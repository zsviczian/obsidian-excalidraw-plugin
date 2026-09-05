/*
# Slideshow

Converts the active Excalidraw drawing into a slideshow presentation. The built
script is emitted to `build/slideshow/slideshow.md`.

[Watch the Slideshow 3.0 walkthrough](https://www.youtube.com/watch?v=JwgtCrIVeEU) and the [Excalidraw 2.27.0 update video](https://youtu.be/am2HOlbYsxI?si=4UPdmFMJcpM6j9oR&t=272)

![Slideshow example](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-slideshow-2.jpg)

## Launch behavior

- Slideshow requests Excalidraw Automate autostart permission. Its autostart pass only registers
  the view-local **Edit slideshow** element action; it never starts a presentation.
- Select a frame or line/arrow carrying slideshow metadata and use its Lucide presentation action
  to open/focus the **Slideshow** sidepanel for that element's frame or line deck.
- After a view is registered, invoking the script from its toolbar icon, Obsidian command, or
  hotkey starts that view's presentation. A normal invocation starts fullscreen; whether presenter
  notes open follows the persisted sidepanel setting. Shift resumes saved progress, Alt/Option
  starts windowed, and Cmd/Ctrl opens/focuses the Slideshow sidepanel instead of presenting.
  Invoking the script again while a presentation is active advances the existing controller unless
  Cmd/Ctrl is held, in which case the presentation ends and the sidepanel opens.
- Slideshow uses `utils.executionSource` so autostart remains registration-only while the very
  first manual toolbar, command, or hotkey invocation can start presenting immediately.
- The presentation toolbar's settings button ends the active presentation and opens the sidepanel.
  Presentation-source switching and presenter-view launch are intentionally configured from the
  sidepanel rather than duplicated on the compact presentation toolbar.
- The sidepanel is a single non-persistent instance. It follows the most recently focused
  Excalidraw drawing across main-window/popout contexts and shows an empty state for Markdown notes.

## Presentation sources and slide order

A drawing can contain one frame presentation plus any number of independent line/arrow presentations. The sidepanel keeps an explicit presentation-source selection; selecting ordinary canvas elements never changes which deck the sorter is editing.

- Frames form one presentation source when the drawing contains frames.
- A line/arrow becomes a presentation source only after slideshow metadata is created for it. Selecting an ordinary line does **not** implicitly turn it into a slideshow or replace the sidepanel deck.
- When an ordinary line/arrow with at least one complete point pair is selected, the sidepanel shows a contextual **Create line presentation** action in the top toolbar.
- Every persisted line presentation has its own optional name. Use its ellipsis/settings action beside the deck summary to rename it or remove only its slideshow metadata. Removing presentation metadata never deletes the line itself and restores its original styling if the path had been persistently hidden.
- If presentation names collide, the selector disambiguates them only in the UI as `Name (1)`, `Name (2)`, and so on; element ids remain the stable identity. Unnamed paths use `Line presentation` with the same duplicate-numbering rule.
- When multiple sources exist, the presentation selector lists `Frames` plus every named line presentation independently. Manual script launch prefers a selected **persisted** line presentation; otherwise frames are the default when available, then the first persisted line presentation.
- Frames without slideshow metadata retain alphabetical ordering.
- The first sorter mutation writes explicit normalized `order` metadata; after that, frame renames do not change presentation order.
- Excluded frame and line slides remain visible and editable in the sorter, but are omitted from presentation and PDF output.

## Slide sorter

The sidepanel shows a title, thumbnail, and controls for every slide. Titles occupy their own top row so long frame names remain readable.

- Desktop: drag rows to reorder them.
- All platforms: use the up/down buttons or `Alt+Arrow Up/Down`.
- `Arrow Up/Down`: move sorter focus.
- `Enter`: zoom the drawing editor to the focused slide.
- `Space`: toggle inclusion for frame or line slides.
- `N`: expand and focus presenter notes for the selected slide.
- `A`: open the animation editor for a frame slide.

Line slides reorder consecutive point pairs in absolute scene coordinates and normalize the line origin afterward. Stable line-slide metadata records are reordered in the same transaction so presenter notes and inclusion state remain attached to the correct slide. Reordering is disabled when the presentation line/arrow has an active start or end binding.

## Appearance sequence and animation

Frame slides support a build sequence stored on the frame's slideshow metadata. Open the sorter, choose a frame, and use the sparkles action (or `A`) to expand the animation editor directly beneath that slide. The frame is selected and zoomed to fit when editing starts. Select elements or groups in the drawing, then add or update steps with these effects:

- **Appear:** restore the target instantly.
- **Fade:** animate from transparent to the element's original opacity.
- **Slide in:** animate an SVG overlay from the chosen direction.
- **Zoom in:** animate an SVG overlay from approximately 5% scale at the target center.

Steps can trigger on presenter advance or sequentially after a delay. Fade, slide, and zoom default to 350 ms; timed steps default to a 1000 ms delay. Steps can be reordered with drag/drop, buttons, or `Alt+Arrow Up/Down`, previewed, edited, and deleted. Editor previews position SVG motion overlays in the drawing host coordinate space, matching presentation geometry even when the Excalidraw leaf is offset by sidepanels or other workspace chrome.

Groups are stored by group ID and resolved dynamically when the presentation runs. Bound text and its container are treated as one visual unit. Marker frames do not own their contents, so animation eligibility is determined by geometric overlap between each element rectangle and the marker-frame rectangle rather than by `frameId`. Adding a target that already belongs to another animation step moves it to the new step instead of creating conflicting builds.

Presentation navigation is hierarchical: Forward reveals the next pending build before advancing the slide; Backward reverses the most recently completed build before moving to the previous slide. Previous slides entered while navigating backward start fully built, while direct jumps enter the destination in its initial build state. Timed callbacks and animation frames are invalidated on navigation and exit. Temporary scene changes use `captureUpdate: "NEVER"`; real elements are changed only through opacity, while slide/zoom motion uses disposable SVG overlays. Any interruption or presentation exit explicitly restores every animated target to its final/original visibility before cleanup.

Animation editing remains frame-only because frames provide stable geometric slide boundaries. Line slides support ordering, notes, and inclusion/exclusion but not element animation.

## Presenter notes

Each sorter row can own Markdown presenter notes. Use the notes icon on that row to expand/collapse its editor directly beneath the slide instead of using a shared editor at the bottom of the sorter.

- Frame notes are stored in `frame.customData.slideshow.notes`.
- Line-slide notes are stored in the corresponding stable record on the presentation-path element.
- Notes save after a short debounce and are flushed on blur, slide changes, panel close, and presentation start.
- Empty notes are removed rather than persisted as empty strings.
- Each persisted notes edit is followed by an immediate drawing `forceSave(true)` so the metadata is written to disk, not merely left dirty in memory.

On desktop, presenter view runs in a script-owned Obsidian popout. The presenter window shows the current slide, rendered Markdown notes, live animation progress, and the **next navigation state**. When another animation is pending, the large next preview shows that next animation state on the current slide; only after the slide is fully built does it preview the next visible slide. A layout toggle can devote approximately 85% of the window width to presenter notes, leaving a compact current/next preview rail for teleprompter-style use. Its Previous/Next controls and keyboard shortcuts call the same `SlideshowController` state machine as the floating presentation toolbar. Keyboard handling is scoped to the window that actually has focus and ignores repeated/default-prevented keydown events, preventing one key press from being interpreted twice. Closing only the presenter popout leaves the presentation running; ending the presentation closes the presenter popout as part of cleanup. Presenter view is disabled on mobile because Obsidian does not support popout windows there.

## Thumbnails

`SlidePreviewService` calculates each slide's configured `printSlideWidth` × `printSlideHeight` navigation rectangle and exports only elements intersecting that viewport. Sorter and presenter previews are bounded-resolution PNG blobs rather than full-scene SVG clones, so off-slide embedded images are not repeated in every thumbnail. Sorter previews are requested lazily with `IntersectionObserver` and rendered through a serialized queue. A byte-budgeted LRU cache owns object URLs and revokes them on eviction or drawing changes. Slideshow metadata-only changes do not invalidate visual previews.

PDF pages use the same area-selection and exact viewport anchoring through `ea.createViewSVG({ exportArea })`, but remain vector SVGs. Each page is self-contained and includes only image files referenced by elements intersecting that page instead of retaining the complete drawing behind a changed `viewBox`.

## Slideshow settings

The sidepanel cog opens a script-owned settings modal for transition timing, edit zoom, fade level, print/presentation dimensions, and maximum zoom. Values are persisted through Excalidraw Automate script settings, with the historical configuration values used as defaults. The sidepanel preview aspect ratio updates to match the configured print width and height.

The sidepanel also includes a small support link to [Ko-fi](https://ko-fi.com/zsolt).

## Presentation launch, displays, and PDF behavior

The sidepanel has one compact **Play** button. Launch behavior is configured independently through dropdowns instead of overloading the play action: **Start / Resume / Current**, **Fullscreen / Windowed**, and **Slides only / With Notes**. If multiple presentation sources exist, a separate presentation selector is shown. Changing a dropdown never starts the presentation; pressing Play uses the currently selected combination. These choices are persisted in script settings. The launch/display controls live in a collapsible **Presentation settings** section so the sorter can use most of the panel height. Windowed launches hide the entire Excalidraw sidepanel before presentation so the deck receives the full workspace width.

On desktop, display selectors are shown only when **With Notes** is selected. The default keeps the presentation on the current/primary display and chooses another display for presenter notes when available. Presentation and notes display selections are persisted in script settings under a stable local device key, allowing different machines that share the script settings to keep independent monitor choices.

Presenter placement is deliberately fail-safe. The host native-window placement is captured **before** a presenter popout is opened. After `openPopoutLeaf()`, Slideshow waits until Obsidian has actually migrated the presenter leaf into a DOM `Window` distinct from the host, then verifies that the two DOM windows resolve to different native Electron `BrowserWindow`s before moving either presenter window. If identity cannot be established unambiguously, presenter movement is skipped instead of risking moving the main Obsidian window. The host is then moved to the requested presentation display and fullscreen is requested only after Electron confirms the display transition. Native restoration uses Electron's `BrowserWindow.id`, waits for macOS native fullscreen to finish exiting, and briefly monitors the captured host for a late Sidecar/Spaces drift; only a window that moves off its original display or fully off-screen is repaired.

Display handling remains best-effort because Obsidian does not expose a first-class presentation-display API to scripts.
On Obsidian Mobile, presentations always use fullscreen mode, presenter view is unavailable, and the docked mobile navbar is hidden for the duration of the presentation. The presentation toolbar is centered and uses a compact slide picker on narrow screens.


Presentation navigation, the toolbar slide picker, and PDF export consume the canonical visible deck. Frame order and exclusions therefore match the sorter. The presentation slide picker labels entries as `Title (current/total)`. Starting from the sidepanel returns focus to the drawing leaf before keyboard handlers are installed, so arrow-key navigation is immediately active. PDF pages use the final fully built scene state: all animation targets are restored to their original opacity and no animation overlays are included.

## Keyboard shortcuts and modifier keys during presentation

- **Forward:** Arrow Down, Arrow Right, or Space
- **Backward:** Arrow Up or Arrow Left
- **Finish:** Backspace or Escape
- **Edit current line-path slide:** E
- **Toggle fullscreen:** F
- **Return to the current slide:** Home
- **Go to the final slide:** End
- **Normal script invocation:** start fullscreen. Slides-only vs presenter notes follows the sidepanel setting.
- **Run in a window:** Hold Alt/Option while launching the script.
- **Resume from the last slide:** Hold Shift while launching the script. Progress is held only in
  temporary runtime memory and is tracked independently for each concrete Excalidraw view, even
  when two views show the same file. It can be combined with Alt/Option.
- **Open the Slideshow sidepanel:** Hold Cmd on macOS or Ctrl on Windows/Linux while invoking the script.

Build version: 2026-09-05T14:16:51.659Z

```javascript
*/

// Script bundle
/* EA Script — slideshow | ea-scripts v1.0.0 */
(() => {
  // src/sharedUtils/i18n.ts
  function interpolateTranslation(template, params = {}) {
    return Object.entries(params).reduce(
      (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
      template
    );
  }
  function createTranslator(requestedLocale, catalogs, fallbackLocale = "en") {
    const locale = requestedLocale.toLowerCase().replaceAll("_", "-");
    const baseLocale = locale.split("-")[0] ?? locale;
    return (key, params = {}) => {
      const template = catalogs[locale]?.[key] ?? catalogs[baseLocale]?.[key] ?? catalogs[fallbackLocale]?.[key] ?? key;
      return interpolateTranslation(template, params);
    };
  }

  // src/scripts/slideshow/lang/de.ts
  var de = {
    requiresNewerVersion: "Dieses Skript ben\xF6tigt eine neuere Version von Excalidraw. Installiere bitte die neueste Version.",
    noActiveView: "\xD6ffne eine Excalidraw-Zeichnung, bevor du die Pr\xE4sentation startest.",
    cannotAccessView: "Auf die aktive Excalidraw-Ansicht konnte nicht zugegriffen werden."
  };

  // src/scripts/slideshow/lang/en.ts
  var en = {
    requiresNewerVersion: "This script requires a newer version of Excalidraw. Please install the latest version.",
    autostartExplanation: 'Autostart is required for registering the "Edit Slide" button. Autostart does not mean slideshows will autostart when opening a drawing.',
    noActiveView: "Open an Excalidraw drawing before starting the slideshow.",
    cannotAccessView: "Could not access the active Excalidraw view.",
    noPresentationPath: "No configured slideshow is available. Add frames or create a line presentation.",
    selectedPathOverridesHidden: "Using the selected line instead of the hidden presentation path. Run the slideshow without selecting an element to use the hidden path.",
    allFramesExcluded: "All frame slides are excluded. Include at least one frame before presenting.",
    allSlidesExcluded: "All slides are excluded. Include at least one slide before presenting.",
    sidepanelTitle: "Slideshow",
    supportPrompt: "Enjoying Slideshow?",
    supportLink: "Buy me a coffee.",
    settingsTitle: "Slideshow settings",
    settingsTransitionStepCount: "Transition step count",
    settingsTransitionStepCountDesc: "Number of interpolation steps used when moving between slides.",
    settingsTransitionDelay: "Transition duration (ms)",
    settingsTransitionDelayDesc: "Approximate duration of the camera transition between slides.",
    settingsFrameSleep: "Transition frame sleep (ms)",
    settingsFrameSleepDesc: "Delay yielded between individual camera-transition frames.",
    settingsEditZoomOut: "Edit zoom factor",
    settingsEditZoomOutDesc: "Zoom multiplier used when opening a slide for editing. *100[%]",
    settingsFadeLevel: "Presentation fade level",
    settingsFadeLevelDesc: "Opacity level used when fading presentation controls. *100[%]",
    settingsPrintSlideWidth: "Slide width",
    settingsPrintSlideWidthDesc: "Presentation/PDF width. Sidepanel previews use this aspect ratio.",
    settingsPrintSlideHeight: "Slide height",
    settingsPrintSlideHeightDesc: "Presentation/PDF height. Sidepanel previews use this aspect ratio.",
    settingsMaxZoom: "Maximum zoom",
    settingsMaxZoomDesc: "Maximum zoom level",
    settingsSave: "Save",
    settingsResetDefaults: "Reset defaults",
    settingsCancel: "Cancel",
    settingsSaved: "Slideshow settings saved.",
    settingsSaveFailed: "Could not save slideshow settings.",
    quickGuideTitle: "Slideshow quick guide",
    quickGuideButton: "Open slideshow quick guide",
    quickGuideShortcutsTitle: "Script button shortcuts",
    quickGuideClick: "Click \u2014 start the slideshow in fullscreen mode.",
    quickGuideWindowed: "Option/Alt+click \u2014 start the slideshow in a window.",
    quickGuideEditor: "Command/Ctrl+click \u2014 open the slideshow editor sidepanel.",
    quickGuideResumeFullscreen: "Shift+click \u2014 continue the slideshow in fullscreen mode.",
    quickGuideResumeWindowed: "Shift+Option/Alt+click \u2014 continue the slideshow in a window.",
    quickGuideAuthoringTitle: "Building a slideshow",
    quickGuideFrameSlides: "Frame slides use the drawing's frames. Reorder slides, exclude frames, and edit slide content from the sorter.",
    quickGuideLineSlides: "Line slides follow consecutive point pairs on a configured presentation line, which is useful for free-form camera paths.",
    quickGuideMarkerFrames: "Marker frames are ideal slideshow markers: they define a slide without changing the visual grouping of the drawing.",
    quickGuideAnimations: "Frame slides can reveal elements or groups in a sequence using appear, fade, slide-in, zoom-in, and timed animation steps.",
    quickGuideNotes: "Add presenter notes per slide. With a second display, presenter mode shows notes and the next slide separately from the audience view.",
    startPresentation: "Start presentation",
    startFromBeginning: "From beginning",
    presentationStartOptions: "Presentation start options",
    presentationSettings: "Presentation settings",
    startWithPresenterView: "With presenter notes",
    startFromCurrentSlide: "Current slide",
    startFullscreen: "Start fullscreen",
    startCurrentWindow: "Start in current window",
    startMode: "Start position",
    startModeStart: "Start",
    startModeResume: "Resume",
    startModeCurrent: "Current",
    windowMode: "Presentation window",
    windowModeFullscreen: "Fullscreen",
    windowModeWindowed: "Windowed",
    notesMode: "Presenter mode",
    notesModeWithNotes: "With Notes",
    notesModeSlidesOnly: "Slides only",
    presentationDisplay: "Presentation display",
    presenterDisplay: "Notes display",
    primaryDisplay: "Primary",
    displayLabel: "Display {number}",
    continuePresentation: "Resume presentation",
    startFromSelectedSlide: "Start presentation from selected slide",
    selectedSlideNotPresentable: "The selected slide is excluded from this presentation.",
    noSlides: "No slideshow is available in this drawing.",
    noActiveDrawing: "Focus an Excalidraw drawing to edit its slideshow.",
    noEligibleSlides: "No eligible slides selected.",
    frameDeck: "Frame slideshow",
    lineDeck: "Line slideshow",
    linePresentationDefaultName: "Line presentation",
    createLinePresentation: "Create a presentation from the selected line",
    linePresentationSettings: "Line presentation settings",
    linePresentationName: "Presentation name",
    removeLinePresentation: "Remove presentation",
    removeLinePresentationConfirm: "Remove slideshow metadata from this line? The line and its drawing content will remain unchanged.",
    presentationType: "Presentation type",
    presentationTypeHint: "Choose whether this drawing presents its frames or presentation path.",
    slideCount: "{count} slides",
    visibleSlideCount: "{visible} of {total} included",
    dragSlide: "Drag to reorder slide",
    moveSlideUp: "Move slide up",
    moveSlideDown: "Move slide down",
    includeSlide: "Include slide in presentation",
    excludeSlide: "Exclude slide from presentation",
    notesPresent: "Notes",
    animationCount: "{count} anims",
    editAnimations: "Edit animations",
    animationCheckpoint3: "Animation editing is available for frame slides.",
    animationEditorTitle: "Animations \u2014 {title}",
    closeAnimationEditor: "Close animation editor",
    animationSelectionHint: "Select elements or groups in the drawing, then configure and add them as a build step.",
    animationOutsideFrameIgnored: "Ignored {count} selected item(s) outside this frame.",
    animationTargets: "Targets",
    animationNoTargets: "Select elements or groups in this frame.",
    animationGroupTarget: "Group {id}",
    animationElementTarget: "{type} {id}",
    removeAnimationTarget: "Remove target",
    animationEffect: "Effect",
    animationEffectAppear: "Appear",
    animationEffectFade: "Fade",
    animationEffectSlide: "Slide in",
    animationEffectZoom: "Zoom in",
    animationTrigger: "Trigger",
    animationTriggerAdvance: "On advance",
    animationTriggerDelay: "After delay",
    animationDelayMs: "Delay (ms)",
    animationDurationMs: "Duration (ms)",
    animationDirection: "Direction",
    animationDirectionLeft: "From left",
    animationDirectionRight: "From right",
    animationDirectionUp: "From top",
    animationDirectionDown: "From bottom",
    addAnimationStep: "Add step",
    updateAnimationStep: "Update step",
    newAnimationStep: "New step",
    previewAnimation: "Preview",
    animationSequence: "Animation sequence ({count})",
    animationNoSteps: "No animation steps yet.",
    animationStepSummary: "{number}. {effect} \xB7 {targets} target(s)",
    moveAnimationStepUp: "Move animation step up",
    moveAnimationStepDown: "Move animation step down",
    previewAnimationStep: "Preview animation step",
    deleteAnimationStep: "Delete animation step",
    animationSaveFailed: "Could not save animation metadata.",
    notesHeading: "Presenter notes",
    showPresenterNotes: "Show presenter notes",
    hidePresenterNotes: "Hide presenter notes",
    notesPlaceholder: "Add presenter notes for this slide\u2026",
    notesHint: "Notes support Markdown and are saved automatically.",
    lineReorderBound: "This presentation path is an arrow. The arrow has a bound start or end. Slides reordering is disabled until you unbind both endpoints.",
    lineAnimationUnsupported: "Element animation currently requires frame-based slides because frames provide stable slide membership.",
    showPresentationPath: "Show presentation path",
    hidePresentationPath: "Hide presentation path",
    editLineSlide: "Edit this line slide",
    editLineSlideFailed: "Could not open this line slide for editing.",
    reorderFailed: "Could not reorder the slide.",
    metadataSaveFailed: "Could not save slideshow metadata.",
    zoomSlide: "Zoom editor to this slide",
    slideLabel: "Slide {number}",
    slideNumberAndTitle: "{number}. {title}",
    presentationSlideTitle: "{title} ({number}/{total})",
    openSlideshowPanel: "Open slideshow panel",
    editSlideshow: "Edit slideshow",
    openPanelEndsPresentation: "End presentation and open slideshow panel",
    switchToFrameSlideshow: "Switch to frame slideshow",
    switchToLineSlideshow: "Switch to line slideshow",
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    navigateToSlide: "Navigate to slide",
    toggleLaser: "Toggle laser pointer and panning mode",
    refocusSlide: "Re-focus current slide (shortcut: HOME)",
    toggleFullscreen: "Toggle fullscreen (shortcut: F)",
    pathVisibility: "Arrow visibility. ON: hidden after presentation, OFF: visible after presentation",
    keepPresentationPathVisible: "Keep presentation path visible after presentation",
    keepPresentationPathHidden: "Keep presentation path hidden after presentation",
    editSlide: "Edit slide",
    printPdf: "Print to PDF\nClick to print slides at {width}x{height}\nHold SHIFT to print the presentation as displayed",
    endPresentation: "End presentation",
    pathWillRemainHidden: "The presentation path will remain hidden after the presentation. Next time, start the slideshow without selecting the line.",
    invalidSlide: "The slideshow presentation path does not contain a valid slide.",
    generatingImage: "Generating image. This can take longer depending on drawing size and device speed.",
    generatingSlide: "Generating slide {number}",
    creatingPdf: "Creating PDF document",
    presenterViewTitle: "Presenter view",
    presenterView: "Open presenter view",
    presenterViewDesktopOnly: "Presenter view is available on desktop only.",
    presenterViewOpenFailed: "Could not open presenter view.",
    presenterCurrentSlide: "Current slide",
    presenterSlideCounter: "Slide {number} of {total}",
    presenterNextSlide: "Next slide",
    presenterNextBuild: "Next animation",
    presenterNotes: "Presenter notes",
    presenterNoNotes: "No presenter notes for this slide.",
    presenterAnimationProgress: "Build {completed} of {total}",
    presenterNoAnimations: "No animation builds",
    presenterEnd: "End of presentation",
    presenterClose: "Close presenter view",
    presenterNotesFocusLayout: "Prioritize presenter notes",
    presenterStandardLayout: "Use standard presenter layout"
  };

  // src/scripts/slideshow/lang/es.ts
  var es = {
    requiresNewerVersion: "Este script requiere una versi\xF3n m\xE1s reciente de Excalidraw. Instala la \xFAltima versi\xF3n.",
    noActiveView: "Abre un dibujo de Excalidraw antes de iniciar la presentaci\xF3n.",
    cannotAccessView: "No se pudo acceder a la vista activa de Excalidraw."
  };

  // src/scripts/slideshow/lang/fr.ts
  var fr = {
    requiresNewerVersion: "Ce script n\xE9cessite une version plus r\xE9cente d\u2019Excalidraw. Installez la derni\xE8re version.",
    noActiveView: "Ouvrez un dessin Excalidraw avant de d\xE9marrer le diaporama.",
    cannotAccessView: "Impossible d\u2019acc\xE9der \xE0 la vue Excalidraw active."
  };

  // src/scripts/slideshow/lang/ru.ts
  var ru = {
    requiresNewerVersion: "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0431\u043E\u043B\u0435\u0435 \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F Excalidraw. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0432\u0435\u0440\u0441\u0438\u044E.",
    noActiveView: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0438\u0441\u0443\u043D\u043E\u043A Excalidraw \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C \u043F\u0440\u0435\u0437\u0435\u043D\u0442\u0430\u0446\u0438\u0438.",
    cannotAccessView: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u043C\u0443 \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044E Excalidraw."
  };

  // src/scripts/slideshow/lang/zh-cn.ts
  var zhCn = {
    requiresNewerVersion: "\u6B64\u811A\u672C\u9700\u8981\u8F83\u65B0\u7248\u672C\u7684 Excalidraw\u3002\u8BF7\u5B89\u88C5\u6700\u65B0\u7248\u672C\u3002",
    noActiveView: "\u8BF7\u5148\u6253\u5F00 Excalidraw \u7ED8\u56FE\uFF0C\u518D\u5F00\u59CB\u5E7B\u706F\u7247\u653E\u6620\u3002",
    cannotAccessView: "\u65E0\u6CD5\u8BBF\u95EE\u5F53\u524D\u7684 Excalidraw \u89C6\u56FE\u3002"
  };

  // src/scripts/slideshow/lang/index.ts
  var CATALOGS = { en, de, es, fr, ru, "zh-cn": zhCn };
  function createSlideshowTranslator(locale) {
    return createTranslator(locale, CATALOGS);
  }

  // src/scripts/slideshow/desktopDisplays.ts
  var DEVICE_KEY_STORAGE = "excalidraw-slideshow-device-key";
  function getRemote(win) {
    const rendererWindow = win;
    try {
      const contextRemote = rendererWindow.require?.("@electron/remote");
      if (contextRemote?.getCurrentWindow) return contextRemote;
    } catch {
    }
    return rendererWindow.electron?.remote ?? null;
  }
  function geometryForWindow(win) {
    return {
      screenX: Number.isFinite(win.screenX) ? win.screenX : 0,
      screenY: Number.isFinite(win.screenY) ? win.screenY : 0,
      outerWidth: Number.isFinite(win.outerWidth) ? Math.max(win.outerWidth, 1) : 1,
      outerHeight: Number.isFinite(win.outerHeight) ? Math.max(win.outerHeight, 1) : 1
    };
  }
  function geometryScore(candidate, geometry) {
    const bounds = candidate.getBounds();
    return Math.abs(bounds.x - geometry.screenX) * 2 + Math.abs(bounds.y - geometry.screenY) * 2 + Math.abs(bounds.width - geometry.outerWidth) + Math.abs(bounds.height - geometry.outerHeight);
  }
  function chooseClosestNativeWindow(windows, geometry) {
    if (windows.length === 0) return null;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of windows) {
      const score = geometryScore(candidate, geometry);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }
  function getNativeWindow(win) {
    const remote = getRemote(win);
    if (!remote) return null;
    try {
      const current = remote.getCurrentWindow();
      const candidates = remote.BrowserWindow?.getAllWindows?.() ?? [];
      if (candidates.length === 0) return current;
      const geometry = geometryForWindow(win);
      const closest = chooseClosestNativeWindow(candidates, geometry);
      if (!closest) return current;
      const currentScore = geometryScore(current, geometry);
      const closestScore = geometryScore(closest, geometry);
      return closestScore + 80 < currentScore ? closest : current;
    } catch {
      try {
        return remote.getCurrentWindow();
      } catch {
        return null;
      }
    }
  }
  function getNativeWindowId(window2) {
    const propertyId = window2.id;
    if (typeof propertyId === "number" && Number.isFinite(propertyId)) return propertyId;
    const legacyId = window2.getId?.();
    return typeof legacyId === "number" && Number.isFinite(legacyId) ? legacyId : null;
  }
  function getNativeWindowById(remote, id) {
    if (id === null) return null;
    try {
      const direct = remote.BrowserWindow?.fromId?.(id);
      if (direct) return direct;
      return remote.BrowserWindow?.getAllWindows?.().find(
        (candidate) => getNativeWindowId(candidate) === id
      ) ?? null;
    } catch {
      return null;
    }
  }
  function captureWindowPlacement(win) {
    try {
      const remote = getRemote(win);
      const screen = remote?.screen;
      if (!remote || !screen) {
        return null;
      }
      const nativeWindow = getNativeWindow(win);
      if (!nativeWindow) {
        return null;
      }
      const bounds = nativeWindow.getBounds();
      const snapshot = {
        windowId: getNativeWindowId(nativeWindow),
        sourceDisplayId: screen.getDisplayMatching(bounds).id,
        bounds: { ...bounds },
        maximized: nativeWindow.isMaximized?.() ?? false
      };
      return snapshot;
    } catch {
      return null;
    }
  }
  function nativeWindowIdentity(window2) {
    const id = getNativeWindowId(window2);
    if (id !== null) return `id:${id}`;
    const bounds = window2.getBounds();
    return `title:${window2.getTitle?.() ?? ""}|${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
  }
  function resolveSameNativeWindow(host, candidate) {
    const hostNative = getNativeWindow(host);
    const candidateNative = getNativeWindow(candidate);
    if (!hostNative || !candidateNative) return null;
    if (hostNative === candidateNative) return true;
    const hostId = getNativeWindowId(hostNative);
    const candidateId = getNativeWindowId(candidateNative);
    if (hostId !== null && candidateId !== null) return hostId === candidateId;
    return nativeWindowIdentity(hostNative) === nativeWindowIdentity(candidateNative);
  }
  function toDisplay(display, primaryId, index) {
    const workArea = display.workArea ?? display.bounds;
    const label = display.label?.trim() ?? "";
    return {
      id: display.id,
      label,
      index,
      bounds: { ...display.bounds },
      workArea: { ...workArea },
      primary: display.id === primaryId
    };
  }
  function getSlideshowDeviceKey(win) {
    try {
      const existing = win.localStorage?.getItem(DEVICE_KEY_STORAGE)?.trim();
      if (existing) return existing;
      const generated = typeof win.crypto?.randomUUID === "function" ? win.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      win.localStorage?.setItem(DEVICE_KEY_STORAGE, generated);
      return generated;
    } catch {
      const nav = win.navigator;
      return `fallback-${nav.platform || "desktop"}-${nav.userAgent.length}`;
    }
  }
  function getSlideshowDisplayIdentity(display) {
    const label = display.label.trim().toLowerCase();
    return JSON.stringify([
      label,
      display.bounds.width,
      display.bounds.height,
      display.primary
    ]);
  }
  function getSlideshowDisplayConfigurationKey(displays) {
    if (displays.length === 0) return "none";
    return JSON.stringify(displays.map(getSlideshowDisplayIdentity).sort());
  }
  function resolveSlideshowDisplayTarget(displays, preferredId, preferredIdentity) {
    if (preferredId !== null && displays.some((display) => display.id === preferredId)) {
      return preferredId;
    }
    if (!preferredIdentity) return null;
    return displays.find((display) => getSlideshowDisplayIdentity(display) === preferredIdentity)?.id ?? null;
  }
  function getAvailableDisplays(win) {
    try {
      const screen = getRemote(win)?.screen;
      if (!screen) return [];
      const primaryId = screen.getPrimaryDisplay().id;
      return screen.getAllDisplays().map((display, index) => toDisplay(display, primaryId, index));
    } catch {
      return [];
    }
  }
  function onDisplayConfigurationChanged(win, callback) {
    const screen = getRemote(win)?.screen;
    if (!screen?.on) return () => void 0;
    const events = ["display-added", "display-removed", "display-metrics-changed"];
    const listener = () => callback();
    try {
      for (const event of events) screen.on(event, listener);
    } catch {
      return () => void 0;
    }
    return () => {
      for (const event of events) {
        try {
          if (screen.off) screen.off(event, listener);
          else screen.removeListener?.(event, listener);
        } catch {
        }
      }
    };
  }
  function getCurrentDisplayId(win) {
    try {
      const remote = getRemote(win);
      const screen = remote?.screen;
      if (!remote || !screen) return null;
      const nativeWindow = getNativeWindow(win);
      return nativeWindow ? screen.getDisplayMatching(nativeWindow.getBounds()).id : null;
    } catch {
      return null;
    }
  }
  function chooseDefaultDisplayTargets(displays, currentDisplayId) {
    if (displays.length === 0) {
      return { presentationDisplayId: null, presenterDisplayId: null };
    }
    const presentation = displays.find((display) => display.id === currentDisplayId) ?? displays.find((display) => display.primary) ?? displays[0];
    const presenter = displays.find((display) => display.id !== presentation?.id) ?? presentation;
    return {
      presentationDisplayId: presentation?.id ?? null,
      presenterDisplayId: presenter?.id ?? null
    };
  }
  async function waitForWindowOnDisplay(win, displayId, timeoutMs = 2e3) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (getCurrentDisplayId(win) === displayId) {
        return true;
      }
      await new Promise((resolve) => win.setTimeout(resolve, 75));
    }
    return false;
  }
  function moveWindowToDisplay(win, displayId, fillWorkArea = true, moveIfAlreadyOnDisplay = true) {
    if (displayId === null || displayId === void 0) return null;
    try {
      const remote = getRemote(win);
      const screen = remote?.screen;
      if (!remote || !screen) {
        return null;
      }
      const target = screen.getAllDisplays().find((display) => display.id === displayId);
      if (!target) {
        return null;
      }
      const nativeWindow = getNativeWindow(win);
      if (!nativeWindow) {
        return null;
      }
      const currentBounds = nativeWindow.getBounds();
      const currentDisplay = screen.getDisplayMatching(currentBounds);
      const windowId = getNativeWindowId(nativeWindow);
      if (currentDisplay.id === displayId && !moveIfAlreadyOnDisplay) {
        return null;
      }
      const snapshot = {
        windowId,
        sourceDisplayId: currentDisplay.id,
        bounds: { ...currentBounds },
        maximized: nativeWindow.isMaximized?.() ?? false
      };
      if (snapshot.maximized) nativeWindow.unmaximize?.();
      const area = target.workArea ?? target.bounds;
      const requestedBounds = fillWorkArea ? { ...area } : {
        x: area.x + Math.round(area.width * 0.08),
        y: area.y + Math.round(area.height * 0.08),
        width: Math.max(Math.round(area.width * 0.84), 480),
        height: Math.max(Math.round(area.height * 0.84), 360)
      };
      nativeWindow.setBounds(requestedBounds, false);
      const actual = nativeWindow.getBounds();
      return snapshot;
    } catch {
      return null;
    }
  }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  function safeRestoreBounds(snapshot, displays, primary) {
    if (displays.some((display) => rectsOverlap(snapshot.bounds, display.bounds))) {
      return { ...snapshot.bounds };
    }
    const source = displays.find((display) => display.id === snapshot.sourceDisplayId) ?? primary;
    const area = source.workArea ?? source.bounds;
    const width = Math.min(Math.max(snapshot.bounds.width, 480), area.width);
    const height = Math.min(Math.max(snapshot.bounds.height, 360), area.height);
    return {
      x: area.x + Math.max(0, Math.round((area.width - width) / 2)),
      y: area.y + Math.max(0, Math.round((area.height - height) / 2)),
      width,
      height
    };
  }
  function resolveCapturedNativeWindow(win, snapshot) {
    const remote = getRemote(win);
    const screen = remote?.screen;
    if (!remote || !screen) return null;
    const nativeWindow = getNativeWindowById(remote, snapshot.windowId) ?? (snapshot.windowId === null ? getNativeWindow(win) : null);
    return nativeWindow ? { remote, screen, nativeWindow } : null;
  }
  function applyRestorePlacement(screen, nativeWindow, snapshot) {
    const requested = safeRestoreBounds(
      snapshot,
      screen.getAllDisplays(),
      screen.getPrimaryDisplay()
    );
    if (nativeWindow.isMaximized?.()) nativeWindow.unmaximize?.();
    nativeWindow.setBounds(requested, false);
    if (snapshot.maximized) nativeWindow.maximize?.();
    return requested;
  }
  function placementNeedsRepair(screen, nativeWindow, snapshot) {
    const bounds = nativeWindow.getBounds();
    const displays = screen.getAllDisplays();
    const visible = displays.some((display) => rectsOverlap(bounds, display.bounds));
    if (!visible) return true;
    if (snapshot.sourceDisplayId === null) return false;
    return screen.getDisplayMatching(bounds).id !== snapshot.sourceDisplayId;
  }
  function restoreWindowPlacement(win, snapshot) {
    if (!snapshot) return;
    try {
      const resolved = resolveCapturedNativeWindow(win, snapshot);
      if (!resolved) {
        return;
      }
      const { screen, nativeWindow } = resolved;
      applyRestorePlacement(screen, nativeWindow, snapshot);
    } catch {
    }
  }
  async function restoreWindowPlacementStable(win, snapshot, timeoutMs = 2400, monitorMs = 900) {
    if (!snapshot) return;
    const resolved = resolveCapturedNativeWindow(win, snapshot);
    if (!resolved) {
      return;
    }
    const { screen, nativeWindow } = resolved;
    const started = Date.now();
    while (nativeWindow.isFullScreen?.() && Date.now() - started < timeoutMs) {
      await new Promise((resolve) => win.setTimeout(resolve, 75));
    }
    restoreWindowPlacement(win, snapshot);
    const monitorStarted = Date.now();
    while (Date.now() - monitorStarted < monitorMs) {
      await new Promise((resolve) => win.setTimeout(resolve, 125));
      if (nativeWindow.isFullScreen?.()) continue;
      if (!placementNeedsRepair(screen, nativeWindow, snapshot)) continue;
      applyRestorePlacement(screen, nativeWindow, snapshot);
    }
  }

  // src/scripts/slideshow/icons.ts
  function iconMarkup(ea2, iconName) {
    return ea2.obsidian.getIcon(iconName)?.outerHTML ?? "";
  }
  function getSlideshowIcons(ea2) {
    return {
      finish: iconMarkup(ea2, "lucide-x"),
      rightArrow: iconMarkup(ea2, "lucide-arrow-right"),
      leftArrow: iconMarkup(ea2, "lucide-arrow-left"),
      edit: iconMarkup(ea2, "lucide-pencil"),
      maximize: iconMarkup(ea2, "lucide-maximize"),
      minimize: iconMarkup(ea2, "lucide-minimize"),
      currentWindow: iconMarkup(ea2, "lucide-app-window"),
      laserOn: iconMarkup(ea2, "lucide-hand"),
      laserOff: iconMarkup(ea2, "lucide-wand"),
      printer: iconMarkup(ea2, "lucide-printer"),
      refocus: iconMarkup(ea2, "lucide-scan-eye"),
      gripVertical: iconMarkup(ea2, "lucide-grip-vertical"),
      chevronUp: iconMarkup(ea2, "lucide-chevron-up"),
      chevronDown: iconMarkup(ea2, "lucide-chevron-down"),
      eye: iconMarkup(ea2, "lucide-eye"),
      eyeOff: iconMarkup(ea2, "lucide-eye-off"),
      sparkles: iconMarkup(ea2, "lucide-sparkles"),
      notebookPen: iconMarkup(ea2, "lucide-notebook-pen"),
      play: iconMarkup(ea2, "lucide-play"),
      continuePresentation: iconMarkup(ea2, "lucide-circle-play"),
      presentation: iconMarkup(ea2, "lucide-presentation"),
      plus: iconMarkup(ea2, "lucide-plus"),
      trash: iconMarkup(ea2, "lucide-trash-2"),
      close: iconMarkup(ea2, "lucide-x"),
      settings: iconMarkup(ea2, "lucide-settings"),
      info: iconMarkup(ea2, "info"),
      frameSlideshow: iconMarkup(ea2, "lucide-frame"),
      lineSlideshow: iconMarkup(ea2, "lucide-route"),
      moreHorizontal: iconMarkup(ea2, "lucide-ellipsis")
    };
  }

  // src/sharedUtils/presentationGeometry.ts
  function getPresentationFrameName(name, index) {
    return name ?? `Frame ${(index + 1).toString().padStart(2, "0")}`;
  }
  function getNavigationRect(slide, dimensions, maxZoom) {
    const { x1, y1, x2, y2 } = slide;
    const { width, height } = dimensions;
    const ratioX = width / Math.abs(x1 - x2);
    const ratioY = height / Math.abs(y1 - y2);
    let ratio = Math.min(Math.max(ratioX, ratioY), maxZoom);
    const scaledWidth = Math.abs(x1 - x2) * ratio;
    const scaledHeight = Math.abs(y1 - y2) * ratio;
    if (scaledWidth > width || scaledHeight > height) {
      ratio = Math.min(width / Math.abs(x1 - x2), height / Math.abs(y1 - y2));
    }
    const deltaX = (width / ratio - Math.abs(x1 - x2)) / 2;
    const deltaY = (height / ratio - Math.abs(y1 - y2)) / 2;
    return {
      left: Math.min(x1, x2) - deltaX,
      top: Math.min(y1, y2) - deltaY,
      right: Math.max(x1, x2) + deltaX,
      bottom: Math.max(y1, y2) + deltaY,
      nextZoom: ratio
    };
  }

  // src/scripts/slideshow/slideshowMetadata.ts
  var FRAME_SCHEMA_VERSION = 2;
  var LINE_SCHEMA_VERSION = 2;
  var animationEffects = /* @__PURE__ */ new Set(["appear", "fade", "slide", "zoom"]);
  var animationTriggers = /* @__PURE__ */ new Set(["advance", "after-delay"]);
  var animationDirections = /* @__PURE__ */ new Set(["left", "right", "up", "down"]);
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }
  function isOptionalNonNegativeNumber(value) {
    return value === void 0 || typeof value === "number" && Number.isFinite(value) && value >= 0;
  }
  function normalizeNotes(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      return void 0;
    }
    return value;
  }
  function readOriginalPathProperties(value) {
    if (!isRecord(value)) {
      return null;
    }
    if (typeof value.strokeColor !== "string" || typeof value.backgroundColor !== "string" || typeof value.locked !== "boolean") {
      return null;
    }
    return {
      strokeColor: value.strokeColor,
      backgroundColor: value.backgroundColor,
      locked: value.locked
    };
  }
  function readAnimationTarget(value) {
    if (!isRecord(value) || !isNonEmptyString(value.id)) {
      return null;
    }
    if (value.type === "element" || value.type === "group") {
      return { type: value.type, id: value.id };
    }
    return null;
  }
  function readAnimationStep(value) {
    if (!isRecord(value) || !isNonEmptyString(value.id) || !Array.isArray(value.targets)) {
      return null;
    }
    if (!animationEffects.has(value.effect)) {
      return null;
    }
    if (!animationTriggers.has(value.trigger)) {
      return null;
    }
    if (!isOptionalNonNegativeNumber(value.delayMs) || !isOptionalNonNegativeNumber(value.durationMs)) {
      return null;
    }
    if (value.direction !== void 0 && !animationDirections.has(value.direction)) {
      return null;
    }
    const targets = value.targets.map(readAnimationTarget);
    if (targets.length === 0 || targets.some((target) => target === null)) {
      return null;
    }
    const result = {
      id: value.id,
      targets,
      effect: value.effect,
      trigger: value.trigger
    };
    if (value.delayMs !== void 0) result.delayMs = value.delayMs;
    if (value.durationMs !== void 0) result.durationMs = value.durationMs;
    if (value.direction !== void 0) result.direction = value.direction;
    return result;
  }
  function readAnimation(value) {
    if (value === void 0) {
      return void 0;
    }
    if (!isRecord(value) || !Array.isArray(value.steps)) {
      return null;
    }
    const steps = value.steps.map(readAnimationStep);
    if (steps.some((step) => step === null)) {
      return null;
    }
    return { steps };
  }
  function getRawSlideshowMetadata(customData) {
    return isRecord(customData) ? customData.slideshow : void 0;
  }
  function hasFrameSlideshowDeclaration(customData) {
    const value = getRawSlideshowMetadata(customData);
    if (!isRecord(value) || value.schemaVersion !== FRAME_SCHEMA_VERSION || value.kind !== "frame") {
      return false;
    }
    if (value.order !== void 0) return readFrameSlideshowData(customData) !== null;
    return Object.keys(value).every((key) => key === "schemaVersion" || key === "kind");
  }
  function readFrameSlideshowData(customData) {
    const value = getRawSlideshowMetadata(customData);
    if (!isRecord(value) || value.schemaVersion !== FRAME_SCHEMA_VERSION || value.kind !== "frame") {
      return null;
    }
    if (typeof value.order !== "number" || !Number.isInteger(value.order) || value.order < 0) {
      return null;
    }
    if (value.excluded !== void 0 && typeof value.excluded !== "boolean") {
      return null;
    }
    if (value.notes !== void 0 && typeof value.notes !== "string") {
      return null;
    }
    const animation = readAnimation(value.animation);
    if (animation === null) {
      return null;
    }
    const result = {
      schemaVersion: FRAME_SCHEMA_VERSION,
      kind: "frame",
      order: value.order
    };
    if (value.excluded !== void 0) result.excluded = value.excluded;
    const notes = normalizeNotes(value.notes);
    if (notes !== void 0) result.notes = notes;
    if (animation !== void 0) result.animation = animation;
    return result;
  }
  function readLegacyLineSlideshowData(customData) {
    const value = getRawSlideshowMetadata(customData);
    if (!isRecord(value) || value.schemaVersion !== void 0 || value.kind !== void 0) {
      return null;
    }
    const originalProps = readOriginalPathProperties(value.originalProps);
    if (typeof value.hidden !== "boolean" || !originalProps) {
      return null;
    }
    return { hidden: value.hidden, originalProps };
  }
  function readLineSlideRecord(value) {
    if (!isRecord(value) || !isNonEmptyString(value.id)) {
      return null;
    }
    if (value.notes !== void 0 && typeof value.notes !== "string") {
      return null;
    }
    if (value.excluded !== void 0 && typeof value.excluded !== "boolean") {
      return null;
    }
    const result = { id: value.id };
    const notes = normalizeNotes(value.notes);
    if (notes !== void 0) result.notes = notes;
    if (value.excluded !== void 0) result.excluded = value.excluded;
    return result;
  }
  function readLineSlideshowDataV2(customData) {
    const value = getRawSlideshowMetadata(customData);
    if (!isRecord(value) || value.schemaVersion !== LINE_SCHEMA_VERSION || value.kind !== "path") {
      return null;
    }
    const originalProps = readOriginalPathProperties(value.originalProps);
    if (typeof value.hidden !== "boolean" || !originalProps || !Array.isArray(value.slides) || value.name !== void 0 && typeof value.name !== "string") {
      return null;
    }
    const slides = value.slides.map(readLineSlideRecord);
    if (slides.some((slide) => slide === null)) {
      return null;
    }
    const result = {
      schemaVersion: LINE_SCHEMA_VERSION,
      kind: "path",
      hidden: value.hidden,
      originalProps,
      slides
    };
    const name = normalizeNotes(value.name);
    if (name !== void 0) result.name = name;
    return result;
  }
  function makeGeneratedLineSlideId(pathId, index, usedIds) {
    const base = `slideshow-${pathId}-${index + 1}`;
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
  function reconcileLineSlideRecords(records, pairCount, pathId) {
    const count = Math.max(0, Math.floor(pairCount));
    const result = [];
    const usedIds = /* @__PURE__ */ new Set();
    for (let index = 0; index < count; index += 1) {
      const existing = records[index];
      const id = existing && isNonEmptyString(existing.id) && !usedIds.has(existing.id) ? existing.id : makeGeneratedLineSlideId(pathId, index, usedIds);
      usedIds.add(id);
      const record = { id };
      const notes = normalizeNotes(existing?.notes);
      if (notes !== void 0) record.notes = notes;
      if (existing?.excluded === true) record.excluded = true;
      result.push(record);
    }
    return result;
  }
  function reorderLineSlideRecords(records, pairCount, pathId, fromPairIndex, toPairIndex) {
    const reconciled = reconcileLineSlideRecords(records, pairCount, pathId);
    if (!Number.isInteger(fromPairIndex) || !Number.isInteger(toPairIndex) || fromPairIndex < 0 || toPairIndex < 0 || fromPairIndex >= reconciled.length || toPairIndex >= reconciled.length) {
      throw new RangeError("Line-slide metadata index is outside the presentation path.");
    }
    const [record] = reconciled.splice(fromPairIndex, 1);
    if (!record) {
      throw new RangeError("The source line-slide metadata record does not exist.");
    }
    reconciled.splice(toPairIndex, 0, record);
    return reconciled;
  }
  function readLineSlideshowData(customData, pathId, pairCount) {
    const v2 = readLineSlideshowDataV2(customData);
    if (v2) {
      return {
        source: "v2",
        data: { ...v2, slides: reconcileLineSlideRecords(v2.slides, pairCount, pathId) }
      };
    }
    const legacy = readLegacyLineSlideshowData(customData);
    if (!legacy) {
      return null;
    }
    return {
      source: "legacy",
      data: {
        schemaVersion: LINE_SCHEMA_VERSION,
        kind: "path",
        hidden: legacy.hidden,
        originalProps: legacy.originalProps,
        slides: reconcileLineSlideRecords([], pairCount, pathId)
      }
    };
  }
  function upgradeLineSlideshowData(customData, pathId, pairCount, fallbackOriginalProps) {
    const existing = readLineSlideshowData(customData, pathId, pairCount);
    if (existing) {
      return existing.data;
    }
    return {
      schemaVersion: LINE_SCHEMA_VERSION,
      kind: "path",
      hidden: false,
      originalProps: fallbackOriginalProps,
      slides: reconcileLineSlideRecords([], pairCount, pathId)
    };
  }
  function withNormalizedFrameOrder(customData, order) {
    const existing = readFrameSlideshowData(customData);
    const result = {
      schemaVersion: FRAME_SCHEMA_VERSION,
      kind: "frame",
      order
    };
    if (existing?.excluded !== void 0) result.excluded = existing.excluded;
    if (existing?.notes !== void 0) result.notes = existing.notes;
    if (existing?.animation !== void 0) result.animation = existing.animation;
    return result;
  }
  function writeSlideshowMetadata(ea2, elementId, data) {
    return ea2.addAppendUpdateCustomData(elementId, { slideshow: data });
  }

  // src/scripts/slideshow/SlideDeck.ts
  function getVisibleSlideIndex(deck, slideId) {
    if (!slideId) return null;
    const index = deck.visibleSlides.findIndex((slide) => slide.id === slideId);
    return index >= 0 ? index : null;
  }
  function compareAlphabetically(left, right) {
    if (left.title === right.title) {
      return left.sourceIndex - right.sourceIndex;
    }
    return left.title > right.title ? 1 : -1;
  }
  function orderFrames(frames) {
    const explicit = frames.some((frame) => frame.metadata !== null);
    if (!explicit) {
      return { ordered: [...frames].sort(compareAlphabetically), explicit: false };
    }
    const withOrder = frames.filter((frame) => frame.metadata !== null);
    const withoutOrder = frames.filter((frame) => frame.metadata === null).sort(compareAlphabetically);
    withOrder.sort((left, right) => {
      const orderDelta = (left.metadata?.order ?? 0) - (right.metadata?.order ?? 0);
      return orderDelta !== 0 ? orderDelta : left.sourceIndex - right.sourceIndex;
    });
    return { ordered: withOrder.concat(withoutOrder), explicit: true };
  }
  function toIndexedFrames(frames) {
    return frames.map((source, sourceIndex) => ({
      source,
      sourceIndex,
      title: getPresentationFrameName(source.name, sourceIndex),
      metadata: readFrameSlideshowData(source.customData)
    }));
  }
  function buildFrameSlideDeck(frames) {
    const { ordered, explicit } = orderFrames(toIndexedFrames(frames));
    const slides = ordered.map((frame, index) => {
      const { source, metadata } = frame;
      const slide = {
        id: source.id,
        kind: "frame",
        frameId: source.id,
        title: frame.title,
        rect: { x1: source.x, y1: source.y, x2: source.x + source.width, y2: source.y + source.height },
        excluded: metadata?.excluded ?? false,
        order: index,
        animationSteps: metadata?.animation?.steps ?? []
      };
      if (metadata?.notes !== void 0) slide.notes = metadata.notes;
      return slide;
    });
    return {
      kind: "frame",
      slides,
      visibleSlides: slides.filter((slide) => !slide.excluded),
      hasExplicitFrameOrder: explicit
    };
  }
  function buildLineSlideDeck(path) {
    const pairCount = Math.floor(path.points.length / 2);
    const metadata = readLineSlideshowData(path.customData, path.id, pairCount);
    const records = metadata?.data.slides ?? [];
    const slides = [];
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const pointA = path.points[pairIndex * 2];
      const pointB = path.points[pairIndex * 2 + 1];
      if (!pointA || !pointB) continue;
      const record = records[pairIndex];
      const slide = {
        id: record?.id ?? `slideshow-${path.id}-${pairIndex + 1}`,
        kind: "path",
        pathId: path.id,
        pairIndex,
        title: `Slide ${pairIndex + 1}`,
        rect: {
          x1: path.x + pointA[0],
          y1: path.y + pointA[1],
          x2: path.x + pointB[0],
          y2: path.y + pointB[1]
        },
        excluded: record?.excluded ?? false
      };
      if (record?.notes !== void 0) slide.notes = record.notes;
      slides.push(slide);
    }
    return {
      kind: "path",
      slides,
      visibleSlides: slides.filter((slide) => !slide.excluded),
      hasExplicitFrameOrder: false
    };
  }
  function movePair(pairs, fromPairIndex, toPairIndex) {
    const [pair] = pairs.splice(fromPairIndex, 1);
    if (!pair) throw new RangeError("The source line-slide pair does not exist.");
    pairs.splice(toPairIndex, 0, pair);
  }
  function reorderLinePointPairs(x, y, points, fromPairIndex, toPairIndex) {
    const pairCount = Math.floor(points.length / 2);
    if (!Number.isInteger(fromPairIndex) || !Number.isInteger(toPairIndex) || fromPairIndex < 0 || toPairIndex < 0 || fromPairIndex >= pairCount || toPairIndex >= pairCount) {
      throw new RangeError("Line-slide pair index is outside the presentation path.");
    }
    const absolute = points.map((point) => [x + point[0], y + point[1]]);
    const pairs = [];
    for (let index = 0; index < pairCount; index += 1) {
      const pointA = absolute[index * 2];
      const pointB = absolute[index * 2 + 1];
      if (pointA && pointB) pairs.push([pointA, pointB]);
    }
    movePair(pairs, fromPairIndex, toPairIndex);
    const reorderedAbsolute = pairs.flat();
    const trailingPoint = absolute[pairCount * 2];
    if (trailingPoint) reorderedAbsolute.push(trailingPoint);
    const origin = reorderedAbsolute[0];
    if (!origin) return { x, y, points: [] };
    return {
      x: origin[0],
      y: origin[1],
      points: reorderedAbsolute.map((point) => [point[0] - origin[0], point[1] - origin[1]])
    };
  }

  // src/scripts/slideshow/types.ts
  function isLinearPathElement(element) {
    return element?.type === "line" || element?.type === "arrow";
  }
  function isFrameElement(element) {
    return element?.type === "frame";
  }

  // src/scripts/slideshow/presentationPath.ts
  function getNamedFrames(elements) {
    return elements.filter(isFrameElement).map((frame, index) => ({
      ...frame,
      name: getPresentationFrameName(frame.name, index)
    }));
  }
  function resolveFrameDeck(frames) {
    if (frames.length === 0) return null;
    return { deck: buildFrameSlideDeck(frames), pathElement: null, frames };
  }
  function toLinePresentationSource(pathElement, frames) {
    const metadata = readLineSlideshowData(
      pathElement.customData,
      pathElement.id,
      Math.floor(pathElement.points.length / 2)
    );
    if (!metadata) return null;
    return {
      key: `line:${pathElement.id}`,
      pathId: pathElement.id,
      name: metadata.data.name?.trim() || null,
      resolved: {
        deck: buildLineSlideDeck(pathElement),
        pathElement,
        frames
      }
    };
  }
  function resolveLineSources(elements, frames) {
    const result = [];
    for (const element of elements) {
      if (!isLinearPathElement(element)) continue;
      const source = toLinePresentationSource(element, frames);
      if (source) result.push(source);
    }
    return result;
  }
  function isPresentationPathHidden(path) {
    return readLineSlideshowData(path.customData, path.id, Math.floor(path.points.length / 2))?.data.hidden ?? false;
  }
  function hasPresentationSource(choices, sourceKey) {
    if (!sourceKey) return false;
    if (sourceKey === "frame") return choices.frame !== null;
    return choices.lines.some((line) => line.key === sourceKey);
  }
  function resolvePresentationSource(choices, sourceKey) {
    if (!sourceKey) return null;
    if (sourceKey === "frame") return choices.frame;
    return choices.lines.find((line) => line.key === sourceKey)?.resolved ?? null;
  }
  function getPresentationSourceType(sourceKey) {
    return sourceKey === "frame" ? "frame" : "line";
  }
  function getLinePresentationSourceKey(element) {
    if (!isLinearPathElement(element)) return null;
    const metadata = readLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2)
    );
    return metadata ? `line:${element.id}` : null;
  }
  function resolveSlideDeckChoices(ea2) {
    const viewElements = ea2.getViewElements();
    const frames = getNamedFrames(viewElements);
    const frame = resolveFrameDeck(frames);
    const lines = resolveLineSources(viewElements, frames);
    const selectedSourceKey = getLinePresentationSourceKey(ea2.getViewSelectedElement());
    const defaultSourceKey = selectedSourceKey ? selectedSourceKey : frame ? "frame" : lines[0]?.key ?? null;
    const defaultType = defaultSourceKey ? getPresentationSourceType(defaultSourceKey) : null;
    return { frame, lines, line: lines[0]?.resolved ?? null, defaultSourceKey, defaultType };
  }
  function normalizeSourceKey(choices, requested) {
    if (requested === "frame") return choices.frame ? "frame" : null;
    if (requested === "line") return choices.lines[0]?.key ?? null;
    if (requested?.startsWith("line:")) {
      return hasPresentationSource(choices, requested) ? requested : null;
    }
    return choices.defaultSourceKey;
  }
  function resolvePresentationSetup(ea2, api, t, presentationSource) {
    const choices = resolveSlideDeckChoices(ea2);
    const sourceKey = normalizeSourceKey(choices, presentationSource);
    const resolved = resolvePresentationSource(choices, sourceKey);
    const frameRenderingOriginalState = api.getAppState().frameRendering;
    if (!resolved || !sourceKey) {
      api.setToast({
        message: t?.("noPresentationPath") ?? "Select a configured presentation in the Slideshow panel or add frames.",
        duration: 3e3,
        closable: true
      });
      return null;
    }
    if (resolved.deck.visibleSlides.length === 0) {
      api.setToast({
        message: t?.("allSlidesExcluded") ?? "All slides are excluded. Include at least one slide before presenting.",
        duration: 4e3,
        closable: true
      });
      return null;
    }
    if (!resolved.pathElement) {
      if (frameRenderingOriginalState.enabled) {
        api.updateScene({
          appState: {
            frameRendering: { ...frameRenderingOriginalState, enabled: false }
          }
        });
      }
      return {
        ...resolved,
        sourceKey,
        pathType: "frame",
        slides: resolved.deck.visibleSlides.map((slide) => slide.rect),
        slideTitles: resolved.deck.visibleSlides.map((slide) => slide.title),
        shouldHidePathAfterPresentation: true,
        isHidden: false,
        originalPathProperties: null,
        frameRenderingOriginalState
      };
    }
    const pathElement = resolved.pathElement;
    const metadata = readLineSlideshowData(
      pathElement.customData,
      pathElement.id,
      Math.floor(pathElement.points.length / 2)
    );
    if (!metadata) return null;
    const originalPathProperties = metadata.data.hidden ? metadata.data.originalProps : {
      strokeColor: pathElement.strokeColor,
      backgroundColor: pathElement.backgroundColor,
      locked: pathElement.locked
    };
    return {
      ...resolved,
      sourceKey,
      pathType: "line",
      slides: resolved.deck.visibleSlides.map((slide) => slide.rect),
      slideTitles: resolved.deck.visibleSlides.map((slide) => slide.title),
      shouldHidePathAfterPresentation: true,
      isHidden: metadata.data.hidden,
      originalPathProperties,
      frameRenderingOriginalState
    };
  }

  // src/sharedUtils/windowTiming.ts
  function sleepInWindow(ownerWindow, milliseconds) {
    return new Promise((resolve) => ownerWindow.setTimeout(resolve, milliseconds));
  }

  // src/scripts/slideshow/AnimationRuntime.ts
  function asAnimationShape(element) {
    return element;
  }
  function getAnimationOverlayPlacement(bounds, state, hostViewportOrigin) {
    const zoom = state.zoom.value;
    return {
      left: state.offsetLeft + (bounds.topX + state.scrollX) * zoom - hostViewportOrigin.left,
      top: state.offsetTop + (bounds.topY + state.scrollY) * zoom - hostViewportOrigin.top,
      width: Math.max(bounds.width * zoom, 1),
      height: Math.max(bounds.height * zoom, 1)
    };
  }
  function getElementRect(element) {
    const x1 = element.x;
    const y1 = element.y;
    const x2 = element.x + element.width;
    const y2 = element.y + element.height;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const angle = element.angle ?? 0;
    if (angle === 0) return { left, top, right, bottom };
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners = [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom]
    ];
    const rotated = corners.map(([x, y]) => {
      const dx = x - centerX;
      const dy = y - centerY;
      return [centerX + dx * cos - dy * sin, centerY + dx * sin + dy * cos];
    });
    return {
      left: Math.min(...rotated.map(([x]) => x)),
      top: Math.min(...rotated.map(([, y]) => y)),
      right: Math.max(...rotated.map(([x]) => x)),
      bottom: Math.max(...rotated.map(([, y]) => y))
    };
  }
  function rectsOverlap2(left, right) {
    return left.left <= right.right && left.right >= right.left && left.top <= right.bottom && left.bottom >= right.top;
  }
  function elementOverlapsFrame(element, frame) {
    return element.id !== frame.id && rectsOverlap2(getElementRect(element), getElementRect(frame));
  }
  function getElementById(elements, id) {
    return elements.find((element) => element.id === id);
  }
  function canonicalElementTargetId(element, elements) {
    const shape = asAnimationShape(element);
    if (element.type === "text" && shape.containerId) {
      const container = getElementById(elements, shape.containerId);
      if (container) return container.id;
    }
    return element.id;
  }
  function expandBoundVisualUnit(initialIds, elements) {
    const result = /* @__PURE__ */ new Set();
    const queue = [...initialIds];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id || result.has(id)) continue;
      const element = getElementById(elements, id);
      if (!element) continue;
      result.add(id);
      const shape = asAnimationShape(element);
      if (element.type === "text" && shape.containerId) queue.push(shape.containerId);
      for (const bound of shape.boundElements ?? []) {
        const boundElement = getElementById(elements, bound.id);
        if (boundElement?.type === "text") queue.push(bound.id);
      }
    }
    return [...result];
  }
  function visualUnitOverlapsFrame(element, frame, elements) {
    return expandBoundVisualUnit([element.id], elements).some((id) => {
      const candidate = getElementById(elements, id);
      return candidate ? elementOverlapsFrame(candidate, frame) : false;
    });
  }
  function resolveAnimationTargetElementIds(frameId, targets, elements) {
    const frame = getElementById(elements, frameId);
    if (!frame) return [];
    const baseIds = /* @__PURE__ */ new Set();
    for (const target of targets) {
      if (target.type === "element") {
        const element = getElementById(elements, target.id);
        if (element && visualUnitOverlapsFrame(element, frame, elements)) {
          baseIds.add(canonicalElementTargetId(element, elements));
        }
        continue;
      }
      for (const element of elements) {
        const shape = asAnimationShape(element);
        if (shape.groupIds?.includes(target.id) && elementOverlapsFrame(element, frame)) {
          baseIds.add(element.id);
        }
      }
    }
    return expandBoundVisualUnit(baseIds, elements);
  }
  function animationTargetExists(target, elements) {
    if (target.type === "element") {
      return elements.some((element) => element.id === target.id);
    }
    return elements.some((element) => asAnimationShape(element).groupIds?.includes(target.id));
  }
  function recycleMissingAnimationTargets(steps, elements) {
    return steps.flatMap((step) => {
      const targets = step.targets.filter((target) => animationTargetExists(target, elements)).map((target) => structuredClone(target));
      return targets.length === 0 ? [] : [{ ...structuredClone(step), targets }];
    });
  }
  function captureAnimationTargets(frameId, elements, selectedElementIds, selectedGroupIds) {
    const frame = getElementById(elements, frameId);
    if (!frame) return { targets: [], ignoredSelectionCount: Object.keys(selectedElementIds).length };
    const targets = [];
    const seen = /* @__PURE__ */ new Set();
    let ignoredSelectionCount = 0;
    const selectedGroups = Object.entries(selectedGroupIds).filter(([, selected]) => selected).map(([groupId]) => groupId);
    for (const groupId of selectedGroups) {
      const members = elements.filter((element) => asAnimationShape(element).groupIds?.includes(groupId));
      const inFrame = members.filter((element) => elementOverlapsFrame(element, frame));
      const selectedOutside = members.some(
        (element) => selectedElementIds[element.id] && !elementOverlapsFrame(element, frame)
      );
      if (inFrame.length > 0) {
        const key = `group:${groupId}`;
        if (!seen.has(key)) {
          seen.add(key);
          targets.push({ type: "group", id: groupId });
        }
      }
      if (selectedOutside) ignoredSelectionCount += 1;
    }
    for (const element of elements) {
      if (!selectedElementIds[element.id] || element.id === frameId) continue;
      const shape = asAnimationShape(element);
      if (selectedGroups.some((groupId) => shape.groupIds?.includes(groupId))) continue;
      if (!visualUnitOverlapsFrame(element, frame, elements)) {
        ignoredSelectionCount += 1;
        continue;
      }
      const id = canonicalElementTargetId(element, elements);
      const key = `element:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ type: "element", id });
      }
    }
    return { targets, ignoredSelectionCount };
  }
  function targetsOverlap(frameId, left, right, elements) {
    const leftIds = new Set(resolveAnimationTargetElementIds(frameId, [left], elements));
    return resolveAnimationTargetElementIds(frameId, [right], elements).some((id) => leftIds.has(id));
  }
  function removeAnimationTargetConflicts(frameId, steps, incomingTargets, elements, editedStepId) {
    return steps.flatMap((step) => {
      if (step.id === editedStepId) return [structuredClone(step)];
      const targets = step.targets.filter(
        (target) => !incomingTargets.some((incoming) => targetsOverlap(frameId, target, incoming, elements))
      );
      return targets.length === 0 ? [] : [{ ...structuredClone(step), targets }];
    });
  }
  function getOpacity(element) {
    return asAnimationShape(element).opacity;
  }
  function resolveRuntimeSteps(frameId, steps, elements) {
    const resolved = steps.map((step) => ({
      step: structuredClone(step),
      elementIds: resolveAnimationTargetElementIds(frameId, step.targets, elements)
    }));
    const claimedByLaterStep = /* @__PURE__ */ new Set();
    for (let index = resolved.length - 1; index >= 0; index -= 1) {
      const current = resolved[index];
      if (!current) continue;
      current.elementIds = current.elementIds.filter((id) => !claimedByLaterStep.has(id));
      for (const id of current.elementIds) claimedByLaterStep.add(id);
    }
    return resolved.filter((step) => step.elementIds.length > 0);
  }
  var AnimationRuntime = class {
    ea;
    api;
    hostView;
    ownerWindow;
    onStateChange;
    active = null;
    timer = 0;
    generation = 0;
    overlays = /* @__PURE__ */ new Set();
    buildQueue = Promise.resolve();
    constructor(options) {
      this.ea = options.ea;
      this.api = options.api;
      this.hostView = options.hostView;
      this.ownerWindow = options.hostView.ownerWindow;
      this.onStateChange = options.onStateChange;
    }
    /** Returns current build progress for presentation-state consumers. */
    getState() {
      return {
        completedSteps: this.active?.completedSteps ?? 0,
        stepCount: this.active?.steps.length ?? 0
      };
    }
    /** Returns original opacity for active animated elements, for presenter build previews. */
    getOriginalOpacities() {
      const opacities = /* @__PURE__ */ new Map();
      for (const [id, element] of this.active?.originals ?? []) opacities.set(id, element.opacity);
      return opacities;
    }
    /** Restores the prior slide, resolves the destination's dynamic targets, and applies its build state. */
    async enterSlide(slide, fullyBuilt, startTimedSteps = true) {
      await this.leaveSlide();
      const elements = this.api.getSceneElements();
      const steps = resolveRuntimeSteps(slide.frameId, slide.animationSteps, elements);
      const allIds = new Set(steps.flatMap((step) => step.elementIds));
      const originals = /* @__PURE__ */ new Map();
      for (const element of elements) {
        if (allIds.has(element.id)) originals.set(element.id, element);
      }
      this.active = {
        frameId: slide.frameId,
        steps,
        originals,
        completedSteps: fullyBuilt ? steps.length : 0
      };
      const generation = this.generation;
      try {
        if (!fullyBuilt) this.applyBuildState();
        this.emitState();
        if (startTimedSteps) this.schedulePendingTimedStep();
      } catch (error) {
        if (generation === this.generation) await this.leaveSlide();
        throw error;
      }
    }
    /** Starts the pending timed step after viewport navigation has completed. */
    startPendingTimer() {
      this.schedulePendingTimedStep();
    }
    /** Pauses only the pending after-delay timer without changing build state. */
    pauseTimedStep() {
      this.cancelTimer();
    }
    /** Reveals the next build step, returning false only when the slide is fully built. */
    advance() {
      const requestedGeneration = this.generation;
      return this.enqueueBuildAction(
        requestedGeneration,
        () => this.advanceCurrentStep(requestedGeneration)
      );
    }
    /** Reverses the most recently completed build step, returning false at the slide's initial state. */
    reverse() {
      const requestedGeneration = this.generation;
      return this.enqueueBuildAction(
        requestedGeneration,
        () => this.reverseCurrentStep(requestedGeneration)
      );
    }
    enqueueBuildAction(requestedGeneration, task) {
      const result = this.buildQueue.then(() => {
        if (requestedGeneration !== this.generation) return true;
        return task();
      });
      this.buildQueue = result.then(
        () => void 0,
        () => void 0
      );
      return result;
    }
    async advanceCurrentStep(generation) {
      const active = this.active;
      if (!active || active.completedSteps >= active.steps.length) return false;
      this.cancelTimer();
      const resolved = active.steps[active.completedSteps];
      if (!resolved) return false;
      try {
        await this.runStepEffect(resolved, false, generation);
        if (!this.active || generation !== this.generation) return true;
        this.active.completedSteps += 1;
        this.emitState();
        this.schedulePendingTimedStep();
        return true;
      } catch (error) {
        if (generation === this.generation) await this.leaveSlide();
        throw error;
      }
    }
    async reverseCurrentStep(generation) {
      const active = this.active;
      if (!active || active.completedSteps <= 0) return false;
      this.cancelTimer();
      const resolved = active.steps[active.completedSteps - 1];
      if (!resolved) return false;
      try {
        await this.runStepEffect(resolved, true, generation);
        if (!this.active || generation !== this.generation) return true;
        this.active.completedSteps -= 1;
        this.emitState();
        return true;
      } catch (error) {
        if (generation === this.generation) await this.leaveSlide();
        throw error;
      }
    }
    /** Restores every animation target to its final/original visibility and invalidates callbacks. */
    async finishActiveSlide() {
      this.invalidateAsyncWork();
      if (this.active) this.restoreOriginalOpacities();
      this.active = null;
      this.emitState();
    }
    /** Leaves a slide with every animation target restored to its final/original visibility. */
    async leaveSlide() {
      await this.finishActiveSlide();
    }
    /** Runs one animation from the sidepanel and restores the drawing when the preview completes. */
    async previewStep(frameId, step) {
      await this.leaveSlide();
      const elements = this.api.getSceneElements();
      const elementIds = resolveAnimationTargetElementIds(frameId, step.targets, elements);
      const originals = /* @__PURE__ */ new Map();
      for (const element of elements) {
        if (elementIds.includes(element.id)) originals.set(element.id, element);
      }
      this.active = {
        frameId,
        steps: elementIds.length > 0 ? [{ step: structuredClone(step), elementIds }] : [],
        originals,
        completedSteps: 0
      };
      const generation = this.generation;
      try {
        this.applyBuildState();
        await this.wait(250, generation);
        if (this.active.steps[0] && generation === this.generation) {
          await this.runStepEffect(this.active.steps[0], false, generation);
        }
        await this.wait(Math.max(step.durationMs ?? 350, 150) + 120, generation);
      } finally {
        if (generation === this.generation && this.active) await this.leaveSlide();
      }
    }
    /** Temporarily exposes the fully built current slide for PDF export, then restores build state. */
    async withFinalState(task) {
      const active = this.active;
      if (!active) return task();
      const completedSteps = active.completedSteps;
      this.invalidateAsyncWork();
      this.restoreOriginalOpacities();
      try {
        return await task();
      } finally {
        if (this.active === active) {
          active.completedSteps = completedSteps;
          this.applyBuildState();
          this.emitState();
          this.schedulePendingTimedStep();
        }
      }
    }
    emitState() {
      this.onStateChange?.(this.getState());
    }
    schedulePendingTimedStep() {
      this.cancelTimer();
      const active = this.active;
      const pending = active?.steps[active.completedSteps];
      if (!active || !pending || pending.step.trigger !== "after-delay") return;
      const generation = this.generation;
      this.timer = this.ownerWindow.setTimeout(() => {
        this.timer = 0;
        if (generation !== this.generation) return;
        void this.advance().catch((error) => {
          console.error("Slideshow timed animation failed", error);
        });
      }, pending.step.delayMs ?? 1e3);
    }
    applyBuildState() {
      const active = this.active;
      if (!active) return;
      const visibleIds = new Set(
        active.steps.slice(0, active.completedSteps).flatMap((resolved) => resolved.elementIds)
      );
      const opacities = /* @__PURE__ */ new Map();
      for (const [id, original] of active.originals) {
        opacities.set(id, visibleIds.has(id) ? getOpacity(original) : 0);
      }
      this.applyOpacities(opacities);
    }
    restoreOriginalOpacities() {
      const active = this.active;
      if (!active || active.originals.size === 0) return;
      const opacities = /* @__PURE__ */ new Map();
      for (const [id, original] of active.originals) opacities.set(id, getOpacity(original));
      this.applyOpacities(opacities);
    }
    applyOpacities(opacities) {
      if (opacities.size === 0) return;
      const current = this.api.getSceneElements();
      const elements = current.map((element) => {
        const opacity = opacities.get(element.id);
        return opacity === void 0 ? element : { ...element, opacity };
      });
      this.api.updateScene({ elements, captureUpdate: "NEVER" });
    }
    async runStepEffect(resolved, reverse, generation) {
      const { step, elementIds } = resolved;
      if (step.effect === "appear") {
        this.applyResolvedOpacity(resolved, reverse ? 0 : null);
        return;
      }
      if (step.effect === "fade") {
        await this.animateFade(resolved, reverse, generation);
        return;
      }
      await this.animateOverlay(resolved, reverse, generation);
    }
    applyResolvedOpacity(resolved, opacity) {
      const active = this.active;
      if (!active) return;
      const opacities = /* @__PURE__ */ new Map();
      for (const id of resolved.elementIds) {
        const original = active.originals.get(id);
        if (original) opacities.set(id, opacity ?? getOpacity(original));
      }
      this.applyOpacities(opacities);
    }
    async animateFade(resolved, reverse, generation) {
      const active = this.active;
      if (!active) return;
      const duration = resolved.step.durationMs ?? 350;
      const started = this.ownerWindow.performance.now();
      while (generation === this.generation) {
        const elapsed = this.ownerWindow.performance.now() - started;
        const progress = duration <= 0 ? 1 : Math.min(elapsed / duration, 1);
        const opacities = /* @__PURE__ */ new Map();
        for (const id of resolved.elementIds) {
          const original = active.originals.get(id);
          if (!original) continue;
          const originalOpacity = getOpacity(original);
          opacities.set(id, reverse ? originalOpacity * (1 - progress) : originalOpacity * progress);
        }
        this.applyOpacities(opacities);
        if (progress >= 1) break;
        await this.nextFrame(generation);
      }
    }
    async animateOverlay(resolved, reverse, generation) {
      const overlay = await this.createOverlay(resolved.elementIds);
      if (!overlay || generation !== this.generation) {
        overlay?.remove();
        return;
      }
      this.overlays.add(overlay);
      const duration = resolved.step.durationMs ?? 350;
      const motion = this.getOverlayMotion(resolved.step, overlay);
      overlay.style.transition = "none";
      overlay.style.opacity = "1";
      overlay.style.transform = reverse ? motion.end : motion.start;
      if (reverse) this.applyResolvedOpacity(resolved, 0);
      await this.nextFrame(generation);
      await this.nextFrame(generation);
      if (generation !== this.generation) return;
      overlay.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
      overlay.style.transform = reverse ? motion.start : motion.end;
      if (reverse && resolved.step.effect === "zoom") overlay.style.opacity = "0";
      await this.wait(duration + 24, generation);
      if (!reverse && generation === this.generation) this.applyResolvedOpacity(resolved, null);
      overlay.remove();
      this.overlays.delete(overlay);
    }
    getOverlayMotion(step, overlay) {
      if (step.effect === "zoom") return { start: "scale(0.05)", end: "scale(1)" };
      const rect = overlay.getBoundingClientRect();
      const appState = this.api.getAppState();
      const horizontal = Math.max(rect.width, appState.width * 0.2, 80);
      const vertical = Math.max(rect.height, appState.height * 0.2, 80);
      const start = step.direction === "right" ? `translateX(${horizontal}px)` : step.direction === "up" ? `translateY(-${vertical}px)` : step.direction === "down" ? `translateY(${vertical}px)` : `translateX(-${horizontal}px)`;
      return { start, end: "translate(0, 0)" };
    }
    async createOverlay(elementIds) {
      const active = this.active;
      if (!active) return null;
      const originals = elementIds.map((id) => active.originals.get(id)).filter((element) => Boolean(element));
      if (originals.length === 0) return null;
      this.ea.setView(this.hostView);
      const svg = await this.ea.createViewSVG({
        withBackground: false,
        theme: this.api.getAppState().theme,
        frameRendering: { enabled: false, name: false, outline: false, clip: false },
        padding: 0,
        selectedOnly: false,
        skipInliningFonts: false,
        embedScene: false,
        elementsOverride: originals
      });
      const excalidraw = this.hostView.contentEl.querySelector(".excalidraw");
      if (!excalidraw) return null;
      const bounds = this.ea.getBoundingBox(originals);
      const state = this.api.getAppState();
      const hostRect = excalidraw.getBoundingClientRect();
      const placement = getAnimationOverlayPlacement(bounds, state, {
        left: hostRect.left + excalidraw.clientLeft,
        top: hostRect.top + excalidraw.clientTop
      });
      const overlay = this.hostView.ownerDocument.createElement("div");
      overlay.className = "slideshow-animation-overlay";
      overlay.style.position = "absolute";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "4";
      overlay.style.left = `${placement.left}px`;
      overlay.style.top = `${placement.top}px`;
      overlay.style.width = `${placement.width}px`;
      overlay.style.height = `${placement.height}px`;
      overlay.style.transformOrigin = "center center";
      overlay.innerHTML = svg.outerHTML;
      const child = overlay.firstElementChild;
      if (child) {
        child.setAttribute("width", "100%");
        child.setAttribute("height", "100%");
        child.style.display = "block";
        child.style.overflow = "visible";
      }
      excalidraw.appendChild(overlay);
      return overlay;
    }
    cancelTimer() {
      if (this.timer) this.ownerWindow.clearTimeout(this.timer);
      this.timer = 0;
    }
    invalidateAsyncWork() {
      this.generation += 1;
      this.cancelTimer();
      for (const overlay of this.overlays) overlay.remove();
      this.overlays.clear();
    }
    nextFrame(generation) {
      if (generation !== this.generation) return Promise.resolve();
      return new Promise((resolve) => {
        this.ownerWindow.requestAnimationFrame(() => resolve());
      });
    }
    wait(delay, generation) {
      if (generation !== this.generation) return Promise.resolve();
      return new Promise((resolve) => {
        this.ownerWindow.setTimeout(resolve, delay);
      });
    }
  };

  // src/scripts/slideshow/PresentationControls.ts
  var PresentationControls = class {
    constructor(options) {
      this.options = options;
    }
    panel = null;
    select = null;
    fullscreenButton = null;
    fadeTimeout = 0;
    posX1 = 0;
    posY1 = 0;
    posX2 = 0;
    posY2 = 0;
    /** Creates and attaches the complete slideshow toolbar. */
    create() {
      const {
        contentElement,
        slidesCount,
        pathType,
        slideTitles,
        shouldOfferPathVisibility,
        isPathHidden,
        printSlideWidth,
        printSlideHeight,
        ea: ea2,
        callbacks,
        icons,
        t,
        ownerDocument
      } = this.options;
      const excalidrawContainer = contentElement.querySelector(".excalidraw");
      if (!excalidrawContainer) {
        throw new Error("Could not find the Excalidraw container for slideshow controls.");
      }
      const top = contentElement.innerHeight;
      this.panel = excalidrawContainer.createDiv({
        cls: [
          "excalidraw-presentation-panel",
          ...ea2.DEVICE.isMobile ? ["slideshow-presentation-panel--mobile"] : []
        ],
        attr: {
          style: `
          width: fit-content;
          max-width: calc(100% - 12px);
          z-index:5;
          position: absolute;
          top:calc(${top}px - var(--default-button-size)*2);
          left:50%;
          transform:translateX(-50%);`
        }
      });
      if (ea2.DEVICE.isMobile) {
        this.panel.style.top = "auto";
        this.panel.style.bottom = "8px";
      }
      this.setFadeTimeout(this.options.transitionDelay * 3);
      const panelColumn = this.panel.createDiv({ cls: "panelColumn" });
      panelColumn.createDiv(
        {
          cls: ["Island", "buttonList"],
          attr: {
            style: `
            max-width: calc(100vw - 12px);
            justify-content: space-between;
            height: calc(var(--default-button-size)*1.5);
            width: max-content;
            background: var(--island-bg-color);
            display: flex;
            align-items: center;`
          }
        },
        (buttonList) => {
          buttonList.createEl("style", {
            text: `
            .excalidraw-presentation-panel select:focus { box-shadow: var(--input-shadow); }
            .excalidraw-presentation-panel .buttonList { max-width: calc(100vw - 12px); }
            .excalidraw-presentation-panel.slideshow-presentation-panel--mobile .buttonList {
              flex-wrap: wrap;
              height: auto !important;
              justify-content: center !important;
            }
            .excalidraw-presentation-panel.slideshow-presentation-panel--mobile select {
              width: clamp(76px, 24vw, 132px);
              max-width: 132px;
              text-overflow: ellipsis;
            }
          `
          });
          buttonList.createEl(
            "button",
            {
              attr: {
                style: "margin-left: calc(var(--default-button-size)*0.25);",
                "aria-label": t("previousSlide")
              }
            },
            (button) => {
              button.innerHTML = icons.leftArrow;
              button.onclick = callbacks.previous;
            }
          );
          this.select = buttonList.createEl(
            "select",
            {
              attr: {
                style: `
                font-size: inherit;
                background-color: var(--island-bg-color);
                border: none;
                color: var(--color-gray-100);
                cursor: pointer;`,
                "aria-label": t("navigateToSlide")
              }
            },
            (selectElement) => {
              for (let index = 0; index < slidesCount; index += 1) {
                const option = ownerDocument.createElement("option");
                option.text = t("presentationSlideTitle", {
                  title: slideTitles[index] ?? t("slideLabel", { number: index + 1 }),
                  number: index + 1,
                  total: slidesCount
                });
                option.value = String(index + 1);
                selectElement.add(option);
              }
              selectElement.addEventListener("change", () => {
                const selectedSlideNumber = Number.parseInt(selectElement.value, 10);
                selectElement.blur();
                callbacks.navigateToSlide(selectedSlideNumber);
              });
            }
          );
          buttonList.createEl(
            "button",
            { attr: { "aria-label": t("nextSlide") } },
            (button) => {
              button.innerHTML = icons.rightArrow;
              button.onclick = callbacks.next;
            }
          );
          if (!ea2.DEVICE.isMobile) {
            buttonList.createDiv({
              attr: {
                style: `
                width: 1px;
                height: var(--default-button-size);
                background-color: var(--default-border-color);
                margin: 0px auto;`
              }
            });
          }
          buttonList.createEl(
            "button",
            { attr: { "aria-label": t("toggleLaser") } },
            (button) => {
              button.innerHTML = icons.laserOff;
              button.onclick = () => {
                const laserIsOn = callbacks.toggleLaser();
                button.innerHTML = laserIsOn ? icons.laserOn : icons.laserOff;
              };
            }
          );
          buttonList.createEl(
            "button",
            { attr: { "aria-label": t("refocusSlide") } },
            (button) => {
              button.innerHTML = icons.refocus;
              button.onclick = callbacks.refocus;
            }
          );
          if (!ea2.DEVICE.isMobile) {
            buttonList.createEl(
              "button",
              { attr: { "aria-label": t("toggleFullscreen") } },
              (button) => {
                this.fullscreenButton = button;
                button.innerHTML = this.options.isFullscreen ? icons.minimize : icons.maximize;
                button.onclick = callbacks.toggleFullscreen;
              }
            );
          }
          if (pathType === "line") {
            if (shouldOfferPathVisibility) {
              let pathHidden = isPathHidden;
              buttonList.createEl(
                "button",
                { attr: { "aria-label": t("pathVisibility") } },
                (button) => {
                  const renderPathVisibility = () => {
                    const label = pathHidden ? t("keepPresentationPathHidden") : t("keepPresentationPathVisible");
                    button.innerHTML = pathHidden ? icons.eyeOff : icons.eye;
                    button.setAttribute("aria-label", label);
                    button.setAttribute("aria-pressed", String(pathHidden));
                  };
                  renderPathVisibility();
                  button.onclick = () => {
                    pathHidden = !pathHidden;
                    renderPathVisibility();
                    callbacks.togglePathVisibility(pathHidden);
                  };
                }
              );
            }
            buttonList.createEl(
              "button",
              { attr: { "aria-label": t("editSlide") } },
              (button) => {
                button.innerHTML = icons.edit;
                button.onclick = callbacks.editSlide;
              }
            );
          }
          buttonList.createEl(
            "button",
            { attr: { "aria-label": t("openSlideshowPanel") } },
            (button) => {
              button.innerHTML = icons.settings;
              button.onclick = callbacks.openSidepanel;
            }
          );
          if (ea2.DEVICE.isDesktop) {
            buttonList.createEl(
              "button",
              {
                attr: {
                  style: "margin-right: calc(var(--default-button-size)*0.25);",
                  "aria-label": t("printPdf", { width: printSlideWidth, height: printSlideHeight })
                }
              },
              (button) => {
                button.innerHTML = icons.printer;
                button.onclick = callbacks.print;
              }
            );
          }
          buttonList.createEl(
            "button",
            {
              attr: {
                style: "margin-right: calc(var(--default-button-size)*0.25);",
                "aria-label": t("endPresentation")
              }
            },
            (button) => {
              button.innerHTML = icons.finish;
              button.onclick = callbacks.finish;
            }
          );
        }
      );
      this.panel.addEventListener("pointerdown", this.onPointerDown, false);
      this.panel.addEventListener("mouseenter", this.onMouseEnter, false);
      this.panel.addEventListener("mouseleave", this.onMouseLeave, false);
      this.options.ownerWindow.addEventListener("pointerup", this.onPointerUp, false);
    }
    /** Repositions the panel and restores the current slide's viewport. */
    resetPosition(refocus = true) {
      if (!this.panel) return;
      const top = this.options.contentElement.innerHeight;
      if (this.options.ea.DEVICE.isMobile) {
        this.panel.style.top = "auto";
        this.panel.style.bottom = "8px";
      } else {
        this.panel.style.top = `calc(${top}px - var(--default-button-size)*2)`;
        this.panel.style.bottom = "auto";
      }
      this.panel.style.left = "50%";
      this.panel.style.transform = "translateX(-50%)";
      if (refocus) this.options.callbacks.refocus();
    }
    /** Updates the slide picker to the one-based slide number. */
    setSelectedSlide(slideNumber) {
      if (this.select) this.select.value = String(slideNumber);
    }
    /** Updates the fullscreen button without rebuilding the toolbar. */
    setFullscreen(fullscreen) {
      if (this.fullscreenButton) {
        this.fullscreenButton.innerHTML = fullscreen ? this.options.icons.minimize : this.options.icons.maximize;
      }
    }
    /** Removes the panel and every event listener owned by it. */
    destroy() {
      this.clearFadeTimeout();
      this.options.ownerWindow.removeEventListener("pointermove", this.onDrag, true);
      this.options.ownerWindow.removeEventListener("pointerup", this.onPointerUp, false);
      this.panel?.removeEventListener("pointerdown", this.onPointerDown, false);
      this.panel?.removeEventListener("mouseenter", this.onMouseEnter, false);
      this.panel?.removeEventListener("mouseleave", this.onMouseLeave, false);
      this.panel?.parentElement?.removeChild(this.panel);
      this.panel = null;
      this.select = null;
      this.fullscreenButton = null;
    }
    setFadeTimeout(delay = this.options.transitionDelay) {
      this.fadeTimeout = this.options.ownerWindow.setTimeout(() => {
        this.fadeTimeout = 0;
        if (this.options.ownerDocument.activeElement === this.select) {
          this.setFadeTimeout(delay);
          return;
        }
        if (this.panel) this.panel.style.opacity = String(this.options.fadeLevel);
      }, delay);
    }
    clearFadeTimeout() {
      if (this.fadeTimeout) {
        this.options.ownerWindow.clearTimeout(this.fadeTimeout);
        this.fadeTimeout = 0;
      }
      if (this.panel) this.panel.style.opacity = "1";
    }
    onPointerUp = () => {
      this.options.ownerWindow.removeEventListener("pointermove", this.onDrag, true);
    };
    onPointerDown = (event) => {
      this.clearFadeTimeout();
      this.setFadeTimeout();
      if (this.panel && this.panel.style.bottom !== "auto" && this.panel.style.bottom !== "") {
        this.panel.style.top = `${this.panel.offsetTop}px`;
        this.panel.style.bottom = "auto";
      }
      this.posX2 = event.clientX;
      this.posY2 = event.clientY;
      this.options.ownerWindow.addEventListener("pointermove", this.onDrag, true);
    };
    onDrag = (event) => {
      event.preventDefault();
      this.posX1 = this.posX2 - event.clientX;
      this.posY1 = this.posY2 - event.clientY;
      this.posX2 = event.clientX;
      this.posY2 = event.clientY;
      this.updatePosition(this.posY1, this.posX1);
    };
    updatePosition(deltaY = 0, deltaX = 0) {
      if (!this.panel) return;
      this.panel.style.top = `${this.panel.offsetTop - deltaY}px`;
      this.panel.style.left = `${this.panel.offsetLeft - deltaX}px`;
    }
    onMouseEnter = () => this.clearFadeTimeout();
    onMouseLeave = () => this.setFadeTimeout();
  };

  // src/sharedUtils/AsyncTaskQueue.ts
  var AsyncTaskQueue = class {
    tail = Promise.resolve();
    generation = 0;
    pending = /* @__PURE__ */ new Map();
    enqueue(key, task, isRelevant = () => true) {
      const existing = this.pending.get(key);
      if (existing) return existing;
      const generation = this.generation;
      const result = this.tail.then(async () => {
        if (generation !== this.generation || !isRelevant()) return void 0;
        return await task();
      });
      this.pending.set(key, result);
      this.tail = result.then(
        () => void 0,
        () => void 0
      );
      const removePending = () => {
        if (this.pending.get(key) === result) this.pending.delete(key);
      };
      void result.then(removePending, removePending);
      return result;
    }
    clear() {
      this.generation += 1;
      this.pending.clear();
    }
    async idle() {
      await this.tail;
    }
  };

  // src/sharedUtils/ByteBudgetLruCache.ts
  var ByteBudgetLruCache = class {
    constructor(maximumSize, dispose) {
      this.maximumSize = maximumSize;
      this.dispose = dispose;
    }
    values = /* @__PURE__ */ new Map();
    totalSize = 0;
    get size() {
      return this.totalSize;
    }
    get(key) {
      const entry = this.values.get(key);
      if (!entry) return void 0;
      this.values.delete(key);
      this.values.set(key, entry);
      return entry.value;
    }
    set(key, value, size) {
      this.delete(key);
      const normalizedSize = Math.max(0, Math.trunc(size));
      this.values.set(key, { value, size: normalizedSize });
      this.totalSize += normalizedSize;
      while (this.totalSize > this.maximumSize && this.values.size > 1) {
        const oldest = this.values.keys().next().value;
        if (oldest === void 0) break;
        this.delete(oldest);
      }
    }
    delete(key) {
      const entry = this.values.get(key);
      if (!entry) return false;
      this.values.delete(key);
      this.totalSize -= entry.size;
      this.dispose?.(entry.value);
      return true;
    }
    clear() {
      for (const entry of this.values.values()) this.dispose?.(entry.value);
      this.values.clear();
      this.totalSize = 0;
    }
  };

  // src/scripts/slideshow/SlidePreviewService.ts
  var FALLBACK_BACKGROUND = "#ffffff";
  var PREVIEW_CACHE_BYTES = 64 * 1024 * 1024;
  var DEFAULT_PREVIEW_WIDTH = 960;
  var MAX_PREVIEW_SCALE = 2;
  var EA_EXPORT_QUEUES = /* @__PURE__ */ new WeakMap();
  async function withEaExportLock(ea2, task) {
    const key = ea2;
    const previous = EA_EXPORT_QUEUES.get(key) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    EA_EXPORT_QUEUES.set(key, previous.catch(() => void 0).then(() => gate));
    await previous.catch(() => void 0);
    try {
      return await task();
    } finally {
      release?.();
    }
  }
  function getPreviewNavigationRect(slide, maxZoom, printSlideWidth = 1920, printSlideHeight = 1080) {
    return getNavigationRect(
      slide.rect,
      { width: printSlideWidth, height: printSlideHeight },
      maxZoom
    );
  }
  function cloneWithoutMetadata(element) {
    const copy = { ...element };
    const customData = copy.customData;
    if (typeof customData === "object" && customData !== null && !Array.isArray(customData)) {
      const visualCustomData = { ...customData };
      delete visualCustomData.slideshow;
      if (Object.keys(visualCustomData).length === 0) delete copy.customData;
      else copy.customData = visualCustomData;
    }
    delete copy.version;
    delete copy.versionNonce;
    delete copy.updated;
    return copy;
  }
  function getSceneVisualFingerprint(elements) {
    return JSON.stringify(elements.map(cloneWithoutMetadata));
  }
  function readBackgroundColor(appState) {
    return typeof appState.viewBackgroundColor === "string" ? appState.viewBackgroundColor : FALLBACK_BACKGROUND;
  }
  function getHiddenBuildElementIds(slide, completedAnimationSteps, elements) {
    if (completedAnimationSteps === void 0) return [];
    const completed = Math.min(
      Math.max(Math.trunc(completedAnimationSteps), 0),
      slide.animationSteps.length
    );
    const ids = /* @__PURE__ */ new Set();
    for (const step of slide.animationSteps.slice(completed)) {
      for (const id of resolveAnimationTargetElementIds(slide.frameId, step.targets, elements)) {
        ids.add(id);
      }
    }
    return [...ids].sort();
  }
  var SlidePreviewService = class {
    constructor(ea2, api, config) {
      this.ea = ea2;
      this.api = api;
      this.config = config;
    }
    queue = new AsyncTaskQueue();
    cached = new ByteBudgetLruCache(
      PREVIEW_CACHE_BYTES,
      (preview) => URL.revokeObjectURL(preview.objectUrl)
    );
    generation = 0;
    lastElements = null;
    lastFingerprint = "";
    /** Returns the drawing background used behind previews. */
    getBackgroundColor() {
      return readBackgroundColor(this.api.getAppState());
    }
    /** Returns the configured presentation aspect ratio used by sorter previews. */
    getAspectRatio() {
      return `${this.config.printSlideWidth} / ${this.config.printSlideHeight}`;
    }
    /** Drops cached previews and invalidates queued work, for example after switching drawings. */
    clear() {
      this.generation += 1;
      this.queue.clear();
      this.cached.clear();
      this.lastElements = null;
      this.lastFingerprint = "";
    }
    getFingerprint(elements) {
      if (elements === this.lastElements) return this.lastFingerprint;
      this.lastElements = elements;
      this.lastFingerprint = getSceneVisualFingerprint(elements);
      return this.lastFingerprint;
    }
    createPreviewElement(cached, ownerDocument) {
      const image = ownerDocument.createElement("img");
      image.src = cached.objectUrl;
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      image.setAttribute("aria-hidden", "true");
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "contain";
      image.style.backgroundColor = cached.backgroundColor;
      return image;
    }
    async exportPreview(elements, slide, hiddenElementIds, originalOpacities, targetWidth, generation, cacheKey) {
      const appState = this.api.getAppState();
      const rect = getPreviewNavigationRect(
        slide,
        this.config.maxZoom,
        this.config.printSlideWidth,
        this.config.printSlideHeight
      );
      const exportArea = {
        x: Math.min(rect.left, rect.right),
        y: Math.min(rect.top, rect.bottom),
        width: Math.abs(rect.right - rect.left),
        height: Math.abs(rect.bottom - rect.top)
      };
      const localElements = this.ea.getElementsIntersectionArea(elements, exportArea, {
        includeBoundElements: true
      });
      return await withEaExportLock(this.ea, async () => {
        if (generation !== this.generation) return void 0;
        this.ea.clear();
        try {
          this.ea.copyViewElementsToEAforEditing(localElements);
          if (slide.kind === "path") {
            const hiddenPath = this.ea.getElement(slide.pathId);
            if (hiddenPath) hiddenPath.opacity = 0;
          }
          for (const [id, opacity] of originalOpacities ?? []) {
            const element = this.ea.getElement(id);
            if (element) element.opacity = opacity;
          }
          for (const id of hiddenElementIds) {
            const element = this.ea.getElement(id);
            if (element) element.opacity = 0;
          }
          const scale = Math.min(
            MAX_PREVIEW_SCALE,
            Math.max(targetWidth / Math.max(exportArea.width, 1), 0.01)
          );
          const blob = await this.ea.createViewPNG({
            withBackground: true,
            theme: appState.theme,
            frameRendering: {
              enabled: true,
              name: false,
              outline: false,
              clip: false
            },
            padding: 0,
            selectedOnly: false,
            embedScene: false,
            elementsOverride: this.ea.getElements(),
            exportArea,
            scale
          });
          if (generation !== this.generation) return void 0;
          const cached = {
            objectUrl: URL.createObjectURL(blob),
            backgroundColor: readBackgroundColor(appState)
          };
          this.cached.set(cacheKey, cached, blob.size);
          return cached;
        } finally {
          this.ea.clear();
        }
      });
    }
    /** Creates a bounded raster preview in the caller's owner document. */
    async createPreview(slide, ownerDocument, state = {}) {
      const elements = this.ea.getViewElements();
      if (elements.length === 0) return null;
      const hiddenElementIds = slide.kind === "frame" ? getHiddenBuildElementIds(slide, state.completedAnimationSteps, elements) : [];
      const appState = this.api.getAppState();
      const targetWidth = Math.max(Math.trunc(state.targetWidth ?? DEFAULT_PREVIEW_WIDTH), 1);
      const opacityKey = state.originalOpacities ? [...state.originalOpacities.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, opacity]) => `${id}:${opacity}`).join(",") : "none";
      const rect = getPreviewNavigationRect(
        slide,
        this.config.maxZoom,
        this.config.printSlideWidth,
        this.config.printSlideHeight
      );
      const cacheKey = [
        appState.theme,
        readBackgroundColor(appState),
        slide.kind === "path" ? `path:${slide.pathId}` : "frame",
        `hidden:${hiddenElementIds.join(",")}`,
        `opacity:${opacityKey}`,
        `area:${rect.left},${rect.top},${rect.right},${rect.bottom}`,
        `width:${targetWidth}`,
        this.getFingerprint(elements)
      ].join("|");
      const existing = this.cached.get(cacheKey);
      if (existing) return this.createPreviewElement(existing, ownerDocument);
      const generation = this.generation;
      const cached = await this.queue.enqueue(
        cacheKey,
        () => this.exportPreview(
          elements,
          slide,
          hiddenElementIds,
          state.originalOpacities,
          targetWidth,
          generation,
          cacheKey
        ),
        () => generation === this.generation
      );
      return cached ? this.createPreviewElement(cached, ownerDocument) : null;
    }
  };

  // src/scripts/slideshow/slideshowSettings.ts
  var DEFAULT_SLIDESHOW_CONFIG = {
    transitionStepCount: 100,
    transitionDelay: 1e3,
    frameSleep: 1,
    editZoomOut: 0.7,
    fadeLevel: 0.1,
    printSlideWidth: 1920,
    printSlideHeight: 1080,
    maxZoom: 30
  };
  var CONFIG_KEYS = Object.keys(DEFAULT_SLIDESHOW_CONFIG);
  var START_MODE_SETTING = "slideshowStartMode";
  var WINDOW_MODE_SETTING = "slideshowWindowMode";
  var NOTES_MODE_SETTING = "slideshowNotesMode";
  var PRESENTATION_TYPE_SETTING = "slideshowPresentationType";
  var DISPLAY_TARGETS_SETTING = "slideshowDisplayTargetsByDevice";
  var DISPLAY_TARGETS_BY_CONFIGURATION_SETTING = "slideshowDisplayTargetsByDeviceConfiguration";
  var PRESENTER_NOTES_FONT_SIZE_SETTING = "slideshowPresenterNotesFontSize";
  var SORTER_THUMBNAIL_MAX_WIDTH_SETTING = "slideshowSorterThumbnailMaxWidth";
  var LEGACY_LAUNCH_MODE_SETTING = "slideshowLaunchMode";
  var LEGACY_START_FULLSCREEN_SETTING = "slideshowStartFullscreen";
  var DEFAULT_PRESENTER_NOTES_FONT_SIZE = 18;
  var DEFAULT_SORTER_THUMBNAIL_MAX_WIDTH = 280;
  function readSettings(ea2) {
    const getSettings = ea2.getScriptSettings;
    return typeof getSettings === "function" ? getSettings.call(ea2) : {};
  }
  function loadSlideshowLaunchPreferences(ea2) {
    const settings = readSettings(ea2);
    const legacyMode = settings[LEGACY_LAUNCH_MODE_SETTING];
    const rawStartMode = settings[START_MODE_SETTING];
    const startMode = rawStartMode === "resume" || rawStartMode === "current" ? rawStartMode : rawStartMode === "beginning" ? "beginning" : legacyMode === "resume" || legacyMode === "current" ? legacyMode : "beginning";
    const rawWindowMode = settings[WINDOW_MODE_SETTING];
    const windowMode = rawWindowMode === "window" || rawWindowMode === "fullscreen" ? rawWindowMode : settings[LEGACY_START_FULLSCREEN_SETTING] === false ? "window" : "fullscreen";
    const rawNotesMode = settings[NOTES_MODE_SETTING];
    const notesMode = rawNotesMode === "presenter" || rawNotesMode === "slides" ? rawNotesMode : legacyMode === "presenter" ? "presenter" : "slides";
    const rawPresentationType = settings[PRESENTATION_TYPE_SETTING];
    const presentationType = rawPresentationType === "frame" || rawPresentationType === "line" ? rawPresentationType : void 0;
    return {
      startMode,
      windowMode,
      notesMode,
      ...presentationType ? { presentationType } : {}
    };
  }
  async function saveSlideshowLaunchPreferences(ea2, preferences) {
    const settings = ea2.getScriptSettings();
    await ea2.setScriptSettings({
      ...settings,
      [START_MODE_SETTING]: preferences.startMode,
      [WINDOW_MODE_SETTING]: preferences.windowMode,
      [NOTES_MODE_SETTING]: preferences.notesMode,
      ...preferences.presentationType ? { [PRESENTATION_TYPE_SETTING]: preferences.presentationType } : {}
    });
  }
  function asDisplayPreferences(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value;
    const normalizeId = (id) => {
      if (id === null) return null;
      return typeof id === "number" && Number.isFinite(id) ? id : void 0;
    };
    const normalizeIdentity = (identity) => {
      if (identity === null) return null;
      return typeof identity === "string" && identity.length > 0 ? identity : void 0;
    };
    const presentationDisplayId = normalizeId(record.presentationDisplayId);
    const presenterDisplayId = normalizeId(record.presenterDisplayId);
    if (presentationDisplayId === void 0 || presenterDisplayId === void 0) return null;
    const presentationDisplayIdentity = normalizeIdentity(record.presentationDisplayIdentity);
    const presenterDisplayIdentity = normalizeIdentity(record.presenterDisplayIdentity);
    return {
      presentationDisplayId,
      presenterDisplayId,
      ...presentationDisplayIdentity !== void 0 ? { presentationDisplayIdentity } : {},
      ...presenterDisplayIdentity !== void 0 ? { presenterDisplayIdentity } : {}
    };
  }
  function loadSlideshowDisplayPreferences(ea2, deviceKey, configurationKey) {
    const settings = readSettings(ea2);
    if (configurationKey) {
      const configuredRaw = settings[DISPLAY_TARGETS_BY_CONFIGURATION_SETTING];
      if (configuredRaw && typeof configuredRaw === "object" && !Array.isArray(configuredRaw)) {
        const byDevice = configuredRaw[deviceKey];
        if (byDevice && typeof byDevice === "object" && !Array.isArray(byDevice)) {
          const configured = asDisplayPreferences(
            byDevice[configurationKey]
          );
          if (configured) return configured;
        }
      }
    }
    const legacyRaw = settings[DISPLAY_TARGETS_SETTING];
    if (!legacyRaw || typeof legacyRaw !== "object" || Array.isArray(legacyRaw)) return null;
    return asDisplayPreferences(legacyRaw[deviceKey]);
  }
  async function saveSlideshowDisplayPreferences(ea2, deviceKey, preferences, configurationKey) {
    const settings = ea2.getScriptSettings();
    if (!configurationKey) {
      const existingRaw2 = settings[DISPLAY_TARGETS_SETTING];
      const existing2 = existingRaw2 && typeof existingRaw2 === "object" && !Array.isArray(existingRaw2) ? existingRaw2 : {};
      await ea2.setScriptSettings({
        ...settings,
        [DISPLAY_TARGETS_SETTING]: {
          ...existing2,
          [deviceKey]: { ...preferences }
        }
      });
      return;
    }
    const existingRaw = settings[DISPLAY_TARGETS_BY_CONFIGURATION_SETTING];
    const existing = existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw) ? existingRaw : {};
    const existingDeviceRaw = existing[deviceKey];
    const existingDevice = existingDeviceRaw && typeof existingDeviceRaw === "object" && !Array.isArray(existingDeviceRaw) ? existingDeviceRaw : {};
    await ea2.setScriptSettings({
      ...settings,
      [DISPLAY_TARGETS_BY_CONFIGURATION_SETTING]: {
        ...existing,
        [deviceKey]: {
          ...existingDevice,
          [configurationKey]: { ...preferences }
        }
      }
    });
  }
  function loadPresenterNotesFontSize(ea2) {
    const raw = readSettings(ea2)[PRESENTER_NOTES_FONT_SIZE_SETTING];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_PRESENTER_NOTES_FONT_SIZE;
    return Math.min(48, Math.max(12, Math.round(value)));
  }
  async function savePresenterNotesFontSize(ea2, fontSize) {
    const value = Math.min(48, Math.max(12, Math.round(fontSize)));
    await ea2.setScriptSettings({
      ...ea2.getScriptSettings(),
      [PRESENTER_NOTES_FONT_SIZE_SETTING]: value
    });
  }
  function loadSorterThumbnailMaxWidth(ea2) {
    const raw = readSettings(ea2)[SORTER_THUMBNAIL_MAX_WIDTH_SETTING];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_SORTER_THUMBNAIL_MAX_WIDTH;
    return Math.min(520, Math.max(140, Math.round(value)));
  }
  async function saveSorterThumbnailMaxWidth(ea2, width) {
    const value = Math.min(520, Math.max(140, Math.round(width)));
    await ea2.setScriptSettings({
      ...ea2.getScriptSettings(),
      [SORTER_THUMBNAIL_MAX_WIDTH_SETTING]: value
    });
  }
  function finiteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function normalizeSlideshowConfig(settings) {
    return {
      transitionStepCount: Math.max(
        1,
        Math.round(finiteNumber(settings.transitionStepCount, DEFAULT_SLIDESHOW_CONFIG.transitionStepCount))
      ),
      transitionDelay: Math.max(
        1,
        finiteNumber(settings.transitionDelay, DEFAULT_SLIDESHOW_CONFIG.transitionDelay)
      ),
      frameSleep: Math.max(0, finiteNumber(settings.frameSleep, DEFAULT_SLIDESHOW_CONFIG.frameSleep)),
      editZoomOut: Math.max(
        0.05,
        finiteNumber(settings.editZoomOut, DEFAULT_SLIDESHOW_CONFIG.editZoomOut)
      ),
      fadeLevel: Math.min(
        1,
        Math.max(0, finiteNumber(settings.fadeLevel, DEFAULT_SLIDESHOW_CONFIG.fadeLevel))
      ),
      printSlideWidth: Math.max(
        1,
        Math.round(finiteNumber(settings.printSlideWidth, DEFAULT_SLIDESHOW_CONFIG.printSlideWidth))
      ),
      printSlideHeight: Math.max(
        1,
        Math.round(finiteNumber(settings.printSlideHeight, DEFAULT_SLIDESHOW_CONFIG.printSlideHeight))
      ),
      maxZoom: Math.max(0.1, finiteNumber(settings.maxZoom, DEFAULT_SLIDESHOW_CONFIG.maxZoom))
    };
  }
  function loadSlideshowConfig(ea2) {
    return normalizeSlideshowConfig(ea2.getScriptSettings());
  }
  async function saveSlideshowConfig(ea2, config) {
    const existing = ea2.getScriptSettings();
    const next = { ...existing };
    for (const key of CONFIG_KEYS) next[key] = config[key];
    await ea2.setScriptSettings(next);
  }
  function resetSlideshowConfigToDefaults(config) {
    Object.assign(config, DEFAULT_SLIDESHOW_CONFIG);
  }
  function addNumberSetting(ea2, container, name, description, value, onChange) {
    new ea2.obsidian.Setting(container).setName(name).setDesc(description).addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.step = "any";
      text.setValue(String(value)).onChange((raw) => {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      });
    });
  }
  function openSlideshowSettingsModal(ea2, config, t, onSaved) {
    const modal = new ea2.obsidian.Modal(app);
    modal.titleEl.setText(t("settingsTitle"));
    const draft = { ...config };
    const renderContent = () => {
      const { contentEl } = modal;
      contentEl.empty();
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsTransitionStepCount"),
        t("settingsTransitionStepCountDesc"),
        draft.transitionStepCount,
        (value) => {
          draft.transitionStepCount = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsTransitionDelay"),
        t("settingsTransitionDelayDesc"),
        draft.transitionDelay,
        (value) => {
          draft.transitionDelay = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsFrameSleep"),
        t("settingsFrameSleepDesc"),
        draft.frameSleep,
        (value) => {
          draft.frameSleep = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsEditZoomOut"),
        t("settingsEditZoomOutDesc"),
        draft.editZoomOut,
        (value) => {
          draft.editZoomOut = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsFadeLevel"),
        t("settingsFadeLevelDesc"),
        draft.fadeLevel,
        (value) => {
          draft.fadeLevel = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsPrintSlideWidth"),
        t("settingsPrintSlideWidthDesc"),
        draft.printSlideWidth,
        (value) => {
          draft.printSlideWidth = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsPrintSlideHeight"),
        t("settingsPrintSlideHeightDesc"),
        draft.printSlideHeight,
        (value) => {
          draft.printSlideHeight = value;
        }
      );
      addNumberSetting(
        ea2,
        contentEl,
        t("settingsMaxZoom"),
        t("settingsMaxZoomDesc"),
        draft.maxZoom,
        (value) => {
          draft.maxZoom = value;
        }
      );
      const actions = contentEl.createDiv({ cls: "modal-button-container" });
      const resetButton = actions.createEl("button", { text: t("settingsResetDefaults") });
      resetButton.addEventListener("click", () => {
        resetSlideshowConfigToDefaults(draft);
        renderContent();
      });
      const cancelButton = actions.createEl("button", { text: t("settingsCancel") });
      cancelButton.addEventListener("click", () => modal.close());
      const saveButton = actions.createEl("button", {
        text: t("settingsSave"),
        cls: "mod-cta"
      });
      saveButton.addEventListener("click", () => {
        void (async () => {
          try {
            const normalized = normalizeSlideshowConfig(
              draft
            );
            await saveSlideshowConfig(ea2, normalized);
            Object.assign(config, normalized);
            onSaved();
            modal.close();
            new Notice(t("settingsSaved"));
          } catch (error) {
            console.error("Slideshow settings save failed", error);
            new Notice(t("settingsSaveFailed"));
          }
        })();
      });
    };
    modal.onOpen = renderContent;
    modal.open();
  }

  // src/scripts/slideshow/styles.ts
  var SLIDESHOW_SIDEPANEL_STYLES = `
.slideshow-sidepanel { display:flex; flex-direction:column; gap:12px; padding:10px; height:100%; box-sizing:border-box; container-type:inline-size; container-name:slideshow-panel; }
.slideshow-sidepanel__support { color:var(--text-muted); font-size:var(--font-ui-smaller); line-height:1.3; }
.slideshow-sidepanel__support a { color:var(--text-accent); }
.slideshow-sidepanel__header { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.slideshow-sidepanel__header button { display:inline-flex; align-items:center; justify-content:center; gap:6px; }
.slideshow-sidepanel__header .slideshow-sidepanel__icon-button { width:36px; height:36px; min-width:36px; padding:7px; }
.slideshow-sidepanel__launch-main { flex:0 0 auto; }
.slideshow-sidepanel__launch-settings { border:1px solid var(--background-modifier-border); border-radius:8px; background:var(--background-secondary-alt); overflow:visible; }
.slideshow-sidepanel__launch-settings-summary { cursor:pointer; padding:8px 10px; color:var(--text-muted); font-size:var(--font-ui-small); font-weight:600; user-select:none; }
.slideshow-sidepanel__launch-settings[open] .slideshow-sidepanel__launch-settings-summary { border-bottom:1px solid var(--background-modifier-border); }
.slideshow-sidepanel__launch-options { display:flex; flex-direction:column; gap:7px; padding:9px; }
.slideshow-sidepanel__launch-option { display:block; min-width:0; }
.slideshow-sidepanel__launch-option select { width:100%; min-width:0; }
.slideshow-sidepanel__display-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:0 9px 9px; }
.slideshow-sidepanel__display-controls label { min-width:0; display:flex; flex-direction:column; gap:4px; color:var(--text-muted); font-size:var(--font-ui-smaller); }
.slideshow-sidepanel__display-controls select { min-width:0; width:100%; }
.slideshow-sidepanel__summary-row { display:flex; align-items:center; gap:6px; min-width:0; }
.slideshow-sidepanel__summary { flex:1 1 auto; min-width:0; color:var(--text-muted); font-size:var(--font-ui-smaller); }
.slideshow-sidepanel__thumbnail-size-control { flex:0 1 180px; min-width:100px; max-width:240px; display:flex; align-items:center; }
.slideshow-sidepanel__thumbnail-size-control input { width:100%; min-width:0; margin:0; }
.slideshow-sidepanel__presentation-settings { flex:0 0 auto; width:28px; height:28px; min-width:28px; padding:5px; }
.slideshow-sidepanel__path-actions { display:flex; flex-wrap:wrap; gap:8px; }
.slideshow-sidepanel__path-actions button { display:inline-flex; align-items:center; gap:6px; }
.slideshow-sorter { display:flex; flex-direction:column; gap:8px; min-height:0; overflow:auto; padding-right:2px; align-items:flex-start; }
.slideshow-sorter__row { position:relative; display:flex; flex-direction:column; gap:7px; width:100%; box-sizing:border-box; border:1px solid var(--background-modifier-border); border-radius:8px; padding:8px; background:var(--background-primary); outline:none; transition:margin .1s ease; }
.slideshow-sorter__row:focus, .slideshow-sorter__row.is-selected { border-color:var(--interactive-accent); box-shadow:0 0 0 1px var(--interactive-accent); }
.slideshow-sorter__row.is-excluded { opacity:.5; }
.slideshow-sorter__row.is-dragging { opacity:.35; }
.slideshow-sorter__row.is-drop-before { margin-top:22px; }
.slideshow-sorter__row.is-drop-after { margin-bottom:22px; }
.slideshow-sorter__row.is-drop-before::before, .slideshow-sorter__row.is-drop-after::after { content:""; position:absolute; left:8px; right:8px; border-top:2px dashed var(--interactive-accent); pointer-events:none; }
.slideshow-sorter__row.is-drop-before::before { top:-13px; }
.slideshow-sorter__row.is-drop-after::after { bottom:-13px; }
.slideshow-sorter__top { display:flex; flex-direction:column; gap:5px; align-items:stretch; padding:6px 8px; border-radius:6px; background:var(--background-secondary); }
.slideshow-sorter__top.is-draggable { cursor:grab; user-select:none; background-color:var(--background-secondary); background-image:radial-gradient(circle, var(--background-modifier-border-hover) .8px, transparent .9px); background-size:5px 5px; }
.slideshow-sorter__top.is-draggable:active { cursor:grabbing; }
.slideshow-sorter__title-row { display:flex; align-items:center; gap:5px; width:100%; min-width:0; }
.slideshow-sorter__title { flex:1 1 auto; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.35; }
.slideshow-sorter__title-edit { flex:0 0 auto; width:22px; height:22px; min-width:22px; padding:3px; display:flex; align-items:center; justify-content:center; }
.slideshow-sidepanel .slideshow-sorter__title-edit svg { width:14px; height:14px; }
.slideshow-sorter__badges { width:100%; min-width:0; display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end; color:var(--text-muted); font-size:var(--font-ui-smaller); }
.slideshow-sorter__badge { display:inline-flex; align-items:center; gap:3px; white-space:nowrap; }
.slideshow-sorter__badge svg { width:14px; height:14px; }
.slideshow-sorter__badge-compact-count { display:none; }
.slideshow-sorter__content { display:flex; flex-direction:column; gap:6px; align-items:flex-start; min-width:0; }
.slideshow-sorter__preview { width:min(100%, var(--slideshow-sorter-thumbnail-max-width, 280px)); aspect-ratio:16/9; overflow:hidden; border-radius:5px; background:var(--background-secondary); display:flex; align-items:center; justify-content:center; }
.slideshow-sorter__preview svg { width:100%; height:100%; display:block; }
.slideshow-sorter__actions { display:flex; flex-wrap:wrap; gap:3px; align-items:center; }
.slideshow-sorter__actions button { width:30px; height:30px; padding:5px; display:flex; align-items:center; justify-content:center; }
.slideshow-sorter__actions button.is-active { color:var(--interactive-accent); background:var(--background-modifier-hover); }
.slideshow-sorter__actions svg { width:16px; height:16px; }
.slideshow-notes { border-top:1px solid var(--background-modifier-border); padding-top:8px; display:flex; flex-direction:column; gap:7px; }
.slideshow-notes textarea { width:100%; min-height:100px; resize:vertical; box-sizing:border-box; }
.slideshow-notes__hint, .slideshow-warning, .slideshow-empty { color:var(--text-muted); font-size:var(--font-ui-smaller); }
.slideshow-warning { padding:8px; border-radius:6px; background:var(--background-secondary); }
.slideshow-sorter__animation { border-top:1px solid var(--background-modifier-border); padding-top:8px; }
.slideshow-animation-editor { display:flex; flex-direction:column; gap:10px; min-height:0; overflow:visible; padding-bottom:4px; }
.slideshow-animation-editor__hint, .slideshow-animation-editor__muted { color:var(--text-muted); font-size:var(--font-ui-smaller); }
.slideshow-animation-editor__section { display:flex; flex-direction:column; gap:6px; }
.slideshow-animation-editor__section-title { font-weight:600; font-size:var(--font-ui-small); }
.slideshow-animation-editor__targets { display:flex; flex-wrap:wrap; gap:5px; }
.slideshow-animation-editor__target { display:inline-flex; align-items:center; gap:4px; padding:3px 4px 3px 7px; border-radius:999px; background:var(--background-secondary); font-size:var(--font-ui-smaller); }
.slideshow-animation-editor__target button { width:22px; height:22px; min-width:22px; padding:3px; display:flex; align-items:center; justify-content:center; }
.slideshow-animation-editor__form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.slideshow-animation-editor__form label { display:flex; flex-direction:column; gap:4px; color:var(--text-muted); font-size:var(--font-ui-smaller); }
.slideshow-animation-editor__form select, .slideshow-animation-editor__form input { width:100%; box-sizing:border-box; }
.slideshow-animation-editor__form-actions { display:flex; flex-wrap:wrap; gap:6px; }
.slideshow-animation-editor__form-actions button { display:inline-flex; align-items:center; gap:5px; }
.slideshow-animation-editor__steps { display:flex; flex-direction:column; gap:6px; }
.slideshow-animation-editor__step { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:6px; padding:6px; border:1px solid var(--background-modifier-border); border-radius:6px; background:var(--background-primary); }
.slideshow-animation-editor__step.is-selected { border-color:var(--interactive-accent); box-shadow:0 0 0 1px var(--interactive-accent); }
.slideshow-animation-editor__step-summary { min-width:0; text-align:left; white-space:normal; }
.slideshow-animation-editor__step-actions { display:grid; grid-template-columns:repeat(2,28px); gap:3px; }
.slideshow-animation-editor__step-actions button { width:28px; height:28px; padding:4px; display:flex; align-items:center; justify-content:center; }

@container slideshow-panel (max-width: 390px) {
  .slideshow-sidepanel__display-controls { grid-template-columns:1fr; }
  .slideshow-animation-editor__form { grid-template-columns:1fr; }
  .slideshow-animation-editor__step { grid-template-columns:1fr; }
  .slideshow-animation-editor__step-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; }
  .slideshow-sorter__actions { justify-content:flex-end; }
}

.slideshow-sorter:not(.has-expanded-editor) {
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(160px,max(160px,var(--slideshow-sorter-thumbnail-max-width,280px))));
  align-content:start;
  align-items:stretch;
}
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row { width:100%; height:100%; box-sizing:border-box; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__top { min-height:0; box-sizing:border-box; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badges { min-height:18px; flex-wrap:nowrap; overflow:hidden; align-items:center; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badge { flex:0 0 auto; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badge-text { display:none; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badge-compact-count { display:inline; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__content { flex:1 1 auto; justify-content:space-between; align-items:center; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__preview { width:min(100%,var(--slideshow-sorter-thumbnail-max-width,280px)); margin-inline:auto; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__actions { width:100%; justify-content:center; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__actions button { width:26px; height:26px; padding:4px; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__actions svg { width:15px; height:15px; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row.is-drop-before,
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row.is-drop-after { margin:0; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row.is-drop-before::before,
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row.is-drop-after::after { top:8px; bottom:8px; width:0; border-top:0; border-left:2px dashed var(--interactive-accent); }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row.is-drop-before::before { left:-6px; right:auto; }
.slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row.is-drop-after::after { right:-6px; left:auto; }
.slideshow-sorter.has-expanded-editor .slideshow-sorter__row { width:min(100%,820px); box-sizing:border-box; }

@container slideshow-panel (max-width: 300px) {
  .slideshow-sorter:not(.has-expanded-editor) { display:flex; }
  .slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__row { width:100%; height:auto; }
  .slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__top { min-height:0; }
  .slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badges { min-height:0; flex-wrap:wrap; overflow:visible; }
  .slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badge-text { display:inline; }
  .slideshow-sorter:not(.has-expanded-editor) .slideshow-sorter__badge-compact-count { display:none; }
  .slideshow-sorter__actions { justify-content:flex-start; }
}

.slideshow-sidepanel button svg { width:16px; height:16px; }
`;
  var SLIDESHOW_PRESENTER_STYLES = `
.slideshow-presenter { display:flex; flex-direction:column; gap:14px; height:100%; box-sizing:border-box; padding:16px; overflow:auto; background:var(--background-primary); color:var(--text-normal); }
.slideshow-presenter__header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.slideshow-presenter__heading { min-width:0; display:flex; flex-direction:column; gap:3px; }
.slideshow-presenter__title { font-size:var(--font-ui-large); font-weight:700; line-height:1.25; overflow-wrap:anywhere; }
.slideshow-presenter__counter { color:var(--text-muted); font-size:var(--font-ui-small); }
.slideshow-presenter__header-actions { display:flex; gap:6px; flex:0 0 auto; }
.slideshow-presenter__font-size-control { display:none; align-items:center; gap:6px; color:var(--text-muted); font-size:var(--font-ui-smaller); white-space:nowrap; }
.slideshow-presenter__font-size-control input { width:120px; }
.slideshow-presenter__close, .slideshow-presenter__layout-toggle { flex:0 0 auto; width:38px; height:38px; display:flex; align-items:center; justify-content:center; }
.slideshow-presenter__layout-toggle.is-active { color:var(--interactive-accent); background:var(--background-modifier-hover); }
.slideshow-presenter__grid { display:grid; flex:1 1 auto; grid-template-columns:minmax(220px,.8fr) minmax(300px,1.2fr); grid-template-rows:auto minmax(160px,1fr); grid-template-areas:"current next" "notes next"; gap:16px; align-items:stretch; min-height:0; }
.slideshow-presenter__column { min-width:0; display:flex; flex-direction:column; gap:9px; }
.slideshow-presenter__column:nth-child(1) { grid-area:current; }
.slideshow-presenter__column:nth-child(2) { grid-area:next; }
.slideshow-presenter__notes-column { grid-area:notes; min-height:0; height:100%; }
.slideshow-presenter__section-title { color:var(--text-muted); font-size:var(--font-ui-smaller); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.slideshow-presenter__preview { width:100%; overflow:hidden; border-radius:8px; background:var(--background-secondary); border:1px solid var(--background-modifier-border); display:flex; align-items:center; justify-content:center; }
.slideshow-presenter__preview svg { width:100%; height:100%; display:block; }
.slideshow-presenter__current-preview { max-width:520px; }
.slideshow-presenter__next-preview { width:100%; }
.slideshow-presenter__end { display:flex; align-items:center; justify-content:center; min-height:180px; color:var(--text-muted); font-size:var(--font-ui-medium); border:1px dashed var(--background-modifier-border); border-radius:8px; }
.slideshow-presenter__notes { flex:1 1 auto; min-height:120px; padding:12px; border-radius:8px; background:var(--background-secondary); border:1px solid var(--background-modifier-border); overflow-wrap:anywhere; overflow:auto; }
.slideshow-presenter__notes.is-empty { color:var(--text-muted); font-style:italic; }
.slideshow-presenter__progress { display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:var(--font-ui-small); }
.slideshow-presenter__controls { display:flex; flex-wrap:wrap; gap:8px; margin-top:auto; padding-top:4px; }
.slideshow-presenter__controls button { min-width:44px; min-height:40px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
.slideshow-presenter__controls svg, .slideshow-presenter__close svg, .slideshow-presenter__layout-toggle svg { width:18px; height:18px; }
.slideshow-presenter.is-notes-focused { overflow:hidden; }
.slideshow-presenter.is-notes-focused .slideshow-presenter__grid { flex:1; grid-template-columns:minmax(0,17fr) minmax(150px,3fr); grid-template-rows:minmax(0,1fr) minmax(0,1fr); grid-template-areas:"notes current" "notes next"; align-items:stretch; }
.slideshow-presenter.is-notes-focused .slideshow-presenter__notes-column { min-height:0; }
.slideshow-presenter.is-notes-focused .slideshow-presenter__font-size-control { display:flex; }
.slideshow-presenter.is-notes-focused .slideshow-presenter__notes { flex:1; min-height:0; font-size:var(--slideshow-presenter-notes-font-size, 18px); }
.slideshow-presenter.is-notes-focused .slideshow-presenter__current-preview { max-width:none; }
.slideshow-presenter.is-notes-focused .slideshow-presenter__column:nth-child(1), .slideshow-presenter.is-notes-focused .slideshow-presenter__column:nth-child(2) { min-height:0; overflow:hidden; }
@media (max-width: 700px) {
  .slideshow-presenter__grid, .slideshow-presenter.is-notes-focused .slideshow-presenter__grid { flex:none; grid-template-columns:1fr; grid-template-rows:auto; grid-template-areas:"current" "next" "notes"; }
  .slideshow-presenter__current-preview { max-width:none; }
  .slideshow-presenter.is-notes-focused { overflow:auto; }
}
`;

  // src/scripts/slideshow/PresenterViewController.ts
  async function waitForPresenterOwnerWindow(leaf, hostWindow, timeoutMs = 3e3) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      const win = leaf.view.containerEl.ownerDocument.defaultView;
      if (win && win !== hostWindow) return { win, elapsedMs: Date.now() - started };
      await sleepInWindow(hostWindow, 50);
    }
    return { win: null, elapsedMs: Date.now() - started };
  }
  function getPresenterKeyboardAction(key) {
    switch (key) {
      case " ":
      case "Space":
      case "Spacebar":
      case "ArrowRight":
      case "ArrowDown":
        return "next";
      case "ArrowLeft":
      case "ArrowUp":
        return "previous";
      case "Home":
        return "first";
      case "End":
        return "last";
      case "Backspace":
      case "Escape":
        return "finish";
      default:
        return null;
    }
  }
  var PresenterViewController = class {
    constructor(options) {
      this.options = options;
      this.previewService = new SlidePreviewService(options.ea, options.api, options.config);
      this.notesFontSize = loadPresenterNotesFontSize(options.ea);
    }
    leaf = null;
    ownerWindow = null;
    root = null;
    titleEl = null;
    counterEl = null;
    currentPreviewEl = null;
    nextPreviewEl = null;
    notesEl = null;
    progressEl = null;
    layoutButton = null;
    notesFocusedLayout = false;
    notesFontSize;
    nextSectionTitleEl = null;
    markdownComponent = null;
    lastNotesSlideId = null;
    updateGeneration = 0;
    previewQueue = Promise.resolve();
    closed = false;
    destroying = false;
    previewService;
    /** Opens the popout, waits for real window migration, and renders its initial state. */
    async open(initialState) {
      if (this.leaf) {
        this.update(initialState);
        await app.workspace.revealLeaf(this.leaf);
        app.workspace.setActiveLeaf(this.leaf, { focus: true });
        return;
      }
      const leaf = app.workspace.openPopoutLeaf();
      this.leaf = leaf;
      await app.workspace.revealLeaf(leaf);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const migrated = await waitForPresenterOwnerWindow(leaf, this.options.hostView.ownerWindow);
      const win = migrated.win;
      if (!win) {
        leaf.detach();
        this.leaf = null;
        throw new Error("Presenter popout did not migrate to a distinct window.");
      }
      const container = leaf.view.containerEl;
      const doc = container.ownerDocument;
      this.ownerWindow = win;
      doc.title = this.options.t("presenterViewTitle");
      const headerTitle = container.querySelector(".view-header-title");
      if (headerTitle) headerTitle.textContent = this.options.t("presenterViewTitle");
      const content = container.querySelector(".view-content") ?? container;
      content.replaceChildren();
      this.renderShell(content, doc);
      win.addEventListener("keydown", this.keydownListener, true);
      win.addEventListener("beforeunload", this.windowClosingListener, { once: true });
      this.update(initialState);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      await sleepInWindow(win, 100);
      if (this.options.targetDisplayId !== void 0) {
        const sameNative = resolveSameNativeWindow(this.options.hostView.ownerWindow, win);
        if (sameNative === false) {
          const moved = moveWindowToDisplay(win, this.options.targetDisplayId, true);
          if (moved) {
            await waitForWindowOnDisplay(win, this.options.targetDisplayId, 2500);
            await sleepInWindow(win, 150);
          }
        }
      }
    }
    /** Brings an already-open presenter window to the foreground. */
    async focus() {
      if (!this.leaf) return;
      await app.workspace.revealLeaf(this.leaf);
      app.workspace.setActiveLeaf(this.leaf, { focus: true });
    }
    /** Updates text synchronously and refreshes previews/Markdown asynchronously. */
    update(state) {
      if (this.closed || !this.root) return;
      const slide = this.getSlide(state.currentSlideId);
      if (this.titleEl) {
        this.titleEl.textContent = slide?.title ?? this.options.t("slideLabel", { number: state.currentIndex + 1 });
      }
      if (this.counterEl) {
        this.counterEl.textContent = this.options.t("presenterSlideCounter", {
          number: state.currentIndex + 1,
          total: state.visibleSlideCount
        });
      }
      if (this.progressEl) {
        this.progressEl.textContent = state.animationStepCount > 0 ? this.options.t("presenterAnimationProgress", {
          completed: state.completedAnimationSteps,
          total: state.animationStepCount
        }) : this.options.t("presenterNoAnimations");
      }
      if (this.nextSectionTitleEl) {
        this.nextSectionTitleEl.textContent = state.nextAction === "build" ? this.options.t("presenterNextBuild") : this.options.t("presenterNextSlide");
      }
      const generation = ++this.updateGeneration;
      if (state.currentSlideId !== this.lastNotesSlideId) {
        this.lastNotesSlideId = state.currentSlideId;
        void this.renderNotes(slide, generation);
      }
      const queuedPreview = this.previewQueue.then(async () => {
        if (generation !== this.updateGeneration || this.closed) return;
        await this.renderPreviews(state, generation);
      });
      this.previewQueue = queuedPreview.catch((error) => {
        console.error("Slideshow presenter preview failed", error);
      });
    }
    /** Waits for any in-flight EA-backed preview export to release the shared workbench. */
    async waitForIdle() {
      await this.previewQueue;
    }
    /** Removes listeners/renderers and optionally detaches the presenter leaf/popout. */
    async destroy(detachLeaf = true) {
      if (this.destroying) return;
      this.destroying = true;
      const leaf = this.leaf;
      const win = this.ownerWindow;
      this.closed = true;
      this.updateGeneration += 1;
      if (win) {
        win.removeEventListener("keydown", this.keydownListener, true);
        win.removeEventListener("beforeunload", this.windowClosingListener);
      }
      this.markdownComponent?.unload();
      this.markdownComponent = null;
      this.root?.remove();
      this.root = null;
      this.leaf = null;
      this.ownerWindow = null;
      if (detachLeaf && leaf) {
        try {
          leaf.detach();
        } catch {
        }
      }
      await this.previewQueue.catch(() => void 0);
      this.previewService.clear();
      this.options.onClosed();
    }
    renderShell(content, doc) {
      const style = doc.createElement("style");
      style.textContent = SLIDESHOW_PRESENTER_STYLES;
      content.appendChild(style);
      const root = doc.createElement("div");
      root.className = "slideshow-presenter";
      root.style.setProperty("--slideshow-presenter-notes-font-size", `${this.notesFontSize}px`);
      content.appendChild(root);
      this.root = root;
      const header = doc.createElement("div");
      header.className = "slideshow-presenter__header";
      root.appendChild(header);
      const heading = doc.createElement("div");
      heading.className = "slideshow-presenter__heading";
      header.appendChild(heading);
      this.titleEl = doc.createElement("div");
      this.titleEl.className = "slideshow-presenter__title";
      heading.appendChild(this.titleEl);
      this.counterEl = doc.createElement("div");
      this.counterEl.className = "slideshow-presenter__counter";
      heading.appendChild(this.counterEl);
      const headerActions = doc.createElement("div");
      headerActions.className = "slideshow-presenter__header-actions";
      header.appendChild(headerActions);
      this.layoutButton = doc.createElement("button");
      this.layoutButton.type = "button";
      this.layoutButton.className = "slideshow-presenter__layout-toggle";
      this.layoutButton.innerHTML = this.options.icons.notebookPen;
      this.layoutButton.addEventListener("click", () => this.toggleNotesFocusedLayout());
      headerActions.appendChild(this.layoutButton);
      this.updateLayoutButton();
      const fontSizeControl = doc.createElement("label");
      fontSizeControl.className = "slideshow-presenter__font-size-control";
      fontSizeControl.setAttribute("aria-label", this.options.t("presenterNotesFontSize"));
      const fontSizeLabel = doc.createElement("span");
      fontSizeLabel.textContent = this.options.t("presenterNotesFontSize");
      fontSizeControl.appendChild(fontSizeLabel);
      const fontSizeSlider = doc.createElement("input");
      fontSizeSlider.type = "range";
      fontSizeSlider.min = "12";
      fontSizeSlider.max = "48";
      fontSizeSlider.step = "1";
      fontSizeSlider.value = String(this.notesFontSize);
      fontSizeSlider.addEventListener("input", () => {
        this.notesFontSize = Number(fontSizeSlider.value);
        root.style.setProperty("--slideshow-presenter-notes-font-size", `${this.notesFontSize}px`);
      });
      fontSizeSlider.addEventListener("change", () => {
        void savePresenterNotesFontSize(this.options.ea, this.notesFontSize).catch((error) => {
          console.error("Slideshow presenter notes font-size save failed", error);
        });
      });
      fontSizeControl.appendChild(fontSizeSlider);
      headerActions.appendChild(fontSizeControl);
      const close = doc.createElement("button");
      close.type = "button";
      close.className = "slideshow-presenter__close";
      close.setAttribute("aria-label", this.options.t("presenterClose"));
      close.innerHTML = this.options.icons.close;
      close.addEventListener("click", () => void this.destroy(true));
      headerActions.appendChild(close);
      const grid = doc.createElement("div");
      grid.className = "slideshow-presenter__grid";
      root.appendChild(grid);
      const currentColumn = doc.createElement("section");
      currentColumn.className = "slideshow-presenter__column";
      grid.appendChild(currentColumn);
      currentColumn.appendChild(this.sectionTitle(doc, this.options.t("presenterCurrentSlide")));
      this.currentPreviewEl = doc.createElement("div");
      this.currentPreviewEl.className = "slideshow-presenter__preview slideshow-presenter__current-preview";
      this.currentPreviewEl.style.aspectRatio = this.previewService.getAspectRatio();
      currentColumn.appendChild(this.currentPreviewEl);
      const nextColumn = doc.createElement("section");
      nextColumn.className = "slideshow-presenter__column";
      grid.appendChild(nextColumn);
      this.nextSectionTitleEl = this.sectionTitle(doc, this.options.t("presenterNextSlide"));
      nextColumn.appendChild(this.nextSectionTitleEl);
      this.nextPreviewEl = doc.createElement("div");
      this.nextPreviewEl.className = "slideshow-presenter__preview slideshow-presenter__next-preview";
      this.nextPreviewEl.style.aspectRatio = this.previewService.getAspectRatio();
      nextColumn.appendChild(this.nextPreviewEl);
      this.progressEl = doc.createElement("div");
      this.progressEl.className = "slideshow-presenter__progress";
      nextColumn.appendChild(this.progressEl);
      const notesColumn = doc.createElement("section");
      notesColumn.className = "slideshow-presenter__column slideshow-presenter__notes-column";
      grid.appendChild(notesColumn);
      notesColumn.appendChild(this.sectionTitle(doc, this.options.t("presenterNotes")));
      this.notesEl = doc.createElement("div");
      this.notesEl.className = "slideshow-presenter__notes";
      notesColumn.appendChild(this.notesEl);
      const controls = doc.createElement("div");
      controls.className = "slideshow-presenter__controls";
      root.appendChild(controls);
      controls.appendChild(this.iconButton(doc, this.options.icons.leftArrow, this.options.t("previousSlide"), this.options.callbacks.previous));
      controls.appendChild(this.iconButton(doc, this.options.icons.rightArrow, this.options.t("nextSlide"), this.options.callbacks.next));
      controls.appendChild(this.iconButton(doc, this.options.icons.finish, this.options.t("endPresentation"), this.options.callbacks.finish));
    }
    toggleNotesFocusedLayout() {
      this.notesFocusedLayout = !this.notesFocusedLayout;
      this.root?.classList.toggle("is-notes-focused", this.notesFocusedLayout);
      this.updateLayoutButton();
    }
    updateLayoutButton() {
      if (!this.layoutButton) return;
      const label = this.options.t(
        this.notesFocusedLayout ? "presenterStandardLayout" : "presenterNotesFocusLayout"
      );
      this.layoutButton.setAttribute("aria-label", label);
      this.layoutButton.classList.toggle("is-active", this.notesFocusedLayout);
    }
    sectionTitle(doc, text) {
      const title = doc.createElement("div");
      title.className = "slideshow-presenter__section-title";
      title.textContent = text;
      return title;
    }
    iconButton(doc, icon, label, callback) {
      const button = doc.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.innerHTML = icon;
      button.addEventListener("click", callback);
      return button;
    }
    getSlide(slideId) {
      if (!slideId) return null;
      return this.options.setup.deck.visibleSlides.find((slide) => slide.id === slideId) ?? null;
    }
    async renderNotes(slide, generation) {
      const notesEl = this.notesEl;
      if (!notesEl) return;
      this.markdownComponent?.unload();
      this.markdownComponent = null;
      notesEl.replaceChildren();
      const notes = slide?.notes?.trim() ?? "";
      notesEl.classList.toggle("is-empty", notes.length === 0);
      if (!notes) {
        notesEl.textContent = this.options.t("presenterNoNotes");
        return;
      }
      const component = new this.options.ea.obsidian.Component();
      component.load();
      this.markdownComponent = component;
      try {
        await this.options.ea.obsidian.MarkdownRenderer.render(
          app,
          notes,
          notesEl,
          this.options.hostView.file.path,
          component
        );
        if (generation !== this.updateGeneration) component.unload();
      } catch (error) {
        if (generation === this.updateGeneration) notesEl.textContent = notes;
        console.error("Slideshow presenter notes render failed", error);
      }
    }
    async renderPreviews(state, generation) {
      const currentHost = this.currentPreviewEl;
      const nextHost = this.nextPreviewEl;
      if (!currentHost || !nextHost) return;
      const doc = currentHost.ownerDocument;
      const currentSlide = this.getSlide(state.currentSlideId);
      const nextSlide = this.getSlide(state.nextSlideId);
      const originalOpacities = this.options.getAnimationOriginalOpacities?.();
      const currentPreview = currentSlide ? await this.previewService.createPreview(
        currentSlide,
        doc,
        currentSlide.kind === "frame" ? {
          completedAnimationSteps: state.completedAnimationSteps,
          ...originalOpacities ? { originalOpacities } : {},
          targetWidth: 1280
        } : { targetWidth: 1280 }
      ) : null;
      const nextPreview = nextSlide ? await this.previewService.createPreview(
        nextSlide,
        doc,
        nextSlide.kind === "frame" ? {
          completedAnimationSteps: state.nextCompletedAnimationSteps ?? 0,
          ...originalOpacities ? { originalOpacities } : {},
          targetWidth: 1280
        } : { targetWidth: 1280 }
      ) : null;
      if (generation !== this.updateGeneration || this.closed) return;
      currentHost.replaceChildren();
      if (currentPreview) currentHost.appendChild(currentPreview);
      nextHost.replaceChildren();
      if (nextPreview) {
        nextHost.classList.remove("slideshow-presenter__end");
        nextHost.appendChild(nextPreview);
      } else {
        nextHost.classList.add("slideshow-presenter__end");
        nextHost.textContent = this.options.t("presenterEnd");
      }
    }
    keydownListener = (event) => {
      if (event.defaultPrevented || event.repeat) return;
      const target = event.target;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const action = getPresenterKeyboardAction(event.key);
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      switch (action) {
        case "next":
          this.options.callbacks.next();
          break;
        case "previous":
          this.options.callbacks.previous();
          break;
        case "first":
          this.options.callbacks.first();
          break;
        case "last":
          this.options.callbacks.last();
          break;
        case "finish":
          this.options.callbacks.finish();
          break;
      }
    };
    windowClosingListener = () => {
      void this.destroy(false);
    };
  };

  // src/scripts/slideshow/presentationState.ts
  function buildPresentationState(deck, currentIndex, animationState = { completedSteps: 0, stepCount: 0 }) {
    const visibleSlides = deck.visibleSlides;
    const boundedIndex = Math.min(Math.max(currentIndex, 0), Math.max(visibleSlides.length - 1, 0));
    const current = visibleSlides[boundedIndex];
    const followingSlide = visibleSlides[boundedIndex + 1];
    const hasPendingBuild = Boolean(current) && animationState.completedSteps < animationState.stepCount;
    return {
      currentSlideId: current?.id ?? "",
      currentIndex: boundedIndex,
      visibleSlideCount: visibleSlides.length,
      completedAnimationSteps: animationState.completedSteps,
      animationStepCount: animationState.stepCount,
      nextSlideId: hasPendingBuild ? current?.id ?? null : followingSlide?.id ?? null,
      nextAction: hasPendingBuild ? "build" : followingSlide ? "slide" : "end",
      nextCompletedAnimationSteps: hasPendingBuild ? Math.min(animationState.completedSteps + 1, animationState.stepCount) : followingSlide ? 0 : null
    };
  }

  // src/sharedUtils/SingleNotice.ts
  var SingleNotice = class {
    notice = null;
    noticeElement = null;
    /** Shows a new notice or replaces the current notice's message. */
    setMessage(message) {
      if (this.notice && this.noticeElement?.parentElement) {
        this.notice.setMessage(message);
        return;
      }
      this.notice = new Notice(message, 0);
      this.noticeElement = this.notice.containerEl ?? this.notice.noticeEl;
    }
    /** Hides the notice if it is currently attached. */
    hide() {
      if (this.noticeElement?.parentElement) {
        this.notice?.hide();
      }
    }
  };

  // src/scripts/slideshow/printToPdf.ts
  async function printSlideshowToPdf(options) {
    const { event, ea: ea2, api, slides, printSlideWidth, printSlideHeight, maxZoom, t } = options;
    const appState = api.getAppState();
    const slideWidth = event.shiftKey ? appState.width : printSlideWidth;
    const slideHeight = event.shiftKey ? appState.height : printSlideHeight;
    const shouldClipFrames = false;
    const notice = new SingleNotice();
    notice.setMessage(t("generatingImage"));
    const pages = [];
    for (const [index, slide] of slides.entries()) {
      notice.setMessage(t("generatingSlide", { number: index + 1 }));
      const rect = getNavigationRect(
        slide,
        { width: slideWidth, height: slideHeight },
        maxZoom
      );
      const width = Math.abs(rect.left - rect.right);
      const height = Math.abs(rect.top - rect.bottom);
      const page = await ea2.createViewSVG({
        withBackground: true,
        theme: appState.theme,
        frameRendering: {
          enabled: shouldClipFrames,
          name: false,
          outline: false,
          clip: shouldClipFrames
        },
        padding: 0,
        selectedOnly: false,
        skipInliningFonts: false,
        embedScene: false,
        exportArea: {
          x: Math.min(rect.left, rect.right),
          y: Math.min(rect.top, rect.bottom),
          width,
          height
        }
      });
      page.setAttribute("width", `${width}`);
      page.setAttribute("height", `${height}`);
      pages.push(page);
    }
    notice.setMessage(t("creatingPdf"));
    try {
      await ea2.createPDF({
        SVG: pages,
        scale: { fitToPage: true },
        pageProps: {
          dimensions: { width: slideWidth, height: slideHeight },
          backgroundColor: api.getAppState().viewBackgroundColor,
          margin: { left: 0, right: 0, top: 0, bottom: 0 },
          alignment: "center"
        },
        filename: `${ea2.targetView?.file.basename ?? "slideshow"}.pdf`
      });
    } finally {
      notice.hide();
    }
  }

  // src/scripts/slideshow/SlideshowController.ts
  var SlideshowController = class {
    ea;
    api;
    hostView;
    hostLeaf;
    ownerWindow;
    ownerDocument;
    contentElement;
    setup;
    config;
    icons;
    statusBarElement;
    shouldStartFullscreen;
    openPresenterViewOnStart;
    presentationDisplayId;
    presenterDisplayId;
    t;
    onSlideChange;
    onExit;
    openSidepanel;
    animationRuntime;
    controls = null;
    presenter = null;
    slide;
    isFullscreen = false;
    isLaserOn = false;
    shouldSaveAfterPresentation = false;
    busy = false;
    preventFullscreenExit = true;
    exitPromise = null;
    navigationQueue = Promise.resolve();
    stateEmissionPauseDepth = 0;
    hostWindowPlacement = null;
    hostPlacementPrepared = false;
    hiddenMobileNavbars = [];
    constructor(options) {
      this.ea = options.ea;
      this.api = options.api;
      this.hostView = options.hostView;
      this.hostLeaf = options.hostView.leaf;
      this.ownerWindow = options.hostView.ownerWindow;
      this.ownerDocument = options.hostView.ownerDocument;
      this.contentElement = options.hostView.contentEl;
      this.setup = options.setup;
      this.config = options.config;
      this.icons = options.icons;
      this.statusBarElement = options.statusBarElement;
      this.slide = Math.min(
        Math.max(options.initialSlide, 0),
        Math.max(options.setup.slides.length - 1, 0)
      );
      this.shouldStartFullscreen = options.ea.DEVICE.isMobile ? true : options.startFullscreen;
      this.openPresenterViewOnStart = options.openPresenterViewOnStart ?? false;
      this.presentationDisplayId = options.presentationDisplayId;
      this.presenterDisplayId = options.presenterDisplayId;
      this.t = options.t;
      this.onSlideChange = options.onSlideChange;
      this.onExit = options.onExit;
      this.openSidepanel = options.openSidepanel;
      this.animationRuntime = options.setup.pathType === "frame" ? new AnimationRuntime({
        ea: options.ea,
        api: options.api,
        hostView: options.hostView,
        onStateChange: () => this.emitPresentationState()
      }) : null;
    }
    /** Starts the presentation and installs all temporary UI and handlers. */
    async start() {
      this.ea.setView(this.hostView);
      this.hideMobileNavbar();
      if (this.statusBarElement) this.statusBarElement.style.display = "none";
      this.ea.setViewModeEnabled(true);
      const helpButton = this.hostView.excalidrawContainer?.querySelector(
        ".ToolIcon__icon.help-icon"
      );
      if (helpButton) helpButton.style.display = "none";
      const zoomButton = this.hostView.excalidrawContainer?.querySelector(
        ".Stack.Stack_vertical.zoom-actions"
      );
      if (zoomButton) zoomButton.style.display = "none";
      this.createControls();
      this.initializeEventListeners();
      this.hostWindowPlacement = captureWindowPlacement(this.ownerWindow);
      if (this.openPresenterViewOnStart) {
        await this.openPresenterView();
        app.workspace.setActiveLeaf(this.hostLeaf, { focus: true });
      }
      await this.prepareHostWindowPlacement(this.shouldStartFullscreen);
      if (this.shouldStartFullscreen) await this.gotoFullscreen(false);
      else this.controls?.resetPosition(false);
      if (this.setup.pathType === "line") await this.togglePathVisibility(this.setup.isHidden);
      this.stateEmissionPauseDepth += 1;
      try {
        await this.enterSlide(this.slide, false);
      } finally {
        this.stateEmissionPauseDepth -= 1;
      }
      this.controls?.setSelectedSlide(this.slide + 1);
      this.emitPresentationState();
      this.hostView.clearDirty();
    }
    /** Advances this presentation when the script is invoked again for its view. */
    advance() {
      this.enqueueNavigation(() => this.navigate("fwd"));
    }
    /** Navigates backward through builds/slides from presenter-window controls. */
    previous() {
      this.enqueueNavigation(() => this.navigate("bkwd"));
    }
    /** Jumps directly to a zero-based visible slide index. */
    goToSlide(index) {
      this.enqueueNavigation(() => this.jumpToSlide(index));
    }
    /** Opens or focuses the desktop presenter popout for this presentation. */
    async openPresenterView() {
      if (this.ea.DEVICE.isMobile) {
        new Notice(this.t("presenterViewDesktopOnly"));
        return;
      }
      if (this.presenter) {
        await this.presenter.focus();
        this.presenter.update(this.getPresentationState());
        return;
      }
      const presenter = new PresenterViewController({
        ea: this.ea,
        api: this.api,
        hostView: this.hostView,
        setup: this.setup,
        config: this.config,
        icons: this.icons,
        t: this.t,
        callbacks: {
          previous: () => this.previous(),
          next: () => this.advance(),
          first: () => this.goToSlide(0),
          last: () => this.goToSlide(this.setup.slides.length - 1),
          finish: () => void this.exit()
        },
        ...this.presenterDisplayId === void 0 ? {} : { targetDisplayId: this.presenterDisplayId },
        getAnimationOriginalOpacities: () => this.animationRuntime?.getOriginalOpacities() ?? /* @__PURE__ */ new Map(),
        onClosed: () => {
          if (this.presenter === presenter) this.presenter = null;
        }
      });
      this.presenter = presenter;
      try {
        await presenter.open(this.getPresentationState());
      } catch (error) {
        if (this.presenter === presenter) this.presenter = null;
        await presenter.destroy(false).catch(() => void 0);
        console.error("Slideshow presenter view failed to open", error);
        new Notice(this.t("presenterViewOpenFailed"));
      }
    }
    /** Returns the authoritative state shared by floating controls and presenter view. */
    getPresentationState() {
      let animationState = this.animationRuntime?.getState() ?? { completedSteps: 0, stepCount: 0 };
      if (this.setup.pathType === "frame" && animationState.stepCount === 0 && this.setup.deck.visibleSlides[this.slide]?.kind === "frame") {
        const current = this.setup.deck.visibleSlides[this.slide];
        animationState = { completedSteps: 0, stepCount: current.animationSteps.length };
      }
      return buildPresentationState(this.setup.deck, this.slide, animationState);
    }
    emitPresentationState() {
      if (this.stateEmissionPauseDepth > 0) return;
      this.presenter?.update(this.getPresentationState());
    }
    enqueueNavigation(task) {
      const queued = this.navigationQueue.then(async () => {
        if (!this.exitPromise) await task();
      });
      this.navigationQueue = queued.catch((error) => {
        console.error("Slideshow navigation failed", error);
      });
    }
    createControls() {
      this.controls = new PresentationControls({
        ea: this.ea,
        ownerWindow: this.ownerWindow,
        ownerDocument: this.ownerDocument,
        contentElement: this.contentElement,
        slidesCount: this.setup.slides.length,
        pathType: this.setup.pathType,
        slideTitles: this.setup.slideTitles,
        shouldOfferPathVisibility: this.setup.shouldHidePathAfterPresentation,
        isPathHidden: this.setup.isHidden,
        isFullscreen: this.isFullscreen,
        fadeLevel: this.config.fadeLevel,
        transitionDelay: this.config.transitionDelay,
        printSlideWidth: this.config.printSlideWidth,
        printSlideHeight: this.config.printSlideHeight,
        icons: this.icons,
        t: this.t,
        callbacks: {
          previous: () => this.enqueueNavigation(() => this.navigate("bkwd")),
          next: () => this.enqueueNavigation(() => this.navigate("fwd")),
          navigateToSlide: (slideNumber) => this.enqueueNavigation(() => this.jumpToSlide(slideNumber - 1)),
          toggleLaser: () => this.toggleLaser(),
          refocus: () => this.enqueueNavigation(() => this.jumpToSlide(this.slide)),
          toggleFullscreen: () => this.enqueueNavigation(() => this.toggleFullscreen()),
          togglePathVisibility: (hidden) => {
            this.shouldSaveAfterPresentation = true;
            if (hidden) {
              this.api.setToast({
                message: this.t("pathWillRemainHidden"),
                duration: 5e3,
                closable: true
              });
            }
            void this.togglePathVisibility(hidden, true);
          },
          editSlide: () => {
            if (this.setup.shouldHidePathAfterPresentation) void this.togglePathVisibility(false);
            void this.exit(true);
          },
          openSidepanel: () => {
            void this.exit().then(() => this.openSidepanel());
          },
          print: (event) => void this.print(event),
          finish: () => void this.exit()
        }
      });
      this.controls.create();
    }
    toggleLaser() {
      this.isLaserOn = !this.isLaserOn;
      this.api.setActiveTool({ type: this.isLaserOn ? "laser" : "selection" });
      return this.isLaserOn;
    }
    async waitForExcalidrawResize() {
      await sleepInWindow(this.ownerWindow, 100);
      const deltaWidth = () => Math.abs(this.contentElement.clientWidth - this.api.getAppState().width);
      const deltaHeight = () => Math.abs(this.contentElement.clientHeight - this.api.getAppState().height);
      let watchdog = 0;
      while ((deltaWidth() > 50 || deltaHeight() > 50) && watchdog++ < 20) {
        await sleepInWindow(this.ownerWindow, 50);
      }
    }
    async prepareHostWindowPlacement(fillWorkArea) {
      if (this.hostPlacementPrepared || this.presentationDisplayId === void 0) return;
      this.hostWindowPlacement ??= captureWindowPlacement(this.ownerWindow);
      moveWindowToDisplay(
        this.ownerWindow,
        this.presentationDisplayId,
        fillWorkArea,
        false
      );
      this.hostPlacementPrepared = true;
      await waitForWindowOnDisplay(this.ownerWindow, this.presentationDisplayId, 3e3);
      await sleepInWindow(this.ownerWindow, 350);
      app.workspace.setActiveLeaf(this.hostLeaf, { focus: true });
    }
    async gotoFullscreen(refocus = true) {
      if (this.isFullscreen) return;
      this.preventFullscreenExit = true;
      await this.prepareHostWindowPlacement(true);
      this.animationRuntime?.pauseTimedStep();
      if (this.ea.DEVICE.isMobile) this.ea.viewToggleFullScreen();
      else await this.contentElement.webkitRequestFullscreen();
      await this.waitForExcalidrawResize();
      this.hideMobileNavbar();
      const layerUiWrapper = this.contentElement.querySelector(".layer-ui__wrapper");
      if (!layerUiWrapper?.hasClass("excalidraw-hidden")) layerUiWrapper?.addClass("excalidraw-hidden");
      this.controls?.setFullscreen(true);
      this.controls?.resetPosition(false);
      this.isFullscreen = true;
      if (refocus) await this.scrollToSlide(this.slide, 1);
      this.animationRuntime?.startPendingTimer();
    }
    async exitFullscreen(refocus = true, restoreHostPlacement = true) {
      if (!this.isFullscreen) return;
      this.preventFullscreenExit = true;
      this.animationRuntime?.pauseTimedStep();
      if (!this.ea.DEVICE.isMobile && this.ownerDocument.fullscreenElement) {
        await this.ownerDocument.exitFullscreen();
      }
      if (this.ea.DEVICE.isMobile) this.ea.viewToggleFullScreen();
      this.controls?.setFullscreen(false);
      await this.waitForExcalidrawResize();
      this.controls?.resetPosition(false);
      this.isFullscreen = false;
      if (restoreHostPlacement && this.hostWindowPlacement && this.hostPlacementPrepared) {
        await restoreWindowPlacementStable(this.ownerWindow, this.hostWindowPlacement);
        this.hostPlacementPrepared = false;
      }
      if (refocus) await this.scrollToSlide(this.slide, 1);
      this.animationRuntime?.startPendingTimer();
    }
    async toggleFullscreen() {
      if (this.isFullscreen) await this.exitFullscreen();
      else await this.gotoFullscreen();
    }
    async togglePathVisibility(setToHidden, isMetadataEdit = false) {
      await this.presenter?.waitForIdle();
      const pathElement = this.setup.pathElement;
      const originalProps = this.setup.originalPathProperties;
      if (!pathElement || !originalProps) return;
      this.ea.setView(this.hostView);
      this.ea.clear();
      this.ea.copyViewElementsToEAforEditing(
        this.ea.getViewElements().filter((element2) => element2.id === pathElement.id)
      );
      const element = this.ea.getElement(
        pathElement.id
      );
      if (!element) return;
      element.strokeColor = "transparent";
      element.backgroundColor = "transparent";
      const shouldRemainHidden = setToHidden && this.setup.shouldHidePathAfterPresentation;
      if (shouldRemainHidden) element.locked = true;
      if (isMetadataEdit) {
        const metadata = upgradeLineSlideshowData(
          element.customData,
          element.id,
          Math.floor(element.points.length / 2),
          originalProps
        );
        metadata.hidden = shouldRemainHidden;
        writeSlideshowMetadata(this.ea, element.id, metadata);
      }
      this.setup.isHidden = shouldRemainHidden;
      await this.ea.addElementsToView(
        false,
        isMetadataEdit,
        false,
        false,
        isMetadataEdit ? "IMMEDIATELY" : "NEVER"
      );
    }
    getSlideNavigationRect(index) {
      const targetSlide = this.setup.slides[index];
      if (!targetSlide) throw new Error(this.t("invalidSlide"));
      const appState = this.api.getAppState();
      return getNavigationRect(
        targetSlide,
        { width: appState.width, height: appState.height },
        this.config.maxZoom
      );
    }
    async scrollToSlide(index, steps = this.config.transitionStepCount) {
      await this.scrollToRect(this.getSlideNavigationRect(index), steps);
    }
    async enterSlide(index, fullyBuilt) {
      const deckSlide = this.setup.deck.visibleSlides[index];
      if (deckSlide?.kind === "frame" && this.animationRuntime) {
        await this.animationRuntime.enterSlide(deckSlide, fullyBuilt, false);
      } else {
        await this.animationRuntime?.leaveSlide();
      }
      await this.scrollToSlide(index);
      this.animationRuntime?.startPendingTimer();
    }
    async scrollToRect(rect, steps = this.config.transitionStepCount) {
      const startTimer = Date.now();
      let watchdog = 0;
      while (this.busy && watchdog++ < 15) await sleepInWindow(this.ownerWindow, 100);
      if (this.busy && watchdog >= 15) return;
      this.busy = true;
      try {
        this.api.updateScene({ appState: { shouldCacheIgnoreZoom: true } });
        const { scrollX, scrollY, zoom } = this.api.getAppState();
        const zoomStep = (zoom.value - rect.nextZoom) / steps;
        const xStep = (rect.left + scrollX) / steps;
        const yStep = (rect.top + scrollY) / steps;
        let index = 1;
        while (index <= steps) {
          this.api.updateScene({
            appState: {
              scrollX: scrollX - xStep * index,
              scrollY: scrollY - yStep * index,
              zoom: { value: zoom.value - zoomStep * index }
            }
          });
          const elapsed = Date.now() - startTimer;
          if (elapsed > this.config.transitionDelay) index = index < steps ? steps : steps + 1;
          else {
            const timeProgress = elapsed / this.config.transitionDelay;
            index = Math.min(Math.round(steps * timeProgress), steps);
            await sleepInWindow(this.ownerWindow, this.config.frameSleep);
          }
        }
        this.api.updateScene({ appState: { shouldCacheIgnoreZoom: false } });
        if (this.isLaserOn) this.api.setActiveTool({ type: "laser" });
      } finally {
        this.busy = false;
      }
    }
    async navigate(direction) {
      if (direction === "fwd") {
        if (await this.animationRuntime?.advance()) return;
        if (this.slide >= this.setup.slides.length - 1) {
          void this.exit();
          return;
        }
        this.stateEmissionPauseDepth += 1;
        try {
          await this.animationRuntime?.leaveSlide();
          this.slide += 1;
          this.controls?.setSelectedSlide(this.slide + 1);
          await this.enterSlide(this.slide, false);
        } finally {
          this.stateEmissionPauseDepth -= 1;
        }
        this.onSlideChange(this.slide);
        this.emitPresentationState();
        return;
      }
      if (await this.animationRuntime?.reverse()) return;
      if (this.slide <= 0) {
        void this.exit();
        return;
      }
      this.stateEmissionPauseDepth += 1;
      try {
        await this.animationRuntime?.leaveSlide();
        this.slide -= 1;
        this.controls?.setSelectedSlide(this.slide + 1);
        await this.enterSlide(this.slide, true);
      } finally {
        this.stateEmissionPauseDepth -= 1;
      }
      this.onSlideChange(this.slide);
      this.emitPresentationState();
    }
    async jumpToSlide(index) {
      const bounded = Math.min(Math.max(index, 0), this.setup.slides.length - 1);
      this.stateEmissionPauseDepth += 1;
      try {
        await this.animationRuntime?.leaveSlide();
        this.slide = bounded;
        this.controls?.setSelectedSlide(this.slide + 1);
        await this.enterSlide(this.slide, false);
      } finally {
        this.stateEmissionPauseDepth -= 1;
      }
      this.onSlideChange(this.slide);
      this.emitPresentationState();
    }
    keydownListener = (event) => {
      if (event.defaultPrevented || event.repeat) return;
      if (!this.ownerDocument.hasFocus()) return;
      if (this.hostLeaf !== app.workspace.activeLeaf) return;
      if (this.hostLeaf.width === 0 && this.hostLeaf.height === 0) return;
      switch (event.key) {
        case "Backspace":
        case "Escape":
          event.preventDefault();
          void this.exit();
          break;
        case "Space":
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          this.enqueueNavigation(() => this.navigate("fwd"));
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          this.enqueueNavigation(() => this.navigate("bkwd"));
          break;
        case "End":
          event.preventDefault();
          this.enqueueNavigation(() => this.jumpToSlide(this.setup.slides.length - 1));
          break;
        case "Home":
          event.preventDefault();
          this.enqueueNavigation(() => this.jumpToSlide(this.slide));
          break;
        case "e":
          if (this.setup.pathType !== "line") return;
          event.preventDefault();
          void (async () => {
            await this.togglePathVisibility(false);
            await this.exit(true);
          })();
          break;
        case "f":
          event.preventDefault();
          this.enqueueNavigation(() => this.toggleFullscreen());
          break;
      }
    };
    fullscreenListener = (event) => {
      if (this.preventFullscreenExit) {
        this.preventFullscreenExit = false;
        return;
      }
      event.preventDefault();
      void this.exit();
    };
    hideMobileNavbar() {
      if (!this.ea.DEVICE.isMobile) return;
      const tracked = new Set(this.hiddenMobileNavbars.map(({ element }) => element));
      const navbars = Array.from(
        this.ownerDocument.querySelectorAll(
          ".mobile-navbar.excalidraw-mobile-navbar-docked"
        )
      );
      for (const element of navbars) {
        if (!tracked.has(element)) {
          this.hiddenMobileNavbars.push({ element, display: element.style.display });
        }
        element.style.display = "none";
      }
    }
    restoreMobileNavbar() {
      for (const { element, display } of this.hiddenMobileNavbars) {
        element.style.display = display;
      }
      this.hiddenMobileNavbars = [];
    }
    initializeEventListeners() {
      this.ownerWindow.addEventListener("keydown", this.keydownListener);
      this.ea.onLinkClickHook = this.linkClickHook;
      if (!this.ea.DEVICE.isMobile) {
        this.contentElement.addEventListener("webkitfullscreenchange", this.fullscreenListener);
        this.contentElement.addEventListener("fullscreenchange", this.fullscreenListener);
      }
    }
    linkClickHook = () => {
      void this.exit();
      return true;
    };
    removeEventListeners() {
      if (this.ea.onLinkClickHook === this.linkClickHook) this.ea.onLinkClickHook = null;
      this.controls?.destroy();
      this.controls = null;
      if (!this.ea.DEVICE.isMobile) {
        this.contentElement.removeEventListener("webkitfullscreenchange", this.fullscreenListener);
        this.contentElement.removeEventListener("fullscreenchange", this.fullscreenListener);
      }
      this.ownerWindow.removeEventListener("keydown", this.keydownListener);
      this.contentElement.querySelector(".layer-ui__wrapper")?.removeClass("excalidraw-hidden");
    }
    /** Restores the drawing and Excalidraw UI after the presentation. */
    exit(openForEdit = false) {
      this.exitPromise ??= this.performExit(openForEdit).finally(this.onExit);
      return this.exitPromise;
    }
    async performExit(openForEdit) {
      this.ea.setView(this.hostView);
      const presenter = this.presenter;
      this.presenter = null;
      await presenter?.destroy(true).catch(() => void 0);
      await presenter?.waitForIdle().catch(() => void 0);
      try {
        await this.animationRuntime?.finishActiveSlide();
        this.isLaserOn = false;
        if (this.statusBarElement) this.statusBarElement.style.display = "inherit";
        if (openForEdit) this.hostView.preventAutozoom();
        await this.exitFullscreen(false, false);
        if (this.hostWindowPlacement) {
          const originalPlacement = this.hostWindowPlacement;
          this.hostWindowPlacement = null;
          this.hostPlacementPrepared = false;
          await restoreWindowPlacementStable(this.ownerWindow, originalPlacement);
        }
        await this.waitForExcalidrawResize();
        this.ea.setViewModeEnabled(false);
        if (this.setup.pathType === "line" && this.setup.pathElement && this.setup.originalPathProperties) {
          await this.restoreLinePathForExit(openForEdit);
        } else if (this.setup.frameRenderingOriginalState.enabled) {
          this.api.updateScene({
            appState: {
              frameRendering: { ...this.setup.frameRenderingOriginalState, enabled: true }
            }
          });
        }
      } finally {
        await this.animationRuntime?.finishActiveSlide().catch(() => void 0);
        this.restoreMobileNavbar();
        this.removeEventListeners();
        this.ownerWindow.setTimeout(() => {
          this.hostView.refreshCanvasOffset();
          this.api.setActiveTool({ type: "selection" });
        });
        if (!this.shouldSaveAfterPresentation) this.hostView.clearDirty();
      }
    }
    async restoreLinePathForExit(openForEdit) {
      const pathElement = this.setup.pathElement;
      const originalProps = this.setup.originalPathProperties;
      if (!pathElement || !originalProps) return;
      this.ea.clear();
      this.ea.copyViewElementsToEAforEditing(
        this.ea.getViewElements().filter((element2) => element2.id === pathElement.id)
      );
      const element = this.ea.getElement(
        pathElement.id
      );
      if (!element) return;
      if (!this.setup.isHidden) {
        element.strokeColor = originalProps.strokeColor;
        element.backgroundColor = originalProps.backgroundColor;
        element.locked = openForEdit ? false : originalProps.locked;
      }
      await this.ea.addElementsToView(false, false, false, false, "NEVER");
      if (!this.setup.isHidden) this.ea.selectElementsInView([element]);
      if (!openForEdit) return;
      const deckSlide = this.setup.deck.visibleSlides[this.slide];
      const pairIndex = deckSlide?.kind === "path" ? deckSlide.pairIndex : this.slide;
      let nextRect = this.getSlideNavigationRect(this.slide);
      const offsetWidth = (nextRect.right - nextRect.left) * (1 - this.config.editZoomOut) / 2;
      const offsetHeight = (nextRect.bottom - nextRect.top) * (1 - this.config.editZoomOut) / 2;
      nextRect = {
        left: nextRect.left - offsetWidth,
        right: nextRect.right + offsetWidth,
        top: nextRect.top - offsetHeight,
        bottom: nextRect.bottom + offsetHeight,
        nextZoom: Math.max(nextRect.nextZoom * this.config.editZoomOut, 0.1)
      };
      await this.scrollToRect(nextRect, 1);
      this.api.startLineEditor(element, [pairIndex * 2, pairIndex * 2 + 1]);
    }
    async print(event) {
      await this.presenter?.waitForIdle();
      this.ea.setView(this.hostView);
      const task = () => printSlideshowToPdf({
        event,
        ea: this.ea,
        api: this.api,
        slides: this.setup.slides,
        printSlideWidth: this.config.printSlideWidth,
        printSlideHeight: this.config.printSlideHeight,
        maxZoom: this.config.maxZoom,
        t: this.t
      });
      if (this.animationRuntime) await this.animationRuntime.withFinalState(task);
      else await task();
    }
  };

  // src/scripts/slideshow/slideDeckMutations.ts
  function normalizeNotes2(notes) {
    return notes.trim().length === 0 ? void 0 : notes;
  }
  function getFrameElements(ea2) {
    return ea2.getViewElements().filter(isFrameElement);
  }
  function moveId(ids, fromIndex, toIndex) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) {
      throw new RangeError("Frame-slide index is outside the deck.");
    }
    const [id] = ids.splice(fromIndex, 1);
    if (!id) throw new RangeError("The source frame slide does not exist.");
    ids.splice(toIndex, 0, id);
  }
  async function commitWorkbench(ea2) {
    const committed = await ea2.addElementsToView(false, true, false, false, "IMMEDIATELY");
    if (!committed) throw new Error("The slideshow metadata could not be applied to the drawing.");
  }
  async function writeFrameMetadataSet(ea2, orderedIds, targetId, mutateTarget) {
    const frames = getFrameElements(ea2);
    const byId = new Map(frames.map((frame) => [frame.id, frame]));
    if (orderedIds.length !== frames.length || orderedIds.some((id) => !byId.has(id))) {
      throw new Error("The frame deck changed before the slideshow metadata could be saved.");
    }
    ea2.clear();
    ea2.copyViewElementsToEAforEditing(frames);
    orderedIds.forEach((frameId, order) => {
      const source = byId.get(frameId);
      if (!source) return;
      const data = withNormalizedFrameOrder(source.customData, order);
      if (frameId === targetId) mutateTarget?.(data);
      writeSlideshowMetadata(ea2, frameId, data);
    });
    await commitWorkbench(ea2);
  }
  async function declareFrameSlideshow(ea2, selectedFrameId) {
    const frame = getFrameElements(ea2).find((candidate) => candidate.id === selectedFrameId);
    if (!frame) throw new Error("The selected frame no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([frame]);
    const updated = ea2.addAppendUpdateCustomData(selectedFrameId, {
      slideshow: { schemaVersion: 2, kind: "frame" }
    });
    if (!updated) throw new Error("The selected frame could not be edited.");
    await commitWorkbench(ea2);
  }
  async function renameFrameSlide(ea2, frameId, name) {
    const source = ea2.getViewElements().find((element) => element.id === frameId);
    if (!isFrameElement(source)) throw new Error("The selected frame no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const frame = ea2.getElement(frameId);
    if (!frame) throw new Error("The selected frame could not be edited.");
    frame.name = name.trim().length === 0 ? null : name;
    await commitWorkbench(ea2);
  }
  async function reorderFrameSlides(ea2, fromIndex, toIndex) {
    const frames = getFrameElements(ea2);
    const orderedIds = buildFrameSlideDeck(frames).slides.map((slide) => slide.id);
    moveId(orderedIds, fromIndex, toIndex);
    await writeFrameMetadataSet(ea2, orderedIds, null);
  }
  async function setFrameExcluded(ea2, frameId, excluded) {
    const frames = getFrameElements(ea2);
    const orderedIds = buildFrameSlideDeck(frames).slides.map((slide) => slide.id);
    await writeFrameMetadataSet(ea2, orderedIds, frameId, (data) => {
      if (excluded) data.excluded = true;
      else delete data.excluded;
    });
  }
  async function saveFrameNotes(ea2, frameId, notes) {
    const frames = getFrameElements(ea2);
    const orderedIds = buildFrameSlideDeck(frames).slides.map((slide) => slide.id);
    if (!orderedIds.includes(frameId)) {
      throw new Error("The selected frame slide no longer exists.");
    }
    const normalized = normalizeNotes2(notes);
    await writeFrameMetadataSet(ea2, orderedIds, frameId, (data) => {
      if (normalized === void 0) delete data.notes;
      else data.notes = normalized;
    });
  }
  async function saveFrameAnimationSteps(ea2, frameId, steps) {
    const frames = getFrameElements(ea2);
    const orderedIds = buildFrameSlideDeck(frames).slides.map((slide) => slide.id);
    if (!orderedIds.includes(frameId)) {
      throw new Error("The selected frame slide no longer exists.");
    }
    await writeFrameMetadataSet(ea2, orderedIds, frameId, (data) => {
      if (steps.length === 0) delete data.animation;
      else data.animation = { steps: steps.map((step) => structuredClone(step)) };
    });
  }
  function hasBoundLineEndpoint(path) {
    const bindingPath = path;
    return bindingPath.startBinding !== null && bindingPath.startBinding !== void 0 || bindingPath.endBinding !== null && bindingPath.endBinding !== void 0;
  }
  function fallbackPathProperties(path) {
    return {
      strokeColor: path.strokeColor,
      backgroundColor: path.backgroundColor,
      locked: path.locked
    };
  }
  async function createLinePresentation(ea2, pathId, name) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The selected line no longer exists.");
    if (Math.floor(source.points.length / 2) <= 0) {
      throw new Error("The selected line does not contain a complete slide point pair.");
    }
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The selected line could not be edited.");
    const metadata = upgradeLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2),
      fallbackPathProperties(source)
    );
    const normalizedName = normalizeNotes2(name ?? "");
    if (normalizedName === void 0) delete metadata.name;
    else metadata.name = normalizedName;
    writeSlideshowMetadata(ea2, element.id, metadata);
    await commitWorkbench(ea2);
  }
  async function renameLinePresentation(ea2, pathId, name) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The presentation path no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The presentation path could not be edited.");
    const metadata = upgradeLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2),
      fallbackPathProperties(source)
    );
    const normalizedName = normalizeNotes2(name);
    if (normalizedName === void 0) delete metadata.name;
    else metadata.name = normalizedName;
    writeSlideshowMetadata(ea2, element.id, metadata);
    await commitWorkbench(ea2);
  }
  async function removeLinePresentation(ea2, pathId) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The presentation path no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The presentation path could not be edited.");
    const existing = upgradeLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2),
      fallbackPathProperties(source)
    );
    if (existing.hidden) {
      element.strokeColor = existing.originalProps.strokeColor;
      element.backgroundColor = existing.originalProps.backgroundColor;
      element.locked = existing.originalProps.locked;
    }
    writeSlideshowMetadata(ea2, element.id, void 0);
    await commitWorkbench(ea2);
  }
  async function reorderLineSlides(ea2, pathId, fromPairIndex, toPairIndex) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The presentation path no longer exists.");
    if (hasBoundLineEndpoint(source)) {
      throw new Error("BOUND_PRESENTATION_PATH");
    }
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The presentation path could not be edited.");
    const pairCount = Math.floor(element.points.length / 2);
    const reordered = reorderLinePointPairs(
      element.x,
      element.y,
      element.points,
      fromPairIndex,
      toPairIndex
    );
    const metadata = upgradeLineSlideshowData(
      element.customData,
      element.id,
      pairCount,
      fallbackPathProperties(source)
    );
    metadata.slides = reorderLineSlideRecords(
      metadata.slides,
      pairCount,
      element.id,
      fromPairIndex,
      toPairIndex
    );
    element.x = reordered.x;
    element.y = reordered.y;
    element.points = reordered.points;
    writeSlideshowMetadata(ea2, element.id, metadata);
    await commitWorkbench(ea2);
  }
  async function saveLineNotes(ea2, pathId, slideId, notes) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The presentation path no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The presentation path could not be edited.");
    const metadata = upgradeLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2),
      fallbackPathProperties(source)
    );
    const record = metadata.slides.find((candidate) => candidate.id === slideId);
    if (!record) throw new Error("The selected line slide no longer exists.");
    const normalized = normalizeNotes2(notes);
    if (normalized === void 0) delete record.notes;
    else record.notes = normalized;
    writeSlideshowMetadata(ea2, element.id, metadata);
    await commitWorkbench(ea2);
  }
  async function setLineSlideExcluded(ea2, pathId, slideId, excluded) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The presentation path no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The presentation path could not be edited.");
    const metadata = upgradeLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2),
      fallbackPathProperties(source)
    );
    const record = metadata.slides.find((candidate) => candidate.id === slideId);
    if (!record) throw new Error("The selected line slide no longer exists.");
    if (excluded) record.excluded = true;
    else delete record.excluded;
    writeSlideshowMetadata(ea2, element.id, metadata);
    await commitWorkbench(ea2);
  }
  async function setLinePresentationPathHidden(ea2, pathId, hidden) {
    const source = ea2.getViewElements().find((element2) => element2.id === pathId);
    if (!isLinearPathElement(source)) throw new Error("The presentation path no longer exists.");
    ea2.clear();
    ea2.copyViewElementsToEAforEditing([source]);
    const element = ea2.getElement(pathId);
    if (!element) throw new Error("The presentation path could not be edited.");
    const metadata = upgradeLineSlideshowData(
      element.customData,
      element.id,
      Math.floor(element.points.length / 2),
      fallbackPathProperties(source)
    );
    metadata.hidden = hidden;
    if (hidden) {
      element.strokeColor = "transparent";
      element.backgroundColor = "transparent";
      element.locked = true;
    } else {
      element.strokeColor = metadata.originalProps.strokeColor;
      element.backgroundColor = metadata.originalProps.backgroundColor;
      element.locked = metadata.originalProps.locked;
    }
    writeSlideshowMetadata(ea2, element.id, metadata);
    await commitWorkbench(ea2);
  }

  // src/scripts/slideshow/AnimationEditor.ts
  function targetKey(target) {
    return `${target.type}:${target.id}`;
  }
  function sameTargets(left, right) {
    if (left.length !== right.length) return false;
    return left.every((target, index) => targetKey(target) === targetKey(right[index] ?? target));
  }
  function uniqueStepId(steps) {
    const used = new Set(steps.map((step) => step.id));
    const base = `animation-${Date.now().toString(36)}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    return id;
  }
  function moveStep(steps, fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= steps.length || toIndex >= steps.length) return;
    const [step] = steps.splice(fromIndex, 1);
    if (step) steps.splice(toIndex, 0, step);
  }
  var AnimationEditor = class {
    constructor(options) {
      this.options = options;
      this.steps = options.slide.animationSteps.map((step) => structuredClone(step));
      this.previewRuntime = new AnimationRuntime({
        ea: options.ea,
        api: options.api,
        hostView: options.hostView
      });
    }
    steps;
    selectedStepId = null;
    targets = [];
    ignoredSelectionCount = 0;
    effect = "appear";
    trigger = "advance";
    delayMs = 1e3;
    durationMs = 350;
    direction = "left";
    destroyed = false;
    saving = false;
    ignoreSelectionUntil = 0;
    recycleTimer = 0;
    pendingRecycleElements = null;
    previewRuntime;
    /** Renders the editor into its current sidepanel container. */
    render() {
      if (this.destroyed) return;
      const { container, icons, t } = this.options;
      const doc = container.ownerDocument;
      container.replaceChildren();
      container.className = "slideshow-animation-editor";
      const instructions = doc.createElement("div");
      instructions.className = "slideshow-animation-editor__hint";
      instructions.textContent = t("animationSelectionHint");
      container.appendChild(instructions);
      if (this.ignoredSelectionCount > 0) {
        const warning = doc.createElement("div");
        warning.className = "slideshow-warning";
        warning.textContent = t("animationOutsideFrameIgnored", { count: this.ignoredSelectionCount });
        container.appendChild(warning);
      }
      const targetSection = doc.createElement("div");
      targetSection.className = "slideshow-animation-editor__section";
      const targetHeading = doc.createElement("div");
      targetHeading.className = "slideshow-animation-editor__section-title";
      targetHeading.textContent = t("animationTargets");
      targetSection.appendChild(targetHeading);
      const chips = doc.createElement("div");
      chips.className = "slideshow-animation-editor__targets";
      if (this.targets.length === 0) {
        const empty = doc.createElement("span");
        empty.className = "slideshow-animation-editor__muted";
        empty.textContent = t("animationNoTargets");
        chips.appendChild(empty);
      } else {
        this.targets.forEach((target, index) => {
          const chip = doc.createElement("span");
          chip.className = "slideshow-animation-editor__target";
          const label = doc.createElement("span");
          label.textContent = this.getTargetLabel(target);
          chip.appendChild(label);
          const remove = this.iconButton(doc, icons.close, t("removeAnimationTarget"), false, () => {
            this.targets.splice(index, 1);
            this.render();
          });
          chip.appendChild(remove);
          chips.appendChild(chip);
        });
      }
      targetSection.appendChild(chips);
      container.appendChild(targetSection);
      const form = doc.createElement("div");
      form.className = "slideshow-animation-editor__form";
      const effectSelect = this.createSelect(doc, t("animationEffect"), [
        ["appear", t("animationEffectAppear")],
        ["fade", t("animationEffectFade")],
        ["slide", t("animationEffectSlide")],
        ["zoom", t("animationEffectZoom")]
      ], this.effect, (value) => {
        this.effect = value;
        this.render();
      });
      form.appendChild(effectSelect);
      const triggerSelect = this.createSelect(doc, t("animationTrigger"), [
        ["advance", t("animationTriggerAdvance")],
        ["after-delay", t("animationTriggerDelay")]
      ], this.trigger, (value) => {
        this.trigger = value;
        this.render();
      });
      form.appendChild(triggerSelect);
      if (this.trigger === "after-delay") {
        form.appendChild(
          this.numberField(doc, t("animationDelayMs"), this.delayMs, 0, (value) => {
            this.delayMs = value;
          })
        );
      }
      if (this.effect !== "appear") {
        form.appendChild(
          this.numberField(doc, t("animationDurationMs"), this.durationMs, 0, (value) => {
            this.durationMs = value;
          })
        );
      }
      if (this.effect === "slide") {
        form.appendChild(
          this.createSelect(doc, t("animationDirection"), [
            ["left", t("animationDirectionLeft")],
            ["right", t("animationDirectionRight")],
            ["up", t("animationDirectionUp")],
            ["down", t("animationDirectionDown")]
          ], this.direction, (value) => {
            this.direction = value;
          })
        );
      }
      container.appendChild(form);
      const formActions = doc.createElement("div");
      formActions.className = "slideshow-animation-editor__form-actions";
      const saveLabel = this.selectedStepId ? t("updateAnimationStep") : t("addAnimationStep");
      const saveButton = doc.createElement("button");
      saveButton.type = "button";
      saveButton.disabled = this.saving || this.targets.length === 0;
      saveButton.innerHTML = `${icons.plus}<span>${saveLabel}</span>`;
      saveButton.addEventListener("click", () => void this.saveCurrentStep());
      formActions.appendChild(saveButton);
      const previewButton = doc.createElement("button");
      previewButton.type = "button";
      previewButton.disabled = this.targets.length === 0;
      previewButton.innerHTML = `${icons.play}<span>${t("previewAnimation")}</span>`;
      previewButton.addEventListener("click", () => void this.previewCurrentStep());
      formActions.appendChild(previewButton);
      if (this.selectedStepId) {
        const cancelButton = doc.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = t("newAnimationStep");
        cancelButton.addEventListener("click", () => {
          this.selectedStepId = null;
          this.targets = [];
          this.resetFormDefaults();
          this.render();
        });
        formActions.appendChild(cancelButton);
      }
      container.appendChild(formActions);
      const stepHeading = doc.createElement("div");
      stepHeading.className = "slideshow-animation-editor__section-title";
      stepHeading.textContent = t("animationSequence", { count: this.steps.length });
      container.appendChild(stepHeading);
      const stepList = doc.createElement("div");
      stepList.className = "slideshow-animation-editor__steps";
      if (this.steps.length === 0) {
        const empty = doc.createElement("div");
        empty.className = "slideshow-animation-editor__muted";
        empty.textContent = t("animationNoSteps");
        stepList.appendChild(empty);
      }
      this.steps.forEach((step, index) => stepList.appendChild(this.renderStep(doc, step, index)));
      container.appendChild(stepList);
    }
    /** Processes live scene changes while animation editing is active. */
    handleSceneChange(elements, appState) {
      this.captureSelection(elements, appState);
      this.scheduleMissingTargetRecycle(elements);
    }
    /** Captures the live canvas selection while animation editing is active. */
    captureSelection(elements, appState) {
      if (this.destroyed || Date.now() < this.ignoreSelectionUntil) return;
      const captured = captureAnimationTargets(
        this.options.slide.frameId,
        elements,
        appState.selectedElementIds,
        appState.selectedGroupIds
      );
      if (sameTargets(captured.targets, this.targets) && captured.ignoredSelectionCount === this.ignoredSelectionCount) {
        return;
      }
      this.targets = captured.targets;
      this.ignoredSelectionCount = captured.ignoredSelectionCount;
      this.render();
    }
    /** Restores preview state and releases editor-owned resources. */
    async destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      if (this.recycleTimer) this.options.hostView.ownerWindow.clearTimeout(this.recycleTimer);
      this.recycleTimer = 0;
      this.pendingRecycleElements = null;
      await this.previewRuntime.leaveSlide();
    }
    scheduleMissingTargetRecycle(elements) {
      if (this.destroyed) return;
      this.pendingRecycleElements = elements;
      const ownerWindow = this.options.hostView.ownerWindow;
      if (this.recycleTimer) ownerWindow.clearTimeout(this.recycleTimer);
      this.recycleTimer = ownerWindow.setTimeout(() => {
        this.recycleTimer = 0;
        void this.recycleMissingTargets();
      }, 160);
    }
    async recycleMissingTargets() {
      if (this.destroyed) return;
      const elements = this.pendingRecycleElements ?? this.options.ea.getViewElements();
      this.pendingRecycleElements = null;
      if (this.saving) {
        this.scheduleMissingTargetRecycle(elements);
        return;
      }
      const steps = recycleMissingAnimationTargets(this.steps, elements);
      if (JSON.stringify(steps) === JSON.stringify(this.steps)) return;
      this.saving = true;
      try {
        await saveFrameAnimationSteps(this.options.ea, this.options.slide.frameId, steps);
        this.steps = steps;
        if (this.selectedStepId) {
          const selectedStep = steps.find((step) => step.id === this.selectedStepId);
          if (selectedStep) {
            this.targets = selectedStep.targets.map((target) => structuredClone(target));
          } else {
            this.selectedStepId = null;
            this.targets = [];
            this.resetFormDefaults();
          }
        }
        this.options.onSaved();
      } catch (error) {
        console.error("Slideshow stale animation cleanup failed", error);
        new Notice(this.options.t("animationSaveFailed"));
      } finally {
        this.saving = false;
        this.render();
      }
    }
    renderStep(doc, step, index) {
      const { icons, t } = this.options;
      const row = doc.createElement("div");
      row.className = "slideshow-animation-editor__step";
      if (step.id === this.selectedStepId) row.classList.add("is-selected");
      row.tabIndex = 0;
      row.draggable = this.options.ea.DEVICE.isDesktop;
      const summary = doc.createElement("button");
      summary.type = "button";
      summary.className = "slideshow-animation-editor__step-summary";
      summary.textContent = t("animationStepSummary", {
        number: index + 1,
        effect: this.effectLabel(step.effect),
        targets: step.targets.length
      });
      summary.addEventListener("click", () => this.selectStep(step));
      row.appendChild(summary);
      const actions = doc.createElement("div");
      actions.className = "slideshow-animation-editor__step-actions";
      actions.appendChild(
        this.iconButton(doc, icons.chevronUp, t("moveAnimationStepUp"), index === 0, () => {
          void this.reorderStep(index, index - 1);
        })
      );
      actions.appendChild(
        this.iconButton(
          doc,
          icons.chevronDown,
          t("moveAnimationStepDown"),
          index === this.steps.length - 1,
          () => void this.reorderStep(index, index + 1)
        )
      );
      actions.appendChild(
        this.iconButton(doc, icons.play, t("previewAnimationStep"), false, () => {
          void this.previewRuntime.previewStep(this.options.slide.frameId, step);
        })
      );
      actions.appendChild(
        this.iconButton(doc, icons.trash, t("deleteAnimationStep"), false, () => {
          void this.deleteStep(step.id);
        })
      );
      row.appendChild(actions);
      if (this.options.ea.DEVICE.isDesktop) {
        row.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("text/plain", String(index));
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });
        row.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        });
        row.addEventListener("drop", (event) => {
          event.preventDefault();
          const fromIndex = Number.parseInt(event.dataTransfer?.getData("text/plain") ?? "", 10);
          if (Number.isInteger(fromIndex) && fromIndex !== index) void this.reorderStep(fromIndex, index);
        });
      }
      row.addEventListener("keydown", (event) => {
        if (!event.altKey || event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const target = event.key === "ArrowUp" ? index - 1 : index + 1;
        void this.reorderStep(index, target);
      });
      return row;
    }
    selectStep(step) {
      this.selectedStepId = step.id;
      this.targets = step.targets.map((target) => structuredClone(target));
      this.effect = step.effect;
      this.trigger = step.trigger;
      this.delayMs = step.delayMs ?? 1e3;
      this.durationMs = step.durationMs ?? 350;
      this.direction = step.direction ?? "left";
      this.ignoredSelectionCount = 0;
      const ids = resolveAnimationTargetElementIds(
        this.options.slide.frameId,
        step.targets,
        this.options.ea.getViewElements()
      );
      const elements = this.options.ea.getViewElements().filter((element) => ids.includes(element.id));
      this.ignoreSelectionUntil = Date.now() + 500;
      if (elements.length > 0) this.options.ea.selectElementsInView(elements);
      this.render();
    }
    async saveCurrentStep() {
      if (this.saving || this.targets.length === 0) return;
      this.saving = true;
      this.render();
      try {
        const elements = this.options.ea.getViewElements();
        const selectedId = this.selectedStepId;
        let steps = removeAnimationTargetConflicts(
          this.options.slide.frameId,
          this.steps,
          this.targets,
          elements,
          selectedId ?? void 0
        );
        const step = this.buildFormStep(selectedId ?? uniqueStepId(steps));
        if (selectedId) {
          const index = steps.findIndex((candidate) => candidate.id === selectedId);
          if (index >= 0) steps[index] = step;
          else steps.push(step);
        } else {
          steps.push(step);
        }
        await saveFrameAnimationSteps(this.options.ea, this.options.slide.frameId, steps);
        this.steps = steps;
        this.selectedStepId = step.id;
        this.targets = step.targets.map((target) => structuredClone(target));
        this.options.onSaved();
      } catch (error) {
        console.error("Slideshow animation metadata save failed", error);
        new Notice(this.options.t("animationSaveFailed"));
      } finally {
        this.saving = false;
        this.render();
      }
    }
    async reorderStep(fromIndex, toIndex) {
      if (toIndex < 0 || toIndex >= this.steps.length || this.saving) return;
      const steps = this.steps.map((step) => structuredClone(step));
      moveStep(steps, fromIndex, toIndex);
      await this.persistSteps(steps);
    }
    async deleteStep(stepId) {
      if (this.saving) return;
      const steps = this.steps.filter((step) => step.id !== stepId);
      await this.persistSteps(steps);
      if (this.selectedStepId === stepId) {
        this.selectedStepId = null;
        this.targets = [];
        this.resetFormDefaults();
      }
      this.render();
    }
    async persistSteps(steps) {
      this.saving = true;
      try {
        await saveFrameAnimationSteps(this.options.ea, this.options.slide.frameId, steps);
        this.steps = steps;
        this.options.onSaved();
      } catch (error) {
        console.error("Slideshow animation sequence save failed", error);
        new Notice(this.options.t("animationSaveFailed"));
      } finally {
        this.saving = false;
        this.render();
      }
    }
    async previewCurrentStep() {
      if (this.targets.length === 0) return;
      await this.previewRuntime.previewStep(
        this.options.slide.frameId,
        this.buildFormStep(this.selectedStepId ?? "preview")
      );
    }
    buildFormStep(id) {
      const step = {
        id,
        targets: this.targets.map((target) => structuredClone(target)),
        effect: this.effect,
        trigger: this.trigger
      };
      if (this.trigger === "after-delay") step.delayMs = this.delayMs;
      if (this.effect !== "appear") step.durationMs = this.durationMs;
      if (this.effect === "slide") step.direction = this.direction;
      return step;
    }
    resetFormDefaults() {
      this.effect = "appear";
      this.trigger = "advance";
      this.delayMs = 1e3;
      this.durationMs = 350;
      this.direction = "left";
    }
    getTargetLabel(target) {
      if (target.type === "group") {
        return this.options.t("animationGroupTarget", { id: target.id.slice(0, 8) });
      }
      const element = this.options.ea.getViewElements().find((candidate) => candidate.id === target.id);
      return this.options.t("animationElementTarget", {
        type: element?.type ?? "?",
        id: target.id.slice(0, 8)
      });
    }
    effectLabel(effect) {
      const { t } = this.options;
      switch (effect) {
        case "fade":
          return t("animationEffectFade");
        case "slide":
          return t("animationEffectSlide");
        case "zoom":
          return t("animationEffectZoom");
        default:
          return t("animationEffectAppear");
      }
    }
    iconButton(doc, icon, label, disabled, callback) {
      const button = doc.createElement("button");
      button.type = "button";
      button.innerHTML = icon;
      button.disabled = disabled;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", callback);
      return button;
    }
    createSelect(doc, labelText, options, value, onChange) {
      const label = doc.createElement("label");
      const text = doc.createElement("span");
      text.textContent = labelText;
      label.appendChild(text);
      const select = doc.createElement("select");
      for (const [optionValue, optionLabel] of options) {
        const option = doc.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel;
        select.appendChild(option);
      }
      select.value = value;
      select.addEventListener("change", () => onChange(select.value));
      label.appendChild(select);
      return label;
    }
    numberField(doc, labelText, value, min, onChange) {
      const label = doc.createElement("label");
      const text = doc.createElement("span");
      text.textContent = labelText;
      label.appendChild(text);
      const input = doc.createElement("input");
      input.type = "number";
      input.min = String(min);
      input.step = "50";
      input.value = String(value);
      input.addEventListener("change", () => {
        const parsed = Number(input.value);
        onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : value);
      });
      label.appendChild(input);
      return label;
    }
  };

  // src/scripts/slideshow/SlideSorter.ts
  function getDropInsertionIndexFromRects(rowRects, pointerX, pointerY) {
    if (rowRects.length === 0) return 0;
    const groups = [];
    rowRects.forEach((rect, index) => {
      const group = groups.find((candidate) => {
        const first = candidate[0]?.rect;
        return Boolean(first && Math.abs(first.top - rect.top) <= 8);
      });
      if (group) group.push({ rect, index });
      else groups.push([{ rect, index }]);
    });
    const targetGroup = groups.find((group) => {
      const top = Math.min(...group.map((entry) => entry.rect.top));
      const bottom = Math.max(...group.map((entry) => entry.rect.bottom));
      return pointerY < (top + bottom) / 2;
    });
    if (!targetGroup) return rowRects.length;
    const ordered = [...targetGroup].sort((a, b) => a.rect.left - b.rect.left);
    const target = ordered.find((entry) => pointerX < (entry.rect.left + entry.rect.right) / 2);
    return target?.index ?? (ordered[ordered.length - 1]?.index ?? -1) + 1;
  }
  function getDropMoveTarget(fromIndex, insertionIndex, slideCount) {
    if (fromIndex < 0 || fromIndex >= slideCount || insertionIndex < 0 || insertionIndex > slideCount) {
      return null;
    }
    const target = insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex;
    return target === fromIndex ? null : target;
  }
  function getDragAutoScrollVelocity(pointerY, containerTop, containerBottom, edgeSize = 72, maximumSpeed = 18) {
    const availableHeight = Math.max(containerBottom - containerTop, 0);
    const edge = Math.min(edgeSize, availableHeight / 2);
    if (edge <= 0) return 0;
    if (pointerY < containerTop + edge) {
      const strength = Math.min(Math.max((containerTop + edge - pointerY) / edge, 0), 1);
      return -maximumSpeed * strength;
    }
    if (pointerY > containerBottom - edge) {
      const strength = Math.min(Math.max((pointerY - (containerBottom - edge)) / edge, 0), 1);
      return maximumSpeed * strength;
    }
    return 0;
  }
  var SlideSorter = class {
    constructor(options) {
      this.options = options;
      this.ownerWindow = options.container.ownerDocument.defaultView ?? window;
      this.selectedSlideId = options.deck.slides[0]?.id ?? null;
      options.container.addEventListener?.("dragover", this.handleContainerDragOver);
      options.container.addEventListener?.("dragleave", this.handleContainerDragLeave);
      options.container.addEventListener?.("drop", this.handleContainerDrop);
    }
    selectedSlideId = null;
    expandedNotesSlideId = null;
    notesTextarea = null;
    notesTimer = 0;
    ownerWindow;
    renderGeneration = 0;
    draggedIndex = null;
    dropTargetIndex = null;
    dragPointerX = null;
    dragPointerY = null;
    autoScrollVelocity = 0;
    autoScrollFrame = 0;
    notesSaveInFlight = null;
    previewObserver = null;
    /** Rebinds timer behavior after the sidepanel DOM migrates between windows. */
    onWindowMigrated(ownerWindow) {
      if (this.notesTimer) {
        this.ownerWindow.clearTimeout(this.notesTimer);
        this.notesTimer = 0;
        this.scheduleNotesSave();
      }
      this.stopAutoScroll();
      this.previewObserver?.disconnect();
      this.previewObserver = null;
      this.ownerWindow = ownerWindow;
      this.render();
    }
    /** Returns the currently selected stable slide id. */
    getSelectedSlideId() {
      return this.selectedSlideId;
    }
    /** Returns the slide whose inline notes editor is expanded, if any. */
    getExpandedNotesSlideId() {
      return this.expandedNotesSlideId;
    }
    /** Returns the current vertical sorter position for preservation across deck refreshes. */
    getScrollTop() {
      return this.options.container.scrollTop ?? 0;
    }
    /** Restores a vertical sorter position after its rows have been rebuilt. */
    restoreScrollTop(scrollTop) {
      this.options.container.scrollTop = scrollTop;
    }
    /** Scrolls the requested slide row into the visible sorter viewport. */
    scrollToSlide(slideId, focus = true, block = "center") {
      const row = Array.from(
        this.options.container.querySelectorAll(".slideshow-sorter__row")
      ).find((candidate) => candidate.dataset.slideId === slideId);
      if (!row) return;
      if (focus) row.focus({ preventScroll: true });
      row.scrollIntoView({ block });
      this.ownerWindow.setTimeout(() => {
        if (row.isConnected) row.scrollIntoView({ block });
      }, 50);
    }
    /** Returns whether notes currently have keyboard focus. */
    isEditingNotes() {
      return this.notesTextarea?.ownerDocument.activeElement === this.notesTextarea;
    }
    /** Mirrors an unambiguous canvas selection without taking keyboard focus from the drawing. */
    async selectFromScene(slideId) {
      if (this.options.animationEditingSlideId || this.isEditingNotes()) return;
      if (!this.options.deck.slides.some((slide) => slide.id === slideId)) return;
      if (slideId !== this.selectedSlideId) {
        await this.flushNotes();
        this.selectedSlideId = slideId;
        this.expandedNotesSlideId = null;
        this.render(slideId);
      }
      this.scrollToSlide(slideId, false);
    }
    /** Selects prior stable ids when still present, then renders the sorter. */
    render(preferredSlideId = this.selectedSlideId, preferredNotesSlideId = this.expandedNotesSlideId) {
      this.renderGeneration += 1;
      const generation = this.renderGeneration;
      const { container, deck } = this.options;
      const scrollTop = container.scrollTop;
      this.previewObserver?.disconnect();
      this.previewObserver = this.createPreviewObserver(generation);
      container.replaceChildren();
      this.notesTextarea = null;
      if (deck.slides.length === 0) return;
      this.selectedSlideId = preferredSlideId && deck.slides.some((slide) => slide.id === preferredSlideId) ? preferredSlideId : deck.slides[0]?.id ?? null;
      this.expandedNotesSlideId = preferredNotesSlideId && preferredNotesSlideId === this.selectedSlideId && deck.slides.some((slide) => slide.id === preferredNotesSlideId) ? preferredNotesSlideId : null;
      container.classList.toggle(
        "has-expanded-editor",
        Boolean(this.expandedNotesSlideId || this.options.animationEditingSlideId)
      );
      deck.slides.forEach((slide, index) => {
        const row = this.createRow(slide, index);
        container.appendChild(row);
        const previewHost = row.querySelector(".slideshow-sorter__preview");
        if (previewHost) {
          previewHost.dataset.slideId = slide.id;
          if (this.previewObserver) this.previewObserver.observe(previewHost);
          else this.renderPreview(previewHost, slide, generation);
        }
      });
      container.scrollTop = scrollTop;
    }
    createPreviewObserver(generation) {
      const Observer = this.ownerWindow.IntersectionObserver;
      if (typeof Observer !== "function") return null;
      return new Observer(
        (entries, observer) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            const host = entry.target;
            const slide = this.options.deck.slides.find(
              (candidate) => candidate.id === host.dataset.slideId
            );
            if (slide) this.renderPreview(host, slide, generation);
          }
        },
        { root: this.options.container, rootMargin: "240px 0px" }
      );
    }
    renderPreview(previewHost, slide, generation) {
      void this.options.previewService.createPreview(slide, previewHost.ownerDocument, { targetWidth: 480 }).then((preview) => {
        if (!preview || generation !== this.renderGeneration || !previewHost.isConnected) return;
        previewHost.replaceChildren(preview);
      }).catch(() => void 0);
    }
    createIconButton(ownerDocument, icon, label, disabled, onClick) {
      const button = ownerDocument.createElement("button");
      button.type = "button";
      button.innerHTML = icon;
      button.setAttribute("aria-label", label);
      button.disabled = disabled;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick();
      });
      return button;
    }
    createRow(slide, index) {
      const { deck, icons, t, reorderEnabled, ea: ea2 } = this.options;
      const doc = this.options.container.ownerDocument;
      const row = doc.createElement("div");
      row.className = "slideshow-sorter__row";
      if (slide.id === this.selectedSlideId) row.classList.add("is-selected");
      if (slide.excluded) row.classList.add("is-excluded");
      row.tabIndex = 0;
      row.dataset.slideId = slide.id;
      row.setAttribute("role", "listitem");
      row.addEventListener("click", () => void this.selectSlide(slide.id));
      row.addEventListener("dblclick", () => this.options.callbacks.zoomToSlide(slide));
      row.addEventListener("keydown", (event) => this.handleRowKeydown(event, slide, index));
      const top = doc.createElement("div");
      top.className = "slideshow-sorter__top";
      const titleRow = doc.createElement("div");
      titleRow.className = "slideshow-sorter__title-row";
      const title = doc.createElement("div");
      title.className = "slideshow-sorter__title";
      const titleText = t("slideNumberAndTitle", { number: index + 1, title: slide.title });
      title.textContent = titleText;
      title.title = titleText;
      titleRow.appendChild(title);
      if (slide.kind === "frame") {
        const editTitleButton = this.createIconButton(
          doc,
          icons.edit,
          t("editFrameSlideName"),
          false,
          () => this.options.callbacks.editFrameSlideName?.(slide)
        );
        editTitleButton.className = "slideshow-sorter__title-edit";
        editTitleButton.draggable = false;
        editTitleButton.addEventListener("dragstart", (event) => event.preventDefault());
        titleRow.appendChild(editTitleButton);
      }
      top.appendChild(titleRow);
      const badges = doc.createElement("div");
      badges.className = "slideshow-sorter__badges";
      if (slide.notes) {
        const badge = doc.createElement("span");
        const label = t("notesPresent");
        badge.className = "slideshow-sorter__badge slideshow-sorter__badge--notes";
        badge.title = label;
        badge.setAttribute("aria-label", label);
        badge.innerHTML = `${icons.notebookPen}<span class="slideshow-sorter__badge-text">${label}</span>`;
        badges.appendChild(badge);
      }
      if (slide.kind === "frame" && slide.animationSteps.length > 0) {
        const badge = doc.createElement("span");
        const count = slide.animationSteps.length;
        const label = t("animationCount", { count });
        badge.className = "slideshow-sorter__badge slideshow-sorter__badge--animation";
        badge.title = label;
        badge.setAttribute("aria-label", label);
        badge.innerHTML = `${icons.sparkles}<span class="slideshow-sorter__badge-compact-count" aria-hidden="true">${count}</span><span class="slideshow-sorter__badge-text">${label}</span>`;
        badges.appendChild(badge);
      }
      top.appendChild(badges);
      row.appendChild(top);
      if (ea2.DEVICE.isDesktop && reorderEnabled) {
        top.draggable = true;
        top.classList.add("is-draggable");
        top.setAttribute("aria-label", t("dragSlide"));
        top.addEventListener("dragstart", (event) => {
          this.selectedSlideId = slide.id;
          this.options.container.querySelectorAll(".slideshow-sorter__row.is-selected").forEach((selectedRow) => selectedRow.classList.remove("is-selected"));
          row.classList.add("is-selected");
          this.draggedIndex = index;
          row.classList.add("is-dragging");
          event.dataTransfer?.setData("text/plain", String(index));
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });
        top.addEventListener("dragend", () => {
          this.finishDrag();
        });
      }
      const content = doc.createElement("div");
      content.className = "slideshow-sorter__content";
      row.appendChild(content);
      const preview = doc.createElement("div");
      preview.className = "slideshow-sorter__preview";
      preview.style.backgroundColor = this.options.previewService.getBackgroundColor();
      preview.style.aspectRatio = this.options.previewService.getAspectRatio();
      content.appendChild(preview);
      const actions = doc.createElement("div");
      actions.className = "slideshow-sorter__actions";
      actions.appendChild(
        this.createIconButton(
          doc,
          icons.chevronUp,
          t("moveSlideUp"),
          !reorderEnabled || index === 0,
          () => {
            void this.options.callbacks.move(index, index - 1);
          }
        )
      );
      actions.appendChild(
        this.createIconButton(
          doc,
          icons.chevronDown,
          t("moveSlideDown"),
          !reorderEnabled || index === deck.slides.length - 1,
          () => {
            void this.options.callbacks.move(index, index + 1);
          }
        )
      );
      actions.appendChild(
        this.createIconButton(
          doc,
          slide.excluded ? icons.eyeOff : icons.eye,
          slide.excluded ? t("includeSlide") : t("excludeSlide"),
          false,
          () => void this.options.callbacks.toggleInclusion(slide, !slide.excluded)
        )
      );
      if (slide.kind === "frame") {
        const animationExpanded = this.options.animationEditingSlideId === slide.id;
        const animationButton = this.createIconButton(
          doc,
          icons.sparkles,
          t("editAnimations"),
          false,
          () => this.options.callbacks.requestAnimationEditor(slide)
        );
        animationButton.classList.toggle("is-active", animationExpanded);
        animationButton.setAttribute("aria-expanded", String(animationExpanded));
        actions.appendChild(animationButton);
      } else {
        actions.appendChild(
          this.createIconButton(doc, icons.edit, t("editLineSlide"), false, () => {
            void this.options.callbacks.editLineSlide(slide, index);
          })
        );
      }
      const notesExpanded = this.expandedNotesSlideId === slide.id;
      const notesButton = this.createIconButton(
        doc,
        icons.notebookPen,
        notesExpanded ? t("hidePresenterNotes") : t("showPresenterNotes"),
        false,
        () => void this.toggleNotes(slide.id)
      );
      notesButton.classList.toggle("is-active", notesExpanded);
      notesButton.setAttribute("aria-expanded", String(notesExpanded));
      actions.appendChild(notesButton);
      content.appendChild(actions);
      if (notesExpanded) this.renderNotesEditor(slide, row);
      if (slide.kind === "frame" && this.options.animationEditingSlideId === slide.id) {
        const animationHost = doc.createElement("div");
        animationHost.className = "slideshow-sorter__animation";
        row.appendChild(animationHost);
        this.options.callbacks.mountAnimationEditor?.(slide, animationHost);
      }
      return row;
    }
    handleRowKeydown(event, slide, index) {
      const rows = Array.from(
        this.options.container.querySelectorAll(".slideshow-sorter__row")
      );
      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        if (!this.options.reorderEnabled) return;
        const target = event.key === "ArrowUp" ? index - 1 : index + 1;
        if (target >= 0 && target < this.options.deck.slides.length) {
          void this.options.callbacks.move(index, target);
        }
        return;
      }
      switch (event.key) {
        case "ArrowUp":
        case "ArrowDown": {
          event.preventDefault();
          const target = event.key === "ArrowUp" ? index - 1 : index + 1;
          rows[target]?.focus();
          break;
        }
        case "Enter":
          event.preventDefault();
          this.options.callbacks.zoomToSlide(slide);
          break;
        case " ":
        case "Spacebar":
          event.preventDefault();
          void this.options.callbacks.toggleInclusion(slide, !slide.excluded);
          break;
        case "n":
        case "N":
          event.preventDefault();
          void this.openNotes(slide.id, true);
          break;
        case "a":
        case "A":
          event.preventDefault();
          this.options.callbacks.requestAnimationEditor(slide);
          break;
      }
    }
    async selectSlide(slideId) {
      if (slideId === this.selectedSlideId) return;
      await this.flushNotes();
      this.selectedSlideId = slideId;
      this.expandedNotesSlideId = null;
      this.render(slideId);
    }
    async toggleNotes(slideId) {
      if (this.expandedNotesSlideId === slideId) {
        await this.flushNotes();
        this.expandedNotesSlideId = null;
        this.render(this.selectedSlideId);
        return;
      }
      await this.openNotes(slideId, false);
    }
    async openNotes(slideId, focusNotes) {
      await this.flushNotes();
      this.selectedSlideId = slideId;
      this.expandedNotesSlideId = slideId;
      this.render(slideId, slideId);
      this.scrollToSlide(slideId, false, "start");
      if (focusNotes) this.notesTextarea?.focus();
    }
    renderNotesEditor(slide, row) {
      const doc = this.options.container.ownerDocument;
      const notes = doc.createElement("div");
      notes.className = "slideshow-notes";
      notes.addEventListener("click", (event) => event.stopPropagation());
      const heading = doc.createElement("strong");
      heading.textContent = this.options.t("notesHeading");
      notes.appendChild(heading);
      const textarea = doc.createElement("textarea");
      textarea.placeholder = this.options.t("notesPlaceholder");
      textarea.value = slide.notes ?? "";
      textarea.addEventListener("click", (event) => event.stopPropagation());
      textarea.addEventListener("keydown", (event) => this.handleNotesKeydown(event));
      textarea.addEventListener("input", () => this.scheduleNotesSave());
      textarea.addEventListener("blur", () => {
        void this.flushNotes().finally(() => this.options.callbacks.notesBlurred());
      });
      notes.appendChild(textarea);
      const hint = doc.createElement("div");
      hint.className = "slideshow-notes__hint";
      hint.textContent = this.options.t("notesHint");
      notes.appendChild(hint);
      row.appendChild(notes);
      this.notesTextarea = textarea;
    }
    handleNotesKeydown(event) {
      event.stopPropagation();
      if (!event.defaultPrevented || event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const textarea = event.currentTarget;
      if (!textarea) return;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      textarea.setRangeText(event.key, start, end, "end");
      this.scheduleNotesSave();
    }
    handleContainerDragOver = (event) => {
      if (this.draggedIndex === null) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      this.dragPointerX = event.clientX;
      this.dragPointerY = event.clientY;
      this.updateDropTarget(event.clientX, event.clientY);
      this.updateAutoScroll(event.clientY);
    };
    handleContainerDragLeave = (event) => {
      const relatedTarget = event.relatedTarget;
      if (relatedTarget && this.options.container.contains(relatedTarget)) return;
      this.clearDropIndicator();
      this.stopAutoScroll();
    };
    handleContainerDrop = (event) => {
      if (this.draggedIndex === null) return;
      event.preventDefault();
      const fromIndex = this.draggedIndex;
      const insertionIndex = this.dropTargetIndex;
      this.finishDrag();
      if (insertionIndex === null) return;
      const target = getDropMoveTarget(fromIndex, insertionIndex, this.options.deck.slides.length);
      if (target !== null) void this.options.callbacks.move(fromIndex, target);
    };
    updateDropTarget(pointerX, pointerY) {
      const rows = Array.from(
        this.options.container.querySelectorAll(".slideshow-sorter__row")
      );
      const insertionIndex = getDropInsertionIndexFromRects(
        rows.map((row) => row.getBoundingClientRect()),
        pointerX,
        pointerY
      );
      if (insertionIndex === this.dropTargetIndex) return;
      this.clearDropIndicator();
      this.dropTargetIndex = insertionIndex;
      if (insertionIndex < rows.length) rows[insertionIndex]?.classList.add("is-drop-before");
      else rows[rows.length - 1]?.classList.add("is-drop-after");
    }
    clearDropIndicator() {
      const rows = this.options.container.querySelectorAll?.(".is-drop-before, .is-drop-after") ?? [];
      rows.forEach((row) => row.classList.remove("is-drop-before", "is-drop-after"));
      this.dropTargetIndex = null;
    }
    updateAutoScroll(pointerY) {
      const rect = this.options.container.getBoundingClientRect();
      this.autoScrollVelocity = getDragAutoScrollVelocity(pointerY, rect.top, rect.bottom);
      if (this.autoScrollVelocity === 0) {
        this.stopAutoScroll();
        return;
      }
      if (!this.autoScrollFrame) {
        this.autoScrollFrame = this.ownerWindow.requestAnimationFrame(this.runAutoScroll);
      }
    }
    runAutoScroll = () => {
      this.autoScrollFrame = 0;
      if (this.draggedIndex === null || this.autoScrollVelocity === 0) return;
      const previousScrollTop = this.options.container.scrollTop;
      this.options.container.scrollTop += this.autoScrollVelocity;
      if (this.options.container.scrollTop === previousScrollTop) {
        this.autoScrollVelocity = 0;
        return;
      }
      if (this.dragPointerX !== null && this.dragPointerY !== null) {
        this.updateDropTarget(this.dragPointerX, this.dragPointerY);
      }
      this.autoScrollFrame = this.ownerWindow.requestAnimationFrame(this.runAutoScroll);
    };
    stopAutoScroll() {
      if (this.autoScrollFrame) this.ownerWindow.cancelAnimationFrame(this.autoScrollFrame);
      this.autoScrollFrame = 0;
      this.autoScrollVelocity = 0;
    }
    finishDrag() {
      this.stopAutoScroll();
      this.clearDropIndicator();
      const rows = this.options.container.querySelectorAll?.(
        ".slideshow-sorter__row.is-dragging"
      ) ?? [];
      rows.forEach((row) => row.classList.remove("is-dragging"));
      this.draggedIndex = null;
      this.dragPointerX = null;
      this.dragPointerY = null;
    }
    scheduleNotesSave() {
      if (!this.notesTextarea || !this.expandedNotesSlideId) return;
      if (this.notesTimer) this.ownerWindow.clearTimeout(this.notesTimer);
      this.notesTimer = this.ownerWindow.setTimeout(() => {
        this.notesTimer = 0;
        void this.flushNotes();
      }, 500);
    }
    /** Flushes a pending notes edit before slide changes, panel close, or presentation start. */
    async flushNotes() {
      if (this.notesTimer) {
        this.ownerWindow.clearTimeout(this.notesTimer);
        this.notesTimer = 0;
      }
      const slideId = this.expandedNotesSlideId;
      const current = this.notesTextarea?.value;
      if (!slideId || current === void 0) return;
      const previousSave = this.notesSaveInFlight;
      const save = (async () => {
        await previousSave?.catch(() => void 0);
        const slide = this.options.deck.slides.find((candidate) => candidate.id === slideId);
        if (!slide || current === (slide.notes ?? "")) return;
        await this.options.callbacks.saveNotes(slide, current);
        if (current.trim().length === 0) delete slide.notes;
        else slide.notes = current;
      })();
      this.notesSaveInFlight = save;
      try {
        await save;
      } finally {
        if (this.notesSaveInFlight === save) this.notesSaveInFlight = null;
      }
    }
    /** Cancels timers and invalidates asynchronous preview insertions. */
    destroy() {
      this.renderGeneration += 1;
      this.previewObserver?.disconnect();
      this.previewObserver = null;
      if (this.notesTimer) this.ownerWindow.clearTimeout(this.notesTimer);
      this.notesTimer = 0;
      this.notesTextarea = null;
      this.finishDrag();
      this.options.container.removeEventListener?.("dragover", this.handleContainerDragOver);
      this.options.container.removeEventListener?.("dragleave", this.handleContainerDragLeave);
      this.options.container.removeEventListener?.("drop", this.handleContainerDrop);
    }
  };

  // src/scripts/slideshow/slideshowQuickGuide.ts
  function openSlideshowQuickGuideModal(ea2, t) {
    const modal = new ea2.obsidian.Modal(app);
    modal.titleEl.setText(t("quickGuideTitle"));
    modal.contentEl.createEl("h3", { text: t("quickGuideShortcutsTitle") });
    const shortcuts = modal.contentEl.createEl("ul");
    for (const key of [
      "quickGuideClick",
      "quickGuideWindowed",
      "quickGuideEditor",
      "quickGuideResumeFullscreen",
      "quickGuideResumeWindowed"
    ]) {
      shortcuts.createEl("li", { text: t(key) });
    }
    modal.contentEl.createEl("h3", { text: t("quickGuideAuthoringTitle") });
    for (const key of [
      "quickGuideFrameSlides",
      "quickGuideLineSlides",
      "quickGuideMarkerFrames",
      "quickGuideAnimations",
      "quickGuideNotes"
    ]) {
      modal.contentEl.createEl("p", { text: t(key) });
    }
    modal.open();
  }

  // src/scripts/slideshow/slideshowRuntime.ts
  var RUNTIME_PROPERTY = "__excalidrawAutomateSlideshowRuntimeV1";
  function getSlideshowRuntime() {
    const host = app;
    host[RUNTIME_PROPERTY] ??= {
      contexts: /* @__PURE__ */ new WeakMap(),
      progress: /* @__PURE__ */ new WeakMap(),
      progressType: /* @__PURE__ */ new WeakMap(),
      progressSource: /* @__PURE__ */ new WeakMap(),
      presentations: /* @__PURE__ */ new WeakMap(),
      sidepanel: null
    };
    const runtime = host[RUNTIME_PROPERTY];
    if (!("progressType" in runtime) || !runtime.progressType) {
      Object.assign(runtime, {
        progressType: /* @__PURE__ */ new WeakMap()
      });
    }
    if (!("progressSource" in runtime) || !runtime.progressSource) {
      Object.assign(runtime, {
        progressSource: /* @__PURE__ */ new WeakMap()
      });
    }
    return runtime;
  }
  function registerSlideshowViewContext(context) {
    const runtime = getSlideshowRuntime();
    const wasKnown = runtime.contexts.has(context.view);
    runtime.contexts.set(context.view, context);
    return wasKnown;
  }
  function getSlideshowViewContext(view) {
    return getSlideshowRuntime().contexts.get(view);
  }
  function setSlideshowProgress(view, slide, presentationSource) {
    const runtime = getSlideshowRuntime();
    runtime.progress.set(view, slide);
    if (presentationSource) {
      const type = presentationSource === "frame" ? "frame" : "line";
      runtime.progressType.set(view, type);
      if (presentationSource === "frame" || presentationSource.startsWith("line:")) {
        runtime.progressSource.set(view, presentationSource);
      }
    }
  }
  function getSlideshowProgress(view) {
    return getSlideshowRuntime().progress.get(view);
  }
  function getSlideshowProgressType(view) {
    return getSlideshowRuntime().progressType.get(view);
  }
  function getSlideshowProgressSource(view) {
    return getSlideshowRuntime().progressSource.get(view);
  }

  // src/scripts/slideshow/SlideshowSidepanel.ts
  function getDeckFingerprint(resolved) {
    if (!resolved) return "none";
    return JSON.stringify({
      kind: resolved.deck.kind,
      pathId: resolved.pathElement?.id ?? null,
      slides: resolved.deck.slides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        rect: slide.rect,
        notes: slide.notes ?? null,
        excluded: slide.excluded,
        animationCount: slide.kind === "frame" ? slide.animationSteps.length : 0
      }))
    });
  }
  function chooseSidepanelPresentationSourceKey(choices, storedSource, preferredType) {
    if (storedSource && hasPresentationSource(choices, storedSource)) return storedSource;
    if (preferredType === "frame" && choices.frame) return "frame";
    if (preferredType === "line" && choices.lines.length > 0) return choices.lines[0]?.key ?? null;
    return choices.defaultSourceKey;
  }
  function getConvertibleSelectedLine(ea2) {
    const selected = ea2.getViewSelectedElement();
    if (!isLinearPathElement(selected) || Math.floor(selected.points.length / 2) <= 0) return null;
    return getLinePresentationSourceKey(selected) ? null : selected;
  }
  function getDeclarableSelectedFrame(ea2) {
    const selected = ea2.getViewSelectedElement();
    if (!isFrameElement(selected)) return null;
    const alreadyDeclared = ea2.getViewElements().some((element) => isFrameElement(element) && hasFrameSlideshowDeclaration(element.customData));
    return alreadyDeclared ? null : selected;
  }
  function getPresentationSourceLabels(choices, frameLabel, defaultLineLabel) {
    const result = [];
    if (choices.frame) result.push({ key: "frame", label: frameLabel });
    const bases = choices.lines.map((line) => line.name?.trim() || defaultLineLabel);
    const totals = /* @__PURE__ */ new Map();
    for (const base of bases) totals.set(base, (totals.get(base) ?? 0) + 1);
    const seen = /* @__PURE__ */ new Map();
    choices.lines.forEach((line, index) => {
      const base = bases[index] ?? defaultLineLabel;
      const ordinal = (seen.get(base) ?? 0) + 1;
      seen.set(base, ordinal);
      result.push({
        key: line.key,
        label: (totals.get(base) ?? 0) > 1 ? `${base} (${ordinal})` : base
      });
    });
    return result;
  }
  function getLineSourceByKey(choices, sourceKey) {
    if (!sourceKey || sourceKey === "frame") return null;
    return choices.lines.find((line) => line.key === sourceKey) ?? null;
  }
  function getSorterSceneSelectionSignature(appState) {
    const selectedElementIds = Object.keys(appState.selectedElementIds).filter((id) => appState.selectedElementIds[id]).sort();
    const editor = appState.selectedLinearElement;
    return JSON.stringify({
      selectedElementIds,
      selectedLinearElement: editor ? {
        elementId: editor.elementId,
        isEditing: editor.isEditing,
        selectedPointsIndices: editor.selectedPointsIndices ? [...editor.selectedPointsIndices].sort((a, b) => a - b) : null
      } : null
    });
  }
  function getSceneSelectedSlideId(resolved, appState) {
    if (!resolved) return null;
    if (resolved.deck.kind === "frame") {
      const selectedSlides = resolved.deck.slides.filter(
        (slide) => slide.kind === "frame" && appState.selectedElementIds[slide.frameId]
      );
      return selectedSlides.length === 1 ? selectedSlides[0]?.id ?? null : null;
    }
    const editor = appState.selectedLinearElement;
    if (!editor?.isEditing || editor.elementId !== resolved.pathElement?.id) return null;
    const pointIndices = editor.selectedPointsIndices;
    if (!pointIndices || pointIndices.length === 0) return null;
    const pairIndices = new Set(pointIndices.map((pointIndex) => Math.floor(pointIndex / 2)));
    if (pairIndices.size !== 1) return null;
    const pairIndex = pairIndices.values().next().value;
    return pairIndex === void 0 ? null : resolved.deck.slides[pairIndex]?.id ?? null;
  }
  function getResumeSlideForPresentation(progress, progressType, presentationType, visibleSlideCount, progressSource, presentationSource) {
    if (progress === void 0 || presentationType === null || visibleSlideCount <= 0) return null;
    if (progressType && progressType !== presentationType) return null;
    if (progressSource && presentationSource && progressSource !== presentationSource) return null;
    return Math.min(Math.max(progress, 0), visibleSlideCount - 1);
  }
  function resolveDeviceLaunchModes(isMobile, windowMode, notesMode, hasSecondaryDisplay) {
    return {
      startFullscreen: isMobile || windowMode === "fullscreen",
      openPresenterView: !isMobile && notesMode === "presenter" && hasSecondaryDisplay
    };
  }
  var SlideshowSidepanel = class {
    constructor(options) {
      this.options = options;
      this.ownerWindow = options.tab.contentEl.ownerDocument.defaultView ?? window;
      this.boundView = null;
      const launchPreferences = loadSlideshowLaunchPreferences(options.ea);
      this.startMode = launchPreferences.startMode;
      this.windowMode = launchPreferences.windowMode;
      this.notesMode = launchPreferences.notesMode;
      this.preferredPresentationType = launchPreferences.presentationType;
      this.sorterThumbnailMaxWidth = loadSorterThumbnailMaxWidth(options.ea);
      this.deviceKey = getSlideshowDeviceKey(this.ownerWindow);
    }
    sorter = null;
    previewService = null;
    resolved = null;
    choices = {
      frame: null,
      lines: [],
      line: null,
      defaultSourceKey: null,
      defaultType: null
    };
    presentationSourceKey = null;
    presentationSourceByDrawing = /* @__PURE__ */ new Map();
    refreshTimer = 0;
    ownerWindow;
    lastFingerprint = "";
    pendingRefresh = false;
    sceneSelectionSignature = null;
    pendingSceneSlideId = null;
    closed = false;
    bindGeneration = 0;
    activeLeafChangeRef = null;
    boundView;
    requestedSlideId = null;
    animationEditor = null;
    animationEditingSlideId = null;
    startMode = "beginning";
    windowMode = "fullscreen";
    notesMode = "slides";
    launchSettingsExpanded = false;
    preferredPresentationType;
    displays = [];
    presentationDisplayId = null;
    presenterDisplayId = null;
    displayConfigurationKey = null;
    deviceKey;
    settingsWriteQueue = Promise.resolve();
    removeDisplayChangeListener = null;
    displayRefreshTimer = 0;
    sorterThumbnailMaxWidth;
    /** Returns the drawing currently edited by this sidepanel. */
    getBoundView() {
      return this.boundView;
    }
    /** Focuses and reveals the slide requested by an element action after the tab is visible. */
    revealRequestedSlide() {
      const slideId = this.requestedSlideId;
      if (!slideId) return;
      this.sorter?.scrollToSlide(slideId);
      this.ownerWindow.setTimeout(() => {
        if (this.requestedSlideId === slideId) this.requestedSlideId = null;
      }, 500);
    }
    /** Rebinds the panel to a concrete view and optionally selects its deck type. */
    async activate(view, preferredSource, preferredSlideId) {
      if (preferredSource) {
        const sourceKey = preferredSource === "line" ? null : preferredSource;
        if (sourceKey) this.presentationSourceByDrawing.set(view.file.path, sourceKey);
        else this.preferredPresentationType = "line";
      }
      if (preferredSlideId) this.requestedSlideId = preferredSlideId;
      if (view === this.boundView) {
        this.options.ea.setView(view);
        this.lastFingerprint = "";
        await this.refresh(true);
        return;
      }
      const generation = ++this.bindGeneration;
      await this.applyViewBinding(view, generation);
    }
    /** Installs lifecycle hooks, workspace focus tracking, and scene-change tracking. */
    initialize() {
      const { ea: ea2, tab } = this.options;
      tab.onOpen = () => void this.refresh(true);
      tab.onFocus = (view) => this.bindView(view);
      tab.onWindowMigrated = (win) => {
        if (this.displayRefreshTimer) this.ownerWindow.clearTimeout(this.displayRefreshTimer);
        this.displayRefreshTimer = 0;
        this.removeDisplayChangeListener?.();
        this.removeDisplayChangeListener = null;
        this.ownerWindow = win;
        this.bindDisplayChangeListener();
        this.sorter?.onWindowMigrated(win);
        void this.animationEditor?.destroy();
        this.animationEditor = null;
        this.animationEditingSlideId = null;
        this.previewService?.clear();
        this.lastFingerprint = "";
        void this.refresh(true);
      };
      tab.onExcalidrawViewClosed = () => this.bindView(null);
      tab.onClose = () => {
        this.closed = true;
        if (this.refreshTimer) this.ownerWindow.clearTimeout(this.refreshTimer);
        this.refreshTimer = 0;
        if (this.displayRefreshTimer) this.ownerWindow.clearTimeout(this.displayRefreshTimer);
        this.displayRefreshTimer = 0;
        this.removeDisplayChangeListener?.();
        this.removeDisplayChangeListener = null;
        const sorter = this.sorter;
        this.sorter = null;
        void sorter?.flushNotes().finally(() => sorter.destroy());
        void this.animationEditor?.destroy();
        this.animationEditor = null;
        this.animationEditingSlideId = null;
        this.previewService?.clear();
        this.previewService = null;
        ea2.onSceneChangeHook = null;
        if (this.activeLeafChangeRef) {
          app.workspace.offref(this.activeLeafChangeRef);
          this.activeLeafChangeRef = null;
        }
        this.options.onClosed();
      };
      this.activeLeafChangeRef = app.workspace.on(
        "active-leaf-change",
        (leaf) => {
          if (this.closed || leaf === ea2.getSidepanelLeaf()) return;
          if (leaf && ea2.isExcalidrawView(leaf.view)) {
            this.bindView(leaf.view);
            return;
          }
          if (leaf?.view.getViewType?.() === "empty") return;
          this.bindView(null);
        }
      );
      ea2.onSceneChangeHook = {
        appStateKeys: [
          "selectedElementIds",
          "selectedGroupIds",
          "selectedLinearElement",
          "viewBackgroundColor",
          "theme"
        ],
        trackElements: true,
        triggerWhenInvisible: false,
        callback: (elements, appState, _files, view) => {
          if (!this.boundView || view !== this.boundView) return;
          if (this.sorter?.isEditingNotes()) {
            this.pendingRefresh = true;
            return;
          }
          if (this.animationEditor) {
            this.animationEditor.handleSceneChange(elements, appState);
            return;
          }
          const selectionSignature = getSorterSceneSelectionSignature(appState);
          if (selectionSignature !== this.sceneSelectionSignature) {
            this.sceneSelectionSignature = selectionSignature;
            const selectedSlideId = getSceneSelectedSlideId(this.resolved, appState);
            this.pendingSceneSlideId = selectedSlideId;
            if (selectedSlideId) void this.sorter?.selectFromScene(selectedSlideId);
          }
          this.scheduleRefresh();
        }
      };
      this.bindDisplayChangeListener();
      if (this.boundView) void this.refresh(true);
      else this.renderUnavailable();
    }
    bindView(view) {
      if (this.closed) return;
      if (view === this.boundView) {
        if (view) void this.refresh();
        else this.renderUnavailable();
        return;
      }
      const generation = ++this.bindGeneration;
      void this.applyViewBinding(view, generation);
    }
    async applyViewBinding(view, generation) {
      const previousSorter = this.sorter;
      await previousSorter?.flushNotes();
      if (this.closed || generation !== this.bindGeneration) return;
      previousSorter?.destroy();
      if (this.sorter === previousSorter) this.sorter = null;
      await this.animationEditor?.destroy();
      this.animationEditor = null;
      this.animationEditingSlideId = null;
      this.previewService?.clear();
      this.previewService = null;
      this.resolved = null;
      this.choices = {
        frame: null,
        lines: [],
        line: null,
        defaultSourceKey: null,
        defaultType: null
      };
      this.presentationSourceKey = null;
      this.sceneSelectionSignature = null;
      this.pendingSceneSlideId = null;
      this.lastFingerprint = "";
      this.boundView = view;
      this.options.ea.setView(view);
      this.options.ea.clear();
      if (!view) {
        this.renderUnavailable();
        return;
      }
      await this.refresh(true);
    }
    scheduleRefresh() {
      if (this.closed) return;
      if (this.sorter?.isEditingNotes()) {
        this.pendingRefresh = true;
        return;
      }
      if (this.refreshTimer) this.ownerWindow.clearTimeout(this.refreshTimer);
      this.refreshTimer = this.ownerWindow.setTimeout(() => {
        this.refreshTimer = 0;
        void this.refresh();
      }, 180);
    }
    appendSupportLine(root, doc) {
      const support = doc.createElement("div");
      support.className = "slideshow-sidepanel__support";
      const prefix = doc.createElement("span");
      prefix.textContent = `${this.options.t("supportPrompt")} `;
      support.appendChild(prefix);
      const link = doc.createElement("a");
      link.href = "https://ko-fi.com/zsolt";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = this.options.t("supportLink");
      support.appendChild(link);
      root.appendChild(support);
    }
    appendSettingsButton(header, doc) {
      const { ea: ea2, icons, t } = this.options;
      const settingsButton = doc.createElement("button");
      settingsButton.type = "button";
      settingsButton.className = "slideshow-sidepanel__icon-button";
      settingsButton.setAttribute("aria-label", t("settingsTitle"));
      settingsButton.innerHTML = icons.settings;
      settingsButton.addEventListener("click", () => {
        void (async () => {
          await this.sorter?.flushNotes();
          openSlideshowSettingsModal(ea2, this.options.config, t, () => {
            this.previewService?.clear();
            this.lastFingerprint = "";
            void this.refresh(true);
          });
        })();
      });
      header.appendChild(settingsButton);
    }
    appendInfoButton(header, doc) {
      const { ea: ea2, icons, t } = this.options;
      const infoButton = doc.createElement("button");
      infoButton.type = "button";
      infoButton.className = "slideshow-sidepanel__icon-button";
      infoButton.setAttribute("aria-label", t("quickGuideButton"));
      infoButton.innerHTML = icons.info;
      infoButton.addEventListener("click", () => openSlideshowQuickGuideModal(ea2, t));
      header.appendChild(infoButton);
    }
    bindDisplayChangeListener() {
      this.removeDisplayChangeListener?.();
      this.removeDisplayChangeListener = onDisplayConfigurationChanged(this.ownerWindow, () => {
        if (this.closed) return;
        if (this.displayRefreshTimer) this.ownerWindow.clearTimeout(this.displayRefreshTimer);
        this.displayRefreshTimer = this.ownerWindow.setTimeout(() => {
          this.displayRefreshTimer = 0;
          this.lastFingerprint = "";
          void this.refresh(true);
        }, 120);
      });
    }
    renderUnavailable() {
      const { tab, t } = this.options;
      tab.setDisabled(false);
      tab.contentEl.replaceChildren();
      const style = tab.contentEl.ownerDocument.createElement("style");
      style.textContent = SLIDESHOW_SIDEPANEL_STYLES;
      tab.contentEl.appendChild(style);
      const root = tab.contentEl.ownerDocument.createElement("div");
      root.className = "slideshow-sidepanel";
      tab.contentEl.appendChild(root);
      const doc = tab.contentEl.ownerDocument;
      this.appendSupportLine(root, doc);
      const header = doc.createElement("div");
      header.className = "slideshow-sidepanel__header";
      root.appendChild(header);
      this.appendInfoButton(header, doc);
      this.appendSettingsButton(header, doc);
      const empty = tab.contentEl.ownerDocument.createElement("div");
      empty.className = "slideshow-empty";
      empty.textContent = t("noEligibleSlides");
      root.appendChild(empty);
    }
    /** Refreshes deck data and previews only when the debounced scene fingerprint changes. */
    async refresh(force = false) {
      const { ea: ea2 } = this.options;
      const view = this.boundView;
      if (this.closed || !view) {
        this.renderUnavailable();
        return;
      }
      if (this.sorter?.isEditingNotes()) {
        this.pendingRefresh = true;
        return;
      }
      if (ea2.targetView !== view) ea2.setView(view);
      const api = ea2.getExcalidrawAPI();
      if (!api) {
        this.renderUnavailable();
        return;
      }
      const choices = resolveSlideDeckChoices(ea2);
      const drawingKey = view.file.path;
      const storedSource = this.presentationSourceByDrawing.get(drawingKey);
      const presentationSourceKey = chooseSidepanelPresentationSourceKey(
        choices,
        storedSource,
        this.preferredPresentationType
      );
      if (presentationSourceKey)
        this.presentationSourceByDrawing.set(drawingKey, presentationSourceKey);
      const resolved = resolvePresentationSource(choices, presentationSourceKey);
      const appState = api.getAppState();
      const lineFingerprint = choices.lines.map((line) => `${line.key}:${line.name ?? ""}:${getDeckFingerprint(line.resolved)}`).join("|");
      const convertibleId = getConvertibleSelectedLine(ea2)?.id ?? "none";
      const declarableFrameId = getDeclarableSelectedFrame(ea2)?.id ?? "none";
      const compositeFingerprint = `${presentationSourceKey ?? "none"}|${getDeckFingerprint(choices.frame)}|${lineFingerprint}|candidate=${convertibleId}|frameCandidate=${declarableFrameId}|${appState.theme}|${appState.viewBackgroundColor}|${getSceneVisualFingerprint(ea2.getViewElements())}`;
      if (!force && compositeFingerprint === this.lastFingerprint) return;
      const requestedSlideId = this.requestedSlideId;
      if (this.sceneSelectionSignature === null) {
        this.sceneSelectionSignature = getSorterSceneSelectionSignature(appState);
        this.pendingSceneSlideId = getSceneSelectedSlideId(resolved, appState);
      }
      const selectedId = this.animationEditingSlideId ?? requestedSlideId ?? this.pendingSceneSlideId ?? this.sorter?.getSelectedSlideId() ?? null;
      const expandedNotesId = this.sorter?.getExpandedNotesSlideId() ?? null;
      const sorterScrollTop = this.sorter?.getScrollTop() ?? 0;
      this.sorter?.destroy();
      this.sorter = null;
      this.choices = choices;
      this.presentationSourceKey = presentationSourceKey;
      this.resolved = resolved;
      this.lastFingerprint = compositeFingerprint;
      this.pendingRefresh = false;
      this.previewService ??= new SlidePreviewService(ea2, api, this.options.config);
      const renderedSorter = this.render(selectedId, expandedNotesId);
      this.pendingSceneSlideId = null;
      if (requestedSlideId) {
        renderedSorter?.scrollToSlide(requestedSlideId);
      } else {
        renderedSorter?.restoreScrollTop(sorterScrollTop);
      }
    }
    render(preferredSlideId, preferredNotesSlideId) {
      const { tab, t, icons, ea: ea2 } = this.options;
      tab.setDisabled(false);
      tab.contentEl.replaceChildren();
      const style = tab.contentEl.ownerDocument.createElement("style");
      style.textContent = SLIDESHOW_SIDEPANEL_STYLES;
      tab.contentEl.appendChild(style);
      const doc = tab.contentEl.ownerDocument;
      const root = doc.createElement("div");
      root.className = "slideshow-sidepanel";
      root.style.setProperty(
        "--slideshow-sorter-thumbnail-max-width",
        `${this.sorterThumbnailMaxWidth}px`
      );
      tab.contentEl.appendChild(root);
      this.appendSupportLine(root, doc);
      const header = doc.createElement("div");
      header.className = "slideshow-sidepanel__header";
      root.appendChild(header);
      const noVisibleSlides = Boolean(this.resolved && this.resolved.deck.visibleSlides.length === 0);
      const resumeSlide = this.boundView && this.resolved ? getResumeSlideForPresentation(
        getSlideshowProgress(this.boundView),
        getSlideshowProgressType(this.boundView),
        this.presentationSourceKey ? getPresentationSourceType(this.presentationSourceKey) : null,
        this.resolved.deck.visibleSlides.length,
        getSlideshowProgressSource(this.boundView),
        this.presentationSourceKey
      ) : null;
      const selectedSlideId = this.sorter?.getSelectedSlideId() ?? preferredSlideId ?? this.resolved?.deck.slides[0]?.id ?? null;
      const selectedVisibleIndex = this.resolved ? getVisibleSlideIndex(this.resolved.deck, selectedSlideId) : null;
      this.refreshDisplayTargets();
      const startButton = doc.createElement("button");
      startButton.type = "button";
      startButton.className = "slideshow-sidepanel__icon-button slideshow-sidepanel__launch-main";
      startButton.setAttribute("aria-label", t("startPresentation"));
      startButton.innerHTML = icons.play;
      startButton.disabled = !this.resolved || noVisibleSlides;
      header.appendChild(startButton);
      startButton.addEventListener("click", () => void this.launchPresentation());
      const printButton = doc.createElement("button");
      printButton.type = "button";
      printButton.className = "slideshow-sidepanel__icon-button";
      const printLabel = t("printPdf", {
        width: this.options.config.printSlideWidth,
        height: this.options.config.printSlideHeight
      });
      printButton.setAttribute("aria-label", printLabel);
      printButton.innerHTML = icons.printer;
      printButton.disabled = !this.resolved || noVisibleSlides;
      header.appendChild(printButton);
      printButton.addEventListener("click", (event) => {
        void this.printPresentation(event);
      });
      const declarableFrame = getDeclarableSelectedFrame(ea2);
      const convertibleLine = getConvertibleSelectedLine(ea2);
      if (declarableFrame) {
        const createFrameButton = doc.createElement("button");
        createFrameButton.type = "button";
        createFrameButton.className = "slideshow-sidepanel__icon-button";
        createFrameButton.setAttribute("aria-label", t("declareFrameSlideshow"));
        createFrameButton.innerHTML = icons.plus;
        createFrameButton.addEventListener("click", () => void this.declareSelectedFrameSlideshow());
        header.appendChild(createFrameButton);
      } else if (convertibleLine) {
        const createPathButton = doc.createElement("button");
        createPathButton.type = "button";
        createPathButton.className = "slideshow-sidepanel__icon-button";
        createPathButton.setAttribute("aria-label", t("createLinePresentation"));
        createPathButton.innerHTML = icons.plus;
        createPathButton.addEventListener(
          "click",
          () => void this.convertSelectedLineToPresentation()
        );
        header.appendChild(createPathButton);
      } else if (this.presentationSourceKey !== "frame" && this.resolved?.pathElement) {
        const pathHidden = isPresentationPathHidden(this.resolved.pathElement);
        const pathButton = doc.createElement("button");
        pathButton.type = "button";
        pathButton.className = "slideshow-sidepanel__icon-button";
        pathButton.setAttribute(
          "aria-label",
          t(pathHidden ? "showPresentationPath" : "hidePresentationPath")
        );
        pathButton.innerHTML = pathHidden ? icons.eyeOff : icons.eye;
        pathButton.addEventListener("click", () => void this.togglePresentationPathVisibility());
        header.appendChild(pathButton);
      }
      this.appendInfoButton(header, doc);
      this.appendSettingsButton(header, doc);
      if (!this.resolved || !this.previewService) {
        const empty = doc.createElement("div");
        empty.className = "slideshow-empty";
        empty.textContent = t("noEligibleSlides");
        root.appendChild(empty);
        return null;
      }
      const launchSettings = doc.createElement("details");
      launchSettings.className = "slideshow-sidepanel__launch-settings";
      launchSettings.open = this.launchSettingsExpanded;
      launchSettings.addEventListener("toggle", () => {
        this.launchSettingsExpanded = launchSettings.open;
      });
      const launchSummary = doc.createElement("summary");
      launchSummary.className = "slideshow-sidepanel__launch-settings-summary";
      launchSummary.textContent = t("presentationSettings");
      launchSettings.appendChild(launchSummary);
      root.appendChild(launchSettings);
      const launchOptions = doc.createElement("div");
      launchOptions.className = "slideshow-sidepanel__launch-options";
      launchSettings.appendChild(launchOptions);
      const appendSelect = (labelText, value, options, onChange) => {
        const label = doc.createElement("label");
        label.className = "slideshow-sidepanel__launch-option";
        const select = doc.createElement("select");
        select.setAttribute("aria-label", labelText);
        for (const optionDefinition of options) {
          const option = doc.createElement("option");
          option.value = optionDefinition.value;
          option.textContent = optionDefinition.label;
          option.disabled = optionDefinition.disabled ?? false;
          select.appendChild(option);
        }
        select.value = value;
        select.addEventListener("change", () => onChange(select.value));
        label.appendChild(select);
        launchOptions.appendChild(label);
        return select;
      };
      const sourceOptions = getPresentationSourceLabels(
        this.choices,
        t("frameDeck"),
        t("linePresentationDefaultName")
      );
      if (sourceOptions.length > 1 && this.presentationSourceKey) {
        appendSelect(
          t("presentationType"),
          this.presentationSourceKey,
          sourceOptions.map((option) => ({ value: option.key, label: option.label })),
          (nextSource) => void this.selectPresentationSource(nextSource)
        );
      }
      const effectiveStartMode = this.startMode === "resume" && resumeSlide === null ? "beginning" : this.startMode === "current" && selectedVisibleIndex === null ? "beginning" : this.startMode;
      appendSelect(
        t("startMode"),
        effectiveStartMode,
        [
          { value: "beginning", label: t("startModeStart") },
          { value: "resume", label: t("startModeResume"), disabled: resumeSlide === null },
          {
            value: "current",
            label: t("startModeCurrent"),
            disabled: selectedVisibleIndex === null
          }
        ],
        (mode) => {
          this.startMode = mode;
          void this.persistLaunchPreferences();
        }
      );
      if (!ea2.DEVICE.isMobile) {
        appendSelect(
          t("windowMode"),
          this.windowMode,
          [
            { value: "fullscreen", label: t("windowModeFullscreen") },
            { value: "window", label: t("windowModeWindowed") }
          ],
          (mode) => {
            this.windowMode = mode;
            void this.persistLaunchPreferences();
          }
        );
        const hasSecondaryDisplay = this.displays.length > 1;
        appendSelect(
          t("notesMode"),
          hasSecondaryDisplay ? this.notesMode : "slides",
          [
            { value: "slides", label: t("notesModeSlidesOnly") },
            {
              value: "presenter",
              label: t("notesModeWithNotes"),
              disabled: !hasSecondaryDisplay
            }
          ],
          (mode) => {
            this.notesMode = mode;
            void this.persistLaunchPreferences();
            this.lastFingerprint = "";
            void this.refresh(true);
          }
        );
      }
      if (!ea2.DEVICE.isMobile && this.notesMode === "presenter" && this.displays.length > 1) {
        const displayControls = doc.createElement("div");
        displayControls.className = "slideshow-sidepanel__display-controls";
        launchSettings.appendChild(displayControls);
        const appendDisplayPicker = (labelText, selectedId, onChange) => {
          const label = doc.createElement("label");
          const caption = doc.createElement("span");
          caption.textContent = labelText;
          label.appendChild(caption);
          const select = doc.createElement("select");
          select.setAttribute("aria-label", labelText);
          for (const display of this.displays) {
            const option = doc.createElement("option");
            option.value = String(display.id);
            option.textContent = this.getDisplayLabel(display);
            select.appendChild(option);
          }
          if (selectedId !== null) select.value = String(selectedId);
          select.addEventListener("change", () => onChange(Number(select.value)));
          label.appendChild(select);
          displayControls.appendChild(label);
        };
        appendDisplayPicker(t("presentationDisplay"), this.presentationDisplayId, (id) => {
          this.presentationDisplayId = id;
          void this.persistDisplayPreferences();
        });
        appendDisplayPicker(t("presenterDisplay"), this.presenterDisplayId, (id) => {
          this.presenterDisplayId = id;
          void this.persistDisplayPreferences();
        });
      }
      const deck = this.resolved.deck;
      const summaryRow = doc.createElement("div");
      summaryRow.className = "slideshow-sidepanel__summary-row";
      root.appendChild(summaryRow);
      const summary = doc.createElement("div");
      summary.className = "slideshow-sidepanel__summary";
      summaryRow.appendChild(summary);
      const activeSourceLabel = sourceOptions.find((option) => option.key === this.presentationSourceKey)?.label ?? (deck.kind === "frame" ? t("frameDeck") : t("linePresentationDefaultName"));
      summary.textContent = `${activeSourceLabel} \xB7 ${t("visibleSlideCount", { visible: deck.visibleSlides.length, total: deck.slides.length })}`;
      const thumbnailSizeControl = doc.createElement("label");
      thumbnailSizeControl.className = "slideshow-sidepanel__thumbnail-size-control";
      thumbnailSizeControl.setAttribute("aria-label", t("sorterThumbnailSize"));
      thumbnailSizeControl.title = t("sorterThumbnailSize");
      const thumbnailSizeSlider = doc.createElement("input");
      thumbnailSizeSlider.type = "range";
      thumbnailSizeSlider.min = "140";
      thumbnailSizeSlider.max = "520";
      thumbnailSizeSlider.step = "20";
      thumbnailSizeSlider.value = String(this.sorterThumbnailMaxWidth);
      thumbnailSizeSlider.setAttribute("aria-label", t("sorterThumbnailSize"));
      thumbnailSizeSlider.addEventListener("input", () => {
        this.sorterThumbnailMaxWidth = Number(thumbnailSizeSlider.value);
        root.style.setProperty(
          "--slideshow-sorter-thumbnail-max-width",
          `${this.sorterThumbnailMaxWidth}px`
        );
      });
      thumbnailSizeSlider.addEventListener("change", () => {
        void this.persistSorterThumbnailMaxWidth();
      });
      thumbnailSizeControl.appendChild(thumbnailSizeSlider);
      summaryRow.appendChild(thumbnailSizeControl);
      if (deck.kind === "path") {
        const presentationSettingsButton = doc.createElement("button");
        presentationSettingsButton.type = "button";
        presentationSettingsButton.className = "slideshow-sidepanel__icon-button slideshow-sidepanel__presentation-settings";
        presentationSettingsButton.setAttribute("aria-label", t("linePresentationSettings"));
        presentationSettingsButton.innerHTML = icons.moreHorizontal;
        presentationSettingsButton.addEventListener(
          "click",
          () => this.openLinePresentationSettings()
        );
        summaryRow.appendChild(presentationSettingsButton);
      }
      const reorderEnabled = !this.resolved.pathElement || !hasBoundLineEndpoint(this.resolved.pathElement);
      if (!reorderEnabled) {
        const warning = doc.createElement("div");
        warning.className = "slideshow-warning";
        warning.textContent = t("lineReorderBound");
        root.appendChild(warning);
      }
      if (deck.kind === "path") {
        const warning = doc.createElement("div");
        warning.className = "slideshow-warning";
        warning.textContent = t("lineAnimationUnsupported");
        root.appendChild(warning);
      }
      const sorterContainer = doc.createElement("div");
      sorterContainer.className = "slideshow-sorter";
      sorterContainer.setAttribute("role", "list");
      root.appendChild(sorterContainer);
      this.sorter = new SlideSorter({
        ea: ea2,
        container: sorterContainer,
        deck,
        previewService: this.previewService,
        icons,
        t,
        reorderEnabled,
        animationEditingSlideId: this.animationEditingSlideId,
        callbacks: {
          move: (fromIndex, toIndex) => this.moveSlide(fromIndex, toIndex),
          toggleInclusion: (slide, excluded) => this.toggleInclusion(slide, excluded),
          zoomToSlide: (slide) => this.zoomToSlide(slide),
          saveNotes: (slide, notes) => this.saveNotes(slide, notes),
          requestAnimationEditor: (slide) => this.requestAnimationEditor(slide),
          mountAnimationEditor: (slide, container) => this.mountAnimationEditor(slide, container),
          editFrameSlideName: (slide) => this.openFrameSlideNameEditor(slide),
          editLineSlide: (slide, index) => this.editLineSlide(slide, index),
          notesBlurred: () => {
            if (this.pendingRefresh) this.scheduleRefresh();
          }
        }
      });
      this.sorter.render(preferredSlideId, preferredNotesSlideId);
      return this.sorter;
    }
    refreshDisplayTargets() {
      const hostWindow = this.boundView?.ownerWindow ?? this.ownerWindow;
      const displays = getAvailableDisplays(hostWindow);
      const configurationKey = getSlideshowDisplayConfigurationKey(displays);
      const configurationChanged = configurationKey !== this.displayConfigurationKey;
      this.displays = displays;
      this.displayConfigurationKey = configurationKey;
      if (displays.length === 0) {
        this.presentationDisplayId = null;
        this.presenterDisplayId = null;
        return;
      }
      const defaults = chooseDefaultDisplayTargets(displays, getCurrentDisplayId(hostWindow));
      const saved = loadSlideshowDisplayPreferences(
        this.options.ea,
        this.deviceKey,
        configurationKey
      );
      const savedPresentationId = saved ? resolveSlideshowDisplayTarget(
        displays,
        saved.presentationDisplayId,
        saved.presentationDisplayIdentity
      ) : null;
      const savedPresenterId = saved ? resolveSlideshowDisplayTarget(
        displays,
        saved.presenterDisplayId,
        saved.presenterDisplayIdentity
      ) : null;
      if (configurationChanged) {
        this.presentationDisplayId = savedPresentationId ?? defaults.presentationDisplayId;
        this.presenterDisplayId = savedPresenterId ?? defaults.presenterDisplayId;
        return;
      }
      const presentationValid = displays.some(
        (display) => display.id === this.presentationDisplayId
      );
      const presenterValid = displays.some((display) => display.id === this.presenterDisplayId);
      if (!presentationValid) {
        this.presentationDisplayId = savedPresentationId ?? defaults.presentationDisplayId;
      }
      if (!presenterValid) {
        this.presenterDisplayId = savedPresenterId ?? defaults.presenterDisplayId;
      }
    }
    getDisplayLabel(display) {
      const resolution = `${display.bounds.width}\xD7${display.bounds.height}`;
      const primary = display.primary ? ` \xB7 ${this.options.t("primaryDisplay")}` : "";
      const name = display.label || this.options.t("displayLabel", { number: display.index + 1 });
      return `${name} \xB7 ${resolution}${primary}`;
    }
    persistLaunchPreferences() {
      const preferences = {
        startMode: this.startMode,
        windowMode: this.windowMode,
        notesMode: this.notesMode,
        ...this.presentationSourceKey ? { presentationType: getPresentationSourceType(this.presentationSourceKey) } : {}
      };
      this.settingsWriteQueue = this.settingsWriteQueue.then(() => saveSlideshowLaunchPreferences(this.options.ea, preferences)).catch((error) => console.error("Slideshow launch preference save failed", error));
      return this.settingsWriteQueue;
    }
    persistDisplayPreferences() {
      const presentationDisplay = this.displays.find(
        (display) => display.id === this.presentationDisplayId
      );
      const presenterDisplay = this.displays.find(
        (display) => display.id === this.presenterDisplayId
      );
      const preferences = {
        presentationDisplayId: this.presentationDisplayId,
        presenterDisplayId: this.presenterDisplayId,
        presentationDisplayIdentity: presentationDisplay ? getSlideshowDisplayIdentity(presentationDisplay) : null,
        presenterDisplayIdentity: presenterDisplay ? getSlideshowDisplayIdentity(presenterDisplay) : null
      };
      const configurationKey = this.displayConfigurationKey ?? getSlideshowDisplayConfigurationKey(this.displays);
      this.settingsWriteQueue = this.settingsWriteQueue.then(
        () => saveSlideshowDisplayPreferences(
          this.options.ea,
          this.deviceKey,
          preferences,
          configurationKey
        )
      ).catch((error) => console.error("Slideshow display preference save failed", error));
      return this.settingsWriteQueue;
    }
    /** Persists the sorter thumbnail cap through the sidepanel's serialized settings queue. */
    persistSorterThumbnailMaxWidth() {
      const width = this.sorterThumbnailMaxWidth;
      this.settingsWriteQueue = this.settingsWriteQueue.then(() => saveSorterThumbnailMaxWidth(this.options.ea, width)).catch((error) => console.error("Slideshow thumbnail-size save failed", error));
      return this.settingsWriteQueue;
    }
    hideSidepanelForWindowedPresentation() {
      const sidepanelLeaf = this.options.ea.getSidepanelLeaf();
      const container = sidepanelLeaf?.view.containerEl;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const visible = container.isConnected && rect.width > 1 && rect.height > 1 && this.ownerWindow.getComputedStyle(container).display !== "none";
      if (visible) this.options.ea.toggleSidepanelView();
    }
    async launchPresentation() {
      const view = this.boundView;
      const resolved = this.resolved;
      const presentationSourceKey = this.presentationSourceKey;
      if (!view || !resolved || !presentationSourceKey || resolved.deck.visibleSlides.length === 0)
        return;
      const presentationType = getPresentationSourceType(presentationSourceKey);
      await this.persistLaunchPreferences();
      const resume = getResumeSlideForPresentation(
        getSlideshowProgress(view),
        getSlideshowProgressType(view),
        presentationType,
        resolved.deck.visibleSlides.length,
        getSlideshowProgressSource(view),
        presentationSourceKey
      );
      const selectedId = this.sorter?.getSelectedSlideId() ?? null;
      const selectedIndex = getVisibleSlideIndex(resolved.deck, selectedId);
      const effectiveStartMode = this.startMode === "resume" && resume === null ? "beginning" : this.startMode === "current" && selectedIndex === null ? "beginning" : this.startMode;
      let initialSlide;
      if (effectiveStartMode === "resume") {
        initialSlide = resume ?? 0;
      } else if (effectiveStartMode === "current") {
        if (selectedIndex === null) {
          new Notice(this.options.t("selectedSlideNotPresentable"));
          return;
        }
        initialSlide = selectedIndex;
      } else {
        initialSlide = 0;
      }
      await this.sorter?.flushNotes();
      await this.animationEditor?.destroy();
      this.animationEditor = null;
      this.animationEditingSlideId = null;
      this.refreshDisplayTargets();
      await this.persistDisplayPreferences();
      const { startFullscreen, openPresenterView } = resolveDeviceLaunchModes(
        this.options.ea.DEVICE.isMobile,
        this.windowMode,
        this.notesMode,
        this.displays.length > 1
      );
      const launchOptions = {
        initialSlide,
        startFullscreen,
        openPresenterView,
        ...openPresenterView && this.presentationDisplayId !== null ? { presentationDisplayId: this.presentationDisplayId } : {},
        ...openPresenterView && this.presenterDisplayId !== null ? { presenterDisplayId: this.presenterDisplayId } : {}
      };
      if (!startFullscreen) this.hideSidepanelForWindowedPresentation();
      await this.options.startPresentation(presentationSourceKey, launchOptions);
    }
    async printPresentation(event) {
      await this.sorter?.flushNotes();
      if (this.animationEditor) {
        await this.animationEditor.destroy();
        this.animationEditor = null;
        this.animationEditingSlideId = null;
        this.lastFingerprint = "";
        await this.refresh(true);
      }
      if (this.presentationSourceKey) {
        await this.options.printPresentation(this.presentationSourceKey, event);
      }
    }
    async selectPresentationSource(sourceKey) {
      if (!hasPresentationSource(this.choices, sourceKey) || sourceKey === this.presentationSourceKey)
        return;
      await this.sorter?.flushNotes();
      await this.animationEditor?.destroy();
      this.animationEditor = null;
      this.animationEditingSlideId = null;
      const view = this.boundView;
      if (!view) return;
      this.presentationSourceByDrawing.set(view.file.path, sourceKey);
      this.preferredPresentationType = getPresentationSourceType(sourceKey);
      this.presentationSourceKey = sourceKey;
      await this.persistLaunchPreferences();
      this.lastFingerprint = "";
      await this.refresh(true);
    }
    async convertSelectedLineToPresentation() {
      const view = this.boundView;
      const path = getConvertibleSelectedLine(this.options.ea);
      if (!view || !path) return;
      try {
        await this.sorter?.flushNotes();
        await createLinePresentation(
          this.options.ea,
          path.id,
          this.options.t("linePresentationDefaultName")
        );
        await view.forceSave(true);
        const sourceKey = `line:${path.id}`;
        this.presentationSourceByDrawing.set(view.file.path, sourceKey);
        this.presentationSourceKey = sourceKey;
        this.preferredPresentationType = "line";
        await this.persistLaunchPreferences();
        this.lastFingerprint = "";
        await this.refresh(true);
      } catch (error) {
        console.error("Slideshow line presentation creation failed", error);
        new Notice(this.options.t("metadataSaveFailed"));
      }
    }
    async declareSelectedFrameSlideshow() {
      const view = this.boundView;
      const frame = getDeclarableSelectedFrame(this.options.ea);
      if (!view || !frame) return;
      try {
        await this.sorter?.flushNotes();
        await declareFrameSlideshow(this.options.ea, frame.id);
        await view.forceSave(true);
        this.presentationSourceByDrawing.set(view.file.path, "frame");
        this.presentationSourceKey = "frame";
        this.preferredPresentationType = "frame";
        await this.persistLaunchPreferences();
        this.lastFingerprint = "";
        await this.refresh(true);
      } catch (error) {
        console.error("Slideshow frame presentation declaration failed", error);
        new Notice(this.options.t("metadataSaveFailed"));
      }
    }
    openFrameSlideNameEditor(slide) {
      const view = this.boundView;
      if (!view) return;
      const frame = this.options.ea.getViewElements().find(
        (element) => element.id === slide.frameId && isFrameElement(element)
      );
      if (!frame) return;
      const { ea: ea2, t } = this.options;
      const modal = new ea2.obsidian.Modal(app);
      modal.titleEl.setText(t("editFrameSlideName"));
      const input = modal.contentEl.createEl("input", {
        type: "text",
        value: frame.name ?? "",
        attr: { "aria-label": t("frameSlideName") }
      });
      input.style.width = "100%";
      input.style.marginBottom = "1rem";
      const actions = modal.contentEl.createDiv({ cls: "modal-button-container" });
      const cancel = actions.createEl("button", { text: t("settingsCancel") });
      cancel.addEventListener("click", () => modal.close());
      const save = actions.createEl("button", { text: t("settingsSave"), cls: "mod-cta" });
      save.addEventListener("click", () => {
        void (async () => {
          try {
            await renameFrameSlide(ea2, slide.frameId, input.value);
            await view.forceSave(true);
            modal.close();
            this.lastFingerprint = "";
            await this.refresh(true);
          } catch (error) {
            console.error("Slideshow frame rename failed", error);
            new Notice(t("metadataSaveFailed"));
          }
        })();
      });
      modal.open();
      input.focus();
      input.select();
    }
    openLinePresentationSettings() {
      const source = getLineSourceByKey(this.choices, this.presentationSourceKey);
      const view = this.boundView;
      if (!source || !view) return;
      const { ea: ea2, t } = this.options;
      const modal = new ea2.obsidian.Modal(app);
      modal.titleEl.setText(t("linePresentationSettings"));
      const input = modal.contentEl.createEl("input", {
        type: "text",
        value: source.name ?? t("linePresentationDefaultName"),
        attr: { "aria-label": t("linePresentationName") }
      });
      input.style.width = "100%";
      input.style.marginBottom = "1rem";
      const actions = modal.contentEl.createDiv({
        cls: "slideshow-line-presentation-settings__actions"
      });
      actions.style.display = "flex";
      actions.style.gap = "0.5rem";
      actions.style.flexWrap = "wrap";
      const save = actions.createEl("button", { text: t("settingsSave") });
      save.addEventListener("click", () => {
        void (async () => {
          try {
            await renameLinePresentation(ea2, source.pathId, input.value);
            await view.forceSave(true);
            modal.close();
            this.lastFingerprint = "";
            await this.refresh(true);
          } catch (error) {
            console.error("Slideshow line presentation rename failed", error);
            new Notice(t("metadataSaveFailed"));
          }
        })();
      });
      const remove = actions.createEl("button", { text: t("removeLinePresentation") });
      remove.style.color = "var(--text-error)";
      remove.addEventListener("click", () => {
        const confirmed = this.ownerWindow.confirm(t("removeLinePresentationConfirm"));
        if (!confirmed) return;
        void (async () => {
          try {
            await removeLinePresentation(ea2, source.pathId);
            await view.forceSave(true);
            modal.close();
            this.presentationSourceByDrawing.delete(view.file.path);
            this.presentationSourceKey = null;
            this.lastFingerprint = "";
            await this.refresh(true);
          } catch (error) {
            console.error("Slideshow line presentation removal failed", error);
            new Notice(t("metadataSaveFailed"));
          }
        })();
      });
      modal.open();
      input.focus();
      input.select();
    }
    async togglePresentationPathVisibility() {
      const path = this.resolved?.pathElement;
      if (!path) return;
      try {
        await this.sorter?.flushNotes();
        await setLinePresentationPathHidden(
          this.options.ea,
          path.id,
          !isPresentationPathHidden(path)
        );
        this.lastFingerprint = "";
        await this.refresh(true);
      } catch (error) {
        console.error("Slideshow presentation path visibility update failed", error);
        new Notice(this.options.t("metadataSaveFailed"));
      }
    }
    async moveSlide(fromIndex, toIndex) {
      if (!this.resolved) return;
      try {
        await this.sorter?.flushNotes();
        if (this.resolved.deck.kind === "frame") {
          await reorderFrameSlides(this.options.ea, fromIndex, toIndex);
        } else if (this.resolved.pathElement) {
          await reorderLineSlides(this.options.ea, this.resolved.pathElement.id, fromIndex, toIndex);
        }
        this.lastFingerprint = "";
        await this.refresh(true);
      } catch (error) {
        if (error instanceof Error && error.message === "BOUND_PRESENTATION_PATH") {
          new Notice(this.options.t("lineReorderBound"));
        } else {
          console.error("Slideshow sorter reorder failed", error);
          new Notice(this.options.t("reorderFailed"));
        }
      }
    }
    async toggleInclusion(slide, excluded) {
      try {
        await this.sorter?.flushNotes();
        if (slide.kind === "frame") {
          await setFrameExcluded(this.options.ea, slide.frameId, excluded);
        } else {
          await setLineSlideExcluded(this.options.ea, slide.pathId, slide.id, excluded);
        }
        this.lastFingerprint = "";
        await this.refresh(true);
      } catch (error) {
        console.error("Slideshow inclusion update failed", error);
        new Notice(this.options.t("metadataSaveFailed"));
      }
    }
    async saveNotes(slide, notes) {
      try {
        const view = this.boundView;
        if (!view) throw new Error("The slideshow sidepanel is not bound to a drawing.");
        if (this.options.ea.targetView !== view) this.options.ea.setView(view);
        if (slide.kind === "frame") {
          await saveFrameNotes(this.options.ea, slide.frameId, notes);
        } else {
          await saveLineNotes(this.options.ea, slide.pathId, slide.id, notes);
        }
        await view.forceSave(true);
        this.lastFingerprint = "";
        if (!this.sorter?.isEditingNotes() && this.pendingRefresh) this.scheduleRefresh();
      } catch (error) {
        console.error("Slideshow notes update failed", error);
        new Notice(this.options.t("metadataSaveFailed"));
      }
    }
    zoomToSlide(slide) {
      const api = this.options.ea.getExcalidrawAPI();
      const view = this.boundView;
      if (!api || !view) return;
      view.preventAutozoom();
      const appState = api.getAppState();
      const rect = getNavigationRect(
        slide.rect,
        { width: appState.width, height: appState.height },
        this.options.config.maxZoom
      );
      api.updateScene({
        appState: {
          scrollX: -rect.left,
          scrollY: -rect.top,
          zoom: { value: rect.nextZoom }
        }
      });
    }
    async editLineSlide(slide, index) {
      if (slide.kind !== "path") return;
      const { ea: ea2 } = this.options;
      const api = ea2.getExcalidrawAPI();
      const view = this.boundView;
      if (!api || !view) return;
      try {
        await this.sorter?.flushNotes();
        const currentPath = ea2.getViewElements().find((element) => element.id === slide.pathId);
        if (!isLinearPathElement(currentPath)) return;
        if (isPresentationPathHidden(currentPath)) {
          await setLinePresentationPathHidden(ea2, currentPath.id, false);
        }
        const path = ea2.getViewElements().find((element) => element.id === slide.pathId);
        if (!isLinearPathElement(path)) return;
        app.workspace.setActiveLeaf(view.leaf, { focus: true });
        view.preventAutozoom();
        ea2.selectElementsInView([path]);
        const appState = api.getAppState();
        let rect = getNavigationRect(
          slide.rect,
          { width: appState.width, height: appState.height },
          this.options.config.maxZoom
        );
        const offsetWidth = (rect.right - rect.left) * (1 - this.options.config.editZoomOut) / 2;
        const offsetHeight = (rect.bottom - rect.top) * (1 - this.options.config.editZoomOut) / 2;
        rect = {
          left: rect.left - offsetWidth,
          right: rect.right + offsetWidth,
          top: rect.top - offsetHeight,
          bottom: rect.bottom + offsetHeight,
          nextZoom: Math.max(rect.nextZoom * this.options.config.editZoomOut, 0.1)
        };
        api.updateScene({
          appState: {
            scrollX: -rect.left,
            scrollY: -rect.top,
            zoom: { value: rect.nextZoom }
          }
        });
        api.setActiveTool({ type: "selection" });
        api.startLineEditor(path, [index * 2, index * 2 + 1]);
        this.lastFingerprint = "";
      } catch (error) {
        console.error("Slideshow line-slide editing failed", error);
        new Notice(this.options.t("editLineSlideFailed"));
      }
    }
    requestAnimationEditor(slide) {
      if (slide.kind !== "frame") {
        new Notice(this.options.t("lineAnimationUnsupported"));
        return;
      }
      void (async () => {
        await this.sorter?.flushNotes();
        if (this.animationEditingSlideId === slide.id) {
          await this.closeAnimationEditor();
          return;
        }
        await this.animationEditor?.destroy();
        this.animationEditor = null;
        this.animationEditingSlideId = slide.id;
        const expandedNotesId = this.sorter?.getExpandedNotesSlideId() ?? null;
        this.sorter?.destroy();
        this.sorter = null;
        const sorter = this.render(slide.id, expandedNotesId);
        this.selectAndZoomAnimationFrame(slide);
        sorter?.scrollToSlide(slide.id, false, "start");
      })();
    }
    mountAnimationEditor(slide, container) {
      const api = this.options.ea.getExcalidrawAPI();
      const view = this.boundView;
      if (!api || !view || slide.id !== this.animationEditingSlideId) return;
      const previousEditor = this.animationEditor;
      this.animationEditor = null;
      void previousEditor?.destroy();
      this.animationEditor = new AnimationEditor({
        ea: this.options.ea,
        api,
        hostView: view,
        container,
        slide,
        icons: this.options.icons,
        t: this.options.t,
        onSaved: () => {
          this.lastFingerprint = "";
        }
      });
      this.animationEditor.render();
      this.animationEditor.handleSceneChange(this.options.ea.getViewElements(), api.getAppState());
    }
    selectAndZoomAnimationFrame(slide) {
      const view = this.boundView;
      if (!view) return;
      const frame = this.options.ea.getViewElements().find((element) => element.id === slide.frameId);
      if (!frame) return;
      this.options.ea.selectElementsInView([frame]);
      this.zoomToSlide(slide);
      app.workspace.setActiveLeaf(view.leaf, { focus: true });
    }
    async closeAnimationEditor() {
      await this.animationEditor?.destroy();
      this.animationEditor = null;
      const slideId = this.animationEditingSlideId;
      this.animationEditingSlideId = null;
      this.lastFingerprint = "";
      await this.refresh(true);
      if (slideId) this.sorter?.scrollToSlide(slideId);
    }
  };

  // src/scripts/slideshow/slideshowLauncher.ts
  function resolveManualInvocationIntent(modifiers) {
    return {
      openSidepanel: modifiers.ctrlKey || modifiers.metaKey,
      resume: modifiers.shiftKey,
      startFullscreen: !modifiers.altKey
    };
  }
  function resolveLaunchModifiers(view) {
    return { startFullscreen: !view.modifierKeyDown.altKey };
  }
  function getElementPresentationSourceKey(element) {
    if (isFrameElement(element) && hasFrameSlideshowDeclaration(element.customData)) return "frame";
    if (isLinearPathElement(element)) return getLinePresentationSourceKey(element);
    return null;
  }
  function registerSlideshowElementActionProvider(context) {
    return context.ea.registerElementActionProvider((element) => {
      const latestContext = getSlideshowViewContext(context.view) ?? context;
      const presentationSourceKey = getElementPresentationSourceKey(element) ?? (isFrameElement(element) && latestContext.ea.getViewElements().some(
        (candidate) => isFrameElement(candidate) && hasFrameSlideshowDeclaration(candidate.customData)
      ) ? "frame" : null);
      if (!presentationSourceKey) return [];
      return [
        {
          id: "edit-slideshow",
          title: latestContext.t("editSlideshow"),
          icon: "presentation",
          action: () => {
            latestContext.ea.setView(latestContext.view);
            void openSlideshowSidepanel(
              latestContext,
              presentationSourceKey,
              presentationSourceKey === "frame" ? element.id : void 0
            );
          }
        }
      ];
    });
  }
  async function startSlideshowPresentation(context, launch = {}) {
    const { ea: ea2, view, config, t } = context;
    ea2.setView(view);
    if (view.isDirty()) await view.forceSave(true);
    const api = ea2.getExcalidrawAPI();
    if (!api) {
      new Notice(t("cannotAccessView"));
      return;
    }
    const runtime = getSlideshowRuntime();
    const previous = runtime.presentations.get(view);
    if (previous) await previous.exit();
    const choices = resolveSlideDeckChoices(ea2);
    const requestedSource = launch.presentationSourceKey ?? launch.presentationType ?? choices.defaultSourceKey ?? void 0;
    const setup = resolvePresentationSetup(ea2, api, t, requestedSource);
    if (!setup || setup.slides.length === 0) return;
    app.workspace.setActiveLeaf(view.leaf, { focus: true });
    const modifierDefaults = resolveLaunchModifiers(view);
    const savedProgressType = getSlideshowProgressType(view);
    const savedProgressSource = getSlideshowProgressSource(view);
    const resumedSlide = launch.resume && (!savedProgressType || savedProgressType === setup.pathType) && (!savedProgressSource || savedProgressSource === setup.sourceKey) ? getSlideshowProgress(view) : void 0;
    const initialSlide = launch.initialSlide ?? resumedSlide ?? 0;
    const controller = new SlideshowController({
      ea: ea2,
      api,
      hostView: view,
      statusBarElement: view.ownerDocument.querySelector("div.status-bar"),
      setup,
      config,
      icons: getSlideshowIcons(ea2),
      initialSlide,
      startFullscreen: launch.startFullscreen ?? modifierDefaults.startFullscreen,
      ...launch.openPresenterView === void 0 ? {} : { openPresenterViewOnStart: launch.openPresenterView },
      ...launch.presentationDisplayId === void 0 ? {} : { presentationDisplayId: launch.presentationDisplayId },
      ...launch.presenterDisplayId === void 0 ? {} : { presenterDisplayId: launch.presenterDisplayId },
      t,
      onSlideChange: (slide) => setSlideshowProgress(view, slide, setup.sourceKey),
      onExit: () => {
        if (runtime.presentations.get(view) === controller) {
          runtime.presentations.delete(view);
        }
      },
      openSidepanel: () => openSlideshowSidepanel(context, setup.sourceKey)
    });
    runtime.presentations.set(view, controller);
    setSlideshowProgress(view, initialSlide, setup.sourceKey);
    try {
      await controller.start();
    } catch (error) {
      if (runtime.presentations.get(view) === controller) {
        runtime.presentations.delete(view);
      }
      throw error;
    }
  }
  async function printSlideshowPresentation(context, presentationSource, event) {
    const { ea: ea2, view, config, t } = context;
    ea2.setView(view);
    if (view.isDirty()) await view.forceSave(true);
    const api = ea2.getExcalidrawAPI();
    if (!api) {
      new Notice(t("cannotAccessView"));
      return;
    }
    const choices = resolveSlideDeckChoices(ea2);
    const resolved = presentationSource === "line" ? choices.line : presentationSource === "frame" ? choices.frame : resolvePresentationSource(choices, presentationSource);
    if (!resolved || resolved.deck.visibleSlides.length === 0) {
      new Notice(t("allSlidesExcluded"));
      return;
    }
    await printSlideshowToPdf({
      event,
      ea: ea2,
      api,
      slides: resolved.deck.visibleSlides.map((slide) => slide.rect),
      printSlideWidth: config.printSlideWidth,
      printSlideHeight: config.printSlideHeight,
      maxZoom: config.maxZoom,
      t
    });
  }
  async function openSlideshowSidepanel(context, preferredSource, preferredSlideId) {
    const runtime = getSlideshowRuntime();
    await runtime.presentations.get(context.view)?.exit();
    if (runtime.sidepanel) {
      await runtime.sidepanel.activate(context.view, preferredSource, preferredSlideId);
      return;
    }
    const existing = context.ea.checkForActiveSidepanelTabForScript();
    if (existing) {
      existing.close();
    }
    context.ea.setView(context.view);
    const tab = await context.ea.createSidepanelTab(context.t("sidepanelTitle"), false, true);
    if (!tab) return;
    const sidepanel = new SlideshowSidepanel({
      ea: context.ea,
      tab,
      t: context.t,
      icons: getSlideshowIcons(context.ea),
      config: context.config,
      onClosed: () => {
        if (runtime.sidepanel?.activate === handle.activate) runtime.sidepanel = null;
      },
      startPresentation: async (presentationSourceKey, launchOptions) => {
        const boundView = sidepanel.getBoundView();
        if (!boundView) return;
        const boundContext = getSlideshowViewContext(boundView);
        if (!boundContext) return;
        Object.assign(boundContext.config, context.config);
        await startSlideshowPresentation(boundContext, {
          presentationSourceKey,
          ...launchOptions
        });
      },
      printPresentation: async (presentationSourceKey, event) => {
        const boundView = sidepanel.getBoundView();
        if (!boundView) return;
        const boundContext = getSlideshowViewContext(boundView);
        if (!boundContext) return;
        Object.assign(boundContext.config, context.config);
        await printSlideshowPresentation(boundContext, presentationSourceKey, event);
      }
    });
    const handle = {
      activate: async (view, source, slideId) => {
        await sidepanel.activate(view, source, slideId);
        tab.open();
        sidepanel.revealRequestedSlide();
      }
    };
    runtime.sidepanel = handle;
    sidepanel.initialize();
    await handle.activate(context.view, preferredSource, preferredSlideId);
  }
  async function runManualSlideshowInvocation(context) {
    const intent = resolveManualInvocationIntent(context.view.modifierKeyDown);
    if (intent.openSidepanel) {
      await openSlideshowSidepanel(context);
      return;
    }
    const active = getSlideshowRuntime().presentations.get(context.view);
    if (active) {
      active.advance();
      return;
    }
    context.ea.setView(context.view);
    const preferences = loadSlideshowLaunchPreferences(context.ea);
    const ownerWindow = context.view.ownerWindow;
    const displays = context.ea.DEVICE.isMobile ? [] : getAvailableDisplays(ownerWindow);
    const openPresenterView = !context.ea.DEVICE.isMobile && preferences.notesMode === "presenter" && displays.length > 1;
    const launch = {
      resume: intent.resume,
      startFullscreen: intent.startFullscreen,
      openPresenterView
    };
    if (openPresenterView) {
      const deviceKey = getSlideshowDeviceKey(ownerWindow);
      const configurationKey = getSlideshowDisplayConfigurationKey(displays);
      const savedDisplays = loadSlideshowDisplayPreferences(
        context.ea,
        deviceKey,
        configurationKey
      );
      const defaults = chooseDefaultDisplayTargets(displays, getCurrentDisplayId(ownerWindow));
      const presentationDisplayId = savedDisplays ? resolveSlideshowDisplayTarget(
        displays,
        savedDisplays.presentationDisplayId,
        savedDisplays.presentationDisplayIdentity
      ) ?? defaults.presentationDisplayId : defaults.presentationDisplayId;
      const presenterDisplayId = savedDisplays ? resolveSlideshowDisplayTarget(
        displays,
        savedDisplays.presenterDisplayId,
        savedDisplays.presenterDisplayIdentity
      ) ?? defaults.presenterDisplayId : defaults.presenterDisplayId;
      if (presentationDisplayId !== null) launch.presentationDisplayId = presentationDisplayId;
      if (presenterDisplayId !== null) launch.presenterDisplayId = presenterDisplayId;
    }
    await startSlideshowPresentation(context, launch);
  }

  // src/scripts/slideshow/run.ts
  async function runSlideshow(scriptEa, scriptUtils, config) {
    const t = createSlideshowTranslator(scriptEa.obsidian.moment.locale());
    if (!scriptEa.verifyMinimumPluginVersion("2.27.0")) {
      new Notice(t("requiresNewerVersion"));
      return;
    }
    const targetView = scriptEa.targetView;
    if (!targetView) return;
    const context = {
      ea: scriptEa,
      utils: scriptUtils,
      view: targetView,
      config,
      t
    };
    const wasKnown = registerSlideshowViewContext(context);
    if (!wasKnown) registerSlideshowElementActionProvider(context);
    await scriptEa.registerAutostart(t("autostartExplanation"));
    if (scriptUtils.executionSource !== "manual") return;
    await runManualSlideshowInvocation(context);
  }

  // src/scripts/slideshow/main.ts
  void runSlideshow(ea, utils, loadSlideshowConfig(ea));
})();