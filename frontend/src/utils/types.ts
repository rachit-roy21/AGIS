/**
 * Type definitions for AGIS frontend
 */

export interface VaultStats {
  tokenCount: number;
  sessionId: string;
  cacheSize: number;
  encryptedSize: string;
  isReady: boolean;
}

export interface SessionCreateResponse {
  session_id: string;
  challenge: string;
  expires_in: number;
}
