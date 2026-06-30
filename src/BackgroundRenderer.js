import * as THREE from "three";

const vert = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = `
  uniform float uTime;
  uniform vec2  uResolution;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

  // Matrice Bayer 4x4 — stessa del FinalPass, per coerenza visiva
  float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int index = x + y * 4;
    float m[16];
    m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
    m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
    m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
    m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
    return m[index] / 16.0;
  }

  void main(){
    vec2 uv = vUv;
    vec2 px = uv * uResolution;

    /* --- griglia di colonne verticali --- */
    float colCount = 48.0;
    float colId = floor(uv.x * colCount);

    /* --- glitch lento: ogni colonna ha un timeslot che cambia ogni N secondi --- */
    float slowTime = floor(uTime * 0.35);          // cambia ogni ~2.8s
    float colSeed  = hash(vec2(colId, slowTime));

    /* shift orizzontale a scatti, solo su alcune colonne */
    float doShift = step(0.82, colSeed);
    float shiftAmt = (hash(vec2(colId, slowTime + 7.7)) - 0.5) * 0.06 * doShift;
    vec2 uvG = uv + vec2(shiftAmt, 0.0);

    float colIdG = floor(uvG.x * colCount);

    /* --- pattern righe orizzontali dentro ogni colonna --- */
    float rowCount = 90.0;
    float rowId = floor(uv.y * rowCount);
    float rowSeed = hash(vec2(colIdG, floor(rowId * 0.3) + slowTime * 0.5));

    /* bande on/off tipo barcode, leggermente animate */
    /* righe nette, animate verticalmente in loop lento */
float scrollY = uv.y + uTime * 0.02;
float rowPattern = mod(floor(scrollY * rowCount) + floor(colIdG * 1.3), 4.0);
float band = step(2.0, rowPattern);

    /* --- colori --- */
    vec3 colA = vec3(0.04, 0.04, 0.05);   // quasi nero
    vec3 colB = vec3(0.85, 0.78, 0.05);   // giallo desaturato
    vec3 col  = mix(colA, colB, band);

    /* occasionali colonne intere "rotte" (glitch forte) */
    float bigGlitch = step(0.965, hash(vec2(floor(slowTime), colIdG)));
    col = mix(col, vec3(1.0), bigGlitch * step(0.5, hash(vec2(colIdG, uTime))));

    /* --- dithering Bayer + posterize, stesso stile del FinalPass --- */
    float dith = bayer4(px) * 0.6;
    col += (dith - 0.5) * 0.05;
    col = floor(col * 5.0 + 0.5) / 5.0;

    /* leggera vignetta per non competere con le particelle al centro */
    float d = length(uv - 0.5);
    col *= mix(1.0, 0.55, smoothstep(0.3, 0.9, d));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default class BackgroundRenderer {
  constructor() {
    // Piano enorme, molto lontano, dietro tutto il resto
    const geometry = new THREE.PlaneGeometry(120, 120);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: vert,
      fragmentShader: frag,
      depthWrite: false,
      depthTest: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = -999;
    this.mesh.position.z = -15;
    this.mesh.frustumCulled = false;
  }

  update(elapsed, camera) {
    this.material.uniforms.uTime.value = elapsed;

    // Mantiene il quad sempre frontale alla camera, indipendentemente dall'orbit
    this.mesh.quaternion.copy(camera.quaternion);
    this.mesh.position.copy(camera.position);
    this.mesh.translateZ(-15);
  }

  resize() {
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
}