export interface Config {
  scale: number;
  log: "ON" | "OFF" | "VER";
}

export let config: Config = {
  /// lattice size
  scale: 15,
  log: "VER",
};
