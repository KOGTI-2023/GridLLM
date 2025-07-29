# LLMama Worker Client

A distributed AI inference worker client that connects to the central LLMama server. This worker provides local Ollama compute resources to a distributed AI inference network with hot-join capability.

## Architecture

This repository contains:
- **Worker Client** (`/src`) - Connects to central server, provides compute resources
- **Server** (`/server`) - Central coordinator for managing workers and distributing jobs

### Hot-Join Worker Design

Workers can dynamically join and leave the network:
- Workers discover and connect to the central server via configuration
- Workers register their capabilities (available models, performance tier, resources)
- Server assigns jobs based on worker availability and current load
- Workers gracefully disconnect when needed (perfect for laptop usage)

## Features

- **Hot-Join Capability**: Connect/disconnect workers dynamically
- **Automatic Job Distribution**: Server assigns jobs based on worker utilization
- **Ollama Integration**: Local AI model serving with health monitoring
- **Resource Monitoring**: Real-time system resource tracking
- **Graceful Shutdown**: Wait for current jobs to complete before disconnecting
- **Fault Tolerance**: Automatic reconnection and job retry mechanisms

## Prerequisites

Before running this project, ensure you have:

1. **Node.js** (v18 or higher)
2. **Redis** server running (for the central server)
3. **Ollama** installed and running locally on worker machines
4. **npm** or **yarn** package manager

### Installing Prerequisites

#### Install Node.js
```bash
# macOS (using Homebrew)
brew install node

# Or download from https://nodejs.org/
```

#### Install and Start Redis (for server only)
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Or using Docker
docker run -d -p 6379:6379 redis:7-alpine
```

#### Install and Start Ollama (on each worker)
```bash
# macOS
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama
ollama serve

# Pull a model (in another terminal)
ollama pull llama2  # or any other model you prefer
```

## Quick Start

### 1. Start the Central Server

```bash
# In the server directory
cd server
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

The server will start on port 4000 by default.

### 2. Start Worker Clients

```bash
# In the main directory
npm install
cp .env.example .env
# Edit .env with your server connection details
npm run dev
```

Workers will automatically connect to the server and register their capabilities.

### 3. Submit Inference Requests

Submit requests to the server (not individual workers):

```bash
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Hello, how are you?",
    "priority": "medium"
  }'
```

## Configuration

### Server Configuration (`server/.env`)

```env
# Server Configuration
PORT=4000
REDIS_HOST=localhost
REDIS_PORT=6379

# Worker Management
WORKER_HEARTBEAT_TIMEOUT=60000
MAX_CONCURRENT_JOBS_PER_WORKER=1
```

### Worker Configuration (`.env`)

```env
# Worker Configuration
PORT=3000
WORKER_ID=worker-macbook-001

# Server Connection
SERVER_HOST=localhost
SERVER_PORT=4000
SERVER_REDIS_HOST=localhost
SERVER_REDIS_PORT=6379

# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
```

## Hot-Join Usage

### Adding Your MacBook to the Pool

1. **Start your worker** when you want to contribute compute:
```bash
npm run dev
```

2. **Monitor your worker** via the local health endpoint:
```bash
curl http://localhost:3000/worker/status
```

3. **Gracefully disconnect** when you need your MacBook:
```bash
# Ctrl+C or SIGTERM - worker will finish current job before stopping
```

### Managing the Network

**Server Status:**
```bash
curl http://localhost:4000/health/workers  # View all connected workers
curl http://localhost:4000/health/jobs     # View job queue status
curl http://localhost:4000/inference/queue # Detailed queue information
```

**Available Models:**
```bash
curl http://localhost:4000/inference/models  # Models across all workers
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**:
   - Ensure Redis is running: `redis-cli ping`
   - Check Redis host/port in `.env`

2. **Ollama Not Found**:
   - Ensure Ollama is running: `curl http://localhost:11434/api/version`
   - Check Ollama host/port in `.env`

3. **Permission Errors**:
   - Ensure log directory is writable: `mkdir -p logs && chmod 755 logs`

4. **Port Already in Use**:
   - Change the PORT in `.env` file
   - Or kill the process using the port: `lsof -ti:3000 | xargs kill -9`

### Logs

Check application logs:
```bash
# View logs in real-time
tail -f logs/llmama-client.log

# View error logs
tail -f logs/error.log
```

## Development

### Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests (when implemented)
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues

### Project Structure
```
src/
├── config/           # Configuration management
├── services/         # Core services (Ollama, Redis, Broker)
├── middleware/       # Express middleware
├── routes/           # API route handlers
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── index.ts          # Application entry point
```

## Configuration

The application uses environment variables for configuration. See `.env.example` for all available options.

## License

MIT License - see LICENSE file for details.