// Inks, the sample scene, and the validator: the trust boundary between the model and the press.

export const INKS = {
  fluorescent_pink: { name: 'Fluorescent Pink', hex: '#FF48B0' },
  aqua: { name: 'Aqua', hex: '#5EC8E5' },
  teal: { name: 'Teal', hex: '#00838A' },
  blue: { name: 'Blue', hex: '#0078BF' },
  federal_blue: { name: 'Risofederal Blue', hex: '#3D5588' },
  medium_blue: { name: 'Medium Blue', hex: '#3255A4' },
  purple: { name: 'Purple', hex: '#765BA7' },
  yellow: { name: 'Yellow', hex: '#FFE800' },
  sunflower: { name: 'Sunflower', hex: '#FFB511' },
  orange: { name: 'Orange', hex: '#FF6C2F' },
  fluorescent_orange: { name: 'Fluorescent Orange', hex: '#FF7477' },
  bright_red: { name: 'Bright Red', hex: '#F15060' },
  green: { name: 'Green', hex: '#00A95C' },
  mint: { name: 'Mint', hex: '#82D8D5' },
  black: { name: 'Black', hex: '#000000' },
  flat_gold: { name: 'Flat Gold', hex: '#BB8B41' },
};

export const CREATURE_TYPES = ['goldfish', 'clownfish', 'neon_tetra', 'angelfish', 'betta', 'pufferfish', 'turtle', 'jellyfish', 'seahorse', 'shrimp', 'crab', 'snail'];
export const DECOR_TYPES = ['kelp', 'seagrass', 'coral', 'rock', 'castle', 'shell', 'starfish', 'bubbles'];
const TONES = ['light', 'mid', 'dense', 'solid'];

export const SAMPLE = {
  title: 'Sample Tank',
  inks: ['fluorescent_pink', 'aqua', 'federal_blue'],
  water: { ink: 1, tone: 'light', gradient: true },
  ground: { ink: 0, tone: 'mid' },
  creatures: [
    { type: 'goldfish', count: 2, ink: 0, accent: 1, size: 1.2, pace: 'calm' },
    { type: 'neon_tetra', count: 7, ink: 2, accent: 0, size: 1, pace: 'lively' },
    { type: 'jellyfish', count: 1, ink: 0, accent: 2, size: 1.2, pace: 'calm' },
    { type: 'snail', count: 1, ink: 2, accent: 0, size: 1, pace: 'calm' },
  ],
  decor: [
    { type: 'kelp', count: 3, ink: 2, tone: 'solid' },
    { type: 'rock', count: 3, ink: 2, tone: 'dense' },
    { type: 'bubbles', count: 2, ink: 2, tone: 'solid' },
  ],
  shift: 0.5,
};

export function sanitize(input) {
  const warnings = [];
  const s = input && typeof input === 'object' ? input : (warnings.push('no scene: printed the sample'), SAMPLE);
  const clamp = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);

  let inks = [...new Set(Array.isArray(s.inks) ? s.inks : [])].filter((k) => INKS[k] || (warnings.push(`unknown ink "${k}" dropped`), false));
  if (inks.length > 3) warnings.push(`${inks.length} inks asked for, press has 3 drums: kept ${inks.slice(0, 3).join(', ')}`);
  inks = inks.slice(0, 3);
  for (const fill of ['federal_blue', 'fluorescent_pink']) if (inks.length < 2 && !inks.includes(fill)) (warnings.push(`under 2 inks: added ${fill}`), inks.push(fill));

  const n = inks.length;
  const ink = (v, where) => {
    if (Number.isInteger(v) && v >= 0 && v < n) return v;
    if (v !== undefined) warnings.push(`${where}: ink ${JSON.stringify(v)} not a drum, used drum 1`);
    return 0;
  };
  const tone = (v, d, where) => (TONES.includes(v) ? v : (v !== undefined && warnings.push(`${where}: tone "${v}" unknown`), d));
  const count = (v, max, where) => {
    if (+v > max) warnings.push(`${where}: ${v} is too many, printed ${max}`);
    return Math.round(clamp(v, 1, max, 1));
  };

  let total = 0;
  const creatures = (Array.isArray(s.creatures) ? s.creatures : [])
    .filter((c) => CREATURE_TYPES.includes(c?.type) || (warnings.push(`unknown creature "${c?.type}" skipped`), false))
    .map((c) => {
      const out = { type: c.type, count: count(c.count, 12, c.type), ink: ink(c.ink, c.type), accent: ink(c.accent ?? 1, c.type), size: clamp(c.size, 0.6, 1.8, 1), pace: c.pace === 'lively' ? 'lively' : 'calm' };
      out.count = Math.max(0, Math.min(out.count, 40 - total));
      total += out.count;
      return out;
    })
    .filter((c) => c.count > 0 || (warnings.push(`${c.type}: tank full (40 max), skipped`), false));

  const decor = (Array.isArray(s.decor) ? s.decor : [])
    .filter((d) => DECOR_TYPES.includes(d?.type) || (warnings.push(`unknown decor "${d?.type}" skipped`), false))
    .map((d) => ({ type: d.type, count: count(d.count, 8, d.type), ink: ink(d.ink, d.type), tone: tone(d.tone, 'solid', d.type) }));

  const scene = {
    title: String(s.title || 'Untitled Tank').slice(0, 24),
    inks,
    water: { ink: ink(s.water?.ink, 'water'), tone: tone(s.water?.tone, 'light', 'water'), gradient: !!s.water?.gradient },
    ground: { ink: ink(s.ground?.ink, 'ground'), tone: tone(s.ground?.tone, 'mid', 'ground') },
    creatures,
    decor,
    shift: clamp(s.shift, 0, 1, 0.5),
  };
  return { scene, warnings };
}
