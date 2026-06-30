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
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorAPrev;
  uniform vec3  uColorBPrev;
  uniform float uTransition; // 0 = colore prev, 1 = colore nuovo
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  float bayer8(vec2 p) {
    int x = int(mod(p.x, 8.0));
    int y = int(mod(p.y, 8.0));
    int index = x + y * 8;
    float m[64];
    m[0]=0.0;m[1]=32.0;m[2]=8.0;m[3]=40.0;m[4]=2.0;m[5]=34.0;m[6]=10.0;m[7]=42.0;
    m[8]=48.0;m[9]=16.0;m[10]=56.0;m[11]=24.0;m[12]=50.0;m[13]=18.0;m[14]=58.0;m[15]=26.0;
    m[16]=12.0;m[17]=44.0;m[18]=4.0;m[19]=36.0;m[20]=14.0;m[21]=46.0;m[22]=6.0;m[23]=38.0;
    m[24]=60.0;m[25]=28.0;m[26]=52.0;m[27]=20.0;m[28]=62.0;m[29]=30.0;m[30]=54.0;m[31]=22.0;
    m[32]=3.0;m[33]=35.0;m[34]=11.0;m[35]=43.0;m[36]=1.0;m[37]=33.0;m[38]=9.0;m[39]=41.0;
    m[40]=51.0;m[41]=19.0;m[42]=59.0;m[43]=27.0;m[44]=49.0;m[45]=17.0;m[46]=57.0;m[47]=25.0;
    m[48]=15.0;m[49]=47.0;m[50]=7.0;m[51]=39.0;m[52]=13.0;m[53]=45.0;m[54]=5.0;m[55]=37.0;
    m[56]=63.0;m[57]=31.0;m[58]=55.0;m[59]=23.0;m[60]=61.0;m[61]=29.0;m[62]=53.0;m[63]=21.0;
    return m[index] / 64.0;
  }

  void main(){
    vec2 uv = vUv;
    vec2 px = uv * uResolution;

    /* transizione morbida tra palette precedente e nuova */
    vec3 colA = mix(uColorAPrev, uColorA, smoothstep(0.0, 1.0, uTransition));
    vec3 colB = mix(uColorBPrev, uColorB, smoothstep(0.0, 1.0, uTransition));

    /* rumore organico lento che modula il mix tra i due colori */
    vec2 flow1 = vec2(uTime * 0.18, uTime * 0.12);
    vec2 flow2 = vec2(-uTime * 0.15, uTime * 0.21);

float n1 = noise(uv * 2.0 + flow1);
float n2 = noise(uv * 4.0 + flow2 + n1 * 0.8);
float n3 = noise(uv * 1.0 - flow1 * 0.5 + n2 * 0.3);

float blend = clamp(n1 * 0.4 + n2 * 0.35 + n3 * 0.25, 0.0, 1.0);
vec3 base = mix(colA, colB, smoothstep(0.2, 0.8, blend));

    /* dithering Bayer fitto */
    float dith = bayer8(px);

    /* rumore fine ad alta frequenza, sempre diverso (texture grain) */
    float grain = hash(px + floor(uTime * 24.0));

    /* combinazione: il bayer decide la soglia, il grain randomizza leggermente */
    float speckle = step(dith, grain * 0.85 + 0.15);

    vec3 col = base;
    col += (speckle - 0.5) * 0.18;     // contrasto puntinato più marcato
    col -= (1.0 - speckle) * 0.05;

    /* ulteriore grana fine indipendente, per texture "carta stampata" */
    float microGrain = hash(px * 1.7 + uTime * 11.0) - 0.5;
    col += microGrain * 0.04;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export default class BackgroundRenderer {
  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uColorA: { value: new THREE.Color(0xcc2200) },
            uColorB: { value: new THREE.Color(0x000000) },
            uColorAPrev: { value: new THREE.Color(0xcc2200) },
            uColorBPrev: { value: new THREE.Color(0x000000) },
            uTransition: { value: 1.0 }
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
  
    if (this._transitionStart !== undefined) {
      const dur = 1800; // ms, durata della transizione colore
      const t = Math.min((performance.now() - this._transitionStart) / dur, 1.0);
      this.material.uniforms.uTransition.value = t;
    }
  }

 // Palette ispirate alle reference: [sfondo, dettaglio]
 static PALETTES = [
    [0xcc2200, 0x000000],   // rosso/nero
    [0x0a0aff, 0x000000],   // blu/nero
    [0xcc2200, 0x3a0a00],   // rosso/rosso scuro
    [0x0a0aff, 0x000033],   // blu/blu scuro
    [0xcc6600, 0x000000],   // arancio/nero
    [0x00aa55, 0x000000],   // verde smeraldo/nero
    [0xaa00cc, 0x000000],   // viola/nero
    [0xffcc00, 0x1a0a00],   // oro/marrone scuro
    [0x00cccc, 0x001a1a],   // ciano/petrolio
    [0xff0066, 0x1a0010],   // magenta/bordeaux scuro
    [0x556b2f, 0x0a0a00],   // verde oliva/nero
  ];

  triggerColorChange() {
    this._paletteIndex = ((this._paletteIndex ?? 0) + 1) % BackgroundRenderer.PALETTES.length;
    const [a, b] = BackgroundRenderer.PALETTES[this._paletteIndex];

    // salva i colori attuali come "prev" per la transizione
    this.material.uniforms.uColorAPrev.value.copy(this.material.uniforms.uColorA.value);
    this.material.uniforms.uColorBPrev.value.copy(this.material.uniforms.uColorB.value);

    this.material.uniforms.uColorA.value.set(a);
    this.material.uniforms.uColorB.value.set(b);

    this.material.uniforms.uTransition.value = 0.0;
    this._transitionStart = performance.now();
  }

  resize() {
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
}