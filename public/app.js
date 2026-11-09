import { sanitize, INKS, SAMPLE } from './riso.js';
import { createTank } from './tank3d.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#tank');
const tank = createTank(canvas);
const history = []; // what the model sees: {role: 'user'|'model', text}
const proofs = [];
let busy = false;

// Standard opening prompts, also used as the eval set (docs/evals.md).
const QUICK = ['I want a calm tank for my desk', '想要一个热闹的热带鱼缸', 'Surprise me', 'Six colors, lots of fish!'];

show(sanitize(SAMPLE).scene, 'SAMPLE');
bubble('model', "Hi, I'm the printer. Tell me about the aquarium you'd like and I'll pull a riso proof. Who's it for, and what should it feel like?");
for (const q of QUICK) {
  const b = document.createElement('button');
  b.textContent = q;
  b.onclick = () => send(q);
  $('#quick').append(b);
}

$('#form').onsubmit = (e) => (e.preventDefault(), send($('#input').value));
$('#input').onkeydown = (e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send($('#input').value));
$('#info').onclick = () => $('#sys').showModal();
$('#export').onclick = exportPrint;
$('#save').onclick = () => download(
  URL.createObjectURL(new Blob([JSON.stringify({ saved: new Date().toISOString(), history, proofs: proofs.map(({ thumb, ...p }) => p) }, null, 2)], { type: 'application/json' })),
  `riso-aquarium-session-${Date.now()}.json`,
);

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true;
  $('#send').disabled = true;
  $('#input').value = '';
  history.push({ role: 'user', text });
  bubble('user', text);
  const typing = bubble('model typing', 'mixing ink…');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) });
    const data = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
    if (!r.ok) throw new Error(data.error || `Server error ${r.status}`);
    history.push({ role: 'model', text: data.raw });
    typing.remove();
    bubble('model', data.reply || '…');
    stage(data.stage);
    note(`${data.model} · stage: ${data.stage}${data.parseError ? ' · reply was not valid JSON' : ''}`, data.parseError);
    if (data.scene && data.stage !== 'asking') {
      const { scene, warnings } = sanitize(data.scene);
      const label = data.stage === 'final' ? 'FINAL' : `PROOF ${proofs.length + 1}`;
      warnings.forEach((w) => note(`${label}: ${w}`, true));
      if (!warnings.length) note(`${label}: recipe passed the press check`);
      show(scene, label);
      addProof(scene, label, data.scene);
    } else if (data.stage !== 'asking') note('stage says proof but no scene was sent', true);
  } catch (err) {
    history.pop();
    typing.remove();
    bubble('error', `The press jammed: ${err.message}`);
  } finally {
    busy = false;
    $('#send').disabled = false;
    $('#input').focus();
  }
}

function show(scene, label) {
  tank.setScene(scene);
  $('#drums').innerHTML = scene.inks
    .map((k, i) => `<span class="drum"><i style="background:${INKS[k].hex}"></i>D${i + 1} · ${INKS[k].name}</span>`)
    .join('');
  $('#title').textContent = scene.title;
  $('#swatches').innerHTML = scene.inks.map((k) => `<i style="background:${INKS[k].hex}"></i>`).join('');
  $('#colophon').textContent = `Riso Aquarium · ${scene.inks.length} drums · ${label}`;
}

// The print as a file: the 3D frame plus title and colophon, on paper.
function exportPrint() {
  const pad = canvas.width * 0.04, foot = canvas.width * 0.08;
  const out = Object.assign(document.createElement('canvas'), { width: canvas.width + pad * 2, height: canvas.height + pad * 2 + foot });
  const c = out.getContext('2d');
  const ink = INKS[tank.scene.inks.reduce((a, k) => (lum(INKS[k].hex) < lum(INKS[a].hex) ? k : a))].hex;
  c.fillStyle = '#F3EEE3';
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(canvas, pad, pad);
  c.font = `${Math.round(foot * 0.45)}px "Archivo Black", sans-serif`;
  c.fillStyle = INKS[tank.scene.inks[0]].hex;
  c.fillText(tank.scene.title.toUpperCase(), pad + 3, out.height - pad - foot * 0.25 + 2);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = ink;
  c.fillText(tank.scene.title.toUpperCase(), pad, out.height - pad - foot * 0.25);
  download(out.toDataURL('image/png'), `riso-aquarium-${slug(tank.scene.title)}.png`);
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

function addProof(scene, label, raw) {
  // wait two frames so the thumbnail shows the new print
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const t = Object.assign(document.createElement('canvas'), { width: 240, height: 160 });
    t.getContext('2d').drawImage(canvas, 0, 0, 240, 160);
    const p = { label, scene, raw, thumb: t.toDataURL('image/jpeg', 0.7) };
    proofs.push(p);
    if (proofs.length === 1) $('#proofs').innerHTML = '';
    const fig = document.createElement('figure');
    fig.innerHTML = `<img alt="${label}" src="${p.thumb}"><figcaption>${label}</figcaption>`;
    fig.onclick = () => (show(scene, label), mark(fig));
    $('#proofs').append(fig);
    mark(fig);
  }));
}

function mark(fig) {
  document.querySelectorAll('.proofs figure').forEach((f) => f.classList.toggle('on', f === fig));
}

function bubble(cls, text) {
  const d = document.createElement('div');
  d.className = `msg ${cls}`;
  d.textContent = text;
  $('#log').append(d);
  d.scrollIntoView({ block: 'end' });
  return d;
}

function stage(s = 'asking') {
  const el = $('#stage');
  el.textContent = s;
  el.className = `pill ${s}`;
}

function note(text, warn = false) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${text}`;
  if (warn) li.className = 'warn';
  $('#presslog').prepend(li);
}

function download(href, name) {
  Object.assign(document.createElement('a'), { href, download: name }).click();
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'print';
}

window.tank = tank; // handy for testing scenes from the console
