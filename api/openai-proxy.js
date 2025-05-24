const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    let { prompt, userInput } = {};
    try {
        if (typeof request.body === 'string') {
            ({ prompt, userInput } = JSON.parse(request.body));
        } else {
            ({ prompt, userInput } = request.body || {});
        }
    } catch (err) {
        return response.status(400).json({ error: 'Invalid JSON in request body' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        return response.status(500).json({ error: 'API Key not configured' });
    }

    const fullPrompt = prompt.replace('[USER_INPUT_HERE]', userInput);

    try {
        const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: fullPrompt }],
                temperature: 0.0,
                max_tokens: 1800
            }),
        });

        const data = await apiResponse.json();
        if (!apiResponse.ok) {
            return response.status(apiResponse.status).json({ error: 'Failed to fetch from OpenAI', details: data });
        }
        return response.status(200).json(data);

    } catch (error) {
        return response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
} 