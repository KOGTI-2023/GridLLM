# GridLLM Development Scripts
.PHONY: help install install-server install-client run-server run-client build-server build-client clean logs-server logs-client test

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
	npm run build

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