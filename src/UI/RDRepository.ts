import { Elem } from "../Core/Elem";
import { Line, makeLine } from "../Core/Line";
import { Loop, makeLoop } from "../Core/Loop";
import { makeMyString, MyString } from "../Core/MyString";
import { Shape } from "../Core/Shape";
import { makeVector, Vector } from "../Core/Vector";
import { loggerVer } from "../looger";
import { RepositoryCommand } from "./RepositoryCommand";

export class RDRepository {
  vertexList: Vector[] = [];
  loopList: Loop[] = [];
  lineList: Line[] = [];
  currentIndex: number | undefined = undefined;
  currentSubIndex: number | undefined = undefined;
  elements: Elem[] = [];
  idCount = 0;
  history: RepositoryCommand[] = [];
  historyHead = 0;  // 次に書き込むべき位置を指す

  save(): string {
    const saveData = {} as any;
    saveData["elements"] = this.elements.map((e) => e.save());
    return JSON.stringify(saveData);
  }

  load(saveData: string) {
    const saveJson = JSON.parse(saveData);
    this.idCount = 0;
    this.currentIndex = 0
    this.currentSubIndex = 0
    this.elements = this.loadElements(saveJson["elements"]);
    this.idCount = Math.max(...this.elements.map(e => Math.floor(Number.parseFloat(e .id))))
  }

  loadElements(saveJsonElements: any[]): Elem[] {
    return saveJsonElements.flatMap(e => {
      const json = JSON.parse(e)
      const shape = json["shape"];
      if (!shape) {
        return undefined
      }
      switch (shape as Shape) {
        case "Line":
          return makeLine(json);
        case "Loop":
          return makeLoop(json)
        case "Point":
          return makeVector(json)
        case "String":
          return makeMyString(json)
      }
    }).flatMap(e => e !== undefined ? [e] : []).flat()
  }

  getElement(id: string): Elem | undefined {
    return this.elements.find((elem) => {
      return elem.id == id;
    });
  }

  setCurrentElement(elem: Elem) {
    this.currentIndex = this.elements.findIndex((e) => e.id === elem.id);
  }

  setSubCurrentElement(elem: Elem) {
    this.currentSubIndex = this.elements.findIndex((e) => e.id === elem.id);
  }

  currentElement(): Elem | undefined {
    // loggerVer("currentElement:length:"+this.elements.length)
    // loggerVer("currentIndex:"+this.currentIndex)

    if (
      this.currentIndex != undefined &&
      this.currentIndex < this.elements.length
    ) {
      return this.elements[this.currentIndex];
    }
    return undefined;
  }

  currentSubElement(): Elem | undefined {
    if (
      this.currentSubIndex != undefined &&
      this.currentSubIndex < this.elements.length
    ) {
      return this.elements[this.currentSubIndex];
    }
    return undefined;
  }

  getAllVertex(): Vector[] {
    return this.vertexList;
  }

  getAllLoop(): Loop[] {
    return this.loopList;
  }

  getAllLine(): Line[] {
    return this.lineList;
  }

  getAllElements(): Elem[] {
    return this.elements;
  }

  deleteCurrentEelemnt() {
    if (this.currentIndex == undefined) {
      return;
    }
    let currentElem = this.currentElement();
    if (!currentElem) {
      return;
    }

    let nextCurrentIndex = this.currentIndex - 1;
    if (nextCurrentIndex < 0) {
      nextCurrentIndex = 0;
    }

    this.elements.splice(this.currentIndex, 1);
    this.currentIndex = nextCurrentIndex;
  }

  doCommand(command: RepositoryCommand) {
    this.history[this.historyHead++] = command;
    this.history.splice(this.historyHead);  // headから先の枝を切る
    command.action(this);
  }

  nextElem() {
    loggerVer("nextElem");
    if (this.currentIndex == undefined) {
      if (this.elements.length == 0) {
        loggerVer("nextElem return");
        return;
      }
      this.currentIndex = -1;
    }
    this.currentIndex = this.currentIndex + 1;
    if (this.currentIndex >= this.elements.length) {
      this.currentIndex = 0;
    }
    loggerVer("currentIndex" + this.currentIndex);
  }

  nextSubElem() {
    if (this.currentSubIndex == undefined) {
      if (this.elements.length == 0) {
        return;
      }
      this.currentSubIndex = -1;
    }
    this.currentSubIndex = this.currentSubIndex + 1;
    if (this.currentSubIndex >= this.elements.length) {
      this.currentSubIndex = 0;
    }
  }

  preElem() {
    if (this.currentIndex == undefined) {
      if (this.elements.length == 0) {
        return;
      }
      this.currentIndex = +1;
    }
    this.currentIndex = this.currentIndex - 1;
    if (this.currentIndex < 0) {
      this.currentIndex =
        this.elements.length != 0 ? this.elements.length - 1 : 0;
    }
  }

  preSubElem() {
    if (this.currentSubIndex == undefined) {
      if (this.elements.length == 0) {
        return;
      }
      this.currentSubIndex = +1;
    }
    this.currentSubIndex = this.currentSubIndex - 1;
    if (this.currentSubIndex < 0) {
      this.currentSubIndex =
        this.elements.length != 0 ? this.elements.length - 1 : 0;
    }
  }

  findMostNearElements(point: Vector, elements: Elem[]): Elem[] {
    const sorted = [...elements].sort((e1, e2) => {
      return e1.formalDistance(point) - e2.formalDistance(point);
    });
    if (sorted.length < 2) {
      return sorted;
    }
    const elem = sorted[0];
    return sorted.filter(
      (e) => e.formalDistance(point) === elem.formalDistance(point)
    );
  }

  select(point: Vector) {
    const elem = this.findElement(point, this.currentElement()?.id);
    if (elem) {
      this.setCurrentElement(elem);
    }
  }

  subSelect(point: Vector) {
    const elem = this.findElement(point, this.currentSubElement()?.id);
    if (elem) {
      this.setSubCurrentElement(elem);
    }
  }

  findElement(point: Vector, current_id: string | undefined) {
    const nearElements = this.findMostNearElements(point, this.elements);

    if (nearElements.length === 0) {
      return;
    }

    function next(elems: Elem[], index?: number): Elem {
      if (index === undefined || index < 0) {
        return elems[0];
      }
      if (index >= elems.length) {
        return elems[0];
      }
      return elems[index];
    }
    const indexOfCurrent = nearElements.findIndex((e) => e.id === current_id);

    let nearElement = next(nearElements, indexOfCurrent);

    return nearElement;
  }

  clearSelectMode() {
    this.currentIndex = undefined;
    this.currentSubIndex = undefined;
  }

  changeSelect() {
    const currentIndex = this.currentIndex;
    this.currentIndex = this.currentSubIndex;
    this.currentSubIndex = currentIndex;
  }

  undo() {
    if (this.historyHead <= 0) {
      return;
    }
    this.history[--this.historyHead].unaction(this);
  }

  redo() {
    if (this.historyHead >= this.history.length) {
      return;
    }
    this.history[this.historyHead++].action(this);
  }
}
