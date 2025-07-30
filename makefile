# GridLLM Development Scripts
.PHONY: help install install-server install-client run-server run-client build-server build-client clean logs-server logs-client test docker-build docker-build-server docker-build-client docker-run docker-run-server docker-run-client docker-stop docker-clean docker-logs docker-status

# Default target
help:
	@echo "GridLLM Development Commands:"
	@echo ""
	@echo "  Setup Commands:"
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
	@echo "  Docker Commands:"
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
	@echo "    logs-server     - View server logs"
	@echo "    logs-client     - View client logs"
	@echo "    clean          - Clean build artifacts and logs"
	@echo "    test           - Run tests"

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
	cd server && docker build -t llmama-server .
	@echo "✅ Server Docker image built successfully!"

docker-build-client:
	@echo "Building client Docker image..."
	cd client && docker build -t llmama-client .
	@echo "✅ Client Docker image built successfully!"

docker-run: docker-run-server docker-run-client

docker-run-server:
	@echo "Starting server container..."
	@docker stop llmama-server-container 2>/dev/null || true
	@docker rm llmama-server-container 2>/dev/null || true
	docker run -d -p 4000:4000 --name llmama-server-container \
		--network bridge \
		-e REDIS_HOST=host.docker.internal \
		-e REDIS_PORT=6379 \
		llmama-server
	@echo "✅ Server container started on port 4000"

docker-run-client:
	@echo "Starting client container..."
	@docker stop llmama-client-container 2>/dev/null || true
	@docker rm llmama-client-container 2>/dev/null || true
	docker run -d -p 3000:3000 --name llmama-client-container \
		--network bridge \
		-e SERVER_REDIS_HOST=host.docker.internal \
		-e SERVER_REDIS_PORT=6379 \
		-e SERVER_HOST=host.docker.internal \
		-e SERVER_PORT=4000 \
		-e OLLAMA_HOST=host.docker.internal \
		-e OLLAMA_PORT=11434 \
		-e OLLAMA_PROTOCOL=http \
		llmama-client
	@echo "✅ Client container started on port 3000"

docker-stop:
	@echo "Stopping all containers..."
	@docker stop llmama-server-container llmama-client-container 2>/dev/null || true
	@echo "✅ All containers stopped"

docker-clean: docker-stop
	@echo "Cleaning up containers and images..."
	@docker rm llmama-server-container llmama-client-container 2>/dev/null || true
	@docker rmi llmama-server llmama-client 2>/dev/null || true
	@echo "✅ Cleanup complete"

docker-logs:
	@echo "=== Server Container Logs ==="
	@docker logs llmama-server-container 2>/dev/null || echo "Server container not running"
	@echo ""
	@echo "=== Client Container Logs ==="
	@docker logs llmama-client-container 2>/dev/null || echo "Client container not running"

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
	@curl -s http://localhost:4000/health 2>/dev/null | jq '.' || echo "Server not responding on port 4000"
	@curl -s http://localhost:3000/health 2>/dev/null | jq '.' || echo "Client not responding on port 3000"

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
	@curl -s http://localhost:4000/health 2>/dev/null | jq '.' || echo "Server not responding"
	@echo ""
	@echo "Client Status:"
	@curl -s http://localhost:3000/health 2>/dev/null | jq '.' || echo "Client not responding"
	@echo ""
	@echo "Available Models:"
	@curl -s http://localhost:4000/inference/models 2>/dev/null | jq '.models[] | .name' || echo "Could not fetch models"

# Development environment setup
setup: install
	@echo "Setting up development environment..."
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env file - please configure it"; fi
	@if [ ! -f server/.env ]; then cp server/.env.example server/.env && echo "Created server/.env file - please configure it"; fi
	@mkdir -p logs server/logs
	@echo "Setup complete! Run 'make run-server' and 'make run-client' to start."

format:
	@echo "Formatting code with Prettier..."
	npx prettier --write "**/*.ts" "**/*.js" "**/*.json" "**/*.md"
	@echo "Code formatted successfully!"