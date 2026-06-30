export default class OfflineRenderer {

    constructor(renderer) {

        this.renderer = renderer;

        this.enabled = false;

        this.frame = 0;

        this.totalFrames = 0;

        this.fps = 60;

    }

    start(seconds) {

        this.enabled = true;

        this.frame = 0;

        this.totalFrames = Math.floor(seconds * this.fps);

    }

    saveFrame() {

        if (!this.enabled) return;

        const canvas = this.renderer.domElement;

        const link = document.createElement("a");

        link.download =
            `frame_${String(this.frame).padStart(5, "0")}.png`;

        link.href = canvas.toDataURL("image/png");

        link.click();

        this.frame++;

        if (this.frame >= this.totalFrames) {

            this.enabled = false;

            console.log("EXPORT FINITO");

        }

    }

}