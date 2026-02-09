import { Shape } from "./Shape";
import { Vector } from "./Vector";

/**
 * An Elem is a Shape that can be moved around the screen.
 * It has a unique ID, a Shape, and a location.
 * It can be moved by a delta, or moved to an absolute location.
 * It can be copied, and it can be saved to a JSON object.
 * It can also be described as a string.
 */
export interface Elem {
  id: string;
  shape: Shape;
  formalDistance(point: Vector): number;
  move(delta: Vector): void;
  copy(): Elem;
  moveAbsolute(location: Vector): void;
  description(): string;
  save() : any
}

let elemIDCounter = 0;
// ElemIDCounter is a global variable that is used to generate unique IDs for
export function getElemID(): string {
  let id = `${elemIDCounter}`;
  elemIDCounter++;
  return id;
}

export function setElemIDCounter(next: number): void {
  elemIDCounter = Math.max(0, Math.floor(next));
}

export function getElemIDCounter(): number {
  return elemIDCounter;
}
