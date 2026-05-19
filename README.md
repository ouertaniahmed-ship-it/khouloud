# Truck Loading Optimizer

A web application that computes the optimal placement of boxes inside a truck, maximizing space utilization. Built with Python (Flask) and vanilla JavaScript.

## Problem

Given a truck floor of **2.4m × 13.2m**, pack a mix of box types as efficiently as possible.

| Type | Dimensions | Variants |
|------|------------|----------|
| American | 1.0m × 1.2m | Stackable / Non-stackable |
| European | 1.2m × 0.8m | Stackable / Non-stackable |

**Rules:**
- Boxes can be rotated 90°
- Stackable boxes can hold one box of the **same type** on top
- Non-stackable boxes cannot have anything placed on them

## Features

- Input the quantity of each box type via steppers
- Define additional **custom box types** (any width × length) — saved in the browser
- Joint floor-and-stacking search that reserves truck length for custom boxes when needed
- Interactive top-down truck visualization rendered on HTML5 Canvas
- Stats: total placed, floor count, stacked count, unfit boxes, floor utilization %
- One-click PDF report (bundled jsPDF — works offline)

## Project Structure

```
.
├── app.py          # Flask server — serves UI and /api/optimize endpoint
├── packing.py      # Strip/shelf bin-packing with stacking
├── launcher.py     # PyInstaller entry point (bundled .exe)
├── build_windows.bat
├── templates/
│   └── index.html  # Single-page UI
└── static/
    ├── css/style.css
    └── js/
        ├── app.js
        └── jspdf.umd.min.js   # bundled, no CDN
```

## Setup

**Requirements:** Python 3.10+

```bash
pip install flask
python app.py
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## Algorithm

**Phase 1 — Standard floor packing** searches over four zero-waste row patterns
that exactly fill the 2.4 m width:

| Row | Composition | Depth |
|-----|---|---|
| A   | 2 American (1.2 × 1.0) | 1.0 m |
| B   | 2 European (1.2 × 0.8) | 0.8 m |
| C   | 3 European (0.8 × 1.2) | 1.2 m |
| D   | 1 American + 1 European | 1.0 m |

The optimiser enumerates `(a, b, c, d)` counts, scores each layout by
`(total_placed, fewer_rows, shorter_length)`, and falls back to partial-row
variants (pA / pB / pE2) to fill any remainder.

**Phase 2 — Stacking:**
- Non-stackable boxes fill floor spots first; they are never base nor top.
- Any stackable box that could not fit on the floor is stacked on a same-type stackable floor box.
- Each stackable floor position can hold at most one additional same-type box on top.

**Phase 3 — Custom boxes:** A greedy shelf packer places user-defined box
types in the remaining truck length, with the same stacking rules. Before
running Phase 1, the standard packer is given a length budget that reserves
room for the estimated custom-box footprint, so a single 1.5 × 1.5 custom
box can't be squeezed out by a maximally-greedy European strip.

Utilization is reported as the percentage of truck floor area covered by first-layer boxes.
