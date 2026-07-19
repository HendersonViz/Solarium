import * as THREE from 'three';

// Minimal spherical orbit camera: scroll = dolly, drag = orbit.
// No external controls dependency. State lives in spherical coords and is
// reapplied to the camera on every input event.
//
// The camera orbits around `state.target` (a Vector3), so the focus point
// can move — used to snap-and-follow a selected planet. `flyTo(target, r)`
// is a short eased tween of radius + target position; user input cancels
// any in-flight tween so manual control always wins.

export function makeControls(camera, domElement) {
  const state = {
    radius: 140,
    theta: Math.PI * 0.25,   // azimuth
    phi:   Math.PI * 0.42,   // polar (down from +Y)
    minRadius: 8,
    maxRadius: 600,
    minPhi: 0.15,
    maxPhi: Math.PI - 0.15,
    target: new THREE.Vector3(0, 0, 0),
    flying: false,
    // Set by every input handler; main.js uses it to start the idle
    // "breathing" drift only after the user has left the camera alone.
    lastInputAt: performance.now()
  };

  let dragging = false;
  let lastX = 0, lastY = 0;
  let flyAnim = null;

  function apply() {
    const sinPhi = Math.sin(state.phi);
    camera.position.set(
      state.target.x + state.radius * sinPhi * Math.cos(state.theta),
      state.target.y + state.radius * Math.cos(state.phi),
      state.target.z + state.radius * sinPhi * Math.sin(state.theta)
    );
    camera.lookAt(state.target);
  }

  function cancelFly() {
    state.flying = false;
    flyAnim = null;
  }

  // Eased tween of radius + target. main.js calls setTarget each frame to
  // keep tracking a moving planet once the tween lands.
  function flyTo(targetVec, radius) {
    cancelFly();
    flyAnim = {
      fromR: state.radius, toR: Math.min(state.maxRadius, Math.max(state.minRadius, radius)),
      fromT: state.target.clone(), toT: targetVec.clone(),
      start: performance.now(), dur: 850
    };
    state.flying = true;
  }

  function tickFly(now) {
    if (!flyAnim) return false;
    const k = Math.min(1, (now - flyAnim.start) / flyAnim.dur);
    const e = k * (2 - k); // easeOutQuad
    state.radius = flyAnim.fromR + (flyAnim.toR - flyAnim.fromR) * e;
    state.target.lerpVectors(flyAnim.fromT, flyAnim.toT, e);
    if (k >= 1) {
      state.flying = false;
      flyAnim = null;
    }
    return true;
  }

  // Snap focus to a body's position without animating (used each frame to
  // follow a moving planet after flyTo has landed).
  function setTarget(v) {
    state.target.copy(v);
  }

  function onWheel(e) {
    e.preventDefault();
    cancelFly();
    state.lastInputAt = performance.now();
    const factor = Math.exp(e.deltaY * 0.0012);
    state.radius = Math.min(state.maxRadius, Math.max(state.minRadius, state.radius * factor));
    apply();
  }

  function onDown(e) {
    cancelFly();
    state.lastInputAt = performance.now();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    domElement.style.cursor = 'grabbing';
  }

  function onMove(e) {
    if (!dragging) return;
    state.lastInputAt = performance.now();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    state.theta -= dx * 0.005;
    state.phi   -= dy * 0.005;
    state.phi = Math.min(state.maxPhi, Math.max(state.minPhi, state.phi));
    apply();
  }

  function onUp() {
    dragging = false;
    domElement.style.cursor = 'grab';
  }

  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  domElement.style.cursor = 'grab';

  apply();
  return { apply, state, flyTo, setTarget, tickFly };
}
