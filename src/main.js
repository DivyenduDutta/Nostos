import * as THREE from "three";
import { sampleImageToPoints } from "./particles/sampleImage.js";

// Served as-is from Vite's public/ dir — do not import this as a module.
const odysseyImageUrl = "/assets/Nolan_Odeyssey.jpg";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

const image = new Image();
image.src = odysseyImageUrl;
image.onload = () => {
  const aspect = image.naturalWidth / image.naturalHeight;
  const sampleHeight = 640;
  const sampleWidth = Math.round(sampleHeight * aspect);

  // Photo has no alpha channel, so density follows brightness instead:
  // bright areas (sky, the gilded spine) get more particles, the near-black
  // helmet/hair silhouette stays sparse.
  const { positions: sampled, colors: sampledColors, count: COUNT } = sampleImageToPoints(
    image,
    {
      width: sampleWidth,
      height: sampleHeight,
      maxPoints: 14000,
      mode: "luminance",
      luminanceGamma: 1.2,
    }
  );

  // Fit the sampled shape inside the camera frustum at z=0 (contain-style),
  // so it's never clipped regardless of image orientation or window aspect.
  const distanceToOrigin = camera.position.z;
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distanceToOrigin;
  const visibleWidth = visibleHeight * camera.aspect;
  const fitPadding = 0.85;

  let WORLD_SCALE_Y = (visibleHeight / 2) * fitPadding;
  let WORLD_SCALE_X = WORLD_SCALE_Y * aspect;
  if (WORLD_SCALE_X > (visibleWidth / 2) * fitPadding) {
    WORLD_SCALE_X = (visibleWidth / 2) * fitPadding;
    WORLD_SCALE_Y = WORLD_SCALE_X / aspect;
  }

  const targetPositions = new Float32Array(COUNT * 3);
  const startPositions = new Float32Array(COUNT * 3);
  const positions = new Float32Array(COUNT * 3);
  const distFromCenter = new Float32Array(COUNT);

  let maxDist = 0;
  for (let i = 0; i < COUNT; i++) {
    const ix = i * 3;

    targetPositions[ix] = sampled[ix] * WORLD_SCALE_X;
    targetPositions[ix + 1] = sampled[ix + 1] * WORLD_SCALE_Y;
    targetPositions[ix + 2] = sampled[ix + 2];

    startPositions[ix] = (Math.random() - 0.5) * 20;
    startPositions[ix + 1] = (Math.random() - 0.5) * 20;
    startPositions[ix + 2] = (Math.random() - 0.5) * 20;

    positions[ix] = startPositions[ix];
    positions[ix + 1] = startPositions[ix + 1];
    positions[ix + 2] = startPositions[ix + 2];

    const d = Math.hypot(targetPositions[ix], targetPositions[ix + 1]);
    distFromCenter[i] = d;
    if (d > maxDist) maxDist = d;
  }

  // Stagger each particle's reveal by how far it sits from the shape's
  // center (plus jitter) so the image assembles outward instead of
  // popping in as one flat wave, and give it a per-particle drift so it
  // keeps breathing gently once settled.
  const RADIAL_DELAY_SPREAD = 1.1;
  const RANDOM_DELAY_JITTER = 0.35;
  const BASE_DURATION = 1.0;
  const DURATION_JITTER = 0.7;
  const DRIFT_AMOUNT = 0.045;

  const delays = new Float32Array(COUNT);
  const durations = new Float32Array(COUNT);
  const driftPhaseX = new Float32Array(COUNT);
  const driftPhaseY = new Float32Array(COUNT);
  const driftPhaseZ = new Float32Array(COUNT);
  const driftFreqX = new Float32Array(COUNT);
  const driftFreqY = new Float32Array(COUNT);
  const driftFreqZ = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const normalizedDist = maxDist > 0 ? distFromCenter[i] / maxDist : 0;
    delays[i] = normalizedDist * RADIAL_DELAY_SPREAD + Math.random() * RANDOM_DELAY_JITTER;
    durations[i] = BASE_DURATION + Math.random() * DURATION_JITTER;

    driftPhaseX[i] = Math.random() * Math.PI * 2;
    driftPhaseY[i] = Math.random() * Math.PI * 2;
    driftPhaseZ[i] = Math.random() * Math.PI * 2;
    driftFreqX[i] = 0.15 + Math.random() * 0.25;
    driftFreqY[i] = 0.15 + Math.random() * 0.25;
    driftFreqZ[i] = 0.15 + Math.random() * 0.25;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(sampledColors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    const posAttr = geometry.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;

      const localT = THREE.MathUtils.clamp((t - delays[i]) / durations[i], 0, 1);
      const eased = 1 - Math.pow(1 - localT, 3);

      const drift = DRIFT_AMOUNT * eased;
      const dx = Math.sin(t * driftFreqX[i] + driftPhaseX[i]) * drift;
      const dy = Math.cos(t * driftFreqY[i] + driftPhaseY[i]) * drift;
      const dz = Math.sin(t * driftFreqZ[i] + driftPhaseZ[i]) * drift * 0.5;

      posAttr.array[ix] = THREE.MathUtils.lerp(startPositions[ix], targetPositions[ix], eased) + dx;
      posAttr.array[ix + 1] = THREE.MathUtils.lerp(startPositions[ix + 1], targetPositions[ix + 1], eased) + dy;
      posAttr.array[ix + 2] = THREE.MathUtils.lerp(startPositions[ix + 2], targetPositions[ix + 2], eased) + dz;
    }
    posAttr.needsUpdate = true;

    points.rotation.y = t * 0.04;

    renderer.render(scene, camera);
  }
  animate();
};
