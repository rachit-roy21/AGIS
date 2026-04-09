# AGIS

A privacy-first document sanitization and processing system.

## 🏗️ Project Structure

```
VaultSim/
├── backend/                 # FastAPI backend application
├── frontend/               # Frontend application
├── infrastructure/         # Infrastructure components (database, redis, modal)
├── tests/                  # Test files and data
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── logs/                   # Log files
└── docker-compose.yml      # Main docker configuration
```

## 🚀 Quick Start

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Create a session:**
   ```bash
   curl -X POST "http://localhost:8000/api/auth/session"
   ```

3. **Sanitize text:**
   ```bash
   curl -X POST \
     -H "session-id: [SESSION_ID]" \
     -H "processing-id: [UUID]" \
     -H "Content-Type: application/json" \
     -d '{"text":"Your text here"}' \
     "http://localhost:8000/api/sanitize/text"
   ```

## 📚 API Documentation

### Authentication
- `POST /api/auth/session` - Create a new session

### Sanitization
- `POST /api/sanitize/text` - Sanitize text content
- `POST /api/sanitize/pdf` - Sanitize PDF files
- `GET /api/sanitize/outputs/{processing_id}` - Get outputs by processing ID
- `GET /api/sanitize/outputs/session/{session_id}` - Get outputs by session

### Health
- `GET /api/health` - Health check endpoint

## 🔧 Development

### Backend
- **Framework:** FastAPI
- **Database:** PostgreSQL
- **Cache:** Redis
- **Sanitization:** Gemini AI

### Environment Variables
Create a `.env` file with:
```
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://vaultsim:password@localhost:5432/vaultsim
REDIS_URL=redis://localhost:6379
```

## 🧪 Testing

Test files and data are located in the `tests/data/` directory.

## 📝 License

[Add your license information here]