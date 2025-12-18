def _blur_regions(img_bgr: np.ndarray, detections: List[Dict[str, Any]], ksize: int = 35) -> np.ndarray:
    """
    Blur detected regions in the image.
    ksize must be odd and >= 3.
    """
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
