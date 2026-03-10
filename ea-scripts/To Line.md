/**
 * Converts an ellipse element to a line element
 * @param {Object} ellipse - The ellipse element to convert
 * @param {number} pointDensity - Optional number of points to generate (defaults to 64)
 * @returns {string} The ID of the created line element
 ```js*/
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
  
  return lineId;
  
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
  
  return lineId;
   
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
  
  return lineId;

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

const el = ea.getViewSelectedElement();
switch (el.type) {
  case "rectangle":
    rectangleToLine(el);
    break;
  case "ellipse":
    ellipseToLine(el);
    break;
  case "diamond": 
    diamondToLine(el);
    break;
}
ea.addElementsToView();