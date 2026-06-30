import * as THREE from "three";

const vert = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = `
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uGridSeed;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

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

    float cellX = 32.0;
    float cellY = 24.0;
    vec2 cellId = floor(uv * vec2(cellX, cellY));
    vec2 cellUv = fract(uv * vec2(cellX, cellY));

    float slowTime = floor(uTime * 0.25);
    float cellSeed = hash(cellId + slowTime * 0.3 + uGridSeed);

    float notchX = step(0.6, hash(cellId + vec2(11.0, 3.0) + uGridSeed));
    float notchSize = 0.35 + hash(cellId + vec2(5.0, 9.0) + uGridSeed) * 0.25;
    float notch = step(notchSize, cellUv.x);
    float cellShape = mix(1.0, notch, notchX);

    float band = smoothstep(0.45, 0.55, cellSeed) * cellShape;

    vec3 colA = vec3(0.0, 0.0, 0.0);
    vec3 colB = vec3(0.65, 0.58, 0.0);
    vec3 col  = mix(colA, colB, band);

    float dith = bayer4(px);
col = mix(colA, colB, step(0.5, band) * step(dith, 0.92));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default class BackgroundRenderer {
  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uGridSeed: { value: 0 }
      },
      vertexShader: vert,
      fragmentShader: frag,
      depthWrite: false,
      depthTest: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = -999;
    this.mesh.frustumCulled = false;
  }

  update(elapsed) {
    this.material.uniforms.uTime.value = elapsed;
  }

  triggerGridChange() {
    this.material.uniforms.uGridSeed.value += 17.37;
  }

  resize() {
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
}