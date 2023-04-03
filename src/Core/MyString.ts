import { Elem, getElemID } from "./Elem";
import { Shape } from "./Shape";
import { Vector } from "./Vector";

/**
 * A MyString is a String that can be moved around the screen.
 * It has a unique ID, a Shape, and a location.
 * It can be moved by a delta, or moved to an absolute location.
 * It can be copied, and it can be saved to a JSON object.
 * It can also be described as a string.
 */
export class MyString implements Elem {
  id: string;
  shape: "String" = "String";
  label: string;
  origin: Vector = new Vector(0, 0);

  save(): any {
    let saveData = {} as any;
    saveData["id"] = this.id;
    saveData["label"] = this.label;
    saveData["shape"] = this.shape;
    saveData["origin"] = this.origin.save();
    return saveData;
  }

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

export function makeMyString(data: any): MyString | undefined {
  const shape = data["shape"] as Shape | undefined;
  if (shape) {
    return undefined;
  }
  const elm = new MyString("");
  elm.id = data["id"];
  elm.label = data["label"];
  return elm;
}