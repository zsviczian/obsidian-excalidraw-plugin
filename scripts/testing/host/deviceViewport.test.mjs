import assert from "node:assert/strict";
import test from "node:test";
import { constrainedViewportMetrics, viewportInput } from "./deviceViewport.mjs";
test("a display clamp keeps the requested viewport instead of changing a device profile", () => {
  const profile={width:1200,height:900};
  const metrics=constrainedViewportMetrics(profile,{width:1200,height:875,workArea:{width:1440,height:875}});
  assert.equal(metrics.width,1200);assert.equal(metrics.height,900);assert.ok(metrics.scale<1);assert.equal(metrics.mobile,false);
});
test("matching windows and unexplained viewport mismatches do not receive an emulation bypass", () => {
  assert.equal(constrainedViewportMetrics({width:1200,height:900},{width:1200,height:900,workArea:{width:1440,height:1000}}),null);
  assert.equal(constrainedViewportMetrics({width:1200,height:900},{width:1100,height:900,workArea:{width:1440,height:1000}}),null);
});

test("scaled native input lands on the CSS hit-test point without mutating the request",()=>{
  const touch={type:"touchStart",touchPoints:[{x:335,y:26,id:1,force:1}]};
  const mapped=viewportInput("Input.dispatchTouchEvent",touch,.8);
  assert.deepEqual(mapped.touchPoints,[{x:268,y:20.8,id:1,force:1}]);
  assert.equal(touch.touchPoints[0].x,335);
  const mouse=viewportInput("Input.dispatchMouseEvent",{type:"mousePressed",x:100,y:200,buttons:1},.8);
  assert.deepEqual(mouse,{type:"mousePressed",x:80,y:160,buttons:1});
  const key={type:"keyDown",key:"p"};assert.equal(viewportInput("Input.dispatchKeyEvent",key,.8),key);
  assert.equal(viewportInput("Input.dispatchTouchEvent",touch),touch);
  assert.throws(()=>viewportInput("Input.dispatchTouchEvent",touch,0),/Invalid/);
});
