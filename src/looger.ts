import { config } from "./Config";

export function loggerVer(text: string) {
  if (config.log == "VER") {
    console.log(text);
  }
}

export function loggerOn(text: string) {
  if (config.log == "ON" || config.log == "VER") {
    console.log(text);
  }
}
