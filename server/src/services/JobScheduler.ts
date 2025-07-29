import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { RedisService } from "./RedisService";
import { WorkerRegistry } from "./WorkerRegistry";
import {
  InferenceRequest,
  InferenceResponse,
  JobAssignment,
  WorkerInfo,
} from "@/types";
import { config } from "@/config";
import { logger } from "@/utils/logger";

export class JobScheduler extends EventEmitter {
  private redis: RedisService;
  private workerRegistry: WorkerRegistry;
  private activeJobs: Map<string, JobAssignment> = new Map();
  private jobQueue: InferenceRequest[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(workerRegistry: WorkerRegistry) {
    super();
    this.redis = RedisService.getInstance();
    this.workerRegistry = workerRegistry;
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing job scheduler");

      // Subscribe to job completion events
      await this.redis.subscribe(
        "job:completed",
        this.handleJobCompleted.bind(this)
      );
      await this.redis.subscribe("job:failed", this.handleJobFailed.bind(this));
      await this.redis.subscribe(
        "job:timeout",
        this.handleJobTimeout.bind(this)
      );

      // Load any existing jobs from Redis
      await this.loadExistingJobs();

      // Start job processing interval
      this.startProcessingInterval();

      logger.info("Job scheduler initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize job scheduler", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info("Stopping job scheduler");

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Unsubscribe from events
    await this.redis.unsubscribe("job:completed");
    await this.redis.unsubscribe("job:failed");
    await this.redis.unsubscribe("job:timeout");

    // Wait for active jobs to complete or timeout
    await this.waitForActiveJobs();

    this.activeJobs.clear();
    this.jobQueue.length = 0;

    logger.info("Job scheduler stopped");
  }

  private async loadExistingJobs(): Promise<void> {
    try {
      // Load active jobs from Redis
      const activeJobsData = await this.redis.hgetall("active_jobs");

      for (const [jobId, data] of Object.entries(activeJobsData)) {
        try {
          const jobAssignment = JSON.parse(data) as JobAssignment;

          // Check if job has timed out
          const now = Date.now();
          const assignedTime = new Date(jobAssignment.assignedAt).getTime();

          if (now - assignedTime > jobAssignment.timeout) {
            // Job has timed out, remove it
            await this.handleJobTimeout(JSON.stringify({ jobId }));
          } else {
            this.activeJobs.set(jobId, jobAssignment);
            logger.job(jobId, "Loaded existing active job");
          }
        } catch (error) {
          logger.error(`Failed to parse job data for ${jobId}`, error);
          await this.redis.hdel("active_jobs", jobId);
        }
      }

      // Load queued jobs from Redis
      const queuedJobsData = await this.redis.get("job_queue");
      if (queuedJobsData) {
        try {
          this.jobQueue = JSON.parse(queuedJobsData);
          logger.info(`Loaded ${this.jobQueue.length} queued jobs`);
        } catch (error) {
          logger.error("Failed to parse queued jobs data", error);
          await this.redis.delete("job_queue");
        }
      }

      logger.info(
        `Loaded ${this.activeJobs.size} active jobs and ${this.jobQueue.length} queued jobs`
      );
    } catch (error) {
      logger.error("Failed to load existing jobs", error);
    }
  }

  private startProcessingInterval(): void {
    this.processingInterval = setInterval(async () => {
      await this.processJobQueue();
    }, 1000); // Process every second

    logger.info("Job processing interval started");
  }

  private async processJobQueue(): Promise<void> {
    if (this.jobQueue.length === 0) {
      return;
    }

    // Sort jobs by priority
    this.jobQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (
        (priorityOrder[b.priority || "medium"] || 2) -
        (priorityOrder[a.priority || "medium"] || 2)
      );
    });

    const processedJobs: string[] = [];

    for (let i = 0; i < this.jobQueue.length; i++) {
      const job = this.jobQueue[i];
      if (!job) continue;

      const worker = this.selectWorkerForJob(job);

      if (worker) {
        await this.assignJobToWorker(job, worker);
        processedJobs.push(job.id);
      }
    }

    // Remove processed jobs from queue
    this.jobQueue = this.jobQueue.filter(
      (job) => !processedJobs.includes(job.id)
    );

    // Update queue in Redis
    if (processedJobs.length > 0) {
      await this.redis.set("job_queue", JSON.stringify(this.jobQueue));
    }
  }

  private selectWorkerForJob(job: InferenceRequest): WorkerInfo | null {
    // Get workers that have the required model
    const candidateWorkers = this.workerRegistry.getAvailableWorkersByModel(
      job.model
    );

    if (candidateWorkers.length === 0) {
      return null;
    }

    // Select worker with lowest current load (fewest active jobs)
    candidateWorkers.sort((a, b) => {
      // Primary sort: current job count (ascending)
      if (a.currentJobs !== b.currentJobs) {
        return a.currentJobs - b.currentJobs;
      }

      // Secondary sort: performance tier (high > medium > low)
      const tierOrder = { high: 3, medium: 2, low: 1 };
      return (
        (tierOrder[b.capabilities.performanceTier] || 2) -
        (tierOrder[a.capabilities.performanceTier] || 2)
      );
    });

    return candidateWorkers[0] || null;
  }

  private async assignJobToWorker(
    job: InferenceRequest,
    worker: WorkerInfo
  ): Promise<void> {
    try {
      const jobAssignment: JobAssignment = {
        jobId: job.id,
        workerId: worker.workerId,
        request: job,
        assignedAt: new Date(),
        timeout: job.timeout || config.jobs.timeout,
      };

      // Store assignment
      this.activeJobs.set(job.id, jobAssignment);
      await this.redis.hset(
        "active_jobs",
        job.id,
        JSON.stringify(jobAssignment)
      );

      // Mark worker as busy
      await this.workerRegistry.markWorkerBusy(worker.workerId);

      // Send job to worker
      await this.redis.publish(
        `worker:${worker.workerId}:job`,
        JSON.stringify({
          type: "job_assignment",
          job: jobAssignment,
        })
      );

      // Set timeout for job
      setTimeout(() => {
        this.handleJobTimeout(JSON.stringify({ jobId: job.id }));
      }, jobAssignment.timeout);

      this.emit("job_assigned", jobAssignment);
      logger.job(job.id, "Job assigned to worker", {
        workerId: worker.workerId,
        model: job.model,
      });
    } catch (error) {
      logger.error("Failed to assign job to worker", error);
      throw error;
    }
  }

  private async handleJobCompleted(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const jobAssignment = this.activeJobs.get(data.jobId);

      if (jobAssignment) {
        // Remove from active jobs
        this.activeJobs.delete(data.jobId);
        await this.redis.hdel("active_jobs", data.jobId);

        // Mark worker as available
        await this.workerRegistry.markWorkerAvailable(jobAssignment.workerId);

        this.emit("job_completed", {
          jobAssignment,
          result: data.result,
          workerId: data.workerId,
        });

        logger.job(data.jobId, "Job completed successfully", {
          workerId: data.workerId,
          duration: Date.now() - new Date(jobAssignment.assignedAt).getTime(),
        });
      }
    } catch (error) {
      logger.error("Failed to handle job completion", error);
    }
  }

  private async handleJobFailed(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const jobAssignment = this.activeJobs.get(data.jobId);

      if (jobAssignment) {
        // Remove from active jobs
        this.activeJobs.delete(data.jobId);
        await this.redis.hdel("active_jobs", data.jobId);

        // Mark worker as available
        await this.workerRegistry.markWorkerAvailable(jobAssignment.workerId);

        // Check if we should retry the job
        const retryCount =
          (jobAssignment.request.metadata?.retryCount || 0) + 1;

        if (retryCount <= config.jobs.retryAttempts) {
          // Retry the job
          jobAssignment.request.metadata = {
            ...jobAssignment.request.metadata,
            retryCount,
          };

          // Add back to queue with delay
          setTimeout(() => {
            this.addJob(jobAssignment.request);
          }, config.jobs.retryDelay);

          logger.job(data.jobId, "Job failed, scheduling retry", {
            retryCount,
            error: data.error,
          });
        } else {
          // Max retries reached
          this.emit("job_failed", {
            jobAssignment,
            error: data.error,
            workerId: data.workerId,
          });

          logger.job(data.jobId, "Job failed permanently", {
            workerId: data.workerId,
            error: data.error,
            retryCount,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to handle job failure", error);
    }
  }

  private async handleJobTimeout(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const jobAssignment = this.activeJobs.get(data.jobId);

      if (jobAssignment) {
        // Remove from active jobs
        this.activeJobs.delete(data.jobId);
        await this.redis.hdel("active_jobs", data.jobId);

        // Mark worker as available
        await this.workerRegistry.markWorkerAvailable(jobAssignment.workerId);

        // Notify worker to cancel the job
        await this.redis.publish(
          `worker:${jobAssignment.workerId}:job`,
          JSON.stringify({
            type: "job_cancellation",
            jobId: data.jobId,
          })
        );

        this.emit("job_timeout", {
          jobAssignment,
          workerId: jobAssignment.workerId,
        });

        logger.job(data.jobId, "Job timed out", {
          workerId: jobAssignment.workerId,
          timeout: jobAssignment.timeout,
        });
      }
    } catch (error) {
      logger.error("Failed to handle job timeout", error);
    }
  }

  private async waitForActiveJobs(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < maxWaitTime) {
      logger.info(
        `Waiting for ${this.activeJobs.size} active jobs to complete`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn(
        `Forcibly stopping with ${this.activeJobs.size} active jobs remaining`
      );
    }
  }

  // Public methods
  async addJob(request: InferenceRequest): Promise<void> {
    // Add to queue
    this.jobQueue.push(request);

    // Update queue in Redis
    await this.redis.set("job_queue", JSON.stringify(this.jobQueue));

    this.emit("job_queued", request);
    logger.job(request.id, "Job added to queue", {
      model: request.model,
      priority: request.priority,
    });
  }

  async submitAndWait(request: InferenceRequest): Promise<InferenceResponse> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Job ${request.id} timed out after ${request.timeout}ms`)
        );
      }, request.timeout || config.jobs.timeout);

      try {
        // Subscribe to job completion for this specific request
        const resultChannel = `job:result:${request.id}`;

        const handleResult = (message: string) => {
          try {
            const data = JSON.parse(message);

            if (data.jobId === request.id) {
              clearTimeout(timeout);
              this.redis.unsubscribe(resultChannel);

              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (error) {
            logger.error("Failed to parse job result", error);
          }
        };

        // Subscribe to results before submitting the job
        await this.redis.subscribe(resultChannel, handleResult);

        // Submit the job
        await this.addJob(request);

        logger.job(request.id, "Job submitted and waiting for result", {
          timeout: request.timeout,
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  getQueuedJobCount(): number {
    return this.jobQueue.length;
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  getJobQueue(): InferenceRequest[] {
    return [...this.jobQueue];
  }

  getActiveJobs(): JobAssignment[] {
    return Array.from(this.activeJobs.values());
  }

  async cancelJob(jobId: string): Promise<boolean> {
    // Check if job is in queue
    const queueIndex = this.jobQueue.findIndex((job) => job.id === jobId);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
      await this.redis.set("job_queue", JSON.stringify(this.jobQueue));
      logger.job(jobId, "Job cancelled from queue");
      return true;
    }

    // Check if job is active
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      // Notify worker to cancel
      await this.redis.publish(
        `worker:${activeJob.workerId}:job`,
        JSON.stringify({
          type: "job_cancellation",
          jobId,
        })
      );

      // Remove from active jobs
      this.activeJobs.delete(jobId);
      await this.redis.hdel("active_jobs", jobId);

      // Mark worker as available
      await this.workerRegistry.markWorkerAvailable(activeJob.workerId);

      logger.job(jobId, "Active job cancelled");
      return true;
    }

    return false;
  }
}
