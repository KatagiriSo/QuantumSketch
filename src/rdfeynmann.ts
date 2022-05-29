// "RDFeynmann  So Katagiri"

import { DrawContext } from "./UI/DrawContext"
import { RDDraw } from "./UI/RDDraw"

let canvas = document.getElementById("canvas") as HTMLCanvasElement
let context_ = canvas.getContext("2d")!

let drawContext = new DrawContext(context_);
const h = new RDDraw(canvas, drawContext)
