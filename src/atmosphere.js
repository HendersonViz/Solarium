// Film grain overlay: fills the #grain canvas with monochrome noise,
// redrawn at ~12 fps. Redrawing slower than the render loop is deliberate —
// it reads as film grain rather than static, and it's much cheaper.
//
// The canvas renders at half window resolution and is CSS-stretched to full
// screen; at 5% opacity the soft upscale is invisible. With
// prefers-reduced-motion the grain is drawn once and left static.

export function setupAtmosphere(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let img = null;

  function draw() {
    const buf = new Uint32Array(img.data.buffer);
    for (let i = 0; i < buf.length; i++) {
      const v = (Math.random() * 255) | 0;
      // Little-endian RGBA: one 32-bit write per gray pixel.
      buf[i] = (255 << 24) | (v << 16) | (v << 8) | v;
    }
    ctx.putImageData(img, 0, 0);
  }

  function resize() {
    canvas.width = Math.max(2, Math.floor(window.innerWidth / 2));
    canvas.height = Math.max(2, Math.floor(window.innerHeight / 2));
    img = ctx.createImageData(canvas.width, canvas.height);
    draw();
  }

  window.addEventListener('resize', resize);
  resize();
  if (!reduced) setInterval(draw, 83);
}
