const x: string = "RDFeynmann  So Katagiri"
console.log(x)

let canvas = document.getElementById("canvas") as HTMLCanvasElement
let context_ = canvas.getContext("2d")!

interface Config {
    scale: number
    log: "ON"|"OFF"|"VER"
}

let config: Config = {
    /// lattice size
    scale: 15,
    log: "VER"
}

function loggerVer(text: string) {
    if (config.log == "VER") {
        console.log(text)
    }
}

function loggerOn(text: string) {
    if (config.log == "ON"||config.log == "VER") {
        console.log(text)
    }
}

let elemIDCounter = 0
function getElemID(): string {
    let id = `${elemIDCounter}`
    elemIDCounter++
    return id
}


class DrawContext {
    exportType:ExportType = "canvas"
    private canvasContext: CanvasRenderingContext2D
    private exportString: string = ""
    private coordinate: Vector = new Vector(0, 0)
    private scale: number = config.scale
    constructor(context: CanvasRenderingContext2D) {
        this.canvasContext = context
    }

    output(desc: string, exportType: "html", id: "sub" | "current") {
        if (this.exportType == "canvas") {
            if (id == "sub") {
                let selector = document.querySelector("div#sub") as HTMLElement
                selector.textContent = desc
                return
            }
            if (id == "current") {
                let selector = document.querySelector("div#current") as HTMLElement
                selector.textContent = desc
                return
            }

        }
    }


    setStrokeColor(color: Color) {
        if (this.exportType == "canvas") {
            this.canvasContext.strokeStyle = getColor(color)
            return
        }
    }

    setFillColor(color: Color) {
        if (this.exportType == "canvas") {
            this.canvasContext.fillStyle = getColor(color)
            return
        }
    }


    setExportType(exportType: ExportType) {
        this.exportType = exportType
        if (exportType == "canvas") {
            this.scale = config.scale
        }
        if (exportType == "tikz") {
            this.scale = (config.scale / config.scale)
        }
    }
    

    beginPath() {
        if (this.exportType == "canvas") {
            this.canvasContext.beginPath()
            return
        }
    }

    moveTo(x: number, y: number) {
        this.coordinate = new Vector(x, y)
    }

    closePath() {
        if (this.exportType == "canvas") {
            this.canvasContext.closePath()
            return
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

    addExport(txt: String) {
        this.exportString += txt
    }

    lineTo(x: number, y_: number, linestyle: LineStyle) {
        if (this.exportType == "canvas") {
            let y = y_

            if (linestyle == "dash") {
                this.canvasContext.setLineDash([2,2])
            } else {
                this.canvasContext.setLineDash([])
            }

            this.canvasContext.moveTo(this.coordinate.x * this.scale, this.coordinate.y * this.scale)
            this.canvasContext.lineTo(x * this.scale, y * this.scale)
            return


        }

        if (this.exportType == "tikz") {
            let y = -y_

            if (linestyle == "wave") {
                this.addExport(`\\draw [snake=snake, segment amplitude=0.2mm,segment length=1mm](${this.coordinate.x},${ - this.coordinate.y}) -- (${x},${y});\n`)
                return
            }

            if (linestyle == "dash") {
                this.addExport(`\\draw [dashed](${this.coordinate.x},${- this.coordinate.y}) -- (${x},${y});\n`)
            } else {
                this.addExport(`\\draw (${this.coordinate.x},${- this.coordinate.y}) -- (${x},${y});\n`)
            }
            return
        }
    }

    fill() {

    }

    fillRect(x:number,y_:number,w:number,h:number) {
        if (this.exportType == "canvas") {
            let y = y_
            loggerVer(`fillRect${x} ${y} ${w} ${h}`)
            this.canvasContext.fillRect(x * this.scale, y * this.scale, w * this.scale, h * this.scale)
            return
        }
    }

    clearRect() {
        if (this.exportType == "canvas") {
            this.canvasContext.clearRect(0, 0, canvas.width, canvas.height)
            return
        }
        if (this.exportType == "tikz") {
            this.exportString = ""
        }   
    }



    stroke() {
        if (this.exportType == "canvas") {
            this.canvasContext.stroke()
            return
        }

    }

    fillText(txt: string, x: number, y: number) {
        if (this.exportType == "canvas") {
            this.canvasContext.fillText(txt, x * this.scale, y * this.scale)
            return
        }
        if (this.exportType == "tikz") {
            // \node[align=left] at (19,19) {\tiny $\int dx y^2$};
            this.addExport(`\\node[align=left] at (${x},${-y}) {\\scalebox{0.3} { $${txt}$}};`)
            return
        }
    }

    arc(x: number, y_: number, radius: number, startAngle: number, endAngle: number, loopStyle: LineStyle) {

        if (this.exportType == "canvas") {
            let y = y_
            if (loopStyle == "dash") {
                this.canvasContext.setLineDash([2,2])
            } else {
                this.canvasContext.setLineDash([])
            }
            this.canvasContext.arc(x * this.scale, y * this.scale, radius * this.scale, startAngle, endAngle)
            return
        }

        if (this.exportType == "tikz") {  
            let y = -y_

            let ea = (-startAngle / (2 * Math.PI) * 360)
            let sa = (-endAngle / (2 * Math.PI) * 360)


            for (let n = 0; n < 2; n++) {
                if (sa < 0) {
                    sa += 360
                }
                if (sa > 360) {
                    sa -= 360
                }

                if (ea < 0) {
                    ea += 360
                }
                if (ea > 360) {
                    ea -= 360
                }

                if (sa > ea) {
                    ea += 360
                }
            }

            


            let option = ""
            if (loopStyle == "dash") {
                option = "[dashed]"
            }
            if (loopStyle == "wave") {
                option = `[decorate, decoration={snake, amplitude = 0.2mm, segment length = 1mm}]`
            }

            if ( Math.abs(endAngle - startAngle) ==  2 * Math.PI) {
                this.addExport(`\\draw ${option} (${x},${y}) circle [radius=${radius}];`)
            } else {
                this.addExport(`\\draw ${option} ([shift=(${sa}:${radius})]${x}, ${y}) arc [radius=${radius}, start angle=${sa}, end angle=${ea}];`)
            }
            return
        }
    }

    startExport() {
        if (this.exportType == "tikz") {
            this.addExport("\\newcommand{\\myDiagram}{")
            this.addExport("\\begin{tikzpicture}[scale=0.1, baseline=(current bounding box.center)]\n")
        }
    }

    endExport() {
        if (this.exportType == "tikz") {
            this.addExport("\\end{tikzpicture}\n ")
            this.addExport("}\n ")

            let selector = document.querySelector("div#output") as HTMLElement
            selector.textContent = this.exportString

            loggerVer(this.exportString)
            this.exportString = ""
        }
    }


}





type Shape = "Line" | "Loop" | "Point" | "String" 

type ExportType = "tikz"|"canvas"

interface Elem {
    id:string
    shape: Shape
    formalDistance(point: Vector): number
    move(delta: Vector): void
    copy():Elem
    moveAbsolute(location: Vector): void
    description():string
}



function direction(v1: Vector, v2: Vector): Vector {
    return v1.minus(v2)
}

function textPosition(text: string, position: Vector, config: Config) {
    //TODO
    return position.add(new Vector(-3, +3))// font 仮定

}

function isVector(elem: Elem): elem is Vector {
    return elem.shape == "Point"
}

function isLoop(elem: Elem): elem is Loop {
    return elem.shape == "Loop"
}

function isLine(elem: Elem): elem is Line {
    return elem.shape == "Line"
}

function isString(elem: Elem): elem is MyString {
    return elem.shape == "String"
}


class Vector implements Elem {
    id:string
    shape: Shape = "Point"
    x: number = 0
    y: number = 0
    constructor(x: number, y: number) {
        this.id = getElemID()
        this.x = x
        this.y = y
    }
    add(vec: Vector): Vector {
        return new Vector(this.x + vec.x, this.y + vec.y)
    }
    minus(vec: Vector): Vector {
        return new Vector(this.x - vec.x, this.y - vec.y)
    }
    length(): number {
        return ((this.x) ** 2 + (this.y) ** 2) ** (1 / 2)
    }
    multi(num: number): Vector {
        return new Vector(this.x * num, this.y * num)
    }

    prod(vec: Vector): number {
        return this.x * vec.x + this.y * vec.y
    }

    unit(): Vector {
        return new Vector(this.x * (1 / this.length()), this.y * (1 / this.length()))
    }
    copy(): Vector {
        return new Vector(this.x, this.y)
    }

    rotation(angle: number): Vector {
        return new Vector(this.x * Math.cos(angle) - this.y * Math.sin(angle), this.x * Math.sin(angle) + this.y * Math.cos(angle))
    }

    formalDistance(point: Vector): number {
        let length = this.minus(point).length()
        if (length > 0.3) {
            return Number.MAX_VALUE
        }
        return 0
    }

    move(delta: Vector): void {
        let vector = this.add(delta)
        this.x = vector.x
        this.y = vector.y
    }

    moveAbsolute(location: Vector): void {
        this.x = location.x
        this.y = location.y
    }

    description(): string {
        return `${this.shape} id:${this.id} x:${this.x} y:${this.y}`
    }
}

class MyString implements Elem {
    id:string
    shape: "String" = "String"
    label: string
    origin: Vector = new Vector(0, 0)
    copy(): MyString {
        let str = new MyString(this.label)
        str.origin = this.origin
        return str
    }
    constructor(label: string) {
        this.id = getElemID()
        this.label = label
    }

    move(delta: Vector): void {
        this.origin = this.origin.add(delta)
    }

    moveAbsolute(location: Vector): void {
        this.origin = location
    }

    formalDistance(point: Vector): number {
        return this.origin.minus(point).length()
    }

    description(): string {
        return `${this.shape} id:${this.id} x:${this.origin.x} y:${this.origin.y} label:${this.label}`
    }
}

type LineStyle = "normal" | "dash" | "wave"// 
// wave https://stackoverflow.com/questions/29917446/drawing-sine-wave-in-canvas

class Line implements Elem {
    id:string
    shape: "Line" = "Line"
    label: string = ""
    style: LineStyle = "normal"
    labelDiff: number = 0
    allow: Boolean = true
    origin: Vector = new Vector(0, 0)
    to: Vector = new Vector(0, 0)

    copy(): Line {
        let line = new Line()
        line.label = this.label
        line.style = this.style
        line.labelDiff = line.labelDiff
        line.allow = this.allow
        line.origin = this.origin
        line.to = this.to
        return line
    }

    constructor(label?: string) {
        this.id = getElemID()
        if (label) {
            this.label = label
        }
    }

    rotation(angle:number) {
        let centerOrigin = this.center()
        let unitVec = this.directionUnit()
        let length = this.length()
        let rotatedUnitVec = unitVec.rotation(angle)
        this.origin = centerOrigin.add(rotatedUnitVec.multi(-length / 2))
        this.to = centerOrigin.add(rotatedUnitVec.multi(length / 2))
    }

    move(delta: Vector): void {
        this.origin =  this.origin.add(delta)
        this.to = this.to.add(delta)
    }

    moveAbsolute(location: Vector): void {
        const length = this.length()
        const unitVec = this.directionUnit()
        this.origin = location.add(unitVec.multi(- length / 2))
        this.to = location.add(unitVec.multi( + length / 2))
    }

    length(): number {
        return this.to.minus(this.origin).length()
    }

    toggle() {
        let o = this.origin
        this.origin = this.to
        this.to = o
    }

    direction(): Vector {
        return this.to.minus(this.origin)
    }

    directionUnit(): Vector {
        return this.direction().multi(1 / this.length())
    }

    addLoopOrigin(loop: Loop) {
        loop.origin = this.origin.minus(this.directionUnit().multi(loop.radius))
    }

    addLoopTo(loop: Loop) {
        loop.origin = this.to.add(this.directionUnit().multi(loop.radius))
    }

    between(loop1: Loop, loop2: Loop) {
        this.to = loop1.origin.copy()
        this.origin = loop2.origin.copy()
        loop1.addLineTo(this)
        loop2.addLineOrigin(this)
    }

    center(): Vector {
        return this.origin.add(this.to).multi(1 / 2)
    }

    formalDistance(point: Vector): number {
        let perp_unit = this.directionUnit().rotation(Math.PI / 2)
        let diff = point.minus(this.origin)
        return Math.abs(diff.prod(perp_unit))


        // let toLength = this.to.minus(point).length()
        // let originLength = this.origin.minus(point).length()
        // if (toLength < originLength) {
        //     if (toLength > 2) {
        //         return toLength
        //     }
        //     return toLength + 1
        // }
        // if (originLength > 2) {
        //     return originLength
        // }
        // return originLength + 1

    }

    description(): string {
        return `${this.shape} id:${this.id} (${this.origin.x},${this.origin.y}) -> (${this.to.x}, ${this.to.y}) stayle:${this.style}`
    }

}

interface LabelInfo {
    label: string,
    angle: number
    diff: number
}

class Loop implements Elem {
    id:string
    shape: "Loop" = "Loop"
    style: LineStyle = "normal"
    fill: boolean = false
    origin: Vector = new Vector(0, 0)
    radius: number = 1
    label: string = ""
    labels: LabelInfo[] = []
    loopBeginAngle: number = 0
    loopEndAngle:number = Math.PI*2

    copy(): Loop {
        let loop = new Loop()
        loop.fill = this.fill
        loop.origin = this.origin
        loop.radius = this.radius
        loop.label = this.label
        loop.labels = this.labels
        loop.style = this.style
        loop.loopBeginAngle = this.loopBeginAngle
        loop.loopEndAngle = this.loopEndAngle
        return loop
    }

    constructor(label?: string) {
        this.id = getElemID()
        if (label) {
            this.label = label
        }
    }

    move(delta: Vector): void {
        this.origin =  this.origin.add(delta)
    }

    moveAbsolute(location: Vector): void {
        this.origin = location
    }

    addLineTo(line: Line) {
        line.to = this.origin.add(direction(line.origin, this.origin).unit().multi(this.radius))
    }
    addLineOrigin(line: Line) {
        line.origin = this.origin.add(direction(line.to, this.origin).unit().multi(this.radius))
    }


    formalDistance(point: Vector): number {
        let length = this.origin.minus(point).length()
        if (length < this.radius) {
            return 0
        }
        return Number.MAX_VALUE
    }

    description(): string {
        return `${this.shape} id:${this.id} (${this.origin.x},${this.origin.y}) radius = ${this.radius} angle = (${this.loopBeginAngle * (360 / (2 * Math.PI))}, ${this.loopEndAngle * (360 / (2 * Math.PI))}) stayle:${this.style}`
    }


}

class Vertex extends Loop {
    fill = true
    radius = 0.3
}

function draw(elem: Elem, exportType:ExportType, color: Color = "normal") {
    if (elem.shape == "Line") {
        drawLine(elem as Line, exportType, color)
        return
    }
    if (elem.shape == "Loop") {
        drawLoop(elem as Loop, exportType, color)
        return
    }

    if (elem.shape == "Point") {
        drawPoint(elem as Vector, exportType, color)
        return
    }

    if (elem.shape == "String") {
        drawText(elem as MyString, exportType, color)
        return
    }
}

type Color = "normal" | "select" | "sub"
function getColor(color: Color): string {
    if (color == "normal") {
        return 'rgb(0,0,0)'
    }

    if (color == "select") {
        return 'rgb(255,0,0)'
    }

    if (color == "sub") {
        return 'rgb(0,255,0)'
    }

    return 'rgb(0,0,0)'
}


function drawWaveLine(line: Line, exportType: ExportType, color: Color = "normal") {
    drawContext.beginPath()

    let origin = line.origin
    let lineto = line.to
    let unitVec = line.directionUnit()
    let perpVec = unitVec.rotation(Math.PI / 2)

    drawContext.setStrokeColor(color)
    // context.arc(100, 10, 50, 0, Math.PI * 2)
    let lineSyle:LineStyle = "normal"
    if (line.style == "dash") {
        lineSyle = "dash"
    } 

    drawContext.moveTo(origin.x, origin.y)
    for (let l = 0; l < line.length(); l += 0.1) {
        let x = origin.x + unitVec.x * l + perpVec.x * Math.sin(l*5) * 3/15
        let y = origin.y + unitVec.y * l + perpVec.y * Math.sin(l*5) * 3/15
        loggerVer(`draw ${l} ${x} ${y}`)
        drawContext.lineTo(x, y, lineSyle)
        drawContext.moveTo(x, y)
        drawContext.stroke()
    }

    if (line.allow) {
        drawAllow(line, exportType)
    }
    if (line.label) {
        let diff = 1.0 + line.labelDiff
        let pos = line.center().add(line.directionUnit().rotation(Math.PI / 2).multi(diff))
        let position = textPosition(line.label, pos, config)
        drawContext.fillText(line.label, position.x, position.y)
    }

    drawContext.closePath()
    // drawContext.setLineDash([])
}


function drawLine(line: Line, exportType:ExportType, color: Color = "normal") {
    if (line.style == "wave") {
        ///MARK: not good
        if (exportType == "canvas") {
            drawWaveLine(line, exportType, color)
            return
        }
    }

    drawContext.beginPath()

    drawContext.setStrokeColor(color)
    let linestyle:LineStyle = line.style

    drawContext.moveTo(line.origin.x, line.origin.y)
    drawContext.lineTo(line.to.x, line.to.y, linestyle)
    // context.arc(100, 10, 50, 0, Math.PI * 2)

    drawContext.stroke()
    if (line.allow) {
        drawAllow(line, exportType)
    }
    if (line.label) {
        let diff = 1.0 + line.labelDiff
        let pos = line.center().add(line.directionUnit().rotation(Math.PI / 2).multi(diff))
        let position = textPosition(line.label, pos, config)
        drawContext.fillText(line.label, position.x, position.y)
    }

    drawContext.closePath()
    // drawContext.setLineDash([])
}

function drawAllow(line: Line, exportType: ExportType,  color: Color = "normal") {
    let center = line.center()
    let front = center.add(line.directionUnit().multi(0.4))
    let tail1 = center.minus(line.directionUnit().rotation(Math.PI / 2).multi(0.4))
    let tail2 = center.add(line.directionUnit().rotation(Math.PI / 2).multi(0.4))
    drawContext.beginPath()
    drawContext.setStrokeColor(color)
    drawContext.moveTo(front.x, front.y)
    drawContext.lineTo(tail1.x, tail1.y, "normal")
    drawContext.lineTo(tail2.x, tail2.y, "normal")
    drawContext.closePath()
    // context.arc(100, 10, 50, 0, Math.PI * 2)
    drawContext.fill()
    drawContext.stroke()
}

function drawWaveLoop(loop: Loop, exportType: ExportType, color: Color = "normal") {
    // drawContext.beginPath()

    let origin = loop.origin
    let radius = loop.radius
    let beginAngle = loop.loopBeginAngle
    let endAngle = loop.loopEndAngle

    const segmentNum = 360*(radius/2)
    const segmentAngleWith = (Math.PI * 2) / segmentNum

    const snakeNum = 12
    const amplitude = 0.1 * radius

    if (beginAngle < 0) {
        beginAngle += (Math.PI * 2)
    }
    if (beginAngle > (Math.PI * 2)) {
        beginAngle -= Math.PI * 2
    }

    if (endAngle < 0) {
        endAngle += (Math.PI * 2)
    }
    if (endAngle > (Math.PI * 2)) {
        endAngle -= Math.PI * 2
    }

    if (beginAngle > endAngle) {
        endAngle += Math.PI * 2
        
    }

    
    for (let angle = beginAngle; angle < endAngle; angle = angle + segmentAngleWith) {
        let unitVec = new Vector(1, 0).rotation(angle)
        let unitVec2 = new Vector(1, 0).rotation(angle + segmentAngleWith)
        let snake = amplitude * Math.sin(angle * snakeNum)
        // let perpVec = unitVec.rotation(Math.PI / 2)
        let startPoint = origin.add(unitVec.multi(radius + snake))
        let endPoint = origin.add(unitVec2.multi(radius + snake))
        let line = new Line()
        line.style = "normal"
        line.origin = startPoint
        line.to = endPoint
        line.allow = false
        drawLine(line, exportType, color)
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


function drawLoop(loop: Loop, exportType: ExportType, color: Color = "normal") {

    if (loop.style == "wave") {
        ///MARK: not good
        if (exportType == "canvas") {
            drawWaveLoop(loop, exportType, color)
            return
        }
    }


    drawContext.beginPath()
    drawContext.setStrokeColor(color)
    let lineStyle:LineStyle = "normal"
    if (loop.style == "dash") {
        lineStyle = "dash"
    }
    if (loop.style == "wave") {
        lineStyle = "wave"
    }

    drawContext.arc(loop.origin.x,
        loop.origin.y,
        loop.radius, loop.loopBeginAngle, loop.loopEndAngle, lineStyle)
    drawContext.stroke()
    if (loop.fill) {
        drawContext.fill()
    }
    if (loop.label) {
        let position = textPosition(loop.label, loop.origin, config)
        drawContext.fillText(loop.label, position.x, position.y)
    }

    if (loop.labels) {
        loop.labels.forEach((lab) => {
            const diff = 0.5 + lab.diff
            let pos = loop.origin.add(new Vector(0, -1).multi(loop.radius + diff).rotation(lab.angle))
            let position = textPosition(lab.label, pos, config)
            drawContext.fillText(lab.label, position.x, position.y)
        })
    }

    drawContext.closePath()
    // drawContext.setLineDash([])
}

function drawPoint(point: Vector, exportType: ExportType,  color: Color = "normal") {
    const x = point.x
    const y = point.y 
    drawContext.beginPath()
    drawContext.setFillColor(color)
    loggerVer(`drawPoint ${x}_${y}, ${getColor(color)}`)
    drawContext.fillRect(x - 1/15, y - 1/15, 3/15, 3/15)
    drawContext.closePath()
}

function drawText(str: MyString, exportType: ExportType, color: Color = "normal") {
    const x = str.origin.x
    const y = str.origin.y
    drawContext.beginPath()

    drawContext.setFillColor(color)
    drawContext.fillText(str.label, x, y)
    loggerVer(`drawText ${x}_${y}, ${getColor(color)}`)
    drawContext.closePath()
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

/// example
function drawFourVertex() {
    let exLine1 = new Line()
    let exLine2 = new Line()
    let exLine3 = new Line()
    let exLine4 = new Line()
    let vertex = new Vertex()
    let elems = [exLine1, exLine2, exLine3, exLine4, vertex]

    exLine1.label = "k1"
    exLine2.label = "k2"
    exLine3.label = "k3"
    exLine4.label = "k4"

    exLine1.origin = new Vector(2, 2)
    exLine2.to = new Vector(10, 2)
    exLine3.origin = new Vector(2, 10)
    exLine4.to = new Vector(10, 10)
    vertex.origin = new Vector(6, 6)
    vertex.addLineTo(exLine1)
    vertex.addLineTo(exLine3)
    vertex.addLineOrigin(exLine2)
    vertex.addLineOrigin(exLine4)

    elems.forEach((x) => {
        draw(x, "canvas")
    })
}

/// example
function draw2loop() {
    let exLine1 = new Line("k1")
    let exLine2 = new Line("k2")
    let exLine3 = new Line("k3")
    let exLine4 = new Line("k4")
    let intLine = new Line("w")
    let loop = new Loop()
    let loop2 = new Loop()
    let elems = [exLine1, exLine2, exLine3, exLine4, loop, loop2, intLine]
    exLine1.origin = new Vector(2, 2)
    exLine2.to = new Vector(14, 2)
    exLine3.origin = new Vector(2, 10)
    exLine4.to = new Vector(14, 10)
    loop.origin = new Vector(6, 6)
    loop2.origin = new Vector(10, 6)

    loop.labels = [
        { label: "p1", angle: 0, diff: 0 }
        , { label: "p2", angle: Math.PI, diff: 0 }
        , { label: "p3", angle: Math.PI * 3 / 2, diff: 0.3 }
    ]
    loop2.labels = [
        { label: "q1", angle: 0, diff: 0 }
        , { label: "q2", angle: Math.PI / 2, diff: 0 }
        , { label: "q3", angle: Math.PI, diff: 0 }
    ]

    loop.addLineTo(exLine1)
    loop2.addLineOrigin(exLine2)
    loop.addLineTo(exLine3)
    loop2.addLineOrigin(exLine4)
    intLine.between(loop2, loop)

    elems.forEach((x) => {
        draw(x, "canvas")
    })
}

/// example
function drawloop(n: number) {
    let exLines: Line[] = []
    for (let i = 0; i < 4; i++) {
        exLines.push(new Line("k" + i))
    }
}

/// example
function kakanzuTest() {

    let loop00 = new Loop("A")
    let loop01 = new Loop("B")
    let loop10 = new Loop("C")
    let loop11 = new Loop("D")
    let line1 = new Line()
    let line2 = new Line()
    let line3 = new Line()
    let line4 = new Line()
    let elems = [loop00, loop01, loop10, loop11, line1, line2, line3, line4]


    loop00.origin = new Vector(2, 2)
    loop01.origin = new Vector(2, 10)
    loop10.origin = new Vector(10, 2)
    loop11.origin = new Vector(10, 10)

    line1.between(loop00, loop01)
    line2.between(loop01, loop11)
    line3.between(loop00, loop10)
    line4.between(loop10, loop11)

    elems.forEach((x) => {
        draw(x, "canvas")
    })
}

// kakanzuTest()
// draw2loop() 
// drawFourVertex()

interface RepositoryCommand {
    action(repo: RDRepository): void
}

class SetVertex implements RepositoryCommand {
    vertex: Vector
    copyVertex: Vector
    constructor(vertex: Vector) {
        this.vertex = vertex
        this.copyVertex = vertex.copy()
    }
    action(repo: RDRepository): void {
        repo.setVertex(this.copyVertex)
    }
}

class SetLine implements RepositoryCommand {
    line: Line
    copyLine: Line
    constructor(line: Line) {
        this.line = line
        this.copyLine = line.copy()
    }

    action(repo: RDRepository): void {
        repo.setLine(this.copyLine)
    }
}

class SetString implements RepositoryCommand {
    mystring: MyString
    copyMyString: MyString
    constructor(str: MyString) {
        this.mystring = str
        this.copyMyString = str.copy()
    }

    action(repo: RDRepository): void {
        repo.setMyString(this.copyMyString)
    }
}

class SetLoop implements RepositoryCommand {
    loop: Loop
    copyLoop: Loop
    constructor(loop: Loop) {
        this.loop = loop
        this.copyLoop = loop.copy()
    }

    action(repo: RDRepository): void {
        repo.setLoop(this.copyLoop)
    }
}

class RDRepository {
    vertex = new Map<string, Vector>();
    loop = new Map<string, Loop>();
    vertexList: Vector[] = []
    loopList: Loop[] = []
    lineList: Line[] = []
    currentIndex: number|undefined = undefined
    currentSubIndex: number| undefined = undefined
    elements: Elem[] = []
    selectCount: number = 0
    idCount = 0
    history: RepositoryCommand[] = []

    getElement(id: string): Elem | undefined {
        return this.elements.find((elem) => {
            return elem.id == id
        })
    }

    currentElement(): Elem | undefined {
        // loggerVer("currentElement:length:"+this.elements.length)
        // loggerVer("currentIndex:"+this.currentIndex)

        if (this.currentIndex != undefined && (this.currentIndex < this.elements.length)) {
            return this.elements[this.currentIndex]
        }
        // loggerVer("no currentElement")
        return undefined
    }

    currentSubElement(): Elem | undefined {
        if (this.currentSubIndex != undefined && (this.currentSubIndex < this.elements.length)) {
            return this.elements[this.currentSubIndex]
        }
        return undefined
    }



    getVertex(x: number, y: number): Vector | undefined {
        const vec = this.vertex.get(`${x}_${y}`)
        return vec
    }

    getLoop(x: number, y: number): Loop | undefined {
        const loop = this.loop.get(`${x}_${y}`)
        return loop
    }

    getAllVertex(): Vector[] {
        return this.vertexList
    }

    getAllLoop(): Loop[] {
        return this.loopList
    }

    getAllLine(): Line[] {
        return this.lineList
    }

    getAllElements(): Elem[] {
        return this.elements
    }

    deleteCurrentEelemnt() {
        if (this.currentIndex == undefined) {
            return
        }
        let currentElem = this.currentElement()
        if (!currentElem) {
            return
        }

        let nextCurrentIndex = this.currentIndex - 1
        if (nextCurrentIndex < 0) {
            nextCurrentIndex = 0
        }

        this.elements.splice(this.currentIndex, 1)
        this.currentIndex = nextCurrentIndex
    }

    doCommand(command: RepositoryCommand) {
        this.history.push(command)
        command.action(this)
    }

    setVertex(vertex: Vector) {
        const x = vertex.x
        const y = vertex.y
        if (this.vertex.get(`${x}_${y}`)) {
            this.vertex.delete(`${x}_${y}`)
            this.vertexList = this.vertexList.filter((vec) => {
                return vec.x != vertex.x && vec.y == vertex.y
            })
        }
        this.vertex.set(`${vertex.x}_${vertex.y}`, vertex)
        this.vertexList.push(vertex)
        this.elements.push(vertex)
        const currentIndex = this.currentIndex
        this.currentIndex = this.elements.length - 1
        this.currentSubIndex = currentIndex
        loggerVer("currentIndex"+ this.currentIndex)
    }

    setLoop(loop: Loop) {
        const x = loop.origin.x
        const y = loop.origin.y
        if (this.loop.get(`${x}_${y}`)) {
            this.loop.delete(`${x}_${y}`)
            this.loopList = this.loopList.filter((l) => {
                return l.origin.x != loop.origin.x && l.origin.y == loop.origin.y
            })
        }
        this.loop.set(`${x}_${y}`, loop)
        this.loopList.push(loop)
        this.elements.push(loop)
        this.currentIndex = this.elements.length - 1
    }

    setLine(line: Line) {
        this.lineList.push(line)
        this.elements.push(line)
        this.currentIndex = this.elements.length - 1
    }

    setMyString(str: MyString) {
        this.elements.push(str)
        this.currentIndex = this.elements.length - 1
    }

    nextElem() {
        loggerVer("nextElem")
        if (this.currentIndex == undefined) {
            if (this.elements.length == 0) {
                loggerVer("nextElem return")
                return
            }
            this.currentIndex = -1
        }
        this.currentIndex = this.currentIndex + 1
        if (this.currentIndex >= this.elements.length) {
            this.currentIndex = 0
        }
        loggerVer("currentIndex" + this.currentIndex)
    }

    nextSubElem() {
        if (this.currentSubIndex == undefined) {
            if (this.elements.length == 0) {
                return
            }
            this.currentSubIndex = -1
        }
        this.currentSubIndex = this.currentSubIndex + 1
        if (this.currentSubIndex >= this.elements.length) {
            this.currentSubIndex = 0
        }
    }

    preElem() {
        if (this.currentIndex == undefined) {
            if (this.elements.length == 0) {
                return
            }
            this.currentIndex = +1
        }
        this.currentIndex = this.currentIndex - 1
        if (this.currentIndex < 0) {
            this.currentIndex = (this.elements.length != 0) ? this.elements.length - 1 : 0
        }
    }

    preSubElem() {
        if (this.currentSubIndex == undefined) {
            if (this.elements.length == 0) {
                return
            }
            this.currentSubIndex = +1
        }
        this.currentSubIndex = this.currentSubIndex - 1
        if (this.currentSubIndex < 0) {
            this.currentSubIndex = (this.elements.length != 0) ? this.elements.length - 1 : 0
        }
    }

    select(point: Vector) {

        loggerVer("select")
        this.selectCount++

        if (this.elements.length == 0) {
            return
        }
        let findIndex = 0
        let current = this.currentElement()
        let currentDistance = Number.MAX_VALUE
        for (let index = 0; index < this.elements.length; index++) {
            if (!current) {
                findIndex = index
                current = this.elements[index]
                continue
            }
            let indexElement = this.elements[index]
            let indexDistance = indexElement.formalDistance(point)
            if (indexDistance <= currentDistance && this.currentIndex != index) {
                if (/*this.selectCount <= 1 || this.currentSubIndex != index*/true) {
                    loggerVer(`near:${findIndex}`)
                    findIndex = index
                    current = indexElement
                    currentDistance = indexDistance
                }
            }
        }
        if (currentDistance == Number.MAX_VALUE) {
            this.currentIndex = undefined
            return
        }
        const currenIndex = this.currentIndex
        this.currentIndex = findIndex
        this.currentSubIndex = currenIndex
    }

    subSelect(point: Vector) {
        loggerVer("subSelect")
        this.selectCount = 0
        if (this.elements.length == 0) {
            return
        }
        let findIndex = 0
        let current = this.currentSubElement()
        for (let index = 0; index < this.elements.length; index++) {
            if (!current) {
                findIndex = index
                current = this.elements[index]
                continue
            }
            let indexElement = this.elements[index]
            let indexDistance = indexElement.formalDistance(point)
            let currentDistance = current.formalDistance(point)
            if (indexDistance <= currentDistance && this.currentSubIndex != index) {
                loggerVer(`near:${findIndex}`)
                findIndex = index
                current = indexElement
            }
        }

        this.currentSubIndex = findIndex

    }

    clearSelectMode() {
        this.currentIndex = undefined
        this.currentSubIndex = undefined
    }

    changeSelect() {
        const currentIndex = this.currentIndex
        this.currentIndex = this.currentSubIndex
        this.currentSubIndex = currentIndex
    }

}

class RDDraw {
    repository: RDRepository = new RDRepository()
    canvas: HTMLCanvasElement
    context: CanvasRenderingContext2D
    isClick: boolean = false
    isMouseDown:"Up"|"Down"|"Downning" = "Up"
    clickIimeOutID?: number = undefined
    prevX: number = 0
    prevY: number = 0
    stringMode?: string = undefined
    isNoSelectMode:boolean = false
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.context = canvas.getContext("2d")!
        this.bind()
    }

    bind() {
        canvas.addEventListener("click", (ev) => {
            this.click(ev)
        })
        // canvas.addEventListener("dblclick", (ev) => {
        //     this.dbclick(ev)
        // })

        canvas.addEventListener("mousedown", (ev) => {
            this.mouseDown(ev)
        })
        
        canvas.addEventListener("mouseup", (ev) => {
            this.mouseUp(ev)
        })


        canvas.addEventListener("mousemove", (ev) => {
            this.move(ev)
        })

        document.addEventListener("keypress", (ev) => {
            this.keyPress(ev)
        })
    }

    click(ev: MouseEvent) {

        this.isMouseDown = "Up"

        const scale = config.scale
        const x = Math.floor(this.prevX / scale)
        const y = Math.floor(this.prevY / scale)

        if (this.isClick) {
            this.subSelect(new Vector(x, y))
            this.isClick = false
            if (this.clickIimeOutID) {
                clearTimeout(this.clickIimeOutID)
            }
            return
        }
        this.isClick = true
        this.clickIimeOutID = setTimeout(() => {
            this.isClick = false
            this.clickIimeOutID = undefined
            this.select(new Vector(x, y))
        }, 250)


    }

    // dbclick(ev: MouseEvent) {

    //     const scale = config.scale
    //     const x = Math.floor(this.prevX / scale)
    //     const y = Math.floor(this.prevY / scale)
    //     this.subSelect(new Vector(x, y))
    // }

    mouseDown(ev: MouseEvent) {
        this.isMouseDown = "Downning"
        setTimeout(() => {
            if (this.isMouseDown == "Downning") {
                this.isMouseDown = "Down"
            }
        }, 300);
    }

    mouseUp(ev: MouseEvent) {
        this.isMouseDown = "Up"
    }

    move(ev: MouseEvent) {

        const scale = config.scale

        // context.beginPath()
        // context.fillStyle = 'rgb(255,255,255)'
        // context.fillRect(this.prevX - 1, this.prevY - 1,
        //     3, 3)
        // // context.stroke()
        // context.closePath()  


        // const x = Math.floor(ev.x / scale) * scale
        // const y = Math.floor(ev.y / scale) * scale

        // context.beginPath()
        // context.fillStyle = 'rgb(255,0,0)' 
        // context.fillRect(x-1, y-1,
        //     3, 3)
        // // context.stroke()
        // context.closePath()
        // loggerVer(`move:${ev.x}_${ev.y}`)

        this.prevX = ev.offsetX + config.scale/2
        this.prevY = ev.offsetY + config.scale / 2
        
        // loggerVer("move")
        if (this.isMouseDown == "Down") {
            this.drag(ev)
        }
    }

    keyPress(ev: KeyboardEvent) {
        loggerVer("key:" + ev.key)
        const scale = config.scale
        const x = Math.floor(this.prevX / scale)
        const y = Math.floor(this.prevY / scale)

        // if (this.stringMode != undefined) {

        //     if (ev.key == "/" || ev.key == "Enter") {
        //         // let current = this.repository.currentElement()
        //         // if (current && isLine(current)) {
        //         //     current.label = this.stringMode
        //         //     this.stringMode = undefined
        //         //     loggerVer("stringMode OUT")
        //         //     this.drawAll()
        //         //     return
        //         // }
        //         // if (current && isLoop(current)) {
        //         //     current.label = this.stringMode
        //         //     this.stringMode = undefined
        //         //     loggerVer("stringMode OUT")
        //         //     this.drawAll()
        //         //     return
        //         // }
        //         // let str = new MyString(this.stringMode)
        //         // str.origin = new Vector(x, y)
        //         // this.repository.doCommand(new SetString(str))
        //         this.stringMode = undefined
        //         loggerVer("stringMode OUT")
        //         this.drawAll()
        //         return
        //     }

        //     let elem = this.repository.getElement(this.stringMode)
        //     if (!elem) {
        //         return
        //     }
        //     if (isString(elem)) {
        //         elem.label = elem.label + ev.key 
        //         loggerVer("stringMode:" + elem.label)
        //         this.drawAll()
        //         return
        //     }
        //     return
        // }

        // if (ev.key == "/") {
        //     loggerVer("stringMode In")
        //     let str = new MyString("")
        //     str.origin = new Vector(x, y)
        //     let command = new SetString(str)
        //     this.repository.doCommand(command)
        //     this.stringMode = command.copyMyString.id
        //     return
        // }

        if (ev.ctrlKey && ev.key == "c") {
            this.copy()
            loggerOn("crt + c")
            return
        }

        if (ev.key == "/") {
            this.setString(x, y)
            return
        }

        if (ev.key == "e") {
            this.drawAll("tikz")
            return
        }


        if (ev.key == "v") {
            this.putVertex(new Vector(x, y))
            return
        }
        if (ev.key == "n") {
            this.nextElem()
            return
        }

        if (ev.key == "b") {
            this.preElem()
            return
        }

        if (ev.key == "s") {
            this.nextSubElem()
            return
        }

        if (ev.key == "a") {
            this.preSubElem()
            return
        }

        if (ev.key == "p") {
            this.putLine()
            return
        }

        if (ev.key == "l") {
            this.putLoop(x, y)
            return
        }

        if (ev.key == "r") {
            this.rotation()
            return
        }

        if (ev.key == "R") {
            this.antiRotation()
            return
        }

        if (ev.key == "W") {
            this.changeArcAngle()
            return
        }

        if (ev.key == "X") {
            this.changeArcAngleMinus()
            return
        }

        if (ev.key == "E") {
            this.changeArcEndAngle()
            return
        }

        if (ev.key == "C") {
            this.changeArcEndAngleMinus()
            return
        }

        if (ev.key == "t") {
            this.changeType()
            return
        }

        if (ev.key == "q") {
            this.changeStyle()
            return
        }

        if (ev.key == "d") {
            this.delete()
            return
        }

        if (ev.key == "@") {
            this.allowToggle()
            return
        }


        if (ev.key == "c") {
            this.changeSelect()
            return
        }

        if (ev.key == "z") {
            this.noSelectMode()
            return
        }

        if (ev.key == "8") {
            this.keyUp()
            return
        }

        if (ev.key == "6") {
            this.keyRight()
            return
        }

        if (ev.key == "4") {
            this.keyLeft()
            return
        }

        if (ev.key == "2") {
            this.keyDown()
            return
        }

        if (ev.key == "w") {
            this.changeScale()
            return
        }

        if (ev.key == "x") {
            this.changeScaleDown()
            return
        }
    }

    drag(ev: MouseEvent) {
        loggerVer("drag")
        let current = this.repository.currentElement()
        current?.moveAbsolute(new Vector(this.prevX, this.prevY).multi(1 / config.scale))
        this.drawAll()
    }

    keyUp() {
        loggerVer("keyUp")
        let current = this.repository.currentElement()
        current?.move(new Vector(0, -1).multi(1 / config.scale))
        this.drawAll()
    }

    keyRight() {
        loggerVer("keyRight")
        let current = this.repository.currentElement()
        current?.move(new Vector(1, 0).multi(1/config.scale))
        this.drawAll()
    }

    keyLeft() {
        loggerVer("keyLeft")
        let current = this.repository.currentElement()
        current?.move(new Vector(-1, 0).multi(1 / config.scale))
        this.drawAll()
    }

    keyDown() {
        loggerVer("keyDown")
        let current = this.repository.currentElement()
        current?.move(new Vector(0, 1).multi(1 / config.scale))
        this.drawAll()
    }

    noSelectMode() {
        this.isNoSelectMode = !this.isNoSelectMode
        if (this.isNoSelectMode) {
            this.repository.clearSelectMode()
        }
        this.drawAll()
    }

    nextElem() {
        this.repository.nextElem()
        this.drawAll()
    }

    nextSubElem() {
        this.repository.nextSubElem()
        this.drawAll()
    }

    preElem() {
        this.repository.preElem()
        this.drawAll()
    }

    preSubElem() {
        this.repository.preSubElem()
        this.drawAll()
    }

    setString(x:number, y:number) {
        let current = this.repository.currentElement()
        let defult = ""
        if (current && isString(current)) {
            defult = current.label
        }

        let text = window.prompt("input text( ex. \\int e^x dx)", defult)

        if (text == null) {
            return
        }

        if (current && isString(current)) {
            current.label = text
            this.drawAll()
            return
        }

        let str = new MyString(text)
        str.origin = new Vector(x, y)
        let command = new SetString(str)
        this.repository.doCommand(command)
        this.drawAll()

    }

    putVertex(vertex: Vector) {
        loggerVer("put vertex..")
        this.repository.doCommand(new SetVertex(vertex))
        this.drawAll()
    }

    putLoop(x: number, y: number) {
        loggerVer("put Loop..")
        const loop = new Loop()
        loop.origin = new Vector(x, y)
        this.repository.doCommand(new SetLoop(loop))
        this.drawAll()
    }

    

    drawAll(exportType: ExportType = "canvas") {
        
        drawContext.setExportType(exportType)

        // clear
        drawContext.clearRect()
        drawContext.startExport()

        const elms = this.repository.getAllElements()
        drawContext.beginPath()
        elms.forEach((elm, index) => {
            loggerVer("draw..")
            draw(elm, exportType)
        })

        drawContext.endExport()

        if (this.isNoSelectMode) {
            return
        }

        if (exportType != "canvas") {
            return
        }

        const sub = this.repository.currentSubElement()
        if (sub) {
            draw(sub, "canvas", "sub")
            drawContext.output("sub:   "+sub.description(), "html", "sub")
        }

        const current = this.repository.currentElement()
        if (current) {
            draw(current, "canvas", "select")
            drawContext.output("current:"+current.description(), "html", "current")
        }
        drawContext.closePath()
    }

    putLine() {
        let current = this.repository.currentElement()
        let sub = this.repository.currentSubElement()
        if (!current) {
            return
        }
        if (!sub) {
            return
        }
        if (isVector(current) && isVector(sub)) {
            if (current.x == sub.x && current.y == sub.y) {
                return
            }
            let line = new Line()
            line.origin = sub
            line.to = current
            this.repository.doCommand(new SetLine(line))
            this.repository.select(current)
            this.drawAll()
            return
        }
        if (isLoop(current) && isLoop(sub)) {
            if (current.origin.x == sub.origin.x && current.origin.y == sub.origin.y) {
                return
            }
            let line = new Line()
            line.between(current, sub)
            this.repository.doCommand(new SetLine(line))
            this.drawAll()
            return
        }

        if (isVector(current) && isLoop(sub)) {
            let line = new Line()
            line.origin = current
            sub.addLineTo(line)
            this.repository.doCommand(new SetLine(line))
            this.drawAll()
            return
        }

        if (isLoop(current) && isVector(sub)) {
            let line = new Line()
            line.origin = sub
            current.addLineTo(line)
            this.repository.doCommand(new SetLine(line))
            this.drawAll()
            return
        }

    }

    copy() {
        let elem = this.repository.currentElement()
        if (elem == undefined) {
            return
        }
        let copied = elem.copy()
        copied.move(new Vector(0.1, 0.1))
        if (isLine(copied)) {
            this.repository.doCommand(new SetLine(copied))
            this.drawAll()
            return
        }
        if (isLoop(copied)) {
            this.repository.doCommand(new SetLoop(copied))
            this.drawAll()
            return
        }
        if (isString(copied)) {
            this.repository.doCommand(new SetString(copied))
            this.drawAll()
            return
        }
        if (isVector(copied)) {
            this.repository.doCommand(new SetVertex(copied))
            this.drawAll()
            return
        }
    }

    rotation() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            elem.rotation((2*Math.PI/360))
            this.drawAll()
            return
        }
        if (isLoop(elem)) {
            this.changeArcAngle()
            this.changeArcEndAngle()
            return
        }
    }

    antiRotation() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            elem.rotation(( -2 * Math.PI / 72))
            this.drawAll()
            return
        }
        if (isLoop(elem)) {
            this.changeArcAngleMinus()
            this.changeArcEndAngleMinus()
            return
        }
    }

    allowToggle() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            elem.allow = !elem.allow
            this.drawAll()
            return
        }
        if (isLoop(elem)) {
            return
        }
    }

    changeSelect() {
        this.repository.changeSelect()
        this.drawAll()
        return
    }

    changeType() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            elem.toggle()
            this.drawAll()
            return
        }
        if (isLoop(elem)) {
            return
        }
    }

    changeArcAngle() {
        loggerVer("changeArcAngle..")
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }

        if (isLine(elem)) {
            return
        }

        if (isLoop(elem)) {
            elem.loopBeginAngle = elem.loopBeginAngle + (2*Math.PI)/72
            if (elem.loopBeginAngle >= (2 * Math.PI)) {
                elem.loopBeginAngle = 0
            }
            this.drawAll()
            return
        }
    }

    changeArcAngleMinus() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }

        if (isLine(elem)) {
            return
        }

        if (isLoop(elem)) {
            elem.loopBeginAngle = elem.loopBeginAngle - (2 * Math.PI) / 72
            if (elem.loopBeginAngle < 0) {
                elem.loopBeginAngle = 2 * Math.PI - (2 * Math.PI) / 72
            }
            this.drawAll()
            return
        }
    }

    changeArcEndAngle() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }

        if (isLine(elem)) {
            return
        }

        if (isLoop(elem)) {
            elem.loopEndAngle = elem.loopEndAngle + (2 * Math.PI) / 72
            if (elem.loopEndAngle >= (2 * Math.PI)) {
                elem.loopEndAngle = 0
            }
            this.drawAll()
            return
        }
    }

    changeArcEndAngleMinus() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }

        if (isLine(elem)) {
            return
        }

        if (isLoop(elem)) {
            elem.loopEndAngle = elem.loopEndAngle - (2 * Math.PI) / 72
            if (elem.loopEndAngle < 0) {
                elem.loopEndAngle = 2 * Math.PI - (2 * Math.PI) / 72
            }
            this.drawAll()
            return
        }
    }


    changeScale() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            elem.to = elem.to.add(elem.directionUnit())
            this.drawAll()
            return
        }
        if (isLoop(elem)) {
            elem.radius = elem.radius + 1
            this.drawAll()
            return
        }
    }

    changeScaleDown() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            elem.to = elem.to.add(elem.directionUnit().multi(-1))
            this.drawAll()
            return
        }
        if (isLoop(elem)) {
            elem.radius = elem.radius - 1
            if (elem.radius < 1) {
                elem.radius = 1
            }
            this.drawAll()
            return
        }
    }

    changeStyle() {
        let elem = this.repository.currentElement()
        if (!elem) {
            return
        }
        if (isVector(elem)) {
            return
        }
        if (isLine(elem)) {
            if (elem.style == "normal") {
                elem.style = "dash"
                this.drawAll()
                return
            }
            if (elem.style == "dash") {
                elem.style = "wave"
                this.drawAll()
                return
            }
            if (elem.style == "wave") {
                elem.style = "normal"
                this.drawAll()
                return
            }
            this.drawAll()
            return

        }
        if (isLoop(elem)) {
            if (elem.style == "normal") {
                elem.style = "dash"
                this.drawAll()
                return
            }
            if (elem.style == "dash") {
                elem.style = "wave"
                this.drawAll()
                return
            }
            if (elem.style == "wave") {
                elem.style = "normal"
                this.drawAll()
                return
            }

            this.drawAll()
            return

        }
    }

    delete() {
        this.repository.deleteCurrentEelemnt()
        this.drawAll()
    }

    select(point: Vector) {
        this.repository.select(point)
        this.drawAll()
    }

    subSelect(point: Vector) {
        this.repository.subSelect(point)
        this.drawAll()
    }
}

const h = new RDDraw(canvas)
let drawContext = new DrawContext(context_)

