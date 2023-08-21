/*

This script splits an ellipse at any point where a line intersects it. If no lines are selected, it will use every line that intersects the ellipse. Otherwise, it will only use the selected lines. If there is no intersecting line, the ellipse will be converted into a line object. 
There is also the option to close the object along the cut, which will close the cut in the shape of the line.
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-splitEllipse-demo1.jpg)
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-splitEllipse-demo2.jpg)
Tip: To use an ellipse as the cutting object, you first have to use this script on it, since it will convert the ellipse into a line.


See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
const elements = ea.getViewSelectedElements();
const ellipse = elements.filter(el => el.type == "ellipse")[0];
if (!ellipse) return;

let lines = elements.filter(el => el.type == "line" || el.type == "arrow");
if (lines.length == 0) lines = ea.getViewElements().filter(el => el.type == "line" || el.type == "arrow");
const subLines = getSubLines(lines);

const angles = subLines.flatMap(line => {
  return intersectionAngleOfEllipseAndLine(ellipse, line.a, line.b).map(result => ({
    angle: result,
    cuttingLine: line
  }));
});

if (angles.length === 0) angles.push({ angle: 0, cuttingLine: null });

angles.sort((a, b) => a.angle - b.angle);

const closeObject = await utils.suggester(["Yes", "No"], [true, false], "Close object along cutedge?")

ea.style.strokeSharpness = closeObject ? "sharp" : "round";
ea.style.strokeColor = ellipse.strokeColor;
ea.style.strokeWidth = ellipse.strokeWidth;
ea.style.backgroundColor = ellipse.backgroundColor;
ea.style.fillStyle = ellipse.fillStyle;
ea.style.roughness = ellipse.roughness;

angles.forEach((angle, key) => {
  const cuttingLine = angle.cuttingLine;
  angle = angle.angle;
  const nextAngleKey = (key + 1) < angles.length ? key + 1 : 0;
  const nextAngle = angles[nextAngleKey].angle;
  const AngleDelta = nextAngle - angle ? nextAngle - angle : Math.PI*2;
  const pointAmount = Math.ceil((AngleDelta*64)/(Math.PI*2));
  const stepSize = AngleDelta/pointAmount;
  let points = drawEllipse(ellipse.x, ellipse.y, ellipse.width, ellipse.height, ellipse.angle, angle, nextAngle, stepSize);
  if (closeObject && cuttingLine) points = points.concat(getCutLine(points[0], angles[key], angles[nextAngleKey], ellipse));

  const lineId = ea.addLine(points);
  const line = ea.getElement(lineId);
  line.frameId = ellipse.frameId;
  line.groupIds = ellipse.groupIds;
});

ea.deleteViewElements([ellipse]);
ea.addElementsToView(false,false,true);
return;

function getSubLines(lines) {
  return lines.flatMap((line, key) => {
    return line.points.slice(1).map((pointB, i) => ({
      a: addVectors([line.points[i], [line.x, line.y]]),
      b: addVectors([pointB, [line.x, line.y]]),
      originLineIndex: key,
      indexPointA: i,
    }));
  });
}

function intersectionAngleOfEllipseAndLine(ellipse, pointA, pointB) {
  /*
  To understand the code in this function and subfunctions it might help to take a look at this geogebra file
  https://www.geogebra.org/m/apbm3hs6
  */
  const c = multiplyVectorByScalar([ellipse.width, ellipse.height], (1/2));
  const a = rotateVector(
    addVectors([
      pointA,
      invVec([ellipse.x, ellipse.y]),
      invVec(multiplyVectorByScalar([ellipse.width, ellipse.height], (1/2)))
    ]),
    -ellipse.angle
  )
  const l_b = rotateVector(
    addVectors([
      pointB,
      invVec([ellipse.x, ellipse.y]),
      invVec(multiplyVectorByScalar([ellipse.width, ellipse.height], (1/2)))
    ]),
    -ellipse.angle
  );
  const b = addVectors([
    l_b,
    invVec(a)
  ]);
  const solutions = calculateLineSegment(a[0], a[1], b[0], b[1], c[0], c[1]);
  return solutions
    .filter(num => isBetween(num, 0, 1))
    .map(num => {
      const point = [
        (a[0] + b[0] * num) / ellipse.width,
        (a[1] + b[1] * num) / ellipse.height
      ];
      return angleBetweenVectors([1, 0], point);
    });
}

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
  points.push(ellipse(end))
  return points;
}

function getCutLine(startpoint, currentAngle, nextAngle, ellipse) {
  if (currentAngle.cuttingLine.originLineIndex != nextAngle.cuttingLine.originLineIndex) return [];
  
  const originLineIndex = currentAngle.cuttingLine.originLineIndex;
  
  if (lines[originLineIndex] == 2) return startpoint;
  
  const originLine = [];
  lines[originLineIndex].points.forEach(p => originLine.push(addVectors([
    p,
    [lines[originLineIndex].x, lines[originLineIndex].y]
  ])));

  const edgepoints = [];
  const direction = isInEllipse(originLine[clamp(nextAngle.cuttingLine.indexPointA - 1, 0, originLine.length - 1)], ellipse) ? -1 : 1
  let i = isInEllipse(originLine[nextAngle.cuttingLine.indexPointA], ellipse) ? nextAngle.cuttingLine.indexPointA : nextAngle.cuttingLine.indexPointA + direction;
  while (isInEllipse(originLine[i], ellipse)) {
    edgepoints.push(originLine[i]);
    i = (i + direction) % originLine.length;
  }
  edgepoints.push(startpoint);
  return edgepoints;
}

function calculateLineSegment(ax, ay, bx, by, cx, cy) {
  const sqrt = Math.sqrt((cx ** 2) * (cy ** 2) * (-(ay ** 2) * (bx ** 2) + 2 * ax * ay * bx * by - (ax ** 2) * (by ** 2) + (bx ** 2) * (cy ** 2) + (by ** 2) * (cx ** 2)));
  const numerator = -(ay * by * (cx ** 2) + ax * bx * (cy ** 2));
  const denominator = ((by ** 2) * (cx ** 2) + (bx ** 2) * (cy ** 2));
  const t1 = (numerator + sqrt) / denominator;
  const t2 = (numerator - sqrt) / denominator;

  return [t1, t2];
}

function isInEllipse(point, ellipse) {
  point = addVectors([point, invVec([ellipse.x, ellipse.y]), invVec(multiplyVectorByScalar([ellipse.width, ellipse.height], 1/2))]);
  point = [point[0]*2/ellipse.width, point[1]*2/ellipse.height];
  const distance = Math.sqrt(point[0]**2 + point[1]**2);
  return distance < 1;
}

function angleBetweenVectors(v1, v2) {
  let dotProduct = v1[0] * v2[0] + v1[1] * v2[1];
  let determinant = v1[0] * v2[1] - v1[1] * v2[0];
  let angle = Math.atan2(determinant, dotProduct);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

function rotateVector (vec, ang)  {
  var cos = Math.cos(ang);
  var sin = Math.sin(ang);
  return [vec[0] * cos - vec[1] * sin, vec[0] * sin + vec[1] * cos];
}

function addVectors(vectors) {
  return vectors.reduce((acc, vec) => [acc[0] + vec[0], acc[1] + vec[1]], [0, 0]);
}

function invVec(vector) {
  return [-vector[0], -vector[1]];
}

function multiplyVectorByScalar(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar];
}

function round(number, precision) {
  var factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}

function isBetween(num, min, max) {
  return (num >= min && num <= max);
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}
