/*
With This Script it is possible to make boolean Operations on Shapes.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
const elements = ea.getViewSelectedElements();
const shadowClones = elements.filter(element => element.isShadowCloneOf);
shadowClones.forEach(shadowClone => {
  const shadowCloneIndex = elements.findIndex(element => element.id = shadowClone.isShadowCloneOf);
  if (shadowCloneIndex == -1) return;
  elements[shadowCloneIndex].backgroundColor = shadowClone.backgroundColor;
})
const borderElements = elements.filter(element => !element.isShadowCloneOf);
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


//temporary function that is executed in the end so I have access to polybool
const run = () => {
  const result = polybool({
    regions: basePolygons,
    inverted: false
  }, {
    regions: toolPolygons,
    inverted: false
  });
  // console.log(subordinateInnerPolygons(toolPolygons));
  const polygonHierachy = subordinateInnerPolygons(result.regions);
  console.log(polygonHierachy);
  drawPolygonHierachy(polygonHierachy);
  ea.deleteViewElements(elements);
  ea.addElementsToView(false,false,true);
}
// return;



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
        new Notice("This script does not work with rotated lines or arrows yet!");
        return [];
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
  return polygon.map(v => addVec([v, [element.x, element.y], SxVEC(1/2, [element.width, element.height])]));
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
  
  let gatheredIds = [];
  polygonHierachy.forEach(polygon => {
    let path = polygon.path;
    path.push(polygon.path[0]);
    if (polygon.innerPolygons.length === 0) {
      setFilledStyle();
      ea.addLine(path);
      return;
    }
    setBorderStyle();
    const outerBorderId = ea.addLine(path);
    const innerPolygons = addInnerPolygons(polygon.innerPolygons);
    path = path.concat(innerPolygons.backgroundPath);
    path.push(polygon.path[0]);
    setInnerStyle();
    const backgroundId = ea.addLine(path);
    const background = ea.getElement(backgroundId);
    background.isShadowCloneOf = outerBorderId;
    const allIds = [innerPolygons.borderIds, outerBorderId, backgroundId].flat();
    gatheredIds = gatheredIds.concat(allIds);
    ea.addToGroup(allIds);
  });
  ea.addToGroup(gatheredIds);
}

function addInnerPolygons(polygonHierachy) {
  let firstPath = [];
  let secondPath = [];
  let borderIds = [];
  polygonHierachy.forEach(polygon => {
    let path = polygon.path;
    path.push(polygon.path[0]);
    borderIds.push(ea.addLine(path));
    firstPath = firstPath.concat(path);
    secondPath.push(polygon.path[0]);
  });
  return {
    backgroundPath: firstPath.concat(secondPath), 
    borderIds: borderIds
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


//---------------------------
//polybooljs library
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
  /*
   * @copyright 2016 Sean Connelly (@voidqk), http://syntheti.cc
   * @license MIT
   * @preserve Project Home: https://github.com/voidqk/polybooljs
   */
  
  var BuildLog = require('./lib/build-log');
  var Epsilon = require('./lib/epsilon');
  var Intersecter = require('./lib/intersecter');
  var SegmentChainer = require('./lib/segment-chainer');
  var SegmentSelector = require('./lib/segment-selector');
  var GeoJSON = require('./lib/geojson');
  
  var buildLog = false;
  var epsilon = Epsilon();
  
  var PolyBool;
  PolyBool = {
      // getter/setter for buildLog
      buildLog: function(bl){
          if (bl === true)
              buildLog = BuildLog();
          else if (bl === false)
              buildLog = false;
          return buildLog === false ? false : buildLog.list;
      },
      // getter/setter for epsilon
      epsilon: function(v){
          return epsilon.epsilon(v);
      },
  
      // core API
      segments: function(poly){
          var i = Intersecter(true, epsilon, buildLog);
          poly.regions.forEach(i.addRegion);
          return {
              segments: i.calculate(poly.inverted),
              inverted: poly.inverted
          };
      },
      combine: function(segments1, segments2){
          var i3 = Intersecter(false, epsilon, buildLog);
          return {
              combined: i3.calculate(
                  segments1.segments, segments1.inverted,
                  segments2.segments, segments2.inverted
              ),
              inverted1: segments1.inverted,
              inverted2: segments2.inverted
          };
      },
      selectUnion: function(combined){
          return {
              segments: SegmentSelector.union(combined.combined, buildLog),
              inverted: combined.inverted1 || combined.inverted2
          }
      },
      selectIntersect: function(combined){
          return {
              segments: SegmentSelector.intersect(combined.combined, buildLog),
              inverted: combined.inverted1 && combined.inverted2
          }
      },
      selectDifference: function(combined){
          return {
              segments: SegmentSelector.difference(combined.combined, buildLog),
              inverted: combined.inverted1 && !combined.inverted2
          }
      },
      selectDifferenceRev: function(combined){
          return {
              segments: SegmentSelector.differenceRev(combined.combined, buildLog),
              inverted: !combined.inverted1 && combined.inverted2
          }
      },
      selectXor: function(combined){
          return {
              segments: SegmentSelector.xor(combined.combined, buildLog),
              inverted: combined.inverted1 !== combined.inverted2
          }
      },
      polygon: function(segments){
          return {
              regions: SegmentChainer(segments.segments, epsilon, buildLog),
              inverted: segments.inverted
          };
      },
  
      // GeoJSON converters
      polygonFromGeoJSON: function(geojson){
          return GeoJSON.toPolygon(PolyBool, geojson);
      },
      polygonToGeoJSON: function(poly){
          return GeoJSON.fromPolygon(PolyBool, epsilon, poly);
      },
  
      // helper functions for common operations
      union: function(poly1, poly2){
          return operate(poly1, poly2, PolyBool.selectUnion);
      },
      intersect: function(poly1, poly2){
          return operate(poly1, poly2, PolyBool.selectIntersect);
      },
      difference: function(poly1, poly2){
          return operate(poly1, poly2, PolyBool.selectDifference);
      },
      differenceRev: function(poly1, poly2){
          return operate(poly1, poly2, PolyBool.selectDifferenceRev);
      },
      xor: function(poly1, poly2){
          return operate(poly1, poly2, PolyBool.selectXor);
      }
  };
  
  function operate(poly1, poly2, selector){
      var seg1 = PolyBool.segments(poly1);
      var seg2 = PolyBool.segments(poly2);
      var comb = PolyBool.combine(seg1, seg2);
      var seg3 = selector(comb);
      return PolyBool.polygon(seg3);
  }
  
  if (typeof window === 'object')
      window.PolyBool = PolyBool;
  
  module.exports = PolyBool;
  
  },{"./lib/build-log":2,"./lib/epsilon":3,"./lib/geojson":4,"./lib/intersecter":5,"./lib/segment-chainer":7,"./lib/segment-selector":8}],2:[function(require,module,exports){
  // (c) Copyright 2016, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // used strictly for logging the processing of the algorithm... only useful if you intend on
  // looking under the covers (for pretty UI's or debugging)
  //
  
  function BuildLog(){
      var my;
      var nextSegmentId = 0;
      var curVert = false;
  
      function push(type, data){
          my.list.push({
              type: type,
              data: data ? JSON.parse(JSON.stringify(data)) : void 0
          });
          return my;
      }
  
      my = {
          list: [],
          segmentId: function(){
              return nextSegmentId++;
          },
          checkIntersection: function(seg1, seg2){
              return push('check', { seg1: seg1, seg2: seg2 });
          },
          segmentChop: function(seg, end){
              push('div_seg', { seg: seg, pt: end });
              return push('chop', { seg: seg, pt: end });
          },
          statusRemove: function(seg){
              return push('pop_seg', { seg: seg });
          },
          segmentUpdate: function(seg){
              return push('seg_update', { seg: seg });
          },
          segmentNew: function(seg, primary){
              return push('new_seg', { seg: seg, primary: primary });
          },
          segmentRemove: function(seg){
              return push('rem_seg', { seg: seg });
          },
          tempStatus: function(seg, above, below){
              return push('temp_status', { seg: seg, above: above, below: below });
          },
          rewind: function(seg){
              return push('rewind', { seg: seg });
          },
          status: function(seg, above, below){
              return push('status', { seg: seg, above: above, below: below });
          },
          vert: function(x){
              if (x === curVert)
                  return my;
              curVert = x;
              return push('vert', { x: x });
          },
          log: function(data){
              if (typeof data !== 'string')
                  data = JSON.stringify(data, false, '  ');
              return push('log', { txt: data });
          },
          reset: function(){
              return push('reset');
          },
          selected: function(segs){
              return push('selected', { segs: segs });
          },
          chainStart: function(seg){
              return push('chain_start', { seg: seg });
          },
          chainRemoveHead: function(index, pt){
              return push('chain_rem_head', { index: index, pt: pt });
          },
          chainRemoveTail: function(index, pt){
              return push('chain_rem_tail', { index: index, pt: pt });
          },
          chainNew: function(pt1, pt2){
              return push('chain_new', { pt1: pt1, pt2: pt2 });
          },
          chainMatch: function(index){
              return push('chain_match', { index: index });
          },
          chainClose: function(index){
              return push('chain_close', { index: index });
          },
          chainAddHead: function(index, pt){
              return push('chain_add_head', { index: index, pt: pt });
          },
          chainAddTail: function(index, pt){
              return push('chain_add_tail', { index: index, pt: pt, });
          },
          chainConnect: function(index1, index2){
              return push('chain_con', { index1: index1, index2: index2 });
          },
          chainReverse: function(index){
              return push('chain_rev', { index: index });
          },
          chainJoin: function(index1, index2){
              return push('chain_join', { index1: index1, index2: index2 });
          },
          done: function(){
              return push('done');
          }
      };
      return my;
  }
  
  module.exports = BuildLog;
  
  },{}],3:[function(require,module,exports){
  // (c) Copyright 2016, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // provides the raw computation functions that takes epsilon into account
  //
  // zero is defined to be between (-epsilon, epsilon) exclusive
  //
  
  function Epsilon(eps){
      if (typeof eps !== 'number')
          eps = 0.0000000001; // sane default? sure why not
      var my = {
          epsilon: function(v){
              if (typeof v === 'number')
                  eps = v;
              return eps;
          },
          pointAboveOrOnLine: function(pt, left, right){
              var Ax = left[0];
              var Ay = left[1];
              var Bx = right[0];
              var By = right[1];
              var Cx = pt[0];
              var Cy = pt[1];
              return (Bx - Ax) * (Cy - Ay) - (By - Ay) * (Cx - Ax) >= -eps;
          },
          pointBetween: function(p, left, right){
              // p must be collinear with left->right
              // returns false if p == left, p == right, or left == right
              var d_py_ly = p[1] - left[1];
              var d_rx_lx = right[0] - left[0];
              var d_px_lx = p[0] - left[0];
              var d_ry_ly = right[1] - left[1];
  
              var dot = d_px_lx * d_rx_lx + d_py_ly * d_ry_ly;
              // if `dot` is 0, then `p` == `left` or `left` == `right` (reject)
              // if `dot` is less than 0, then `p` is to the left of `left` (reject)
              if (dot < eps)
                  return false;
  
              var sqlen = d_rx_lx * d_rx_lx + d_ry_ly * d_ry_ly;
              // if `dot` > `sqlen`, then `p` is to the right of `right` (reject)
              // therefore, if `dot - sqlen` is greater than 0, then `p` is to the right of `right` (reject)
              if (dot - sqlen > -eps)
                  return false;
  
              return true;
          },
          pointsSameX: function(p1, p2){
              return Math.abs(p1[0] - p2[0]) < eps;
          },
          pointsSameY: function(p1, p2){
              return Math.abs(p1[1] - p2[1]) < eps;
          },
          pointsSame: function(p1, p2){
              return my.pointsSameX(p1, p2) && my.pointsSameY(p1, p2);
          },
          pointsCompare: function(p1, p2){
              // returns -1 if p1 is smaller, 1 if p2 is smaller, 0 if equal
              if (my.pointsSameX(p1, p2))
                  return my.pointsSameY(p1, p2) ? 0 : (p1[1] < p2[1] ? -1 : 1);
              return p1[0] < p2[0] ? -1 : 1;
          },
          pointsCollinear: function(pt1, pt2, pt3){
              // does pt1->pt2->pt3 make a straight line?
              // essentially this is just checking to see if the slope(pt1->pt2) === slope(pt2->pt3)
              // if slopes are equal, then they must be collinear, because they share pt2
              var dx1 = pt1[0] - pt2[0];
              var dy1 = pt1[1] - pt2[1];
              var dx2 = pt2[0] - pt3[0];
              var dy2 = pt2[1] - pt3[1];
              return Math.abs(dx1 * dy2 - dx2 * dy1) < eps;
          },
          linesIntersect: function(a0, a1, b0, b1){
              // returns false if the lines are coincident (e.g., parallel or on top of each other)
              //
              // returns an object if the lines intersect:
              //   {
              //     pt: [x, y],    where the intersection point is at
              //     alongA: where intersection point is along A,
              //     alongB: where intersection point is along B
              //   }
              //
              //  alongA and alongB will each be one of: -2, -1, 0, 1, 2
              //
              //  with the following meaning:
              //
              //    -2   intersection point is before segment's first point
              //    -1   intersection point is directly on segment's first point
              //     0   intersection point is between segment's first and second points (exclusive)
              //     1   intersection point is directly on segment's second point
              //     2   intersection point is after segment's second point
              var adx = a1[0] - a0[0];
              var ady = a1[1] - a0[1];
              var bdx = b1[0] - b0[0];
              var bdy = b1[1] - b0[1];
  
              var axb = adx * bdy - ady * bdx;
              if (Math.abs(axb) < eps)
                  return false; // lines are coincident
  
              var dx = a0[0] - b0[0];
              var dy = a0[1] - b0[1];
  
              var A = (bdx * dy - bdy * dx) / axb;
              var B = (adx * dy - ady * dx) / axb;
  
              var ret = {
                  alongA: 0,
                  alongB: 0,
                  pt: [
                      a0[0] + A * adx,
                      a0[1] + A * ady
                  ]
              };
  
              // categorize where intersection point is along A and B
  
              if (A <= -eps)
                  ret.alongA = -2;
              else if (A < eps)
                  ret.alongA = -1;
              else if (A - 1 <= -eps)
                  ret.alongA = 0;
              else if (A - 1 < eps)
                  ret.alongA = 1;
              else
                  ret.alongA = 2;
  
              if (B <= -eps)
                  ret.alongB = -2;
              else if (B < eps)
                  ret.alongB = -1;
              else if (B - 1 <= -eps)
                  ret.alongB = 0;
              else if (B - 1 < eps)
                  ret.alongB = 1;
              else
                  ret.alongB = 2;
  
              return ret;
          },
          pointInsideRegion: function(pt, region){
              var x = pt[0];
              var y = pt[1];
              var last_x = region[region.length - 1][0];
              var last_y = region[region.length - 1][1];
              var inside = false;
              for (var i = 0; i < region.length; i++){
                  var curr_x = region[i][0];
                  var curr_y = region[i][1];
  
                  // if y is between curr_y and last_y, and
                  // x is to the right of the boundary created by the line
                  if ((curr_y - y > eps) != (last_y - y > eps) &&
                      (last_x - curr_x) * (y - curr_y) / (last_y - curr_y) + curr_x - x > eps)
                      inside = !inside
  
                  last_x = curr_x;
                  last_y = curr_y;
              }
              return inside;
          }
      };
      return my;
  }
  
  module.exports = Epsilon;
  
  },{}],4:[function(require,module,exports){
  // (c) Copyright 2017, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // convert between PolyBool polygon format and GeoJSON formats (Polygon and MultiPolygon)
  //
  
  var GeoJSON = {
      // convert a GeoJSON object to a PolyBool polygon
      toPolygon: function(PolyBool, geojson){
  
          // converts list of LineString's to segments
          function GeoPoly(coords){
              // check for empty coords
              if (coords.length <= 0)
                  return PolyBool.segments({ inverted: false, regions: [] });
  
              // convert LineString to segments
              function LineString(ls){
                  // remove tail which should be the same as head
                  var reg = ls.slice(0, ls.length - 1);
                  return PolyBool.segments({ inverted: false, regions: [reg] });
              }
  
              // the first LineString is considered the outside
              var out = LineString(coords[0]);
  
              // the rest of the LineStrings are considered interior holes, so subtract them from the
              // current result
              for (var i = 1; i < coords.length; i++)
                  out = PolyBool.selectDifference(PolyBool.combine(out, LineString(coords[i])));
  
              return out;
          }
  
          if (geojson.type === 'Polygon'){
              // single polygon, so just convert it and we're done
              return PolyBool.polygon(GeoPoly(geojson.coordinates));
          }
          else if (geojson.type === 'MultiPolygon'){
              // multiple polygons, so union all the polygons together
              var out = PolyBool.segments({ inverted: false, regions: [] });
              for (var i = 0; i < geojson.coordinates.length; i++)
                  out = PolyBool.selectUnion(PolyBool.combine(out, GeoPoly(geojson.coordinates[i])));
              return PolyBool.polygon(out);
          }
          throw new Error('PolyBool: Cannot convert GeoJSON object to PolyBool polygon');
      },
  
      // convert a PolyBool polygon to a GeoJSON object
      fromPolygon: function(PolyBool, eps, poly){
          // make sure out polygon is clean
          poly = PolyBool.polygon(PolyBool.segments(poly));
  
          // test if r1 is inside r2
          function regionInsideRegion(r1, r2){
              // we're guaranteed no lines intersect (because the polygon is clean), but a vertex
              // could be on the edge -- so we just average pt[0] and pt[1] to produce a point on the
              // edge of the first line, which cannot be on an edge
              return eps.pointInsideRegion([
                  (r1[0][0] + r1[1][0]) * 0.5,
                  (r1[0][1] + r1[1][1]) * 0.5
              ], r2);
          }
  
          // calculate inside heirarchy
          //
          //  _____________________   _______    roots -> A       -> F
          // |          A          | |   F   |            |          |
          // |  _______   _______  | |  ___  |            +-- B      +-- G
          // | |   B   | |   C   | | | |   | |            |   |
          // | |  ___  | |  ___  | | | |   | |            |   +-- D
          // | | | D | | | | E | | | | | G | |            |
          // | | |___| | | |___| | | | |   | |            +-- C
          // | |_______| |_______| | | |___| |                |
          // |_____________________| |_______|                +-- E
  
          function newNode(region){
              return {
                  region: region,
                  children: []
              };
          }
  
          var roots = newNode(null);
  
          function addChild(root, region){
              // first check if we're inside any children
              for (var i = 0; i < root.children.length; i++){
                  var child = root.children[i];
                  if (regionInsideRegion(region, child.region)){
                      // we are, so insert inside them instead
                      addChild(child, region);
                      return;
                  }
              }
  
              // not inside any children, so check to see if any children are inside us
              var node = newNode(region);
              for (var i = 0; i < root.children.length; i++){
                  var child = root.children[i];
                  if (regionInsideRegion(child.region, region)){
                      // oops... move the child beneath us, and remove them from root
                      node.children.push(child);
                      root.children.splice(i, 1);
                      i--;
                  }
              }
  
              // now we can add ourselves
              root.children.push(node);
          }
  
          // add all regions to the root
          for (var i = 0; i < poly.regions.length; i++){
              var region = poly.regions[i];
              if (region.length < 3) // regions must have at least 3 points (sanity check)
                  continue;
              addChild(roots, region);
          }
  
          // with our heirarchy, we can distinguish between exterior borders, and interior holes
          // the root nodes are exterior, children are interior, children's children are exterior,
          // children's children's children are interior, etc
  
          // while we're at it, exteriors are counter-clockwise, and interiors are clockwise
  
          function forceWinding(region, clockwise){
              // first, see if we're clockwise or counter-clockwise
              // https://en.wikipedia.org/wiki/Shoelace_formula
              var winding = 0;
              var last_x = region[region.length - 1][0];
              var last_y = region[region.length - 1][1];
              var copy = [];
              for (var i = 0; i < region.length; i++){
                  var curr_x = region[i][0];
                  var curr_y = region[i][1];
                  copy.push([curr_x, curr_y]); // create a copy while we're at it
                  winding += curr_y * last_x - curr_x * last_y;
                  last_x = curr_x;
                  last_y = curr_y;
              }
              // this assumes Cartesian coordinates (Y is positive going up)
              var isclockwise = winding < 0;
              if (isclockwise !== clockwise)
                  copy.reverse();
              // while we're here, the last point must be the first point...
              copy.push([copy[0][0], copy[0][1]]);
              return copy;
          }
  
          var geopolys = [];
  
          function addExterior(node){
              var poly = [forceWinding(node.region, false)];
              geopolys.push(poly);
              // children of exteriors are interior
              for (var i = 0; i < node.children.length; i++)
                  poly.push(getInterior(node.children[i]));
          }
  
          function getInterior(node){
              // children of interiors are exterior
              for (var i = 0; i < node.children.length; i++)
                  addExterior(node.children[i]);
              // return the clockwise interior
              return forceWinding(node.region, true);
          }
  
          // root nodes are exterior
          for (var i = 0; i < roots.children.length; i++)
              addExterior(roots.children[i]);
  
          // lastly, construct the approrpriate GeoJSON object
  
          if (geopolys.length <= 0) // empty GeoJSON Polygon
              return { type: 'Polygon', coordinates: [] };
          if (geopolys.length == 1) // use a GeoJSON Polygon
              return { type: 'Polygon', coordinates: geopolys[0] };
          return { // otherwise, use a GeoJSON MultiPolygon
              type: 'MultiPolygon',
              coordinates: geopolys
          };
      }
  };
  
  module.exports = GeoJSON;
  
  },{}],5:[function(require,module,exports){
  // (c) Copyright 2016, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // this is the core work-horse
  //
  
  var LinkedList = require('./linked-list');
  
  function Intersecter(selfIntersection, eps, buildLog){
      // selfIntersection is true/false depending on the phase of the overall algorithm
  
      //
      // segment creation
      //
  
      function segmentNew(start, end){
          return {
              id: buildLog ? buildLog.segmentId() : -1,
              start: start,
              end: end,
              myFill: {
                  above: null, // is there fill above us?
                  below: null  // is there fill below us?
              },
              otherFill: null
          };
      }
  
      function segmentCopy(start, end, seg){
          return {
              id: buildLog ? buildLog.segmentId() : -1,
              start: start,
              end: end,
              myFill: {
                  above: seg.myFill.above,
                  below: seg.myFill.below
              },
              otherFill: null
          };
      }
  
      //
      // event logic
      //
  
      var event_root = LinkedList.create();
  
      function eventCompare(p1_isStart, p1_1, p1_2, p2_isStart, p2_1, p2_2){
          // compare the selected points first
          var comp = eps.pointsCompare(p1_1, p2_1);
          if (comp !== 0)
              return comp;
          // the selected points are the same
  
          if (eps.pointsSame(p1_2, p2_2)) // if the non-selected points are the same too...
              return 0; // then the segments are equal
  
          if (p1_isStart !== p2_isStart) // if one is a start and the other isn't...
              return p1_isStart ? 1 : -1; // favor the one that isn't the start
  
          // otherwise, we'll have to calculate which one is below the other manually
          return eps.pointAboveOrOnLine(p1_2,
              p2_isStart ? p2_1 : p2_2, // order matters
              p2_isStart ? p2_2 : p2_1
          ) ? 1 : -1;
      }
  
      function eventAdd(ev, other_pt){
          event_root.insertBefore(ev, function(here){
              // should ev be inserted before here?
              var comp = eventCompare(
                  ev  .isStart, ev  .pt,      other_pt,
                  here.isStart, here.pt, here.other.pt
              );
              return comp < 0;
          });
      }
  
      function eventAddSegmentStart(seg, primary){
          var ev_start = LinkedList.node({
              isStart: true,
              pt: seg.start,
              seg: seg,
              primary: primary,
              other: null,
              status: null
          });
          eventAdd(ev_start, seg.end);
          return ev_start;
      }
  
      function eventAddSegmentEnd(ev_start, seg, primary){
          var ev_end = LinkedList.node({
              isStart: false,
              pt: seg.end,
              seg: seg,
              primary: primary,
              other: ev_start,
              status: null
          });
          ev_start.other = ev_end;
          eventAdd(ev_end, ev_start.pt);
      }
  
      function eventAddSegment(seg, primary){
          var ev_start = eventAddSegmentStart(seg, primary);
          eventAddSegmentEnd(ev_start, seg, primary);
          return ev_start;
      }
  
      function eventUpdateEnd(ev, end){
          // slides an end backwards
          //   (start)------------(end)    to:
          //   (start)---(end)
  
          if (buildLog)
              buildLog.segmentChop(ev.seg, end);
  
          ev.other.remove();
          ev.seg.end = end;
          ev.other.pt = end;
          eventAdd(ev.other, ev.pt);
      }
  
      function eventDivide(ev, pt){
          var ns = segmentCopy(pt, ev.seg.end, ev.seg);
          eventUpdateEnd(ev, pt);
          return eventAddSegment(ns, ev.primary);
      }
  
      function calculate(primaryPolyInverted, secondaryPolyInverted){
          // if selfIntersection is true then there is no secondary polygon, so that isn't used
  
          //
          // status logic
          //
  
          var status_root = LinkedList.create();
  
          function statusCompare(ev1, ev2){
              var a1 = ev1.seg.start;
              var a2 = ev1.seg.end;
              var b1 = ev2.seg.start;
              var b2 = ev2.seg.end;
  
              if (eps.pointsCollinear(a1, b1, b2)){
                  if (eps.pointsCollinear(a2, b1, b2))
                      return 1;//eventCompare(true, a1, a2, true, b1, b2);
                  return eps.pointAboveOrOnLine(a2, b1, b2) ? 1 : -1;
              }
              return eps.pointAboveOrOnLine(a1, b1, b2) ? 1 : -1;
          }
  
          function statusFindSurrounding(ev){
              return status_root.findTransition(function(here){
                  var comp = statusCompare(ev, here.ev);
                  return comp > 0;
              });
          }
  
          function checkIntersection(ev1, ev2){
              // returns the segment equal to ev1, or false if nothing equal
  
              var seg1 = ev1.seg;
              var seg2 = ev2.seg;
              var a1 = seg1.start;
              var a2 = seg1.end;
              var b1 = seg2.start;
              var b2 = seg2.end;
  
              if (buildLog)
                  buildLog.checkIntersection(seg1, seg2);
  
              var i = eps.linesIntersect(a1, a2, b1, b2);
  
              if (i === false){
                  // segments are parallel or coincident
  
                  // if points aren't collinear, then the segments are parallel, so no intersections
                  if (!eps.pointsCollinear(a1, a2, b1))
                      return false;
                  // otherwise, segments are on top of each other somehow (aka coincident)
  
                  if (eps.pointsSame(a1, b2) || eps.pointsSame(a2, b1))
                      return false; // segments touch at endpoints... no intersection
  
                  var a1_equ_b1 = eps.pointsSame(a1, b1);
                  var a2_equ_b2 = eps.pointsSame(a2, b2);
  
                  if (a1_equ_b1 && a2_equ_b2)
                      return ev2; // segments are exactly equal
  
                  var a1_between = !a1_equ_b1 && eps.pointBetween(a1, b1, b2);
                  var a2_between = !a2_equ_b2 && eps.pointBetween(a2, b1, b2);
  
                  // handy for debugging:
                  // buildLog.log({
                  //	a1_equ_b1: a1_equ_b1,
                  //	a2_equ_b2: a2_equ_b2,
                  //	a1_between: a1_between,
                  //	a2_between: a2_between
                  // });
  
                  if (a1_equ_b1){
                      if (a2_between){
                          //  (a1)---(a2)
                          //  (b1)----------(b2)
                          eventDivide(ev2, a2);
                      }
                      else{
                          //  (a1)----------(a2)
                          //  (b1)---(b2)
                          eventDivide(ev1, b2);
                      }
                      return ev2;
                  }
                  else if (a1_between){
                      if (!a2_equ_b2){
                          // make a2 equal to b2
                          if (a2_between){
                              //         (a1)---(a2)
                              //  (b1)-----------------(b2)
                              eventDivide(ev2, a2);
                          }
                          else{
                              //         (a1)----------(a2)
                              //  (b1)----------(b2)
                              eventDivide(ev1, b2);
                          }
                      }
  
                      //         (a1)---(a2)
                      //  (b1)----------(b2)
                      eventDivide(ev2, a1);
                  }
              }
              else{
                  // otherwise, lines intersect at i.pt, which may or may not be between the endpoints
  
                  // is A divided between its endpoints? (exclusive)
                  if (i.alongA === 0){
                      if (i.alongB === -1) // yes, at exactly b1
                          eventDivide(ev1, b1);
                      else if (i.alongB === 0) // yes, somewhere between B's endpoints
                          eventDivide(ev1, i.pt);
                      else if (i.alongB === 1) // yes, at exactly b2
                          eventDivide(ev1, b2);
                  }
  
                  // is B divided between its endpoints? (exclusive)
                  if (i.alongB === 0){
                      if (i.alongA === -1) // yes, at exactly a1
                          eventDivide(ev2, a1);
                      else if (i.alongA === 0) // yes, somewhere between A's endpoints (exclusive)
                          eventDivide(ev2, i.pt);
                      else if (i.alongA === 1) // yes, at exactly a2
                          eventDivide(ev2, a2);
                  }
              }
              return false;
          }
  
          //
          // main event loop
          //
          var segments = [];
          while (!event_root.isEmpty()){
              var ev = event_root.getHead();
  
              if (buildLog)
                  buildLog.vert(ev.pt[0]);
  
              if (ev.isStart){
  
                  if (buildLog)
                      buildLog.segmentNew(ev.seg, ev.primary);
  
                  var surrounding = statusFindSurrounding(ev);
                  var above = surrounding.before ? surrounding.before.ev : null;
                  var below = surrounding.after ? surrounding.after.ev : null;
  
                  if (buildLog){
                      buildLog.tempStatus(
                          ev.seg,
                          above ? above.seg : false,
                          below ? below.seg : false
                      );
                  }
  
                  function checkBothIntersections(){
                      if (above){
                          var eve = checkIntersection(ev, above);
                          if (eve)
                              return eve;
                      }
                      if (below)
                          return checkIntersection(ev, below);
                      return false;
                  }
  
                  var eve = checkBothIntersections();
                  if (eve){
                      // ev and eve are equal
                      // we'll keep eve and throw away ev
  
                      // merge ev.seg's fill information into eve.seg
  
                      if (selfIntersection){
                          var toggle; // are we a toggling edge?
                          if (ev.seg.myFill.below === null)
                              toggle = true;
                          else
                              toggle = ev.seg.myFill.above !== ev.seg.myFill.below;
  
                          // merge two segments that belong to the same polygon
                          // think of this as sandwiching two segments together, where `eve.seg` is
                          // the bottom -- this will cause the above fill flag to toggle
                          if (toggle)
                              eve.seg.myFill.above = !eve.seg.myFill.above;
                      }
                      else{
                          // merge two segments that belong to different polygons
                          // each segment has distinct knowledge, so no special logic is needed
                          // note that this can only happen once per segment in this phase, because we
                          // are guaranteed that all self-intersections are gone
                          eve.seg.otherFill = ev.seg.myFill;
                      }
  
                      if (buildLog)
                          buildLog.segmentUpdate(eve.seg);
  
                      ev.other.remove();
                      ev.remove();
                  }
  
                  if (event_root.getHead() !== ev){
                      // something was inserted before us in the event queue, so loop back around and
                      // process it before continuing
                      if (buildLog)
                          buildLog.rewind(ev.seg);
                      continue;
                  }
  
                  //
                  // calculate fill flags
                  //
                  if (selfIntersection){
                      var toggle; // are we a toggling edge?
                      if (ev.seg.myFill.below === null) // if we are a new segment...
                          toggle = true; // then we toggle
                      else // we are a segment that has previous knowledge from a division
                          toggle = ev.seg.myFill.above !== ev.seg.myFill.below; // calculate toggle
  
                      // next, calculate whether we are filled below us
                      if (!below){ // if nothing is below us...
                          // we are filled below us if the polygon is inverted
                          ev.seg.myFill.below = primaryPolyInverted;
                      }
                      else{
                          // otherwise, we know the answer -- it's the same if whatever is below
                          // us is filled above it
                          ev.seg.myFill.below = below.seg.myFill.above;
                      }
  
                      // since now we know if we're filled below us, we can calculate whether
                      // we're filled above us by applying toggle to whatever is below us
                      if (toggle)
                          ev.seg.myFill.above = !ev.seg.myFill.below;
                      else
                          ev.seg.myFill.above = ev.seg.myFill.below;
                  }
                  else{
                      // now we fill in any missing transition information, since we are all-knowing
                      // at this point
  
                      if (ev.seg.otherFill === null){
                          // if we don't have other information, then we need to figure out if we're
                          // inside the other polygon
                          var inside;
                          if (!below){
                              // if nothing is below us, then we're inside if the other polygon is
                              // inverted
                              inside =
                                  ev.primary ? secondaryPolyInverted : primaryPolyInverted;
                          }
                          else{ // otherwise, something is below us
                              // so copy the below segment's other polygon's above
                              if (ev.primary === below.primary)
                                  inside = below.seg.otherFill.above;
                              else
                                  inside = below.seg.myFill.above;
                          }
                          ev.seg.otherFill = {
                              above: inside,
                              below: inside
                          };
                      }
                  }
  
                  if (buildLog){
                      buildLog.status(
                          ev.seg,
                          above ? above.seg : false,
                          below ? below.seg : false
                      );
                  }
  
                  // insert the status and remember it for later removal
                  ev.other.status = surrounding.insert(LinkedList.node({ ev: ev }));
              }
              else{
                  var st = ev.status;
  
                  if (st === null){
                      throw new Error('PolyBool: Zero-length segment detected; your epsilon is ' +
                          'probably too small or too large');
                  }
  
                  // removing the status will create two new adjacent edges, so we'll need to check
                  // for those
                  if (status_root.exists(st.prev) && status_root.exists(st.next))
                      checkIntersection(st.prev.ev, st.next.ev);
  
                  if (buildLog)
                      buildLog.statusRemove(st.ev.seg);
  
                  // remove the status
                  st.remove();
  
                  // if we've reached this point, we've calculated everything there is to know, so
                  // save the segment for reporting
                  if (!ev.primary){
                      // make sure `seg.myFill` actually points to the primary polygon though
                      var s = ev.seg.myFill;
                      ev.seg.myFill = ev.seg.otherFill;
                      ev.seg.otherFill = s;
                  }
                  segments.push(ev.seg);
              }
  
              // remove the event and continue
              event_root.getHead().remove();
          }
  
          if (buildLog)
              buildLog.done();
  
          return segments;
      }
  
      // return the appropriate API depending on what we're doing
      if (!selfIntersection){
          // performing combination of polygons, so only deal with already-processed segments
          return {
              calculate: function(segments1, inverted1, segments2, inverted2){
                  // segmentsX come from the self-intersection API, or this API
                  // invertedX is whether we treat that list of segments as an inverted polygon or not
                  // returns segments that can be used for further operations
                  segments1.forEach(function(seg){
                      eventAddSegment(segmentCopy(seg.start, seg.end, seg), true);
                  });
                  segments2.forEach(function(seg){
                      eventAddSegment(segmentCopy(seg.start, seg.end, seg), false);
                  });
                  return calculate(inverted1, inverted2);
              }
          };
      }
  
      // otherwise, performing self-intersection, so deal with regions
      return {
          addRegion: function(region){
              // regions are a list of points:
              //  [ [0, 0], [100, 0], [50, 100] ]
              // you can add multiple regions before running calculate
              var pt1;
              var pt2 = region[region.length - 1];
              for (var i = 0; i < region.length; i++){
                  pt1 = pt2;
                  pt2 = region[i];
  
                  var forward = eps.pointsCompare(pt1, pt2);
                  if (forward === 0) // points are equal, so we have a zero-length segment
                      continue; // just skip it
  
                  eventAddSegment(
                      segmentNew(
                          forward < 0 ? pt1 : pt2,
                          forward < 0 ? pt2 : pt1
                      ),
                      true
                  );
              }
          },
          calculate: function(inverted){
              // is the polygon inverted?
              // returns segments
              return calculate(inverted, false);
          }
      };
  }
  
  module.exports = Intersecter;
  
  },{"./linked-list":6}],6:[function(require,module,exports){
  // (c) Copyright 2016, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // simple linked list implementation that allows you to traverse down nodes and save positions
  //
  
  var LinkedList = {
      create: function(){
          var my = {
              root: { root: true, next: null },
              exists: function(node){
                  if (node === null || node === my.root)
                      return false;
                  return true;
              },
              isEmpty: function(){
                  return my.root.next === null;
              },
              getHead: function(){
                  return my.root.next;
              },
              insertBefore: function(node, check){
                  var last = my.root;
                  var here = my.root.next;
                  while (here !== null){
                      if (check(here)){
                          node.prev = here.prev;
                          node.next = here;
                          here.prev.next = node;
                          here.prev = node;
                          return;
                      }
                      last = here;
                      here = here.next;
                  }
                  last.next = node;
                  node.prev = last;
                  node.next = null;
              },
              findTransition: function(check){
                  var prev = my.root;
                  var here = my.root.next;
                  while (here !== null){
                      if (check(here))
                          break;
                      prev = here;
                      here = here.next;
                  }
                  return {
                      before: prev === my.root ? null : prev,
                      after: here,
                      insert: function(node){
                          node.prev = prev;
                          node.next = here;
                          prev.next = node;
                          if (here !== null)
                              here.prev = node;
                          return node;
                      }
                  };
              }
          };
          return my;
      },
      node: function(data){
          data.prev = null;
          data.next = null;
          data.remove = function(){
              data.prev.next = data.next;
              if (data.next)
                  data.next.prev = data.prev;
              data.prev = null;
              data.next = null;
          };
          return data;
      }
  };
  
  module.exports = LinkedList;
  
  },{}],7:[function(require,module,exports){
  // (c) Copyright 2016, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // converts a list of segments into a list of regions, while also removing unnecessary verticies
  //
  
  function SegmentChainer(segments, eps, buildLog){
      var chains = [];
      var regions = [];
  
      segments.forEach(function(seg){
          var pt1 = seg.start;
          var pt2 = seg.end;
          if (eps.pointsSame(pt1, pt2)){
              console.warn('PolyBool: Warning: Zero-length segment detected; your epsilon is ' +
                  'probably too small or too large');
              return;
          }
  
          if (buildLog)
              buildLog.chainStart(seg);
  
          // search for two chains that this segment matches
          var first_match = {
              index: 0,
              matches_head: false,
              matches_pt1: false
          };
          var second_match = {
              index: 0,
              matches_head: false,
              matches_pt1: false
          };
          var next_match = first_match;
          function setMatch(index, matches_head, matches_pt1){
              // return true if we've matched twice
              next_match.index = index;
              next_match.matches_head = matches_head;
              next_match.matches_pt1 = matches_pt1;
              if (next_match === first_match){
                  next_match = second_match;
                  return false;
              }
              next_match = null;
              return true; // we've matched twice, we're done here
          }
          for (var i = 0; i < chains.length; i++){
              var chain = chains[i];
              var head  = chain[0];
              var head2 = chain[1];
              var tail  = chain[chain.length - 1];
              var tail2 = chain[chain.length - 2];
              if (eps.pointsSame(head, pt1)){
                  if (setMatch(i, true, true))
                      break;
              }
              else if (eps.pointsSame(head, pt2)){
                  if (setMatch(i, true, false))
                      break;
              }
              else if (eps.pointsSame(tail, pt1)){
                  if (setMatch(i, false, true))
                      break;
              }
              else if (eps.pointsSame(tail, pt2)){
                  if (setMatch(i, false, false))
                      break;
              }
          }
  
          if (next_match === first_match){
              // we didn't match anything, so create a new chain
              chains.push([ pt1, pt2 ]);
              if (buildLog)
                  buildLog.chainNew(pt1, pt2);
              return;
          }
  
          if (next_match === second_match){
              // we matched a single chain
  
              if (buildLog)
                  buildLog.chainMatch(first_match.index);
  
              // add the other point to the apporpriate end, and check to see if we've closed the
              // chain into a loop
  
              var index = first_match.index;
              var pt = first_match.matches_pt1 ? pt2 : pt1; // if we matched pt1, then we add pt2, etc
              var addToHead = first_match.matches_head; // if we matched at head, then add to the head
  
              var chain = chains[index];
              var grow  = addToHead ? chain[0] : chain[chain.length - 1];
              var grow2 = addToHead ? chain[1] : chain[chain.length - 2];
              var oppo  = addToHead ? chain[chain.length - 1] : chain[0];
              var oppo2 = addToHead ? chain[chain.length - 2] : chain[1];
  
              if (eps.pointsCollinear(grow2, grow, pt)){
                  // grow isn't needed because it's directly between grow2 and pt:
                  // grow2 ---grow---> pt
                  if (addToHead){
                      if (buildLog)
                          buildLog.chainRemoveHead(first_match.index, pt);
                      chain.shift();
                  }
                  else{
                      if (buildLog)
                          buildLog.chainRemoveTail(first_match.index, pt);
                      chain.pop();
                  }
                  grow = grow2; // old grow is gone... new grow is what grow2 was
              }
  
              if (eps.pointsSame(oppo, pt)){
                  // we're closing the loop, so remove chain from chains
                  chains.splice(index, 1);
  
                  if (eps.pointsCollinear(oppo2, oppo, grow)){
                      // oppo isn't needed because it's directly between oppo2 and grow:
                      // oppo2 ---oppo--->grow
                      if (addToHead){
                          if (buildLog)
                              buildLog.chainRemoveTail(first_match.index, grow);
                          chain.pop();
                      }
                      else{
                          if (buildLog)
                              buildLog.chainRemoveHead(first_match.index, grow);
                          chain.shift();
                      }
                  }
  
                  if (buildLog)
                      buildLog.chainClose(first_match.index);
  
                  // we have a closed chain!
                  regions.push(chain);
                  return;
              }
  
              // not closing a loop, so just add it to the apporpriate side
              if (addToHead){
                  if (buildLog)
                      buildLog.chainAddHead(first_match.index, pt);
                  chain.unshift(pt);
              }
              else{
                  if (buildLog)
                      buildLog.chainAddTail(first_match.index, pt);
                  chain.push(pt);
              }
              return;
          }
  
          // otherwise, we matched two chains, so we need to combine those chains together
  
          function reverseChain(index){
              if (buildLog)
                  buildLog.chainReverse(index);
              chains[index].reverse(); // gee, that's easy
          }
  
          function appendChain(index1, index2){
              // index1 gets index2 appended to it, and index2 is removed
              var chain1 = chains[index1];
              var chain2 = chains[index2];
              var tail  = chain1[chain1.length - 1];
              var tail2 = chain1[chain1.length - 2];
              var head  = chain2[0];
              var head2 = chain2[1];
  
              if (eps.pointsCollinear(tail2, tail, head)){
                  // tail isn't needed because it's directly between tail2 and head
                  // tail2 ---tail---> head
                  if (buildLog)
                      buildLog.chainRemoveTail(index1, tail);
                  chain1.pop();
                  tail = tail2; // old tail is gone... new tail is what tail2 was
              }
  
              if (eps.pointsCollinear(tail, head, head2)){
                  // head isn't needed because it's directly between tail and head2
                  // tail ---head---> head2
                  if (buildLog)
                      buildLog.chainRemoveHead(index2, head);
                  chain2.shift();
              }
  
              if (buildLog)
                  buildLog.chainJoin(index1, index2);
              chains[index1] = chain1.concat(chain2);
              chains.splice(index2, 1);
          }
  
          var F = first_match.index;
          var S = second_match.index;
  
          if (buildLog)
              buildLog.chainConnect(F, S);
  
          var reverseF = chains[F].length < chains[S].length; // reverse the shorter chain, if needed
          if (first_match.matches_head){
              if (second_match.matches_head){
                  if (reverseF){
                      // <<<< F <<<< --- >>>> S >>>>
                      reverseChain(F);
                      // >>>> F >>>> --- >>>> S >>>>
                      appendChain(F, S);
                  }
                  else{
                      // <<<< F <<<< --- >>>> S >>>>
                      reverseChain(S);
                      // <<<< F <<<< --- <<<< S <<<<   logically same as:
                      // >>>> S >>>> --- >>>> F >>>>
                      appendChain(S, F);
                  }
              }
              else{
                  // <<<< F <<<< --- <<<< S <<<<   logically same as:
                  // >>>> S >>>> --- >>>> F >>>>
                  appendChain(S, F);
              }
          }
          else{
              if (second_match.matches_head){
                  // >>>> F >>>> --- >>>> S >>>>
                  appendChain(F, S);
              }
              else{
                  if (reverseF){
                      // >>>> F >>>> --- <<<< S <<<<
                      reverseChain(F);
                      // <<<< F <<<< --- <<<< S <<<<   logically same as:
                      // >>>> S >>>> --- >>>> F >>>>
                      appendChain(S, F);
                  }
                  else{
                      // >>>> F >>>> --- <<<< S <<<<
                      reverseChain(S);
                      // >>>> F >>>> --- >>>> S >>>>
                      appendChain(F, S);
                  }
              }
          }
      });
  
      return regions;
  }
  
  module.exports = SegmentChainer;
  
  },{}],8:[function(require,module,exports){
  // (c) Copyright 2016, Sean Connelly (@voidqk), http://syntheti.cc
  // MIT License
  // Project Home: https://github.com/voidqk/polybooljs
  
  //
  // filter a list of segments based on boolean operations
  //
  
  function select(segments, selection, buildLog){
      var result = [];
      segments.forEach(function(seg){
          var index =
              (seg.myFill.above ? 8 : 0) +
              (seg.myFill.below ? 4 : 0) +
              ((seg.otherFill && seg.otherFill.above) ? 2 : 0) +
              ((seg.otherFill && seg.otherFill.below) ? 1 : 0);
          if (selection[index] !== 0){
              // copy the segment to the results, while also calculating the fill status
              result.push({
                  id: buildLog ? buildLog.segmentId() : -1,
                  start: seg.start,
                  end: seg.end,
                  myFill: {
                      above: selection[index] === 1, // 1 if filled above
                      below: selection[index] === 2  // 2 if filled below
                  },
                  otherFill: null
              });
          }
      });
  
      if (buildLog)
          buildLog.selected(result);
  
      return result;
  }
  
  var SegmentSelector = {
      union: function(segments, buildLog){ // primary | secondary
          // above1 below1 above2 below2    Keep?               Value
          //    0      0      0      0   =>   no                  0
          //    0      0      0      1   =>   yes filled below    2
          //    0      0      1      0   =>   yes filled above    1
          //    0      0      1      1   =>   no                  0
          //    0      1      0      0   =>   yes filled below    2
          //    0      1      0      1   =>   yes filled below    2
          //    0      1      1      0   =>   no                  0
          //    0      1      1      1   =>   no                  0
          //    1      0      0      0   =>   yes filled above    1
          //    1      0      0      1   =>   no                  0
          //    1      0      1      0   =>   yes filled above    1
          //    1      0      1      1   =>   no                  0
          //    1      1      0      0   =>   no                  0
          //    1      1      0      1   =>   no                  0
          //    1      1      1      0   =>   no                  0
          //    1      1      1      1   =>   no                  0
          return select(segments, [
              0, 2, 1, 0,
              2, 2, 0, 0,
              1, 0, 1, 0,
              0, 0, 0, 0
          ], buildLog);
      },
      intersect: function(segments, buildLog){ // primary & secondary
          // above1 below1 above2 below2    Keep?               Value
          //    0      0      0      0   =>   no                  0
          //    0      0      0      1   =>   no                  0
          //    0      0      1      0   =>   no                  0
          //    0      0      1      1   =>   no                  0
          //    0      1      0      0   =>   no                  0
          //    0      1      0      1   =>   yes filled below    2
          //    0      1      1      0   =>   no                  0
          //    0      1      1      1   =>   yes filled below    2
          //    1      0      0      0   =>   no                  0
          //    1      0      0      1   =>   no                  0
          //    1      0      1      0   =>   yes filled above    1
          //    1      0      1      1   =>   yes filled above    1
          //    1      1      0      0   =>   no                  0
          //    1      1      0      1   =>   yes filled below    2
          //    1      1      1      0   =>   yes filled above    1
          //    1      1      1      1   =>   no                  0
          return select(segments, [
              0, 0, 0, 0,
              0, 2, 0, 2,
              0, 0, 1, 1,
              0, 2, 1, 0
          ], buildLog);
      },
      difference: function(segments, buildLog){ // primary - secondary
          // above1 below1 above2 below2    Keep?               Value
          //    0      0      0      0   =>   no                  0
          //    0      0      0      1   =>   no                  0
          //    0      0      1      0   =>   no                  0
          //    0      0      1      1   =>   no                  0
          //    0      1      0      0   =>   yes filled below    2
          //    0      1      0      1   =>   no                  0
          //    0      1      1      0   =>   yes filled below    2
          //    0      1      1      1   =>   no                  0
          //    1      0      0      0   =>   yes filled above    1
          //    1      0      0      1   =>   yes filled above    1
          //    1      0      1      0   =>   no                  0
          //    1      0      1      1   =>   no                  0
          //    1      1      0      0   =>   no                  0
          //    1      1      0      1   =>   yes filled above    1
          //    1      1      1      0   =>   yes filled below    2
          //    1      1      1      1   =>   no                  0
          return select(segments, [
              0, 0, 0, 0,
              2, 0, 2, 0,
              1, 1, 0, 0,
              0, 1, 2, 0
          ], buildLog);
      },
      differenceRev: function(segments, buildLog){ // secondary - primary
          // above1 below1 above2 below2    Keep?               Value
          //    0      0      0      0   =>   no                  0
          //    0      0      0      1   =>   yes filled below    2
          //    0      0      1      0   =>   yes filled above    1
          //    0      0      1      1   =>   no                  0
          //    0      1      0      0   =>   no                  0
          //    0      1      0      1   =>   no                  0
          //    0      1      1      0   =>   yes filled above    1
          //    0      1      1      1   =>   yes filled above    1
          //    1      0      0      0   =>   no                  0
          //    1      0      0      1   =>   yes filled below    2
          //    1      0      1      0   =>   no                  0
          //    1      0      1      1   =>   yes filled below    2
          //    1      1      0      0   =>   no                  0
          //    1      1      0      1   =>   no                  0
          //    1      1      1      0   =>   no                  0
          //    1      1      1      1   =>   no                  0
          return select(segments, [
              0, 2, 1, 0,
              0, 0, 1, 1,
              0, 2, 0, 2,
              0, 0, 0, 0
          ], buildLog);
      },
      xor: function(segments, buildLog){ // primary ^ secondary
          // above1 below1 above2 below2    Keep?               Value
          //    0      0      0      0   =>   no                  0
          //    0      0      0      1   =>   yes filled below    2
          //    0      0      1      0   =>   yes filled above    1
          //    0      0      1      1   =>   no                  0
          //    0      1      0      0   =>   yes filled below    2
          //    0      1      0      1   =>   no                  0
          //    0      1      1      0   =>   no                  0
          //    0      1      1      1   =>   yes filled above    1
          //    1      0      0      0   =>   yes filled above    1
          //    1      0      0      1   =>   no                  0
          //    1      0      1      0   =>   no                  0
          //    1      0      1      1   =>   yes filled below    2
          //    1      1      0      0   =>   no                  0
          //    1      1      0      1   =>   yes filled above    1
          //    1      1      1      0   =>   yes filled below    2
          //    1      1      1      1   =>   no                  0
          return select(segments, [
              0, 2, 1, 0,
              2, 0, 0, 1,
              1, 0, 0, 2,
              0, 1, 2, 0
          ], buildLog);
      }
  };
  
  module.exports = SegmentSelector;
},{}]},{},[1]);

//code that needs to be run with bolybool js
const polybool = await utils.suggester(["union (a + b)", "intersect (a && b)", "diffrence (a - b)", "reversed diffrence (b - a)", "xor"], [
  PolyBool.union, PolyBool.intersect, PolyBool.difference, PolyBool.differenceRev, PolyBool.xor
], "What would you like todo with the object");
run();