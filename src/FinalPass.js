import * as THREE from "three";

const FinalPass = {

    uniforms: {

        tDiffuse: { value: null },

        uTime: { value: 0 },

        vignetteStrength: { value: 0.28 },

        grainStrength: { value: 0.025 },

        chroma: { value: 0.0018 }

    },

    vertexShader: `

        varying vec2 vUv;

        void main(){

            vUv = uv;

            gl_Position =

                projectionMatrix *

                modelViewMatrix *

                vec4(position,1.0);

        }

    `,

    fragmentShader: `

        uniform sampler2D tDiffuse;

        uniform float uTime;

        uniform float vignetteStrength;

        uniform float grainStrength;

        uniform float chroma;

        varying vec2 vUv;

        float random(vec2 st){

            return fract(

                sin(

                    dot(

                        st.xy,

                        vec2(12.9898,78.233)

                    )

                )*

                43758.5453123

            );

        }

        void main(){

            vec2 uv = vUv;

            vec2 center = uv - 0.5;

            float dist = length(center);

            float edge =
    0.35 +
    0.65 *
    smoothstep(
        0.20,
        0.80,
        dist
    );

vec2 offset =
    center *
    chroma *
    edge;

            float r = texture2D(

                tDiffuse,

                uv + offset

            ).r;

            float g = texture2D(

                tDiffuse,

                uv

            ).g;

            float b = texture2D(

                tDiffuse,

                uv - offset

            ).b;

            vec3 color = vec3(r,g,b);

            // Contrasto morbido
color = pow(color, vec3(0.92));

// Leggero S-Curve
color = smoothstep(0.0, 1.0, color);

// Ombre leggermente fredde
color.b += (1.0 - color.r) * 0.02;

// Alte luci leggermente calde
color.r += color.r * 0.015;

            float vignette =

                smoothstep(

                    0.85,

                    vignetteStrength,

                    dist

                );

            color *= vignette;

            float grain =

                random(

                    uv +

                    uTime

                )-0.5;

            color += grain * grainStrength;

            gl_FragColor =

                vec4(color,1.0);

        }

    `

};

export default FinalPass;