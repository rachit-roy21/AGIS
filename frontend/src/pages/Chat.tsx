import { useState, useRef, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useVault } from '../hooks/useVault';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  detokenized?: string;
  timestamp: Date;
  tokensStored?: string[];
}

export function Chat() {
  const { session, isSessionValid } = useSession();
  const { vault, ready: vaultReady } = useVault();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!session.isActive || !isSessionValid()) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
        <p className="text-gray-600 mb-8">Please start a session to access the chat interface.</p>
        <button
          onClick={() => window.location.href = '/test'}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Start Session
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading || !vaultReady || !vault) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Send message to backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': session.id!,
          'X-Processing-ID': `chat_${Date.now()}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_history: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Store any new tokens in vault
      const tokensStored: string[] = [];
      if (data.tokens && Object.keys(data.tokens).length > 0) {
        await vault.storeFromTokenMap(data.tokens);
        tokensStored.push(...Object.keys(data.tokens));
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.sanitized_response || data.response || 'No response received',
        detokenized: data.response, // Original response with real values
        timestamp: new Date(),
        tokensStored,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Secure Chat</h1>
            <p className="text-sm text-gray-600">
              Privacy-first conversation with automatic tokenization
            </p>
          </div>
          <button
            onClick={clearChat}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Start a Conversation</h3>
            <p className="text-gray-600">
              Ask questions about documents, get help with analysis, or discuss any topic. 
              All sensitive information is automatically protected.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-sm font-medium">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <span className="ml-2 text-xs opacity-70">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                
                {/* Tokenized Content */}
                <div className="text-sm whitespace-pre-wrap">
                  {message.content}
                </div>

                {/* Detokenized Toggle for Assistant Messages */}
                {message.role === 'assistant' && message.detokenized && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800">
                      🔓 Show with real values
                    </summary>
                    <div className="mt-2 p-3 bg-white bg-opacity-20 rounded border border-indigo-300 whitespace-pre-wrap">
                      {message.detokenized}
                    </div>
                  </details>
                )}

                {/* Tokens Stored Indicator */}
                {message.tokensStored && message.tokensStored.length > 0 && (
                  <div className="mt-2 text-xs">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800">
                      🔑 {message.tokensStored.length} tokens secured
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-auto max-w-2xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 max-w-2xl px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                <span className="text-sm">Assistant is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message... (sensitive info will be protected)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={loading || !vaultReady}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !vaultReady}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
        
        {/* Status Bar */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>Vault Status: {vaultReady ? '✅ Ready' : '⚠️ Not Ready'}</span>
          <span>Messages: {messages.length}</span>
        </div>
      </div>
    </div>
  );
}