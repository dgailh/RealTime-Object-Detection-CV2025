import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, AlertTriangle, Image as ImageIcon, X, ScanLine, Shield, FolderArchive, Download, CheckCircle } from "lucide-react";
import type { Detection, DetectionResponse } from "@shared/schema";

const API_BASE = "https://realtime-object-detection-cv2025.onrender.com";
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ZIP_SIZE = 100 * 1024 * 1024;

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurredImageUrl, setBlurredImageUrl] = useState<string | null>(null);
  
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipSuccess, setZipSuccess] = useState(false);
  const [zipDragOver, setZipDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return "Invalid file type. Please upload a JPG, PNG, or WebP image.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File is too large. Maximum size is 10MB.";
    }
    return null;
  };

  const validateZipFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      return "Invalid file type. Please upload a ZIP file.";
    }
    if (file.size > MAX_ZIP_SIZE) {
      return "File is too large. Maximum size is 100MB.";
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setError(null);
    setDetectionResult(null);
    setSelectedFile(file);
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, [toast]);

  const handleZipSelect = useCallback((file: File) => {
    const validationError = validateZipFile(file);
    if (validationError) {
      setZipError(validationError);
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setZipError(null);
    setZipSuccess(false);
    setZipFile(file);
  }, [toast]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleZipSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleZipDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setZipDragOver(true);
  };

  const handleZipDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setZipDragOver(false);
  };

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setZipDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleZipSelect(file);
    }
  };

  const handleDetect = async () => {
    if (!selectedFile) return;

    setIsDetecting(true);
    setError(null);
    setBlurredImageUrl(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE}/api/detect`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Detection failed with status ${response.status}`);
      }

      const result: DetectionResponse = await response.json();
      setDetectionResult(result);

      if (blurEnabled && result.detections.length > 0) {
        const blurFormData = new FormData();
        blurFormData.append("file", selectedFile);

        const blurResponse = await fetch(`${API_BASE}/api/detect-and-blur`, {
          method: "POST",
          body: blurFormData,
        });

        if (blurResponse.ok) {
          const blurResult = await blurResponse.json();
          setBlurredImageUrl(blurResult.image_blurred_base64);
        }
      }
      
      toast({
        title: "Detection Complete",
        description: `Found ${result.detections.length} license plate(s)${blurEnabled && result.detections.length > 0 ? " - plates blurred" : ""}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      toast({
        title: "Detection Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleProcessZip = async () => {
    if (!zipFile) return;

    setIsProcessingZip(true);
    setZipError(null);
    setZipSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", zipFile);

      const response = await fetch(`${API_BASE}/api/blur-zip`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Processing failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blurred_images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setZipSuccess(true);
      toast({
        title: "Processing Complete",
        description: "Your blurred images ZIP has been downloaded.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setZipError(message);
      toast({
        title: "Processing Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingZip(false);
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setDetectionResult(null);
    setError(null);
    setBlurredImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearZip = () => {
    setZipFile(null);
    setZipError(null);
    setZipSuccess(false);
    if (zipInputRef.current) {
      zipInputRef.current.value = "";
    }
  };

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return "bg-green-500";
    if (conf >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <header className="text-center py-8 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground" data-testid="text-title">
              Saudi ANPR
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-subtitle">
            License Plate Detector
          </p>
          <p className="text-sm text-muted-foreground">
            Upload an image to detect Saudi license plates using advanced AI detection
          </p>
        </header>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="single" className="gap-2" data-testid="tab-single">
              <ImageIcon className="w-4 h-4" />
              Single Image
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-2" data-testid="tab-batch">
              <FolderArchive className="w-4 h-4" />
              Batch Processing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-8 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Image
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                  data-testid="input-file"
                />

                {!previewUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      relative h-48 border-2 border-dashed rounded-lg cursor-pointer
                      flex flex-col items-center justify-center gap-4
                      transition-colors duration-200
                      ${isDragOver 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                      }
                    `}
                    data-testid="dropzone"
                  >
                    <Upload className="w-12 h-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium text-foreground">
                        Drop an image here or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Supports JPG, PNG, WebP (max 10MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Selected image preview"
                      className="w-full h-auto max-h-64 object-contain rounded-lg border bg-muted/20"
                      data-testid="img-preview"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={handleClear}
                      className="absolute top-2 right-2"
                      data-testid="button-clear"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <div className="absolute bottom-2 left-2 right-12 px-3 py-1 bg-background/80 backdrop-blur-sm rounded text-sm text-foreground truncate">
                      {selectedFile?.name}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                  <Button
                    onClick={handleDetect}
                    disabled={!selectedFile || isDetecting}
                    size="lg"
                    className="w-full sm:w-auto px-8"
                    data-testid="button-detect"
                  >
                    {isDetecting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-5 h-5" />
                        Detect Plates
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-3 pt-4 border-t">
                  <Switch 
                    id="blur-toggle" 
                    checked={blurEnabled}
                    onCheckedChange={setBlurEnabled}
                    data-testid="switch-blur" 
                  />
                  <Label htmlFor="blur-toggle" className="text-foreground cursor-pointer">
                    Blur detected plates
                  </Label>
                </div>
              </CardContent>
            </Card>

            {isDetecting && (
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <Card className="p-8 text-center space-y-4">
                  <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
                  <p className="text-lg font-medium text-foreground">Detecting plates...</p>
                  <p className="text-sm text-muted-foreground">This may take a few seconds</p>
                </Card>
              </div>
            )}

            {error && !isDetecting && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-8 h-8 text-destructive shrink-0" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">Detection Error</h3>
                      <p className="text-sm text-muted-foreground">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setError(null)}
                        className="mt-2"
                        data-testid="button-dismiss-error"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {detectionResult && !isDetecting && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        Original Image
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt="Original uploaded image"
                          className="w-full h-auto rounded-lg object-contain max-h-80"
                          data-testid="img-original"
                        />
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ScanLine className="w-5 h-5" />
                        {blurredImageUrl ? "Blurred Result" : "Detection Results"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {blurredImageUrl ? (
                        <img
                          src={blurredImageUrl}
                          alt="Image with license plates blurred"
                          className="w-full h-auto rounded-lg object-contain max-h-80"
                          data-testid="img-blurred"
                        />
                      ) : detectionResult.image_annotated_base64 && (
                        <img
                          src={detectionResult.image_annotated_base64}
                          alt="Image with detected license plates highlighted"
                          className="w-full h-auto rounded-lg object-contain max-h-80"
                          data-testid="img-annotated"
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Detected Plates ({detectionResult.detections.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detectionResult.detections.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <ImageIcon className="w-16 h-16 text-muted-foreground mx-auto opacity-50" />
                        <div>
                          <h3 className="font-medium text-foreground">No Plates Detected</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            No license plates were found in this image. Try uploading a different image with clearer license plates.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {detectionResult.detections.map((detection: Detection, index: number) => {
                          const confidencePercent = Math.round(detection.conf * 100);
                          return (
                            <div
                              key={index}
                              className="p-4 rounded-lg bg-muted/30 border space-y-3"
                              data-testid={`card-detection-${index}`}
                            >
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <span className="font-medium text-foreground" data-testid={`text-plate-label-${index}`}>
                                  Plate #{index + 1}
                                </span>
                                <span className="font-mono text-sm text-muted-foreground" data-testid={`text-confidence-${index}`}>
                                  {confidencePercent}% confidence
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(detection.conf)}`}
                                    style={{ width: `${confidencePercent}%` }}
                                    role="progressbar"
                                    aria-valuenow={confidencePercent}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    data-testid={`progress-confidence-${index}`}
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                Bounding Box: [{detection.bbox.map(Math.round).join(", ")}]
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="batch" className="space-y-8 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5" />
                  Batch Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a ZIP file containing images. All license plates will be automatically detected and blurred. 
                  You'll receive a new ZIP file with the processed images.
                </p>

                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={handleZipInputChange}
                  className="hidden"
                  data-testid="input-zip"
                />

                {!zipFile ? (
                  <div
                    onClick={() => zipInputRef.current?.click()}
                    onDragOver={handleZipDragOver}
                    onDragLeave={handleZipDragLeave}
                    onDrop={handleZipDrop}
                    className={`
                      relative h-48 border-2 border-dashed rounded-lg cursor-pointer
                      flex flex-col items-center justify-center gap-4
                      transition-colors duration-200
                      ${zipDragOver 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                      }
                    `}
                    data-testid="dropzone-zip"
                  >
                    <FolderArchive className="w-12 h-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium text-foreground">
                        Drop a ZIP file here or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Maximum file size: 100MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <FolderArchive className="w-8 h-8 text-primary" />
                        <div>
                          <p className="font-medium text-foreground truncate max-w-xs" data-testid="text-zip-name">
                            {zipFile.name}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid="text-zip-size">
                            {formatFileSize(zipFile.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearZip}
                        data-testid="button-clear-zip"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-4">
                  <Button
                    onClick={handleProcessZip}
                    disabled={!zipFile || isProcessingZip}
                    size="lg"
                    className="w-full sm:w-auto px-8"
                    data-testid="button-process-zip"
                  >
                    {isProcessingZip ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-5 h-5" />
                        Process and Download
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isProcessingZip && (
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <Card className="p-8 text-center space-y-4 max-w-sm">
                  <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
                  <p className="text-lg font-medium text-foreground">Processing images...</p>
                  <p className="text-sm text-muted-foreground">
                    Detecting and blurring license plates in all images. This may take a while for large files.
                  </p>
                </Card>
              </div>
            )}

            {zipError && !isProcessingZip && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-8 h-8 text-destructive shrink-0" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">Processing Error</h3>
                      <p className="text-sm text-muted-foreground">{zipError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setZipError(null)}
                        className="mt-2"
                        data-testid="button-dismiss-zip-error"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {zipSuccess && !isProcessingZip && (
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">Processing Complete</h3>
                      <p className="text-sm text-muted-foreground">
                        Your blurred images ZIP file has been downloaded. Check your downloads folder.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearZip}
                        className="mt-2"
                        data-testid="button-process-another"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Process Another ZIP
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-3">How It Works</h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">1</span>
                    </div>
                    <p>Upload a ZIP file containing images (JPG, PNG, WebP supported)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">2</span>
                    </div>
                    <p>Our AI automatically detects all license plates in each image</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">3</span>
                    </div>
                    <p>License plates are blurred to protect privacy</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">4</span>
                    </div>
                    <p>Download a new ZIP file with all processed images</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
