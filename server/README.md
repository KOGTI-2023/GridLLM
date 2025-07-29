# LLMama Server

Central server for managing distributed AI inference workers in the LLMama network.

## Quick Start

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Redis** (if not already running):
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or using local installation
redis-server
```

4. **Start the server**:
```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start
```

## Configuration

Key environment variables:

- `PORT`: Server port (default: 4000)
- `REDIS_HOST`: Redis host for worker communication
- `REDIS_PORT`: Redis port
- `WORKER_HEARTBEAT_TIMEOUT`: How long to wait for worker heartbeats
- `MAX_CONCURRENT_JOBS_PER_WORKER`: Job limit per worker

## API Endpoints

### Health & Status
- `GET /` - Server status and overview
- `GET /health` - Basic health check
- `GET /health/system` - Detailed system information
- `GET /health/workers` - Worker status
- `GET /health/jobs` - Job statistics

### Inference
- `POST /inference` - Submit inference request
- `GET /inference/:id/status` - Get job status
- `DELETE /inference/:id` - Cancel job
- `GET /inference/models` - Available models
- `GET /inference/queue` - Queue statistics

## Architecture

The server manages:
- **Worker Registry**: Tracks connected workers and their capabilities
- **Job Scheduler**: Distributes jobs based on worker availability and load
- **Redis Communication**: Message bus for worker coordination
- **Health Monitoring**: Worker heartbeats and system status

Workers connect to the server and are automatically discovered and managed.
