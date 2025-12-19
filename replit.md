# Saudi ANPR - License Plate Detector

## Overview
A single-page web application for detecting Saudi license plates. Users can upload images and get instant detection results with confidence visualization and optional blur functionality.

## Architecture

### Frontend (React + TypeScript)
- **Path**: `client/src/`
- **Framework**: React with TypeScript, Vite bundler
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks, TanStack Query for API calls

### Backend
Uses external API hosted at: `https://realtime-object-detection-cv2025.onrender.com`
- `/api/detect` - License plate detection
- `/api/detect-and-blur` - Detection with blur

### Key Files
- `client/src/pages/home.tsx` - Main detection UI
- `client/src/App.tsx` - App router
- `shared/schema.ts` - Shared TypeScript types

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
node ./dist/index.cjs
```

## Deployment Notes
- Frontend-only deployment using Node.js server
- All detection processing handled by external API
- Python backend files excluded via .deployignore

## Future Features
- **OCR**: Extract actual plate text from detected regions
- **Batch Processing**: Multiple image processing

## User Preferences
- Clean, professional UI design
- Real-time loading indicators
- Confidence visualization with color-coded progress bars
