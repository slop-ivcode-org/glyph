'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const viewport = $('viewport');
  const screen = $('screen');
  const ramps = {
    classic: ' .:-=+*#%@',
    standard: " `.-,:/!{+?1icovC0faZ8dbm@#QWM",
    minimal: ' .:+#'
  };
  const projectModels = new Map();
  let selectedModel = '';
  let modelRequest = 0;
  const state = { mesh: null, yaw: .5, pitch: .35, zoom: 1, panX: 0, panY: 0, fitScale: 1, columns: 140, rows: 60, mode: 'solid', ramp: ramps.classic, intensity: 1.2, ambient: .12, contrast: 1 };
  let depth, shades, lastTime = 0, fpsStart = 0, frames = 0, drag = null;

  function normalizeMesh(vertices, faces) {
    if (!vertices.length || !faces.length) throw new Error('The OBJ needs vertices (v) and faces (f).');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const v of vertices) for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i]);
      max[i] = Math.max(max[i], v[i]);
    }
    const size = Math.max(...max.map((n, i) => n - min[i]));
    if (!Number.isFinite(size) || size <= 0) throw new Error('The mesh has no usable dimensions.');
    const center = min.map((n, i) => (n + max[i]) / 2);
    return { vertices: vertices.map(v => v.map((n, i) => (n - center[i]) * 2 / size)), faces };
  }

  function parseOBJ(text) {
    const vertices = [], faces = [];
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const parts = lines[lineIndex].split('#')[0].trim().split(/\s+/);
      if (parts[0] === 'v') {
        const v = parts.slice(1, 4).map(Number);
        if (v.length !== 3 || !v.every(Number.isFinite)) throw new Error(`Invalid vertex on line ${lineIndex + 1}.`);
        vertices.push(v);
      } else if (parts[0] === 'f') {
        if (parts.length < 4) throw new Error(`Face needs at least three vertices on line ${lineIndex + 1}.`);
        const indices = parts.slice(1).map(part => {
          const token = part.split('/')[0];
          if (!/^-?\d+$/.test(token)) throw new Error(`Invalid face index on line ${lineIndex + 1}.`);
          const index = Number(token);
          const resolved = index < 0 ? vertices.length + index : index - 1;
          if (index === 0 || resolved < 0 || resolved >= vertices.length) throw new Error(`Face index out of bounds on line ${lineIndex + 1}.`);
          return resolved;
        });
        for (let i = 1; i < indices.length - 1; i++) faces.push([indices[0], indices[i], indices[i + 1]]);
      }
      if (vertices.length > 50000 || faces.length > 100000) throw new Error('Mesh too complex. Limit: 50,000 vertices / 100,000 triangles.');
    }
    return normalizeMesh(vertices, faces);
  }

  function setMesh(mesh, name) {
    state.mesh = mesh;
    state.fitScale = 1 / mesh.vertices.reduce((radius, v) => Math.max(radius, Math.hypot(...v)), 1);
    $('model-label').textContent = name.toUpperCase();
    $('mesh-stats').textContent = `${mesh.vertices.length.toLocaleString()} VERTICES / ${mesh.faces.length.toLocaleString()} TRIANGLES`;
    reset();
  }

  function reset() { state.yaw = .5; state.pitch = .35; state.zoom = 1; state.panX = 0; state.panY = 0; }

  function projectionScale() { return Math.min(state.columns * .6, state.rows) * 1.15 * state.fitScale * state.zoom; }

  function pan(dx, dy) {
    // Convert viewport fractions to camera-plane offsets at the mesh center's depth.
    const scale = projectionScale();
    state.panX += dx * state.columns * .6 * 3.6 / scale;
    state.panY -= dy * state.rows * 3.6 / scale;
  }

  function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    state.columns = Number($('density').value);
    const fontSize = width / (state.columns * .6);
    state.rows = Math.max(1, Math.floor(height / fontSize));
    screen.style.fontSize = `${fontSize}px`;
    depth = new Float32Array(state.columns * state.rows);
    shades = new Float32Array(depth.length);
    $('grid-stats').textContent = `${state.columns} COLUMNS x ${state.rows} ROWS`;
  }

  function plot(x, y, z, shade) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= state.columns || y >= state.rows) return;
    const index = y * state.columns + x;
    if (z < depth[index]) { depth[index] = z; shades[index] = shade; }
  }

  function edge(a, b, shade) {
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      plot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1 / ((1 - t) / a[2] + t / b[2]), shade);
    }
  }

  function triangle(a, b, c, shade) {
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(state.columns - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(state.rows - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < .00001) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
      const w = 1 - u - v;
      if (u >= -.001 && v >= -.001 && w >= -.001) {
        const z = 1 / (u / a[2] + v / b[2] + w / c[2]);
        const index = y * state.columns + x;
        if (z < depth[index]) { depth[index] = z; shades[index] = shade; }
      }
    }
  }

  function render(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    if (!document.hidden && state.mesh) {
      if ($('rotate').checked && !drag) state.yaw += dt * .32;
      depth.fill(Infinity); shades.fill(0);
      const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      const transformed = state.mesh.vertices.map(([x, y, z]) => {
        const rx = x * cy + z * sy, rz = -x * sy + z * cy;
        return [rx, y * cp - rz * sp, y * sp + rz * cp];
      });
      const scale = projectionScale();
      const projected = transformed.map(([x, y, z]) => {
        const distance = z + 3.6;
        return [state.columns / 2 + (x + state.panX) * scale / (.6 * distance), state.rows / 2 - (y + state.panY) * scale / distance, distance];
      });
      if (state.mode === 'points') {
        for (const p of projected) plot(p[0], p[1], p[2], .8);
      } else {
        for (const [i, j, k] of state.mesh.faces) {
          const a = transformed[i], b = transformed[j], c = transformed[k];
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
          const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const length = Math.hypot(nx, ny, nz);
          if (length < .000001) continue;
          // Two-sided lighting also supports OBJ files with inconsistent face winding.
          const diffuse = Math.abs((nx * -.35 + ny * .65 - nz * .68) / length);
          const shade = Math.pow(Math.min(1, (state.ambient + diffuse * (1 - state.ambient)) * state.intensity), state.contrast);
          if (state.mode === 'wire') {
            edge(projected[i], projected[j], shade); edge(projected[j], projected[k], shade); edge(projected[k], projected[i], shade);
          } else triangle(projected[i], projected[j], projected[k], shade);
        }
      }
      const lines = [];
      for (let y = 0; y < state.rows; y++) {
        let line = '';
        for (let x = 0; x < state.columns; x++) {
          const index = y * state.columns + x;
          line += depth[index] === Infinity ? ' ' : state.ramp[Math.max(state.ramp[0] === ' ' ? 1 : 0, Math.round(shades[index] * (state.ramp.length - 1)))];
        }
        lines.push(line);
      }
      screen.textContent = lines.join('\n');
      frames++;
      if (time - fpsStart > 750) {
        $('fps').textContent = `${Math.round(frames * 1000 / (time - fpsStart))} FPS`;
        frames = 0; fpsStart = time;
      }
    }
    requestAnimationFrame(render);
  }

  async function loadFile(file) {
    if (!file) return;
    const request = ++modelRequest;
    try {
      if (!/\.obj$/i.test(file.name)) throw new Error('Please choose a Wavefront .obj file.');
      if (file.size > 10 * 1024 * 1024) throw new Error('File too large. The maximum is 10 MB.');
      const mesh = parseOBJ(await file.text());
      if (request !== modelRequest) return;
      setMesh(mesh, file.name);
      $('model').value = '';
      selectedModel = '';
      $('message').classList.remove('error');
      $('message').textContent = `Loaded ${file.name}. No data left your device.`;
    } catch (error) {
      if (request !== modelRequest) return;
      $('message').classList.add('error');
      $('message').textContent = error.message;
    } finally { $('file').value = ''; }
  }

  async function selectModel(value) {
    const request = ++modelRequest;
    try {
      if (projectModels.has(value)) {
        const model = projectModels.get(value);
        if (!model.mesh) {
          if (window.location.protocol === 'file:') throw new Error('Project models require a local server. Run node serve.js and open http://localhost:8080.');
          $('message').classList.remove('error');
          $('message').textContent = `Loading ${model.name}...`;
          const response = await fetch(model.url);
          if (!response.ok) throw new Error(`${model.name}: HTTP ${response.status}. Check the file path and regenerate the manifest.`);
          const data = await response.blob();
          if (data.size > 10 * 1024 * 1024) throw new Error('File too large. The maximum is 10 MB.');
          if (request !== modelRequest) return;
          model.mesh = parseOBJ(await data.text());
        }
        if (request !== modelRequest) return;
        setMesh(model.mesh, model.name);
      } else {
        throw new Error('Model is not in the project manifest.');
      }
      selectedModel = value;
      $('model').value = value;
      $('message').classList.remove('error');
      $('message').textContent = '';
    } catch (error) {
      if (request !== modelRequest) return;
      $('model').value = selectedModel;
      $('message').classList.add('error');
      $('message').textContent = `Could not load model: ${error.message}`;
    }
  }
  $('model').addEventListener('change', event => selectModel(event.target.value));
  function registerProjectModels() {
    try {
      if (!Array.isArray(window.GLYPH_MODELS)) throw new Error('Model manifest is missing or invalid. Run update-models.ps1 and reload.');
      const entries = window.GLYPH_MODELS;
      for (const entry of entries) {
        if (!entry || typeof entry.name !== 'string' || !entry.name.trim() || typeof entry.path !== 'string' || !entry.path.trim()) {
          throw new Error('Invalid model manifest entry. Run update-models.ps1 and reload.');
        }
        const url = new URL(entry.path, window.location.href);
        const folder = new URL('models/', window.location.href);
        if (url.origin !== folder.origin || !url.pathname.startsWith(folder.pathname) || !/\.obj$/i.test(url.pathname)) {
          throw new Error(`Invalid project model path: ${entry.path}`);
        }
      }
      entries.forEach((entry, index) => {
        const value = `project-${index}`;
        projectModels.set(value, { name: entry.name, url: new URL(entry.path, window.location.href).href, mesh: null });
        $('model').add(new Option(entry.name, value));
      });
      if (entries.length) {
        $('model').value = 'project-0';
        selectModel('project-0');
      } else {
        $('message').textContent = 'No project models. Add .obj files to models, run update-models.ps1, and reload.';
      }
    } catch (error) {
      $('message').classList.add('error');
      $('message').textContent = error.message;
    }
  }
  $('upload').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', () => loadFile($('file').files[0]));
  viewport.addEventListener('dragover', (event) => { event.preventDefault(); viewport.classList.add('dragging'); });
  viewport.addEventListener('dragleave', (event) => { if (!viewport.contains(event.relatedTarget)) viewport.classList.remove('dragging'); });
  viewport.addEventListener('drop', (event) => {
    event.preventDefault(); viewport.classList.remove('dragging');
    loadFile(event.dataTransfer.files[0]);
  });
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    viewport.focus({ preventScroll: true });
    drag = { x: event.clientX, y: event.clientY };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (event.shiftKey) {
      pan(dx / viewport.clientWidth, dy / viewport.clientHeight);
    } else {
      state.yaw -= dx * .008;
      state.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.pitch - dy * .008));
    }
    drag = { x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener('pointerup', () => { drag = null; });
  viewport.addEventListener('pointercancel', () => { drag = null; });
  viewport.addEventListener('lostpointercapture', () => { drag = null; });
  function zoom(amount) { state.zoom = Math.max(.4, Math.min(2.5, state.zoom * amount)); }
  viewport.addEventListener('wheel', (event) => { event.preventDefault(); zoom(Math.exp(-event.deltaY * .001)); }, { passive: false });
  viewport.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    if (event.shiftKey) {
      if (event.key === 'ArrowLeft') pan(-.04, 0);
      if (event.key === 'ArrowRight') pan(.04, 0);
      if (event.key === 'ArrowUp') pan(0, -.04);
      if (event.key === 'ArrowDown') pan(0, .04);
    } else {
      if (event.key === 'ArrowLeft') state.yaw += .1;
      if (event.key === 'ArrowRight') state.yaw -= .1;
      if (event.key === 'ArrowUp') state.pitch = Math.min(Math.PI / 2, state.pitch + .1);
      if (event.key === 'ArrowDown') state.pitch = Math.max(-Math.PI / 2, state.pitch - .1);
    }
    if (event.key === '+' || event.key === '=') zoom(1.1);
    if (event.key === '-') zoom(1 / 1.1);
  });
  $('density').addEventListener('input', () => { $('density-value').value = $('density').value; resize(); });
  $('light').addEventListener('input', () => { state.intensity = Number($('light').value); $('light-value').value = state.intensity.toFixed(1); });
  $('ambient').addEventListener('input', () => { state.ambient = Number($('ambient').value); $('ambient-value').value = state.ambient.toFixed(2); });
  $('contrast').addEventListener('input', () => { state.contrast = Number($('contrast').value); $('contrast-value').value = state.contrast.toFixed(1); });
  $('ramp').addEventListener('change', () => { state.ramp = ramps[$('ramp').value]; });
  $('mode').addEventListener('change', () => { state.mode = $('mode').value; });
  $('reset').addEventListener('click', reset);
  document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => {
    screen.style.color = button.dataset.color;
    screen.style.textShadow = `0 0 7px ${button.dataset.color}25`;
    document.querySelectorAll('.swatch').forEach(swatch => {
      const active = swatch === button;
      swatch.classList.toggle('active', active); swatch.setAttribute('aria-pressed', String(active));
    });
  }));
  $('copy').addEventListener('click', async () => {
    const text = screen.textContent;
    if (!text.trim()) {
      $('message').classList.add('error');
      $('message').textContent = 'No rendered text to copy yet.';
      return;
    }
    const button = $('copy');
    button.disabled = true;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Local files and HTTP browsers may need the legacy selection-based API.
        const selection = document.createElement('textarea');
        const focused = document.activeElement;
        selection.value = text;
        selection.className = 'clipboard-selection';
        selection.setAttribute('readonly', '');
        document.body.appendChild(selection);
        try {
          selection.select();
          if (!document.execCommand('copy')) throw new Error('Clipboard copying is unavailable.');
        } finally {
          selection.remove();
          if (focused) focused.focus({ preventScroll: true });
        }
      }
      $('message').classList.remove('error');
      $('message').textContent = 'Current ASCII frame copied to clipboard.';
    } catch (error) {
      $('message').classList.add('error');
      $('message').textContent = `Could not copy text. Check clipboard permissions or use Export .TXT. ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
  $('snapshot').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([screen.textContent], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'glyph-frame.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('rotate').checked = false;
  new ResizeObserver(resize).observe(viewport);
  registerProjectModels();
  resize();
  requestAnimationFrame(render);
})();
