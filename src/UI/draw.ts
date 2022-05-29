import { config } from "../Config";
import { Color } from "../Core/Color";
import { Elem } from "../Core/Elem";
import { Line, LineStyle } from "../Core/Line";
import { Loop } from "../Core/Loop";
import { MyString } from "../Core/MyString";
import { textPosition } from "../Core/TextPosition";
import { Vector } from "../Core/Vector";
import { loggerVer } from "../looger";
import { DrawContext } from "./DrawContext";
import { ExportType } from "./ExportType";
import { getColor } from "./UIColor";

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
}

export function drawWaveLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  drawContext.beginPath();

  let origin = line.origin;
  let lineto = line.to;
  let unitVec = line.directionUnit();
  let perpVec = unitVec.rotation(Math.PI / 2);

  drawContext.setStrokeColor(color);
  // context.arc(100, 10, 50, 0, Math.PI * 2)
  let lineSyle: LineStyle = "normal";
  if (line.style == "dash") {
    lineSyle = "dash";
  }

  drawContext.moveTo(origin.x, origin.y);
  for (let l = 0; l < line.length(); l += 0.1) {
    let x = origin.x + unitVec.x * l + (perpVec.x * Math.sin(l * 5) * 3) / 15;
    let y = origin.y + unitVec.y * l + (perpVec.y * Math.sin(l * 5) * 3) / 15;
    loggerVer(`draw ${l} ${x} ${y}`);
    drawContext.lineTo(x, y, lineSyle);
    drawContext.moveTo(x, y);
    drawContext.stroke();
  }

  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    let pos = line.center().add(
      line
        .directionUnit()
        .rotation(Math.PI / 2)
        .multi(diff)
    );
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
  // drawContext.setLineDash([])
}

export function drawCoilLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  drawContext.setStrokeColor(color);
  let lineStyle: LineStyle = "normal";
  if (line.style == "dash") {
    lineStyle = "dash";
  }

  let pathLength: number = line.length();

  // 経路とその接線ベクトルの媒介変数表示
  // 要素の種類によって決まる関数
  let x: (s: number) => number;
  let y: (s: number) => number;
  let dx: (s: number) => number;
  let dy: (s: number) => number;
  {
    x = (s) => {
      return line.origin.x + ((line.to.x - line.origin.x) * s) / pathLength;
    };
    y = (s) => {
      return line.origin.y + ((line.to.y - line.origin.y) * s) / pathLength;
    };
    dx = (s) => {
      return line.directionUnit().x;
    };
    dy = (s) => {
      return line.directionUnit().y;
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
      let n = Math.floor(pathLength / segmentLength);

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
      drawContext.lineTo(x, y, lineStyle);
      drawContext.moveTo(x, y);
    }
    (x = f(end)), (y = g(end));
    drawContext.lineTo(x, y, lineStyle);
  }
  drawContext.stroke();
  drawContext.closePath();

  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    let pos = line.center().add(
      line
        .directionUnit()
        .rotation(Math.PI / 2)
        .multi(diff)
    );
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
  // drawContext.setLineDash([])
}

export function drawLine(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  if (line.style == "wave") {
    ///MARK: not good
    if (exportType == "canvas") {
      drawWaveLine(drawContext, line, exportType, color);
      return;
    }
  }

  if (line.style == "coil") {
    ///MARK: not good
    if (exportType == "canvas") {
      drawCoilLine(drawContext, line, exportType, color);
      return;
    }
  }

  drawContext.beginPath();

  drawContext.setStrokeColor(color);
  let linestyle: LineStyle = line.style;

  drawContext.moveTo(line.origin.x, line.origin.y);
  drawContext.lineTo(line.to.x, line.to.y, linestyle);
  // context.arc(100, 10, 50, 0, Math.PI * 2)

  drawContext.stroke();
  if (line.allow) {
    drawAllow(drawContext, line, exportType);
  }
  if (line.label) {
    let diff = 1.0 + line.labelDiff;
    let pos = line.center().add(
      line
        .directionUnit()
        .rotation(Math.PI / 2)
        .multi(diff)
    );
    let position = textPosition(line.label, pos, config);
    drawContext.fillText(line.label, position.x, position.y);
  }

  drawContext.closePath();
  // drawContext.setLineDash([])
}

export function drawAllow(
  drawContext: DrawContext,
  line: Line,
  exportType: ExportType,
  color: Color = "normal"
) {
  let center = line.center();
  let front = center.add(line.directionUnit().multi(0.4));
  let tail1 = center.minus(
    line
      .directionUnit()
      .rotation(Math.PI / 2)
      .multi(0.4)
  );
  let tail2 = center.add(
    line
      .directionUnit()
      .rotation(Math.PI / 2)
      .multi(0.4)
  );
  drawContext.beginPath();
  drawContext.setStrokeColor(color);
  drawContext.moveTo(front.x, front.y);
  drawContext.lineTo(tail1.x, tail1.y, "normal");
  drawContext.lineTo(tail2.x, tail2.y, "normal");
  drawContext.closePath();
  // context.arc(100, 10, 50, 0, Math.PI * 2)
  drawContext.stroke();
}

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

export function drawLoop(
  drawContext: DrawContext,
  loop: Loop,
  exportType: ExportType,
  color: Color = "normal"
) {
  if (loop.style == "wave") {
    ///MARK: not good
    if (exportType == "canvas") {
      drawWaveLoop(drawContext, loop, exportType, color);
      return;
    }
  }

  if (loop.style == "coil") {
    ///MARK: not good
    if (exportType == "canvas") {
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
  loggerVer(`drawPoint ${x}_${y}, ${getColor(color)}`);
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
  loggerVer(`drawText ${x}_${y}, ${getColor(color)}`);
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
