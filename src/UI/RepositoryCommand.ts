import { Line } from "../Core/Line";
import { Loop } from "../Core/Loop";
import { MyString } from "../Core/MyString";
import { Vector } from "../Core/Vector";
import { RDRepository } from "./RDRepository";

export interface RepositoryCommand {
  action(repo: RDRepository): void;
}

export class SetVertex implements RepositoryCommand {
  vertex: Vector;
  copyVertex: Vector;
  constructor(vertex: Vector) {
    this.vertex = vertex;
    this.copyVertex = vertex.copy();
  }
  action(repo: RDRepository): void {
    repo.setVertex(this.copyVertex);
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
    repo.setLine(this.copyLine);
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
    repo.setMyString(this.copyMyString);
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
    repo.setLoop(this.copyLoop);
  }
}
