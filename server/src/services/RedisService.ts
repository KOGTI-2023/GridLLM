import Redis from "ioredis";
import { config } from "@/config";
import { logger } from "@/utils/logger";

export class RedisService {
	private static instance: RedisService;
	private mainConnection: Redis | null = null;
	private subscriberConnection: Redis | null = null;
	private publisherConnection: Redis | null = null;
	private isConnected: boolean = false;

	static getInstance(): RedisService {
		if (!RedisService.instance) {
			RedisService.instance = new RedisService();
		}
		return RedisService.instance;
	}

	async connect(): Promise<void> {
		try {
			logger.info("Connecting to Redis");

			// Main connection for general operations
			this.mainConnection = new Redis(config.redis);

			// Separate connections for pub/sub to avoid conflicts
			this.subscriberConnection = new Redis({
				...config.redis,
				lazyConnect: true,
			});

			this.publisherConnection = new Redis({
				...config.redis,
				lazyConnect: true,
			});

			// Setup event handlers
			this.setupEventHandlers();

			// Test connections
			await Promise.all([
				this.mainConnection.ping(),
				this.subscriberConnection.connect(),
				this.publisherConnection.connect(),
			]);

			this.isConnected = true;
			logger.info("Successfully connected to Redis");
		} catch (error) {
			logger.error("Failed to connect to Redis", error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		try {
			logger.info("Disconnecting from Redis");

			this.isConnected = false;

			if (this.mainConnection) {
				await this.mainConnection.quit();
				this.mainConnection = null;
			}

			if (this.subscriberConnection) {
				await this.subscriberConnection.quit();
				this.subscriberConnection = null;
			}

			if (this.publisherConnection) {
				await this.publisherConnection.quit();
				this.publisherConnection = null;
			}

			logger.info("Disconnected from Redis");
		} catch (error) {
			logger.error("Error disconnecting from Redis", error);
		}
	}

	private setupEventHandlers(): void {
		if (this.mainConnection) {
			this.mainConnection.on("error", (error) => {
				logger.error("Redis main connection error", error);
			});

			this.mainConnection.on("connect", () => {
				logger.info("Redis main connection established");
			});

			this.mainConnection.on("close", () => {
				logger.warn("Redis main connection closed");
			});
		}

		if (this.subscriberConnection) {
			this.subscriberConnection.on("error", (error) => {
				logger.error("Redis subscriber connection error", error);
			});
		}

		if (this.publisherConnection) {
			this.publisherConnection.on("error", (error) => {
				logger.error("Redis publisher connection error", error);
			});
		}
	}

	// Main connection operations
	async get(key: string): Promise<string | null> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.get(key);
	}

	async set(key: string, value: string, ttl?: number): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		if (ttl) {
			await this.mainConnection.setex(key, ttl, value);
		} else {
			await this.mainConnection.set(key, value);
		}
	}

	async delete(key: string): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.del(key);
	}

	async exists(key: string): Promise<boolean> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		const result = await this.mainConnection.exists(key);
		return result === 1;
	}

	// Hash operations
	async hget(key: string, field: string): Promise<string | null> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.hget(key, field);
	}

	async hset(key: string, field: string, value: string): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.hset(key, field, value);
	}

	async hgetall(key: string): Promise<Record<string, string>> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.hgetall(key);
	}

	async hdel(key: string, field: string): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.hdel(key, field);
	}

	async hkeys(key: string): Promise<string[]> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.hkeys(key);
	}

	// List operations
	async lpush(key: string, value: string): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.lpush(key, value);
	}

	async rpop(key: string): Promise<string | null> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.rpop(key);
	}

	async llen(key: string): Promise<number> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.llen(key);
	}

	// Set operations
	async sadd(key: string, member: string): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.sadd(key, member);
	}

	async srem(key: string, member: string): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.srem(key, member);
	}

	async smembers(key: string): Promise<string[]> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.smembers(key);
	}

	async sismember(key: string, member: string): Promise<boolean> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		const result = await this.mainConnection.sismember(key, member);
		return result === 1;
	}

	// Pub/Sub operations
	async publish(channel: string, message: string): Promise<void> {
		if (!this.publisherConnection)
			throw new Error("Redis publisher not connected");
		await this.publisherConnection.publish(channel, message);
	}

	async subscribe(
		channel: string,
		callback: (message: string) => void
	): Promise<void> {
		if (!this.subscriberConnection)
			throw new Error("Redis subscriber not connected");

		this.subscriberConnection.on("message", (receivedChannel, message) => {
			if (receivedChannel === channel) {
				callback(message);
			}
		});

		await this.subscriberConnection.subscribe(channel);
	}

	async unsubscribe(channel: string): Promise<void> {
		if (!this.subscriberConnection)
			throw new Error("Redis subscriber not connected");
		await this.subscriberConnection.unsubscribe(channel);
	}

	// Pattern subscribe
	async psubscribe(
		pattern: string,
		callback: (channel: string, message: string) => void
	): Promise<void> {
		if (!this.subscriberConnection)
			throw new Error("Redis subscriber not connected");

		this.subscriberConnection.on(
			"pmessage",
			(receivedPattern, channel, message) => {
				if (receivedPattern === pattern) {
					callback(channel, message);
				}
			}
		);

		await this.subscriberConnection.psubscribe(pattern);
	}

	// Utility methods
	async ping(): Promise<string> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.ping();
	}

	async flushdb(): Promise<void> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		await this.mainConnection.flushdb();
	}

	async keys(pattern: string): Promise<string[]> {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return await this.mainConnection.keys(pattern);
	}

	getConnection(): Redis {
		if (!this.mainConnection) throw new Error("Redis not connected");
		return this.mainConnection;
	}

	isHealthy(): boolean {
		return (
			this.isConnected &&
			this.mainConnection !== null &&
			this.subscriberConnection !== null &&
			this.publisherConnection !== null
		);
	}
}
