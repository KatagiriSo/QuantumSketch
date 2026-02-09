import { Elem, getElemID } from "./Elem";
import { LabelInfo } from "./LabelInfo";
import { LineStyle, Line } from "./Line";
import { Shape } from "./Shape";
import { Vector, direction, makeVector } from "./Vector";
import { Vertex } from "./Vertex";

/**
 * Loop bound to a center vertex (graph node).
 */
export class Loop implements Elem {
  id: string;
  shape: "Loop" = "Loop";
  style: LineStyle = "normal";
  allow: Boolean = false;
  fill: boolean = false;
  radius: number = 1;
  label: string = "";
  labels: LabelInfo[] = [];
  loopBeginAngle: number = 0;
  loopEndAngle: number = Math.PI * 2;

  centerVertexId: string = "";
  private centerVertex?: Vertex;
  private fallbackOrigin: Vector = new Vector(0, 0);

  constructor(label?: string, origin?: Vector) {
    this.id = getElemID();
    if (label) {
      this.label = label;
    }
    if (origin) {
      this.origin = origin;
    }
  }

  get origin(): Vertex {
    if (this.centerVertex) {
      return this.centerVertex;
    }
    const detached = new Vertex(this.fallbackOrigin.x, this.fallbackOrigin.y);
    detached.id = this.centerVertexId || detached.id;
    this.centerVertex = detached;
    this.centerVertexId = detached.id;
    return detached;
  }

  set origin(value: Vector) {
    if (value instanceof Vertex) {
      this.centerVertex = value;
      this.centerVertexId = value.id;
      this.fallbackOrigin = value.copy();
      return;
    }
    const detached = new Vertex(value.x, value.y);
    this.centerVertex = detached;
    this.centerVertexId = detached.id;
    this.fallbackOrigin = detached.copy();
  }

  bindCenterVertex(vertex: Vertex): void {
    this.centerVertex = vertex;
    this.centerVertexId = vertex.id;
    this.fallbackOrigin = vertex.copy();
  }

  save(): any {
    const saveData = {} as any;
    saveData["id"] = this.id;
    saveData["label"] = this.label;
    saveData["labels"] = this.labels;
    saveData["shape"] = this.shape;
    saveData["style"] = this.style;
    saveData["allow"] = this.allow;
    saveData["fill"] = this.fill;
    saveData["origin"] = this.origin.save();
    saveData["radius"] = this.radius;
    saveData["loopBeginAngle"] = this.loopBeginAngle;
    saveData["loopEndAngle"] = this.loopEndAngle;
    saveData["centerVertexId"] = this.centerVertexId;
    return saveData;
  }

  copy(): Loop {
    const loop = new Loop();
    loop.id = this.id;
    loop.fill = this.fill;
    loop.radius = this.radius;
    loop.label = this.label;
    loop.labels = [...this.labels];
    loop.style = this.style;
    loop.allow = this.allow;
    loop.loopBeginAngle = this.loopBeginAngle;
    loop.loopEndAngle = this.loopEndAngle;
    loop.centerVertexId = this.centerVertexId;
    loop.centerVertex = this.centerVertex;
    loop.fallbackOrigin = this.fallbackOrigin.copy();
    return loop;
  }

  setLoopBeginAngle(angle: number): void {
    if (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    if (angle < 0.0) angle += 2 * Math.PI;
    this.loopBeginAngle = angle;
  }

  setLoopEndAngle(angle: number): void {
    if (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    if (angle < 0) angle += 2 * Math.PI;
    this.loopEndAngle = angle;
  }

  setRadius(radius: number): void {
    if (radius < 1) radius = 1;
    this.radius = radius;
  }

  move(delta: Vector): void {
    this.origin.move(delta);
  }

  moveAbsolute(location: Vector): void {
    this.origin.moveAbsolute(location);
  }

  rotation(delta: number): void {
    this.setLoopBeginAngle(this.loopBeginAngle + delta);
    this.setLoopEndAngle(this.loopEndAngle + delta);
  }

  addLineTo(line: Line): void {
    line.to = this.origin.add(direction(line.origin, this.origin).unit().multi(this.radius));
  }

  addLineOrigin(line: Line): void {
    line.origin = this.origin.add(direction(line.to, this.origin).unit().multi(this.radius));
  }

  addLoop(loop: Loop): void {
    loop.origin = this.origin.add(direction(loop.origin, this.origin).unit().multi(this.radius));
  }

  formalDistance(point: Vector): number {
    const length = this.origin.minus(point).length();
    if (length < this.radius) {
      return 0;
    }
    return Number.MAX_VALUE;
  }

  description(): string {
    return `${this.shape} id:${this.id} (${this.origin.x},${this.origin.y}) radius = ${this.radius} angle = (${this.loopBeginAngle * (360 / (2 * Math.PI))}, ${this.loopEndAngle * (360 / (2 * Math.PI))}) style:${this.style}`;
  }
}

export function isLoop(elem: Elem): elem is Loop {
  return elem.shape == "Loop";
}

export function makeLoop(data: any): Loop | undefined {
  const shape = data["shape"] as Shape | undefined;
  if (shape && shape !== "Loop") {
    return undefined;
  }
  const loop = new Loop(undefined, undefined);
  loop.id = data["id"] ?? loop.id;
  loop.label = data["label"] ?? "";
  loop.style = data["style"] ?? "normal";
  loop.allow = data["allow"] ?? false;
  loop.fill = data["fill"] ?? false;
  loop.radius = data["radius"] ?? 1;
  loop.loopBeginAngle = data["loopBeginAngle"] ?? 0;
  loop.loopEndAngle = data["loopEndAngle"] ?? Math.PI * 2;
  const centerId = data["centerVertexId"];
  if (typeof centerId === "string") {
    loop.centerVertexId = centerId;
  }
  const origin = makeVector(data["origin"]);
  if (origin) {
    loop.origin = new Vertex(origin.x, origin.y);
  }
  return loop;
}
