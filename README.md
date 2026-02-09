# QuantumSketch

QuantumSketch is an HTML5 Canvas based Feynman diagram editor.

- TypeScript implementation
- Direct manipulation (select, drag, snap, resize)
- DSL/script engine for fast diagram generation
- Export to TikZ / SVG
- Undo / Redo and clipboard operations


## Live Demo

https://katagiriso.github.io/QuantumSketch/

## Local Setup

1. Install dependencies
```bash
npm install
```
2. Build
```bash
npm run build
```
3. Open `docs/index.html` in your browser

### Development Commands

```bash
npm run watch
npm run build
npm run gen:allinone
```

## Current Core Features

### Canvas Editing

- Select / box-select / multi-select (`Shift+Click`)
- Vertex-first drag behavior for connected graph editing
- Propagator endpoint detachment with `Alt+Drag`
- Loop radius direct handle on canvas
- Grid/vertex snap feedback while drawing
- Group / Ungroup (PowerPoint-like behavior)

### View Navigation

- Zoom with mouse wheel
- Pan with `Space + Drag` (or middle mouse drag)
- Responsive canvas layout

### Clipboard and History

- `Ctrl/⌘ + C / X / V`
- `Ctrl/⌘ + Z` undo, `Ctrl/⌘ + Shift + Z` or `Ctrl/⌘ + Y` redo
- `Ctrl/⌘ + S` quick save to browser localStorage (`quantumSketch.quickSave.latest`)

### DSL Studio

Supports both quick command input and multiline script execution.

#### Relative commands

- `start x y` / `move x y`
- `line direction length [particle|style]`
- `prop direction length [particle|style]`
- `loop radius`
- `branch`, `next`, `join`, `join_mode`

#### Absolute commands

- `line x1 y1 x2 y2 [particle|style]`
- `loop x y radius [style] [beginAngle] [endAngle]`

#### Physics templates/macros

- `template qed_box`
- `template qed_vertex`
- `template qed_vac`
- `template penguin`
- `template compton`
- `template s_channel`
- `template t_channel`
- `template triangle`
- `template w_exchange`
- `template bhabha_t`
- `template sunset`
- `template double_box`
- `qed_se x y length`
- `qed_vp x y length`

## Export

- TikZ text export
- SVG text export
- SVG download

## Notes

- IDs are re-synchronized on load to avoid collisions.
- Selection state is unified around selected-elements ordering.

## License

MIT
