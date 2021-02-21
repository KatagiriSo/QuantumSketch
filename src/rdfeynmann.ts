const x: string = "hello typescript"
console.log(x)

let canvas = document.getElementById("canvas") as HTMLCanvasElement
let context = canvas.getContext("2d")!

interface Config {
    scale: number
}

type Shape = "Line" | "Loop" |"Point" | "String"

interface Elem {
    shape: Shape
    formalDistance(point:Vector):number
}

let config: Config = {
    /// lattice size
    scale:15
}

function direction(v1: Vector, v2: Vector): Vector {
    return v1.minus(v2)
}

function textPosition(text: string, position: Vector, config:Config) {
    //TODO
    let scale = config.scale
    return position.add(new Vector(-3 / scale, +3 / scale))// font 仮定

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

class Vector implements Elem {
    shape: Shape = "Point"
    x: number = 0
    y: number = 0
    constructor(x: number, y: number) {
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
        return ((this.x)**2 + (this.y)**2)**(1/2)
    }
    multi(num: number): Vector {
        return new Vector(this.x * num, this.y * num)
    }
    unit(): Vector {
        return new Vector(this.x * (1/this.length()), this.y * (1/this.length()))
    }
    copy(): Vector {
        return new Vector(this.x, this.y)
    }

    rotation(angle: number): Vector {
        return new Vector(this.x * Math.cos(angle) - this.y * Math.sin(angle), this.x * Math.sin(angle) + this.y * Math.cos(angle))
    }

    formalDistance(point:Vector): number {
        return this.minus(point).length()
    }
}

class MyString implements Elem {
    shape: "String" = "String"
    label: string
    origin: Vector = new Vector(0, 0)
    copy(): MyString {
        let str = new MyString(this.label)
        str.origin = this.origin
        return str
    }
    constructor(label:string) {
        this.label = label
    }

    formalDistance(point: Vector): number {
        return this.origin.minus(point).length()
    }
}

type LineStyle = "normal" | "dash" | "wave"// waveはtodo
// wave https://stackoverflow.com/questions/29917446/drawing-sine-wave-in-canvas

class Line implements Elem {
    shape: "Line" = "Line"
    label: string = ""
    style: LineStyle = "normal"
    labelDiff: number = 0
    allow:Boolean = true
    origin: Vector = new Vector(0,0)
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
        if (label) {
            this.label = label
        }
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
        return this.direction().multi(1/this.length())
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
        return this.origin.add(this.to).multi(1/2)
    }

    formalDistance(point:Vector): number {
        let toLength = this.to.minus(point).length()
        let originLength = this.origin.minus(point).length()
        if (toLength < originLength) {
            if (toLength > 2) {
                return toLength
            }
            return toLength + 1
        }
        if (originLength > 2) {
            return originLength
        }
        return originLength + 1

    }
}

interface LabelInfo {
    label: string,
    angle: number
    diff: number
}

class Loop implements Elem {
    shape: "Loop" = "Loop"
    style: LineStyle = "normal"
    fill: boolean = false
    origin: Vector = new Vector(0, 0)
    radius: number = 1
    label: string = ""
    labels: LabelInfo[] = []

    copy():Loop {
        let loop = new Loop()
        loop.fill = this.fill
        loop.origin = this.origin
        loop.radius = this.radius
        loop.label = this.label
        loop.labels = this.labels
        loop.style = this.style
        return loop
    }

    constructor(label?: string) {
        if (label) {
            this.label = label
        }
    }

    addLineTo(line: Line) {
        line.to = this.origin.add(direction(line.origin, this.origin).unit().multi(this.radius))
    }
    addLineOrigin(line: Line) {
        line.origin = this.origin.add(direction(line.to, this.origin).unit().multi(this.radius))
    }


    formalDistance(point: Vector): number {
        return this.origin.minus(point).length()
    }

}

class Vertex extends Loop {
    fill = true
    radius = 0.3
}

function draw(elem: Elem, color:Color = "normal") {
    if (elem.shape == "Line") {
        drawLine(elem as Line, color)
        return
    }
    if (elem.shape == "Loop") {
        drawLoop(elem as Loop, color)
        return
    }

    if (elem.shape == "Point") {
        drawPoint(elem as Vector, color)
        return
    }

    if (elem.shape == "String") {
        drawText(elem as MyString, color)
        return
    }
}

type Color = "normal" | "select" | "sub"
function getColor(color: Color) : string {
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


function drawLine(line: Line, color:Color = "normal") {
    const scale = config.scale
    context.beginPath()
    context.moveTo(line.origin.x * scale, line.origin.y*scale)
    context.lineTo(line.to.x*scale, line.to.y*scale)
    // context.arc(100, 10, 50, 0, Math.PI * 2)
    context.strokeStyle = getColor(color)
    if (line.style == "dash") {
        context.setLineDash([2,2])
    } else {
        context.setLineDash([])
    }
    context.stroke() 
    if (line.allow) {
        drawAllow(line)
    }
    if (line.label) {
        let diff = 1.0 + line.labelDiff
        let pos = line.center().add(line.directionUnit().rotation(Math.PI/2).multi(diff))
        let position = textPosition(line.label, pos, config)
        context.fillText(line.label, position.x * scale, position.y * scale)
    }
}

function drawAllow(line: Line, color: Color = "normal") {
    const scale = config.scale
    let center = line.center()
    let front = center.add(line.directionUnit().multi(0.4))
    let tail1 = center.minus(line.directionUnit().rotation(Math.PI/2).multi(0.4))
    let tail2 = center.add(line.directionUnit().rotation(Math.PI/2).multi(0.4))
    context.beginPath()
    context.strokeStyle = getColor(color)
    context.moveTo(front.x * scale, front.y * scale)
    context.lineTo(tail1.x * scale, tail1.y * scale)
    context.lineTo(tail2.x * scale, tail2.y * scale)
    context.closePath()
    // context.arc(100, 10, 50, 0, Math.PI * 2)
    context.fill()
    context.stroke() 
}

function drawLoop(loop: Loop, color: Color = "normal") {
    const scale = config.scale
    context.beginPath()
    context.strokeStyle = getColor(color)
    if (loop.style == "dash") {
        context.setLineDash([2, 2])
    } else {
        context.setLineDash([])
    }
    context.arc(loop.origin.x * scale,
        loop.origin.y * scale,
        loop.radius * scale, 0, Math.PI * 2)
    context.stroke()
    if (loop.fill) {
        context.fill()
    }
    if (loop.label) {
        let position = textPosition(loop.label, loop.origin, config)
        context.fillText(loop.label, position.x * scale, position.y * scale)
    }

    if (loop.labels) {
        loop.labels.forEach((lab) => {
            const diff = 0.5 + lab.diff
            let pos = loop.origin.add(new Vector(0, -1).multi(loop.radius+diff).rotation(lab.angle))
            let position = textPosition(lab.label, pos, config)
            context.fillText(lab.label, position.x * scale, position.y * scale)
        }) 
    }
}

function drawPoint(point: Vector, color: Color = "normal") {
    const scale = config.scale
    const x = point.x * scale
    const y = point.y * scale
    context.beginPath()
    context.fillStyle = getColor(color)
    console.log(`drawPoint ${x}_${y}, ${getColor(color)}`)
    context.fillRect(x - 1, y - 1, 3, 3)
    context.closePath()
}

function drawText(str: MyString, color: Color = "normal") {
    const scale = config.scale
    const x = str.origin.x * scale
    const y = str.origin.y * scale
    context.beginPath()
    context.fillStyle = getColor(color)
    context.fillText(str.label, x, y)
    console.log(`drawText ${x}_${y}, ${getColor(color)}`)
    context.closePath()
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
        draw(x)
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
        , { label: "p3", angle: Math.PI*3/2, diff: 0.3 }
    ]
    loop2.labels = [
        { label: "q1", angle: 0 , diff : 0}
        , { label: "q2", angle: Math.PI / 2, diff: 0}
        , { label: "q3", angle: Math.PI, diff: 0}
    ]

    loop.addLineTo(exLine1)
    loop2.addLineOrigin(exLine2)
    loop.addLineTo(exLine3)
    loop2.addLineOrigin(exLine4)
    intLine.between(loop2, loop)

    elems.forEach((x) => {
        draw(x)
    })
}

/// example
function drawloop(n: number) {
    let exLines: Line[] = []
    for (let i = 0; i < 4; i++) {
        exLines.push(new Line("k"+i))
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
        draw(x)
    })
}

// kakanzuTest()
// draw2loop() 
// drawFourVertex()

interface RepositoryCommand {
    action(repo:RDRepository):void
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
    currentIndex: number = 0
    currentSubIndex: number = 0
    elements: Elem[] = [] 
    selectCount:number = 0

    history:RepositoryCommand[] = []

    currentElement(): Elem | undefined {
        if (this.currentIndex < this.elements.length) {
            return this.elements[this.currentIndex]
        }
        return undefined
    }

    currentSubElement(): Elem | undefined {
        if (this.currentSubIndex < this.elements.length) {
            return this.elements[this.currentSubIndex]
        }
        return undefined
    }



    getVertex(x: number, y: number): Vector|undefined {
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
        this.currentIndex = this.elements.length -1
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
        this.currentIndex = this.elements.length -1
    }

    nextElem() {
        this.currentIndex = this.currentIndex + 1
        if (this.currentIndex >= this.elements.length) {
            this.currentIndex = 0
        }
    }

    nextSubElem() {
        this.currentSubIndex = this.currentSubIndex + 1
        if (this.currentSubIndex >= this.elements.length) {
            this.currentSubIndex = 0
        }
    }

    preElem() {
        this.currentIndex = this.currentIndex - 1
        if (this.currentIndex < 0) {
            this.currentIndex = (this.elements.length != 0) ? this.elements.length - 1 : 0
        }
    }

    preSubElem() {
        this.currentSubIndex = this.currentSubIndex - 1
        if (this.currentSubIndex < 0) {
            this.currentSubIndex = (this.elements.length != 0) ? this.elements.length - 1 : 0
        }
    }

    select(point: Vector) {

        console.log("select")
        this.selectCount++

        if (this.elements.length == 0) {
            return
        }
        let findIndex = 0
        let current = this.currentElement()
        for (let index = 0; index < this.elements.length; index++) {
            if (!current) {
                findIndex = index
                current = this.elements[index]
                continue
            }
            let indexElement = this.elements[index]
            let indexDistance = indexElement.formalDistance(point)
            let currentDistance = current.formalDistance(point)
            if (indexDistance <= currentDistance && this.currentIndex != index) {
                if (/*this.selectCount <= 1 || this.currentSubIndex != index*/true) {
                    console.log(`near:${findIndex}`)
                    findIndex = index
                    current = indexElement
                }
            }
        }
        this.currentIndex = findIndex
    }

    subSelect(point: Vector) {
        console.log("subSelect")
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
                console.log(`near:${findIndex}`)
                findIndex = index
                current = indexElement
            }
        }

        this.currentSubIndex = findIndex

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
    clickIimeOutID?:number = undefined 
    prevX: number = 0
    prevY: number = 0
    stringMode?: string = undefined
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

        canvas.addEventListener("mousemove", (ev) => {
            this.move(ev)
        })

        document.addEventListener("keypress", (ev) => {
            this.keyPress(ev)
        })
    }

    click(ev: MouseEvent) {
    


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
        // console.log(`move:${ev.x}_${ev.y}`)
      
        this.prevX = ev.x
        this.prevY = ev.y
    }

    keyPress(ev: KeyboardEvent) {
        console.log("key:" + ev.key)
        const scale = config.scale
        const x = Math.floor(this.prevX / scale) 
        const y = Math.floor(this.prevY / scale)

        if (this.stringMode != undefined) {

            if (ev.key == "/") {
                let current = this.repository.currentElement()
                if (current && isLine(current)) {
                    current.label = this.stringMode
                    this.stringMode = undefined
                    console.log("stringMode OUT")
                    this.drawAll()
                    return
                }
                if (current && isLoop(current)) {
                    current.label = this.stringMode
                    this.stringMode = undefined
                    console.log("stringMode OUT")
                    this.drawAll()
                    return
                }
                let str = new MyString(this.stringMode)
                str.origin = new Vector(x, y)
                this.repository.doCommand(new SetString(str))
                this.stringMode = undefined
                console.log("stringMode OUT")
                this.drawAll()
                return
            }

            this.stringMode = this.stringMode + ev.key
            console.log("stringMode:", this.stringMode)
            return
        }

        if (ev.key == "/") {
            console.log("stringMode In")
            this.stringMode = ""
            return
        }


        if (ev.key == "v") {
            this.putVertex(new Vector(x,y))
        }
        if (ev.key == "n") {
            this.nextElem()
        }

        if (ev.key == "b") {
            this.preElem()
        }

        if (ev.key == "s") {
            this.nextSubElem()
        }

        if (ev.key == "a") {
            this.preSubElem()
        }

        if (ev.key == "p") {
            this.putLine()
        }

        if (ev.key == "l") {
            this.putLoop(x, y)
        }

        if (ev.key == "t") {
            this.changeType()
        }

        if (ev.key == "q") {
            this.changeStyle()
        }

        if (ev.key == "d") {
            this.delete()
        }

        if (ev.key == "@") {
            this.allowToggle()
        }


        if (ev.key == "c") {
            this.changeSelect()
        }
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


    putVertex(vertex: Vector) {
        console.log("put vertex..")
        this.repository.doCommand(new SetVertex(vertex))
        this.drawAll()
    }

    putLoop(x:number, y:number) {
        console.log("put Loop..")
        const loop = new Loop()
        loop.origin = new Vector(x,y)
        this.repository.doCommand(new SetLoop(loop))
        this.drawAll()
    }

    drawAll() {

        // clear
        context.clearRect(0,0, canvas.width, canvas.height)

        const elms = this.repository.getAllElements()
        context.beginPath()
        elms.forEach((elm, index) => {
            console.log("draw..")
            draw(elm)
        })

        const sub = this.repository.currentSubElement()
        if (sub) {
            draw(sub, "sub")
        }

        const current = this.repository.currentElement()
        if (current) {
            draw(current, "select")
        }
        context.closePath()
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

    select(point:Vector) {
        this.repository.select(point)
        this.drawAll()
    }

    subSelect(point: Vector) {
        this.repository.subSelect(point)
        this.drawAll()
    }
}

const h = new RDDraw(canvas)
