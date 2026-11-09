import { INSTRUCTIONS, KNOWLEDGE } from './_prompt.js';

// Model selection and temperature are design surfaces: change them here (or set MODEL) and re-run docs/evals.md.
// Any OpenRouter model id works, e.g. anthropic/claude-sonnet-5.5, openai/gpt-5.6-luna, google/gemini-3.8-flash.
const MODEL = process.env.MODEL || 'anthropic/claude-haiku-5.5';
const TEMPERATURE = 0.8; // OpenRouter drops this for models that no longer take it (newer Claude, reasoning models)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY environment variable' });

  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-30) : [];
  const turns = messages
    .filter((m) => typeof m?.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text.slice(0, 4000) }));
  if (!turns.length || turns.at(-1).role !== 'user') return res.status(400).json({ error: 'Last message must be from the user' });

  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'Riso Aquarium' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: INSTRUCTIONS + '\n\nKNOWLEDGE\n' + KNOWLEDGE }, ...turns],
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) return res.status(502).json({ error: data?.error?.message || `OpenRouter error ${r.status}` });

  const raw = data?.choices?.[0]?.message?.content || '';
  let out;
  try {
    out = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    out = { reply: raw || '(empty reply)', stage: 'asking', scene: null, parseError: true };
  }
  res.status(200).json({ ...out, raw, model: data.model || MODEL });
}
