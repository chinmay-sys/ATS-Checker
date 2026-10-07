// ==========================================================================
// Vercel Serverless API Proxy for Gemini
// The API key is stored as a Vercel Environment Variable (GEMINI_API_KEY)
// and NEVER reaches the browser.
// ==========================================================================

const MODELS_TO_TRY = [
    'models/gemini-flash-lite-latest',
    'models/gemini-3.1-flash-lite',
    'models/gemini-3.5-flash-lite',
    'models/gemini-flash-latest',
    'models/gemini-3.8-flash'
];

export default async function handler(req, res) {
    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'GEMINI_API_KEY is not configured on the server. Add it in Vercel Environment Variables.'
        });
    }

    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "prompt" in request body.' });
    }

    let lastError = 'All models were busy or unavailable.';

    // Try fastest verified models first with a snappy 7-second timeout each
    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`[Gemini Proxy] Trying model: ${modelName}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                }
            );

            clearTimeout(timeoutId);
            const data = await response.json();

            // Success — got a valid response
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return res.status(200).json({
                    text: data.candidates[0].content.parts[0].text,
                    model: modelName
                });
            }

            // If this model returned an error (quota, overloaded, deprecated, etc.), fallback to next model
            if (data.error) {
                console.warn(`[Gemini Proxy] ${modelName} error:`, data.error.message);
                lastError = data.error.message;
                continue;
            }

        } catch (error) {
            console.warn(`[Gemini Proxy] Error with ${modelName}:`, error.message);
            lastError = error.message;
            continue;
        }
    }

    // All models exhausted
    return res.status(503).json({
        error: `Gemini API Error: ${lastError}`
    });
}
