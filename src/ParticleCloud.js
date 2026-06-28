import * as THREE from "three";

const vertexShader = `
attribute vec3 targetPosition;

uniform float uProgress;
uniform float uTime;
uniform float uTurbulence;
uniform float uPointSize;
varying float vDepth;
varying float vAlpha;

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

    // Turbolenza organica — clampata per evitare che le particelle
    // vengano spinte troppo lontano dalla camera (causa gl_PointSize~0
    // e "buchi" neri durante il morph)
    float envelope =
        sin(uProgress * 3.14159265) *
        uTurbulence;

    vec3 flow;

    flow.x = sin( p.y * 3.5 + uTime * 0.9 + seed * 6.0 );
    flow.y = cos( p.z * 4.2 - uTime * 1.2 + seed * 4.0 );
    flow.z = sin( p.x * 3.8 + uTime * 0.8 + seed * 5.0 );

    flow = normalize(flow);

    // FIX linee nere: l'ampiezza massima era 0.06 (0.015+0.045).
    // Ridotta a 0.025 max così nessuna particella si allontana abbastanza
    // da far collassare gl_PointSize a zero.
    float amplitude = 0.008 + seed * 0.017;

    p += flow * amplitude * envelope;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    // FIX linee nere: range del depth allargato (da 1.5–9.0 a 0.5–12.0)
    // così le particelle spostate dalla turbolenza non raggiungono depth=1
    // e gl_PointSize non crolla a zero.
    float depth = smoothstep(0.5, 12.0, -mvPosition.z);

    vDepth = depth;
    vAlpha = 1.0 - depth;

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

void main(){

    float d = distance(gl_PointCoord, vec2(0.5));

    if(d > 0.5) discard;

    float alpha =
        (1.0 - smoothstep(0.30, 0.50, d)) * vAlpha;

    if(alpha < 0.01) discard;

    gl_FragColor = vec4(vec3(1.0), alpha);
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
                uProgress:   { value: 0 },
                uTime:       { value: 0 },
                uTurbulence: { value: 1.0 },
                uPointSize:  { value: 0.018 }
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
