/**
 * AGIS AI Client (Powered by Mistral AI)
 * 
 * This service handles private AI interactions by sending strictly
 * masked data to Mistral models.
 */

const API_KEY = import.meta.env.VITE_AI_API_KEY || '';

export interface AIResponse {
  text: string;
  isError: boolean;
}

export async function askGemini(maskedText: string): Promise<AIResponse> {
  if (!API_KEY) {
    return {
      text: "AI API Key missing. Please set VITE_AI_API_KEY in your .env file.",
      isError: true
    };
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-tiny",
        messages: [
          {
            role: "system",
            content: "You are a secure AI. Use only the provided tokens (e.g., [TOKEN_NAME_X]) to refer to people/entities. Do not guess what lies behind them. Be professional and concise."
          },
          {
            role: "user",
            content: maskedText
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || response.statusText);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    return {
      text,
      isError: false
    };
  } catch (error) {
    console.error('[Mistral] API Error:', error);
    return {
      text: `AI Error: ${error instanceof Error ? error.message : 'Connection failed'}`,
      isError: true
    };
  }
}
