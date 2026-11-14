/** PNG payloads belong to an image, independently of the persistent image cache. */
const cleanups = new WeakMap<HTMLImageElement, () => void>();

/** Release an owned payload even after the plugin's cache manager has retired. */
export function discardOwnedPNGImage(image: HTMLImageElement): boolean {
  const cleanup = cleanups.get(image);
  if (!cleanup) return false;
  cleanup();
  return true;
}

/** Keep the blob available for Obsidian's document migrations without retaining a live URL after decoding. */
export function setOwnedPNGImageSource(
  image: HTMLImageElement,
  blob: Blob,
): void {
  discardOwnedPNGImage(image);
  let disposed = false;
  let releaseURL: () => void = () => undefined;
  const setSource = () => {
    if (disposed) return;
    releaseURL();
    const url = URL.createObjectURL(blob);
    const release = () => {
      image.removeEventListener("load", settled);
      image.removeEventListener("error", settled);
      URL.revokeObjectURL(url);
    };
    const settled = () => {
      // An old request's event can arrive while migration starts a new request.
      // Release only after the image's current request has actually settled.
      if (image.complete) release();
    };
    releaseURL = release;
    image.addEventListener("load", settled);
    image.addEventListener("error", settled);
    image.src = url;
  };
  // The hook is element-owned and returns a disposer. It captures no plugin,
  // view or document; the same payload can follow an image into either window.
  const stopMigration = image.onWindowMigrated(setSource);
  cleanups.set(image, () => {
    if (disposed) return;
    disposed = true;
    cleanups.delete(image);
    stopMigration();
    releaseURL();
  });
  setSource();
}
