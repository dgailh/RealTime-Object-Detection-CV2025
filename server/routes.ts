import type { Express, Request, Response } from "express";
import { type Server } from "http";
import http from "http";
import { storage } from "./storage";

const FASTAPI_PORT = process.env.FASTAPI_PORT || "8000";
const FASTAPI_URL = `http://127.0.0.1:${FASTAPI_PORT}`;

// Register proxy routes - must be called BEFORE body parsers
export function registerProxyRoutes(app: Express): void {
  // Manual proxy for detect endpoint using http.request
  app.post('/api/detect', (req: Request, res: Response) => {
    const options = {
      hostname: '127.0.0.1',
      port: parseInt(FASTAPI_PORT),
      path: '/detect',
      method: 'POST',
      headers: {
        ...req.headers,
        host: `127.0.0.1:${FASTAPI_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.status(503).json({
        detail: 'Detection service unavailable. Please try again later.',
      });
    });

    // Pipe the incoming request body to the proxy request
    req.pipe(proxyReq, { end: true });
  });

  // Proxy for detect-and-blur endpoint
  app.post('/api/detect-and-blur', (req: Request, res: Response) => {
    const options = {
      hostname: '127.0.0.1',
      port: parseInt(FASTAPI_PORT),
      path: '/detect-and-blur',
      method: 'POST',
      headers: {
        ...req.headers,
        host: `127.0.0.1:${FASTAPI_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.status(503).json({
        detail: 'Detection service unavailable. Please try again later.',
      });
    });

    req.pipe(proxyReq, { end: true });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint that also checks FastAPI
  app.get("/api/health", async (req, res) => {
    try {
      const response = await fetch(`${FASTAPI_URL}/health`);
      const data = await response.json();
      res.json({
        express: "healthy",
        fastapi: data,
      });
    } catch (error) {
      res.json({
        express: "healthy",
        fastapi: "unavailable",
      });
    }
  });

  return httpServer;
}
