# AGIS

AGIS is a local-first security tool for masking and unmasking sensitive information (PII).

## Core Functionality

- **Data Interception**: Detects names, emails, and phone numbers in raw text.
- **Local Masking**: Replaces sensitive data with unique secure tokens (`TOKEN_...`).
- **Private Vault**: Stores masked data locally in your browser using AES-256-GCM encryption.
- **Information Rehydration**: Locally recovers original text from tokens for authorized viewing.

## Project Structure

- `frontend/`: The complete AGIS application (Vite + React).

## Setup & Development

1. **Navigate to app**: `cd frontend`
2. **Install**: `npm install`
3. **Run**: `npm run dev`

## Deployment

This project is optimized for **Vercel**. Deploy by pushing the `frontend/` directory to your project.