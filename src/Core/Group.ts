import { Elem, getElemID } from "./Elem";
import { isLoop } from "./Loop";
import { isString } from "./MyString";
import { isVector } from "./Vector";
import { Vector } from "./Vector";

export class Group implements Elem {
    id: string;
    shape: "Group" = "Group";
    elements: Elem[] = [];
    
    first(): Elem | undefined {
        if (this.elements.length === 0) {
            return undefined;
        }
        return this.elements[0];
    }

    constructor(elements:Elem[]) {
        this.id = getElemID();
        this.elements = elements;
    }
    formalDistance(point: Vector): number {
        if (this.elements.length === 0) {
            return Infinity;
        }
        let minDistance = Infinity;
        for (let elem of this.elements) {
            let distance = elem.formalDistance(point);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        return minDistance;
    }
    move(delta: Vector): void {
        for (let elem of this.elements) {
            elem.move(delta);
        }
    }
    copy(): Elem {
        let elementsCopy = [];
        for (let elem of this.elements) {
            elementsCopy.push(elem.copy());
        }
        return new Group(elementsCopy);
    }
    moveAbsolute(location: Vector): void {
        if (this.elements.length === 0) {
            return;
        }
        const first = this.elements[0];
        if (isVector(first)) {
            let delta = location.minus(first);
            this.move(delta);
        } else if (isLoop(first)) {
            let delta = location.minus(first.origin);
            this.move(delta);
        } else if (isString(first)) {
            let delta = location.minus(first.origin);
            this.move(delta);
        } else if (isGroup(first)) {
            first.moveAbsolute(location);
        } else {

        }
    }
    description(): string {
        let desc = `${this.shape} id:${this.id} elements:`;
        for (let elem of this.elements) {
            desc += elem.description() + " ";
        }
        return desc;
    }
    save() {
        let saveData = {} as any;
        saveData["id"] = this.id;
        saveData["shape"] = this.shape;
        saveData["elements"] = [];
        for (let elem of this.elements) {
            saveData["elements"].push(elem.save());
        }
        return saveData;
    }
}

export function isGroup(elem: Elem): elem is Group {
    return elem.shape == "Group";
}

    