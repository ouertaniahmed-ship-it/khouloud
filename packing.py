"""
Truck loading optimizer — strip-based bin packing.

Truck: 2.4m (width) x 13.2m (length)
American box: 1.0m x 1.2m
European box: 1.2m x 0.8m

Stacking rules (strictly enforced):
  - A NON-STACKABLE box can NEVER be placed on top of another box.
  - A NON-STACKABLE box can NEVER have another box placed on top of it.
  - Only a STACKABLE box may sit on the floor and serve as a base for stacking.
  - Only a STACKABLE box may be placed on top (of a stackable floor box).
  - Stacked box must be the same type as the box beneath it.

Floor-placement priority:
  1. Non-stackable boxes are placed on the floor first (they have nowhere else to go).
  2. Remaining floor spots are filled by stackable boxes.
  3. Any stackable boxes that did not fit on the floor may be stacked on top of
     stackable floor boxes (one box per base, same type).

Row types that fill 2.4m width with zero waste:
  A — 2 American  (each 1.2w × 1.0h) → row depth 1.0m, 2 AM
  B — 2 European  (each 1.2w × 0.8h) → row depth 0.8m, 2 EU
  C — 3 European  (each 0.8w × 1.2h) → row depth 1.2m, 3 EU
  D — 1 American + 1 European (1.2w each) → row depth 1.0m, 1 AM + 1 EU
"""

from dataclasses import dataclass, field

TRUCK_WIDTH  = 2.4
TRUCK_LENGTH = 13.2
EPS = 1e-6


@dataclass
class PlacedBox:
    x: float          # position along truck width
    y: float          # position along truck length
    w: float          # width (across truck)
    h: float          # depth (along truck length)
    box_type: str     # "american" | "european"
    stackable: bool
    stacked: bool = False


def _box_to_dict(b: PlacedBox) -> dict:
    return {
        "x": b.x, "y": b.y, "w": b.w, "h": b.h,
        "type": b.box_type,
        "stackable": b.stackable,
        "stacked": b.stacked,
    }


# ── Helpers ──────────────────────────────────────────────────────────

def _max_stackable_bonus(floor_spots: int, s_count: int, ns_count: int) -> int:
    """
    Given `floor_spots` floor positions available for one box type,
    compute how many extra (stacked) boxes can be loaded on top.

    Priority: non-stackable fill the floor first (they can't go anywhere else).
    Stackable fill remaining floor spots. Any stackable left over can be stacked
    on top of the stackable floor bases — one per base.

    Returns the number of boxes that can be stacked on top (always >= 0).
    """
    ns_on_floor   = min(ns_count, floor_spots)
    remaining     = floor_spots - ns_on_floor
    s_on_floor    = min(s_count, remaining)
    s_leftover    = s_count - s_on_floor      # stackable boxes that didn't fit on floor
    stacked_on_top = min(s_leftover, s_on_floor)  # can only stack on stackable floor bases
    return stacked_on_top


def _greedy_fill(am_left: int, eu_left: int, remaining_len: float) -> list:
    """Greedily fill remaining truck space with best-fit rows."""
    rows = []
    candidates = [
        ("A",  2, 0, 1.0),
        ("C",  0, 3, 1.2),
        ("B",  0, 2, 0.8),
        ("D",  1, 1, 1.0),
        ("pA", 1, 0, 1.0),
        ("pE2",0, 2, 1.2),
        ("pB", 0, 1, 0.8),
    ]
    changed = True
    while changed and remaining_len > EPS and (am_left > 0 or eu_left > 0):
        changed = False
        for name, an, en, h in candidates:
            if an <= am_left and en <= eu_left and h <= remaining_len + EPS:
                rows.append((name, an, en, h))
                am_left -= an
                eu_left -= en
                remaining_len -= h
                changed = True
                break
    return rows


# ── Row-configuration search ──────────────────────────────────────────

def _find_best_row_config(total_am: int, total_eu: int,
                          am_s: int, am_ns: int,
                          eu_s: int, eu_ns: int) -> tuple:
    """
    Search for the combination of row types A/B/C/D that maximises
    TOTAL boxes loaded (floor + legally stacked) within the 13.2m length.
    """
    best      = None
    best_score = (-1, 0, 0)

    max_a = min(total_am // 2,  int(TRUCK_LENGTH / 1.0 + EPS))
    max_c = min(total_eu // 3,  int(TRUCK_LENGTH / 1.2 + EPS))

    for a in range(max_a + 1):
        len_a = a * 1.0
        if len_a > TRUCK_LENGTH + EPS:
            break

        for c in range(max_c + 1):
            len_ac = len_a + c * 1.2
            if len_ac > TRUCK_LENGTH + EPS:
                break
            eu_after_c = total_eu - 3 * c
            if eu_after_c < 0:
                break

            am_after_a  = total_am - 2 * a
            rem_len      = TRUCK_LENGTH - len_ac
            max_d        = min(am_after_a, eu_after_c, int(rem_len / 1.0 + EPS))

            for d in range(max_d + 1):
                am_left = am_after_a - d
                eu_left = eu_after_c - d
                rem      = rem_len - d * 1.0

                b        = min(eu_left // 2, int(rem / 0.8 + EPS))
                used_len = len_ac + d * 1.0 + b * 0.8
                leftover = TRUCK_LENGTH - used_len
                eu_rem   = eu_left - 2 * b

                extra_rows = _greedy_fill(am_left, eu_rem, leftover)
                extra_am   = sum(r[1] for r in extra_rows)
                extra_eu   = sum(r[2] for r in extra_rows)
                extra_len  = sum(r[3] for r in extra_rows)

                floor_am = 2 * a + d + extra_am
                floor_eu = 3 * c + d + 2 * b + extra_eu

                # Actual placed on floor (capped by available boxes)
                placed_am_floor = min(floor_am, total_am)
                placed_eu_floor = min(floor_eu, total_eu)

                stacked_am = _max_stackable_bonus(placed_am_floor, am_s, am_ns)
                stacked_eu = _max_stackable_bonus(placed_eu_floor, eu_s, eu_ns)

                total_with_stacking = placed_am_floor + placed_eu_floor + stacked_am + stacked_eu
                total_len  = used_len + extra_len
                num_rows   = a + b + c + d + len(extra_rows)

                score = (total_with_stacking, -num_rows, -total_len)
                if score > best_score:
                    best_score = score
                    best = (a, b, c, d, extra_rows)

    return best if best is not None else (0, 0, 0, 0, [])


# ── Coordinate generation ─────────────────────────────────────────────

def _generate_placements(a, b, c, d, extra_rows,
                         am_s, am_ns, eu_s, eu_ns) -> list[PlacedBox]:
    """
    Convert a row configuration into concrete PlacedBox objects.

    Floor-assignment priority:
      Non-stackable boxes fill floor spots first.
      Remaining spots go to stackable boxes (so surplus stackable can be stacked).
    """
    total_am = am_s + am_ns
    total_eu = eu_s + eu_ns

    extra_am = sum(r[1] for r in extra_rows)
    extra_eu = sum(r[2] for r in extra_rows)
    floor_am_cap = 2 * a + d + extra_am
    floor_eu_cap = 3 * c + d + 2 * b + extra_eu

    # Clamp to available boxes
    floor_am = min(floor_am_cap, total_am)
    floor_eu = min(floor_eu_cap, total_eu)

    # Non-stackable fill first, stackable get remaining spots
    am_ns_floor = min(am_ns, floor_am)
    am_s_floor  = floor_am - am_ns_floor   # stackable that actually go on floor

    eu_ns_floor = min(eu_ns, floor_eu)
    eu_s_floor  = floor_eu - eu_ns_floor

    # Queues: non-stackable (False) first, then stackable (True)
    am_queue = [False] * am_ns_floor + [True] * am_s_floor
    eu_queue = [False] * eu_ns_floor + [True] * eu_s_floor

    am_idx = 0
    eu_idx = 0

    placed: list[PlacedBox] = []
    y = 0.0

    def next_am() -> bool:
        nonlocal am_idx
        if am_idx >= len(am_queue):
            return False
        v = am_queue[am_idx]; am_idx += 1; return v

    def next_eu() -> bool:
        nonlocal eu_idx
        if eu_idx >= len(eu_queue):
            return False
        v = eu_queue[eu_idx]; eu_idx += 1; return v

    def add(x, yy, w, h, btype, stackable_fn):
        placed.append(PlacedBox(x, yy, w, h, btype, stackable_fn()))

    # ── Row type A: 2 American (1.2w × 1.0h) ──
    for _ in range(a):
        add(0.0, y, 1.2, 1.0, "american", next_am)
        add(1.2, y, 1.2, 1.0, "american", next_am)
        y += 1.0

    # ── Row type D: 1 American + 1 European ──
    for _ in range(d):
        add(0.0, y, 1.2, 1.0, "american", next_am)
        add(1.2, y, 1.2, 0.8, "european", next_eu)
        y += 1.0

    # ── Row type C: 3 European (0.8w × 1.2h) ──
    for _ in range(c):
        add(0.0, y, 0.8, 1.2, "european", next_eu)
        add(0.8, y, 0.8, 1.2, "european", next_eu)
        add(1.6, y, 0.8, 1.2, "european", next_eu)
        y += 1.2

    # ── Row type B: 2 European (1.2w × 0.8h) ──
    for _ in range(b):
        add(0.0, y, 1.2, 0.8, "european", next_eu)
        add(1.2, y, 1.2, 0.8, "european", next_eu)
        y += 0.8

    # ── Extra rows from greedy fill ──
    for row_name, am_need, eu_need, height in extra_rows:
        _place_extra_row(placed, row_name, y,
                         next_am if am_need else None,
                         next_eu if eu_need else None)
        y += height

    return placed


def _place_extra_row(placed, row_name, y, next_am_fn, next_eu_fn):
    def am(): return next_am_fn()
    def eu(): return next_eu_fn()

    def add(x, w, h, btype, sfn):
        placed.append(PlacedBox(x, y, w, h, btype, sfn()))

    if   row_name == "A":
        add(0.0, 1.2, 1.0, "american", am); add(1.2, 1.2, 1.0, "american", am)
    elif row_name == "B":
        add(0.0, 1.2, 0.8, "european", eu); add(1.2, 1.2, 0.8, "european", eu)
    elif row_name == "C":
        add(0.0, 0.8, 1.2, "european", eu)
        add(0.8, 0.8, 1.2, "european", eu)
        add(1.6, 0.8, 1.2, "european", eu)
    elif row_name == "D":
        add(0.0, 1.2, 1.0, "american", am); add(1.2, 1.2, 0.8, "european", eu)
    elif row_name == "pA":
        add(0.0, 1.2, 1.0, "american", am)
    elif row_name == "pB":
        add(0.0, 1.2, 0.8, "european", eu)
    elif row_name == "pE2":
        add(0.0, 0.8, 1.2, "european", eu); add(0.8, 0.8, 1.2, "european", eu)


# ── Stacking ──────────────────────────────────────────────────────────

def _apply_stacking(floor_placed: list[PlacedBox],
                    am_s: int, am_ns: int,
                    eu_s: int, eu_ns: int) -> tuple[list[PlacedBox], int]:
    """
    Place remaining stackable boxes on top of stackable floor boxes.

    Strict rules enforced here:
      - Only a stackable floor box may serve as a base.
      - Only a stackable box may be placed on top.
      - Non-stackable boxes are NEVER involved (neither base nor top).
      - One extra box per base, same type only.
    """
    # Count stackable floor boxes per type
    floor_am_s_bases = [p for p in floor_placed if p.box_type == "american" and p.stackable]
    floor_eu_s_bases = [p for p in floor_placed if p.box_type == "european" and p.stackable]

    floor_am_total = sum(1 for p in floor_placed if p.box_type == "american")
    floor_eu_total = sum(1 for p in floor_placed if p.box_type == "european")

    # Stackable boxes that ended up on the floor (filled remaining spots after ns)
    am_ns_on_floor = min(am_ns, floor_am_total)
    am_s_on_floor  = floor_am_total - am_ns_on_floor
    eu_ns_on_floor = min(eu_ns, floor_eu_total)
    eu_s_on_floor  = floor_eu_total - eu_ns_on_floor

    # Stackable boxes NOT on the floor
    am_s_leftover = am_s - am_s_on_floor
    eu_s_leftover = eu_s - eu_s_on_floor

    # Can only stack on stackable bases, one per base
    am_to_stack = min(max(0, am_s_leftover), len(floor_am_s_bases))
    eu_to_stack = min(max(0, eu_s_leftover), len(floor_eu_s_bases))

    stacked: list[PlacedBox] = []

    for fp in floor_am_s_bases[:am_to_stack]:
        stacked.append(PlacedBox(
            fp.x, fp.y, fp.w, fp.h, "american",
            stackable=True, stacked=True
        ))

    for fp in floor_eu_s_bases[:eu_to_stack]:
        stacked.append(PlacedBox(
            fp.x, fp.y, fp.w, fp.h, "european",
            stackable=True, stacked=True
        ))

    # Compute boxes that genuinely could not be loaded
    placed_am = floor_am_total + am_to_stack
    placed_eu = floor_eu_total + eu_to_stack
    not_placed = max(0, (am_s + am_ns) - placed_am) + max(0, (eu_s + eu_ns) - placed_eu)

    return stacked, not_placed


# ── Custom-box shelf packing ─────────────────────────────────────────

def _pack_custom_boxes(custom_types: list, remaining_length: float) -> tuple:
    """
    Pack arbitrary-dimension custom boxes into the remaining truck space
    using a greedy shelf (strip) algorithm.

    Each custom type dict: {id, name, width, length, stackable, non_stackable}

    Returns (placed_list, per_type_counts_dict)
    where per_type_counts_dict maps type_id -> {floor, stacked, total_requested}.
    """
    placed: list[PlacedBox] = []
    counts: dict = {}

    # Build a flat list of boxes to place, non-stackable first (they must go on floor)
    floor_boxes = []
    for ct in custom_types:
        tid = ct["id"]
        ns = max(0, int(ct.get("non_stackable", 0)))
        s = max(0, int(ct.get("stackable", 0)))
        bw = float(ct["width"])
        bl = float(ct["length"])
        counts[tid] = {"floor": 0, "stacked": 0, "requested": ns + s,
                        "name": ct["name"], "width": bw, "length": bl}
        # Non-stackable boxes first (they can only go on floor)
        for _ in range(ns):
            floor_boxes.append((tid, bw, bl, False))
        for _ in range(s):
            floor_boxes.append((tid, bw, bl, True))

    if not floor_boxes:
        return placed, counts

    # Greedy shelf packing into remaining_length x TRUCK_WIDTH area
    # Each shelf has a fixed height (depth along truck) = tallest box in that shelf
    shelves = []  # list of (y_start, shelf_height, boxes_in_shelf)
    y_cursor = 0.0

    for tid, bw, bl, stackable in floor_boxes:
        # Try both orientations
        orientations = [(bw, bl), (bl, bw)]
        fitted = False

        for ow, oh in orientations:
            if ow > TRUCK_WIDTH + EPS or oh > remaining_length + EPS:
                continue

            # Try to fit in an existing shelf
            for shelf in shelves:
                sy, sh, sboxes = shelf
                if oh > sh + EPS:
                    continue
                # Find rightmost edge in this shelf
                x_cursor = sum(sb[1] for sb in sboxes)
                if x_cursor + ow <= TRUCK_WIDTH + EPS:
                    sboxes.append((tid, ow, oh, stackable))
                    p = PlacedBox(x_cursor, sy, ow, oh, tid, stackable)
                    placed.append(p)
                    counts[tid]["floor"] += 1
                    fitted = True
                    break

            if fitted:
                break

            # Open a new shelf
            if y_cursor + oh <= remaining_length + EPS:
                shelf_entry = (y_cursor, oh, [(tid, ow, oh, stackable)])
                shelves.append(shelf_entry)
                p = PlacedBox(0.0, y_cursor, ow, oh, tid, stackable)
                placed.append(p)
                counts[tid]["floor"] += 1
                y_cursor += oh
                fitted = True
                break

        # If not fitted, box is unplaced (counts will show the gap)

    # Apply stacking for custom boxes: stackable leftover on stackable floor bases, same type
    for ct in custom_types:
        tid = ct["id"]
        info = counts[tid]
        total_s = max(0, int(ct.get("stackable", 0)))
        total_ns = max(0, int(ct.get("non_stackable", 0)))

        floor_total = info["floor"]
        ns_on_floor = min(total_ns, floor_total)
        s_on_floor = floor_total - ns_on_floor
        s_leftover = total_s - s_on_floor

        if s_leftover <= 0:
            continue

        # Find stackable floor bases for this type
        bases = [p for p in placed if p.box_type == tid and p.stackable and not p.stacked]
        to_stack = min(s_leftover, len(bases))
        for base in bases[:to_stack]:
            stacked_box = PlacedBox(base.x, base.y, base.w, base.h, tid,
                                     stackable=True, stacked=True)
            placed.append(stacked_box)
            info["stacked"] += 1

    return placed, counts


# ── Public API ────────────────────────────────────────────────────────

def pack_boxes_with_stacking(american_stackable: int,
                              american_non_stackable: int,
                              european_stackable: int,
                              european_non_stackable: int,
                              custom_boxes: list | None = None) -> dict:
    """
    Pack boxes into the truck. Returns a dict with placement details.

    Standard American/European boxes are packed first using optimised row
    patterns.  Then any custom boxes fill the remaining truck length using
    a greedy shelf algorithm.
    """
    am_s  = max(0, american_stackable)
    am_ns = max(0, american_non_stackable)
    eu_s  = max(0, european_stackable)
    eu_ns = max(0, european_non_stackable)

    total_am = am_s + am_ns
    total_eu = eu_s + eu_ns

    custom_types = custom_boxes or []
    total_custom_requested = sum(
        max(0, int(ct.get("stackable", 0))) + max(0, int(ct.get("non_stackable", 0)))
        for ct in custom_types
    )

    if total_am + total_eu + total_custom_requested == 0:
        return {
            "placed": [], "floor_count": 0, "stacked_count": 0,
            "total_placed": 0, "not_placed": 0, "total_requested": 0,
            "truck_width": TRUCK_WIDTH, "truck_length": TRUCK_LENGTH,
            "utilization": 0.0, "custom_counts": {},
        }

    # ── Standard packing ──────────────────────────────────────────
    floor_placed: list[PlacedBox] = []
    stacked: list[PlacedBox] = []
    not_placed_std = 0
    used_length = 0.0

    if total_am + total_eu > 0:
        a, b, c, d, extra_rows = _find_best_row_config(
            total_am, total_eu, am_s, am_ns, eu_s, eu_ns
        )

        floor_placed = _generate_placements(
            a, b, c, d, extra_rows,
            am_s, am_ns, eu_s, eu_ns,
        )

        stacked, not_placed_std = _apply_stacking(
            floor_placed, am_s, am_ns, eu_s, eu_ns
        )

        # Calculate used truck length from standard boxes
        if floor_placed:
            used_length = max(p.y + p.h for p in floor_placed)

    # ── Custom box packing ────────────────────────────────────────
    custom_placed: list[PlacedBox] = []
    custom_counts: dict = {}

    if custom_types:
        remaining = TRUCK_LENGTH - used_length
        custom_placed, custom_counts = _pack_custom_boxes(custom_types, remaining)
        # Offset custom boxes by used_length
        for p in custom_placed:
            p.y += used_length

    # ── Combine results ───────────────────────────────────────────
    all_floor = floor_placed + [p for p in custom_placed if not p.stacked]
    all_stacked = stacked + [p for p in custom_placed if p.stacked]

    all_placed_dicts = [_box_to_dict(p) for p in all_floor] + [_box_to_dict(p) for p in all_stacked]
    floor_area = sum(p.w * p.h for p in all_floor)

    custom_not_placed = sum(
        max(0, info["requested"] - info["floor"] - info["stacked"])
        for info in custom_counts.values()
    )

    total_not_placed = not_placed_std + custom_not_placed
    total_requested = total_am + total_eu + total_custom_requested

    return {
        "placed":          all_placed_dicts,
        "floor_count":     len(all_floor),
        "stacked_count":   len(all_stacked),
        "total_placed":    len(all_floor) + len(all_stacked),
        "not_placed":      total_not_placed,
        "total_requested": total_requested,
        "truck_width":     TRUCK_WIDTH,
        "truck_length":    TRUCK_LENGTH,
        "utilization":     round(floor_area / (TRUCK_WIDTH * TRUCK_LENGTH) * 100, 1),
        "custom_counts":   {k: {kk: vv for kk, vv in v.items()} for k, v in custom_counts.items()},
    }