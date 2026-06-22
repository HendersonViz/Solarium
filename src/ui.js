import * as THREE from 'three';
import { PLANETS } from './bodies.js';

// Side panel: a planet-name list (fallback for users who don't want to
// click in 3D) plus a Wikipedia article extract fetched from the REST
// summary endpoint on selection. Clicking a planet in the canvas drives
// the same panel via the raycaster below.

const WIKI_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

export async function fetchWikiExtract(title) {
  const url = WIKI_ENDPOINT + encodeURIComponent(title);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return {
    title: data.title || title,
    extract: data.extract || '',
    extractHtml: data.extract_html || '',
    articleUrl: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || null,
    thumbnail: (data.originalimage && data.originalimage.source) || (data.thumbnail && data.thumbnail.source) || null
  };
}

export function setupUI({ camera, canvas, planetMeshes, sunMesh, sunBody, cometMesh, onSelect, onCometEgg, onArgClose }) {
  // --- Build panel DOM (skeleton styled via index.html) -------------------
  const panel = document.getElementById('panel');
  const panelList = document.getElementById('panel-list');
  const panelTitle = document.getElementById('panel-title');
  const panelArticle = document.getElementById('panel-article');
  const panelClose = document.getElementById('panel-close');

  // Planet-name buttons, colour-coded with each body's colour. The Sun
  // leads the list so the whole system is explorable from the panel.
  const buttons = new Map();
  {
    const b = document.createElement('button');
    b.className = 'planet-btn';
    b.textContent = sunBody.name;
    const hex = '#' + sunBody.color.toString(16).padStart(6, '0');
    b.style.setProperty('--planet-color', hex);
    b.addEventListener('click', () => selectBody(sunBody));
    panelList.appendChild(b);
    buttons.set(sunBody.name, b);
  }
  for (const body of PLANETS) {
    const b = document.createElement('button');
    b.className = 'planet-btn';
    b.textContent = body.name;
    const hex = '#' + body.color.toString(16).padStart(6, '0');
    b.style.setProperty('--planet-color', hex);
    b.addEventListener('click', () => selectBody(body));
    panelList.appendChild(b);
    buttons.set(body.name, b);
  }

  panelClose.addEventListener('click', () => {
    onSelect(null);
    closePanel();
  });

  // --- Raycast on canvas click -------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;

  // Distinguish a click from a drag so orbit-dragging doesn't trigger picks.
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - pointerDown.t;
    pointerDown = null;
    if (dist > 6 || dt > 400) return; // treat as drag, not click

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = planetMeshes.map(p => p.mesh);
    if (sunMesh) meshes.push(sunMesh);
    if (cometMesh) meshes.push(cometMesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const mesh = hits[0].object;
      // The comet routes to the easter egg, not a body selection.
      if (mesh.isComet) { onCometEgg(); return; }
      if (sunMesh && mesh === sunMesh) {
        selectBody(sunBody);
      } else {
        const entry = planetMeshes.find(p => p.mesh === mesh);
        if (entry) selectBody(entry.body);
      }
    } else {
      // Empty space: deselect.
      onSelect(null);
      closePanel();
    }
  });

  // --- Selection + article fetch -----------------------------------------
  let activeBody = null;

  function selectBody(body) {
    activeBody = body;
    onSelect(body);
    openPanel(body);
  }

  function openPanel(body) {
    panel.classList.add('open');
    panelTitle.textContent = body.name;
    panelTitle.style.color = '#' + body.color.toString(16).padStart(6, '0');
    for (const [name, b] of buttons) b.classList.toggle('active', name === body.name);

    // Loading state, then fetch.
    panelArticle.innerHTML = `<div class="wiki-loading">Looking up ${body.name} on Wikipedia…</div>`;
    fetchWikiExtract(body.wikiTitle)
      .then((info) => renderArticle(body, info))
      .catch((err) => renderError(body, err));
  }

  function closePanel() {
    const wasArg = panel.classList.contains('arg-mode');
    panel.classList.remove('open', 'arg-mode');
    for (const b of buttons.values()) b.classList.remove('active');
    activeBody = null;
    if (wasArg && onArgClose) onArgClose();
  }

  function renderArticle(body, info) {
    panel.classList.remove('arg-mode');
    const thumb = info.thumbnail
      ? `<img class="wiki-thumb" src="${info.thumbnail}" alt="${body.name}" referrerpolicy="no-referrer" />`
      : '';
    const link = info.articleUrl
      ? `<a class="wiki-link" href="${info.articleUrl}" target="_blank" rel="noopener noreferrer">Read full article on Wikipedia ↗</a>`
      : '';
    const extract = info.extract || 'No summary available.';
    panelArticle.innerHTML = `
      ${thumb}
      <p class="wiki-extract">${escapeHtml(extract)}</p>
      ${link}
    `;
  }

  function renderError(body, err) {
    panel.classList.remove('arg-mode');
    panelArticle.innerHTML = `
      <p class="wiki-error">Couldn't load the Wikipedia summary for ${body.name}
      (${err.message}). The article is still available directly:</p>
      <a class="wiki-link" href="https://en.wikipedia.org/wiki/${encodeURIComponent(body.wikiTitle)}"
        target="_blank" rel="noopener noreferrer">Open Wikipedia ↗</a>
    `;
  }

  // Easter-egg mode for the comet. Not a body, not a Wikipedia fetch —
  // a single cryptic fragment with a click counter. The panel switches
  // to `arg-mode` styling (see index.html): monospace, warm tint, blink.
  function showArg(fragment, clickCount) {
    activeBody = null; // no body selected while ARG is open
    panel.classList.add('open', 'arg-mode');
    panelTitle.textContent = '???';
    panelTitle.style.color = '';
    for (const b of buttons.values()) b.classList.remove('active');
    const counter = clickCount > 1 ? `<div class="arg-meta">visit #${clickCount}</div>` : '';
    // Deep layer (visit 15+): the cursor stops blinking and creeps
    // leftward across the text, as if reading along with the reader.
    const cursorCls = clickCount >= 15 ? 'arg-cursor-deep' : 'arg-cursor';
    panelArticle.innerHTML = `
      <p class="arg-fragment">${escapeHtml(fragment)}</p>
      ${counter}
      <div class="${cursorCls}"></div>
    `;
  }

  // Public surface: main.js calls this when the comet is clicked.
  return { showArg };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
