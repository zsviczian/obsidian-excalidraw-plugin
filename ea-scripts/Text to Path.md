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

const st = ea.getExcalidrawAPI().getAppState();
const fontSize = textEl?.fontSize ?? st.currentItemFontSize;
const fontFamily = textEl?.fontFamily ?? st.currentItemFontFamily;
ea.style.fontSize = fontSize;
ea.style.fontFamily = fontFamily;
const fontHeight = ea.measureText("M").height*1.3;

const aspectRatio = pathEl.width/pathEl.height;
const isCircle = pathEl.type === "ellipse" && aspectRatio > 0.9  && aspectRatio < 1.1;
const isPathLinear = ["line", "arrow", "freedraw"].includes(pathEl.type);
if(!isCircle && !isPathLinear) {
  ea.copyViewElementsToEAforEditing([pathEl]);
  pathEl = ea.getElement(pathEl.id);
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
if(
  (["line", "arrow"].includes(pathEl.type) && pathEl.roundness !== null) ||
  pathEl.type === "freedraw"
) {
  [pathEl, isLeftToRight] = await convertBezierToPoints();
}

// ---------------------------------------------------------
// Retreive original text from text-on-path customData
// ---------------------------------------------------------
const initialOffset = textEl?.customData?.text2Path?.offset ?? 0;
const initialArchAbove = textEl?.customData?.text2Path?.archAbove ?? true;

const text = (await utils.inputPrompt({
  header: "Edit",
  value: textEl?.customData?.text2Path
    ? textEl.customData.text2Path.text
    : textEl?.text ?? "",
  lines: 3,
  customComponents: isCircle ? circleArchControl : offsetControl,
  draggable: true,
}))?.replace(" \n"," ").replace("\n ", " ").replace("\n"," ");

if(!text) {
  new Notice("No text provided!");
  return;
}

// -------------------------------------
// Copy font style to ExcalidrawAutomate
// -------------------------------------
ea.style.fontSize = fontSize;
ea.style.fontFamily = fontFamily;
ea.style.strokeColor = textEl?.strokeColor ?? st.currentItemStrokeColor;
ea.style.opacity = textEl?.opacity ?? st.currentItemOpacity;

// -----------------------------------
// Delete previous text arch if exists
// -----------------------------------
if (textEl?.customData?.text2Path) {
  const pathID = textEl.customData.text2Path.pathID;
  const elements = ea.getViewElements().filter(el=>el.customData?.text2Path && el.customData.text2Path.pathID === pathID);
  ea.copyViewElementsToEAforEditing(elements);
  ea.getElements().forEach(el=>{el.isDeleted = true;});
} else {
  if(textEl) {
    ea.copyViewElementsToEAforEditing([textEl]);
    ea.getElements().forEach(el=>{el.isDeleted = true;});
  }
}

if(isCircle) {
  await fitTextToCircle();
} else {
  await fitTextToShape();
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

// Function to create the circle arch position control in the dialog
function circleArchControl(container) {
  if (typeof win.ArchPosition === "undefined") {
    win.ArchPosition = initialArchAbove;
  }
  
  const archContainer = container.createDiv();
  archContainer.style.display = "flex";
  archContainer.style.alignItems = "center";
  archContainer.style.marginBottom = "8px";
  
  const label = archContainer.createEl("label");
  label.textContent = "Arch position:";
  label.style.marginRight = "10px";
  label.style.fontWeight = "bold";
  
  const select = archContainer.createEl("select");
  
  // Add options for above/below
  const aboveOption = select.createEl("option");
  aboveOption.value = "true";
  aboveOption.text = "Above";
  
  const belowOption = select.createEl("option");
  belowOption.value = "false";
  belowOption.text = "Below";
  
  // Set the default value
  select.value = win.ArchPosition ? "true" : "false";
  
  select.addEventListener("change", (e) => {
    win.ArchPosition = e.target.value === "true";
  });
}

// Function to create the offset input control in the dialog
function offsetControl(container) {
  if (!win.TextArchOffset) win.TextArchOffset = initialOffset.toString();
  
  const offsetContainer = container.createDiv();
  offsetContainer.style.display = "flex";
  offsetContainer.style.alignItems = "center";
  offsetContainer.style.marginBottom = "8px";
  
  const label = offsetContainer.createEl("label");
  label.textContent = "Offset (px):";
  label.style.marginRight = "10px";
  label.style.fontWeight = "bold";
  
  const input = offsetContainer.createEl("input");
  input.type = "number";
  input.value = win.TextArchOffset;
  input.placeholder = "0";
  input.style.width = "60px";
  input.style.padding = "4px";
  
  input.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val === "" || !isNaN(parseInt(val))) {
      win.TextArchOffset = val;
    } else {
      e.target.value = win.TextArchOffset || "0";
    }
  });
}

// Function to convert any shape to a series of points along its path
function calculatePathPoints(element) { 
  // Handle lines, arrows, and freedraw paths
  const points = [];
  
  // Get absolute coordinates of all points
  const absolutePoints = element.points.map(point => [
    point[0] + element.x,
    point[1] + element.y
  ]);
  
  // Calculate segment information
  let segments = [];
  
  for (let i = 0; i < absolutePoints.length - 1; i++) {
    const p0 = absolutePoints[i];
    const p1 = absolutePoints[i+1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    segments.push({
      p0, p1, length: segmentLength, angle
    });
  }
  
  // Sample points along each segment
  for (const segment of segments) {
    // Number of points to sample depends on segment length
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
function distributeTextAlongPath(text, pathPoints, pathID, objectIDs, offset = 0, isLeftToRight) {
  if (pathPoints.length === 0) return;

  const {baseline} = ExcalidrawLib.getFontMetrics(ea.style.fontFamily, ea.style.fontSize);

  const originalText = text;
  if(!isLeftToRight) {
    text = text.split('').reverse().join('');
  }

  // Calculate path length
  let pathLength = 0;
  let pathSegments = [];
  let accumulatedLength = 0;
  
  for (let i = 1; i < pathPoints.length; i++) {
    const [x1, y1] = [pathPoints[i-1][0], pathPoints[i-1][1]];
    const [x2, y2] = [pathPoints[i][0], pathPoints[i][1]];
    const segLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    
    pathSegments.push({
      startPoint: pathPoints[i-1],
      endPoint: pathPoints[i],
      length: segLength,
      startDist: accumulatedLength,
      endDist: accumulatedLength + segLength
    });
    
    accumulatedLength += segLength;
    pathLength += segLength;
  }

  // Precompute substring widths for kerning-accurate placement
  const substrWidths = [];
  for (let i = 0; i <= text.length; i++) {
    substrWidths.push(ea.measureText(text.substring(0, i)).width);
  }

  // The actual distance along the path for a character's center is `offset + charCenter`.
  for (let i = 0; i < text.length; i++) {
    const character = text.substring(i, i+1);
    const charHeight = ea.measureText(character).height;

    // Advance for this character (kerning-aware)
    const prevWidth = substrWidths[i];
    const nextWidth = substrWidths[i+1];
    const charAdvance = nextWidth - prevWidth;

    // Center of this character in the full text
    const charCenter = isLeftToRight
      ? (i === 0 ? charAdvance / 2 : prevWidth + charAdvance / 2)
      : prevWidth + charAdvance / 2; // For RTL, text is reversed, so this logic still holds for the reversed string

    // Target distance along the path for the character's center
    const targetDistOnPath = offset + charCenter;

    // Find point on path for the BASELINE at the center of this character
    let pointInfo = getPointAtDistance(targetDistOnPath, pathSegments, pathLength);
    let x, y, angle;
    if (pointInfo) {
      x = pointInfo.x;
      y = pointInfo.y;
      angle = pointInfo.angle;
    } else {
      // We're beyond the path, continue in the direction of the last segment
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (!lastSegment) { // Should not happen if pathPoints.length > 0
        // Fallback if somehow pathSegments is empty but pathPoints was not
        x = pathPoints[0]?.[0] ?? 0;
        y = pathPoints[0]?.[1] ?? 0;
        angle = pathPoints[0]?.[2] ?? 0;
      } else {
        const lastPoint = lastSegment.endPoint;
        const secondLastPoint = lastSegment.startPoint;
        angle = Math.atan2(
          lastPoint[1] - secondLastPoint[1], 
          lastPoint[0] - secondLastPoint[0]
        );
      
        // Calculate how far past the end of the path this character's center should be
        const distanceFromEnd = targetDistOnPath - pathLength;
      
        // Position character extending beyond the path
        x = lastPoint[0] + Math.cos(angle) * distanceFromEnd;
        y = lastPoint[1] + Math.sin(angle) * distanceFromEnd;
      }
    }

    // Use baseline offset directly (already in px)
    const baselineOffset = baseline;

    // Place the character so its baseline is on the path and horizontally centered
    const drawX = x - charAdvance / 2;
    const drawY = y - baselineOffset/2;

    ea.style.angle = angle + (isLeftToRight ? 0 : Math.PI);
    const charID = ea.addText(drawX, drawY, character);
    ea.addAppendUpdateCustomData(charID, {
      text2Path: {pathID, text: originalText, pathElID, offset}
    });
    objectIDs.push(charID);
  }

  transposeElements(new Set(objectIDs));
}

// Helper function to find a point at a specific distance along the path
function getPointAtDistance(distance, segments, totalLength) {
  if (distance > totalLength) return null;
  
  // Find the segment where this distance falls
  const segment = segments.find(seg => 
    distance >= seg.startDist && distance <= seg.endDist
  );
  
  if (!segment) return null;
  
  // Calculate position within the segment
  const t = (distance - segment.startDist) / segment.length;
  const [x1, y1, angle1] = segment.startPoint;
  const [x2, y2, angle2] = segment.endPoint;
  
  // Linear interpolation
  const x = x1 + t * (x2 - x1);
  const y = y1 + t * (y2 - y1);
  
  // Use the segment's angle
  const angle = angle1;
  
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
    const {topX, topY, width, height} = ea.getBoundingBox(ea.getElements());
    const svgElement = await ea.createSVG(undefined,false,undefined,undefined,'light',svgPadding);
    ea.clear();
    return {
      svgElement,
      boundingBox: {topX, topY, width, height}
    };
  }
  
  const {svgElement, boundingBox} = await getSVGForPath();

  if (svgElement) {
    // Find the <path> element in the SVG
    const pathElSVG = svgElement.querySelector('path');
    if (pathElSVG) {
      // Use SVGPathElement's getPointAtLength to sample points along the path
      function samplePathPoints(pathElSVG, step = 15) {
        const points = [];
        const totalLength = pathElSVG.getTotalLength();
        for (let len = 0; len <= totalLength; len += step) {
          const pt = pathElSVG.getPointAtLength(len);
          points.push([pt.x, pt.y]);
        }
        // Ensure last point is included
        const lastPt = pathElSVG.getPointAtLength(totalLength);
        if (
          points.length === 0 ||
          points[points.length - 1][0] !== lastPt.x ||
          points[points.length - 1][1] !== lastPt.y
        ) {
          points.push([lastPt.x, lastPt.y]);
        }
        return points;
      }
      
      let points = samplePathPoints(pathElSVG, 15); // 15 px step, adjust for smoothness

      // --- Map SVG coordinates back to Excalidraw coordinate system ---
      // Get the <g> transform
      const g = pathElSVG.closest('g');
      let dx = 0, dy = 0;
      if (g) {
        const m = g.getAttribute('transform');
        // Parse translate(x y) from transform
        const match = m && m.match(/translate\(([-\d.]+)[ ,]([-\d.]+)/);
        if (match) {
          dx = parseFloat(match[1]);
          dy = parseFloat(match[2]);
        }
      }
      
      // Calculate the scale factor from SVG space to actual element space
      const svgContentWidth = boundingBox.width;
      const svgContentHeight = boundingBox.height;
           
      // The transform dy includes both padding and element positioning within SVG
      // We need to subtract the padding from the transform to get the actual element offset
      const elementOffsetY = dy - svgPadding;
      
      isLeftToRight = pathEl.points[pathEl.points.length-1][0] >=0;

      points = points.map(([x, y]) => [
        boundingBox.topX + (x - dx) + svgPadding + (isLeftToRight ? 0 : boundingBox.width*2),
        pathEl.y + y
      ]);
      
      // For freedraw paths, we typically want only the top half of the outline
      // The SVG path traces the entire perimeter, but we want just the top edge
      // Trim to get approximately the first half of the path points
      if (points.length > 3) {
        if(!isLeftToRight && pathEl.type === "freedraw") {
          points = points.reverse();
        }
        points = points.slice(0, Math.ceil(points.length / 2)-2); //DO NOT REMOVE THE -2 !!!!!
      }

      if (points.length > 1) {
        ea.clear();
        ea.style.backgroundColor="transparent";
        ea.style.roughness = 0;
        ea.style.strokeWidth = 1;
        ea.style.roundness = null;
        const lineId = ea.addLine(points);
        const line = ea.getElement(lineId);
        tempElementIDs.push(lineId);
        return [line, isLeftToRight];
      } else {
        new Notice("Could not extract enough points from SVG path.");
      }
    } else {
      new Notice("No path element found in SVG.");
    }
  }
  return [pathEl, isLeftToRight];
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

async function fitTextToCircle() {
  const r = (pathEl.width+pathEl.height)/4 + fontHeight/2;
  const archAbove = win.ArchPosition ?? initialArchAbove;

  if (textEl?.customData?.text2Path) {
    const pathID = textEl.customData.text2Path.pathID;
    const elements = ea.getViewElements().filter(el=>el.customData?.text2Path && el.customData.text2Path.pathID === pathID);
    ea.copyViewElementsToEAforEditing(elements);
  } else {
    if(textEl) ea.copyViewElementsToEAforEditing([textEl]);
  }
  ea.getElements().forEach(el=>{el.isDeleted = true;});

  // Define center point of the ellipse
  const centerX = pathEl.x + r - fontHeight/2;
  const centerY = pathEl.y + r - fontHeight/2;

  function circlePoint(angle) {
    // Calculate point exactly on the ellipse's circumference
    return [
      centerX + r * Math.sin(angle),
      centerY - r * Math.cos(angle)
    ];
  }

  // Calculate the text width to center it properly
  const textWidth = ea.measureText(text).width;

  // Calculate starting angle based on arch position
  // For "Arch above", start at top (0 radians)
  // For "Arch below", start at bottom (π radians)
  const startAngle = archAbove ? 0 : Math.PI;

  // Calculate how much of the circle arc the text will occupy
  const arcLength = textWidth / r;

  // Set the starting rotation to center the text at the top/bottom point
  let rot = startAngle - arcLength / 2;

  const pathID = ea.generateElementId();

  let objectIDs = [];

  for(
    archAbove ? i=0 : i=text.length-1;
    archAbove ? i<text.length : i>=0;
    archAbove ? i++ : i--
  ) {
    const character = text.substring(i,i+1);
    const charMetrics = ea.measureText(character);
    const charWidth = charMetrics.width / r;
    // Adjust rotation to position the current character
    const charAngle = rot + charWidth / 2;
    // Calculate point on the circle's edge
    const [baseX, baseY] = circlePoint(charAngle);

    // Center each character horizontally and vertically
    // Use the actual character width and height for precise placement
    const charPixelWidth = charMetrics.width;
    const charPixelHeight = charMetrics.height;
    // Place the character so its center is on the circle
    const x = baseX - charPixelWidth / 2;
    const y = baseY - charPixelHeight / 2;

    // Set rotation for the character to align with the tangent of the circle
    // No additional 90 degree rotation needed
    ea.style.angle = charAngle + (archAbove ? 0 : Math.PI);

    const charID = ea.addText(x, y, character);
    ea.addAppendUpdateCustomData(charID, {
      text2Path: {pathID, text, pathElID, archAbove, offset: 0}
    });
    objectIDs.push(charID);

    rot += charWidth;
  }

  const groupID = ea.addToGroup(objectIDs);
  const letterSet = new Set(objectIDs);
  await addToView();
  ea.selectElementsInView(ea.getViewElements().filter(el=>letterSet.has(el.id) && !el.isDeleted));
}

// ------------------------------------------------------------
// Convert any shape type to a series of points along a path
// In practice this only applies to ellipses and streight lines
// ------------------------------------------------------------
async function fitTextToShape() {
  const pathPoints = calculatePathPoints(pathEl);

  // Generate a unique ID for this text arch
  const pathID = ea.generateElementId();
  let objectIDs = [];

  // Place text along the path with natural spacing
  const offsetValue = (parseInt(win.TextArchOffset ?? initialOffset) || 0);

  distributeTextAlongPath(text, pathPoints, pathID, objectIDs, offsetValue, isLeftToRight);

  // Add all text characters to a group
  const groupID = ea.addToGroup(objectIDs);
  const letterSet = new Set(objectIDs);
  await addToView();
  ea.selectElementsInView(ea.getViewElements().filter(el=>letterSet.has(el.id) && !el.isDeleted));
}