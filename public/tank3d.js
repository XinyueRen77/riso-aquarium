// The press, in 3D. Pass 1 renders the tank into an "ink coverage" buffer: R/G/B = how much of drum 1/2/3
// each pixel gets (lighting lowers coverage on the shadow side). Pass 2 screens each drum with halftone
// dots at its own angle, nudges it off-register, and multiplies the inks onto paper.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { INKS } from './riso.js';

THREE.ColorManagement.enabled = false;

const TONE = { light: 0.28, mid: 0.48, dense: 0.7, solid: 1 };
// Tank shapes. Box: w x h x d. Round: radius r with `sides` (48 = cylinder, 6 = hexagon). Bowl: a sphere.
const SHAPES = {
  rectangle: { box: true, w: 8, h: 4.6, d: 3.6 },
  tall: { box: true, w: 4.6, h: 6.2, d: 3.4 },
  wide: { box: true, w: 11, h: 3.8, d: 3.2 },
  cube: { box: true, w: 5.4, h: 5.4, d: 5.4 },
  cylinder: { r: 3, h: 5.2, sides: 48 },
  hexagon: { r: 3.2, h: 5, sides: 6 },
  bowl: { r: 3.2, bowl: true },
};
let T; // the current tank, with derived floor / water / swim limits
function useShape(name) {
  T = { name, ...(SHAPES[name] || SHAPES.rectangle) };
  if (T.bowl) Object.assign(T, { cy: T.r + 0.15, floor: 0.85, water: T.r + 0.15 + T.r * 0.55 });
  else Object.assign(T, { floor: 0.5, water: T.h, ri: T.sides === 6 ? T.r * Math.cos(Math.PI / 6) : T.r });
  T.top = T.water - 0.45;
  T.width = T.box ? T.w : 2 * T.r;
  T.height = T.bowl ? 2 * T.r + 0.15 : T.h;
}
useShape('rectangle');
const sandAt = (x, z) => T.floor + 0.12 * Math.sin(x * 1.3 + z * 0.7) + 0.07 * Math.sin(x * 3.1 - z * 2.3);
const radiusAt = (y) => (T.bowl ? Math.sqrt(Math.max(0, T.r * T.r - (y - T.cy) ** 2)) : T.ri);
// Keep a point m units inside the glass.
function clampIn(p, m) {
  if (T.box) {
    p.x = Math.max(-(T.w / 2 - m), Math.min(T.w / 2 - m, p.x));
    p.z = Math.max(-(T.d / 2 - m), Math.min(T.d / 2 - m, p.z));
    return;
  }
  const lim = Math.max(0.2, radiusAt(p.y) - m), d = Math.hypot(p.x, p.z);
  if (d > lim) (p.x *= lim / d), (p.z *= lim / d);
}
const nearWall = (p) => (T.box ? Math.abs(p.x) > (T.w / 2 - 0.6) * 0.85 || Math.abs(p.z) > (T.d / 2 - 0.5) * 0.8 : Math.hypot(p.x, p.z) > (radiusAt(p.y) - 0.5) * 0.8);
function randomIn(rand, y, m = 0.6) {
  if (T.box) return [(rand() - 0.5) * (T.w - 2 * m), (rand() - 0.5) * (T.d - 2 * m)];
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * Math.max(0.1, radiusAt(y) - m);
  return [Math.cos(a) * r, Math.sin(a) * r];
}
const UP = new THREE.Vector3(0, 1, 0);
const PAPER = '#F3EEE3';

// ---------- materials ----------

const INK_VERT = `varying vec3 vN;
void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const INK_FRAG = `uniform vec3 ink; uniform float tone; uniform float shade; varying vec3 vN;
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float l = clamp(dot(n, normalize(vec3(-0.35, 0.75, 0.55))), 0.0, 1.0);
  gl_FragColor = vec4(ink * tone * mix(1.0 - shade, 1.0, l), 1.0);
}`;
const mats = new Map();
function inkMat(ink, tone = 'solid', shade = 0.5, additive = false) {
  const key = `${ink}|${tone}|${shade}|${additive}`;
  if (!mats.has(key)) {
    const v = new THREE.Vector3(); v.setComponent(ink, 1);
    mats.set(key, new THREE.ShaderMaterial({
      uniforms: { ink: { value: v }, tone: { value: TONE[tone] }, shade: { value: shade } },
      vertexShader: INK_VERT, fragmentShader: INK_FRAG,
      side: additive ? THREE.FrontSide : THREE.DoubleSide,
      ...(additive && { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    }));
  }
  return mats.get(key);
}

const POST_FRAG = `uniform sampler2D tInk; uniform vec2 res; uniform vec3 c0, c1, c2; uniform vec2 off1, off2; uniform float cell; uniform vec3 paper;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float dots(vec2 px, float ang, float cov) {
  if (cov > 0.93) return 1.0;
  if (cov < 0.03) return 0.0;
  vec2 p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * px / cell;
  float d = length(fract(p) - 0.5);
  float r = sqrt(cov / 3.14159) * 1.08;
  return 1.0 - smoothstep(r - 0.08, r + 0.08, d);
}
void main() {
  vec2 px = gl_FragCoord.xy;
  float a0 = texture2D(tInk, px / res).r;
  float a1 = texture2D(tInk, (px + off1) / res).g;
  float a2 = texture2D(tInk, (px + off2) / res).b;
  float m0 = dots(px, 0.2618, a0) * step(0.05, hash(floor(px)));
  float m1 = dots(px, 1.309, a1) * step(0.05, hash(floor(px) + 31.0));
  float m2 = dots(px, 0.7854, a2) * step(0.05, hash(floor(px) + 77.0));
  vec3 col = paper * mix(vec3(1.0), c0, m0 * 0.94) * mix(vec3(1.0), c1, m1 * 0.94) * mix(vec3(1.0), c2, m2 * 0.94);
  col *= 0.95 + 0.05 * hash(px * 0.37);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- the tank ----------

export function createTank(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });

  const scene3d = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1.5, 0.1, 100);
  camera.position.set(-1.8, 4.1, 12.2);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 2.1, 0);
  Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 8, maxDistance: 18, minPolarAngle: 0.9, maxPolarAngle: 1.62, minAzimuthAngle: -0.9, maxAzimuthAngle: 0.9 });
  controls.update();

  const post = new THREE.ShaderMaterial({
    uniforms: {
      tInk: { value: rt.texture }, res: { value: new THREE.Vector2() }, cell: { value: 5 * pr },
      c0: { value: new THREE.Color(1, 1, 1) }, c1: { value: new THREE.Color(1, 1, 1) }, c2: { value: new THREE.Color(1, 1, 1) },
      off1: { value: new THREE.Vector2() }, off2: { value: new THREE.Vector2() }, paper: { value: new THREE.Color(PAPER) },
    },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FRAG,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    const w = canvas.clientWidth || 960, h = Math.round(w / 1.5);
    renderer.setSize(w, h, false);
    rt.setSize(w * pr, h * pr);
    post.uniforms.res.value.set(w * pr, h * pr);
    post.uniforms.cell.value = Math.min(6, Math.max(3.5, w / 170)) * pr; // dot size follows print size
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let world = null, actors = [], updaters = [], owned = [], current = null, food = null;
  const own = (g) => (owned.push(g), g);

  function frame() {
    const dist = Math.max(T.width * 1.5, T.height * 2.2);
    controls.target.set(0, T.height * 0.47, 0);
    camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(-0.15, 0.17, 1).normalize(), dist);
    Object.assign(controls, { minDistance: dist * 0.6, maxDistance: dist * 1.5 });
    controls.update();
  }

  function setScene(scene) {
    if (!current || current.tank !== scene.tank) (useShape(scene.tank), frame());
    if (world) scene3d.remove(world);
    owned.forEach((g) => g.dispose());
    owned = [];
    actors = [];
    updaters = [];
    current = scene;
    world = new THREE.Group();
    scene3d.add(world);

    const rand = mulberry32(hash(JSON.stringify(scene)));
    const n = scene.inks.length;
    const D = scene.inks.map((k) => luminance(INKS[k].hex)).reduce((b, l, i, all) => (l < all[b] ? i : b), 0);
    const M = (geo, ink, tone, shade) => new THREE.Mesh(geo, inkMat(ink, tone, shade));
    const ctx = { M, own, rand, D, n };

    ['c0', 'c1', 'c2'].forEach((c, i) => post.uniforms[c].value.set(scene.inks[i] ? INKS[scene.inks[i]].hex : '#ffffff'));
    const off = () => (rand() - 0.5) * 10 * scene.shift * pr;
    post.uniforms.off1.value.set(off(), off());
    post.uniforms.off2.value.set(off(), off());

    buildTank({ M, own, D }, world, scene);
    for (let i = 0; i < 40; i++) {
      const p = M(SPHERE, (scene.ground.ink + 1) % n, 'dense', 0.5);
      const [x, z] = randomIn(rand, T.floor, 0.25), r = 0.04 + rand() * 0.06;
      p.scale.set(r * 1.4, r * 0.7, r);
      p.position.set(x, sandAt(x, z), z);
      world.add(p);
    }

    // decor along the back half of the floor
    const span = T.box ? T.w / 2 - 0.6 : radiusAt(T.floor) * 0.7;
    for (const spec of scene.decor) {
      for (let i = 0; i < spec.count; i++) {
        const x = -span + ((i + rand()) / spec.count) * span * 2;
        const back = T.box ? T.d / 2 - 0.4 : Math.sqrt(Math.max(0, span * span - x * x));
        const z = -back + rand() * back * (T.box ? 1.1 : 0.9);
        const d = DECOR[spec.type](ctx, spec, x, z);
        world.add(d.g);
        if (d.update) updaters.push(d.update);
      }
    }

    for (const spec of scene.creatures) {
      let leader = null;
      for (let i = 0; i < spec.count; i++) {
        const body = BUILD[spec.type](ctx, spec.ink, spec.accent);
        const kind = KIND[spec.type];
        const g = body.g;
        g.scale.setScalar(spec.size * (0.85 + rand() * 0.3));
        const a = {
          ...body, spec, kind, phase: rand() * Math.PI * 2,
          pos: new THREE.Vector3(0, T.floor + 0.6 + rand() * (T.top - T.floor - 0.6), 0),
          heading: rand() * Math.PI * 2, dir: rand() < 0.5 ? -1 : 1,
          speed: SPEED[spec.type] * (spec.pace === 'lively' ? 1.5 : 0.75) * (0.8 + rand() * 0.4),
        };
        [a.pos.x, a.pos.z] = randomIn(rand, a.pos.y, 0.8);
        a.baseY = a.pos.y;
        if (spec.type === 'neon_tetra') {
          if (leader) Object.assign(a, { leader, off: new THREE.Vector3((rand() - 0.5) * 1.4, (rand() - 0.5) * 0.6, (rand() - 0.5) * 1.0) });
          else leader = a;
        }
        world.add(g);
        actors.push(a);
      }
    }
  }

  // ---------- behaviour ----------

  function update(t, dt) {
    if (food && t - food.t0 > 7) (world.remove(food.g), (food = null));
    if (food) food.g.children.forEach((b) => (b.position.y = Math.max(sandAt(b.position.x, b.position.z) + 0.05, b.position.y - dt * 0.18)));
    const foodAt = food && food.g.children[0].position;

    for (const a of actors) {
      const p = a.pos;
      if (a.kind === 'swim') {
        let desired = null, speed = a.speed;
        if (foodAt) {
          desired = Math.atan2(foodAt.z - p.z, foodAt.x - p.x);
          speed *= 2.2;
          a.baseY += (foodAt.y - a.baseY) * Math.min(1, dt * 1.2);
          if (Math.hypot(foodAt.x - p.x, foodAt.z - p.z) < 0.25) speed = 0.05;
        } else if (a.leader) {
          const tx = a.leader.pos.x + a.off.x, tz = a.leader.pos.z + a.off.z;
          desired = Math.atan2(tz - p.z, tx - p.x);
          speed = Math.min(a.speed * 1.6, Math.hypot(tx - p.x, tz - p.z) * 1.5);
          a.baseY += (a.leader.baseY + a.off.y - a.baseY) * Math.min(1, dt * 1.5);
        } else {
          a.heading += (Math.random() - 0.5) * dt * 1.5;
          if (nearWall(p)) desired = Math.atan2(-p.z, -p.x);
          if (Math.random() < dt * 0.2) a.baseY = T.floor + 0.6 + Math.random() * (T.top - T.floor - 0.6);
        }
        if (desired !== null) a.heading += angleDiff(a.heading, desired) * Math.min(1, dt * 2.5);
        p.x += Math.cos(a.heading) * speed * dt;
        p.z += Math.sin(a.heading) * speed * dt;
        a.baseY = Math.min(T.top, Math.max(T.floor + 0.5, a.baseY));
        p.y += (a.baseY + Math.sin(t * 1.3 + a.phase) * 0.06 - p.y) * Math.min(1, dt * 2);
        a.g.rotation.y = -a.heading;
        a.g.rotation.z = Math.max(-0.4, Math.min(0.4, (a.baseY - p.y) * 1.5));
      } else if (a.kind === 'drift') {
        p.x += Math.sin(t * 0.25 + a.phase) * a.speed * dt;
        p.y = a.baseY + Math.sin(t * (a.spec.type === 'jellyfish' ? 0.5 : 1.2) + a.phase) * (a.spec.type === 'jellyfish' ? 0.35 : 0.08);
        if (a.spec.type === 'seahorse') a.g.rotation.y = -0.6 + Math.sin(t * 0.2 + a.phase) * 0.9;
      } else {
        a.moving = a.spec.type === 'snail' || Math.sin(t * 0.7 + a.phase) > -0.2;
        if (a.moving) p.x += a.dir * a.speed * dt;
        const xlim = T.box ? T.w / 2 - 0.6 : Math.sqrt(Math.max(0, (radiusAt(T.floor) - 0.5) ** 2 - p.z * p.z));
        if (p.x > xlim) a.dir = -1;
        if (p.x < -xlim) a.dir = 1;
        const hop = a.spec.type === 'shrimp' ? Math.pow(Math.max(0, Math.sin(t * 1.3 + a.phase)), 8) * 0.35 : 0;
        p.y = sandAt(p.x, p.z) + hop;
        if (a.spec.type !== 'crab') a.g.rotation.y = a.dir > 0 ? 0 : Math.PI;
      }
      clampIn(p, a.kind === 'bottom' ? 0.5 : 0.7);
      a.g.position.copy(p);
      a.animate?.(t, a);
    }
    for (const u of updaters) u(t);
  }

  // click (not drag) drops food
  let down = null;
  canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || !world) return;
    const r = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), new THREE.Vector3());
    if (!hit || hit.y < T.floor + 0.3 || hit.y > T.water || Math.abs(hit.x) > (T.box ? T.w / 2 : radiusAt(hit.y)) - 0.3) return;
    if (food) world.remove(food.g);
    const D = current.inks.map((k) => luminance(INKS[k].hex)).reduce((b, l, i, all) => (l < all[b] ? i : b), 0);
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(SPHERE, inkMat(D, 'solid', 0.3));
      b.scale.setScalar(0.04);
      b.position.set(hit.x + (Math.random() - 0.5) * 0.4, hit.y + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4);
      g.add(b);
    }
    world.add(g);
    food = { g, t0: performance.now() / 1000 };
  });

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!world) return;
    update(now / 1000, dt);
    controls.update();
    renderer.setRenderTarget(rt);
    renderer.render(scene3d, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  });

  return { setScene, get scene() { return current; } };
}

// ---------- tank shells: frame, sand and water for each shape ----------

function buildTank({ M, own, D }, world, scene) {
  const add = (m, y = 0) => ((m.position.y = y), world.add(m), m);
  const water = (geo, y, tone, order) => {
    const m = new THREE.Mesh(geo, inkMat(scene.water.ink, tone, 0, true));
    m.renderOrder = order;
    return add(m, y);
  };
  const sandTop = (geo) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, sandAt(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    return add(M(geo, scene.ground.ink, scene.ground.tone, 0.35));
  };
  const disc = (r, sides) => own(new THREE.CircleGeometry(r, sides, Math.PI / 2)).rotateX(-Math.PI / 2);
  const ring = (r, sides) => own(new THREE.RingGeometry(0.01, r, sides, 12, Math.PI / 2)).rotateX(-Math.PI / 2); // inner rings so the sand can ripple

  if (T.box) {
    const box = (w, h, d) => own(new THREE.BoxGeometry(w, h, d));
    add(M(box(T.w + 0.4, 0.35, T.d + 0.4), D, 'solid', 0.4), -0.18);
    add(M(box(T.w + 0.3, 0.12, T.d + 0.3), D, 'solid', 0.3), T.h);
    for (const x of [-1, 1]) for (const z of [-1, 1]) add(M(box(0.07, T.h, 0.07), D, 'solid', 0)).position.set((x * T.w) / 2, T.h / 2, (z * T.d) / 2);
    const sand = own(new THREE.BoxGeometry(T.w, T.floor, T.d, 48, 1, 24)).translate(0, T.floor / 2, 0);
    const p = sand.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > T.floor - 0.1) p.setY(i, sandAt(p.getX(i), p.getZ(i)));
    sand.computeVertexNormals();
    add(M(sand, scene.ground.ink, scene.ground.tone, 0.35));
    water(box(T.w, T.h - 0.3, T.d), (T.h - 0.3) / 2 + 0.3, scene.water.tone, 10);
    if (scene.water.gradient) water(box(T.w - 0.01, T.h * 0.4, T.d - 0.01), T.h * 0.2 + 0.01, 'light', 11);
  } else if (!T.bowl) {
    const cyl = (r1, r2, h, open = false) => own(new THREE.CylinderGeometry(r1, r2, h, T.sides, 1, open));
    add(M(cyl(T.r + 0.25, T.r + 0.32, 0.35), D, 'solid', 0.4), -0.18);
    if (T.sides === 6) {
      // CylinderGeometry puts corner k at angle k*60deg from +z
      const c = Array.from({ length: 6 }, (_, k) => [T.r * Math.sin((k * Math.PI) / 3), T.r * Math.cos((k * Math.PI) / 3)]);
      c.forEach(([x, z], k) => {
        add(M(own(new THREE.BoxGeometry(0.07, T.h, 0.07)), D, 'solid', 0)).position.set(x, T.h / 2, z);
        const [x2, z2] = c[(k + 1) % 6];
        const bar = add(M(own(new THREE.BoxGeometry(0.1, 0.12, T.r + 0.1)), D, 'solid', 0.3), T.h);
        bar.position.x = (x + x2) / 2;
        bar.position.z = (z + z2) / 2;
        bar.rotation.y = Math.atan2(x2 - x, z2 - z);
      });
    } else add(M(own(new THREE.TorusGeometry(T.r, 0.07, 6, 64)).rotateX(Math.PI / 2), D, 'solid', 0.3), T.h);
    add(M(cyl(T.r, T.r, T.floor, true), scene.ground.ink, scene.ground.tone, 0.35), T.floor / 2);
    sandTop(ring(T.r, T.sides));
    water(cyl(T.r, T.r, T.h - 0.3), (T.h - 0.3) / 2 + 0.3, scene.water.tone, 10);
    if (scene.water.gradient) water(cyl(T.r - 0.01, T.r - 0.01, T.h * 0.4), T.h * 0.2 + 0.01, 'light', 11);
  } else {
    const theta = (y) => Math.acos(Math.max(-1, Math.min(1, (y - T.cy) / T.r)));
    const shell = (r, from) => own(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, from, Math.PI - from));
    add(M(own(new THREE.CylinderGeometry(1.3, 1.6, 0.3, 48)), D, 'solid', 0.4), 0);
    const lipY = T.water + 0.3;
    add(M(own(new THREE.TorusGeometry(radiusAt(lipY), 0.07, 6, 64)).rotateX(Math.PI / 2), D, 'solid', 0.3), lipY);
    add(M(shell(T.r - 0.02, theta(T.floor)), scene.ground.ink, scene.ground.tone, 0.35), T.cy);
    sandTop(ring(radiusAt(T.floor) - 0.02, 48));
    water(shell(T.r, theta(T.water)), T.cy, scene.water.tone, 10);
    water(disc(radiusAt(T.water), 48), T.water, scene.water.tone, 10);
    if (scene.water.gradient) water(shell(T.r - 0.01, theta(T.floor + (T.water - T.floor) * 0.45)), T.cy, 'light', 11);
  }
}

// ---------- shared geometry ----------

const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 6);

function shapeGeo(own, pts, curved = true) {
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i += curved ? 2 : 1) curved && pts[i + 1] ? s.quadraticCurveTo(...pts[i], ...pts[i + 1]) : s.lineTo(...pts[i]);
  return own(new THREE.ShapeGeometry(s, 10));
}
const fan = (own, len, h) => shapeGeo(own, [[0, 0], [-len * 0.6, h * 0.5], [-len, h], [-len * 0.75, 0], [-len, -h], [-len * 0.6, -h * 0.5], [0, 0]]);

function part(M, geo, ink, tone, [x, y, z], [sx, sy, sz] = [1, 1, 1], shade) {
  const m = M(geo, ink, tone, shade);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
const rot = (m, x, y, z) => (m.rotation.set(x, y, z), m);
function eyes(M, D, x, y, z, r) {
  return [-1, 1].map((s) => part(M, SPHERE, D, 'solid', [x, y, s * z], [r, r, r], 0.2));
}

// A bendable chain of cylinders (tentacles, kelp, antennae). set(points) re-poses it.
function chain(M, n, radius, ink, tone, taper = 1) {
  const g = new THREE.Group(), segs = [];
  for (let i = 0; i < n; i++) (segs.push(M(CYL, ink, tone)), g.add(segs[i]));
  const dir = new THREE.Vector3();
  return {
    g,
    set(points) {
      segs.forEach((m, i) => {
        const a = points[i], b = points[i + 1];
        dir.subVectors(b, a);
        const len = dir.length();
        const r = radius * (1 - (1 - taper) * (i / n));
        m.position.addVectors(a, b).multiplyScalar(0.5);
        m.scale.set(r, len * 1.15, r);
        m.quaternion.setFromUnitVectors(UP, dir.normalize());
      });
    },
  };
}

// ---------- creatures (face +x, centred on the origin) ----------

const KIND = { goldfish: 'swim', clownfish: 'swim', neon_tetra: 'swim', angelfish: 'swim', betta: 'swim', pufferfish: 'swim', turtle: 'swim', jellyfish: 'drift', seahorse: 'drift', shrimp: 'bottom', crab: 'bottom', snail: 'bottom' };
const SPEED = { goldfish: 0.45, clownfish: 0.55, neon_tetra: 0.8, angelfish: 0.3, betta: 0.25, pufferfish: 0.2, turtle: 0.25, jellyfish: 0.1, seahorse: 0.05, shrimp: 0.2, crab: 0.35, snail: 0.05 };

function fishWith(M, tailGeo, tailInk, tailTone, tailX, parts, wiggle = 9, amp = 0.45) {
  const g = new THREE.Group(), tail = new THREE.Group();
  tail.position.x = tailX;
  tail.add(M(tailGeo, tailInk, tailTone));
  g.add(tail, ...parts);
  return { g, animate: (t, a) => (tail.rotation.y = Math.sin(t * wiggle + a.phase) * amp) };
}

const BUILD = {
  goldfish: ({ M, own, D }, ink, acc) => fishWith(M, fan(own, 0.55, 0.36), ink, 'dense', -0.34, [
    part(M, SPHERE, ink, 'solid', [0, 0, 0], [0.42, 0.32, 0.24]),
    part(M, shapeGeo(own, [[-0.18, 0.24], [-0.02, 0.56], [0.18, 0.28]], false), acc, 'mid', [0, 0, 0]),
    ...[-1, 1].map((s) => part(M, SPHERE, acc, 'mid', [0.05, -0.14, s * 0.22], [0.15, 0.05, 0.03])),
    ...eyes(M, D, 0.27, 0.07, 0.19, 0.05),
  ], 7),
  clownfish: ({ M, own, D }, ink, acc) => fishWith(M, fan(own, 0.24, 0.17), ink, 'solid', -0.36, [
    part(M, SPHERE, ink, 'solid', [0, 0, 0], [0.4, 0.22, 0.15]),
    part(M, SPHERE, acc, 'solid', [0.13, 0, 0], [0.06, 0.225, 0.157]),
    part(M, SPHERE, acc, 'solid', [-0.14, 0, 0], [0.06, 0.2, 0.14]),
    part(M, shapeGeo(own, [[-0.2, 0.18], [0, 0.36], [0.15, 0.2]], false), acc, 'dense', [0, 0, 0]),
    ...eyes(M, D, 0.28, 0.05, 0.12, 0.04),
  ]),
  neon_tetra: ({ M, own, D }, ink, acc) => fishWith(M, fan(own, 0.15, 0.08), ink, 'solid', -0.22, [
    part(M, SPHERE, ink, 'solid', [0, 0, 0], [0.24, 0.08, 0.06]),
    part(M, SPHERE, acc, 'solid', [0.01, 0.015, 0], [0.2, 0.026, 0.064]),
    ...eyes(M, D, 0.17, 0.02, 0.05, 0.025),
  ], 14, 0.3),
  angelfish: ({ M, own, D }, ink, acc) => {
    const s = new THREE.Shape();
    s.moveTo(0.35, 0); s.quadraticCurveTo(0.05, 0.38, -0.25, 0.04); s.lineTo(-0.25, -0.04); s.quadraticCurveTo(0.05, -0.38, 0.35, 0);
    const body = own(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 }));
    body.translate(0, 0, -0.05);
    const longFin = (sy) => shapeGeo(own, [[0.05, 0.22 * sy], [-0.15, 0.6 * sy], [-0.45, 0.95 * sy], [-0.2, 0.45 * sy], [-0.2, 0.1 * sy]]);
    return fishWith(M, fan(own, 0.2, 0.16), ink, 'solid', -0.24, [
      part(M, body, ink, 'solid', [0, 0, 0]),
      part(M, longFin(1), acc, 'mid', [0, 0, 0]),
      part(M, longFin(-1), acc, 'mid', [0, 0, 0]),
      part(M, CYL, acc, 'solid', [0.13, 0, 0], [0.03, 0.42, 0.11]),
      part(M, CYL, acc, 'solid', [-0.06, 0, 0], [0.03, 0.42, 0.11]),
      ...eyes(M, D, 0.22, 0.05, 0.08, 0.035),
    ], 4, 0.3);
  },
  betta: ({ M, own, D }, ink, acc) => fishWith(M, fan(own, 0.75, 0.6), acc, 'mid', -0.26, [
    part(M, SPHERE, ink, 'solid', [0, 0, 0], [0.3, 0.14, 0.1]),
    part(M, shapeGeo(own, [[0.08, 0.1], [-0.15, 0.55], [-0.35, 0.15]]), acc, 'dense', [0, 0, 0]),
    part(M, shapeGeo(own, [[0.08, -0.1], [-0.12, -0.6], [-0.35, -0.15]]), acc, 'dense', [0, 0, 0]),
    ...eyes(M, D, 0.2, 0.03, 0.08, 0.03),
  ], 3, 0.35),
  pufferfish: ({ M, own, D }, ink, acc) => {
    const spikes = [];
    for (let i = 0; i < 28; i++) {
      const y = 1 - (i / 27) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      const nrm = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      const m = part(M, CONE, acc, 'solid', nrm.clone().multiplyScalar(0.36).toArray(), [0.03, 0.12, 0.03]);
      m.quaternion.setFromUnitVectors(UP, nrm);
      spikes.push(m);
    }
    const f = fishWith(M, fan(own, 0.16, 0.13), ink, 'solid', -0.3, [
      part(M, SPHERE, ink, 'dense', [0, 0, 0], [0.32, 0.3, 0.3]), ...spikes, ...eyes(M, D, 0.22, 0.1, 0.18, 0.055),
    ], 6, 0.4);
    const anim = f.animate;
    f.animate = (t, a) => (anim(t, a), f.g.children[1].scale.setScalar(0.32 * (1 + 0.06 * Math.sin(t * 1.5 + a.phase))));
    return f;
  },
  turtle: ({ M, D }, ink, acc) => {
    const g = new THREE.Group(), flips = [];
    g.add(part(M, SPHERE, ink, 'dense', [0, 0, 0], [0.6, 0.26, 0.48]));
    for (const [x, z] of [[-0.2, 0], [0.15, 0.15], [0.15, -0.15], [-0.15, 0.22], [-0.15, -0.22]]) g.add(part(M, SPHERE, ink, 'solid', [x, 0.2, z], [0.16, 0.07, 0.13]));
    g.add(part(M, SPHERE, acc, 'dense', [0.7, 0.02, 0], [0.18, 0.14, 0.14]), ...eyes(M, D, 0.82, 0.07, 0.09, 0.03));
    for (const [x, z, s] of [[0.3, 0.42, 1], [0.3, -0.42, 1], [-0.42, 0.34, 0.6], [-0.42, -0.34, 0.6]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z);
      pivot.add(part(M, SPHERE, acc, 'dense', [0, 0, Math.sign(z) * 0.14 * s], [0.14 * s + 0.05, 0.04, 0.26 * s]));
      flips.push([pivot, Math.sign(z)]);
      g.add(pivot);
    }
    return { g, animate: (t, a) => flips.forEach(([p, s]) => (p.rotation.x = s * Math.sin(t * 2 + a.phase) * 0.5)) };
  },
  jellyfish: ({ M, own }, ink, acc) => {
    const g = new THREE.Group();
    const bell = part(M, own(new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), ink, 'mid', [0, 0, 0]);
    const inner = part(M, SPHERE, acc, 'dense', [0, 0.08, 0], [0.2, 0.15, 0.2]);
    const tentacles = [];
    for (let k = 0; k < 8; k++) tentacles.push([chain(M, 7, 0.012, acc, 'solid'), Math.cos((k / 8) * Math.PI * 2) * 0.32, Math.sin((k / 8) * Math.PI * 2) * 0.32, 0.12]);
    for (let k = 0; k < 3; k++) tentacles.push([chain(M, 5, 0.045, ink, 'dense', 0.4), Math.cos(k * 2.1) * 0.08, Math.sin(k * 2.1) * 0.08, 0.16]);
    g.add(bell, inner, ...tentacles.map((c) => c[0].g));
    const pts = Array.from({ length: 8 }, () => new THREE.Vector3());
    return {
      g,
      animate(t, a) {
        const p = Math.sin(t * 2.2 + a.phase);
        bell.scale.set(1 + 0.08 * p, 1 - 0.12 * p, 1 + 0.08 * p);
        tentacles.forEach(([c, x, z, step], k) => {
          for (let s = 0; s < pts.length; s++) pts[s].set(x * (1 + 0.08 * p) + Math.sin(t * 3 + s * 0.8 + k) * 0.05 * s / 3, -s * step * (1 + 0.1 * p), z + Math.cos(t * 2.5 + s * 0.7 + k) * 0.04 * s / 3);
          c.set(pts);
        });
      },
    };
  },
  seahorse: ({ M, own, D }, ink, acc) => {
    const curve = new THREE.CatmullRomCurve3([[0.05, 0.42, 0], [0.15, 0.22, 0], [0.11, 0, 0], [0, -0.18, 0], [-0.08, -0.3, 0], [0, -0.42, 0], [0.08, -0.36, 0]].map((p) => new THREE.Vector3(...p)));
    const fin = part(M, SPHERE, acc, 'mid', [-0.07, 0.08, 0], [0.06, 0.13, 0.015]);
    const g = new THREE.Group();
    g.add(
      M(own(new THREE.TubeGeometry(curve, 48, 0.075, 8)), ink, 'solid'),
      part(M, SPHERE, ink, 'solid', [0.06, 0.48, 0], [0.11, 0.09, 0.08]),
      rot(part(M, CYL, ink, 'solid', [0.22, 0.47, 0], [0.03, 0.2, 0.03]), 0, 0, Math.PI / 2),
      fin, ...eyes(M, D, 0.09, 0.51, 0.07, 0.025),
    );
    return { g, animate: (t, a) => (fin.scale.x = 0.06 * (1 + 0.5 * Math.sin(t * 12 + a.phase))) };
  },
  shrimp: ({ M, own, D }, ink, acc) => {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI * (1.1 + (0.8 * i) / 5), r = 0.05 + i * 0.008;
      g.add(part(M, SPHERE, ink, 'solid', [Math.cos(ang) * 0.22, 0.2 + Math.sin(ang) * 0.22 + 0.1, 0], [r * 1.2, r, r]));
    }
    g.add(part(M, fan(own, 0.12, 0.08), ink, 'dense', [-0.2, 0.25, 0]), ...eyes(M, D, 0.2, 0.2, 0.04, 0.02));
    const ants = [chain(M, 5, 0.008, acc, 'solid'), chain(M, 5, 0.008, acc, 'solid')];
    ants.forEach((c) => g.add(c.g));
    const pts = Array.from({ length: 6 }, () => new THREE.Vector3());
    return {
      g,
      animate(t, a) {
        ants.forEach((c, k) => {
          for (let s = 0; s < 6; s++) pts[s].set(0.22 + s * 0.09, 0.22 + s * 0.04 + Math.sin(t * 5 + s + k) * 0.02 * s, (k ? 1 : -1) * s * 0.03);
          c.set(pts);
        });
      },
    };
  },
  crab: ({ M, D }, ink, acc) => {
    const g = new THREE.Group(), legs = [];
    g.add(part(M, SPHERE, ink, 'solid', [0, 0.14, 0], [0.32, 0.14, 0.24]));
    for (const s of [-1, 1]) {
      g.add(part(M, SPHERE, acc, 'solid', [s * 0.36, 0.2, 0.22], [0.11, 0.08, 0.09]));
      g.add(rot(part(M, CYL, acc, 'solid', [s * 0.27, 0.16, 0.13], [0.03, 0.2, 0.03]), 0.8, 0, s * 0.9));
      g.add(part(M, CYL, D, 'solid', [s * 0.08, 0.3, 0.16], [0.012, 0.14, 0.012]), part(M, SPHERE, D, 'solid', [s * 0.08, 0.38, 0.16], [0.03, 0.03, 0.03]));
      for (let k = 0; k < 3; k++) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.24, 0.12, -0.12 + k * 0.1);
        const leg = part(M, CYL, ink, 'solid', [s * 0.14, -0.06, 0], [0.02, 0.32, 0.02]);
        leg.rotation.z = s * 1.0;
        pivot.add(leg);
        legs.push([pivot, k]);
        g.add(pivot);
      }
    }
    return { g, animate: (t, a) => legs.forEach(([p, k]) => (p.rotation.x = a.moving ? Math.sin(t * 14 + k * 2) * 0.35 : 0)) };
  },
  snail: ({ M, own, D }, ink, acc) => {
    const g = new THREE.Group();
    const ant = [-1, 1].map((s) => rot(part(M, CYL, D, 'solid', [0.33, 0.14, s * 0.04], [0.012, 0.16, 0.012]), s * 0.2, 0, -0.5));
    g.add(
      part(M, SPHERE, ink, 'mid', [0.05, 0.05, 0], [0.35, 0.07, 0.12]),
      part(M, SPHERE, ink, 'dense', [-0.05, 0.24, 0], [0.22, 0.22, 0.17]),
      ...[-1, 1].map((s) => part(M, own(new THREE.TorusGeometry(0.11, 0.025, 8, 24)), acc, 'solid', [-0.05, 0.24, s * 0.16])),
      ...ant,
    );
    return { g, animate: (t, a) => ant.forEach((m, k) => (m.rotation.z = -0.5 + Math.sin(t * 1.5 + k) * 0.1)) };
  },
};

// ---------- decor ----------

const DECOR = {
  kelp({ M, rand }, spec, x, z) {
    const h = Math.min(2 + rand() * 1.6, T.top - T.floor + 0.2), n = 12, ph = rand() * 6, base = sandAt(x, z) - 0.05;
    const c = chain(M, n, 0.07, spec.ink, spec.tone, 0.6);
    const leaves = Array.from({ length: 4 }, (_, i) => part(M, SPHERE, spec.ink, spec.tone, [0, 0, 0], [0.22, 0.06, 0.08]));
    const g = new THREE.Group();
    g.add(c.g, ...leaves);
    const pts = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    return {
      g,
      update(t) {
        pts.forEach((p, i) => p.set(x + Math.sin(t * 0.9 + i * 0.45 + ph) * (i / n) * 0.35, base + (h * i) / n, z + Math.cos(t * 0.7 + i * 0.4 + ph) * (i / n) * 0.15));
        c.set(pts);
        leaves.forEach((l, k) => {
          const p = pts[3 + k * 2];
          l.position.set(p.x + (k % 2 ? 0.16 : -0.16), p.y, p.z);
          l.rotation.z = (k % 2 ? 0.5 : -0.5) + Math.sin(t + k) * 0.1;
        });
      },
    };
  },
  seagrass({ M, rand }, spec, x, z) {
    const g = new THREE.Group(), blades = [];
    for (let k = 0; k < 7; k++) {
      const c = chain(M, 4, 0.025, spec.ink, spec.tone, 0.4);
      blades.push([c, x + (rand() - 0.5) * 0.4, z + (rand() - 0.5) * 0.3, 0.5 + rand() * 0.6, rand() * 6]);
      g.add(c.g);
    }
    const pts = Array.from({ length: 5 }, () => new THREE.Vector3());
    return {
      g,
      update(t) {
        for (const [c, bx, bz, h, ph] of blades) {
          pts.forEach((p, i) => p.set(bx + Math.sin(t * 1.3 + ph) * 0.12 * (i / 4) ** 2, sandAt(bx, bz) - 0.05 + (h * i) / 4, bz));
          c.set(pts);
        }
      },
    };
  },
  coral({ M, rand }, spec, x, z) {
    const g = new THREE.Group();
    (function branch(start, dir, len, depth, r) {
      const end = start.clone().addScaledVector(dir, len);
      const m = M(CYL, spec.ink, spec.tone);
      m.position.addVectors(start, end).multiplyScalar(0.5);
      m.scale.set(r, len * 1.1, r);
      m.quaternion.setFromUnitVectors(UP, dir);
      g.add(m);
      if (!depth) return g.add(part(M, SPHERE, spec.ink, spec.tone, end.toArray(), [r * 1.4, r * 1.4, r * 1.4]));
      for (let k = 0; k < 2; k++) {
        const axis = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize();
        branch(end, dir.clone().applyAxisAngle(axis, 0.4 + rand() * 0.4).normalize(), len * 0.72, depth - 1, r * 0.72);
      }
    })(new THREE.Vector3(x, sandAt(x, z) - 0.05, z), UP.clone(), 0.55, 3, 0.09);
    return { g };
  },
  rock({ M, own, rand }, spec, x, z) {
    const geo = own(new THREE.IcosahedronGeometry(0.4, 1));
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.85 + ((Math.sin(p.getX(i) * 9.1 + p.getY(i) * 5.3 + p.getZ(i) * 7.7 + x) + 1) / 2) * 0.3;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const s = 0.8 + rand() * 0.6;
    return { g: part(M, geo, spec.ink, spec.tone, [x, sandAt(x, z) + 0.05, z], [1.3 * s, 0.7 * s, s]) };
  },
  castle({ M, own, D }, spec, x, z) {
    const g = new THREE.Group(), base = sandAt(x, z) - 0.05;
    const box = own(new THREE.BoxGeometry(1, 1, 1));
    for (const [bx, w, h] of [[-0.62, 0.45, 0.85], [0, 0.8, 1.25], [0.62, 0.45, 0.85]]) {
      g.add(part(M, box, spec.ink, spec.tone, [x + bx, base + h / 2, z], [w, h, w * 0.8], 0.45));
      for (let i = 0; i < 3; i++) g.add(part(M, box, spec.ink, spec.tone, [x + bx - w / 3 + (i * w) / 3, base + h + 0.07, z + w * 0.3], [0.1, 0.14, 0.1]));
    }
    g.add(part(M, box, D, 'solid', [x, base + 0.18, z + 0.33], [0.22, 0.36, 0.02]));
    for (const [wx, wy] of [[0, 0.85], [-0.62, 0.6], [0.62, 0.6]]) g.add(part(M, box, D, 'solid', [x + wx, base + wy, z + (wx ? 0.19 : 0.33)], [0.08, 0.12, 0.02]));
    return { g };
  },
  shell({ M, own, rand }, spec, x, z) {
    const geo = own(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI));
    const m = part(M, geo, spec.ink, spec.tone, [x, sandAt(x, z) + 0.02, z], [1, 0.45, 1]);
    m.rotation.set(-0.3, rand() * 6, 0);
    return { g: m };
  },
  starfish({ M, own, rand }, spec, x, z) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const ang = (i * Math.PI) / 5, r = i % 2 ? 0.08 : 0.22;
      i ? s.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : s.moveTo(r, 0);
    }
    const geo = own(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }));
    const m = part(M, geo, spec.ink, spec.tone, [x, sandAt(x, z) + 0.03, z + 0.6]);
    m.rotation.set(-Math.PI / 2, 0, rand() * 6);
    return { g: m };
  },
  bubbles({ M, rand }, spec, x, z) {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 9; i++) {
      const b = part(M, SPHERE, spec.ink, spec.tone === 'solid' ? 'dense' : spec.tone, [x, 0, z], [1, 1, 1], 0.7);
      b.scale.setScalar(0.04 + rand() * 0.06);
      list.push([b, rand(), rand() * 6]);
      g.add(b);
    }
    const span = T.water - T.floor - 0.3;
    return {
      g,
      update(t) {
        for (const [b, y0, ph] of list) b.position.set(x + Math.sin(t * 3 + ph) * 0.06, T.floor + 0.1 + ((y0 * span + t * 0.5) % span), z);
      },
    };
  },
};

// ---------- helpers ----------

function angleDiff(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
