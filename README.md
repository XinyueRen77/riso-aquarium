# Riso Aquarium

**Live:** https://riso-aquarium.vercel.app · **Repo:** https://github.com/XinyueRen77/riso-aquarium

An AI agent plays me, a riso printer. It chats with the customer to find out what kind of aquarium they want, then "prints" it as an animated riso aquarium. You can pull proofs, revise them, and export the final print as a PNG.

- **Agent** (the probabilistic part): an LLM (through OpenRouter, Claude Haiku 5.5 by default) only handles the conversation and writes a scene recipe as JSON.
- **Press** (the deterministic part): checks the recipe (max 3 inks, catalog creatures only), then builds a 3D aquarium. For every pixel it works out how much of each ink is needed (affected by the lighting), turns each ink into halftone dots at its own angle, shifts the layers slightly off-register, and prints them on paper.
- Drag to turn the tank, scroll to zoom, click the water to feed the fish and they swim over to eat.
- Click an ink to change a color, or a shape to change the tank (7 shapes: rectangle, tall, wide, cube, cylinder, hexagon, bowl). Edits are not sent to the agent on their own; they go along with the next message. Chat messages can be deleted one by one or cleared.

## Files

| File | Contents |
|---|---|
| `api/_prompt.js` | System instructions and knowledge (**change the agent's behavior here**) |
| `api/chat.js` | Vercel function: calls the model through OpenRouter, sets the model and temperature |
| `public/riso.js` | Ink table + validator |
| `public/tank3d.js` | 3D press: three.js scene + creature animation + riso halftone shader |
| `public/app.js` | Chat, proof history, press log, export |
| [`docs/system-card-v1.md`](docs/system-card-v1.md) | System card v1 (first version, unchanged) |
| [`docs/system-card-v2.md`](docs/system-card-v2.md) | System card v2 (hand edits, tank shapes, and what changed from v1) |
| [`docs/evals.md`](docs/evals.md) | Evaluation set, results, what broke and how it was fixed |
| [`docs/system-diagram.md`](docs/system-diagram.md) | System diagram |

## Run locally

1. Create `.env.local` in this folder with one line: `OPENROUTER_API_KEY=your_key` (create a key at openrouter.ai → Keys). This file is never uploaded to GitHub.
2. Run the command below, then open http://localhost:3000

```bash
npm run dev
```

## Deploy (GitHub → Vercel)

1. Push this folder to a new GitHub repo.
2. In Vercel, import the repo, set Framework to **Other**, and keep the other defaults.
3. In Settings → Environment Variables, add `OPENROUTER_API_KEY`, then redeploy.
4. Optional: add `MODEL` (any OpenRouter model id, e.g. `openai/gpt-5.6-luna`, `google/gemini-3.8-flash`) to switch models for a model-comparison eval.

Never put the API key in slides, journals, or screenshots.
