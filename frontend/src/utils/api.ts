/**
 * API Client Layer
 * 
 * Implements backend API contracts exactly as specified
 * Automatically stores tokens from responses via vault.storeFromTokenMap()
 * 
 * Contracts:
 * - POST /api/auth/session - Create new session
 * - GET /api/auth/session - Get session status
 * - DELETE /api/auth/session - Terminate session
 * - POST /api/sanitize/text - Sanitize text
 * - POST /api/sanitize/pdf - Sanitize PDF
 * - GET /api/sanitize/outputs - Get outputs
 * - GET /api/health - Health check
 */

import { getVault } from '../utils/Vault';
import { createProcessingId } from './generateProcessingId';

// ============ Type Definitions ============

export interface SessionCreateResponse {
  session_id: string;
  challenge: string;
  expires_in: number;
}

export interface SessionStatusResponse {
  session_id: string;
  session_data: {
    created_at: string;
    last_active: string;
    requests: number;
  };
  pipeline_status: 'idle' | 'running' | 'error';
  ttl_seconds: number;
  active: boolean;
}

export interface SanitizeTextRequest {
  text: string;
}

export interface SanitizeTextResponse {
  sanitized_text: string;
  tokens: Record<string, string>;
  engine: string;
}

export interface SanitizePdfResponse {
  pdf_bytes: ArrayBuffer;
  tokens: Record<string, string>;
  pages: number;
  processing_time_sec: number;
  gemini_calls: number;
}

export interface SanitizedOutput {
  session_id: string;
  input_type: 'text' | 'pdf';
  tokenized_content: string;
  engine: string;
  created_at: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  response: string;
  tokens: Record<string, string>;
  engine: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
}

export interface DebateTranscriptItem {
  agent: string;
  text: string;
}

export interface DebateResponse {
  session_id: string;
  transcript: DebateTranscriptItem[];
  masked_content?: string;
}

export interface HistoricalDebatesResponse {
  session_id: string;
  debates: {
    id: string;
    session_id: string;
    transcript: DebateTranscriptItem[];
    created_at: string;
  }[];
}

// ============ API Client ============

class ApiClient {
  private apiUrl: string;

  constructor() {
    // Smart URL resolution with proper fallbacks
    if (import.meta.env.VITE_API_URL) {
      // If VITE_API_URL is provided, use it exactly (e.g., "http://localhost:8000")
      this.apiUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
    } else if (import.meta.env.PROD) {
      // In production, Nginx proxies /api to backend:8000
      this.apiUrl = ''; // Use relative paths directly
    } else {
      // In development, Vite proxied directly or direct to backend
      this.apiUrl = 'http://localhost:8000';
    }
  }

  /**
   * Helper: Make API request with proper error handling
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: Record<string, unknown> | FormData;
      headers?: Record<string, string>;
      sessionId?: string;
      processingId?: string;
    }
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = options?.headers || {};

    // Add session ID if provided
    if (options?.sessionId) {
      headers['X-Session-ID'] = options.sessionId;
    }

    // Add processing ID if provided
    if (options?.processingId) {
      headers['X-Processing-ID'] = options.processingId;
    }

    // Set content type if not FormData
    if (options?.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (options?.body) {
      if (options.body instanceof FormData) {
        fetchOptions.body = options.body;
      } else {
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    console.log(`[API] Fetching: ${method} ${url}`);

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        console.error(`[API] HTTP Error: ${response.status}`, { url, method });
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // Special handling for PDF responses
      if (endpoint.includes('/sanitize/pdf')) {
        return response.arrayBuffer() as Promise<T>;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      console.error(`[API] Fetch failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Create new session
   * Returns session ID and challenge for key derivation
   */
  async createSession(): Promise<SessionCreateResponse> {
    const response = await this.request<SessionCreateResponse>(
      'POST',
      '/api/auth/session'
    );

    console.log('[API] Session created:', {
      sessionId: response.session_id,
      expiresIn: response.expires_in,
    });

    return response;
  }

  /**
   * Get current session status
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    return this.request<SessionStatusResponse>(
      'GET',
      `/api/auth/session`,
      { sessionId }
    );
  }

  /**
   * Terminate session
   * SECURITY: Frontend should call vault.wipe() before this
   */
  async terminateSession(sessionId: string): Promise<void> {
    await this.request<{ message: string }>(
      'DELETE',
      `/api/auth/session`,
      { sessionId }
    );
  }

  /**
   * Sanitize raw text
   */
  async sanitizeText(
    sessionId: string,
    processingId: string,
    text: string
  ): Promise<SanitizeTextResponse> {
    const response = await this.request<SanitizeTextResponse>(
      'POST',
      '/api/sanitize/text',
      {
        body: { text },
        sessionId,
        processingId,
      }
    );

    // SECURITY: Immediately store tokens in vault
    if (response.tokens && Object.keys(response.tokens).length > 0) {
      const vault = getVault();
      if (vault.isReady()) {
        try {
          await vault.storeFromTokenMap(response.tokens);
          console.log(`[API] Stored ${Object.keys(response.tokens).length} tokens from text sanitization`);
        } catch (error) {
          console.error('[API] Token storage failed:', error);
          throw new Error('Failed to secure tokens');
        }
      }
    }

    return response;
  }

  /**
   * Sanitize PDF document
   * 
   * SECURITY CRITICAL:
   * 1. Streams PDF file to backend
   * 2. Backend extracts text, tokenizes, redacts PDF
   * 3. Returns redacted PDF + token map in headers
   * 4. Frontend MUST store tokens before processing PDF
   * 
   * @param sessionId - Active session ID
   * @param processingId - Unique ID for this operation
   * @param file - PDF file to sanitize
   */
  async sanitizePdf(
    sessionId: string,
    processingId: string,
    file: File
  ): Promise<SanitizePdfResponse> {
    const formData = new FormData();
    formData.append('file', file);

    console.log(`[API] Sanitizing PDF: ${file.name} (${file.size} bytes)`);

    const response = await fetch(`${this.apiUrl}/api/sanitize/pdf`, {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId,
        'X-Processing-ID': processingId,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error(`[API] PDF Sanitization Failed: ${response.status}`);
      throw new Error(`PDF sanitization failed: ${response.status}`);
    }

    const pdfBytes = await response.arrayBuffer();

    // Extract token metadata from headers
    const tokensHeader = response.headers.get('X-Tokens') || '';
    const tokenIds = tokensHeader ? tokensHeader.split(',').filter(t => t) : [];
    const pages = parseInt(response.headers.get('X-Pages') || '0', 10);
    const processingTime = parseFloat(response.headers.get('X-Processing-Time') || '0');
    const geminiCalls = parseInt(response.headers.get('X-Gemini-Calls') || '0', 10);

    console.log(`[API] PDF processing: ${pages} pages, ${tokenIds.length} tokens, ${geminiCalls} Gemini calls`);

    // Fetch actual token mapping
    let tokens: Record<string, string> = {};
    if (tokenIds.length > 0) {
      try {
        const outputResponse = await this.getSanitizedOutputsByProcessingId(processingId, sessionId);

        // Find the PDF output and parse its tokenized_content (which is JSON)
        const pdfOutput = outputResponse.outputs.find(o => o.input_type === 'pdf');
        if (pdfOutput && pdfOutput.tokenized_content) {
          try {
            tokens = JSON.parse(pdfOutput.tokenized_content);
          } catch (e) {
            console.error('[API] Failed to parse PDF token mapping:', e);
            for (const id of tokenIds) tokens[id] = '[PARSING_ERROR]';
          }
        } else {
          for (const id of tokenIds) tokens[id] = '[VAULT_FETCH_EMPTY]';
        }
      } catch (e) {
        console.error('[API] Failed to fetch real tokens for PDF:', e);
        for (const id of tokenIds) tokens[id] = '[VAULT_FETCH_ERROR]';
      }
    }

    return {
      pdf_bytes: pdfBytes,
      tokens,
      pages,
      processing_time_sec: processingTime,
      gemini_calls: geminiCalls,
    };
  }

  /**
   * Get sanitized outputs by processing ID
   */
  async getSanitizedOutputsByProcessingId(
    processingId: string,
    sessionId?: string
  ): Promise<{ processing_id: string; outputs: SanitizedOutput[] }> {
    return this.request(
      'GET',
      `/api/sanitize/outputs/${processingId}`,
      { sessionId }
    );
  }

  /**
   * Get all sanitized outputs for session
   */
  async getSanitizedOutputsBySession(
    sessionId: string
  ): Promise<{ session_id: string; outputs: SanitizedOutput[] }> {
    return this.request(
      'GET',
      `/api/sanitize/outputs`,
      { sessionId }
    );
  }

  /**
   * Send chat message with PII detection and tokenization
   * 
   * SECURITY CRITICAL:
   * 1. Backend detects PII in chat messages
   * 2. Returns tokenized response + token map
   * 3. Frontend MUST immediately call vault.storeFromTokenMap(tokens)
   * 4. Only then render the detokenized response
   * 
   * @param sessionId - Active session ID
   * @param processingId - Unique ID for this operation
   * @param message - Chat message to send
   */
  async sendChat(
    sessionId: string,
    processingId: string,
    message: string
  ): Promise<ChatResponse> {
    const response = await this.request<ChatResponse>(
      'POST',
      '/api/chat',
      {
        body: { message },
        sessionId,
        processingId,
      }
    );

    // SECURITY: Immediately store tokens in vault
    if (response.tokens && Object.keys(response.tokens).length > 0) {
      const vault = getVault();
      if (vault.isReady()) {
        try {
          await vault.storeFromTokenMap(response.tokens);
          console.log(`[API] Stored ${Object.keys(response.tokens).length} tokens from chat response`);
        } catch (error) {
          console.error('[API] Token storage failed:', error);
          throw new Error('Failed to secure chat tokens');
        }
      }
    }

    return response;
  }

  /**
   * Run an AI Security Debate for the session
   */
  async runDebate(sessionId: string): Promise<DebateResponse> {
    return this.request<DebateResponse>(
      'POST',
      `/api/debate/run/${sessionId}`,
      { sessionId }
    );
  }

  /**
   * Get historical debates for a session
   */
  async getHistoricalDebates(sessionId: string): Promise<HistoricalDebatesResponse> {
    return this.request<HistoricalDebatesResponse>(
      'GET',
      `/api/debate/session/${sessionId}`,
      { sessionId }
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>(
      'GET',
      '/api/health'
    );
  }
}

/**
 * Global API client singleton
 */
let apiClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClient) {
    apiClient = new ApiClient();
  }
  return apiClient;
}

/**
 * Generate unique processing ID for tracking operations
 * Re-export from centralized utility for backward compatibility
 * 
 * @deprecated Use createProcessingId() from generateProcessingId.ts instead
 */
export function generateProcessingId(): string {
  return createProcessingId();
}
