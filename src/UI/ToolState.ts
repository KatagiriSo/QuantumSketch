import { Vector } from "../Core/Vector";
import { DrawContext } from "./DrawContext";
import { DrawMode } from "./DrawMode";
import type { RDDraw } from "./RDDraw";

export interface ToolState {
  readonly mode: DrawMode;
  onDown(host: RDDraw, point: Vector, precisePoint: Vector, ev: MouseEvent): void;
  onMove(host: RDDraw, point: Vector, precisePoint: Vector, ev: MouseEvent): void;
  onUp(host: RDDraw, point: Vector, precisePoint: Vector, ev: MouseEvent): void;
  render(host: RDDraw, drawContext: DrawContext): void;
}

abstract class BaseToolState implements ToolState {
  readonly mode: DrawMode;

  constructor(mode: DrawMode) {
    this.mode = mode;
  }

  onDown(host: RDDraw, point: Vector, precisePoint: Vector, ev: MouseEvent): void {
    host.dispatchToolMouseDown(this.mode, point, precisePoint, ev);
  }

  onMove(host: RDDraw, point: Vector, precisePoint: Vector, ev: MouseEvent): void {
    host.dispatchToolMouseMove(this.mode, point, precisePoint, ev);
  }

  onUp(host: RDDraw, point: Vector, precisePoint: Vector, ev: MouseEvent): void {
    host.dispatchToolMouseUp(this.mode, point, precisePoint, ev);
  }

  render(host: RDDraw, drawContext: DrawContext): void {
    return;
  }
}

export class SelectToolState extends BaseToolState {
  constructor() {
    super("normal");
  }
}

export class LineToolState extends BaseToolState {
  constructor() {
    super("line");
  }
}

export class LoopToolState extends BaseToolState {
  constructor() {
    super("loop");
  }
}

export class PointToolState extends BaseToolState {
  constructor() {
    super("point");
  }
}

export class StringToolState extends BaseToolState {
  constructor() {
    super("string");
  }
}

