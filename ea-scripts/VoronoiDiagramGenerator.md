/*
This script generates a Voronoi diagram from selected elements on the drawing canvas.

The following parameters can be set in 'Voronoi Settings' window pop-up once the script is started:
- Frame width (default: 100)
- Roughness (default: 0)
- Stroke width (default: 2)
- Grouping (default: checked)

Setting parameters could be set back to default values by click on button 'Default'.

See background information about Voronoi diagram at Wikipedia : https://en.wikipedia.org/wiki/Voronoi_diagram

Comments and discussion are welcomed in the Sketch-Your-Mind community: https://community.sketch-your-mind.com

```js*/


ea.clear();

const DEFAULTS = {
    frameWidth: 100,
    roughness: 0,
    strokeWidth: 2,
    groupVoronoi: true
};

let config = ea.getScriptSettings() || { ...DEFAULTS };

async function openSettings() {
    return new Promise((resolve) => {
        const modal = new ea.obsidian.Modal(app);
        modal.contentEl.style.frameWidth = "20px"; // External clearance of the entire window
        modal.contentEl.createEl("h2", { text: "Voronoi Settings" });
        
        const inputs = {};

        // Support function with better layout
        const createInput = (label, key, type = "number") => {
            const container = modal.contentEl.createDiv();
            container.style.marginBottom = "15px"; // Distance between input blocks
            
            container.createEl("label", { text: label, cls: "setting-item-name" });
            const input = container.createEl("input", { type: type });
            input.style.display = "block";
            input.style.marginTop = "5px"; // Distance between label and input
            input.value = config[key];
            input.onchange = (e) => config[key] = type === "number" ? Number(e.target.value) : e.target.checked;
            inputs[key] = input;
        };

        createInput("Framing width:", "frameWidth");
        createInput("Roughness (0-3):", "roughness");
        createInput("Stroke width:", "strokeWidth");

        // Checkbox section
        const checkContainer = modal.contentEl.createDiv();
        checkContainer.style.marginBottom = "25px";
        const label = checkContainer.createEl("label", { text: "Grouping: " });
        inputs.groupVoronoi = checkContainer.createEl("input", { type: "checkbox" });
        inputs.groupVoronoi.checked = config.groupVoronoi;
        inputs.groupVoronoi.onchange = (e) => config.groupVoronoi = e.target.checked;

        // Button section
        const btnContainer = modal.contentEl.createDiv();
        btnContainer.style.display = "flex";
        btnContainer.style.gap = "10px"; // Distance between buttons
        btnContainer.style.justifyContent = "flex-end"; // Buttons to the right

        const btnDefault = btnContainer.createEl("button", { text: "Default" });
        const btnOk = btnContainer.createEl("button", { text: "OK" });

        btnDefault.onclick = () => {
            config = { ...DEFAULTS };
            inputs.frameWidth.value = config.frameWidth;
            inputs.roughness.value = config.roughness;
            inputs.strokeWidth.value = config.strokeWidth;
            inputs.groupVoronoi.checked = config.groupVoronoi;
            new Notice("Values reset to default");
        };

        btnOk.onclick = () => {
            ea.setScriptSettings(config);
            modal.close();
            resolve(true);
        };

        modal.open();
    });
}

// Waiting for dialog window
await openSettings();

// --- The actual algorithm ---
const els = ea.getViewSelectedElements();
if (els.length < 2) {
    new Notice("Please select at least two items!");
    return;
}

const seeds = els.map(el => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 }));
if (seeds.length < 2) { new Notice("Please select circles"); return; }

const minX = Math.min(...seeds.map(s => s.x)) - config.frameWidth;
const minY = Math.min(...seeds.map(s => s.y)) - config.frameWidth;
const maxX = Math.max(...seeds.map(s => s.x)) + config.frameWidth;
const maxY = Math.max(...seeds.map(s => s.y)) + config.frameWidth;

const bbox = [{x:minX, y:minY}, {x:maxX, y:minY}, {x:maxX, y:maxY}, {x:minX, y:maxY}];

function clipPolygon(poly, p1, p2) {
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const n = { x: p2.x - p1.x, y: p2.y - p1.y };
    const isInside = (p) => (p.x - mid.x) * n.x + (p.y - mid.y) * n.y <= 0;
    const intersect = (a, b) => {
        const num = (a.x - mid.x) * n.x + (a.y - mid.y) * n.y;
        const den = (b.x - a.x) * n.x + (b.y - a.y) * n.y;
        if (den === 0) return null;
        const t = -num / den;
        return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    };
    const result = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const prev = poly[(i - 1 + poly.length) % poly.length];
        const curIn = isInside(cur);
        const prevIn = isInside(prev);
        if (curIn !== prevIn) { const ix = intersect(prev, cur); if (ix) result.push(ix); }
        if (curIn) result.push(cur);
    }
    return result;
}

const polygons = seeds.map((_, i) => {
    let poly = [...bbox];
    seeds.forEach((_, j) => { if (i !== j) poly = clipPolygon(poly, seeds[i], seeds[j]); });
    return poly;
});

ea.style.roughness = config.roughness;
ea.style.strokeWidth = config.strokeWidth;
ea.style.backgroundColor = "transparent";

const ids = [];
for (const poly of polygons) {
    if (poly.length < 3) continue;
    const points = poly.map(p => [p.x, p.y]);
    points.push(points[0]);
    ids.push(ea.addLine(points));
}

if (config.groupVoronoi && ids.length > 0) ea.addToGroup(ids);
await ea.addElementsToView(false, false);
new Notice("Voronoi diagram created!");