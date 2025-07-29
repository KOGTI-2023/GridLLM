import { Router, Request, Response } from "express";
import { config } from "@/config";
import { logger } from "@/utils/logger";

const router = Router();

// Basic health check
router.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "llmama-worker",
    workerId: config.worker.id,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Liveness probe
router.get("/live", (req: Request, res: Response) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe
router.get("/ready", (req: Request, res: Response) => {
  // Simple readiness check - if the process is running, we're ready
  res.json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
});

// System info
router.get("/system", (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();

  res.json({
    worker: {
      id: config.worker.id,
      status: "running",
      uptime: process.uptime(),
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
    },
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRoutes };
