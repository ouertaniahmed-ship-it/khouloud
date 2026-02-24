function step(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) || 0;
    val = Math.max(0, val + delta);
    input.value = val;
}

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

        displayResults(data);
    } catch (err) {
        alert("Request failed: " + err.message);
    } finally {
        btn.disabled = false;
        btnText.textContent = "Optimize Loading";
        btnLoader.style.display = "none";
    }
}

function displayResults(data) {
    const section = document.getElementById("results");
    section.style.display = "block";

    document.getElementById("stat-placed").textContent = data.total_placed;
    document.getElementById("stat-floor").textContent = data.floor_count;
    document.getElementById("stat-stacked").textContent = data.stacked_count;
    document.getElementById("stat-unplaced").textContent = data.not_placed;
    document.getElementById("stat-util").textContent = data.utilization + "%";

    drawTruck(data);

    section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function drawTruck(data) {
    const canvas = document.getElementById("truck-canvas");
    const ctx = canvas.getContext("2d");

    const TRUCK_W = data.truck_width;
    const TRUCK_L = data.truck_length;

    // Scale: make truck fill canvas nicely
    const SCALE = 60; // pixels per meter
    const PAD = 4;

    canvas.width = TRUCK_W * SCALE + PAD * 2;
    canvas.height = TRUCK_L * SCALE + PAD * 2;

    // Background
    ctx.fillStyle = "#1a1d27";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Truck floor
    ctx.fillStyle = "#232734";
    ctx.fillRect(PAD, PAD, TRUCK_W * SCALE, TRUCK_L * SCALE);

    // Grid lines (every 0.4m)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= TRUCK_W; x += 0.4) {
        ctx.beginPath();
        ctx.moveTo(PAD + x * SCALE, PAD);
        ctx.lineTo(PAD + x * SCALE, PAD + TRUCK_L * SCALE);
        ctx.stroke();
    }
    for (let y = 0; y <= TRUCK_L; y += 0.4) {
        ctx.beginPath();
        ctx.moveTo(PAD, PAD + y * SCALE);
        ctx.lineTo(PAD + TRUCK_W * SCALE, PAD + y * SCALE);
        ctx.stroke();
    }

    const colors = {
        american_stackable: { fill: "rgba(225, 112, 85, 0.75)", stroke: "#e17055" },
        american_non_stackable: { fill: "rgba(225, 112, 85, 0.4)", stroke: "#e17055" },
        european_stackable: { fill: "rgba(0, 184, 148, 0.75)", stroke: "#00b894" },
        european_non_stackable: { fill: "rgba(0, 184, 148, 0.4)", stroke: "#00b894" },
    };

    // Draw floor boxes first, then stacked
    const floorBoxes = data.placed.filter(b => !b.stacked);
    const stackedBoxes = data.placed.filter(b => b.stacked);

    for (const box of floorBoxes) {
        drawBox(ctx, box, SCALE, PAD, colors, false);
    }

    for (const box of stackedBoxes) {
        drawBox(ctx, box, SCALE, PAD, colors, true);
    }

    // Truck border
    ctx.strokeStyle = "#4a4e69";
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, TRUCK_W * SCALE, TRUCK_L * SCALE);
}

function drawBox(ctx, box, scale, pad, colors, isStacked) {
    const x = pad + box.x * scale;
    const y = pad + box.y * scale;
    const w = box.w * scale;
    const h = box.h * scale;

    const key = box.type + "_" + (box.stackable ? "stackable" : "non_stackable");
    const color = colors[key];

    // Fill
    ctx.fillStyle = color.fill;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    // Stacked pattern (diagonal stripes)
    if (isStacked) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 1, w - 2, h - 2);
        ctx.clip();

        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        const step = 6;
        for (let i = -h; i < w + h; i += step) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + h, y + h);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Border
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    // Label
    const fontSize = Math.min(w, h) > 35 ? 9 : 7;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const label = box.type === "american" ? "AM" : "EU";
    const sublabel = isStacked ? "x2" : (box.rotated ? "R" : "");

    ctx.fillText(label, x + w / 2, y + h / 2 - (sublabel ? 4 : 0));
    if (sublabel) {
        ctx.font = `${fontSize - 1}px -apple-system, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(sublabel, x + w / 2, y + h / 2 + 6);
    }
}
