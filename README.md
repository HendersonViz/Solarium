# Solarium

A real-time 3D solar system in the browser, rendered with
[Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). The Sun
and all eight planets orbit at their real sidereal periods, advancing at
true speed from the moment you open the page — Mercury visibly drifts,
Neptune effectively does not. That's the point.

## Quick start

```sh
npm install
npm run dev      # http://localhost:5173 (auto-opens)
```

Other scripts:

```sh
npm run build    # production bundle to dist/
npm run preview  # serve the built bundle
```

There are no tests, linters, or typecheckers. Verify changes by eye in the
browser.

## Controls

| Input | Action |
| --- | --- |
| Scroll | Zoom in / out |
| Drag | Orbit the camera |
| Click a planet (or the Sun) | Snap the camera to it + open its info panel |
| Click empty space | Back to the whole-system view |

The side panel fetches a live summary of the selected body from Wikipedia.

Leave the camera alone for a few seconds and it begins to breathe.

## What's in the scene

- The Sun, with a glow shell and lens-flare halo, spinning on its real
  ~25.4-day period
- Eight planets with real axial tilts, spin periods, orbit lines, and
  motion trails (Saturn has its rings)
- A twinkling, tinted starfield (~2,400 stars on a custom shader)
- Film grain and a vignette for atmosphere
- A comet. It's not in any catalog. It returns every 120 seconds. You can
  click it.

## A note on scale

Planet radii and orbital distances are **log-compressed, not to physical
scale** — this is deliberate, so Neptune stays visible alongside the inner
planets at the default view. Orbital *periods*, however, are real. The
HUD's `r = …` readout reports distance in these compressed scene units.

Planets start at an arbitrary phase at page load and advance at real
relative speed from there; there is no ephemeris math, and there isn't
meant to be.
