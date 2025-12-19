# Saudi ANPR - License Plate Detector

## Overview
A single-page web application for detecting Saudi license plates using YOLOv8 AI model. Users can upload images and get instant detection results with confidence visualization.

## Architecture

### Frontend (React + TypeScript)
- **Path**: `client/src/`
- **Framework**: React with TypeScript, Vite bundler
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks, TanStack Query for API calls

### Backend
- **External API**: Detection handled by `https://realtime-object-detection-cv2025.onrender.com`
- **Production**: Static Express server serves frontend from `dist/public/`
- **Development**: Express dev server with Vite HMR

### Key Files
- `client/src/pages/home.tsx` - Main detection UI
- `client/src/App.tsx` - App router
- `server/static-server.ts` - Production static file server
- `script/build.ts` - Build script (Vite + esbuild)
- `shared/schema.ts` - Shared TypeScript types


## API Endpoints

### POST /api/detect
Detect license plates in an uploaded image.

**Request**: multipart/form-data with `file` field
**Accepts**: .jpg, .jpeg, .png, .webp (max 10MB)
**Response**:
```json
{
  "detections": [
    {"bbox": [x1, y1, x2, y2], "conf": 0.93}
  ],
  "image_annotated_base64": "data:image/jpeg;base64,...",
  "image_width": 640,
  "image_height": 480
}
```

### GET /api/health
Check server health status.

## Configuration

### Environment Variables
- `YOLO_WEIGHTS` - Path to ONNX model (default: `./weights/best.onnx`)
- `YOLO_CONF` - Detection confidence threshold (default: 0.25)
- `YOLO_IOU` - NMS IOU threshold (default: 0.50)
- `FASTAPI_PORT` - FastAPI server port (default: 8000)

### Model Weights
Place ONNX model at `./weights/best.onnx`. The app uses ONNX Runtime for ARM-compatible production deployment.

## Running the Application

### Development
```bash
npm run dev
```
This starts Express for development with hot-reload and proxies to FastAPI.

### Production
```bash
npm run build  # Build frontend + static server
npm run start  # Start production server
```
Static Express server serves frontend, API calls go to external backend.

## Deployment Notes
- Frontend calls external API at `https://realtime-object-detection-cv2025.onrender.com`
- Production build creates `dist/index.cjs` (server) and `dist/public/` (assets)
- Node.js static server for Replit deployment

## Future Features
- **OCR**: Extract actual plate text from detected regions
- **Batch Processing**: Multiple image processing

## User Preferences
- Clean, professional UI design
- Real-time loading indicators
- Confidence visualization with color-coded progress bars
