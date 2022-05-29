import { Color } from "../Core/Color";

export function getColor(color: Color): string {
  if (color == "normal") {
    return "rgb(0,0,0)";
  }

  if (color == "select") {
    return "rgb(255,0,0)";
  }

  if (color == "sub") {
    return "rgb(0,255,0)";
  }

  return "rgb(0,0,0)";
}
