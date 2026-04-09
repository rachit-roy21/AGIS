import { useState, useEffect } from 'react';
import { getVault } from '../utils/Vault';

interface TranscriptItem {
    agent: string;
    text: string;
}

interface DebateResultProps {
    transcript: TranscriptItem[];
    maskedContent?: string | null;
}

export function DebateResult({ transcript, maskedContent }: DebateResultProps) {
    const [showTranscript, setShowTranscript] = useState(true);
    const [unmaskedText, setUnmaskedText] = useState<string | null>(null);

    useEffect(() => {
        const revealContent = async () => {
            if (maskedContent) {
                const vault = getVault();
                if (vault.isReady()) {
                    try {
                        // Find all tokens in the masked content
                        // Token format: [TOKEN_xxxxxx]
                        const tokenRegex = /\[(TOKEN_[a-zA-Z0-9]+)\]/g;
                        const matches = [...maskedContent.matchAll(tokenRegex)];
                        const uniqueTokens = [...new Set(matches.map(m => m[1]))];

                        if (uniqueTokens.length === 0) {
                            setUnmaskedText(maskedContent);
                            return;
                        }

                        // Retrieve values from vault
                        const retrieved = await vault.retrieveBatch(uniqueTokens);

                        // Replace tokens with values
                        let revealed = maskedContent;
                        for (const token of uniqueTokens) {
                            const value = retrieved[token];
                            if (value) {
                                // Replace [TOKEN_...] with value
                                // use split-join for compatibility if replaceAll is missing
                                revealed = revealed.split(`[${token}]`).join(value);
                            }
                        }

                        setUnmaskedText(revealed);
                    } catch (e) {
                        console.error("Failed to unmask content:", e);
                        setUnmaskedText("Failed to unmask content. Error accessing vault.");
                    }
                } else {
                    setUnmaskedText("Vault is locked or not ready. Cannot unmask content.");
                }
            } else {
                setUnmaskedText(null);
            }
        };

        revealContent();
    }, [maskedContent]);

    if (!transcript || transcript.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-lg shadow mt-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">AI Security Debate</h2>
                <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                    {showTranscript ? 'Hide Debate' : 'Show Debate'}
                </button>
            </div>

            {showTranscript && (
                <div className="space-y-4">
                    {transcript.map((item, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg border-2 ${item.agent === 'DefenseLawyer'
                                ? 'border-green-200 bg-green-50'
                                : item.agent === 'ProsecutionLawyer'
                                    ? 'border-red-200 bg-red-50'
                                    : item.agent === 'Judge'
                                        ? 'border-amber-200 bg-amber-50'
                                        : 'border-gray-200 bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`font-bold ${item.agent === 'DefenseLawyer'
                                    ? 'text-green-800'
                                    : item.agent === 'ProsecutionLawyer'
                                        ? 'text-red-800'
                                        : item.agent === 'Judge'
                                            ? 'text-amber-800'
                                            : 'text-gray-800'
                                    }`}>
                                    {item.agent === 'DefenseLawyer' ? '🛡️ Defense' :
                                        item.agent === 'ProsecutionLawyer' ? '⚖️ Prosecution' :
                                            item.agent === 'Judge' ? '👨‍⚖️ Judge' :
                                                '🤖 SYSTEM'}
                                </span>
                            </div>
                            <p className="text-gray-800 italic whitespace-pre-wrap">{item.text}</p>
                        </div>
                    ))}
                </div>
            )}

            {unmaskedText && (
                <div className="mt-8 p-6 bg-slate-800 text-slate-100 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold mb-3 flex items-center">
                        <span className="mr-2">🔓</span> Unmasked Evidence
                    </h3>
                    <div className="prose prose-invert max-w-none">
                        <p className="whitespace-pre-wrap">{unmaskedText}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
