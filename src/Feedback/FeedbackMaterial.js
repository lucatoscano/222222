import * as THREE from "three";

export default function createFeedbackMaterial(texture){

    return new THREE.ShaderMaterial({

        uniforms:{

            tOld:{ value:texture },

            uTime:{ value:0 },

            uDecay:{ value:0.985 }

        },

        vertexShader:`

            varying vec2 vUv;

            void main(){

                vUv = uv;

                gl_Position = vec4(position,1.0);

            }

        `,

        fragmentShader:`

            varying vec2 vUv;

            uniform sampler2D tOld;

            uniform float uTime;

            uniform float uDecay;

            void main(){

                vec2 uv = vUv;

                vec4 col = texture2D(
                    tOld,
                    uv
                );

                col *= uDecay;

                gl_FragColor = col;

            }

        `

    });

}