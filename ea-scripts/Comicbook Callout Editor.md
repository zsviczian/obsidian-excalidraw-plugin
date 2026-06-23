/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-comicbook-callout-editor.jpg)

```js
# Comic Book Callouts & Speech Bubbles Generator
A highly modular, versatile script for creating comic-book style speech bubbles, thought clouds, screams, and narrative boxes within Excalidraw. 

Features:
- Live SVG Preview with correct padding and scale
- Preset saving and loading (manage your own callout styles)
- Edit & Replace existing callouts seamlessly (context-aware, prevents background insertions)
- High-density polygon generation for perfect shapes, or low-density for dashed/dotted lines
- Customizable base shapes (Oval, Box, Cloud, Spiky, Heart, Polygon, Ribbon)
- Polygon rotation and Box corner roundness sliders
- Base shape random explosion spikes with Randomize toggle for "Scream" bubbles
- Various stem types (V-Shape, Curvy V, Lightning, Bubbles, Line) with adjustable position and bend
- Sharp vs Rounded edge controls to fix crossing artifacts
- Thought bubble size and spacing profiles
- Granular color and appearance controls (Text, Stroke, Fill, Roughness)
- Clean, scrollbar-free side panel layout with non-destructive UI updating

### Architecture Notes for Future Extensibility:
1. **State Management**: The `state` object holds all parameters. Adding a new parameter means adding it to `DEFAULT_STATE`, creating a UI control for it, and using it in `buildElements()`.
   - When saving metadata to Excalidraw's `customData`, `state` is deep-cloned to prevent shared reference mutations across multiple inserted callouts.
2. **Shape Generation Pipeline**:
   - `generateBaseShape(rx, ry)`: Creates the closed perimeter of the main bubble.
   - `injectStem(basePts, rx, ry)`: Splices the tail/stem into the base perimeter array.
   - `buildElements(isFinal)`: Constructs the Excalidraw elements (Polygon + Text + Extras) into the EA workbench.
   - `renderPreview(previewContainer)`: Generates an SVG snapshot for the live preview pane.
3. **UI & Event Handling**:
   - DOM elements (like action buttons and text areas) are preserved and updated during `onFocus` rather than destroyed to prevent interaction bugs (e.g., requiring double-clicks to insert).
   - Action buttons dynamically enable/disable based on whether the active workspace leaf matches the script's target Excalidraw view.
*/

// ---------------------------------------------------------
// 1. Constants & State Initialization
// ---------------------------------------------------------
const st = () => ea.targetView ? ea.getExcalidrawAPI()?.getAppState() : null;
const SCRIPT_SETTINGS_KEY = "ComicBubbles_Settings_V5";

// The default parameters requested for the script
const DEFAULT_STATE = {
  "text": "What a beautiful day\nto draw comics!",
  "shapeType": "cloud",
  "stemType": "curvy_v",
  "strokeSharpness": "sharp",
  "pathResolution": 50,
  "cornerRoundness": 0.2,
  "bumpCount": 15,
  "bumpDepth": 0.15,
  "bumpVariance": 0,
  "randomVariance": false,
  "polySides": 6,
  "polyRotation": 0,
  "heightRatio": 1,
  "stemPosition": 35,
  "stemBend": -65,
  "stemLength": 110,
  "stemWidth": 8,
  "ribbonEnds": "both",
  "addSpikes": false,
  "spikeCount": 3,
  "spikeWidth": 5,
  "spikeHeight": 30,
  "spikeDist": "Even",
  "bubbleCount": 3,
  "bubbleShrink": 30,
  "wrapWidth": 250,
  "textMargin": 35,
  "strokeStyle": "solid",
  "strokeWidth": 1,
  "roughness": 0,
  "fontFamily": 5,
  "fontSize": 16,
  "textColor": "black",
  "bgColor": "#ffffff",
  "strokeColor": "black",
  "bgOpacity": 100
};

// SVG Icons for the Shape Selector Buttons
const SHAPES = [
  { id: "oval", name: "Oval", svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="40" ry="25" fill="none" stroke="currentColor" stroke-width="6"/></svg>` },
  { id: "box", name: "Rectangle / Box", svg: `<svg viewBox="0 0 100 100"><rect x="15" y="25" width="70" height="50" rx="10" fill="none" stroke="currentColor" stroke-width="6"/></svg>` },
  { id: "cloud", name: "Cloud", svg: `<svg viewBox="0 0 100 100"><path d="M 25 50 a 15 15 0 0 1 15 -15 a 20 20 0 0 1 35 5 a 15 15 0 0 1 10 20 a 15 15 0 0 1 -15 15 l -30 0 a 15 15 0 0 1 -15 -25 z" fill="none" stroke="currentColor" stroke-width="6"/></svg>` },
  { id: "spiky", name: "Spiky / Scream", svg: `<svg viewBox="0 0 100 100"><path d="M 50 15 L 60 35 L 85 30 L 70 50 L 85 70 L 60 65 L 50 85 L 40 65 L 15 70 L 30 50 L 15 30 L 40 35 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/></svg>` },
  { id: "heart", name: "Heart", svg: `<svg viewBox="0 0 100 100"><path d="M 50 85 C 50 85 15 55 15 35 C 15 20 30 15 40 25 C 50 35 50 35 50 35 C 50 35 50 35 60 25 C 70 15 85 20 85 35 C 85 55 50 85 50 85 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/></svg>` },
  { id: "polygon", name: "Polygon", svg: `<svg viewBox="0 0 100 100"><polygon points="25,20 75,20 95,50 75,80 25,80 5,50" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/></svg>` },
  { id: "ribbon", name: "Ribbon", svg: `<svg viewBox="0 0 100 100"><polygon points="10,25 90,25 75,50 90,75 10,75 25,50" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/></svg>` },
];

// Global State & User Data Variables
let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let editTarget = null; // Stores IDs if we are replacing an existing callout
let presets = {};
let activePresetName = "Default";
let previewTimeout;

// Global UI Node Variables (Replaces old modal variables)
let tabsContainer, inputsContainer, previewWrapper, previewContainer, actionsContainer;
let mainScrollContainer;
let activeTab = "baseShape";
let pathResSliderComp;
let textAreaComp;


/**
 * Loads preferences from Obsidian/Excalidraw settings and applies the active preset.
 */
function initializeStateAndPresets() {
  const scriptSettings = ea.getScriptSettings() || {};
  if (!scriptSettings[SCRIPT_SETTINGS_KEY]) {
    scriptSettings[SCRIPT_SETTINGS_KEY] = {
      presets: { "Default": JSON.parse(JSON.stringify(DEFAULT_STATE)) },
      lastUsedPreset: "Default"
    };
  }
  presets = scriptSettings[SCRIPT_SETTINGS_KEY].presets || { "Default": JSON.parse(JSON.stringify(DEFAULT_STATE)) };
  activePresetName = scriptSettings[SCRIPT_SETTINGS_KEY].lastUsedPreset || "Default";

  // Apply the last used preset if it exists
  if (presets[activePresetName]) {
    Object.assign(state, presets[activePresetName]);
  }
}

/**
 * Checks the active selection on the Excalidraw canvas to see if we are editing an existing callout.
 */
function detectEditTarget() {
  const oldTargetId = editTarget ? editTarget.polyId : null;
  editTarget = null;  
  
  // Safe exit if no view is bound yet (e.g., during Obsidian startup)
  if (!ea.targetView) return; 
  
  const selectedEls = ea.getViewSelectedElements();
  if (!selectedEls || selectedEls.length === 0) return;

  let mainPoly = selectedEls.find(el => el.customData && el.customData.comicCallout);

  if (mainPoly) {
    const calloutData = mainPoly.customData.comicCallout;
    const expectedIds = mainPoly.customData.comicCalloutIds || [];
    const selectedIds = selectedEls.map(e => e.id);
    
    // Check if exactly the original elements were selected
    const isExactMatch = expectedIds.length === selectedIds.length && expectedIds.every(id => selectedIds.includes(id));
    
    let isValidInference = isExactMatch;
    let newAllIds = [...expectedIds];
    let textEl = null;
    
    if (!isExactMatch) {
      const textEls = selectedEls.filter(e => e.type === "text");
      const polyEls = selectedEls.filter(e => e.type === "line" && e.polygon);
      
      // If the selection has 1 text and at least 1 polygon, it's a duplicated callout we can infer
      if (textEls.length === 1 && polyEls.length >= 1) {
        isValidInference = true;
        newAllIds = selectedIds;
        textEl = textEls[0];
      }
    } else {
      // If it's an exact match, find the text element within the selection
      textEl = selectedEls.find(e => e.type === "text");
    }
    
    // ALWAYS update text in settings if the user edited the text element in the scene
    if (isValidInference && textEl && textEl.originalText && textEl.originalText !== calloutData.text) {
      calloutData.text = textEl.originalText;
      // If we are still focused on the same target, push the scene-edited text up to the state
      if (oldTargetId === mainPoly.id) {
        state.text = textEl.originalText;
      }
    }
    
    if (isValidInference) {
      // ONLY overwrite the editor settings if the user actually selected a different callout
      if (oldTargetId !== mainPoly.id) {
        Object.assign(state, calloutData);
      }
      
      editTarget = {
        polyId: mainPoly.id,
        allIds: newAllIds
      };
    }
  }
}

// Helper to save preferences back to Obsidian
async function savePrefs() {
  let s = ea.getScriptSettings() || {};
  if (!s[SCRIPT_SETTINGS_KEY]) s[SCRIPT_SETTINGS_KEY] = {};
  s[SCRIPT_SETTINGS_KEY].presets = presets;
  s[SCRIPT_SETTINGS_KEY].lastUsedPreset = activePresetName;
  await ea.setScriptSettings(s);
}

// ---------------------------------------------------------
// 2. Geometry & Math Generators
// ---------------------------------------------------------

/**
 * Pseudo-random generator for reproducible jitter in explosion spikes and bumpy shapes.
 * 
 * @param {number} seed - The numerical seed value to initialize the pseudo-random calculation.
 * @returns {number} A deterministic pseudo-random float between 0 and 1.
 */
function pseudoRandom(seed) {
  let x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Determines the target point count for the perimeter.
 * Lower density is required for dashed/dotted strokes so the gaps render properly.
 * Higher density is needed for complex curves.
 */
function getPointCount() {
  if (state.shapeType === "cloud" || state.shapeType === "spiky") {
    // Balance pathResolution with a minimum required for bumps so it doesn't collapse,
    // without inflating the point count to the point of ruining dashed lines.
    return Math.max(Math.floor(state.pathResolution * 3), state.bumpCount * 3);
  }
  return Math.max(10, Math.floor(state.pathResolution * 3));
}

/**
 * Normalizes an arbitrary set of points to be centered at 0,0 
 * and scaled to the specified X and Y radii.
 * 
 * @param {number[][]} pts - An array of [x, y] coordinate pairs to normalize.
 * @param {number} rx - The target horizontal radius (X-axis scaling factor).
 * @param {number} ry - The target vertical radius (Y-axis scaling factor).
 * @returns {number[][]} A new array of scaled and centered [x, y] coordinate pairs.
 */
function normalizeAndScale(pts, rx, ry) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  });

  const scaleX = (rx * 2) / (maxX - minX || 1);
  const scaleY = (ry * 2) / (maxY - minY || 1);
  const cx = (maxX + minX) / 2;
  const cy = (maxY + minY) / 2;

  return pts.map(p => [
    (p[0] - cx) * scaleX,
    (p[1] - cy) * scaleY
  ]);
}

/**
 * Takes a low-density polygon (like a box or ribbon) and inserts 
 * evenly spaced points along its perimeter.
 * 
 * @param {number[][]} vertices - An array of the polygon's original [x, y] vertices.
 * @param {number} N - The target total number of points to generate along the perimeter.
 * @returns {number[][]} An array of interpolated [x, y] coordinate pairs forming the higher-density perimeter.
 */
function interpolatePolygon(vertices, N) {
  if (vertices.length === 0) return [];
  let totalLen = 0;
  const segments = [];
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    segments.push({ p1, p2, len });
    totalLen += len;
  }

  const pts = [];
  for (let seg of segments) {
    // Preserve vertices and interpolate proportional lengths cleanly
    const segPts = Math.max(1, Math.round((seg.len / totalLen) * N));
    for (let i = 0; i < segPts; i++) {
      const t = i / segPts;
      pts.push([
        seg.p1[0] + t * (seg.p2[0] - seg.p1[0]),
        seg.p1[1] + t * (seg.p2[1] - seg.p1[1])
      ]);
    }
  }
  return pts;
}

/**
 * Creates an array of points forming a circular arc.
 * Used for rounded corners on boxes.
 * 
 * @param {number} cx - The X coordinate of the arc's center point.
 * @param {number} cy - The Y coordinate of the arc's center point.
 * @param {number} r - The radius of the arc.
 * @param {number} startAng - The starting angle of the arc in radians.
 * @param {number} endAng - The ending angle of the arc in radians.
 * @param {number} numPts - The number of segments/interpolated points to generate for the arc.
 * @returns {number[][]} An array of [x, y] coordinate pairs representing the curve of the arc.
 */
function createArc(cx, cy, r, startAng, endAng, numPts) {
  if (r <= 0) return [[cx, cy]];
  const pts = [];
  for (let i = 0; i <= numPts; i++) {
    const a = startAng + (i / numPts) * (endAng - startAng);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Overlays explosion "Action" spikes onto a generated base shape.
 * 
 * @param {number[][]} pts - The base shape's perimeter points as an array of [x, y] coordinates.
 * @returns {number[][]} A new array of [x, y] coordinates with the spike geometries injected.
 */
function injectSpikes(pts) {
  const validShapeTypes = ['box', 'oval', 'ribbon', 'polygon'];
  if (!state.addSpikes || state.spikeCount <= 0 || !validShapeTypes.includes(state.shapeType)) return pts;

  const newPts = [...pts];
  const N = newPts.length;
  const step = N / state.spikeCount;

  for (let i = 0; i < state.spikeCount; i++) {
    let jitter = (state.spikeDist === "Random") ? (pseudoRandom(i + 100) - 0.5) * (step * 0.6) : 0;
    let centerIdx = Math.floor(i * step + jitter + N) % N;

    let spikeWidthPts = Math.floor(N * (state.spikeWidth / 100));
    if (spikeWidthPts < 2) spikeWidthPts = 2;
    let half = Math.floor(spikeWidthPts / 2);

    const p1 = newPts[(centerIdx - half + N) % N];
    const p2 = newPts[(centerIdx + half) % N];

    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2;
    const dirAng = Math.atan2(cy, cx);
    const tip = [cx + Math.cos(dirAng) * state.spikeHeight, cy + Math.sin(dirAng) * state.spikeHeight];

    // Replace the section of points with a V-shape extending to the tip
    for (let j = -half + 1; j < half; j++) {
      let idx = (centerIdx + j + N) % N;
      let t = (j + half) / spikeWidthPts;
      if (t < 0.5) {
        let t2 = t * 2;
        newPts[idx] = [p1[0] + t2 * (tip[0] - p1[0]), p1[1] + t2 * (tip[1] - p1[1])];
      } else {
        let t2 = (t - 0.5) * 2;
        newPts[idx] = [tip[0] + t2 * (p2[0] - tip[0]), tip[1] + t2 * (p2[1] - tip[1])];
      }
    }
  }
  return newPts;
}

/**
 * Calculates the full perimeter of the callout (excluding the stem).
 * Ensures ALL shapes start their point array at Angle 0 (Right/3 o'clock)
 * so that the stem position percentage is visually consistent across all shapes.
 * 
 * @param {number} rx - The horizontal radius for generating the base shape.
 * @param {number} ry - The vertical radius for generating the base shape.
 * @returns {number[][]} An array of [x, y] coordinate pairs representing the shape's perimeter.
 */
function generateBaseShape(rx, ry) {
  let pts = [];
  const N = getPointCount();

  if (state.shapeType === 'spiky') {
    // Precise generation for screams/stars
    const numPoints = state.bumpCount * 2;
    for (let i = 0; i < numPoints; i++) {
      const a = (i / numPoints) * 2 * Math.PI;
      const rawV = state.randomVariance ? pseudoRandom(i + 42) : (Math.sin(i * 13.579) * 0.5 + 0.5);
      let r;
      if (i % 2 === 0) {
        // Peak (outer point)
        const peakVariance = state.bumpVariance > 0 ? (rawV * (state.bumpVariance / 100) * 0.5) : 0;
        r = 1.0 + peakVariance;
      } else {
        // Valley (inner point)
        const valleyVariance = state.bumpVariance > 0 ? (rawV * (state.bumpVariance / 100)) : 0;
        r = 1.0 - state.bumpDepth - (state.bumpDepth * valleyVariance);
      }
      pts.push([r * Math.cos(a) * rx, r * Math.sin(a) * ry]);
    }
    // ALWAYS interpolate to preserve exact peaks/valleys but add structural resolution
    pts = interpolatePolygon(pts, Math.max(numPoints, N));
  }
  else if (state.shapeType === 'polygon') {
    const polyVerts = [];
    const phase = (state.polyRotation * Math.PI / 180) + ((state.polySides % 2 === 0) ? (Math.PI / state.polySides) : (Math.PI / 2));
    for (let i = 0; i < state.polySides; i++) {
      const a = phase + (i / state.polySides) * 2 * Math.PI;
      polyVerts.push([Math.cos(a) * rx, Math.sin(a) * ry]);
    }
    
    // Rotate the array so the vertex closest to angle 0 (3 o'clock) is first
    let minAngle = Infinity;
    let startIdx = 0;
    for (let i = 0; i < polyVerts.length; i++) {
      let ang = Math.abs(Math.atan2(polyVerts[i][1], polyVerts[i][0]));
      if (ang < minAngle) {
        minAngle = ang;
        startIdx = i;
      }
    }
    const alignedVerts = [...polyVerts.slice(startIdx), ...polyVerts.slice(0, startIdx)];
    pts = interpolatePolygon(alignedVerts, Math.max(state.polySides, N)); 
  }
  else if (state.shapeType === 'box') {
    const r = Math.min(rx, ry) * state.cornerRoundness;
    const boxVerts = [];
    
    if (r <= 0.1) {
      // Start right-middle and go clockwise
      boxVerts.push([rx, 0], [rx, ry], [-rx, ry], [-rx, -ry], [rx, -ry]);
    } else {
      const arcPts = Math.max(3, Math.floor(N / 8));
      // Start right-middle and go clockwise appending corner arcs
      boxVerts.push([rx, 0]);
      boxVerts.push(...createArc(rx - r, ry - r, r, 0, Math.PI * 0.5, arcPts)); // Bottom-Right
      boxVerts.push(...createArc(-rx + r, ry - r, r, Math.PI * 0.5, Math.PI, arcPts)); // Bottom-Left
      boxVerts.push(...createArc(-rx + r, -ry + r, r, Math.PI, Math.PI * 1.5, arcPts)); // Top-Left
      boxVerts.push(...createArc(rx - r, -ry + r, r, Math.PI * 1.5, Math.PI * 2, arcPts)); // Top-Right
    }
    pts = interpolatePolygon(boxVerts, Math.max(boxVerts.length, N));
  }
  else if (state.shapeType === 'ribbon') {
    // Start right-middle and go clockwise
    const ribVerts = [[rx * 0.8, 0], [rx, ry], [-rx, ry], [-rx * 0.8, 0], [-rx, -ry], [rx, -ry]];
    
    if (state.ribbonEnds === "left") {
      ribVerts[0] = [rx, 0]; ribVerts[1] = [rx, ry]; ribVerts[5] = [rx, -ry];
    } else if (state.ribbonEnds === "right") {
      ribVerts[3] = [-rx, 0]; ribVerts[2] = [-rx, ry]; ribVerts[4] = [-rx, -ry];
    } else if (state.ribbonEnds === "none") {
      ribVerts[0] = [rx, 0]; ribVerts[1] = [rx, ry]; ribVerts[5] = [rx, -ry];
      ribVerts[3] = [-rx, 0]; ribVerts[2] = [-rx, ry]; ribVerts[4] = [-rx, -ry];
    }
    pts = interpolatePolygon(ribVerts, Math.max(ribVerts.length, N));
  }
  else {
    // Parametric Shapes (Oval, Heart, Cloud)
    for (let i = 0; i < N; i++) {
      const t = (i / N) * 2 * Math.PI;
      let x, y;

      if (state.shapeType === 'heart') {
        x = 16 * Math.pow(Math.sin(t), 3);
        y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        y -= 2; // center shift
        x *= rx / 16;
        y *= ry / 16;
      } else {
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        let r = 1;

        if (state.shapeType === 'cloud') {
          const rawV = state.randomVariance ? pseudoRandom(i + 123) : (Math.sin(t * state.bumpCount * 12.345) * 0.5 + 0.5);
          const v = state.bumpVariance > 0 ? rawV * (state.bumpVariance / 100) : 0;
          r *= (1 + (state.bumpDepth * (1 - v)) * Math.abs(Math.sin(state.bumpCount * t / 2)));
        }
        x = r * cosT * rx;
        y = r * sinT * ry;
      }
      pts.push([x, y]);
    }
  }

  // Cloud and Heart don't strictly need normalizeAndScale if math is right, but it ensures fitting
  if (state.shapeType === 'cloud' || state.shapeType === 'heart') {
    pts = normalizeAndScale(pts, rx, ry);
    
    // Heart naturally generates its first point at the top (12 o'clock). 
    // Rotate the array so it also aligns to Angle 0 (3 o'clock) like everything else.
    if (state.shapeType === 'heart') {
      let minAngle = Infinity;
      let startIdx = 0;
      for (let i = 0; i < pts.length; i++) {
        let ang = Math.abs(Math.atan2(pts[i][1], pts[i][0]));
        if (ang < minAngle) {
          minAngle = ang;
          startIdx = i;
        }
      }
      pts = [...pts.slice(startIdx), ...pts.slice(0, startIdx)];
    }
  }

  return injectSpikes(pts);
}

/**
 * Generates an array of points along a quadratic bezier curve.
 * 
 * @param {number[]} p0 - The starting [x, y] coordinate of the curve.
 * @param {number[]} p1 - The [x, y] control point determining the curve's bend and direction.
 * @param {number[]} p2 - The ending [x, y] coordinate of the curve.
 * @param {number} steps - The number of segments/interpolated points to generate along the curve.
 * @returns {number[][]} An array of [x, y] coordinate pairs defining the bezier curve.
 */
function getQuadraticBezier(p0, p1, p2, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push([
      mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
      mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
    ]);
  }
  return pts;
}

/**
 * Shifts the elements of an array by a given offset, wrapping elements 
 * around to the other side. Useful for putting the "splice" point in the middle.
 * 
 * @param {Array<any>} arr - The original array to be rotated.
 * @param {number} offset - The number of positions to shift the array (can be positive or negative).
 * @returns {Array<any>} A new array with its elements shifted by the offset.
 */
function rotateArray(arr, offset) {
  if (!arr || arr.length === 0) return arr;
  const k = ((offset % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/**
 * Modifies the base perimeter to include the tail/stem.
 * 
 * @param {number[][]} basePts - An array of [x, y] coordinate pairs representing the base shape's perimeter.
 * @param {number} rx - The horizontal bounding radius of the base shape.
 * @param {number} ry - The vertical bounding radius of the base shape.
 * @returns {{ polyPts: number[][], extraElements: Array<Object> }} An object containing the new perimeter points (including splicing stems), and any extra detached elements (like line stems or thought bubbles).
 */
function injectStem(basePts, rx, ry) {
  if (state.stemType === "none" || basePts.length < 3) return { polyPts: basePts, extraElements: [] };

  const N = basePts.length;

  // Map 0-100 to Perimeter Index
  let centerIdx = Math.floor((state.stemPosition / 100) * N) % N;
  const startPt = basePts[centerIdx];

  // Base direction normal approximation (from center to point)
  const dirAng = Math.atan2(startPt[1], startPt[0]);
  // Apply bend for tip calculation
  const tipAng = dirAng + (state.stemBend / 100) * (Math.PI / 2);

  const tipX = startPt[0] + Math.cos(tipAng) * state.stemLength;
  const tipY = startPt[1] + Math.sin(tipAng) * state.stemLength;
  const tip = [tipX, tipY];

  const gapSize = Math.max(2, Math.floor(N * (state.stemWidth / 100)));

  // Non-splicing stems
  if (state.stemType === "bubbles" || state.stemType === "line") {
    const extraElements = [];

    // Push the start outwards to the mathematical bounding perimeter to avoid spikes/valleys
    let safeStartX = startPt[0];
    let safeStartY = startPt[1];
    if (state.shapeType === 'cloud' || state.shapeType === 'spiky' || state.addSpikes) {
      safeStartX = Math.cos(dirAng) * rx * 1.1;
      safeStartY = Math.sin(dirAng) * ry * 1.1;
    }

    if (state.stemType === "line") {
      // Line stem gets a midpoint bend
      const dx = tipX - startPt[0];
      const dy = tipY - startPt[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const bendRatio = state.stemBend / 100;
      const bow = Math.max(15, state.stemLength * 0.4);
      const midX = startPt[0] + dx * 0.5 + nx * bow * bendRatio;
      const midY = startPt[1] + dy * 0.5 + ny * bow * bendRatio;

      // Apply second section bend
      const seg2Length = Math.hypot(tipX - midX, tipY - midY);
      const origSeg2Angle = Math.atan2(tipY - midY, tipX - midX);
      const finalSeg2Angle = origSeg2Angle + (state.lineSecondBend || 0) * Math.PI / 180;

      const finalTipX = midX + Math.cos(finalSeg2Angle) * seg2Length;
      const finalTipY = midY + Math.sin(finalSeg2Angle) * seg2Length;

      extraElements.push({ type: "line", pts: [[startPt[0], startPt[1]], [midX, midY], [finalTipX, finalTipY]] });
    } else if (state.stemType === "bubbles") {
      // Distribute bubbles proportionally along the distance vector
      const radii = [];
      let r = state.bubbleBaseRadius || Math.max(5, state.stemWidth * 1.5);
      for (let i = 0; i < state.bubbleCount; i++) {
        radii.push(r);
        r *= (1 - state.bubbleShrink / 100);
      }

      const relCenters = [0];
      for (let i = 1; i < state.bubbleCount; i++) {
        const dist = radii[i - 1] + radii[i];
        relCenters.push(relCenters[i - 1] + dist);
      }
      const maxRelCenter = relCenters[relCenters.length - 1] || 1;

      for (let i = 0; i < state.bubbleCount; i++) {
        const t = maxRelCenter === 0 ? 0 : relCenters[i] / maxRelCenter;
        const actualDist = (state.stemLength * 0.2) + (state.stemLength * 0.8) * t;
        const bx = safeStartX + Math.cos(tipAng) * actualDist;
        const by = safeStartY + Math.sin(tipAng) * actualDist;
        extraElements.push({ type: "ellipse", x: bx, y: by, w: radii[i] * 2, h: radii[i] * 2 });
      }
    }

    return { polyPts: basePts, extraElements };
  }

  // Splicing stems (v_shape, curvy_v, lightning)
  const rotated = rotateArray(basePts, centerIdx - Math.floor(N / 2));
  const spliceStart = Math.floor(N / 2) - Math.floor(gapSize / 2);

  const p1 = rotated[spliceStart];
  const p2 = rotated[spliceStart + gapSize - 1] || rotated[rotated.length - 1];
  const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

  let stemPts = [];
  if (state.stemType === "v_shape") {
    stemPts = [p1, tip, p2];
  }
  else if (state.stemType === "curvy_v") {
    const bow = Math.max(15, state.stemLength * 0.4);

    const dx = tip[0] - mid[0];
    const dy = tip[1] - mid[1];
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;

    if (state.invertBend) {
      nx = -nx;
      ny = -ny;
    }

    // Use constant bow in normal direction to prevent overlapping/crossing.
    const cx1 = p1[0] + (tip[0] - p1[0]) * 0.5 + nx * bow;
    const cy1 = p1[1] + (tip[1] - p1[1]) * 0.5 + ny * bow;

    const cx2 = tip[0] * 0.5 + p2[0] * 0.5 + nx * bow;
    const cy2 = tip[1] * 0.5 + p2[1] * 0.5 + ny * bow;

    const curveSteps = state.strokeSharpness === "sharp" ? 25 : 10;
    stemPts.push(...getQuadraticBezier(p1, [cx1, cy1], tip, curveSteps));
    stemPts.push(...getQuadraticBezier(tip, [cx2, cy2], p2, curveSteps));
  }
  else if (state.stemType === "lightning") {
    // Dynamic Lightning zig-zag math
    const dx = tip[0] - mid[0];
    const dy = tip[1] - mid[1];

    const w = Math.max(10, state.stemWidth * 1.5);
    const sections = state.lightningSections || 1;
    const outPts = [];
    const inPts = [];

    // Base half-width vectors (keeps the stem thick and parallel)
    const bwX = p1[0] - mid[0];
    const bwY = p1[1] - mid[1];

    // Normal vector for shifting left/right
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const step = 1 / (sections + 1);

    for (let i = 1; i <= sections; i++) {
      // Zig advances forward, Zag cuts horizontally backwards
      const t_zig = i * step;
      const t_zag = i * step - (step * 0.3);

      // Shift the entire stem centerline left and right
      const shift_zig = w;
      const shift_zag = -w * 0.5;

      const cx_zig = mid[0] + dx * t_zig + nx * shift_zig;
      const cy_zig = mid[1] + dy * t_zig + ny * shift_zig;

      const cx_zag = mid[0] + dx * t_zag + nx * shift_zag;
      const cy_zag = mid[1] + dy * t_zag + ny * shift_zag;

      // Outward edge travels: p1 -> zig1 -> zag1 -> zig2 -> zag2 -> tip
      outPts.push([cx_zig + bwX, cy_zig + bwY]);
      outPts.push([cx_zag + bwX, cy_zag + bwY]);

      // Inward edge travels: p2 -> in_zig1 -> in_zag1 -> in_zig2 -> in_zag2 -> tip
      // To build from the tip backwards, unshift zag, then unshift zig
      inPts.unshift([cx_zag - bwX, cy_zag - bwY]);
      inPts.unshift([cx_zig - bwX, cy_zig - bwY]);
    }

    stemPts = [p1, ...outPts, tip, ...inPts, p2];
  }

  rotated.splice(spliceStart, gapSize, ...stemPts);
  const finalPts = rotateArray(rotated, -(centerIdx - Math.floor(N / 2)));

  return { polyPts: finalPts, extraElements: [] };
}


// ---------------------------------------------------------
// 3. EA Builder & Preview Loop
// ---------------------------------------------------------

/**
 * Constructs the Excalidraw elements (polygon, text, and extra stem elements) based on the current state.
 * If isFinal is true, it handles the actual replacement or insertion into the Excalidraw scene and attaches metadata.
 * 
 * @param {boolean} isFinal - Indicates if the build is for actual canvas insertion rather than just rendering a preview.
 */
async function buildElements(isFinal = false) {
  ea.clear();

  // Grab old position data if we are doing a replacement
  let oldPoly = null;
  // Safe check for ea.targetView to prevent errors on EA workbench manipulation
  if (isFinal && editTarget && ea.targetView) {
    const viewEls = ea.getViewElements();
    oldPoly = viewEls.find(el => el.id === editTarget.polyId);
    const elsToDelete = viewEls.filter(el => editTarget.allIds.includes(el.id) || el.id === editTarget.polyId);
    if (elsToDelete.length > 0) {
      ea.copyViewElementsToEAforEditing(elsToDelete);
      ea.getElements().forEach(e => e.isDeleted = true);
    }
  }

  // 1. Setup Global Styles FIRST (Must be done before text measurement)
  ea.canvas.viewBackgroundColor = st()?.viewBackgroundColor ?? "gray";
  ea.style.strokeColor = state.strokeColor;
  ea.style.strokeWidth = state.strokeWidth;
  ea.style.roughness = parseInt(state.roughness);
  ea.style.strokeStyle = state.strokeStyle;
  ea.style.fontFamily = state.fontFamily;
  ea.style.fontSize = parseInt(state.fontSize);

  const bgRGB = ea.getCM(state.bgColor).alphaTo(state.bgOpacity / 100).stringRGB({ alpha: true });
  ea.style.backgroundColor = bgRGB;
  ea.style.fillStyle = state.fillStyle || "solid";

  // 2. Text Metrics
  const fontStr = window.ExcalidrawLib.getFontString({ fontFamily: state.fontFamily, fontSize: state.fontSize });
  const wrappedText = window.ExcalidrawLib.wrapText(state.text, fontStr, state.wrapWidth);
  const metrics = ea.measureText(wrappedText); // Now correctly uses the updated fontSize

  // 3. Calculate Dimensions
  let paddingMultiplier = 1;
  if (state.shapeType === 'cloud' || state.shapeType === 'spiky') {
    paddingMultiplier = 1 / (1 - Math.max(state.bumpDepth, 0.2));
  }

  const fontScaleFactor = state.fontSize / 16;
  const rx = (metrics.width / 2 + state.textMargin * fontScaleFactor) * paddingMultiplier;
  const ry = (metrics.height / 2 + state.textMargin * fontScaleFactor) * paddingMultiplier * state.heightRatio;

  // 4. Generate Perimeter & Inject Stem
  const basePts = generateBaseShape(rx, ry);
  const { polyPts, extraElements } = injectStem(basePts, rx, ry);

  // EXPLICIT CLOSURE to prevent missing segments in Excalidraw polygon rendering
  if (polyPts.length > 0) {
    polyPts.push([polyPts[0][0], polyPts[0][1]]);
  }

  // 5. Draw Polygon
  const polyId = ea.addLine(polyPts);
  const polyEl = ea.getElement(polyId);
  polyEl.polygon = true;

  // Only apply Excalidraw's native roundness if requested AND if it's an appropriate shape
  const blockNativeRoundness = ['ribbon', 'polygon', 'spiky', 'box'].includes(state.shapeType);
  polyEl.roundness = state.strokeSharpness === "round" && !blockNativeRoundness ? { type: 2 } : null;

  // 6. Add extra elements (bubbles, lines)
  const allIds = [polyId];
  for (let extra of extraElements) {
    if (extra.type === "ellipse") {
      const eId = ea.addEllipse(extra.x - extra.w / 2, extra.y - extra.h / 2, extra.w, extra.h);
      ea.getElement(eId).roundness = state.strokeSharpness === "round" ? { type: 2 } : null;
      allIds.push(eId);
    } else if (extra.type === "line") {
      const oldBg = ea.style.backgroundColor;
      ea.style.backgroundColor = "transparent";
      const lId = ea.addLine(extra.pts);
      ea.getElement(lId).roundness = state.strokeSharpness === "round" ? { type: 2 } : null;
      ea.style.backgroundColor = oldBg;
      allIds.push(lId);
    }
  }

  // 7. Add Text LAST (so it renders on top in z-index)
  ea.style.strokeColor = state.textColor;
  ea.style.backgroundColor = "transparent";

  const textId = ea.addText(0, 0, wrappedText, {
    textAlign: "center",
    textVerticalAlign: "middle",
    autoResize: true,
    box: false
  });

  const textEl = ea.getElement(textId);
  textEl.x = -textEl.width / 2;
  textEl.y = -textEl.height / 2;
  allIds.push(textId);

  // 8. Fix Z-index order inside EA's elements array
  const viewEls = ea.getElements();
  const tIdx = viewEls.findIndex(e => e.id === textId);
  if (tIdx > -1) {
    const t = viewEls.splice(tIdx, 1)[0];
    viewEls.push(t);
  }
  const pIdx = viewEls.findIndex(e => e.id === polyId);
  if (pIdx > 0) {
    const p = viewEls.splice(pIdx, 1)[0];
    viewEls.unshift(p);
  }

  // 9. Re-position to original location if replacing
  if (isFinal && editTarget && oldPoly) {
    const newPoly = ea.getElement(polyId);
    const oldCx = oldPoly.x + oldPoly.width / 2;
    const oldCy = oldPoly.y + oldPoly.height / 2;
    const newCx = newPoly.x + newPoly.width / 2;
    const newCy = newPoly.y + newPoly.height / 2;

    const dx = oldCx - newCx;
    const dy = oldCy - newCy;

    allIds.forEach(id => {
      const e = ea.getElement(id);
      if (e) {
        e.x += dx;
        e.y += dy;
      }
    });
  }

  // 10. Add Metadata & Group
  if (isFinal) {
    ea.addAppendUpdateCustomData(polyId, {
      // DEEP COPY state to prevent shared reference mutations across multiple callouts
      comicCallout: JSON.parse(JSON.stringify(state)), 
      comicCalloutIds: allIds
    });
  }
  ea.addToGroup(allIds);
}

/**
 * Generates an SVG snapshot of the currently configured elements and injects it into the preview pane.
 * 
 * @param {HTMLElement} previewContainer - The DOM element where the live SVG preview should be rendered.
 */
async function renderPreview(previewContainer) {
  // Prevent SVG generation without a valid view context (e.g., during Obsidian startup)
  if (!ea.targetView) return; 

  await buildElements(false);
  const svg = await ea.createSVG(undefined, undefined, undefined, undefined, undefined, 10);
  
  // Wait until SVG is generated before clearing to prevent collapse and UI flash
  previewContainer.empty();
  previewContainer.appendChild(svg);
}

/**
 * Debounces the preview rendering execution to prevent UI freezing and visual artifacts
 * when the user rapidly changes sliders, inputs text, or adjusts settings.
 * 
 * @param {HTMLElement} previewContainer - The DOM element containing the live preview.
 */
function scheduleUpdate(previewContainer) {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    renderPreview(previewContainer);
  }, 150);
}

// ---------------------------------------------------------
// 4. Settings UI
// ---------------------------------------------------------

/**
 * Utility function to create a standardized, styled UI section container inside the side panel.
 * 
 * @param {HTMLElement} container - The parent DOM element.
 * @param {string} title - The header text for the section.
 * @returns {HTMLElement} The newly created section div.
 */
function createSection(container, title) {
  const div = container.createDiv();
  div.style.marginBottom = "10px";
  if (title) {
    div.createEl("div", { text: title, cls: "comic-section-header", attr: { style: "margin-top: 0;" } });
  }
  return div;
}

/**
 * Calculates the ideal path resolution (number of structural points) needed to render the 
 * current shape cleanly. It balances Excalidraw performance with visual fidelity based on 
 * shape complexity and active modifiers (like action spikes or cloud bumps).
 * 
 * @returns {number} The optimally calculated path resolution.
 */
function getOptimalPathResolution() {
  let res = 10;
  if (['box', 'polygon', 'ribbon'].includes(state.shapeType)) {
    if (state.addSpikes) {
      let neededRes = Math.ceil(100 / Math.max(2, state.spikeWidth));
      res = Math.max(10, neededRes, state.spikeCount * 4);
    } else if (state.shapeType === 'box' && state.cornerRoundness > 0.05) {
      res = 30;
    } else {
      res = 10;
    }
  } else if (state.shapeType === 'cloud' || state.shapeType === 'spiky') {
    res = Math.ceil(state.bumpCount * 2.5);
  } else if (state.shapeType === 'oval' || state.shapeType === 'heart') {
    if (state.addSpikes) {
      let neededRes = Math.ceil(100 / Math.max(2, state.spikeWidth));
      res = Math.max(30, neededRes, state.spikeCount * 4);
    } else {
      res = 30;
    }
  }
  return Math.max(10, Math.min(200, Math.ceil(res / 10) * 10));
}

/**
 * Updates the state's path resolution to its optimal calculated value and automatically
 * syncs the corresponding UI slider if it is currently rendered in the active tab.
 */
function updatePathRes() {
  state.pathResolution = getOptimalPathResolution();
  if (pathResSliderComp) pathResSliderComp.setValue(state.pathResolution);
}

/**
 * Renders the preset management UI bar, which includes a dropdown selector and action buttons
 * for saving, creating (Save As), and deleting custom user configurations.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderPresetsUI(container) {
  container.empty();
  const presetBar = container.createDiv({ cls: "comic-preset-bar", attr: { style: "margin-bottom: 0; padding-bottom: 0; border-bottom: none;" } });
  const pSelect = presetBar.createEl("select", { cls: "dropdown" });
  Object.keys(presets).forEach(p => pSelect.createEl("option", { text: p, value: p }));
  pSelect.value = activePresetName;
  
  pSelect.onchange = () => {
    activePresetName = pSelect.value;
    Object.assign(state, presets[activePresetName]);
    if (textAreaComp) textAreaComp.setValue(state.text);
    renderTabsUI(tabsContainer); // Refresh parameters without full UI rebuild
    scheduleUpdate(previewContainer);
  };

  const btnSave = presetBar.createEl("div", { cls: "comic-btn-icon", attr: { title: "Save Preset" } });
  btnSave.innerHTML = ea.obsidian.getIcon("save").outerHTML;
  btnSave.onclick = async () => {
    presets[activePresetName] = JSON.parse(JSON.stringify(state));
    await savePrefs();
    new Notice(`Preset "${activePresetName}" saved.`);
  };

  const btnSaveAs = presetBar.createEl("div", { cls: "comic-btn-icon", attr: { title: "Save As New Preset" } });
  btnSaveAs.innerHTML = ea.obsidian.getIcon("plus").outerHTML;
  btnSaveAs.onclick = async () => {
    const name = await utils.inputPrompt("New Preset Name:", "Name", "Custom Callout");
    if (name && name.trim()) {
      activePresetName = name.trim();
      presets[activePresetName] = JSON.parse(JSON.stringify(state));
      await savePrefs();
      renderPresetsUI(container); // Re-render just this bar
      new Notice(`Preset "${activePresetName}" created.`);
    }
  };

  const btnDel = presetBar.createEl("div", { cls: "comic-btn-icon", attr: { title: "Delete Preset", style: "color: var(--text-error);" } });
  btnDel.innerHTML = ea.obsidian.getIcon("trash").outerHTML;
  btnDel.onclick = async () => {
    if (activePresetName === "Default") {
      new Notice("Cannot delete the Default preset.");
      return;
    }
    delete presets[activePresetName];
    activePresetName = "Default";
    Object.assign(state, presets["Default"]);
    if (textAreaComp) textAreaComp.setValue(state.text);
    await savePrefs();
    renderPresetsUI(container);
    renderTabsUI(tabsContainer);
    scheduleUpdate(previewContainer);
    new Notice(`Preset deleted.`);
  };
}

/**
 * Renders the main multi-line text area block where the user inputs the speech/callout text.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderTextUI(container) {
  const wrapper = container.createDiv({ attr: { style: "width: 100%; display: flex; flex-direction: column;" } });
  const textSetting = new ea.obsidian.Setting(wrapper).addTextArea(text => {
    textAreaComp = text;
    text.setValue(state.text).onChange(val => { state.text = val; scheduleUpdate(previewContainer); });
  });
  textSetting.settingEl.classList.add("comic-textarea-setting");
  textSetting.settingEl.style.marginTop = "0";
}

/**
 * Renders the "Base Shape" tab content. This includes the primary visual shape selector grid
 * and triggers the rendering functions for shape-specific modifiers and explosion spikes.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderBaseShapeUI(container) {
  const section = createSection(container, "Base Shape");

  const shapeGrid = section.createDiv({
    attr: { style: "display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 60px)); gap: 10px; margin-bottom: 15px; justify-content: start;" }
  });

  SHAPES.forEach((shape) => {
    const isActive = state.shapeType === shape.id;
    const btn = shapeGrid.createEl("button", {
      attr: {
        title: shape.name,
        "aria-label": shape.name,
        style: "height: 40px; width: 100%; padding: 4px; cursor: pointer;" + (isActive ? "background-color: var(--background-modifier-hover); color: var(--interactive-accent); border-color: var(--interactive-accent);" : "")
      }
    });
    btn.innerHTML = shape.svg;
    btn.onclick = () => {
      state.shapeType = shape.id;
      state.pathResolution = getOptimalPathResolution();
      scheduleUpdate(previewContainer);
      // Re-render tabs to update dynamic sliders (e.g. corner roundness vs bumps)
      renderTabsUI(tabsContainer);
    };
  });

  renderShapeModifiersUI(section);
  renderExplosionSpikesUI(section);
}

/**
 * Renders the configuration tabs, switching contents actively and preserving scroll
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderTabsUI(container) {
  const scrollPos = mainScrollContainer ? mainScrollContainer.scrollTop : 0;
  container.empty();

  // Ensure safe fallbacks for legacy presets
  if (state.bubbleBaseRadius === undefined) state.bubbleBaseRadius = 20;
  if (state.invertBend === undefined) state.invertBend = false;
  if (state.lineSecondBend === undefined) state.lineSecondBend = 0;
  if (state.lightningSections === undefined) state.lightningSections = 1;
  if (state.fontFamily === undefined) state.fontFamily = 5;
  if (state.fontSize === undefined) state.fontSize = 16;
  if (state.fillStyle === undefined) state.fillStyle = "solid";

  // Render Tabs Header
  const tabsHeader = container.createDiv({ cls: "comic-tabs-header" });
  const tabs = [
    { id: "baseShape", icon: "shapes", label: "Base Shape" },
    { id: "stem", icon: "message-square", label: "Tail / Stem" },
    { id: "text", icon: "type", label: "Text Properties" },
    { id: "lineFill", icon: "pen-tool", label: "Line and Fill" },
    { id: "colors", icon: "palette", label: "Colors" }
  ];
  
  tabs.forEach(tab => {
    const btn = tabsHeader.createEl("button", { cls: "comic-tab-btn" + (activeTab === tab.id ? " is-active" : "") });
    btn.innerHTML = ea.obsidian.getIcon(tab.icon)?.outerHTML || tab.label;
    btn.setAttribute("aria-label", tab.label);
    btn.setAttribute("title", tab.label);
    btn.onclick = () => {
      activeTab = tab.id;
      renderTabsUI(container);
    };
  });
  
  // Render Active Tab Content with fixed minimum height to prevent scroll jumps
  const tabContent = container.createDiv({ cls: "comic-tab-content", attr: { style: "min-height: 380px;" } });
  
  switch (activeTab) {
    case "baseShape":
      renderBaseShapeUI(tabContent);
      break;
    case "stem":
      renderStemUI(tabContent);
      break;
    case "text":
      renderTextAppearanceUI(tabContent);
      break;
    case "lineFill":
      renderLineFillUI(tabContent);
      break;
    case "colors":
      renderColorsUI(tabContent);
      break;
  }

  if (mainScrollContainer) {
    mainScrollContainer.scrollTop = scrollPos;
  }
}

/**
 * Constructs the core UI grid for the side panel, injecting responsive CSS.
 * Sets up the main structural containers including the preset manager, text area, 
 * live preview pane, action buttons, and the configuration tabs.
 * 
 * @param {HTMLElement} contentEl - The root DOM element of the side panel tab where the UI layout will be built.
 */
function buildPanelLayout(contentEl) {
  contentEl.empty();

  contentEl.createEl("style", {
    text: `
      .comic-textarea-setting { display: block !important; border-top: none !important; padding: 0 !important; }
      .comic-textarea-setting .setting-item-info { display: none !important; }
      .comic-textarea-setting .setting-item-control { display: block !important; width: 100% !important; justify-content: stretch !important; }
      .comic-textarea-setting textarea { width: 100% !important; box-sizing: border-box !important; min-height: 100px; resize: vertical; margin-bottom: 0; }
      .comic-section-header { margin-top: 15px; display: block; color: var(--text-accent); border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; font-size: 1.1em;}
      .comic-preset-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
      .comic-preset-bar .dropdown { flex-grow: 1; margin-left: 0px; }
      .comic-btn-icon { padding: 4px 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: var(--interactive-normal); border-radius: 4px; }
      .comic-btn-icon:hover { background: var(--interactive-hover); }
      .comic-tabs-header { display: flex; border-bottom: 1px solid var(--background-modifier-border); margin-bottom: 15px; margin-top: 10px; flex-wrap: wrap; }
      .comic-tab-btn { flex: 1; padding: 8px 5px; cursor: pointer; text-align: center; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); border-radius: 0; box-shadow: none; display: flex; align-items: center; justify-content: center; min-width: 40px; }
      .comic-tab-btn svg { width: 20px; height: 20px; }
      .comic-tab-btn:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
      .comic-tab-btn.is-active { border-bottom-color: var(--interactive-accent); color: var(--interactive-accent); }
      
      /* Responsive Sidepanel Grid - Wrapped for responsiveness */
      .comic-top-section { display: flex; flex-direction: row; flex-wrap: wrap; gap: 15px; align-items: stretch; margin-bottom: 5px; }
      .comic-inputs-col { flex: 1 1 250px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
      .comic-preview-col { flex: 1 1 250px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }

      /* Hide main scrollbar completely while maintaining scrollability */
      .comic-no-scrollbar {
        overflow-y: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE/Edge */
      }
      .comic-no-scrollbar::-webkit-scrollbar {
        display: none; /* Chrome/Safari/Opera */
      }
  `});

  mainScrollContainer = contentEl.createDiv({
    cls: "comic-no-scrollbar",
    attr: { style: "display: flex; flex-direction: column; gap: 8px; padding: 10px; height: 100%;" }
  });

  const topSection = mainScrollContainer.createDiv({ cls: "comic-top-section" });
  
  // 1. Template Selector & Text Area Column
  inputsContainer = topSection.createDiv({ cls: "comic-inputs-col" });
  
  // Create separated inner containers so that updating the preset UI doesn't erase the text UI
  const presetContainer = inputsContainer.createDiv();
  const textContainer = inputsContainer.createDiv();

  renderPresetsUI(presetContainer);
  renderTextUI(textContainer);

  // 2. Preview & Actions Column
  previewWrapper = topSection.createDiv({ cls: "comic-preview-col" });
  previewContainer = previewWrapper.createDiv({
    attr: { style: `flex: 1 1 auto; min-height: 140px; border: 1px solid var(--background-modifier-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; background-color: ${st()?.viewBackgroundColor ?? "gray"};` }
  });
  buildActionButtons(previewWrapper);

  // 3. Configuration Tabs
  tabsContainer = mainScrollContainer.createDiv({ cls: "comic-tabs-container" });
  renderTabsUI(tabsContainer);
}

/**
 * Renders the contextual sliders and toggles that uniquely modify the currently selected base shape
 * (e.g., polygon vertices rotation, cloud bump properties, box corner roundness, ribbon tails).
 * 
 * @param {HTMLElement} section - The parent DOM section to render into.
 */
function renderShapeModifiersUI(section) {
  if (state.shapeType === "polygon") {
    new ea.obsidian.Setting(section).setName("Polygon Vertices")
      .addSlider(slider => slider.setLimits(3, 12, 1).setValue(state.polySides).onChange(val => { state.polySides = val; scheduleUpdate(previewContainer); }));
    new ea.obsidian.Setting(section).setName("Polygon Rotation")
      .addSlider(slider => slider.setLimits(0, 360, 5).setValue(state.polyRotation).onChange(val => { state.polyRotation = val; scheduleUpdate(previewContainer); }));
  }
  if (state.shapeType === "cloud" || state.shapeType === "spiky") {
    new ea.obsidian.Setting(section).setName("Spike / Bump Count")
      .addSlider(slider => slider.setLimits(4, 30, 1).setValue(state.bumpCount).onChange(val => {
        state.bumpCount = val;
        updatePathRes();
        scheduleUpdate(previewContainer);
      }));
    new ea.obsidian.Setting(section).setName("Spike / Bump Depth")
      .addSlider(slider => slider.setLimits(0.05, 0.4, 0.01).setValue(state.bumpDepth).onChange(val => { state.bumpDepth = val; scheduleUpdate(previewContainer); }));
    new ea.obsidian.Setting(section).setName("Bump Variance")
      .addSlider(slider => slider.setLimits(0, 100, 5).setValue(state.bumpVariance).onChange(val => { state.bumpVariance = val; scheduleUpdate(previewContainer); }));
    new ea.obsidian.Setting(section).setName("Randomize Variance")
      .addToggle(t => t.setValue(state.randomVariance).onChange(val => { state.randomVariance = val; scheduleUpdate(previewContainer); }));
  }
  if (state.shapeType === "box") {
    new ea.obsidian.Setting(section).setName("Corner Roundness")
      .addSlider(slider => slider.setLimits(0, 1, 0.05).setValue(state.cornerRoundness).onChange(val => {
        state.cornerRoundness = val;
        updatePathRes();
        scheduleUpdate(previewContainer);
      }));
  }
  if (state.shapeType === "ribbon") {
    new ea.obsidian.Setting(section).setName("Ribbon Tails")
      .addDropdown(d => d.addOption("both", "Both").addOption("left", "Left").addOption("right", "Right").addOption("none", "None")
        .setValue(state.ribbonEnds).onChange(val => { state.ribbonEnds = val; scheduleUpdate(previewContainer); }));
  }

  new ea.obsidian.Setting(section).setName("Relative Height")
    .addSlider(slider => slider.setLimits(0.5, 2.0, 0.1).setValue(state.heightRatio).onChange(val => { state.heightRatio = val; scheduleUpdate(previewContainer); }));
}

/**
 * Renders the UI controls for adding "Action/Scream" explosion spikes to compatible 
 * base shapes. Controls include the spike count, width, height, and distribution.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderExplosionSpikesUI(container) {
  if (['box', 'oval', 'ribbon', 'polygon'].includes(state.shapeType)) {
    container.createEl("hr", { attr: { style: "margin: 15px 0;" } });
    container.createEl("div", { text: "Explosion Spikes", cls: "comic-section-header", attr: { style: "border:none; padding:0; margin-bottom:5px; font-size:1em;" } });

    new ea.obsidian.Setting(container).setName("Add Spikes")
      .addToggle(t => t.setValue(state.addSpikes).onChange(val => {
        state.addSpikes = val;
        state.pathResolution = getOptimalPathResolution();
        renderTabsUI(tabsContainer); // Re-render to show/hide sub-sliders
        scheduleUpdate(previewContainer);
      }));

    if (state.addSpikes) {
      new ea.obsidian.Setting(container).setName("Spike Count")
        .addSlider(s => s.setLimits(1, 20, 1).setValue(state.spikeCount).onChange(val => {
          state.spikeCount = val;
          updatePathRes();
          scheduleUpdate(previewContainer);
        }));
      new ea.obsidian.Setting(container).setName("Base Width (%)")
        .addSlider(s => s.setLimits(2, 20, 1).setValue(state.spikeWidth).onChange(val => {
          state.spikeWidth = val;
          updatePathRes();
          scheduleUpdate(previewContainer);
        }));
      new ea.obsidian.Setting(container).setName("Spike Height")
        .addSlider(s => s.setLimits(10, 100, 5).setValue(state.spikeHeight).onChange(val => { state.spikeHeight = val; scheduleUpdate(previewContainer); }));
      new ea.obsidian.Setting(container).setName("Distribution")
        .addDropdown(d => d.addOption("Even", "Even").addOption("Random", "Random").setValue(state.spikeDist).onChange(val => { state.spikeDist = val; scheduleUpdate(previewContainer); }));
    }
  }
}

/**
 * Renders the "Tail / Stem" tab content, providing configurable options for the speech bubble's 
 * tail. Settings include stem type, position along the perimeter, length, width, and bend angles.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderStemUI(container) {
  const section = createSection(container, "Tail / Stem");

  new ea.obsidian.Setting(section).setName("Type")
    .addDropdown(d => d.addOption("v_shape", "V-Shape").addOption("curvy_v", "Curvy Swoop").addOption("lightning", "Lightning").addOption("bubbles", "Thought Bubbles").addOption("line", "Line").addOption("none", "None")
      .setValue(state.stemType).onChange(val => { 
        state.stemType = val; 
        renderTabsUI(tabsContainer); 
        scheduleUpdate(previewContainer); 
      }));

  new ea.obsidian.Setting(section).setName("Perimeter Position (%)")
    .addSlider(slider => slider.setLimits(0, 100, 1).setValue(state.stemPosition).onChange(val => { state.stemPosition = val; scheduleUpdate(previewContainer); }));

  if (state.stemType !== "none") {
    new ea.obsidian.Setting(section).setName("Bend / Angle Deflection")
      .setDesc("-100 (Left/Up) to 100 (Right/Down)")
      .addSlider(slider => slider.setLimits(-100, 100, 5).setValue(state.stemBend).onChange(val => { state.stemBend = val; scheduleUpdate(previewContainer); }));
  }

  if (state.stemType === "curvy_v") {
    new ea.obsidian.Setting(section).setName("Invert Curve Bend")
      .addToggle(t => t.setValue(state.invertBend).onChange(val => { state.invertBend = val; scheduleUpdate(previewContainer); }));
  }

  if (state.stemType === "line") {
    new ea.obsidian.Setting(section).setName("Second Segment Angle")
      .setDesc("Relative bend angle for the tip segment")
      .addSlider(slider => slider.setLimits(-180, 180, 5).setValue(state.lineSecondBend).onChange(val => { state.lineSecondBend = val; scheduleUpdate(previewContainer); }));
  }

  if (state.stemType === "lightning") {
    new ea.obsidian.Setting(section).setName("Lightning Sections")
      .setDesc("Number of zig-zags in the lightning stem")
      .addSlider(slider => slider.setLimits(1, 5, 1).setValue(state.lightningSections).onChange(val => { state.lightningSections = val; scheduleUpdate(previewContainer); }));
  }

  new ea.obsidian.Setting(section).setName("Stem Length (%)")
    .setDesc("Length relative to the size of the shape")
    .addSlider(slider => slider.setLimits(10, 200, 5).setValue(state.stemLength).onChange(val => { state.stemLength = val; scheduleUpdate(previewContainer); }));

  if (state.stemType !== "bubbles" && state.stemType !== "line" && state.stemType !== "none") {
    new ea.obsidian.Setting(section).setName("Stem Base Width (%)")
      .addSlider(slider => slider.setLimits(2, 40, 1).setValue(state.stemWidth).onChange(val => { state.stemWidth = val; scheduleUpdate(previewContainer); }));
  }

  if (state.stemType === "bubbles") {
    new ea.obsidian.Setting(section).setName("Bubble Count")
      .addSlider(slider => slider.setLimits(2, 10, 1).setValue(state.bubbleCount).onChange(val => { state.bubbleCount = val; scheduleUpdate(previewContainer); }));
    new ea.obsidian.Setting(section).setName("Base Bubble Radius")
      .addSlider(slider => slider.setLimits(5, 50, 1).setValue(state.bubbleBaseRadius).onChange(val => { state.bubbleBaseRadius = val; scheduleUpdate(previewContainer); }));
    new ea.obsidian.Setting(section).setName("Bubble Shrink (%)")
      .setDesc("How fast bubbles diminish.")
      .addSlider(slider => slider.setLimits(0, 90, 5).setValue(state.bubbleShrink).onChange(val => { state.bubbleShrink = val; scheduleUpdate(previewContainer); }));
  }
}

/**
 * Renders the "Text Properties" tab content. Controls formatting behaviors related to
 * the inserted text, including wrap width, internal margins/padding, font family, and font size.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderTextAppearanceUI(container) {
  const section = createSection(container, "Text Properties");

  new ea.obsidian.Setting(section).setName("Text Wrap Width")
    .addSlider(slider => slider.setLimits(100, 600, 10).setValue(state.wrapWidth).onChange(val => { state.wrapWidth = val; scheduleUpdate(previewContainer); }));

  new ea.obsidian.Setting(section).setName("Padding")
    .addSlider(slider => slider.setLimits(10, 100, 5).setValue(state.textMargin).onChange(val => { state.textMargin = val; scheduleUpdate(previewContainer); }));

  new ea.obsidian.Setting(section).setName("Font Family")
    .addDropdown(d => d
      .addOption("1", "Virgil")
      .addOption("2", "Helvetica")
      .addOption("3", "Cascadia")
      .addOption("4", "Local Font")
      .addOption("5", "Excalifont")
      .addOption("6", "Nunito")
      .addOption("7", "Lilita One")
      .addOption("8", "Comic Shanns")
      .addOption("9", "Liberation Sans")
      .addOption("10", "Assistant")
      .setValue(String(state.fontFamily))
      .onChange(val => { state.fontFamily = parseInt(val); scheduleUpdate(previewContainer); })
    );

  new ea.obsidian.Setting(section).setName("Font Size")
    .addDropdown(d => d
      .addOption("16", "Small (16)")
      .addOption("20", "Medium (20)")
      .addOption("28", "Large (28)")
      .addOption("36", "Extra Large (36)")
      .setValue(String(state.fontSize))
      .onChange(val => { state.fontSize = parseInt(val); scheduleUpdate(previewContainer); })
    );
}

/**
 * Renders the "Line and Fill Properties" tab content. Configures Excalidraw-specific
 * style properties for the shape such as path resolution, stroke/fill styles, 
 * sloppiness (roughness), stroke width, and background opacity.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderLineFillUI(container) {
  const section = createSection(container, "Line and Fill Properties");

  new ea.obsidian.Setting(section).setName("Path Resolution")
    .setDesc("Lower for dashed styles, higher for smoothness.")
    .addSlider(slider => {
      pathResSliderComp = slider;
      slider.setLimits(10, 200, 10).setValue(state.pathResolution).onChange(val => {
        state.pathResolution = val;
        scheduleUpdate(previewContainer);
      })
    });

  new ea.obsidian.Setting(section).setName("Fill Style")
    .addDropdown(d => d
      .addOption("hachure", "Hachure")
      .addOption("zigzag", "Zigzag")
      .addOption("cross-hatch", "Cross-hatch")
      .addOption("solid", "Solid")
      .setValue(state.fillStyle)
      .onChange(val => { state.fillStyle = val; scheduleUpdate(previewContainer); })
    );

  new ea.obsidian.Setting(section).setName("Stroke Style")
    .addDropdown(d => d.addOption("solid", "Solid").addOption("dashed", "Dashed").addOption("dotted", "Dotted")
      .setValue(state.strokeStyle).onChange(val => { state.strokeStyle = val; scheduleUpdate(previewContainer); }));

  new ea.obsidian.Setting(section).setName("Edges (Sharp/Round)")
    .addDropdown(d => d.addOption("round", "Rounded").addOption("sharp", "Sharp")
      .setValue(state.strokeSharpness).onChange(val => { state.strokeSharpness = val; scheduleUpdate(previewContainer); }));

  new ea.obsidian.Setting(section).setName("Sloppiness")
    .addDropdown(d => d.addOption("0", "Architect").addOption("1", "Artist").addOption("2", "Cartoonist")
      .setValue(String(state.roughness)).onChange(val => { state.roughness = parseInt(val); scheduleUpdate(previewContainer); }));

  new ea.obsidian.Setting(section).setName("Stroke Width")
    .addSlider(slider => slider.setLimits(1, 10, 0.5).setValue(state.strokeWidth).onChange(val => { state.strokeWidth = val; scheduleUpdate(previewContainer); }));

  new ea.obsidian.Setting(section).setName("Background Opacity")
    .addSlider(slider => slider.setLimits(0, 100, 5).setValue(state.bgOpacity).onChange(val => { state.bgOpacity = val; scheduleUpdate(previewContainer); }));
}

/**
 * Renders the "Colors" tab content. Constructs synced color picker components consisting of
 * an interactive swatch, a native input picker, and a text input field for hex/color values, 
 * linked to the text, stroke, and fill color properties.
 * 
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function renderColorsUI(container) {
  const section = createSection(container, "Colors");

  const mkColorSyncPicker = (parent, name, stateKey) => {
    const row = new ea.obsidian.Setting(parent).setName(name);

    let textInput;
    let nativePicker;
    let btnEl;

    const updateAllUIs = (colorStr) => {
      if (textInput && textInput.inputEl.value !== colorStr) {
        textInput.setValue(colorStr);
      }
      try {
        if (colorStr.toLowerCase() === "transparent") {
          if (nativePicker) nativePicker.value = "#ffffff";
          if (btnEl) {
            btnEl.style.backgroundColor = "transparent";
            btnEl.style.color = "black";
          }
        } else {
          const cm = ea.getCM(colorStr);
          if (cm && cm.format !== "invalid") {
            const hex = cm.stringHEX({ alpha: false }).toLowerCase();
            if (nativePicker) nativePicker.value = hex;
            if (btnEl) {
              btnEl.style.backgroundColor = hex;
              btnEl.style.color = cm.isDark() ? "white" : "black";
            }
          }
        }
      } catch (e) {}
    };

    const onColorChange = (newColor) => {
      state[stateKey] = newColor;
      updateAllUIs(newColor);
      scheduleUpdate(previewContainer);
    };

    row.addButton(btn => {
      btnEl = btn.buttonEl;
      btnEl.style.width = "28px";
      btnEl.style.height = "28px";
      btnEl.style.padding = "0";
      btn.setIcon("swatch-book");
      btn.onClick(async () => {
        const newColor = await ea.showColorPicker(btn.buttonEl, "elementStroke");
        if (newColor) onColorChange(newColor);
      });
    });

    nativePicker = row.controlEl.createEl("input", {
      type: "color",
      attr: { style: "width: 28px; height: 28px; padding: 0; border: none; cursor: pointer; background: transparent; border-radius: 4px; margin-right: 8px;" }
    });
    nativePicker.addEventListener("input", (e) => {
      onColorChange(e.target.value);
    });

    row.addText(text => {
      textInput = text;
      text.setValue(state[stateKey])
        .onChange(val => {
          onColorChange(val);
        });
      text.inputEl.style.width = "100px";
    });

    updateAllUIs(state[stateKey]);
  };

  mkColorSyncPicker(section, "Text Color", "textColor");
  mkColorSyncPicker(section, "Stroke Color", "strokeColor");
  mkColorSyncPicker(section, "Fill Color", "bgColor");
}

/**
 * Creates the functional UI buttons (Insert, Replace) for the side panel
 *
 * @param {HTMLElement} container - The parent DOM element to render into.
 */
function buildActionButtons(container) {
  // Query the container directly to prevent detached DOM nodes if the tab was re-rendered.
  // We use a local variable to shadow any old global references.
  let localActionsContainer = container.querySelector(".comic-actions-container");
  
  if (!localActionsContainer) {
    localActionsContainer = container.createDiv({
      cls: "comic-actions-container",
      attr: { style: "display: flex; justify-content: flex-end; gap: 15px; flex: 0 0 auto;" }
    });
  }

  // Safely check for ea.targetView before checking if it's the active leaf
  const isActiveView = ea.targetView && app.workspace.getLeaf()?.view === ea.targetView;

  // Retrieve existing buttons or create them to avoid destroying DOM elements 
  // mid-click (which breaks focus events and causes double-click requirements)
  let replaceBtn = localActionsContainer.querySelector(".comic-replace-btn");
  if (!replaceBtn) {
    replaceBtn = localActionsContainer.createEl("button", { text: "Replace Selected", cls: "mod-warning comic-replace-btn" });
    replaceBtn.onclick = async () => {
      await savePrefs();
      await buildElements(true);
      const newElements = ea.getElements().map(el => el);
      await ea.addElementsToView(false, false, true);
      ea.selectElementsInView(newElements);
      
      detectEditTarget();
      buildActionButtons(container);
      scheduleUpdate(previewContainer);
    };
  }

  let insertBtn = localActionsContainer.querySelector(".comic-insert-btn");
  if (!insertBtn) {
    insertBtn = localActionsContainer.createEl("button", { cls: "mod-cta comic-insert-btn" });
    insertBtn.onclick = async () => {
      await savePrefs();
      editTarget = null; // Clear target so we don't delete anything when inserting new
      await buildElements(true);
      
      // Offset to center of the view to prevent "wait for click" positioning issue
      const center = ea.getViewCenterPosition();
      const els = ea.getElements();
      els.forEach(el => {
        el.x += center.x;
        el.y += center.y;
      });

      const newElements = ea.getElements().map(el => el);
      await ea.addElementsToView(false, false, true);
      ea.selectElementsInView(newElements);
      
      detectEditTarget();
      buildActionButtons(container);
      scheduleUpdate(previewContainer);
    };
  }

  // Safely update visibility and text 
  if (editTarget) {
    replaceBtn.style.display = "block";
    insertBtn.innerText = "Insert as New";
  } else {
    replaceBtn.style.display = "none";
    insertBtn.innerText = "Insert Bubble";
  }

  // Disable interaction if not observing target view AND not interacting with the sidepanel
  replaceBtn.disabled = !isActiveView;
  insertBtn.disabled = !isActiveView;
}

/**
 * Core initialization sequence
 */
async function main() {
  const existingTab = ea.checkForActiveSidepanelTabForScript();
  if (existingTab) {
    const hostEA = existingTab.getHostEA();
    if (hostEA && hostEA !== ea) {
      // Prevent setting an invalid view during startup
      if (ea.targetView) hostEA.setView(ea.targetView);
      existingTab.open();
      return;
    }
  }

  initializeStateAndPresets();
  detectEditTarget();

  const tab = await ea.createSidepanelTab("Comic Bubbles", true, true);
  if (!tab) return;

  tab.onOpen = () => {
    buildPanelLayout(tab.contentEl);
    scheduleUpdate(previewContainer);
  };

  tab.onFocus = (view) => {
    let viewChanged = false;
    if (view && view !== ea.targetView) {
      ea.setView(view);
      ea.clear();
      viewChanged = true;
    }
    
    // Update preview background color to match the currently focused Excalidraw view
    if (previewContainer) {
      previewContainer.style.backgroundColor = st()?.viewBackgroundColor ?? "gray";
    }
    
    // Capture state before parsing selection to see if it actually changed
    const oldTargetId = editTarget ? editTarget.polyId : null;
    detectEditTarget();
    const newTargetId = editTarget ? editTarget.polyId : null;

    if (textAreaComp && textAreaComp.getValue() !== state.text) {
      textAreaComp.setValue(state.text);
    }
    
    // Only re-render UI if the view or target changed. 
    // Unconditional re-rendering destroys elements during mousedown, causing the double-click issue.
    if (viewChanged || oldTargetId !== newTargetId) {
      renderTabsUI(tabsContainer);
    }
    
    // Update button states (disabled/enabled, visibility) without destroying them
    buildActionButtons(previewWrapper); 
    scheduleUpdate(previewContainer);
  };

  tab.onClose = () => {
    savePrefs();
    clearTimeout(previewTimeout);
  };

  tab.open();
}

// Execute Script
main();
