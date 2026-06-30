import "./style.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OrbitControls, OBJLoader } from "three-stdlib";
import SurfaceSampler from "./SurfaceSampler.js";
import ParticleCloud from "./ParticleCloud.js";

import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import FinalPass from "./FinalPass.js";
import ParticleField from "./ParticleField.js";
import BackgroundRenderer from "./BackgroundRenderer.js";
import OfflineRenderer from "./OfflineRenderer.js";



const PARTICLE_COUNT = 120000;
const MORPH_DURATION = 2.8;
const REST_DURATION = 3.5;
const MAX_MODELS = 20;

const scene = new THREE.Scene();

const bgScene = new THREE.Scene();
const bgRenderer = new BackgroundRenderer();
bgScene.add(bgRenderer.mesh);


function getCanvasSize() {
  const targetRatio = 4 / 5;
  let height = window.innerHeight;
  let width = height * targetRatio;

  if (width > window.innerWidth) {
    width = window.innerWidth;
    height = width / targetRatio;
  }

  return { width, height };
}
const { width: initW, height: initH } = getCanvasSize();

const camera = new THREE.PerspectiveCamera(
  60,
  initW / initH,
  0.1,
  100
);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
const offline = new OfflineRenderer(renderer);
window.addEventListener("keydown", (e) => {

  if (e.code === "KeyP") {

      offline.start(10);

  }

});
// Risoluzione di export per la registrazione (indipendente dalla finestra)
const EXPORT_WIDTH = 2160;
const EXPORT_HEIGHT = 2700;
let isExportMode = false;
let baseExposure = 0.65;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initW, initH);



const composer = new EffectComposer(renderer);

const bgRenderPass = new RenderPass(bgScene, camera);
composer.addPass(bgRenderPass);

const renderPass = new RenderPass(scene, camera);
renderPass.clear = false;
composer.addPass(renderPass);
let bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.7,  // intensità
  0.5,   // raggio
  0.50   // threshold
);
composer.addPass(bloomPass);
const finalPass = new ShaderPass(FinalPass);

composer.addPass(finalPass);


document.body.innerHTML = `
  <div class="status" aria-live="polite"></div>
  <div class="hint"></div>
`;
document.body.prepend(renderer.domElement);
function rebuildBloomPass(width, height) {
  const index = composer.passes.indexOf(bloomPass);

  // Salva lo stato attuale prima di ricreare il pass
  const prevStrength = bloomPass.strength;
  const prevRadius = bloomPass.radius;
  const prevThreshold = bloomPass.threshold;

  composer.passes.splice(index, 1);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    prevStrength,
    prevRadius,
    prevThreshold
  );

  composer.passes.splice(index, 0, bloomPass);
}

function setExportResolution(enabled) {
  isExportMode = enabled;

  const w = enabled ? EXPORT_WIDTH : window.innerWidth;
  const h = enabled ? EXPORT_HEIGHT : window.innerHeight;

  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  bgRenderer.resize();

  rebuildBloomPass(w, h);

  // Compensa la sottoesposizione del MediaRecorder durante captureStream
  baseExposure = enabled ? 1.8 : 0.65;
  renderer.toneMappingExposure = baseExposure;

  if (enabled) {
    renderer.domElement.style.width = "100vw";
    renderer.domElement.style.height = "100vh";
  } else {
    renderer.domElement.style.width = "";
    renderer.domElement.style.height = "";
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    event.preventDefault();

    if (!recorder.isRecording) {
      setExportResolution(true);
      // Aspetta un frame perché il resize abbia effetto prima di iniziare a registrare
      requestAnimationFrame(() => recorder.start());
    } else {
      recorder.stop();
      setExportResolution(false);
    }
  }
});

const status = document.querySelector(".status");
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

const group = new THREE.Group();
scene.add(group);
const target = new THREE.Vector3();

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
  bgRenderer.triggerColorChange();
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
  if (isExportMode) return; // ignora il resize della finestra mentre esporti in 4K
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bgRenderer.resize();
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  finalPass.uniforms.uTime.value = elapsed;
  bgRenderer.update(elapsed);


  
  const cameraDistance = camera.position.length();



  if (cloud) {
    phaseElapsed += dt;

    if (phase === "rest" && phaseElapsed >= REST_DURATION) {
      startMorph();
    }  else if (phase === "morph") {
      const rawProgress = Math.min(phaseElapsed / MORPH_DURATION, 1);
      const p = easeInOutCubic(rawProgress);
      const morphEnergy = Math.sin(p * Math.PI);

      cloud.material.uniforms.uTurbulence.value =
        THREE.MathUtils.lerp(0.20, 1.10, morphEnergy);

        cloud.material.uniforms.uPointSize.value =
        THREE.MathUtils.lerp(
            cloud.material.uniforms.uPointSize.value,
            THREE.MathUtils.lerp(
                0.018,
                0.012,
                morphEnergy
            ),
            0.08
        );

        bloomPass.strength = THREE.MathUtils.lerp(
          bloomPass.strength,
          THREE.MathUtils.lerp(0.05, 0.12, morphEnergy),
          0.08
      );
      
      bloomPass.radius = THREE.MathUtils.lerp(
          bloomPass.radius,
          THREE.MathUtils.lerp(0.35, 0.55, morphEnergy),
          0.08
      );
      
      renderer.toneMappingExposure = THREE.MathUtils.lerp(
          renderer.toneMappingExposure,
          THREE.MathUtils.lerp(baseExposure, baseExposure + 0.20, morphEnergy),
          0.08
      );

      cloud.update(p, elapsed);

      if (rawProgress >= 1) {
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

  let morphEnergy = 0;

if (phase === "morph") {
    const rawProgress = Math.min(phaseElapsed / MORPH_DURATION, 1);
    morphEnergy = Math.sin(rawProgress * Math.PI);
}

  const orbitTime = elapsed * 0.12;

  const radius = 4.15;
  
  camera.position.set(
  
      Math.cos(orbitTime) * radius,
  
      Math.sin(elapsed * 0.10) * 0.35,
  
      Math.sin(orbitTime) * radius
  
  );
  
  controls.target.lerp(
  
      new THREE.Vector3(
  
          Math.sin(elapsed * 0.08) * 0.05,
  
          Math.cos(elapsed * 0.06) * 0.03,
  
          0
  
      ),
  
      0.02
  
  );
  
bloomPass.strength = 1.0;
bloomPass.radius = 0.6;
  controls.update();
  composer.render();
  offline.saveFrame();
  

}

init();
animate();
