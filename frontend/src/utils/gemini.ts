import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Client for Private AI Intelligence
 * 
 * This service handles interactions with Google Gemini while ensuring
 * that only MASKED data (tokens) is sent to the LLM.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface GeminiResponse {
  text: string;
  isError: boolean;
}

/**
 * Ask Gemini a question using masked data
 * 
 * @param maskedText - The text containing tokens (e.g., [TOKEN_NAME_X])
 * @returns The AI response containing tokens
 */
export async function askGemini(maskedText: string): Promise<GeminiResponse> {
  if (!API_KEY) {
    return {
      text: "Gemini API Key missing. Please set VITE_GEMINI_API_KEY in your .env file.",
      isError: true
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
      You are a security-conscious AI assistant helping a user process sensitive data.
      The user will provide text where sensitive information (names, emails, phones) 
      has been replaced by masks like [TOKEN_TYPE_HASH] (e.g., [TOKEN_NAME_ABC123]).
      
      RULES:
      1. DO NOT try to guess what is behind the tokens.
      2. If you need to refer to a person or entity, use the token exactly as provided.
      3. Provide a helpful, professional response based on the context of the masked text.
    `;

    const prompt = `${systemPrompt}\n\nUser Request:\n${maskedText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return {
      text,
      isError: false
    };
  } catch (error) {
    console.error('[Gemini] API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown Gemini error';
    
    // Check for rate limit
    if (errorMessage.includes('429')) {
      return {
        text: "Gemini Rate Limit Exceeded (429). Please try again in a few minutes.",
        isError: true
      };
    }

    return {
      text: `Gemini Error: ${errorMessage}`,
      isError: true
    };
  }
}
