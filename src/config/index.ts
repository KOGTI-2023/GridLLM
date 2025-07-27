import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Redis Configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_KEY_PREFIX: Joi.string().default('llmama:'),
  
  // Ollama Configuration
  OLLAMA_HOST: Joi.string().default('localhost'),
  OLLAMA_PORT: Joi.number().default(11434),
  OLLAMA_PROTOCOL: Joi.string().valid('http', 'https').default('http'),
  OLLAMA_TIMEOUT: Joi.number().default(300000),
  OLLAMA_MAX_RETRIES: Joi.number().default(3),
  
  // Broker Configuration
  BROKER_HOST: Joi.string().default('localhost'),
  BROKER_PORT: Joi.number().default(6379),
  BROKER_AUTH_TOKEN: Joi.string().required(),
  BROKER_HEARTBEAT_INTERVAL: Joi.number().default(30000),
  BROKER_RECONNECT_DELAY: Joi.number().default(5000),
  BROKER_MAX_RECONNECT_ATTEMPTS: Joi.number().default(10),
  
  // Worker Configuration
  WORKER_ID: Joi.string().default(`worker-${Math.random().toString(36).substr(2, 9)}`),
  WORKER_CONCURRENCY: Joi.number().default(2),
  WORKER_MAX_CONCURRENT_JOBS: Joi.number().default(5),
  WORKER_POLL_INTERVAL: Joi.number().default(1000),
  WORKER_RESOURCE_CHECK_INTERVAL: Joi.number().default(10000),
  
  // Performance Thresholds
  MAX_CPU_USAGE: Joi.number().default(80),
  MAX_MEMORY_USAGE: Joi.number().default(85),
  MAX_GPU_MEMORY_USAGE: Joi.number().default(90),
  MIN_AVAILABLE_MEMORY_MB: Joi.number().default(1024),
  
  // Security
  JWT_SECRET: Joi.string().required(),
  API_KEY: Joi.string().required(),
  ENCRYPT_SENSITIVE_DATA: Joi.boolean().default(true),
  
  // Monitoring & Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE_PATH: Joi.string().default('./logs/llmama-client.log'),
  METRICS_ENABLED: Joi.boolean().default(true),
  HEALTH_CHECK_INTERVAL: Joi.number().default(60000),
  
  // Task Configuration
  TASK_TIMEOUT: Joi.number().default(600000),
  TASK_RETRY_ATTEMPTS: Joi.number().default(3),
  TASK_RETRY_DELAY: Joi.number().default(5000),
  TASK_PRIORITY_WEIGHTS: Joi.string().default('high:3,medium:2,low:1'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD || undefined,
    db: envVars.REDIS_DB,
    keyPrefix: envVars.REDIS_KEY_PREFIX,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
  },
  
  ollama: {
    host: envVars.OLLAMA_HOST,
    port: envVars.OLLAMA_PORT,
    protocol: envVars.OLLAMA_PROTOCOL,
    timeout: envVars.OLLAMA_TIMEOUT,
    maxRetries: envVars.OLLAMA_MAX_RETRIES,
    baseUrl: `${envVars.OLLAMA_PROTOCOL}://${envVars.OLLAMA_HOST}:${envVars.OLLAMA_PORT}`,
  },
  
  broker: {
    host: envVars.BROKER_HOST,
    port: envVars.BROKER_PORT,
    authToken: envVars.BROKER_AUTH_TOKEN,
    heartbeatInterval: envVars.BROKER_HEARTBEAT_INTERVAL,
    reconnectDelay: envVars.BROKER_RECONNECT_DELAY,
    maxReconnectAttempts: envVars.BROKER_MAX_RECONNECT_ATTEMPTS,
  },
  
  worker: {
    id: envVars.WORKER_ID,
    concurrency: envVars.WORKER_CONCURRENCY,
    maxConcurrentJobs: envVars.WORKER_MAX_CONCURRENT_JOBS,
    pollInterval: envVars.WORKER_POLL_INTERVAL,
    resourceCheckInterval: envVars.WORKER_RESOURCE_CHECK_INTERVAL,
  },
  
  performance: {
    maxCpuUsage: envVars.MAX_CPU_USAGE,
    maxMemoryUsage: envVars.MAX_MEMORY_USAGE,
    maxGpuMemoryUsage: envVars.MAX_GPU_MEMORY_USAGE,
    minAvailableMemoryMB: envVars.MIN_AVAILABLE_MEMORY_MB,
  },
  
  security: {
    jwtSecret: envVars.JWT_SECRET,
    apiKey: envVars.API_KEY,
    encryptSensitiveData: envVars.ENCRYPT_SENSITIVE_DATA,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    filePath: envVars.LOG_FILE_PATH,
    metricsEnabled: envVars.METRICS_ENABLED,
    healthCheckInterval: envVars.HEALTH_CHECK_INTERVAL,
  },
  
  tasks: {
    timeout: envVars.TASK_TIMEOUT,
    retryAttempts: envVars.TASK_RETRY_ATTEMPTS,
    retryDelay: envVars.TASK_RETRY_DELAY,
    priorityWeights: parsePriorityWeights(envVars.TASK_PRIORITY_WEIGHTS),
  },
  
  rateLimit: {
    window: envVars.RATE_LIMIT_WINDOW,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
};

function parsePriorityWeights(weights: string): Record<string, number> {
  const result: Record<string, number> = {};
  const pairs = weights.split(',');
  
  for (const pair of pairs) {
    const [priority, weight] = pair.split(':');
    if (priority && weight) {
      result[priority.trim()] = parseInt(weight.trim(), 10);
    }
  }
  
  return result;
}

export default config;
