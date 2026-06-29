import * as THREE from "three";

export default class ParticleField {

    constructor(count = 30000){

        const positions = new Float32Array(count * 3);

        for(let i = 0; i < count; i++){

            positions[i*3] =
                (Math.random()-0.5) * 12;

            positions[i*3+1] =
                (Math.random()-0.5) * 12;

            positions[i*3+2] =
                (Math.random()-0.5) * 12;

        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                positions,
                3
            )
        );

        const material = new THREE.PointsMaterial({

            color:0xffffff,

            size:0.006,

            transparent:true,

            opacity:0.05,

            depthWrite:false,

            blending:THREE.AdditiveBlending

        });

        this.points =
            new THREE.Points(
                geometry,
                material
            );

    }

}