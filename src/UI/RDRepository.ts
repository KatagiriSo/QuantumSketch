import { Elem } from "../Core/Elem";
import { Line } from "../Core/Line";
import { Loop } from "../Core/Loop";
import { MyString } from "../Core/MyString";
import { Vector } from "../Core/Vector";
import { loggerVer } from "../looger";
import { RepositoryCommand } from "./RepositoryCommand";

export class RDRepository {
  vertex = new Map<string, Vector>();
  loop = new Map<string, Loop>();
  vertexList: Vector[] = [];
  loopList: Loop[] = [];
  lineList: Line[] = [];
  currentIndex: number | undefined = undefined;
  currentSubIndex: number | undefined = undefined;
  elements: Elem[] = [];
  selectCount: number = 0;
  idCount = 0;
  history: RepositoryCommand[] = [];

  getElement(id: string): Elem | undefined {
    return this.elements.find((elem) => {
      return elem.id == id;
    });
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
    // loggerVer("no currentElement")
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

  getVertex(x: number, y: number): Vector | undefined {
    const vec = this.vertex.get(`${x}_${y}`);
    return vec;
  }

  getLoop(x: number, y: number): Loop | undefined {
    const loop = this.loop.get(`${x}_${y}`);
    return loop;
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
    this.history.push(command);
    command.action(this);
  }

  setVertex(vertex: Vector) {
    const x = vertex.x;
    const y = vertex.y;
    if (this.vertex.get(`${x}_${y}`)) {
      this.vertex.delete(`${x}_${y}`);
      this.vertexList = this.vertexList.filter((vec) => {
        return vec.x != vertex.x && vec.y == vertex.y;
      });
    }
    this.vertex.set(`${vertex.x}_${vertex.y}`, vertex);
    this.vertexList.push(vertex);
    this.elements.push(vertex);
    const currentIndex = this.currentIndex;
    this.currentIndex = this.elements.length - 1;
    this.currentSubIndex = currentIndex;
    loggerVer("currentIndex" + this.currentIndex);
  }

  setLoop(loop: Loop) {
    const x = loop.origin.x;
    const y = loop.origin.y;
    if (this.loop.get(`${x}_${y}`)) {
      this.loop.delete(`${x}_${y}`);
      this.loopList = this.loopList.filter((l) => {
        return l.origin.x != loop.origin.x && l.origin.y == loop.origin.y;
      });
    }
    this.loop.set(`${x}_${y}`, loop);
    this.loopList.push(loop);
    this.elements.push(loop);
    this.currentIndex = this.elements.length - 1;
  }

  setLine(line: Line) {
    this.lineList.push(line);
    this.elements.push(line);
    this.currentIndex = this.elements.length - 1;
  }

  setMyString(str: MyString) {
    this.elements.push(str);
    this.currentIndex = this.elements.length - 1;
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

  select(point: Vector) {
    loggerVer("select");
    this.selectCount++;

    if (this.elements.length == 0) {
      return;
    }
    let findIndex = 0;
    let current = this.currentElement();
    let currentDistance = Number.MAX_VALUE;
    for (let index = 0; index < this.elements.length; index++) {
      if (!current) {
        findIndex = index;
        current = this.elements[index];
        continue;
      }
      let indexElement = this.elements[index];
      let indexDistance = indexElement.formalDistance(point);
      if (indexDistance <= currentDistance && this.currentIndex != index) {
        if (/*this.selectCount <= 1 || this.currentSubIndex != index*/ true) {
          loggerVer(`near:${findIndex}`);
          findIndex = index;
          current = indexElement;
          currentDistance = indexDistance;
        }
      }
    }
    if (currentDistance == Number.MAX_VALUE) {
      this.currentIndex = undefined;
      return;
    }
    const currenIndex = this.currentIndex;
    this.currentIndex = findIndex;
    this.currentSubIndex = currenIndex;
  }

  subSelect(point: Vector) {
    loggerVer("subSelect");
    this.selectCount = 0;
    if (this.elements.length == 0) {
      return;
    }
    let findIndex = 0;
    let current = this.currentSubElement();
    for (let index = 0; index < this.elements.length; index++) {
      if (!current) {
        findIndex = index;
        current = this.elements[index];
        continue;
      }
      let indexElement = this.elements[index];
      let indexDistance = indexElement.formalDistance(point);
      let currentDistance = current.formalDistance(point);
      if (indexDistance <= currentDistance && this.currentSubIndex != index) {
        loggerVer(`near:${findIndex}`);
        findIndex = index;
        current = indexElement;
      }
    }

    this.currentSubIndex = findIndex;
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
}
