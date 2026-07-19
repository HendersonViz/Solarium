# Solarium — Agent Notes

Real-time 3D solar system rendered with Three.js + Vite. Planets advance at
their real sidereal periods, anchored to the wall clock at page load.

## Commands
- `npm install` — install deps (first run only)
- `npm run dev` — Vite dev server at http://localhost:5173 (auto-opens)
- `npm run build` — production bundle to `dist/`
- `npm run preview` — serve the built bundle

No test suite, linter, or typechecker is configured. Verify changes by eye in
the browser.

## Architecture
Single-page app, no router, no framework. Entry is `index.html` → `src/main.js`.

- `src/bodies.js` — data table for the Sun + 8 planets. **Radii and distances
  are log-compressed, not to physical scale** — this is intentional so Neptune
  stays visible alongside the inner planets. Preserve the compression when
  editing; do not "fix" it to real AU values.
- `src/orbit.js` — builds the faint orbit `LineLoop` and computes a body's
  angle/position on the XZ plane at time `t`. All orbits are circular.
- `src/controls.js` — hand-rolled spherical orbit camera (scroll = dolly,
  drag = orbit). **No OrbitControls dependency on purpose.** If you swap to
  `three/examples/jsm/controls/OrbitControls.js`, delete this file and update
  `main.js`; don't leave both.
- `src/main.js` — scene/camera/renderer setup, sun + planets + starfield,
  animation loop. Time is anchored via `t0 = Date.now()` captured once at
  load; `t = (Date.now() - t0) / 1000` advances at real speed.
- `src/atmosphere.js` — film grain on the `#grain` overlay canvas (the
  `#vignette` overlay is pure CSS). Both sit at z-index 6–7, above the
  label layer (5) but below the HUD (10) and panel (20).

## Conventions & gotchas
- `"type": "module"` in `package.json` — all JS uses ESM (`import`/`export`).
- Planet spin uses each body's real sidereal rotation period. Venus and
  Uranus tilts are set so their visual spin direction is preserved; don't
  "correct" the tilt values without re-checking rotation direction.
- The sun has two meshes: the solid sphere + a larger back-side glow shell.
  Both live at the origin; the `PointLight` is also at the origin.
- Camera far plane is `10000` and the starfield sits at radius `1000`. Keep
  new objects well inside those bounds or they'll be clipped / occlude stars.
- Axial tilt is applied to each planet's parent `Group` (z-rotation), and
  spin is applied to the child `Mesh`'s y-rotation. Saturn's ring is a child
  of the same group, so it inherits the tilt automatically.
- Default camera radius is `140` in `controls.js` state; Neptune's orbit is at
  distance `80`. Keep Neptune visible at the default view when changing
  scales — that's the intended "see the whole system" framing.

## Time semantics (don't over-engineer)
v1 deliberately starts planets at an arbitrary phase when the page loads and
lets them advance at real relative speed from there. Do **not** add J2000
epoch math, Keplerian elements, or eccentricity unless explicitly asked — the
user has confirmed the simple model is acceptable.
