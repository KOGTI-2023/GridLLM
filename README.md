# LLMama - Distributed AI Inference Network

A distributed AI inference system with hot-join capability, designed for dynamic worker pools. Perfect for adding your MacBook or other machines to a shared AI compute network when available.

## Architecture

This repository contains a complete server/client architecture:

- **Server** (`/server`) - Central coordinator that manages workers and distributes inference jobs
- **Client** (`/client`) - Hot-joinable worker that provides local Ollama compute resources

### Hot-Join Design Philosophy

The system is designed for dynamic worker participation:

- **Central Server**: Always-on coordinator that receives inference requests and manages job distribution
- **Worker Clients**: Can join/leave the network at any time without disrupting the system
- **Intelligent Job Routing**: Server automatically routes jobs to available workers based on model availability and current load
- **Graceful Disconnection**: Workers finish current jobs before leaving the network

### Ollama API Compatibility

LLMama provides **full Ollama API compatibility** under the `/ollama` route:

- Use existing Ollama clients without modification
- All Ollama endpoints supported (`/api/generate`, `/api/chat`, `/api/tags`, etc.)
- Transparent load balancing across distributed workers
- See [Ollama API Documentation](docs/OLLAMA_API.md) for complete details

## Prerequisites

### For the Central Server (Always-On Machine)

- **Node.js** (v18 or higher)
- **Redis** server
- **npm** package manager

### For Worker Clients (Hot-Join Machines)

- **Node.js** (v18 or higher)
- **Ollama** installed and running locally
- **npm** package manager

## Installation

### Install Dependencies

```bash
# Install all dependencies (recommended)
make install

# Or install manually
cd server && npm install
cd ../client && npm install
```

### Install Prerequisites

#### Redis (Server Machine Only)

```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Or using Docker
docker run -d -p 6379:6379 --name gridllm-redis redis:7-alpine
```

#### Ollama (Worker Machines)

```bash
# macOS
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
ollama serve

# Pull some models
ollama pull llama3.2
ollama pull qwen2.5
```

## Quick Start

### 1. Start the Central Server

```bash
# Using Makefile (recommended)
make run-server

# Or manually
cd server
cp .env.example .env
npm run dev
```

The server starts on port 4000 by default and provides:

- Inference API at `http://localhost:4000/inference`
- **Ollama API at `http://localhost:4000/ollama`** (full compatibility)
- Health monitoring at `http://localhost:4000/health`
- Worker management endpoints

### 2. Start Worker Clients

```bash
# Using Makefile (recommended)
make run-client

# Or manually
cd client
cp .env.example .env
npm run dev
```

Workers automatically:

- Connect to the server
- Register available Ollama models
- Start processing assigned jobs

### 3. Submit Inference Requests

Send requests to the server (not individual workers):

#### Using LLMama Native API

```bash
# Basic inference request
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "prompt": "Explain quantum computing in simple terms",
    "priority": "medium"
  }'

# Check available models across all workers
curl http://localhost:4000/inference/models

# Check worker status
curl http://localhost:4000/health/workers
```

#### Using Ollama-Compatible API

```bash
# Generate text completion (just like Ollama!)
curl http://localhost:4000/ollama/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Why is the sky blue?",
  "stream": false
}'

# Chat completion
curl http://localhost:4000/ollama/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}'

# List available models
curl http://localhost:4000/ollama/api/tags

# Generate embeddings
curl http://localhost:4000/ollama/api/embed -d '{
  "model": "all-minilm",
  "input": "Hello world"
}'
```

## Configuration

### Server Configuration (`server/.env`)

```env
# Server Settings
PORT=4000
SERVER_ID=gridllm-server-1

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Worker Management
WORKER_HEARTBEAT_TIMEOUT=60000
MAX_CONCURRENT_JOBS_PER_WORKER=1

# Logging
LOG_LEVEL=info
```

### Client Configuration (`client/.env`)

```env
# Worker Settings
PORT=3002
WORKER_ID=macbook-worker-001

# Server Connection
SERVER_REDIS_HOST=localhost
SERVER_REDIS_PORT=6379

# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434

# Resource Limits
MAX_CONCURRENT_JOBS=1
HEARTBEAT_INTERVAL=30000

# Logging
LOG_LEVEL=info
```

## Development Workflow

### Using the Makefile (Recommended)

```bash
# Install all dependencies
make install

# Start the server
make run-server

# Start a worker client (in another terminal)
make run-client

# Check system status
make status

# View logs
make logs-server
make logs-client

# Stop all processes
make stop

# Clean build artifacts
make clean

# Build for production
make build
```

### Manual Development (Alternative)

```bash
# Server development
cd server && npm run dev

# Client development
cd client && npm run dev

# Build for production
cd server && npm run build && npm start
cd client && npm run build && npm start
```

## Hot-Join Usage Examples

### Scenario 1: Adding Your MacBook to the Pool

```bash
# When you want to contribute compute power
make run-client

# Monitor your worker's status
curl http://localhost:3002/health

# When you need your MacBook back
# Ctrl+C (worker gracefully finishes current job)
```

### Scenario 2: Multi-Worker Setup

```bash
# Terminal 1: Start server
make run-server

# Terminal 2: Start worker 1 (MacBook)
WORKER_ID=macbook-worker make run-client

# Terminal 3: Start worker 2 (Desktop)
WORKER_ID=desktop-worker PORT=3003 make run-client

# Check all workers
curl http://localhost:4000/health/workers
```

## Monitoring and Management

### Server Health Endpoints

```bash
# Overall server status
curl http://localhost:4000/health

# Connected workers
curl http://localhost:4000/health/workers

# Job queue status
curl http://localhost:4000/health/jobs

# Available models across all workers
curl http://localhost:4000/inference/models
```

### Worker Health Endpoints

```bash
# Worker status
curl http://localhost:3002/health

# Worker capabilities
curl http://localhost:3002/health/capabilities

# Current jobs
curl http://localhost:3002/health/jobs
```

## Troubleshooting

### Common Issues

**1. "Model not available on any worker"**

- Ensure at least one worker is connected: `curl http://localhost:4000/health/workers`
- Check if worker has the requested model: `curl http://localhost:3002/health/capabilities`
- Verify Ollama is running: `ollama list`

**2. Worker connection failures**

- Check Redis is running: `redis-cli ping`
- Verify Redis connection settings in `.env`
- Check server logs: `make logs-server`

**3. Port conflicts**

- Change ports in `.env` files
- Or kill conflicting processes: `lsof -ti:PORT | xargs kill`

**4. Ollama connection errors**

- Ensure Ollama is running: `curl http://localhost:11434/api/version`
- Check Ollama host/port in client `.env`

### Logs

```bash
# View real-time logs
make logs-server  # Server logs
make logs-client  # Client logs

# Or manually
tail -f server/logs/gridllm-server.log
tail -f client/logs/gridllm-client.log
tail -f client/logs/error.log
```

## Project Structure

```
├── server/                 # Central coordinator server
│   ├── src/
│   │   ├── config/        # Server configuration
│   │   ├── services/      # Core services (Redis, WorkerRegistry, JobScheduler)
│   │   ├── routes/        # API endpoints (health, inference)
│   │   ├── middleware/    # Express middleware
│   │   └── index.ts       # Server entry point
│   ├── package.json
│   └── .env.example
├── client/                 # Hot-join worker client
│   ├── src/
│   │   ├── config/        # Client configuration
│   │   ├── services/      # Worker services (Ollama, WorkerClient)
│   │   ├── routes/        # Health endpoints
│   │   └── index.ts       # Client entry point
│   ├── package.json
│   └── .env.example
├── makefile               # Development automation
└── README.md
```

## Production Deployment

### Using Docker

```bash
# Start with Docker Compose
docker-compose up -d

# Scale workers
docker-compose up -d --scale client=3
```

### Manual Production

```bash
# Build for production
make build

# Start server (production mode)
make start-server

# Start workers (production mode)
make start-client

# Or manually
cd server && npm start
cd client && npm start
```

## API Reference

### Inference API

**POST** `/inference`

```json
{
  "model": "llama3.2",
  "prompt": "Your prompt here",
  "priority": "medium",
  "timeout": 60000
}
```

**GET** `/inference/models` - List all available models across workers

**GET** `/inference/queue` - View job queue status

### Health API

**GET** `/health` - Server health status

**GET** `/health/workers` - Connected workers status

**GET** `/health/jobs` - Job processing status

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
