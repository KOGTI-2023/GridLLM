# GridLLM Development Scripts
.PHONY: help install install-server install-client run-server run-client build-server build-client clean logs-server logs-client test docker-build docker-build-server docker-build-client docker-run docker-run-server docker-run-client docker-stop docker-clean docker-logs docker-status

# Load environment variables from .env file if it exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Default values for environment variables (can be overridden by .env file)
NODE_ENV ?= development
DOCKER_NETWORK ?= bridge
SERVER_PORT ?= 4000
CLIENT_PORT ?= 3000
SERVER_CONTAINER_NAME ?= llmama-server-container
CLIENT_CONTAINER_NAME ?= llmama-client-container
SERVER_IMAGE_NAME ?= llmama-server
CLIENT_IMAGE_NAME ?= llmama-client
REDIS_HOST ?= host.docker.internal
REDIS_PORT ?= 6379
REDIS_PASSWORD ?= 
REDIS_DB ?= 0
REDIS_KEY_PREFIX ?= GridLLM:
OLLAMA_HOST ?= host.docker.internal
OLLAMA_PORT ?= 11434
OLLAMA_PROTOCOL ?= http
OLLAMA_TIMEOUT ?= 300000
OLLAMA_MAX_RETRIES ?= 3
WORKER_ID ?= worker-docker-001
WORKER_CONCURRENCY ?= 2
WORKER_MAX_CONCURRENT_JOBS ?= 1
WORKER_POLL_INTERVAL ?= 1000
WORKER_RESOURCE_CHECK_INTERVAL ?= 10000
MAX_CPU_USAGE ?= 80
MAX_MEMORY_USAGE ?= 85
MAX_GPU_MEMORY_USAGE ?= 90
MIN_AVAILABLE_MEMORY_MB ?= 1024
API_KEY ?= worker-api-key
LOG_LEVEL ?= info
HEALTH_CHECK_INTERVAL ?= 60000
TASK_TIMEOUT ?= 600000
TASK_RETRY_ATTEMPTS ?= 3
TASK_RETRY_DELAY ?= 5000
RATE_LIMIT_WINDOW ?= 60000
RATE_LIMIT_MAX_REQUESTS ?= 100
CORS_ORIGIN ?= *
JOB_TIMEOUT ?= 600000
WORKER_TIMEOUT ?= 300000
WORKER_HEARTBEAT_TIMEOUT ?= 60000
WORKER_CLEANUP_INTERVAL ?= 30000
MAX_CONCURRENT_JOBS_PER_WORKER ?= 1

# Default target
help:
	@echo "GridLLM Development Commands:"
	@echo ""
	@echo "  Setup Commands:"
	@echo "    setup           - Complete development environment setup"
	@echo "    install         - Install dependencies for both server and client"
	@echo "    install-server  - Install server dependencies only"
	@echo "    install-client  - Install client dependencies only"
	@echo ""
	@echo "  Development Commands:"
	@echo "    run-server      - Start the central server in development mode"
	@echo "    run-client      - Start the worker client in development mode"
	@echo ""
	@echo "  Build Commands:"
	@echo "    build-server    - Build server for production"
	@echo "    build-client    - Build client for production"
	@echo ""
	@echo "  Docker Commands (configured via .env file):"
	@echo "    docker-build         - Build both Docker images"
	@echo "    docker-build-server  - Build server Docker image"
	@echo "    docker-build-client  - Build client Docker image"
	@echo "    docker-run          - Run both containers"
	@echo "    docker-run-server   - Run server container"
	@echo "    docker-run-client   - Run client container"
	@echo "    docker-stop         - Stop all containers"
	@echo "    docker-clean        - Remove all containers and images"
	@echo "    docker-logs         - View logs from all containers"
	@echo "    docker-status       - Check status of all containers"
	@echo ""
	@echo "  Utility Commands:"
	@echo "    status          - Check overall system status"
	@echo "    logs-server     - View server logs"
	@echo "    logs-client     - View client logs"
	@echo "    clean          - Clean build artifacts and logs"
	@echo "    test           - Run tests"
	@echo "    format         - Format code with Prettier"
	@echo ""
	@echo "  Configuration:"
	@echo "    Copy .env.example to .env and customize values for Docker environment"

# Installation commands
install: install-server install-client

install-server:
	@echo "Installing server dependencies..."
	cd server && npm install

install-client:
	@echo "Installing client dependencies..."
	cd client && npm install

# Development commands
run-server:
	@echo "Starting GridLLM Server..."
	@echo "Server will be available at http://localhost:4000"
	cd server && npm run dev

run-client:
	@echo "Starting GridLLM Worker Client..."
	@echo "Worker health check at http://localhost:3000"
	cd client && npm run dev

# Build commands
build-server:
	@echo "Building server for production..."
	cd server && npm run build

build-client:
	@echo "Building client for production..."
	cd client && npm run build

# Docker commands
docker-build: docker-build-server docker-build-client

docker-build-server:
	@echo "Building server Docker image..."
	cd server && docker build -t $(SERVER_IMAGE_NAME) .
	@echo "✅ Server Docker image built successfully!"

docker-build-client:
	@echo "Building client Docker image..."
	cd client && docker build -t $(CLIENT_IMAGE_NAME) .
	@echo "✅ Client Docker image built successfully!"

docker-run: docker-run-server docker-run-client

docker-run-server:
	@echo "Starting server container..."
	@docker stop $(SERVER_CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(SERVER_CONTAINER_NAME) 2>/dev/null || true
	docker run -d -p $(SERVER_PORT):$(SERVER_PORT) --name $(SERVER_CONTAINER_NAME) \
		--network $(DOCKER_NETWORK) \
		-e NODE_ENV=$(NODE_ENV) \
		-e PORT=$(SERVER_PORT) \
		-e REDIS_HOST=$(REDIS_HOST) \
		-e REDIS_PORT=$(REDIS_PORT) \
		-e REDIS_PASSWORD=$(REDIS_PASSWORD) \
		-e REDIS_DB=$(REDIS_DB) \
		-e REDIS_KEY_PREFIX=$(REDIS_KEY_PREFIX) \
		-e WORKER_TIMEOUT=$(WORKER_TIMEOUT) \
		-e WORKER_HEARTBEAT_TIMEOUT=$(WORKER_HEARTBEAT_TIMEOUT) \
		-e WORKER_CLEANUP_INTERVAL=$(WORKER_CLEANUP_INTERVAL) \
		-e JOB_TIMEOUT=$(JOB_TIMEOUT) \
		-e TASK_RETRY_ATTEMPTS=$(TASK_RETRY_ATTEMPTS) \
		-e TASK_RETRY_DELAY=$(TASK_RETRY_DELAY) \
		-e MAX_CONCURRENT_JOBS_PER_WORKER=$(MAX_CONCURRENT_JOBS_PER_WORKER) \
		-e LOG_LEVEL=$(LOG_LEVEL) \
		-e HEALTH_CHECK_INTERVAL=$(HEALTH_CHECK_INTERVAL) \
		-e RATE_LIMIT_WINDOW=$(RATE_LIMIT_WINDOW) \
		-e RATE_LIMIT_MAX_REQUESTS=$(RATE_LIMIT_MAX_REQUESTS) \
		-e CORS_ORIGIN=$(CORS_ORIGIN) \
		$(SERVER_IMAGE_NAME)
	@echo "✅ Server container started on port $(SERVER_PORT)"

docker-run-client:
	@echo "Starting client container..."
	@docker stop $(CLIENT_CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(CLIENT_CONTAINER_NAME) 2>/dev/null || true
	docker run -d -p $(CLIENT_PORT):$(CLIENT_PORT) --name $(CLIENT_CONTAINER_NAME) \
		--network $(DOCKER_NETWORK) \
		-e NODE_ENV=$(NODE_ENV) \
		-e PORT=$(CLIENT_PORT) \
		-e WORKER_ID=$(WORKER_ID) \
		-e SERVER_HOST=$(REDIS_HOST) \
		-e SERVER_PORT=$(SERVER_PORT) \
		-e SERVER_REDIS_HOST=$(REDIS_HOST) \
		-e SERVER_REDIS_PORT=$(REDIS_PORT) \
		-e SERVER_REDIS_PASSWORD=$(REDIS_PASSWORD) \
		-e REDIS_DB=$(REDIS_DB) \
		-e REDIS_KEY_PREFIX=$(REDIS_KEY_PREFIX) \
		-e OLLAMA_HOST=$(OLLAMA_HOST) \
		-e OLLAMA_PORT=$(OLLAMA_PORT) \
		-e OLLAMA_PROTOCOL=$(OLLAMA_PROTOCOL) \
		-e OLLAMA_TIMEOUT=$(OLLAMA_TIMEOUT) \
		-e OLLAMA_MAX_RETRIES=$(OLLAMA_MAX_RETRIES) \
		-e WORKER_CONCURRENCY=$(WORKER_CONCURRENCY) \
		-e WORKER_MAX_CONCURRENT_JOBS=$(WORKER_MAX_CONCURRENT_JOBS) \
		-e WORKER_POLL_INTERVAL=$(WORKER_POLL_INTERVAL) \
		-e WORKER_RESOURCE_CHECK_INTERVAL=$(WORKER_RESOURCE_CHECK_INTERVAL) \
		-e MAX_CPU_USAGE=$(MAX_CPU_USAGE) \
		-e MAX_MEMORY_USAGE=$(MAX_MEMORY_USAGE) \
		-e MAX_GPU_MEMORY_USAGE=$(MAX_GPU_MEMORY_USAGE) \
		-e MIN_AVAILABLE_MEMORY_MB=$(MIN_AVAILABLE_MEMORY_MB) \
		-e API_KEY=$(API_KEY) \
		-e LOG_LEVEL=$(LOG_LEVEL) \
		-e HEALTH_CHECK_INTERVAL=$(HEALTH_CHECK_INTERVAL) \
		-e TASK_TIMEOUT=$(TASK_TIMEOUT) \
		-e TASK_RETRY_ATTEMPTS=$(TASK_RETRY_ATTEMPTS) \
		-e TASK_RETRY_DELAY=$(TASK_RETRY_DELAY) \
		-e RATE_LIMIT_WINDOW=$(RATE_LIMIT_WINDOW) \
		-e RATE_LIMIT_MAX_REQUESTS=$(RATE_LIMIT_MAX_REQUESTS) \
		-e CORS_ORIGIN=$(CORS_ORIGIN) \
		$(CLIENT_IMAGE_NAME)
	@echo "✅ Client container started on port $(CLIENT_PORT)"

docker-stop:
	@echo "Stopping all containers..."
	@docker stop $(SERVER_CONTAINER_NAME) $(CLIENT_CONTAINER_NAME) 2>/dev/null || true
	@echo "✅ All containers stopped"

docker-clean: docker-stop
	@echo "Cleaning up containers and images..."
	@docker rm $(SERVER_CONTAINER_NAME) $(CLIENT_CONTAINER_NAME) 2>/dev/null || true
	@docker rmi $(SERVER_IMAGE_NAME) $(CLIENT_IMAGE_NAME) 2>/dev/null || true
	@echo "✅ Cleanup complete"

docker-logs:
	@echo "=== Server Container Logs ==="
	@docker logs $(SERVER_CONTAINER_NAME) 2>/dev/null || echo "Server container not running"
	@echo ""
	@echo "=== Client Container Logs ==="
	@docker logs $(CLIENT_CONTAINER_NAME) 2>/dev/null || echo "Client container not running"

docker-status:
	@echo "=== Docker Container Status ==="
	@echo ""
	@echo "Running Containers:"
	@docker ps --filter "name=llmama" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers running"
	@echo ""
	@echo "Available Images:"
	@docker images --filter "reference=llmama-*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || echo "No images found"
	@echo ""
	@echo "Health Checks:"
	@curl -s http://localhost:$(SERVER_PORT)/health 2>/dev/null | jq '.' || echo "Server not responding on port $(SERVER_PORT)"
	@curl -s http://localhost:$(CLIENT_PORT)/health 2>/dev/null | jq '.' || echo "Client not responding on port $(CLIENT_PORT)"

# Utility commands
logs-server:
	@echo "Server logs:"
	@tail -f server/logs/GridLLM-server.log 2>/dev/null || echo "No server logs found. Start the server first."

logs-client:
	@echo "Client logs:"
	@tail -f logs/GridLLM-worker.log 2>/dev/null || echo "No client logs found. Start the client first."

clean:
	@echo "Cleaning build artifacts and logs..."
	rm -rf server/dist client/dist dist
	rm -rf server/logs/* logs/*
	@echo "Clean complete!"

test:
	@echo "Running tests..."
	npm test
	cd server && npm test

# Quick status check
status:
	@echo "=== GridLLM Network Status ==="
	@echo ""
	@echo "Server Status:"
	@curl -s http://localhost:$(SERVER_PORT)/health 2>/dev/null | jq '.' || echo "Server not responding"
	@echo ""
	@echo "Client Status:"
	@curl -s http://localhost:$(CLIENT_PORT)/health 2>/dev/null | jq '.' || echo "Client not responding"
	@echo ""
	@echo "Available Models:"
	@curl -s http://localhost:$(SERVER_PORT)/inference/models 2>/dev/null | jq '.models[] | .name' || echo "Could not fetch models"

# Development environment setup
setup: install
	@echo "Setting up development environment..."
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created global .env file - please configure it"; fi
	@if [ ! -f server/.env ]; then cp server/.env.example server/.env && echo "Created server/.env file - please configure it"; fi
	@if [ ! -f client/.env ]; then cp client/.env.example client/.env && echo "Created client/.env file - please configure it"; fi
	@mkdir -p logs server/logs client/logs
	@echo "Setup complete! Configure .env files and run 'make docker-run' to start with Docker."

format:
	@echo "Formatting code with Prettier..."
	npx prettier --write "**/*.ts" "**/*.js" "**/*.json" "**/*.md"
	@echo "Code formatted successfully!"