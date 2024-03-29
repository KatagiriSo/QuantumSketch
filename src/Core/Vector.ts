import { Elem, getElemID } from "./Elem";
import { Shape } from "./Shape";

/**
 * A Vector is a point in 2D space.
 * It has a unique ID, a Shape, and a location.
 * It can be moved by a delta, or moved to an absolute location.
 * It can be copied, and it can be saved to a JSON object.
 * It can also be described as a string.
 * It can be added to another Vector, or subtracted from another Vector.
 * It can be multiplied by a number.
 * It can be rotated by an angle.
 * It can be converted to a unit vector.
 * It can be converted to a floor vector.
 * It can be converted to a vector with integer coordinates.
 */
export class Vector implements Elem {
  id: string;
  shape: Shape = "Point";
  x: number = 0;
  y: number = 0;
  constructor(x: number, y: number) {
    this.id = getElemID();
    this.x = x;
    this.y = y;
  }

  save(): any {
    const saveData = {} as any
    saveData["id"] = this.id
    saveData["shape"] = this.shape
    saveData["x"] = this.x
    saveData["y"] = this.x;
    return saveData
  }

  add(vec: Vector): Vector {
    return new Vector(this.x + vec.x, this.y + vec.y);
  }
  minus(vec: Vector): Vector {
    return new Vector(this.x - vec.x, this.y - vec.y);
  }
  length(): number {
    return (this.x ** 2 + this.y ** 2) ** (1 / 2);
  }
  multi(num: number): Vector {
    return new Vector(this.x * num, this.y * num);
  }

  floor(): Vector {
    return new Vector(Math.floor(this.x), Math.floor(this.y));
  }

  prod(vec: Vector): number {
    return this.x * vec.x + this.y * vec.y;
  }

  unit(): Vector {
    return new Vector(
      this.x * (1 / this.length()),
      this.y * (1 / this.length())
    );
  }
  copy(): Vector {
    return new Vector(this.x, this.y);
  }

  rotation(angle: number): Vector {
    return new Vector(
      this.x * Math.cos(angle) - this.y * Math.sin(angle),
      this.x * Math.sin(angle) + this.y * Math.cos(angle)
    );
  }

  formalDistance(point: Vector): number {
    return (length = this.minus(point).length());
    // if (length > 0.3) {
    //   return Number.MAX_VALUE;
    // }
    // return 0;
  }

  move(delta: Vector): void {
    let vector = this.add(delta);
    this.x = vector.x;
    this.y = vector.y;
  }

  moveAbsolute(location: Vector): void {
    this.x = location.x;
    this.y = location.y;
  }

  description(): string {
    return `${this.shape} id:${this.id} x:${this.x} y:${this.y}`;
  }
}

export function isVector(elem: Elem): elem is Vector {
  return elem.shape == "Point";
}

export function direction(v1: Vector, v2: Vector): Vector {
  return v1.minus(v2);
}


export function makeVector(data: any): Vector|undefined {
  const shape = data["shape"] as Shape | undefined
  if (shape) {
    return undefined
  }
  const elm = new Vector(0,0)
  elm.id = data["id"];
  elm.x = data["x"];
  elm.y = data["y"];
  return elm
}