import { Elem, getElemID } from "./Elem";
import { Loop } from "./Loop";
import { Vector } from "./Vector";

export type LineStyle = "normal" | "dash" | "wave" | "coil"; //
// wave https://stackoverflow.com/questions/29917446/drawing-sine-wave-in-canvas

export class Line implements Elem {
  id: string;
  shape: "Line" = "Line";
  label: string = "";
  style: LineStyle = "normal";
  labelDiff: number = 0;
  allow: Boolean = true;
  origin: Vector = new Vector(0, 0);
  to: Vector = new Vector(0, 0);

  copy(): Line {
    let line = new Line();
    line.label = this.label;
    line.style = this.style;
    line.labelDiff = line.labelDiff;
    line.allow = this.allow;
    line.origin = this.origin;
    line.to = this.to;
    return line;
  }

  constructor(label?: string, style?: LineStyle) {
    this.id = getElemID();
    if (label) {
      this.label = label;
    }
      if (style) {
        this.style = style
    }
  }

  rotation(angle: number) {
    let centerOrigin = this.center();
    let unitVec = this.directionUnit();
    let length = this.length();
    let rotatedUnitVec = unitVec.rotation(angle);
    this.origin = centerOrigin.add(rotatedUnitVec.multi(-length / 2));
    this.to = centerOrigin.add(rotatedUnitVec.multi(length / 2));
  }

  move(delta: Vector): void {
    this.origin = this.origin.add(delta);
    this.to = this.to.add(delta);
  }

  moveAbsolute(location: Vector): void {
    const length = this.length();
    const unitVec = this.directionUnit();
    this.origin = location.add(unitVec.multi(-length / 2));
    this.to = location.add(unitVec.multi(+length / 2));
  }

  length(): number {
    return this.to.minus(this.origin).length();
  }

  toggle() {
    let o = this.origin;
    this.origin = this.to;
    this.to = o;
  }

  direction(): Vector {
    return this.to.minus(this.origin);
  }

  directionUnit(): Vector {
    return this.direction().multi(1 / this.length());
  }

  addLoopOrigin(loop: Loop) {
    loop.origin = this.origin.minus(this.directionUnit().multi(loop.radius));
  }

  addLoopTo(loop: Loop) {
    loop.origin = this.to.add(this.directionUnit().multi(loop.radius));
  }

  between(loop1: Loop, loop2: Loop) {
    this.to = loop1.origin.copy();
    this.origin = loop2.origin.copy();
    loop1.addLineTo(this);
    loop2.addLineOrigin(this);
  }

  center(): Vector {
    return this.origin.add(this.to).multi(1 / 2);
  }

  formalDistance(point: Vector): number {
    let perp_unit = this.directionUnit().rotation(Math.PI / 2);
    let diff = point.minus(this.origin);
    return Math.abs(diff.prod(perp_unit));

    // let toLength = this.to.minus(point).length()
    // let originLength = this.origin.minus(point).length()
    // if (toLength < originLength) {
    //     if (toLength > 2) {
    //         return toLength
    //     }
    //     return toLength + 1
    // }
    // if (originLength > 2) {
    //     return originLength
    // }
    // return originLength + 1
  }

  description(): string {
    return `${this.shape} id:${this.id} (${this.origin.x},${this.origin.y}) -> (${this.to.x}, ${this.to.y}) stayle:${this.style}`;
  }
}

export function isLine(elem: Elem): elem is Line {
  return elem.shape == "Line";
}
