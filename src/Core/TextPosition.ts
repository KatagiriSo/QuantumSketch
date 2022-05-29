import { Config } from "../Config";
import { Vector } from "./Vector";

export function textPosition(text: string, position: Vector, config: Config) {
  //TODO
  return position.add(new Vector(-3, +3)); // font 仮定
}
