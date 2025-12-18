#!/bin/bash

# Start FastAPI backend in background
echo "Starting FastAPI backend on port 8000..."
python backend/main.py &
FASTAPI_PID=$!

# Wait for FastAPI to be ready
echo "Waiting for FastAPI to start..."
sleep 3

# Start Node.js frontend (Vite dev server)
echo "Starting Node.js frontend on port 5000..."
npm run dev

# Cleanup FastAPI on exit
trap "kill $FASTAPI_PID 2>/dev/null" EXIT
