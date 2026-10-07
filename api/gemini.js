// ==========================================================================
// Vercel Serverless API Proxy for Gemini
// The API key is stored as a Vercel Environment Variable (GEMINI_API_KEY)
// and NEVER reaches the browser.
// ==========================================================================

const MODELS_TO_TRY = [
    'models/gemini-3.8-flash',
    'models/gemini-2.5-flash-lite',
    'models/gemini-2.0-flash',
    'models/gemini-1.5-flash'
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

    // Try each model with fallback (same logic as before, but server-side)
    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`[Gemini Proxy] Trying model: ${modelName}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

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

            // Quota exhausted, model unavailable, or overloaded — try next model
            if (data.error && (
                data.error.message.includes('quota') ||
                data.error.message.includes('429') ||
                data.error.message.includes('no longer available') ||
                data.error.message.includes('not found') ||
                data.error.message.includes('is not supported') ||
                data.error.message.includes('high demand') ||
                data.error.message.includes('overloaded') ||
                data.error.message.includes('temporarily') ||
                data.error.status === 'RESOURCE_EXHAUSTED' ||
                data.error.status === 'NOT_FOUND' ||
                data.error.status === 'UNAVAILABLE'
            )) {
                console.warn(`[Gemini Proxy] ${modelName} unavailable/exhausted, trying next...`);
                continue;
            }

            // Other API error — return it
            if (data.error) {
                return res.status(502).json({ error: `Gemini API Error: ${data.error.message}` });
            }

        } catch (error) {
            console.warn(`[Gemini Proxy] Error with ${modelName}:`, error.message);
            continue;
        }
    }

    // All models exhausted
    return res.status(429).json({
        error: 'All Gemini models have hit their quota limit. Please try again later.'
    });
}
