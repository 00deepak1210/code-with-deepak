import * as THREE from 'three';

// Every texture on the can is painted at runtime on a 2D canvas, so the whole
// site ships without a single image asset.
//
// The label is laid out on a 2048 × 1024 "logical" canvas that wraps once
// around the can body. u = 0.5 faces the camera (front), u = 0.25 is the left
// side, u = 0.75 the right side and u = 0 / 1 the back.
export const LABEL_W = 2048;
export const LABEL_H = 1024;

const SANS = '"Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Bodoni Moda Variable", "Bodoni Moda", Didot, "Bodoni 72", Georgia, serif';

// Material map: G = roughness, B = metalness (three.js / glTF convention).
const MAT = {
  metal: 'rgb(0, 62, 255)', // bare brushed aluminium
  ink: 'rgb(0, 118, 26)', // opaque black ink
  accent: 'rgb(0, 80, 170)', // translucent coloured ink, metal shows through
  paper: 'rgb(0, 150, 0)', // white nutrition panel
};

export function seeded(seed) {
  // mulberry32
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function setFont(ctx, { style = 'normal', weight = 400, size, family = SANS, stretch = 'normal', spacing = 0 }) {
  ctx.font = `${style} ${weight} ${size}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
}

let brushed = null;
function brushedAluminium() {
  if (brushed) return brushed;
  brushed = makeCanvas(LABEL_W, LABEL_H);
  const ctx = brushed.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, LABEL_H);
  g.addColorStop(0, '#cdd1d5');
  g.addColorStop(0.5, '#e4e6e9');
  g.addColorStop(1, '#c8ccd0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  // Fine vertical striations left behind by the can-forming process.
  const rand = seeded(7);
  for (let x = 0; x < LABEL_W; x++) {
    const v = rand();
    if (v < 0.45) continue;
    ctx.fillStyle =
      v > 0.82 ? `rgba(255,255,255,${(rand() * 0.2).toFixed(3)})` : `rgba(80,86,94,${(rand() * 0.07).toFixed(3)})`;
    ctx.fillRect(x, 0, 1, LABEL_H);
  }
  return brushed;
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textOnCircle(ctx, text, cx, cy, radius, startAngle) {
  // Draws characters clockwise around a full circle, spacing them evenly so
  // the text closes up neatly (used for the round badge).
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const gap = (Math.PI * 2 * radius - total) / chars.length;
  let angle = startAngle;
  ctx.textAlign = 'center';
  chars.forEach((ch, i) => {
    const a = angle + widths[i] / 2 / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += (widths[i] + gap) / radius;
  });
}

// ---------------------------------------------------------------------------
// Label artwork. Drawn twice with the same code: once in colour and once as a
// roughness / metalness map, so ink and bare metal line up perfectly.
// ---------------------------------------------------------------------------
function drawLabel(ctx, flavor, mode) {
  const color = mode === 'color';
  const C = color
    ? {
        ink: '#0c0c0e',
        soft: 'rgba(12,12,14,0.72)',
        accent: flavor.label,
        paper: '#f7f7f4',
        metal: '#dfe2e5',
      }
    : { ink: MAT.ink, soft: MAT.ink, accent: MAT.accent, paper: MAT.paper, metal: MAT.metal };

  // Base
  if (color) ctx.drawImage(brushedAluminium(), 0, 0);
  else {
    ctx.fillStyle = MAT.metal;
    ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  }

  // Top & bottom rules with micro-text
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 46, LABEL_W, 4);
  ctx.fillRect(0, LABEL_H - 50, LABEL_W, 4);
  setFont(ctx, { weight: 650, size: 17, stretch: 'expanded', spacing: 5 });
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.soft;
  // Repeat a whole number of times so the band joins seamlessly at the back
  const micro = 'DIET COKE  ·  ZERO SUGAR  ·  ZERO CALORIES  ·  EST. 1982  ·  ';
  const reps = Math.ceil(LABEL_W / ctx.measureText(micro).width);
  const step = LABEL_W / reps;
  for (let i = 0; i <= reps; i++) {
    ctx.fillText(micro, i * step, 24, step);
    ctx.fillText(micro, i * step - step / 2, LABEL_H - 24, step);
  }

  drawFront(ctx, C, 1024);
  drawLeft(ctx, C, 512);
  drawRight(ctx, C, flavor, 1536);
  // The back straddles the seam, so draw it at both ends of the canvas.
  drawBack(ctx, C, 0);
  drawBack(ctx, C, LABEL_W);
}

function drawFront(ctx, C, cx) {
  const cy = LABEL_H / 2;
  const top = 50;
  const h = LABEL_H - 100;

  // Signature vertical stripe
  ctx.fillStyle = C.accent;
  ctx.fillRect(cx + 150, top, 86, h);
  ctx.fillStyle = C.ink;
  ctx.fillRect(cx + 250, top, 10, h);

  // Knock-out text inside the stripe (bare metal shows through)
  ctx.save();
  ctx.translate(cx + 193, cy);
  ctx.rotate(-Math.PI / 2);
  setFont(ctx, { weight: 700, size: 30, stretch: 'expanded', spacing: 12 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.metal;
  ctx.fillText('ZERO SUGAR  ·  ZERO CALORIES', 0, 2);
  ctx.restore();

  // Vertical lockup, reading bottom to top
  ctx.save();
  ctx.translate(cx - 6, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, { style: 'italic', weight: 800, size: 340, family: SERIF });
  const cokeW = ctx.measureText('Coke').width;
  const x0 = -cokeW / 2;
  ctx.fillStyle = C.accent;
  ctx.fillText('Coke', x0, 118);
  setFont(ctx, { weight: 800, size: 150, stretch: 'expanded', spacing: -2 });
  ctx.fillStyle = C.ink;
  ctx.fillText('diet', x0 + 26, -150);
  // fine rule + signature line under the lockup
  ctx.fillRect(x0 + 26, -116, cokeW - 40, 3);
  setFont(ctx, { weight: 600, size: 22, stretch: 'expanded', spacing: 8 });
  ctx.fillStyle = C.soft;
  ctx.fillText('EST. 1982', x0 + cokeW - 170, -150);
  ctx.restore();
}

function drawLeft(ctx, C, cx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  setFont(ctx, { weight: 900, size: 150, stretch: 'extra-condensed', spacing: 2 });
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.strokeText('ZERO', cx, 250);
  ctx.fillStyle = C.accent;
  ctx.fillText('SUGAR', cx, 400);

  ctx.fillStyle = C.ink;
  ctx.fillRect(cx - 150, 448, 300, 4);
  setFont(ctx, { weight: 600, size: 20, stretch: 'expanded', spacing: 7 });
  ctx.fillStyle = C.soft;
  ctx.fillText('ALL TASTE', cx, 492);
  ctx.fillStyle = C.ink;
  ctx.fillRect(cx - 150, 520, 300, 4);

  setFont(ctx, { weight: 900, size: 150, stretch: 'extra-condensed', spacing: 2 });
  ctx.strokeText('ZERO', cx, 690);
  ctx.fillStyle = C.accent;
  setFont(ctx, { weight: 900, size: 136, stretch: 'extra-condensed', spacing: 1 });
  ctx.fillText('CALORIES', cx, 830);

  setFont(ctx, { weight: 600, size: 19, stretch: 'expanded', spacing: 6 });
  ctx.fillStyle = C.soft;
  ctx.fillText('NO SUGAR · NO COMPROMISE', cx, 900);
}

function drawRight(ctx, C, flavor, cx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  setFont(ctx, { style: 'italic', weight: 700, size: 92, family: SERIF });
  ctx.fillStyle = C.accent;
  ctx.fillText(`N°${flavor.index}`, cx, 200);

  setFont(ctx, { weight: 900, size: 150, stretch: 'extra-condensed', spacing: 3 });
  ctx.fillStyle = C.ink;
  ctx.fillText(flavor.name.toUpperCase(), cx, 360);

  // Round caffeine badge
  const by = 590;
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  ctx.arc(cx, by, 140, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, by, 92, 0, Math.PI * 2);
  ctx.stroke();
  setFont(ctx, { weight: 700, size: 22, stretch: 'expanded', spacing: 3 });
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  textOnCircle(ctx, 'CAFFEINE · PER 12 FL OZ · ZERO SUGAR · ', cx, by, 116, -Math.PI / 2);
  setFont(ctx, { weight: 900, size: 92, stretch: 'extra-condensed' });
  ctx.fillStyle = C.accent;
  ctx.fillText('46', cx, by - 8);
  setFont(ctx, { weight: 700, size: 24, stretch: 'expanded', spacing: 6 });
  ctx.fillStyle = C.ink;
  ctx.fillText('MG', cx + 4, by + 48);

  ctx.textBaseline = 'alphabetic';
  setFont(ctx, { weight: 700, size: 30, stretch: 'expanded', spacing: 6 });
  ctx.fillText('12 FL OZ (355 mL)', cx, 850);
  setFont(ctx, { weight: 500, size: 19, stretch: 'expanded', spacing: 5 });
  ctx.fillStyle = C.soft;
  ctx.fillText('SERVE ICE COLD', cx, 900);
}

function drawBack(ctx, C, cx) {
  ctx.save();
  ctx.translate(cx, 0);
  ctx.textBaseline = 'alphabetic';

  // Nutrition panel
  const x = -238;
  const w = 256;
  const y = 150;
  const h = 640;
  ctx.fillStyle = C.paper;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

  const px = x + 16;
  const pw = w - 32;
  let cy = y + 58;
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  setFont(ctx, { weight: 900, size: 46, stretch: 'condensed' });
  ctx.fillText('Nutrition Facts', px, cy);
  cy += 34;
  setFont(ctx, { weight: 500, size: 21 });
  ctx.fillText('Serving size  1 can', px, cy);
  cy += 16;
  ctx.fillRect(px, cy, pw, 12);
  cy += 38;
  setFont(ctx, { weight: 800, size: 17 });
  ctx.fillText('Amount per serving', px, cy);
  cy += 52;
  setFont(ctx, { weight: 900, size: 46, stretch: 'condensed' });
  ctx.fillText('Calories', px, cy);
  ctx.textAlign = 'right';
  setFont(ctx, { weight: 900, size: 62, stretch: 'condensed' });
  ctx.fillText('0', px + pw, cy + 4);
  cy += 18;
  ctx.fillRect(px, cy, pw, 7);
  cy += 30;
  setFont(ctx, { weight: 800, size: 16 });
  ctx.fillText('% Daily Value*', px + pw, cy);

  const rows = [
    ['Total Fat 0g', '0%', true],
    ['Sodium 40mg', '2%', true],
    ['Total Carb. 0g', '0%', true],
    ['   Total Sugars 0g', '', false],
    ['Protein 0g', '', true],
  ];
  for (const [label, dv, bold] of rows) {
    cy += 8;
    ctx.fillRect(px, cy, pw, 2);
    cy += 32;
    ctx.textAlign = 'left';
    setFont(ctx, { weight: bold ? 800 : 500, size: 21 });
    ctx.fillText(label, px, cy);
    ctx.textAlign = 'right';
    setFont(ctx, { weight: 800, size: 21 });
    if (dv) ctx.fillText(dv, px + pw, cy);
  }
  cy += 14;
  ctx.fillRect(px, cy, pw, 12);
  cy += 34;
  ctx.textAlign = 'left';
  setFont(ctx, { weight: 500, size: 14 });
  for (const line of wrapLines(ctx, '*Not a significant source of other nutrients.', pw)) {
    ctx.fillText(line, px, cy);
    cy += 19;
  }

  // Ingredients
  ctx.textAlign = 'left';
  setFont(ctx, { weight: 500, size: 18, spacing: 0.5 });
  ctx.fillStyle = C.ink;
  let iy = 176;
  const ingredients =
    'INGREDIENTS: CARBONATED WATER, CARAMEL COLOR, ASPARTAME, PHOSPHORIC ACID, POTASSIUM BENZOATE (TO PROTECT TASTE), NATURAL FLAVORS, CITRIC ACID, CAFFEINE.';
  for (const line of wrapLines(ctx, ingredients, 196)) {
    ctx.fillText(line, 40, iy);
    iy += 25;
  }
  iy += 10;
  setFont(ctx, { weight: 800, size: 18, spacing: 0.5 });
  for (const line of wrapLines(ctx, 'PHENYLKETONURICS: CONTAINS PHENYLALANINE.', 196)) {
    ctx.fillText(line, 40, iy);
    iy += 25;
  }

  // Decorative barcode (not a real code)
  const rand = seeded(1982);
  let bx = 44;
  const by = 590;
  while (bx < 228) {
    const bw = 2 + Math.floor(rand() * 4);
    ctx.fillRect(bx, by, bw, 104);
    bx += bw + 2 + Math.floor(rand() * 4);
  }
  setFont(ctx, { weight: 600, size: 17, spacing: 4 });
  ctx.fillText('0 12345 67890 5', 44, by + 128);

  setFont(ctx, { weight: 700, size: 17, stretch: 'expanded', spacing: 3 });
  ctx.fillText('CAFFEINE 46MG/12 FL OZ', 40, 770);

  // Recycling loop
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  ctx.arc(62, 822, 18, 0.4, Math.PI * 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(74, 800);
  ctx.lineTo(86, 812);
  ctx.lineTo(70, 818);
  ctx.closePath();
  ctx.fill();
  setFont(ctx, { weight: 700, size: 17, stretch: 'expanded', spacing: 3 });
  ctx.fillText('PLEASE RECYCLE', 92, 828);

  setFont(ctx, { weight: 500, size: 15, stretch: 'expanded', spacing: 2 });
  ctx.fillStyle = C.soft;
  ctx.fillText('FAN CONCEPT · NOT A REAL PRODUCT', -238, 838);

  ctx.restore();
}

function paintLabel(flavor, mode, size) {
  const scale = size / LABEL_W;
  const canvas = makeCanvas(size, size / 2);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawLabel(ctx, flavor, mode);
  return canvas;
}

export function createLabelTexture(flavor, size, anisotropy) {
  const tex = new THREE.CanvasTexture(paintLabel(flavor, 'color', size));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createLabelMaterialTexture(flavor, size, anisotropy) {
  const tex = new THREE.CanvasTexture(paintLabel(flavor, 'material', size));
  tex.anisotropy = anisotropy;
  return tex;
}

// ---------------------------------------------------------------------------
// Lid: a height map with the rivet, the opening score and reinforcing beads.
// The lid disc is mapped planar, canvas bottom = front of the can (+z).
// ---------------------------------------------------------------------------
export function mouthOutline(ctx, toPx) {
  // Same outline as the 3D mouth shape in Can.js (lid units, z towards viewer)
  const p = (x, z) => toPx(x, z);
  ctx.beginPath();
  ctx.moveTo(...p(0, 0.17));
  ctx.bezierCurveTo(...p(0.13, 0.17), ...p(0.26, 0.4), ...p(0.23, 0.55));
  ctx.bezierCurveTo(...p(0.21, 0.665), ...p(-0.21, 0.665), ...p(-0.23, 0.55));
  ctx.bezierCurveTo(...p(-0.26, 0.4), ...p(-0.13, 0.17), ...p(0, 0.17));
  ctx.closePath();
}

export function createLidTexture(radius) {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const toPx = (x, z) => [size / 2 + (x / radius) * (size / 2), size / 2 + (z / radius) * (size / 2)];

  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);

  const ring = (r, width, shade, blur = 4) => {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = shade;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (r / radius) * (size / 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  ring(0.74, 10, 'rgb(175,175,175)', 5);
  ring(0.69, 4, 'rgb(95,95,95)', 2);

  // Raised bead around the opening (the outline scaled about its centroid)
  const [mx, my] = toPx(0, 0.42);
  ctx.save();
  ctx.filter = 'blur(6px)';
  ctx.strokeStyle = 'rgb(190,190,190)';
  ctx.lineWidth = 16;
  ctx.translate(mx, my);
  ctx.scale(1.16, 1.14);
  ctx.translate(-mx, -my);
  mouthOutline(ctx, toPx);
  ctx.stroke();
  ctx.restore();

  // Score line
  ctx.save();
  ctx.filter = 'blur(1px)';
  ctx.strokeStyle = 'rgb(60,60,60)';
  ctx.lineWidth = 3;
  mouthOutline(ctx, toPx);
  ctx.stroke();
  ctx.restore();

  // Rivet
  const [rx, ry] = toPx(0, 0);
  const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, 26);
  g.addColorStop(0, 'rgb(220,220,220)');
  g.addColorStop(0.6, 'rgb(170,170,170)');
  g.addColorStop(1, 'rgb(128,128,128)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(rx, ry, 26, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ---------------------------------------------------------------------------
// Condensation: thousands of droplets rendered into a height field, then
// converted into a tangent-space normal map.
// ---------------------------------------------------------------------------
export function createCondensationTexture(w = 1024, h = 512) {
  const height = new Float32Array(w * h);
  const rand = seeded(42);

  const stamp = (cx, cy, r, stretch) => {
    const ry = r * stretch;
    const x0 = Math.floor(cx - r - 1);
    const x1 = Math.ceil(cx + r + 1);
    const y0 = Math.max(0, Math.floor(cy - ry - 1));
    const y1 = Math.min(h - 1, Math.ceil(cy + ry + 1));
    for (let y = y0; y <= y1; y++) {
      const dy = (y - cy) / ry;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const v = Math.sqrt(1 - d2) * Math.min(r, 6) * 0.42;
        const idx = y * w + (((x % w) + w) % w);
        if (v > height[idx]) height[idx] = v;
      }
    }
  };

  // A fine mist of tiny beads...
  for (let i = 0; i < 2200; i++) stamp(rand() * w, rand() * h, 0.8 + rand() * 1.6, 1);
  // ...scattered larger drops...
  for (let i = 0; i < 420; i++) {
    const r = 2.5 + Math.pow(rand(), 2) * 8;
    stamp(rand() * w, rand() * h, r, 1 + rand() * 0.35);
  }
  // ...and a few drips running down the can
  for (let i = 0; i < 10; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.6;
    const len = 60 + rand() * 160;
    const r = 2.5 + rand() * 2.5;
    for (let t = 0; t < len; t += 2) {
      stamp(x + Math.sin(t * 0.05) * 1.5, y + t, r * (0.7 + 0.3 * (t / len)), 1);
    }
    stamp(x, y + len, r * 1.6, 1.3);
  }

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w;
    const down = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      const l = height[y * w + ((x - 1 + w) % w)];
      const r = height[y * w + ((x + 1) % w)];
      const u = height[up + x];
      const dn = height[down + x];
      let nx = l - r;
      let ny = dn - u;
      let nz = 2.2;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

export function createShadowTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cola foam: a tan base packed with tiny bubbles.
export function createFoamTexture() {
  const canvas = makeCanvas(512, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b38459';
  ctx.fillRect(0, 0, 512, 256);
  const rand = seeded(9);
  for (let i = 0; i < 3200; i++) {
    const x = rand() * 512;
    const y = rand() * 256;
    const r = 1.2 + Math.pow(rand(), 3) * 7;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,246,232,0.95)');
    g.addColorStop(0.55, 'rgba(228,196,158,0.85)');
    g.addColorStop(1, 'rgba(110,70,40,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}
