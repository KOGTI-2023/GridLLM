import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { BrokerClientService } from '@/services/BrokerClientService';
import { healthRoutes } from '@/routes/health';
import { errorHandler } from '@/middleware/errorHandler';

class Application {
  private app: express.Application;
  private brokerClient: BrokerClientService;
  private server: any;

  constructor() {
    this.app = express();
    this.brokerClient = new BrokerClientService();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // General middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Public routes
    this.app.use('/health', healthRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'LLMama Broker Client',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private setupEventHandlers(): void {
    // Broker client events
    this.brokerClient.on('connected', () => {
      logger.info('Broker client connected');
    });

    this.brokerClient.on('disconnected', () => {
      logger.warn('Broker client disconnected');
    });

    this.brokerClient.on('connection_error', () => {
      logger.error('Broker client connection error');
    });

    this.brokerClient.on('reconnected', () => {
      logger.info('Broker client reconnected');
    });

    this.brokerClient.on('max_reconnect_attempts_reached', () => {
      logger.error('Max reconnect attempts reached, shutting down');
      this.shutdown();
    });

    this.brokerClient.on('shutdown_requested', () => {
      logger.info('Shutdown requested by broker');
      this.shutdown();
    });

    // Process events
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      this.shutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      this.shutdown(1);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting application');

      // Initialize and start broker client
      await this.brokerClient.initialize();
      await this.brokerClient.start();

      // Start HTTP server
      this.server = this.app.listen(config.port, () => {
        logger.info('Application started successfully', {
          port: config.port,
          env: config.env,
          workerId: config.worker.id,
        });
      });

      this.server.on('error', (error: any) => {
        logger.error('Server error', error);
        this.shutdown(1);
      });

    } catch (error) {
      logger.error('Failed to start application', error);
      throw error;
    }
  }

  async shutdown(exitCode: number = 0): Promise<void> {
    logger.info('Shutting down application', { exitCode });

    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // Stop broker client
      await this.brokerClient.stop();

      logger.info('Application shutdown complete');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  getBrokerClient(): BrokerClientService {
    return this.brokerClient;
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  const app = new Application();
  
  app.start().catch((error) => {
    logger.error('Failed to start application', error);
    process.exit(1);
  });
}

export default Application;
