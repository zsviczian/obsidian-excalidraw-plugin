/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-to-path.jpg)

This script allows you to fit a text element along a selected path: line, arrow, freedraw, ellipse, rectangle, or diamond. You can select either a path or a text element, or both:

- If only a path is selected, you will be prompted to provide the text.
- If only a text element is selected and it was previously fitted to a path, the script will use the original path if it is still present in the scene.
- If both a text and a path are selected, the script will fit the text to the selected path.

If the path is a perfect circle, you will be prompted to choose whether to fit the text above or below the circle.

After fitting, the text will no longer be editable as a standard text element, but you'll be able to edit it with this script. Text on path cannot function as a markdown link. Emojis are not supported.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.12.0")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

els = ea.getViewSelectedElements();
let pathEl = els.find(el=>["ellipse", "rectangle", "diamond", "line", "arrow", "freedraw"].includes(el.type));
const textEl = els.find(el=>el.type === "text");
const tempElementIDs = [];

const win = ea.targetView.ownerWindow;

let pathElID = textEl?.customData?.text2Path?.pathElID;
if(!pathEl) {
  if (pathElID) {
    pathEl = ea.getViewElements().find(el=>el.id === pathElID);
    pathElID = pathEl?.id;
  }
  if(!pathElID) {
    new Notice("Please select a text element and a valid path element (ellipse, rectangle, diamond, line, arrow, or freedraw)");
    return;
  }
} else {
  pathElID = pathEl.id;
}
const originalPathType = pathEl.type;
const originalPathDirectionLR = ["line","arrow","freedraw"].includes(pathEl.type)
  ? (pathEl.points[pathEl.points.length-1][0] < 0 ? true : false)
  : true;

const st = ea.getExcalidrawAPI().getAppState();
const fontSize = textEl?.fontSize ?? st.currentItemFontSize;
const fontFamily = textEl?.fontFamily ?? st.currentItemFontFamily;
ea.style.fontSize = fontSize;
ea.style.fontFamily = fontFamily;
const fontHeight = ea.measureText("M").height*1.3;

// Remove isCircle check and introduce isClosedShape
const isPathLinear = ["line", "arrow", "freedraw"].includes(pathEl.type);
const isClosedShape = ["ellipse", "rectangle", "diamond"].includes(originalPathType) || (pathEl.type === "line" && pathEl.polygon);

// Expand and convert all closed shapes to line elements uniformly
if(!isPathLinear) {
  ea.copyViewElementsToEAforEditing([pathEl]);
  pathEl = ea.getElement(pathEl.id);

  if (pathEl.type === "line" && isClosedShape && isClockwise(pathEl.points)) {
    pathEl.points = pathEl.points.reverse();
  }

  pathEl.x -= fontHeight/2;
  pathEl.y -= fontHeight/2;
  pathEl.width += fontHeight;
  pathEl.height += fontHeight;
  tempElementIDs.push(pathEl.id);

  switch (pathEl.type) {
    case "rectangle":
      pathEl = rectangleToLine(pathEl);
      break;
    case "ellipse":
      pathEl = ellipseToLine(pathEl);
      break;
    case "diamond":
      pathEl = diamondToLine(pathEl);
      break;
  }
  tempElementIDs.push(pathEl.id);
}

// ---------------------------------------------------------
// Convert path to SVG and use real path for text placement.
// ---------------------------------------------------------
let isLeftToRight = true;
let pathElBottom = null;

if (
  (["line", "arrow"].includes(pathEl.type) && pathEl.roundness !== null) ||
  pathEl.type === "freedraw"
) {
  [pathEl, isLeftToRight, pathElBottom] = await convertBezierToPoints();
} else if (pathEl.points) {
  isLeftToRight = pathEl.points[pathEl.points.length - 1][0] >= 0;
}

// ---------------------------------------------------------
// Retrieve original settings from text-on-path customData
// ---------------------------------------------------------
let currentOffsetPct = textEl?.customData?.text2Path?.offsetPct ?? 0;
let currentDistanceOffset = textEl?.customData?.text2Path?.distanceOffset ?? 0;
let currentLetterSpacing = textEl?.customData?.text2Path?.letterSpacing ?? 0;

// Map legacy archAbove to currentIsReversed for backwards compatibility
let currentIsReversed = textEl?.customData?.text2Path?.isReversed ?? (textEl?.customData?.text2Path?.archAbove === false ? true : false);
let currentPlaceInside = textEl?.customData?.text2Path?.placeInside ?? false; 
let currentText = textEl?.customData?.text2Path
  ? textEl.customData.text2Path.text
  : textEl?.text ?? "";
currentText = currentText.replace(/ \n/g," ").replace(/\n /g, " ").replace(/\n/g," ");

let generatedIDs = [];
let updateTimeout = null;
let textUpdateTimeout = null;

function isClockwise(points) {
  if(points.length <=3 ) return true
  return points[points.length-2] > 0
}

async function updatePath() {
  if (!currentText || currentText.trim() === "") return;

  ea.clear();
  let elementsToDelete = [];
  
  // Target generated elements from this session, or the original text element 
  // and its associated path characters if editing a pre-existing path
  if (generatedIDs.length > 0) {
    elementsToDelete = ea.getViewElements().filter(el => generatedIDs.includes(el.id));
  } else if (textEl && !textEl.isDeleted) {
    if (textEl?.customData?.text2Path) {
      const pathID = textEl.customData.text2Path.pathID;
      elementsToDelete = ea.getViewElements().filter(el => el.customData?.text2Path && el.customData.text2Path.pathID === pathID);
    } else {
      elementsToDelete = [textEl];
    }
  }

  if (elementsToDelete.length > 0) {
    ea.copyViewElementsToEAforEditing(elementsToDelete);
    ea.getElements().forEach(el => { el.isDeleted = true; });
  }

  // Re-apply style rules to the EA workbench context
  ea.style.fontSize = fontSize;
  ea.style.fontFamily = fontFamily;
  ea.style.strokeColor = textEl?.strokeColor ?? st.currentItemStrokeColor;
  ea.style.opacity = textEl?.opacity ?? st.currentItemOpacity;

  generatedIDs = [];

  // Apply fitTextToShape universally
  await fitTextToShape();
}

// -------------------------------------
// Floating Modal UI
// -------------------------------------
const modal = new ea.FloatingModal(ea.plugin.app);

// Constrain the modal width
modal.modalEl.style.width = "400px";
modal.modalEl.style.maxWidth = "100%";

let outsideClickHandler; // Store reference to remove it later

modal.onOpen = () => {
  modal.contentEl.empty();
  
  // Text Input
  const textSetting = new ea.obsidian.Setting(modal.contentEl)
    .setName("Text")
    .addTextArea(text => {
      text.setValue(currentText)
          .onChange(val => {
            currentText = val.replace(/ \n/g," ").replace(/\n /g, " ").replace(/\n/g," ");
            if (textUpdateTimeout) clearTimeout(textUpdateTimeout);
            textUpdateTimeout = setTimeout(() => {
              updatePath();
            }, 1000); 
          });
      // Make text area fill its container
      text.inputEl.style.width = "100%";
      text.inputEl.style.minHeight = "80px";
      text.inputEl.style.resize = "vertical";
    });
    
  // Force block layout so the textarea sits below the label and takes 100% width
  textSetting.settingEl.style.display = "block";
  textSetting.controlEl.style.width = "100%";
  textSetting.controlEl.style.marginTop = "8px";

  // Offset Slider (Now applies to all shapes)
  const offsetSetting = new ea.obsidian.Setting(modal.contentEl)
    .setName("Slide text along the path")
    .addSlider(slider => {
      slider.setLimits(-50, 50, 0.1)
            .setValue(currentOffsetPct)
            .onChange(val => {
              currentOffsetPct = val;
              // 500ms Throttle for continuous sliding to keep performance smooth
              if (updateTimeout) clearTimeout(updateTimeout);
              updateTimeout = setTimeout(() => {
                updatePath();
              }, 500); 
            });
      // Make the slider stretch to fill the control element
      slider.sliderEl.style.width = "100%";
    });
    
  // Tell the control container to expand and take up all remaining width
  offsetSetting.controlEl.style.flexGrow = "1";
  offsetSetting.controlEl.style.width = "100%";
  offsetSetting.infoEl.style.flex = "0 1 auto"; 

  const distanceSetting = new ea.obsidian.Setting(modal.contentEl)
    .setName("Distance from line")
    .addSlider(slider => {
      slider.setLimits(-50, 50, 1)
            .setValue(currentDistanceOffset)
            .onChange(val => {
              currentDistanceOffset = val;
              if (updateTimeout) clearTimeout(updateTimeout);
              updateTimeout = setTimeout(() => { updatePath(); }, 500); 
            });
      slider.sliderEl.style.width = "100%";
    });
  distanceSetting.controlEl.style.flexGrow = "1";
  distanceSetting.controlEl.style.width = "100%";
  distanceSetting.infoEl.style.flex = "0 1 auto"; 

  const spacingSetting = new ea.obsidian.Setting(modal.contentEl)
    .setName("Character spacing")
    .addSlider(slider => {
      slider.setLimits(-25, 50, 1)
            .setValue(currentLetterSpacing)
            .onChange(val => {
              currentLetterSpacing = val;
              if (updateTimeout) clearTimeout(updateTimeout);
              updateTimeout = setTimeout(() => { updatePath(); }, 500); 
            });
      slider.sliderEl.style.width = "100%";
    });
  spacingSetting.controlEl.style.flexGrow = "1";
  spacingSetting.controlEl.style.width = "100%";
  spacingSetting.infoEl.style.flex = "0 1 auto"; 

  new ea.obsidian.Setting(modal.contentEl)
    .setName("Reverse text")
    .setDesc("Flips the text direction (useful for placing text on the inside or bottom of a shape).")
    .addToggle(toggle => {
      toggle.setValue(currentIsReversed)
            .onChange(val => {
              currentIsReversed = val;
              updatePath();
            });
    });

  const placementLabel = isClosedShape ? "Place inside shape" : "Place on opposite side";
  const placementDesc = isClosedShape
      ? "Places the text on the inside of the shape's boundary."
      : "Places the text on the other side of the path.";

  new ea.obsidian.Setting(modal.contentEl)
    .setName(placementLabel)
    .setDesc(placementDesc)
    .addToggle(toggle => {
      toggle.setValue(currentPlaceInside)
            .onChange(val => {
              currentPlaceInside = val;
              updatePath();
            });
    });

  // Action Buttons
  const btnContainer = modal.contentEl.createDiv({ attr: { style: "display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;" } });
  
  const updateBtn = btnContainer.createEl("button", { text: "Update Preview" });
  updateBtn.onclick = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    if (textUpdateTimeout) clearTimeout(textUpdateTimeout);
    updatePath();
  };

  const closeBtn = btnContainer.createEl("button", { text: "Done", cls: "mod-cta" });
  closeBtn.onclick = async () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    if (textUpdateTimeout) clearTimeout(textUpdateTimeout);
    await updatePath();
    modal.close();
  };

  // Add outside click listener
  outsideClickHandler = (e) => {
    // If the click is outside the modal element
    if (modal.modalEl && !modal.modalEl.contains(e.target)) {
      modal.close();
    }
  };

  // Delay attaching the listener slightly so the click that opened the script 
  // doesn't immediately trigger the close.
  setTimeout(() => {
    ea.targetView.ownerWindow.addEventListener("pointerdown", outsideClickHandler);
  }, 100);
};

modal.onClose = () => {
   if (updateTimeout) clearTimeout(updateTimeout);
   if (outsideClickHandler) {
     ea.targetView.ownerWindow.removeEventListener("pointerdown", outsideClickHandler);
   }
};

modal.enableKeyCapture();
modal.open();

// Trigger initial calculation
if (currentText.trim() !== "") {
  await updatePath();
}


//----------------------------------------
//----------------------------------------
// Supporting functions
//----------------------------------------
//----------------------------------------
function transposeElements(ids) {
  const dims = ea.measureText("M");
  ea.getElements().filter(el=>ids.has(el.id)).forEach(el=>{
      el.x -= dims.width/2;
      el.y -= dims.height/2;
  })
}

// Function to convert any shape to a series of points along its path
function calculatePathPoints(element) { 
  const points = [];
  
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  if (element.points && element.points.length > 0) {
    minX = Math.min(...element.points.map(p => p[0]));
    minY = Math.min(...element.points.map(p => p[1]));
    maxX = Math.max(...element.points.map(p => p[0]));
    maxY = Math.max(...element.points.map(p => p[1]));
  } else {
    maxX = element.width;
    maxY = element.height;
  }
  const cx = element.x + minX + (maxX - minX) / 2;
  const cy = element.y + minY + (maxY - minY) / 2;
  
  const angle = element.angle || 0;
  
  // Get absolute coordinates of all points, accounting for rotation
  const absolutePoints = element.points.map(point => {
    const sx = point[0] + element.x;
    const sy = point[1] + element.y;
    
    if (angle !== 0) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = cos * (sx - cx) - sin * (sy - cy) + cx;
      const ry = sin * (sx - cx) + cos * (sy - cy) + cy;
      return [rx, ry];
    }
    return [sx, sy];
  });
  
  // If it's a closed polygon, ensure the last point connects to the first
  if (element.polygon) {
    const firstPt = absolutePoints[0];
    const lastPt = absolutePoints[absolutePoints.length - 1];
    if (Math.abs(firstPt[0] - lastPt[0]) > 0.001 || Math.abs(firstPt[1] - lastPt[1]) > 0.001) {
      absolutePoints.push([...firstPt]);
    }
  }
  
  // Calculate segment information
  let segments = [];
  for (let i = 0; i < absolutePoints.length - 1; i++) {
    const p0 = absolutePoints[i];
    const p1 = absolutePoints[i+1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    // Skip zero-length segments to prevent angle corruption
    if (segmentLength < 0.001) continue;
    
    const angleSeg = Math.atan2(dy, dx);
    segments.push({ p0, p1, length: segmentLength, angle: angleSeg });
  }
  
  // Sample points along each segment
  for (const segment of segments) {
    const numSamplePoints = Math.max(2, Math.ceil(segment.length / 5)); // 1 point every 5 pixels
    
    for (let i = 0; i < numSamplePoints; i++) {
      const t = i / (numSamplePoints - 1);
      const x = segment.p0[0] + t * (segment.p1[0] - segment.p0[0]);
      const y = segment.p0[1] + t * (segment.p1[1] - segment.p0[1]);
      points.push([x, y, segment.angle]);
    }
  }
  
  return points;
}

// Function to distribute text along any path
function distributeTextAlongPath(text, pathPoints, pathID, objectIDs, offset = 0, isLeftToRight, isClosed = false, isReversed = false, isInside = false, isBottomEdge = false) {
  if (pathPoints.length === 0) return;

  const originalText = text;
  
  // Determine if we need to draw the characters backwards based on path direction and reversal setting
  let shouldReverseString = !isLeftToRight;
  if (isReversed) {
    shouldReverseString = !shouldReverseString;
  }

  if (shouldReverseString) {
    text = text.split('').reverse().join('');
  }

  let pathLength = 0;
  let pathSegments = [];
  let accumulatedLength = 0;
  
  for (let i = 1; i < pathPoints.length; i++) {
    const [x1, y1] = [pathPoints[i-1][0], pathPoints[i-1][1]];
    const [x2, y2] = [pathPoints[i][0], pathPoints[i][1]];
    const segLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    
    if (segLength < 0.001) continue;

    pathSegments.push({
      startPoint: [x1, y1], // Create new arrays to safely mutate them later
      endPoint: [x2, y2],
      length: segLength,
      startDist: accumulatedLength,
      endDist: accumulatedLength + segLength
    });
    
    accumulatedLength += segLength;
    pathLength += segLength;
  }
  
  // --- Trimming logic to remove freedraw terminal hooks ---
  if (originalPathType === "freedraw" && !isClosed && pathSegments.length > 0) {
    let trimDist = 15;
    while (pathSegments.length > 0 && trimDist > 0) {
      const lastSeg = pathSegments[pathSegments.length - 1];
      if (lastSeg.length <= trimDist) {
        trimDist -= lastSeg.length;
        pathSegments.pop();
      } else {
        const ratio = (lastSeg.length - trimDist) / lastSeg.length;
        lastSeg.endPoint[0] = lastSeg.startPoint[0] + (lastSeg.endPoint[0] - lastSeg.startPoint[0]) * ratio;
        lastSeg.endPoint[1] = lastSeg.startPoint[1] + (lastSeg.endPoint[1] - lastSeg.startPoint[1]) * ratio;
        lastSeg.length -= trimDist;
        lastSeg.endDist -= trimDist;
        break;
      }
    }
    pathLength = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].endDist : 0;
  }

  if (pathSegments.length === 0) return;

  // Pre-calculate contextual widths to preserve natural kerning
  const substrWidths = [];
  const spaceWidth = ea.measureText(" ").width;
  for (let i = 0; i <= text.length; i++) {
    const sub = text.substring(0, i);
    substrWidths.push(ea.measureText(sub + " ").width - spaceWidth);
  }

  // Calculate the exact target distance (center-to-center) on a straight line
  const centers = [];
  for (let i = 0; i < text.length; i++) {
    centers.push((substrWidths[i] + substrWidths[i+1]) / 2);
  }

  // Helper to get the exact projected coordinate on the offset path
  function getProjectedPoint(s, dy) {
    let actualDist = s;
    if (isClosed && pathLength > 0) {
      actualDist = ((s % pathLength) + pathLength) % pathLength;
    }
    
    let pointInfo = getPointAtDistance(actualDist, pathSegments, pathLength);
    if (!pointInfo) return null;
    
    const rotAngle = pointInfo.angle + (isLeftToRight ? 0 : Math.PI);
    const rotatedDx = -dy * Math.sin(rotAngle);
    const rotatedDy = dy * Math.cos(rotAngle);
    
    return {
      x: pointInfo.x - rotatedDx,
      y: pointInfo.y - rotatedDy,
      angle: rotAngle
    };
  }

  let currentS = offset;
  let lastPlacedPoint = null;
  
  for (let i = 0; i < text.length; i++) {
    const character = text.substring(i, i+1);
    const charMetrics = ea.measureText(character);
    const charPixelWidth = charMetrics.width;
    const charPixelHeight = charMetrics.height;

    // Determine the vertical shift required to place the text
    let dy = 0;
    if (["line", "arrow", "freedraw"].includes(originalPathType)) {
      // For open lines, shift UP so the text sits on top of the line
      const margin = ea.style.fontSize * 0.2;
      dy = (charPixelHeight / 2) + margin;
      
      // Apply custom distance offset (mapped to percentage of fontSize)
      dy += (currentDistanceOffset / 100) * ea.style.fontSize;
      
      // If we are using the bottom edge, its normal vectors actually point UP into the stroke.
      // So we must invert dy to push the text DOWN away from the stroke edge.
      // if (isBottomEdge) dy = -dy;
      
      if (isInside) dy = -dy; 
    } else {
      // For shapes, the path was already expanded outwards by fontHeight/2 earlier in the script.
      // Therefore, the base path is exactly where the text centers should be.
      dy = 0;
      
      // Apply custom distance offset (mapped to percentage of fontSize)
      dy += (currentDistanceOffset / 100) * ea.style.fontSize;
      
      if (isInside) dy = -dy - fontHeight; 
    }

    // Target spatial distance from the previous character center
    let targetDist = i === 0 ? centers[0] : centers[i] - centers[i-1];
    
    // Apply custom letter spacing (scale mapped to percentage of font size)
    if (i > 0) {
      targetDist += (currentLetterSpacing / 100) * ea.style.fontSize;
      if (targetDist < 1) targetDist = 1; // Prevent backward steps or collapsed kerning
    }

    if (i === 0) {
      // Find the starting reference point at 'offset'
      lastPlacedPoint = getProjectedPoint(offset, dy);
    }

    let safety = 0;
    let currPt = getProjectedPoint(currentS, dy);
    let dist = (currPt && lastPlacedPoint) ? Math.hypot(currPt.x - lastPlacedPoint.x, currPt.y - lastPlacedPoint.y) : 0;
    
    // Ray-marching: Step forward along the base path until the 2D Euclidean distance 
    // between the character centers exactly matches the natural kerning distance.
    while (dist < targetDist && safety < 10000) {
      currentS += 0.5; // High-precision half-pixel steps
      currPt = getProjectedPoint(currentS, dy);
      if (currPt && lastPlacedPoint) {
        dist = Math.hypot(currPt.x - lastPlacedPoint.x, currPt.y - lastPlacedPoint.y);
      }
      safety++;
    }
    
    lastPlacedPoint = currPt;
    if (!currPt) continue;

    // Center the visual bounding box on that exact structural center
    const drawX = currPt.x - charPixelWidth / 2;
    const drawY = currPt.y - charPixelHeight / 2;

    // If reversing the text, rotate the characters 180 degrees to keep them upright 
    ea.style.angle = currPt.angle + (isReversed ? Math.PI : 0);
    ea.style.textAlign = "left";
    ea.style.verticalAlign = "top";
    
    const charID = ea.addText(drawX, drawY, character);
    
    // Pass custom properties back into the customData to be persisted
    ea.addAppendUpdateCustomData(charID, {
      text2Path: {
        pathID, 
        text: originalText, 
        pathElID, 
        isReversed, 
        offsetPct: currentOffsetPct, 
        distanceOffset: currentDistanceOffset,
        letterSpacing: currentLetterSpacing,
        placeInside: isInside
      }
    });
    objectIDs.push(charID);
  }
}

// Helper function to find a point at a specific distance along the path
// Enhanced to include extrapolation with a stabilizing window to prevent terminal jitters
function getPointAtDistance(distance, segments, totalLength) {
  if (!segments || segments.length === 0) return null;
  
  // Extrapolate backwards if distance is negative
  if (distance <= 0) {
    let refSegIdx = 0;
    let accumLen = 0;
    // Look ahead at least 5 pixels to get a stable starting angle, bypassing pen-down hooks
    while(refSegIdx < segments.length - 1 && accumLen < 5) {
        accumLen += segments[refSegIdx].length;
        refSegIdx++;
    }
    const refSeg = segments[refSegIdx];
    const firstSeg = segments[0];
    const angle = Math.atan2(refSeg.endPoint[1] - firstSeg.startPoint[1], refSeg.endPoint[0] - firstSeg.startPoint[0]);
    
    return {
      x: firstSeg.startPoint[0] + Math.cos(angle) * distance,
      y: firstSeg.startPoint[1] + Math.sin(angle) * distance,
      angle: angle
    };
  }
  
  // Extrapolate forwards if distance exceeds path length
  if (distance >= totalLength) {
    let refSegIdx = segments.length - 1;
    let accumLen = 0;
    // Look behind at least 5 pixels to get a stable ending angle, bypassing pen-lift hooks
    while(refSegIdx > 0 && accumLen < 5) {
        accumLen += segments[refSegIdx].length;
        refSegIdx--;
    }
    const refSeg = segments[refSegIdx];
    const lastSeg = segments[segments.length - 1];
    const angle = Math.atan2(lastSeg.endPoint[1] - refSeg.startPoint[1], lastSeg.endPoint[0] - refSeg.startPoint[0]);
    const over = distance - totalLength;
    
    return {
      x: lastSeg.endPoint[0] + Math.cos(angle) * over,
      y: lastSeg.endPoint[1] + Math.sin(angle) * over,
      angle: angle
    };
  }
  
  // Interpolate along the matching segment
  const segment = segments.find(seg => distance >= seg.startDist && distance <= seg.endDist) || segments[segments.length - 1];
  const t = (distance - segment.startDist) / segment.length;
  const x = segment.startPoint[0] + t * (segment.endPoint[0] - segment.startPoint[0]);
  const y = segment.startPoint[1] + t * (segment.endPoint[1] - segment.startPoint[1]);
  
  const angle = Math.atan2(segment.endPoint[1] - segment.startPoint[1], segment.endPoint[0] - segment.startPoint[0]);
  
  return { x, y, angle };
}

async function convertBezierToPoints() {
  const svgPadding = 100;
  let isLeftToRight = true;
  
  async function getSVGForPath() {
    let el = ea.getElement(pathEl.id);
    if(!el) {
      ea.copyViewElementsToEAforEditing([pathEl]);
      el = ea.getElement(pathEl.id);
    }
    el.roughness = 0;
    el.fillStyle = "solid";
    el.backgroundColor = "transparent";
    const svgElement = await ea.createSVG(undefined, false, undefined, undefined, 'light', svgPadding);
    ea.clear();
    return svgElement;
  }
  
  const svgElement = await getSVGForPath();

  if (svgElement) {
    const pathElSVG = svgElement.querySelector('path');
    if (pathElSVG) {
      // Extract only the first continuous subpath to avoid disconnected jumps
      const d = pathElSVG.getAttribute('d');
      const subpaths = d.match(/[Mm][^Mm]*/g);
      
      let workingPath = pathElSVG;
      if (subpaths && subpaths.length > 1) {
        workingPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        workingPath.setAttribute('d', subpaths[0]);
      }

      function samplePathPoints(pathNode, step = 5) {
        const points = [];
        const totalLength = pathNode.getTotalLength();
        for (let len = 0; len <= totalLength; len += step) {
          const pt = pathNode.getPointAtLength(len);
          points.push([pt.x, pt.y]);
        }
        const lastPt = pathNode.getPointAtLength(totalLength);
        if (
          points.length === 0 ||
          points[points.length - 1][0] !== lastPt.x ||
          points[points.length - 1][1] !== lastPt.y
        ) {
          points.push([lastPt.x, lastPt.y]);
        }
        return points;
      }
      
      let points = samplePathPoints(workingPath, 5);

      const cx = pathEl.x + pathEl.width / 2;
      const cy = pathEl.y + pathEl.height / 2;
      const angle = pathEl.angle || 0;

      points = points.map(([x, y]) => {
        let sx = pathEl.x + x;
        let sy = pathEl.y + y;
        
        if (angle !== 0) {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rx = cos * (sx - cx) - sin * (sy - cy) + cx;
          const ry = sin * (sx - cx) + cos * (sy - cy) + cy;
          return [rx, ry];
        }
        return [sx, sy];
      });
      
      isLeftToRight = pathEl.points[pathEl.points.length-1][0] >= 0;

      let pointsTop = points;
      let pointsBottom = null;

      // Handle Freedraw Trimming and Bottom Edge Extraction
      if (pathEl.type === "freedraw" && points.length > 10) {
        // Perfect Freehand creates a looped polygon. 
        // The first half traces one edge, the second half traces the return edge.
        const half = Math.floor(points.length / 2);
        
        let topEdge = points.slice(0, half);
        // Reverse the bottom edge so it flows Start->End, matching the top edge
        let bottomEdge = points.slice(half).reverse();
        
        // Trim the rounded end-caps (usually ~6 points at both ends)
        const TRIM = 6;
        if (topEdge.length > TRIM * 2) topEdge = topEdge.slice(TRIM, topEdge.length - TRIM);
        if (bottomEdge.length > TRIM * 2) bottomEdge = bottomEdge.slice(TRIM, bottomEdge.length - TRIM);

        // Ensure topEdge is actually the visual Top
        // If drawn Right-to-Left, the SVG winding order might map the first half to the bottom
        if (!isLeftToRight) {
           const temp = topEdge;
           topEdge = bottomEdge;
           bottomEdge = temp;
        }

        pointsTop = topEdge;
        pointsBottom = bottomEdge;
      } 
      // FIX: robustly handle simulated A->B->A strokes on lines and Double-Rounds on polygons
      else if (points.length > 10) {
        const firstPt = points[0];
        const lastPt = points[points.length - 1];
        const isLoop = Math.hypot(firstPt[0] - lastPt[0], firstPt[1] - lastPt[1]) < 3;

        if (pathEl.polygon) {
          // Polygons: find the FIRST time the path returns to the start to get exactly one round
          let loopEndIdx = -1;
          for (let i = 10; i < points.length; i++) {
            if (Math.hypot(points[i][0] - firstPt[0], points[i][1] - firstPt[1]) < 5) {
              loopEndIdx = i;
              break;
            }
          }
          if (loopEndIdx !== -1 && loopEndIdx < points.length * 0.9) {
            pointsTop = points.slice(0, loopEndIdx + 1);
          }
        } else if (isLoop) {
          // Open Lines: If it loops back, Excalidraw drew A->B->A. Slice in half to keep A->B.
          if (!isLeftToRight) points = points.reverse();
          pointsTop = points.slice(0, Math.ceil(points.length / 2));
        }
      }

      if (pointsTop.length > 1) {
        ea.clear();
        ea.style.backgroundColor="transparent";
        ea.style.roughness = 0;
        ea.style.strokeWidth = 1;
        ea.style.roundness = null;
        
        // We create line elements for BOTH the top and bottom edges in the EA workbench 
        // so we can dynamically swap them inside fitTextToShape when the user toggles settings.
        const lineId = ea.addLine(pointsTop);
        const line = ea.getElement(lineId);
        line.polygon = pathEl.polygon; 
        
        tempElementIDs.push(lineId);
        
        let lineBottom = null;
        if (pointsBottom && pointsBottom.length > 1) {
          const lineBottomId = ea.addLine(pointsBottom);
          lineBottom = ea.getElement(lineBottomId);
          lineBottom.polygon = pathEl.polygon;
          tempElementIDs.push(lineBottomId);
        }

        return [line, isLeftToRight, lineBottom];
      } else {
        new Notice("Could not extract enough points from SVG path.");
      }
    } else {
      new Notice("No path element found in SVG.");
    }
  }
  return [pathEl, isLeftToRight, null];
}

/**
 * Converts an ellipse element to a line element
 * @param {Object} ellipse - The ellipse element to convert
 * @param {number} pointDensity - Optional number of points to generate (defaults to 64)
 * @returns {string} The ID of the created line element
*/
function ellipseToLine(ellipse, pointDensity = 64) {
  if (!ellipse || ellipse.type !== "ellipse") {
    throw new Error("Input must be an ellipse element");
  }
  
  // Calculate points along the ellipse perimeter
  const stepSize = (Math.PI * 2) / pointDensity;
  const points = drawEllipse(
    ellipse.x, 
    ellipse.y, 
    ellipse.width, 
    ellipse.height, 
    ellipse.angle,
    0,
    Math.PI * 2,
    stepSize
  );
  
  // Save original styling to apply to the new line
  const originalStyling = {
    strokeColor: ellipse.strokeColor,
    strokeWidth: ellipse.strokeWidth,
    backgroundColor: ellipse.backgroundColor,
    fillStyle: ellipse.fillStyle,
    roughness: ellipse.roughness,
    strokeSharpness: ellipse.strokeSharpness,
    frameId: ellipse.frameId,
    groupIds: [...ellipse.groupIds],
    opacity: ellipse.opacity
  };
  
  // Use current style
  const prevStyle = {...ea.style};
  
  // Apply ellipse styling to the line
  ea.style.strokeColor = originalStyling.strokeColor;
  ea.style.strokeWidth = originalStyling.strokeWidth;
  ea.style.backgroundColor = originalStyling.backgroundColor;
  ea.style.fillStyle = originalStyling.fillStyle;
  ea.style.roughness = originalStyling.roughness;
  ea.style.strokeSharpness = originalStyling.strokeSharpness;
  ea.style.opacity = originalStyling.opacity;
  
  // Create the line and close it
  const lineId = ea.addLine(points);
  const line = ea.getElement(lineId);
  
  // Make it a polygon to close the path
  line.polygon = true;
  
  // Transfer grouping and frame information
  line.frameId = originalStyling.frameId;
  line.groupIds = originalStyling.groupIds;
  
  // Restore previous style
  ea.style = prevStyle;
  
  return ea.getElement(lineId);
  
  // Helper function from the Split Ellipse script
  function drawEllipse(x, y, width, height, angle = 0, start = 0, end = Math.PI*2, step = Math.PI/32) {
    const ellipse = (t) => {
      const spanningVector = rotateVector([width/2*Math.cos(t), height/2*Math.sin(t)], angle);
      const baseVector = [x+width/2, y+height/2];
      return addVectors([baseVector, spanningVector]);
    }

    if(end <= start) end = end + Math.PI*2;

    let points = [];
    const almostEnd = end - step/2;
    for (let t = start; t < almostEnd; t = t + step) {
      points.push(ellipse(t));
    }
    points.push(ellipse(end));
    return points;
  }
  
  function rotateVector(vec, ang) {
    var cos = Math.cos(ang);
    var sin = Math.sin(ang);
    return [vec[0] * cos - vec[1] * sin, vec[0] * sin + vec[1] * cos];
  }
  
  function addVectors(vectors) {
    return vectors.reduce((acc, vec) => [acc[0] + vec[0], acc[1] + vec[1]], [0, 0]);
  }
}

/**
 * Converts a rectangle element to a line element
 * @param {Object} rectangle - The rectangle element to convert
 * @param {number} pointDensity - Optional number of points to generate for curved segments (defaults to 16)
 * @returns {string} The ID of the created line element
 */
function rectangleToLine(rectangle, pointDensity = 16) {
  if (!rectangle || rectangle.type !== "rectangle") {
    throw new Error("Input must be a rectangle element");
  }

  // Save original styling to apply to the new line
  const originalStyling = {
    strokeColor: rectangle.strokeColor,
    strokeWidth: rectangle.strokeWidth,
    backgroundColor: rectangle.backgroundColor,
    fillStyle: rectangle.fillStyle,
    roughness: rectangle.roughness,
    strokeSharpness: rectangle.strokeSharpness,
    frameId: rectangle.frameId,
    groupIds: [...rectangle.groupIds],
    opacity: rectangle.opacity
  };
  
  // Use current style
  const prevStyle = {...ea.style};
  
  // Apply rectangle styling to the line
  ea.style.strokeColor = originalStyling.strokeColor;
  ea.style.strokeWidth = originalStyling.strokeWidth;
  ea.style.backgroundColor = originalStyling.backgroundColor;
  ea.style.fillStyle = originalStyling.fillStyle;
  ea.style.roughness = originalStyling.roughness;
  ea.style.strokeSharpness = originalStyling.strokeSharpness;
  ea.style.opacity = originalStyling.opacity;
  
  // Calculate points for the rectangle perimeter
  const points = generateRectanglePoints(rectangle, pointDensity);
  
  // Create the line and close it
  const lineId = ea.addLine(points);
  const line = ea.getElement(lineId);
  
  // Make it a polygon to close the path
  line.polygon = true;
  
  // Transfer grouping and frame information
  line.frameId = originalStyling.frameId;
  line.groupIds = originalStyling.groupIds;
  
  // Restore previous style
  ea.style = prevStyle;
  
  return ea.getElement(lineId);
   
  // Helper function to generate rectangle points with optional rounded corners
  function generateRectanglePoints(rectangle, pointDensity) {
    const { x, y, width, height, angle = 0 } = rectangle;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // If no roundness, create a simple rectangle
    if (!rectangle.roundness) {
      const corners = [
        [x, y],                   // top-left
        [x + width, y],           // top-right
        [x + width, y + height],  // bottom-right
        [x, y + height],          // bottom-left
        [x,y] //origo
      ];
      
      // Apply rotation if needed
      if (angle !== 0) {
        return corners.map(point => rotatePoint(point, [centerX, centerY], angle));
      }
      return corners;
    }
    
    // Handle rounded corners
    const points = [];
    
    // Calculate corner radius using Excalidraw's algorithm
    const cornerRadius = getCornerRadius(Math.min(width, height), rectangle);
    const clampedRadius = Math.min(cornerRadius, width / 2, height / 2);
    
    // Corner positions
    const topLeft = [x + clampedRadius, y + clampedRadius];
    const topRight = [x + width - clampedRadius, y + clampedRadius];
    const bottomRight = [x + width - clampedRadius, y + height - clampedRadius];
    const bottomLeft = [x + clampedRadius, y + height - clampedRadius];
    
    // Add top-left corner arc
    points.push(...createArc(
      topLeft[0], topLeft[1], clampedRadius, Math.PI, Math.PI * 1.5, pointDensity));
    
    // Add top edge
    points.push([x + clampedRadius, y], [x + width - clampedRadius, y]);
    
    // Add top-right corner arc
    points.push(...createArc(
      topRight[0], topRight[1], clampedRadius, Math.PI * 1.5, Math.PI * 2, pointDensity));
    
    // Add right edge
    points.push([x + width, y + clampedRadius], [x + width, y + height - clampedRadius]);
    
    // Add bottom-right corner arc
    points.push(...createArc(
      bottomRight[0], bottomRight[1], clampedRadius, 0, Math.PI * 0.5, pointDensity));
    
    // Add bottom edge
    points.push([x + width - clampedRadius, y + height], [x + clampedRadius, y + height]);
    
    // Add bottom-left corner arc
    points.push(...createArc(
      bottomLeft[0], bottomLeft[1], clampedRadius, Math.PI * 0.5, Math.PI, pointDensity));
    
    // Add left edge
    points.push([x, y + height - clampedRadius], [x, y + clampedRadius]);
    
    // Apply rotation if needed
    if (angle !== 0) {
      return points.map(point => rotatePoint(point, [centerX, centerY], angle));
    }
    
    return points;
  }
  
  // Helper function to create an arc of points
  function createArc(centerX, centerY, radius, startAngle, endAngle, pointDensity) {
    const points = [];
    const angleStep = (endAngle - startAngle) / pointDensity;
    
    for (let i = 0; i <= pointDensity; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push([x, y]);
    }
    
    return points;
  }
  
  // Helper function to rotate a point around a center
  function rotatePoint(point, center, angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    // Translate point to origin
    const x = point[0] - center[0];
    const y = point[1] - center[1];
    
    // Rotate point
    const xNew = x * cos - y * sin;
    const yNew = x * sin + y * cos;
    
    // Translate point back
    return [xNew + center[0], yNew + center[1]];
  }
}

function getCornerRadius(x, element) {
  const fixedRadiusSize = element.roundness?.value ?? 32;
  const CUTOFF_SIZE = fixedRadiusSize / 0.25;
  if (x <= CUTOFF_SIZE) {
    return x * 0.25;
  }
  return fixedRadiusSize;
}

/**
 * Converts a diamond element to a line element
 * @param {Object} diamond - The diamond element to convert
 * @param {number} pointDensity - Optional number of points to generate for curved segments (defaults to 16)
 * @returns {string} The ID of the created line element
 */
function diamondToLine(diamond, pointDensity = 16) {
  if (!diamond || diamond.type !== "diamond") {
    throw new Error("Input must be a diamond element");
  }

  // Save original styling to apply to the new line
  const originalStyling = {
    strokeColor: diamond.strokeColor,
    strokeWidth: diamond.strokeWidth,
    backgroundColor: diamond.backgroundColor,
    fillStyle: diamond.fillStyle,
    roughness: diamond.roughness,
    strokeSharpness: diamond.strokeSharpness,
    frameId: diamond.frameId,
    groupIds: [...diamond.groupIds],
    opacity: diamond.opacity
  };
  
  // Use current style
  const prevStyle = {...ea.style};
  
  // Apply diamond styling to the line
  ea.style.strokeColor = originalStyling.strokeColor;
  ea.style.strokeWidth = originalStyling.strokeWidth;
  ea.style.backgroundColor = originalStyling.backgroundColor;
  ea.style.fillStyle = originalStyling.fillStyle;
  ea.style.roughness = originalStyling.roughness;
  ea.style.strokeSharpness = originalStyling.strokeSharpness;
  ea.style.opacity = originalStyling.opacity;
  
  // Calculate points for the diamond perimeter
  const points = generateDiamondPoints(diamond, pointDensity);
  
  // Create the line and close it
  const lineId = ea.addLine(points);
  const line = ea.getElement(lineId);
  
  // Make it a polygon to close the path
  line.polygon = true;
  
  // Transfer grouping and frame information
  line.frameId = originalStyling.frameId;
  line.groupIds = originalStyling.groupIds;
  
  // Restore previous style
  ea.style = prevStyle;
  
  return ea.getElement(lineId);

  function generateDiamondPoints(diamond, pointDensity) {
    const { x, y, width, height, angle = 0 } = diamond;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Diamond corners
    const top    = [cx, y];
    const right  = [x + width, cy];
    const bottom = [cx, y + height];
    const left   = [x, cy];

    if (!diamond.roundness) {
      const corners = [top, right, bottom, left, top];
      if (angle !== 0) {
        return corners.map(pt => rotatePoint(pt, [cx, cy], angle));
      }
      return corners;
    }

    // Clamp radius
    const r = Math.min(
      getCornerRadius(Math.min(width, height) / 2, diamond),
      width / 2,
      height / 2
    );

    // For a diamond, the rounded corner is a *bezier* between the two adjacent edge points, not a circular arc.
    // Excalidraw uses a quadratic bezier for each corner, with the control point at the corner itself.

    // Calculate edge directions
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
    function norm([x, y]) {
      const len = Math.hypot(x, y);
      return [x / len, y / len];
    }
    function scale([x, y], s) { return [x * s, y * s]; }

    // For each corner, move along both adjacent edges by r to get arc endpoints
    // Order: top, right, bottom, left
    const corners = [top, right, bottom, left];
    const next = [right, bottom, left, top];
    const prev = [left, top, right, bottom];

    // For each corner, calculate the two points where the straight segments meet the arc
    const arcPoints = [];
    for (let i = 0; i < 4; ++i) {
      const c = corners[i];
      const n = next[i];
      const p = prev[i];
      const toNext = norm(sub(n, c));
      const toPrev = norm(sub(p, c));
      arcPoints.push([
        add(c, scale(toPrev, r)), // start of arc (from previous edge)
        add(c, scale(toNext, r)), // end of arc (to next edge)
        c                         // control point for bezier
      ]);
    }

    // Helper: quadratic bezier between p0 and p2 with control p1
    function bezier(p0, p1, p2, density) {
      const pts = [];
      for (let i = 0; i <= density; ++i) {
        const t = i / density;
        const mt = 1 - t;
        pts.push([
          mt*mt*p0[0] + 2*mt*t*p1[0] + t*t*p2[0],
          mt*mt*p0[1] + 2*mt*t*p1[1] + t*t*p2[1]
        ]);
      }
      return pts;
    }

    // Build path: for each corner, straight line to arc start, then bezier to arc end using corner as control
    let pts = [];
    for (let i = 0; i < 4; ++i) {
      const prevArc = arcPoints[(i + 3) % 4];
      const arc = arcPoints[i];
      if (i === 0) {
        pts.push(arc[0]);
      } else {
        pts.push(arc[0]);
      }
      // Quadratic bezier from arc[0] to arc[1] with control at arc[2] (the corner)
      pts.push(...bezier(arc[0], arc[2], arc[1], pointDensity));
    }
    pts.push(arcPoints[0][0]); // close

    if (angle !== 0) {
      return pts.map(pt => rotatePoint(pt, [cx, cy], angle));
    }
    return pts;
  }

  // Helper function to create an arc between two points
  function createArcBetweenPoints(startPoint, endPoint, centerX, centerY, pointDensity) {
    const startAngle = Math.atan2(startPoint[1] - centerY, startPoint[0] - centerX);
    const endAngle = Math.atan2(endPoint[1] - centerY, endPoint[0] - centerX);
    
    // Ensure angles are in correct order for arc drawing
    let adjustedEndAngle = endAngle;
    if (endAngle < startAngle) {
      adjustedEndAngle += 2 * Math.PI;
    }
    
    const points = [];
    const angleStep = (adjustedEndAngle - startAngle) / pointDensity;
    
    // Start with the straight line to arc start
    points.push(startPoint);
    
    // Create arc points
    for (let i = 1; i < pointDensity; i++) {
      const angle = startAngle + i * angleStep;
      const distance = Math.hypot(startPoint[0] - centerX, startPoint[1] - centerY);
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      points.push([x, y]);
    }
    
    // Add the end point of the arc
    points.push(endPoint);
    
    return points;
  }
  
  // Helper function to rotate a point around a center
  function rotatePoint(point, center, angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    // Translate point to origin
    const x = point[0] - center[0];
    const y = point[1] - center[1];
    
    // Rotate point
    const xNew = x * cos - y * sin;
    const yNew = x * sin + y * cos;
    
    // Translate point back
    return [xNew + center[0], yNew + center[1]];
  }
}

async function addToView() {
  ea.getElements()
    .filter(el=>el.type==="text" && el.text === " " && !el.isDeleted)
    .forEach(el=>tempElementIDs.push(el.id));
  tempElementIDs.forEach(elID=>{
    delete ea.elementsDict[elID];
  });
  await ea.addElementsToView(false, false, true);
}

// ------------------------------------------------------------
// Convert any shape type to a series of points along a path
// In practice this only applies to ellipses and straight lines
// ------------------------------------------------------------
async function fitTextToShape() {
  // Swap to the bottom path if it's a freedraw and the user reversed the text or placed it inside
  let activePathEl = pathEl;
  if (originalPathType === "freedraw" && pathElBottom) {
     if (currentPlaceInside) {
        activePathEl = pathElBottom;
     }
  }
  
  const pathPoints = calculatePathPoints(activePathEl);

  let pathLength = 0;
  for (let i = 1; i < pathPoints.length; i++) {
    const dx = pathPoints[i][0] - pathPoints[i-1][0];
    const dy = pathPoints[i][1] - pathPoints[i-1][1];
    pathLength += Math.sqrt(dx*dx + dy*dy);
  }
  
  const textWidth = ea.measureText(currentText).width;
  let offsetValue = 0;
  
  const effectiveCurrentOffsetPct = originalPathDirectionLR ? -currentOffsetPct : currentOffsetPct;
  if (pathEl.polygon) {
    // With double-loops removed from the path array, pathLength is now 1 round.
    // 100 divisor maps +/- 50% slider range exactly to 1 full loop length.
    offsetValue = (effectiveCurrentOffsetPct / 100) * pathLength; 
  } else {
    // Open path calibration
    if (effectiveCurrentOffsetPct < 0) {
      offsetValue = (Math.abs(effectiveCurrentOffsetPct) / 50) * -textWidth;
    } else {
      offsetValue = (effectiveCurrentOffsetPct / 50) * pathLength;
    }
  }

  const pathID = ea.generateElementId();
  let objectIDs = [];

  distributeTextAlongPath(
    currentText,
    pathPoints,
    pathID,
    objectIDs,
    offsetValue,
    isLeftToRight,
    pathEl.polygon,
    currentIsReversed,
    currentPlaceInside,
    activePathEl === pathElBottom // Pass a flag to invert dy if using the bottom edge
  );

  const groupID = ea.addToGroup(objectIDs);
  generatedIDs.push(...objectIDs);

  await addToView();
  const selectedElementIds = Object.fromEntries(
    objectIDs.map(id => [id, true])
  );
  ea.viewUpdateScene({
    appState: {
      selectedElementIds,
      selectedGroupIds: { [groupID]: true }
    }
  });
}
```
