/** CDP needs explicit browser editing commands for macOS shortcuts, as Playwright's Chromium driver does. */
export function nativeKeyboardInput(params, platform = process.platform) {
  if (platform !== "darwin" || !["keyDown", "rawKeyDown"].includes(params.type) || params.commands) return params;
  const command = params.modifiers === 4 && params.code === "KeyA" ? "selectAll"
    : params.modifiers === 4 && params.code === "KeyZ" ? "undo"
    : params.modifiers === 12 && params.code === "KeyZ" ? "redo" : null;
  return command ? { ...params, commands: [command] } : params;
}
