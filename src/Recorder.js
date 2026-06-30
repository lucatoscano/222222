export default class Recorder {
  constructor(canvas, fps = 200) {
    this.canvas = canvas;
    this.fps = fps;
    this.recorder = null;
    this.chunks = [];
    this.isRecording = false;
  }

  start() {
    if (this.isRecording) return;

    const stream = this.canvas.captureStream(this.fps);

    // Bitrate alto per qualità export (40 Mbps)
    const options = {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 80_000_000
    };

    // Fallback se vp9 non supportato
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = "video/webm;codecs=vp8";
    }

    this.chunks = [];
    this.recorder = new MediaRecorder(stream, options);

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    this.recorder.start();
    this.isRecording = true;
    console.log("Recording started");
  }

  stop() {
    if (!this.isRecording) return;
    this.recorder.stop();
    this.isRecording = false;
    console.log("Recording stopped — download avviato");
  }

  toggle() {
    this.isRecording ? this.stop() : this.start();
  }
}