import { config } from "../Config";
import { Line, isLine } from "../Core/Line";
import { isLoop, Loop } from "../Core/Loop";
import { isString, MyString } from "../Core/MyString";
import { Vector, isVector } from "../Core/Vector";
import { loggerVer, loggerOn } from "../looger";
import { draw } from "./draw";
import { DrawContext } from "./DrawContext";
import { ExportType } from "./ExportType";
import { RDRepository } from "./RDRepository";
import { SetString, SetVertex, SetLoop, SetLine } from "./RepositoryCommand";

export class RDDraw {
  repository: RDRepository = new RDRepository();
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  drawContext: DrawContext;
  isClick: boolean = false;
  isMouseDown: "Up" | "Down" | "Downning" = "Up";
  clickIimeOutID?: NodeJS.Timeout = undefined;
  prevX: number = 0;
  prevY: number = 0;
  stringMode?: string = undefined;
  isNoSelectMode: boolean = false;
  constructor(canvas: HTMLCanvasElement, drawContext: DrawContext) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d")!;
    this.drawContext = drawContext;
    this.bind();
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
  }

  click(ev: MouseEvent) {
    this.isMouseDown = "Up";

    const scale = config.scale;
    const x = Math.floor(this.prevX / scale);
    const y = Math.floor(this.prevY / scale);

    if (this.isClick) {
      this.subSelect(new Vector(x, y));
      this.isClick = false;
      if (this.clickIimeOutID) {
        clearTimeout(this.clickIimeOutID);
      }
      return;
    }
    this.isClick = true;
    this.clickIimeOutID = setTimeout(() => {
      this.isClick = false;
      this.clickIimeOutID = undefined;
      this.select(new Vector(x, y));
    }, 250);
  }

  // dbclick(ev: MouseEvent) {

  //     const scale = config.scale
  //     const x = Math.floor(this.prevX / scale)
  //     const y = Math.floor(this.prevY / scale)
  //     this.subSelect(new Vector(x, y))
  // }

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
    const scale = config.scale;

    // context.beginPath()
    // context.fillStyle = 'rgb(255,255,255)'
    // context.fillRect(this.prevX - 1, this.prevY - 1,
    //     3, 3)
    // // context.stroke()
    // context.closePath()

    // const x = Math.floor(ev.x / scale) * scale
    // const y = Math.floor(ev.y / scale) * scale

    // context.beginPath()
    // context.fillStyle = 'rgb(255,0,0)'
    // context.fillRect(x-1, y-1,
    //     3, 3)
    // // context.stroke()
    // context.closePath()
    // loggerVer(`move:${ev.x}_${ev.y}`)

    this.prevX = ev.offsetX + config.scale / 2;
    this.prevY = ev.offsetY + config.scale / 2;

    // loggerVer("move")
    if (this.isMouseDown == "Down") {
      this.drag(ev);
    }
  }

  keyPress(ev: KeyboardEvent) {
    loggerVer("key:" + ev.key);
    const scale = config.scale;
    const x = Math.floor(this.prevX / scale);
    const y = Math.floor(this.prevY / scale);

    // if (this.stringMode != undefined) {

    //     if (ev.key == "/" || ev.key == "Enter") {
    //         // let current = this.repository.currentElement()
    //         // if (current && isLine(current)) {
    //         //     current.label = this.stringMode
    //         //     this.stringMode = undefined
    //         //     loggerVer("stringMode OUT")
    //         //     this.drawAll()
    //         //     return
    //         // }
    //         // if (current && isLoop(current)) {
    //         //     current.label = this.stringMode
    //         //     this.stringMode = undefined
    //         //     loggerVer("stringMode OUT")
    //         //     this.drawAll()
    //         //     return
    //         // }
    //         // let str = new MyString(this.stringMode)
    //         // str.origin = new Vector(x, y)
    //         // this.repository.doCommand(new SetString(str))
    //         this.stringMode = undefined
    //         loggerVer("stringMode OUT")
    //         this.drawAll()
    //         return
    //     }

    //     let elem = this.repository.getElement(this.stringMode)
    //     if (!elem) {
    //         return
    //     }
    //     if (isString(elem)) {
    //         elem.label = elem.label + ev.key
    //         loggerVer("stringMode:" + elem.label)
    //         this.drawAll()
    //         return
    //     }
    //     return
    // }

    // if (ev.key == "/") {
    //     loggerVer("stringMode In")
    //     let str = new MyString("")
    //     str.origin = new Vector(x, y)
    //     let command = new SetString(str)
    //     this.repository.doCommand(command)
    //     this.stringMode = command.copyMyString.id
    //     return
    // }

    if (ev.ctrlKey && ev.key == "c") {
      this.copy();
      loggerOn("crt + c");
      return;
    }

    if (ev.key == "/") {
      this.setString(x, y);
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
      this.putLine();
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
  }

  drag(ev: MouseEvent) {
    loggerVer("drag");
    let current = this.repository.currentElement();
    current?.moveAbsolute(
      new Vector(this.prevX, this.prevY).multi(1 / config.scale)
    );
    this.drawAll();
  }

  keyUp() {
    loggerVer("keyUp");
    let current = this.repository.currentElement();
    current?.move(new Vector(0, -1).multi(1 / config.scale));
    this.drawAll();
  }

  keyRight() {
    loggerVer("keyRight");
    let current = this.repository.currentElement();
    current?.move(new Vector(1, 0).multi(1 / config.scale));
    this.drawAll();
  }

  keyLeft() {
    loggerVer("keyLeft");
    let current = this.repository.currentElement();
    current?.move(new Vector(-1, 0).multi(1 / config.scale));
    this.drawAll();
  }

  keyDown() {
    loggerVer("keyDown");
    let current = this.repository.currentElement();
    current?.move(new Vector(0, 1).multi(1 / config.scale));
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
      current.fill = !current.fill;
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
      loggerVer("draw..");
      draw(this.drawContext, elm, exportType);
    });

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
      this.drawContext.output("current:" + current.description(), "html", "current");
    }
    this.drawContext.closePath();
  }

  putLine() {
    let current = this.repository.currentElement();
    let sub = this.repository.currentSubElement();
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
      sub.addLineTo(line);
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
      elem.rotation((2 * Math.PI) / 360);
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.changeArcAngle();
      this.changeArcEndAngle();
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
      elem.rotation((-2 * Math.PI) / 72);
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      this.changeArcAngleMinus();
      this.changeArcEndAngleMinus();
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
      elem.allow = !elem.allow;
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
      elem.toggle();
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
      elem.loopBeginAngle = elem.loopBeginAngle + (2 * Math.PI) / 72;
      if (elem.loopBeginAngle >= 2 * Math.PI) {
        elem.loopBeginAngle = 0;
      }
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
      elem.loopBeginAngle = elem.loopBeginAngle - (2 * Math.PI) / 72;
      if (elem.loopBeginAngle < 0) {
        elem.loopBeginAngle = 2 * Math.PI - (2 * Math.PI) / 72;
      }
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
      elem.loopEndAngle = elem.loopEndAngle + (2 * Math.PI) / 72;
      if (elem.loopEndAngle >= 2 * Math.PI) {
        elem.loopEndAngle = 0;
      }
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
      elem.loopEndAngle = elem.loopEndAngle - (2 * Math.PI) / 72;
      if (elem.loopEndAngle < 0) {
        elem.loopEndAngle = 2 * Math.PI - (2 * Math.PI) / 72;
      }
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
      elem.to = elem.to.add(elem.directionUnit());
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      elem.radius = elem.radius + 1;
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
      elem.to = elem.to.add(elem.directionUnit().multi(-1));
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      elem.radius = elem.radius - 1;
      if (elem.radius < 1) {
        elem.radius = 1;
      }
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
      if (elem.style == "normal") {
        elem.style = "dash";
        this.drawAll();
        return;
      }
      if (elem.style == "dash") {
        elem.style = "wave";
        this.drawAll();
        return;
      }
      if (elem.style == "wave") {
        elem.style = "coil";
        this.drawAll();
        return;
      }
      if (elem.style == "coil") {
        elem.style = "normal";
        this.drawAll();
        return;
      }
      this.drawAll();
      return;
    }
    if (isLoop(elem)) {
      if (elem.style == "normal") {
        elem.style = "dash";
        this.drawAll();
        return;
      }
      if (elem.style == "dash") {
        elem.style = "wave";
        this.drawAll();
        return;
      }
      if (elem.style == "wave") {
        elem.style = "coil";
        this.drawAll();
        return;
      }
      if (elem.style == "coil") {
        elem.style = "normal";
        this.drawAll();
        return;
      }

      this.drawAll();
      return;
    }
  }

  delete() {
    this.repository.deleteCurrentEelemnt();
    this.drawAll();
  }

  select(point: Vector) {
    this.repository.select(point);
    this.drawAll();
  }

  subSelect(point: Vector) {
    this.repository.subSelect(point);
    this.drawAll();
  }
}
