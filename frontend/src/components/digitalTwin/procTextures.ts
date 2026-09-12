// Procedural texture factory for the PowerWorker digital twin.
// Everything is drawn once to an offscreen <canvas> and wrapped in a
// THREE.CanvasTexture — no external image files, so the app runs fully offline.
// Callers MUST memoize the result and dispose it on unmount. House textures are
// heavy-reuse (50 instances) and are therefore reference-counted below.

import * as THREE from 'three';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function createCanvasCtx(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for procedural texture');
  }
  return { canvas, ctx };
}

// Scatter faint monochrome grain so flat PBR surfaces catch the light unevenly.
function drawNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  maxAlpha: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * maxAlpha})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

function finishTexture(
  canvas: HTMLCanvasElement,
  repeat: number,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  if (repeat > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Deep-navy HUD floor: fine cyan tech grid, faint grain and a soft vignette so
// the plane reads as a lit surface rather than a flat fill.
export function makeGroundTexture(): THREE.CanvasTexture {
  const size = 1024;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#0a1220';
  ctx.fillRect(0, 0, size, size);

  drawNoise(ctx, size, 6000, 0.05);

  // Fine grid.
  ctx.strokeStyle = 'rgba(34,211,238,0.05)';
  ctx.lineWidth = 1;
  for (let p = 0; p <= size; p += 16) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  // Bolder major grid every 8 cells.
  ctx.strokeStyle = 'rgba(56,189,248,0.12)';
  ctx.lineWidth = 1.5;
  for (let p = 0; p <= size; p += 128) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Vignette to focus the centre of the community.
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.15,
    size / 2,
    size / 2,
    size * 0.72,
  );
  grad.addColorStop(0, 'rgba(6,10,20,0)');
  grad.addColorStop(1, 'rgba(3,6,14,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return finishTexture(canvas, 1);
}

// Textured asphalt for the road strips: dark slate with directional grain.
export function makeAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#0d1626';
  ctx.fillRect(0, 0, size, size);
  drawNoise(ctx, size, 4200, 0.08);

  // A couple of faint longitudinal scuff lines.
  ctx.strokeStyle = 'rgba(56,189,248,0.04)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 20, size);
    ctx.stroke();
  }

  return finishTexture(canvas, 2);
}

function windowRects(size: number): Rect[] {
  const cols = 3;
  const rows = 2;
  const w = size * 0.17;
  const h = size * 0.19;
  const gapX = (size - cols * w) / (cols + 1);
  const gapY = size * 0.12;
  const top = size * 0.22;
  const rects: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rects.push({
        x: gapX + c * (w + gapX),
        y: top + r * (h + gapY),
        w,
        h,
      });
    }
  }
  return rects;
}

// House facade albedo: dark panel base, subtle horizontal cladding seams and
// recessed window frames. Paired with the emissive-window map below so the
// windows glow in the per-house energy-source colour.
export function makeWallTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#141d30';
  ctx.fillRect(0, 0, size, size);
  drawNoise(ctx, size, 1400, 0.06);

  // Horizontal cladding seams.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= size; y += size / 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Recessed window frames.
  for (const r of windowRects(size)) {
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(56,189,248,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    // Mullion cross.
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2, r.y);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    ctx.moveTo(r.x, r.y + r.h / 2);
    ctx.lineTo(r.x + r.w, r.y + r.h / 2);
    ctx.stroke();
  }

  return finishTexture(canvas, 1);
}

// White window panes on black -> used as emissiveMap so only the windows emit,
// tinted by the material's emissive colour (energy source).
export function makeWindowEmissiveTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  for (const r of windowRects(size)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    // Darken the mullions so panes read as separate lights.
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2, r.y);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    ctx.moveTo(r.x, r.y + r.h / 2);
    ctx.lineTo(r.x + r.w, r.y + r.h / 2);
    ctx.stroke();
  }

  return finishTexture(canvas, 1, THREE.NoColorSpace);
}

// Darker rough roof slab with panel seams and a small rooftop vent block.
export function makeRoofTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#0b1322';
  ctx.fillRect(0, 0, size, size);
  drawNoise(ctx, size, 2000, 0.09);

  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let p = 0; p <= size; p += size / 6) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Vent block + faint cyan trim.
  ctx.fillStyle = '#0e1a2b';
  ctx.fillRect(size * 0.6, size * 0.55, size * 0.28, size * 0.24);
  ctx.strokeStyle = 'rgba(34,211,238,0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(size * 0.6, size * 0.55, size * 0.28, size * 0.24);

  return finishTexture(canvas, 1);
}

// PV cell grid: dark glass with fine cyan cell borders and busbar lines.
export function makeSolarCellTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#04121a';
  ctx.fillRect(0, 0, size, size);

  const cells = 6;
  const step = size / cells;
  ctx.strokeStyle = 'rgba(34,211,238,0.22)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= cells; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Per-cell diagonal glare + darker corners for a monocrystalline look.
  ctx.fillStyle = 'rgba(56,189,248,0.05)';
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      ctx.beginPath();
      ctx.moveTo(c * step, r * step);
      ctx.lineTo(c * step + step, r * step);
      ctx.lineTo(c * step, r * step + step);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Horizontal busbars.
  ctx.strokeStyle = 'rgba(226,241,255,0.10)';
  ctx.lineWidth = 2;
  for (let i = 1; i < cells; i++) {
    const y = i * step;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  return finishTexture(canvas, 1);
}

// Vertical metallic ribs for the battery caps/bands (wrapped around cylinders).
export function makeBatteryRibTexture(): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = createCanvasCtx(size, size);

  const ribs = 10;
  const step = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const grad = ctx.createLinearGradient(i * step, 0, (i + 1) * step, 0);
    grad.addColorStop(0, '#161616');
    grad.addColorStop(0.5, '#3a3a3a');
    grad.addColorStop(1, '#161616');
    ctx.fillStyle = grad;
    ctx.fillRect(i * step, 0, step, size);
  }
  drawNoise(ctx, size, 800, 0.05);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 1);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// EV parking bay: dark asphalt with a violet painted stall outline + charge glyph.
export function makeEVBayTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvasCtx(size, size);

  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, size, size);
  drawNoise(ctx, size, 2600, 0.07);

  // Painted stall outline.
  ctx.strokeStyle = 'rgba(167,139,250,0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(size * 0.14, size * 0.08, size * 0.72, size * 0.84);

  // Charge glyph (lightning bolt) near the head of the bay.
  ctx.fillStyle = 'rgba(167,139,250,0.6)';
  ctx.beginPath();
  ctx.moveTo(size * 0.54, size * 0.22);
  ctx.lineTo(size * 0.44, size * 0.44);
  ctx.lineTo(size * 0.52, size * 0.44);
  ctx.lineTo(size * 0.46, size * 0.62);
  ctx.lineTo(size * 0.6, size * 0.38);
  ctx.lineTo(size * 0.52, size * 0.38);
  ctx.closePath();
  ctx.fill();

  return finishTexture(canvas, 1);
}

// ---- Shared, reference-counted house textures (reused by all 50 houses) ----

export interface HouseTextures {
  wall: THREE.CanvasTexture;
  windows: THREE.CanvasTexture;
  roof: THREE.CanvasTexture;
}

let houseCache: HouseTextures | null = null;
let houseRefs = 0;

export function acquireHouseTextures(): HouseTextures {
  if (!houseCache) {
    houseCache = {
      wall: makeWallTexture(),
      windows: makeWindowEmissiveTexture(),
      roof: makeRoofTexture(),
    };
  }
  houseRefs += 1;
  return houseCache;
}

export function releaseHouseTextures(): void {
  houseRefs -= 1;
  if (houseRefs <= 0 && houseCache) {
    houseCache.wall.dispose();
    houseCache.windows.dispose();
    houseCache.roof.dispose();
    houseCache = null;
    houseRefs = 0;
  }
}
