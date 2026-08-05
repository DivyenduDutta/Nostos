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
    mode = "alpha",
    luminanceGamma = 1,
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
