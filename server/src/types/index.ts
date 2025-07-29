// Worker and Node Types
export interface NodeCapabilities {
  workerId: string;
  availableModels: OllamaModel[];
  systemResources: SystemResources;
  performanceTier: 'high' | 'medium' | 'low';
  maxConcurrentTasks: number;
  supportedFormats: string[];
  lastUpdated: Date;
}

export interface SystemResources {
  cpuCores: number;
  totalMemoryMB: number;
  availableMemoryMB: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  gpuMemoryMB?: number;
  gpuUsagePercent?: number;
  diskSpaceGB: number;
  platform: string;
  architecture: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

// Worker Status and Connection
export interface WorkerInfo {
  workerId: string;
  capabilities: NodeCapabilities;
  status: 'online' | 'offline' | 'busy' | 'error';
  currentJobs: number;
  lastHeartbeat: Date;
  registeredAt: Date;
  totalJobsProcessed: number;
  connectionHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export interface WorkerStatus {
  workerId: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentJobs: number;
  maxJobs: number;
  systemResources: SystemResources;
  connectionHealth: 'healthy' | 'degraded' | 'unhealthy';
  lastUpdated: Date;
}

// Job and Inference Types
export interface InferenceRequest {
  id: string;
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_k?: number;
    top_p?: number;
    num_predict?: number;
    stop?: string[];
    seed?: number;
    [key: string]: any;
  };
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface InferenceResponse {
  id: string;
  model?: string;
  created_at?: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface JobAssignment {
  jobId: string;
  workerId: string;
  request: InferenceRequest;
  assignedAt: Date;
  timeout: number;
}

// Server Types
export interface ServerStatus {
  serverId: string;
  status: 'running' | 'maintenance' | 'error';
  connectedWorkers: number;
  activeJobs: number;
  queuedJobs: number;
  totalJobsProcessed: number;
  uptime: number;
  version: string;
}

// Error Types
export interface LLMamaError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Events
export interface WorkerEvent {
  type: 'registered' | 'unregistered' | 'heartbeat' | 'status_changed' | 'job_completed' | 'job_failed';
  workerId: string;
  timestamp: Date;
  data?: any;
}

export interface JobEvent {
  type: 'created' | 'assigned' | 'started' | 'completed' | 'failed' | 'timeout';
  jobId: string;
  workerId?: string;
  timestamp: Date;
  data?: any;
}
