import { Line } from "../Core/Line";
import { Loop } from "../Core/Loop";
import { Vector } from "../Core/Vector";
import { Vertex } from "../Core/Vertex";
import { draw } from "../UI/draw";
import { DrawContext } from "../UI/DrawContext";

function getContext() {
  let canvas = document.getElementById("canvas") as HTMLCanvasElement;
  let context_ = canvas.getContext("2d")!;

  let drawContext = new DrawContext(context_);
  return drawContext;
}

/// example
function drawFourVertex(context: DrawContext) {
  let exLine1 = new Line();
  let exLine2 = new Line();
  let exLine3 = new Line();
  let exLine4 = new Line();
  let vertex = new Vertex();
  let elems = [exLine1, exLine2, exLine3, exLine4, vertex];

  exLine1.label = "k1";
  exLine2.label = "k2";
  exLine3.label = "k3";
  exLine4.label = "k4";

  exLine1.origin = new Vector(2, 2);
  exLine2.to = new Vector(10, 2);
  exLine3.origin = new Vector(2, 10);
  exLine4.to = new Vector(10, 10);
  vertex.origin = new Vector(6, 6);
  vertex.addLineTo(exLine1);
  vertex.addLineTo(exLine3);
  vertex.addLineOrigin(exLine2);
  vertex.addLineOrigin(exLine4);

  elems.forEach((x) => {
    draw(context, x, "canvas");
  });
}

/// example
function draw2loop(context: DrawContext) {
  let exLine1 = new Line("k1");
  let exLine2 = new Line("k2");
  let exLine3 = new Line("k3");
  let exLine4 = new Line("k4");
  let intLine = new Line("w");
  let loop = new Loop();
  let loop2 = new Loop();
  let elems = [exLine1, exLine2, exLine3, exLine4, loop, loop2, intLine];
  exLine1.origin = new Vector(2, 2);
  exLine2.to = new Vector(14, 2);
  exLine3.origin = new Vector(2, 10);
  exLine4.to = new Vector(14, 10);
  loop.origin = new Vector(6, 6);
  loop2.origin = new Vector(10, 6);

  loop.labels = [
    { label: "p1", angle: 0, diff: 0 },
    { label: "p2", angle: Math.PI, diff: 0 },
    { label: "p3", angle: (Math.PI * 3) / 2, diff: 0.3 },
  ];
  loop2.labels = [
    { label: "q1", angle: 0, diff: 0 },
    { label: "q2", angle: Math.PI / 2, diff: 0 },
    { label: "q3", angle: Math.PI, diff: 0 },
  ];

  loop.addLineTo(exLine1);
  loop2.addLineOrigin(exLine2);
  loop.addLineTo(exLine3);
  loop2.addLineOrigin(exLine4);
  intLine.between(loop2, loop);

  elems.forEach((x) => {
    draw(context, x, "canvas");
  });
}

/// example
function drawloop(n: number) {
  let exLines: Line[] = [];
  for (let i = 0; i < 4; i++) {
    exLines.push(new Line("k" + i));
  }
}

/// example
function kakanzuTest(context: DrawContext) {
  let loop00 = new Loop("A");
  let loop01 = new Loop("B");
  let loop10 = new Loop("C");
  let loop11 = new Loop("D");
  let line1 = new Line();
  let line2 = new Line();
  let line3 = new Line();
  let line4 = new Line();
  let elems = [loop00, loop01, loop10, loop11, line1, line2, line3, line4];

  loop00.origin = new Vector(2, 2);
  loop01.origin = new Vector(2, 10);
  loop10.origin = new Vector(10, 2);
  loop11.origin = new Vector(10, 10);

  line1.between(loop00, loop01);
  line2.between(loop01, loop11);
  line3.between(loop00, loop10);
  line4.between(loop10, loop11);

  elems.forEach((x) => {
    draw(context, x, "canvas");
  });
}

// const context = getContext()
// draw2loop()
