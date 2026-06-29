import * as THREE from "three";

export default function BackgroundSphere() {

    const geometry = new THREE.SphereGeometry(
        40,
        64,
        64
    );

    const material = new THREE.ShaderMaterial({

        side: THREE.BackSide,

        depthWrite: false,

        uniforms: {

            uTime: { value: 0 }

        },

        vertexShader: `

            varying vec3 vPosition;

            void main(){

                vPosition = position;

                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(position,1.0);

            }

        `,

        fragmentShader: `

            varying vec3 vPosition;

            uniform float uTime;

            void main(){

                float h =
                    normalize(vPosition).y;

                vec3 top =
                    vec3(
                        0.05,
                        0.07,
                        0.12
                    );

                vec3 bottom =
                    vec3(
                        0.005,
                        0.005,
                        0.01
                    );

                vec3 color =
                    mix(
                        bottom,
                        top,
                        smoothstep(
                            -0.3,
                            1.0,
                            h
                        )
                    );

                float pulse =
                    0.015 *
                    sin(
                        uTime * 0.12
                    );

                color += pulse;

                gl_FragColor =
                    vec4(
                        color,
                        1.0
                    );

            }

        `

    });

    return new THREE.Mesh(
        geometry,
        material
    );

}