/** Preserve declared CSS viewport dimensions when the desktop display clamps a native window. */
export function constrainedViewportMetrics(profile, measured) {
  if (measured.width === profile.width && measured.height === profile.height) return null;
  if (profile.width <= measured.workArea.width && profile.height <= measured.workArea.height) return null;
  return {
    width: profile.width,
    height: profile.height,
    mobile: false, // Obsidian's real mobile mode owns platform classification.
    deviceScaleFactor: 0,
    scale: Math.min(1, measured.width / profile.width, measured.height / profile.height),
  };
}

/** CDP input uses the displayed surface, while DOM hit tests use CSS viewport coordinates. */
export function viewportInput(method, params, scale = 1) {
  if (!(scale > 0 && scale <= 1)) throw Error("Invalid owned viewport scale");
  if (scale === 1) return params;
  if (method === "Input.dispatchTouchEvent") return {...params, touchPoints:params.touchPoints.map(point=>({...point,x:point.x*scale,y:point.y*scale}))};
  if (method === "Input.dispatchMouseEvent") return {...params,x:params.x*scale,y:params.y*scale};
  return params;
}
