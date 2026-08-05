import * as THREE from "three";
import { nextQuote } from "./quotes.js";
import { buildShapes } from "./shapes.js";

document.getElementById("quote").textContent = nextQuote();

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

// The point cloud doubles as a navigation device: one persistent field of
// particles that reshapes itself into a different silhouette per stop on
// the journey, instead of separate pages/images per episode.
const COUNT = 5000;
const shapes = buildShapes(COUNT);

const distanceToOrigin = camera.position.z;
const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distanceToOrigin;
const WORLD_SCALE = (visibleHeight / 2) * 0.8;

const shapePositions = shapes.map((shape) => {
  const scaled = new Float32Array(shape.positions.length);
  for (let i = 0; i < shape.positions.length; i++) {
    scaled[i] = shape.positions[i] * WORLD_SCALE;
  }
  return scaled;
});

const positions = new Float32Array(COUNT * 3);
const fromPositions = new Float32Array(COUNT * 3);
const toPositions = new Float32Array(COUNT * 3);
const delays = new Float32Array(COUNT);
const durations = new Float32Array(COUNT);
const driftPhaseX = new Float32Array(COUNT);
const driftPhaseY = new Float32Array(COUNT);
const driftPhaseZ = new Float32Array(COUNT);
const driftFreqX = new Float32Array(COUNT);
const driftFreqY = new Float32Array(COUNT);
const driftFreqZ = new Float32Array(COUNT);

for (let i = 0; i < COUNT; i++) {
  const ix = i * 3;
  fromPositions[ix] = (Math.random() - 0.5) * 20;
  fromPositions[ix + 1] = (Math.random() - 0.5) * 20;
  fromPositions[ix + 2] = (Math.random() - 0.5) * 20;
  positions[ix] = fromPositions[ix];
  positions[ix + 1] = fromPositions[ix + 1];
  positions[ix + 2] = fromPositions[ix + 2];

  driftPhaseX[i] = Math.random() * Math.PI * 2;
  driftPhaseY[i] = Math.random() * Math.PI * 2;
  driftPhaseZ[i] = Math.random() * Math.PI * 2;
  driftFreqX[i] = 0.15 + Math.random() * 0.25;
  driftFreqY[i] = 0.15 + Math.random() * 0.25;
  driftFreqZ[i] = 0.15 + Math.random() * 0.25;
}
toPositions.set(shapePositions[0]);

const RANDOM_DELAY_SPREAD = 1.2;
const BASE_DURATION = 1.0;
const DURATION_JITTER = 0.7;
const DRIFT_AMOUNT = 0.09;

let transitionStart = 0;

function restaggerTransition(t) {
  transitionStart = t;
  for (let i = 0; i < COUNT; i++) {
    delays[i] = Math.random() * RANDOM_DELAY_SPREAD;
    durations[i] = BASE_DURATION + Math.random() * DURATION_JITTER;
  }
}
restaggerTransition(0);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0xe8dcc4,
  size: 0.025,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// Nav: click a stop to morph the cloud into that episode's silhouette.
const nav = document.createElement("div");
nav.className = "nav";
const buttons = shapes.map((shape, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = shape.name;
  if (index === 0) button.classList.add("active");
  button.addEventListener("click", () => {
    if (index === activeIndex) return;
    fromPositions.set(geometry.attributes.position.array);
    toPositions.set(shapePositions[index]);
    restaggerTransition(clock.getElapsedTime());
    activeIndex = index;
    buttons.forEach((b, i) => b.classList.toggle("active", i === index));
  });
  nav.appendChild(button);
  return button;
});
document.getElementById("ui").appendChild(nav);

let activeIndex = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  const posAttr = geometry.attributes.position;
  for (let i = 0; i < COUNT; i++) {
    const ix = i * 3;

    const localT = THREE.MathUtils.clamp((t - transitionStart - delays[i]) / durations[i], 0, 1);
    const eased = 1 - Math.pow(1 - localT, 3);

    const drift = DRIFT_AMOUNT * eased;
    const driftX = Math.sin(t * driftFreqX[i] + driftPhaseX[i]) * drift;
    const driftY = Math.cos(t * driftFreqY[i] + driftPhaseY[i]) * drift;
    const driftZ = Math.sin(t * driftFreqZ[i] + driftPhaseZ[i]) * drift * 0.5;

    posAttr.array[ix] = THREE.MathUtils.lerp(fromPositions[ix], toPositions[ix], eased) + driftX;
    posAttr.array[ix + 1] = THREE.MathUtils.lerp(fromPositions[ix + 1], toPositions[ix + 1], eased) + driftY;
    posAttr.array[ix + 2] = THREE.MathUtils.lerp(fromPositions[ix + 2], toPositions[ix + 2], eased) + driftZ;
  }
  posAttr.needsUpdate = true;

  points.rotation.y = t * 0.04;

  renderer.render(scene, camera);
}
animate();
