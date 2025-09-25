import { config } from "../Config";
import { Line, isLine } from "../Core/Line";
import { Elem } from "../Core/Elem";
import { isLoop, Loop } from "../Core/Loop";
import { isString, MyString } from "../Core/MyString";
import { Vector, isVector } from "../Core/Vector";
import { loggerVer } from "../looger";
import { draw } from "./draw";
import { DrawContext } from "./DrawContext";
import { DrawMode } from "./DrawMode";
import { ExportType } from "./ExportType";
import { RDRepository } from "./RDRepository";
import { SetString, SetVertex, SetLoop, SetLine, Delete, Move, Rotation, ChangeScale, ChangeArcAngle, ChangeArcEndAngle, Fill, ArrowToggle, ChangeType, ChangeStyle, SetLoopRadius, SetLoopBeginAngle, SetLoopEndAngle, SetLoopAngles, MoveGroup, DeleteGroup, SetLineEndpoint, SetLineControlPoint, RotateArrow, SetArrowRotation } from "./RepositoryCommand";
import { CommandRegistry, CommandHost } from "./CommandRegistry";

/**
 * Central UI orchestrator for the editor. This class owns the canvas draw
 * loop, manages repository mutations, and routes all user input (clicks,
 * keyboard, command buttons) through a command registry so that new features
 * can be added without editing a monolithic switch statement.
 */
export class RDDraw implements CommandHost {
  repository: RDRepository = new RDRepository();
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  drawContext: DrawContext;
  isMouseDown: "Up" | "Down" | "Downning" = "Up";
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
      };
  private selectionRect?: { x1: number; y1: number; x2: number; y2: number };
  private suppressClick = false;
  private pendingDrag?: {
    startPointer: Vector;
    hit?: Elem;
    additive: boolean;
    forceRect: boolean;
  };
  private lastHitContext?: { point: Vector; tolerance: number };
  constructor(canvas: HTMLCanvasElement, drawContext: DrawContext) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d")!;
    this.drawContext = drawContext;
    this.registerCommands();
    this.bind();
    this.drawAll();
  }

  bind() {
    this.canvas.addEventListener("click", (ev) => {
      this.onCanvasClick(ev);
    });
    this.canvas.addEventListener("dblclick", (ev) => {
      this.onCanvasDoubleClick(ev);
    });

    this.canvas.addEventListener("mousedown", (ev) => {
      this.mouseDown(ev);
    });

    this.canvas.addEventListener("mouseup", (ev) => {
      this.mouseUp(ev);
    });

    this.canvas.addEventListener("mousemove", (ev) => {
      this.move(ev);
    });

    document.addEventListener("keydown", (ev) => {
      this.onKeyDown(ev);
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
    const currentId = this.repository.currentElement()?.id;
    const hit = this.repository.findElement(point, currentId);
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

  private performMoveDrag(pointer: Vector) {
    if (!this.dragSession || this.dragSession.type !== "move") {
      return;
    }
    const deltaStep = pointer.minus(this.dragSession.lastPointer);
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
    this.suppressClick = true;
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
      line.origin.moveAbsolute(pointer);
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
      line.to.moveAbsolute(pointer);
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
    this.suppressClick = true;
  }

  private insertVertex(point: Vector): Vector {
    const vertex = this.ensureVertex(point);
    this.repository.setCurrentElement(vertex);
    this.setDrawMode("normal");
    return vertex;
  }

  private ensureVertex(point: Vector): Vector {
    const tolerance = 2;
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
    this.repository.clearSelectMode();
    this.setDrawMode("normal");
  }

  private resolveLinePoint(point: Vector): Vector {
    const tolerance = 2;
    const existingVertex = this.findNearestVertex(point, tolerance);
    if (existingVertex) {
      return existingVertex;
    }

    const existingLine = this.findNearestLine(point, tolerance * 2);
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

  private snapToGrid(point: Vector): Vector {
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

    if (isLine(current)) {
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
    if (!this.lineDraftStart) {
      return;
    }
    this.lineDraftStart = undefined;
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
    if (mode !== "line") {
      this.lineDraftStart = undefined;
    }
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

    const tolerance = 0.6;
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

  private drawLineHandles(lines: Line[]) {
    if (lines.length === 0) {
      return;
    }
    const ctx = this.context;
    const scale = config.scale;
    const baseRadius = Math.max(4, Math.min(6, scale * 0.35));

    lines.forEach((line) => {
      const controlPoint = line.control ? line.control : line.pointAt(0.5);
      const hasControl = !!line.control;

      ctx.save();
      ctx.strokeStyle = "rgba(30, 144, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash(hasControl ? [4, 4] : [6, 6]);
      ctx.beginPath();
      ctx.moveTo(line.origin.x * scale, line.origin.y * scale);
      ctx.lineTo(controlPoint.x * scale, controlPoint.y * scale);
      ctx.lineTo(line.to.x * scale, line.to.y * scale);
      ctx.stroke();
      ctx.restore();

      const handles: Array<{ point: Vector; ghost: boolean }> = [
        { point: line.origin, ghost: false },
        { point: line.to, ghost: false },
        { point: controlPoint, ghost: !hasControl },
      ];

      handles.forEach((handle) => {
        ctx.save();
        const px = handle.point.x * scale;
        const py = handle.point.y * scale;
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

  setPrevXY(eventX: number, eventY: number) {
    this.rawPointer = new Vector(eventX, eventY);
    // loggerVer(`rawPointer ${this.rawPointer.x}  ${this.rawPointer.y}`);
  }
  /**
   * Returns the last pointer position in canvas coordinates. Centralises
   * scaling logic so every command receives consistent values regardless of
   * the current zoom level.
   */
  getPointer(): Vector {
    const scale = config.scale;
    const p = this.rawPointer.multi(1 / scale).floor();
    // loggerVer(`p ${p.x}  ${p.y}`);
    return p;
  }

  private getPointerPrecise(): Vector {
    const scale = config.scale;
    return this.rawPointer.multi(1 / scale);
  }

  private onCanvasClick(ev: MouseEvent) {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.isMouseDown = "Up";
    this.resetLoopPreview();
    this.setPrevXY(ev.offsetX, ev.offsetY);
    const point = this.getPointer();

    switch (this.drawMode) {
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

  private onCanvasDoubleClick(ev: MouseEvent) {
    this.resetLoopPreview();
    this.pendingDrag = undefined;
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
        this.suppressClick = true;
        return;
      }
    }

    if (this.drawMode !== "normal") {
      this.setDrawMode("normal");
    }

    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
    const tolerance = 12;
    const candidates = this.repository.findAllNear(point, tolerance);
    if (candidates.length === 0) {
      this.suppressClick = true;
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

    this.suppressClick = true;
  }

  mouseDown(ev: MouseEvent) {
    this.isMouseDown = "Downning";
    this.setPrevXY(ev.offsetX, ev.offsetY);
    const point = this.getPointer();
    const precisePoint = this.getPointerPrecise();
    this.suppressClick = false;
    this.pendingDrag = undefined;
    this.selectionRect = undefined;

    if (this.drawMode === "normal") {
      const handleHit = this.hitTestLineHandle(precisePoint);
      if (handleHit) {
        const { line, handle, createControl } = handleHit;
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
        };
        this.pendingDrag = undefined;
        this.suppressClick = true;
        return;
      }

      const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
      const forceRect = ev.altKey;
      const hit = this.repository.findElement(point, this.repository.currentElement()?.id);

      if (hit) {
        const alreadySelected = this.repository.isSelected(hit);
        if (!alreadySelected) {
          if (additive) {
            this.repository.toggleSelection(hit);
          } else {
            this.repository.setCurrentElement(hit);
          }
          this.drawAll();
        }
      } else if (!additive) {
        this.repository.clearSelectMode();
        this.drawAll();
      }

      this.pendingDrag = {
        startPointer: point,
        hit,
        additive,
        forceRect,
      };
    }

    setTimeout(() => {
      if (this.isMouseDown == "Downning") {
        this.isMouseDown = "Down";
      }
    }, 300);
  }

  mouseUp(ev: MouseEvent) {
    this.isMouseDown = "Up";
    this.pendingDrag = undefined;
    if (!this.dragSession) {
      this.selectionRect = undefined;
      return;
    }

    if (this.dragSession.type === "handle") {
      const session = this.dragSession;
      this.dragSession = undefined;
      const line = session.line;
      const initial = session.initial;
      const finalOrigin = line.origin.copy();
      const finalTo = line.to.copy();
      let finalControl = line.control ? line.control.copy() : null;

      line.origin.moveAbsolute(initial.origin);
      line.to.moveAbsolute(initial.to);
      line.control = initial.control ? initial.control.copy() : null;

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
          // revert creation without change
          line.control = null;
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
        this.suppressClick = true;
        this.drawAll();
      } else {
        this.suppressClick = false;
      }
      return;
    }
  }

  move(ev: MouseEvent) {
    // loggerVer(`offset ${ev.offsetX}  ${ev.offsetY}`);
    // loggerVer(`screen ${ev.screenX}  ${ev.screenY}`);
    this.setPrevXY(ev.offsetX, ev.offsetY);
    const pointer = this.getPointer();

    if (this.pendingDrag) {
      const delta = pointer.minus(this.pendingDrag.startPointer);
      const threshold = 0.2;
      if (Math.abs(delta.x) > threshold || Math.abs(delta.y) > threshold) {
        const hit = this.pendingDrag.hit;
        const additive = this.pendingDrag.additive;
        const forceRect = this.pendingDrag.forceRect;
        const selected = this.repository.getSelectedElements();
        const hitSelected = hit ? this.repository.isSelected(hit) : false;
        if (
          hit &&
          hitSelected &&
          !forceRect
        ) {
          const elements = selected.length > 0 ? selected : [hit];
          this.dragSession = {
            type: "move",
            elements,
            startPointer: this.pendingDrag.startPointer,
            lastPointer: this.pendingDrag.startPointer,
            totalDelta: new Vector(0, 0),
          };
          this.pendingDrag = undefined;
          this.performMoveDrag(pointer);
        } else {
          const rectAdditive = additive;
          this.dragSession = {
            type: "rect",
            start: this.pendingDrag.startPointer,
            current: pointer,
            additive: rectAdditive,
          };
          this.selectionRect = {
            x1: this.pendingDrag.startPointer.x,
            y1: this.pendingDrag.startPointer.y,
            x2: pointer.x,
            y2: pointer.y,
          };
          this.pendingDrag = undefined;
          this.drawAll();
          this.suppressClick = true;
          return;
        }
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
      this.suppressClick = true;
      return;
    }
    if (this.dragSession?.type === "handle") {
      this.performHandleDrag(pointer);
      return;
    }
    if (this.dragSession?.type === "move" && this.isMouseDown === "Down") {
      this.performMoveDrag(pointer);
    }
  }

  private onKeyDown(ev: KeyboardEvent) {
    if (this.isTextInput(ev)) {
      return;
    }

    const isMeta = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();

    if (ev.key === "Escape") {
      if (this.drawMode === "line") {
        this.cancelLineDraft();
      }
      this.resetLoopPreview();
      this.setDrawMode("normal");
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
      this.copy();
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

    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      this.keyUp();
      return;
    }

    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      this.keyRight();
      return;
    }

    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      this.keyLeft();
      return;
    }

    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      this.keyDown();
      return;
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

  keyUp() {
    loggerVer("keyUp");
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    const delta = new Vector(0, -1).multi(1 / config.scale);
    if (selected.length === 1) {
      this.repository.doCommand(new Move(selected[0], delta));
    } else {
      this.repository.doCommand(new MoveGroup(selected, delta));
    }
    this.drawAll();
  }

  keyRight() {
    loggerVer("keyRight");
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    const delta = new Vector(1, 0).multi(1 / config.scale);
    if (selected.length === 1) {
      this.repository.doCommand(new Move(selected[0], delta));
    } else {
      this.repository.doCommand(new MoveGroup(selected, delta));
    }
    this.drawAll();
  }

  keyLeft() {
    loggerVer("keyLeft");
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    const delta = new Vector(-1, 0).multi(1 / config.scale);
    if (selected.length === 1) {
      this.repository.doCommand(new Move(selected[0], delta));
    } else {
      this.repository.doCommand(new MoveGroup(selected, delta));
    }
    this.drawAll();
  }

  keyDown() {
    loggerVer("keyDown");
    const selected = this.repository.getSelectedElements();
    if (selected.length === 0) {
      return;
    }
    const delta = new Vector(0, 1).multi(1 / config.scale);
    if (selected.length === 1) {
      this.repository.doCommand(new Move(selected[0], delta));
    } else {
      this.repository.doCommand(new MoveGroup(selected, delta));
    }
    this.drawAll();
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

    let text = window.prompt("input text( ex. \\int e^x dx)", defult);

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

    if (this.isNoSelectMode) {
      return;
    }

    if (exportType != "canvas") {
      return;
    }

    if (this.drawMode === "line" && this.lineDraftStart) {
      draw(this.drawContext, this.lineDraftStart, "canvas", "sub");
      const pointer = this.getPointer();
      this.drawContext.beginPath();
      this.drawContext.setStrokeColor("sub");
      this.drawContext.moveTo(this.lineDraftStart.x, this.lineDraftStart.y);
      this.drawContext.lineTo(pointer.x, pointer.y, "dash");
      this.drawContext.stroke();
      this.drawContext.closePath();
    }

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

    this.drawContext.closePath();

    if (this.selectionRect) {
      const scale = config.scale;
      const left = Math.min(this.selectionRect.x1, this.selectionRect.x2) * scale;
      const top = Math.min(this.selectionRect.y1, this.selectionRect.y2) * scale;
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
    switch (this.drawMode) {
      case "normal":
        return "Select";
      case "point":
        return "Vertex tool";
      case "line":
        return this.lineDraftStart ? "Propagator: pick end" : "Propagator: pick start";
      case "loop":
        return "Loop tool";
      case "string":
        return "Text tool";
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
    let elem = this.repository.currentElement();
    if (elem == undefined) {
      return;
    }
    let copied = elem.copy();
    copied.move(new Vector(0.1, 0.1));
    if (isLine(copied)) {
      this.repository.doCommand(new SetLine(copied));
      this.drawAll();
      return;
    }
    if (isLoop(copied)) {
      this.repository.doCommand(new SetLoop(copied));
      this.drawAll();
      return;
    }
    if (isString(copied)) {
      this.repository.doCommand(new SetString(copied));
      this.drawAll();
      return;
    }
    if (isVector(copied)) {
      this.repository.doCommand(new SetVertex(copied));
      this.drawAll();
      return;
    }
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
