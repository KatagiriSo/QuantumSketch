import { Elem } from "../Core/Elem";
import { Line, isLine, LineStyle } from "../Core/Line";
import { Loop, isLoop } from "../Core/Loop";
import { MyString } from "../Core/MyString";
import { Vector, isVector } from "../Core/Vector";
import { RDRepository } from "./RDRepository";

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
