# 🚀 Multi-Language Code Runner

A Node.js server that executes code in multiple programming languages using Docker containers for isolation and security.

## ✨ Features

- **Multi-language Support**: Python, C, C++, Java, JavaScript, TypeScript, SQLite
- **Docker-based Execution**: Secure isolated environments
- **CORS Enabled**: Support for web applications
- **Real-time Execution**: Fast code execution with timeout protection
- **REST API**: Simple HTTP endpoints for code execution
- **Continuous Deployment**: GitHub Actions for automated deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │───▶│   Node Server   │───▶│  Docker Container│
│  (Frontend)     │    │   (Express)     │    │  (Code Runner)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Temp Files    │
                       │  (Isolated)     │
                       └─────────────────┘
```

## 🛠️ Supported Languages

| Language | Compiler/Interpreter | File Extension |
|----------|---------------------|----------------|
| Python   | python3             | `.py`          |
| C        | gcc                 | `.c`           |
| C++      | g++                 | `.cpp`         |
| Java     | javac + java        | `.java`        |
| JavaScript | node               | `.js`          |
| TypeScript | ts-node           | `.ts`          |
| SQLite   | sqlite3             | `.sql`         |

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd code-runner
   ```

2. **Start the server**
   ```bash
   docker-compose up -d
   ```

3. **Optional: Start with MySQL**
   ```bash
   docker-compose --profile mysql up -d
   ```

4. **Test the server**
   ```bash
   curl http://localhost:3000/health
   ```

### Manual Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the server**
   ```bash
   npm start
   ```

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Get Supported Languages
```http
GET /languages
```

### Execute Code
```http
POST /run
Content-Type: application/json

{
  "language": "python",
  "sourceCode": "print('Hello, World!')",
  "input": ""
}
```

**Response:**
```json
{
  "run": {
    "stdout": "Hello, World!\n",
    "stderr": "",
    "code": 0,
    "executionTime": 45,
    "language": "python"
  },
  "success": true
}
```

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Docker Configuration
- **Base Image**: Ubuntu 22.04
- **Timeout**: 10 seconds per execution
- **Memory Limits**: Configurable via Docker

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t code-runner .
```

### Run Container
```bash
docker run -p 3000:3000 -v $(pwd)/temp:/app/temp code-runner
```

### With Docker Compose
```bash
docker-compose up -d
```

## 🔄 Continuous Deployment

The project includes CI/CD pipelines for automated deployment:

### GitHub Actions
1. **Test**: Runs basic server tests
2. **Build**: Creates Docker image
3. **Deploy**: Deploys to production (main branch only)

### Azure DevOps
1. **Test**: Runs validation tests
2. **Build**: Creates and pushes Docker image
3. **Deploy**: Deploys to Azure Container Apps and Web Apps

### Setup Secrets

#### GitHub Repository
Add these secrets to your GitHub repository:
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password/token

#### Azure DevOps
Add these service connections and variables:
- `dockerhub`: Docker Hub service connection
- `your-azure-subscription`: Azure subscription service connection
- `DOCKER_HUB_USERNAME`: Docker Hub username
- `DOCKER_HUB_PASSWORD`: Docker Hub password

## ☁️ Azure Deployment

### Option 1: Azure Container Apps (Recommended)

#### Using Azure CLI Script
```bash
# Make the script executable
chmod +x deploy-azure.sh

# Run the deployment
./deploy-azure.sh
```

#### Manual Deployment
```bash
# Login to Azure
az login

# Create resource group
az group create --name code-runner-rg --location eastus

# Create container app environment
az containerapp env create \
  --name code-runner-env \
  --resource-group code-runner-rg \
  --location eastus

# Deploy container app
az containerapp create \
  --name code-runner-app \
  --resource-group code-runner-rg \
  --environment code-runner-env \
  --image your-docker-username/code-runner:latest \
  --target-port 3000 \
  --ingress 'external' \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 10
```

### Option 2: Azure Web App for Containers

#### Using ARM Template
```bash
# Deploy using ARM template
az deployment group create \
  --resource-group code-runner-rg \
  --template-file azure/arm-template.json \
  --parameters siteName=code-runner-webapp \
  --parameters hostingPlanName=code-runner-plan \
  --parameters dockerHubUsername=your-docker-username \
  --parameters dockerHubPassword=your-docker-password
```

#### Using Azure Portal
1. Create a Web App for Containers
2. Configure Docker Hub registry
3. Set image to `your-docker-username/code-runner:latest`
4. Set environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `WEBSITES_PORT=3000`

### Azure DevOps Pipeline Setup

1. **Create Azure DevOps Project**
2. **Connect Repository**: Link your GitHub repository
3. **Create Pipeline**: Use `.azure/azure-pipelines.yml`
4. **Configure Variables**:
   - `dockerRegistryServiceConnection`: Docker Hub service connection
   - `containerRegistry`: Your Docker Hub username
   - `azureSubscription`: Azure subscription connection

5. **Create Environments**:
   - `staging`: For develop branch
   - `production`: For main branch
   - `container-apps`: For Container Apps deployment

### Monitoring and Scaling

#### Container Apps Monitoring
```bash
# View logs
az containerapp logs show \
  --name code-runner-app \
  --resource-group code-runner-rg \
  --tail 50

# Scale configuration
az containerapp update \
  --name code-runner-app \
  --resource-group code-runner-rg \
  --min-replicas 2 \
  --max-replicas 20
```

#### Web App Monitoring
```bash
# View logs
az webapp log tail \
  --name code-runner-webapp \
  --resource-group code-runner-rg

# Scale up
az appservice plan update \
  --name code-runner-plan \
  --resource-group code-runner-rg \
  --sku S1
```

## 📝 Usage Examples

### Python Example
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "sourceCode": "name = input(\"Enter your name: \")\nprint(f\"Hello, {name}!\")",
    "input": "Alice"
  }'
```

### C++ Example
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "language": "cpp",
    "sourceCode": "#include <iostream>\nusing namespace std;\nint main() {\n    cout << \"Hello from C++!\" << endl;\n    return 0;\n}",
    "input": ""
  }'
```

### SQL Example
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "language": "sql",
    "sourceCode": "CREATE TABLE users (id INTEGER, name TEXT);\nINSERT INTO users VALUES (1, \"John\");\nSELECT * FROM users;",
    "input": ""
  }'
```

## 🔒 Security Features

- **Docker Isolation**: Each execution runs in isolated containers
- **Timeout Protection**: 10-second execution limit
- **File Cleanup**: Automatic cleanup of temporary files
- **Input Validation**: Validates all inputs before execution
- **Resource Limits**: Configurable memory and CPU limits

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process using port 3000
   lsof -ti:3000 | xargs kill -9
   ```

2. **Docker permission issues**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   ```

3. **Temp directory permissions**
   ```bash
   # Ensure temp directory exists and is writable
   mkdir -p temp && chmod 755 temp
   ```

### Logs

```bash
# Docker logs
docker-compose logs -f code-runner

# Application logs
docker logs code-runner-server
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Docker for containerization
- Express.js for the web framework
- Judge0 API inspiration for the execution model
