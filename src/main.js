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
  const revealDuration = 2.5;

  function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    const revealT = Math.min(t / revealDuration, 1);
    const eased = 1 - Math.pow(1 - revealT, 3);

    const posAttr = geometry.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      posAttr.array[ix] = THREE.MathUtils.lerp(startPositions[ix], targetPositions[ix], eased);
      posAttr.array[ix + 1] = THREE.MathUtils.lerp(startPositions[ix + 1], targetPositions[ix + 1], eased);
      posAttr.array[ix + 2] = THREE.MathUtils.lerp(startPositions[ix + 2], targetPositions[ix + 2], eased);
    }
    posAttr.needsUpdate = true;

    points.rotation.y = t * 0.08;

    renderer.render(scene, camera);
  }
  animate();
};
