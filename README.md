# AGIS

AGIS is a local-first security tool for masking and unmasking sensitive information (PII).

## Core Functionality

- **Data Interception**: Detects names, emails, and phone numbers in raw text.
- **Local Masking**: Replaces sensitive data with secure tokens (TOKEN_...).
- **Private Vault**: Stores masked data locally in your browser using AES-256-GCM encryption.
- **Information Rehydration**: Locally recovers the original text from tokens without sending sensitive data to the network.

## Project Structure

- `frontend/`: Single-page application for text sanitization.
- `backend/`: Core API for session management.

## Setup

1. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app
   ```