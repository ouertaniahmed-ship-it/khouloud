let animationFrameId = null;
let lastResult  = null;
let lastPayload = null;

// ── Custom box type colors ────────────────────────────────────────────
const CUSTOM_COLORS = ["#e056a0", "#f0932b", "#6c5ce7", "#0984e3"];

function getCustomColor(index) {
    return CUSTOM_COLORS[index % CUSTOM_COLORS.length];
}

// ── localStorage helpers ──────────────────────────────────────────────

function getCustomTypes() {
    try {
        return JSON.parse(localStorage.getItem("customBoxTypes") || "[]");
    } catch { return []; }
}

function saveCustomTypes(types) {
    localStorage.setItem("customBoxTypes", JSON.stringify(types));
}

function deleteCustomType(id) {
    const types = getCustomTypes().filter(t => t.id !== id);
    saveCustomTypes(types);
    renderCustomCards();
}

// ── Add-type form ─────────────────────────────────────────────────────

function showAddTypeForm() {
    document.getElementById("add-type-form").style.display = "block";
    document.getElementById("add-type-btn").style.display = "none";
    document.getElementById("custom-name").focus();
}

function hideAddTypeForm() {
    document.getElementById("add-type-form").style.display = "none";
    document.getElementById("add-type-btn").style.display = "";
    document.getElementById("custom-name").value = "";
    document.getElementById("custom-width").value = "";
    document.getElementById("custom-length").value = "";
}

function saveCustomType() {
    const name = document.getElementById("custom-name").value.trim();
    const width = parseFloat(document.getElementById("custom-width").value);
    const length = parseFloat(document.getElementById("custom-length").value);

    if (!name) { alert("Please enter a name."); return; }
    if (!width || width <= 0 || width > 2.4) { alert("Width must be between 0.1 and 2.4m."); return; }
    if (!length || length <= 0 || length > 13.2) { alert("Length must be between 0.1 and 13.2m."); return; }

    const types = getCustomTypes();
    types.push({
        id: "custom_" + Date.now(),
        name: name,
        width: Math.round(width * 100) / 100,
        length: Math.round(length * 100) / 100,
    });
    saveCustomTypes(types);
    hideAddTypeForm();
    renderCustomCards();
}

// ── Render custom cards ───────────────────────────────────────────────

function renderCustomCards() {
    // Remove old custom cards
    document.querySelectorAll(".box-card.custom-card").forEach(el => el.remove());

    const grid = document.querySelector(".box-grid");
    const types = getCustomTypes();

    types.forEach((ct, idx) => {
        const color = getCustomColor(idx);
        const card = document.createElement("div");
        card.className = "box-card custom-card";
        card.style.borderTop = `3px solid ${color}`;
        card.innerHTML = `
            <div class="box-header">
                <div class="box-header-row">
                    <div class="box-header-left">
                        <span class="box-icon" style="background:${hexToRgba(color,0.15)};border:2px solid ${color}"></span>
                        <div>
                            <h3>${escapeHtml(ct.name)}</h3>
                            <span class="dims">${ct.width}m &times; ${ct.length}m</span>
                        </div>
                    </div>
                    <button class="btn-delete-type" onclick="deleteCustomType('${ct.id}')" title="Delete">&times;</button>
                </div>
            </div>
            <div class="box-inputs">
                <div class="input-group">
                    <label><span class="stack-badge stackable">Stackable</span></label>
                    <div class="stepper">
                        <button type="button" class="btn-step" onclick="step('${ct.id}_s', -1)">&#8722;</button>
                        <input type="number" id="${ct.id}_s" value="0" min="0" max="99">
                        <button type="button" class="btn-step" onclick="step('${ct.id}_s', 1)">+</button>
                    </div>
                </div>
                <div class="input-group">
                    <label><span class="stack-badge non-stackable">Non-stackable</span></label>
                    <div class="stepper">
                        <button type="button" class="btn-step" onclick="step('${ct.id}_ns', -1)">&#8722;</button>
                        <input type="number" id="${ct.id}_ns" value="0" min="0" max="99">
                        <button type="button" class="btn-step" onclick="step('${ct.id}_ns', 1)">+</button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

// ── Stepper ───────────────────────────────────────────────────────────

function step(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) || 0;
    val = Math.max(0, val + delta);
    input.value = val;
}

// ── Optimize ──────────────────────────────────────────────────────────

async function optimize() {
    const btn = document.getElementById("optimize-btn");
    const btnText = btn.querySelector(".btn-text");
    const btnLoader = btn.querySelector(".btn-loader");

    btn.disabled = true;
    btnText.textContent = "Optimizing...";
    btnLoader.style.display = "inline-block";

    const payload = {
        american_stackable: parseInt(document.getElementById("american_stackable").value) || 0,
        american_non_stackable: parseInt(document.getElementById("american_non_stackable").value) || 0,
        european_stackable: parseInt(document.getElementById("european_stackable").value) || 0,
        european_non_stackable: parseInt(document.getElementById("european_non_stackable").value) || 0,
    };

    // Gather custom box data
    const customTypes = getCustomTypes();
    if (customTypes.length > 0) {
        payload.custom_boxes = customTypes.map(ct => ({
            id: ct.id,
            name: ct.name,
            width: ct.width,
            length: ct.length,
            stackable: parseInt(document.getElementById(ct.id + "_s")?.value) || 0,
            non_stackable: parseInt(document.getElementById(ct.id + "_ns")?.value) || 0,
        }));
    }

    try {
        const resp = await fetch("/api/optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();

        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        lastPayload = payload;
        displayResults(data);
    } catch (err) {
        alert("Request failed: " + err.message);
    } finally {
        btn.disabled = false;
        btnText.textContent = "Optimize Loading";
        btnLoader.style.display = "none";
    }
}

// ── Build a color-defs map that includes custom types ─────────────────

function buildColorDefs() {
    const defs = {
        american_stackable:     { base: "#e17055", alphaHi: 0.90, alphaLo: 0.60 },
        american_non_stackable: { base: "#e17055", alphaHi: 0.52, alphaLo: 0.30 },
        european_stackable:     { base: "#00b894", alphaHi: 0.90, alphaLo: 0.60 },
        european_non_stackable: { base: "#00b894", alphaHi: 0.52, alphaLo: 0.30 },
    };
    const types = getCustomTypes();
    types.forEach((ct, idx) => {
        const c = getCustomColor(idx);
        defs[ct.id + "_stackable"]     = { base: c, alphaHi: 0.90, alphaLo: 0.60 };
        defs[ct.id + "_non_stackable"] = { base: c, alphaHi: 0.52, alphaLo: 0.30 };
    });
    return defs;
}

// ── Build a label map for box types ───────────────────────────────────

function buildLabelMap() {
    const map = { american: "AM", european: "EU" };
    const types = getCustomTypes();
    types.forEach(ct => {
        // Use first 2-3 chars of name as label
        map[ct.id] = ct.name.substring(0, 3).toUpperCase();
    });
    return map;
}

// ── Display results ───────────────────────────────────────────────────

function displayResults(data) {
    const section = document.getElementById("results");
    section.style.display = "block";

    document.getElementById("stat-placed").textContent = data.total_placed;
    document.getElementById("stat-floor").textContent = data.floor_count;
    document.getElementById("stat-stacked").textContent = data.stacked_count;
    document.getElementById("stat-unplaced").textContent = data.not_placed;
    document.getElementById("stat-util").textContent = data.utilization + "%";

    // Red stat card when boxes couldn't fit
    const unplacedCard = document.getElementById("stat-unplaced").closest(".stat");
    if (data.not_placed > 0) {
        unplacedCard.classList.add("stat-danger");
    } else {
        unplacedCard.classList.remove("stat-danger");
    }

    // Alert banner
    const alertEl = document.getElementById("alert-unplaced");
    if (data.not_placed > 0) {
        alertEl.style.display = "flex";
        const n = data.not_placed;
        alertEl.querySelector(".alert-text").textContent =
            `${n} box${n !== 1 ? "es" : ""} could not fit in the truck!`;
    } else {
        alertEl.style.display = "none";
    }

    // Per-type unplaced breakdown
    const placedAS  = data.placed.filter(b => b.type === "american" &&  b.stackable).length;
    const placedANS = data.placed.filter(b => b.type === "american" && !b.stackable).length;
    const placedES  = data.placed.filter(b => b.type === "european" &&  b.stackable).length;
    const placedENS = data.placed.filter(b => b.type === "european" && !b.stackable).length;

    const breakdown = [
        { type: "american", stackable: true,  label: "American Stackable",    count: Math.max(0, (lastPayload?.american_stackable     || 0) - placedAS)  },
        { type: "american", stackable: false, label: "American Non-stackable", count: Math.max(0, (lastPayload?.american_non_stackable || 0) - placedANS) },
        { type: "european", stackable: true,  label: "European Stackable",    count: Math.max(0, (lastPayload?.european_stackable     || 0) - placedES)  },
        { type: "european", stackable: false, label: "European Non-stackable", count: Math.max(0, (lastPayload?.european_non_stackable || 0) - placedENS) },
    ];

    // Add custom type breakdowns
    const customTypes = getCustomTypes();
    const customCounts = data.custom_counts || {};
    customTypes.forEach(ct => {
        const info = customCounts[ct.id];
        const reqS  = (lastPayload?.custom_boxes || []).find(b => b.id === ct.id)?.stackable || 0;
        const reqNS = (lastPayload?.custom_boxes || []).find(b => b.id === ct.id)?.non_stackable || 0;
        const placedS  = data.placed.filter(b => b.type === ct.id &&  b.stackable).length;
        const placedNS = data.placed.filter(b => b.type === ct.id && !b.stackable).length;
        breakdown.push({ type: ct.id, stackable: true,  label: ct.name + " Stackable",     count: Math.max(0, reqS - placedS),  customId: ct.id });
        breakdown.push({ type: ct.id, stackable: false, label: ct.name + " Non-stackable",  count: Math.max(0, reqNS - placedNS), customId: ct.id });
    });

    data.unplacedBreakdown = breakdown;
    lastResult = data;

    renderUnplacedBoxes(breakdown);
    updateLegend(data);

    // Update dimension labels
    document.getElementById("label-horizontal").textContent = data.truck_length + "m";
    document.getElementById("label-vertical").textContent = data.truck_width + "m";

    drawTruck(data);

    section.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Update legend with custom types ───────────────────────────────────

function updateLegend(data) {
    const legend = document.getElementById("legend");
    // Remove previous custom legend items
    legend.querySelectorAll(".legend-item-custom").forEach(el => el.remove());

    const types = getCustomTypes();
    types.forEach((ct, idx) => {
        const color = getCustomColor(idx);
        // Stackable
        const itemS = document.createElement("div");
        itemS.className = "legend-item legend-item-custom";
        itemS.innerHTML = `<span class="legend-color" style="background:${color};opacity:0.9"></span> ${escapeHtml(ct.name)} Stackable`;
        legend.insertBefore(itemS, legend.querySelector(".legend-item:last-child"));
        // Non-stackable
        const itemNS = document.createElement("div");
        itemNS.className = "legend-item legend-item-custom";
        itemNS.innerHTML = `<span class="legend-color" style="background:${color};opacity:0.5"></span> ${escapeHtml(ct.name)} Non-stackable`;
        legend.insertBefore(itemNS, legend.querySelector(".legend-item:last-child"));
    });
}

// ── Render unplaced boxes ─────────────────────────────────────────────

function renderUnplacedBoxes(breakdown) {
    const section = document.getElementById("unplaced-section");
    section.style.display = "block";

    const palette = {
        american_stackable:     { color: "#e17055", bg: "rgba(225,112,85,0.08)",  border: "rgba(225,112,85,0.35)" },
        american_non_stackable: { color: "#e17055", bg: "rgba(225,112,85,0.04)",  border: "rgba(225,112,85,0.20)" },
        european_stackable:     { color: "#00b894", bg: "rgba(0,184,148,0.08)",   border: "rgba(0,184,148,0.35)"  },
        european_non_stackable: { color: "#00b894", bg: "rgba(0,184,148,0.04)",   border: "rgba(0,184,148,0.20)"  },
    };

    // Add custom type palettes
    const types = getCustomTypes();
    types.forEach((ct, idx) => {
        const c = getCustomColor(idx);
        palette[ct.id + "_stackable"]     = { color: c, bg: hexToRgba(c, 0.08), border: hexToRgba(c, 0.35) };
        palette[ct.id + "_non_stackable"] = { color: c, bg: hexToRgba(c, 0.04), border: hexToRgba(c, 0.20) };
    });

    const grid = document.getElementById("unplaced-grid");
    // Adjust grid columns based on card count
    const cols = Math.min(breakdown.length, 4);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    grid.innerHTML = breakdown.map(item => {
        const key = item.type + "_" + (item.stackable ? "stackable" : "non_stackable");
        const p   = palette[key] || { color: "#888", bg: "var(--surface)", border: "var(--border)" };
        const has = item.count > 0;

        return `
        <div class="unplaced-card" style="
            border-top: 3px solid ${p.color};
            border-color: ${has ? p.border : "var(--border)"};
            border-top-color: ${p.color};
            background: ${has ? p.bg : "var(--surface)"};
        ">
            <span class="unplaced-card-label">${escapeHtml(item.label)}</span>
            <span class="unplaced-card-count" style="color:${has ? p.color : "var(--text-dim)"}; opacity:${has ? 1 : 0.28}">${item.count}</span>
            <span class="unplaced-card-sub" style="color:${has ? p.color : "var(--text-dim)"}; opacity:${has ? 0.7 : 0.28}">${has ? "could not fit" : "all loaded"}</span>
        </div>`;
    }).join("");
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function rrect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
    } else {
        ctx.rect(x, y, w, h);
    }
}

function drawTruck(data) {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    const canvas = document.getElementById("truck-canvas");
    const ctx = canvas.getContext("2d");

    const TRUCK_W = data.truck_width;
    const TRUCK_L = data.truck_length;

    const dpr = window.devicePixelRatio || 1;
    const SCALE = 85;
    const PAD = 10;

    const logicalW = TRUCK_L * SCALE + PAD * 2;
    const logicalH = TRUCK_W * SCALE + PAD * 2;

    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    canvas.style.width = logicalW + "px";
    canvas.style.height = logicalH + "px";
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#1a1d27";
    ctx.fillRect(0, 0, logicalW, logicalH);

    const floorGrad = ctx.createLinearGradient(PAD, PAD, PAD, PAD + TRUCK_W * SCALE);
    floorGrad.addColorStop(0, "#272b3c");
    floorGrad.addColorStop(1, "#1c1f2e");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(PAD, PAD, TRUCK_L * SCALE, TRUCK_W * SCALE);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= TRUCK_L; x += 1.2) {
        const cx = PAD + x * SCALE;
        ctx.beginPath(); ctx.moveTo(cx, PAD); ctx.lineTo(cx, PAD + TRUCK_W * SCALE); ctx.stroke();
    }
    for (let y = 0; y <= TRUCK_W; y += 0.4) {
        const cy = PAD + y * SCALE;
        ctx.beginPath(); ctx.moveTo(PAD, cy); ctx.lineTo(PAD + TRUCK_L * SCALE, cy); ctx.stroke();
    }

    const colorDefs = buildColorDefs();
    const labelMap = buildLabelMap();

    const floorBoxes = data.placed.filter(b => !b.stacked).sort((a, b) => a.y - b.y);
    const stackedBoxes = data.placed.filter(b => b.stacked);

    let fi = 0, si = 0;
    const total = floorBoxes.length + stackedBoxes.length;
    const BATCH = Math.max(1, Math.min(3, Math.ceil(total / 25)));

    function tick() {
        let drawn = 0;

        while (fi < floorBoxes.length && drawn < BATCH) {
            drawBox(ctx, floorBoxes[fi++], SCALE, PAD, colorDefs, labelMap, false);
            drawn++;
        }

        if (fi >= floorBoxes.length) {
            while (si < stackedBoxes.length && drawn < BATCH) {
                drawBox(ctx, stackedBoxes[si++], SCALE, PAD, colorDefs, labelMap, true);
                drawn++;
            }
        }

        if (fi < floorBoxes.length || si < stackedBoxes.length) {
            animationFrameId = requestAnimationFrame(tick);
        } else {
            animationFrameId = null;
            ctx.save();
            ctx.strokeStyle = "#5a5e7a";
            ctx.lineWidth = 2.5;
            ctx.shadowColor = "rgba(108, 92, 231, 0.5)";
            ctx.shadowBlur = 10;
            ctx.strokeRect(PAD, PAD, TRUCK_L * SCALE, TRUCK_W * SCALE);
            ctx.restore();
        }
    }

    ctx.strokeStyle = "#3a3e55";
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, TRUCK_L * SCALE, TRUCK_W * SCALE);

    animationFrameId = requestAnimationFrame(tick);
}

function drawBox(ctx, box, scale, pad, colorDefs, labelMap, isStacked) {
    const x = pad + box.y * scale;
    const y = pad + box.x * scale;
    const w = box.h * scale;
    const h = box.w * scale;

    const key = box.type + "_" + (box.stackable ? "stackable" : "non_stackable");
    const def = colorDefs[key] || { base: "#888888", alphaHi: 0.70, alphaLo: 0.40 };
    const R = 3;

    const hiAlpha = isStacked ? def.alphaHi * 0.60 : def.alphaHi;
    const loAlpha = isStacked ? def.alphaLo * 0.60 : def.alphaLo;

    const grad = ctx.createLinearGradient(x, y + 1, x, y + h - 1);
    grad.addColorStop(0, hexToRgba(def.base, hiAlpha));
    grad.addColorStop(1, hexToRgba(def.base, loAlpha));

    ctx.beginPath();
    rrect(ctx, x + 1, y + 1, w - 2, h - 2, R);
    ctx.fillStyle = grad;
    ctx.fill();

    if (h > 10) {
        const hiH = Math.min(h * 0.38, 12);
        const hi = ctx.createLinearGradient(x, y + 1, x, y + 1 + hiH);
        hi.addColorStop(0, "rgba(255,255,255,0.20)");
        hi.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        rrect(ctx, x + 1, y + 1, w - 2, h - 2, R);
        ctx.fillStyle = hi;
        ctx.fill();
    }

    if (isStacked) {
        ctx.save();
        ctx.beginPath();
        rrect(ctx, x + 1, y + 1, w - 2, h - 2, R);
        ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.20)";
        ctx.lineWidth = 1.5;
        for (let i = -(h + w); i < w + h; i += 7) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + h, y + h);
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.beginPath();
    rrect(ctx, x + 1, y + 1, w - 2, h - 2, R);
    ctx.strokeStyle = hexToRgba(def.base, isStacked ? 0.40 : 0.88);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const minDim = Math.min(w, h);
    if (minDim > 14) {
        const fontSize = minDim > 40 ? 10 : 7;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = labelMap[box.type] || box.type.substring(0, 3).toUpperCase();
        const sublabel = isStacked ? "\u00d72" : (box.rotated ? "R" : "");
        ctx.fillText(label, x + w / 2, y + h / 2 - (sublabel ? 4 : 0));
        if (sublabel) {
            ctx.font = `${fontSize - 1}px -apple-system, sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fillText(sublabel, x + w / 2, y + h / 2 + 5);
        }
    }
}

// ── PDF Export ────────────────────────────────────────────────────────

function exportPDF(data) {
    if (!data) return;
    if (typeof window.jspdf === "undefined") {
        alert("PDF library not loaded. Please check your internet connection.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const PW = 297, PH = 210, M = 14;
    const UW = PW - M * 2;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB") + "  " +
        now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    // ── Page border
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(M - 3, M - 3, UW + 6, PH - (M - 3) * 2);

    // ── Dark header bar
    doc.setFillColor(12, 12, 18);
    doc.rect(M, M, UW, 13, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.text("TRUCK LOADING OPTIMIZATION REPORT", M + 5, M + 8.5);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, PW - M - 5, M + 8.5, { align: "right" });

    // ── Specs sub-line
    let cy = M + 16.5;
    doc.setTextColor(90, 90, 90);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(
        `TRUCK: ${data.truck_length}m (L) x ${data.truck_width}m (W)  |  TOTAL REQUESTED: ${data.total_requested} boxes`,
        M + 2, cy
    );
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(M, cy + 2, PW - M, cy + 2);
    cy += 6;

    // ── Analytics stat boxes
    const stats = [
        { label: "TOTAL PLACED",   value: String(data.total_placed) },
        { label: "ON FLOOR",       value: String(data.floor_count) },
        { label: "STACKED",        value: String(data.stacked_count) },
        { label: "COULD NOT FIT",  value: String(data.not_placed), alert: data.not_placed > 0 },
        { label: "FLOOR UTIL.",    value: data.utilization + "%" },
    ];
    const boxW = (UW - 2) / stats.length;
    const boxH = 15;

    stats.forEach((s, i) => {
        const bx = M + 1 + i * boxW;
        doc.setLineWidth(0.25);
        if (s.alert) {
            doc.setDrawColor(160, 0, 0);
            doc.setFillColor(255, 242, 242);
        } else {
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(248, 248, 248);
        }
        doc.rect(bx, cy, boxW - 1, boxH, "FD");
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(s.alert ? 160 : 15, 0, 0);
        if (!s.alert) doc.setTextColor(15, 15, 15);
        doc.text(s.value, bx + (boxW - 1) / 2, cy + 8.5, { align: "center" });
        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(s.label, bx + (boxW - 1) / 2, cy + 13.5, { align: "center" });
    });
    cy += boxH + 5;

    // ── Section: Floor Plan
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("TOP-DOWN FLOOR PLAN", M + 2, cy);
    doc.setLineWidth(0.2);
    doc.setDrawColor(120, 120, 120);
    doc.line(M, cy + 1.5, PW - M, cy + 1.5);
    cy += 5;

    const sideGap = 11;
    const truckW_mm = UW - sideGap - 2;
    const truckH_mm = truckW_mm * (data.truck_width / data.truck_length);
    const truckX = M + sideGap;
    const truckY = cy + 5;

    // Dimension arrows
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.25);
    doc.line(truckX, cy + 1.5, truckX + truckW_mm, cy + 1.5);
    doc.line(truckX, cy + 0.2, truckX, cy + 2.8);
    doc.line(truckX + truckW_mm, cy + 0.2, truckX + truckW_mm, cy + 2.8);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(data.truck_length + "m", truckX + truckW_mm / 2, cy, { align: "center" });
    const sideX = M + sideGap - 3;
    doc.line(sideX, truckY, sideX, truckY + truckH_mm);
    doc.line(sideX - 1.5, truckY, sideX + 1.5, truckY);
    doc.line(sideX - 1.5, truckY + truckH_mm, sideX + 1.5, truckY + truckH_mm);
    doc.text(data.truck_width + "m", sideX - 1, truckY + truckH_mm / 2 + 1.5, { angle: 90, align: "center" });

    const bwCanvas = drawTruckBW(data);
    doc.addImage(bwCanvas.toDataURL("image/png"), "PNG", truckX, truckY, truckW_mm, truckH_mm);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(truckX, truckY, truckW_mm, truckH_mm);

    cy = truckY + truckH_mm + 10;

    // ── Unplaced breakdown
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("UNLOADED BOXES", M + 2, cy);
    doc.setLineWidth(0.2);
    doc.setDrawColor(180, 180, 180);
    doc.line(M, cy + 1.5, PW - M, cy + 1.5);
    cy += 4;

    const allBreakdown = data.unplacedBreakdown || [];
    const numCards = allBreakdown.length || 4;
    const cardW = (UW - numCards * 2) / numCards;
    const cardH = 14;

    const customTypes = getCustomTypes();

    allBreakdown.forEach((item, i) => {
        const cx  = M + 1 + i * (cardW + 2);
        const isA = item.type === "american";
        const isE = item.type === "european";
        const isCustom = !isA && !isE;
        const has = item.count > 0;

        let topR = 225, topG = 112, topB = 85; // default american
        if (isE) { topR = 0; topG = 184; topB = 148; }
        if (isCustom) {
            const cidx = customTypes.findIndex(ct => ct.id === item.type);
            const hex = getCustomColor(cidx >= 0 ? cidx : 0);
            topR = parseInt(hex.slice(1,3),16);
            topG = parseInt(hex.slice(3,5),16);
            topB = parseInt(hex.slice(5,7),16);
        }

        if (has) {
            doc.setFillColor(Math.min(255, topR + 30), Math.min(255, topG + 70), Math.min(255, topB + 70));
            doc.setDrawColor(topR, topG, topB);
        } else {
            doc.setFillColor(248, 248, 248);
            doc.setDrawColor(210, 210, 210);
        }
        doc.setLineWidth(0.3);
        doc.rect(cx, cy, cardW, cardH, "FD");

        doc.setFillColor(topR, topG, topB);
        doc.rect(cx, cy, cardW, 1.2, "F");

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        if (!has)  doc.setTextColor(190, 190, 190);
        else       doc.setTextColor(Math.max(0, topR - 25), Math.max(0, topG - 30), Math.max(0, topB - 30));
        doc.text(String(item.count), cx + cardW / 2, cy + 8, { align: "center" });

        doc.setFontSize(4.8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(110, 110, 110);
        doc.text(item.label, cx + cardW / 2, cy + 12.5, { align: "center" });
    });

    cy += cardH + 4;

    // ── Legend
    doc.setTextColor(0);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("LEGEND:", M + 2, cy);

    const legendItems = [
        { label: "American / Stackable",     am: true,  sk: true,  st: false },
        { label: "American / Non-stackable", am: true,  sk: false, st: false },
        { label: "European / Stackable",     am: false, sk: true,  st: false },
        { label: "European / Non-stackable", am: false, sk: false, st: false },
        { label: "Stacked (2nd layer)",      am: true,  sk: true,  st: true  },
    ];

    // Add custom types to legend
    customTypes.forEach((ct, idx) => {
        const c = getCustomColor(idx);
        legendItems.splice(legendItems.length - 1, 0,
            { label: ct.name + " / S",  customColor: c, sk: true,  st: false },
            { label: ct.name + " / NS", customColor: c, sk: false, st: false },
        );
    });

    const legItemW = (UW - 20) / legendItems.length;
    legendItems.forEach((item, i) => {
        const lx = M + 18 + i * legItemW;
        let sw;
        if (item.customColor) {
            sw = createColorSwatchCanvas(item.customColor, item.sk, item.st);
        } else {
            sw = createSwatchCanvas(item.am, item.sk, item.st);
        }
        doc.addImage(sw.toDataURL("image/png"), "PNG", lx, cy - 3.5, 9, 6);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(45, 45, 45);
        doc.text(item.label, lx + 10.5, cy);
    });

    // ── Footer
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.line(M, PH - M - 4, PW - M, PH - M - 4);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.setFont("times", "italic");
    doc.text("by Ouertani", M, PH - M - 1.5);
    doc.setFont("helvetica", "normal");
    doc.text("Page 1 / 1", PW - M, PH - M - 1.5, { align: "right" });

    doc.save("truck-loading-report.pdf");
}

// BW canvas for PDF
function drawTruckBW(data) {
    const canvas = document.createElement("canvas");
    const TRUCK_W = data.truck_width;
    const TRUCK_L = data.truck_length;
    const SCALE = 200;
    const PAD = 16;

    canvas.width  = Math.round(TRUCK_L * SCALE + PAD * 2);
    canvas.height = Math.round(TRUCK_W * SCALE + PAD * 2);

    const ctx = canvas.getContext("2d");
    const labelMap = buildLabelMap();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f9f9f9";
    ctx.fillRect(PAD, PAD, TRUCK_L * SCALE, TRUCK_W * SCALE);

    ctx.strokeStyle = "rgba(0,0,0,0.09)";
    ctx.lineWidth = 0.7;
    ctx.setLineDash([4, 8]);
    for (let x = 0; x <= TRUCK_L; x += 1.2) {
        const cx = PAD + x * SCALE;
        ctx.beginPath(); ctx.moveTo(cx, PAD); ctx.lineTo(cx, PAD + TRUCK_W * SCALE); ctx.stroke();
    }
    for (let y = 0; y <= TRUCK_W; y += 0.4) {
        const cy = PAD + y * SCALE;
        ctx.beginPath(); ctx.moveTo(PAD, cy); ctx.lineTo(PAD + TRUCK_L * SCALE, cy); ctx.stroke();
    }
    ctx.setLineDash([]);

    const floor   = data.placed.filter(b => !b.stacked);
    const stacked = data.placed.filter(b =>  b.stacked);
    floor.forEach(b   => drawBoxBW(ctx, b, SCALE, PAD, labelMap, false));
    stacked.forEach(b => drawBoxBW(ctx, b, SCALE, PAD, labelMap, true));

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3.5;
    ctx.strokeRect(PAD, PAD, TRUCK_L * SCALE, TRUCK_W * SCALE);

    return canvas;
}

function drawBoxBW(ctx, box, scale, pad, labelMap, isStacked) {
    const x = pad + box.y * scale;
    const y = pad + box.x * scale;
    const w = box.h * scale;
    const h = box.w * scale;

    const isAmerican = box.type === "american";
    const isStackable = box.stackable;

    ctx.fillStyle = isStacked ? "#dcdcdc" : (isStackable ? "#f2f2f2" : "#e8e8e8");
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.clip();

    const spacing = isStackable ? 8 : 16;
    const alpha   = isStacked ? 0.18 : (isStackable ? 0.48 : 0.28);
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 1.0;

    for (let i = -(h + w); i < w + h; i += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + i,     y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
    }
    if (!isAmerican && box.type === "european") {
        for (let i = -(h + w); i < w + h; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + w - i,     y);
            ctx.lineTo(x + w - i - h, y + h);
            ctx.stroke();
        }
    }
    ctx.restore();

    ctx.strokeStyle = isStacked ? "#888888" : "#1c1c1c";
    ctx.lineWidth   = isStacked ? 1.0 : 1.8;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    const minDim = Math.min(w, h);
    if (minDim > 22) {
        const fs = minDim > 60 ? 16 : 11;
        ctx.fillStyle = isStacked ? "#666" : "#000";
        ctx.font = `bold ${fs}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lbl = labelMap[box.type] || box.type.substring(0, 3).toUpperCase();
        const sub = isStacked ? "x2" : (isStackable ? "S" : "NS");
        ctx.fillText(lbl, x + w / 2, y + h / 2 - (sub ? 6 : 0));
        ctx.font = `${fs - 4}px Arial, sans-serif`;
        ctx.fillStyle = isStacked ? "#999" : "#444";
        ctx.fillText(sub, x + w / 2, y + h / 2 + 7);
    }
}

// Creates a small swatch canvas for the PDF legend
function createSwatchCanvas(isAmerican, isStackable, isStacked) {
    const c = document.createElement("canvas");
    c.width = 72; c.height = 44;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 72, 44);
    ctx.fillStyle = isStacked ? "#dcdcdc" : (isStackable ? "#f2f2f2" : "#e8e8e8");
    ctx.fillRect(1, 1, 70, 42);

    ctx.save();
    ctx.beginPath();
    ctx.rect(1, 1, 70, 42);
    ctx.clip();

    const spacing = isStackable ? 8 : 16;
    const alpha   = isStacked ? 0.18 : (isStackable ? 0.48 : 0.28);
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 1.0;
    for (let i = -50; i < 130; i += spacing) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 50, 50); ctx.stroke();
    }
    if (!isAmerican) {
        for (let i = -50; i < 130; i += spacing) {
            ctx.beginPath(); ctx.moveTo(70 - i, 0); ctx.lineTo(70 - i - 50, 50); ctx.stroke();
        }
    }
    ctx.restore();

    ctx.strokeStyle = isStacked ? "#888" : "#1c1c1c";
    ctx.lineWidth   = isStacked ? 1.0 : 1.8;
    ctx.strokeRect(1, 1, 70, 42);
    return c;
}

// Color swatch for custom types in PDF legend
function createColorSwatchCanvas(hexColor, isStackable, isStacked) {
    const c = document.createElement("canvas");
    c.width = 72; c.height = 44;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 72, 44);

    const alpha = isStacked ? 0.35 : (isStackable ? 0.70 : 0.40);
    ctx.fillStyle = hexToRgba(hexColor, alpha);
    ctx.fillRect(1, 1, 70, 42);

    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(1, 1, 70, 42);
    return c;
}

// ── Init: render custom cards on page load ────────────────────────────
document.addEventListener("DOMContentLoaded", renderCustomCards);
