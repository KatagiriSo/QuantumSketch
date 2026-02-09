import { Elem, getElemID } from "./Elem";
import { Loop } from "./Loop";
import { Shape } from "./Shape";
import { Vector } from "./Vector";
import { Vertex } from "./Vertex";

export type LineStyle = "normal" | "dash" | "wave" | "coil" | "double";

/**
 * Graph edge. Geometry is resolved from vertex references.
 */
export class Line implements Elem {
  id: string;
  shape: "Line" = "Line";
  label: string = "";
  style: LineStyle = "normal";
  labelDiff: number = 0;
  allow: Boolean = true;
  control: Vector | null = null;
  arrowRotation: number = 0;

  startVertexId: string = "";
  endVertexId: string = "";

  private startVertex?: Vertex;
  private endVertex?: Vertex;
  private fallbackOrigin: Vector = new Vector(0, 0);
  private fallbackTo: Vector = new Vector(0, 0);

  constructor(label?: string, style?: LineStyle) {
    this.id = getElemID();
    if (label) {
      this.label = label;
    }
    if (style) {
      this.style = style;
    }
  }

  save(): any {
    const saveData = {} as any;
    saveData["id"] = this.id;
    saveData["shape"] = this.shape;
    saveData["label"] = this.label;
    saveData["style"] = this.style;
    saveData["allow"] = this.allow;
    saveData["labelDiff"] = this.labelDiff;
    saveData["arrowRotation"] = this.arrowRotation;
    saveData["control"] = this.control ? this.control.save() : null;
    saveData["startVertexId"] = this.startVertexId;
    saveData["endVertexId"] = this.endVertexId;
    saveData["origin"] = this.origin.save();
    saveData["to"] = this.to.save();
    return saveData;
  }

  copy(): Line {
    const line = new Line();
    line.id = this.id;
    line.label = this.label;
    line.style = this.style;
    line.labelDiff = this.labelDiff;
    line.allow = this.allow;
    line.control = this.control ? this.control.copy() : null;
    line.arrowRotation = this.arrowRotation;
    line.startVertexId = this.startVertexId;
    line.endVertexId = this.endVertexId;
    line.startVertex = this.startVertex;
    line.endVertex = this.endVertex;
    line.fallbackOrigin = this.fallbackOrigin.copy();
    line.fallbackTo = this.fallbackTo.copy();
    return line;
  }

  bindVertices(start: Vertex, end: Vertex): void {
    this.startVertex = start;
    this.endVertex = end;
    this.startVertexId = start.id;
    this.endVertexId = end.id;
    this.fallbackOrigin = start.copy();
    this.fallbackTo = end.copy();
  }

  bindStartVertex(start: Vertex): void {
    this.startVertex = start;
    this.startVertexId = start.id;
    this.fallbackOrigin = start.copy();
  }

  bindEndVertex(end: Vertex): void {
    this.endVertex = end;
    this.endVertexId = end.id;
    this.fallbackTo = end.copy();
  }

  resolveVertices(start?: Vertex, end?: Vertex): void {
    if (start) {
      this.bindStartVertex(start);
    }
    if (end) {
      this.bindEndVertex(end);
    }
  }

  get origin(): Vertex {
    if (this.startVertex) {
      return this.startVertex;
    }
    const detached = new Vertex(this.fallbackOrigin.x, this.fallbackOrigin.y);
    detached.id = this.startVertexId || detached.id;
    this.startVertex = detached;
    this.startVertexId = detached.id;
    return detached;
  }

  set origin(value: Vector) {
    if (value instanceof Vertex) {
      this.bindStartVertex(value);
      return;
    }
    const detached = new Vertex(value.x, value.y);
    this.bindStartVertex(detached);
  }

  get to(): Vertex {
    if (this.endVertex) {
      return this.endVertex;
    }
    const detached = new Vertex(this.fallbackTo.x, this.fallbackTo.y);
    detached.id = this.endVertexId || detached.id;
    this.endVertex = detached;
    this.endVertexId = detached.id;
    return detached;
  }

  set to(value: Vector) {
    if (value instanceof Vertex) {
      this.bindEndVertex(value);
      return;
    }
    const detached = new Vertex(value.x, value.y);
    this.bindEndVertex(detached);
  }

  rotation(angle: number): void {
    const center = this.center();
    const unit = this.directionUnit();
    const length = this.length();
    const rotated = unit.rotation(angle);
    this.origin.moveAbsolute(center.add(rotated.multi(-length / 2)));
    this.to.moveAbsolute(center.add(rotated.multi(length / 2)));
  }

  move(delta: Vector): void {
    this.origin.move(delta);
    this.to.move(delta);
  }

  moveAbsolute(location: Vector): void {
    const length = this.length();
    const unit = this.directionUnit();
    this.origin.moveAbsolute(location.add(unit.multi(-length / 2)));
    this.to.moveAbsolute(location.add(unit.multi(length / 2)));
  }

  length(): number {
    return this.to.minus(this.origin).length();
  }

  toggle(): void {
    const start = this.origin;
    const end = this.to;
    this.bindVertices(end, start);
  }

  direction(): Vector {
    return this.to.minus(this.origin);
  }

  directionUnit(): Vector {
    const length = this.length();
    if (length === 0) {
      return new Vector(1, 0);
    }
    return this.direction().multi(1 / length);
  }

  addLoopOrigin(loop: Loop): void {
    loop.origin = this.origin.minus(this.directionUnit().multi(loop.radius));
  }

  addLoopTo(loop: Loop): void {
    loop.origin = this.to.add(this.directionUnit().multi(loop.radius));
  }

  between(loop1: Loop, loop2: Loop): void {
    this.to = loop1.origin.copy();
    this.origin = loop2.origin.copy();
    loop1.addLineTo(this);
    loop2.addLineOrigin(this);
  }

  center(): Vector {
    if (this.control) {
      return this.pointAt(0.5);
    }
    return this.origin.add(this.to).multi(0.5);
  }

  formalDistance(point: Vector): number {
    const closest = this.closestPoint(point);
    return point.minus(closest).length();
  }

  vector(): Vector {
    return this.to.minus(this.origin);
  }

  description(): string {
    return `${this.shape} id:${this.id} (${this.origin.x},${this.origin.y}) -> (${this.to.x}, ${this.to.y}) style:${this.style}`;
  }

  closestPoint(point: Vector): Vector {
    if (!this.control) {
      const direction = this.direction();
      const lengthSquared = direction.prod(direction);
      if (lengthSquared === 0) {
        return this.origin.copy();
      }
      const t = Math.max(0, Math.min(1, point.minus(this.origin).prod(direction) / lengthSquared));
      return new Vector(this.origin.x + direction.x * t, this.origin.y + direction.y * t);
    }

    let closest: Vector = this.origin.copy();
    let minDistance = Number.POSITIVE_INFINITY;
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const sample = this.pointAt(t);
      const distance = point.minus(sample).length();
      if (distance < minDistance) {
        minDistance = distance;
        closest = sample;
      }
    }
    return closest;
  }

  pointAt(t: number): Vector {
    const clamped = Math.max(0, Math.min(1, t));
    if (this.control) {
      const oneMinusT = 1 - clamped;
      const term1 = this.origin.multi(oneMinusT * oneMinusT);
      const term2 = this.control.multi(2 * oneMinusT * clamped);
      const term3 = this.to.multi(clamped * clamped);
      return term1.add(term2).add(term3);
    }
    return this.origin.add(this.direction().multi(clamped));
  }

  tangentAt(t: number): Vector {
    const clamped = Math.max(0, Math.min(1, t));
    if (this.control) {
      const term1 = this.control.minus(this.origin).multi(2 * (1 - clamped));
      const term2 = this.to.minus(this.control).multi(2 * clamped);
      return term1.add(term2);
    }
    return this.direction();
  }
}

export function isLine(elem: Elem): elem is Line {
  return elem.shape == "Line";
}

export function makeLine(data: any): Line | undefined {
  const shape = data["shape"] as Shape | undefined;
  if (shape && shape !== "Line") {
    return undefined;
  }

  const line = new Line();
  line.id = data["id"] ?? line.id;
  line.label = data["label"] ?? "";
  line.style = data["style"] ?? "normal";
  line.allow = data["allow"] ?? true;
  line.labelDiff = data["labelDiff"] ?? 0;
  line.arrowRotation = typeof data["arrowRotation"] === "number" ? data["arrowRotation"] : 0;

  const origin = data["origin"];
  const to = data["to"];
  if (origin && typeof origin.x === "number" && typeof origin.y === "number") {
    line.origin = new Vertex(origin.x, origin.y);
  }
  if (to && typeof to.x === "number" && typeof to.y === "number") {
    line.to = new Vertex(to.x, to.y);
  }

  line.startVertexId = data["startVertexId"] ?? line.startVertexId;
  line.endVertexId = data["endVertexId"] ?? line.endVertexId;

  const control = data["control"];
  if (control && typeof control.x === "number" && typeof control.y === "number") {
    line.control = new Vector(control.x, control.y);
  } else {
    line.control = null;
  }

  return line;
}
