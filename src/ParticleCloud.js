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

    // Turbolenza organica
    float envelope =
        sin(uProgress * 3.14159265) *
        uTurbulence;

    vec3 flow;

    flow.x =
        sin(
            p.y * 3.5 +
            uTime * 0.9 +
            seed * 6.0
        );

    flow.y =
        cos(
            p.z * 4.2 -
            uTime * 1.2 +
            seed * 4.0
        );

    flow.z =
        sin(
            p.x * 3.8 +
            uTime * 0.8 +
            seed * 5.0
        );

    flow = normalize(flow);

    float amplitude =
        0.015 +
        seed * 0.045;

    p +=
        flow *
        amplitude *
        envelope;

    vec4 mvPosition =
        modelViewMatrix *
        vec4(p,1.0);

gl_Position =
    projectionMatrix *
    mvPosition;

    float depth =
    smoothstep(
        1.5,
        9.0,
        -mvPosition.z
    );

vDepth = depth;

vAlpha =
    1.0 - depth;

    float perspective =
    300.0 /
    max(1.0,-mvPosition.z);

float pulse =
    1.0 +
    0.10 *
    sin(
        uTime * 1.2 +
        seed * 18.0
    );

gl_PointSize =
    uPointSize *
    perspective *
    pulse *
    mix(
        1.15,
        0.85,
        depth
    );
}
`;

const fragmentShader = `
void main(){

    float d =
        distance(
            gl_PointCoord,
            vec2(0.5)
        );

    if(d>0.5) discard;

    float alpha =
        1.0 -
        smoothstep(
            0.30,
            0.50,
            d
        );

    gl_FragColor =
        vec4(
            vec3(1.0),
            alpha
        );

}
`;

export default class ParticleCloud{

    constructor(positions){

        this.geometry = new THREE.BufferGeometry();

        this.geometry.setAttribute(

            "position",

            new THREE.BufferAttribute(
                positions,
                3
            )

        );

        this.geometry.setAttribute(

            "targetPosition",

            new THREE.BufferAttribute(
                positions,
                3
            )

        );

        this.material =
            new THREE.ShaderMaterial({

                uniforms:{

                    uProgress:{value:0},

                    uTime:{value:0},

                    uTurbulence:{value:1.0},

                    uPointSize:{value:0.018}

                },

                vertexShader,

                fragmentShader,

                transparent:true,

                depthWrite:false,

                blending:THREE.AdditiveBlending

            });

        this.points =
            new THREE.Points(

                this.geometry,

                this.material

            );

    }

    setMorph(fromPositions,toPositions){

        this.geometry.setAttribute(

            "position",

            new THREE.BufferAttribute(
                fromPositions,
                3
            )

        );

        this.geometry.setAttribute(

            "targetPosition",

            new THREE.BufferAttribute(
                toPositions,
                3
            )

        );

        this.material.uniforms.uProgress.value=0;

    }

    update(progress,elapsedTime){

        this.material.uniforms.uProgress.value=progress;

        this.material.uniforms.uTime.value=elapsedTime;

    }

}