/** The shared plugin realm keeps PNG URLs valid across popout document migration. */
const imageSources = new WeakMap<HTMLImageElement, { blob: Blob; dispose: () => void }>();
const liveImages = new Map<string, WeakRef<HTMLImageElement>>();
let generation = 0;
let active = true;

function releaseURL(url: string): void {
  liveImages.delete(url);
  URL.revokeObjectURL(url);
}

// Normal renderers explicitly discard their images. Legacy DOM consumers may
// also drop an image without a retirement callback. This fallback retains only
// its URL string, never the image; plugin unload remains a deterministic boundary.
const orphanedURLs =
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry<string>(releaseURL)
    : null;

function clearSources(): void {
  for (const [url, reference] of liveImages) {
    const image = reference.deref();
    if (!image || !discardOwnedPNGImage(image)) releaseURL(url);
  }
}

/** One owner per plugin lifetime; an old disposer cannot retire a replacement. */
export function registerOwnedPNGImageSources(): () => void {
  clearSources();
  const owner = ++generation;
  active = true;
  return () => {
    if (!active || owner !== generation) return;
    active = false;
    clearSources();
  };
}

/** Release an owned payload even after the plugin's cache manager has retired. */
export function discardOwnedPNGImage(image: HTMLImageElement): boolean {
  const source = imageSources.get(image);
  if (!source) return false;
  source.dispose();
  return true;
}

/** Reuse displayed PNG pixels for fullscreen without rasterizing the scene again. */
export function cloneOwnedPNGImage(image: HTMLImageElement): HTMLImageElement | null {
  const source = imageSources.get(image);
  if (!source) return null;
  const copy = image.ownerDocument.adoptNode(createEl("img", { cls: "excalidraw-embedded-img" }));
  setOwnedPNGImageSource(copy, source.blob);
  return copy;
}

/** Keep a live image's source reusable for pixel reads and document migration. */
export function setOwnedPNGImageSource(
  image: HTMLImageElement,
  blob: Blob,
): void {
  discardOwnedPNGImage(image);
  if (!active) return;
  const url = URL.createObjectURL(blob);
  liveImages.set(url, new WeakRef(image));
  orphanedURLs?.register(image, url, image);
  const cleanup = () => {
    imageSources.delete(image);
    image.removeEventListener("error", failed);
    orphanedURLs?.unregister(image);
    releaseURL(url);
  };
  const failed = () => {
    // Ignore an old request's queued error while a replacement is loading.
    if (image.complete && image.naturalWidth === 0) cleanup();
  };
  imageSources.set(image, { blob, dispose: cleanup });
  image.addEventListener("error", failed);
  image.src = url;
}
