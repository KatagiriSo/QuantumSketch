import { Elem } from "../Core/Elem";
import { Line, isLine, makeLine } from "../Core/Line";
import { Loop, isLoop, makeLoop } from "../Core/Loop";
import { makeMyString, MyString, isString } from "../Core/MyString";
import { Shape } from "../Core/Shape";
import { makeVector, Vector, isVector } from "../Core/Vector";
import { isGroup, Group } from "../Core/Group";
import { loggerVer } from "../looger";
import { RepositoryCommand } from "./RepositoryCommand";

/**
 * The repository of the drawing.
 * It has a list of elements, and it can save and load.
 * It can also get the current element.
 * It can also get all the vertex, loop, and line.
 * It can also get the current element.
 * It can also get the current sub element.
 * It can also set the current element.
 */
export class RDRepository {
  vertexList: Vector[] = [];
  loopList: Loop[] = [];
  lineList: Line[] = [];
  currentIndex: number | undefined = undefined;
  currentSubIndex: number | undefined = undefined;
  elements: Elem[] = [];
  selectedIds: Set<string> = new Set();
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
    this.selectedIds.clear();
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

  setCurrentElement(elem: Elem, additive = false) {
    const index = this.elements.findIndex((e) => e.id === elem.id);
    if (index === -1) {
      return;
    }
    this.currentIndex = index;
    if (!additive) {
      this.selectedIds.clear();
    }
    this.selectedIds.add(elem.id);
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

  getSelectedElements(): Elem[] {
    if (this.selectedIds.size === 0) {
      return [];
    }
    return this.elements.filter((elem) => this.selectedIds.has(elem.id));
  }

  isSelected(elem: Elem): boolean {
    return this.selectedIds.has(elem.id);
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

  findMostNearElements(point: Vector, elements: Elem[], tolerance = 2): Elem[] {
    const sorted = [...elements]
      .map((elem) => ({ elem, distance: elem.formalDistance(point) }))
      .filter(({ distance }) => Number.isFinite(distance))
      .sort((a, b) => a.distance - b.distance);
    if (sorted.length === 0) {
      return [];
    }
    const minDistance = sorted[0].distance;
    if (!Number.isFinite(minDistance) || minDistance > tolerance) {
      return [];
    }
    const targetDistance = minDistance;
    return sorted
      .filter(({ distance }) => Math.abs(distance - targetDistance) < 1e-6)
      .map(({ elem }) => elem);
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

  findElement(point: Vector, current_id: string | undefined, tolerance = 2) {
    const nearElements = this.findMostNearElements(point, this.elements, tolerance);

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

  findNearest(point: Vector, tolerance = 2): Elem | undefined {
    const nearElements = this.findMostNearElements(point, this.elements, tolerance);
    if (nearElements.length === 0) {
      return undefined;
    }
    return nearElements[0];
  }

  findAllNear(point: Vector, tolerance = 2): Elem[] {
    return this.findMostNearElements(point, this.elements, tolerance);
  }

  clearSelectMode() {
    this.currentIndex = undefined;
    this.currentSubIndex = undefined;
    this.selectedIds.clear();
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

  setSelection(elements: Elem[]) {
    this.selectedIds.clear();
    elements.forEach((elem) => this.selectedIds.add(elem.id));
    if (elements.length > 0) {
      this.setCurrentElement(elements[elements.length - 1], true);
    } else {
      this.currentIndex = undefined;
    }
  }

  toggleSelection(elem: Elem) {
    if (this.selectedIds.has(elem.id)) {
      this.selectedIds.delete(elem.id);
      if (this.currentElement()?.id === elem.id) {
        const remaining = this.getSelectedElements();
        if (remaining.length > 0) {
          this.setCurrentElement(remaining[remaining.length - 1], true);
        } else {
          this.currentIndex = undefined;
        }
      }
    } else {
      this.selectedIds.add(elem.id);
      this.setCurrentElement(elem, true);
    }
  }

  selectInRect(rect: { x1: number; y1: number; x2: number; y2: number }, additive: boolean) {
    const normalized = this.normalizeRect(rect);
    const matching = this.elements.filter((elem) => this.intersectsRect(elem, normalized));
    if (!additive) {
      this.selectedIds.clear();
      if (matching.length === 0) {
        this.currentIndex = undefined;
      }
    }
    matching.forEach((elem) => this.selectedIds.add(elem.id));
    if (matching.length > 0) {
      this.setCurrentElement(matching[matching.length - 1], true);
    }
  }

  private normalizeRect(rect: { x1: number; y1: number; x2: number; y2: number }) {
    const x1 = Math.min(rect.x1, rect.x2);
    const y1 = Math.min(rect.y1, rect.y2);
    const x2 = Math.max(rect.x1, rect.x2);
    const y2 = Math.max(rect.y1, rect.y2);
    return { x1, y1, x2, y2 };
  }

  private intersectsRect(elem: Elem, rect: { x1: number; y1: number; x2: number; y2: number }): boolean {
    const box = this.elementBounds(elem);
    return !(box.x2 < rect.x1 || box.x1 > rect.x2 || box.y2 < rect.y1 || box.y1 > rect.y2);
  }

  private elementBounds(elem: Elem): { x1: number; y1: number; x2: number; y2: number } {
    if (isVector(elem)) {
      return { x1: elem.x, y1: elem.y, x2: elem.x, y2: elem.y };
    }
    if (isLine(elem)) {
      const x1 = Math.min(elem.origin.x, elem.to.x);
      const y1 = Math.min(elem.origin.y, elem.to.y);
      const x2 = Math.max(elem.origin.x, elem.to.x);
      const y2 = Math.max(elem.origin.y, elem.to.y);
      return { x1, y1, x2, y2 };
    }
    if (isLoop(elem)) {
      return {
        x1: elem.origin.x - elem.radius,
        y1: elem.origin.y - elem.radius,
        x2: elem.origin.x + elem.radius,
        y2: elem.origin.y + elem.radius,
      };
    }
    if (isString(elem)) {
      return { x1: elem.origin.x, y1: elem.origin.y, x2: elem.origin.x, y2: elem.origin.y };
    }
    if (isGroup(elem)) {
      if (elem.elements.length === 0) {
        return { x1: 0, y1: 0, x2: 0, y2: 0 };
      }
      return elem.elements
        .map((child) => this.elementBounds(child))
        .reduce(
          (acc, box) => ({
            x1: Math.min(acc.x1, box.x1),
            y1: Math.min(acc.y1, box.y1),
            x2: Math.max(acc.x2, box.x2),
            y2: Math.max(acc.y2, box.y2),
          })
        );
    }
    return { x1: -Infinity, y1: -Infinity, x2: Infinity, y2: Infinity };
  }
}
