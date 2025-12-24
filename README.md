## PlateSafe – Real-Time License Plate Privacy System

A privacy-preserving computer vision system developed for
EMAI651 – Computer Vision.

PlateSafe automatically detects and blurs vehicle license plates in images to protect user privacy, particularly for online car sale listings and image sharing platforms.

🌐 Live Demo:
https://recipe-builder--dgailhomary.replit.app/

## Features
- License plate detection using YOLOv8
- Base training on a large generic plate dataset
- Fine-tuning on Saudi vehicle images
- Automatic license plate **blurring (anonymization)**
- Batch processing (multiple images / ZIP upload)
- Experimental OCR (ANPR) **not deployed** for privacy reasons
- Quantitative and qualitative evaluation

## Tech Stack
- Python
- YOLOv8 (Ultralytics, PyTorch)
- OpenCV
- ONNX Runtime
- Google Colab (training)
- Replit (frontend)
- Render (backend)

## Results (Detection)
| Metric        | Value      |
| ------------- | ---------- |
| Precision     | **0.9066** |
| Recall        | **0.9471** |
| mAP@0.50      | **0.9458** |
| mAP@0.50–0.95 | **0.8028** |

> Note: Performance was strong on the evaluation dataset, with reduced generalization on highly diverse unseen images due to limited dataset diversity.

## Repository Structure

- **main**
Backend implementation: model inference, preprocessing, blurring logic, and deployment files.
- **replit-agent**
Frontend files generated and managed through Replit integration.

## Notes
- Project is for academic and educational purposes
