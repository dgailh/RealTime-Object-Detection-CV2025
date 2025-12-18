"""
Saudi ANPR - License Plate Detection Backend
FastAPI server for YOLOv8 inference on uploaded images
"""

import os
import io
import base64
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
from PIL import Image

# Check for ultralytics availability (YOLOv8)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("Warning: ultralytics not installed. Using mock detection.")

# Configuration
WEIGHTS_PATH = os.environ.get("YOLO_WEIGHTS_PATH", "./weights/best.pt")
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.25"))
DEVICE = os.environ.get("YOLO_DEVICE", "auto")  # 'auto', 'cpu', 'cuda', 'mps'

# Accepted file types
ACCEPTED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

app = FastAPI(
    title="Saudi ANPR API",
    description="License Plate Detection API using YOLOv8",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Response models
class Detection(BaseModel):
    bbox: List[float]  # [x1, y1, x2, y2]
    conf: float

class DetectionResponse(BaseModel):
    detections: List[Detection]
    image_annotated_base64: str
    image_width: Optional[int] = None
    image_height: Optional[int] = None

# Global model reference
model = None

def load_model():
    """Load YOLOv8 model at startup"""
    global model
    
    if not YOLO_AVAILABLE:
        print("YOLOv8 not available - running in mock mode")
        return None
    
    if not os.path.exists(WEIGHTS_PATH):
        print(f"Warning: Model weights not found at {WEIGHTS_PATH}")
        print("Running in mock mode. Please provide valid weights.")
        return None
    
    try:
        print(f"Loading YOLOv8 model from {WEIGHTS_PATH}...")
        model = YOLO(WEIGHTS_PATH)
        
        # Set device
        if DEVICE == "auto":
            # Auto-detect best device
            import torch
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
        else:
            device = DEVICE
        
        print(f"Model loaded successfully on device: {device}")
        return model
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

@app.on_event("startup")
async def startup_event():
    """Load model when server starts"""
    load_model()

def draw_bboxes(image: np.ndarray, detections: List[Detection]) -> np.ndarray:
    """Draw bounding boxes on image"""
    annotated = image.copy()
    
    for i, det in enumerate(detections):
        x1, y1, x2, y2 = [int(c) for c in det.bbox]
        conf = det.conf
        
        # Color based on confidence (green to red)
        if conf >= 0.8:
            color = (0, 255, 0)  # Green
        elif conf >= 0.5:
            color = (0, 255, 255)  # Yellow
        else:
            color = (0, 0, 255)  # Red
        
        # Draw rectangle
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
        
        # Draw label background
        label = f"Plate #{i+1}: {conf*100:.1f}%"
        (label_width, label_height), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
        )
        
        # Position label above or below box
        label_y = y1 - 10 if y1 > 30 else y2 + label_height + 10
        
        cv2.rectangle(
            annotated,
            (x1, label_y - label_height - 5),
            (x1 + label_width + 10, label_y + 5),
            color,
            -1
        )
        
        # Draw text
        cv2.putText(
            annotated,
            label,
            (x1 + 5, label_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 0),  # Black text
            2
        )
    
    return annotated

def mock_detection(image: np.ndarray) -> List[Detection]:
    """
    Mock detection for testing when model is not available.
    Returns random-ish detections based on image size.
    """
    h, w = image.shape[:2]
    
    # Generate a "detection" in the center-bottom area (typical plate location)
    x1 = int(w * 0.25)
    y1 = int(h * 0.6)
    x2 = int(w * 0.75)
    y2 = int(h * 0.85)
    
    return [
        Detection(
            bbox=[float(x1), float(y1), float(x2), float(y2)],
            conf=0.87
        )
    ]

def run_inference(image: np.ndarray) -> List[Detection]:
    """Run YOLOv8 inference on image"""
    global model
    
    if model is None:
        # Mock mode
        return mock_detection(image)
    
    # Run inference
    results = model(image, conf=CONFIDENCE_THRESHOLD, verbose=False)
    
    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is not None:
            for box in boxes:
                # Get bounding box coordinates
                xyxy = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                
                detections.append(Detection(
                    bbox=[float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3])],
                    conf=conf
                ))
    
    # Sort by confidence (highest first)
    detections.sort(key=lambda x: x.conf, reverse=True)
    
    return detections

# TODO: Future blur logic will be added here
# def blur_plates(image: np.ndarray, detections: List[Detection]) -> np.ndarray:
#     """Apply blur to detected license plate regions"""
#     blurred = image.copy()
#     for det in detections:
#         x1, y1, x2, y2 = [int(c) for c in det.bbox]
#         roi = blurred[y1:y2, x1:x2]
#         blurred_roi = cv2.GaussianBlur(roi, (51, 51), 0)
#         blurred[y1:y2, x1:x2] = blurred_roi
#     return blurred

@app.post("/detect", response_model=DetectionResponse)
async def detect_plates(file: UploadFile = File(...)):
    """
    Detect license plates in uploaded image.
    
    Accepts: JPG, JPEG, PNG, WebP images
    Returns: Detection results with annotated image
    """
    # Validate file type
    content_type = file.content_type
    if content_type not in ACCEPTED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {content_type}. Accepted types: {', '.join(ACCEPTED_TYPES)}"
        )
    
    try:
        # Read file contents
        contents = await file.read()
        
        # Convert to numpy array
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=400,
                detail="Could not decode image. Please upload a valid image file."
            )
        
        # Get image dimensions
        height, width = image.shape[:2]
        
        # Run detection
        detections = run_inference(image)
        
        # Draw bounding boxes
        annotated_image = draw_bboxes(image, detections)
        
        # Convert annotated image to base64
        # Convert BGR to RGB for proper color display
        annotated_rgb = cv2.cvtColor(annotated_image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(annotated_rgb)
        
        # Save to bytes
        buffer = io.BytesIO()
        pil_image.save(buffer, format="JPEG", quality=90)
        buffer.seek(0)
        
        # Encode to base64
        base64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
        annotated_base64 = f"data:image/jpeg;base64,{base64_image}"
        
        return DetectionResponse(
            detections=detections,
            image_annotated_base64=annotated_base64,
            image_width=width,
            image_height=height
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Detection error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "yolo_available": YOLO_AVAILABLE
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("FASTAPI_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
