// Local server: serves public/ and runs api/chat.js the way Vercel does.
// Run: node --env-file=.env.local dev.mjs   (put OPENROUTER_API_KEY=... in .env.local)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import handler from './api/chat.js';

const root = join(import.meta.dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (o) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)));
  if (req.url.startsWith('/api/chat')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    try { req.body = JSON.parse(body || '{}'); } catch { req.body = {}; }
    return handler(req, res).catch((e) => res.status(500).json({ error: String(e) }));
  }
  const path = normalize(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
  if (!join(root, path).startsWith(root)) return res.status(404).end('Not found');
  try {
    const file = await readFile(join(root, path));
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(file);
  } catch {
    res.status(404).end('Not found');
  }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
