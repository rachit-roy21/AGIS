import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * AGIS Serverless AI Proxy
 * 
 * Bypasses CORS issues by calling Gemini API from the server side.
 * Uses GEMINI_API_KEY from environment variables.
 */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { maskedText } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured on server.' });
  }

  if (!maskedText) {
    return res.status(400).json({ error: 'Missing maskedText in request body.' });
  }

  try {
    // Call Gemini 2.0 Flash API (v1beta)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `You are a helpful assistant. Use these tokens to refer to private entities: ${maskedText}` 
          }] 
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ 
        text: `(PROXY_ERROR) ${data.error?.message || 'Upstream Error'}`,
        rawError: data
      });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
    return res.status(200).json({ text: aiText });
  } catch (error) {
    console.error('[Serverless Proxy Failure]', error);
    return res.status(500).json({ error: 'Failed to communicate with AI API.' });
  }
}
