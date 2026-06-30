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
import ParticleField from "./ParticleField.js";




const PARTICLE_COUNT = 120000;
const MORPH_DURATION = 2.8;
const REST_DURATION = 3.5;
const MAX_MODELS = 12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0aff);


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
renderer.toneMappingExposure = 0.55;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.08,  // intensità
  0.2,   // raggio
  0.95   // threshold
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

// Gruppo silhouette — mesh piatte colorate sullo sfondo
const silhouetteGroup = new THREE.Group();
scene.add(silhouetteGroup);

const silhouetteMat = new THREE.MeshBasicMaterial({
  color: 0xcc2200,
  side: THREE.DoubleSide,
  depthWrite: false,
  depthTest: false,
});

let silhouetteMesh = null;

// Palette colori risograph — coppie [sfondo, silhouette]
const PALETTES = [
  [0x0a0aff, 0xcc2200],   // blu + rosso
  [0xcc2200, 0x0a0aff],   // rosso + blu
  [0xcc2200, 0xf0e0b0],   // rosso + beige
  [0x0a1a00, 0xf0e0b0],   // verde scuro + beige
  [0x111111, 0x0a0aff],   // nero + blu
  [0x111111, 0xcc2200],   // nero + rosso
];
let paletteIndex = 0;

function updateSilhouette(index) {
  if (silhouetteMesh) {
    silhouetteGroup.remove(silhouetteMesh);
    silhouetteMesh.geometry.dispose();
    silhouetteMesh = null;
  }

  // Cambia palette ad ogni morph
  paletteIndex = (paletteIndex + 1) % PALETTES.length;
  const [bgColor, fgColor] = PALETTES[paletteIndex];
  scene.background = new THREE.Color(bgColor);
  silhouetteMat.color.set(fgColor);

  const loader = new OBJLoader();
  fetch(`/models/${(index % 3) + 1}.obj`)
    .then(r => r.text())
    .then(src => {
      const obj = loader.parse(src);
      obj.traverse(child => {
        if (child.isMesh && !silhouetteMesh) {
          // Clona e distorci la geometria
          const geo = child.geometry.clone();
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            // Distorsione random forte
            pos.setXYZ(i,
              x + (Math.random() - 0.5) * 0.3,
              y + (Math.random() - 0.5) * 0.3,
              z + (Math.random() - 0.5) * 0.1
            );
          }
          pos.needsUpdate = true;

          silhouetteMesh = new THREE.Mesh(geo, silhouetteMat);
          silhouetteMesh.renderOrder = -1;

          geo.computeBoundingBox();
          const box = geo.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 6.0;
          const scale = targetSize / maxDim;
          silhouetteMesh.scale.setScalar(scale);

          const center = new THREE.Vector3();
          box.getCenter(center);
          silhouetteMesh.position.set(
            -center.x * scale,
            -center.y * scale,
            -8
          );

          // Orientamento fisso — frontale, niente rotazione
          silhouetteMesh.rotation.set(0, 0, 0);

          silhouetteGroup.add(silhouetteMesh);
        }
      });
    });
}
const group = new THREE.Group();
scene.add(group);
const field = new ParticleField();

scene.add(field.points);
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
  if (!cloud || phase === "morph") return;

  nextIndex = (currentIndex + 1) % shapes.length;

  // FIX: passiamo shapes[currentIndex] come "from" — che coincide già
  // con i valori attuali di positionAttribute (aggiornati da setMorph
  // precedente o dall'inizializzazione). In questo modo non c'è mai
  // un frame dove le particelle appaiono nella posizione sbagliata.
  cloud.setMorph(shapes[currentIndex], shapes[nextIndex]);

  phase = "morph";
  updateSilhouette(nextIndex);
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

      const morphEnergy = Math.sin(p * Math.PI);

cloud.material.uniforms.uTurbulence.value =
    THREE.MathUtils.lerp(
        0.20,
        1.10,
        morphEnergy
    );

bloomPass.strength =
    THREE.MathUtils.lerp(
        0.18,
        0.42,
        morphEnergy
    );

bloomPass.radius =
    THREE.MathUtils.lerp(
        0.35,
        0.55,
        morphEnergy
    );

renderer.toneMappingExposure =
    THREE.MathUtils.lerp(
        1.05,
        1.20,
        morphEnergy
    );

cloud.update(p, elapsed);

bloomPass.strength =
    THREE.MathUtils.lerp(
        0.18,
        0.55,
        morphEnergy
    );

bloomPass.radius =
    THREE.MathUtils.lerp(
        0.35,
        0.65,
        morphEnergy
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
  
  controls.update();
  composer.render();
}

init();
animate();
