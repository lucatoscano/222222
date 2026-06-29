import "./style.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OrbitControls, OBJLoader } from "three-stdlib";
import SurfaceSampler from "./SurfaceSampler.js";
import ParticleCloud from "./ParticleCloud.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import FinalPass from "./FinalPass.js";

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
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.25,  // intensità
  0.45,  // raggio
  0.65   // threshold
);
composer.addPass(bloomPass);
const finalPass = new ShaderPass(FinalPass);

composer.addPass(finalPass);
const bokehPass = new BokehPass(scene, camera, {

  focus: 4.0,

  aperture: 0.00002,

  maxblur: 0.004

});

composer.addPass(bokehPass);

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

  // FIX: passiamo shapes[currentIndex] come "from" — che coincide già
  // con i valori attuali di positionAttribute (aggiornati da setMorph
  // precedente o dall'inizializzazione). In questo modo non c'è mai
  // un frame dove le particelle appaiono nella posizione sbagliata.
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
  composer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  finalPass.uniforms.uTime.value = elapsed;
  
  const cameraDistance = camera.position.length();

bokehPass.materialBokeh.uniforms.focus.value =
    cameraDistance * 0.95;

  if (cloud) {
    phaseElapsed += dt;

    if (phase === "rest" && phaseElapsed >= REST_DURATION) {
      startMorph();
    } else if (phase === "morph") {
      const rawProgress = Math.min(phaseElapsed / MORPH_DURATION, 1);
      const p = easeInOutCubic(rawProgress);

      cloud.material.uniforms.uTurbulence.value = THREE.MathUtils.lerp(
        0.25,
        1.35,
        Math.sin(p * Math.PI)
      );

      cloud.update(p, elapsed);

      if (rawProgress >= 1) {
        // FIX: al termine del morph sincronizziamo currentIndex.
        // Non serve toccare i buffer qui: setMorph del prossimo ciclo
        // li aggiornerà correttamente partendo da shapes[currentIndex].
        currentIndex = nextIndex;
        phase = "rest";
        phaseElapsed = 0;
      }
    }

    const targetSpeed = phase === "morph" ? 0.45 : 0.15;
    rotationSpeed = THREE.MathUtils.lerp(rotationSpeed, targetSpeed, 0.04);

    group.rotation.y += rotationSpeed * dt;
    group.rotation.x = Math.sin(elapsed * 0.8) * 0.5;
    group.rotation.z = Math.cos(elapsed * 0.8) * 0.5;
  }

  const camRadius = 4.2;
  camera.position.x = Math.sin(elapsed * 0.18) * camRadius;
  camera.position.z = Math.cos(elapsed * 0.18) * camRadius;
  camera.position.y = Math.sin(elapsed * 0.11) * 0.65;
  camera.lookAt(0, 0, 0);

  controls.update();
  composer.render();
}

init();
animate();
