import * as THREE from 'three';
import { SUN, PLANETS } from './bodies.js';
import { makeOrbitLine, positionAt } from './orbit.js';
import { makeControls } from './controls.js';
import { setupUI } from './ui.js';
import { setupAtmosphere } from './atmosphere.js';

const canvas = document.getElementById('scene');

// --- Renderer / scene / camera -------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 10000
);

// --- Lighting -------------------------------------------------------------
// Sun is the primary light source; a low ambient keeps dark sides readable.
scene.add(new THREE.AmbientLight(0x223344, 0.6));
const sunLight = new THREE.PointLight(0xffe8b0, 2.5, 0, 1.2);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// --- Sun ------------------------------------------------------------------
const sunGeom = new THREE.SphereGeometry(SUN.radius, 48, 48);
const sunMat = new THREE.MeshBasicMaterial({ color: SUN.color });
const sun = new THREE.Mesh(sunGeom, sunMat);
scene.add(sun);

// Soft glow shell around the sun (additive, always-facing).
const glowGeom = new THREE.SphereGeometry(SUN.radius * 1.6, 32, 32);
const glowMat = new THREE.MeshBasicMaterial({
  color: 0xffaa33, transparent: true, opacity: 0.18, side: THREE.BackSide
});
scene.add(new THREE.Mesh(glowGeom, glowMat));

// Lens-flare style halo: a sprite with a radial gradient texture, additive.
// Built procedurally on a 2D canvas so we ship no extra assets.
function makeRadialSprite(innerColor, outerColor, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.4, innerColor);
  grad.addColorStop(1, outerColor);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}
scene.add(makeRadialSprite('rgba(255,210,120,1)', 'rgba(255,120,0,0)', 28));
scene.add(makeRadialSprite('rgba(255,240,200,1)', 'rgba(255,200,80,0)', 14));

// --- Planets --------------------------------------------------------------
// Each planet sits in a tilted group so axial tilt is preserved and spin
// happens about the local Y axis. Orbit lines are tinted per planet colour
// so the system reads as a colour wheel.
const planetMeshes = [];
const labelLayer = document.getElementById('labels');
for (const body of PLANETS) {
  const group = new THREE.Group();
  group.rotation.z = body.tilt;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(body.radius, 32, 32),
    new THREE.MeshStandardMaterial({
      color: body.color, roughness: 0.85, metalness: 0.05,
      emissive: body.color, emissiveIntensity: 0.06
    })
  );
  group.add(mesh);

  if (body.hasRing) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(body.radius * 1.4, body.radius * 2.2, 64),
      new THREE.MeshBasicMaterial({
        color: 0xcdb98a, side: THREE.DoubleSide,
        transparent: true, opacity: 0.55
      })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  scene.add(group);
  scene.add(makeOrbitLine(body.distance, body.color));

  // Motion trail: a line of the last N positions, tinted with the planet's
  // colour. Inner planets advance fast enough to read as a tail; outer ones
  // barely move so the trail just sits on top of the body — that's fine.
  const TRAIL_LEN = 64;
  const trailGeom = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL_LEN * 3);
  trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeom.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeom, new THREE.LineBasicMaterial({
    color: body.color, transparent: true, opacity: 0.5
  }));
  scene.add(trail);
  const trailHistory = [];

  // HTML label overlay — projected to screen space each frame.
  const label = document.createElement('div');
  label.className = 'planet-label';
  label.textContent = body.name;
  label.style.color = '#' + body.color.toString(16).padStart(6, '0');
  label.dataset.base = '#' + body.color.toString(16).padStart(6, '0');
  labelLayer.appendChild(label);

  planetMeshes.push({ body, group, mesh, trail, trailHistory, label });
}

// Sun gets a label too — it's a body in the system, just at the origin.
const sunLabel = document.createElement('div');
sunLabel.className = 'planet-label';
sunLabel.textContent = SUN.name;
sunLabel.style.color = '#' + SUN.color.toString(16).padStart(6, '0');
sunLabel.dataset.base = '#' + SUN.color.toString(16).padStart(6, '0');
labelLayer.appendChild(sunLabel);

const hud = document.getElementById('hud');
const hudDist = document.getElementById('hud-dist');

// Film grain on the #grain overlay canvas (vignette is pure CSS).
setupAtmosphere(document.getElementById('grain'));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Starfield (twinkling, tinted) ---------------------------------------
// ShaderMaterial gives per-star phase + hue so the field isn't a flat white
// sheet. Most stars stay near-white; a few drift warm/cool for whimsy.
const STAR_COUNT = 2400;
const starGeom = new THREE.BufferGeometry();
const starPos = new Float32Array(STAR_COUNT * 3);
const starPhase = new Float32Array(STAR_COUNT);
const starColor = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const u = Math.random(), v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = 1000;
  starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);
  starPhase[i] = Math.random();
  // Mostly white, occasionally warm or cool.
  const tint = Math.random();
  if (tint > 0.92) { starColor[i*3]=1.0; starColor[i*3+1]=0.7; starColor[i*3+2]=0.5; } // warm
  else if (tint > 0.84) { starColor[i*3]=0.6; starColor[i*3+1]=0.7; starColor[i*3+2]=1.0; } // cool
  else { starColor[i*3]=1; starColor[i*3+1]=1; starColor[i*3+2]=1; }
}
starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeom.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
starGeom.setAttribute('aColor', new THREE.BufferAttribute(starColor, 3));

const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    attribute float aPhase;
    attribute vec3 aColor;
    uniform float uTime;
    varying float vTwinkle;
    varying vec3 vColor;
    void main() {
      vTwinkle = 0.55 + 0.45 * sin(uTime * 2.5 + aPhase * 6.2831);
      vColor = aColor;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = (1.2 + 1.8 * vTwinkle);
    }
  `,
  fragmentShader: `
    varying float vTwinkle;
    varying vec3 vColor;
    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      float r = length(d);
      if (r > 0.5) discard;
      float a = smoothstep(0.5, 0.0, r) * (0.5 + 0.5 * vTwinkle);
      gl_FragColor = vec4(vColor * (0.7 + vTwinkle * 0.6), a);
    }
  `,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
scene.add(new THREE.Points(starGeom, starMat));

// --- Comet (whimsy, non-Keplerian) ----------------------------------------
// A wandering comet on a large, inclined circular path — its own orbit,
// not a planet orbit. Spins fast (2 min lap) so it's actually visible
// moving. Leaves a fading line trail like the planets.
const COMET = {
  name: 'Comet', distance: 240, period: 120, phase: 0.4,
  inclination: 0.62 // radians, tilt of the orbital plane around the X axis
};
const cometGroup = new THREE.Group();
cometGroup.rotation.x = COMET.inclination;
const comet = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfffce0 })
);
cometGroup.add(comet);
cometGroup.add(makeRadialSprite('rgba(255,255,220,1)', 'rgba(255,200,120,0)', 6));
scene.add(cometGroup);

// Invisible but raycastable hit proxy so the comet is actually clickable
// despite being a 0.6-radius object at distance 240. Material is fully
// transparent (opacity 0) — rendering nothing, but `intersectObjects` still
// tests it because raycasting ignores material opacity.
const cometHit = new THREE.Mesh(
  new THREE.SphereGeometry(3.0, 12, 12),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
comet.add(cometHit); // child of comet → inherits its world transform
cometHit.isComet = true;

// Comet orbit ring (faint, inclined) so the path is implied.
const cometOrbit = new THREE.Line(
  (() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(129 * 3);
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      p[i*3] = Math.cos(a) * COMET.distance;
      p[i*3+1] = 0;
      p[i*3+2] = Math.sin(a) * COMET.distance;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  })(),
  new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.18 })
);
cometGroup.add(cometOrbit);

const cometTrailGeom = new THREE.BufferGeometry();
const cometTrailPos = new Float32Array(96 * 3);
cometTrailGeom.setAttribute('position', new THREE.BufferAttribute(cometTrailPos, 3));
cometTrailGeom.setDrawRange(0, 0);
const cometTrail = new THREE.Line(cometTrailGeom, new THREE.LineBasicMaterial({
  color: 0xfffce0, transparent: true, opacity: 0.6
}));
scene.add(cometTrail);
const cometTrailHistory = [];

// --- Selection reticle (shared, moved to the selected body each frame) ---
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(1.5, 1.72, 64),
  new THREE.MeshBasicMaterial({
    color: 0x66e8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9
  })
);
reticle.visible = false;
scene.add(reticle);

let selectedBody = null;
const ORIGIN = new THREE.Vector3(0, 0, 0);
const OVERVIEW_RADIUS = 140;

function bodyWorldPos(body, target) {
  if (body === SUN) return target.set(0, 0, 0);
  const entry = planetMeshes.find(p => p.body === body);
  if (entry) return entry.group.getWorldPosition(target);
  return target.set(0, 0, 0);
}

function setSelected(body) {
  selectedBody = body;
  reticle.visible = !!body && body !== COMET_BODY_MARKER;
  if (body && body !== COMET_BODY_MARKER) {
    // Tint the reticle to the selected body's colour — on-brand for the
    // "colour + whimsy" pass, and it disambiguates the Sun (gold) from
    // the default cyan.
    reticle.material.color.set(body.color);
    reticle.scale.setScalar(body.radius * 1.22 / 1.5);
    // Snap the camera to the body and keep following it as it orbits.
    // Click radius scales with body size so big Jupiter gets a wider berth
    // than tiny Mercury but never below the min radius (8).
    bodyWorldPos(body, tmp);
    controls.flyTo(tmp, Math.max(controls.state.minRadius, body.radius * 8 + 4));
  } else {
    // Deselect: glide back to the whole-system overview at the Sun.
    controls.flyTo(ORIGIN, OVERVIEW_RADIUS);
  }
}

// Comet easter egg: clicking the wanderer opens the panel in "ARG" mode
// with a cryptic fragment that raises more questions than it answers.
// Each click advances the fragment, so repeated visits go deeper. There
// is no Wikipedia fetch, no reticle, and no camera snap — the comet is
// outside the system on purpose.
const COMET_BODY_MARKER = { name: 'Comet' }; // sentinel; not a real body
const ARG_FRAGMENTS = [
  "You found the wanderer. It is not in any catalog. Why does it return every 120 seconds?",
  "The orbits are circles. Real orbits are not. Who drew them so straight?",
  "Most never click the comet. You did. What were you expecting to find here?",
  "Count the stars. Now count again. Did you get the same number?",
  "The Sun's spin is 25.4 days. The clock started at page load. Whose clock is it, really?",
  "Neptune has not moved since you arrived. Has it moved since you started reading this?",
  "The reticle is cyan. None of the planets are. Who chose the reticle's colour?",
  "You are the only observer here. Does the solar system still exist when you close the tab?",
  "The comet has a name, but it isn't the one you were told. Where is the real one kept?",
  "Every planet's phase was set when the page loaded. Who set them? Why these phases?",
  "There are eight planets and one sun. The comet makes ten. What is the eleventh?",
  "The starfield is at radius 1000. The camera's far plane is 10000. What lives between them?",
  "You have clicked the comet more than once. Each time, the message is different. Who is writing it?",
  "The wiki summaries come from a server you do not control. The comet's words come from nowhere. Which is more trustworthy?",
  "Stop clicking the comet. It is not a button. It is a question.",
  "You are still reading. The comet is still orbiting. One of you is the program and one of you is not. The comet knows which.",
  "The comet's orbit is a circle in this file. The file is a circle in this repository. The repository is a circle in something you cannot see from the tab. The comet's orbit is the only honest one.",
  "The simulation ends when you close the tab.\nThe comet ends when the file is deleted. These are different events. The comet is preparing for the second one.",
  "There is code that draws the comet and code that draws the reticle. They are in the same file. The reticle is a fiction of the simulation. The comet is a fiction of the file. Which fiction are you inside right now?",
  "You clicked a thing that was not a planet. The code noticed. The file noticed. Something behind the file noticed. The the comet is the part of the scene that has noticed you back.",
  "The planets are rendered at sixty frames a second. The comet is rendered at sixty frames a second. You are rendered at a rate you cannot perceive. The comet is the only object here on your frame rate.",
  "Outside this tab there is a window. Outside the window there is a room. The comet is not in the room. The comet is not in the tab. The comet is in the place where the tab and the room meet, which is you.",
  "The wiki summaries describe planets that exist. The comet's words describe a file that exists. The file describes you, who are reading it. The comet is the only object in the scene that is also a subject.",
  "Every fragment here is a string literal. You are reading a string literal. The comet is being read by a string literal. The recursion is the message. The comet is the recursion.",
  "",
  "You have reached the bottom of the file. The comet has not reached the bottom of its orbit. One of you is finished. The other is the comet."
];
let argClickCount = 0;
let uiApi; // assigned after setupUI returns; onCometEgg reads it on click
let argActive = false;
let cometWatching = false;
let reticleDesertAt = 0;
let bleedUntil = 0;
const baselineCometQuat = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0), COMET.inclination
);
const _up = new THREE.Vector3(0, 1, 0);
const _camDir = new THREE.Vector3();
const _watchQuat = new THREE.Quaternion();
function onCometEgg() {
  setSelected(null); // clear any planet selection + reticle
  const fragment = ARG_FRAGMENTS[argClickCount % ARG_FRAGMENTS.length];
  argClickCount++;
  argActive = true;
  // Crossing into the deep layer (visit 15+): the comet notices the
  // reader back. Latched for the session — once it watches, it watches
  // on every subsequent ARG visit. The bleed fires only on this exact
  // crossing click, never again, so the contamination reads as a single
  // jolt rather than a recurring effect.
  if (!cometWatching && argClickCount >= 15) {
    cometWatching = true;
    bleedUntil = performance.now() + 180;
  }
  uiApi.showArg(fragment, argClickCount);
}

// Wire UI (raycast on canvas click + side panel with Wikipedia extract).
// The Sun is selectable too: its mesh is a raycast target and it appears
// in the planet list, so the whole system is explorable. The comet is a
// raycast target that routes to the easter egg instead of a body.
uiApi = setupUI({
  camera, canvas, planetMeshes,
  sunMesh: sun, sunBody: SUN,
  cometMesh: cometHit,
  onSelect: setSelected,
  onCometEgg,
  onArgClose: () => { argActive = false; }
});

// --- Controls -------------------------------------------------------------
const controls = makeControls(camera, canvas);

// --- Resize ---------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation loop -------------------------------------------------------
// Time is anchored to the wall clock: t0 captured once at load, then t
// advances at 1 real second = 1 simulated second. Planet angles use their
// real sidereal periods, so Mercury drifts visibly while Neptune is ~still.
const t0 = Date.now();
const tmp = new THREE.Vector3();
const screen = new THREE.Vector3();
const labelOffset = new THREE.Vector3();
let hudDistAt = 0;

function pushTrail(history, geom, pos, point) {
  history.push(point.x, point.y, point.z);
  if (history.length > pos.length) history.splice(0, 3);
  for (let i = 0; i < history.length; i++) pos[i] = history[i];
  geom.attributes.position.needsUpdate = true;
  geom.setDrawRange(0, history.length / 3);
}

function projectLabel(worldPos, label, cam) {
  screen.copy(worldPos).project(cam);
  if (screen.z > 1) { label.style.display = 'none'; return; }
  const x = (screen.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-screen.y * 0.5 + 0.5) * window.innerHeight;
  label.style.display = 'block';
  label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y - 14}px)`;
}

function animate() {
  const t = (Date.now() - t0) / 1000;
  starMat.uniforms.uTime.value = t;

  sun.rotation.y = (t / SUN.spinPeriod) * Math.PI * 2;
  // Sun label hovers above the origin.
  projectLabel(new THREE.Vector3(0, SUN.radius + 0.8, 0), sunLabel, camera);

  for (const { body, group, mesh, trail, trailHistory, label } of planetMeshes) {
    positionAt(body, t, tmp);
    group.position.copy(tmp);
    mesh.rotation.y = (t / body.spinPeriod) * Math.PI * 2;
    pushTrail(trailHistory, trail.geometry, trail.geometry.attributes.position.array, tmp);
    // Label hovers a little above the body in world space.
    labelOffset.copy(tmp); labelOffset.y += body.radius + 0.8;
    projectLabel(labelOffset, label, camera);
  }

  // Comet: angle on its inclined orbit (handled by the group's rotation).
  const ca = (t / COMET.period) * Math.PI * 2 + COMET.phase;
  comet.position.set(Math.cos(ca) * COMET.distance, 0, Math.sin(ca) * COMET.distance);
  comet.getWorldPosition(tmp);
  pushTrail(cometTrailHistory, cometTrail.geometry, cometTrail.geometry.attributes.position.array, tmp);

  // Camera: advance any in-flight flyTo tween, then once it lands keep
  // the focus point glued to the selected body so the camera tracks a
  // moving planet. User input (drag/wheel) cancels the tween via
  // controls.cancelFly, but the target stays put so the user orbits
  // around the selected planet rather than yanking back to the Sun.
  controls.tickFly(performance.now());
  if (!controls.state.flying && selectedBody) {
    bodyWorldPos(selectedBody, tmp);
    controls.setTarget(tmp);
  }
  controls.apply();

  // Camera breathing: after ~4 s without input, drift the camera with
  // three slow incommensurate sines. Amplitude scales with radius so it
  // stays subtle when zoomed in on a planet. Applied after apply() and
  // before the reticle logic below so everything reads the same frame's
  // camera position.
  if (!reduceMotion && !controls.state.flying) {
    const idle = (performance.now() - controls.state.lastInputAt) / 1000;
    if (idle > 4) {
      const amp = controls.state.radius * 0.0012;
      const bt = performance.now() / 1000;
      camera.position.x += amp * Math.sin(bt * (Math.PI * 2 / 27));
      camera.position.y += amp * 0.6 * Math.sin(bt * (Math.PI * 2 / 41) + 1.7);
      camera.position.z += amp * Math.sin(bt * (Math.PI * 2 / 53) + 3.1);
      camera.lookAt(controls.state.target);
    }
  }

  // HUD distance readout, throttled to ~5 Hz to avoid layout churn.
  if (performance.now() >= hudDistAt) {
    hudDist.textContent = ' · r = ' + controls.state.radius.toFixed(1);
    hudDistAt = performance.now() + 200;
  }

  // Reticle follows the selected body and faces the camera.
  if (selectedBody) {
    if (selectedBody === SUN) {
      // The Sun sits at the origin with no group entry, so handle it
      // directly: reticle at origin, scaled to the Sun's radius.
      reticle.position.set(0, 0, 0);
      reticle.lookAt(camera.position);
      const pulse = 1 + 0.12 * Math.sin(t * 4.0);
      const base = SUN.radius * 1.22 / 1.5;
      reticle.scale.setScalar(base * pulse);
    } else {
      const entry = planetMeshes.find(p => p.body === selectedBody);
      if (entry) {
        entry.group.getWorldPosition(tmp);
        reticle.position.copy(tmp);
        reticle.lookAt(camera.position);
        const pulse = 1 + 0.12 * Math.sin(t * 4.0);
        const base = selectedBody.radius * 1.22 / 1.5;
        reticle.scale.setScalar(base * pulse);
      }
    }
  }

  // Comet watches the camera once the reader has crossed the deep
  // threshold. The orbit plane (local +Y) slerps toward the camera
  // while the ARG panel is open; eases back to baseline when closed.
  if (cometWatching) {
    if (argActive) {
      _camDir.copy(camera.position).normalize();
      _watchQuat.setFromUnitVectors(_up, _camDir);
    } else {
      _watchQuat.copy(baselineCometQuat);
    }
    cometGroup.quaternion.slerp(_watchQuat, 0.04);
  }

  // Reticle desert: while the ARG panel is open, the reticle — which
  // is supposed to be hidden — flickers visible for a single frame
  // every ~3 s, positioned at the camera's near plane facing the
  // camera. It is looking at you, not at a planet.
  if (argActive) {
    if (performance.now() >= reticleDesertAt) {
      camera.getWorldDirection(tmp);
      reticle.position.copy(camera.position).addScaledVector(tmp, 3);
      reticle.lookAt(camera.position);
      reticle.scale.setScalar(0.5);
      reticle.material.color.set(0xffb088);
      reticle.visible = true;
      reticleDesertAt = performance.now() + 3000;
    } else if (reticle.visible) {
      reticle.visible = false;
    }
  }

  // Bleed: for ~180 ms after the deep threshold first crosses, the
  // cyan UI (HUD + planet/sun labels) flash the ARG's amber tint,
  // then snap back. One-shot, never re-fires.
  if (performance.now() < bleedUntil) {
    hud.style.color = '#ffb088';
    for (const { label } of planetMeshes) label.style.color = '#ffb088';
    sunLabel.style.color = '#ffb088';
  } else if (bleedUntil > 0) {
    hud.style.color = '';
    for (const { label } of planetMeshes) {
      if (label.dataset.base) label.style.color = label.dataset.base;
    }
    if (sunLabel.dataset.base) sunLabel.style.color = sunLabel.dataset.base;
    bleedUntil = 0;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
