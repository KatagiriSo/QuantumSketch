import { Line, LineStyle } from "../Core/Line";
import { Loop } from "../Core/Loop";
import { Vector } from "../Core/Vector";
import { Vertex } from "../Core/Vertex";
import { RDRepository } from "../UI/RDRepository";
import { SetLine, SetLoop, SetVertex } from "../UI/RepositoryCommand";

const LINE_STYLES: ReadonlyArray<LineStyle> = ["normal", "dash", "wave", "coil", "double"];

type DirectionKeyword =
  | "right" | "left" | "up" | "down"
  | "ur" | "ul" | "dr" | "dl"
  | "upright" | "upleft" | "downright" | "downleft";

const DIRECTION_VECTORS: Record<DirectionKeyword, Vector> = {
  right: new Vector(1, 0),
  left: new Vector(-1, 0),
  up: new Vector(0, -1),
  down: new Vector(0, 1),
  ur: new Vector(1, -1),
  ul: new Vector(-1, -1),
  dr: new Vector(1, 1),
  dl: new Vector(-1, 1),
  upright: new Vector(1, -1),
  upleft: new Vector(-1, -1),
  downright: new Vector(1, 1),
  downleft: new Vector(-1, 1),
};

function isLineStyle(style: string): style is LineStyle {
  return LINE_STYLES.includes(style as LineStyle);
}

function particleToStyle(raw?: string): LineStyle {
  if (!raw) {
    return "normal";
  }
  const token = raw.toLowerCase();
  if (isLineStyle(token)) {
    return token;
  }
  if (token === "photon") {
    return "wave";
  }
  if (token === "gluon") {
    return "coil";
  }
  if (token === "electron" || token === "fermion") {
    return "normal";
  }
  return "normal";
}

export interface ScriptExecutionResult {
  success: boolean;
  command: string;
  message: string;
  line?: number;
}

export interface ScriptBatchExecutionResult {
  success: boolean;
  message: string;
  executed: number;
  total: number;
  failedLine?: number;
  results: ScriptExecutionResult[];
}

export interface ScriptTemplateInfo {
  name: string;
  label: string;
  description: string;
}

export class ScriptEngine {
  private repository: RDRepository;
  private cursorVertexId?: string;
  private branchStack: string[] = [];
  private forceJoinCleanupMode = false;

  private static readonly TEMPLATE_CATALOG: ScriptTemplateInfo[] = [
    { name: "qed_box", label: "QED Box", description: "1-loop 4-point box scattering with four external photons." },
    { name: "qed_vertex", label: "QED Vertex", description: "One-loop vertex correction with external photon leg." },
    { name: "qed_vac", label: "QED Vacuum", description: "Vacuum polarization: photon line with fermion loop insertion." },
    { name: "penguin", label: "Penguin", description: "Flavor-changing penguin-like topology with emitted gluon." },
    { name: "compton", label: "Compton", description: "Tree-level Compton-like electron-photon scattering." },
    { name: "s_channel", label: "s-channel", description: "Two-into-two scattering through s-channel propagator." },
    { name: "triangle", label: "Triangle", description: "Triangle loop with three external boson legs." },
    { name: "t_channel", label: "t-channel", description: "Two-into-two scattering through t-channel mediator." },
    { name: "w_exchange", label: "W Exchange", description: "Charged-current style exchange skeleton." },
    { name: "bhabha_t", label: "Bhabha t", description: "Bhabha-like t-channel exchange topology." },
    { name: "sunset", label: "Sunset", description: "Two-loop self-energy inspired sunset motif." },
    { name: "double_box", label: "Double Box", description: "Two adjacent loop boxes for higher-order amplitudes." },
  ];

  constructor(repository: RDRepository) {
    this.repository = repository;
  }

  getTemplateCatalog(): ScriptTemplateInfo[] {
    return ScriptEngine.TEMPLATE_CATALOG.map((item) => ({ ...item }));
  }

  buildTemplateMacro(templateName: string, x = 20, y = 20): string | null {
    const name = templateName.toLowerCase();
    const xRounded = Number(x.toFixed(2));
    const yRounded = Number(y.toFixed(2));

    switch (name) {
      case "qed_box":
      case "qed_vertex":
      case "qed_vac":
      case "qed_vacuum":
      case "penguin":
      case "compton":
      case "s_channel":
      case "schannel":
      case "triangle":
      case "anomaly_triangle":
      case "t_channel":
      case "tchannel":
      case "w_exchange":
      case "bhabha_t":
      case "sunset":
      case "double_box":
        return `# Template macro (editable)\nstart ${xRounded} ${yRounded}\ntemplate ${name}`;
      default:
        return null;
    }
  }

  execute(input: string): ScriptExecutionResult {
    const command = input.trim();
    if (!command) {
      return { success: false, command: "", message: "Command is empty." };
    }
    const error = this.executeCommand(command);
    if (error) {
      return { success: false, command, message: error };
    }
    return { success: true, command, message: "Command executed." };
  }

  executeScript(input: string, stopOnError = true): ScriptBatchExecutionResult {
    const commands = this.parseScriptLines(input);
    if (commands.length === 0) {
      return { success: false, message: "No executable commands found.", executed: 0, total: 0, results: [] };
    }

    const results: ScriptExecutionResult[] = [];
    let executed = 0;

    for (let i = 0; i < commands.length; i++) {
      const lineInfo = commands[i];
      const error = this.executeCommand(lineInfo.command);
      if (error) {
        const failure: ScriptExecutionResult = {
          success: false,
          command: lineInfo.command,
          line: lineInfo.line,
          message: error,
        };
        results.push(failure);
        if (stopOnError) {
          return {
            success: false,
            message: `Failed at line ${lineInfo.line}: ${error}`,
            executed,
            total: commands.length,
            failedLine: lineInfo.line,
            results,
          };
        }
        continue;
      }

      executed += 1;
      results.push({
        success: true,
        command: lineInfo.command,
        line: lineInfo.line,
        message: "Command executed.",
      });
    }

    const allSuccess = results.every((result) => result.success);
    if (!allSuccess) {
      return {
        success: false,
        message: `Executed ${executed}/${commands.length} commands with errors.`,
        executed,
        total: commands.length,
        results,
      };
    }

    return {
      success: true,
      message: `Executed ${executed}/${commands.length} commands.`,
      executed,
      total: commands.length,
      results,
    };
  }

  private parseScriptLines(input: string): Array<{ line: number; command: string }> {
    const lines = input.split(/\r?\n/);
    const commands: Array<{ line: number; command: string }> = [];

    lines.forEach((sourceLine, index) => {
      const lineNumber = index + 1;
      const chunks = sourceLine.split(";");
      chunks.forEach((chunk) => {
        const command = this.stripComments(chunk).trim();
        if (!command) {
          return;
        }
        commands.push({ line: lineNumber, command });
      });
    });

    return commands;
  }

  private stripComments(text: string): string {
    const hashIndex = text.indexOf("#");
    const slashIndex = text.indexOf("//");
    let cutIndex = -1;
    if (hashIndex >= 0) {
      cutIndex = hashIndex;
    }
    if (slashIndex >= 0 && (cutIndex < 0 || slashIndex < cutIndex)) {
      cutIndex = slashIndex;
    }
    if (cutIndex < 0) {
      return text;
    }
    return text.slice(0, cutIndex);
  }

  private executeCommand(commandText: string): string | null {
    const tokens = commandText.split(/\s+/);
    if (tokens.length === 0) {
      return "Command is empty.";
    }

    const command = tokens[0].toLowerCase();

    switch (command) {
      case "move":
      case "start":
        return this.executeMove(tokens);
      case "line":
      case "prop":
        return this.executeLineCommand(tokens);
      case "loop":
        return this.executeLoop(tokens);
      case "branch":
        return this.executeBranch();
      case "next":
        return this.executeNext();
      case "join":
        return this.executeJoin(tokens);
      case "join_mode":
      case "join_cleanup":
        return this.executeJoinMode(tokens);
      case "template":
        return this.executeTemplate(tokens);
      case "qed_se":
        return this.executeQEDSelfEnergy(tokens);
      case "qed_vp":
        return this.executeQEDVacuumPolarization(tokens);
      default:
        return `Unknown command '${command}'.`;
    }
  }

  private executeMove(tokens: string[]): string | null {
    if (tokens.length !== 3) {
      return "Usage: move x y";
    }
    const x = Number(tokens[1]);
    const y = Number(tokens[2]);
    if (![x, y].every((value) => Number.isFinite(value))) {
      return "move arguments must be numeric.";
    }
    const vertex = this.getOrCreateVertex(new Vector(x, y));
    this.cursorVertexId = vertex.id;
    return null;
  }

  private executeLineCommand(tokens: string[]): string | null {
    if (tokens.length >= 5) {
      const maybeX1 = Number(tokens[1]);
      const maybeY1 = Number(tokens[2]);
      const maybeX2 = Number(tokens[3]);
      const maybeY2 = Number(tokens[4]);
      if ([maybeX1, maybeY1, maybeX2, maybeY2].every((value) => Number.isFinite(value))) {
        return this.executeAbsoluteLine(tokens, maybeX1, maybeY1, maybeX2, maybeY2);
      }
    }
    return this.executeRelativeLine(tokens);
  }

  private executeAbsoluteLine(tokens: string[], x1: number, y1: number, x2: number, y2: number): string | null {
    if (tokens.length < 5 || tokens.length > 6) {
      return "Usage: line|prop x1 y1 x2 y2 [particle|style]";
    }
    const start = this.getOrCreateVertex(new Vector(x1, y1), 0.25);
    const end = this.getOrCreateVertex(new Vector(x2, y2), 0.25);
    const line = new Line();
    line.style = particleToStyle(tokens[5]);
    this.repository.bindLineToVertices(line, start, end);
    this.repository.doCommand(new SetLine(line));
    this.cursorVertexId = end.id;
    return null;
  }

  private executeRelativeLine(tokens: string[]): string | null {
    if (tokens.length < 3 || tokens.length > 4) {
      return "Usage: line|prop direction length [particle|style]";
    }

    const current = this.getCursorVertex();
    if (!current) {
      return "Cursor is not set. Use 'move x y' or 'start x y' first.";
    }

    const directionRaw = tokens[1].toLowerCase() as DirectionKeyword;
    const unit = DIRECTION_VECTORS[directionRaw];
    if (!unit) {
      return `Unknown direction '${tokens[1]}'. Use right/left/up/down/ur/ul/dr/dl.`;
    }

    const length = Number(tokens[2]);
    if (!Number.isFinite(length) || length <= 0) {
      return "length must be a positive number.";
    }

    const targetPoint = current.add(unit.unit().multi(length));
    const nextVertex = this.getOrCreateVertex(targetPoint, 0.45);

    const line = new Line();
    line.style = particleToStyle(tokens[3]);
    this.repository.bindLineToVertices(line, current, nextVertex);
    this.repository.doCommand(new SetLine(line));

    this.cursorVertexId = nextVertex.id;
    return null;
  }

  private executeLoop(tokens: string[]): string | null {
    if (tokens.length >= 4) {
      const x = Number(tokens[1]);
      const y = Number(tokens[2]);
      const radius = Number(tokens[3]);
      if ([x, y, radius].every((value) => Number.isFinite(value))) {
        return this.executeAbsoluteLoop(tokens, x, y, radius);
      }
    }
    if (tokens.length < 2 || tokens.length > 5) {
      return "Usage: loop radius [style] [beginAngle] [endAngle] | loop x y radius [style] [beginAngle] [endAngle]";
    }
    const current = this.getCursorVertex();
    if (!current) {
      return "Cursor is not set. Use 'move x y' first.";
    }

    const radius = Number(tokens[1]);
    if (!Number.isFinite(radius) || radius <= 0) {
      return "loop radius must be a positive number.";
    }

    const loop = new Loop();
    loop.setRadius(radius);
    loop.origin = current;
    this.applyLoopOptionTokens(loop, tokens.slice(2));
    this.repository.doCommand(new SetLoop(loop));
    return null;
  }

  private executeAbsoluteLoop(tokens: string[], x: number, y: number, radius: number): string | null {
    if (tokens.length < 4 || tokens.length > 7) {
      return "Usage: loop x y radius [style] [beginAngle] [endAngle]";
    }
    if (radius <= 0) {
      return "loop radius must be a positive number.";
    }
    const center = this.getOrCreateVertex(new Vector(x, y), 0.25);
    const loop = new Loop();
    loop.origin = center;
    loop.setRadius(radius);
    this.applyLoopOptionTokens(loop, tokens.slice(4));
    this.repository.doCommand(new SetLoop(loop));
    this.cursorVertexId = center.id;
    return null;
  }

  private applyLoopOptionTokens(loop: Loop, options: string[]): void {
    if (options.length === 0) {
      return;
    }
    const styleToken = options[0]?.toLowerCase();
    if (styleToken && isLineStyle(styleToken)) {
      loop.style = styleToken;
    }
    if (options.length >= 3) {
      const begin = Number(options[1]);
      const end = Number(options[2]);
      if (Number.isFinite(begin) && Number.isFinite(end)) {
        loop.loopBeginAngle = begin;
        loop.loopEndAngle = end;
      }
    }
  }

  private executeBranch(): string | null {
    const current = this.getCursorVertex();
    if (!current) {
      return "Cursor is not set. Use 'move x y' first.";
    }
    this.branchStack.push(current.id);
    return null;
  }

  private executeNext(): string | null {
    if (this.branchStack.length === 0) {
      return "No branch anchor. Use 'branch' first.";
    }
    const id = this.branchStack[this.branchStack.length - 1];
    const vertex = this.repository.getVertex(id);
    if (!vertex) {
      return "Branch anchor vertex no longer exists.";
    }
    this.cursorVertexId = vertex.id;
    return null;
  }

  private executeJoin(tokens: string[]): string | null {
    const current = this.getCursorVertex();
    if (!current) {
      return "Cursor is not set. Use 'move x y' first.";
    }

    let tolerance = 1.2;
    let forceCleanup = this.forceJoinCleanupMode;

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i].toLowerCase();
      const numeric = Number(token);
      if (Number.isFinite(numeric)) {
        if (numeric <= 0) {
          return "join tolerance must be a positive number.";
        }
        tolerance = numeric;
        continue;
      }
      if (token === "force" || token === "strict" || token === "cleanup") {
        forceCleanup = true;
        continue;
      }
      if (token === "soft" || token === "normal") {
        forceCleanup = false;
        continue;
      }
      return "Usage: join [tolerance] [force|soft]";
    }

    const near = this.repository.findNearestVertex(current, tolerance, current.id);
    if (!near) {
      return "No nearby vertex to join.";
    }
    this.repository.mergeVertexInto(current, near);
    if (forceCleanup) {
      this.repository.cleanupDanglingVertices();
    }
    this.cursorVertexId = near.id;
    return null;
  }

  private executeJoinMode(tokens: string[]): string | null {
    if (tokens.length !== 2) {
      return "Usage: join_mode on|off (alias: join_cleanup on|off)";
    }
    const value = tokens[1].toLowerCase();
    if (value === "on" || value === "true" || value === "force" || value === "strict") {
      this.forceJoinCleanupMode = true;
      return null;
    }
    if (value === "off" || value === "false" || value === "soft" || value === "normal") {
      this.forceJoinCleanupMode = false;
      return null;
    }
    return "join_mode expects on|off.";
  }

  private executeTemplate(tokens: string[]): string | null {
    if (tokens.length < 2) {
      return "Usage: template qed_box|qed_vertex|qed_vac|penguin|compton|s_channel|triangle|t_channel|w_exchange|bhabha_t|sunset|double_box";
    }
    const name = tokens[1].toLowerCase();
    const anchor = this.getCursorVertex() ?? this.getOrCreateVertex(new Vector(20, 20), 0.0);

    switch (name) {
      case "qed_box":
        this.createTemplateQEDBox(anchor);
        return null;
      case "qed_vertex":
        this.createTemplateQEDVertex(anchor);
        return null;
      case "qed_vac":
      case "qed_vacuum":
        this.createTemplateQEDVacuum(anchor);
        return null;
      case "penguin":
        this.createTemplatePenguin(anchor);
        return null;
      case "compton":
        this.createTemplateCompton(anchor);
        return null;
      case "s_channel":
      case "schannel":
        this.createTemplateSChannel(anchor);
        return null;
      case "triangle":
      case "anomaly_triangle":
        this.createTemplateTriangle(anchor);
        return null;
      case "t_channel":
      case "tchannel":
        this.createTemplateTChannel(anchor);
        return null;
      case "w_exchange":
        this.createTemplateWExchange(anchor);
        return null;
      case "bhabha_t":
        this.createTemplateBhabhaT(anchor);
        return null;
      case "sunset":
        this.createTemplateSunset(anchor);
        return null;
      case "double_box":
        this.createTemplateDoubleBox(anchor);
        return null;
      default:
        return `Unknown template '${name}'.`;
    }
  }

  private createTemplateQEDBox(anchor: Vertex): void {
    const size = 8;
    const arm = 6;
    const half = size / 2;

    const v1 = this.getOrCreateVertex(new Vector(anchor.x - half, anchor.y - half), 0.01);
    const v2 = this.getOrCreateVertex(new Vector(anchor.x + half, anchor.y - half), 0.01);
    const v3 = this.getOrCreateVertex(new Vector(anchor.x + half, anchor.y + half), 0.01);
    const v4 = this.getOrCreateVertex(new Vector(anchor.x - half, anchor.y + half), 0.01);

    this.createLine(v1, v2, "normal");
    this.createLine(v2, v3, "normal");
    this.createLine(v3, v4, "normal");
    this.createLine(v4, v1, "normal");

    const o1 = this.getOrCreateVertex(new Vector(v1.x - arm, v1.y - arm), 0.01);
    const o2 = this.getOrCreateVertex(new Vector(v2.x + arm, v2.y - arm), 0.01);
    const o3 = this.getOrCreateVertex(new Vector(v3.x + arm, v3.y + arm), 0.01);
    const o4 = this.getOrCreateVertex(new Vector(v4.x - arm, v4.y + arm), 0.01);

    this.createLine(o1, v1, "wave");
    this.createLine(o2, v2, "wave");
    this.createLine(v3, o3, "wave");
    this.createLine(v4, o4, "wave");

    this.cursorVertexId = v3.id;
  }

  private createTemplateQEDVertex(anchor: Vertex): void {
    const span = 12;
    const uplift = 9;
    const loopRadius = 2.8;

    const left = this.getOrCreateVertex(new Vector(anchor.x - span / 2, anchor.y), 0.01);
    const right = this.getOrCreateVertex(new Vector(anchor.x + span / 2, anchor.y), 0.01);
    const mid = this.getOrCreateVertex(new Vector(anchor.x, anchor.y), 0.01);
    const photonTip = this.getOrCreateVertex(new Vector(anchor.x, anchor.y - uplift), 0.01);

    const extIn = this.getOrCreateVertex(new Vector(left.x - 8, left.y), 0.01);
    const extOut = this.getOrCreateVertex(new Vector(right.x + 8, right.y), 0.01);

    this.createLine(extIn, left, "normal");
    this.createLine(left, mid, "normal");
    this.createLine(mid, right, "normal");
    this.createLine(right, extOut, "normal");
    this.createLine(mid, photonTip, "wave");

    const loopCenter = this.getOrCreateVertex(new Vector(anchor.x, anchor.y - 2.6), 0.01);
    const loop = new Loop();
    loop.origin = loopCenter;
    loop.setRadius(loopRadius);
    loop.style = "wave";
    loop.loopBeginAngle = Math.PI * 0.1;
    loop.loopEndAngle = Math.PI * 0.9;
    this.repository.doCommand(new SetLoop(loop));

    this.cursorVertexId = mid.id;
  }

  private createTemplateQEDVacuum(anchor: Vertex): void {
    const length = 24;
    const radius = 4.2;
    const left = this.getOrCreateVertex(new Vector(anchor.x - length / 2, anchor.y), 0.01);
    const right = this.getOrCreateVertex(new Vector(anchor.x + length / 2, anchor.y), 0.01);
    const midL = this.getOrCreateVertex(new Vector(anchor.x - radius, anchor.y), 0.01);
    const midR = this.getOrCreateVertex(new Vector(anchor.x + radius, anchor.y), 0.01);
    const center = this.getOrCreateVertex(new Vector(anchor.x, anchor.y), 0.01);

    this.createLine(left, midL, "wave");
    this.createLine(midR, right, "wave");

    const loop = new Loop();
    loop.origin = center;
    loop.setRadius(radius);
    loop.style = "normal";
    this.repository.doCommand(new SetLoop(loop));
    this.cursorVertexId = right.id;
  }

  private createTemplatePenguin(anchor: Vertex): void {
    const leftIn = this.getOrCreateVertex(new Vector(anchor.x - 16, anchor.y + 2), 0.01);
    const weakIn = this.getOrCreateVertex(new Vector(anchor.x - 9, anchor.y + 1.2), 0.01);
    const weakCore = this.getOrCreateVertex(new Vector(anchor.x - 3, anchor.y), 0.01);
    const weakOut = this.getOrCreateVertex(new Vector(anchor.x + 8, anchor.y + 1.2), 0.01);
    const rightOut = this.getOrCreateVertex(new Vector(anchor.x + 16, anchor.y + 2), 0.01);

    // Keep the fermion loop above the weak line so the emitted boson reads clearly.
    const loopCenter = this.getOrCreateVertex(new Vector(anchor.x + 2, anchor.y - 4.8), 0.01);
    const loopRadius = 4.1;
    const loopLeft = this.getOrCreateVertex(new Vector(loopCenter.x - loopRadius, loopCenter.y), 0.01);
    const loopRight = this.getOrCreateVertex(new Vector(loopCenter.x + loopRadius, loopCenter.y), 0.01);
    const loopTop = this.getOrCreateVertex(new Vector(loopCenter.x, loopCenter.y - loopRadius), 0.01);
    const emittedBoson = this.getOrCreateVertex(new Vector(loopTop.x + 8.5, loopTop.y - 4), 0.01);

    this.createLine(leftIn, weakIn, "normal");
    this.createLine(weakIn, weakCore, "normal");
    this.createLine(weakCore, weakOut, "normal");
    this.createLine(weakOut, rightOut, "normal");
    this.createLine(weakCore, loopLeft, "normal");
    this.createLine(loopRight, weakOut, "normal");
    this.createLine(loopTop, emittedBoson, "coil");

    const loop = new Loop();
    loop.origin = loopCenter;
    loop.setRadius(loopRadius);
    loop.style = "normal";
    this.repository.doCommand(new SetLoop(loop));

    this.cursorVertexId = weakOut.id;
  }

  private createTemplateCompton(anchor: Vertex): void {
    const eIn = this.getOrCreateVertex(new Vector(anchor.x - 13, anchor.y + 2), 0.01);
    const v1 = this.getOrCreateVertex(new Vector(anchor.x - 4, anchor.y + 2), 0.01);
    const v2 = this.getOrCreateVertex(new Vector(anchor.x + 4, anchor.y + 2), 0.01);
    const eOut = this.getOrCreateVertex(new Vector(anchor.x + 13, anchor.y + 2), 0.01);
    const gIn = this.getOrCreateVertex(new Vector(anchor.x - 10, anchor.y - 6), 0.01);
    const gOut = this.getOrCreateVertex(new Vector(anchor.x + 10, anchor.y - 6), 0.01);

    this.createLine(eIn, v1, "normal");
    this.createLine(v1, v2, "normal");
    this.createLine(v2, eOut, "normal");
    this.createLine(gIn, v1, "wave");
    this.createLine(v2, gOut, "wave");
    this.cursorVertexId = eOut.id;
  }

  private createTemplateSChannel(anchor: Vertex): void {
    const inL = this.getOrCreateVertex(new Vector(anchor.x - 12, anchor.y - 4.5), 0.01);
    const inR = this.getOrCreateVertex(new Vector(anchor.x - 12, anchor.y + 4.5), 0.01);
    const midL = this.getOrCreateVertex(new Vector(anchor.x - 3, anchor.y), 0.01);
    const midR = this.getOrCreateVertex(new Vector(anchor.x + 3, anchor.y), 0.01);
    const outL = this.getOrCreateVertex(new Vector(anchor.x + 12, anchor.y - 4.5), 0.01);
    const outR = this.getOrCreateVertex(new Vector(anchor.x + 12, anchor.y + 4.5), 0.01);

    this.createLine(inL, midL, "normal");
    this.createLine(inR, midL, "normal");
    this.createLine(midL, midR, "wave");
    this.createLine(midR, outL, "normal");
    this.createLine(midR, outR, "normal");
    this.cursorVertexId = midR.id;
  }

  private createTemplateTriangle(anchor: Vertex): void {
    const v1 = this.getOrCreateVertex(new Vector(anchor.x, anchor.y - 5), 0.01);
    const v2 = this.getOrCreateVertex(new Vector(anchor.x - 5.5, anchor.y + 4), 0.01);
    const v3 = this.getOrCreateVertex(new Vector(anchor.x + 5.5, anchor.y + 4), 0.01);
    const extTop = this.getOrCreateVertex(new Vector(anchor.x, anchor.y - 11), 0.01);
    const extLeft = this.getOrCreateVertex(new Vector(anchor.x - 11, anchor.y + 5), 0.01);
    const extRight = this.getOrCreateVertex(new Vector(anchor.x + 11, anchor.y + 5), 0.01);

    this.createLine(v1, v2, "normal");
    this.createLine(v2, v3, "normal");
    this.createLine(v3, v1, "normal");
    this.createLine(extTop, v1, "wave");
    this.createLine(extLeft, v2, "wave");
    this.createLine(v3, extRight, "wave");
    this.cursorVertexId = v1.id;
  }

  private createTemplateTChannel(anchor: Vertex): void {
    const inTop = this.getOrCreateVertex(new Vector(anchor.x - 11, anchor.y - 5), 0.01);
    const inBottom = this.getOrCreateVertex(new Vector(anchor.x - 11, anchor.y + 5), 0.01);
    const leftTop = this.getOrCreateVertex(new Vector(anchor.x - 3, anchor.y - 3), 0.01);
    const leftBottom = this.getOrCreateVertex(new Vector(anchor.x - 3, anchor.y + 3), 0.01);
    const rightTop = this.getOrCreateVertex(new Vector(anchor.x + 3, anchor.y - 3), 0.01);
    const rightBottom = this.getOrCreateVertex(new Vector(anchor.x + 3, anchor.y + 3), 0.01);
    const outTop = this.getOrCreateVertex(new Vector(anchor.x + 11, anchor.y - 5), 0.01);
    const outBottom = this.getOrCreateVertex(new Vector(anchor.x + 11, anchor.y + 5), 0.01);

    this.createLine(inTop, leftTop, "normal");
    this.createLine(inBottom, leftBottom, "normal");
    this.createLine(leftTop, rightTop, "normal");
    this.createLine(leftBottom, rightBottom, "normal");
    this.createLine(leftTop, leftBottom, "wave");
    this.createLine(rightTop, outTop, "normal");
    this.createLine(rightBottom, outBottom, "normal");
    this.cursorVertexId = rightTop.id;
  }

  private createTemplateWExchange(anchor: Vertex): void {
    const inA = this.getOrCreateVertex(new Vector(anchor.x - 14, anchor.y - 5), 0.01);
    const inB = this.getOrCreateVertex(new Vector(anchor.x - 14, anchor.y + 5), 0.01);
    const weakL = this.getOrCreateVertex(new Vector(anchor.x - 4, anchor.y), 0.01);
    const weakR = this.getOrCreateVertex(new Vector(anchor.x + 4, anchor.y), 0.01);
    const outA = this.getOrCreateVertex(new Vector(anchor.x + 14, anchor.y - 5), 0.01);
    const outB = this.getOrCreateVertex(new Vector(anchor.x + 14, anchor.y + 5), 0.01);

    this.createLine(inA, weakL, "normal");
    this.createLine(inB, weakL, "normal");
    this.createLine(weakL, weakR, "wave");
    this.createLine(weakR, outA, "normal");
    this.createLine(weakR, outB, "normal");
    this.cursorVertexId = weakR.id;
  }

  private createTemplateBhabhaT(anchor: Vertex): void {
    const inElectron = this.getOrCreateVertex(new Vector(anchor.x - 13, anchor.y - 4), 0.01);
    const outElectron = this.getOrCreateVertex(new Vector(anchor.x + 13, anchor.y - 4), 0.01);
    const inPositron = this.getOrCreateVertex(new Vector(anchor.x - 13, anchor.y + 4), 0.01);
    const outPositron = this.getOrCreateVertex(new Vector(anchor.x + 13, anchor.y + 4), 0.01);
    const topLeft = this.getOrCreateVertex(new Vector(anchor.x - 3, anchor.y - 4), 0.01);
    const topRight = this.getOrCreateVertex(new Vector(anchor.x + 3, anchor.y - 4), 0.01);
    const bottomLeft = this.getOrCreateVertex(new Vector(anchor.x - 3, anchor.y + 4), 0.01);
    const bottomRight = this.getOrCreateVertex(new Vector(anchor.x + 3, anchor.y + 4), 0.01);

    this.createLine(inElectron, topLeft, "normal");
    this.createLine(topLeft, topRight, "normal");
    this.createLine(topRight, outElectron, "normal");
    this.createLine(inPositron, bottomLeft, "normal");
    this.createLine(bottomLeft, bottomRight, "normal");
    this.createLine(bottomRight, outPositron, "normal");
    this.createLine(topLeft, bottomRight, "wave");
    this.cursorVertexId = topRight.id;
  }

  private createTemplateSunset(anchor: Vertex): void {
    const left = this.getOrCreateVertex(new Vector(anchor.x - 12, anchor.y), 0.01);
    const midLeft = this.getOrCreateVertex(new Vector(anchor.x - 5, anchor.y), 0.01);
    const midRight = this.getOrCreateVertex(new Vector(anchor.x + 5, anchor.y), 0.01);
    const right = this.getOrCreateVertex(new Vector(anchor.x + 12, anchor.y), 0.01);
    const upperLeftCenter = this.getOrCreateVertex(new Vector(anchor.x - 2.5, anchor.y - 4), 0.01);
    const upperRightCenter = this.getOrCreateVertex(new Vector(anchor.x + 2.5, anchor.y - 4), 0.01);

    this.createLine(left, midLeft, "normal");
    this.createLine(midLeft, midRight, "normal");
    this.createLine(midRight, right, "normal");

    const loopA = new Loop();
    loopA.origin = upperLeftCenter;
    loopA.setRadius(3.2);
    loopA.style = "wave";
    this.repository.doCommand(new SetLoop(loopA));

    const loopB = new Loop();
    loopB.origin = upperRightCenter;
    loopB.setRadius(3.2);
    loopB.style = "wave";
    this.repository.doCommand(new SetLoop(loopB));

    this.cursorVertexId = midRight.id;
  }

  private createTemplateDoubleBox(anchor: Vertex): void {
    const size = 6;
    const gap = 2;
    const arm = 5;

    const l1 = this.getOrCreateVertex(new Vector(anchor.x - size - gap, anchor.y - size), 0.01);
    const l2 = this.getOrCreateVertex(new Vector(anchor.x - gap, anchor.y - size), 0.01);
    const l3 = this.getOrCreateVertex(new Vector(anchor.x - gap, anchor.y + size), 0.01);
    const l4 = this.getOrCreateVertex(new Vector(anchor.x - size - gap, anchor.y + size), 0.01);

    const r1 = this.getOrCreateVertex(new Vector(anchor.x + gap, anchor.y - size), 0.01);
    const r2 = this.getOrCreateVertex(new Vector(anchor.x + size + gap, anchor.y - size), 0.01);
    const r3 = this.getOrCreateVertex(new Vector(anchor.x + size + gap, anchor.y + size), 0.01);
    const r4 = this.getOrCreateVertex(new Vector(anchor.x + gap, anchor.y + size), 0.01);

    this.createLine(l1, l2, "normal");
    this.createLine(l2, l3, "normal");
    this.createLine(l3, l4, "normal");
    this.createLine(l4, l1, "normal");
    this.createLine(r1, r2, "normal");
    this.createLine(r2, r3, "normal");
    this.createLine(r3, r4, "normal");
    this.createLine(r4, r1, "normal");
    this.createLine(l2, r1, "normal");
    this.createLine(l3, r4, "normal");

    const inTop = this.getOrCreateVertex(new Vector(l1.x - arm, l1.y - arm), 0.01);
    const inBottom = this.getOrCreateVertex(new Vector(l4.x - arm, l4.y + arm), 0.01);
    const outTop = this.getOrCreateVertex(new Vector(r2.x + arm, r2.y - arm), 0.01);
    const outBottom = this.getOrCreateVertex(new Vector(r3.x + arm, r3.y + arm), 0.01);
    this.createLine(inTop, l1, "wave");
    this.createLine(inBottom, l4, "wave");
    this.createLine(r2, outTop, "wave");
    this.createLine(r3, outBottom, "wave");

    this.cursorVertexId = r2.id;
  }

  private createLine(start: Vertex, end: Vertex, style: LineStyle): void {
    const line = new Line();
    line.style = style;
    this.repository.bindLineToVertices(line, start, end);
    this.repository.doCommand(new SetLine(line));
  }

  private executeQEDSelfEnergy(tokens: string[]): string | null {
    if (tokens.length !== 4) {
      return "Usage: qed_se x y length";
    }
    const x = Number(tokens[1]);
    const y = Number(tokens[2]);
    const length = Number(tokens[3]);
    if (![x, y, length].every((value) => Number.isFinite(value)) || length <= 0) {
      return "qed_se arguments must be numeric and length > 0.";
    }

    const start = this.getOrCreateVertex(new Vector(x, y));
    const end = this.getOrCreateVertex(new Vector(x + length, y));
    const radius = Math.max(1, length * 0.15);
    const centerX = x + length / 2;
    const midL = this.getOrCreateVertex(new Vector(centerX - radius, y));
    const midR = this.getOrCreateVertex(new Vector(centerX + radius, y));

    const inLine = new Line();
    this.repository.bindLineToVertices(inLine, start, midL);
    inLine.style = "normal";
    this.repository.doCommand(new SetLine(inLine));

    const outLine = new Line();
    this.repository.bindLineToVertices(outLine, midR, end);
    outLine.style = "normal";
    this.repository.doCommand(new SetLine(outLine));

    const loop = new Loop();
    loop.origin = this.getOrCreateVertex(new Vector(centerX, y));
    loop.setRadius(radius);
    loop.style = "wave";
    loop.loopBeginAngle = 0;
    loop.loopEndAngle = Math.PI;
    this.repository.doCommand(new SetLoop(loop));

    this.cursorVertexId = end.id;
    return null;
  }

  private executeQEDVacuumPolarization(tokens: string[]): string | null {
    if (tokens.length !== 4) {
      return "Usage: qed_vp x y length";
    }
    const x = Number(tokens[1]);
    const y = Number(tokens[2]);
    const length = Number(tokens[3]);
    if (![x, y, length].every((value) => Number.isFinite(value)) || length <= 0) {
      return "qed_vp arguments must be numeric and length > 0.";
    }

    const start = this.getOrCreateVertex(new Vector(x, y));
    const end = this.getOrCreateVertex(new Vector(x + length, y));
    const radius = Math.max(1, length * 0.15);
    const centerX = x + length / 2;
    const midL = this.getOrCreateVertex(new Vector(centerX - radius, y));
    const midR = this.getOrCreateVertex(new Vector(centerX + radius, y));

    const inPhoton = new Line();
    this.repository.bindLineToVertices(inPhoton, start, midL);
    inPhoton.style = "wave";
    this.repository.doCommand(new SetLine(inPhoton));

    const outPhoton = new Line();
    this.repository.bindLineToVertices(outPhoton, midR, end);
    outPhoton.style = "wave";
    this.repository.doCommand(new SetLine(outPhoton));

    const loop = new Loop();
    loop.origin = this.getOrCreateVertex(new Vector(centerX, y));
    loop.setRadius(radius);
    loop.style = "normal";
    this.repository.doCommand(new SetLoop(loop));

    this.cursorVertexId = end.id;
    return null;
  }

  private getCursorVertex(): Vertex | undefined {
    if (!this.cursorVertexId) {
      return undefined;
    }
    return this.repository.getVertex(this.cursorVertexId);
  }

  private getOrCreateVertex(point: Vector, tolerance = 0.15): Vertex {
    const existing = this.repository.findNearestVertex(point, tolerance);
    if (existing) {
      return existing;
    }
    const vertex = new Vertex(point.x, point.y);
    this.repository.doCommand(new SetVertex(vertex));
    const created = this.repository.getVertex(vertex.id);
    if (created) {
      return created;
    }
    return vertex;
  }
}
