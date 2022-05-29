import { Elem, getElemID } from "./Elem";
import { Vector } from "./Vector";

export class MyString implements Elem {
  id: string;
  shape: "String" = "String";
  label: string;
  origin: Vector = new Vector(0, 0);
  copy(): MyString {
    let str = new MyString(this.label);
    str.origin = this.origin;
    return str;
  }
  constructor(label: string) {
    this.id = getElemID();
    this.label = label;
  }

  move(delta: Vector): void {
    this.origin = this.origin.add(delta);
  }

  moveAbsolute(location: Vector): void {
    this.origin = location;
  }

  formalDistance(point: Vector): number {
    return this.origin.minus(point).length();
  }

  description(): string {
    return `${this.shape} id:${this.id} x:${this.origin.x} y:${this.origin.y} label:${this.label}`;
  }
}

export function isString(elem: Elem): elem is MyString {
  return elem.shape == "String";
}
