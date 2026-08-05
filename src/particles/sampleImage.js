function boxBlur(src, width, height) {
  const dst = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += src[yy * width + xx];
          count++;
        }
      }
      dst[y * width + x] = sum / count;
    }
  }
  return dst;
}

// Samples a rendered image into a sparse point cloud: pixel position -> 3D
// position, pixel color -> vertex color. `drawSource` is either an
// HTMLImageElement (drawn as-is) or a function (ctx, width, height) that
// paints the source content itself — useful before real artwork exists.
export function sampleImageToPoints(
  drawSource,
  {
    width = 512,
    height = 512,
    maxPoints = 6000,
    alphaThreshold = 128,
    // "alpha": keep pixels above alphaThreshold (transparent PNGs, drawn text).
    // "luminance": keep pixels with probability ~ brightness (opaque photos/JPEGs).
    // "edge": keep pixels with probability ~ local gradient magnitude, so
    // particles concentrate on contours/outlines instead of flat brightness
    // — reads as a recognizable shape instead of a brightness-weighted dust
    // field. `edgeFillWeight` optionally adds a little luminance-based fill
    // so it isn't a pure wireframe.
    mode = "alpha",
    luminanceGamma = 1,
    edgeGamma = 1,
    edgeFillWeight = 0.12,
    edgeBlurPasses = 2,
  } = {}
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (typeof drawSource === "function") {
    drawSource(ctx, width, height);
  } else {
    ctx.drawImage(drawSource, 0, 0, width, height);
  }

  const { data } = ctx.getImageData(0, 0, width, height);

  const candidates = [];

  if (mode === "edge") {
    let luminance = new Float32Array(width * height);
    for (let p = 0; p < width * height; p++) {
      const i = p * 4;
      luminance[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    }

    // Blur before edge detection so fine paper-grain/texture noise doesn't
    // compete with the bold shape outlines we actually want.
    for (let pass = 0; pass < edgeBlurPasses; pass++) {
      luminance = boxBlur(luminance, width, height);
    }

    // Sobel gradient magnitude per pixel (borders left at 0 — negligible).
    const gradient = new Float32Array(width * height);
    let maxGradient = 0;
    for (let py = 1; py < height - 1; py++) {
      for (let px = 1; px < width - 1; px++) {
        const p = py * width + px;
        const tl = luminance[p - width - 1];
        const t = luminance[p - width];
        const tr = luminance[p - width + 1];
        const l = luminance[p - 1];
        const r = luminance[p + 1];
        const bl = luminance[p + width - 1];
        const b = luminance[p + width];
        const br = luminance[p + width + 1];

        const gx = tr + 2 * r + br - (tl + 2 * l + bl);
        const gy = bl + 2 * b + br - (tl + 2 * t + tr);
        const mag = Math.hypot(gx, gy);
        gradient[p] = mag;
        if (mag > maxGradient) maxGradient = mag;
      }
    }

    for (let py = 1; py < height - 1; py++) {
      for (let px = 1; px < width - 1; px++) {
        const p = py * width + px;
        const edgeStrength = maxGradient > 0 ? gradient[p] / maxGradient : 0;
        const probability =
          Math.pow(edgeStrength, edgeGamma) + edgeFillWeight * Math.pow(luminance[p], luminanceGamma);
        if (Math.random() < probability) {
          candidates.push(p * 4);
        }
      }
    }
  } else {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const i = (py * width + px) * 4;
        if (mode === "luminance") {
          const luminance = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          if (Math.random() < Math.pow(luminance, luminanceGamma)) {
            candidates.push(i);
          }
        } else if (data[i + 3] >= alphaThreshold) {
          candidates.push(i);
        }
      }
    }
  }

  // Random subsample (rather than truncate) so the shape stays evenly
  // covered even when candidates outnumber maxPoints.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const selected = candidates.slice(0, maxPoints);

  const count = selected.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  selected.forEach((i, n) => {
    const pixelIndex = i / 4;
    const px = pixelIndex % width;
    const py = Math.floor(pixelIndex / width);

    // Normalized to [-1, 1] on x/y, centered; caller scales to world units.
    positions[n * 3] = (px / width - 0.5) * 2;
    positions[n * 3 + 1] = -(py / height - 0.5) * 2;
    positions[n * 3 + 2] = (Math.random() - 0.5) * 0.15;

    colors[n * 3] = data[i] / 255;
    colors[n * 3 + 1] = data[i + 1] / 255;
    colors[n * 3 + 2] = data[i + 2] / 255;
  });

  return { positions, colors, count };
}
