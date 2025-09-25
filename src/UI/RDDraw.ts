import { config } from "../Config";
import { Line, isLine } from "../Core/Line";
import { isLoop, Loop } from "../Core/Loop";
import { isString, MyString } from "../Core/MyString";
import { Vector, isVector } from "../Core/Vector";
import { loggerVer, loggerOn } from "../looger";
import { draw } from "./draw";
import { DrawContext } from "./DrawContext";
import { DrawMode } from "./DrawMode";
import { ExportType } from "./ExportType";
import { RDRepository } from "./RDRepository";
import { SetString, SetVertex, SetLoop, SetLine, Delete, Move, MoveAbsolute, Rotation, ChangeScale, ChangeArcAngle, ChangeArcEndAngle, Fill, ArrowToggle, ChangeType, ChangeStyle } from "./RepositoryCommand";

/**
 * Draw class for draw and mouse event
 * @description
 * 1. Draw
 * 2. Mouse Event
 * 3. Key Event
 * 4. Repository Command
 * 5. Export
 * 6. Import
 * 7. Undo
 * 8. Redo
 * 9. Select
 * 10. Move
 * 11. Delete
 * 12. Change Style
 * 13. Change Type
 * 14. Change Scale
 * 15. Change Arc Angle
 * 16. Change Arc End Angle
 * 17. Fill
 * 18. Arrow Toggle
 * 19. Rotation
 * 20. Change String
 * 21. Change Vertex
 * 22. Change Loop
 * 23. Change Line
 * 24. Change String
 */
export class RDDraw {
  repository: RDRepository = new RDRepository();
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  drawContext: DrawContext;
  isClick: boolean = false;
  isMouseDown: "Up" | "Down" | "Downning" = "Up";
  clickIimeOutID?: NodeJS.Timeout = undefined;
  // private prevX: number = 0;
  // private prevY: number = 0;
  private pointerPrev: Vector = new Vector(0, 0);
  rawPointer: Vector = new Vector(0, 0);
  stringMode?: string = undefined;
  drawMode: DrawMode = "line";
  lineMode?: Vector = undefined;
  isNoSelectMode: boolean = false;
  constructor(canvas: HTMLCanvasElement, drawContext: DrawContext) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d")!;
    this.drawContext = drawContext;
    this.bind();
    this.drawAll();
  }

  bind() {
    this.canvas.addEventListener("click", (ev) => {
      this.click(ev);
    });
    // canvas.addEventListener("dblclick", (ev) => {
    //     this.dbclick(ev)
    // })

    this.canvas.addEventListener("mousedown", (ev) => {
      this.mouseDown(ev);
    });

    this.canvas.addEventListener("mouseup", (ev) => {
      this.mouseUp(ev);
    });

    this.canvas.addEventListener("mousemove", (ev) => {
      this.move(ev);
    });

    document.addEventListener("keypress", (ev) => {
      this.keyPress(ev);
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

  }

  setPrevXY(eventX: number, eventY: number) {
    this.rawPointer = new Vector(eventX, eventY);
    // loggerVer(`rawPointer ${this.rawPointer.x}  ${this.rawPointer.y}`);
  }
  getPointer(): Vector {
    const scale = config.scale;
    const p = this.rawPointer.multi(1 / scale).floor();
    // loggerVer(`p ${p.x}  ${p.y}`);
    return p;
  }

  click(ev: MouseEvent) {
    this.isMouseDown = "Up";
    const p = this.getPointer();
    const x = p.x;
    const y = p.y;

    if (this.isClick) {
      if (this.clickIimeOutID) {
        clearTimeout(this.clickIimeOutID);
      }
      this.subSelect(new Vector(x, y));
      this.isClick = false;

      return;
    }
    this.isClick = true;
    this.clickIimeOutID = setTimeout(() => {
      this.isClick = false;
      this.clickIimeOutID = undefined;
      this.select(new Vector(x, y));
    }, 250);
  }

  mouseDown(ev: MouseEvent) {
    this.isMouseDown = "Downning";
    setTimeout(() => {
      if (this.isMouseDown == "Downning") {
        this.isMouseDown = "Down";
      }
    }, 300);
  }

  mouseUp(ev: MouseEvent) {
    this.isMouseDown = "Up";
  }

  move(ev: MouseEvent) {
    // loggerVer(`offset ${ev.offsetX}  ${ev.offsetY}`);
    // loggerVer(`screen ${ev.screenX}  ${ev.screenY}`);
    this.setPrevXY(ev.offsetX, ev.offsetY);
    if (this.isMouseDown == "Down") {
      this.drag(ev);
    }
  }

  keyPress(ev: KeyboardEvent) {
    loggerVer("key:" + ev.key);
    const p = this.getPointer();
    const x = p.x;
    const y = p.y;

    if (ev.ctrlKey && ev.key == "c") {
      this.copy();
      loggerOn("crt + c");
      return;
    }

    if (ev.key == "/") {
      this.setString(x, y);
      return;
    }

    if (ev.ctrlKey && ev.key == "e") {
      this.drawAll("svg");
      return;
    }

    if (ev.key == "e") {
      this.drawAll("tikz");
      return;
    }

    if (ev.key == "f") {
      this.fill(x, y);
    }

    if (ev.key == "v") {
      this.putVertex(new Vector(x, y));
      return;
    }
    if (ev.key == "n") {
      this.nextElem();
      return;
    }

    if (ev.key == "b") {
      this.preElem();
      return;
    }

    if (ev.key == "s") {
      this.nextSubElem();
      return;
    }

    if (ev.key == "a") {
      this.preSubElem();
      return;
    }

    if (ev.key == "p") {
      this.putLine(undefined, true);
      return;
    }

    if (ev.key == "P") {
      this.putLine(undefined, false);
      return;
    }

    if (ev.key == "-") {
      this.putLine(new Vector(x, y), true);
      return;
    }

    if (ev.key == "l") {
      this.putLoop(x, y);
      return;
    }

    if (ev.key == "r") {
      this.rotation();
      return;
    }

    if (ev.key == "R") {
      this.antiRotation();
      return;
    }

    if (ev.key == "W") {
      this.changeArcAngle();
      return;
    }

    if (ev.key == "X") {
      this.changeArcAngleMinus();
      return;
    }

    if (ev.key == "E") {
      this.changeArcEndAngle();
      return;
    }

    if (ev.key == "C") {
      this.changeArcEndAngleMinus();
      return;
    }

    if (ev.key == "t") {
      this.changeType();
      return;
    }

    if (ev.key == "q") {
      this.changeStyle();
      return;
    }

    if (ev.key == "d") {
      this.delete();
      return;
    }

    if (ev.key == "@") {
      this.allowToggle();
      return;
    }

    if (ev.key == "c") {
      this.changeSelect();
      return;
    }

    if (ev.key == "z") {
      this.noSelectMode();
      return;
    }

    if (ev.key == "8") {
      this.keyUp();
      return;
    }

    if (ev.key == "6") {
      this.keyRight();
      return;
    }

    if (ev.key == "4") {
      this.keyLeft();
      return;
    }

    if (ev.key == "2") {
      this.keyDown();
      return;
    }

    if (ev.key == "w") {
      this.changeScale();
      return;
    }

    if (ev.key == "x") {
      this.changeScaleDown();
      return;
    }

    if (ev.key == ">") {
      this.redo();
      return;
    }

    if (ev.key == "<") {
      this.undo();
      return;
    }

    if (ev.key == "m") {
      this.changeMode();
      return;
    }
  }

  drag(ev: MouseEvent) {
    loggerVer("drag");
    let current = this.repository.currentElement();
    if (!current) {
      return;
    }
    let pointer: Vector = this.getPointer();
    if (!(pointer.x == this.pointerPrev.x && pointer.y == this.pointerPrev.y)) {
      this.repository.doCommand(new MoveAbsolute(current, pointer.copy()));
      this.drawAll();
      this.pointerPrev = pointer;
    }
  }

  keyUp() {
    loggerVer("keyUp");
    let current = this.repository.currentElement();
    if (!current) {
      return;
    }
    this.repository.doCommand(new Move(current, new Vector(0, -1).multi(1 / config.scale)));
    this.drawAll();
  }

  keyRight() {
    loggerVer("keyRight");
    let current = this.repository.currentElement();
    if (!current) {
      return;
    }
    this.repository.doCommand(new Move(current, new Vector(1, 0).multi(1 / config.scale)));
    this.drawAll();
  }

  keyLeft() {
    loggerVer("keyLeft");
    let current = this.repository.currentElement();
    if (!current) {
      return;
    }
    this.repository.doCommand(new Move(current, new Vector(-1, 0).multi(1 / config.scale)));
    this.drawAll();
  }

  keyDown() {
    loggerVer("keyDown");
    let current = this.repository.currentElement();
    if (!current) {
      return;
    }
    this.repository.doCommand(new Move(current, new Vector(0, 1).multi(1 / config.scale)));
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
      return;
    }

    if (current && isString(current)) {
      current.label = text;
      this.drawAll();
      return;
    }

    let str = new MyString(text);
    str.origin = new Vector(x, y);
    let command = new SetString(str);
    this.repository.doCommand(command);
    this.drawAll();
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
    this.drawAll();
  }

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

    if (this.isNoSelectMode) {
      return;
    }

    if (exportType != "canvas") {
      return;
    }

    const sub = this.repository.currentSubElement();
    if (sub) {
      draw(this.drawContext, sub, "canvas", "sub");
      this.drawContext.output("sub:   " + sub.description(), "html", "sub");
    }

    const current = this.repository.currentElement();
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

    this.drawContext.output(this.drawMode, "html", "mode");


    this.drawContext.closePath();
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

  delete() {
    let current = this.repository.currentElement();
    if (!current) {
      return;
    }
    this.repository.doCommand(new Delete(current));
    this.drawAll();
  }

  select(point: Vector) {
    if (this.drawMode == "point") {
      this.putVertex(point);
      this.drawAll();
      return;
    }
    if (this.drawMode == "line") {
      if (this.lineMode) {
        this.putLine(point, false);
        this.putVertex(point);
        this.lineMode = undefined;
        this.drawAll();
        return;
      }
      this.lineMode = point
      this.putVertex(this.lineMode);
      this.drawAll();
      return;
    }
    if (this.drawMode == "loop") {
      const current = this.repository.currentElement();
      if (!current) {
          this.putLoop(point.x, point.y);
          this.drawAll();
          return;
      }
      if (isLoop(current)) {
        let loop = new Loop();
        loop.origin = point
        current.addLoop(loop);
        this.repository.doCommand(new SetLoop(loop));
        this.drawAll();
        return;
      }
      if (isLine(current)) {
        let loop = new Loop();
        loop.origin = current.to.add(current.directionUnit().multi(loop.radius*2))
        this.repository.doCommand(new SetLoop(loop));
        this.drawAll();
        return;
      }
      if (isVector(current)) {
        let loop = new Loop();
        loop.origin = current
        this.repository.doCommand(new SetLoop(loop));
        this.drawAll();
        return;
      }
    }   
    if (this.drawMode == "string") {
      this.setString(point.x, point.y);
      this.drawAll();
    }
    if (this.drawMode == "normal") {
      this.repository.select(point);
      this.drawAll();
    }
  }

  subSelect(point: Vector) {
    if (this.drawMode == "normal") {
      this.repository.subSelect(point);
      this.drawAll();
      return;
    }
    this.repository.select(point);
    this.drawAll();
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

  changeMode() {
    if (this.drawMode == "normal") {
      this.drawMode = "line";
    } else if (this.drawMode == "line") {
      this.drawMode = "loop";
    } else if (this.drawMode == "loop") {
      this.drawMode = "normal";
    }
    this.drawAll();
  }
}
