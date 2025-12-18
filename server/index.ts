import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, registerProxyRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { spawn, type ChildProcess } from "child_process";

const app = express();
const httpServer = createServer(app);

// Start FastAPI backend as a child process
let fastapiProcess: ChildProcess | null = null;

function startFastAPI(): Promise<void> {
  return new Promise((resolve) => {
    console.log("Starting FastAPI backend on port 8000...");
    
    fastapiProcess = spawn("python", ["-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    fastapiProcess.stdout?.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[FastAPI] ${message}`);
      }
      // Resolve when uvicorn reports it's running
      if (message.includes("Uvicorn running") || message.includes("Application startup complete")) {
        resolve();
      }
    });

    fastapiProcess.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[FastAPI] ${message}`);
      }
    });

    fastapiProcess.on("error", (err) => {
      console.error("FastAPI process error:", err);
      resolve(); // Continue even if FastAPI fails
    });

    fastapiProcess.on("close", (code) => {
      console.log(`FastAPI process exited with code ${code}`);
      fastapiProcess = null;
    });

    // Resolve after timeout if startup message not detected
    setTimeout(resolve, 5000);
  });
}

// Cleanup FastAPI on exit
process.on("exit", () => {
  if (fastapiProcess) {
    fastapiProcess.kill();
  }
});

process.on("SIGINT", () => {
  if (fastapiProcess) {
    fastapiProcess.kill();
  }
  process.exit();
});

process.on("SIGTERM", () => {
  if (fastapiProcess) {
    fastapiProcess.kill();
  }
  process.exit();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Start FastAPI backend first
  await startFastAPI();
  
  // Register proxy routes BEFORE body parsers (they need raw request body)
  registerProxyRoutes(app);
  
  // Body parsers for regular routes (skip for /api/detect)
  app.use((req, res, next) => {
    // Skip body parsing for proxy routes
    if (req.path.startsWith('/api/detect')) {
      return next();
    }
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  });
  
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/detect')) {
      return next();
    }
    express.urlencoded({ extended: false })(req, res, next);
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
