import { Elem, getElemID } from "./Elem";
import { Loop } from "./Loop";
import { Shape } from "./Shape";
import { makeVector, Vector } from "./Vector";

export type LineStyle = "normal" | "dash" | "wave" | "coil" | "double"; //
// wave https://stackoverflow.com/questions/29917446/drawing-sine-wave-in-canvas

/**
 * A Line is a Elem that is a line.
 * It has a label, a style, and a labelDiff.
 * It can be rotated, and it can be toggled.
 * It can be copied, and it can be saved to a JSON object.
 * It can also be described as a string.
 */
export class Line implements Elem {
  id: string;
  shape: "Line" = "Line";
  label: string = "";
  style: LineStyle = "normal";
  labelDiff: number = 0;
  allow: Boolean = true;
  origin: Vector = new Vector(0, 0);
  to: Vector = new Vector(0, 0);
  control: Vector | null = null;
  arrowRotation: number = 0;

  save(): any {
    let saveData = {} as any
    saveData["id"] = this.id
    saveData["label"] = this.label
    saveData["style"] = this.style;
    saveData["allow"] = this.allow;
    saveData["origin"] = this.origin.save();
    saveData["to"] = this.to.save();
    saveData["control"] = this.control ? this.control.save() : null;
    saveData["arrowRotation"] = this.arrowRotation;
    return saveData
  }

  copy(): Line {
    let line = new Line();
    line.label = this.label;
    line.style = this.style;
    line.labelDiff = line.labelDiff;
    line.allow = this.allow;
    line.origin = this.origin.copy();
    line.to = this.to.copy();
    line.control = this.control ? this.control.copy() : null;
    line.arrowRotation = this.arrowRotation;
    return line;
  }

  constructor(label?: string, style?: LineStyle) {
    this.id = getElemID();
    if (label) {
      this.label = label;
    }
    if (style) {
      this.style = style;
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
    if (this.control) {
      return this.pointAt(0.5);
    }
    return this.origin.add(this.to).multi(1 / 2);
  }

  formalDistance(point: Vector): number {
    const closest = this.closestPoint(point);
    return point.minus(closest).length();

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

  vector(): Vector {
    return this.to.minus(this.origin);
  }

  description(): string {
    return `${this.shape} id:${this.id} (${this.origin.x},${this.origin.y}) -> (${this.to.x}, ${this.to.y}) stayle:${this.style}`;
  }

  closestPoint(point: Vector): Vector {
    if (!this.control) {
      const direction = this.direction();
      const lengthSquared = direction.prod(direction);
      if (lengthSquared === 0) {
        return this.origin.copy();
      }
      const t = Math.max(
        0,
        Math.min(
          1,
          point
            .minus(this.origin)
            .prod(direction) / lengthSquared
        )
      );
      return new Vector(
        this.origin.x + direction.x * t,
        this.origin.y + direction.y * t
      );
    }
    let closest = this.origin.copy();
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
    t = Math.max(0, Math.min(1, t));
    if (this.control) {
      const oneMinusT = 1 - t;
      const term1 = this.origin.multi(oneMinusT * oneMinusT);
      const term2 = this.control.multi(2 * oneMinusT * t);
      const term3 = this.to.multi(t * t);
      return term1.add(term2).add(term3);
    }
    return this.origin.add(this.direction().multi(t));
  }

  tangentAt(t: number): Vector {
    t = Math.max(0, Math.min(1, t));
    if (this.control) {
      const term1 = this.control.minus(this.origin).multi(2 * (1 - t));
      const term2 = this.to.minus(this.control).multi(2 * t);
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
  if (shape) {
    return undefined;
  }
  const elm = new Line(undefined, undefined);
  elm.id = data["id"];
  elm.label = data["label"];
  elm.style = data["style"];
  elm.allow = data["allow"];
  elm.labelDiff = data["labelDiff"];
  elm.origin = makeVector(data["origin"]) ?? new Vector(0, 0);
  elm.to = makeVector(data["to"]) ?? new Vector(0, 0);
  const control = makeVector(data["control"]);
  elm.control = control ?? null;
  const arrowRotation = data["arrowRotation"];
  elm.arrowRotation = typeof arrowRotation === "number" ? arrowRotation : 0;

  return elm;
}
