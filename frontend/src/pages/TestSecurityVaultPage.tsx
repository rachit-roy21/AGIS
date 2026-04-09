/**
 * TEST SECURITY VAULT PAGE - Inline Styling
 */

import { useState, useRef } from 'react';
import { useVault } from '../hooks/useVault';
import { useSession } from '../contexts/SessionContext';
import { useDetokenizer } from '../hooks/useDetokenizer';
import { getApiClient, generateProcessingId, DebateTranscriptItem } from '../utils/api';
import { DebateResult } from '../components/DebateResult';
import type { VaultStats } from '../utils/types';

interface TestState {
  lastError: string | null;
  lastSuccess: string | null;
}

interface TextTestResult {
  original: string;
  sanitized: string;
  detokenized: string;
  tokenCount: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  detokenized?: string;
  processingId?: string;
}

interface PdfTestResult {
  fileName: string;
  fileSize: number;
  pages: number;
  tokenCount: number;
  processingTime: number;
  geminiCalls: number;
  success: boolean;
  error?: string;
}

export function TestSecurityVaultPage() {
  const { vault, ready: vaultReady, wipe: wipeVault, storeFromTokenMap } = useVault();
  const { session, initializeSession: initGlobalSession } = useSession();
  const { detokenize } = useDetokenizer();
  const apiClient = getApiClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [testState, setTestState] = useState<TestState>({
    lastError: null,
    lastSuccess: null,
  });

  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [textTestResult, setTextTestResult] = useState<TextTestResult | null>(null);
  const [pdfTestResult, setPdfTestResult] = useState<PdfTestResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Debate state
  const [debateTranscript, setDebateTranscript] = useState<DebateTranscriptItem[]>([]);
  const [maskedContent, setMaskedContent] = useState<string | null>(null);
  const [debateLoading, setDebateLoading] = useState(false);
  const [debateError, setDebateError] = useState<string | null>(null);

  const handleInitializeSession = async () => {
    setLoading(true);
    try {
      console.log('Starting session creation...');
      const sessionResponse = await apiClient.createSession();
      console.log('Session response received:', sessionResponse);

      console.log('Initializing vault and session with:', {
        sessionId: sessionResponse.session_id,
        challenge: sessionResponse.challenge
      });
      await initGlobalSession(sessionResponse.session_id, sessionResponse.challenge);
      console.log('Session initialized successfully');

      setTestState({
        lastSuccess: `Session created: ${sessionResponse.session_id.substring(0, 8)}...`,
        lastError: null,
      });
    } catch (error) {
      console.error('Session creation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestState((prev) => ({
        ...prev,
        lastError: `Session creation failed: ${errorMessage}`,
        lastSuccess: null,
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleTextSanitization = async (inputText: string) => {
    if (!session.id) {
      setTestState((prev) => ({ ...prev, lastError: 'Session not initialized' }));
      return;
    }

    setLoading(true);
    try {
      const processingId = generateProcessingId();
      const response = await apiClient.sanitizeText(session.id, processingId, inputText);

      // Store tokens in vault using the optimized hook method
      if (Object.keys(response.tokens).length > 0) {
        await storeFromTokenMap(response.tokens);
        console.log(`[TestVault] Stored ${Object.keys(response.tokens).length} tokens in vault`);
      }

      const detokenizedText = await detokenize(response.sanitized_text);

      setTextTestResult({
        original: inputText,
        sanitized: response.sanitized_text,
        detokenized: detokenizedText,
        tokenCount: Object.keys(response.tokens).length,
      });

      if (vault) {
        const stats = await vault.getStats();
        setVaultStats(stats);
      }

      setTestState((prev) => ({
        ...prev,
        lastSuccess: `Text sanitized: ${Object.keys(response.tokens).length} tokens created`,
        lastError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestState((prev) => ({ ...prev, lastError: `Text sanitization failed: ${message}`, lastSuccess: null }));
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (!session.id) {
      setTestState((prev) => ({ ...prev, lastError: 'Session not initialized' }));
      return;
    }

    if (!file || file.type !== 'application/pdf') {
      setTestState((prev) => ({ ...prev, lastError: 'Please select a valid PDF file' }));
      return;
    }

    setLoading(true);
    try {
      const processingId = generateProcessingId();
      const response = await apiClient.sanitizePdf(session.id, processingId, file);

      // Store tokens in vault using the optimized hook method
      if (Object.keys(response.tokens).length > 0) {
        await storeFromTokenMap(response.tokens);
        console.log(`[TestVault] Stored ${Object.keys(response.tokens).length} tokens from PDF in vault`);
      }

      setPdfTestResult({
        fileName: file.name,
        fileSize: file.size,
        pages: response.pages,
        tokenCount: Object.keys(response.tokens).length,
        processingTime: response.processing_time_sec,
        geminiCalls: response.gemini_calls,
        success: true,
      });

      if (vault) {
        const stats = await vault.getStats();
        setVaultStats(stats);
      }

      setTestState((prev) => ({
        ...prev,
        lastSuccess: `PDF processed: ${response.pages} pages, ${Object.keys(response.tokens).length} tokens`,
        lastError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPdfTestResult({
        fileName: file.name,
        fileSize: file.size,
        pages: 0,
        tokenCount: 0,
        processingTime: 0,
        geminiCalls: 0,
        success: false,
        error: message,
      });
      setTestState((prev) => ({ ...prev, lastError: `PDF processing failed: ${message}`, lastSuccess: null }));
    } finally {
      setLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !session.id) return;

    setLoading(true);
    try {
      const processingId = generateProcessingId();
      const userMessage = chatInput.trim();

      // Add user message immediately
      setChatMessages((prev) => [...prev, {
        role: 'user',
        content: userMessage,
        processingId
      }]);

      // Use proper chat endpoint
      const response = await apiClient.sendChat(session.id, processingId, userMessage);
      const detokenizedAssistant = await detokenize(response.response);

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          detokenized: detokenizedAssistant,
          processingId
        },
      ]);

      if (vault) {
        const stats = await vault.getStats();
        setVaultStats(stats);
      }

      setChatInput('');

      setTestState((prev) => ({
        ...prev,
        lastSuccess: `Chat processed: ${Object.keys(response.tokens).length} tokens created`,
        lastError: null
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestState((prev) => ({ ...prev, lastError: `Chat failed: ${message}`, lastSuccess: null }));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVaultStats = async () => {
    if (vault) {
      const stats = await vault.getStats();
      setVaultStats(stats);
    }
  };

  const handleWipeVault = async () => {
    if (!window.confirm('Wipe all vault data?')) return;

    setLoading(true);
    try {
      await wipeVault();
      setVaultStats(null);
      setTextTestResult(null);
      setPdfTestResult(null);
      setChatMessages([]);
      setChatInput('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTestState((prev) => ({
        ...prev,
        lastSuccess: 'Vault wiped',
        lastError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestState((prev) => ({ ...prev, lastError: `Wipe failed: ${message}` }));
    } finally {
      setLoading(false);
    }
  };

  const handleRunDebate = async () => {
    if (!session.id) return;

    setDebateLoading(true);
    setDebateError(null);
    setMaskedContent(null);
    try {
      const response = await apiClient.runDebate(session.id);
      setDebateTranscript(response.transcript);
      if (response.masked_content) {
        setMaskedContent(response.masked_content);
      }

      setTestState((prev) => ({
        ...prev,
        lastSuccess: `Debate completed: ${response.transcript.length} exchanges`,
        lastError: null
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDebateError(message);
      setTestState((prev) => ({ ...prev, lastError: `Debate failed: ${message}` }));
    } finally {
      setDebateLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #0f172a, #1e293b)', padding: '1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
              VaultSim Security Test
            </h1>
            <p style={{ color: '#cbd5e1' }}>AES-256-GCM Encrypted Vault & Detokenization System</p>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Status: {vaultReady ? '✓ Vault Ready' : '○ Not Initialized'} |
              {session.id ? ` Session: ${session.id.substring(0, 8)}...` : ' No Session'}
            </p>
          </div>

          {testState.lastSuccess && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(20, 83, 45, 0.4)', border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '0.375rem', color: '#86efac' }}>
              ✓ {testState.lastSuccess}
            </div>
          )}
          {testState.lastError && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(127, 29, 29, 0.4)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '0.375rem', color: '#fca5a5' }}>
              ✗ {testState.lastError}
            </div>
          )}

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>1. Session Initialization</h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>Start session and derive encryption key</p>
            <button
              onClick={handleInitializeSession}
              disabled={loading || vaultReady}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: '600',
                border: 'none',
                cursor: loading || vaultReady ? 'not-allowed' : 'pointer',
                background: vaultReady ? '#475569' : '#2563eb',
                color: vaultReady ? '#94a3b8' : 'white',
                opacity: loading || vaultReady ? 0.5 : 1,
              }}
            >
              {loading ? 'Initializing...' : vaultReady ? 'Session Active' : 'Initialize Session'}
            </button>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>2. Text Sanitization</h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>Sanitize text containing PII</p>
            <textarea
              placeholder="Enter text with sensitive information"
              style={{
                width: '100%',
                height: '6rem',
                padding: '0.75rem',
                background: '#0f172a',
                color: 'white',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                marginBottom: '0.75rem',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
              defaultValue="My name is John Doe and my email is john@example.com. Call me at (555) 123-4567."
              id="textInput"
            />
            <button
              onClick={() => {
                const textarea = document.getElementById('textInput') as HTMLTextAreaElement;
                handleTextSanitization(textarea.value);
              }}
              disabled={loading || !vaultReady}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: '600',
                border: 'none',
                cursor: loading || !vaultReady ? 'not-allowed' : 'pointer',
                background: vaultReady ? '#16a34a' : '#475569',
                color: 'white',
                opacity: loading || !vaultReady ? 0.5 : 1,
              }}
            >
              {loading ? 'Processing...' : 'Sanitize Text'}
            </button>

            {textTestResult && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Original</label>
                  <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '0.375rem', color: '#cbd5e1', fontSize: '0.875rem', wordBreak: 'break-word' }}>
                    {textTestResult.original}
                  </div>
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Sanitized ({textTestResult.tokenCount} tokens)
                  </label>
                  <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '0.375rem', color: '#cbd5e1', fontSize: '0.875rem', wordBreak: 'break-word' }}>
                    {textTestResult.sanitized}
                  </div>
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Detokenized</label>
                  <div style={{ padding: '0.75rem', background: 'rgba(20, 83, 45, 0.2)', borderRadius: '0.375rem', color: '#86efac', fontSize: '0.875rem', wordBreak: 'break-word', border: '1px solid #16a34a' }}>
                    {textTestResult.detokenized}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>3. PDF Upload & Processing</h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>Upload PDF documents for PII detection and redaction</p>

            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handlePdfUpload(file);
                }
              }}
              disabled={loading || !vaultReady}
              style={{
                display: 'none',
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !vaultReady}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: '600',
                border: 'none',
                cursor: loading || !vaultReady ? 'not-allowed' : 'pointer',
                background: vaultReady ? '#7c3aed' : '#475569',
                color: 'white',
                opacity: loading || !vaultReady ? 0.5 : 1,
                marginBottom: '0.75rem',
              }}
            >
              {loading ? 'Processing PDF...' : 'Select PDF File'}
            </button>

            {pdfTestResult && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ padding: '0.75rem', background: pdfTestResult.success ? 'rgba(20, 83, 45, 0.2)' : 'rgba(127, 29, 29, 0.2)', borderRadius: '0.375rem', border: `1px solid ${pdfTestResult.success ? '#16a34a' : '#dc2626'}` }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: pdfTestResult.success ? '#86efac' : '#fca5a5', marginBottom: '0.5rem' }}>
                    {pdfTestResult.success ? '✓ PDF Processed Successfully' : '✗ PDF Processing Failed'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                    <div>File: {pdfTestResult.fileName}</div>
                    <div>Size: {(pdfTestResult.fileSize / 1024).toFixed(1)} KB</div>
                    {pdfTestResult.success && (
                      <>
                        <div>Pages: {pdfTestResult.pages}</div>
                        <div>Tokens: {pdfTestResult.tokenCount}</div>
                        <div>Processing Time: {pdfTestResult.processingTime.toFixed(2)}s</div>
                        <div>Gemini Calls: {pdfTestResult.geminiCalls}</div>
                      </>
                    )}
                    {pdfTestResult.error && (
                      <div style={{ color: '#fca5a5', marginTop: '0.25rem' }}>Error: {pdfTestResult.error}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pdfTestResult?.success && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #334155' }}>
                <button
                  onClick={() => window.location.href = '/debate'}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.375rem',
                    fontWeight: 'bold',
                    border: '1px solid #d97706',
                    cursor: 'pointer',
                    background: 'rgba(217, 119, 6, 0.1)',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.background = 'rgba(217, 119, 6, 0.2)';
                  }}
                  onMouseOut={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.background = 'rgba(217, 119, 6, 0.1)';
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>⚖️</span>
                  Access AI Security Debate
                </button>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>
                  Adversarial testing unlocked based on processed document
                </p>
              </div>
            )}
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>4. AI Security Debate</h2>
            <div style={{ flex: 1, color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>
              <p className="mb-2">
                Evaluate session robustness through adversarial testing between AI agents.
              </p>
              <p>
                They will try to extract sensitive context from your tokenized data.
              </p>
            </div>

            <button
              onClick={handleRunDebate}
              disabled={debateLoading || !vaultReady}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: '600',
                border: 'none',
                cursor: debateLoading || !vaultReady ? 'not-allowed' : 'pointer',
                background: vaultReady ? '#d97706' : '#475569',
                color: 'white',
                opacity: debateLoading || !vaultReady ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {debateLoading ? (
                <>
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    border: '2px solid white',
                    borderBottomColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Agents Debating...
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.125rem' }}>⚖️</span>
                  Start Security Debate
                </>
              )}
            </button>

            {debateError && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(127, 29, 29, 0.4)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.875rem' }}>
                Error: {debateError}
              </div>
            )}

            {debateTranscript.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <DebateResult transcript={debateTranscript} maskedContent={maskedContent} />
              </div>
            )}
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>5. Chat Simulation</h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>Send messages with PII for tokenization</p>

            <div style={{ background: '#0f172a', borderRadius: '0.375rem', padding: '0.75rem', height: '12rem', overflowY: 'auto', marginBottom: '0.75rem', border: '1px solid #334155' }}>
              {chatMessages.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>No messages yet...</div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      {msg.role === 'user' ? 'YOU' : 'ASSISTANT'}
                    </div>
                    {msg.role === 'user' ? (
                      <div style={{ padding: '0.5rem', background: 'rgba(37, 99, 235, 0.2)', borderRadius: '0.25rem', color: '#93c5fd', fontSize: '0.875rem' }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div>
                        <div style={{ padding: '0.5rem', background: 'rgba(51, 65, 85, 0.4)', borderRadius: '0.25rem', color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                          Tokenized: {msg.content.substring(0, 50)}...
                        </div>
                        {msg.detokenized && (
                          <div style={{ padding: '0.5rem', background: 'rgba(20, 83, 45, 0.2)', borderRadius: '0.25rem', color: '#86efac', fontSize: '0.875rem' }}>
                            Detokenized: {msg.detokenized.substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Type a message with PII..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                disabled={!vaultReady}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: '#0f172a',
                  color: 'white',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  opacity: vaultReady ? 1 : 0.5,
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleSendChatMessage}
                disabled={loading || !vaultReady || !chatInput.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: loading || !vaultReady || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  background: vaultReady ? '#2563eb' : '#475569',
                  color: 'white',
                  opacity: loading || !vaultReady || !chatInput.trim() ? 0.5 : 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>Vault Debug Panel</h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.75rem', marginBottom: '1rem' }}>⚠️ No values exposed</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>Vault Status</label>
                <div style={{ ...{ fontSize: '0.875rem', marginTop: '0.25rem' }, color: vaultReady ? '#4ade80' : '#facc15', fontWeight: 'bold' }}>
                  {vaultReady ? '✓ Ready' : '○ Not Ready'}
                </div>
              </div>

              {vaultStats && (
                <>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>Token Count</label>
                    <div style={{ fontSize: '1.125rem', color: '#22d3ee', fontWeight: 'bold', marginTop: '0.25rem' }}>
                      {vaultStats.tokenCount}
                    </div>
                  </div>

                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>Cache Size</label>
                    <div style={{ fontSize: '0.875rem', color: '#cbd5e1', marginTop: '0.25rem' }}>{vaultStats.cacheSize} values</div>
                  </div>
                </>
              )}

              <button
                onClick={handleUpdateVaultStats}
                disabled={!vaultReady || loading}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  border: 'none',
                  cursor: !vaultReady || loading ? 'not-allowed' : 'pointer',
                  background: '#334155',
                  color: '#cbd5e1',
                  opacity: !vaultReady || loading ? 0.5 : 1,
                  marginTop: '0.5rem',
                }}
              >
                {loading ? 'Updating...' : 'Update Stats'}
              </button>

              <button
                onClick={handleWipeVault}
                disabled={!vaultReady || loading}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  border: 'none',
                  cursor: !vaultReady || loading ? 'not-allowed' : 'pointer',
                  background: '#7f1d1d',
                  color: '#fca5a5',
                  opacity: !vaultReady || loading ? 0.5 : 1,
                }}
              >
                {loading ? 'Wiping...' : 'Wipe Vault'}
              </button>

              <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '0.375rem', color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.75rem', border: '1px solid #334155' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Encryption Details:</div>
                <ul style={{ listStyle: 'disc', paddingLeft: '1rem', lineHeight: '1.5' }}>
                  <li>AES-256-GCM</li>
                  <li>PBKDF2 SHA-256</li>
                  <li>100k+ iterations</li>
                  <li>IndexedDB encrypted</li>
                  <li>Memory-only cache</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
