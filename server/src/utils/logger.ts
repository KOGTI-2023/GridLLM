import winston from 'winston';
import { config } from '@/config';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

// Create logger instance
const baseLogger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'llmama-server',
    serverId: config.server.id,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: config.logging.filePath,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: config.logging.filePath.replace('.log', '-error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: config.logging.filePath.replace('.log', '-exceptions.log'),
    }),
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: config.logging.filePath.replace('.log', '-rejections.log'),
    }),
  ],
});

// Extend logger with custom methods
interface ExtendedLogger extends winston.Logger {
  worker: (workerId: string, message: string, meta?: any) => void;
  job: (jobId: string, message: string, meta?: any) => void;
  performance: (message: string, meta?: any) => void;
}

const extendedLogger = baseLogger as ExtendedLogger;

// Worker-specific logging
extendedLogger.worker = (workerId: string, message: string, meta: any = {}) => {
  baseLogger.info(message, { workerId, type: 'worker', ...meta });
};

// Job-specific logging
extendedLogger.job = (jobId: string, message: string, meta: any = {}) => {
  baseLogger.info(message, { jobId, type: 'job', ...meta });
};

// Performance logging
extendedLogger.performance = (message: string, meta: any = {}) => {
  baseLogger.info(message, { type: 'performance', ...meta });
};

export { extendedLogger as logger };
