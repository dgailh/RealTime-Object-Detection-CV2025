import base64
import os
from typing import List, Dict, Any

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

WEIGHTS_PATH = os.getenv("YOLO_WEIGHTS", "./weights/best.pt")
CONF_THRES = float(os.getenv("YOLO_CONF", "0.25"))
IOU_THRES = float(os.getenv("YOLO_IOU", "0.50"))

app = FastAPI(title="ANPR Plate Detection API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None

@app.on_event("startup")
async def startup_event():
    global model
    if not os.path.exists(WEIGHTS_PATH):
        raise RuntimeError(f"Model weights not found at {WEIGHTS_PATH}")
    print(f"Loading YOLOv8 model from {WEIGHTS_PATH}...")
    model = YOLO(WEIGHTS_PATH)
    print("Model loaded successfully")

def _load_image_from_upload(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image. Supported: jpg/jpeg/png/webp.")
    return img

def _annotate_image(img_bgr: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    out = img_bgr.copy()
    for i, det in enumerate(detections, 1):
        x1, y1, x2, y2 = det["bbox"]
        conf = det["conf"]
        color = (0, 255, 0) if conf >= 0.8 else (0, 255, 255) if conf >= 0.5 else (0, 0, 255)
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        label = f"Plate {i}: {conf:.2f}"
        cv2.putText(out, label, (x1, max(0, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    return out

def _bgr_to_base64_jpeg(img_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise ValueError("Failed to encode annotated image.")
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    return "data:image/jpeg;base64," + b64

def _blur_regions(img_bgr: np.ndarray, detections: List[Dict[str, Any]], ksize: int = 35) -> np.ndarray:
    """Blur detected regions in the image. ksize must be odd and >= 3."""
    out = img_bgr.copy()
    if ksize % 2 == 0:
        ksize += 1
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        roi = out[y1:y2, x1:x2]
        if roi.size == 0:
            continue
        roi_blur = cv2.GaussianBlur(roi, (ksize, ksize), 0)
        out[y1:y2, x1:x2] = roi_blur
    return out

@app.get("/health")
def health():
    return {
        "status": "ok",
        "weights": WEIGHTS_PATH,
        "model_loaded": model is not None
    }

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    global model

    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    content = await file.read()
    try:
        img = _load_image_from_upload(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = img.shape[:2]

    results = model.predict(img, conf=CONF_THRES, iou=IOU_THRES, verbose=False)
    detections: List[Dict[str, Any]] = []
    if results and results[0].boxes is not None and len(results[0].boxes) > 0:
        boxes_xyxy = results[0].boxes.xyxy.cpu().numpy()
        confs = results[0].boxes.conf.cpu().numpy()
        for (x1, y1, x2, y2), c in zip(boxes_xyxy, confs):
            detections.append({
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "conf": float(c)
            })

    annotated = _annotate_image(img, detections)
    annotated_b64 = _bgr_to_base64_jpeg(annotated)

    return {
        "image_width": w,
        "image_height": h,
        "conf_threshold": CONF_THRES,
        "iou_threshold": IOU_THRES,
        "detections": detections,
        "image_annotated_base64": annotated_b64
    }

@app.post("/detect-and-blur")
async def detect_and_blur(file: UploadFile = File(...)):
    global model

    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    content = await file.read()
    try:
        img = _load_image_from_upload(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = img.shape[:2]

    results = model.predict(img, conf=CONF_THRES, iou=IOU_THRES, verbose=False)
    detections: List[Dict[str, Any]] = []
    if results and results[0].boxes is not None and len(results[0].boxes) > 0:
        boxes_xyxy = results[0].boxes.xyxy.cpu().numpy()
        confs = results[0].boxes.conf.cpu().numpy()
        for (x1, y1, x2, y2), c in zip(boxes_xyxy, confs):
            detections.append({
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "conf": float(c)
            })

    blurred = _blur_regions(img, detections, ksize=41)
    blurred_b64 = _bgr_to_base64_jpeg(blurred)

    return {
        "image_width": w,
        "image_height": h,
        "conf_threshold": CONF_THRES,
        "iou_threshold": IOU_THRES,
        "detections": detections,
        "image_blurred_base64": blurred_b64
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("FASTAPI_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
