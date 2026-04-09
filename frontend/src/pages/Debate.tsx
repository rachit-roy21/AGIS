import { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { DebateResult } from '../components/DebateResult';

export function Debate() {
    const { session, isSessionValid } = useSession();
    const [debateTranscript, setDebateTranscript] = useState<any[]>([]);
    const [maskedContent, setMaskedContent] = useState<string | null>(null);
    const [debateLoading, setDebateLoading] = useState(false);
    const [debateError, setDebateError] = useState<string | null>(null);
    const [historicalDebates, setHistoricalDebates] = useState<any[]>([]);

    useEffect(() => {
        if (session.id) {
            fetchHistoricalDebates();
        }
    }, [session.id]);

    const fetchHistoricalDebates = async () => {
        try {
            const response = await fetch(`/api/debate/session/${session.id}`);
            if (response.ok) {
                const data = await response.json();
                setHistoricalDebates(data.debates);
            }
        } catch (err) {
            console.error('Failed to fetch historical debates:', err);
        }
    };

    const runDebate = async () => {
        if (!session.id) return;

        setDebateLoading(true);
        setDebateError(null);
        try {
            const response = await fetch(`/api/debate/run/${session.id}`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to run debate');
            }

            const data = await response.json();
            setDebateTranscript(data.transcript);
            setMaskedContent(data.masked_content || null);
            fetchHistoricalDebates(); // Refresh list
        } catch (err: any) {
            setDebateError(err.message);
        } finally {
            setDebateLoading(false);
        }
    };

    if (!session.isActive || !isSessionValid()) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
                <p className="text-gray-600 mb-8">Please start a session to access the AI Security Debate.</p>
                <button
                    onClick={() => window.location.href = '/test'}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                    Start Session
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">AI Security Debate</h1>
                <p className="mt-2 text-gray-600">
                    Adversarial testing of your data sanitization through AI debate.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-lg shadow-md border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Evaluate Session Robustness</h2>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1 text-sm text-gray-600">
                                <p className="mb-2">
                                    Current Session ID: <code className="bg-gray-100 px-1 rounded">{session.id}</code>
                                </p>
                                <p>
                                    Click "Start Debate" to trigger an adversarial conversation between AI agents.
                                    They will try to extract sensitive context from your tokenized data.
                                </p>
                            </div>

                            <button
                                onClick={runDebate}
                                disabled={debateLoading}
                                className="whitespace-nowrap px-8 py-4 bg-amber-600 text-white font-bold rounded-lg shadow-lg hover:bg-amber-700 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:scale-100 flex items-center justify-center min-w-[200px]"
                            >
                                {debateLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                        Agents Debating...
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xl mr-2">⚖️</span>
                                        Start Debate
                                    </>
                                )}
                            </button>
                        </div>

                        {debateError && (
                            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600 font-medium">Error: {debateError}</p>
                            </div>
                        )}
                    </div>

                    {debateTranscript.length > 0 && (
                        <div className="animate-fade-in">
                            <div className="animate-fade-in">
                                <DebateResult transcript={debateTranscript} maskedContent={maskedContent} />
                            </div>
                        </div>
                    )}

                    {debateTranscript.length === 0 && !debateLoading && (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                            <div className="text-6xl mb-4 opacity-10">🛡️ vs ⚖️</div>
                            <p className="text-lg">No active debate transcript.</p>
                            <p className="text-sm">Start a new debate or select one from the history.</p>
                        </div>
                    )}
                </div>

                {/* Sidebar: History */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <span className="mr-2">📜</span> Debate History
                    </h2>
                    <div className="bg-white rounded-lg shadow border border-gray-100 divide-y overflow-hidden max-h-[600px] overflow-y-auto">
                        {historicalDebates.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                No historical debates found for this session.
                            </div>
                        ) : (
                            historicalDebates.map((debate) => (
                                <button
                                    key={debate.id}
                                    onClick={() => {
                                        setDebateTranscript(debate.transcript);
                                        setMaskedContent(null); // Historical debates don't have masked content stored in this view yet
                                    }}
                                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                                            Debate #{debate.id.substring(0, 4)}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(debate.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-800">
                                        {new Date(debate.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {debate.transcript.length} exchanges
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
