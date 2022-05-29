import { Elem, getElemID } from "./Elem";
import { LabelInfo } from "./LabelInfo";
import { LineStyle, Line } from "./Line";
import { Vector, direction } from "./Vector";

export class Loop implements Elem {
  id: string;
  shape: "Loop" = "Loop";
  style: LineStyle = "normal";
  fill: boolean = false;
  origin: Vector = new Vector(0, 0);
  radius: number = 1;
  label: string = "";
  labels: LabelInfo[] = [];
  loopBeginAngle: number = 0;
  loopEndAngle: number = Math.PI * 2;

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

  constructor(label?: string) {
    this.id = getElemID();
    if (label) {
      this.label = label;
    }
  }

  move(delta: Vector): void {
    this.origin = this.origin.add(delta);
  }

  moveAbsolute(location: Vector): void {
    this.origin = location;
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
