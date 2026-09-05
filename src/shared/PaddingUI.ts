import {
  EditorPosition,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  TFile,
  Workspace,
} from "obsidian";
import type ExcalidrawPlugin from "../core/main";
import type { FILENAMEPARTS } from "../types/utilTypes";
import {
  getEmbeddedFilenameParts,
  PADDING_PARAMETER_REGEX,
} from "../utils/embeddedFilenameParts";
import { errorlog } from "../utils/coreUtils";
import { t } from "../lang/helpers";
import { setStyle } from "../utils/styleUtils";

declare const deliberateCreateElement: (
  document: Document,
  tagName: string,
) => HTMLElement;

let plugin: ExcalidrawPlugin;

/**
 * Maps each processed `.internal-embed` element to the wrapper that replaced
 * it. Obsidian may re-insert the same element when the note re-renders; the
 * stale wrapper is then replaced in place instead of piling up (see
 * `processReadingMode`). Keyed by element identity so sibling embeds that
 * share the same area reference are never affected.
 */
export const embedPaddingWrapperMap = new WeakMap<Element, HTMLElement>();

/**
 * Force-closes the currently open padding popup per document before another
 * one opens. Keyed by document so popups in the main window and in popout
 * windows stay independent.
 */
const activePopups = new Map<Document, () => void>();

// The reserved-size cache is derived from embed renders, so it is disposable
// and must not grow without bound. Re-inserting a key makes it the newest
// entry; once the limit is exceeded the oldest entry is dropped.
const AREA_PADDING_SIZE_CACHE_LIMIT = 2000;
const areaPaddingSizeCache = new Map<
  string,
  { width: number; height: number }
>();

export const getAreaPaddingSize = (key: string) =>
  areaPaddingSizeCache.get(key);

export const setAreaPaddingSize = (
  key: string,
  size: { width: number; height: number },
) => {
  areaPaddingSizeCache.delete(key);
  areaPaddingSizeCache.set(key, size);
  while (areaPaddingSizeCache.size > AREA_PADDING_SIZE_CACHE_LIMIT) {
    const oldestKey = Array.from(areaPaddingSizeCache.keys())[0];
    if (oldestKey === undefined) {
      break;
    }
    areaPaddingSizeCache.delete(oldestKey);
  }
};

export const initPaddingUI = (_plugin: ExcalidrawPlugin) => {
  plugin = _plugin;
};

/**
 * Closes every open padding popup and drops the size cache. Called on plugin
 * unload so no popup or cached size outlives the plugin instance.
 */
export const cleanupPaddingUI = () => {
  for (const close of Array.from(activePopups.values())) {
    close();
  }
  activePopups.clear();
  areaPaddingSizeCache.clear();
};

/**
 * Wraps an `area=` embed preview with the zoom icon and the padding popup.
 *
 * `sourceFile` is the markdown file that owns the `![[...]]` embed markup
 * when it is known from the render context, or `null` in live preview where
 * the context only exposes the drawing. `targetFile` is the embedded
 * Excalidraw drawing whose area the embed points at. When `sourceFile` is
 * unknown, the owning note is resolved from the DOM (or metadata backlinks)
 * at save time.
 */
export const wrapWithPaddingPopup = (
  imgDiv: HTMLDivElement,
  src: string,
  fnameParts: FILENAMEPARTS,
  sourceFile: TFile | null,
  targetFile: TFile,
  reRender: (newSrc: string) => Promise<HTMLDivElement>,
  ctx: MarkdownPostProcessorContext,
): HTMLDivElement => {
  // The embed may be rendered in the main document and later adopted into a
  // popout window. Use imgDiv's document only for the wrapper/icon (they must
  // share imgDiv's document to be appended); the popup resolves the live
  // document/window when it opens (see the icon click handler below).
  const renderDoc = imgDiv.ownerDocument;
  const renderWin = renderDoc.defaultView ?? window;

  const currentPadding =
    fnameParts.padding ?? plugin.settings.exportPaddingSVG;

  const bareRef = src.replace(PADDING_PARAMETER_REGEX, "");

  // The image Obsidian rendered for this embed. The drag preview replaces it
  // inside the wrapper, and it is restored before the final write so the
  // re-render that follows the file change starts from a clean embed.
  const originalImgDiv = imgDiv;

  const rememberSize = () => {
    setAreaPaddingSize(bareRef, {
      width: imgDiv.offsetWidth,
      height: imgDiv.offsetHeight,
    });
  };

  const wrapper = deliberateCreateElement(renderDoc, "div") as HTMLDivElement;
  wrapper.className = "excalidraw-padding-wrapper";
  wrapper.setAttribute("data-bare-ref", bareRef);
  wrapper.setAttribute("data-area-id", fnameParts.blockref);
  wrapper.setAttribute("data-target-path", targetFile.path);
  wrapper.setAttribute("data-padding", String(currentPadding));
  wrapper.appendChild(imgDiv);
  renderWin.requestAnimationFrame(rememberSize);

  const icon = deliberateCreateElement(renderDoc, "button");
  icon.className = "excalidraw-padding-zoom-icon";
  icon.setAttribute("type", "button");
  icon.setAttribute("aria-label", t("PADDING_ZOOM_ARIA"));
  const svgNs = "http://www.w3.org/2000/svg";
  const svgIcon = renderDoc.createElementNS(svgNs, "svg");
  svgIcon.setAttribute("viewBox", "0 0 24 24");
  svgIcon.setAttribute("fill", "none");
  svgIcon.setAttribute("stroke", "currentColor");
  svgIcon.setAttribute("stroke-width", "2");
  const circle = renderDoc.createElementNS(svgNs, "circle");
  circle.setAttribute("cx", "11");
  circle.setAttribute("cy", "11");
  circle.setAttribute("r", "8");
  svgIcon.appendChild(circle);
  for (const [x1, y1, x2, y2] of [
    ["21", "21", "16.65", "16.65"],
    ["11", "8", "11", "14"],
    ["8", "11", "14", "11"],
  ]) {
    const line = renderDoc.createElementNS(svgNs, "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    svgIcon.appendChild(line);
  }
  icon.appendChild(svgIcon);

  const setIconVisible = (visible: boolean) => {
    icon.classList.toggle("is-visible", visible);
  };

  wrapper.addEventListener("mouseenter", () => {
    setIconVisible(true);
  });
  wrapper.addEventListener("mouseleave", () => {
    setIconVisible(false);
  });

  let hideTimer: number;
  wrapper.addEventListener("click", (e) => {
    if (e.target === icon || icon.contains(e.target as Node)) return;
    renderWin.clearTimeout(hideTimer);
    setIconVisible(true);
    hideTimer = renderWin.setTimeout(() => { setIconVisible(false); }, 3000);
  });

  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    // The wrapper may have been adopted into a popout window after the initial
    // render, so re-resolve the live document/window at open time instead of
    // relying on the render-time document captured above.
    const doc = wrapper.ownerDocument;
    const win = doc.defaultView ?? window;

    // Force-close any previously open popup in the same document before
    // opening this one (main window and popout windows are independent).
    const prevClose = activePopups.get(doc);
    if (prevClose) {
      activePopups.delete(doc);
      prevClose();
    }

    let value = currentPadding;
    let committedValue = currentPadding;
    let debounceTimer: number;
    // Guards against prerender races: a fast slider drag issues several
    // in-flight re-renders, and only the newest result may touch the wrapper.
    // Any final save also invalidates pending previews so a stale image cannot
    // land after the file write.
    let renderGeneration = 0;
    // Serializes final file writes: a force-close racing a pointerup save must
    // not run two vault processes concurrently. Re-renders (final: false)
    // never touch the file, so they stay out of the chain.
    let writeChain: Promise<void> = Promise.resolve();

    // The markdown leaf (and thus the note) that actually renders the wrapper.
    // Checks the main window and, for popouts, the owner window. Captured once
    // at open time: the first interactive re-render detaches this wrapper from
    // the DOM, so the live document can no longer be used to locate the note.
    const resolveOwningMarkdownView = (): MarkdownView | null => {
      const workspaces: Workspace[] = [plugin.app.workspace];
      const win = wrapper.ownerDocument.defaultView;
      const winApp = (
        win as unknown as { app?: { workspace?: Workspace } } | null
      )?.app;
      if (winApp?.workspace && winApp.workspace !== plugin.app.workspace) {
        workspaces.push(winApp.workspace);
      }
      for (const workspace of workspaces) {
        for (const leaf of workspace.getLeavesOfType("markdown")) {
          if (
            leaf.view instanceof MarkdownView &&
            leaf.view.containerEl.contains(wrapper)
          ) {
            return leaf.view;
          }
        }
      }
      return null;
    };
    const owningView = resolveOwningMarkdownView();

    // Nth embed of this drawing's area within the owning note. DOM order
    // matches source markdown order, and the wrapper always lives in the DOM
    // of the note that contains the `![[...]]` markup (even when the embed was
    // rendered from a nested drawing context in live preview). Scope the query
    // to the owning note's container so identical embeds in other open notes or
    // panes of the same document are never counted.
    const rootNode = wrapper.getRootNode();
    const fallbackRoot: ParentNode =
      rootNode.nodeType === 9 ? (rootNode as Document) : wrapper.ownerDocument;
    const occurrenceRoot: ParentNode = owningView?.containerEl ?? fallbackRoot;
    const allWrappers = Array.from(
      occurrenceRoot.querySelectorAll(
        `.excalidraw-padding-wrapper[data-target-path="${targetFile.path}"][data-area-id="${fnameParts.blockref}"]`,
      ),
    );
    const areaOccurrence = allWrappers.indexOf(wrapper);
    // Index within the group of wrappers rendered with the same padding: used
    // to disambiguate identical embeds (same area reference, same padding).
    const paddingOccurrence = allWrappers
      .filter((w) => w.getAttribute("data-padding") === String(currentPadding))
      .indexOf(wrapper);

    const doSave = async (final: boolean) => {
      const valueToWrite = value;
      const defaultPad = plugin.settings.exportPaddingSVG;
      const newSuffix =
        valueToWrite === defaultPad ? "" : ",padding=" + valueToWrite;

      if (!final) {
        // Update the target image in place during drag, so the note layout
        // doesn't reflow. The file is written once when the popup closes
        // (final), instead of on every debounce, so the note does not jump
        // during re-render (see 0dd2635).
        const generation = ++renderGeneration;
        const newSrc =
          fnameParts.filepath +
          fnameParts.linkpartReference.replace(PADDING_PARAMETER_REGEX, "") +
          newSuffix +
          fnameParts.linkpartAlias;
        try {
          const newImgDiv = await reRender(newSrc);
          // A newer render started while this one was in flight, or the
          // wrapper was detached (popup closed, note closed): discard the
          // stale result instead of clobbering the fresh embed.
          if (generation !== renderGeneration || !wrapper.isConnected) {
            return;
          }
          if (newImgDiv) {
            if (newImgDiv.ownerDocument !== doc) {
              doc.adoptNode(newImgDiv);
            }
            wrapper.replaceChild(newImgDiv, imgDiv);
            imgDiv = newImgDiv;
            win.requestAnimationFrame(rememberSize);
          }
        } catch (error: unknown) {
          errorlog({
            message: `Failed to render area= padding preview ${newSuffix}`,
            context: "PaddingUI",
            error,
          });
        }
        return;
      }

      // The popup is closing: put the embed image Obsidian rendered back in
      // place before writing. The drag preview must not survive into the
      // re-render that follows the file change: Obsidian reuses the wrapper
      // DOM for the edited line, and a stale preview would leak into a sibling
      // embed of the same area.
      if (imgDiv !== originalImgDiv && wrapper.isConnected) {
        wrapper.replaceChild(originalImgDiv, imgDiv);
        imgDiv = originalImgDiv;
      }

      // The popup is closing: the file becomes the source of truth, and any
      // in-flight preview re-render is now obsolete.
      renderGeneration++;

      if (valueToWrite === committedValue) {
        return;
      }

      const write = writeChain.then(async () => {
        if (valueToWrite === committedValue) {
          return;
        }
        await writePadding(newSuffix);
        // Only advance the committed value after the write succeeded, so a
        // failed write leaves it untouched and can be retried (e.g. by
        // closing the popup again).
        committedValue = valueToWrite;
      });
      writeChain = write.catch((error: unknown) => {
        errorlog({
          message: `Failed to save area= padding ${newSuffix}`,
          context: "PaddingUI",
          error,
        });
      });
      await writeChain;
    };

    // Persists the new padding into the note that owns the `![[...]]` markup.
    // The wrapper always lives in the DOM of that note, even when the embed
    // was rendered from a nested drawing context (live preview or reading
    // mode), where `ctx.sourcePath` points at the drawing. The owning markdown
    // leaf gives the real note file; metadata backlinks are the fallback.
    const writePadding = async (newSuffix: string): Promise<void> => {
      const areaId = fnameParts.blockref;

      // Semantic matcher: find the `![[...]]` embed that points at this
      // drawing's area and was rendered with the same padding as this wrapper
      // (the embed the user is actually adjusting), then swap only the padding
      // parameter, preserving the written filepath and alias. A plain
      // `[[...]]` link is never targeted because only `![[` embeds are
      // considered, and markup inside fenced code blocks or inline code is
      // masked out because Obsidian does not render it. The occurrence index
      // is only a tiebreaker: stale wrappers can inflate the DOM-based index,
      // so the file may contain fewer embeds than the DOM suggests.
      type MatchResult = {
        found: boolean;
        from: number;
        to: number;
        replacement: string;
      };
      // Returns a copy of `data` of identical length where the content of
      // fenced code blocks (```/~~~) and inline code spans has been replaced
      // with spaces. Obsidian does not render embeds there, so `![[...]]`
      // markup inside code must never be treated as a real embed; keeping the
      // length identical makes regex offsets valid for the original text.
      const maskNonRenderedContent = (text: string): string => {
        const lines = text.split("\n");
        let fenceChar = "";
        let fenceLen = 0;
        let inFence = false;
        for (let i = 0; i < lines.length; i++) {
          const m = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
          if (inFence) {
            if (m && m[1][0] === fenceChar && m[1].length >= fenceLen) {
              inFence = false;
              continue;
            }
            lines[i] = " ".repeat(lines[i].length);
          } else if (m) {
            inFence = true;
            fenceChar = m[1][0];
            fenceLen = m[1].length;
            lines[i] = " ".repeat(lines[i].length);
          }
        }
        // Inline code spans are masked after fenced blocks: masking them first
        // would eat the backticks of a ``` fence opener.
        return lines.join("\n").replace(/`[^`\n]*`/g, (s) => " ".repeat(s.length));
      };
      const matchAndReplace = (
        data: string,
        resolveBase: TFile,
        occurrence: number,
        paddingOccurrence: number,
        suffix: string,
      ): MatchResult => {
        const defaultPad = plugin.settings.exportPaddingSVG;
        const masked = maskNonRenderedContent(data);
        const embedPattern = /!\[\[([^[\]]*)\]\]/g;
        const matches: {
          index: number;
          end: number;
          parts: FILENAMEPARTS;
        }[] = [];
        let m: RegExpExecArray | null;
        while ((m = embedPattern.exec(masked))) {
          const parts = getEmbeddedFilenameParts(m[1]);
          if (!parts.hasArearef || parts.blockref !== areaId) {
            continue;
          }
          const resolved = plugin.app.metadataCache.getFirstLinkpathDest(
            parts.filepath,
            resolveBase.path,
          );
          if (resolved?.path !== targetFile.path) {
            continue;
          }
          matches.push({ index: m.index, end: m.index + m[0].length, parts });
        }
        // Prefer the embed rendered with the same padding as this wrapper; the
        // note usually contains exactly one such embed. For duplicate-padding
        // embeds fall back to the padding-group index (the position of this
        // wrapper among wrappers with the same padding), then to the global
        // occurrence.
        const samePadding = matches.filter(
          ({ parts }) => (parts.padding ?? defaultPad) === currentPadding,
        );
        const target =
          samePadding.length === 1
            ? samePadding[0]
            : samePadding[
                Math.min(paddingOccurrence, samePadding.length - 1)
              ] ?? matches[Math.min(occurrence, matches.length - 1)];
        if (!target) {
          return { found: false, from: 0, to: 0, replacement: "" };
        }
        const newRef =
          target.parts.linkpartReference.replace(PADDING_PARAMETER_REGEX, "") +
          suffix;
        const newEmbed =
          `![[${target.parts.filepath}${newRef}${target.parts.linkpartAlias}]]`;
        return {
          found: true,
          from: target.index,
          to: target.end,
          replacement: newEmbed,
        };
      };

      const posFromOffset = (text: string, offset: number): EditorPosition => {
        const before = text.slice(0, offset);
        const lines = before.split("\n");
        return {
          line: lines.length - 1,
          ch: lines[lines.length - 1].length,
        };
      };

      const tryDiskWrite = async (file: TFile): Promise<boolean> => {
        const content = await plugin.app.vault.cachedRead(file);
        const result = matchAndReplace(
          content,
          file,
          areaOccurrence,
          paddingOccurrence,
          newSuffix,
        );
        if (!result.found) {
          return false;
        }
        await plugin.app.vault.process(file, (data: string) => {
          const r = matchAndReplace(
            data,
            file,
            areaOccurrence,
            paddingOccurrence,
            newSuffix,
          );
          return r.found
            ? data.slice(0, r.from) + r.replacement + data.slice(r.to)
            : data;
        });
        return true;
      };

      let saved = false;
      if (owningView?.file) {
        // Live preview / source mode: edit the editor buffer directly so the
        // change lands even if the file is not yet saved to disk, then let
        // Obsidian persist it.
        if (owningView.getMode() === "source" && owningView.editor) {
          const content = owningView.editor.getValue();
          const result = matchAndReplace(
            content,
            owningView.file,
            areaOccurrence,
            paddingOccurrence,
            newSuffix,
          );
          if (result.found) {
            owningView.editor.replaceRange(
              result.replacement,
              posFromOffset(content, result.from),
              posFromOffset(content, result.to),
            );
            saved = true;
          }
        }
        if (!saved) {
          saved = await tryDiskWrite(owningView.file);
        }
      }

      // Fallback candidates that may own the embed markup.
      const candidates: TFile[] = [];
      const pushCandidate = (file: TFile | null) => {
        if (file && !candidates.some((c) => c.path === file.path)) {
          candidates.push(file);
        }
      };
      let ancestor: HTMLElement | null = wrapper.parentElement;
      while (ancestor) {
        const path = ancestor.getAttribute?.("data-path");
        if (path) {
          const f = plugin.app.vault.getAbstractFileByPath(path);
          if (f instanceof TFile) {
            pushCandidate(f);
          }
          break;
        }
        ancestor = ancestor.parentElement;
      }
      pushCandidate(sourceFile);
      const backlinks =
        plugin.app.metadataCache.getBacklinksForFile(targetFile);
      for (const srcPath of Object.keys(backlinks?.data ?? {})) {
        const srcFile = plugin.app.vault.getAbstractFileByPath(srcPath);
        if (srcFile instanceof TFile) {
          pushCandidate(srcFile);
        }
      }

      if (!saved) {
        for (const candidate of candidates) {
          try {
            if (await tryDiskWrite(candidate)) {
              saved = true;
              break;
            }
          } catch (error: unknown) {
            errorlog({
              message: `Failed to save embed padding to ${candidate.path}`,
              context: "PaddingUI",
              error,
            });
          }
        }
      }
    };

    const popup = deliberateCreateElement(doc, "div");
    popup.className = "ex-pad-popup";

    const label = deliberateCreateElement(doc, "span");
    label.className = "ex-pad-popup-label";
    label.textContent = String(value);

    const track = deliberateCreateElement(doc, "div");
    track.className = "ex-pad-popup-track";

    const knob = deliberateCreateElement(doc, "div");
    knob.className = "ex-pad-popup-knob";

    const STEPS = [0, 10];
    for (let s = 50; s <= 500; s += 50) STEPS.push(s);
    for (let s = 600; s <= 1000; s += 100) STEPS.push(s);
    for (let s = 1200; s <= 2000; s += 200) STEPS.push(s);

    const valueToStep = (v: number) => {
      let best = STEPS[0];
      for (const s of STEPS) {
        if (Math.abs(s - v) < Math.abs(best - v)) best = s;
      }
      return best;
    };

    const stepIndex = (v: number) => STEPS.indexOf(valueToStep(v));

    label.textContent = String(value);

    const updateKnob = (v: number) => {
      const idx = stepIndex(v);
      const pct = idx / (STEPS.length - 1);
      setStyle(knob, { top: (160 - 14) * pct + "px" });
    };
    updateKnob(value);

    const onValueChange = (v: number) => {
      value = valueToStep(v);
      label.textContent = String(value);
      updateKnob(value);
      win.clearTimeout(debounceTimer);
      debounceTimer = win.setTimeout(() => {
        void doSave(false);
      }, 400);
    };

    let dragging = false;
    const posToValue = (clientY: number) => {
      const tr = track.getBoundingClientRect();
      const pct = (clientY - tr.top) / tr.height;
      const idx = Math.round(pct * (STEPS.length - 1));
      return STEPS[Math.max(0, Math.min(STEPS.length - 1, idx))];
    };

    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      win.clearTimeout(debounceTimer);
      onValueChange(posToValue(ev.clientY));
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return;
      onValueChange(posToValue(ev.clientY));
    };
    const onPointerUp = () => {
      // No file write on release: writing re-renders the note and would tear
      // down the popup mid-interaction. The value is committed once when the
      // popup closes (click outside, force-close, or owner unload).
      dragging = false;
    };

    track.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("pointermove", onPointerMove);
    doc.addEventListener("pointerup", onPointerUp);

    track.appendChild(knob);

    popup.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const idx = stepIndex(value);
      const next = idx + (ev.deltaY < 0 ? -1 : 1);
      if (next >= 0 && next < STEPS.length) onValueChange(STEPS[next]);
    }, { passive: false });

    popup.appendChild(label);
    popup.appendChild(track);
    doc.body.appendChild(popup);

    const rect = icon.getBoundingClientRect();
    const pr = popup.getBoundingClientRect();
    setStyle(popup, {
      left: Math.min(rect.left, win.innerWidth - pr.width - 8) + "px",
      top: Math.min(rect.bottom + 4, win.innerHeight - pr.height - 8) + "px",
    });

    let closeListenerTimer: number | undefined;
    let closing = false;

    function cleanup() {
      popup.remove();
      if (closeListenerTimer !== undefined) {
        win.clearTimeout(closeListenerTimer);
        closeListenerTimer = undefined;
      }
      doc.removeEventListener("click", close);
      doc.removeEventListener("pointermove", onPointerMove);
      doc.removeEventListener("pointerup", onPointerUp);
      win.clearTimeout(debounceTimer);
    }

    // Shared by the document-click close path and the force-close path used
    // when another embed opens. Idempotent so the two paths never double-fire.
    function commitAndClose() {
      if (closing) return;
      closing = true;
      activePopups.delete(doc);
      cleanup();
      void doSave(true);
    }

    function close(ev: MouseEvent) {
      if (!popup.contains(ev.target as Node)) {
        commitAndClose();
      }
    }

    // Register this popup so opening another one in the same document
    // force-closes it cleanly.
    activePopups.set(doc, commitAndClose);

    // Tie the popup lifetime to the render context: when Obsidian re-renders
    // or closes the note, the render child unloads and the popup is committed
    // (final save) and cleaned up instead of leaking.
    const popupOwner = new MarkdownRenderChild(wrapper);
    popupOwner.onunload = () => {
      if (activePopups.get(doc) === commitAndClose) {
        commitAndClose();
      }
    };
    ctx.addChild(popupOwner);

    closeListenerTimer = win.setTimeout(
      () => doc.addEventListener("click", close),
      0,
    );
  });

  wrapper.appendChild(icon);
  return wrapper;
};
