import { EventEmitter } from "events";
import { RedisService } from "./RedisService";
import { WorkerInfo, NodeCapabilities, WorkerStatus } from "@/types";
import { config } from "@/config";
import { logger } from "@/utils/logger";

export class WorkerRegistry extends EventEmitter {
  private redis: RedisService;
  private workers: Map<string, WorkerInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.redis = RedisService.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing worker registry");

      // Subscribe to worker events
      await this.redis.subscribe(
        "worker:registered",
        this.handleWorkerRegistered.bind(this)
      );
      await this.redis.subscribe(
        "worker:unregistered",
        this.handleWorkerUnregistered.bind(this)
      );
      await this.redis.subscribe(
        "worker:heartbeat",
        this.handleWorkerHeartbeat.bind(this)
      );
      await this.redis.subscribe(
        "worker:status_update",
        this.handleWorkerStatusUpdate.bind(this)
      );

      // Load existing workers from Redis
      await this.loadExistingWorkers();

      // Start cleanup interval
      this.startCleanupInterval();

      logger.info("Worker registry initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize worker registry", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info("Stopping worker registry");

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Unsubscribe from events
    await this.redis.unsubscribe("worker:registered");
    await this.redis.unsubscribe("worker:unregistered");
    await this.redis.unsubscribe("worker:heartbeat");
    await this.redis.unsubscribe("worker:status_update");

    this.workers.clear();
    logger.info("Worker registry stopped");
  }

  private async loadExistingWorkers(): Promise<void> {
    try {
      const workerData = await this.redis.hgetall("workers");

      for (const [workerId, data] of Object.entries(workerData)) {
        try {
          const workerInfo = JSON.parse(data) as WorkerInfo;

          // Check if worker is still alive based on last heartbeat
          const heartbeatAge =
            Date.now() - new Date(workerInfo.lastHeartbeat).getTime();

          if (heartbeatAge < config.server.workerHeartbeatTimeout) {
            workerInfo.status = "online";
            this.workers.set(workerId, workerInfo);
            logger.worker(workerId, "Loaded existing worker");
          } else {
            // Worker is stale, remove it
            await this.removeWorker(workerId);
            logger.worker(
              workerId,
              "Removed stale worker during initialization"
            );
          }
        } catch (error) {
          logger.error(`Failed to parse worker data for ${workerId}`, error);
          await this.redis.hdel("workers", workerId);
        }
      }

      logger.info(`Loaded ${this.workers.size} existing workers`);
    } catch (error) {
      logger.error("Failed to load existing workers", error);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupStaleWorkers();
    }, config.server.workerCleanupInterval);

    logger.info("Worker cleanup interval started", {
      interval: config.server.workerCleanupInterval,
    });
  }

  private async cleanupStaleWorkers(): Promise<void> {
    const now = Date.now();
    const staleWorkers: string[] = [];

    for (const [workerId, worker] of this.workers.entries()) {
      const lastSeen = new Date(worker.lastHeartbeat).getTime();
      const timeSinceLastSeen = now - lastSeen;

      if (timeSinceLastSeen > config.server.workerHeartbeatTimeout) {
        staleWorkers.push(workerId);
      }
    }

    if (staleWorkers.length > 0) {
      logger.info(`Cleaning up ${staleWorkers.length} stale workers`);

      for (const workerId of staleWorkers) {
        await this.removeWorker(workerId);
        logger.worker(workerId, "Removed stale worker");
      }
    }
  }

  private async handleWorkerRegistered(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const workerInfo: WorkerInfo = {
        workerId: data.workerId,
        capabilities: data.capabilities,
        status: "online",
        currentJobs: 0,
        lastHeartbeat: new Date(),
        registeredAt: new Date(data.registeredAt),
        totalJobsProcessed: 0,
        connectionHealth: "healthy",
      };

      this.workers.set(data.workerId, workerInfo);

      // Store in Redis
      await this.redis.hset(
        "workers",
        data.workerId,
        JSON.stringify(workerInfo)
      );

      this.emit("worker_registered", workerInfo);
      logger.worker(data.workerId, "Worker registered");
    } catch (error) {
      logger.error("Failed to handle worker registration", error);
    }
  }

  private async handleWorkerUnregistered(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      await this.removeWorker(data.workerId);
      logger.worker(data.workerId, "Worker unregistered");
    } catch (error) {
      logger.error("Failed to handle worker unregistration", error);
    }
  }

  private async handleWorkerHeartbeat(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const worker = this.workers.get(data.workerId);

      if (worker) {
        worker.lastHeartbeat = new Date(data.timestamp);
        worker.status = data.status || "online";
        worker.currentJobs = data.currentJobs || 0;
        worker.connectionHealth = data.connectionHealth || "healthy";

        // Update in Redis
        await this.redis.hset("workers", data.workerId, JSON.stringify(worker));

        this.emit("worker_heartbeat", worker);
      } else {
        logger.worker(data.workerId, "Received heartbeat from unknown worker");
      }
    } catch (error) {
      logger.error("Failed to handle worker heartbeat", error);
    }
  }

  private async handleWorkerStatusUpdate(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const worker = this.workers.get(data.workerId);

      if (worker) {
        worker.status = data.status;
        worker.currentJobs = data.currentJobs || worker.currentJobs;

        if (data.systemResources) {
          worker.capabilities.systemResources = data.systemResources;
          worker.capabilities.lastUpdated = new Date();
        }

        // Update in Redis
        await this.redis.hset("workers", data.workerId, JSON.stringify(worker));

        this.emit("worker_status_changed", worker);
        logger.worker(data.workerId, "Worker status updated", {
          status: data.status,
        });
      }
    } catch (error) {
      logger.error("Failed to handle worker status update", error);
    }
  }

  private async removeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);

    if (worker) {
      this.workers.delete(workerId);
      await this.redis.hdel("workers", workerId);

      this.emit("worker_removed", worker);
    }
  }

  // Public methods
  getWorker(workerId: string): WorkerInfo | undefined {
    return this.workers.get(workerId);
  }

  getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  getOnlineWorkers(): WorkerInfo[] {
    return this.getAllWorkers().filter(
      (worker) => worker.status === "online" || worker.status === "busy"
    );
  }

  getAvailableWorkers(): WorkerInfo[] {
    return this.getAllWorkers().filter(
      (worker) =>
        worker.status === "online" &&
        worker.currentJobs < config.jobs.maxConcurrentJobsPerWorker
    );
  }

  getWorkersByModel(modelName: string): WorkerInfo[] {
    return this.getAllWorkers().filter((worker) =>
      worker.capabilities.availableModels.some(
        (model) => model.name === modelName
      )
    );
  }

  getAvailableWorkersByModel(modelName: string): WorkerInfo[] {
    return this.getAvailableWorkers().filter((worker) =>
      worker.capabilities.availableModels.some(
        (model) => model.name === modelName
      )
    );
  }

  async updateWorkerJobCount(
    workerId: string,
    increment: number
  ): Promise<void> {
    const worker = this.workers.get(workerId);

    if (worker) {
      worker.currentJobs = Math.max(0, worker.currentJobs + increment);

      // Update status based on job count
      if (worker.currentJobs >= config.jobs.maxConcurrentJobsPerWorker) {
        worker.status = "busy";
      } else if (
        worker.status === "busy" &&
        worker.currentJobs < config.jobs.maxConcurrentJobsPerWorker
      ) {
        worker.status = "online";
      }

      // Update total jobs processed if job completed
      if (increment < 0) {
        worker.totalJobsProcessed++;
      }

      // Update in Redis
      await this.redis.hset("workers", workerId, JSON.stringify(worker));

      this.emit("worker_job_count_changed", worker);
      logger.worker(workerId, "Job count updated", {
        currentJobs: worker.currentJobs,
        status: worker.status,
      });
    }
  }

  async markWorkerBusy(workerId: string): Promise<void> {
    await this.updateWorkerJobCount(workerId, 1);
  }

  async markWorkerAvailable(workerId: string): Promise<void> {
    await this.updateWorkerJobCount(workerId, -1);
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  getOnlineWorkerCount(): number {
    return this.getOnlineWorkers().length;
  }

  getAvailableWorkerCount(): number {
    return this.getAvailableWorkers().length;
  }

  getTotalActiveJobs(): number {
    return this.getAllWorkers().reduce(
      (total, worker) => total + worker.currentJobs,
      0
    );
  }

  // Get all available models across all workers
  getAllAvailableModels(): string[] {
    const models = new Set<string>();

    for (const worker of this.getOnlineWorkers()) {
      for (const model of worker.capabilities.availableModels) {
        models.add(model.name);
      }
    }

    return Array.from(models);
  }
}
