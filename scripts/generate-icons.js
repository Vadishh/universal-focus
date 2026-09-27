/**
 * generate-icons.js
 * Generates PNG icons at 16, 32, 48, 128 px from scratch.
 * Design: dark rounded-rect background + electric-lime reticle (crosshair arms +
 * corner brackets + centre ring + centre dot).  Pure Node — no native deps.
 */

const fs   = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

/* ── PNG encoder ────────────────────────────────────────────── */
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const tb  = Buffer.from(type);
  const body = Buffer.concat([tb, data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(pixels, size) {
  const rows = [];
  const row  = size * 4;
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]));          // filter byte
    rows.push(pixels.subarray(y * row, (y + 1) * row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;             // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/* ── Drawing helpers ─────────────────────────────────────────── */
function setPixel(pixels, size, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (Math.round(y) * size + Math.round(x)) * 4;
  // Alpha-blend onto existing pixel
  const sa = a / 255;
  const da = pixels[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) { pixels[i + 3] = 0; return; }
  pixels[i]     = Math.round((r * sa + pixels[i]     * da * (1 - sa)) / oa);
  pixels[i + 1] = Math.round((g * sa + pixels[i + 1] * da * (1 - sa)) / oa);
  pixels[i + 2] = Math.round((b * sa + pixels[i + 2] * da * (1 - sa)) / oa);
  pixels[i + 3] = Math.round(oa * 255);
}

/** Anti-aliased line via Wu's algorithm */
function drawLine(pixels, size, x0, y0, x1, y1, r, g, b, thick) {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
  if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
  const dx = x1 - x0, dy = y1 - y0;
  const grad = dx === 0 ? 1 : dy / dx;
  let iy = y0;
  const half = thick / 2;
  for (let x = x0; x <= x1; x++) {
    for (let t = -half; t <= half; t += 0.5) {
      const y = iy + t;
      const alpha = Math.max(0, 255 - Math.abs(t) * (255 / half) * 0.5);
      if (steep) setPixel(pixels, size, y, x, r, g, b, alpha);
      else        setPixel(pixels, size, x, y, r, g, b, alpha);
    }
    iy += grad;
  }
}

/** Anti-aliased circle (ring) */
function drawRing(pixels, size, cx, cy, radius, thick, r, g, b) {
  const half = thick / 2;
  const steps = Math.ceil(2 * Math.PI * radius * 4);
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    setPixel(pixels, size, px, py, r, g, b, 255);
    if (thick > 1) {
      setPixel(pixels, size, px + Math.cos(angle) * half * 0.6,
               py + Math.sin(angle) * half * 0.6, r, g, b, 220);
      setPixel(pixels, size, px - Math.cos(angle) * half * 0.6,
               py - Math.sin(angle) * half * 0.6, r, g, b, 220);
    }
  }
}

/** Filled circle */
function drawDisc(pixels, size, cx, cy, radius, r, g, b) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= radius) {
        const a = d > radius - 1 ? Math.round((radius - d) * 255) : 255;
        setPixel(pixels, size, x, y, r, g, b, a);
      }
    }
  }
}

/* ── Rounded-rect background mask ───────────────────────────── */
function drawRoundedBg(pixels, size, rr) {
  const bg  = [8, 10, 9];    // #080a09
  const pad = size * 0.05;   // small padding from edge
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rx = x - pad, ry = y - pad;
      const rw = size - pad * 2, rh = size - pad * 2;
      const qx = Math.max(0, Math.abs(rx - rw / 2) - (rw / 2 - rr));
      const qy = Math.max(0, Math.abs(ry - rh / 2) - (rh / 2 - rr));
      const dist = Math.hypot(qx, qy) - rr;
      if (dist < 0.5) {
        const a = dist < -0.5 ? 255 : Math.round((0.5 - dist) * 255);
        setPixel(pixels, size, x, y, bg[0], bg[1], bg[2], a);
      }
    }
  }
}

/* ── Main icon renderer ─────────────────────────────────────── */
function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  const c  = size / 2;            // centre
  const rr = size * 0.24;         // corner radius

  // 1. Dark background
  drawRoundedBg(pixels, size, rr);

  if (size <= 16) {
    // Simplified for tiny sizes: just a crosshair + disc
    const arm = size * 0.18;
    const t   = Math.max(1, size * 0.09);
    drawLine(pixels, size, c, c - arm - 2, c, c - arm * 0.2, 183, 255, 60, t);
    drawLine(pixels, size, c, c + arm * 0.2, c, c + arm + 2, 183, 255, 60, t);
    drawLine(pixels, size, c - arm - 2, c, c - arm * 0.2, c, 183, 255, 60, t);
    drawLine(pixels, size, c + arm * 0.2, c, c + arm + 2, c, 183, 255, 60, t);
    drawDisc(pixels, size, c, c, size * 0.08, 183, 255, 60);
    return encodePNG(pixels, size);
  }

  const lineThick   = Math.max(1.5, size * 0.038);
  const bracketThick = Math.max(1.2, size * 0.032);
  const ringR       = size * 0.115;
  const ringThick   = Math.max(1.2, size * 0.022);
  const discR       = size * 0.048;
  const armInner    = size * 0.155;   // gap start (near centre)
  const armOuter    = size * 0.355;   // arm end
  const bktOuter    = size * 0.38;    // bracket corner
  const bktLen      = size * 0.115;   // bracket arm length
  const margin      = size * 0.09;    // bracket offset from edge

  // Lime colour: #b7ff3c = 183,255,60
  const [lr, lg, lb] = [183, 255, 60];
  // Dimmer lime for brackets: ~70%
  const [br, bg_, bb] = [128, 200, 42];

  // 2. Crosshair arms (4 segments, leaving gap around centre)
  drawLine(pixels, size, c, c - armOuter, c, c - armInner, lr, lg, lb, lineThick);
  drawLine(pixels, size, c, c + armInner, c, c + armOuter, lr, lg, lb, lineThick);
  drawLine(pixels, size, c - armOuter, c, c - armInner, c, lr, lg, lb, lineThick);
  drawLine(pixels, size, c + armInner, c, c + armOuter, c, lr, lg, lb, lineThick);

  // 3. Corner brackets (L-shapes at 4 corners)
  const corners = [
    { sx: c - bktOuter, sy: c - bktOuter, dx: 1, dy: 1 },   // top-left
    { sx: c + bktOuter, sy: c - bktOuter, dx: -1, dy: 1 },   // top-right
    { sx: c - bktOuter, sy: c + bktOuter, dx: 1, dy: -1 },   // bottom-left
    { sx: c + bktOuter, sy: c + bktOuter, dx: -1, dy: -1 }   // bottom-right
  ];
  for (const { sx, sy, dx, dy } of corners) {
    // horizontal arm
    drawLine(pixels, size, sx, sy, sx + dx * bktLen, sy, br, bg_, bb, bracketThick);
    // vertical arm
    drawLine(pixels, size, sx, sy, sx, sy + dy * bktLen, br, bg_, bb, bracketThick);
  }

  // 4. Centre ring
  drawRing(pixels, size, c, c, ringR, ringThick, lr, lg, lb);

  // 5. Centre dot
  drawDisc(pixels, size, c, c, discR, lr, lg, lb);

  return encodePNG(pixels, size);
}

/* ── Output ─────────────────────────────────────────────────── */
const out = path.join(__dirname, "..", "assets");
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(out, `icon${size}.png`), renderIcon(size));
  console.log(`✓ icon${size}.png`);
}
console.log("Icons generated.");
