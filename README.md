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
- Optimization runs 6 different packing strategies and picks the best result
- Interactive top-down truck visualization rendered on HTML5 Canvas
- Stats: total placed, floor count, stacked count, unfit boxes, floor utilization %
- Color-coded boxes with rotation and stacking indicators

## Project Structure

```
.
├── app.py          # Flask server — serves UI and /api/optimize endpoint
├── packing.py      # Maximal rectangles bin-packing algorithm
├── templates/
│   └── index.html  # Single-page UI
└── static/
    ├── css/style.css
    └── js/app.js
```

## Setup

**Requirements:** Python 3.10+

```bash
pip install flask
python app.py
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## Algorithm

**Phase 1 — Floor packing** uses the *Maximal Rectangles* heuristic:
- The free space is tracked as a list of non-overlapping rectangles
- Each box is placed in the rectangle that gives the best score (bottom-left preference)
- Both orientations (normal and rotated) are tried for every placement
- 6 ordering strategies are evaluated in parallel and the best result is kept

**Phase 2 — Stacking:**
- Any box that could not fit on the floor is stacked on a same-type stackable floor box
- Each stackable floor position can hold at most one additional box on top

**Utilization** is reported as the percentage of truck floor area covered by first-layer boxes.
