import { Router, Request, Response } from 'express';
import { OllamaService } from '@/services/OllamaService';
import { RedisConnectionManager } from '@/services/RedisConnectionManager';
import { logger } from '@/utils/logger';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ollamaService = new OllamaService();
const redisManager = RedisConnectionManager.getInstance();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    ollama: boolean;
    redis: boolean;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

// Basic health check
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Check Ollama service
    const ollamaHealthy = await ollamaService.checkHealth();
    
    // Check Redis connection
    const redisHealthy = await redisManager.ping();
    
    // Get system info
    const systemResources = await ollamaService.getSystemResources();
    
    const responseTime = Date.now() - startTime;
    
    const health: HealthStatus = {
      status: ollamaHealthy && redisHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        ollama: ollamaHealthy,
        redis: redisHealthy,
      },
      system: {
        memory: {
          used: systemResources.totalMemoryMB - systemResources.availableMemoryMB,
          total: systemResources.totalMemoryMB,
          percentage: systemResources.memoryUsagePercent,
        },
        cpu: {
          usage: systemResources.cpuUsagePercent,
        },
      },
    };

    logger.debug('Health check completed', {
      status: health.status,
      responseTime,
      services: health.services,
    });

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      ...health,
      responseTime,
    });
  } catch (error) {
    logger.error('Health check failed', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    });
  }
}));

// Liveness probe (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  try {
    const ollamaHealthy = await ollamaService.checkHealth();
    const redisHealthy = await redisManager.ping();
    
    if (ollamaHealthy && redisHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          ollama: ollamaHealthy,
          redis: redisHealthy,
        },
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          ollama: ollamaHealthy,
          redis: redisHealthy,
        },
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Detailed system info
router.get('/system', asyncHandler(async (req: Request, res: Response) => {
  try {
    const systemResources = await ollamaService.getSystemResources();
    const models = await ollamaService.getAvailableModels();
    const ollamaStatus = ollamaService.getConnectionStatus();
    const redisStatus = redisManager.getConnectionStatus();

    res.json({
      timestamp: new Date().toISOString(),
      system: systemResources,
      models: {
        count: models.length,
        list: models.map(model => ({
          name: model.name,
          size: model.size,
          modified_at: model.modified_at,
        })),
      },
      connections: {
        ollama: ollamaStatus,
        redis: redisStatus,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    logger.error('System info request failed', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}));

export { router as healthRoutes };
