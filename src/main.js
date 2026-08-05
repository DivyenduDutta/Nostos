import * as THREE from "three";
import { buildShapes } from "./shapes.js";

const quoteEl = document.getElementById("quote");
function setQuote(text) {
  quoteEl.classList.add("hidden");
  setTimeout(() => {
    quoteEl.textContent = text;
    quoteEl.classList.remove("hidden");
  }, 400);
}

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
quoteEl.textContent = shapes[0].quote;

// Cyclops pupil: particles near the eye shape's own center are the pupil
// (drawn as a filled circle of radius 70 in a 600px canvas — see
// shapes.js's drawEye), everything else is the outline/brow.
const CYCLOPS_INDEX = shapes.findIndex((s) => s.name === "The Cyclops");
const VOYAGE_INDEX = shapes.findIndex((s) => s.name === "The Voyage");
const SCYLLA_INDEX = shapes.findIndex((s) => s.name === "Scylla & Charybdis");
const ITHACA_INDEX = shapes.findIndex((s) => s.name === "Ithaca");

const cyclopsPupilMask = new Uint8Array(COUNT);
if (CYCLOPS_INDEX !== -1) {
  const eyeShape = shapePositions[CYCLOPS_INDEX];
  const pupilRadius = WORLD_SCALE * 0.26;
  for (let i = 0; i < COUNT; i++) {
    const ix = i * 3;
    const d = Math.hypot(eyeShape[ix], eyeShape[ix + 1]);
    cyclopsPupilMask[i] = d < pupilRadius ? 1 : 0;
  }
}

// Pointer tracked in world space (z=0 plane) for the eye-tracking and
// whirlpool-pull interactions below.
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const pointerWorld = new THREE.Vector3();
let pointerActive = false;

window.addEventListener("pointermove", (e) => {
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  pointerActive = true;
});
window.addEventListener("pointerleave", () => {
  pointerActive = false;
});

let pupilOffsetX = 0;
let pupilOffsetY = 0;
let bobOffsetY = 0;
const baseColor = new THREE.Color(0xe8dcc4);
const ithacaColor = new THREE.Color(0xf6dda3);

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
    setQuote(shape.quote);
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

  if (pointerActive) {
    raycaster.setFromCamera(pointerNDC, camera);
    raycaster.ray.intersectPlane(pointerPlane, pointerWorld);
  }

  // Cyclops: pupil (masked particles) tracks the cursor as a rigid group,
  // clamped so it can't wander out of the eye's white.
  const wantsPupilTracking = activeIndex === CYCLOPS_INDEX && pointerActive;
  let desiredPupilX = 0;
  let desiredPupilY = 0;
  if (wantsPupilTracking) {
    const maxShift = WORLD_SCALE * 0.13;
    const dist = Math.hypot(pointerWorld.x, pointerWorld.y);
    const clamped = Math.min(dist, maxShift);
    if (dist > 0.0001) {
      desiredPupilX = (pointerWorld.x / dist) * clamped;
      desiredPupilY = (pointerWorld.y / dist) * clamped;
    }
  }
  pupilOffsetX = THREE.MathUtils.lerp(pupilOffsetX, desiredPupilX, 0.08);
  pupilOffsetY = THREE.MathUtils.lerp(pupilOffsetY, desiredPupilY, 0.08);

  // The Voyage: gentle bob, like a ship riding low swells.
  const desiredBob = activeIndex === VOYAGE_INDEX ? Math.sin(t * 1.2) * WORLD_SCALE * 0.035 : 0;
  bobOffsetY = THREE.MathUtils.lerp(bobOffsetY, desiredBob, 0.05);
  points.position.y = bobOffsetY;

  // Ithaca: warmer, brighter — homecoming glow.
  material.color.lerp(activeIndex === ITHACA_INDEX ? ithacaColor : baseColor, 0.03);
  material.opacity = THREE.MathUtils.lerp(material.opacity, activeIndex === ITHACA_INDEX ? 1 : 0.85, 0.03);

  const scyllaActive = activeIndex === SCYLLA_INDEX && pointerActive;
  const scyllaPullRadius = WORLD_SCALE * 0.9;

  const posAttr = geometry.attributes.position;
  for (let i = 0; i < COUNT; i++) {
    const ix = i * 3;

    const localT = THREE.MathUtils.clamp((t - transitionStart - delays[i]) / durations[i], 0, 1);
    const eased = 1 - Math.pow(1 - localT, 3);

    const drift = DRIFT_AMOUNT * eased;
    const driftX = Math.sin(t * driftFreqX[i] + driftPhaseX[i]) * drift;
    const driftY = Math.cos(t * driftFreqY[i] + driftPhaseY[i]) * drift;
    const driftZ = Math.sin(t * driftFreqZ[i] + driftPhaseZ[i]) * drift * 0.5;

    let x = THREE.MathUtils.lerp(fromPositions[ix], toPositions[ix], eased) + driftX;
    let y = THREE.MathUtils.lerp(fromPositions[ix + 1], toPositions[ix + 1], eased) + driftY;
    const z = THREE.MathUtils.lerp(fromPositions[ix + 2], toPositions[ix + 2], eased) + driftZ;

    if (cyclopsPupilMask[i] && activeIndex === CYCLOPS_INDEX) {
      x += pupilOffsetX * eased;
      y += pupilOffsetY * eased;
    }

    // Scylla & Charybdis: nearby particles get pulled in and swirled
    // around the cursor, like water circling toward the whirlpool.
    if (scyllaActive) {
      const px = pointerWorld.x - x;
      const py = pointerWorld.y - y;
      const dist = Math.hypot(px, py);
      if (dist < scyllaPullRadius && dist > 0.0001) {
        const pull = (1 - dist / scyllaPullRadius) * 0.4 * eased;
        const tx = -py / dist;
        const ty = px / dist;
        x += px * pull * 0.5 + tx * pull * WORLD_SCALE * 0.2;
        y += py * pull * 0.5 + ty * pull * WORLD_SCALE * 0.2;
      }
    }

    posAttr.array[ix] = x;
    posAttr.array[ix + 1] = y;
    posAttr.array[ix + 2] = z;
  }
  posAttr.needsUpdate = true;

  renderer.render(scene, camera);
}
animate();
