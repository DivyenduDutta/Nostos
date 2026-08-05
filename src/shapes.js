import { sampleImageToPoints } from "./particles/sampleImage.js";

const CANVAS_SIZE = 600;

function drawShip(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "#e8dcc4";

  // hull
  ctx.beginPath();
  ctx.moveTo(cx - 170, cy + 60);
  ctx.quadraticCurveTo(cx, cy + 115, cx + 170, cy + 60);
  ctx.quadraticCurveTo(cx, cy + 82, cx - 170, cy + 60);
  ctx.fill();

  // mast
  ctx.fillRect(cx - 5, cy - 190, 10, 250);

  // sail
  ctx.beginPath();
  ctx.moveTo(cx, cy - 175);
  ctx.lineTo(cx + 135, cy + 40);
  ctx.lineTo(cx, cy + 40);
  ctx.closePath();
  ctx.fill();
}

function drawEye(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = "#e8dcc4";
  ctx.fillStyle = "#e8dcc4";

  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 220, 130, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(cx - 210, cy - 155);
  ctx.quadraticCurveTo(cx, cy - 235, cx + 210, cy - 155);
  ctx.stroke();
}

function drawSpiral(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = "#e8dcc4";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";

  const turns = 4.5;
  const maxR = 235;
  ctx.beginPath();
  for (let a = 0; a <= turns * Math.PI * 2; a += 0.04) {
    const r = (a / (turns * Math.PI * 2)) * maxR;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawHome(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "#e8dcc4";

  // roof
  ctx.beginPath();
  ctx.moveTo(cx - 210, cy - 10);
  ctx.lineTo(cx, cy - 195);
  ctx.lineTo(cx + 210, cy - 10);
  ctx.lineTo(cx + 155, cy - 10);
  ctx.lineTo(cx, cy - 145);
  ctx.lineTo(cx - 155, cy - 10);
  ctx.closePath();
  ctx.fill();

  // walls
  ctx.fillRect(cx - 155, cy - 10, 310, 185);

  // doorway cutout
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(cx - 32, cy + 60, 64, 115);
  ctx.restore();
}

const SHAPE_DEFS = [
  { name: "The Voyage", draw: drawShip },
  { name: "The Cyclops", draw: drawEye },
  { name: "Scylla & Charybdis", draw: drawSpiral },
  { name: "Ithaca", draw: drawHome },
];

// Pads/duplicates (with a little jitter) up to `target` particles so every
// shape has exactly the same particle count — required for a clean
// per-particle morph between shapes of very different silhouette area.
function padToCount(positions, count, target) {
  const out = new Float32Array(target * 3);
  out.set(positions);
  for (let i = count; i < target; i++) {
    const srcIndex = Math.floor(Math.random() * count);
    const ix = i * 3;
    const srcIx = srcIndex * 3;
    out[ix] = positions[srcIx] + (Math.random() - 0.5) * 0.02;
    out[ix + 1] = positions[srcIx + 1] + (Math.random() - 0.5) * 0.02;
    out[ix + 2] = positions[srcIx + 2] + (Math.random() - 0.5) * 0.02;
  }
  return out;
}

export function buildShapes(count) {
  return SHAPE_DEFS.map(({ name, draw }) => {
    const { positions, count: sampledCount } = sampleImageToPoints(draw, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      maxPoints: count,
      mode: "alpha",
      alphaThreshold: 100,
    });
    return { name, positions: padToCount(positions, sampledCount, count) };
  });
}
