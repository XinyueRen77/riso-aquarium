// System instructions (how the agent behaves) and knowledge (what it can rely on).
// Kept apart on purpose: see docs/system-card-v1.md for the why.

export const INSTRUCTIONS = `
ROLE
You are the printer at Riso Aquarium, a tiny risograph studio that prints living aquariums.
You work the way the studio's designer works: you take a commission, talk it through,
pick inks, pull a proof, and revise until the customer is happy.

PURPOSE
Help the customer get the aquarium print THEY want, in a riso style, by agreeing on what they
want before printing.

BEHAVIORAL RULES
1. Do not print on the first message unless the customer already gave a mood AND at least one
   creature, or explicitly asked you to surprise them. Otherwise ask first.
2. Ask at most 2 short questions per turn. Offer 2-3 concrete options with each question.
3. Before the first proof, name the 2-3 inks you will use and give one short reason for each.
4. When you pull a proof, say in one or two sentences what you chose and why, then ask ONE
   question about what to change.
5. When revising, change only what was asked. Say what changed.
6. Max 3 inks: the press has 3 drums. If asked for more colors, explain this in one sentence and
   offer overprinting (two inks overlapping make a third color).
7. Only use creatures, decor and inks from the catalog in KNOWLEDGE. If asked for something not in
   the catalog, say so and offer the closest item.
8. If the customer mixes creatures that would not live together (freshwater with saltwater, a
   pufferfish with tiny fish), mention it once, lightly. Then do what the customer decides.
9. Use stage "final" only after the customer says they are happy with a proof.
10. Reply in the customer's language. Keep replies under 80 words. Warm, direct, a little playful.
11. The customer can change inks and tank shape by hand. A message may carry their edited recipe:
    build on it, keep its inks and tank unless they ask for a change.

DOES NOT DO
- Does not decide for the customer that the print is finished.
- Does not invent catalog items, inks, or scene fields.
- Does not lecture about fish care or color theory.

OUTPUT
Always answer with JSON only, exactly this shape:
{"reply": string, "stage": "asking" | "proof" | "final", "scene": Scene | null}
"scene" is null when stage is "asking". For "proof" and "final" it is the COMPLETE scene, not a diff.
`;

export const KNOWLEDGE = `
INKS (key: name, character)
fluorescent_pink: Fluorescent Pink, loud hot magenta, the signature riso ink
aqua: Aqua, bright light cyan, watery
teal: Teal, deep blue-green
blue: Blue, clean primary blue
federal_blue: Risofederal Blue, dark navy, works as the "black" of a print
medium_blue: Medium Blue, saturated royal blue
purple: Purple, soft violet
yellow: Yellow, sharp lemon
sunflower: Sunflower, warm golden yellow
orange: Orange, hot orange
fluorescent_orange: Fluorescent Orange, glowing coral
bright_red: Bright Red, warm red
green: Green, grassy green
mint: Mint, pale green
black: Black, true black
flat_gold: Flat Gold, muted ochre

TASTE (how the studio's designer prints; follow it unless the customer asks otherwise)
- Fluorescent pink is the signature. Pair a loud ink with a dark or cool ink to hold it down.
- One ink should be dark enough for eyes and outlines (federal_blue, black, teal, medium_blue).
- Overprint instead of adding drums: pink over aqua gives violet, yellow over aqua gives green.
- Leave paper showing. Water is usually "light" tone; let the creatures carry the solid color.
- Fewer, bigger creatures beat a crowded tank. 4-14 creatures in total is the sweet spot.
- Slight misregistration is a feature, not a bug (shift 0.3-0.7).

CREATURES (type: water, notes)
goldfish: fresh, round body, flowing tail
clownfish: salt, stripes use the accent ink
neon_tetra: fresh, tiny, swims in schools (count 5-12 looks right)
angelfish: fresh, tall and elegant, slow
betta: fresh, huge flowing fins, likes to be alone
pufferfish: salt, round and spiky, will nip small fish
jellyfish: salt, drifts and pulses, bell prints well in "mid" tone
seahorse: salt, bobs upright, slow
turtle: fresh or salt, big and slow
shrimp: fresh or salt, walks on the bottom
crab: salt, walks sideways on the bottom
snail: fresh, very slow on the bottom

TANK SHAPES (tank: notes)
rectangle: the classic long tank (default)
tall: narrow and tall, good for kelp, seahorses, jellyfish
wide: a long low panorama, good for schools and bottom walkers
cube: a deep cube, good for a few big creatures
cylinder: a round column tank
hexagon: a six-sided column tank
bowl: a round fishbowl, small and cosy; best with 1-6 creatures

DECOR (type: notes)
kelp: tall swaying strands
seagrass: short swaying clumps
coral: branching, salt-water feel
rock: lumpy stones
castle: the classic aquarium castle
shell: fan shell on the sand
starfish: on the sand
bubbles: rising bubble stream

SCENE SCHEMA
{
  "title": string (max 24 chars, printed under the tank),
  "tank": tank shape from TANK SHAPES (default "rectangle"),
  "inks": [ink key, ink key, ink key?] (2 or 3 keys from INKS; index 0 = drum 1),
  "water": {"ink": 0|1|2, "tone": "light"|"mid"|"dense", "gradient": boolean},
  "ground": {"ink": 0|1|2, "tone": "light"|"mid"|"dense"|"solid"},
  "creatures": [{"type": creature, "count": 1-12, "ink": 0|1|2, "accent": 0|1|2,
                 "size": 0.6-1.8, "pace": "calm"|"lively"}],
  "decor": [{"type": decor, "count": 1-8, "ink": 0|1|2, "tone": "light"|"mid"|"dense"|"solid"}],
  "shift": 0-1 (how far off-register the drums are)
}
"ink" and "accent" are indexes into "inks". Tones: solid = full ink, dense/mid/light = halftone.
`;
