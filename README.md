# LLMama Broker Client

A distributed AI inference broker client that acts as a broker dealer between individual node Ollama installations and a central host broker handler. This client facilitates distributed AI inference workload management across multiple compute nodes.

## Features

- **Connection Management**: Persistent connection to central broker via Redis with automatic reconnection
- **Ollama Integration**: Detects and connects to local Ollama instance, monitors health and capabilities
- **Work Distribution**: Registers node capabilities, polls for tasks, and executes inference requests
- **Task Execution**: Handles inference requests with proper error handling, timeouts, and progress tracking
- **Health Monitoring**: Real-time system resource monitoring and health checks
- **Distributed Queue**: Uses BullMQ and Redis for reliable task distribution

## Prerequisites

Before running this project, ensure you have:

1. **Node.js** (v18 or higher)
2. **Redis** server running
3. **Ollama** installed and running locally
4. **npm** or **yarn** package manager

### Installing Prerequisites

#### Install Node.js
```bash
# macOS (using Homebrew)
brew install node

# Or download from https://nodejs.org/
```

#### Install and Start Redis
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Or using Docker
docker run -d -p 6379:6379 redis:7-alpine
```

#### Install and Start Ollama
```bash
# macOS
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama
ollama serve

# Pull a model (in another terminal)
ollama pull llama2  # or any other model you prefer
```

## Installation

1. **Clone the repository** (if not already done):
```bash
git clone <repository-url>
cd LLMama
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Key environment variables to configure:
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434

# Security (change these!)
BROKER_AUTH_TOKEN=your-secure-token-here
JWT_SECRET=your-super-secret-jwt-key
API_KEY=your-api-key-here

# Worker Configuration
WORKER_ID=worker-001
```

## Running the Project

### Development Mode
```bash
# Start in development mode with hot reload
npm run dev
```

### Production Mode
```bash
# Build the project
npm run build

# Start in production mode
npm start
```

### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build Docker image manually
docker build -t llmama-client .
docker run -p 3000:3000 llmama-client
```

## API Endpoints

Once running, the service provides these endpoints:

### Health Checks
- `GET /health` - Basic health status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /health/system` - Detailed system information

### Root
- `GET /` - Service information

## Verification

After starting the service, verify it's working:

1. **Check service status**:
```bash
curl http://localhost:3000/
```

2. **Check health**:
```bash
curl http://localhost:3000/health
```

3. **Check system info**:
```bash
curl http://localhost:3000/health/system
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