import { config } from "../Config";
import { Color } from "../Core/Color";
import { Elem } from "../Core/Elem";
import { isGroup } from "../Core/Group";
import { Line, LineStyle } from "../Core/Line";
import { Loop } from "../Core/Loop";
import { MyString } from "../Core/MyString";
import { textPosition } from "../Core/TextPosition";
import { Vector } from "../Core/Vector";
import { loggerVer } from "../looger";
import { DrawContext } from "./DrawContext";
import { ExportType } from "./ExportType";

const CURVED_LINE_SEGMENTS = 48;
const EPSILON = 1e-6;

function lineDirectionAt(line: Line, t: number): Vector {
  let tangent = line.tangentAt(t);
  if (tangent.length() < EPSILON) {
    tangent = line.direction();
  }
  const length = tangent.length();
  if (length < EPSILON) {
    return new Vector(1, 0);
  }
  return tangent.multi(1 / length);
}

function lineNormalAt(line: Line, t: number): Vector {
  const direction = lineDirectionAt(line, t);
  return direction.rotation(Math.PI / 2);
}

function sampleLinePoints(line: Line, segments = line.control ? CURVED_LINE_SEGMENTS : 1): Vector[] {
  const count = Math.max(1, segments);
  const points: Vector[] = [];
  for (let i = 0; i <= count; i++) {
    const t = count === 0 ? 0 : i / count;
    points.push(line.pointAt(t));
  }
  return points;
}

function computeCumulativeLengths(points: Vector[]): { cumulative: number[]; total: number } {
  const cumulative: number[] = new Array(points.length).fill(0);
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const segmentLength = points[i].minus(points[i - 1]).length();
    total += segmentLength;
    cumulative[i] = total;
  }
  return { cumulative, total };
}

function sampleOffsetLinePoints(line: Line, offset: number, segments = line.control ? CURVED_LINE_SEGMENTS : 1): Vector[] {
  const count = Math.max(1, segments);
  const points: Vector[] = [];
  for (let i = 0; i <= count; i++) {
    const t = count === 0 ? 0 : i / count;
    const basePoint = line.pointAt(t);
    const normal = lineNormalAt(line, t);
    const offsetVector = normal.multi(offset);
    points.push(basePoint.add(offsetVector));
  }
  return points;
}

function tracePolyline(drawContext: DrawContext, points: Vector[], style: LineStyle) {
  if (points.length < 2) {
    return;
  }
  drawContext.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    drawContext.lineTo(points[i].x, points[i].y, style);
  }
}

function lineMidDirection(line: Line): Vector {
  return lineDirectionAt(line, 0.5);
}

function sampleCoilPoints(line: Line): Vector[] {
  const segmentLength = 1.0;
  const aspect = 0.9;
  const amplitude = 0.5;
  const segments = line.control ? CURVED_LINE_SEGMENTS * 4 : Math.max(32, Math.ceil(line.length() * 18));
  const basePoints = sampleLinePoints(line, segments);
  const { cumulative, total } = computeCumulativeLengths(basePoints);
  if (total < segmentLength) {
    return basePoints;
  }

  const turns = Math.max(1, Math.floor(total / segmentLength));
  const coilPoints: Vector[] = [];
  for (let i = 0; i < basePoints.length; i++) {
    const s = cumulative[i];
    const tNorm = segments === 0 ? 0 : i / segments;
    const tangent = lineDirectionAt(line, tNorm);
    const normal = lineNormalAt(line, tNorm);
    const phase = (s / total) * (turns - 0.5) * 2 * Math.PI;
    const u = aspect * amplitude * Math.cos(Math.PI - phase) - aspect * amplitude * ((2 * s) / total - 1);
    const v = amplitude * Math.sin(Math.PI - phase);
    coilPoints.push(
      basePoints[i]
        .add(tangent.multi(u))
        .add(normal.multi(v))
    );
  }
  return coilPoints;
}

/**
 * draw is the main function to draw an element.
 * @param drawContext the draw context
 * @param elem the element to draw
 * @param exportType the export type 
 * @param color the color
 */
export function draw(
  drawContext: DrawContext,
  elem: Elem,
  exportType: ExportType,
  color: Color = "normal"
) {
  if (elem.shape == "Line") {
    drawLine(drawContext, elem as Line, exportType, color);
    return;
  }
  if (elem.shape == "Loop") {
    drawLoop(drawContext, elem as Loop, exportType, color);
    return;
  }

  if (elem.shape == "Point") {
    drawPoint(drawContext, elem as Vector, exportType, color);
    return;
  }

  if (elem.shape == "String") {
    drawText(drawContext, elem as MyString, exportType, color);
    return;
  }
  if (isGroup(elem)) {
    elem.elements.forEach((elem) => {
      draw(drawContext, elem, exportType, color);
    });
    return;
  }
}

/**
 * draw DoubleLine
 */
export function drawDoubleLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  const offset = 0.1;
  const segments = line.control ? CURVED_LINE_SEGMENTS : 1;
  const outer = sampleOffsetLinePoints(line, offset, segments);
  const inner = sampleOffsetLinePoints(line, -offset, segments);

  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  tracePolyline(drawContext, outer, line.style);
  drawContext.stroke();
  drawContext.closePath();

  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  tracePolyline(drawContext, inner, line.style);
  drawContext.stroke();
  drawContext.closePath();

  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    const midDirection = lineMidDirection(line);
    const labelNormal = midDirection.rotation(Math.PI / 2);
    const pos = line.center().add(labelNormal.multi(diff));
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
  // drawContext.setLineDash([])
}

/**
 * draw a line
 */
export function drawNormalLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  drawContext.beginPath();

  drawContext.setStrokeColor(color);
  const linestyle: LineStyle = line.style;
  const segments = line.control ? CURVED_LINE_SEGMENTS : 1;
  const points = sampleLinePoints(line, segments);
  tracePolyline(drawContext, points, linestyle);

  drawContext.stroke();
  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    const midDirection = lineMidDirection(line);
    const labelNormal = midDirection.rotation(Math.PI / 2);
    const pos = line.center().add(labelNormal.multi(diff));
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
  // drawContext.setLineDash([])
}

export function drawWaveLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  if (!line.control) {
    drawContext.beginPath();

    const origin = line.origin;
    const unitVec = line.directionUnit();
    const perpVec = unitVec.rotation(Math.PI / 2);

    drawContext.setStrokeColor(color);
    let lineStyle: LineStyle = "normal";
    if (line.style == "dash") {
      lineStyle = "dash";
    }

    drawContext.moveTo(origin.x, origin.y);
    for (let l = 0; l < line.length(); l += 0.1) {
      const offset = Math.sin(l * 5) * 3 / 15;
      let x = origin.x + unitVec.x * l + perpVec.x * offset;
      let y = origin.y + unitVec.y * l + perpVec.y * offset;
      drawContext.lineTo(x, y, lineStyle);
      drawContext.moveTo(x, y);
      drawContext.stroke();
    }

    if (line.allow) {
      drawAllow(drawContext, line, exportType);
    }
    if (line.label) {
      let diff = 1.0 + line.labelDiff;
      const midDirection = lineMidDirection(line);
      const pos = line.center().add(midDirection.rotation(Math.PI / 2).multi(diff));
      let position = textPosition(line.label, pos, config);
      drawContext.fillText(line.label, position.x, position.y);
    }

    drawContext.closePath();
    return;
  }

  const baseSegments = CURVED_LINE_SEGMENTS * 3;
  const basePoints = sampleLinePoints(line, baseSegments);
  const { cumulative, total } = computeCumulativeLengths(basePoints);
  const amplitude = 0.2;
  const frequency = 5;
  const wavePoints = basePoints.map((point, index) => {
    if (total < EPSILON) {
      return point.copy();
    }
    const t = baseSegments === 0 ? 0 : index / baseSegments;
    const normal = lineNormalAt(line, t);
    const offset = Math.sin(cumulative[index] * frequency) * amplitude;
    return point.add(normal.multi(offset));
  });

  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  tracePolyline(drawContext, wavePoints, "normal");
  drawContext.stroke();

  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    const midDirection = lineMidDirection(line);
    const pos = line.center().add(midDirection.rotation(Math.PI / 2).multi(diff));
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
}

/**
 * draw a coil line
 */
export function drawCoilLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  const coilPoints = sampleCoilPoints(line);
  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  tracePolyline(drawContext, coilPoints, "normal");
  drawContext.stroke();

  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    const midDirection = lineMidDirection(line);
    const pos = line.center().add(midDirection.rotation(Math.PI / 2).multi(diff));
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
}

/**
 * draw line
 */
export function drawLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  if (line.style == "wave") {
    ///MARK: not good
    if (exportType == "canvas" || exportType == "svg") {
      drawWaveLine(drawContext, line, exportType, color);
      return;
    }
  }

  if (line.style == "coil") {
    ///MARK: not good
    if (exportType == "canvas" || exportType == "svg") {
      drawCoilLine(drawContext, line, exportType, color);
      return;
    }
  }

  if (line.style == "double") {
    drawDoubleLine(drawContext, line, exportType, color);
    return
  }

  drawNormalLine(drawContext, line, exportType, color)

}

/**
 * draw allow
 */
export function drawAllow(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  const center = line.pointAt(0.5);
  const baseDirection = lineMidDirection(line);
  const direction = baseDirection.rotation(line.arrowRotation ?? 0);
  const forward = direction.multi(0.4);
  const normal = direction.rotation(Math.PI / 2).multi(0.35);
  const tip = center.add(forward);
  const tail = center.minus(forward);
  const tail1 = tail.add(normal);
  const tail2 = tail.minus(normal);
  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  drawContext.moveTo(tip.x, tip.y);
  drawContext.lineTo(tail1.x, tail1.y, "normal");
  drawContext.lineTo(tail2.x, tail2.y, "normal");
  drawContext.closePath();
  // context.arc(100, 10, 50, 0, Math.PI * 2)
  drawContext.stroke();
}

/**
 * draw wave loop
 */
export function drawWaveLoop(
  drawContext: DrawContext,
  loop: Loop,
  exportType: ExportType,
  color: Color = "normal"
) {
  // drawContext.beginPath()

  let origin = loop.origin;
  let radius = loop.radius;
  let beginAngle = loop.loopBeginAngle;
  let endAngle = loop.loopEndAngle;

  const segmentNum = 360 * (radius / 2);
  const segmentAngleWith = (Math.PI * 2) / segmentNum;

  const snakeNum = 12;
  const amplitude = 0.1 * radius;

  if (beginAngle < 0) {
    beginAngle += Math.PI * 2;
  }
  if (beginAngle > Math.PI * 2) {
    beginAngle -= Math.PI * 2;
  }

  if (endAngle < 0) {
    endAngle += Math.PI * 2;
  }
  if (endAngle > Math.PI * 2) {
    endAngle -= Math.PI * 2;
  }

  if (beginAngle > endAngle) {
    endAngle += Math.PI * 2;
  }

  for (
    let angle = beginAngle;
    angle < endAngle;
    angle = angle + segmentAngleWith
  ) {
    let unitVec = new Vector(1, 0).rotation(angle);
    let unitVec2 = new Vector(1, 0).rotation(angle + segmentAngleWith);
    let snake = amplitude * Math.sin(angle * snakeNum);
    // let perpVec = unitVec.rotation(Math.PI / 2)
    let startPoint = origin.add(unitVec.multi(radius + snake));
    let endPoint = origin.add(unitVec2.multi(radius + snake));
    let line = new Line();
    line.style = "normal";
    line.origin = startPoint;
    line.to = endPoint;
    line.allow = false;
    drawLine(drawContext, line, exportType, color);
  }

  // drawContext.setStrokeColor(color)
  // // context.arc(100, 10, 50, 0, Math.PI * 2)
  // let lineSyle: LineStyle = "normal"
  // if (line.style == "dash") {
  //     lineSyle = "dash"
  // }

  // drawContext.moveTo(origin.x, origin.y)
  // for (let l = 0; l < line.length(); l += 0.1) {
  //     let x = origin.x + unitVec.x * l + perpVec.x * Math.sin(l * 5) * 3 / 15
  //     let y = origin.y + unitVec.y * l + perpVec.y * Math.sin(l * 5) * 3 / 15
  //     loggerVer(`draw ${l} ${x} ${y}`)
  //     drawContext.lineTo(x, y, lineSyle)
  //     drawContext.moveTo(x, y)
  //     drawContext.stroke()
  // }

  // if (line.allow) {
  //     drawAllow(line, exportType)
  // }

  // drawContext.closePath()
  // drawContext.setLineDash([])
}

/**
 * draw coil loop
 */
export function drawCoilLoop(
  drawContext: DrawContext,
  loop: Loop,
  exportType: ExportType,
  color: Color = "normal"
) {
  let beginAngle = loop.loopBeginAngle;
  let endAngle = loop.loopEndAngle;

  if (beginAngle < 0) {
    beginAngle += Math.PI * 2;
  }
  if (beginAngle > Math.PI * 2) {
    beginAngle -= Math.PI * 2;
  }

  if (endAngle < 0) {
    endAngle += Math.PI * 2;
  }
  if (endAngle > Math.PI * 2) {
    endAngle -= Math.PI * 2;
  }

  if (beginAngle > endAngle) {
    endAngle += Math.PI * 2;
  }

  drawContext.setStrokeColor(color);
  let lineSyle: LineStyle = "normal";
  if (loop.style == "dash") {
    lineSyle = "dash";
  }

  let pathLength: number = loop.radius * (endAngle - beginAngle);

  // 経路とその接線ベクトルの媒介変数表示
  // 要素の種類によって決まる関数
  let x: (s: number) => number;
  let y: (s: number) => number;
  let dx: (s: number) => number;
  let dy: (s: number) => number;
  {
    // 弧長sから中心角angleへ
    const angle = (s: number): number => {
      return s / loop.radius + beginAngle;
    };

    x = (s) => {
      return loop.radius * Math.cos(angle(s)) + loop.origin.x;
    };
    y = (s) => {
      return loop.radius * Math.sin(angle(s)) + loop.origin.y;
    };
    dx = (s) => {
      return Math.cos(angle(s) + Math.PI / 2);
    };
    dy = (s) => {
      return Math.sin(angle(s) + Math.PI / 2);
    };
  }

  // 線のスタイルとpathLengthによって決まる関数
  let u: (s: number) => number;
  let v: (s: number) => number;
  {
    // コイル線のパラメータ
    const segmentLength: number = 1.0;
    const aspect: number = 0.9;
    const amplitude: number = 0.5;

    // 経路の長さが1波長(segmentLength)よりも短い場合、線の装飾をしない。
    if (pathLength < segmentLength) {
      u = v = (s) => {
        return 0;
      };
    } else {
      // コイルの巻き数
      let n: number = Math.floor(pathLength / segmentLength);

      // 弧長sから位相tへ
      const t = (s: number): number => {
        return (s / pathLength) * (n - 1 / 2) * 2 * Math.PI;
      };

      u = (s) => {
        // 第2項は両端を閉じるための補正。経路の中間点で0。
        return (
          aspect * amplitude * Math.cos(Math.PI - t(s)) -
          aspect * amplitude * ((2 * s) / pathLength - 1)
        );
      };
      v = (s) => {
        return amplitude * Math.sin(Math.PI - t(s));
      };
    }
  }

  const resolution: number = 32; // 1巻きのコイルを32本の線分で描く程度
  let ds: number, begin: number, end: number;
  let f: (s: number) => number;
  let g: (s: number) => number;
  f = (s) => {
    return x(s) + (u(s) * dx(s) - v(s) * dy(s));
  };
  g = (s) => {
    return y(s) + (u(s) * dy(s) + v(s) * dx(s));
  };
  ds = (2 * Math.PI * 0.5) /*amplitude*/ / resolution;
  begin = 0;
  end = pathLength;
  drawContext.beginPath();
  {
    let x: number, y: number, s: number;

    (x = f(begin)), (y = g(begin));
    drawContext.moveTo(x, y);
    for (s = begin; s < end; s += ds) {
      (x = f(s)), (y = g(s));
      drawContext.lineTo(x, y, lineSyle);
      drawContext.moveTo(x, y);
    }
    (x = f(end)), (y = g(end));
    drawContext.lineTo(x, y, lineSyle);
  }
  drawContext.stroke();
  drawContext.closePath();
  /*
    // 基準線
    f = x
    g = y
    drawContext.beginPath()
    {
        let x: number, y: number, s: number

        x = f(begin), y = g(begin)
        drawContext.moveTo(x, y)
        for (s = begin; s < end; s += ds) {
            x = f(s), y = g(s)
            drawContext.lineTo(x, y, lineSyle)
            drawContext.moveTo(x, y)
        }
        x = f(end), y = g(end)
        drawContext.lineTo(x, y, lineSyle)
    }
    drawContext.stroke()
    drawContext.closePath()
*/
}

/**
 * draw a loop
 */
export function drawLoop(
  drawContext: DrawContext,
  loop: Loop,
  exportType: ExportType,
  color: Color = "normal"
) {
  if (loop.style == "wave") {
    ///MARK: not good
    if (exportType == "canvas" || exportType == "svg") {
      drawWaveLoop(drawContext, loop, exportType, color);
      return;
    }
  }

  if (loop.style == "coil") {
    ///MARK: not good
    if (exportType == "canvas" ||  exportType=="svg") {
      drawCoilLoop(drawContext, loop, exportType, color);
      return;
    }
  }

  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  drawContext.setFillColor(color);
  let lineStyle: LineStyle = "normal";
  if (loop.style == "dash") {
    lineStyle = "dash";
  }
  if (loop.style == "wave") {
    lineStyle = "wave";
  }
  if (loop.style == "coil") {
    lineStyle = "coil";
  }

  drawContext.arc(
    loop.origin.x,
    loop.origin.y,
    loop.radius,
    loop.loopBeginAngle,
    loop.loopEndAngle,
    lineStyle,
    loop.fill
  );
  drawContext.stroke();

  if (loop.allow) {
    drawLoopAllow(drawContext, loop, exportType, color);
  }

  if (loop.label) {
    let position = textPosition(loop.label, loop.origin, config);
    drawContext.fillText(loop.label, position.x, position.y);
  }

  if (loop.labels) {
    loop.labels.forEach((lab) => {
      const diff = 0.5 + lab.diff;
      let pos = loop.origin.add(
        new Vector(0, -1).multi(loop.radius + diff).rotation(lab.angle)
      );
      let position = textPosition(lab.label, pos, config);
      drawContext.fillText(lab.label, position.x, position.y);
    });
  }

  drawContext.closePath();
  // drawContext.setLineDash([])
}

function drawLoopAllow(
  drawContext: DrawContext,
  loop: Loop,
  exportType: ExportType,
  color: Color
) {
  let diff = loop.loopEndAngle - loop.loopBeginAngle;
  if (diff <= 0) {
    diff += Math.PI * 2;
  }
  if (diff < 0.01) {
    return;
  }
  const mid = loop.loopBeginAngle + diff / 2;
  const radial = new Vector(Math.cos(mid), Math.sin(mid));
  const tangentUnit = new Vector(-Math.sin(mid), Math.cos(mid));
  const anchor = loop.origin.add(radial.multi(loop.radius));
  const arrowLength = Math.max(0.35, Math.min(loop.radius * 0.4, 1.0));
  const arrowWidth = arrowLength * 0.8;

  const front = anchor.add(tangentUnit.multi(arrowLength));
  const perp = tangentUnit.rotation(Math.PI / 2).multi(arrowWidth);
  const tail1 = anchor.minus(perp);
  const tail2 = anchor.add(perp);

  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  drawContext.moveTo(front.x, front.y);
  drawContext.lineTo(tail1.x, tail1.y, "normal");
  drawContext.lineTo(tail2.x, tail2.y, "normal");
  drawContext.closePath();
  drawContext.stroke();
}


/**
 * draw point
 */
export function drawPoint(
  drawContext: DrawContext,
  point: Vector,
  exportType: ExportType,
  color: Color = "normal"
) {
  const x = point.x;
  const y = point.y;
  drawContext.beginPath();
  drawContext.setFillColor(color);
  // loggerVer(`drawPoint ${x}_${y}`);
  drawContext.fillRect(x - 1 / 15, y - 1 / 15, 3 / 15, 3 / 15);
  drawContext.closePath();
}

function drawText(
  drawContext: DrawContext,
  str: MyString,
  exportType: ExportType,
  color: Color = "normal"
) {
  const x = str.origin.x;
  const y = str.origin.y;
  drawContext.beginPath();

  drawContext.setFillColor(color);
  drawContext.fillText(str.label, x, y);
  // loggerVer(`drawText ${x}_${y}`);
  drawContext.closePath();
}

// function drawVertex(loop: Vertex) {
//     const scale = config.scale
//     context.beginPath()
//     context.arc(loop.origin.x * scale,
//         loop.origin.y * scale,
//         loop.radius * scale, 0, Math.PI * 2)
//     context.stroke()
//     if (loop.fill) {
//         context.fill()
//     }
//     if (loop.label) {
//         let position = textPosition(loop.label, loop.origin, config)
//         context.fillText(loop.label, position.x * scale, position.y * scale)
//     }

//     if (loop.labels) {
//         loop.labels.forEach((lab) => {
//             const diff = 0.5 + lab.diff
//             let pos = loop.origin.add(new Vector(0, -1).multi(loop.radius + diff).rotation(lab.angle))
//             let position = textPosition(lab.label, pos, config)
//             context.fillText(lab.label, position.x * scale, position.y * scale)
//         })
//     }
// }
