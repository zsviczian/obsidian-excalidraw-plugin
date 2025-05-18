/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/text-arch.jpg)

This script allows you to fit a text element along a selected path (line, arrow, freedraw, ellipse, rectangle, or diamond) in Excalidraw. You can select either a path or a text element, or both:

- If only a path is selected, you will be prompted to provide the text.
- If only a text element is selected and it was previously fitted to a path, the script will use the original path if it is still present in the scene.
- If both a text and a path are selected, the script will fit the text to the selected path.

If the path is a perfect circle, you will be prompted to choose whether to fit the text above or below the circle.

After fitting, the text will no longer be editable as a standard text element or function as a markdown link. Emojis are not supported.

```javascript
*/
els = ea.getViewSelectedElements();
let pathEl = els.find(el=>["ellipse", "rectangle", "diamond", "line", "arrow", "freedraw"].includes(el.type));
const textEl = els.find(el=>el.type === "text");

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

const aspectRatio = pathEl.width/pathEl.height;
const isCircle = pathEl.type === "ellipse" && aspectRatio > 0.9  && aspectRatio < 1.1;


// ---------------------------------------------------------
// Convert path to SVG and use real path for text placement.
// ---------------------------------------------------------
if((["line", "arrow"].includes(pathEl.type) && pathEl.roundness !== null) || ["freedraw", "rectangle", "diamond"].includes(pathEl.type)) {
  pathEl = await convertBezierToPoints();
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
})).replace(" \n"," ").replace("\n ", " ").replace("\n"," ");

if(!text) {
  new Notice("No text provided!");
  return;
}

// -------------------------------------
// Copy font style to ExcalidrawAutomate
// -------------------------------------
const st = ea.getExcalidrawAPI().getAppState();
ea.style.fontSize = textEl?.fontSize ?? st.currentItemFontSize;
ea.style.fontFamily = textEl?.fontFamily ?? st.currentItemFontFamily;
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

// --------------------------------------------------------
// Use original text arch algorithm in case shape is circle
// --------------------------------------------------------
if (isCircle) {
  const r = (pathEl.width+pathEl.height)/4;
  const archAbove = win.ArchPosition ?? initialArchAbove;

  if (textEl.customData?.text2Path) {
    const pathID = textEl.customData.text2Path.pathID;
    const elements = ea.getViewElements().filter(el=>el.customData?.text2Path && el.customData.text2Path.pathID === pathID);
    ea.copyViewElementsToEAforEditing(elements);
  } else {
    ea.copyViewElementsToEAforEditing([textEl]);
  }
  ea.getElements().forEach(el=>{el.isDeleted = true;});

  // Define center point of the ellipse
  const centerX = pathEl.x + r;
  const centerY = pathEl.y + r;

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
  await ea.addElementsToView(false, false, true);
  ea.selectElementsInView(ea.getViewElements().filter(el=>letterSet.has(el.id)));
  return;
}

// ------------------------------------------------------------
// Convert any shape type to a series of points along a path
// In practice this only applies to ellipses and streight lines
// ------------------------------------------------------------
const pathPoints = calculatePathPoints(pathEl);


// Calculate character metrics for spacing
const charWidths = [];
const charHeights = [];
let totalTextWidth = 0;
for (let i = 0; i < text.length; i++) {
  const character = text.substring(i, i+1);
  const charWidth = ea.measureText(character).width;
  const charHeight = ea.measureText(character).height;
  charWidths.push(charWidth);
  charHeights.push(charHeight);
  totalTextWidth += charWidth;
}

// Generate a unique ID for this text arch
const pathID = ea.generateElementId();
let objectIDs = [];

// Place text along the path with natural spacing
const offset = isCircle ? 0 : (parseInt(win.TextArchOffset ?? initialOffset) || 0);
distributeTextAlongPath(text, pathPoints, pathID, objectIDs, charWidths, charHeights, ea.measureText("i").width*0.3, offset);

// Add all text characters to a group
const groupID = ea.addToGroup(objectIDs);
const letterSet = new Set(objectIDs);
await ea.addElementsToView(false, false, true);
ea.selectElementsInView(ea.getViewElements().filter(el=>letterSet.has(el.id)));

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
  // Handle closed shapes by converting them to points along their perimeter
  if (["ellipse", "rectangle", "diamond"].includes(element.type)) {
    return getClosedShapePoints(element);
  }
  
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

// Function to get points along the perimeter of a closed shape
function getClosedShapePoints(element) {
  let points = [];
  
  if (element.type === "ellipse") {
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const rx = element.width / 2;
    const ry = element.height / 2;
    
    // Sample points along the ellipse perimeter
    const numPoints = 64;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const x = centerX + rx * Math.cos(angle);
      const y = centerY + ry * Math.sin(angle);
      
      // Calculate tangent angle
      const tangentAngle = angle + Math.PI / 2; // Tangent is perpendicular to radius
      
      points.push([x, y, tangentAngle]);
    }
    
    // Close the loop
    points.push(points[0]);
  } 
  else if (element.type === "rectangle" || element.type === "diamond") {
    let corners;
    
    if (element.type === "rectangle") {
      const x = element.x;
      const y = element.y;
      const width = element.width;
      const height = element.height;
      
      corners = [
        [x, y],               // top-left
        [x, y + height],      // bottom-left
        [x + width, y + height], // bottom-right
        [x + width, y],       // top-right
        [x, y]                // back to start
      ];
    } 
    else { // Diamond
      const x = element.x;
      const y = element.y;
      const width = element.width;
      const height = element.height;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      corners = [
        [centerX, y],         // top
        [x + width, centerY], // right
        [centerX, y + height], // bottom
        [x, centerY],         // left
        [centerX, y]          // back to top
      ];
    }
    
    // Sample points along each side of the polygon
    for (let i = 0; i < corners.length - 1; i++) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[i + 1];
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const sideLength = Math.sqrt(dx*dx + dy*dy);
      const angle = Math.atan2(dy, dx);
      
      // Sample points based on side length
      const numPoints = Math.max(2, Math.ceil(sideLength / 5)); // 1 point every 5 pixels
      
      for (let j = 0; j < numPoints; j++) {
        const t = j / (numPoints - 1);
        const x = x1 + t * dx;
        const y = y1 + t * dy;
        // Fix: Don't add an additional 90 degrees for rectangle and diamond
        points.push([x, y, angle]);
      }
    }
  }
  
  return points;
}

// Function to distribute text along any path
function distributeTextAlongPath(text, pathPoints, pathID, objectIDs, charWidths, charHeights, spacing, offset = 0) {
  if (pathPoints.length === 0) return;
  
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
  
  // Total length needed for text with natural spacing
  const totalTextLength = charWidths.reduce((sum, width) => sum + width, 0) + 
    (text.length - 1) * spacing;
  
  // Place characters with natural spacing
  // Apply the offset to the starting position
  let currentDist = offset;
  
  for (let i = 0; i < text.length; i++) {
    const character = text.substring(i, i+1);
    const charWidth = charWidths[i];
    
    // Find point on path for this character
    let pointInfo = getPointAtDistance(currentDist, pathSegments, pathLength);
    let x, y, angle;
    
    if (pointInfo) {
      x = pointInfo.x;
      y = pointInfo.y;
      angle = pointInfo.angle;
    } else {
      // We're beyond the path, continue in the direction of the last segment
      const lastSegment = pathSegments[pathSegments.length - 1];
      const lastPoint = lastSegment.endPoint;
      const secondLastPoint = lastSegment.startPoint;
      angle = Math.atan2(
        lastPoint[1] - secondLastPoint[1], 
        lastPoint[0] - secondLastPoint[0]
      );
      
      // Calculate how far past the end of the path
      const distanceFromEnd = currentDist - pathLength;
      
      // Position character extending beyond the path
      x = lastPoint[0] + Math.cos(angle) * distanceFromEnd;
      y = lastPoint[1] + Math.sin(angle) * distanceFromEnd;
    }
    
    // Add the character to the drawing
    ea.style.angle = angle;
    const charPixelWidth = charWidths[i];
    const charPixelHeight = charHeights[i];
    const charID = ea.addText(x - charPixelWidth/2, y - charPixelHeight/2, character);
    ea.addAppendUpdateCustomData(charID, {
      text2Path: {pathID, text, pathElID, offset}
    });
    objectIDs.push(charID);
    
    // Move to next character position with natural spacing
    currentDist += charWidth + spacing;
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
  async function getSVGForPath() {
    ea.copyViewElementsToEAforEditing([pathEl]);
    const el = ea.getElements()[0];
    el.roughness = 0;
    const svgDoc = await ea.createSVG();
    ea.clear();
    return svgDoc;
  }

  const svgDoc = await getSVGForPath();

  // --- Add below: create a line element from the SVG path ---

  if (svgDoc) {
    // Find the <path> element in the SVG
    const pathElSVG = svgDoc.querySelector('path');
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

      // --- Align the new line's first point to the original element's first point ---
      // Find the original element's first point (relative to its x/y)
      const origFirst = pathEl.type === "rectangle"
      ? [pathEl.x, pathEl.y]
      : (pathEl.type === "diamond"
        ? [pathEl.x + pathEl.width/2, pathEl.y]
        : [pathEl.x + pathEl.points[0][0], pathEl.y + pathEl.points[0][1]]);
      // Find the SVG's first point (relative to its g transform)
      // Get the <g> transform
      const g = pathElSVG.closest('g');
      let dx = 0, dy = 0;
      if (g) {
        const m = g.getAttribute('transform');
        // Parse translate(x y)
        const match = m && m.match(/translate\(([-\d.]+)[ ,]([-\d.]+)/);
        if (match) {
          dx = parseFloat(match[1]);
          dy = parseFloat(match[2]);
        }
      }
      // SVG points are relative to the group transform
      const svgFirst = [points[0][0] + dx, points[0][1] + dy];
      // Calculate delta
      const deltaX = origFirst[0] - svgFirst[0];
      const deltaY = origFirst[1] - svgFirst[1];
      // Apply delta to all points
      points = points.map(([x, y]) => [x + dx + deltaX, y + dy + deltaY]);
      // Trim the very last point
      if (points.length > 2) {
        points = points.slice(0, -1);
      }

      if (points.length > 1) {
        ea.clear();
        const lineId = ea.addLine(points);
        const line = ea.getElement(lineId);
        line.isDeleted = true;
        return line;
      } else {
        new Notice("Could not extract enough points from SVG path.");
      }
    } else {
      new Notice("No path element found in SVG.");
    }
  }
  return pathEl;
}