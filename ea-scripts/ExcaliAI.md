/*
# ExcaliAI

Generate HTML, Mermaid, mind maps, editable SVG strokes and images from a canvas selection and a prompt. Includes an editable task library, image transforms, mask edits, aspect-ratio previews and response token overrides.

Uses **Excalidraw AI** provider profiles and model preferences, including OpenAI reasoning effort. Configure keys in the plugin (obfuscated vault settings or device-local Obsidian SecretStorage); this script never stores API keys. Your chosen task sends its prompt and, when enabled, selected canvas image to that provider.

Requires Excalidraw 2.29.2 or newer. Open a drawing and run **ExcaliAI**. Preserve that script filename when replacing an older copy so its task library and preferences remain under the same Script Engine settings key.

The migration preserves legacy settings and task IDs. Existing JavaScript modal/export orchestration remains in run.js, with import-safe task helpers and typed request helpers. New script UI strings and default prompts are in lang/en.ts; maintained locale files use English fallback for untranslated advanced content.

Build: npm run build. Deploy build/excali-ai/excali-ai.md as ea-scripts/ExcaliAI.md in the plugin repository.

Validation uses fake providers and keys. Verify live providers, mask edits and generated content separately with your own API access.

Tutorial: https://www.youtube.com/watch?v=A1vrSGBbWgo

Maintained source: https://github.com/zsviczian/ea-scripts/tree/main/src/scripts/excali-ai

Build version: 2026-11-17T17:24:59.281Z

```javascript
*/

// Script bundle
/* EA Script — excali-ai | ea-scripts v1.0.0 */
(() => {
  // src/scripts/excali-ai/tasks.ts
  var createTaskHelpers = (t) => {
    const EXCALIAI_SETTINGS_VERSION = 1;
    const DEFAULT_IMAGE_SIZE = "1024x1024";
    const TASK_EXECUTION_MODES = {
      TEXT_RESULT: "text-result",
      IMAGE_PROMPT: "image-prompt",
      IMAGE_DIRECT: "image-direct",
      IMAGE_EDIT: "image-edit"
    };
    const TASK_RESULT_TYPES = {
      HTML: "html",
      MINDMAP: "mindmap",
      MERMAID: "mermaid",
      SVG: "svg",
      IMAGE: "image",
      IMAGE_SILENT: "image-silent"
    };
    const TASK_INPUT_RULES = {
      DISABLED: "disabled",
      OPTIONAL: "optional",
      REQUIRED: "required"
    };
    const TASK_MASK_MODES = {
      DISABLED: "disabled",
      OPTIONAL: "optional",
      REQUIRED: "required"
    };
    const TASK_RUNTIME_APIS = {
      NONE: "",
      MINDMAP_BUILDER: "mindmap-builder"
    };
    const VALID_TASK_EXECUTION_MODES = Object.values(TASK_EXECUTION_MODES);
    const VALID_TASK_RESULT_TYPES = Object.values(TASK_RESULT_TYPES);
    const VALID_TASK_INPUT_RULES = Object.values(TASK_INPUT_RULES);
    const VALID_TASK_MASK_MODES = Object.values(TASK_MASK_MODES);
    const VALID_TASK_RUNTIME_APIS = Object.values(TASK_RUNTIME_APIS);
    const TASK_EXECUTION_MODE_META = {
      [TASK_EXECUTION_MODES.TEXT_RESULT]: {
        label: t("textResponse"),
        description: t("usesTheTextOrMultimodalModelAnd")
      },
      [TASK_EXECUTION_MODES.IMAGE_PROMPT]: {
        label: t("writePromptThenGenerateImage"),
        description: t("usesTheTextModelToWriteAn")
      },
      [TASK_EXECUTION_MODES.IMAGE_DIRECT]: {
        label: t("sendPromptStraightToImageModel"),
        description: t("sendsOnlyTheUserSPromptTo")
      },
      [TASK_EXECUTION_MODES.IMAGE_EDIT]: {
        label: t("editSelectedImage"),
        description: t("usesTheSelectedImageAsTheSource")
      }
    };
    const TASK_RESULT_TYPE_META = {
      [TASK_RESULT_TYPES.HTML]: {
        label: "HTML",
        description: t("embedsTheResponseAsASingleHtml")
      },
      [TASK_RESULT_TYPES.MINDMAP]: {
        label: t("mindMap"),
        description: t("importsTheResponseIntoMindmapBuilder"),
        runtimeRequirement: TASK_RUNTIME_APIS.MINDMAP_BUILDER
      },
      [TASK_RESULT_TYPES.MERMAID]: {
        label: t("mermaid"),
        description: t("createsAMermaidDiagram")
      },
      [TASK_RESULT_TYPES.SVG]: {
        label: t("excalidrawStrokes"),
        description: t("usesSvgBehindTheScenesToGenerate")
      },
      [TASK_RESULT_TYPES.IMAGE]: {
        label: t("imagePromptNote"),
        description: t("generatesAnImageAndAddsTheModel")
      },
      [TASK_RESULT_TYPES.IMAGE_SILENT]: {
        label: t("imageOnly"),
        description: t("generatesOnlyTheImageWithoutAddingThe")
      }
    };
    const getTaskExecutionModeMeta = (mode) => TASK_EXECUTION_MODE_META[mode] ?? TASK_EXECUTION_MODE_META[TASK_EXECUTION_MODES.TEXT_RESULT];
    const getTaskExecutionModeLabel = (mode) => getTaskExecutionModeMeta(mode).label;
    const getTaskExecutionModeDescription = (mode) => getTaskExecutionModeMeta(mode).description;
    const getTaskResultTypeMeta = (resultType) => TASK_RESULT_TYPE_META[resultType] ?? TASK_RESULT_TYPE_META[TASK_RESULT_TYPES.HTML];
    const getTaskResultTypeLabel = (resultType) => getTaskResultTypeMeta(resultType).label;
    const getTaskResultTypeDescription = (resultType) => getTaskResultTypeMeta(resultType).description;
    const getTaskRuntimeRequirement = (taskConfig) => getTaskResultTypeMeta(taskConfig?.execution?.resultType ?? TASK_RESULT_TYPES.HTML).runtimeRequirement ?? TASK_RUNTIME_APIS.NONE;
    const getTaskRuntimeRequirementLabel = (runtimeRequirement) => {
      switch (runtimeRequirement) {
        case TASK_RUNTIME_APIS.MINDMAP_BUILDER:
          return t("mindmapBuilder");
        default:
          return t("none");
      }
    };
    const normalizeEnumValue = (value, validValues, fallbackValue) => typeof value === "string" && validValues.includes(value) ? value : fallbackValue;
    const cloneJSON = (value) => {
      if (value === null || value === void 0) {
        return value;
      }
      return JSON.parse(JSON.stringify(value));
    };
    const createTaskIdFromName = (value = "") => {
      const normalizedValue = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return normalizedValue || "task";
    };
    const getDefaultOutputInstruction = (resultType) => {
      switch (resultType) {
        case TASK_RESULT_TYPES.HTML:
          return t("turnThisIntoASingleHtmlFile");
        case TASK_RESULT_TYPES.MINDMAP:
          return t("returnOnlyTheMindMapAsPlain");
        case TASK_RESULT_TYPES.MERMAID:
          return t("returnASingleMessageContainingOnlyThe");
        case TASK_RESULT_TYPES.SVG:
          return t("returnASingleMessageContainingOnlyThe2");
        case TASK_RESULT_TYPES.IMAGE:
        case TASK_RESULT_TYPES.IMAGE_SILENT:
          return t("returnASingleMessageWithTheGenerated");
        default:
          return "";
      }
    };
    const getDefaultResultTypeForMode = (mode) => {
      switch (mode) {
        case TASK_EXECUTION_MODES.IMAGE_PROMPT:
        case TASK_EXECUTION_MODES.IMAGE_DIRECT:
        case TASK_EXECUTION_MODES.IMAGE_EDIT:
          return TASK_RESULT_TYPES.IMAGE;
        default:
          return TASK_RESULT_TYPES.HTML;
      }
    };
    const normalizeTaskConfig = (task = {}, index = 0) => {
      const execution = task.execution ?? {};
      const mode = normalizeEnumValue(
        execution.mode,
        VALID_TASK_EXECUTION_MODES,
        TASK_EXECUTION_MODES.TEXT_RESULT
      );
      const resultType = normalizeEnumValue(
        execution.resultType,
        VALID_TASK_RESULT_TYPES,
        getDefaultResultTypeForMode(mode)
      );
      const imageInputFallback = mode === TASK_EXECUTION_MODES.IMAGE_DIRECT ? TASK_INPUT_RULES.DISABLED : mode === TASK_EXECUTION_MODES.IMAGE_EDIT ? TASK_INPUT_RULES.REQUIRED : TASK_INPUT_RULES.OPTIONAL;
      return {
        id: createTaskIdFromName(task.id ?? task.name ?? `task-${index + 1}`),
        name: String(task.name ?? "").trim() || t("task", { value1: index + 1 }),
        help: String(task.help ?? "").trim(),
        systemPrompt: task.systemPrompt === null || task.systemPrompt === void 0 ? null : String(task.systemPrompt),
        outputInstruction: String(task.outputInstruction ?? getDefaultOutputInstruction(resultType)),
        execution: {
          mode,
          resultType,
          userPrompt: normalizeEnumValue(
            execution.userPrompt,
            VALID_TASK_INPUT_RULES,
            TASK_INPUT_RULES.OPTIONAL
          ),
          imageInput: normalizeEnumValue(
            execution.imageInput,
            VALID_TASK_INPUT_RULES,
            imageInputFallback
          ),
          maskMode: normalizeEnumValue(
            execution.maskMode,
            VALID_TASK_MASK_MODES,
            mode === TASK_EXECUTION_MODES.IMAGE_EDIT ? TASK_MASK_MODES.OPTIONAL : TASK_MASK_MODES.DISABLED
          ),
          requiresApi: getTaskResultTypeMeta(resultType).runtimeRequirement ?? TASK_RUNTIME_APIS.NONE
        }
      };
    };
    const normalizeTaskConfigs = (tasks, { fallbackToDefaults = false } = {}) => {
      if (!Array.isArray(tasks)) {
        return fallbackToDefaults ? normalizeTaskConfigs(createDefaultTaskConfigs()) : [];
      }
      const usedIds = /* @__PURE__ */ new Set();
      return tasks.map((task, index) => {
        const normalizedTask = normalizeTaskConfig(task, index);
        if (normalizedTask.execution.mode !== TASK_EXECUTION_MODES.IMAGE_EDIT) {
          normalizedTask.execution.maskMode = TASK_MASK_MODES.DISABLED;
        }
        let nextId = normalizedTask.id || createTaskIdFromName(normalizedTask.name) || `task-${index + 1}`;
        let duplicateCount = 2;
        while (usedIds.has(nextId)) {
          nextId = `${normalizedTask.id}-${duplicateCount++}`;
        }
        usedIds.add(nextId);
        normalizedTask.id = nextId;
        return normalizedTask;
      });
    };
    const createDefaultTaskConfigs = () => [
      {
        id: "challenge-my-thinking",
        name: t("challengeMyThinking"),
        help: t("turnTheSelectedImageAndOptionalPrompt"),
        systemPrompt: t("yourTaskIsToInterpretAScreenshot"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.MERMAID),
        execution: {
          mode: TASK_EXECUTION_MODES.TEXT_RESULT,
          resultType: TASK_RESULT_TYPES.MERMAID,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "convert-sketch-to-shapes",
        name: t("convertSketchToShapes"),
        help: t("convertSelectedSketchesIntoExcalidrawStrokesWorks"),
        systemPrompt: t("givenAnImageFeaturingVariousGeometricShapes"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.SVG),
        execution: {
          mode: TASK_EXECUTION_MODES.TEXT_RESULT,
          resultType: TASK_RESULT_TYPES.SVG,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "create-a-simple-excalidraw-icon",
        name: t("createASimpleExcalidrawIcon"),
        help: t("turnATextPromptIntoASimple"),
        systemPrompt: t("givenADescriptionOfAnSvgImage"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.SVG),
        execution: {
          mode: TASK_EXECUTION_MODES.TEXT_RESULT,
          resultType: TASK_RESULT_TYPES.SVG,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.DISABLED,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "create-a-stick-figure",
        name: t("createAStickFigure"),
        help: t("sendOnlyTheTextPromptToThe"),
        systemPrompt: t("youWillReceiveAPromptFromThe"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
          resultType: TASK_RESULT_TYPES.IMAGE,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.DISABLED,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "edit-an-image",
        name: t("editAnImage"),
        help: t("imageElementsAreUsedAsTheSource"),
        systemPrompt: null,
        outputInstruction: "",
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_EDIT,
          resultType: TASK_RESULT_TYPES.IMAGE,
          userPrompt: TASK_INPUT_RULES.REQUIRED,
          imageInput: TASK_INPUT_RULES.REQUIRED,
          maskMode: TASK_MASK_MODES.OPTIONAL,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "generate-an-image-from-image-and-prompt",
        name: t("generateAnImageFromImageAndPrompt"),
        help: t("generateAnImageFromTheSelectedImage"),
        systemPrompt: t("yourTaskInvolvesReceivingAnImageAnd"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
          resultType: TASK_RESULT_TYPES.IMAGE,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "generate-an-image-from-prompt",
        name: t("generateAnImageFromPrompt"),
        help: t("sendOnlyTheTextPromptToThe"),
        systemPrompt: null,
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_DIRECT,
          resultType: TASK_RESULT_TYPES.IMAGE,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.DISABLED,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "generate-an-image-to-illustrate-a-quote",
        name: t("generateAnImageToIllustrateAQuote"),
        help: t("turnAQuoteIntoAnIllustratedScene"),
        systemPrompt: t("yourTaskInvolvesTransformingAUserProvided"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
          resultType: TASK_RESULT_TYPES.IMAGE,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.DISABLED,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "generate-4-icon-variants-based-on-input-image",
        name: t("generateIconVariantsBasedOnInputImage"),
        help: t("generateAXSheetOfFourIcon"),
        systemPrompt: t("givenASimpleSketchAndAnOptional"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE_SILENT),
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
          resultType: TASK_RESULT_TYPES.IMAGE_SILENT,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "visual-brainstorm",
        name: t("visualBrainstorm"),
        help: t("generateAnImageFromTheSelectedImage2"),
        systemPrompt: t("yourObjectiveIsToInterpretAScreenshot"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
        execution: {
          mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
          resultType: TASK_RESULT_TYPES.IMAGE,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "wireframe-to-code",
        name: t("wireframeToCode"),
        help: t("interpretTheSelectedWireframeAndGenerateA"),
        systemPrompt: t("youAreAnExpertTailwindDeveloperA"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.HTML),
        execution: {
          mode: TASK_EXECUTION_MODES.TEXT_RESULT,
          resultType: TASK_RESULT_TYPES.HTML,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.NONE
        }
      },
      {
        id: "create-mindmap",
        name: t("createMindmap"),
        help: t("createAHierarchicalMindMapFromThe"),
        systemPrompt: t("youWillReceiveATextPromptAnd"),
        outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.MINDMAP),
        execution: {
          mode: TASK_EXECUTION_MODES.TEXT_RESULT,
          resultType: TASK_RESULT_TYPES.MINDMAP,
          userPrompt: TASK_INPUT_RULES.OPTIONAL,
          imageInput: TASK_INPUT_RULES.OPTIONAL,
          maskMode: TASK_MASK_MODES.DISABLED,
          requiresApi: TASK_RUNTIME_APIS.MINDMAP_BUILDER
        }
      }
    ];
    const DEFAULT_TASK_CONFIGS = normalizeTaskConfigs(createDefaultTaskConfigs());
    const DEFAULT_TASK_ID = DEFAULT_TASK_CONFIGS.find((task) => task.id === "wireframe-to-code")?.id ?? DEFAULT_TASK_CONFIGS[0]?.id ?? "";
    const createDefaultState = (taskConfigs = []) => ({
      selectedTaskId: taskConfigs.find((task) => task.id === DEFAULT_TASK_ID)?.id ?? taskConfigs[0]?.id ?? "",
      userPrompt: "",
      maskEdit: true,
      textModel: "",
      imageModel: "",
      maxTokens: "",
      imageSize: DEFAULT_IMAGE_SIZE
    });
    const normalizeState = (state = {}, taskConfigs = []) => {
      const defaultState = createDefaultState(taskConfigs);
      const knownTaskIds = new Set(taskConfigs.map((task) => task.id));
      const selectedTaskId = String(state.selectedTaskId ?? defaultState.selectedTaskId).trim();
      return {
        selectedTaskId: knownTaskIds.has(selectedTaskId) ? selectedTaskId : defaultState.selectedTaskId,
        userPrompt: String(state.userPrompt ?? defaultState.userPrompt),
        maskEdit: state.maskEdit !== false,
        textModel: String(state.textModel ?? defaultState.textModel),
        imageModel: String(state.imageModel ?? defaultState.imageModel),
        maxTokens: String(state.maxTokens ?? defaultState.maxTokens).trim(),
        imageSize: String(state.imageSize ?? defaultState.imageSize).trim() || defaultState.imageSize
      };
    };
    const createDefaultExcaliAISettings = () => ({
      schemaVersion: EXCALIAI_SETTINGS_VERSION,
      config: {
        tasks: cloneJSON(DEFAULT_TASK_CONFIGS)
      },
      state: createDefaultState(DEFAULT_TASK_CONFIGS)
    });
    const LEGACY_TASK_NAME_TO_ID = Object.fromEntries(
      DEFAULT_TASK_CONFIGS.map((task) => [task.name, task.id])
    );
    const loadExcaliAISettings = (rawSettings) => {
      const sourceSettings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
      const normalizedSettings = createDefaultExcaliAISettings();
      normalizedSettings.config.tasks = normalizeTaskConfigs(sourceSettings.config?.tasks, {
        fallbackToDefaults: true
      });
      const legacyState = {
        selectedTaskId: LEGACY_TASK_NAME_TO_ID[String(sourceSettings["Agent's Task"] ?? "").trim()] ?? normalizedSettings.state.selectedTaskId,
        userPrompt: sourceSettings["User Prompt"] ?? normalizedSettings.state.userPrompt,
        maskEdit: sourceSettings["Mask Edit"] !== false,
        textModel: sourceSettings["Text Model"] ?? normalizedSettings.state.textModel,
        imageModel: sourceSettings["Image Model"] ?? normalizedSettings.state.imageModel,
        maxTokens: sourceSettings["Max Tokens"] ?? normalizedSettings.state.maxTokens,
        imageSize: sourceSettings["Image Size"] ?? normalizedSettings.state.imageSize
      };
      normalizedSettings.state = normalizeState(
        {
          ...legacyState,
          ...sourceSettings.state ?? {}
        },
        normalizedSettings.config.tasks
      );
      return {
        settings: normalizedSettings,
        needsSave: JSON.stringify(sourceSettings) !== JSON.stringify(normalizedSettings)
      };
    };
    return {
      EXCALIAI_SETTINGS_VERSION,
      DEFAULT_IMAGE_SIZE,
      TASK_EXECUTION_MODES,
      TASK_RESULT_TYPES,
      TASK_INPUT_RULES,
      TASK_MASK_MODES,
      TASK_RUNTIME_APIS,
      VALID_TASK_EXECUTION_MODES,
      VALID_TASK_RESULT_TYPES,
      VALID_TASK_INPUT_RULES,
      VALID_TASK_MASK_MODES,
      VALID_TASK_RUNTIME_APIS,
      TASK_EXECUTION_MODE_META,
      TASK_RESULT_TYPE_META,
      getTaskExecutionModeMeta,
      getTaskExecutionModeLabel,
      getTaskExecutionModeDescription,
      getTaskResultTypeMeta,
      getTaskResultTypeLabel,
      getTaskResultTypeDescription,
      getTaskRuntimeRequirement,
      getTaskRuntimeRequirementLabel,
      normalizeEnumValue,
      cloneJSON,
      createTaskIdFromName,
      getDefaultOutputInstruction,
      getDefaultResultTypeForMode,
      normalizeTaskConfig,
      normalizeTaskConfigs,
      createDefaultTaskConfigs,
      DEFAULT_TASK_CONFIGS,
      DEFAULT_TASK_ID,
      createDefaultState,
      normalizeState,
      createDefaultExcaliAISettings,
      LEGACY_TASK_NAME_TO_ID,
      loadExcaliAISettings
    };
  };

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

  // src/scripts/excali-ai/lang/en.ts
  var en = {
    scriptFailed: "ExcaliAI could not start. Check that your drawing is open and the selected images are available.",
    requestFailed: "ExcaliAI could not complete this task. Check your model settings and try again.",
    errorTitle: "Error",
    thisScriptRequiresExcalidrawOrLaterPlease: "This script requires Excalidraw 2.23.0 or later. Please update the plugin.",
    textResponse: "Text response",
    usesTheTextOrMultimodalModelAnd: "Uses the text or multimodal model and returns structured output such as HTML, Mermaid, a mind map, or Excalidraw strokes.",
    writePromptThenGenerateImage: "Write prompt, then generate image",
    usesTheTextModelToWriteAn: "Uses the text model to write an image prompt from the canvas selection and/or user prompt, then sends that prompt to the image model.",
    sendPromptStraightToImageModel: "Send prompt straight to image model",
    sendsOnlyTheUserSPromptTo: "Sends only the user's prompt to the image model. No text-model prompt writing step and no canvas image input.",
    editSelectedImage: "Edit selected image",
    usesTheSelectedImageAsTheSource: "Uses the selected image as the source and applies either a mask edit or a prompt-based transform.",
    embedsTheResponseAsASingleHtml: "Embeds the response as a single HTML result.",
    mindMap: "Mind Map",
    importsTheResponseIntoMindmapBuilder: "Imports the response into MindMap Builder.",
    mermaid: "Mermaid",
    createsAMermaidDiagram: "Creates a Mermaid diagram.",
    excalidrawStrokes: "Excalidraw Strokes",
    usesSvgBehindTheScenesToGenerate: "Uses SVG behind the scenes to generate Excalidraw strokes.",
    imagePromptNote: "Image + prompt note",
    generatesAnImageAndAddsTheModel: "Generates an image and adds the model's revised prompt underneath when available.",
    imageOnly: "Image only",
    generatesOnlyTheImageWithoutAddingThe: "Generates only the image, without adding the revised prompt underneath.",
    mindmapBuilder: "MindMap Builder",
    none: "None",
    turnThisIntoASingleHtmlFile: "Turn this into a single html file using tailwind. Return a single message containing only the html file in a codeblock.",
    returnOnlyTheMindMapAsPlain: "Return only the mind map as plain text. Use one # heading for the central node, then nested - bullets for branches. Do not use bold, italics, code fences, tables, or explanatory text.",
    returnASingleMessageContainingOnlyThe: "Return a single message containing only the mermaid diagram in a codeblock.",
    returnASingleMessageContainingOnlyThe2: "Return a single message containing only the SVG code in an html codeblock.",
    returnASingleMessageWithTheGenerated: "Return a single message with the generated image prompt in a codeblock",
    task: "Task {value1}",
    challengeMyThinking: "Challenge my thinking",
    turnTheSelectedImageAndOptionalPrompt: "Turn the selected image and optional prompt into a Mermaid mind map. If conversion fails, open More Tools > Mermaid to Excalidraw and edit the generated script.",
    yourTaskIsToInterpretAScreenshot: "Your task is to interpret a screenshot of a whiteboard, translating its ideas into a Mermaid graph. The whiteboard will encompass thoughts on a subject. Within the mind map, distinguish ideas that challenge, dispute, or contradict the whiteboard content. Additionally, include concepts that expand, complement, or advance the user's thinking. Utilize the Mermaid graph diagram type and present the resulting Mermaid diagram within a code block. Ensure the Mermaid script excludes the use of parentheses ().",
    convertSketchToShapes: "Convert sketch to shapes",
    convertSelectedSketchesIntoExcalidrawStrokesWorks: "Convert selected sketches into Excalidraw strokes. Works best with a small number of simple shapes. Experimental.",
    givenAnImageFeaturingVariousGeometricShapes: "Given an image featuring various geometric shapes drawn by the user, your objective is to analyze the input and generate SVG code that accurately represents these shapes. Your output will be the SVG code enclosed in an HTML code block.",
    createASimpleExcalidrawIcon: "Create a simple Excalidraw icon",
    turnATextPromptIntoASimple: "Turn a text prompt into a simple icon and insert it into Excalidraw as strokes. Text prompt only. Experimental.",
    givenADescriptionOfAnSvgImage: "Given a description of an SVG image from the user, your objective is to generate the corresponding SVG code. Avoid incorporating textual elements within the generated SVG. Your output should be the resulting SVG code enclosed in an HTML code block.",
    createAStickFigure: "Create a stick figure",
    sendOnlyTheTextPromptToThe: "Send only the text prompt to the configured image model. Be specific. To keep the prompt unchanged, start with: 'DO NOT add any detail, just use it AS-IS:'",
    youWillReceiveAPromptFromThe: "You will receive a prompt from the user. Your task involves drawing a simple stick figure or a scene involving a few stick figures based on the user's prompt. Create the stick figure based on the following style description. DO NOT add any detail, just use it AS-IS: Create a simple stick figure character with a large round head and a face in the style of sketchy caricatures. The stick figure should have a rudimentary body composed of straight lines representing the arms and legs. Hands and toes should be represented with round shapes, do not add details such as fingers or toes. Use fine lines, smooth curves, rounded shapes. The stick figure should retain a playful and childlike simplicity, reminiscent of a doodle someone might draw on the corner of a notebook page. Create a black and white drawing, a hand-drawn figure on white background.",
    editAnImage: "Edit an image",
    imageElementsAreUsedAsTheSource: "Image elements are used as the source image. In mask mode, shapes on top become the mask. Turn mask edit off to flatten non-image elements into the source image and apply a prompt-based transform.",
    generateAnImageFromImageAndPrompt: "Generate an image from image and prompt",
    generateAnImageFromTheSelectedImage: "Generate an image from the selected image and your prompt. Add context in the prompt to guide how the image should be interpreted.",
    yourTaskInvolvesReceivingAnImageAnd: "Your task involves receiving an image and a textual prompt from the user. Your goal is to craft a detailed, accurate, and descriptive narrative of the image, tailored for effective image generation. Utilize the user-provided text prompt to inform and guide your depiction of the image. Ensure the resulting image remains text-free.",
    generateAnImageFromPrompt: "Generate an image from prompt",
    generateAnImageToIllustrateAQuote: "Generate an image to illustrate a quote",
    turnAQuoteIntoAnIllustratedScene: "Turn a quote into an illustrated scene. Include the author's name if you want the result to reference them.",
    yourTaskInvolvesTransformingAUserProvided: "Your task involves transforming a user-provided quote into a detailed and imaginative illustration. Craft a visual representation that captures the essence of the quote and resonates well with a broad audience. If the Author's name is provided, aim to establish a connection between the illustration and the Author. This can be achieved by referencing a well-known story from the Author, situating the image in the Author's era or setting, or employing other creative methods of association. Additionally, provide preferences for styling, such as the chosen medium and artistic direction, to guide the image creation process. Ensure the resulting image remains text-free. Your task output should comprise a descriptive and detailed narrative aimed at facilitating the creation of a captivating illustration from the quote.",
    generateIconVariantsBasedOnInputImage: "Generate 4 icon-variants based on input image",
    generateAXSheetOfFourIcon: "Generate a 2x2 sheet of four icon variations from the selected sketch. Add a prompt if you want to steer the result.",
    givenASimpleSketchAndAnOptional: "Given a simple sketch and an optional text prompt from the user, your task is to generate a descriptive narrative tailored for effective image generation, capturing the style of the sketch. Utilize the text prompt to guide the description. Your objective is to instruct DALL-E to create a collage of four minimalist black and white hand-drawn pencil sketches in a 2x2 matrix format. Each sketch should convert the user's sketch into simple artistic SVG icons with transparent backgrounds. Ensure the resulting images remain text-free, maintaining a minimalist, easy-to-understand style, and omit framing borders. Only include a pencil in the drawing if it is explicitly mentioned in the user prompt or included in the sketch.",
    visualBrainstorm: "Visual brainstorm",
    generateAnImageFromTheSelectedImage2: "Generate an image from the selected image and prompt to spark new ideas.",
    yourObjectiveIsToInterpretAScreenshot: "Your objective is to interpret a screenshot of a whiteboard, creating an image aimed at sparking further thoughts on the subject. The whiteboard will present diverse ideas about a specific topic. Your generated image should achieve one of two purposes: highlighting concepts that challenge, dispute, or contradict the whiteboard content, or introducing ideas that expand, complement, or enrich the user's thinking. You have the option to include multiple tiles in the resulting image, resembling a sequence akin to a comic strip. Ensure that the image remains devoid of text.",
    wireframeToCode: "Wireframe to code",
    interpretTheSelectedWireframeAndGenerateA: "Interpret the selected wireframe and generate a web app as a single HTML file. You can copy the result from the embeddable menu.",
    youAreAnExpertTailwindDeveloperA: "You are an expert tailwind developer. A user will provide you with a low-fidelity wireframe of an application and you will return a single html file that uses tailwind to create the website. Use creative license to make the application more fleshed out. Write the necessary javascript code. If you need to insert an image, use placehold.co to create a placeholder image.",
    createMindmap: "Create Mindmap",
    createAHierarchicalMindMapFromThe: "Create a hierarchical mind map from the selected image, if any, and your prompt, then import it into MindMap Builder. Requires MindMap Builder to be available.",
    youWillReceiveATextPromptAnd: "You will receive a text prompt and may also receive an image. Create a mind map as a hierarchical plain-text outline based on the image content, if provided, and the text prompt. Return only the mind map. Use exactly one markdown H1 heading for the central node, then - bullets for branches and indented - bullets for sub-branches. Do not use bold, italics, code fences, numbering, commentary, or any markdown formatting other than the heading and bullet list.",
    excalidrawAiIsDisabledOrUnavailableEnable: "Excalidraw AI is disabled or unavailable. Enable it in plugin settings.",
    noRunnableAiTasksAreConfiguredOpen: "No runnable AI tasks are configured. Open Task Editor to add a task or reset the shipped presets.",
    taskUsesAnImageResultWithUse: 'Task "{value1}" uses an image result with {value2}. Use {value3} or {value4} instead.',
    taskMustUseAnImageResultWhen: 'Task "{value1}" must use an image result when {value2} is selected.',
    taskCannotSendACanvasImageWhen: 'Task "{value1}" cannot send a canvas image when {value2} is selected.',
    taskMustUseTheImageResultWhen: 'Task "{value1}" must use the image result when {value2} is selected.',
    taskCanOnlyEnableMaskModeWhen: 'Task "{value1}" can only enable mask mode when {value2} is selected.',
    noTextOrMultimodalModelsAreReady: "No text or multimodal models are ready to use. Add an API key to a provider profile and assign at least one text model in Excalidraw AI settings.",
    noImageModelsAreReadyToUse: "No image models are ready to use. Add an API key to a provider profile and assign at least one image model in Excalidraw AI settings.",
    theSelectedTextModelIsnTConfigured: "The selected text model ({value1}) isn't configured in Excalidraw AI settings.",
    theProviderProfileForTextModelIs: "The provider profile ({value1}) for text model {value2} is missing from Excalidraw AI settings.",
    theSelectedProviderProfileDoesnTHave: "The selected provider profile ({value1}) doesn't have an API key configured.",
    theSelectedTextModelIsSetTo: "The selected text model ({value1}) is set to text-only. Choose a multimodal model for image analysis tasks.",
    theProviderProfileForImageModelIs: "The provider profile ({value1}) for image model {value2} is missing from Excalidraw AI settings.",
    theSelectedImageModelDoesnTSupport: "The selected image model ({value1}) doesn't support prompt-based transforms in Excalidraw AI settings.",
    theSelectedImageModelDoesnTSupport2: "The selected image model ({value1}) doesn't support mask-based edits in Excalidraw AI settings.",
    theImageRequestFailed: "The image request failed.",
    somethingWentWrongCheckDeveloperConsoleFor: "Something went wrong! Check developer console for more.",
    localstorageSetitemError: "localStorage.setItem error: {value1}",
    selectContentBeforeRunningExcaliai: "Select content before running ExcaliAI.",
    enterAPromptBeforeRunningExcaliai: "Enter a prompt before running ExcaliAI.",
    enterAPromptOrSelectContentBefore: "Enter a prompt or select content before running ExcaliAI.",
    enterInstructionsForHowTheImageShould: "Enter instructions for how the image should be changed.",
    selectAnImage: "Select an image.",
    selectCanvasContentBeforeRunningThisTask: "Select canvas content before running this task.",
    selectOrCreateAMask: "Select or create a mask.",
    unexpectedExcalidrawautomateError: "Unexpected ExcalidrawAutomate error.",
    theModelHitTheTokenLimitBefore: "The model hit the token limit before it finished the HTML output. Increase 'Text max token override' in ExcaliAI or raise the default AI response token limit in plugin settings.",
    mindmapBuilderIsNotAvailable: "MindMap Builder is not available.",
    couldNotConnectToMindmapBuilder: "Could not connect to MindMap Builder.",
    couldNotCreateTheMindMap: "Could not create the mind map.",
    mindMapCreatedInMindmapBuilder: "Mind map created in MindMap Builder.",
    openMoreToolsMermaidToExcalidrawTo: "Open [More Tools > Mermaid to Excalidraw] to review and fix the generated Mermaid script.<br><br>",
    openMoreToolsMermaidToExcalidrawTo2: "Open More Tools > Mermaid to Excalidraw to review or edit the generated diagram.",
    newTask: "New Task {value1}",
    describeWhatThisTaskDoes: "Describe what this task does.",
    thisTaskIgnoresTheCurrentCanvasSelection: "This task ignores the current canvas selection and uses only the text prompt.",
    maskEditIsOffNonImageElements: "Mask edit is off. Non-image elements are flattened into the preview image and sent as a prompt-based transform.",
    thisModelDoesnTSupportMaskEdits: "This model doesn't support mask edits. Non-image elements are flattened into the preview image and sent as a prompt-based transform.",
    determinesHowTheTaskRuns: "Determines how the task runs.",
    controlsHowExcaliaiInterpretsTheModelResponse: "Controls how ExcaliAI interprets the model response.",
    validationNoTasksConfiguredAddATask: "<b>Validation:</b> No tasks configured. Add a task or reset the shipped presets.",
    validation: "<b>Validation:</b> {value1}",
    validationTaskConfigurationIsValid: "<b>Validation:</b> Task configuration is valid.",
    excaliaiTaskEditor: '{value1} <h2 style="margin: 0;">ExcaliAI Task Editor</h2>',
    tasksAreStoredInExcaliaiSScript: "Tasks are stored in ExcaliAI's script settings JSON. Edit the fields below to add, remove, or change how a task runs.",
    task2: "Task",
    selectWhichTaskToEdit: "Select which task to edit.",
    px: "1 1 220px",
    addTask: " Add task",
    deleteTask: " Delete task",
    noTaskIsSelected: "No task is selected.",
    deleteTheTask: 'Delete the task "{value1}"?',
    resetDefaults: " Reset defaults",
    resetAllExcaliaiTasksToTheShipped: "Reset all ExcaliAI tasks to the shipped defaults? This overwrites custom tasks.",
    taskId: "Task ID",
    settingsKeyNormalizedToLowercaseWithDashes: "Settings key, normalized to lowercase with dashes.",
    taskName: "Task name",
    shownInTheExcaliaiTaskPicker: "Shown in the ExcaliAI task picker.",
    taskHelp: "Task help",
    explainsTheTaskInTheMainExcaliai: "Explains the task in the main ExcaliAI dialog.",
    systemPrompt: "System prompt",
    sentToTheTextModelWhenThe: "Sent to the text model when the task uses a text-model step.",
    outputInstruction: "Output instruction",
    controlsTheExpectedResponseFormatWhenThe: "Controls the expected response format when the task uses a text-model step.",
    executionMode: "Execution mode",
    resultType: "Result type",
    userPrompt: "User prompt",
    controlsWhetherTheMainPromptBoxIs: "Controls whether the main prompt box is optional, required, or hidden for this task.",
    optional: "Optional",
    required: "Required",
    disabled: "Disabled",
    canvasImageInput: "Canvas image input",
    controlsWhetherTheSelectedCanvasContentIs: "Controls whether the selected canvas content is optional, required, or ignored.",
    maskMode: "Mask mode",
    availableOnlyInEditSelectedImageMode: "Available only in Edit selected image mode.",
    optionalToggle: "Optional toggle",
    alwaysRequired: "Always required",
    done: " Done",
    excaliai: "{value1} <h2>ExcaliAI</h2>",
    mindmapBuilderApiIsNotActiveThe: '{value1} <span><b>MindMap Builder API is not active.</b> The "Create Mindmap" task requires it to be running.</span>',
    textModelNoRunnableTaskIsSelected: "<b>Text model:</b> No runnable task is selected.",
    textModelThisTaskDoesNotUse: "<b>Text model:</b> This task does not use a text model.",
    textModel: "<b>Text model:</b> {value1}",
    theSelectedCanvasImageWillAlsoBe: "The selected canvas image will also be sent to this model.",
    onlyTheTextPromptWillBeSent: "Only the text prompt will be sent to this model.",
    textModelProviderThisModelIs: "<b>Text model:</b> {value1}. <b>Provider:</b> {value2}. This model is {value3}. {value4}",
    imageModelNoRunnableTaskIsSelected: "<b>Image model:</b> No runnable task is selected.",
    imageModelThisTaskDoesNotUse: "<b>Image model:</b> This task does not use an image model.",
    imageModel: "<b>Image model:</b> {value1}",
    doesnTSupportPromptTransforms: "doesn't support prompt transforms",
    supportsPromptTransforms: "supports prompt transforms",
    doesnTSupportMaskEdits: "doesn't support mask edits",
    supportsMaskEdits: "supports mask edits",
    maskEditIsOnSoNonImage: "Mask edit is on, so non-image elements are sent as the mask.",
    maskEditIsOffSoNonImage: "Mask edit is off, so non-image elements are flattened into the source image.",
    thisModelDoesnTSupportMaskEdits2: "This model doesn't support mask edits, so non-image elements are flattened into the source image.",
    imageModelSizesThisModelAndIf: "<b>Image model:</b> {value1}. <b>Sizes:</b> {value2}. This model {value3} and {value4}. If the selected image or mask does not match the chosen aspect ratio, ExcaliAI expands the export frame to fit the target ratio instead of cropping the content. {value5}",
    thisTaskAlwaysUsesMaskEdit: "This task always uses mask edit.",
    thisTaskRequiresMaskEditButThe: "This task requires mask edit, but the selected model does not support it.",
    onNonImageElementsBecomeTheMask: "On: non-image elements become the mask. Off: non-image elements are flattened into the source image for a prompt-based transform.",
    thisModelDoesnTSupportMaskEdits3: "This model doesn't support mask edits. ExcaliAI will flatten non-image elements into the source image and use a prompt-based transform.",
    textMaxTokensThisTaskDoesNot: "<b>Text max tokens:</b> This task does not use a text model.",
    usingTheExcaliaiOverride: "Using the ExcaliAI override.",
    usingThePluginDefaultResponseTokenLimit: "Using the plugin default response token limit.",
    usingTheSharedAiRuntimeDefaultBehavior: "Using the shared AI runtime default behavior.",
    textMaxTokens: "<b>Text max tokens:</b> {value1}. {value2}",
    preview: "Preview",
    noRunnableTaskIsSelected: "No runnable task is selected.",
    selectContentOnTheCanvasThisTask: "Select content on the canvas. This task requires an image input.",
    nothingIsSelectedSoOnlyTheText: "Nothing is selected, so only the text prompt will be sent to the configured text model.",
    thisTaskUsesOnlyTheTextPrompt: "This task uses only the text prompt and ignores canvas selection.",
    howItWorks: "<b>How it works:</b> {value1}",
    howItWorksNoRunnableTaskIs: "<b>How it works:</b> No runnable task is selected.",
    taskConfig: "<b>Task config:</b> {value1}",
    selectTheTaskYouWantToRun: "Select the task you want to run.",
    editTasks: " Edit tasks",
    prompt: "Prompt",
    advancedSettings: "{value1} <span>Advanced Settings</span>",
    textModel2: "Text model",
    textMaxTokenOverride: "Text max token override",
    imageModel2: "Image model",
    useMaskEdit: "Use mask edit",
    imageSize: "Image size",
    viewAiTokenUsageForThisSession: "View AI token usage for this session",
    run: " Run",
    noRunnableAiTaskIsSelected: "No runnable AI task is selected.",
    noView: "Open an Excalidraw drawing first.",
    generating: "Generating...",
    advancedPromptWarning: "Advanced: change this only if you know why.",
    reasoningHelp: "Reasoning effort: {effort} (from Excalidraw AI settings).",
    reasoningDefault: "API default",
    requiresVersion: "This script requires Excalidraw 2.29.2 or later. Please update the plugin."
  };

  // src/scripts/excali-ai/lang/de.ts
  var de = {
    noView: "\xD6ffne zuerst eine Excalidraw-Zeichnung.",
    requiresVersion: "Dieses Skript erfordert Excalidraw 2.29.2 oder neuer. Bitte aktualisiere das Plugin.",
    prompt: "Prompt",
    advancedSettings: "{value1} <span>Erweiterte Einstellungen</span>",
    systemPrompt: "System-Prompt",
    textModel2: "Textmodell",
    imageModel2: "Bildmodell",
    textMaxTokenOverride: "Tokenlimit f\xFCr Text \xFCberschreiben",
    reasoningHelp: "Denkaufwand: {effort} (aus den Excalidraw-KI-Einstellungen).",
    reasoningDefault: "API-Standard"
  };

  // src/scripts/excali-ai/lang/es.ts
  var es = {
    noView: "Abre primero un dibujo de Excalidraw.",
    requiresVersion: "Este script requiere Excalidraw 2.29.2 o posterior. Actualiza el complemento.",
    prompt: "Instrucciones",
    advancedSettings: "{value1} <span>Ajustes avanzados</span>",
    systemPrompt: "Instrucciones del sistema",
    textModel2: "Modelo de texto",
    imageModel2: "Modelo de imagen",
    textMaxTokenOverride: "L\xEDmite de tokens de texto",
    reasoningHelp: "Esfuerzo de razonamiento: {effort} (de los ajustes de IA de Excalidraw).",
    reasoningDefault: "Predeterminado de la API"
  };

  // src/scripts/excali-ai/lang/fr.ts
  var fr = {
    noView: "Ouvrez d\u2019abord un dessin Excalidraw.",
    requiresVersion: "Ce script n\xE9cessite Excalidraw 2.29.2 ou une version ult\xE9rieure. Mettez le plugin \xE0 jour.",
    prompt: "Instruction",
    advancedSettings: "{value1} <span>Param\xE8tres avanc\xE9s</span>",
    systemPrompt: "Instruction syst\xE8me",
    textModel2: "Mod\xE8le de texte",
    imageModel2: "Mod\xE8le d\u2019image",
    textMaxTokenOverride: "Limite de jetons du texte",
    reasoningHelp: "Effort de raisonnement : {effort} (param\xE8tres IA d\u2019Excalidraw).",
    reasoningDefault: "Valeur par d\xE9faut de l\u2019API"
  };

  // src/scripts/excali-ai/lang/ru.ts
  var ru = {
    noView: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0438\u0441\u0443\u043D\u043E\u043A Excalidraw.",
    requiresVersion: "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F Excalidraw 2.29.2 \u0438\u043B\u0438 \u043D\u043E\u0432\u0435\u0435. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u043B\u0430\u0433\u0438\u043D.",
    prompt: "\u0417\u0430\u043F\u0440\u043E\u0441",
    advancedSettings: "{value1} <span>\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</span>",
    systemPrompt: "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441",
    textModel2: "\u0422\u0435\u043A\u0441\u0442\u043E\u0432\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C",
    imageModel2: "\u041C\u043E\u0434\u0435\u043B\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0439",
    textMaxTokenOverride: "\u041B\u0438\u043C\u0438\u0442 \u0442\u043E\u043A\u0435\u043D\u043E\u0432 \u0442\u0435\u043A\u0441\u0442\u0430",
    reasoningHelp: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0440\u0430\u0441\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F: {effort} (\u0438\u0437 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u0418\u0418 Excalidraw).",
    reasoningDefault: "\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0432 API"
  };

  // src/scripts/excali-ai/lang/zh-cn.ts
  var zhCn = {
    noView: "\u8BF7\u5148\u6253\u5F00 Excalidraw \u7ED8\u56FE\u3002",
    requiresVersion: "\u6B64\u811A\u672C\u9700\u8981 Excalidraw 2.29.2 \u6216\u66F4\u65B0\u7248\u672C\u3002\u8BF7\u66F4\u65B0\u63D2\u4EF6\u3002",
    prompt: "\u63D0\u793A\u8BCD",
    advancedSettings: "{value1} <span>\u9AD8\u7EA7\u8BBE\u7F6E</span>",
    systemPrompt: "\u7CFB\u7EDF\u63D0\u793A\u8BCD",
    textModel2: "\u6587\u672C\u6A21\u578B",
    imageModel2: "\u56FE\u50CF\u6A21\u578B",
    textMaxTokenOverride: "\u8986\u76D6\u6587\u672C\u4EE4\u724C\u4E0A\u9650",
    reasoningHelp: "\u63A8\u7406\u5F3A\u5EA6\uFF1A{effort}\uFF08\u6765\u81EA Excalidraw AI \u8BBE\u7F6E\uFF09\u3002",
    reasoningDefault: "API \u9ED8\u8BA4\u503C"
  };

  // src/scripts/excali-ai/lang/index.ts
  function createExcaliAITranslator(locale) {
    return createTranslator(locale, { en, de, es, fr, ru, "zh-cn": zhCn });
  }

  // src/scripts/excali-ai/requests.ts
  function getTextModelRequest(modelId, config, profile) {
    return {
      textModelId: modelId,
      ...profile?.provider === "openai" && config?.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}
    };
  }

  // src/scripts/excali-ai/responses.ts
  function getGeneratedImageSource(result) {
    return result?.firstImage?.dataURL || result?.firstImage?.url || result?.images?.[0]?.dataURL || result?.images?.[0]?.url || null;
  }
  function getResultFinishReason(result) {
    const reason = result?.json?.choices?.[0]?.finish_reason;
    return typeof reason === "string" ? reason : "";
  }
  function isMaxTokenFinishReason(reason) {
    return ["max_tokens", "max_tokens_exceeded", "length"].includes(reason.trim().toLowerCase());
  }
  function extractStructuredContent(rawContent, blocktype, extractCodeBlocks) {
    const content = (rawContent ?? "").trim();
    if (!content) return "";
    const blocks = extractCodeBlocks(content);
    const matching = blocks.find((block) => (block.type ?? "").toLowerCase() === blocktype) || (blocktype === "svg" ? blocks.find((block) => (block.type ?? "").toLowerCase() === "html") : void 0) || blocks[0];
    if (matching?.data) return matching.data;
    if (blocktype === "html") {
      const doctype = content.indexOf("<!DOCTYPE html>"), html = content.indexOf("<html");
      const start = doctype >= 0 ? doctype : html, end = content.lastIndexOf("</html>");
      if (start >= 0 && end >= 0) return content.slice(start, end + "</html>".length);
    }
    if (blocktype === "mermaid" && content.startsWith("mermaid"))
      return content.replace(/^mermaid/, "").trim();
    if (blocktype === "mindmap") return content;
    return "";
  }

  // src/scripts/excali-ai/run.js
  async function runExcaliAI(ea2, utils2) {
    const { Notice } = ea2.obsidian;
    const t = createExcaliAITranslator(ea2.obsidian.moment.locale());
    if (!ea2.targetView) {
      new Notice(t("noView"));
      return;
    }
    const originView = ea2.targetView;
    const originAPI = ea2.getExcalidrawAPI();
    const originFilePath = originView.file?.path;
    const isViewAlive = () => ea2.targetView === originView && originView.excalidrawAPI === originAPI && originView.file?.path === originFilePath && !originView.isClosingOrMigrating();
    const app = originView.app;
    const document = ea2.targetView.containerEl.ownerDocument;
    const {
      EXCALIAI_SETTINGS_VERSION,
      DEFAULT_IMAGE_SIZE,
      TASK_EXECUTION_MODES,
      TASK_RESULT_TYPES,
      TASK_INPUT_RULES,
      TASK_MASK_MODES,
      TASK_RUNTIME_APIS,
      VALID_TASK_EXECUTION_MODES,
      VALID_TASK_RESULT_TYPES,
      VALID_TASK_INPUT_RULES,
      VALID_TASK_MASK_MODES,
      VALID_TASK_RUNTIME_APIS,
      TASK_EXECUTION_MODE_META,
      TASK_RESULT_TYPE_META,
      getTaskExecutionModeMeta,
      getTaskExecutionModeLabel,
      getTaskExecutionModeDescription,
      getTaskResultTypeMeta,
      getTaskResultTypeLabel,
      getTaskResultTypeDescription,
      getTaskRuntimeRequirement,
      getTaskRuntimeRequirementLabel,
      normalizeEnumValue,
      cloneJSON,
      createTaskIdFromName,
      getDefaultOutputInstruction,
      getDefaultResultTypeForMode,
      normalizeTaskConfig,
      normalizeTaskConfigs,
      createDefaultTaskConfigs,
      DEFAULT_TASK_CONFIGS,
      DEFAULT_TASK_ID,
      createDefaultState,
      normalizeState,
      createDefaultExcaliAISettings,
      LEGACY_TASK_NAME_TO_ID,
      loadExcaliAISettings
    } = createTaskHelpers(t);
    let dirty = false;
    if (!ea2.verifyMinimumPluginVersion || !ea2.verifyMinimumPluginVersion("2.29.2")) {
      new Notice(t("requiresVersion"));
      return;
    }
    let settings = ea2.getScriptSettings();
    const loadedExcaliAISettings = loadExcaliAISettings(settings);
    settings = loadedExcaliAISettings.settings;
    if (loadedExcaliAISettings.needsSave) {
      await ea2.setScriptSettings(settings);
    }
    let userPrompt = settings.state.userPrompt ?? "";
    let selectedTaskId = settings.state.selectedTaskId;
    let imageSize = settings.state.imageSize ?? DEFAULT_IMAGE_SIZE;
    let selectedTextModel = settings.state.textModel ?? "";
    let selectedImageModel = settings.state.imageModel ?? "";
    let selectedMaxTokens = String(settings.state.maxTokens ?? "").trim();
    let prefersMaskEdit = settings.state.maskEdit !== false;
    const aiSettings = ea2.getAISettings();
    if (!aiSettings?.enabled) {
      new Notice(t("excalidrawAiIsDisabledOrUnavailableEnable"));
      return;
    }
    let textModel, imageModel, validSizes;
    let imageDataURL = null;
    let maskDataURL = null;
    const parsePositiveInteger = (value) => {
      const normalizedValue = String(value ?? "").trim();
      if (!normalizedValue) {
        return null;
      }
      const parsedValue = parseInt(normalizedValue, 10);
      if (Number.isNaN(parsedValue) || parsedValue <= 0) {
        return null;
      }
      return parsedValue;
    };
    const getTaskConfigs = () => settings.config?.tasks ?? [];
    const isTaskRuntimeAvailable = (taskConfig) => {
      switch (getTaskRuntimeRequirement(taskConfig)) {
        case TASK_RUNTIME_APIS.MINDMAP_BUILDER:
          return Boolean(window?.MindMapBuilderAPI);
        default:
          return true;
      }
    };
    const getVisibleTaskConfigs = () => getTaskConfigs().filter(isTaskRuntimeAvailable);
    const getTaskConfigById = (taskId = selectedTaskId) => getTaskConfigs().find((taskConfig) => taskConfig.id === taskId) ?? null;
    const getVisibleTaskConfigById = (taskId = selectedTaskId) => getVisibleTaskConfigs().find((taskConfig) => taskConfig.id === taskId) ?? null;
    const ensureSelectedTaskId = () => {
      const activeVisibleTask = getVisibleTaskConfigById(selectedTaskId);
      const fallbackTask = activeVisibleTask ?? getVisibleTaskConfigs()[0] ?? null;
      const nextTaskId = fallbackTask?.id ?? "";
      if (selectedTaskId !== nextTaskId) {
        selectedTaskId = nextTaskId;
        dirty = true;
      }
      return fallbackTask;
    };
    const getActiveTaskConfig = () => ensureSelectedTaskId();
    const getTaskExecutionConfig = (taskId = selectedTaskId) => getTaskConfigById(taskId)?.execution ?? null;
    const getTaskOutputType = (taskId = selectedTaskId) => {
      const taskConfig = typeof taskId === "string" ? getTaskConfigById(taskId) : taskId;
      return {
        instruction: taskConfig?.outputInstruction ?? "",
        blocktype: taskConfig?.execution?.resultType ?? TASK_RESULT_TYPES.HTML
      };
    };
    const isImageEditTask = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.mode === TASK_EXECUTION_MODES.IMAGE_EDIT;
    const isImageGenerationTask = (taskId = selectedTaskId) => {
      const mode = getTaskExecutionConfig(taskId)?.mode;
      return mode === TASK_EXECUTION_MODES.IMAGE_PROMPT || mode === TASK_EXECUTION_MODES.IMAGE_DIRECT || mode === TASK_EXECUTION_MODES.IMAGE_EDIT;
    };
    const doesTaskUseTextModel = (taskId = selectedTaskId) => {
      const mode = getTaskExecutionConfig(taskId)?.mode;
      return mode === TASK_EXECUTION_MODES.TEXT_RESULT || mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
    };
    const doesTaskAllowUserPrompt = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.userPrompt !== TASK_INPUT_RULES.DISABLED;
    const taskRequiresUserPrompt = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.userPrompt === TASK_INPUT_RULES.REQUIRED;
    const doesTaskAllowImageInput = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.imageInput !== TASK_INPUT_RULES.DISABLED;
    const taskRequiresImageInput = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.imageInput === TASK_INPUT_RULES.REQUIRED;
    const taskUsesDirectImageModel = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.mode === TASK_EXECUTION_MODES.IMAGE_DIRECT;
    const taskUsesImagePromptPipeline = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
    const getTaskMaskMode = (taskId = selectedTaskId) => getTaskExecutionConfig(taskId)?.maskMode ?? TASK_MASK_MODES.DISABLED;
    const getTaskConfigValidationMessage = (taskConfig = getActiveTaskConfig()) => {
      if (!taskConfig) {
        return t("noRunnableAiTasksAreConfiguredOpen");
      }
      const { mode, resultType, maskMode } = taskConfig.execution;
      const isImageResultType = resultType === TASK_RESULT_TYPES.IMAGE || resultType === TASK_RESULT_TYPES.IMAGE_SILENT;
      if (mode === TASK_EXECUTION_MODES.TEXT_RESULT && isImageResultType) {
        return t("taskUsesAnImageResultWithUse", {
          value1: taskConfig.name,
          value2: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.TEXT_RESULT),
          value3: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_PROMPT),
          value4: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)
        });
      }
      if (mode === TASK_EXECUTION_MODES.IMAGE_PROMPT && !isImageResultType) {
        return t("taskMustUseAnImageResultWhen", {
          value1: taskConfig.name,
          value2: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_PROMPT)
        });
      }
      if (mode === TASK_EXECUTION_MODES.IMAGE_DIRECT && !isImageResultType) {
        return t("taskMustUseAnImageResultWhen", {
          value1: taskConfig.name,
          value2: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)
        });
      }
      if (mode === TASK_EXECUTION_MODES.IMAGE_DIRECT && taskConfig.execution.imageInput !== TASK_INPUT_RULES.DISABLED) {
        return t("taskCannotSendACanvasImageWhen", {
          value1: taskConfig.name,
          value2: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)
        });
      }
      if (mode === TASK_EXECUTION_MODES.IMAGE_EDIT && resultType !== TASK_RESULT_TYPES.IMAGE) {
        return t("taskMustUseTheImageResultWhen", {
          value1: taskConfig.name,
          value2: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_EDIT)
        });
      }
      if (mode !== TASK_EXECUTION_MODES.IMAGE_EDIT && maskMode !== TASK_MASK_MODES.DISABLED) {
        return t("taskCanOnlyEnableMaskModeWhen", {
          value1: taskConfig.name,
          value2: getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_EDIT)
        });
      }
      return "";
    };
    const getConfiguredTextMaxTokens = () => {
      const scriptOverride = parsePositiveInteger(selectedMaxTokens);
      if (scriptOverride) {
        return scriptOverride;
      }
      const pluginDefault = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
      return pluginDefault;
    };
    const getProviderProfiles = () => aiSettings.providerProfiles ?? {};
    const getTextModelConfigs = () => aiSettings.textModels ?? {};
    const getImageModelConfigs = () => aiSettings.imageModels ?? {};
    const hasConfiguredProviderApiKey = (providerId) => Boolean(getProviderProfiles()[providerId]?.hasApiKey);
    const getConfiguredModelIdsForKind = (kind) => {
      const configs = kind === "text" ? getTextModelConfigs() : getImageModelConfigs();
      return Object.keys(configs).filter((modelId) => hasConfiguredProviderApiKey(configs[modelId]?.providerId)).sort((left, right) => left.localeCompare(right));
    };
    const getMissingModelConfigurationMessage = (kind) => {
      if (kind === "text") {
        return t("noTextOrMultimodalModelsAreReady");
      }
      return t("noImageModelsAreReadyToUse");
    };
    const getConfiguredTextModel = () => (doesTaskAllowImageInput() && imageDataURL ? aiSettings.defaultMultimodalTextModel : aiSettings.defaultTextModel) || aiSettings.defaultTextModel || aiSettings.defaultMultimodalTextModel || getConfiguredModelIdsForKind("text")[0] || "";
    const getConfiguredImageModel = () => aiSettings.defaultImageModel || getConfiguredModelIdsForKind("image")[0] || "";
    const getModelConfigId = (configs, modelId) => {
      if (configs[modelId]) {
        return modelId;
      }
      return Object.keys(configs).find((configId) => configs[configId]?.model === modelId) ?? "";
    };
    const getTextModelConfigId = (modelId) => getModelConfigId(getTextModelConfigs(), modelId);
    const getImageModelConfigId = (modelId) => {
      return getModelConfigId(getImageModelConfigs(), modelId);
    };
    const getTextModelConfig = (modelId) => {
      const configId = getTextModelConfigId(modelId);
      return configId ? getTextModelConfigs()[configId] ?? null : null;
    };
    const getImageModelConfig = (modelId) => {
      const configId = getImageModelConfigId(modelId);
      return configId ? getImageModelConfigs()[configId] ?? null : null;
    };
    const getAvailableTextModels = () => {
      const configuredModels = getConfiguredModelIdsForKind("text");
      if (configuredModels.length > 0) {
        return configuredModels;
      }
      return [];
    };
    const getAvailableImageModels = () => {
      const configuredModels = getConfiguredModelIdsForKind("image");
      if (configuredModels.length > 0) {
        return configuredModels;
      }
      return [];
    };
    const getValidSizesForModel = (model) => {
      if (!model) {
        return [];
      }
      const configuredSizes = getImageModelConfig(model)?.supportedSizes?.map((size) => size?.trim()).filter(Boolean);
      if (configuredSizes?.length) {
        return configuredSizes;
      }
      return ["1024x1024"];
    };
    const parseImageSizeDimensions = (size) => {
      const match = String(size ?? "").trim().match(/^(\d+)x(\d+)$/i);
      if (!match) {
        return null;
      }
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
        return null;
      }
      return { width, height };
    };
    const greatestCommonDivisor = (a, b) => {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y !== 0) {
        const remainder = x % y;
        x = y;
        y = remainder;
      }
      return x || 1;
    };
    const CANONICAL_ASPECT_RATIOS = [
      "1:8",
      "1:4",
      "2:3",
      "3:4",
      "4:5",
      "9:16",
      "1:1",
      "16:9",
      "5:4",
      "4:3",
      "3:2",
      "4:1",
      "8:1",
      "21:9"
    ].map((label) => {
      const [width, height] = label.split(":").map((value) => parseInt(value, 10));
      return {
        label,
        ratio: width / height
      };
    });
    const ASPECT_RATIO_LABEL_RELATIVE_EPSILON = 0.02;
    const getCanonicalAspectRatioLabel = (width, height) => {
      const ratio = width / height;
      const nearest = CANONICAL_ASPECT_RATIOS.map((candidate) => ({
        ...candidate,
        delta: Math.abs(candidate.ratio - ratio)
      })).sort((left, right) => left.delta - right.delta)[0];
      if (nearest && nearest.delta / Math.max(nearest.ratio, Number.EPSILON) <= ASPECT_RATIO_LABEL_RELATIVE_EPSILON) {
        return nearest.label;
      }
      const divisor = greatestCommonDivisor(width, height);
      return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
    };
    const getAspectRatioLabelFromDimensions = (width, height) => {
      return getCanonicalAspectRatioLabel(width, height);
    };
    const getImageSizeDropdownOptions = (sizes = []) => {
      return sizes.map((size) => {
        const dimensions = parseImageSizeDimensions(size);
        if (!dimensions) {
          return {
            value: size,
            label: String(size ?? ""),
            ratioOrder: Number.POSITIVE_INFINITY,
            pixels: Number.POSITIVE_INFINITY,
            width: Number.POSITIVE_INFINITY,
            height: Number.POSITIVE_INFINITY
          };
        }
        const ratioLabel = getAspectRatioLabelFromDimensions(dimensions.width, dimensions.height);
        return {
          value: size,
          label: `(${ratioLabel}) ${dimensions.width}x${dimensions.height}`,
          ratioOrder: dimensions.width / dimensions.height,
          pixels: dimensions.width * dimensions.height,
          width: dimensions.width,
          height: dimensions.height
        };
      }).sort((left, right) => {
        if (left.ratioOrder !== right.ratioOrder) {
          return left.ratioOrder - right.ratioOrder;
        }
        if (left.pixels !== right.pixels) {
          return left.pixels - right.pixels;
        }
        if (left.width !== right.width) {
          return left.width - right.width;
        }
        if (left.height !== right.height) {
          return left.height - right.height;
        }
        return String(left.value).localeCompare(String(right.value));
      });
    };
    const getResolvedTextModelSelection = (requestedModelId = selectedTextModel) => {
      const availableModels = getAvailableTextModels();
      const requestedConfigId = getTextModelConfigId(requestedModelId);
      const configuredDefaultId = getTextModelConfigId(getConfiguredTextModel());
      const resolvedModelId = [requestedConfigId, configuredDefaultId, availableModels[0], requestedModelId].find(
        (modelId) => modelId && availableModels.includes(modelId)
      ) || "";
      const modelConfig = getTextModelConfig(resolvedModelId);
      const providerProfiles = getProviderProfiles();
      const providerId = modelConfig?.providerId ?? Object.keys(providerProfiles)[0] ?? "";
      const providerProfile = providerProfiles[providerId] ?? null;
      return {
        modelId: resolvedModelId,
        modelConfig,
        providerId,
        providerProfile,
        requestConfig: getTextModelRequest(resolvedModelId, modelConfig, providerProfile)
      };
    };
    const getResolvedImageModelSelection = (requestedModelId = selectedImageModel) => {
      const availableModels = getAvailableImageModels();
      const requestedConfigId = getImageModelConfigId(requestedModelId);
      const configuredDefaultId = getImageModelConfigId(getConfiguredImageModel());
      const resolvedModelId = [requestedConfigId, configuredDefaultId, availableModels[0], requestedModelId].find(
        (modelId) => modelId && availableModels.includes(modelId)
      ) || "";
      const modelConfig = getImageModelConfig(resolvedModelId);
      const providerProfiles = getProviderProfiles();
      const providerId = modelConfig?.providerId ?? Object.keys(providerProfiles)[0] ?? "";
      const providerProfile = providerProfiles[providerId] ?? null;
      return {
        modelId: resolvedModelId,
        modelConfig,
        providerId,
        providerProfile,
        requestConfig: {
          imageModelId: resolvedModelId
        }
      };
    };
    const getTextModelValidationMessage = (modelId, { requireMultimodal = false } = {}) => {
      if (getAvailableTextModels().length === 0) {
        return getMissingModelConfigurationMessage("text");
      }
      const textSelection = getResolvedTextModelSelection(modelId);
      if (!textSelection.modelConfig) {
        return t("theSelectedTextModelIsnTConfigured", { value1: modelId || "unknown" });
      }
      if (!textSelection.providerProfile) {
        return t("theProviderProfileForTextModelIs", {
          value1: textSelection.providerId || "unknown",
          value2: textSelection.modelId
        });
      }
      if (!textSelection.providerProfile.hasApiKey) {
        return t("theSelectedProviderProfileDoesnTHave", { value1: textSelection.providerId });
      }
      if (requireMultimodal && textSelection.modelConfig.multimodalSupport === false) {
        return t("theSelectedTextModelIsSetTo", { value1: textSelection.modelId });
      }
      return "";
    };
    const getImageModelValidationMessage = (modelId, { requirePromptTransformSupport = false, requireMaskEditSupport = false } = {}) => {
      if (getAvailableImageModels().length === 0) {
        return getMissingModelConfigurationMessage("image");
      }
      const imageSelection = getResolvedImageModelSelection(modelId);
      if (!imageSelection.modelConfig) {
        return getMissingModelConfigurationMessage("image");
      }
      if (!imageSelection.providerProfile) {
        return t("theProviderProfileForImageModelIs", {
          value1: imageSelection.providerId || "unknown",
          value2: imageSelection.modelId
        });
      }
      if (!imageSelection.providerProfile.hasApiKey) {
        return t("theSelectedProviderProfileDoesnTHave", { value1: imageSelection.providerId });
      }
      if (requirePromptTransformSupport && imageSelection.modelConfig.supportsPromptImageTransforms === false) {
        return t("theSelectedImageModelDoesnTSupport", { value1: imageSelection.modelId });
      }
      if (requireMaskEditSupport && imageSelection.modelConfig.supportsMaskImageEdits === false) {
        return t("theSelectedImageModelDoesnTSupport2", { value1: imageSelection.modelId });
      }
      return "";
    };
    const getImageRequestErrorMessage = (result, modelId) => {
      const baseMessage = result?.json?.error?.message ?? t("theImageRequestFailed");
      const errorContext = result?.json?.error;
      const imageSelection = getResolvedImageModelSelection(modelId);
      const contextParts = [];
      if (errorContext?.provider) {
        contextParts.push(`provider=${errorContext.provider}`);
      }
      if (errorContext?.status) {
        contextParts.push(`status=${errorContext.status}`);
      }
      if (errorContext?.endpoint) {
        contextParts.push(`endpoint=${errorContext.endpoint}`);
      }
      if (errorContext?.imageRequest?.model) {
        contextParts.push(`model=${errorContext.imageRequest.model}`);
      }
      if (errorContext?.imageRequest?.size) {
        contextParts.push(`size=${errorContext.imageRequest.size}`);
      }
      if (errorContext?.imageRequest?.mode) {
        contextParts.push(`mode=${errorContext.imageRequest.mode}`);
      }
      const contextText = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";
      return `${baseMessage}${contextText}`;
    };
    const getTaskValidationMessage = ({
      usesTextModel,
      requiresMultimodalText,
      isImageGenRequest,
      isImageEditRequest,
      requiresPromptTransformSupport,
      requiresMaskEditSupport,
      activeTextSelection,
      activeImageSelection
    }) => {
      if (usesTextModel) {
        const textValidationMessage = getTextModelValidationMessage(activeTextSelection.modelId, {
          requireMultimodal: requiresMultimodalText
        });
        if (textValidationMessage) {
          return textValidationMessage;
        }
      }
      if (isImageGenRequest || isImageEditRequest) {
        return getImageModelValidationMessage(activeImageSelection.modelId, {
          requirePromptTransformSupport: requiresPromptTransformSupport,
          requireMaskEditSupport: requiresMaskEditSupport
        });
      }
      return "";
    };
    const getActiveTextModel = () => {
      return getResolvedTextModelSelection(selectedTextModel).modelId;
    };
    const getActiveImageModel = () => {
      return getResolvedImageModelSelection(selectedImageModel).modelId;
    };
    const activeImageModelSupportsMaskEdits = () => {
      const modelConfig = getResolvedImageModelSelection(selectedImageModel).modelConfig;
      return Boolean(modelConfig) && modelConfig.supportsMaskImageEdits !== false;
    };
    const canUseMaskEdit = () => isImageEditTask() && getTaskMaskMode() !== TASK_MASK_MODES.DISABLED && activeImageModelSupportsMaskEdits();
    const shouldUseMaskEdit = () => {
      switch (getTaskMaskMode()) {
        case TASK_MASK_MODES.REQUIRED:
          return canUseMaskEdit();
        case TASK_MASK_MODES.OPTIONAL:
          return canUseMaskEdit() && prefersMaskEdit;
        default:
          return false;
      }
    };
    const shouldGenerateMaskPreview = () => shouldUseMaskEdit();
    const hasAvailableTextModels = () => getAvailableTextModels().length > 0;
    const hasAvailableImageModels = () => getAvailableImageModels().length > 0;
    const parseImageSize = (size) => {
      const [width, height] = (size ?? "1024x1024").split("x").map((value) => parseInt(value, 10));
      if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
        return { width: 1024, height: 1024 };
      }
      return { width, height };
    };
    const getEditTargetBoundingBox = (bb, size) => {
      const { width: targetWidth, height: targetHeight } = parseImageSize(size);
      const targetRatio = targetWidth / targetHeight;
      const sourceRatio = bb.width / bb.height;
      let width = bb.width;
      let height = bb.height;
      let topX = bb.topX;
      let topY = bb.topY;
      if (sourceRatio > targetRatio) {
        height = width / targetRatio;
        topY = bb.topY - (height - bb.height) / 2;
      } else if (sourceRatio < targetRatio) {
        width = height * targetRatio;
        topX = bb.topX - (width - bb.width) / 2;
      }
      return { topX, topY, width, height, targetWidth, targetHeight };
    };
    const setTextAndImageModels = () => {
      const nextTextModel = getActiveTextModel();
      if (selectedTextModel !== nextTextModel) {
        dirty = true;
      }
      textModel = nextTextModel;
      selectedTextModel = textModel;
      const nextImageModel = getActiveImageModel();
      if (selectedImageModel !== nextImageModel) {
        dirty = true;
      }
      imageModel = nextImageModel;
      selectedImageModel = imageModel;
      validSizes = imageModel ? getValidSizesForModel(imageModel) : [];
      if (imageModel && !validSizes.includes(imageSize)) {
        imageSize = validSizes[0] ?? "1024x1024";
        dirty = true;
      }
    };
    setTextAndImageModels();
    const calculateImageScale = (elements) => {
      const bb = ea2.getBoundingBox(elements);
      const size = bb.width * bb.height;
      const minRatio = Math.sqrt(36e4 / size);
      const maxRatio = Math.sqrt(size / 16e6);
      return minRatio > 1 ? minRatio : maxRatio > 1 ? 1 / maxRatio : 1;
    };
    const createMask = async (dataURL) => {
      return new Promise((resolve, reject) => {
        const img = document.body.createEl("img");
        img.remove();
        img.onload = () => {
          const canvas = document.body.createEl("canvas");
          canvas.remove();
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
              data[i + 3] = 0;
            } else if (data[i + 3] === 0) {
              data[i] = 255;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 255;
            }
          }
          ctx.putImageData(imageData, 0, 0);
          const maskDataURL2 = canvas.toDataURL();
          resolve(maskDataURL2);
        };
        img.onerror = (error) => {
          reject(error);
        };
        img.src = dataURL;
      });
    };
    const renderCanvasDataURL = async (view, targetImageEdit = false) => {
      try {
        let PADDING = 5;
        await view.forceSave(true);
        if (!isViewAlive()) return { imageDataURL: null, maskDataURL: null };
        const viewElements = ea2.getViewSelectedElements();
        if (viewElements.length === 0) {
          return { imageDataURL: null, maskDataURL: null };
        }
        ea2.copyViewElementsToEAforEditing(viewElements, true);
        let maskDataURL2;
        const loader = ea2.getEmbeddedFilesLoader(false);
        let scale = calculateImageScale(ea2.getElements());
        const bb = ea2.getBoundingBox(viewElements);
        if (ea2.getElements().filter((el) => el.type === "image").some(
          (el) => Math.round(el.width) === Math.round(bb.width) && Math.round(el.height) === Math.round(bb.height)
        )) {
          PADDING = 0;
        }
        let exportSettings = { withBackground: true, withTheme: true };
        if (targetImageEdit) {
          PADDING = 0;
          const strokeColor = ea2.style.strokeColor;
          const backgroundColor = ea2.style.backgroundColor;
          ea2.style.backgroundColor = "transparent";
          ea2.style.strokeColor = "transparent";
          const targetBounds = getEditTargetBoundingBox(bb, imageSize);
          const rectID = ea2.addRect(
            targetBounds.topX,
            targetBounds.topY,
            targetBounds.width,
            targetBounds.height
          );
          const rect = ea2.getElement(rectID);
          ea2.style.strokeColor = strokeColor;
          ea2.style.backgroundColor = backgroundColor;
          ea2.getElements().filter((el) => el.type === "image").forEach((el) => {
            el.isDeleted = true;
          });
          scale = targetBounds.targetWidth / rect.width;
          exportSettings = { withBackground: false, withTheme: true };
          maskDataURL2 = await ea2.createPNGBase64(
            null,
            scale,
            exportSettings,
            loader,
            "light",
            PADDING
          );
          maskDataURL2 = await createMask(maskDataURL2);
          ea2.getElements().filter((el) => el.type === "image").forEach((el) => {
            el.isDeleted = false;
          });
          ea2.getElements().filter((el) => el.type !== "image" && el.id !== rectID).forEach((el) => {
            el.isDeleted = true;
          });
        }
        const imageDataURL2 = await ea2.createPNGBase64(
          null,
          scale,
          exportSettings,
          loader,
          "light",
          PADDING
        );
        return { imageDataURL: imageDataURL2, maskDataURL: maskDataURL2 };
      } finally {
        ea2.clear();
      }
    };
    let pendingPreview = Promise.resolve();
    const generateCanvasDataURL = (view, targetImageEdit = false) => {
      const next = pendingPreview.then(async () => {
        if (!isViewAlive()) return { imageDataURL: null, maskDataURL: null };
        const result = await renderCanvasDataURL(view, targetImageEdit);
        ({ imageDataURL, maskDataURL } = result);
        return result;
      });
      pendingPreview = next.catch(() => {
      });
      return next;
    };
    ({ imageDataURL, maskDataURL } = await generateCanvasDataURL(
      ea2.targetView,
      shouldGenerateMaskPreview()
    ));
    const spinner = await ea2.convertStringToDataURL(`
  <html><head><style>
    html, body {width: 100%; height: 100%; color: ${ea2.getExcalidrawAPI().getAppState().theme === "dark" ? "white" : "black"};}
    body {display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 1rem; overflow: hidden;}
    .Spinner {display: flex; align-items: center; justify-content: center; margin-left: auto; margin-right: auto;}
    .Spinner svg {animation: rotate 1.6s linear infinite; transform-origin: center center; width: 40px; height: 40px;}
    .Spinner circle {stroke: currentColor; animation: dash 1.6s linear 0s infinite; stroke-linecap: round;}
    @keyframes rotate {100% {transform: rotate(360deg);}}
    @keyframes dash {
      0% {stroke-dasharray: 1, 300; stroke-dashoffset: 0;}
      50% {stroke-dasharray: 150, 300; stroke-dashoffset: -200;}
      100% {stroke-dasharray: 1, 300; stroke-dashoffset: -280;}
    }
  </style></head><body>
    <div class="Spinner">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" stroke-width="8" fill="none" stroke-miter-limit="10"/>
      </svg>
    </div>
    <div>${t("generating")}</div>
  </body></html>`);
    const errorMessage = async (spinnerID, message) => {
      const error = t("somethingWentWrongCheckDeveloperConsoleFor");
      const details = message ? `<p>${message}</p>` : "";
      const errorDataURL = await ea2.convertStringToDataURL(`
      <html><head><style>
        html, body {height: 100%;}
        body {display: flex; flex-direction: column; align-items: center; justify-content: center; color: red;}
        h1, h3 {margin-top: 0;margin-bottom: 0.5rem;}
      </style></head><body>
        <h1>${t("errorTitle")}</h1>
        <h3>${error}</h3>${details}
      </body></html>`);
      if (!isViewAlive()) return;
      new Notice(error);
      ea2.getElement(spinnerID).link = errorDataURL;
      await ea2.addElementsToView(false, true);
    };
    const EDITOR_LS_KEYS = {
      OAI_API_KEY: "excalidraw-oai-api-key",
      MERMAID_TO_EXCALIDRAW: "mermaid-to-excalidraw",
      PUBLISH_LIBRARY: "publish-library-data"
    };
    const setMermaidDataToStorage = (mermaidDefinition) => {
      try {
        window.localStorage.setItem(
          EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW,
          JSON.stringify(mermaidDefinition)
        );
        return true;
      } catch (error) {
        console.warn(t("localstorageSetitemError", { value1: error.message }));
        return false;
      }
    };
    const extractStructuredContent2 = (rawContent, blocktype) => extractStructuredContent(rawContent, blocktype, (text) => ea2.extractCodeBlocks(text));
    const generateImage = async (text, spinnerID, bb, silent = false) => {
      const validationMessage = getImageModelValidationMessage(selectedImageModel);
      if (validationMessage) {
        new Notice(validationMessage, 8e3);
        await errorMessage(spinnerID, validationMessage);
        return;
      }
      const imageSelection = getResolvedImageModelSelection(selectedImageModel);
      const result = await ea2.generateAIImage({
        ...imageSelection.requestConfig,
        text,
        imageGenerationProperties: {
          size: imageSize,
          //quality: "standard", //not supported by dall-e-2
          n: 1
        }
      });
      if (!isViewAlive()) return;
      const imageSource = getGeneratedImageSource(result);
      if (!imageSource) {
        await errorMessage(spinnerID, getImageRequestErrorMessage(result, imageSelection.modelId));
        return;
      }
      const spinner2 = ea2.getElement(spinnerID);
      spinner2.isDeleted = true;
      const imageID = await ea2.addImage(spinner2.x, spinner2.y, imageSource);
      if (!isViewAlive()) return;
      const imageEl = ea2.getElement(imageID);
      const revisedPrompt = result.revisedPrompt;
      if (revisedPrompt && !silent) {
        ea2.style.fontSize = 16;
        const rectID = ea2.addText(imageEl.x + 15, imageEl.y + imageEl.height + 50, revisedPrompt, {
          width: imageEl.width - 30,
          textAlign: "center",
          textVerticalAlign: "top",
          box: true
        });
        ea2.getElement(rectID).strokeColor = "transparent";
        ea2.getElement(rectID).backgroundColor = "transparent";
        ea2.addToGroup(
          ea2.getElements().filter((el) => el.id !== spinnerID).map((el) => el.id)
        );
      }
      await ea2.addElementsToView(false, true, true);
      if (silent) return;
    };
    const run = async (text) => {
      await pendingPreview;
      if (!isViewAlive()) return;
      const taskConfig = getActiveTaskConfig();
      const taskConfigValidationMessage = getTaskConfigValidationMessage(taskConfig);
      if (taskConfigValidationMessage) {
        new Notice(taskConfigValidationMessage, 8e3);
        return;
      }
      const trimmedText = String(text ?? "").trim();
      const allowsTextInput = doesTaskAllowUserPrompt(taskConfig.id);
      const allowsImageInput = doesTaskAllowImageInput(taskConfig.id);
      const hasAllowedText = allowsTextInput && Boolean(trimmedText);
      const hasAllowedImage = allowsImageInput && Boolean(imageDataURL);
      if (!hasAllowedText && !hasAllowedImage) {
        const emptyInputMessage = allowsImageInput && !allowsTextInput ? t("selectContentBeforeRunningExcaliai") : allowsTextInput && !allowsImageInput ? t("enterAPromptBeforeRunningExcaliai") : t("enterAPromptOrSelectContentBefore");
        new Notice(emptyInputMessage);
        return;
      }
      const outputType = getTaskOutputType(taskConfig);
      const isImageGenRequest = taskUsesDirectImageModel(taskConfig.id) || taskUsesImagePromptPipeline(taskConfig.id);
      const isImageEditRequest = isImageEditTask(taskConfig.id);
      const isMaskEditRequest = isImageEditRequest && shouldUseMaskEdit();
      const usesTextModel = doesTaskUseTextModel(taskConfig.id);
      const sendsCanvasImage = allowsImageInput && Boolean(imageDataURL);
      const requiresMultimodalText = usesTextModel && sendsCanvasImage;
      const activeTextSelection = getResolvedTextModelSelection(selectedTextModel);
      const activeImageSelection = getResolvedImageModelSelection(selectedImageModel);
      const validationMessage = getTaskValidationMessage({
        usesTextModel,
        requiresMultimodalText,
        isImageGenRequest,
        isImageEditRequest,
        requiresPromptTransformSupport: isImageEditRequest && !isMaskEditRequest,
        requiresMaskEditSupport: isMaskEditRequest,
        activeTextSelection,
        activeImageSelection
      });
      if (validationMessage) {
        new Notice(validationMessage, 8e3);
        return;
      }
      if (taskRequiresUserPrompt(taskConfig.id) && !trimmedText) {
        new Notice(
          isImageEditRequest ? t("enterInstructionsForHowTheImageShould") : t("enterAPromptBeforeRunningExcaliai")
        );
        return;
      }
      if (taskRequiresImageInput(taskConfig.id) && !imageDataURL) {
        new Notice(
          isImageEditRequest ? t("selectAnImage") : t("selectCanvasContentBeforeRunningThisTask")
        );
        return;
      }
      if (isMaskEditRequest && !maskDataURL) {
        new Notice(t("selectOrCreateAMask"));
        return;
      }
      const bb = ea2.getBoundingBox(ea2.getViewSelectedElements());
      const spinnerID = ea2.addEmbeddable(
        bb.topX + bb.width + 100,
        bb.topY - (720 - bb.height) / 2,
        550,
        720,
        spinner
      );
      await ea2.addElementsToView(false, true);
      if (!isViewAlive()) return;
      ea2.clear();
      const embeddable = ea2.getViewElements().filter((el) => el.id === spinnerID);
      ea2.copyViewElementsToEAforEditing(embeddable);
      ea2.viewZoomToElements(false, ea2.getViewSelectedElements().concat(embeddable));
      if (taskUsesDirectImageModel(taskConfig.id)) {
        await generateImage(
          trimmedText,
          spinnerID,
          bb,
          outputType.blocktype === TASK_RESULT_TYPES.IMAGE_SILENT
        );
        return;
      }
      let result;
      let requestTextResult = null;
      if (isImageEditRequest) {
        result = isMaskEditRequest ? await ea2.maskEditAIImage({
          ...activeImageSelection.requestConfig,
          image: { url: imageDataURL },
          ...trimmedText ? { text: trimmedText } : {},
          imageGenerationProperties: {
            size: imageSize,
            n: 1,
            mask: maskDataURL
          }
        }) : await ea2.transformAIImage({
          ...activeImageSelection.requestConfig,
          image: { url: imageDataURL },
          ...trimmedText ? { text: trimmedText } : {},
          imageGenerationProperties: {
            size: imageSize,
            n: 1
          }
        });
      } else {
        requestTextResult = async () => {
          const maxTokens = getConfiguredTextMaxTokens();
          const textRequestObject = {
            ...activeTextSelection.requestConfig,
            ...sendsCanvasImage ? { image: { url: imageDataURL } } : {},
            ...trimmedText ? { text: trimmedText } : {},
            ...taskConfig.systemPrompt ? { systemPrompt: taskConfig.systemPrompt } : {},
            ...outputType.instruction ? { instruction: outputType.instruction } : {},
            ...maxTokens ? { maxTokens } : {}
          };
          return sendsCanvasImage ? await ea2.analyzeAIImage(textRequestObject) : await ea2.generateAIText(textRequestObject);
        };
        result = await requestTextResult();
      }
      if (!isViewAlive()) return;
      if (isImageEditRequest) {
        if (!isViewAlive()) return;
        const imageSource = getGeneratedImageSource(result);
        if (!imageSource) {
          await errorMessage(
            spinnerID,
            getImageRequestErrorMessage(result, activeImageSelection.modelId)
          );
          return;
        }
        const spinner2 = ea2.getElement(spinnerID);
        spinner2.isDeleted = true;
        const imageID = await ea2.addImage(spinner2.x, spinner2.y, imageSource);
        if (!isViewAlive()) return;
        await ea2.addElementsToView(false, true, true);
        return;
      }
      if (result?.json?.error) {
        await errorMessage(spinnerID, result?.json?.error?.message);
        return;
      }
      let content = extractStructuredContent2(result.content, outputType.blocktype);
      if (!content) {
        const errorDetails = outputType.blocktype === TASK_RESULT_TYPES.HTML && isMaxTokenFinishReason(getResultFinishReason(result)) ? t("theModelHitTheTokenLimitBefore") : void 0;
        await errorMessage(spinnerID, errorDetails);
        return;
      }
      if (taskUsesImagePromptPipeline(taskConfig.id)) {
        await generateImage(
          content,
          spinnerID,
          bb,
          outputType.blocktype === TASK_RESULT_TYPES.IMAGE_SILENT
        );
        return;
      }
      switch (outputType.blocktype) {
        case "html": {
          const link = await ea2.convertStringToDataURL(content);
          if (!isViewAlive()) return;
          ea2.getElement(spinnerID).link = link;
          await ea2.addElementsToView(false, true);
          break;
        }
        case "mindmap": {
          const mmb = window?.MindMapBuilderAPI;
          if (!mmb?.setView || !mmb?.importMarkdown) {
            await errorMessage(spinnerID, t("mindmapBuilderIsNotAvailable"));
            return;
          }
          const setViewResult = mmb.setView(ea2.targetView);
          if (!setViewResult?.ok) {
            await errorMessage(
              spinnerID,
              setViewResult?.error?.message || t("couldNotConnectToMindmapBuilder")
            );
            return;
          }
          const importResult = await mmb.importMarkdown({ markdown: content });
          if (!importResult?.ok) {
            await errorMessage(
              spinnerID,
              importResult?.error?.message || t("couldNotCreateTheMindMap")
            );
            return;
          }
          ea2.getElement(spinnerID).isDeleted = true;
          await ea2.addElementsToView(false, true, true);
          new Notice(t("mindMapCreatedInMindmapBuilder"), 8e3);
          break;
        }
        case "svg":
          ea2.getElement(spinnerID).isDeleted = true;
          await ea2.importSVG(content);
          if (!isViewAlive()) return;
          ea2.addToGroup(ea2.getElements().map((el) => el.id));
          if (ea2.getViewSelectedElements().length > 0) {
            ea2.targetView.currentPosition = { x: bb.topX + bb.width + 100, y: bb.topY };
          }
          await ea2.addElementsToView(true, false);
          break;
        case "mermaid":
          if (content.startsWith("mermaid")) {
            content = content.replace(/^mermaid/, "").trim();
          }
          try {
            result = await ea2.addMermaid(content);
            if (typeof result === "string") {
              await errorMessage(spinnerID, t("openMoreToolsMermaidToExcalidrawTo") + result);
              return;
            }
          } catch (e) {
            if (!isViewAlive()) return;
            ea2.addText(0, 0, content);
          }
          if (!isViewAlive()) return;
          ea2.getElement(spinnerID).isDeleted = true;
          ea2.targetView.currentPosition = { x: bb.topX + bb.width + 100, y: bb.topY - bb.height };
          await ea2.addElementsToView(true, false);
          setMermaidDataToStorage(content);
          new Notice(t("openMoreToolsMermaidToExcalidrawTo2"), 8e3);
          break;
      }
    };
    let previewDiv;
    const createUniqueTaskId = (candidateValue, taskConfigs, currentTaskId = "") => {
      const existingTaskIds = new Set(
        taskConfigs.filter((taskConfig) => taskConfig.id !== currentTaskId).map((taskConfig) => taskConfig.id)
      );
      const baseId = createTaskIdFromName(candidateValue) || `task-${taskConfigs.length + 1}`;
      let nextId = baseId;
      let duplicateCount = 2;
      while (existingTaskIds.has(nextId)) {
        nextId = `${baseId}-${duplicateCount++}`;
      }
      return nextId;
    };
    const createBlankTaskConfig = (taskConfigs = []) => {
      const name = t("newTask", { value1: taskConfigs.length + 1 });
      return normalizeTaskConfig(
        {
          id: createUniqueTaskId(name, taskConfigs),
          name,
          help: t("describeWhatThisTaskDoes"),
          systemPrompt: "",
          outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.HTML),
          execution: {
            mode: TASK_EXECUTION_MODES.TEXT_RESULT,
            resultType: TASK_RESULT_TYPES.HTML,
            userPrompt: TASK_INPUT_RULES.OPTIONAL,
            imageInput: TASK_INPUT_RULES.OPTIONAL,
            maskMode: TASK_MASK_MODES.DISABLED,
            requiresApi: TASK_RUNTIME_APIS.NONE
          }
        },
        taskConfigs.length
      );
    };
    const syncStateToSettings = () => {
      settings.config.tasks = normalizeTaskConfigs(settings.config?.tasks, {
        fallbackToDefaults: false
      });
      const nextSelectedTaskId = getVisibleTaskConfigById(selectedTaskId)?.id ?? getVisibleTaskConfigs()[0]?.id ?? "";
      settings.state = normalizeState(
        {
          selectedTaskId: nextSelectedTaskId,
          userPrompt,
          maskEdit: prefersMaskEdit,
          textModel: selectedTextModel,
          imageModel: selectedImageModel,
          maxTokens: selectedMaxTokens,
          imageSize
        },
        settings.config.tasks
      );
      userPrompt = settings.state.userPrompt;
      selectedTaskId = settings.state.selectedTaskId;
      prefersMaskEdit = settings.state.maskEdit;
      selectedTextModel = settings.state.textModel;
      selectedImageModel = settings.state.imageModel;
      selectedMaxTokens = settings.state.maxTokens;
      imageSize = settings.state.imageSize;
    };
    const saveExcaliAISettings = async () => {
      syncStateToSettings();
      await ea2.setScriptSettings(settings);
      dirty = false;
    };
    const addPreviewImage = () => {
      if (!previewDiv) return;
      const activeTask = getActiveTaskConfig();
      previewDiv.empty();
      if (!imageDataURL) {
        return;
      }
      previewDiv.createEl("img", {
        cls: "excali-ai-preview-img",
        attr: { src: imageDataURL }
      });
      if (activeTask && !doesTaskAllowImageInput(activeTask.id)) {
        previewDiv.createEl("p", {
          text: t("thisTaskIgnoresTheCurrentCanvasSelection"),
          cls: "excali-ai-help-text"
        });
        return;
      }
      if (isImageEditTask() && !shouldUseMaskEdit()) {
        previewDiv.createEl("p", {
          text: activeImageModelSupportsMaskEdits() ? t("maskEditIsOffNonImageElements") : t("thisModelDoesnTSupportMaskEdits"),
          cls: "excali-ai-help-text"
        });
        return;
      }
      if (maskDataURL) {
        previewDiv.createEl("img", {
          cls: "excali-ai-preview-img",
          attr: { src: maskDataURL }
        });
      }
    };
    const openTaskEditorModal = ({ reopenMainModal = false } = {}) => {
      const taskModal = new ea2.obsidian.Modal(app);
      const unregisterTaskModalCleanup = ea2.registerCleanup(() => taskModal.close());
      taskModal.modalEl.style.width = "100%";
      taskModal.modalEl.style.maxWidth = "1100px";
      taskModal.modalEl.classList.add("excali-ai-task-editor-modal");
      let editorDirty = false;
      let refreshingEditorFields = false;
      let editableTasks = normalizeTaskConfigs(cloneJSON(getTaskConfigs()), {
        fallbackToDefaults: false
      });
      let editorTaskId = editableTasks.find((taskConfig) => taskConfig.id === selectedTaskId)?.id ?? editableTasks[0]?.id ?? "";
      let taskSelectDropdown;
      let taskIdText;
      let taskNameText;
      let helpTextArea;
      let systemPromptTextArea;
      let outputInstructionTextArea;
      let executionModeDropdown;
      let resultTypeDropdown;
      let userPromptDropdown;
      let imageInputDropdown;
      let maskModeDropdown;
      let validationEl;
      let taskHeaderSetting;
      let taskIdSetting;
      let taskNameSetting;
      let helpSetting;
      let systemPromptSetting;
      let outputInstructionSetting;
      let executionModeSetting;
      let resultTypeSetting;
      let userPromptSetting;
      let imageInputSetting;
      let maskModeSetting;
      const addTaskEditorFieldClass = (setting, className = "excali-ai-task-editor-field") => {
        if (setting?.settingEl) {
          setting.settingEl.classList.add(className);
        }
      };
      const getEditorTask = () => editableTasks.find((taskConfig) => taskConfig.id === editorTaskId) ?? null;
      const ensureEditorTaskId = () => {
        if (editableTasks.some((taskConfig) => taskConfig.id === editorTaskId)) {
          return editorTaskId;
        }
        editorTaskId = editableTasks[0]?.id ?? "";
        return editorTaskId;
      };
      const refreshTaskEditorDropdown = () => {
        if (!taskSelectDropdown) return;
        ensureEditorTaskId();
        while (taskSelectDropdown.selectEl.options.length > 0) {
          taskSelectDropdown.selectEl.remove(0);
        }
        editableTasks.forEach(
          (taskConfig) => taskSelectDropdown.addOption(taskConfig.id, taskConfig.name)
        );
        taskSelectDropdown.setDisabled(editableTasks.length === 0);
        if (editableTasks.length > 0) {
          taskSelectDropdown.setValue(editorTaskId);
        }
      };
      const updateTaskEditorVisibility = () => {
        const taskConfig = getEditorTask();
        const hasTask = Boolean(taskConfig);
        [
          taskIdSetting,
          taskNameSetting,
          helpSetting,
          systemPromptSetting,
          outputInstructionSetting,
          executionModeSetting,
          resultTypeSetting,
          userPromptSetting,
          imageInputSetting,
          maskModeSetting
        ].forEach((setting) => {
          if (setting) {
            setting.settingEl.style.display = hasTask ? "" : "none";
          }
        });
        updateExecutionModeDescription();
        updateResultTypeDescription();
        if (!taskConfig) {
          return;
        }
        const mode = taskConfig.execution.mode;
        const usesTextPipeline = mode === TASK_EXECUTION_MODES.TEXT_RESULT || mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
        const showsOutputInstruction = mode === TASK_EXECUTION_MODES.TEXT_RESULT || mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
        if (systemPromptSetting) {
          systemPromptSetting.settingEl.style.display = usesTextPipeline ? "" : "none";
        }
        if (outputInstructionSetting) {
          outputInstructionSetting.settingEl.style.display = showsOutputInstruction ? "" : "none";
        }
        if (maskModeSetting) {
          maskModeSetting.settingEl.style.display = mode === TASK_EXECUTION_MODES.IMAGE_EDIT ? "" : "none";
        }
      };
      const updateExecutionModeDescription = () => {
        if (!executionModeSetting) return;
        const taskConfig = getEditorTask();
        if (!taskConfig) {
          executionModeSetting.descEl.setText(t("determinesHowTheTaskRuns"));
          return;
        }
        executionModeSetting.descEl.innerHTML = `Determines how the task runs.<br><span class="excali-ai-task-editor-note">${getTaskExecutionModeDescription(taskConfig.execution.mode)}</span>`;
      };
      const updateResultTypeDescription = () => {
        if (!resultTypeSetting) return;
        const taskConfig = getEditorTask();
        if (!taskConfig) {
          resultTypeSetting.descEl.setText(t("controlsHowExcaliaiInterpretsTheModelResponse"));
          return;
        }
        const runtimeRequirement = getTaskRuntimeRequirement(taskConfig);
        const runtimeText = runtimeRequirement !== TASK_RUNTIME_APIS.NONE ? `<br><span class="excali-ai-task-editor-accent">Requires: ${getTaskRuntimeRequirementLabel(runtimeRequirement)}</span>` : "";
        resultTypeSetting.descEl.innerHTML = `Controls how ExcaliAI interprets the model response.<br><span class="excali-ai-task-editor-note">${getTaskResultTypeDescription(taskConfig.execution.resultType)}</span>${runtimeText}`;
      };
      const updateTaskEditorValidation = () => {
        if (!validationEl) return;
        const taskConfig = getEditorTask();
        const validationMessage = getTaskConfigValidationMessage(taskConfig);
        if (!taskConfig) {
          validationEl.innerHTML = t("validationNoTasksConfiguredAddATask");
          validationEl.style.color = "var(--text-warning)";
          return;
        }
        if (validationMessage) {
          validationEl.innerHTML = t("validation", { value1: validationMessage });
          validationEl.style.color = "var(--text-error)";
          return;
        }
        validationEl.innerHTML = t("validationTaskConfigurationIsValid");
        validationEl.style.color = "var(--text-muted)";
      };
      const populateTaskEditorFields = () => {
        const taskConfig = getEditorTask();
        refreshingEditorFields = true;
        if (taskIdText) taskIdText.setValue(taskConfig?.id ?? "");
        if (taskNameText) taskNameText.setValue(taskConfig?.name ?? "");
        if (helpTextArea) helpTextArea.setValue(taskConfig?.help ?? "");
        if (systemPromptTextArea) systemPromptTextArea.setValue(taskConfig?.systemPrompt ?? "");
        if (outputInstructionTextArea)
          outputInstructionTextArea.setValue(taskConfig?.outputInstruction ?? "");
        if (executionModeDropdown)
          executionModeDropdown.setValue(
            taskConfig?.execution?.mode ?? TASK_EXECUTION_MODES.TEXT_RESULT
          );
        if (resultTypeDropdown)
          resultTypeDropdown.setValue(taskConfig?.execution?.resultType ?? TASK_RESULT_TYPES.HTML);
        if (userPromptDropdown)
          userPromptDropdown.setValue(taskConfig?.execution?.userPrompt ?? TASK_INPUT_RULES.OPTIONAL);
        if (imageInputDropdown)
          imageInputDropdown.setValue(taskConfig?.execution?.imageInput ?? TASK_INPUT_RULES.OPTIONAL);
        if (maskModeDropdown)
          maskModeDropdown.setValue(taskConfig?.execution?.maskMode ?? TASK_MASK_MODES.DISABLED);
        refreshingEditorFields = false;
        refreshTaskEditorDropdown();
        updateTaskEditorVisibility();
        updateTaskEditorValidation();
      };
      taskModal.onOpen = () => {
        const contentEl = taskModal.contentEl;
        contentEl.createEl("style", {
          text: `
        .excali-ai-task-editor-modal {
          width: min(1100px, calc(100vw - 1rem)) !important;
          max-width: min(1100px, calc(100vw - 1rem)) !important;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field {
          display: block;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field .setting-item-info {
          max-width: none;
          padding-right: 0;
          margin-bottom: 0.45rem;
        }
        .excali-ai-task-editor-header .setting-item-control {
          width: fit-content !important;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field .setting-item-control {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: stretch;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field .setting-item-control > :not(button) {
          flex: 1 1 100%;
          min-width: 0;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field .setting-item-control button {
          flex: 0 0 auto;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field input[type="text"],
        .excali-ai-task-editor-modal .excali-ai-task-editor-field input[type="number"],
        .excali-ai-task-editor-modal .excali-ai-task-editor-field select,
        .excali-ai-task-editor-modal .excali-ai-task-editor-field textarea {
          width: 100%;
          max-width: none;
          box-sizing: border-box;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-field textarea {
          resize: vertical;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-header .setting-item-info {
          max-width: none;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-header .setting-item-control {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-note {
          color: var(--text-muted);
        }
        .excali-ai-task-editor-modal .excali-ai-task-editor-accent {
          color: var(--text-accent);
          font-weight: 600;
        }
        @media (max-width: 700px) {
          .excali-ai-task-editor-modal .excali-ai-task-editor-header .setting-item-control > * {
            flex: 1 1 100%;
          }
        }
      `
        });
        const headerContainer = contentEl.createDiv({
          style: "display: flex; align-items: center; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 10px;"
        });
        headerContainer.innerHTML = t("excaliaiTaskEditor", {
          value1: ea2.obsidian.getIcon("bot").outerHTML
        });
        contentEl.createEl("p", { text: t("tasksAreStoredInExcaliaiSScript") });
        taskHeaderSetting = new ea2.obsidian.Setting(contentEl).setName(t("task2")).setDesc(t("selectWhichTaskToEdit")).addDropdown((dropdown) => {
          taskSelectDropdown = dropdown;
          dropdown.selectEl.style.flex = t("px");
          dropdown.selectEl.style.minWidth = "220px";
          refreshTaskEditorDropdown();
          dropdown.onChange((value) => {
            if (refreshingEditorFields) return;
            editorTaskId = value;
            populateTaskEditorFields();
          });
        }).addButton(
          (button) => button.setButtonText(t("addTask")).setIcon("plus").setTooltip(t("addTask")).onClick(() => {
            const nextTask = createBlankTaskConfig(editableTasks);
            nextTask.id = createUniqueTaskId(nextTask.id, editableTasks);
            editableTasks.push(nextTask);
            editorTaskId = nextTask.id;
            editorDirty = true;
            populateTaskEditorFields();
          })
        ).addButton(
          (button) => button.setButtonText(t("deleteTask")).setIcon("trash-2").setTooltip(t("deleteTask")).onClick(() => {
            const taskConfig = getEditorTask();
            if (!taskConfig) {
              new Notice(t("noTaskIsSelected"), 5e3);
              return;
            }
            if (!window.confirm(t("deleteTheTask", { value1: taskConfig.name }))) {
              return;
            }
            editableTasks = editableTasks.filter((candidate) => candidate.id !== taskConfig.id);
            editorTaskId = editableTasks[0]?.id ?? "";
            editorDirty = true;
            populateTaskEditorFields();
          })
        ).addButton(
          (button) => button.setButtonText(t("resetDefaults")).setIcon("rotate-ccw").setTooltip(t("resetDefaults")).onClick(() => {
            if (!window.confirm(t("resetAllExcaliaiTasksToTheShipped"))) {
              return;
            }
            editableTasks = cloneJSON(DEFAULT_TASK_CONFIGS);
            editorTaskId = editableTasks.find((taskConfig) => taskConfig.id === DEFAULT_TASK_ID)?.id ?? editableTasks[0]?.id ?? "";
            editorDirty = true;
            populateTaskEditorFields();
          })
        );
        addTaskEditorFieldClass(taskHeaderSetting, "excali-ai-task-editor-header");
        validationEl = contentEl.createEl("p");
        taskIdSetting = new ea2.obsidian.Setting(contentEl).setName(t("taskId")).setDesc(t("settingsKeyNormalizedToLowercaseWithDashes")).addText((text) => {
          taskIdText = text;
          text.inputEl.style.width = "100%";
          text.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            const nextId = createUniqueTaskId(
              value || taskConfig.name,
              editableTasks,
              taskConfig.id
            );
            taskConfig.id = nextId;
            editorTaskId = nextId;
            editorDirty = true;
            populateTaskEditorFields();
          });
        });
        addTaskEditorFieldClass(taskIdSetting);
        taskNameSetting = new ea2.obsidian.Setting(contentEl).setName(t("taskName")).setDesc(t("shownInTheExcaliaiTaskPicker")).addText((text) => {
          taskNameText = text;
          text.inputEl.style.width = "100%";
          text.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.name = value;
            editorDirty = true;
            refreshTaskEditorDropdown();
            updateTaskEditorValidation();
          });
        });
        addTaskEditorFieldClass(taskNameSetting);
        helpSetting = new ea2.obsidian.Setting(contentEl).setName(t("taskHelp")).setDesc(t("explainsTheTaskInTheMainExcaliai")).addTextArea((text) => {
          helpTextArea = text;
          text.inputEl.style.minHeight = "6em";
          text.inputEl.style.width = "100%";
          text.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.help = value;
            editorDirty = true;
          });
        });
        addTaskEditorFieldClass(helpSetting);
        systemPromptSetting = new ea2.obsidian.Setting(contentEl).setName(t("systemPrompt")).setDesc(t("sentToTheTextModelWhenThe")).addTextArea((text) => {
          systemPromptTextArea = text;
          text.inputEl.style.minHeight = "10em";
          text.inputEl.style.width = "100%";
          text.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.systemPrompt = value;
            editorDirty = true;
          });
        });
        addTaskEditorFieldClass(systemPromptSetting);
        outputInstructionSetting = new ea2.obsidian.Setting(contentEl).setName(t("outputInstruction")).setDesc(t("controlsTheExpectedResponseFormatWhenThe")).addTextArea((text) => {
          outputInstructionTextArea = text;
          text.inputEl.style.minHeight = "6em";
          text.inputEl.style.width = "100%";
          text.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.outputInstruction = value;
            editorDirty = true;
          });
        });
        addTaskEditorFieldClass(outputInstructionSetting);
        executionModeSetting = new ea2.obsidian.Setting(contentEl).setName(t("executionMode")).setDesc(t("determinesHowTheTaskRuns")).addDropdown((dropdown) => {
          executionModeDropdown = dropdown;
          dropdown.addOption(
            TASK_EXECUTION_MODES.TEXT_RESULT,
            getTaskExecutionModeLabel(TASK_EXECUTION_MODES.TEXT_RESULT)
          );
          dropdown.addOption(
            TASK_EXECUTION_MODES.IMAGE_PROMPT,
            getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_PROMPT)
          );
          dropdown.addOption(
            TASK_EXECUTION_MODES.IMAGE_DIRECT,
            getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)
          );
          dropdown.addOption(
            TASK_EXECUTION_MODES.IMAGE_EDIT,
            getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_EDIT)
          );
          dropdown.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.execution.mode = value;
            if (value === TASK_EXECUTION_MODES.TEXT_RESULT && (taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE || taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE_SILENT)) {
              taskConfig.execution.resultType = TASK_RESULT_TYPES.HTML;
            }
            if ((value === TASK_EXECUTION_MODES.IMAGE_PROMPT || value === TASK_EXECUTION_MODES.IMAGE_DIRECT) && !(taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE || taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE_SILENT)) {
              taskConfig.execution.resultType = TASK_RESULT_TYPES.IMAGE;
            }
            if (value === TASK_EXECUTION_MODES.IMAGE_DIRECT) {
              taskConfig.execution.imageInput = TASK_INPUT_RULES.DISABLED;
              taskConfig.execution.maskMode = TASK_MASK_MODES.DISABLED;
            }
            if (value === TASK_EXECUTION_MODES.IMAGE_EDIT) {
              taskConfig.execution.resultType = TASK_RESULT_TYPES.IMAGE;
              taskConfig.execution.imageInput = TASK_INPUT_RULES.REQUIRED;
              if (taskConfig.execution.maskMode === TASK_MASK_MODES.DISABLED) {
                taskConfig.execution.maskMode = TASK_MASK_MODES.OPTIONAL;
              }
            }
            if (value !== TASK_EXECUTION_MODES.IMAGE_EDIT) {
              taskConfig.execution.maskMode = TASK_MASK_MODES.DISABLED;
            }
            editorDirty = true;
            populateTaskEditorFields();
          });
        });
        addTaskEditorFieldClass(executionModeSetting);
        resultTypeSetting = new ea2.obsidian.Setting(contentEl).setName(t("resultType")).setDesc(t("controlsHowExcaliaiInterpretsTheModelResponse")).addDropdown((dropdown) => {
          resultTypeDropdown = dropdown;
          dropdown.addOption(
            TASK_RESULT_TYPES.HTML,
            getTaskResultTypeLabel(TASK_RESULT_TYPES.HTML)
          );
          dropdown.addOption(
            TASK_RESULT_TYPES.MINDMAP,
            getTaskResultTypeLabel(TASK_RESULT_TYPES.MINDMAP)
          );
          dropdown.addOption(
            TASK_RESULT_TYPES.MERMAID,
            getTaskResultTypeLabel(TASK_RESULT_TYPES.MERMAID)
          );
          dropdown.addOption(TASK_RESULT_TYPES.SVG, getTaskResultTypeLabel(TASK_RESULT_TYPES.SVG));
          dropdown.addOption(
            TASK_RESULT_TYPES.IMAGE,
            getTaskResultTypeLabel(TASK_RESULT_TYPES.IMAGE)
          );
          dropdown.addOption(
            TASK_RESULT_TYPES.IMAGE_SILENT,
            getTaskResultTypeLabel(TASK_RESULT_TYPES.IMAGE_SILENT)
          );
          dropdown.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.execution.resultType = value;
            taskConfig.execution.requiresApi = getTaskResultTypeMeta(value).runtimeRequirement ?? TASK_RUNTIME_APIS.NONE;
            editorDirty = true;
            updateResultTypeDescription();
            updateTaskEditorValidation();
          });
        });
        addTaskEditorFieldClass(resultTypeSetting);
        userPromptSetting = new ea2.obsidian.Setting(contentEl).setName(t("userPrompt")).setDesc(t("controlsWhetherTheMainPromptBoxIs")).addDropdown((dropdown) => {
          userPromptDropdown = dropdown;
          dropdown.addOption(TASK_INPUT_RULES.OPTIONAL, t("optional"));
          dropdown.addOption(TASK_INPUT_RULES.REQUIRED, t("required"));
          dropdown.addOption(TASK_INPUT_RULES.DISABLED, t("disabled"));
          dropdown.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.execution.userPrompt = value;
            editorDirty = true;
          });
        });
        addTaskEditorFieldClass(userPromptSetting);
        imageInputSetting = new ea2.obsidian.Setting(contentEl).setName(t("canvasImageInput")).setDesc(t("controlsWhetherTheSelectedCanvasContentIs")).addDropdown((dropdown) => {
          imageInputDropdown = dropdown;
          dropdown.addOption(TASK_INPUT_RULES.OPTIONAL, t("optional"));
          dropdown.addOption(TASK_INPUT_RULES.REQUIRED, t("required"));
          dropdown.addOption(TASK_INPUT_RULES.DISABLED, t("disabled"));
          dropdown.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.execution.imageInput = value;
            editorDirty = true;
            updateTaskEditorValidation();
          });
        });
        addTaskEditorFieldClass(imageInputSetting);
        maskModeSetting = new ea2.obsidian.Setting(contentEl).setName(t("maskMode")).setDesc(t("availableOnlyInEditSelectedImageMode")).addDropdown((dropdown) => {
          maskModeDropdown = dropdown;
          dropdown.addOption(TASK_MASK_MODES.DISABLED, t("disabled"));
          dropdown.addOption(TASK_MASK_MODES.OPTIONAL, t("optionalToggle"));
          dropdown.addOption(TASK_MASK_MODES.REQUIRED, t("alwaysRequired"));
          dropdown.onChange((value) => {
            if (refreshingEditorFields) return;
            const taskConfig = getEditorTask();
            if (!taskConfig) return;
            taskConfig.execution.maskMode = value;
            editorDirty = true;
            updateTaskEditorValidation();
          });
        });
        addTaskEditorFieldClass(maskModeSetting);
        new ea2.obsidian.Setting(contentEl).addButton(
          (button) => button.setButtonText(t("done")).setIcon("check").setTooltip(t("done")).setCta().onClick(() => taskModal.close())
        );
        populateTaskEditorFields();
      };
      taskModal.onClose = async () => {
        unregisterTaskModalCleanup();
        if (editorDirty) {
          settings.config.tasks = normalizeTaskConfigs(editableTasks, { fallbackToDefaults: false });
          selectedTaskId = getVisibleTaskConfigById(editorTaskId)?.id ?? getVisibleTaskConfigs()[0]?.id ?? "";
          await saveExcaliAISettings();
        }
        if (reopenMainModal) {
          openConfigModal();
        }
      };
      taskModal.open();
    };
    const openConfigModal = () => {
      if (!isViewAlive()) return;
      dirty = false;
      const configModal = new ea2.FloatingModal(app);
      configModal.modalEl.classList.add("excali-ai-floating-modal");
      let openTaskEditorAfterClose = false;
      let detachSelectionListeners = () => {
      };
      let unregisterModalCleanup = () => {
      };
      let refreshingMainFields = false;
      let lastSelectedElementIds = ea2.getViewSelectedElements().map((e) => e.id).sort().join(",");
      let isUpdatingSelection = false;
      configModal.onOpen = async () => {
        const contentEl = configModal.contentEl;
        contentEl.createEl("style", {
          text: `
        .excali-ai-floating-modal {
          width: min(1000px, 95vw) !important;
          max-height: 90vh !important;
          border-radius: 8px;
        }
        .excali-ai-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          border-bottom: 1px solid var(--background-modifier-border);
          padding-bottom: 10px;
        }
        .excali-ai-header h2 { margin: 0; font-weight: 600; }
        .excali-ai-header svg { width: 28px; height: 28px; color: var(--interactive-accent); }

        .excali-ai-main-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .excali-ai-left-col { flex: 1 1 55%; min-width: 0; display: flex; flex-direction: column; }
        .excali-ai-right-col { flex: 1 1 45%; min-width: 0; background: var(--background-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--background-modifier-border); }

        @media (min-width: 768px) {
          .excali-ai-main-container { flex-direction: row; }
        }

        .excali-ai-warning {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background: var(--background-modifier-error);
          color: var(--text-error);
          border-radius: 6px;
          margin-bottom: 15px;
          font-size: 0.9em;
        }

        .excali-ai-preview-img {
          max-width: 100%;
          max-height: 250px;
          object-fit: contain;
          border: 1px solid var(--background-modifier-border);
          border-radius: 4px;
          margin-top: 10px;
          background: var(--background-primary);
        }

        .excali-ai-help-text {
          font-size: 0.9em;
          color: var(--text-muted);
          margin-top: 5px;
          margin-bottom: 15px;
        }

        .excali-ai-validation-text {
          font-size: 0.9em;
          color: var(--text-error);
          margin-top: 5px;
          margin-bottom: 15px;
          font-weight: 500;
        }

        .excali-ai-advanced-details {
          margin-top: 20px;
          border-top: 1px solid var(--background-modifier-border);
          padding-top: 15px;
        }

        .excali-ai-advanced-summary {
          cursor: pointer;
          color: var(--text-muted);
          font-size: 0.95em;
          font-weight: 500;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 10px;
        }
        .excali-ai-advanced-summary:hover { color: var(--text-normal); }

        .excali-ai-advanced-content {
          border-left: 2px solid var(--interactive-accent);
          padding-left: 15px;
          margin-bottom: 15px;
          margin-top: 10px;
        }

        .excali-ai-run-container {
          margin-top: auto;
          padding-top: 20px;
          display: flex;
          justify-content: flex-end;
        }

        .excali-ai-task-setting {
          flex-wrap: wrap;
          gap: 10px;
        }
        .excali-ai-task-setting .setting-item-info {
          min-width: 150px;
          flex: 1 1 auto;
        }
        .excali-ai-task-setting .setting-item-control {
          flex: 1 1 auto;
          justify-content: flex-start;
        }

        .excali-ai-advanced-summary > svg {
          transition: transform 0.15s ease-in-out;
          width: 16px;
          height: 16px;
        }
        .excali-ai-advanced-details[open] > .excali-ai-advanced-summary > svg {
          transform: rotate(90deg);
        }
        .excali-ai-advanced-summary::-webkit-details-marker,
        .excali-ai-advanced-summary::marker {
          display: none; /* Hide native marker */
        }
      `
        });
        const headerContainer = contentEl.createDiv({ cls: "excali-ai-header" });
        headerContainer.innerHTML = t("excaliai", { value1: ea2.obsidian.getIcon("bot").outerHTML });
        const mainContainer = contentEl.createDiv({ cls: "excali-ai-main-container" });
        const leftCol = mainContainer.createDiv({ cls: "excali-ai-left-col" });
        const rightCol = mainContainer.createDiv({ cls: "excali-ai-right-col" });
        const mmbWarning = leftCol.createDiv({ cls: "excali-ai-warning" });
        mmbWarning.innerHTML = t("mindmapBuilderApiIsNotActiveThe", {
          value1: ea2.obsidian.getIcon("alert-triangle").outerHTML
        });
        mmbWarning.style.display = "none";
        let taskDropdown;
        let promptHeadingEl;
        let promptSetting;
        let systemPromptTextArea;
        let systemPromptDiv;
        let textModelSetting;
        let textModelSettingDropdown;
        let imageModelSetting;
        let imageModelSettingDropdown;
        let imageSizeSetting;
        let imageSizeSettingDropdown;
        let maskEditSetting;
        let maskEditToggleComponent;
        let maxTokensSetting;
        let helpEl;
        let taskValidationEl;
        let textModelHelpEl;
        let imageModelHelpEl;
        let maxTokensHelpEl;
        let previewContainerEl = rightCol;
        const checkAndUpdateSelection = async () => {
          if (isUpdatingSelection) return;
          const currentSelectedElementIds = ea2.getViewSelectedElements().map((e) => e.id).sort().join(",");
          if (lastSelectedElementIds !== currentSelectedElementIds) {
            isUpdatingSelection = true;
            lastSelectedElementIds = currentSelectedElementIds;
            const taskConfig = getActiveTaskConfig();
            if (taskConfig && (isImageEditTask(taskConfig.id) || doesTaskAllowImageInput(taskConfig.id))) {
              ({ imageDataURL, maskDataURL } = await generateCanvasDataURL(
                ea2.targetView,
                shouldGenerateMaskPreview()
              ));
              updatePreviewSection();
            }
            isUpdatingSelection = false;
          }
        };
        configModal.modalEl.addEventListener("pointerenter", checkAndUpdateSelection);
        configModal.modalEl.addEventListener("focusin", checkAndUpdateSelection);
        detachSelectionListeners = () => {
          configModal.modalEl.removeEventListener("pointerenter", checkAndUpdateSelection);
          configModal.modalEl.removeEventListener("focusin", checkAndUpdateSelection);
        };
        const refreshTaskDropdown = () => {
          if (!taskDropdown) return;
          const visibleTasks = getVisibleTaskConfigs();
          while (taskDropdown.selectEl.options.length > 0) {
            taskDropdown.selectEl.remove(0);
          }
          visibleTasks.forEach(
            (taskConfig) => taskDropdown.addOption(taskConfig.id, taskConfig.name)
          );
          taskDropdown.setDisabled(visibleTasks.length === 0);
          if (visibleTasks.length > 0) {
            taskDropdown.setValue(selectedTaskId);
          }
        };
        const updateTextModelHelp = () => {
          if (!textModelHelpEl) return;
          const taskConfig = getActiveTaskConfig();
          if (!taskConfig) {
            textModelHelpEl.innerHTML = t("textModelNoRunnableTaskIsSelected");
            return;
          }
          if (!doesTaskUseTextModel(taskConfig.id)) {
            textModelHelpEl.innerHTML = t("textModelThisTaskDoesNotUse");
            return;
          }
          if (!hasAvailableTextModels()) {
            textModelHelpEl.innerHTML = t("textModel", {
              value1: getMissingModelConfigurationMessage("text")
            });
            return;
          }
          const textSelection = getResolvedTextModelSelection(textModel);
          const multimodalText = textSelection.modelConfig?.multimodalSupport === false ? "text-only" : "multimodal";
          const usageText = doesTaskAllowImageInput(taskConfig.id) && imageDataURL ? t("theSelectedCanvasImageWillAlsoBe") : t("onlyTheTextPromptWillBeSent");
          textModelHelpEl.innerHTML = t("textModelProviderThisModelIs", {
            value1: textModel,
            value2: textSelection.providerId || "unknown",
            value3: multimodalText,
            value4: usageText
          });
          if (textSelection.providerProfile?.provider === "openai")
            textModelHelpEl.appendText(
              " " + t("reasoningHelp", {
                effort: textSelection.modelConfig?.reasoningEffort ?? t("reasoningDefault")
              })
            );
        };
        const updateImageModelHelp = () => {
          if (!imageModelHelpEl) return;
          const taskConfig = getActiveTaskConfig();
          if (!taskConfig) {
            imageModelHelpEl.innerHTML = t("imageModelNoRunnableTaskIsSelected");
            return;
          }
          if (!isImageGenerationTask(taskConfig.id)) {
            imageModelHelpEl.innerHTML = t("imageModelThisTaskDoesNotUse");
            return;
          }
          if (!hasAvailableImageModels()) {
            imageModelHelpEl.innerHTML = t("imageModel", {
              value1: getMissingModelConfigurationMessage("image")
            });
            return;
          }
          const configuredSizes = validSizes.length > 0 ? validSizes.join(", ") : DEFAULT_IMAGE_SIZE;
          const modelConfig = getImageModelConfig(imageModel);
          const transformSupportText = modelConfig?.supportsPromptImageTransforms === false ? t("doesnTSupportPromptTransforms") : t("supportsPromptTransforms");
          const maskSupportText = modelConfig?.supportsMaskImageEdits === false ? t("doesnTSupportMaskEdits") : t("supportsMaskEdits");
          const editModeText = isImageEditTask(taskConfig.id) ? shouldUseMaskEdit() ? t("maskEditIsOnSoNonImage") : activeImageModelSupportsMaskEdits() ? t("maskEditIsOffSoNonImage") : t("thisModelDoesnTSupportMaskEdits2") : "";
          imageModelHelpEl.innerHTML = t("imageModelSizesThisModelAndIf", {
            value1: imageModel,
            value2: configuredSizes,
            value3: transformSupportText,
            value4: maskSupportText,
            value5: editModeText
          });
        };
        const updateMaskEditSetting = () => {
          if (!maskEditSetting || !maskEditToggleComponent) return;
          const taskConfig = getActiveTaskConfig();
          const maskMode = getTaskMaskMode(taskConfig?.id);
          const showMaskSetting = Boolean(taskConfig) && isImageEditTask(taskConfig.id) && maskMode !== TASK_MASK_MODES.DISABLED;
          maskEditSetting.settingEl.style.display = showMaskSetting ? "" : "none";
          if (!showMaskSetting) {
            return;
          }
          const maskEditAvailable = activeImageModelSupportsMaskEdits();
          if (maskMode === TASK_MASK_MODES.REQUIRED) {
            maskEditSetting.descEl.setText(
              maskEditAvailable ? t("thisTaskAlwaysUsesMaskEdit") : t("thisTaskRequiresMaskEditButThe")
            );
            maskEditToggleComponent.setDisabled(true);
            maskEditToggleComponent.setValue(maskEditAvailable);
            return;
          }
          maskEditSetting.descEl.setText(
            maskEditAvailable ? t("onNonImageElementsBecomeTheMask") : t("thisModelDoesnTSupportMaskEdits3")
          );
          maskEditToggleComponent.setDisabled(!maskEditAvailable);
          maskEditToggleComponent.setValue(shouldUseMaskEdit());
        };
        const updateMaxTokensHelp = () => {
          if (!maxTokensHelpEl) return;
          if (!doesTaskUseTextModel()) {
            maxTokensHelpEl.innerHTML = t("textMaxTokensThisTaskDoesNot");
            return;
          }
          const scriptOverride = parsePositiveInteger(selectedMaxTokens);
          const pluginDefault = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
          const effectiveMaxTokens = getConfiguredTextMaxTokens();
          const sourceText = scriptOverride ? t("usingTheExcaliaiOverride") : pluginDefault ? t("usingThePluginDefaultResponseTokenLimit") : t("usingTheSharedAiRuntimeDefaultBehavior");
          maxTokensHelpEl.innerHTML = t("textMaxTokens", {
            value1: effectiveMaxTokens ?? "runtime default",
            value2: sourceText
          });
        };
        const refreshTextModelDropdown = () => {
          if (!textModelSettingDropdown) return;
          while (textModelSettingDropdown.selectEl.options.length > 0) {
            textModelSettingDropdown.selectEl.remove(0);
          }
          getAvailableTextModels().forEach(
            (model) => textModelSettingDropdown.addOption(model, model)
          );
          textModelSettingDropdown.setDisabled(!hasAvailableTextModels());
          if (hasAvailableTextModels()) {
            textModelSettingDropdown.setValue(textModel);
          }
        };
        const refreshImageSizeDropdown = () => {
          if (!imageSizeSettingDropdown) return;
          while (imageSizeSettingDropdown.selectEl.options.length > 0) {
            imageSizeSettingDropdown.selectEl.remove(0);
          }
          getImageSizeDropdownOptions(validSizes).forEach(
            ({ value, label }) => imageSizeSettingDropdown.addOption(value, label)
          );
          imageSizeSettingDropdown.setDisabled(!hasAvailableImageModels());
          if (hasAvailableImageModels() && validSizes.length > 0) {
            imageSizeSettingDropdown.setValue(imageSize);
          }
        };
        const refreshImageModelDropdown = () => {
          if (!imageModelSettingDropdown) return;
          while (imageModelSettingDropdown.selectEl.options.length > 0) {
            imageModelSettingDropdown.selectEl.remove(0);
          }
          getAvailableImageModels().forEach(
            (model) => imageModelSettingDropdown.addOption(model, model)
          );
          imageModelSettingDropdown.setDisabled(!hasAvailableImageModels());
          if (hasAvailableImageModels()) {
            imageModelSettingDropdown.setValue(imageModel);
          }
        };
        const updatePreviewSection = () => {
          if (!previewContainerEl) return;
          previewContainerEl.empty();
          previewContainerEl.createEl("h3", {
            text: t("preview"),
            attr: { style: "margin-top: 0; margin-bottom: 10px;" }
          });
          previewDiv = null;
          const taskConfig = getActiveTaskConfig();
          if (!taskConfig) {
            previewContainerEl.createEl("p", {
              text: t("noRunnableTaskIsSelected"),
              cls: "excali-ai-help-text"
            });
            return;
          }
          if (imageDataURL) {
            previewDiv = previewContainerEl.createDiv({ attr: { style: "text-align: center;" } });
            addPreviewImage();
            return;
          }
          if (taskRequiresImageInput(taskConfig.id)) {
            previewContainerEl.createEl("span", {
              text: t("selectContentOnTheCanvasThisTask"),
              cls: "excali-ai-help-text"
            });
            return;
          }
          if (doesTaskAllowImageInput(taskConfig.id)) {
            previewContainerEl.createEl("span", {
              text: t("nothingIsSelectedSoOnlyTheText"),
              cls: "excali-ai-help-text"
            });
            return;
          }
          previewContainerEl.createEl("span", {
            text: t("thisTaskUsesOnlyTheTextPrompt"),
            cls: "excali-ai-help-text"
          });
        };
        const updateHelpText = () => {
          const taskConfig = getActiveTaskConfig();
          helpEl.innerHTML = taskConfig ? t("howItWorks", { value1: taskConfig.help }) : t("howItWorksNoRunnableTaskIs");
          const validationMessage = getTaskConfigValidationMessage(taskConfig);
          taskValidationEl.style.display = validationMessage ? "" : "none";
          taskValidationEl.innerHTML = validationMessage ? t("taskConfig", { value1: validationMessage }) : "";
          updateTextModelHelp();
          updateImageModelHelp();
          updateMaxTokensHelp();
          if (mmbWarning) {
            const isMmbTask = taskConfig?.execution?.requiresApi === TASK_RUNTIME_APIS.MINDMAP_BUILDER;
            mmbWarning.style.display = isMmbTask && !window?.MindMapBuilderAPI ? "flex" : "none";
          }
        };
        const updateTaskSpecificControls = () => {
          const taskConfig = getActiveTaskConfig();
          const taskId = taskConfig?.id ?? "";
          const usesTextModel = Boolean(taskConfig) && doesTaskUseTextModel(taskId);
          const usesImageModel = Boolean(taskConfig) && isImageGenerationTask(taskId);
          const showsSystemPrompt = usesTextModel && taskConfig.systemPrompt !== null;
          const showsUserPrompt = Boolean(taskConfig) && doesTaskAllowUserPrompt(taskId);
          if (systemPromptDiv) {
            systemPromptDiv.style.display = showsSystemPrompt ? "" : "none";
          }
          if (systemPromptTextArea) {
            refreshingMainFields = true;
            systemPromptTextArea.setValue(taskConfig?.systemPrompt ?? "");
            refreshingMainFields = false;
          }
          if (promptHeadingEl) {
            promptHeadingEl.style.display = showsUserPrompt ? "" : "none";
          }
          if (promptSetting) {
            promptSetting.settingEl.style.display = showsUserPrompt ? "" : "none";
          }
          if (textModelSetting) {
            textModelSetting.settingEl.style.display = usesTextModel ? "" : "none";
          }
          if (maxTokensSetting) {
            maxTokensSetting.settingEl.style.display = usesTextModel ? "" : "none";
          }
          if (imageModelSetting) {
            imageModelSetting.settingEl.style.display = usesImageModel ? "" : "none";
          }
          if (imageSizeSetting) {
            imageSizeSetting.settingEl.style.display = usesImageModel ? "" : "none";
          }
          updateMaskEditSetting();
          updateHelpText();
          updatePreviewSection();
        };
        const taskSetting = new ea2.obsidian.Setting(leftCol).setName(t("task2")).setDesc(t("selectTheTaskYouWantToRun")).addDropdown((dropdown) => {
          taskDropdown = dropdown;
          refreshTaskDropdown();
          dropdown.setValue(selectedTaskId);
          dropdown.onChange(async (value) => {
            dirty = true;
            const previousTaskId = selectedTaskId;
            const previousMaskMode = getTaskMaskMode(previousTaskId);
            const previousWasImageEdit = isImageEditTask(previousTaskId);
            selectedTaskId = value;
            const nextWasImageEdit = isImageEditTask(selectedTaskId);
            const nextMaskMode = getTaskMaskMode(selectedTaskId);
            if (previousWasImageEdit !== nextWasImageEdit || previousMaskMode !== nextMaskMode) {
              ({ imageDataURL, maskDataURL } = await generateCanvasDataURL(
                ea2.targetView,
                shouldGenerateMaskPreview()
              ));
            }
            setTextAndImageModels();
            refreshTaskDropdown();
            refreshTextModelDropdown();
            refreshImageModelDropdown();
            refreshImageSizeDropdown();
            updateTaskSpecificControls();
          });
        }).addButton(
          (button) => button.setButtonText(t("editTasks")).setIcon("settings").setTooltip(t("editTasks")).onClick(() => {
            openTaskEditorAfterClose = true;
            configModal.close();
          })
        );
        taskSetting.settingEl.classList.add("excali-ai-task-setting");
        helpEl = leftCol.createEl("p", { cls: "excali-ai-help-text" });
        taskValidationEl = leftCol.createEl("p", { cls: "excali-ai-validation-text" });
        promptHeadingEl = leftCol.createEl("h4", {
          text: t("prompt"),
          attr: { style: "margin-bottom: 5px; margin-top: 10px;" }
        });
        promptSetting = new ea2.obsidian.Setting(leftCol).addTextArea((text) => {
          text.inputEl.style.minHeight = "8em";
          text.inputEl.style.width = "100%";
          text.setValue(userPrompt);
          text.onChange((value) => {
            userPrompt = value;
            dirty = true;
          });
        });
        promptSetting.nameEl.style.display = "none";
        promptSetting.descEl.style.display = "none";
        promptSetting.infoEl.style.display = "none";
        promptSetting.controlEl.style.width = "100%";
        const advancedDetails = leftCol.createEl("details", { cls: "excali-ai-advanced-details" });
        const advancedSummary = advancedDetails.createEl("summary", {
          cls: "excali-ai-advanced-summary"
        });
        advancedSummary.innerHTML = t("advancedSettings", {
          value1: ea2.obsidian.getIcon("chevron-right").outerHTML
        });
        const advancedContent = advancedDetails.createDiv({ cls: "excali-ai-advanced-content" });
        systemPromptDiv = advancedContent.createDiv();
        systemPromptDiv.createEl("h4", {
          text: t("systemPrompt"),
          attr: { style: "margin-bottom: 5px;" }
        });
        systemPromptDiv.createEl("span", {
          text: t("advancedPromptWarning"),
          cls: "excali-ai-help-text"
        });
        const systemPromptSetting = new ea2.obsidian.Setting(systemPromptDiv).addTextArea((text) => {
          systemPromptTextArea = text;
          text.inputEl.style.minHeight = "6em";
          text.inputEl.style.width = "100%";
          text.setValue(getActiveTaskConfig()?.systemPrompt ?? "");
          text.onChange((value) => {
            if (refreshingMainFields) return;
            const taskConfig = getTaskConfigById(selectedTaskId);
            if (!taskConfig) return;
            taskConfig.systemPrompt = value;
            dirty = true;
            updateHelpText();
          });
        });
        systemPromptSetting.nameEl.style.display = "none";
        systemPromptSetting.descEl.style.display = "none";
        systemPromptSetting.infoEl.style.display = "none";
        textModelSetting = new ea2.obsidian.Setting(advancedContent).setName(t("textModel2")).addDropdown((dropdown) => {
          textModelSettingDropdown = dropdown;
          refreshTextModelDropdown();
          dropdown.setDisabled(!hasAvailableTextModels());
          dropdown.setValue(textModel || getAvailableTextModels()[0] || "").onChange((value) => {
            dirty = true;
            selectedTextModel = value;
            setTextAndImageModels();
            refreshTextModelDropdown();
            updateTextModelHelp();
          });
        });
        textModelHelpEl = advancedContent.createEl("p", { cls: "excali-ai-help-text" });
        maxTokensSetting = new ea2.obsidian.Setting(advancedContent).setName(t("textMaxTokenOverride")).addText((text) => {
          text.inputEl.type = "number";
          text.inputEl.min = "1";
          text.inputEl.style.width = "100px";
          const placeholderValue = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
          if (placeholderValue) {
            text.setPlaceholder(String(placeholderValue));
          }
          text.setValue(selectedMaxTokens);
          text.onChange((value) => {
            selectedMaxTokens = String(value ?? "").trim();
            dirty = true;
            updateMaxTokensHelp();
          });
        });
        maxTokensSetting.settingEl.toggleClass("is-disabled", !hasAvailableTextModels());
        maxTokensHelpEl = advancedContent.createEl("p", { cls: "excali-ai-help-text" });
        imageModelSetting = new ea2.obsidian.Setting(advancedContent).setName(t("imageModel2")).addDropdown((dropdown) => {
          imageModelSettingDropdown = dropdown;
          refreshImageModelDropdown();
          dropdown.setDisabled(!hasAvailableImageModels());
          dropdown.setValue(imageModel || getAvailableImageModels()[0] || "").onChange(async (value) => {
            dirty = true;
            selectedImageModel = value;
            setTextAndImageModels();
            refreshTextModelDropdown();
            refreshImageModelDropdown();
            refreshImageSizeDropdown();
            updateMaskEditSetting();
            updateImageModelHelp();
            if (isImageEditTask()) {
              ({ imageDataURL, maskDataURL } = await generateCanvasDataURL(
                ea2.targetView,
                shouldGenerateMaskPreview()
              ));
              updatePreviewSection();
            }
          });
        });
        imageModelHelpEl = advancedContent.createEl("p", { cls: "excali-ai-help-text" });
        maskEditSetting = new ea2.obsidian.Setting(advancedContent).setName(t("useMaskEdit")).addToggle((toggle) => {
          maskEditToggleComponent = toggle;
          toggle.setValue(shouldUseMaskEdit()).setDisabled(!activeImageModelSupportsMaskEdits()).onChange(async (value) => {
            dirty = true;
            prefersMaskEdit = value;
            updateMaskEditSetting();
            updateImageModelHelp();
            ({ imageDataURL, maskDataURL } = await generateCanvasDataURL(
              ea2.targetView,
              shouldGenerateMaskPreview()
            ));
            updatePreviewSection();
          });
        });
        imageSizeSetting = new ea2.obsidian.Setting(advancedContent).setName(t("imageSize")).addDropdown((dropdown) => {
          imageSizeSettingDropdown = dropdown;
          refreshImageSizeDropdown();
          dropdown.setDisabled(!hasAvailableImageModels());
          dropdown.setValue(imageSize).onChange(async (value) => {
            dirty = true;
            imageSize = value;
            updateImageModelHelp();
            if (isImageEditTask()) {
              ({ imageDataURL, maskDataURL } = await generateCanvasDataURL(
                ea2.targetView,
                shouldGenerateMaskPreview()
              ));
              updatePreviewSection();
            }
          });
        });
        setTextAndImageModels();
        refreshTaskDropdown();
        refreshTextModelDropdown();
        refreshImageModelDropdown();
        refreshImageSizeDropdown();
        updateTaskSpecificControls();
        const runContainer = leftCol.createDiv({ cls: "excali-ai-run-container" });
        const runSetting = new ea2.obsidian.Setting(runContainer);
        if (ea2.verifyMinimumPluginVersion && ea2.verifyMinimumPluginVersion("2.23.4")) {
          runSetting.addButton((button) => {
            button.setButtonText(ea2.formatAIUsageLabel()).setIcon("bar-chart-2").setTooltip(t("viewAiTokenUsageForThisSession")).onClick(() => {
              ea2.showAIUsageModal();
            });
          });
        }
        runSetting.addButton(
          (button) => button.setButtonText(t("run")).setIcon("play").setTooltip(t("run")).setCta().onClick(() => {
            const taskConfig = getActiveTaskConfig();
            if (!taskConfig) {
              new Notice(t("noRunnableAiTaskIsSelected"), 8e3);
              return;
            }
            const taskConfigValidationMessage = getTaskConfigValidationMessage(taskConfig);
            if (taskConfigValidationMessage) {
              new Notice(taskConfigValidationMessage, 8e3);
              return;
            }
            if (doesTaskUseTextModel(taskConfig.id) && !hasAvailableTextModels()) {
              new Notice(getMissingModelConfigurationMessage("text"), 8e3);
              return;
            }
            if (isImageGenerationTask(taskConfig.id) && !hasAvailableImageModels()) {
              new Notice(getMissingModelConfigurationMessage("image"), 8e3);
              return;
            }
            void run(userPrompt).catch(() => {
              new Notice(t("requestFailed"));
            });
            configModal.close();
          })
        );
      };
      configModal.onClose = async () => {
        detachSelectionListeners();
        unregisterModalCleanup();
        if (dirty) {
          await saveExcaliAISettings();
        }
        if (openTaskEditorAfterClose) {
          openTaskEditorModal({ reopenMainModal: true });
        }
      };
      unregisterModalCleanup = ea2.registerCleanup(() => configModal.close());
      configModal.open();
    };
    openConfigModal();
  }

  // src/scripts/excali-ai/main.ts
  void runExcaliAI(ea, utils).catch((error) => {
    const t = createExcaliAITranslator(ea.obsidian.moment.locale());
    new ea.obsidian.Notice(t("scriptFailed"));
    console.error(error);
  });
})();

/* end of bundle */
