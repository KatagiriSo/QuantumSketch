import { Shape } from "./Shape";
import { Vector } from "./Vector";

export interface Elem {
  id: string;
  shape: Shape;
  formalDistance(point: Vector): number;
  move(delta: Vector): void;
  copy(): Elem;
  moveAbsolute(location: Vector): void;
  description(): string;
}

let elemIDCounter = 0;
export function getElemID(): string {
  let id = `${elemIDCounter}`;
  elemIDCounter++;
  return id;
}
