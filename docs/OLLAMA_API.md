# GridLLM Server - Ollama API Compatibility

The GridLLM server provides a complete Ollama API-compatible interface under the `/ollama` route. This allows existing Ollama clients and applications to work seamlessly with GridLLM's distributed inference system.

## Base URL

All Ollama API endpoints are available under:

```
http://[host]:[port]/ollama
```

For example, if your GridLLM server is running on `localhost:3001`, the Ollama API base would be:

```
http://localhost:3001/ollama
```

## Supported Endpoints

### Generate a Completion

- **POST** `/ollama/api/generate`
- Generate text completions using a specified model
- Supports streaming and non-streaming responses
- Compatible with all Ollama generation parameters

### Generate a Chat Completion

- **POST** `/ollama/api/chat`
- Generate chat-based completions with conversation history
- Supports tool calling and structured outputs
- Compatible with all Ollama chat parameters

### List Local Models

- **GET** `/ollama/api/tags`
- List all available models across the worker network
- Returns models in Ollama-compatible format

### Show Model Information

- **POST** `/ollama/api/show`
- Get detailed information about a specific model
- Returns modelfile, parameters, and metadata

### Create a Model

- **POST** `/ollama/api/create`
- Create new models from existing ones or files
- Supports model copying, quantization, and custom configurations

### Copy a Model

- **POST** `/ollama/api/copy`
- Copy an existing model with a new name

### Delete a Model

- **DELETE** `/ollama/api/delete`
- Remove a model from the system

### Pull a Model

- **POST** `/ollama/api/pull`
- Download models from remote repositories
- Supports streaming progress updates

### Push a Model

- **POST** `/ollama/api/push`
- Upload models to remote repositories
- Supports streaming progress updates

### Generate Embeddings

- **POST** `/ollama/api/embed`
- Generate vector embeddings for text input
- Supports single and batch processing

### List Running Models

- **GET** `/ollama/api/ps`
- Show currently loaded models across workers

### Version Information

- **GET** `/ollama/api/version`
- Get API version information

### Legacy Embeddings Endpoint

- **POST** `/ollama/api/embeddings`
- Legacy embedding endpoint for backward compatibility

### Blob Management

- **HEAD** `/ollama/api/blobs/:digest`
- Check if a blob exists
- **POST** `/ollama/api/blobs/:digest`
- Upload binary data for model creation

## Usage Examples

### Basic Text Generation

```bash
curl http://localhost:3001/ollama/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

### Chat Completion

```bash
curl http://localhost:3001/ollama/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "stream": false
}'
```

### List Available Models

```bash
curl http://localhost:3001/ollama/api/tags
```

### Generate Embeddings

```bash
curl http://localhost:3001/ollama/api/embed -d '{
  "model": "all-minilm",
  "input": "Hello world"
}'
```

## Distributed Features

While maintaining full Ollama API compatibility, GridLLM adds distributed system capabilities:

- **Load Balancing**: Requests are automatically distributed across available workers
- **Model Availability**: Models available on any worker in the network are accessible
- **Fault Tolerance**: Automatic failover if workers become unavailable
- **Scaling**: Add more workers to increase capacity without API changes

## Streaming Responses

GridLLM supports Ollama's streaming protocol:

- Set `"stream": true` for real-time token streaming
- Responses are sent as newline-delimited JSON
- Final response includes complete metadata

## Error Handling

Error responses maintain Ollama compatibility:

- HTTP status codes match Ollama behavior
- Error messages are in Ollama format
- Validation errors provide detailed feedback

## Model Management

Models are managed across the distributed worker network:

- Any model available on any worker can be used
- Model availability is checked in real-time
- Load balancing ensures optimal resource utilization

## Integration

To migrate from Ollama to GridLLM:

1. Change your base URL from `http://localhost:11434` to `http://[GridLLM-server]:[port]/ollama`
2. All existing Ollama client code works without modification
3. Benefit from distributed inference capabilities

## Performance

GridLLM's distributed architecture provides:

- Higher throughput through parallel processing
- Better resource utilization across multiple machines
- Automatic load balancing for optimal performance
- Scalable infrastructure as demand grows
