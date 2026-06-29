import * as THREE from "three";

export default class FeedbackEngine {

    constructor(renderer, width, height) {

        this.renderer = renderer;

        this.readBuffer = new THREE.WebGLRenderTarget(
            width,
            height,
            {
                type: THREE.HalfFloatType
            }
        );

        this.writeBuffer = new THREE.WebGLRenderTarget(
            width,
            height,
            {
                type: THREE.HalfFloatType
            }
        );

    }

    swap() {

        const tmp = this.readBuffer;

        this.readBuffer = this.writeBuffer;

        this.writeBuffer = tmp;

    }

}