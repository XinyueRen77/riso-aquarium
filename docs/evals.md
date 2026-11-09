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

## Results log (fill in)

| Date | Config (model / temp / card version) | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9 | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | anthropic/claude-haiku-5.5 / 0.8 / v1 | /3 | /3 | /3 | /3 | /3 | /3 | /3 | /3 | | |

## What broke (keep for the deck)
- Date · script · what happened · cause (instructions / knowledge / model / validator) · fix · fixed? y/n
