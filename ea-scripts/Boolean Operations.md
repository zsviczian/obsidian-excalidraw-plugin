/*
With This Script it is possible to make boolean Operations on Shapes. 
The style of the resulting shape will be the style of the highest ranking Element that was used. 
The ranking of the elements is based on their background. The "denser" the background, the higher the ranking (the order of backgroundstyles is shown below). If they have the same background the opacity will decide. If thats also the same its decided by the order they were created.
The ranking is also important for the difference operation, so a transparent object for example will cut a hole into a solid object.
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-boolean-operations-showcase.png)
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-boolean-operations-element-ranking.png)


See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.9.20")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}
const ShadowGroupMarker = "ShadowCloneOf-";

const elements = ea.getViewSelectedElements().filter(
  el=>["ellipse", "rectangle", "diamond"].includes(el.type) ||
    el.groupIds.some(id => id.startsWith(ShadowGroupMarker)) ||
    (["line", "arrow"].includes(el.type) && el.roundness === null)
);
if(elements.length === 0) {
  new Notice ("Select ellipses, rectangles or diamonds");
  return;
}

const PolyBool = ea.getPolyBool();
const polyboolAction = await utils.suggester(["union (a + b)", "intersect (a && b)", "difference (a - b)", "reversed difference (b - a)", "xor"], [
  PolyBool.union, PolyBool.intersect, PolyBool.difference, PolyBool.differenceRev, PolyBool.xor
], "What would you like todo with the object");

const shadowClones = elements.filter(element => element.groupIds.some(id => id.startsWith(ShadowGroupMarker)));
shadowClones.forEach(shadowClone => {
  let parentId = shadowClone.groupIds
    .filter(id => id.startsWith(ShadowGroupMarker))[0]
    .slice(ShadowGroupMarker.length);
  const shadowCloneIndex = elements.findIndex(element => element.id == parentId);
  if (shadowCloneIndex == -1) return;
  elements[shadowCloneIndex].backgroundColor = shadowClone.backgroundColor;
  elements[shadowCloneIndex].fillStyle = shadowClone.fillStyle;
})
const borderElements = elements.filter(element => !element.groupIds.some(id => id.startsWith(ShadowGroupMarker)));
groups = ea.getMaximumGroups(borderElements);
groups = groups.map((group) => group.sort((a, b) => RankElement(b) - RankElement(a)));
groups.sort((a, b) => RankElement(b[0]) - RankElement(a[0]));

ea.style.strokeColor = groups[0][0].strokeColor;
ea.style.backgroundColor = groups[0][0].backgroundColor;
ea.style.fillStyle = groups[0][0].fillStyle;
ea.style.strokeWidth = groups[0][0].strokeWidth;
ea.style.strokeStyle = groups[0][0].strokeStyle;
ea.style.roughness = groups[0][0].roughness;
ea.style.opacity = groups[0][0].opacity;

const basePolygons = groups.shift().map(element => traceElement(element));
const toolPolygons = groups.flatMap(group => group.map(element => traceElement(element)));

const result = polyboolAction({
  regions: basePolygons,
  inverted: false
}, {
  regions: toolPolygons,
  inverted: false
});
const polygonHierachy = subordinateInnerPolygons(result.regions);
drawPolygonHierachy(polygonHierachy);
ea.deleteViewElements(elements);
ea.addElementsToView(false,false,true);
return;



function traceElement(element) {
  const diamondPath = (diamond) => [
      SxVEC(1/2, [0, diamond.height]),
      SxVEC(1/2, [diamond.width, 0]),
      addVec([SxVEC(1/2, [0, diamond.height]), ([diamond.width, 0])]),
      addVec([SxVEC(1/2, [diamond.width, 0]), ([0, diamond.height])]),
      SxVEC(1/2, [0, diamond.height])
    ];
  const rectanglePath = (rectangle) => [
    [0,0],
    [0, rectangle.height],
    [rectangle.width, rectangle.height],
    [rectangle.width, 0],
    [0, 0]
  ]
  const ellipsePath = (ellipse) => {
    const angle = ellipse.angle;
    const width = ellipse.width;
    const height = ellipse.height;
    const ellipseAtPoint = (t) => {
      const spanningVector = [width/2*Math.cos(t), height/2*Math.sin(t)];
      const baseVector = [width/2, height/2];
      return addVec([spanningVector, baseVector]);
    }
    let points = [];
    step = (2*Math.PI)/64
    for (let t = 0; t < 2*Math.PI; t = t + step) {
      points.push(ellipseAtPoint(t));
    }
    return points;
  }
  let polygon;
  let correctForPolygon = [0, 0];
  switch (element.type) {
    case "diamond":
      polygon = diamondPath(element);
      break;
    case "rectangle":
      polygon = rectanglePath(element);
      break;
    case "ellipse":
      polygon = ellipsePath(element);
      break;
    case "line":
    case "arrow":
      if (element.angle != 0) {
        let smallestX = 0;
        let smallestY = 0;
        element.points.forEach(point => {
          if (point[0] < smallestX) smallestX = point[0];
          if (point[1] < smallestY) smallestY = point[1];
        });
        polygon = element.points.map(point => {
          return [
            point[0] -= smallestX,
            point[1] -= smallestY
          ];
        });
        correctForPolygon = [smallestX, smallestY];
        break;
      }
      if (element.roundness) {
        new Notice("This script does not work with curved lines or arrows yet!");
        return [];
      }
      polygon = element.points; 
      default:
          break;
    }
  if (element.angle == 0) return polygon.map(v => addVec([v, [element.x, element.y]]));
  
  polygon = polygon.map(v => addVec([v, SxVEC(-1/2, [element.width, element.height])]));
  polygon = rotateVectorsByAngle(polygon, element.angle);
  return polygon.map(v => addVec([v, [element.x, element.y], SxVEC(1/2, [element.width, element.height]), correctForPolygon]));
}

function RankElement(element) {
  let score = 0;
  const backgroundRank = [
    "dashed",
    "none",
    "hachure",
    "zigzag",
    "zigzag-line",
    "cross-hatch",
    "solid"
  ]
  score += (backgroundRank.findIndex((fillStyle) => fillStyle == element.fillStyle) + 1) * 10;
  if (element.backgroundColor == "transparent") score -= 100;
  if (element.points && getVectorLength(element.points[element.points.length - 1]) > 8) score -= 100; 
  if (score < 0) score = 0;
  score += element.opacity / 100;
  return score;
}

function drawPolygonHierachy(polygonHierachy) {
  const backgroundColor = ea.style.backgroundColor;
  const strokeColor = ea.style.strokeColor;
  const setInnerStyle = () => {
    ea.style.backgroundColor = backgroundColor;
    ea.style.strokeColor = "transparent";
  }
  const setBorderStyle = () => {
    ea.style.backgroundColor = "transparent";
    ea.style.strokeColor = strokeColor;
  }
  const setFilledStyle = () => {
    ea.style.backgroundColor = backgroundColor;
    ea.style.strokeColor = strokeColor;
  }
  
  polygonHierachy.forEach(polygon => {
    setFilledStyle();
    let path = polygon.path;
    path.push(polygon.path[0]);
    if (polygon.innerPolygons.length === 0) {
      ea.addLine(path);
      return;
    }
    const outerBorder = path;
    const innerPolygons = addInnerPolygons(polygon.innerPolygons);
    path = path.concat(innerPolygons.backgroundPath);
    path.push(polygon.path[0]);
    setInnerStyle();
    const backgroundId = ea.addLine(path);
    setBorderStyle();
    const outerBorderId = ea.addLine(outerBorder)
    const innerBorderIds = innerPolygons.borderPaths.map(path => ea.addLine(path));
    const allIds = [innerBorderIds, outerBorderId, backgroundId].flat();
    ea.addToGroup(allIds);
    const background = ea.getElement(backgroundId);
    background.groupIds.push(ShadowGroupMarker + outerBorderId);
  });
}

function addInnerPolygons(polygonHierachy) {
  let firstPath = [];
  let secondPath = [];
  let borderPaths = [];
  polygonHierachy.forEach(polygon => {
    let path = polygon.path;
    path.push(polygon.path[0]);
    borderPaths.push(path);
    firstPath = firstPath.concat(path);
    secondPath.push(polygon.path[0]);
    drawPolygonHierachy(polygon.innerPolygons);
  });
  return {
    backgroundPath: firstPath.concat(secondPath.reverse()), 
    borderPaths: borderPaths
  };
}

function subordinateInnerPolygons(polygons) {
  const polygonObjectPrototype = (polygon) => {
    return {
      path: polygon,
      innerPolygons: []
    };
  }

  const insertPolygonIntoHierachy = (polygon, hierarchy) => {
    for (let i = 0; i < hierarchy.length; i++) {
      const polygonObject = hierarchy[i];
      let inside = null;
      let pointIndex = 0;
      do {
        inside = pointInPolygon(polygon[pointIndex], polygonObject.path);
        pointIndex++
      } while (inside === null);
      if (inside) {
        hierarchy[i].innerPolygons = insertPolygonIntoHierachy(polygon, hierarchy[i].innerPolygons);
        return hierarchy;
      }
    }
    polygon = polygonObjectPrototype(polygon);
    for (let i = 0; i < hierarchy.length; i++) {
      const polygonObject = hierarchy[i];
      let inside = null;
      let pointIndex = 0;
      do {
        inside = pointInPolygon(polygonObject.path[pointIndex], polygon.path);
        pointIndex++
      } while (inside === null);
      if (inside) {
        polygon.innerPolygons.push(hierarchy.splice(i, 1)[0]);
        i--;
      }
    }
    hierarchy.push(polygon);
    return hierarchy;
  }

  let polygonHierachy = [];
  polygons.forEach(polygon => {
    polygonHierachy = insertPolygonIntoHierachy(polygon, polygonHierachy);
  })

  return polygonHierachy;
}

/**
 * Checks if the given point lays in the polygon
 * @param point array [x, y]
 * @param polygon array [[x, y], ...]
 * @returns true if inside, false if not, null if the point is on one of the polygons vertecies
 */
function pointInPolygon(point, polygon) {
  const x = point[0];
  const y = point[1];
  let inside = false;

  // odd even test if point is in polygon
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }

    if ((x === xi && y === yi) || (x === xj && y === yj)) {
      return null;
    }
  }

  return inside;
}


function getVectorLength(vector) {
  return Math.sqrt(vector[0]**2+vector[1]**2);
}

/**
 * Adds two Vectors together
 */
function addVec(vectors) {
  return vectors.reduce((acc, vec) => [acc[0] + vec[0], acc[1] + vec[1]], [0, 0]);
}

/**
 * Returns the negative of the vector
 */
function negVec(vector) {
  return [-vector[0], -vector[1]];
}
 
/**
 * Multiplies Vector with a scalar
 */
function SxVEC(scalar, vector) {
  return [vector[0] * scalar, vector[1] * scalar];
}

function rotateVector (vec, ang)  {
  var cos = Math.cos(ang);
  var sin = Math.sin(ang);
  return [vec[0] * cos - vec[1] * sin, vec[0] * sin + vec[1] * cos];
}

function rotateVectorsByAngle(vectors, angle) {
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);

  const rotationMatrix = [
    [cosAngle, -sinAngle],
    [sinAngle, cosAngle]
  ];

  return applyTranformationMatrix(vectors, rotationMatrix);
}

function applyTranformationMatrix(vectors, transformationMatrix) {
  const result = [];
  for (const vector of vectors) {
    const x = vector[0];
    const y = vector[1];

    const newX = transformationMatrix[0][0] * x + transformationMatrix[0][1] * y;
    const newY = transformationMatrix[1][0] * x + transformationMatrix[1][1] * y;

    result.push([newX, newY]);
  }

  return result;
}
