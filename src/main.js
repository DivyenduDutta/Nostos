import * as THREE from "three";

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

// Placeholder particle cloud: scattered points converging into a sphere.
// Stand-in for the real image-sampled particle-art system (see project plan step 2).
const COUNT = 4000;
const targetPositions = new Float32Array(COUNT * 3);
const startPositions = new Float32Array(COUNT * 3);
const positions = new Float32Array(COUNT * 3);

for (let i = 0; i < COUNT; i++) {
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * Math.PI * 2;
  const r = 2;

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);

  targetPositions.set([x, y, z], i * 3);
  startPositions.set(
    [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20],
    i * 3
  );
  positions.set(startPositions.slice(i * 3, i * 3 + 3), i * 3);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0xe8dcc4,
  size: 0.03,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

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
