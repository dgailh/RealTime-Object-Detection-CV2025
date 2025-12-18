import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, AlertTriangle, Image as ImageIcon, X, ScanLine, Shield } from "lucide-react";
import type { Detection, DetectionResponse } from "@shared/schema";

const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
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

  const handleDetect = async () => {
    if (!selectedFile) return;

    setIsDetecting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Detection failed with status ${response.status}`);
      }

      const result: DetectionResponse = await response.json();
      setDetectionResult(result);
      
      toast({
        title: "Detection Complete",
        description: `Found ${result.detections.length} license plate(s)`,
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

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setDetectionResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return "bg-green-500";
    if (conf >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
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
                <div className="absolute bottom-2 left-2 px-3 py-1 bg-background/80 backdrop-blur-sm rounded text-sm text-foreground">
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
              <Switch disabled id="blur-toggle" data-testid="switch-blur" />
              <Label htmlFor="blur-toggle" className="text-muted-foreground opacity-50 cursor-not-allowed">
                Blur plate numbers (coming soon)
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
                    Detection Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detectionResult.image_annotated_base64 && (
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
      </div>
    </div>
  );
}
