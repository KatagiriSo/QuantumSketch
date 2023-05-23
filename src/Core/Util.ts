import { Elem } from "./Elem";
import { isGroup } from "./Group";
import { isLoop } from "./Loop";
import { isString } from "./MyString";
import { Vector, isVector } from "./Vector"

function origin(elem:Elem): Vector|undefined {
    if (isVector(elem)) {
        return elem;
    }
    if (isLoop(elem)) {
        return elem.origin;
    }
    if (isString(elem)) {
        return elem.origin;
    }
    if (isGroup(elem)) {
        return origin(elem);
    }
    return undefined;
}
