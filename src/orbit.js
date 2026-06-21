import * as THREE from 'three';

// Faint circular orbit path on the XZ plane, tinted with the body's colour
// so the system reads as a colour wheel rather than a single blue grid.
export function makeOrbitLine(distance, color = 0x335577) {
  const segments = 128;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3]     = Math.cos(a) * distance;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(a) * distance;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.45
  });
  return new THREE.Line(geom, mat);
}

// Orbital angle at time t (seconds since epoch), in radians.
export function angleAt(body, t) {
  return (t / body.period) * Math.PI * 2 + (body.phase || 0);
}

// World position on the XZ plane at time t.
export function positionAt(body, t, target = new THREE.Vector3()) {
  const a = angleAt(body, t);
  return target.set(Math.cos(a) * body.distance, 0, Math.sin(a) * body.distance);
}
