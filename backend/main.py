import base64
import os
from pathlib import Path
from typing import List, Dict, Any

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import io
import zipfile
import tempfile
from fastapi.responses import StreamingResponse

WEIGHTS_PATH = os.getenv("YOLO_WEIGHTS", "./weights/best.onnx")
STATIC_DIR = Path(os.getenv("STATIC_DIR", "./dist/public"))
CONF_THRES = float(os.getenv("YOLO_CONF", "0.25"))
IOU_THRES = float(os.getenv("YOLO_IOU", "0.50"))
INPUT_SIZE = 640

app = FastAPI(title="ANPR Plate Detection API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

session = None


@app.on_event("startup")
async def startup_event():
    global session
    if not os.path.exists(WEIGHTS_PATH):
        raise RuntimeError(f"Model weights not found at {WEIGHTS_PATH}")
    print(f"Loading ONNX model from {WEIGHTS_PATH}...")
    session = ort.InferenceSession(WEIGHTS_PATH,
                                   providers=['CPUExecutionProvider'])
    print("ONNX model loaded successfully")


def _load_image_from_upload(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(
            "Could not decode image. Supported: jpg/jpeg/png/webp.")
    return img

def _is_image_file(name: str) -> bool:
    ext = os.path.splitext(name.lower())[1]
    return ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]

# Zip method 
@app.post("/api/blur-zip")
async def blur_zip(file: UploadFile = File(...)):
    """
    Accepts a ZIP (<100MB), extracts all images (even in nested folders),
    detects plates, blurs them, and returns a ZIP for download.
    """
    global session
    if session is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    # 100MB limit
    MAX_BYTES = 100 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="ZIP too large (max 100MB)")

    # Validate it's a zip
    try:
        zin = zipfile.ZipFile(io.BytesIO(content))
        _ = zin.infolist()
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")

    # Build output zip in memory (ok for <=100MB input)
    out_buf = io.BytesIO()
    processed_count = 0
    skipped_count = 0

    with zipfile.ZipFile(out_buf, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            # Skip directories
            if info.is_dir():
                continue

            # Protect against zip-slip paths
            name = info.filename.replace("\\", "/")
            if name.startswith("/") or ".." in name.split("/"):
                skipped_count += 1
                continue

            if not _is_image_file(name):
                skipped_count += 1
                continue

            img_bytes = zin.read(info)
            # Decode image
            try:
                img = _load_image_from_upload(img_bytes)
            except Exception:
                skipped_count += 1
                continue

            h, w = img.shape[:2]
            blob, scale, pad_x, pad_y = _preprocess(img)
            input_name = session.get_inputs()[0].name
            output = session.run(None, {input_name: blob})
            detections = _postprocess(output[0], w, h, scale, pad_x, pad_y)

            # Blur detected plates
            blurred = _blur_regions(img, detections, ksize=91)

            # Re-encode (keep same extension where possible)
            ext = os.path.splitext(name.lower())[1]
            if ext in [".jpg", ".jpeg"]:
                ok, enc = cv2.imencode(".jpg", blurred, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            elif ext == ".png":
                ok, enc = cv2.imencode(".png", blurred)
            elif ext == ".webp":
                ok, enc = cv2.imencode(".webp", blurred, [int(cv2.IMWRITE_WEBP_QUALITY), 90])
            else:
                # fallback jpg
                ok, enc = cv2.imencode(".jpg", blurred, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
                name = os.path.splitext(name)[0] + ".jpg"

            if not ok:
                skipped_count += 1
                continue

            # Write back into the zip preserving folders
            zout.writestr(name, enc.tobytes())
            processed_count += 1

        # Add a small report file
        report = (
            f"Processed images: {processed_count}\n"
            f"Skipped files: {skipped_count}\n"
            f"conf_threshold: {CONF_THRES}\n"
            f"iou_threshold: {IOU_THRES}\n"
        )
        zout.writestr("blur_report.txt", report)

    out_buf.seek(0)

    headers = {
        "Content-Disposition": 'attachment; filename="blurred_images.zip"'
    }
    return StreamingResponse(out_buf, media_type="application/zip", headers=headers)


def _preprocess(img_bgr: np.ndarray):
    """Preprocess image for YOLO ONNX model."""
    h, w = img_bgr.shape[:2]
    scale = min(INPUT_SIZE / w, INPUT_SIZE / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img_bgr, (new_w, new_h))

    padded = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
    pad_x, pad_y = (INPUT_SIZE - new_w) // 2, (INPUT_SIZE - new_h) // 2
    padded[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized

    blob = padded.astype(np.float32) / 255.0
    blob = blob.transpose(2, 0, 1)
    blob = np.expand_dims(blob, axis=0)

    return blob, scale, pad_x, pad_y


def _nms(boxes: np.ndarray, scores: np.ndarray,
         iou_threshold: float) -> List[int]:
    """Non-maximum suppression."""
    if len(boxes) == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)

    order = scores.argsort()[::-1]
    keep = []

    while len(order) > 0:
        i = order[0]
        keep.append(i)

        if len(order) == 1:
            break

        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h

        iou = inter / (areas[i] + areas[order[1:]] - inter)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]

    return keep


def _postprocess(output: np.ndarray, orig_w: int, orig_h: int, scale: float,
                 pad_x: int, pad_y: int) -> List[Dict[str, Any]]:
    """Post-process YOLO ONNX output to get detections."""
    predictions = output[0]

    if predictions.shape[0] == 1:
        predictions = predictions[0]

    if predictions.shape[0] < predictions.shape[1]:
        predictions = predictions.T

    boxes = []
    scores = []

    for pred in predictions:
        if len(pred) >= 5:
            cx, cy, w, h = pred[0], pred[1], pred[2], pred[3]
            conf = pred[4] if len(pred) == 5 else np.max(pred[4:])

            if conf < CONF_THRES:
                continue

            x1 = cx - w / 2
            y1 = cy - h / 2
            x2 = cx + w / 2
            y2 = cy + h / 2

            x1 = (x1 - pad_x) / scale
            y1 = (y1 - pad_y) / scale
            x2 = (x2 - pad_x) / scale
            y2 = (y2 - pad_y) / scale

            x1 = max(0, min(orig_w, x1))
            y1 = max(0, min(orig_h, y1))
            x2 = max(0, min(orig_w, x2))
            y2 = max(0, min(orig_h, y2))

            if x2 > x1 and y2 > y1:
                boxes.append([x1, y1, x2, y2])
                scores.append(conf)

    if len(boxes) == 0:
        return []

    boxes = np.array(boxes)
    scores = np.array(scores)
    keep = _nms(boxes, scores, IOU_THRES)

    detections = []
    for i in keep:
        detections.append({
            "bbox": [
                int(boxes[i][0]),
                int(boxes[i][1]),
                int(boxes[i][2]),
                int(boxes[i][3])
            ],
            "conf":
            float(scores[i])
        })

    return detections


def _annotate_image(img_bgr: np.ndarray,
                    detections: List[Dict[str, Any]]) -> np.ndarray:
    out = img_bgr.copy()
    for i, det in enumerate(detections, 1):
        x1, y1, x2, y2 = det["bbox"]
        conf = det["conf"]
        color = (0, 255,
                 0) if conf >= 0.8 else (0, 255,
                                         255) if conf >= 0.5 else (0, 0, 255)
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        label = f"Plate {i}: {conf:.2f}"
        cv2.putText(out, label, (x1, max(0, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, color, 2)
    return out


def _bgr_to_base64_jpeg(img_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", img_bgr,
                           [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise ValueError("Failed to encode annotated image.")
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    return "data:image/jpeg;base64," + b64


def _blur_regions(img_bgr: np.ndarray,
                  detections: List[Dict[str, Any]],
                  ksize: int = 35) -> np.ndarray:
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
        "model_loaded": session is not None
    }


@app.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    global session

    if session is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    content = await file.read()
    try:
        img = _load_image_from_upload(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = img.shape[:2]

    blob, scale, pad_x, pad_y = _preprocess(img)
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: blob})
    detections = _postprocess(output[0], w, h, scale, pad_x, pad_y)

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


@app.post("/api/detect-and-blur")
async def detect_and_blur(file: UploadFile = File(...)):
    global session

    if session is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    content = await file.read()
    try:
        img = _load_image_from_upload(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = img.shape[:2]

    blob, scale, pad_x, pad_y = _preprocess(img)
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: blob})
    detections = _postprocess(output[0], w, h, scale, pad_x, pad_y)

    blurred = _blur_regions(img, detections, ksize=91)
    blurred_b64 = _bgr_to_base64_jpeg(blurred)

    return {
        "image_width": w,
        "image_height": h,
        "conf_threshold": CONF_THRES,
        "iou_threshold": IOU_THRES,
        "detections": detections,
        "image_blurred_base64": blurred_b64
    }


@app.get("/api/health")
def api_health():
    return health()


if STATIC_DIR.exists():
    app.mount("/assets",
              StaticFiles(directory=STATIC_DIR / "assets"),
              name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

