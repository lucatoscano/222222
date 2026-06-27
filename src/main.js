import "./style.css";
import * as THREE from "three";
import { OrbitControls, OBJLoader } from "three-stdlib";
import SurfaceSampler from "./SurfaceSampler.js";
import ParticleCloud from "./ParticleCloud.js";

// 120k è già molto denso e mantiene rapido l'avvio anche con tre forme.
// Su una macchina potente puoi riportarlo a 300000.
const PARTICLE_COUNT = 120000;
const MORPH_DURATION = 2.8;
const REST_DURATION = 3.5;
const MAX_MODELS = 12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090909);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.innerHTML = `
  <div class="status" aria-live="polite">Caricamento forme…</div>
  <div class="hint">spazio · forma successiva</div>
`;
document.body.prepend(renderer.domElement);

const status = document.querySelector(".status");
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

const group = new THREE.Group();
scene.add(group);

const shapes = [];
let cloud = null;
let currentIndex = 0;
let nextIndex = 1;
let phase = "loading";
let phaseElapsed = 0;
let rotationSpeed = 0.12;

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function loadOBJ(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Impossibile caricare ${path}`);

  const source = await response.text();
  if (source.trimStart().startsWith("<")) {
    throw new Error(`${path} non esiste`);
  }

  const object = new OBJLoader().parse(source);
  return SurfaceSampler.sample(object, PARTICLE_COUNT);
}

async function loadAllModels() {
  for (let i = 1; i <= MAX_MODELS; i++) {
    const path = `/models/${i}.obj`;

    try {
      status.textContent = `Campionamento forma ${i}…`;
      shapes.push(await loadOBJ(path));
    } catch (error) {
      if (i === 1) throw error;
      break;
    }
  }

  if (shapes.length < 2) {
    throw new Error("Servono almeno due OBJ in public/models.");
  }
}

function startMorph() {
  if (!cloud || phase === "morph") return;

  nextIndex = (currentIndex + 1) % shapes.length;
  cloud.setMorph(shapes[currentIndex], shapes[nextIndex]);
  phase = "morph";
  phaseElapsed = 0;
}

async function init() {
  try {
    await loadAllModels();

    cloud = new ParticleCloud(shapes[0]);
    group.add(cloud.points);
    phase = "rest";
    phaseElapsed = 0;

    status.textContent = `${shapes.length} forme · ${PARTICLE_COUNT.toLocaleString("it-IT")} punti`;
    window.setTimeout(() => status.classList.add("is-hidden"), 1800);
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
    status.classList.add("is-error");
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    startMorph();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (cloud) {
    phaseElapsed += dt;

    if (phase === "rest" && phaseElapsed >= REST_DURATION) {
      startMorph();
    } else if (phase === "morph") {
      const rawProgress = Math.min(phaseElapsed / MORPH_DURATION, 1);
      const p = easeInOutCubic(rawProgress);

cloud.material.uniforms.uTurbulence.value =
THREE.MathUtils.lerp(

0.25,

1.35,

Math.sin(p*Math.PI)

);

cloud.update(p,elapsed);

      if (rawProgress >= 1) {
        
        currentIndex = nextIndex;
        phase = "rest";
        phaseElapsed = 0;
      }
    }

    const targetSpeed = phase === "morph" ? 0.45 : 0.15;
rotationSpeed = THREE.MathUtils.lerp(rotationSpeed, targetSpeed, 0.04);

group.rotation.y += rotationSpeed * dt;

// oscillazione morbida sugli altri assi
group.rotation.x =
  Math.sin(elapsed * 0.8) * 0.5;

group.rotation.z =
  Math.cos(elapsed * 0.8) * 0.5;
  }

camera.position.x =
  Math.sin(elapsed * 2) * 0.5;

camera.position.y =
  Math.cos(elapsed * 2) * 0.5;

camera.position.z =
  4 +
  Math.sin(elapsed * 2) * 0.5;

camera.lookAt(0, 0, 0);

controls.update();
renderer.render(scene, camera);
}

init();
animate();
