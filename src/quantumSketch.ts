// "QuantumSketch  So Katagiri"

import { DrawContext } from "./UI/DrawContext"
import { RDDraw } from "./UI/RDDraw"

declare global {
  interface Window {
    __quantumSketchInitialized?: boolean;
  }
}

if (!window.__quantumSketchInitialized) {
  window.__quantumSketchInitialized = true;
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const context_ = canvas.getContext("2d")!;
  const drawContext = new DrawContext(context_);
  new RDDraw(canvas, drawContext);
}
