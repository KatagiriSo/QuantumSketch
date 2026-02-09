import { Vector } from "./Vector";
import { Line } from "./Line";
import { Loop } from "./Loop";

/**
 * Graph node used by lines/loops.
 * Keeps small adjacency hints for UI workflows.
 */
export class Vertex extends Vector {
  readonly kind = "vertex";
  connectedLineIds: Set<string> = new Set();
  connectedLoopIds: Set<string> = new Set();

  constructor(xOrLabel: number | string = 0, yOrOrigin: number | Vector = 0) {
    let x = 0;
    let y = 0;
    if (typeof xOrLabel === "number" && typeof yOrOrigin === "number") {
      x = xOrLabel;
      y = yOrOrigin;
    } else if (yOrOrigin instanceof Vector) {
      x = yOrOrigin.x;
      y = yOrOrigin.y;
    }
    super(x, y);
  }

  copy(): Vertex {
    const vertex = new Vertex(this.x, this.y);
    vertex.id = this.id;
    vertex.connectedLineIds = new Set(this.connectedLineIds);
    vertex.connectedLoopIds = new Set(this.connectedLoopIds);
    return vertex;
  }

  attachLine(lineId: string): void {
    this.connectedLineIds.add(lineId);
  }

  detachLine(lineId: string): void {
    this.connectedLineIds.delete(lineId);
  }

  attachLoop(loopId: string): void {
    this.connectedLoopIds.add(loopId);
  }

  detachLoop(loopId: string): void {
    this.connectedLoopIds.delete(loopId);
  }

  connectionCount(): number {
    return this.connectedLineIds.size + this.connectedLoopIds.size;
  }

  hasConnections(): boolean {
    return this.connectionCount() > 0;
  }

  clearConnections(): void {
    this.connectedLineIds.clear();
    this.connectedLoopIds.clear();
  }

  // Backward-compatible alias used in old sample/UI code.
  get origin(): Vertex {
    return this;
  }

  set origin(value: Vector) {
    this.moveAbsolute(value);
  }

  addLineTo(line: Line): void {
    line.to = this;
  }

  addLineOrigin(line: Line): void {
    line.origin = this;
  }

  addLoop(loop: Loop): void {
    loop.origin = this;
  }
}
