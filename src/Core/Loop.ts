import { Elem, getElemID } from "./Elem";
import { LabelInfo } from "./LabelInfo";
import { LineStyle, Line } from "./Line";
import { Shape } from "./Shape";
import { Vector, direction, makeVector } from "./Vector";

export class Loop implements Elem {
  id: string;
  shape: "Loop" = "Loop";
  style: LineStyle = "normal";
  allow: Boolean = false;
  fill: boolean = false;
  origin: Vector = new Vector(0, 0);
  radius: number = 1;
  label: string = "";
  labels: LabelInfo[] = [];
  loopBeginAngle: number = 0;
  loopEndAngle: number = Math.PI * 2;

  save(): any {
    let saveData = {} as any;
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

    return saveData;
  }

  copy(): Loop {
    let loop = new Loop();
    loop.fill = this.fill;
    loop.origin = this.origin;
    loop.radius = this.radius;
    loop.label = this.label;
    loop.labels = this.labels;
    loop.style = this.style;
    loop.loopBeginAngle = this.loopBeginAngle;
    loop.loopEndAngle = this.loopEndAngle;
    return loop;
  }

  constructor(label?: string, origin?: Vector) {
    this.id = getElemID();
    if (label) {
      this.label = label;
    }
    if (origin) {
      this.origin = origin;
    }
  }

  setLoopBeginAngle(angle: number): void {
    if (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    if (angle < 0.0         ) angle += 2 * Math.PI;
    this.loopBeginAngle = angle;
  }

  setLoopEndAngle(angle: number): void {
    if (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    if (angle < 0           ) angle += 2 * Math.PI;
    this.loopEndAngle = angle;
  }

  setRadius(radius: number): void {
    if (radius < 1) radius = 1;
    this.radius = radius;
  }

  move(delta: Vector): void {
    this.origin = this.origin.add(delta);
  }

  moveAbsolute(location: Vector): void {
    this.origin = location;
  }

  rotation(delta: number): void {
    this.setLoopBeginAngle(this.loopBeginAngle + delta);
    this.setLoopEndAngle(this.loopEndAngle + delta);
  }

  addLineTo(line: Line) {
    line.to = this.origin.add(
      direction(line.origin, this.origin).unit().multi(this.radius)
    );
  }
  addLineOrigin(line: Line) {
    line.origin = this.origin.add(
      direction(line.to, this.origin).unit().multi(this.radius)
    );
  }

  formalDistance(point: Vector): number {
    let length = this.origin.minus(point).length();
    if (length < this.radius) {
      return 0;
    }
    return Number.MAX_VALUE;
  }

  description(): string {
    return `${this.shape} id:${this.id} (${this.origin.x},${
      this.origin.y
    }) radius = ${this.radius} angle = (${
      this.loopBeginAngle * (360 / (2 * Math.PI))
    }, ${this.loopEndAngle * (360 / (2 * Math.PI))}) stayle:${this.style}`;
  }
}

export function isLoop(elem: Elem): elem is Loop {
  return elem.shape == "Loop";
}

export function makeLoop(data: any): Loop | undefined {
  const shape = data["shape"] as Shape | undefined;
  if (shape) {
    return undefined;
  }
  const elm = new Loop(undefined, undefined);
  elm.id = data["id"];
  elm.label = data["label"];
  elm.style = data["style"];
  elm.allow = data["allow"];
  elm.fill = data["fill"];
  elm.origin = makeVector(data["origin"]) ?? new Vector(0, 0);
  elm.loopBeginAngle = data["loopBeginAngle"];
  elm.loopEndAngle = data["loopEndAngle"];
  return elm;
}