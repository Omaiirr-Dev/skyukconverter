import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = req.body;
    const completion = await openai.chat.completions.create(body);
    res.status(200).json(completion);
  } catch (err) {
    res.status(500).json({ error: err.message || 'OpenAI proxy error' });
  }
} 