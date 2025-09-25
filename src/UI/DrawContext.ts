import { config } from "../Config";
import { Color } from "../Core/Color";
import { LineStyle } from "../Core/Line";
import { Vector } from "../Core/Vector";
import { loggerVer } from "../looger";
import { ExportType } from "./ExportType";
import { getColor } from "./UIColor";

/**
 * DrawContext
 * 
 * This class is used to draw on canvas. 
 */
export class DrawContext {
  exportType: ExportType = "canvas";
  private canvasContext: CanvasRenderingContext2D;
  private exportString: string = "";
  private coordinate: Vector = new Vector(0, 0);
  private scale: number = config.scale;
  constructor(context: CanvasRenderingContext2D) {
    this.canvasContext = context;
    this.canvasContext.font = "25px Arial";
  }

  /**
   * output is used to output the result of drawing.
   */
  output(desc: string, exportType: "html", id: "sub" | "current" | "mode") {
    if (this.exportType == "canvas") {
      if (id == "sub") {
        let selector = document.querySelector("div#sub") as HTMLElement;
        selector.textContent = desc;
        return;
      }
      if (id == "current") {
        let selector = document.querySelector("div#current") as HTMLElement;
        selector.textContent = desc;
        return;
      }
      if (id == "mode") {
        let selector = document.querySelector("div#mode") as HTMLElement;
        selector.textContent = desc;
        return;
      }
    }
  }

  /**
   * set the color of stroke.
   */
  setStrokeColor(color: Color) {
    if (this.exportType == "canvas") {
      this.canvasContext.strokeStyle = getColor(color);
      return;
    }
  }

  /**
   * set the color of fill.
   */
  setFillColor(color: Color) {
    if (this.exportType == "canvas") {
      this.canvasContext.fillStyle = getColor(color);
      return;
    }
  }

  /**
   * set export type.
   */
  setExportType(exportType: ExportType) {
    this.exportType = exportType;
    if (exportType == "canvas") {
      this.scale = config.scale;
    }
    if (exportType == "tikz") {
      this.scale = config.scale / config.scale;
    }
    if (exportType == "svg") {
      this.scale = config.scale;
    }
  }

  /**
   * begin path.
   */
  beginPath() {
    if (this.exportType == "canvas") {
      this.canvasContext.beginPath();
      return;
    }
  }

  /**
   * move to a point.
   */
  moveTo(x: number, y: number) {
    this.coordinate = new Vector(x, y);
  }

  /**
   * close path.
   */
  closePath() {
    if (this.exportType == "canvas") {
      this.canvasContext.closePath();
      return;
    }
  }

  // setLineDash(style: LineStyle) {
  //     loggerVer("setLineDash:" + style)
  //     this.lineDashStyle = style
  // }

  // setLoopDash(style: LineStyle) {
  //     loggerVer("setLoopDash:" + style)
  //     this.loopDashStyle = style
  // }

  /**
   * add string for export.
   */
  addExport(txt: String) {
    this.exportString += txt;
  }

  /**
   * set line into point (x,y).
   */
  lineTo(x: number, y_: number, linestyle: LineStyle) {
    if (this.exportType == "canvas") {
      let y = y_;

      if (linestyle == "dash") {
        this.canvasContext.setLineDash([2, 2]);
      } else {
        this.canvasContext.setLineDash([]);
      }

      this.canvasContext.moveTo(
        this.coordinate.x * this.scale,
        this.coordinate.y * this.scale
      );
      this.canvasContext.lineTo(x * this.scale, y * this.scale);
      return;
    }

    if (this.exportType == "tikz") {
      let y = -y_;

      if (linestyle == "wave") {
        this.addExport(
          `\\draw [snake=snake, segment amplitude=0.2mm,segment length=1mm](${
            this.coordinate.x
          },${-this.coordinate.y}) -- (${x},${y});\n`
        );
        return;
      }

      if (linestyle == "coil") {
        // コイル線のパラメータ
        const segmentLength: number = 1.0;
        const aspect: number = 0.9;
        const amplitude: number = 0.5;

        let from: Vector, to: Vector;
        let pathLength: number;

        from = new Vector(this.coordinate.x, -this.coordinate.y);
        to = new Vector(x, -y_);
        pathLength = to.minus(from).length();

        // 経路の長さが1波長(segmentLength)よりも短い場合、線の装飾をしない。
        if (pathLength < segmentLength) {
          this.addExport(`\\draw(${from.x},${from.y}) -- (${to.x},${to.y});\n`);
        } else {
          let n: number;
          let coilNTimesLength: number;
          let effectiveSegmentLength: number;

          n = Math.floor(pathLength / segmentLength);
          coilNTimesLength =
            2 * aspect * amplitude + (n - 1 / 2) * segmentLength;
          effectiveSegmentLength =
            segmentLength + (pathLength - coilNTimesLength) / (n - 1 / 2);

          this.addExport(
            `\\draw[decorate, decoration={coil,` +
              `amplitude = ${amplitude}mm,` +
              `segment length = ${effectiveSegmentLength}mm,` +
              `aspect = ${aspect}` +
              `}]` +
              `(${from.x},${from.y}) -- (${to.x},${to.y});\n`
          );
        }
        return;
      }

      if (linestyle == "dash") {
        this.addExport(
          `\\draw [dashed](${this.coordinate.x},${-this.coordinate
            .y}) -- (${x},${y});\n`
        );
      } else {
        this.addExport(
          `\\draw (${this.coordinate.x},${-this.coordinate
            .y}) -- (${x},${y});\n`
        );
      }
      return;
    }

    if (this.exportType === "svg") {
      let dash = "";
      if (linestyle === "dash") {
        dash = 'stroke-dasharray="4"';
      }
      this.addExport(
        `<line x1="${this.coordinate.x * this.scale}" y1="${
          this.coordinate.y * this.scale
        }" x2="${x * this.scale}" y2="${
          y_ * this.scale
        }" stroke="black" ${dash}/>`
      );
      return;
    }
  }

  // fill() {
  //     if (this.exportType == "canvas") {
  //         this.canvasContext.fill()
  //         return
  //     }
  // }

  /**
   * fill rectangle.
   */
  fillRect(x: number, y_: number, w: number, h: number) {
    if (this.exportType == "canvas") {
      let y = y_;
      // loggerVer(`fillRect${x} ${y} ${w} ${h}`);
      this.canvasContext.fillRect(
        x * this.scale,
        y * this.scale,
        w * this.scale,
        h * this.scale
      );
      return;
    }
  }

  /**
   * clear rectangle.
   */
  clearRect() {
    if (this.exportType == "canvas") {
      this.canvasContext.clearRect(
        0,
        0,
        this.canvasContext.canvas.width,
        this.canvasContext.canvas.height
      );
      return;
    }
    if (this.exportType == "tikz") {
      this.exportString = "";
    }
    if (this.exportType == "svg") {
      this.exportString = "";
    }
  }

  /**
   * stroke.
   */
  stroke() {
    if (this.exportType == "canvas") {
      this.canvasContext.stroke();
      return;
    }
  }

  /**
   * fill text
   */
  fillText(txt: string, x: number, y: number) {
    if (this.exportType == "canvas") {
      this.canvasContext.fillText(txt, x * this.scale, y * this.scale);
      return;
    }
    if (this.exportType == "tikz") {
      // \node[align=left] at (19,19) {\tiny $\int dx y^2$};
      this.addExport(
        `\\node[align=left] at (${x},${-y}) {\\scalebox{0.3} { $${txt}$}};`
      );
      return;
    }
    if (this.exportType == "svg") {
      this.addExport(
        `<text x="${x * this.scale}" y="${
          y * this.scale
        }" font-family="Verdana" font-size="35">
        ${txt}</text>`
      );
      return;
    }
  }

  /**
   * draw arc
   */
  arc(
    x: number,
    y_: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    loopStyle: LineStyle,
    fill: boolean
  ) {
    if (this.exportType == "canvas") {
      let y = y_;
      if (loopStyle == "dash") {
        this.canvasContext.setLineDash([2, 2]);
      } else {
        this.canvasContext.setLineDash([]);
      }
      this.canvasContext.arc(
        x * this.scale,
        y * this.scale,
        radius * this.scale,
        startAngle,
        endAngle
      );
      if (fill) {
        this.canvasContext.fill();
      }
      return;
    }

    if (this.exportType == "tikz") {
      let y = -y_;

      let ea = (-startAngle / (2 * Math.PI)) * 360;
      let sa = (-endAngle / (2 * Math.PI)) * 360;

      for (let n = 0; n < 2; n++) {
        if (sa < 0) {
          sa += 360;
        }
        if (sa > 360) {
          sa -= 360;
        }

        if (ea < 0) {
          ea += 360;
        }
        if (ea > 360) {
          ea -= 360;
        }

        if (sa > ea) {
          ea += 360;
        }
      }

      let option = "";
      if (loopStyle == "dash") {
        option = "[dashed]";
      }
      if (loopStyle == "wave") {
        option = `[decorate, decoration={snake, amplitude = 0.2mm, segment length = 1mm}]`;
      }
      if (loopStyle == "coil") {
        // コイル線のパラメータ
        const segmentLength: number = 1.0;
        const aspect: number = 0.9;
        const amplitude: number = 0.5;

        let pathLength: number;

        pathLength = radius * (endAngle - startAngle);

        // 経路の長さが1波長(segmentLength)よりも短い場合、線の装飾をしない。
        if (pathLength < segmentLength) {
          option = ``;
        } else {
          let n: number;
          let effectiveSegmentLength: number;
          let coilNTimesLength: number;

          n = Math.floor(pathLength / segmentLength);
          coilNTimesLength =
            2 * aspect * amplitude + (n - 1 / 2) * segmentLength;
          effectiveSegmentLength =
            segmentLength + (pathLength - coilNTimesLength) / (n - 1 / 2);
          option =
            `[decorate, decoration={coil,` +
            `amplitude = ${amplitude}mm,` +
            `segment length = ${effectiveSegmentLength}mm,` +
            `aspect = ${aspect}` +
            `}]`;
        }
      }

      let command = `\\draw`;
      if (fill) {
        command = `\\fill`;
      }

      if (Math.abs(endAngle - startAngle) == 2 * Math.PI) {
        this.addExport(
          `${command} ${option} (${x},${y}) circle [radius=${radius}];`
        );
      } else {
        this.addExport(
          `${command} ${option} ([shift=(${sa}:${radius})]${x}, ${y}) arc [radius=${radius}, start angle=${sa}, end angle=${ea}];`
        );
      }
      return;
    }

    if (this.exportType == "svg") {
      let y = y_;
      let dash = "";
      if (loopStyle == "dash") {
        dash = 'stroke-dasharray="4"';
      }

      if (Math.abs(startAngle - endAngle) <= (Math.PI / 1) * 360) {
        let fillStr = `fill="none"`;
        if (fill) {
          fillStr = `fill="black"`;
        }
        this.addExport(
          `<circle cx="${x * this.scale}" cy="${y * this.scale}" r="${
            radius * this.scale
          }" stroke="black" ${dash} ${fillStr}/>`
        );
        return;
      }
      // TODO cole, wave
      const sx = x + radius * Math.cos(startAngle);
      const sy = y + radius * Math.sin(startAngle);
      const ex = x + radius * Math.cos(endAngle);
      const ey = y + radius * Math.sin(endAngle);
      const angle = (360 * (endAngle - startAngle)) / (2 * Math.PI);
      let lx = 0;
      let ly = 0;
      if (angle > 0) {
        ly = 1;
      }
      this.addExport(
        `<path d="M ${sx * this.scale}, ${sy * this.scale} A ${
          radius * this.scale
        } ${radius * this.scale} ${angle} ${lx} ${ly} ${ex * this.scale}, ${
          ey * this.scale
        }" stroke="black" ${dash} fill="none"/>`
      );
    }
  }

  startExport() {
    if (this.exportType == "tikz") {
      this.addExport("\\newcommand{\\myDiagram}{");
      this.addExport(
        "\\begin{tikzpicture}[scale=0.1, baseline=(current bounding box.center)]\n"
      );
      return;
    }
    if (this.exportType == "svg") {
      this.addExport(
        `<svg viewBox="0 0 ${50 * this.scale} ${50 * this.scale}">`
      );
    }
    return;
  }

  /**
   * return export string
   */
  endExport(): string {
    if (this.exportType == "tikz") {
      this.addExport("\\end{tikzpicture}\n ");
      this.addExport("}\n ");

      let selector = document.querySelector("div#output-tikz") as HTMLElement;
      selector.textContent = this.exportString;

      const ret = this.exportString;
      loggerVer(this.exportString);
      this.exportString = "";
      return ret;
    }
    if (this.exportType == "svg") {
      this.addExport(`</svg>`);

      let selector = document.querySelector("div#output-svg") as HTMLElement;
      selector.textContent = this.exportString;
      this.fildDownload(this.exportString);

      const ret = this.exportString;
      loggerVer(this.exportString);
      this.exportString = "";
      return ret;
    }
    return "";
  }

  /**
   *  save data
   */
  insertsavedata(saveData: string) {
    if (this.exportType == "svg") {
      this.addExport(`<!-- QuantumSketchSaveDataStart@${saveData}@ -->`)
    }
  }

  /**
   * file download
   */
  fildDownload(content: string) {
    const blob = new Blob([content], { type: "text/plain" });

    let link = document.getElementById("download") as
      | HTMLAnchorElement
      | undefined;
    if (link) {
      link.href = window.URL.createObjectURL(blob);
      const dateStr = new Date().toISOString();
      const fileName = `${dateStr}.svg`;
      link.download = fileName;
      link.hidden = false;
    }
  }
}
