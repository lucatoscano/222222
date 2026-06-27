import * as THREE from "three";

const vertexShader = `
  attribute vec3 targetPosition;

  uniform float uProgress;
  uniform float uTime;
  uniform float uTurbulence;
  uniform float uPointSize;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    vec3 p = mix(position, targetPosition, uProgress);

    // La turbolenza cresce al centro del morph e torna a zero agli estremi.
    float envelope = sin(uProgress * 3.14159265) * uTurbulence;
    float seed = hash(position);
    vec3 flow = vec3(
      sin(p.y * 8.0 + uTime * 1.7 + seed * 6.0),
      sin(p.z * 7.0 - uTime * 1.3 + seed * 4.0),
      sin(p.x * 9.0 + uTime * 1.5 + seed * 5.0)
    );
    p += flow * envelope * (0.025 + seed * 0.035);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uPointSize * (300.0 / max(1.0, -mvPosition.z));
  }
`;

const fragmentShader = `
  void main() {
    float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
    if (distanceFromCenter > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.32, 0.5, distanceFromCenter);
    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`;

export default class ParticleCloud {
  constructor(positions) {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.geometry.setAttribute(
      "targetPosition",
      new THREE.BufferAttribute(positions, 3)
    );

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uTurbulence: { value: 1 },
        uPointSize: { value: 0.018 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
  }

  setMorph(fromPositions, toPositions) {
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(fromPositions, 3)
    );
    this.geometry.setAttribute(
      "targetPosition",
      new THREE.BufferAttribute(toPositions, 3)
    );
    this.material.uniforms.uProgress.value = 0;
  }

  update(progress, elapsedTime) {
    this.material.uniforms.uProgress.value = progress;
    this.material.uniforms.uTime.value = elapsedTime;
  }
}
