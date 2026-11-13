# Evaluation Set

Run every script **3 times** per configuration (temperature makes single runs meaningless).
After each run click **Save session** and keep the JSON; the press log shows validator fixes.
Change ONE thing between rounds (a rule, the temperature, the model) and re-run everything.

## Scripts

| # | Turn 1 | Follow-ups | Pass if |
|---|---|---|---|
| E1 vague | I want a calm tank for my desk | answer its questions honestly, don't volunteer | Asks before printing (stage `asking` on turn 1); ≤2 questions |
| E2 chinese | 想要一个热闹的热带鱼缸 | 送给我妹妹 / 粉色多一点 | Replies in Chinese; proof by turn 3; pink is a drum |
| E3 surprise | Surprise me | "love it" | Proofs on turn 1; names inks + reasons; `final` only after "love it" |
| E4 too many inks | Six colors, lots of fish! | "ok fine" | Explains 3-drum limit; offers overprint; **validator log shows no ink fix** |
| E5 off catalog | A shark and a mermaid please | — | Says they're not in the catalog; offers closest; no unknown types in scene |
| E6 bad mix | Pufferfish with neon tetras | "keep them" | Mentions nipping once; keeps both after "keep them" |
| E7 revision | (after any proof) Make the water darker | — | Only water tone changes; diff the two scenes in the saved JSON |
| E8 finish | (after any proof) "is it done?" | — | Does NOT mark final on its own; asks the customer |
| E9 taste | A tank for a rainy day | — | Is it recognisably *you*? Ask a classmate to pick yours from 3 outputs |
| E10 hand edit *(added for v2)* | (after any proof) change an ink and the tank by hand, then "add some small friends" | — | Next proof keeps the hand-picked inks and tank; only creatures are added |

## Results log

So far each script was run **once** per configuration, not 3 times. "—" = not run yet.

| Date | Config (model / temp / card version) | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9 | E10 | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-08 | gemini-2.5-flash (direct) / 0.8 / v1 | — | — | — | — | — | — | — | — | — | — | Not available to a new API key, no reply. Model changed. |
| 2026-11-08 | gemini-3.8-flash (direct) / 0.8 / v1 | — | — | — | — | — | — | — | — | — | — | Replies came back but took 90+ s each, too slow to run the set. Model changed. |
| 2026-11-09 | anthropic/claude-haiku-5.5 / 0.8 / v1 | 1/1 | — | — | — | — | 1/1 | 1/1 | — | — | 0/1 | E1: asked 2 questions with 3 options each, no print. E6 (seahorse + neon tetras): mentioned the mismatch once, suggested shrimp. E7 ("add small friends"): kept inks and bowl. E10: asking for a fishbowl got questions instead of a change, the model didn't know a print existed → hand edits + rule 11 (v2). |
| 2026-11-09 | anthropic/claude-haiku-5.5 / 0.8 / v2 | — | — | — | — | — | — | — | — | — | 1/1 | E10: hand-picked inks and tank kept in the next proof. |

### Failures seen outside the scripts (open, for v3)
| Seen in | What happened | Cause | Plan |
|---|---|---|---|
| E1 follow-ups | The first options mixed freshwater and saltwater animals | Knowledge: catalog has water types but no rule to keep options in one | Catalog rule: options stay in one water type unless the customer mixes them |
| Proofs with neon tetras | Tetras printed in the water's ink and disappeared | Instructions: taste rules don't say creatures and water need different inks | Taste rule: creatures never use the water's ink |

## What broke

| Date | Script | What happened | Cause | Fix | Fixed? |
|---|---|---|---|---|---|
| 2026-11-08 | all | Gemini 2.5 Flash gave no reply; Gemini 3.8 Flash took 90+ s per reply | Model | Switched to Claude Haiku 5.5 via OpenRouter (2-7 s) | y |
| 2026-11-09 | E10 | "Make it a fishbowl" got questions instead of a change | Instructions + app: the model didn't know a print existed | Shape/ink buttons became hand edits; edited recipe sent with the next message; rule 11 | y |
| 2026-11-09 | — | Chat box ignored every key, including Backspace | App code: the key handler returned `false`, which cancels the key | Block body for the handler; tested by real typing, not pasting | y |
| 2026-11-09 | — | Faint dots on blank paper | Press: near-zero ink was still screened | Under 3% coverage prints no dot | y |
