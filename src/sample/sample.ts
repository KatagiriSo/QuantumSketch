import { Elem } from "../Core/Elem";
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
export function draw2loop(context: DrawContext) {
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

export function clossLoop3(drawContext: DrawContext) {
    let v_Line = new Line("", "normal");
    let n_Line = new Line("", "dash");
    let boson_Line = new Line("", "wave");
    let vertex = new Vertex();
    vertex.origin = new Vector(6, 6);
    v_Line.origin = new Vector(0, 6);
    n_Line.to = new Vector(12, 6);
    boson_Line.to = new Vector(12, 0);

    vertex.addLineTo(v_Line);
    vertex.addLineOrigin(n_Line);
    vertex.addLineOrigin(boson_Line);
    const elems = [v_Line, n_Line, boson_Line, vertex];
    elems.forEach((x) => draw(drawContext, x, "canvas"));
}

export function clossLoop(drawContext: DrawContext) : string {
    let list: Elem[] = []
    let vertex_L = new Vertex("", new Vector(3, 6));
    let vertex_I_L = new Vertex("", new Vector(6, 6));
    let vertex_I_R = new Vertex("", new Vector(9, 6));
    let vertex_R = new Vertex("", new Vector(12, 6));
    list.push(vertex_L, vertex_I_L, vertex_I_L, vertex_I_R, vertex_R);

    let v_L_Line = new Line("", "normal");
    let v_R_Line = new Line("", "normal");
    let v_C_Line = new Line("", "normal");
    let n_1_Line = new Line("", "dash");
    let n_2_Line = new Line("", "dash");
    let boson_L_Line = new Line("", "wave");
    let boson_R_Line = new Line("", "wave");
    list.push(
        v_L_Line,
        v_R_Line,
        v_C_Line,
        n_1_Line,
        n_2_Line,
        boson_L_Line,
        boson_R_Line
    );

    v_L_Line.origin = new Vector(0, 6);
    vertex_L.addLineTo(v_L_Line);
    vertex_L.addLineOrigin(n_1_Line);
    vertex_I_L.addLineTo(n_1_Line)
    vertex_I_L.addLineOrigin(v_C_Line)
    vertex_I_R.addLineTo(v_C_Line);
    vertex_I_R.addLineOrigin(n_2_Line);
    vertex_R.addLineTo(n_2_Line)
    vertex_R.addLineOrigin(v_R_Line);
    v_R_Line.to = vertex_R.origin.add(new Vector(3, 0))

    const loop = new Loop()
    loop.style = "wave"
    loop.origin = v_C_Line.center()
    loop.radius = v_C_Line.length() / 2 + v_L_Line.length()
    loop.loopBeginAngle = 0
    loop.loopEndAngle = Math.PI
    list.push(loop)

    vertex_I_L.addLineTo(boson_L_Line)
    vertex_I_R.addLineOrigin(boson_R_Line)
    boson_L_Line.origin = new Vector(0, 0)
    boson_R_Line.to = new Vector(16,0)

    drawContext.setExportType("svg")
    drawContext.startExport();
    list.forEach((x) => draw(drawContext, x, "svg"));
    const result = drawContext.endExport();
    return result
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
