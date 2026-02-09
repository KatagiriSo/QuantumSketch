import { Elem } from "../Core/Elem";
import { setElemIDCounter } from "../Core/Elem";
import { Line, isLine, makeLine } from "../Core/Line";
import { Loop, isLoop, makeLoop } from "../Core/Loop";
import { makeMyString, isString } from "../Core/MyString";
import { Shape } from "../Core/Shape";
import { makeVector, Vector, isVector } from "../Core/Vector";
import { Vertex } from "../Core/Vertex";
import { isGroup } from "../Core/Group";
import { loggerVer } from "../looger";
import { RepositoryCommand } from "./RepositoryCommand";

export class RDRepository {
  vertexList: Vertex[] = [];
  loopList: Loop[] = [];
  lineList: Line[] = [];
  vertexMap: Map<string, Vertex> = new Map();
  currentIndex: number | undefined = undefined;
  currentSubIndex: number | undefined = undefined;
  elements: Elem[] = [];
  selectedIds: Set<string> = new Set();
  idCount = 0;
  history: RepositoryCommand[] = [];
  historyHead = 0;

  private selectionOrder: string[] = [];
  private currentSubId?: string;

  save(): string {
    return JSON.stringify({
      elements: this.elements.map((e) => e.save()),
    });
  }

  load(saveData: string) {
    const saveJson = JSON.parse(saveData);
    this.idCount = 0;
    this.selectedIds.clear();
    this.selectionOrder = [];
    this.currentSubId = undefined;
    const rawElements = Array.isArray(saveJson["elements"]) ? saveJson["elements"] : [];
    this.elements = this.loadElements(rawElements);
    this.reindexElements();
    this.rebindGraphReferences();
    this.syncSelectionState();
    const ids = this.elements
      .map((e) => Number.parseFloat(e.id))
      .filter((value) => Number.isFinite(value));
    this.idCount = ids.length > 0 ? Math.max(...ids.map((n) => Math.floor(n))) : 0;
    setElemIDCounter(this.idCount + 1);
  }

  loadElements(saveJsonElements: unknown[]): Elem[] {
    return saveJsonElements
      .map((raw) => this.parseSerializedElement(raw))
      .flatMap((elem) => (elem ? [elem] : []));
  }

  private parseSerializedElement(raw: unknown): Elem | undefined {
    if (typeof raw !== "string") {
      return undefined;
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }

    const shape = json["shape"];
    if (typeof shape !== "string") {
      return undefined;
    }

    switch (shape as Shape) {
      case "Line":
        return makeLine(json);
      case "Loop":
        return makeLoop(json);
      case "Point":
        return makeVector(json);
      case "String":
        return makeMyString(json);
      default:
        return undefined;
    }
  }

  getElement(id: string): Elem | undefined {
    return this.elements.find((elem) => elem.id === id);
  }

  setCurrentElement(elem: Elem, additive = false) {
    const index = this.elements.findIndex((e) => e.id === elem.id);
    if (index === -1) {
      return;
    }
    if (!additive) {
      this.selectedIds.clear();
      this.selectionOrder = [];
    }
    this.selectedIds.add(elem.id);
    this.pushSelectionOrder(elem.id);
    this.syncSelectionState();
  }

  setSubCurrentElement(elem: Elem) {
    if (!this.elements.some((e) => e.id === elem.id)) {
      return;
    }
    this.currentSubId = elem.id;
    this.currentSubIndex = this.elements.findIndex((e) => e.id === elem.id);
  }

  currentElement(): Elem | undefined {
    if (this.selectionOrder.length === 0) {
      return undefined;
    }
    const id = this.selectionOrder[this.selectionOrder.length - 1];
    return this.getElement(id);
  }

  currentSubElement(): Elem | undefined {
    if (!this.currentSubId) {
      return undefined;
    }
    return this.getElement(this.currentSubId);
  }

  getAllVertex(): Vector[] {
    return this.vertexList;
  }

  getVertex(id: string): Vertex | undefined {
    return this.vertexMap.get(id);
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
    const current = this.currentElement();
    if (!current) {
      return;
    }
    const index = this.elements.indexOf(current);
    if (index >= 0) {
      this.elements.splice(index, 1);
    }
    this.selectedIds.delete(current.id);
    this.selectionOrder = this.selectionOrder.filter((id) => id !== current.id);
    this.syncSelectionState();
  }

  doCommand(command: RepositoryCommand) {
    this.history[this.historyHead++] = command;
    this.history.splice(this.historyHead);
    command.action(this);
    this.reindexElements();
    this.rebindGraphReferences();
    this.syncSelectionState();
  }

  nextElem() {
    loggerVer("nextElem");
    if (this.elements.length === 0) {
      return;
    }
    const current = this.currentElement();
    const currentIndex = current ? this.elements.findIndex((e) => e.id === current.id) : -1;
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % this.elements.length;
    this.setCurrentElement(this.elements[nextIndex], false);
  }

  nextSubElem() {
    if (this.elements.length === 0) {
      return;
    }
    const currentSub = this.currentSubElement();
    const currentIndex = currentSub ? this.elements.findIndex((e) => e.id === currentSub.id) : -1;
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % this.elements.length;
    this.setSubCurrentElement(this.elements[nextIndex]);
  }

  preElem() {
    if (this.elements.length === 0) {
      return;
    }
    const current = this.currentElement();
    const currentIndex = current ? this.elements.findIndex((e) => e.id === current.id) : 0;
    const prevIndex = currentIndex <= 0 ? this.elements.length - 1 : currentIndex - 1;
    this.setCurrentElement(this.elements[prevIndex], false);
  }

  preSubElem() {
    if (this.elements.length === 0) {
      return;
    }
    const currentSub = this.currentSubElement();
    const currentIndex = currentSub ? this.elements.findIndex((e) => e.id === currentSub.id) : 0;
    const prevIndex = currentIndex <= 0 ? this.elements.length - 1 : currentIndex - 1;
    this.setSubCurrentElement(this.elements[prevIndex]);
  }

  findMostNearElements(point: Vector, elements: Elem[], tolerance = 2): Elem[] {
    const nearByBounds = elements.filter((elem) => {
      const box = this.elementBounds(elem);
      const inflate = tolerance;
      return !(
        point.x < box.x1 - inflate ||
        point.x > box.x2 + inflate ||
        point.y < box.y1 - inflate ||
        point.y > box.y2 + inflate
      );
    });

    const sorted = [...nearByBounds]
      .map((elem) => ({
        elem,
        distance: elem.formalDistance(point),
        zOrder: this.elements.findIndex((target) => target.id === elem.id),
      }))
      .filter(({ distance }) => Number.isFinite(distance))
      .sort((a, b) => {
        if (Math.abs(a.distance - b.distance) > 1e-6) {
          return a.distance - b.distance;
        }
        return b.zOrder - a.zOrder;
      });

    if (sorted.length === 0) {
      return [];
    }
    const minDistance = sorted[0].distance;
    if (!Number.isFinite(minDistance) || minDistance > tolerance) {
      return [];
    }
    return sorted
      .filter(({ distance }) => Math.abs(distance - minDistance) < 1e-6)
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

  findElement(point: Vector, currentId: string | undefined, tolerance = 2) {
    const nearElements = this.findMostNearElements(point, this.elements, tolerance);
    if (nearElements.length === 0) {
      return undefined;
    }
    if (!currentId) {
      return nearElements[0];
    }
    const currentIndex = nearElements.findIndex((e) => e.id === currentId);
    if (currentIndex < 0) {
      return nearElements[0];
    }
    return nearElements[(currentIndex + 1) % nearElements.length];
  }

  findNearest(point: Vector, tolerance = 2): Elem | undefined {
    const nearElements = this.findMostNearElements(point, this.elements, tolerance);
    return nearElements.length > 0 ? nearElements[0] : undefined;
  }

  findNearestEdge(point: Vector, tolerance = 2): Elem | undefined {
    const candidates = this.elements.filter((elem) => !isVector(elem));
    const nearElements = this.findMostNearElements(point, candidates, tolerance);
    return nearElements.length > 0 ? nearElements[0] : undefined;
  }

  hitTest(point: Vector, zoom: number, pxTolerance = 12): Elem | undefined {
    const safeZoom = Math.max(zoom, 0.0001);
    const tolerance = Math.max(0.25, pxTolerance / safeZoom);
    return this.findNearest(point, tolerance);
  }

  findAllNear(point: Vector, tolerance = 2): Elem[] {
    return this.findMostNearElements(point, this.elements, tolerance);
  }

  clearSelectMode() {
    this.selectedIds.clear();
    this.selectionOrder = [];
    this.currentIndex = undefined;
    this.currentSubIndex = undefined;
    this.currentSubId = undefined;
  }

  changeSelect() {
    const current = this.currentElement();
    const sub = this.currentSubElement();
    if (!sub) {
      return;
    }
    this.setCurrentElement(sub, false);
    if (current) {
      this.setSubCurrentElement(current);
    } else {
      this.currentSubId = undefined;
      this.currentSubIndex = undefined;
    }
  }

  undo() {
    if (this.historyHead <= 0) {
      return;
    }
    this.history[--this.historyHead].unaction(this);
    this.reindexElements();
    this.rebindGraphReferences();
    this.syncSelectionState();
  }

  redo() {
    if (this.historyHead >= this.history.length) {
      return;
    }
    this.history[this.historyHead++].action(this);
    this.reindexElements();
    this.rebindGraphReferences();
    this.syncSelectionState();
  }

  ensureVertex(point: Vector, tolerance = 0.15): Vertex {
    const near = this.findNearestVertex(point, tolerance);
    if (near) {
      return near;
    }
    const vertex = new Vertex(point.x, point.y);
    this.vertexList.push(vertex);
    this.elements.push(vertex);
    this.vertexMap.set(vertex.id, vertex);
    this.currentIndex = this.elements.length - 1;
    return vertex;
  }

  findNearestVertex(point: Vector, tolerance = 1.0, skipId?: string): Vertex | undefined {
    let nearest: Vertex | undefined = undefined;
    let minDistance = Number.POSITIVE_INFINITY;
    this.vertexList.forEach((vertex) => {
      if (skipId && vertex.id === skipId) {
        return;
      }
      const distance = vertex.minus(point).length();
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

  bindLineToVertices(line: Line, start: Vertex, end: Vertex): void {
    const previousStart = line.startVertexId ? this.vertexMap.get(line.startVertexId) : undefined;
    const previousEnd = line.endVertexId ? this.vertexMap.get(line.endVertexId) : undefined;
    if (previousStart && previousStart.id !== start.id) {
      previousStart.detachLine(line.id);
    }
    if (previousEnd && previousEnd.id !== end.id) {
      previousEnd.detachLine(line.id);
    }
    line.bindVertices(start, end);
    start.attachLine(line.id);
    end.attachLine(line.id);
  }

  bindLineEndpoint(line: Line, endpoint: "origin" | "to", vertex: Vertex): void {
    if (endpoint === "origin") {
      const previous = line.startVertexId ? this.vertexMap.get(line.startVertexId) : undefined;
      if (previous && previous.id !== vertex.id) {
        previous.detachLine(line.id);
      }
      line.bindStartVertex(vertex);
      vertex.attachLine(line.id);
      return;
    }
    const previous = line.endVertexId ? this.vertexMap.get(line.endVertexId) : undefined;
    if (previous && previous.id !== vertex.id) {
      previous.detachLine(line.id);
    }
    line.bindEndVertex(vertex);
    vertex.attachLine(line.id);
  }

  bindLoopCenter(loop: Loop, vertex: Vertex): void {
    const previous = loop.centerVertexId ? this.vertexMap.get(loop.centerVertexId) : undefined;
    if (previous && previous.id !== vertex.id) {
      previous.detachLoop(loop.id);
    }
    loop.bindCenterVertex(vertex);
    vertex.attachLoop(loop.id);
  }

  mergeVertexInto(source: Vertex, target: Vertex): void {
    if (source.id === target.id) {
      return;
    }
    this.lineList.forEach((line) => {
      if (line.startVertexId === source.id) {
        this.bindLineEndpoint(line, "origin", target);
      }
      if (line.endVertexId === source.id) {
        this.bindLineEndpoint(line, "to", target);
      }
    });
    this.loopList.forEach((loop) => {
      if (loop.centerVertexId === source.id) {
        this.bindLoopCenter(loop, target);
      }
    });
    this.vertexList = this.vertexList.filter((vertex) => vertex.id !== source.id);
    this.elements = this.elements.filter((elem) => elem.id !== source.id);
    this.vertexMap.delete(source.id);
    this.selectedIds.delete(source.id);
    this.selectionOrder = this.selectionOrder.filter((id) => id !== source.id);
    this.syncSelectionState();
  }

  cleanupDanglingVertices(): void {
    const used = new Set<string>();
    this.lineList.forEach((line) => {
      if (line.startVertexId) {
        used.add(line.startVertexId);
      }
      if (line.endVertexId) {
        used.add(line.endVertexId);
      }
    });
    this.loopList.forEach((loop) => {
      if (loop.centerVertexId) {
        used.add(loop.centerVertexId);
      }
    });
    this.vertexList = this.vertexList.filter((vertex) => used.has(vertex.id) || this.selectedIds.has(vertex.id));
    const vertexIds = new Set(this.vertexList.map((vertex) => vertex.id));
    this.elements = this.elements.filter((elem) => !isVector(elem) || vertexIds.has(elem.id));
    this.reindexElements();
    this.syncSelectionState();
  }

  setSelection(elements: Elem[]) {
    this.selectedIds.clear();
    this.selectionOrder = [];
    elements.forEach((elem) => {
      if (this.elements.some((e) => e.id === elem.id)) {
        this.selectedIds.add(elem.id);
        this.pushSelectionOrder(elem.id);
      }
    });
    this.syncSelectionState();
  }

  toggleSelection(elem: Elem) {
    if (this.selectedIds.has(elem.id)) {
      this.selectedIds.delete(elem.id);
      this.selectionOrder = this.selectionOrder.filter((id) => id !== elem.id);
    } else {
      this.selectedIds.add(elem.id);
      this.pushSelectionOrder(elem.id);
    }
    this.syncSelectionState();
  }

  selectInRect(rect: { x1: number; y1: number; x2: number; y2: number }, additive: boolean) {
    const normalized = this.normalizeRect(rect);
    const matching = this.elements.filter((elem) => this.intersectsRect(elem, normalized));
    if (!additive) {
      this.selectedIds.clear();
      this.selectionOrder = [];
    }
    matching.forEach((elem) => {
      this.selectedIds.add(elem.id);
      this.pushSelectionOrder(elem.id);
    });
    this.syncSelectionState();
  }

  private normalizeRect(rect: { x1: number; y1: number; x2: number; y2: number }) {
    return {
      x1: Math.min(rect.x1, rect.x2),
      y1: Math.min(rect.y1, rect.y2),
      x2: Math.max(rect.x1, rect.x2),
      y2: Math.max(rect.y1, rect.y2),
    };
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
      const xs = [elem.origin.x, elem.to.x];
      const ys = [elem.origin.y, elem.to.y];
      if (elem.control) {
        xs.push(elem.control.x);
        ys.push(elem.control.y);
      }
      return {
        x1: Math.min(...xs),
        y1: Math.min(...ys),
        x2: Math.max(...xs),
        y2: Math.max(...ys),
      };
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

  private pushSelectionOrder(id: string) {
    this.selectionOrder = this.selectionOrder.filter((item) => item !== id);
    this.selectionOrder.push(id);
  }

  private syncSelectionState() {
    const elementIds = new Set(this.elements.map((e) => e.id));
    this.selectedIds.forEach((id) => {
      if (!elementIds.has(id)) {
        this.selectedIds.delete(id);
      }
    });
    this.selectionOrder = this.selectionOrder.filter((id) => this.selectedIds.has(id) && elementIds.has(id));
    const current = this.currentElement();
    this.currentIndex = current ? this.elements.findIndex((e) => e.id === current.id) : undefined;

    if (this.currentSubId && !elementIds.has(this.currentSubId)) {
      this.currentSubId = undefined;
    }
    const sub = this.currentSubElement();
    this.currentSubIndex = sub ? this.elements.findIndex((e) => e.id === sub.id) : undefined;
  }

  private reindexElements(): void {
    this.vertexList = this.elements.filter((elem): elem is Vertex => {
      if (!isVector(elem)) {
        return false;
      }
      if (!(elem instanceof Vertex)) {
        Object.setPrototypeOf(elem, Vertex.prototype);
        const vertex = elem as Vertex;
        if (!vertex.connectedLineIds) {
          vertex.connectedLineIds = new Set();
        }
        if (!vertex.connectedLoopIds) {
          vertex.connectedLoopIds = new Set();
        }
      }
      return true;
    });
    this.lineList = this.elements.filter((elem): elem is Line => isLine(elem));
    this.loopList = this.elements.filter((elem): elem is Loop => isLoop(elem));
    this.vertexMap.clear();
    this.vertexList.forEach((vertex) => this.vertexMap.set(vertex.id, vertex));
  }

  private rebindGraphReferences(): void {
    this.vertexList.forEach((vertex) => {
      vertex.connectedLineIds.clear();
      vertex.connectedLoopIds.clear();
    });

    this.lineList.forEach((line) => {
      let start = line.startVertexId ? this.vertexMap.get(line.startVertexId) : undefined;
      let end = line.endVertexId ? this.vertexMap.get(line.endVertexId) : undefined;

      if (!start) {
        start = this.ensureVertex(line.origin, 0.0);
      }
      if (!end) {
        end = this.ensureVertex(line.to, 0.0);
      }
      this.bindLineToVertices(line, start, end);
    });

    this.loopList.forEach((loop) => {
      let center = loop.centerVertexId ? this.vertexMap.get(loop.centerVertexId) : undefined;
      if (!center) {
        center = this.ensureVertex(loop.origin, 0.0);
      }
      this.bindLoopCenter(loop, center);
    });
  }
}
