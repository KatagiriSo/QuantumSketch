import { Elem, getElemID } from "./Elem";
import { Shape } from "./Shape";

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
