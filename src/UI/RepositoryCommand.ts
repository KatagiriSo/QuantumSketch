import { Elem } from "../Core/Elem";
import { Line, isLine, LineStyle } from "../Core/Line";
import { Loop, isLoop } from "../Core/Loop";
import { MyString } from "../Core/MyString";
import { Vector, isVector } from "../Core/Vector";
import { RDRepository } from "./RDRepository";

/**
 * A RepositoryCommand is a command that can be executed on a repository.
 * It can be undone, and redone.
 * It can be saved to a JSON object.
 * It can also be described as a string.
 */
export interface RepositoryCommand {
  action(repo: RDRepository): void;
  unaction(repo: RDRepository): void;
}

export class SetVertex implements RepositoryCommand {
  vertex: Vector;
  copyVertex: Vector;
  constructor(vertex: Vector) {
    this.vertex = vertex;
    this.copyVertex = vertex.copy();
  }
  action(repo: RDRepository): void {
    repo.vertexList.push(this.copyVertex);
    repo.elements.push(this.copyVertex);
    repo.currentIndex = repo.elements.length - 1;
  }

  unaction(repo: RDRepository): void {
    repo.vertexList.splice(repo.vertexList.indexOf(this.copyVertex), 1);
    repo.elements.splice(repo.elements.indexOf(this.copyVertex), 1);
  }
}

export class SetLine implements RepositoryCommand {
  line: Line;
  copyLine: Line;
  constructor(line: Line) {
    this.line = line;
    this.copyLine = line.copy();
  }

  action(repo: RDRepository): void {
    repo.lineList.push(this.copyLine);
    repo.elements.push(this.copyLine);
    repo.currentIndex = repo.elements.length - 1;
  }

  unaction(repo: RDRepository): void {
    repo.lineList.splice(repo.lineList.indexOf(this.copyLine), 1);
    repo.elements.splice(repo.elements.indexOf(this.copyLine), 1);
  }
}

export class SetString implements RepositoryCommand {
  mystring: MyString;
  copyMyString: MyString;
  constructor(str: MyString) {
    this.mystring = str;
    this.copyMyString = str.copy();
  }

  action(repo: RDRepository): void {
    repo.elements.push(this.copyMyString);
     repo.currentIndex = repo.elements.length - 1;
 }

  unaction(repo: RDRepository): void {
    repo.elements.splice(repo.elements.indexOf(this.copyMyString), 1);
  }
}

export class SetLoop implements RepositoryCommand {
  loop: Loop;
  copyLoop: Loop;
  constructor(loop: Loop) {
    this.loop = loop;
    this.copyLoop = loop.copy();
  }

  action(repo: RDRepository): void {
    repo.loopList.push(this.copyLoop);
    repo.elements.push(this.copyLoop);
    repo.currentIndex = repo.elements.length - 1;
  }

  unaction(repo: RDRepository): void {
    repo.loopList.splice(repo.loopList.indexOf(this.copyLoop), 1);
    repo.elements.splice(repo.elements.indexOf(this.copyLoop), 1);
  }
}

export class Delete implements RepositoryCommand {
  target: Elem;

  constructor(target: Elem) {
    this.target = target;
  }

  action(repo: RDRepository): void {
    repo.elements.splice(repo.elements.indexOf(this.target), 1);
    if (isVector(this.target)) {
      repo.vertexList.splice(repo.vertexList.indexOf(this.target), 1);
    }
    if (isLoop(this.target)) {
      repo.loopList.splice(repo.loopList.indexOf(this.target), 1);
    }
    if (isLine(this.target)) {
      repo.lineList.splice(repo.lineList.indexOf(this.target), 1);
    }
  }

  unaction(repo: RDRepository): void {
    repo.elements.push(this.target);
    if (isVector(this.target)) {
      repo.vertexList.push(this.target);
    }
    if (isLoop(this.target)) {
      repo.loopList.push(this.target);
    }
    if (isLine(this.target)) {
      repo.lineList.push(this.target);
    }
  }
}

export class Move implements RepositoryCommand {
  target: Elem;
  delta: Vector;
  before: Elem;

  constructor(target: Elem, delta: Vector) {
    this.target = target;
    this.delta = delta;
    this.before = JSON.parse(JSON.stringify(target));  // 深いコピー
    Object.defineProperties(this.before, Object.getOwnPropertyDescriptors(target));
  }

  action(repo: RDRepository): void {
    this.target.move(this.delta);
  }

  unaction(repo: RDRepository): void {
    // this.target.move(this.delta.multi(-1.0));  // 誤差が蓄積する恐れ
    Object.assign(this.target, this.before);
  }
}

export class MoveAbsolute implements RepositoryCommand {
  target: Elem;
  location: Vector;
  before: Elem;

  constructor(target: Elem, location: Vector) {
    this.target = target;
    this.location = location;
    this.before = JSON.parse(JSON.stringify(target));  // 深いコピー
    Object.defineProperties(this.before, Object.getOwnPropertyDescriptors(target));
  }

  action(repo: RDRepository): void {
    this.target.moveAbsolute(this.location);
  }

  unaction(repo: RDRepository): void {
    Object.assign(this.target, this.before);
  }
}

export class Rotation implements RepositoryCommand {
  target: Line | Loop;
  delta: number;
  before: Line | Loop;

  constructor(target: Line | Loop, delta: number) {
    this.target = target;
    this.delta = delta;
    this.before = JSON.parse(JSON.stringify(target));  // 深いコピー
    Object.defineProperties(this.before, Object.getOwnPropertyDescriptors(target));
  }

  action(repo: RDRepository): void {
    this.target.rotation(this.delta);
  }

  unaction(repo: RDRepository): void {
    // this.target.rotation(-this.delta);
    Object.assign(this.target, this.before);
  }
}

export class ChangeScale implements RepositoryCommand {
  target: Line | Loop;
  delta: number;
  before: Line | Loop;

  constructor(target: Line | Loop, delta: number) {
    this.target = target;
    this.delta = delta;
    this.before = JSON.parse(JSON.stringify(target));  // 深いコピー
    Object.defineProperties(this.before, Object.getOwnPropertyDescriptors(target));
  }

  action(repo: RDRepository): void {
    if (isLine(this.target)) {
      this.target.to = this.target.to.add(this.target.directionUnit().multi(this.delta));
    }
    if (isLoop(this.target)) {
      this.target.setRadius(this.target.radius + this.delta * 1);
    }
  }

  unaction(repo: RDRepository): void {
    // if (isLine(this.target)) {
    //   this.target.to = this.target.to.minus(this.target.directionUnit().multi(this.delta));
    // }
    // if (isLoop(this.target)) {
    //   this.target.setRadius(this.target.radius - this.delta * 1);
    // }
    Object.assign(this.target, this.before);
  }
}

export class ChangeArcAngle implements RepositoryCommand {
  target: Loop;
  delta: number;
  angleBefore: number;

  constructor(target: Loop, delta: number) {
    this.target = target;
    this.delta = delta;
    this.angleBefore = target.loopBeginAngle;
  }

  action(repo: RDRepository): void {
    this.target.setLoopBeginAngle(this.target.loopBeginAngle + this.delta);
  }

  unaction(repo: RDRepository): void {
    // this.target.setLoopBeginAngle(this.target.loopBeginAngle - this.delta);
    this.target.setLoopBeginAngle(this.angleBefore);
  }
}

export class ChangeArcEndAngle implements RepositoryCommand {
  target: Loop;
  delta: number;
  angleBefore: number;

  constructor(target: Loop, delta: number) {
    this.target = target;
    this.delta = delta;
    this.angleBefore = target.loopEndAngle;
  }

  action(repo: RDRepository): void {
    this.target.setLoopEndAngle(this.target.loopEndAngle + this.delta);
  }

  unaction(repo: RDRepository): void {
    // this.target.setLoopEndAngle(this.target.loopEndAngle - this.delta);
    this.target.setLoopEndAngle(this.angleBefore);
  }
}

export class Fill implements RepositoryCommand {
  target: Loop;

  constructor(target: Loop) {
    this.target = target;
  }

  action(repo: RDRepository): void {
    this.target.fill = !this.target.fill;
  }

  unaction(repo: RDRepository): void {
    this.action(repo);
  }
}


export class ArrowToggle implements RepositoryCommand {
  target: Elem;

  constructor(target: Elem) {
    this.target = target;
  }

  action(repo: RDRepository): void {
    if (isLine(this.target)) {
      this.target.allow = !this.target.allow;
    }
    if (isLoop(this.target)) {
      this.target.allow = !this.target.allow;
    }
  }

  unaction(repo: RDRepository): void {
    this.action(repo);
  }
}

export class ChangeType implements RepositoryCommand {
  target: Elem;

  constructor(target: Elem) {
    this.target = target;
  }

  action(repo: RDRepository): void {
    if (isLine(this.target)) {
      this.target.toggle();
    }
  }

  unaction(repo: RDRepository): void {
    this.action(repo);
  }
}

export class RotateArrow implements RepositoryCommand {
  targets: Line[];
  before: number[];
  delta: number;

  constructor(targets: Line[], delta: number) {
    this.targets = targets;
    this.before = targets.map((line) => line.arrowRotation ?? 0);
    this.delta = delta;
  }

  action(repo: RDRepository): void {
    this.targets.forEach((line, index) => {
      line.arrowRotation = this.before[index] + this.delta;
    });
  }

  unaction(repo: RDRepository): void {
    this.targets.forEach((line, index) => {
      line.arrowRotation = this.before[index];
    });
  }
}

export class SetArrowRotation implements RepositoryCommand {
  targets: Line[];
  before: number[];
  after: number[];

  constructor(targets: Line[], after: number | number[]) {
    this.targets = targets;
    this.before = targets.map((line) => line.arrowRotation ?? 0);
    if (Array.isArray(after)) {
      this.after = after;
    } else {
      this.after = targets.map(() => after);
    }
  }

  action(repo: RDRepository): void {
    this.targets.forEach((line, index) => {
      line.arrowRotation = this.after[index];
    });
  }

  unaction(repo: RDRepository): void {
    this.targets.forEach((line, index) => {
      line.arrowRotation = this.before[index];
    });
  }
}

export class ChangeStyle implements RepositoryCommand {
  target: Line | Loop;
  styleBefore: LineStyle = "normal";
  styleAfter: LineStyle = "normal";

  constructor(target: Line | Loop) {
    this.target = target;
    this.styleBefore = target.style;
    if (isLine(target)) {
      if (this.styleBefore == "normal") {
        this.styleAfter = "dash";
      }
      if (this.styleBefore == "dash") {
        this.styleAfter = "wave";
      }
      if (this.styleBefore == "wave") {
        this.styleAfter = "coil";
      }
      if (this.styleBefore == "coil") {
        this.styleAfter = "double";
      }
      if (this.styleBefore == "double") {
        this.styleAfter = "normal";
      }
    }
    if (isLoop(target)) {
      if (this.styleBefore == "normal") {
        this.styleAfter = "dash";
      }
      if (this.styleBefore == "dash") {
        this.styleAfter = "wave";
      }
      if (this.styleBefore == "wave") {
        this.styleAfter = "coil";
      }
      if (this.styleBefore == "coil") {
        this.styleAfter = "normal";
      }
    }
  }

  action(repo: RDRepository): void {
    this.target.style = this.styleAfter;
  }

  unaction(repo: RDRepository): void {
    this.target.style = this.styleBefore;
  }
}

export class MoveGroup implements RepositoryCommand {
  targets: Elem[];
  delta: Vector;
  before: Elem[] = [];

  constructor(targets: Elem[], delta: Vector) {
    this.targets = targets;
    this.delta = delta;
    this.before = targets.map((target) => {
      const cloned = JSON.parse(JSON.stringify(target));
      Object.defineProperties(cloned, Object.getOwnPropertyDescriptors(target));
      return cloned;
    });
  }

  action(repo: RDRepository): void {
    this.targets.forEach((target) => {
      target.move(this.delta);
    });
  }

  unaction(repo: RDRepository): void {
    this.targets.forEach((target, index) => {
      Object.assign(target, this.before[index]);
    });
  }
}

export class DeleteGroup implements RepositoryCommand {
  targets: Elem[];
  snapshots: { elem: Elem; index: number }[] = [];

  constructor(targets: Elem[]) {
    this.targets = targets;
  }

  action(repo: RDRepository): void {
    this.snapshots = this.targets
      .map((target) => ({ elem: target, index: repo.elements.indexOf(target) }))
      .filter((snapshot) => snapshot.index !== -1)
      .sort((a, b) => a.index - b.index);

    [...this.snapshots]
      .sort((a, b) => b.index - a.index)
      .forEach(({ elem, index }) => {
        repo.elements.splice(index, 1);
        if (isVector(elem)) {
          const idx = repo.vertexList.indexOf(elem);
          if (idx !== -1) {
            repo.vertexList.splice(idx, 1);
          }
        }
        if (isLoop(elem)) {
          const idx = repo.loopList.indexOf(elem);
          if (idx !== -1) {
            repo.loopList.splice(idx, 1);
          }
        }
        if (isLine(elem)) {
          const idx = repo.lineList.indexOf(elem);
          if (idx !== -1) {
            repo.lineList.splice(idx, 1);
          }
        }
      });
  }

  unaction(repo: RDRepository): void {
    this.snapshots
      .sort((a, b) => a.index - b.index)
      .forEach(({ elem, index }) => {
        repo.elements.splice(index, 0, elem);
        if (isVector(elem) && !repo.vertexList.includes(elem as Vector)) {
          repo.vertexList.push(elem as Vector);
        }
        if (isLoop(elem) && !repo.loopList.includes(elem as Loop)) {
          repo.loopList.push(elem as Loop);
        }
        if (isLine(elem) && !repo.lineList.includes(elem as Line)) {
          repo.lineList.push(elem as Line);
        }
      });
  }
}

export class SetLoopRadius implements RepositoryCommand {
  target: Loop;
  before: number;
  after: number;

  constructor(target: Loop, after: number) {
    this.target = target;
    this.before = target.radius;
    this.after = after;
  }

  action(repo: RDRepository): void {
    this.target.setRadius(this.after);
  }

  unaction(repo: RDRepository): void {
    this.target.setRadius(this.before);
  }
}

export class SetLoopBeginAngle implements RepositoryCommand {
  target: Loop;
  before: number;
  after: number;

  constructor(target: Loop, after: number) {
    this.target = target;
    this.before = target.loopBeginAngle;
    this.after = after;
  }

  action(repo: RDRepository): void {
    this.target.setLoopBeginAngle(this.after);
  }

  unaction(repo: RDRepository): void {
    this.target.setLoopBeginAngle(this.before);
  }
}

export class SetLoopEndAngle implements RepositoryCommand {
  target: Loop;
  before: number;
  after: number;

  constructor(target: Loop, after: number) {
    this.target = target;
    this.before = target.loopEndAngle;
    this.after = after;
  }

  action(repo: RDRepository): void {
    this.target.setLoopEndAngle(this.after);
  }

  unaction(repo: RDRepository): void {
    this.target.setLoopEndAngle(this.before);
  }
}

export class SetLoopAngles implements RepositoryCommand {
  target: Loop;
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;

  constructor(target: Loop, afterStart: number, afterEnd: number) {
    this.target = target;
    this.beforeStart = target.loopBeginAngle;
    this.beforeEnd = target.loopEndAngle;
    this.afterStart = afterStart;
    this.afterEnd = afterEnd;
  }

  action(repo: RDRepository): void {
    this.target.setLoopBeginAngle(this.afterStart);
    this.target.setLoopEndAngle(this.afterEnd);
  }

  unaction(repo: RDRepository): void {
    this.target.setLoopBeginAngle(this.beforeStart);
    this.target.setLoopEndAngle(this.beforeEnd);
  }
}

export class SetLineEndpoint implements RepositoryCommand {
  line: Line;
  endpoint: "origin" | "to";
  before: Vector;
  after: Vector;

  constructor(line: Line, endpoint: "origin" | "to", after: Vector) {
    this.line = line;
    this.endpoint = endpoint;
    this.before = line[endpoint].copy();
    this.after = after.copy();
  }

  action(repo: RDRepository): void {
    this.line[this.endpoint].moveAbsolute(this.after);
  }

  unaction(repo: RDRepository): void {
    this.line[this.endpoint].moveAbsolute(this.before);
  }
}

export class SetLineControlPoint implements RepositoryCommand {
  line: Line;
  before: Vector | null;
  after: Vector | null;

  constructor(line: Line, after: Vector | null) {
    this.line = line;
    this.before = line.control ? line.control.copy() : null;
    this.after = after ? after.copy() : null;
  }

  action(repo: RDRepository): void {
    this.line.control = this.after ? this.after.copy() : null;
  }

  unaction(repo: RDRepository): void {
    this.line.control = this.before ? this.before.copy() : null;
  }
}
