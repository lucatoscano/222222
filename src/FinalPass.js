import * as THREE from "three";

const FinalPass = {

    uniforms: {

        tDiffuse: { value: null },

        uTime: { value: 0 },

        vignetteStrength: { value: 0.28 },

        grainStrength: { value: 0.025 },

        chroma: { value: 0.0018 },
        posterize:  { value: 5.0 },
        ditherStr:  { value: 0.8 }

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
        uniform float posterize;
        uniform float ditherStr;

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

        // Matrice Bayer 4x4 per dithering ordinato
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

        vec3 posterizeColor(vec3 c, float levels) {
            return floor(c * levels + 0.5) / levels;
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
color = pow(color, vec3(0.7));
color = clamp(color * 1.4, 0.0, 1.0);

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
            // Dithering Bayer
            vec2 pixelCoord = vUv * vec2(1280.0, 720.0);
            float threshold = bayer4(pixelCoord) * ditherStr;
            color += (threshold - 0.5) * 0.12;

            // Posterize
            color = posterizeColor(color, posterize);

            gl_FragColor =

                vec4(color,1.0);

        }

    `

};

export default FinalPass;