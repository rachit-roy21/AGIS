/**
 * TEST SECURITY VAULT PAGE - Reference Design Match (Larger Sans-Serif Typography)
 */

import { useState, useEffect } from 'react';
import { useVault } from '../hooks/useVault';
import { useSession } from '../contexts/SessionContext';
import { useDetokenizer } from '../hooks/useDetokenizer';
import { getApiClient, generateProcessingId } from '../utils/api';
import { askGemini } from '../utils/gemini';
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

export function TestSecurityVaultPage() {
  const { vault, ready: vaultReady, storeFromTokenMap } = useVault();
  const { session, initializeSession: initGlobalSession } = useSession();
  const { detokenize } = useDetokenizer();
  const apiClient = getApiClient();

  const [testState, setTestState] = useState<TestState>({
    lastError: null,
    lastSuccess: null,
  });

  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [textTestResult, setTextTestResult] = useState<TextTestResult | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const handleInitializeSession = async () => {
    setLoading(true);
    try {
      const sessionResponse = await apiClient.createSession();
      await initGlobalSession(sessionResponse.session_id, sessionResponse.challenge);
      
      setTestState({
        lastSuccess: `SESSION SECURED. LOCAL KEYS DERIVED.`,
        lastError: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestState((prev) => ({
        ...prev,
        lastError: `FAILURE: ${errorMessage}`,
        lastSuccess: null,
      }));
    } finally {
      setLoading(false);
    }
  };

  // Reset state on logout
  useEffect(() => {
    if (!session.isActive) {
      setTextTestResult(null);
      setAiResponse(null);
      setVaultStats(null);
      setTestState({
        lastError: null,
        lastSuccess: null,
      });
      // Clear textarea if it exists
      const textArea = document.getElementById('textInput') as HTMLTextAreaElement;
      if (textArea) textArea.value = "My name is John Doe and my phone number is 567898767892.";
    }
  }, [session.isActive]);

  const handleTextSanitization = async (inputText: string) => {
    if (!session.id) {
      setTestState((prev) => ({ ...prev, lastError: 'NO ACTIVE SESSION' }));
      return;
    }

    setLoading(true);
    try {
      const processingId = generateProcessingId();
      const response = await apiClient.sanitizeText(session.id, processingId, inputText);

      if (Object.keys(response.tokens).length > 0) {
        await storeFromTokenMap(response.tokens);
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
        lastSuccess: `${Object.keys(response.tokens).length} PII ENTITIES ISOLATED`,
        lastError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestState((prev) => ({ ...prev, lastError: `INTERCEPT FAILED: ${message}`, lastSuccess: null }));
    } finally {
      setLoading(false);
    }
  };

  const handleAskGemini = async () => {
    if (!textTestResult?.sanitized) return;
    
    setAiLoading(true);
    setTestState(prev => ({ ...prev, lastError: null }));

    try {
      const result = await askGemini(textTestResult.sanitized);
      
      if (result.isError) {
        setTestState(prev => ({ ...prev, lastError: result.text }));
        return;
      }

      // Rehydrate AI response locally
      const rehydratedResponse = await detokenize(result.text);
      setAiResponse(rehydratedResponse);
      
      setTestState(prev => ({ 
        ...prev, 
        lastSuccess: 'PRIVATE AI RESPONSE RECEIVED' 
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestState(prev => ({ ...prev, lastError: `AI INTERFACE ERROR: ${message}` }));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-[#faf9f6]/90 backdrop-blur-sm border border-[#e8e5df] rounded-[2.5rem] p-6 lg:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] min-h-[78vh] flex flex-col font-sans">
      
      {/* Top Meta Row */}
      <div className="flex items-center justify-between text-xs sm:text-sm tracking-widest uppercase mb-8 px-2 font-semibold">
        <div className={`flex items-center gap-2 ${vaultReady ? 'text-[#22c55e]' : 'text-[#a39f98]'}`}>
          <div className={`w-3 h-3 rounded-full ${vaultReady ? 'bg-[#22c55e]' : 'bg-[#d6d3cc]'}`}></div>
          {vaultReady ? 'SECURE VAULT ACTIVE' : 'VAULT OFFLINE'}
        </div>
        <div className="text-[#63615b]">
          SESSION ID: <span className="text-[#1f1e1c] ml-2 font-mono">{session.id ? session.id.substring(0, 16).toUpperCase() : 'NONE'}</span>
        </div>
      </div>

      {/* Active Inner Workspace */}
      <div className="bg-white border border-[#eeeeee] rounded-[2rem] p-8 lg:p-12 shadow-[0_2px_15px_rgba(0,0,0,0.02)] flex-1 flex flex-col">
        
        {/* Module Header from Reference */}
        <div className="flex items-center gap-3 text-[#22c55e] text-sm sm:text-base font-bold tracking-widest uppercase mb-12">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          {textTestResult ? 'SANITIZED OUTPUT GENERATED' : 'DATA SANITISATION PROTOCOL'}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* Left Column (Controls & Input) */}
          <div className="lg:col-span-5 flex flex-col gap-12">
            
            {/* Step 1 */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-[#f4f2ee] pb-3">
                <span className="text-xs sm:text-sm tracking-widest font-bold text-[#4a4843]">STEP 01 // INITIALIZATION</span>
              </div>
              <p className="text-[#33322f] text-sm sm:text-base leading-relaxed mb-6">
                Before intercepting sensitive data, the local vault must derive isolated cryptographic keys.
              </p>
              <button
                onClick={handleInitializeSession}
                disabled={loading || vaultReady}
                className={`w-full py-4 px-6 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
                  vaultReady 
                    ? 'bg-[#e8e5df] text-[#63615b] cursor-not-allowed'
                    : 'bg-[#1f1e1c] hover:bg-black text-white shadow-md active:scale-[0.98]'
                }`}
              >
                {loading ? 'INITIALIZING...' : vaultReady ? 'VAULT SECURED' : 'ACTIVATE VAULT'}
              </button>
            </div>

            {/* Step 2 */}
            <div className={!vaultReady ? 'opacity-60 grayscale-[50%] pointer-events-none transition-all' : 'transition-all'}>
              <div className="flex items-center justify-between mb-4 border-b border-[#f4f2ee] pb-3">
                <span className="text-xs sm:text-sm tracking-widest font-bold text-[#4a4843]">STEP 02 // INPUT STREAM</span>
              </div>
              <textarea
                id="textInput"
                placeholder="Enter plaintext here..."
                className="w-full h-40 p-5 text-[#1f1e1c] bg-[#fbfab6]/20 border border-[#d6d3cc] hover:border-[#b3afa8] focus:bg-[#fbfab6]/40 rounded-2xl outline-none transition-all resize-none text-base leading-relaxed placeholder:text-[#8c8a85] focus:ring-2 focus:ring-[#fbfab6]"
                defaultValue="My name is John Doe and my phone number is 567898767892."
              />
              <button
                onClick={() => {
                  const textarea = document.getElementById('textInput') as HTMLTextAreaElement;
                  handleTextSanitization(textarea.value);
                }}
                disabled={loading || !vaultReady}
                className={`w-full mt-6 py-4 px-6 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
                  !vaultReady 
                    ? 'bg-[#d6d3cc] text-[#4a4843]'
                    : 'bg-[#ff5500] hover:bg-[#cc4400] text-white shadow-lg shadow-[#ff5500]/30 active:scale-[0.98]'
                }`}
              >
                {loading ? 'PROCESSING...' : 'MASK & STORE'}
              </button>
            </div>

            {/* Alerts */}
            {testState.lastSuccess && (
              <div className="text-xs sm:text-sm tracking-wide font-bold text-[#22c55e] bg-[#22c55e]/10 p-5 rounded-2xl border border-[#22c55e]/20">
                &gt; {testState.lastSuccess}
              </div>
            )}
            {testState.lastError && (
              <div className="text-xs sm:text-sm tracking-wide font-bold text-red-500 bg-red-50 p-5 rounded-2xl border border-red-100">
                &gt; {testState.lastError}
              </div>
            )}
          </div>

          {/* Right Column (Pipeline Output) */}
          <div className="lg:col-span-7 pl-0 lg:pl-10 lg:border-l border-[#f4f2ee] flex flex-col gap-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm tracking-widest font-bold text-[#4a4843]">PIPELINE OUTPUT</span>
              {textTestResult && (
                <span className="font-mono text-xs font-bold text-[#4a4843] bg-[#e8e5df] px-4 py-1.5 rounded-full">
                  {textTestResult.tokenCount} TOKENS
                </span>
              )}
            </div>

            {!textTestResult ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-[#e8e5df] rounded-[2rem] bg-[#fbfbf8]">
                <div className="w-16 h-16 rounded-full border-2 border-[#e8e5df] flex items-center justify-center mb-5 text-[#d6d3cc]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <p className="text-xs sm:text-sm tracking-widest font-bold text-[#63615b] uppercase">Waiting for input stream</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Original */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs uppercase tracking-widest text-[#63615b] font-bold">1_ RAW PAYLOAD</label>
                  <div className="p-5 bg-[#fbfbf8] border border-[#d6d3cc] rounded-2xl text-[#33322f] text-base leading-relaxed">
                    {textTestResult.original}
                  </div>
                </div>

                {/* Sanitized (Masked) */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs uppercase tracking-widest text-[#63615b] font-bold flex items-center gap-3">
                    2_ TRANSMITTED SECURELY <span className="bg-[#ff8a3d]/20 text-[#ff8a3d] px-2 py-1 rounded tracking-wider text-[10px]">TOKENIZED</span>
                  </label>
                  <div className="p-5 bg-[#fffaf5] border border-[#ff8a3d]/30 rounded-2xl text-[#1f1e1c] font-mono text-[15px] leading-relaxed shadow-inner">
                    {textTestResult.sanitized}
                  </div>
                </div>

                {/* Detokenized */}
                <div className="flex flex-col gap-3 mt-4 pt-8 border-t border-[#f4f2ee]">
                  <label className="text-xs uppercase tracking-widest text-[#22c55e] font-bold">3_ LOCAL REHYDRATION</label>
                  <div className="p-6 bg-white border-2 border-[#22c55e]/30 rounded-2xl text-[#1f1e1c] text-base md:text-lg leading-relaxed shadow-sm">
                    {textTestResult.detokenized}
                  </div>
                </div>

                {/* Private AI Interaction Region */}
                <div className="mt-8 pt-8 border-t border-[#f4f2ee]">
                  <div className="flex items-center justify-between mb-6">
                    <label className="text-xs uppercase tracking-[0.2em] text-[#ff5500] font-black">
                      4_ PRIVATE INTELLIGENCE (GEMINI)
                    </label>
                  </div>
                  
                  {!aiResponse ? (
                    <button
                      onClick={handleAskGemini}
                      disabled={aiLoading}
                      className="w-full py-5 px-8 rounded-2xl bg-[#1f1e1c] text-white text-sm font-bold tracking-widest uppercase hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl"
                    >
                      {aiLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          CONSULTING GEMINI...
                        </>
                      ) : (
                        <>
                          <span>❋</span> ASK GEMINI (MASKED)
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="p-8 bg-[#1f1e1c] text-white rounded-3xl text-base md:text-lg leading-relaxed shadow-2xl border border-white/5 relative overflow-hidden">
                        {/* Shimmer effect for AI response */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff5500] to-transparent animate-[shine_3s_ease-in-out_infinite]" />
                        <p className="whitespace-pre-wrap">{aiResponse}</p>
                      </div>
                      <button 
                         onClick={() => { setAiResponse(null); handleAskGemini(); }}
                         className="text-[10px] tracking-widest font-bold text-[#63615b] uppercase hover:text-[#1f1e1c] transition-colors self-end"
                      >
                        RE-GENERATE AI RESPONSE ↺
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Mini Debug Panel */}
            {vaultStats && (
              <div className="mt-auto pt-10 flex items-center gap-8">
                 <div className="flex flex-col">
                   <span className="text-xs tracking-widest text-[#63615b] font-bold mb-1">VAULT LOAD</span>
                   <span className="font-mono text-3xl text-[#1f1e1c] font-bold">{vaultStats.tokenCount}</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-xs tracking-widest text-[#63615b] font-bold mb-1">ENCRYPTION</span>
                   <span className="text-base text-[#1f1e1c] font-bold mt-1">AES-256-GCM</span>
                 </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
