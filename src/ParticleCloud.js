import * as THREE from "three";

const vertexShader = `
attribute vec3 targetPosition;

uniform float uProgress;
uniform float uTime;
uniform float uTurbulence;
uniform float uPointSize;
varying float vDepth;
varying float vAlpha;
varying float vLight;

float hash(vec3 p){
    return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453);
}

void main(){

    vec3 p = mix(position, targetPosition, uProgress);

    float seed = hash(position);

    // Respirazione globale della forma
    float breathe =
        0.02 *
        sin(
            uTime * 0.7 +
            seed * 20.0
        );

    p *= 1.0 + breathe;

   float envelope =
    sin(uProgress * 3.14159265) *
    uTurbulence;

// Campo vettoriale continuo
vec3 flow;

flow.x =
    sin(
        p.y * 2.2 +
        uTime * 0.45
    ) +
    cos(
        p.z * 1.6 -
        uTime * 0.32
    );

flow.y =
    sin(
        p.z * 2.0 -
        uTime * 0.40
    ) +
    cos(
        p.x * 2.3 +
        uTime * 0.28
    );

flow.z =
    sin(
        p.x * 1.8 +
        uTime * 0.35
    ) +
    cos(
        p.y * 2.4 -
        uTime * 0.31
    );

flow = normalize(flow);

float amplitude =
    0.01 +
    pow(seed, 2.0) *
    0.08;

p +=
    flow *
    amplitude *
    envelope;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    // FIX linee nere: range del depth allargato (da 1.5–9.0 a 0.5–12.0)
    // così le particelle spostate dalla turbolenza non raggiungono depth=1
    // e gl_PointSize non crolla a zero.
    float depth = smoothstep(0.5, 12.0, -mvPosition.z);

    vDepth = depth;

    vAlpha =
        1.0 - depth;
    
    // Luce virtuale
    vec3 lightDir = normalize(vec3(
        -0.4,
         0.8,
         1.0
    ));
    
    vec3 normal =
        normalize(p);
    
    vLight =
        clamp(
            dot(normal, lightDir),
            0.0,
            1.0
        );

    float perspective = 300.0 / max(1.0, -mvPosition.z);

    float pulse =
        1.0 +
        0.10 *
        sin( uTime * 1.2 + seed * 18.0 );

    gl_PointSize =
        uPointSize *
        perspective *
        pulse *
        mix(1.15, 0.85, depth);
}
`;

const fragmentShader = `
varying float vAlpha;

varying float vDepth;
varying float vLight;
uniform vec3 uAccentColor;


void main(){

    float d =
        distance(
            gl_PointCoord,
            vec2(0.5)
        );

    if(d > 0.5) discard;

    float alpha =
    1.0 -
    smoothstep(
        0.20,
        0.50,
        d
    );

    vec3 nearColor = vec3(
        1.00,
        1.00,
        1.00
    );
    
    vec3 farColor = vec3(
        0.78,
        0.86,
        1.00
    );

    vec3 color =
    mix(
        farColor,
        nearColor,
        vLight
    );

color =
    mix(
        color,
        vec3(1.0),
        0.25
    );

    alpha *=
    mix(
        1.0,
        0.55,
        vDepth
    );

alpha *= 0.7;

    gl_FragColor =
        vec4(
            color,
            alpha
        );
}
`;

export default class ParticleCloud {

    constructor(positions) {

        this.geometry = new THREE.BufferGeometry();

        this.positionAttribute = new THREE.BufferAttribute(
            new Float32Array(positions), 3
        );

        this.targetAttribute = new THREE.BufferAttribute(
            new Float32Array(positions), 3
        );

        this.geometry.setAttribute("position", this.positionAttribute);
        this.geometry.setAttribute("targetPosition", this.targetAttribute);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uProgress:    { value: 0 },
                uTime:        { value: 0 },
                uTurbulence:  { value: 1.0 },
                uPointSize:   { value: 0.018 },
                uAccentColor: { value: new THREE.Color(0xff3b30) }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(this.geometry, this.material);
    }

    setMorph(fromPositions, toPositions) {

        // FIX salto: azzerare uProgress PRIMA di aggiornare i buffer.
        // Così nel frame corrente lo shader legge ancora i vecchi buffer
        // con progress=0 (= posizione stabile), e nel frame successivo
        // riceve i nuovi buffer con progress=0 → nessun salto visibile.
        this.material.uniforms.uProgress.value = 0;

        this.positionAttribute.array.set(fromPositions);
        this.targetAttribute.array.set(toPositions);

        this.positionAttribute.needsUpdate = true;
        this.targetAttribute.needsUpdate = true;
    }

    update(progress, elapsedTime) {
        this.material.uniforms.uProgress.value = progress;
        this.material.uniforms.uTime.value = elapsedTime;
    }
}
