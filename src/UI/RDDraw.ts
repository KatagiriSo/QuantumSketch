import { config } from "../Config";
import { Line, isLine, LineStyle } from "../Core/Line";
import { Elem } from "../Core/Elem";
import { isLoop, Loop } from "../Core/Loop";
import { isString, MyString } from "../Core/MyString";
import { Vector, isVector } from "../Core/Vector";
import { Vertex } from "../Core/Vertex";
import { Group, isGroup } from "../Core/Group";
import { loggerVer } from "../looger";
import { ScriptEngine } from "../Scripting/ScriptEngine";
import { draw } from "./draw";
import { DrawContext } from "./DrawContext";
import { DrawMode } from "./DrawMode";
import { ExportType } from "./ExportType";
import { RDRepository } from "./RDRepository";
import { SetString, SetVertex, SetLoop, SetLine, Delete, Move, Rotation, ChangeScale, ChangeArcAngle, ChangeArcEndAngle, Fill, ArrowToggle, ChangeType, ChangeStyle, SetLoopRadius, SetLoopBeginAngle, SetLoopEndAngle, SetLoopAngles, MoveGroup, DeleteGroup, SetLineEndpoint, SetLineControlPoint, RotateArrow, SetArrowRotation, GroupSelection, UngroupSelection, SetLineStyle, SetLoopStyle, SetLineLabel, SetLoopLabel, SetStringLabel } from "./RepositoryCommand";
import { CommandRegistry, CommandHost } from "./CommandRegistry";
import { LineToolState, LoopToolState, PointToolState, SelectToolState, StringToolState, ToolState } from "./ToolState";

type InteractionState =
  | {
      type: "idle";
    }
  | {
      type: "potentialClick";
      startPointer: Vector;
      hit?: Elem;
      additive: boolean;
      forceRect: boolean;
    }
  | {
      type: "dragging";
    };

type HitResult =
  | {
      type: "line-handle";
      line: Line;
      handle: "origin" | "to" | "control";
      position: Vector;
      createControl: boolean;
    }
  | {
      type: "loop-handle";
      loop: Loop;
      handle: "radius" | "start" | "end";
      position: Vector;
    }
  | {
      type: "vertex";
      vertex: Vertex;
    }
  | {
      type: "edge";
      elem: Elem;
    };

/**
 * Central UI orchestrator for the editor. This class owns the canvas draw
 * loop, manages repository mutations, and routes all user input (clicks,
 * keyboard, command buttons) through a command registry so that new features
 * can be added without editing a monolithic switch statement.
 */
export class RDDraw implements CommandHost {
  repository: RDRepository = new RDRepository();
  private scriptEngine: ScriptEngine;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  drawContext: DrawContext;
  // private prevX: number = 0;
  // private prevY: number = 0;
  private pointerPrev: Vector = new Vector(0, 0);
  rawPointer: Vector = new Vector(0, 0);
  drawMode: DrawMode = "normal";
  isNoSelectMode: boolean = false;
  private contextMenuElement: HTMLElement | null = null;
  private commandRegistry: CommandRegistry<RDDraw> = new CommandRegistry();
  private lineDraftStart?: Vector;
  private loopControls = {
    container: null as HTMLElement | null,
    radiusSlider: null as HTMLInputElement | null,
    startSlider: null as HTMLInputElement | null,
    endSlider: null as HTMLInputElement | null,
    radiusValue: null as HTMLElement | null,
    startValue: null as HTMLElement | null,
    endValue: null as HTMLElement | null,
    arcValue: null as HTMLElement | null,
    gapValue: null as HTMLElement | null,
  };
  private inspectorControls = {
    root: null as HTMLElement | null,
    selectionType: null as HTMLElement | null,
    selectionCount: null as HTMLElement | null,
    lineLength: null as HTMLElement | null,
    lineArrow: null as HTMLElement | null,
    lineStyle: null as HTMLSelectElement | null,
    lineLabel: null as HTMLInputElement | null,
    lineApply: null as HTMLButtonElement | null,
    lineStraighten: null as HTMLButtonElement | null,
    loopStyle: null as HTMLSelectElement | null,
    loopLabel: null as HTMLInputElement | null,
    loopApply: null as HTMLButtonElement | null,
    loopState: null as HTMLElement | null,
    textValue: null as HTMLTextAreaElement | null,
    textApply: null as HTMLButtonElement | null,
    textLength: null as HTMLElement | null,
  };
  private loopPreview?: {
    loopId: string;
    radius?: { original: number };
    start?: { original: number };
    end?: { original: number };
  };
  private dragSession?:
    | {
        type: "move";
        elements: Elem[];
        startPointer: Vector;
        lastPointer: Vector;
        totalDelta: Vector;
      }
    | {
        type: "rect";
        start: Vector;
        current: Vector;
        additive: boolean;
      }
    | {
        type: "handle";
        line: Line;
        handle: "origin" | "to" | "control";
        startPointer: Vector;
        lastPointer: Vector;
        initial: { origin: Vector; to: Vector; control: Vector | null };
        createdControl: boolean;
        detachMode: boolean;
      }
    | {
        type: "loop-handle";
        loop: Loop;
        handle: "radius" | "start" | "end";
        startPointer: Vector;
        startRadius: number;
        startBeginAngle: number;
        startEndAngle: number;
      };
  private selectionRect?: { x1: number; y1: number; x2: number; y2: number };
  private interactionState: InteractionState = { type: "idle" };
  private linePreviewEnd?: Vector;
  private hoveredSnapVertex?: Vector;
  private hoveredSnapGrid?: Vector;
  private hoveredHit?: HitResult | null;
  private cursorMode: "default" | "grab" | "grabbing" | "crosshair" | "pointer" = "default";
  private lineToolPress?: {
    startPointer: Vector;
    startVertex: Vector;
    didDrag: boolean;
  };
  private spacePanActive = false;
  private panDragLast?: Vector;
  private activePointers: Map<number, Vector> = new Map();
  private pointerGesture?: {
    pointerIds: [number, number];
    lastMidRaw: Vector;
    lastDistance: number;
  };
  private interactionPointerId?: number;
  private gridSnapEnabled = true;
  private readonly tools: Record<DrawMode, ToolState>;
  private activeTool: ToolState;
  private pointerTool?: ToolState;
  private lastHitContext?: { point: Vector; tolerance: number };
  private renderScheduled = false;
  private clipboardSnapshot?: {
    vertices: Array<{ id: string; x: number; y: number }>;
    lines: Array<{
      startId: string;
      endId: string;
      style: Line["style"];
      label: string;
      labelDiff: number;
      allow: Boolean;
      arrowRotation: number;
      control: Vector | null;
    }>;
    loops: Array<{
      centerId: string;
      radius: number;
      style: Loop["style"];
      allow: Boolean;
      fill: boolean;
      label: string;
      loopBeginAngle: number;
      loopEndAngle: number;
    }>;
    strings: Array<{
      x: number;
      y: number;
      label: string;
    }>;
  };
  private dslScriptElement: HTMLTextAreaElement | null = null;
  private dslStatusElement: HTMLElement | null = null;
  private dslLogElement: HTMLElement | null = null;
  private selectionMacroEditMode = false;
  constructor(canvas: HTMLCanvasElement, drawContext: DrawContext) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d")!;
    this.drawContext = drawContext;
    this.scriptEngine = new ScriptEngine(this.repository);
    this.tools = {
      normal: new SelectToolState(),
      line: new LineToolState(),
      loop: new LoopToolState(),
      point: new PointToolState(),
      string: new StringToolState(),
    };
    this.activeTool = this.tools[this.drawMode];
    this.registerCommands();
    this.bind();
    this.drawAll();
  }

  bind() {
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("dblclick", (ev) => {
      this.onCanvasDoubleClick(ev);
    });

    this.canvas.addEventListener("pointerdown", (ev) => {
      this.onCanvasPointerDown(ev);
    });
    this.canvas.addEventListener("pointermove", (ev) => {
      this.onCanvasPointerMove(ev);
    });
    this.canvas.addEventListener("pointerup", (ev) => {
      this.onCanvasPointerUp(ev);
    });
    this.canvas.addEventListener("pointercancel", (ev) => {
      this.onCanvasPointerCancel(ev);
    });

    document.addEventListener("keydown", (ev) => {
      this.onKeyDown(ev);
    });
    document.addEventListener("keyup", (ev) => {
      this.onKeyUp(ev);
    });
    this.canvas.addEventListener("wheel", (ev) => {
      this.onCanvasWheel(ev);
    }, { passive: false });
    window.addEventListener("blur", () => {
      this.clearTransientInputState();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        this.clearTransientInputState();
      }
    });
    window.addEventListener(DrawContext.TEX_READY_EVENT, () => {
      this.drawAll();
    });
    window.addEventListener("resize", () => {
      this.resizeCanvasToViewport();
    });

    (document.getElementById("nav-redo"))?.addEventListener("click", (ev: Event) => {
      ev.preventDefault();
      this.redo();
    });

    (document.getElementById("nav-undo"))?.addEventListener("click", (ev: Event) => {
      ev.preventDefault();
      this.undo();
    });

    (document.getElementById("nav-export-tikz"))?.addEventListener("click", (ev: Event) => {
      ev.preventDefault();
      this.drawAll("tikz");
    });

    (document.getElementById("nav-export-svg"))?.addEventListener("click", (ev: Event) => {
      ev.preventDefault();
      this.drawAll("svg");
    });

    (document.getElementById("download"))?.addEventListener("click", (ev: Event) => {
      this.drawAll("svg");
    });

    this.initializeCommandTriggers();
    this.setupContextMenu();
    this.setupLoopControls();
    this.setupInspectorControls();
    this.setupScriptInput();
    this.setupTemplatePresets();
    this.resizeCanvasToViewport();
  }

  private setupTemplatePresets() {
    const dslScript = document.getElementById("dsl-script") as HTMLTextAreaElement | null;
    const templateCatalog = document.getElementById("dsl-template-catalog") as HTMLSelectElement | null;
    const templateHelp = document.getElementById("dsl-template-help") as HTMLElement | null;
    const loadMacroButton = document.getElementById("dsl-load-template-macro") as HTMLButtonElement | null;
    const runMacroButton = document.getElementById("dsl-run-template-macro") as HTMLButtonElement | null;
    const dslStatus = document.getElementById("dsl-status") as HTMLElement | null;
    const dslLog = document.getElementById("dsl-log") as HTMLElement | null;

    const templateCatalogItems = this.scriptEngine.getTemplateCatalog();

    const setStatus = (message: string, type: "neutral" | "ok" | "error" = "neutral") => {
      if (!dslStatus) {
        return;
      }
      dslStatus.textContent = message;
      dslStatus.classList.remove("text-secondary", "text-success", "text-danger");
      if (type === "ok") {
        dslStatus.classList.add("text-success");
        return;
      }
      if (type === "error") {
        dslStatus.classList.add("text-danger");
        return;
      }
      dslStatus.classList.add("text-secondary");
    };

    const appendLog = (text: string, kind: "ok" | "error" | "info" = "info") => {
      if (!dslLog) {
        return;
      }
      const stamp = new Date().toLocaleTimeString();
      const prefix = kind === "ok" ? "OK" : kind === "error" ? "ERR" : "INFO";
      const line = `[${stamp}] ${prefix} ${text}`;
      const previous = dslLog.textContent;
      if (!previous || previous === "Execution log is empty.") {
        dslLog.textContent = line;
        return;
      }
      dslLog.textContent = `${line}\n${previous}`;
    };

    const updateTemplateHelp = (templateName: string) => {
      if (!templateHelp) {
        return;
      }
      const matched = templateCatalogItems.find((item) => item.name === templateName);
      if (!matched) {
        templateHelp.textContent = "Select a preset to load its macro into the script editor.";
        return;
      }
      templateHelp.textContent = `${matched.label}: ${matched.description}`;
    };

    const loadTemplateMacro = (templateName: string, runNow: boolean): boolean => {
      const macro = this.scriptEngine.buildTemplateMacro(templateName);
      if (!macro) {
        setStatus(`Unknown template '${templateName}'.`, "error");
        appendLog(`Template macro failed: unknown '${templateName}'.`, "error");
        return false;
      }

      if (dslScript) {
        dslScript.value = macro;
        dslScript.focus();
        dslScript.setSelectionRange(0, dslScript.value.length);
      }
      updateTemplateHelp(templateName);
      setStatus("Template macro loaded into script editor.", "ok");
      appendLog(`Template macro loaded: ${templateName}`, "info");

      if (!runNow) {
        return true;
      }

      const batch = this.scriptEngine.executeScript(macro, true);
      if (batch.executed > 0) {
        this.drawAll();
      }
      if (!batch.success) {
        setStatus(batch.message, "error");
        appendLog(batch.message, "error");
        return false;
      }
      setStatus(`Template executed: ${templateName}`, "ok");
      appendLog(`Template executed: ${templateName}`, "ok");
      return true;
    };

    templateCatalog?.addEventListener("change", () => {
      if (!templateCatalog.value) {
        updateTemplateHelp("");
        return;
      }
      loadTemplateMacro(templateCatalog.value, false);
    });

    loadMacroButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const selected = templateCatalog?.value || "";
      if (!selected) {
        setStatus("Choose a template from the catalog first.", "neutral");
        return;
      }
      loadTemplateMacro(selected, false);
    });

    runMacroButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const selected = templateCatalog?.value || "";
      if (!selected) {
        setStatus("Choose a template from the catalog first.", "neutral");
        return;
      }
      loadTemplateMacro(selected, true);
    });

    const presetButtons = document.querySelectorAll<HTMLButtonElement>("[data-template]");
    presetButtons.forEach((button) => {
      button.addEventListener("click", (ev) => {
        ev.preventDefault();
        const template = button.dataset.template;
        if (!template) {
          return;
        }
        if (templateCatalog) {
          templateCatalog.value = template;
        }
        const executed = loadTemplateMacro(template, true);
        if (!executed) {
          loggerVer(`template '${template}' failed.`);
        }
      });
    });

    updateTemplateHelp(templateCatalog?.value ?? "");
  }

  private setupScriptInput() {
    const dslInput = document.getElementById("dsl-input") as HTMLInputElement | null;
    if (!dslInput) {
      return;
    }

    const dslRun = document.getElementById("dsl-run") as HTMLButtonElement | null;
    const dslClear = document.getElementById("dsl-clear") as HTMLButtonElement | null;
    const dslExampleSelect = document.getElementById("dsl-example-select") as HTMLSelectElement | null;
    const dslInsertExample = document.getElementById("dsl-insert-example") as HTMLButtonElement | null;
    const dslScript = document.getElementById("dsl-script") as HTMLTextAreaElement | null;
    const dslRunScript = document.getElementById("dsl-run-script") as HTMLButtonElement | null;
    const dslCopyScript = document.getElementById("dsl-copy-script") as HTMLButtonElement | null;
    const dslMacroKind = document.getElementById("dsl-macro-kind") as HTMLSelectElement | null;
    const dslMacroX = document.getElementById("dsl-macro-x") as HTMLInputElement | null;
    const dslMacroY = document.getElementById("dsl-macro-y") as HTMLInputElement | null;
    const dslMacroLength = document.getElementById("dsl-macro-length") as HTMLInputElement | null;
    const dslBuildMacro = document.getElementById("dsl-build-macro") as HTMLButtonElement | null;
    const dslStatus = document.getElementById("dsl-status") as HTMLElement | null;
    const dslLog = document.getElementById("dsl-log") as HTMLElement | null;
    this.dslScriptElement = dslScript;
    this.dslStatusElement = dslStatus;
    this.dslLogElement = dslLog;

    const appendLog = (text: string, kind: "ok" | "error" | "info" = "info") => this.appendDslLog(text, kind);
    const setStatus = (message: string, type: "neutral" | "ok" | "error" = "neutral") => this.setDslStatus(message, type);

    const runCommand = (command: string): boolean => {
      if (!command) {
        setStatus("Enter a DSL command to run.", "neutral");
        return false;
      }

      if (command.includes(";") || command.includes("\n")) {
        const batch = this.scriptEngine.executeScript(command, true);
        if (batch.executed > 0) {
          this.drawAll();
        }
        if (batch.success) {
          setStatus(batch.message, "ok");
          appendLog(batch.message, "ok");
          dslInput.classList.remove("is-invalid");
          return true;
        }
        setStatus(batch.message, "error");
        appendLog(batch.message, "error");
        dslInput.classList.add("is-invalid");
        return false;
      }

      const result = this.scriptEngine.execute(command);
      if (result.success) {
        this.drawAll();
        setStatus(`Executed: ${command}`, "ok");
        appendLog(command, "ok");
        dslInput.classList.remove("is-invalid");
        return true;
      } else {
        setStatus(result.message, "error");
        appendLog(`Command failed: ${command} (${result.message})`, "error");
        dslInput.classList.add("is-invalid");
        return false;
      }
    };

    dslInput.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        const command = dslInput.value.trim();
        if (runCommand(command)) {
          dslInput.value = "";
        }
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        dslInput.blur();
      }
    });

    dslInput.addEventListener("input", () => {
      dslInput.classList.remove("is-invalid");
      setStatus("", "neutral");
    });

    dslRun?.addEventListener("click", () => {
      const command = dslInput.value.trim();
      if (runCommand(command)) {
        dslInput.value = "";
      }
      dslInput.focus();
    });

    dslClear?.addEventListener("click", () => {
      dslInput.value = "";
      dslInput.classList.remove("is-invalid");
      setStatus("", "neutral");
      dslInput.focus();
      appendLog("Command input cleared.", "info");
    });

    dslInsertExample?.addEventListener("click", () => {
      if (!dslExampleSelect || !dslExampleSelect.value) {
        setStatus("Select an example command first.", "neutral");
        return;
      }
      dslInput.value = dslExampleSelect.value;
      dslInput.classList.remove("is-invalid");
      setStatus("Example inserted. Press Run or Enter.", "neutral");
      dslInput.focus();
      dslInput.select();
      appendLog(`Example loaded: ${dslExampleSelect.value}`, "info");
    });

    dslExampleSelect?.addEventListener("change", () => {
      if (!dslExampleSelect.value) {
        return;
      }
      dslInput.value = dslExampleSelect.value;
      dslInput.classList.remove("is-invalid");
      setStatus("Example loaded to input.", "neutral");
    });

    dslBuildMacro?.addEventListener("click", () => {
      const kind = dslMacroKind?.value || "qed_se";
      const x = Number(dslMacroX?.value ?? "10");
      const y = Number(dslMacroY?.value ?? "15");
      const length = Number(dslMacroLength?.value ?? "40");
      if (![x, y, length].every((value) => Number.isFinite(value))) {
        setStatus("Macro parameters must be numeric.", "error");
        appendLog("Macro build failed: invalid numeric parameter.", "error");
        return;
      }
      const command = `${kind} ${x} ${y} ${length}`;
      dslInput.value = command;
      dslInput.classList.remove("is-invalid");
      setStatus("Macro command created in quick command box.", "ok");
      appendLog(`Macro created: ${command}`, "info");
      dslInput.focus();
      dslInput.select();
    });

    const focusScriptLine = (line: number) => {
      if (!dslScript || line < 1) {
        return;
      }
      const rows = dslScript.value.split(/\r?\n/);
      let start = 0;
      for (let index = 0; index < line - 1 && index < rows.length; index++) {
        start += rows[index].length + 1;
      }
      const end = start + (rows[line - 1]?.length ?? 0);
      dslScript.focus();
      dslScript.setSelectionRange(start, end);
    };

    const runScript = () => {
      if (!dslScript) {
        return;
      }
      if (this.selectionMacroEditMode) {
        const applied = this.applySelectionMacroScript(dslScript.value);
        if (applied) {
          setStatus("Selection replaced from macro.", "ok");
          appendLog("Selection macro applied.", "ok");
        }
        return;
      }
      const batch = this.scriptEngine.executeScript(dslScript.value, true);
      if (batch.total === 0) {
        setStatus(batch.message, "neutral");
        appendLog(batch.message, "info");
        return;
      }
      if (batch.executed > 0) {
        this.drawAll();
      }
      if (batch.success) {
        setStatus(batch.message, "ok");
        appendLog(batch.message, "ok");
      } else {
        setStatus(batch.message, "error");
        appendLog(batch.message, "error");
        if (batch.failedLine) {
          focusScriptLine(batch.failedLine);
        }
      }
    };

    dslRunScript?.addEventListener("click", () => {
      runScript();
    });

    dslScript?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      const isMeta = ev.ctrlKey || ev.metaKey;
      if (isMeta && ev.key === "Enter") {
        ev.preventDefault();
        runScript();
      }
    });

    dslCopyScript?.addEventListener("click", () => {
      if (!dslScript) {
        return;
      }
      const text = dslScript.value;
      if (!text.trim()) {
        setStatus("Script editor is empty.", "neutral");
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setStatus("Script copied to clipboard.", "ok");
          appendLog("Script copied to clipboard.", "info");
        }).catch(() => {
          dslScript.focus();
          dslScript.select();
          setStatus("Clipboard API unavailable. Selected script text instead.", "neutral");
          appendLog("Clipboard API unavailable; selected script text.", "info");
        });
      } else {
        dslScript.focus();
        dslScript.select();
        setStatus("Clipboard API unavailable. Selected script text instead.", "neutral");
        appendLog("Clipboard API unavailable; selected script text.", "info");
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "/") {
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.shiftKey) {
        return;
      }
      const target = ev.target as HTMLElement | null;
      if (target === dslInput) {
        return;
      }
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      ev.preventDefault();
      dslInput.focus();
      dslInput.select();
      setStatus("DSL input focused.", "neutral");
    });
  }

  /**
   * Registers the default set of UI commands. Having a dedicated registry
    * keeps the mapping between command identifiers and their behaviour in one
   * place, which makes it much simpler to add, remove, or reuse commands in
   * other UI surfaces (shortcut keys, palette, context menu, etc.).
   */
  private registerCommands() {
    const registry = this.commandRegistry;

    registry.register({
      id: "select-here",
      description: "Select the element closest to the pointer location",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.selectAt(pointer, false),
    });

    registry.register({
      id: "sub-select-here",
      description: "Set the sub-selection using the pointer location",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.selectAt(pointer, true),
    });

    registry.register({
      id: "mode-normal",
      description: "Switch to selection mode",
      execute: ({ host }) => host.setDrawMode("normal"),
    });

    registry.register({
      id: "mode-line",
      description: "Switch to propagator drawing mode",
      execute: ({ host }) => host.setDrawMode("line"),
    });

    registry.register({
      id: "mode-loop",
      description: "Switch to loop drawing mode",
      execute: ({ host }) => host.setDrawMode("loop"),
    });

    registry.register({
      id: "mode-point",
      description: "Switch to vertex drawing mode",
      execute: ({ host }) => host.setDrawMode("point"),
    });

    registry.register({
      id: "mode-string",
      description: "Switch to text placement mode",
      execute: ({ host }) => host.setDrawMode("string"),
    });

    registry.register({
      id: "add-vertex",
      description: "Place a vertex at the pointer position",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.insertVertex(pointer),
    });

    registry.register({
      id: "add-loop",
      description: "Create a loop centred at the pointer position",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.putLoop(pointer.x, pointer.y),
    });

    registry.register({
      id: "add-line-from-pointer",
      description: "Create a propagator ending at the pointer position",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.advanceLineTool(pointer),
    });

    registry.register({
      id: "add-text",
      description: "Insert a text label at the pointer position",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.setString(pointer.x, pointer.y),
    });

    registry.register({
      id: "fill",
      description: "Fill the currently selected loop",
      requiresPointer: true,
      execute: ({ host, pointer }) => host.fill(pointer.x, pointer.y),
    });

    registry.register({
      id: "toggle-arrow",
      description: "Toggle arrow direction on the selected propagator",
      execute: ({ host }) => host.allowToggle(),
    });

    registry.register({
      id: "arrow-rotate-left",
      description: "Rotate the propagator arrow counter-clockwise",
      execute: ({ host }) => host.rotateArrow(-Math.PI / 12),
    });

    registry.register({
      id: "arrow-rotate-right",
      description: "Rotate the propagator arrow clockwise",
      execute: ({ host }) => host.rotateArrow(Math.PI / 12),
    });

    registry.register({
      id: "arrow-reset",
      description: "Reset the propagator arrow rotation",
      execute: ({ host }) => host.resetArrowRotation(),
    });

    registry.register({
      id: "change-type",
      description: "Cycle the selected propagator's particle type",
      execute: ({ host }) => host.changeType(),
    });

    registry.register({
      id: "change-style",
      description: "Cycle the selected propagator's visual style",
      execute: ({ host }) => host.changeStyle(),
    });

    registry.register({
      id: "delete",
      description: "Delete the currently selected element",
      execute: ({ host }) => host.delete(),
    });

    registry.register({
      id: "select-all",
      description: "Select all elements on the canvas",
      execute: ({ host }) => host.selectAll(),
    });

    registry.register({
      id: "copy-selection",
      description: "Copy selected elements",
      execute: ({ host }) => host.copySelection(),
    });

    registry.register({
      id: "cut-selection",
      description: "Cut selected elements",
      execute: ({ host }) => host.cutSelection(),
    });

    registry.register({
      id: "paste-selection",
      description: "Paste copied elements",
      execute: ({ host }) => host.pasteSelection(),
    });

    registry.register({
      id: "group-selection",
      description: "Group selected elements",
      execute: ({ host }) => host.groupSelection(),
    });

    registry.register({
      id: "ungroup-selection",
      description: "Ungroup selected group element",
      execute: ({ host }) => host.ungroupSelection(),
    });

    registry.register({
      id: "edit-selection-macro",
      description: "Export the selection to editable DSL macro text",
      execute: ({ host }) => host.openSelectionMacroEditor(),
    });

    registry.register({
      id: "undo",
      description: "Undo the last change",
      execute: ({ host }) => host.undo(),
    });

    registry.register({
      id: "redo",
      description: "Redo the previously undone change",
      execute: ({ host }) => host.redo(),
    });

    registry.register({
      id: "rotation",
      description: "Rotate the selection clockwise",
      execute: ({ host }) => host.rotation(),
    });

    registry.register({
      id: "anti-rotation",
      description: "Rotate the selection counter-clockwise",
      execute: ({ host }) => host.antiRotation(),
    });
  }

  /**
   * Registers click handlers for every `data-command` element. Any new button
   * or menu entry simply needs the attribute and will automatically route
   * through the command registry.
   */
  private initializeCommandTriggers() {
    const triggers = document.querySelectorAll<HTMLElement>("[data-command]");
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const element = ev.currentTarget as HTMLElement;
        const command = element.dataset.command;
        if (!command) {
          return;
        }
        this.handleCommand(command);
      });
    });
  }

  /**
   * Runs a command from UI surfaces. Centralising the clutch of ancillary
   * work (closing menus, logging, pointer handling) keeps the event handlers
   * trivial and consistent.
   */
  private handleCommand(commandId: string) {
    const executed = this.runCommand(commandId);
    if (executed) {
      this.hideContextMenu();
    }
  }

  private runCommand(commandId: string): boolean {
    try {
      return this.commandRegistry.execute(commandId, this, this.getPointer());
    } catch (error) {
      loggerVer(`command '${commandId}' failed: ${error}`);
      return false;
    }
  }

  private selectAt(point: Vector, additive: boolean) {
    this.resetLoopPreview();
    const hit = this.repository.hitTest(point, config.scale, 14);
    if (!hit) {
      if (!additive) {
        this.repository.clearSelectMode();
        this.drawAll();
      }
      return;
    }
    if (additive) {
      this.repository.toggleSelection(hit);
    } else {
      this.repository.setCurrentElement(hit);
    }
    this.drawAll();
  }

  private performMoveDrag(pointer: Vector, fineFactor = 1) {
    if (!this.dragSession || this.dragSession.type !== "move") {
      return;
    }
    const deltaStep = pointer.minus(this.dragSession.lastPointer).multi(fineFactor);
    if (deltaStep.x === 0 && deltaStep.y === 0) {
      return;
    }
    this.dragSession.lastPointer = pointer;
    this.dragSession.totalDelta = new Vector(
      this.dragSession.totalDelta.x + deltaStep.x,
      this.dragSession.totalDelta.y + deltaStep.y
    );
    this.dragSession.elements.forEach((elem) => {
      elem.move(deltaStep);
    });
    this.drawAll();
  }

  private nudgeSelection(delta: Vector) {
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    if (selected.length === 1) {
      this.repository.doCommand(new Move(selected[0], delta));
    } else {
      this.repository.doCommand(new MoveGroup(selected, delta));
    }
    this.drawAll();
  }

  private performHandleDrag(pointer: Vector) {
    if (!this.dragSession || this.dragSession.type !== "handle") {
      return;
    }
    const session = this.dragSession;
    const line = session.line;
    const initial = session.initial;
    this.dragSession.lastPointer = pointer;

    if (session.handle === "origin") {
      if (session.detachMode) {
        line.origin = new Vector(pointer.x, pointer.y);
      } else {
        line.origin.moveAbsolute(pointer);
      }
      if (initial.control) {
        const delta = pointer.minus(initial.origin);
        const newControl = initial.control.add(delta);
        if (!line.control) {
          line.control = new Vector(newControl.x, newControl.y);
        } else {
          line.control.moveAbsolute(newControl);
        }
      }
    } else if (session.handle === "to") {
      if (session.detachMode) {
        line.to = new Vector(pointer.x, pointer.y);
      } else {
        line.to.moveAbsolute(pointer);
      }
      if (initial.control) {
        const delta = pointer.minus(initial.to);
        const newControl = initial.control.add(delta);
        if (!line.control) {
          line.control = new Vector(newControl.x, newControl.y);
        } else {
          line.control.moveAbsolute(newControl);
        }
      }
    } else {
      if (!line.control) {
        line.control = new Vector(pointer.x, pointer.y);
      } else {
        line.control.moveAbsolute(pointer);
      }
    }

    this.drawAll();
  }

  private insertVertex(point: Vector): Vector {
    const vertex = this.ensureVertex(point);
    this.repository.setCurrentElement(vertex);
    this.setDrawMode("normal");
    return vertex;
  }

  private ensureVertex(point: Vector): Vector {
    const tolerance = this.worldTolerance(10);
    const existing = this.findNearestVertex(point, tolerance);
    if (existing) {
      this.repository.setCurrentElement(existing);
      return existing;
    }
    const vertex = new Vector(point.x, point.y);
    this.repository.doCommand(new SetVertex(vertex));
    const created = this.repository.currentElement();
    if (created && isVector(created)) {
      return created;
    }
    return vertex;
  }

  private findNearestVertex(point: Vector, tolerance: number): Vector | undefined {
    let nearest: Vector | undefined = undefined;
    let minDistance = Number.POSITIVE_INFINITY;
    const vertices = this.repository.getAllVertex();
    vertices.forEach((vertex) => {
      const distance = vertex.formalDistance(point);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = vertex;
      }
    });
    if (nearest && minDistance <= tolerance) {
      return nearest;
    }
    return undefined;
  }

  private findNearestLine(point: Vector, tolerance: number): Line | undefined {
    let nearest: Line | undefined = undefined;
    let minDistance = Number.POSITIVE_INFINITY;
    const lines = this.repository.getAllLine();
    lines.forEach((line) => {
      const distance = line.formalDistance(point);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = line;
      }
    });
    if (nearest && minDistance <= tolerance) {
      return nearest;
    }
    return undefined;
  }

  private advanceLineTool(point: Vector) {
    if (this.drawMode !== "line") {
      this.drawMode = "line";
    }
    const startPoint = this.resolveLinePoint(point);
    if (!this.lineDraftStart) {
      this.lineDraftStart = startPoint;
      this.linePreviewEnd = startPoint.copy();
      this.repository.setCurrentElement(startPoint);
      this.drawAll();
      return;
    }

    const endPoint = this.resolveLinePoint(point);
    if (startPoint === this.lineDraftStart && endPoint === this.lineDraftStart) {
      this.lineDraftStart = undefined;
      this.drawAll();
      return;
    }

    const line = new Line();
    line.origin = this.lineDraftStart;
    line.to = endPoint;
    this.repository.doCommand(new SetLine(line));
    this.lineDraftStart = undefined;
    this.linePreviewEnd = undefined;
    this.repository.clearSelectMode();
    this.setDrawMode("normal");
  }

  private resolveLinePoint(point: Vector): Vector {
    const tolerance = this.worldTolerance(10);
    const existingVertex = this.findNearestVertex(point, tolerance);
    if (existingVertex) {
      return existingVertex;
    }

    const existingLine = this.findNearestLine(point, tolerance * 1.6);
    if (existingLine) {
      const projected = existingLine.closestPoint(point);
      const snap = new Vector(projected.x, projected.y);
      this.repository.doCommand(new SetVertex(snap));
      return this.repository.currentElement() as Vector;
    }

    const snapPoint = this.snapToGrid(point);
    this.repository.doCommand(new SetVertex(snapPoint));
    return this.repository.currentElement() as Vector;
  }

  private resolveLineHoverPoint(point: Vector): Vector {
    const tolerance = this.worldTolerance(12);
    const existingVertex = this.findNearestVertex(point, tolerance);
    if (existingVertex) {
      return existingVertex.copy();
    }
    return this.snapToGrid(point);
  }

  private snapToGrid(point: Vector): Vector {
    if (!this.gridSnapEnabled) {
      return point.copy();
    }
    const grid = 0.5;
    const snapped = new Vector(
      Math.round(point.x / grid) * grid,
      Math.round(point.y / grid) * grid
    );
    return snapped;
  }

  private handleLoopTool(point: Vector) {
    const current = this.repository.currentElement();
    if (!current) {
      this.putLoop(point.x, point.y);
      this.setDrawMode("normal");
      return;
    }

    if (isLoop(current)) {
      const loop = new Loop();
      loop.origin = point;
      current.addLoop(loop);
      this.repository.doCommand(new SetLoop(loop));
      this.setDrawMode("normal");
      return;
    }

    if (current && isLine(current)) {
      const loop = new Loop();
      loop.origin = current.to.add(current.directionUnit().multi(loop.radius * 2));
      this.repository.doCommand(new SetLoop(loop));
      this.setDrawMode("normal");
      return;
    }

    if (isVector(current)) {
      const loop = new Loop();
      loop.origin = current;
      this.repository.doCommand(new SetLoop(loop));
      this.setDrawMode("normal");
      return;
    }

    this.putLoop(point.x, point.y);
    this.setDrawMode("normal");
  }

  private cancelLineDraft() {
    if (!this.lineDraftStart && !this.lineToolPress) {
      return;
    }
    this.lineDraftStart = undefined;
    this.lineToolPress = undefined;
    this.linePreviewEnd = undefined;
    this.drawAll();
  }

  /**
   * Wires up the custom context menu so right-click behaves consistently with
   * the command palette. The menu is lightweight and hides whenever the user
   * clicks elsewhere or the viewport changes.
   */
  private setupContextMenu() {
    this.contextMenuElement = document.getElementById("canvas-context-menu");
    if (!this.contextMenuElement) {
      return;
    }

    this.canvas.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      this.setPrevXY(ev.offsetX, ev.offsetY);
      const point = this.getPointer();
      const hit = this.repository.findElement(point, this.repository.currentElement()?.id, this.worldTolerance(12));
      if (hit && !this.repository.isSelected(hit)) {
        this.repository.setCurrentElement(hit);
        this.drawAll();
      }
      this.updateContextMenuBySelection();
      this.showContextMenu(ev.clientX, ev.clientY);
    });

    document.addEventListener("click", (ev) => {
      if (!this.contextMenuElement) {
        return;
      }
      if (this.contextMenuElement.contains(ev.target as Node)) {
        return;
      }
      this.hideContextMenu();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        this.hideContextMenu();
      }
    });

    window.addEventListener("resize", () => {
      this.hideContextMenu();
    });

    window.addEventListener("scroll", () => {
      this.hideContextMenu();
    });
  }

  private setupLoopControls() {
    this.loopControls.container = document.getElementById("loop-controls");
    this.loopControls.radiusSlider = document.getElementById("loop-radius") as HTMLInputElement | null;
    this.loopControls.startSlider = document.getElementById("loop-gap-start") as HTMLInputElement | null;
    this.loopControls.endSlider = document.getElementById("loop-gap-end") as HTMLInputElement | null;
    this.loopControls.radiusValue = document.getElementById("loop-radius-value");
    this.loopControls.startValue = document.getElementById("loop-start-value");
    this.loopControls.endValue = document.getElementById("loop-end-value");
    this.loopControls.arcValue = document.getElementById("loop-arc-value");
    this.loopControls.gapValue = document.getElementById("loop-gap-value");

    const radiusSlider = this.loopControls.radiusSlider;
    if (radiusSlider) {
      radiusSlider.addEventListener("input", (ev) => {
        const value = Number((ev.target as HTMLInputElement).value);
        this.previewLoopRadius(value);
      });
      radiusSlider.addEventListener("change", (ev) => {
        const value = Number((ev.target as HTMLInputElement).value);
        this.commitLoopRadius(value);
      });
    }

    const startSlider = this.loopControls.startSlider;
    if (startSlider) {
      startSlider.addEventListener("input", (ev) => {
        const value = Number((ev.target as HTMLInputElement).value);
        this.previewLoopStart(value);
      });
      startSlider.addEventListener("change", (ev) => {
        const value = Number((ev.target as HTMLInputElement).value);
        this.commitLoopStart(value);
      });
    }

    const endSlider = this.loopControls.endSlider;
    if (endSlider) {
      endSlider.addEventListener("input", (ev) => {
        const value = Number((ev.target as HTMLInputElement).value);
        this.previewLoopEnd(value);
      });
      endSlider.addEventListener("change", (ev) => {
        const value = Number((ev.target as HTMLInputElement).value);
        this.commitLoopEnd(value);
      });
    }

    this.loopControls.container
      ?.querySelectorAll<HTMLButtonElement>("[data-loop-step]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const property = button.dataset.loopStep as "radius" | "start" | "end" | undefined;
          const step = Number(button.dataset.step ?? "0");
          if (!property || Number.isNaN(step)) {
            return;
          }
          this.adjustLoop(property, step);
        });
      });

    this.loopControls.container
      ?.querySelectorAll<HTMLButtonElement>("[data-loop-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.loopAction;
          if (!action) {
            return;
          }
          this.handleLoopAction(action);
        });
      });
  }

  private setupInspectorControls() {
    this.inspectorControls.root = document.getElementById("selection-inspector");
    this.inspectorControls.selectionType = document.getElementById("inspector-selection-type");
    this.inspectorControls.selectionCount = document.getElementById("inspector-selection-count");
    this.inspectorControls.lineLength = document.getElementById("inspector-line-length");
    this.inspectorControls.lineArrow = document.getElementById("inspector-line-arrow");
    this.inspectorControls.lineStyle = document.getElementById("inspector-line-style") as HTMLSelectElement | null;
    this.inspectorControls.lineLabel = document.getElementById("inspector-line-label") as HTMLInputElement | null;
    this.inspectorControls.lineApply = document.getElementById("inspector-line-label-apply") as HTMLButtonElement | null;
    this.inspectorControls.lineStraighten = document.getElementById("inspector-line-straighten") as HTMLButtonElement | null;
    this.inspectorControls.loopStyle = document.getElementById("inspector-loop-style") as HTMLSelectElement | null;
    this.inspectorControls.loopLabel = document.getElementById("inspector-loop-label") as HTMLInputElement | null;
    this.inspectorControls.loopApply = document.getElementById("inspector-loop-label-apply") as HTMLButtonElement | null;
    this.inspectorControls.loopState = document.getElementById("inspector-loop-state");
    this.inspectorControls.textValue = document.getElementById("inspector-text-value") as HTMLTextAreaElement | null;
    this.inspectorControls.textApply = document.getElementById("inspector-text-apply") as HTMLButtonElement | null;
    this.inspectorControls.textLength = document.getElementById("inspector-text-length");

    this.inspectorControls.lineStyle?.addEventListener("change", () => {
      const line = this.currentLineSelection();
      const style = this.parseLineStyle(this.inspectorControls.lineStyle?.value ?? "");
      if (!line || !style || line.style === style) {
        return;
      }
      this.repository.doCommand(new SetLineStyle(line, style));
      this.drawAll();
    });

    this.inspectorControls.loopStyle?.addEventListener("change", () => {
      const loop = this.currentLoop();
      const style = this.parseLoopStyle(this.inspectorControls.loopStyle?.value ?? "");
      if (!loop || !style || loop.style === style) {
        return;
      }
      this.repository.doCommand(new SetLoopStyle(loop, style));
      this.drawAll();
    });

    this.inspectorControls.lineApply?.addEventListener("click", () => {
      this.commitInspectorLineLabel();
    });
    this.inspectorControls.lineLabel?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") {
        return;
      }
      ev.preventDefault();
      this.commitInspectorLineLabel();
    });

    this.inspectorControls.loopApply?.addEventListener("click", () => {
      this.commitInspectorLoopLabel();
    });
    this.inspectorControls.loopLabel?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") {
        return;
      }
      ev.preventDefault();
      this.commitInspectorLoopLabel();
    });

    this.inspectorControls.textApply?.addEventListener("click", () => {
      this.commitInspectorTextLabel();
    });
    this.inspectorControls.textValue?.addEventListener("keydown", (ev) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key !== "Enter") {
        return;
      }
      ev.preventDefault();
      this.commitInspectorTextLabel();
    });

    this.inspectorControls.lineStraighten?.addEventListener("click", () => {
      const line = this.currentLineSelection();
      if (!line || !line.control) {
        return;
      }
      this.repository.doCommand(new SetLineControlPoint(line, null));
      this.drawAll();
    });
  }

  private parseLineStyle(value: string): LineStyle | undefined {
    if (value === "normal" || value === "dash" || value === "wave" || value === "coil" || value === "double") {
      return value;
    }
    return undefined;
  }

  private parseLoopStyle(value: string): LineStyle | undefined {
    if (value === "normal" || value === "dash" || value === "wave" || value === "coil") {
      return value;
    }
    return undefined;
  }

  private currentLineSelection(): Line | undefined {
    const current = this.repository.currentElement();
    if (current && isLine(current)) {
      return current;
    }
    return undefined;
  }

  private currentStringSelection(): MyString | undefined {
    const current = this.repository.currentElement();
    if (current && isString(current)) {
      return current;
    }
    return undefined;
  }

  private commitInspectorLineLabel() {
    const line = this.currentLineSelection();
    const input = this.inspectorControls.lineLabel;
    if (!line || !input) {
      return;
    }
    const next = input.value;
    if (line.label === next) {
      return;
    }
    this.repository.doCommand(new SetLineLabel(line, next));
    this.drawAll();
  }

  private commitInspectorLoopLabel() {
    const loop = this.currentLoop();
    const input = this.inspectorControls.loopLabel;
    if (!loop || !input) {
      return;
    }
    const next = input.value;
    if (loop.label === next) {
      return;
    }
    this.repository.doCommand(new SetLoopLabel(loop, next));
    this.drawAll();
  }

  private commitInspectorTextLabel() {
    const text = this.currentStringSelection();
    const input = this.inspectorControls.textValue;
    if (!text || !input) {
      return;
    }
    const next = input.value;
    if (text.label === next) {
      return;
    }
    this.repository.doCommand(new SetStringLabel(text, next));
    this.drawAll();
  }

  private updateInspectorControlsUI(current?: Elem) {
    const controls = this.inspectorControls;
    const root = controls.root;
    if (!root) {
      return;
    }

    const selectedCount = this.repository.getSelectedElements().length;
    if (controls.selectionCount) {
      controls.selectionCount.textContent = selectedCount > 0 ? `${selectedCount} selected` : "No selection";
    }

    let kind: "none" | "line" | "loop" | "string" | "vertex" | "group" | "elem" = "none";
    let label = "No selection";
    if (current) {
      if (isLine(current)) {
        kind = "line";
        label = "Line";
      } else if (isLoop(current)) {
        kind = "loop";
        label = "Loop";
      } else if (isString(current)) {
        kind = "string";
        label = "Text";
      } else if (isVector(current)) {
        kind = "vertex";
        label = "Vertex";
      } else if (isGroup(current)) {
        kind = "group";
        label = "Group";
      } else {
        kind = "elem";
        label = "Element";
      }
    }
    root.dataset.selectionKind = kind;
    root.classList.toggle("is-empty", kind === "none");
    if (controls.selectionType) {
      controls.selectionType.textContent = label;
    }

    if (current && isLine(current)) {
      if (controls.lineLength) {
        controls.lineLength.textContent = current.length().toFixed(2);
      }
      if (controls.lineArrow) {
        controls.lineArrow.textContent = current.allow ? "on" : "off";
      }
      if (controls.lineStyle && document.activeElement !== controls.lineStyle) {
        controls.lineStyle.value = current.style;
      }
      if (controls.lineLabel && document.activeElement !== controls.lineLabel) {
        controls.lineLabel.value = current.label ?? "";
      }
    }

    if (current && isLoop(current)) {
      if (controls.loopStyle && document.activeElement !== controls.loopStyle) {
        controls.loopStyle.value = this.parseLoopStyle(current.style) ?? "normal";
      }
      if (controls.loopLabel && document.activeElement !== controls.loopLabel) {
        controls.loopLabel.value = current.label ?? "";
      }
      if (controls.loopState) {
        controls.loopState.textContent = `arrow ${current.allow ? "on" : "off"} / fill ${current.fill ? "on" : "off"}`;
      }
    }

    if (current && isString(current)) {
      if (controls.textValue && document.activeElement !== controls.textValue) {
        controls.textValue.value = current.label;
      }
      if (controls.textLength) {
        controls.textLength.textContent = `${current.label.length} chars`;
      }
    }
  }

  private showContextMenu(clientX: number, clientY: number) {
    if (!this.contextMenuElement) {
      return;
    }
    const menu = this.contextMenuElement;
    menu.style.visibility = "hidden";
    menu.style.display = "block";

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(clientX, viewportWidth - menuWidth - 8);
    const top = Math.min(clientY, viewportHeight - menuHeight - 8);

    menu.style.left = `${Math.max(0, left)}px`;
    menu.style.top = `${Math.max(0, top)}px`;
    menu.style.visibility = "visible";
  }

  private updateContextMenuBySelection() {
    if (!this.contextMenuElement) {
      return;
    }
    const hasSelection = this.repository.getSelectedElements().length > 0;
    this.contextMenuElement
      .querySelectorAll<HTMLElement>("[data-selection-required]")
      .forEach((element) => {
        const requireSelection = element.dataset.selectionRequired === "true";
        if (requireSelection && !hasSelection) {
          element.classList.add("d-none");
        } else {
          element.classList.remove("d-none");
        }
      });
  }

  private hideContextMenu() {
    if (!this.contextMenuElement) {
      return;
    }
    this.contextMenuElement.style.display = "none";
    this.contextMenuElement.style.visibility = "hidden";
  }

  /**
   * Sets the active drawing mode and refreshes the UI. This wrapper is used by
   * both keyboard shortcuts and command buttons to ensure we always reset line
   * staging state and highlight the currently active tool.
   */
  setDrawMode(mode: DrawMode) {
    this.resetLoopPreview();
    this.drawMode = mode;
    this.activeTool = this.tools[mode];
    if (mode !== "line") {
      this.lineDraftStart = undefined;
      this.lineToolPress = undefined;
      this.linePreviewEnd = undefined;
    }
    this.updateCursor();
    this.drawAll();
  }

  /**
   * Keeps the button panel in sync with the active draw mode. Using a helper
   * avoids sprinkling DOM-manipulation logic around the codebase.
   */
  private updateModeButtons() {
    const modeButtons = document.querySelectorAll<HTMLElement>("[data-mode]");
    modeButtons.forEach((button) => {
      const buttonMode = button.dataset.mode as DrawMode | undefined;
      if (!buttonMode) {
        return;
      }
      if (buttonMode === this.drawMode) {
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");
      } else {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      }
    });
  }

  /**
   * Helper for comparing vectors when the pointer interaction introduces minor
   * floating point noise. Keeps handle drags from enqueuing no-op commands.
   */
  private vectorsAlmostEqual(a?: Vector | null, b?: Vector | null, epsilon = 1e-6): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
  }

  private hitTestLineHandle(point: Vector):
    | { line: Line; handle: "origin" | "to" | "control"; position: Vector; createControl: boolean }
    | null {
    const candidates: Line[] = [];
    const current = this.repository.currentElement();
    if (current && isLine(current)) {
      candidates.push(current);
    }
    this.repository.getSelectedElements().forEach((elem) => {
      if (isLine(elem) && !candidates.includes(elem)) {
        candidates.push(elem);
      }
    });

    if (candidates.length === 0) {
      return null;
    }

    const tolerance = this.worldTolerance(10);
    let bestMatch:
      | { line: Line; handle: "origin" | "to" | "control"; position: Vector; createControl: boolean }
      | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    candidates.forEach((line) => {
      const handleSpecs: Array<{
        handle: "origin" | "to" | "control";
        position: Vector;
        createControl: boolean;
      }> = [
        { handle: "origin", position: line.origin, createControl: false },
        { handle: "to", position: line.to, createControl: false },
      ];

      if (line.control) {
        handleSpecs.push({ handle: "control", position: line.control, createControl: false });
      } else {
        handleSpecs.push({ handle: "control", position: line.pointAt(0.5), createControl: true });
      }

      handleSpecs.forEach((spec) => {
        const distance = point.minus(spec.position).length();
        if (distance < tolerance && distance < bestDistance) {
          bestMatch = { line, handle: spec.handle, position: spec.position, createControl: spec.createControl };
          bestDistance = distance;
        }
      });
    });

    return bestMatch;
  }

  private activeLoop(): Loop | undefined {
    const current = this.repository.currentElement();
    if (current && isLoop(current)) {
      return current;
    }
    const selectedLoop = this.repository
      .getSelectedElements()
      .find((elem): elem is Loop => isLoop(elem));
    return selectedLoop;
  }

  private loopRadiusHandlePoint(loop: Loop): Vector {
    return new Vector(loop.origin.x + loop.radius, loop.origin.y);
  }

  private loopStartAngleHandlePoint(loop: Loop): Vector {
    return new Vector(
      loop.origin.x + Math.cos(loop.loopBeginAngle) * loop.radius,
      loop.origin.y + Math.sin(loop.loopBeginAngle) * loop.radius
    );
  }

  private loopEndAngleHandlePoint(loop: Loop): Vector {
    return new Vector(
      loop.origin.x + Math.cos(loop.loopEndAngle) * loop.radius,
      loop.origin.y + Math.sin(loop.loopEndAngle) * loop.radius
    );
  }

  private hitTestLoopHandle(point: Vector): { loop: Loop; handle: "radius" | "start" | "end"; position: Vector } | null {
    const loop = this.activeLoop();
    if (!loop) {
      return null;
    }
    const handles = [
      { handle: "radius" as const, position: this.loopRadiusHandlePoint(loop) },
      { handle: "start" as const, position: this.loopStartAngleHandlePoint(loop) },
      { handle: "end" as const, position: this.loopEndAngleHandlePoint(loop) },
    ];
    let nearest: { loop: Loop; handle: "radius" | "start" | "end"; position: Vector } | null = null;
    let min = Number.POSITIVE_INFINITY;
    handles.forEach((item) => {
      const distance = point.minus(item.position).length();
      if (distance < min) {
        min = distance;
        nearest = { loop, handle: item.handle, position: item.position };
      }
    });
    if (nearest && min <= this.worldTolerance(10)) {
      return nearest;
    }
    return null;
  }

  private drawLineHandles(lines: Line[]) {
    if (lines.length === 0) {
      return;
    }
    const ctx = this.context;
    const scale = config.scale;
    const offset = this.drawContext.getViewOffset();
    const baseRadius = Math.max(4, Math.min(6, scale * 0.35));

    lines.forEach((line) => {
      const controlPoint = line.control ? line.control : line.pointAt(0.5);
      const hasControl = !!line.control;

      ctx.save();
      ctx.strokeStyle = "rgba(30, 144, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash(hasControl ? [4, 4] : [6, 6]);
      ctx.beginPath();
      ctx.moveTo((line.origin.x + offset.x) * scale, (line.origin.y + offset.y) * scale);
      ctx.lineTo((controlPoint.x + offset.x) * scale, (controlPoint.y + offset.y) * scale);
      ctx.lineTo((line.to.x + offset.x) * scale, (line.to.y + offset.y) * scale);
      ctx.stroke();
      ctx.restore();

      const handles: Array<{ point: Vector; ghost: boolean }> = [
        { point: line.origin, ghost: false },
        { point: line.to, ghost: false },
        { point: controlPoint, ghost: !hasControl },
      ];

      handles.forEach((handle) => {
        ctx.save();
        const px = (handle.point.x + offset.x) * scale;
        const py = (handle.point.y + offset.y) * scale;
        const radius = handle.ghost ? baseRadius + 2 : baseRadius;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        if (handle.ghost) {
          ctx.fillStyle = "rgba(30, 144, 255, 0.15)";
          ctx.strokeStyle = "rgba(30, 144, 255, 0.9)";
          ctx.lineWidth = 1.5;
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(30, 144, 255, 0.9)";
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1.5;
          ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
      });
    });
  }

  private drawLoopHandles(loop?: Loop) {
    if (!loop) {
      return;
    }
    const ctx = this.context;
    const scale = config.scale;
    const offset = this.drawContext.getViewOffset();
    const handles = [
      { handle: "radius" as const, point: this.loopRadiusHandlePoint(loop), fill: "rgba(220, 53, 69, 0.85)" },
      { handle: "start" as const, point: this.loopStartAngleHandlePoint(loop), fill: "rgba(255, 193, 7, 0.92)" },
      { handle: "end" as const, point: this.loopEndAngleHandlePoint(loop), fill: "rgba(25, 135, 84, 0.92)" },
    ];

    handles.forEach((item) => {
      const px = (item.point.x + offset.x) * scale;
      const py = (item.point.y + offset.y) * scale;
      const isHover =
        this.hoveredHit?.type === "loop-handle" &&
        this.hoveredHit.loop.id === loop.id &&
        this.hoveredHit.handle === item.handle;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, isHover ? 7.5 : 6, 0, Math.PI * 2);
      ctx.fillStyle = item.fill;
      ctx.strokeStyle = "white";
      ctx.lineWidth = isHover ? 2 : 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  private drawHoverFeedback() {
    const hit = this.hoveredHit;
    if (!hit) {
      return;
    }
    if (hit.type === "vertex") {
      draw(this.drawContext, hit.vertex, "canvas", "sub");
      return;
    }
    if (hit.type === "edge") {
      draw(this.drawContext, hit.elem, "canvas", "sub");
      return;
    }

    const point = hit.position;
    const scale = config.scale;
    const offset = this.drawContext.getViewOffset();
    const px = (point.x + offset.x) * scale;
    const py = (point.y + offset.y) * scale;
    this.context.save();
    this.context.beginPath();
    this.context.arc(px, py, 8, 0, Math.PI * 2);
    this.context.strokeStyle = "rgba(13,110,253,0.95)";
    this.context.lineWidth = 2;
    this.context.stroke();
    this.context.restore();
  }

  setPrevXY(eventX: number, eventY: number) {
    this.rawPointer = new Vector(eventX, eventY);
    // loggerVer(`rawPointer ${this.rawPointer.x}  ${this.rawPointer.y}`);
  }

  private effectiveDrawMode(ev?: MouseEvent): DrawMode {
    if (!ev) {
      return this.drawMode;
    }
    if ((ev.ctrlKey || ev.metaKey) && this.drawMode !== "normal") {
      return "normal";
    }
    return this.drawMode;
  }

  private worldTolerance(px = 10): number {
    return px / Math.max(config.scale, 0.0001);
  }

  private hitTestPriority(point: Vector, precisePoint: Vector): HitResult | null {
    const vertex = this.repository.findNearestVertex(point, this.worldTolerance(14));
    if (vertex) {
      return { type: "vertex", vertex };
    }

    const lineHandleHit = this.hitTestLineHandle(precisePoint);
    if (lineHandleHit) {
      return {
        type: "line-handle",
        line: lineHandleHit.line,
        handle: lineHandleHit.handle,
        position: lineHandleHit.position,
        createControl: lineHandleHit.createControl,
      };
    }
    const loopHandleHit = this.hitTestLoopHandle(precisePoint);
    if (loopHandleHit) {
      return {
        type: "loop-handle",
        loop: loopHandleHit.loop,
        handle: loopHandleHit.handle,
        position: loopHandleHit.position,
      };
    }
    const edge = this.repository.findNearestEdge(point, this.worldTolerance(14));
    if (edge) {
      return { type: "edge", elem: edge };
    }
    return null;
  }

  private updateHoverState(point: Vector, precisePoint: Vector): void {
    this.hoveredHit = this.hitTestPriority(point, precisePoint);
  }

  private updateCursor(): void {
    let next: "default" | "grab" | "grabbing" | "crosshair" | "pointer" = "default";
    if (this.pointerGesture || this.panDragLast || this.spacePanActive) {
      next = this.panDragLast || this.pointerGesture ? "grabbing" : "grab";
    } else if (this.drawMode === "line") {
      next = "crosshair";
    } else if (this.dragSession) {
      next = "grabbing";
    } else if (this.hoveredHit) {
      if (this.hoveredHit.type === "edge" || this.hoveredHit.type === "vertex") {
        next = "grab";
      } else {
        next = "pointer";
      }
    }
    if (this.cursorMode === next) {
      return;
    }
    this.cursorMode = next;
    this.canvas.style.cursor = next;
  }

  private resizeCanvasToViewport() {
    const parent = this.canvas.parentElement;
    if (!parent) {
      return;
    }
    const rect = parent.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.drawAll();
    }
  }

  private onCanvasWheel(ev: WheelEvent) {
    ev.preventDefault();
    this.setPrevXY(ev.offsetX, ev.offsetY);

    const panByTrackpad = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) * 0.8 && !ev.ctrlKey && !ev.metaKey;
    if (panByTrackpad) {
      const offset = this.drawContext.getViewOffset();
      this.drawContext.setViewOffset(
        offset.add(new Vector(-ev.deltaX / config.scale, -ev.deltaY / config.scale))
      );
      this.drawAll();
      return;
    }

    const before = this.getPointerPrecise();
    const factor = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
    const nextScale = Math.max(4, Math.min(80, config.scale * factor));
    if (Math.abs(nextScale - config.scale) < 1e-6) {
      return;
    }
    config.scale = nextScale;
    const after = this.getPointerPrecise();
    const delta = before.minus(after);
    const offset = this.drawContext.getViewOffset();
    this.drawContext.setViewOffset(offset.add(delta));
    this.drawAll();
  }

  private getRawPointFromClient(clientX: number, clientY: number): Vector {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    return new Vector(
      (clientX - rect.left) * scaleX,
      (clientY - rect.top) * scaleY
    );
  }

  private pointerToMouseEvent(ev: PointerEvent, raw: Vector): MouseEvent {
    return {
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      metaKey: ev.metaKey,
      shiftKey: ev.shiftKey,
      button: ev.button,
      buttons: ev.buttons,
      offsetX: raw.x,
      offsetY: raw.y,
    } as unknown as MouseEvent;
  }

  private beginPointerGestureFromActivePointers(): boolean {
    if (this.activePointers.size < 2) {
      return false;
    }
    const entries = Array.from(this.activePointers.entries()).slice(0, 2);
    const [id1, p1] = entries[0];
    const [id2, p2] = entries[1];
    this.pointerGesture = {
      pointerIds: [id1, id2],
      lastMidRaw: new Vector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2),
      lastDistance: Math.max(1, p1.minus(p2).length()),
    };
    this.interactionPointerId = undefined;
    this.pointerTool = undefined;
    this.interactionState = { type: "idle" };
    this.dragSession = undefined;
    this.selectionRect = undefined;
    this.panDragLast = undefined;
    return true;
  }

  private updatePointerGestureFromActivePointers(): boolean {
    if (!this.pointerGesture) {
      return false;
    }
    const [id1, id2] = this.pointerGesture.pointerIds;
    const p1 = this.activePointers.get(id1);
    const p2 = this.activePointers.get(id2);
    if (!p1 || !p2) {
      return false;
    }
    const midRaw = new Vector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    const distance = Math.max(1, p1.minus(p2).length());

    const currentOffset = this.drawContext.getViewOffset();
    const beforeScale = config.scale;
    const scaleRatio = distance / Math.max(1, this.pointerGesture.lastDistance);
    const nextScale = Math.max(4, Math.min(80, beforeScale * scaleRatio));

    let nextOffset = currentOffset;
    if (Math.abs(nextScale - beforeScale) > 1e-6) {
      const anchorWorldBefore = this.rawToWorld(midRaw, beforeScale, currentOffset);
      const anchorWorldAfter = this.rawToWorld(midRaw, nextScale, currentOffset);
      config.scale = nextScale;
      nextOffset = currentOffset.add(anchorWorldBefore.minus(anchorWorldAfter));
    }

    const deltaRaw = midRaw.minus(this.pointerGesture.lastMidRaw);
    nextOffset = nextOffset.add(new Vector(deltaRaw.x / config.scale, deltaRaw.y / config.scale));
    this.drawContext.setViewOffset(nextOffset);

    this.pointerGesture.lastMidRaw = midRaw;
    this.pointerGesture.lastDistance = distance;
    this.drawAll();
    return true;
  }

  private rawToWorld(raw: Vector, scale: number, offset: Vector): Vector {
    return raw.multi(1 / scale).minus(offset);
  }

  private onCanvasPointerDown(ev: PointerEvent) {
    const raw = this.getRawPointFromClient(ev.clientX, ev.clientY);
    this.setPrevXY(raw.x, raw.y);
    this.activePointers.set(ev.pointerId, raw);
    if (ev.pointerType !== "mouse") {
      ev.preventDefault();
    }
    if (this.canvas.setPointerCapture) {
      this.canvas.setPointerCapture(ev.pointerId);
    }

    if (this.beginPointerGestureFromActivePointers()) {
      this.updateCursor();
      return;
    }

    this.interactionPointerId = ev.pointerId;
    const mouseLike = this.pointerToMouseEvent(ev, raw);
    this.mouseDown(mouseLike);
    this.updateCursor();
  }

  private onCanvasPointerMove(ev: PointerEvent) {
    const raw = this.getRawPointFromClient(ev.clientX, ev.clientY);
    this.setPrevXY(raw.x, raw.y);
    if (this.activePointers.has(ev.pointerId)) {
      this.activePointers.set(ev.pointerId, raw);
    }

    if (this.pointerGesture) {
      if (!this.updatePointerGestureFromActivePointers()) {
        this.pointerGesture = undefined;
      }
      if (ev.pointerType !== "mouse") {
        ev.preventDefault();
      }
      this.updateCursor();
      return;
    }

    if (this.interactionPointerId !== undefined && ev.pointerId !== this.interactionPointerId) {
      return;
    }

    if (this.interactionPointerId === undefined && ev.pointerType !== "mouse" && ev.pointerType !== "pen") {
      return;
    }

    const mouseLike = this.pointerToMouseEvent(ev, raw);
    this.move(mouseLike);
    if (ev.pointerType !== "mouse") {
      ev.preventDefault();
    }
    this.updateCursor();
  }

  private onCanvasPointerUp(ev: PointerEvent) {
    const raw = this.getRawPointFromClient(ev.clientX, ev.clientY);
    this.setPrevXY(raw.x, raw.y);
    this.activePointers.delete(ev.pointerId);
    if (this.canvas.releasePointerCapture) {
      try {
        this.canvas.releasePointerCapture(ev.pointerId);
      } catch {
        // no-op
      }
    }

    if (this.pointerGesture) {
      if (this.beginPointerGestureFromActivePointers()) {
        this.updateCursor();
        return;
      }
      this.pointerGesture = undefined;
      this.pointerTool = undefined;
      this.interactionPointerId = undefined;
      this.updateCursor();
      return;
    }

    if (this.interactionPointerId !== undefined && ev.pointerId === this.interactionPointerId) {
      const mouseLike = this.pointerToMouseEvent(ev, raw);
      this.mouseUp(mouseLike);
      this.interactionPointerId = undefined;
      this.activeTool = this.tools[this.drawMode];
    }
    if (ev.pointerType !== "mouse") {
      ev.preventDefault();
    }
    this.updateCursor();
  }

  private onCanvasPointerCancel(ev: PointerEvent) {
    this.activePointers.delete(ev.pointerId);
    if (this.interactionPointerId === ev.pointerId) {
      this.interactionPointerId = undefined;
      this.pointerTool = undefined;
      this.interactionState = { type: "idle" };
      this.dragSession = undefined;
      this.selectionRect = undefined;
    }
    if (this.pointerGesture && this.pointerGesture.pointerIds.includes(ev.pointerId)) {
      if (!this.beginPointerGestureFromActivePointers()) {
        this.pointerGesture = undefined;
      }
    }
    this.updateCursor();
  }

  private clearTransientInputState() {
    this.spacePanActive = false;
    this.panDragLast = undefined;
    this.pointerGesture = undefined;
    this.activePointers.clear();
    this.interactionPointerId = undefined;
    this.pointerTool = undefined;
    this.interactionState = { type: "idle" };
    this.dragSession = undefined;
    this.selectionRect = undefined;
    this.updateCursor();
  }

  /**
   * Returns the last pointer position in canvas coordinates. Centralises
   * scaling logic so every command receives consistent values regardless of
   * the current zoom level.
   */
  getPointer(): Vector {
    const scale = config.scale;
    const offset = this.drawContext.getViewOffset();
    const p = this.rawPointer.multi(1 / scale).minus(offset);
    // loggerVer(`p ${p.x}  ${p.y}`);
    return p;
  }

  private getPointerPrecise(): Vector {
    const scale = config.scale;
    const offset = this.drawContext.getViewOffset();
    return this.rawPointer.multi(1 / scale).minus(offset);
  }

  private handleCanvasClickForMode(mode: DrawMode, point: Vector, ev: MouseEvent) {
    this.resetLoopPreview();
    switch (mode) {
      case "normal":
        this.selectAt(point, ev.shiftKey || ev.metaKey || ev.ctrlKey);
        break;
      case "point":
        this.insertVertex(point);
        break;
      case "line":
        this.advanceLineTool(point);
        break;
      case "loop":
        this.handleLoopTool(point);
        break;
      case "string":
        this.setString(point.x, point.y);
        break;
    }
  }

  private handleCanvasClick(point: Vector, ev: MouseEvent) {
    this.handleCanvasClickForMode(this.effectiveDrawMode(ev), point, ev);
  }

  private onCanvasDoubleClick(ev: MouseEvent) {
    this.resetLoopPreview();
    this.interactionState = { type: "idle" };
    this.dragSession = undefined;
    this.selectionRect = undefined;

    this.setPrevXY(ev.offsetX, ev.offsetY);
    const point = this.getPointer();
    const precisePoint = this.getPointerPrecise();

    if (this.drawMode === "normal") {
      const handleHit = this.hitTestLineHandle(precisePoint);
      if (handleHit && handleHit.handle === "control" && handleHit.createControl) {
        const controlPoint = handleHit.position.copy();
        this.repository.doCommand(new SetLineControlPoint(handleHit.line, controlPoint));
        this.repository.setCurrentElement(handleHit.line);
        this.drawAll();
        return;
      }
    }

    if (this.drawMode !== "normal") {
      this.setDrawMode("normal");
    }

    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
    const tolerance = this.worldTolerance(12);
    const candidates = this.repository.findAllNear(point, tolerance);
    if (candidates.length === 0) {
      return;
    }

    const lastContext = this.lastHitContext;
    let nextIndex = 0;
    if (
      lastContext &&
      Math.abs(lastContext.point.x - point.x) < 1e-6 &&
      Math.abs(lastContext.point.y - point.y) < 1e-6 &&
      lastContext.tolerance === tolerance
    ) {
      const current = this.repository.currentElement();
      const currentIndex = current
        ? candidates.findIndex((elem) => elem.id === current.id)
        : -1;
      nextIndex = currentIndex >= 0 ? (currentIndex + 1) % candidates.length : 0;
    }

    const hit = candidates[nextIndex];
    if (additive) {
      this.repository.toggleSelection(hit);
    } else {
      this.repository.setCurrentElement(hit);
    }
    this.lastHitContext = { point: point.copy(), tolerance };
    this.drawAll();
  }

  private dragThresholdCanvas(): number {
    return 3 / Math.max(config.scale, 0.0001);
  }

  private beginPotentialInteraction(point: Vector, precisePoint: Vector, ev: MouseEvent, modeOverride?: DrawMode) {
    const mode = modeOverride ?? this.effectiveDrawMode(ev);
    if (mode !== "normal") {
      this.interactionState = {
        type: "potentialClick",
        startPointer: point,
        hit: undefined,
        additive: ev.shiftKey || ev.metaKey || ev.ctrlKey,
        forceRect: false,
      };
      return;
    }

    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
    const forceRect = ev.altKey;
    const hitResult = this.hitTestPriority(point, precisePoint);
    const hit = hitResult?.type === "edge"
      ? hitResult.elem
      : hitResult?.type === "vertex"
        ? hitResult.vertex
        : hitResult?.type === "line-handle"
          ? hitResult.line
          : hitResult?.type === "loop-handle"
            ? hitResult.loop
            : undefined;

    if (hit && !this.repository.isSelected(hit as Elem)) {
      if (additive) {
        this.repository.toggleSelection(hit as Elem);
      } else {
        this.repository.setCurrentElement(hit as Elem);
      }
      this.drawAll();
    } else if (!hit && !additive) {
      this.repository.clearSelectMode();
      this.drawAll();
    }

    this.interactionState = {
      type: "potentialClick",
      startPointer: point,
      hit,
      additive,
      forceRect,
    };
  }

  private resolveToolForEvent(ev?: MouseEvent): ToolState {
    return this.tools[this.effectiveDrawMode(ev)];
  }

  public dispatchToolMouseDown(mode: DrawMode, point: Vector, precisePoint: Vector, ev: MouseEvent): void {
    if (mode === "line") {
      const startVertex = this.lineDraftStart ?? this.resolveLinePoint(point);
      this.linePreviewEnd = startVertex.copy();
      this.lineToolPress = {
        startPointer: point.copy(),
        startVertex,
        didDrag: false,
      };
      this.interactionState = { type: "dragging" };
      this.drawAll();
      return;
    }

    if (mode === "normal") {
      const lineHandleHit = this.hitTestLineHandle(precisePoint);
      if (lineHandleHit) {
        const { line, handle, createControl } = lineHandleHit;
        if (!this.repository.isSelected(line)) {
          this.repository.setCurrentElement(line);
          this.drawAll();
        }
        this.dragSession = {
          type: "handle",
          line,
          handle,
          startPointer: point,
          lastPointer: point,
          initial: {
            origin: line.origin.copy(),
            to: line.to.copy(),
            control: line.control ? line.control.copy() : null,
          },
          createdControl: createControl,
          detachMode: ev.altKey,
        };
        this.interactionState = { type: "dragging" };
        return;
      }

      const loopHandle = this.hitTestLoopHandle(precisePoint);
      if (loopHandle) {
        this.dragSession = {
          type: "loop-handle",
          loop: loopHandle.loop,
          handle: loopHandle.handle,
          startPointer: point,
          startRadius: loopHandle.loop.radius,
          startBeginAngle: loopHandle.loop.loopBeginAngle,
          startEndAngle: loopHandle.loop.loopEndAngle,
        };
        this.interactionState = { type: "dragging" };
        return;
      }

      const nearVertex = this.findNearestVertex(point, this.worldTolerance(14));
      if (nearVertex) {
        if (!this.repository.isSelected(nearVertex)) {
          this.repository.setCurrentElement(nearVertex);
          this.drawAll();
        }
        const selected = this.repository.getSelectedElements();
        this.dragSession = {
          type: "move",
          elements: selected.length > 0 ? selected : [nearVertex],
          startPointer: point,
          lastPointer: point,
          totalDelta: new Vector(0, 0),
        };
        this.interactionState = { type: "dragging" };
        return;
      }
    }
    this.beginPotentialInteraction(point, precisePoint, ev, mode);
  }

  public dispatchToolMouseUp(mode: DrawMode, point: Vector, precisePoint: Vector, ev: MouseEvent): void {
    const state = this.interactionState;
    this.interactionState = { type: "idle" };

    if (mode === "line" && this.lineToolPress) {
      const draft = this.lineToolPress;
      this.lineToolPress = undefined;
      const distance = point.minus(draft.startPointer).length();
      if (draft.didDrag || distance > this.dragThresholdCanvas()) {
        const endPoint = this.resolveLinePoint(point);
        const line = new Line();
        line.origin = draft.startVertex;
        line.to = endPoint;
        this.repository.doCommand(new SetLine(line));
        this.lineDraftStart = undefined;
        this.linePreviewEnd = undefined;
        this.setDrawMode("normal");
        return;
      }
      this.handleCanvasClickForMode(mode, point, ev);
      return;
    }

    if (state.type === "potentialClick") {
      this.selectionRect = undefined;
      this.handleCanvasClickForMode(mode, point, ev);
      return;
    }

    if (!this.dragSession) {
      this.selectionRect = undefined;
      return;
    }

    if (this.dragSession.type === "handle") {
      const session = this.dragSession;
      this.dragSession = undefined;
      const line = session.line;
      const initial = session.initial;
      let finalOrigin: Vector = line.origin.copy();
      let finalTo: Vector = line.to.copy();
      let finalControl = line.control ? line.control.copy() : null;

      line.origin.moveAbsolute(initial.origin);
      line.to.moveAbsolute(initial.to);
      line.control = initial.control ? initial.control.copy() : null;

      if (session.handle === "origin" && !session.detachMode) {
        const snap = this.repository.findNearestVertex(finalOrigin, this.worldTolerance(14), line.startVertexId);
        if (snap) {
          finalOrigin = snap;
        }
      }

      if (session.handle === "to" && !session.detachMode) {
        const snap = this.repository.findNearestVertex(finalTo, this.worldTolerance(14), line.endVertexId);
        if (snap) {
          finalTo = snap;
        }
      }

      if (
        session.handle === "control" &&
        session.createdControl &&
        !finalControl &&
        !this.vectorsAlmostEqual(session.lastPointer, session.startPointer)
      ) {
        finalControl = new Vector(session.lastPointer.x, session.lastPointer.y);
      }

      if (
        session.handle === "origin" &&
        !this.vectorsAlmostEqual(finalOrigin, initial.origin)
      ) {
        this.repository.doCommand(new SetLineEndpoint(line, "origin", finalOrigin));
      }

      if (
        session.handle === "to" &&
        !this.vectorsAlmostEqual(finalTo, initial.to)
      ) {
        this.repository.doCommand(new SetLineEndpoint(line, "to", finalTo));
      }

      const initialControl = initial.control;
      const controlChanged =
        (initialControl && !finalControl) ||
        (!initialControl && finalControl) ||
        (initialControl && finalControl && !this.vectorsAlmostEqual(finalControl, initialControl));

      if (session.handle === "control") {
        if (controlChanged) {
          this.repository.doCommand(new SetLineControlPoint(line, finalControl));
        } else if (session.createdControl && !finalControl) {
          line.control = null;
        }
      }

      this.drawAll();
      return;
    }

    if (this.dragSession.type === "loop-handle") {
      const session = this.dragSession;
      this.dragSession = undefined;
      const loop = session.loop;
      if (session.handle === "radius") {
        const radius = Math.max(1, point.minus(loop.origin).length());
        if (Math.abs(radius - session.startRadius) > 1e-6) {
          this.repository.doCommand(new SetLoopRadius(loop, radius));
        }
      } else if (session.handle === "start") {
        const angle = Math.atan2(point.y - loop.origin.y, point.x - loop.origin.x);
        if (Math.abs(angle - session.startBeginAngle) > 1e-6) {
          this.repository.doCommand(new SetLoopBeginAngle(loop, angle));
        }
      } else {
        const angle = Math.atan2(point.y - loop.origin.y, point.x - loop.origin.x);
        if (Math.abs(angle - session.startEndAngle) > 1e-6) {
          this.repository.doCommand(new SetLoopEndAngle(loop, angle));
        }
      }
      this.drawAll();
      return;
    }

    if (this.dragSession.type === "move") {
      const total = this.dragSession.totalDelta;
      const elements = this.dragSession.elements;
      this.dragSession = undefined;
      if (Math.abs(total.x) > 0 || Math.abs(total.y) > 0) {
        const revert = total.multi(-1);
        elements.forEach((elem) => elem.move(revert));
        const commitDelta = new Vector(total.x, total.y);
        this.repository.doCommand(new MoveGroup(elements, commitDelta));
      }
      this.drawAll();
      return;
    }

    if (this.dragSession.type === "rect") {
      const rect = this.dragSession;
      const area = Math.abs((rect.current.x - rect.start.x) * (rect.current.y - rect.start.y));
      this.dragSession = undefined;
      const additive = rect.additive;
      this.selectionRect = undefined;
      if (area > 0.01) {
        this.repository.selectInRect(
          { x1: rect.start.x, y1: rect.start.y, x2: rect.current.x, y2: rect.current.y },
          additive
        );
        this.drawAll();
      }
      return;
    }
  }

  public dispatchToolMouseMove(mode: DrawMode, pointer: Vector, precisePoint: Vector, ev: MouseEvent): void {
    if (mode === "line") {
      if (this.lineToolPress) {
        const distance = pointer.minus(this.lineToolPress.startPointer).length();
        if (distance > this.dragThresholdCanvas()) {
          this.lineToolPress.didDrag = true;
        }
        this.linePreviewEnd = this.resolveLineHoverPoint(pointer);
        const nearVertex = this.findNearestVertex(pointer, this.worldTolerance(14));
        this.hoveredSnapVertex = nearVertex ? nearVertex.copy() : undefined;
        this.hoveredSnapGrid = nearVertex ? undefined : this.snapToGrid(pointer);
        this.drawAll();
        return;
      }
      if (this.lineDraftStart || this.lineToolPress) {
        this.linePreviewEnd = this.resolveLineHoverPoint(pointer);
        const nearVertex = this.findNearestVertex(pointer, this.worldTolerance(14));
        this.hoveredSnapVertex = nearVertex ? nearVertex.copy() : undefined;
        this.hoveredSnapGrid = nearVertex ? undefined : this.snapToGrid(pointer);
        this.drawAll();
        return;
      }
      this.linePreviewEnd = undefined;
      this.hoveredSnapVertex = undefined;
      this.hoveredSnapGrid = undefined;
      return;
    }

    this.linePreviewEnd = undefined;
    this.hoveredSnapVertex = undefined;
    this.hoveredSnapGrid = undefined;

    if (mode !== "normal") {
      return;
    }

    if (this.interactionState.type === "potentialClick") {
      const delta = pointer.minus(this.interactionState.startPointer);
      if (delta.length() > this.dragThresholdCanvas()) {
        const hit = this.interactionState.hit;
        const additive = this.interactionState.additive;
        const forceRect = this.interactionState.forceRect;
        const selected = this.repository.getSelectedElements();
        const hitSelected = hit ? this.repository.isSelected(hit) : false;
        if (hit && hitSelected && !forceRect) {
          const elements = selected.length > 0 ? selected : [hit];
          this.dragSession = {
            type: "move",
            elements,
            startPointer: this.interactionState.startPointer,
            lastPointer: this.interactionState.startPointer,
            totalDelta: new Vector(0, 0),
          };
          this.interactionState = { type: "dragging" };
          const fineFactor = ev.metaKey || ev.ctrlKey ? 0.2 : 1;
          this.performMoveDrag(pointer, fineFactor);
          return;
        }

        this.dragSession = {
          type: "rect",
          start: this.interactionState.startPointer,
          current: pointer,
          additive,
        };
        this.selectionRect = {
          x1: this.interactionState.startPointer.x,
          y1: this.interactionState.startPointer.y,
          x2: pointer.x,
          y2: pointer.y,
        };
        this.interactionState = { type: "dragging" };
        this.drawAll();
        return;
      }
    }

    if (this.dragSession?.type === "rect") {
      this.dragSession.current = pointer;
      this.selectionRect = {
        x1: this.dragSession.start.x,
        y1: this.dragSession.start.y,
        x2: pointer.x,
        y2: pointer.y,
      };
      this.drawAll();
      return;
    }
    if (this.dragSession?.type === "handle") {
      this.performHandleDrag(pointer);
      return;
    }
    if (this.dragSession?.type === "loop-handle") {
      const loop = this.dragSession.loop;
      if (this.dragSession.handle === "radius") {
        const previewRadius = Math.max(1, pointer.minus(loop.origin).length());
        loop.setRadius(previewRadius);
      } else if (this.dragSession.handle === "start") {
        loop.setLoopBeginAngle(Math.atan2(pointer.y - loop.origin.y, pointer.x - loop.origin.x));
      } else {
        loop.setLoopEndAngle(Math.atan2(pointer.y - loop.origin.y, pointer.x - loop.origin.x));
      }
      this.drawAll();
      return;
    }
    if (this.dragSession?.type === "move") {
      const fineFactor = ev.metaKey || ev.ctrlKey ? 0.2 : 1;
      this.performMoveDrag(pointer, fineFactor);
      return;
    }
  }

  mouseDown(ev: MouseEvent) {
    this.setPrevXY(ev.offsetX, ev.offsetY);
    const point = this.getPointer();
    const precisePoint = this.getPointerPrecise();
    this.interactionState = { type: "idle" };
    this.selectionRect = undefined;

    if (this.spacePanActive || ev.button === 1) {
      this.panDragLast = new Vector(ev.offsetX, ev.offsetY);
      this.interactionState = { type: "dragging" };
      this.dragSession = undefined;
      this.updateCursor();
      return;
    }
    const tool = this.resolveToolForEvent(ev);
    this.pointerTool = tool;
    tool.onDown(this, point, precisePoint, ev);
    this.updateCursor();
  }

  mouseUp(ev: MouseEvent) {
    this.setPrevXY(ev.offsetX, ev.offsetY);
    const point = this.getPointer();
    this.panDragLast = undefined;
    const precisePoint = this.getPointerPrecise();
    const tool = this.pointerTool ?? this.resolveToolForEvent(ev);
    tool.onUp(this, point, precisePoint, ev);
    this.pointerTool = undefined;
    this.activeTool = this.tools[this.drawMode];
    this.updateCursor();
  }

  move(ev: MouseEvent) {
    // loggerVer(`offset ${ev.offsetX}  ${ev.offsetY}`);
    // loggerVer(`screen ${ev.screenX}  ${ev.screenY}`);
    this.setPrevXY(ev.offsetX, ev.offsetY);
    const pointer = this.getPointer();

    if (this.panDragLast) {
      const currentRaw = new Vector(ev.offsetX, ev.offsetY);
      const deltaRaw = currentRaw.minus(this.panDragLast);
      this.panDragLast = currentRaw;
      const offset = this.drawContext.getViewOffset();
      this.drawContext.setViewOffset(
        offset.add(new Vector(deltaRaw.x / config.scale, deltaRaw.y / config.scale))
      );
      this.drawAll();
      this.updateCursor();
      return;
    }

    const precise = this.getPointerPrecise();
    this.updateHoverState(pointer, precise);
    const tool = this.pointerTool ?? this.resolveToolForEvent(ev);
    tool.onMove(this, pointer, precise, ev);
    this.updateCursor();
  }

  private onKeyDown(ev: KeyboardEvent) {
    const isMeta = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();

    if (isMeta && key === "s") {
      ev.preventDefault();
      this.quickSaveSnapshot();
      return;
    }

    if (this.isTextInput(ev)) {
      return;
    }

    if (this.isModalOpen()) {
      return;
    }

    if (ev.key === "Escape") {
      if (this.drawMode === "line") {
        this.cancelLineDraft();
      }
      this.resetLoopPreview();
      this.setDrawMode("normal");
      return;
    }

    if (ev.code === "Space") {
      ev.preventDefault();
      this.spacePanActive = true;
      return;
    }

    if (isMeta && key === "z") {
      ev.preventDefault();
      if (ev.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if (isMeta && (key === "y" || (key === "z" && ev.shiftKey))) {
      ev.preventDefault();
      this.redo();
      return;
    }

    if ((ev.key === "Delete" || ev.key === "Backspace") && !ev.altKey && !ev.metaKey) {
      ev.preventDefault();
      this.delete();
      return;
    }

    if (isMeta && key === "c") {
      ev.preventDefault();
      this.copy();
      return;
    }

    if (isMeta && key === "x") {
      ev.preventDefault();
      this.cutSelection();
      return;
    }

    if (isMeta && key === "v") {
      ev.preventDefault();
      this.pasteSelection();
      return;
    }

    if (isMeta && key === "a") {
      ev.preventDefault();
      this.selectAll();
      return;
    }

    if (isMeta && key === "g") {
      ev.preventDefault();
      if (ev.shiftKey) {
        this.ungroupSelection();
      } else {
        this.groupSelection();
      }
      return;
    }

    if (!isMeta && key === "g") {
      ev.preventDefault();
      this.gridSnapEnabled = !this.gridSnapEnabled;
      this.setDslStatus(`Grid snap ${this.gridSnapEnabled ? "enabled" : "disabled"}.`, "neutral");
      this.drawAll();
      return;
    }

    if (isMeta && key === "e") {
      ev.preventDefault();
      this.drawAll("svg");
      return;
    }

    if (isMeta && key === "p") {
      ev.preventDefault();
      this.drawAll("tikz");
      return;
    }

    const nudgeFactor = isMeta ? 0.2 : 1;

    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      this.keyUp(nudgeFactor);
      return;
    }

    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      this.keyRight(nudgeFactor);
      return;
    }

    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      this.keyLeft(nudgeFactor);
      return;
    }

    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      this.keyDown(nudgeFactor);
      return;
    }
  }

  private onKeyUp(ev: KeyboardEvent) {
    if (ev.code === "Space") {
      this.spacePanActive = false;
      this.panDragLast = undefined;
      this.updateCursor();
    }
  }

  private isModalOpen(): boolean {
    return document.querySelector(".modal.show") !== null;
  }

  private quickSaveSnapshot() {
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        data: this.repository.save(),
      };
      localStorage.setItem("quantumSketch.quickSave.latest", JSON.stringify(payload));
      this.setDslStatus("Quick save completed (browser local storage).", "ok");
      this.appendDslLog("Quick save: quantumSketch.quickSave.latest", "ok");
    } catch (error) {
      this.setDslStatus("Quick save failed.", "error");
      this.appendDslLog(`Quick save failed: ${error}`, "error");
    }
  }

  private isTextInput(ev: KeyboardEvent): boolean {
    const target = ev.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
  }

  keyUp(stepFactor = 1) {
    loggerVer("keyUp");
    const delta = new Vector(0, -1).multi((1 / config.scale) * stepFactor);
    this.nudgeSelection(delta);
  }

  keyRight(stepFactor = 1) {
    loggerVer("keyRight");
    const delta = new Vector(1, 0).multi((1 / config.scale) * stepFactor);
    this.nudgeSelection(delta);
  }

  keyLeft(stepFactor = 1) {
    loggerVer("keyLeft");
    const delta = new Vector(-1, 0).multi((1 / config.scale) * stepFactor);
    this.nudgeSelection(delta);
  }

  keyDown(stepFactor = 1) {
    loggerVer("keyDown");
    const delta = new Vector(0, 1).multi((1 / config.scale) * stepFactor);
    this.nudgeSelection(delta);
  }

  noSelectMode() {
    this.isNoSelectMode = !this.isNoSelectMode;
    if (this.isNoSelectMode) {
      this.repository.clearSelectMode();
    }
    this.drawAll();
  }

  nextElem() {
    this.repository.nextElem();
    this.drawAll();
  }

  nextSubElem() {
    this.repository.nextSubElem();
    this.drawAll();
  }

  preElem() {
    this.repository.preElem();
    this.drawAll();
  }

  preSubElem() {
    this.repository.preSubElem();
    this.drawAll();
  }

  fill(x: number, y: number) {
    let current = this.repository.currentElement();
    if (current && isLoop(current)) {
      this.repository.doCommand(new Fill(current));
      this.drawAll();
      return;
    }
    return;
  }

  setString(x: number, y: number) {
    let current = this.repository.currentElement();
    let defult = "";
    if (current && isString(current)) {
      defult = current.label;
    }

    let text = window.prompt("input text (plain) or TeX (ex. $\\\\int e^x dx$)", defult);

    if (text == null) {
      this.setDrawMode("normal");
      return;
    }

    if (current && isString(current)) {
      current.label = text;
      this.setDrawMode("normal");
      return;
    }

    let str = new MyString(text);
    str.origin = new Vector(x, y);
    let command = new SetString(str);
    this.repository.doCommand(command);
    this.setDrawMode("normal");
  }

  putVertex(vertex: Vector) {
    loggerVer("put vertex..");
    this.repository.doCommand(new SetVertex(vertex));
    this.drawAll();
  }

  putLoop(x: number, y: number) {
    loggerVer("put Loop..");
    const loop = new Loop();
    loop.origin = new Vector(x, y);
    this.repository.doCommand(new SetLoop(loop));
    this.setDrawMode("normal");
  }

  /**
   * Redraws every element according to the requested export target. The method
   * also maintains the side-panel widgets (current selection, mode indicator)
   * so that the UI always reflects repository state.
   */
  drawAll(exportType: ExportType = "canvas") {
    if (exportType !== "canvas") {
      this.renderNow(exportType);
      return;
    }
    if (this.renderScheduled) {
      return;
    }
    this.renderScheduled = true;
    window.requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.renderNow("canvas");
    });
  }

  private renderNow(exportType: ExportType = "canvas") {
    this.drawContext.setExportType(exportType);

    // clear
    this.drawContext.clearRect();
    this.drawContext.startExport();

    const elms = this.repository.getAllElements();
    this.drawContext.beginPath();
    elms.forEach((elm, index) => {
      // loggerVer("draw..");
      draw(this.drawContext, elm, exportType);
    });

    if (exportType === "svg") {
      this.drawContext.insertsavedata(this.repository.save())
    }

    this.drawContext.endExport();
    this.updateModeButtons();

    const current = this.repository.currentElement();
    this.updateLoopControlsUI(current);
    if (exportType === "canvas") {
      this.updateInspectorControlsUI(current);
    }

    if (this.isNoSelectMode) {
      return;
    }

    if (exportType != "canvas") {
      return;
    }

    const previewStart = this.lineDraftStart ?? this.lineToolPress?.startVertex;
    if (this.drawMode === "line" && previewStart) {
      draw(this.drawContext, previewStart, "canvas", "sub");
      const pointer = this.linePreviewEnd ?? this.resolveLineHoverPoint(this.getPointer());
      this.drawContext.beginPath();
      this.drawContext.setStrokeColor("sub");
      this.drawContext.moveTo(previewStart.x, previewStart.y);
      this.drawContext.lineTo(pointer.x, pointer.y, "dash");
      this.drawContext.stroke();
      this.drawContext.closePath();
    }

    if (this.hoveredSnapGrid) {
      draw(this.drawContext, this.hoveredSnapGrid, "canvas", "sub");
    }
    if (this.hoveredSnapVertex) {
      draw(this.drawContext, this.hoveredSnapVertex, "canvas", "sub");
    }
    this.drawHoverFeedback();
    (this.pointerTool ?? this.activeTool).render(this, this.drawContext);

    const selected = this.repository.getSelectedElements();
    selected.forEach((elem) => {
      if (current && elem.id === current.id) {
        return;
      }
      draw(this.drawContext, elem, "canvas", "select");
    });

    const sub = this.repository.currentSubElement();
    if (sub) {
      draw(this.drawContext, sub, "canvas", "sub");
      this.drawContext.output("sub:   " + sub.description(), "html", "sub");
    } else {
      this.drawContext.output("sub:   -", "html", "sub");
    }

    if (current) {
      draw(this.drawContext, current, "canvas", "select");
      this.drawContext.output(
        "current: " +
          current.description() +
          ` ${current.formalDistance(this.getPointer())}`,
        "html",
        "current"
      );
    } else {
      this.drawContext.output("current: -", "html", "current");
    }

    this.drawContext.output(this.describeMode(), "html", "mode");


    const lineHandleTargets: Line[] = [];
    if (current && isLine(current)) {
      lineHandleTargets.push(current);
    }
    selected.forEach((elem) => {
      if (isLine(elem) && !lineHandleTargets.includes(elem)) {
        lineHandleTargets.push(elem);
      }
    });
    this.drawLineHandles(lineHandleTargets);
    this.drawLoopHandles(this.activeLoop());

    this.drawContext.closePath();

    if (this.selectionRect) {
      const scale = config.scale;
      const offset = this.drawContext.getViewOffset();
      const left = (Math.min(this.selectionRect.x1, this.selectionRect.x2) + offset.x) * scale;
      const top = (Math.min(this.selectionRect.y1, this.selectionRect.y2) + offset.y) * scale;
      const width = Math.abs(this.selectionRect.x2 - this.selectionRect.x1) * scale;
      const height = Math.abs(this.selectionRect.y2 - this.selectionRect.y1) * scale;
      this.context.save();
      this.context.strokeStyle = "rgba(30, 144, 255, 0.9)";
      this.context.fillStyle = "rgba(30, 144, 255, 0.2)";
      this.context.setLineDash([6, 4]);
      this.context.strokeRect(left, top, width, height);
      this.context.setLineDash([]);
      this.context.fillRect(left, top, width, height);
      this.context.restore();
    }
  }

  private describeMode(): string {
    const suffix = ` | zoom ${config.scale.toFixed(1)}x | snap ${this.gridSnapEnabled ? "on" : "off"}`;
    switch (this.drawMode) {
      case "normal":
        return `Select${suffix}`;
      case "point":
        return `Vertex tool${suffix}`;
      case "line":
        return `${this.lineDraftStart ? "Propagator: pick end" : "Propagator: pick start"}${suffix}`;
      case "loop":
        return `Loop tool${suffix}`;
      case "string":
        return `Text tool${suffix}`;
    }
    return "";
  }

  private updateLoopControlsUI(current?: Elem) {
    const controls = this.loopControls;
    if (!controls.container) {
      return;
    }

    const loop = current && isLoop(current) ? current : undefined;

    this.resetLoopPreview(loop?.id);

    if (!loop) {
      controls.container.classList.add("d-none");
      return;
    }

    controls.container.classList.remove("d-none");

    const radius = loop.radius;
    if (controls.radiusSlider) {
      const slider = controls.radiusSlider;
      slider.min = "1";
      slider.step = "0.5";
      const dynamicMax = Math.max(50, Math.ceil(radius + 20));
      if (Number(slider.max) !== dynamicMax) {
        slider.max = dynamicMax.toString();
      }
      slider.value = radius.toFixed(2);
    }
    if (controls.radiusValue) {
      controls.radiusValue.textContent = radius.toFixed(1);
    }

    const startDeg = this.normalizeDegrees(this.radToDeg(loop.loopBeginAngle));
    const endDegNormalized = this.normalizeDegrees(this.radToDeg(loop.loopEndAngle));
    const drawnDeg = this.arcLengthDegrees(loop);
    const gapDeg = Math.max(0, 360 - drawnDeg);
    const isFullLoop = Math.abs(drawnDeg - 360) < 0.01;
    const endDeg = isFullLoop ? 360 : endDegNormalized;

    if (controls.startSlider) {
      const slider = controls.startSlider;
      slider.min = "0";
      slider.max = "360";
      slider.step = "1";
      slider.value = Math.round(startDeg).toString();
    }
    if (controls.endSlider) {
      const slider = controls.endSlider;
      slider.min = "0";
      slider.max = "360";
      slider.step = "1";
      slider.value = Math.round(endDeg).toString();
    }
    if (controls.startValue) {
      controls.startValue.textContent = this.formatDegrees(startDeg);
    }
    if (controls.endValue) {
      controls.endValue.textContent = this.formatDegrees(endDeg);
    }
    if (controls.arcValue) {
      controls.arcValue.textContent = this.formatDegrees(drawnDeg);
    }
    if (controls.gapValue) {
      controls.gapValue.textContent = this.formatDegrees(gapDeg);
    }
  }

  private currentLoop(): Loop | undefined {
    const current = this.repository.currentElement();
    if (current && isLoop(current)) {
      return current;
    }
    return undefined;
  }

  private previewLoopRadius(value: number) {
    const loop = this.currentLoop();
    if (!loop) {
      return;
    }
    if (!this.loopPreview || this.loopPreview.loopId !== loop.id) {
      this.loopPreview = { loopId: loop.id, radius: { original: loop.radius } };
    } else if (!this.loopPreview.radius) {
      this.loopPreview.radius = { original: loop.radius };
    }
    loop.setRadius(value);
    this.drawAll();
  }

  private commitLoopRadius(value: number) {
    const loop = this.currentLoop();
    if (!loop) {
      this.finalizeLoopPreview("radius");
      return;
    }
    const preview = this.loopPreview;
    if (preview?.loopId === loop.id && preview.radius) {
      const original = preview.radius.original;
      if (Math.abs(original - value) < 1e-6) {
        this.finalizeLoopPreview("radius");
        this.drawAll();
        return;
      }
      loop.setRadius(original);
      this.finalizeLoopPreview("radius");
    }
    this.repository.doCommand(new SetLoopRadius(loop, value));
    this.drawAll();
  }

  private previewLoopStart(value: number) {
    const loop = this.currentLoop();
    if (!loop) {
      return;
    }
    const radians = this.degToRad(value);
    if (!this.loopPreview || this.loopPreview.loopId !== loop.id) {
      this.loopPreview = { loopId: loop.id, start: { original: loop.loopBeginAngle } };
    } else if (!this.loopPreview.start) {
      this.loopPreview.start = { original: loop.loopBeginAngle };
    }
    loop.setLoopBeginAngle(radians);
    this.drawAll();
  }

  private commitLoopStart(value: number) {
    const loop = this.currentLoop();
    if (!loop) {
      this.finalizeLoopPreview("start");
      return;
    }
    const preview = this.loopPreview;
    const radians = this.degToRad(value);
    if (preview?.loopId === loop.id && preview.start) {
      const original = preview.start.original;
      if (Math.abs(original - radians) < 1e-6) {
        this.finalizeLoopPreview("start");
        this.drawAll();
        return;
      }
      loop.setLoopBeginAngle(original);
      this.finalizeLoopPreview("start");
    }
    this.repository.doCommand(new SetLoopBeginAngle(loop, radians));
    this.drawAll();
  }

  private previewLoopEnd(value: number) {
    const loop = this.currentLoop();
    if (!loop) {
      return;
    }
    const radians = this.degToRad(value);
    if (!this.loopPreview || this.loopPreview.loopId !== loop.id) {
      this.loopPreview = { loopId: loop.id, end: { original: loop.loopEndAngle } };
    } else if (!this.loopPreview.end) {
      this.loopPreview.end = { original: loop.loopEndAngle };
    }
    loop.setLoopEndAngle(radians);
    this.drawAll();
  }

  private commitLoopEnd(value: number) {
    const loop = this.currentLoop();
    if (!loop) {
      this.finalizeLoopPreview("end");
      return;
    }
    const preview = this.loopPreview;
    const radians = this.degToRad(value);
    if (preview?.loopId === loop.id && preview.end) {
      const original = preview.end.original;
      if (Math.abs(original - radians) < 1e-6) {
        this.finalizeLoopPreview("end");
        this.drawAll();
        return;
      }
      loop.setLoopEndAngle(original);
      this.finalizeLoopPreview("end");
    }
    this.repository.doCommand(new SetLoopEndAngle(loop, radians));
    this.drawAll();
  }

  private adjustLoop(property: "radius" | "start" | "end", step: number) {
    this.resetLoopPreview();
    const loop = this.currentLoop();
    if (!loop) {
      return;
    }
    if (property === "radius") {
      this.repository.doCommand(new ChangeScale(loop, step));
    } else if (property === "start") {
      this.repository.doCommand(new ChangeArcAngle(loop, this.degToRad(step)));
    } else if (property === "end") {
      this.repository.doCommand(new ChangeArcEndAngle(loop, this.degToRad(step)));
    }
    this.drawAll();
  }

  private handleLoopAction(action: string) {
    this.resetLoopPreview();
    const loop = this.currentLoop();
    if (!loop) {
      return;
    }
    switch (action) {
      case "full":
        this.repository.doCommand(new SetLoopAngles(loop, 0, Math.PI * 2));
        break;
      case "gap60": {
        const start = this.degToRad(-30);
        const end = this.degToRad(30);
        this.repository.doCommand(new SetLoopAngles(loop, start, end));
        break;
      }
      case "gap180": {
        const start = this.degToRad(-90);
        const end = this.degToRad(90);
        this.repository.doCommand(new SetLoopAngles(loop, start, end));
        break;
      }
      default:
        return;
    }
    this.drawAll();
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private radToDeg(value: number): number {
    return (value * 180) / Math.PI;
  }

  private normalizeDegrees(value: number): number {
    let result = value % 360;
    if (result < 0) {
      result += 360;
    }
    return result;
  }

  private formatDegrees(value: number): string {
    return `${Math.round(value)}°`;
  }

  private arcLengthDegrees(loop: Loop): number {
    let diff = loop.loopEndAngle - loop.loopBeginAngle;
    if (diff <= 0) {
      diff += 2 * Math.PI;
    }
    return this.radToDeg(diff);
  }

  private resetLoopPreview(exceptLoopId?: string) {
    const preview = this.loopPreview;
    if (!preview) {
      return;
    }
    if (exceptLoopId && preview.loopId === exceptLoopId) {
      return;
    }
    const element = this.repository.getElement(preview.loopId);
    if (element && isLoop(element)) {
      if (preview.radius) {
        element.setRadius(preview.radius.original);
      }
      if (preview.start) {
        element.setLoopBeginAngle(preview.start.original);
      }
      if (preview.end) {
        element.setLoopEndAngle(preview.end.original);
      }
    }
    this.loopPreview = undefined;
  }

  private finalizeLoopPreview(part: "radius" | "start" | "end") {
    const preview = this.loopPreview;
    if (!preview) {
      return;
    }
    if (part === "radius") {
      delete preview.radius;
    } else if (part === "start") {
      delete preview.start;
    } else {
      delete preview.end;
    }
    if (!preview.radius && !preview.start && !preview.end) {
      this.loopPreview = undefined;
    }
  }

  putLine(point: Vector | undefined, isReverse: boolean) {
    let current = this.repository.currentElement();
    let sub = this.repository.currentSubElement();
    if (point) {
      sub = current;
      current = point;
    }
    if (!current) {
      return;
    }
    if (!sub) {
      return;
    }
    if (isVector(current) && isVector(sub)) {
      if (current.x == sub.x && current.y == sub.y) {
        return;
      }
      let line = new Line();
      line.origin = sub;
      line.to = current;
      this.repository.doCommand(new SetLine(line));
      this.repository.select(current);
      this.drawAll();
      return;
    }
    if (isLoop(current) && isLoop(sub)) {
      if (
        current.origin.x == sub.origin.x &&
        current.origin.y == sub.origin.y
      ) {
        return;
      }
      let line = new Line();
      line.between(current, sub);
      this.repository.doCommand(new SetLine(line));
      this.drawAll();
      return;
    }

    if (isVector(current) && isLoop(sub)) {
      let line = new Line();
      line.origin = current;
      if (isReverse) {
        sub.addLineTo(line);
      } else {
        sub.addLineOrigin(line);
      }
      this.repository.doCommand(new SetLine(line));
      this.drawAll();
      return;
    }

    if (isLoop(current) && isVector(sub)) {
      let line = new Line();
      line.origin = sub;
      current.addLineTo(line);
      this.repository.doCommand(new SetLine(line));
      this.drawAll();
      return;
    }

    if (isVector(current) && isLine(sub)) {
      let line = new Line();
      if (isReverse) {
        line.origin = sub.to;
      } else {
        line.origin = sub.origin;
      }
      line.to = current;
      this.repository.doCommand(new SetLine(line));
      this.drawAll();
      return;
    }

    if (isLine(current) && isVector(sub)) {
      let line = new Line();
      if (isReverse) {
        line.to = current.to;
      } else {
        line.to = current.origin;
      }
      line.origin = sub;
      this.repository.doCommand(new SetLine(line));
      this.drawAll();
      return;
    }

    if (isLine(current) && isLine(sub)) {
      let line = new Line();
      if (isReverse) {
        line.to = current.to;
      } else {
        line.to = current.origin;
      }
      line.origin = sub.to;
      this.repository.doCommand(new SetLine(line));
      this.drawAll();
      return;
    }
  }

  copy() {
    this.copySelection();
  }

  private setDslStatus(message: string, type: "neutral" | "ok" | "error" = "neutral") {
    if (!this.dslStatusElement) {
      return;
    }
    this.dslStatusElement.textContent = message;
    this.dslStatusElement.classList.remove("text-secondary", "text-success", "text-danger");
    if (type === "ok") {
      this.dslStatusElement.classList.add("text-success");
      return;
    }
    if (type === "error") {
      this.dslStatusElement.classList.add("text-danger");
      return;
    }
    this.dslStatusElement.classList.add("text-secondary");
  }

  private appendDslLog(text: string, kind: "ok" | "error" | "info" = "info") {
    if (!this.dslLogElement) {
      return;
    }
    const stamp = new Date().toLocaleTimeString();
    const prefix = kind === "ok" ? "OK" : kind === "error" ? "ERR" : "INFO";
    const line = `[${stamp}] ${prefix} ${text}`;
    const previous = this.dslLogElement.textContent;
    if (!previous || previous === "Execution log is empty.") {
      this.dslLogElement.textContent = line;
      return;
    }
    this.dslLogElement.textContent = `${line}\n${previous}`;
  }

  private openSelectionMacroEditor() {
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      this.selectionMacroEditMode = false;
      this.setDslStatus("Select elements before editing as macro.", "neutral");
      return;
    }

    const script = this.buildSelectionMacroScript(selected);
    if (!script) {
      this.selectionMacroEditMode = false;
      this.setDslStatus("Selection contains no macro-exportable geometry.", "error");
      return;
    }

    if (this.dslScriptElement) {
      this.dslScriptElement.value = script;
      this.dslScriptElement.focus();
      this.dslScriptElement.setSelectionRange(0, this.dslScriptElement.value.length);
    }
    this.selectionMacroEditMode = true;
    this.setDslStatus("Selection macro loaded. Edit and run script to replace selection.", "ok");
    this.appendDslLog("Selection macro exported to script editor.", "info");
  }

  private buildSelectionMacroScript(selected: Elem[]): string | null {
    const lines = selected.filter((elem): elem is Line => isLine(elem));
    const loops = selected.filter((elem): elem is Loop => isLoop(elem));
    if (lines.length === 0 && loops.length === 0) {
      return null;
    }

    const commands: string[] = [
      "# Selection macro (editable)",
      "# Run Script will replace current selection with this script output.",
      "# line x1 y1 x2 y2 [style]",
      "# loop x y radius [style] [beginAngle] [endAngle]",
    ];
    const format = (value: number) => Number(value.toFixed(3)).toString();

    lines
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((line) => {
        commands.push(
          `line ${format(line.origin.x)} ${format(line.origin.y)} ${format(line.to.x)} ${format(line.to.y)} ${line.style}`
        );
      });

    loops
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((loop) => {
        commands.push(
          `loop ${format(loop.origin.x)} ${format(loop.origin.y)} ${format(loop.radius)} ${loop.style} ${format(loop.loopBeginAngle)} ${format(loop.loopEndAngle)}`
        );
      });

    return commands.join("\n");
  }

  private applySelectionMacroScript(script: string): boolean {
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      this.selectionMacroEditMode = false;
      this.setDslStatus("Macro edit mode ended because selection was cleared.", "neutral");
      return false;
    }
    const text = script.trim();
    if (!text) {
      this.setDslStatus("Script is empty.", "error");
      return false;
    }

    const historyHeadBefore = this.repository.historyHead;
    const idsBefore = new Set(this.repository.getAllElements().map((elem) => elem.id));

    if (selected.length === 1) {
      this.repository.doCommand(new Delete(selected[0]));
    } else {
      this.repository.doCommand(new DeleteGroup(selected));
    }
    this.repository.clearSelectMode();

    const batch = this.scriptEngine.executeScript(text, true);
    if (!batch.success) {
      while (this.repository.historyHead > historyHeadBefore) {
        this.repository.undo();
      }
      this.drawAll();
      this.setDslStatus(batch.message, "error");
      this.appendDslLog(batch.message, "error");
      return false;
    }

    const inserted = this.repository.getAllElements().filter((elem) => !idsBefore.has(elem.id));
    if (inserted.length > 0) {
      this.repository.setSelection(inserted);
    }
    this.drawAll();
    return true;
  }

  cutSelection() {
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    this.copySelection();
    this.delete();
  }

  groupSelection() {
    const selected = this.repository.getSelectedElements();
    if (selected.length < 2) {
      return;
    }
    this.repository.doCommand(new GroupSelection(selected));
    this.drawAll();
  }

  ungroupSelection() {
    const selected = this.repository.getSelectedElements();
    if (selected.length !== 1 || !isGroup(selected[0])) {
      return;
    }
    this.repository.doCommand(new UngroupSelection(selected[0] as Group));
    this.drawAll();
  }

  copySelection() {
    const selectedRaw = this.repository.getSelectedElements();
    const selected = selectedRaw.length > 0
      ? selectedRaw
      : (this.repository.currentElement() ? [this.repository.currentElement() as Elem] : []);
    if (selected.length === 0) {
      return;
    }

    const vertexMap = new Map<string, Vertex>();
    const lines: Array<{
      startId: string;
      endId: string;
      style: Line["style"];
      label: string;
      labelDiff: number;
      allow: Boolean;
      arrowRotation: number;
      control: Vector | null;
    }> = [];
    const loops: Array<{
      centerId: string;
      radius: number;
      style: Loop["style"];
      allow: Boolean;
      fill: boolean;
      label: string;
      loopBeginAngle: number;
      loopEndAngle: number;
    }> = [];
    const strings: Array<{ x: number; y: number; label: string }> = [];

    const ensureVertex = (vertex: Vertex | Vector) => {
      if (!vertexMap.has(vertex.id)) {
        vertexMap.set(vertex.id, new Vertex(vertex.x, vertex.y));
      }
    };

    const flatten = (elem: Elem): Elem[] => {
      if (!isGroup(elem)) {
        return [elem];
      }
      return elem.elements.flatMap((child) => flatten(child));
    };

    selected.flatMap((elem) => flatten(elem)).forEach((elem) => {
      if (isVector(elem)) {
        ensureVertex(elem);
        return;
      }
      if (isLine(elem)) {
        ensureVertex(elem.origin);
        ensureVertex(elem.to);
        lines.push({
          startId: elem.origin.id,
          endId: elem.to.id,
          style: elem.style,
          label: elem.label,
          labelDiff: elem.labelDiff,
          allow: elem.allow,
          arrowRotation: elem.arrowRotation ?? 0,
          control: elem.control ? elem.control.copy() : null,
        });
        return;
      }
      if (isLoop(elem)) {
        ensureVertex(elem.origin);
        loops.push({
          centerId: elem.origin.id,
          radius: elem.radius,
          style: elem.style,
          allow: elem.allow,
          fill: elem.fill,
          label: elem.label,
          loopBeginAngle: elem.loopBeginAngle,
          loopEndAngle: elem.loopEndAngle,
        });
        return;
      }
      if (isString(elem)) {
        strings.push({ x: elem.origin.x, y: elem.origin.y, label: elem.label });
      }
    });

    this.clipboardSnapshot = {
      vertices: Array.from(vertexMap.entries()).map(([id, vertex]) => ({
        id,
        x: vertex.x,
        y: vertex.y,
      })),
      lines,
      loops,
      strings,
    };
  }

  pasteSelection() {
    const snapshot = this.clipboardSnapshot;
    if (!snapshot) {
      return;
    }
    const offset = new Vector(1.2, 1.2);
    const idMap = new Map<string, Vertex>();

    snapshot.vertices.forEach((data) => {
      const vertex = new Vertex(data.x + offset.x, data.y + offset.y);
      this.repository.doCommand(new SetVertex(vertex));
      const created = this.repository.currentElement();
      if (created && isVector(created)) {
        idMap.set(data.id, created as Vertex);
      } else {
        idMap.set(data.id, vertex);
      }
    });

    snapshot.lines.forEach((data) => {
      const start = idMap.get(data.startId);
      const end = idMap.get(data.endId);
      if (!start || !end) {
        return;
      }
      const line = new Line();
      line.style = data.style;
      line.label = data.label;
      line.labelDiff = data.labelDiff;
      line.allow = data.allow;
      line.arrowRotation = data.arrowRotation;
      line.control = data.control ? data.control.add(offset) : null;
      line.origin = start;
      line.to = end;
      this.repository.doCommand(new SetLine(line));
    });

    snapshot.loops.forEach((data) => {
      const center = idMap.get(data.centerId);
      if (!center) {
        return;
      }
      const loop = new Loop();
      loop.origin = center;
      loop.setRadius(data.radius);
      loop.style = data.style;
      loop.allow = data.allow;
      loop.fill = data.fill;
      loop.label = data.label;
      loop.loopBeginAngle = data.loopBeginAngle;
      loop.loopEndAngle = data.loopEndAngle;
      this.repository.doCommand(new SetLoop(loop));
    });

    snapshot.strings.forEach((data) => {
      const str = new MyString(data.label);
      str.origin = new Vector(data.x + offset.x, data.y + offset.y);
      this.repository.doCommand(new SetString(str));
    });

    this.drawAll();
  }

  selectAll() {
    const all = this.repository.getAllElements();
    if (all.length === 0) {
      return;
    }
    this.repository.setSelection(all);
    this.drawAll();
  }

  rotation() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new Rotation(elem, (2 * Math.PI) / 72));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.repository.doCommand(new Rotation(elem, (2 * Math.PI) / 72));
      this.drawAll();
      return;
    }
  }

  antiRotation() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new Rotation(elem, -(2 * Math.PI) / 72));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.repository.doCommand(new Rotation(elem, -(2 * Math.PI) / 72));
      this.drawAll();
      return;
    }
  }

  allowToggle() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new ArrowToggle(elem));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.repository.doCommand(new ArrowToggle(elem));
      this.drawAll();
      return;
    }
  }

  changeSelect() {
    this.repository.changeSelect();
    this.drawAll();
    return;
  }

  changeType() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new ChangeType(elem));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      return;
    }
  }

  changeArcAngle() {
    loggerVer("changeArcAngle..");
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }

    if (isLine(elem)) {
      return;
    }

    if (isLoop(elem)) {
      this.repository.doCommand(new ChangeArcAngle(elem, (2 * Math.PI) / 72));
      this.drawAll();
      return;
    }
  }

  changeArcAngleMinus() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }

    if (isLine(elem)) {
      return;
    }

    if (isLoop(elem)) {
      this.repository.doCommand(new ChangeArcAngle(elem, -(2 * Math.PI) / 72));
      this.drawAll();
      return;
    }
  }

  changeArcEndAngle() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }

    if (isLine(elem)) {
      return;
    }

    if (isLoop(elem)) {
      this.repository.doCommand(
        new ChangeArcEndAngle(elem, (2 * Math.PI) / 72)
      );
      this.drawAll();
      return;
    }
  }

  changeArcEndAngleMinus() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }

    if (isLine(elem)) {
      return;
    }

    if (isLoop(elem)) {
      this.repository.doCommand(
        new ChangeArcEndAngle(elem, -(2 * Math.PI) / 72)
      );
      this.drawAll();
      return;
    }
  }

  changeScale() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new ChangeScale(elem, 1.0));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.repository.doCommand(new ChangeScale(elem, 1.0));
      this.drawAll();
      return;
    }
  }

  changeScaleDown() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new ChangeScale(elem, -1.0));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.repository.doCommand(new ChangeScale(elem, -1.0));
      this.drawAll();
      return;
    }
  }

  changeStyle() {
    let elem = this.repository.currentElement();
    if (!elem) {
      return;
    }
    if (isVector(elem)) {
      return;
    }
    if (isLine(elem)) {
      this.repository.doCommand(new ChangeStyle(elem));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.repository.doCommand(new ChangeStyle(elem));
      this.drawAll();
      return;
    }
  }

  private activeLines(): Line[] {
    const selectedLines = this.repository
      .getSelectedElements()
      .filter((elem): elem is Line => isLine(elem));
    if (selectedLines.length > 0) {
      return selectedLines;
    }
    const current = this.repository.currentElement();
    if (current && isLine(current)) {
      return [current];
    }
    return [];
  }

  rotateArrow(delta: number) {
    const lines = this.activeLines();
    if (lines.length === 0) {
      return;
    }
    this.repository.doCommand(new RotateArrow(lines, delta));
    this.drawAll();
  }

  resetArrowRotation() {
    const lines = this.activeLines();
    if (lines.length === 0) {
      return;
    }
    this.repository.doCommand(new SetArrowRotation(lines, 0));
    this.drawAll();
  }

  delete() {
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    if (selected.length === 1) {
      this.repository.doCommand(new Delete(selected[0]));
    } else {
      this.repository.doCommand(new DeleteGroup(selected));
    }
    this.repository.clearSelectMode();
    this.drawAll();
  }

  select(point: Vector) {
    this.selectAt(point, false);
  }

  subSelect(point: Vector) {
    this.selectAt(point, true);
  }

  undo() {
    loggerVer("undo");
    this.repository.undo();
    this.drawAll();
  }

  redo() {
    loggerVer("redo");
    this.repository.redo();
    this.drawAll();
  }

}
