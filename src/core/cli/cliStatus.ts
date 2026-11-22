/** Optional script readiness is separate from plugin startup and never starts a script. */
export function mindMapBuilderStatus() {
  // This separately installed script has no package declaration to import.
  const api = Object.getOwnPropertyDescriptor(window, "MindMapBuilderAPI")?.value as
    { ready?: () => boolean } | undefined;
  const available = typeof api?.ready === "function";
  try { return { available, ready: available && api.ready() === true }; }
  catch { return { available, ready: false }; }
}
