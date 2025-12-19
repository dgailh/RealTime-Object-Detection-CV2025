@app.post("/detect-and-blur")
async def detect_and_blur(file: UploadFile = File(...)):
    global model

    if model is None:
        if not os.path.exists(WEIGHTS_PATH):
            raise HTTPException(status_code=500, detail=f"Model weights not found: {WEIGHTS_PATH}")
        model = YOLO(WEIGHTS_PATH)

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

    # Apply blur
    blurred = _blur_regions(img, detections, ksize=41)

    blurred_b64 = _bgr_to_base64_jpeg(blurred)

    return {
        "image_width": w,
        "image_height": h,
        "detections": detections,
        "image_blurred_base64": blurred_b64
    }
