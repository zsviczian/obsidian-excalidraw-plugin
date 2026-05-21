/*

<a href="https://www.youtube.com/watch?v=A1vrSGBbWgo" target="_blank"><img src ="https://i.ytimg.com/vi/A1vrSGBbWgo/maxresdefault.jpg" style="width:560px;"></a>


![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-draw-a-ui.jpg)
```js*/
let dirty=false;

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.23.0")) {
  new Notice("This script requires Excalidraw 2.23.0 or later. Please update the plugin.");
  return;
}

const EXCALIAI_SETTINGS_VERSION = 1;
const DEFAULT_IMAGE_SIZE = "1024x1024";

const TASK_EXECUTION_MODES = {
  TEXT_RESULT: "text-result",
  IMAGE_PROMPT: "image-prompt",
  IMAGE_DIRECT: "image-direct",
  IMAGE_EDIT: "image-edit",
};

const TASK_RESULT_TYPES = {
  HTML: "html",
  MINDMAP: "mindmap",
  MERMAID: "mermaid",
  SVG: "svg",
  IMAGE: "image",
  IMAGE_SILENT: "image-silent",
};

const TASK_INPUT_RULES = {
  DISABLED: "disabled",
  OPTIONAL: "optional",
  REQUIRED: "required",
};

const TASK_MASK_MODES = {
  DISABLED: "disabled",
  OPTIONAL: "optional",
  REQUIRED: "required",
};

const TASK_RUNTIME_APIS = {
  NONE: "",
  MINDMAP_BUILDER: "mindmap-builder",
};

const VALID_TASK_EXECUTION_MODES = Object.values(TASK_EXECUTION_MODES);
const VALID_TASK_RESULT_TYPES = Object.values(TASK_RESULT_TYPES);
const VALID_TASK_INPUT_RULES = Object.values(TASK_INPUT_RULES);
const VALID_TASK_MASK_MODES = Object.values(TASK_MASK_MODES);
const VALID_TASK_RUNTIME_APIS = Object.values(TASK_RUNTIME_APIS);

const TASK_EXECUTION_MODE_META = {
  [TASK_EXECUTION_MODES.TEXT_RESULT]: {
    label: "Text response",
    description: "Uses the text or multimodal model and returns structured output such as HTML, Mermaid, a mind map, or Excalidraw strokes.",
  },
  [TASK_EXECUTION_MODES.IMAGE_PROMPT]: {
    label: "Write prompt, then generate image",
    description: "Uses the text model to write an image prompt from the canvas selection and/or user prompt, then sends that prompt to the image model.",
  },
  [TASK_EXECUTION_MODES.IMAGE_DIRECT]: {
    label: "Send prompt straight to image model",
    description: "Sends only the user's prompt to the image model. No text-model prompt writing step and no canvas image input.",
  },
  [TASK_EXECUTION_MODES.IMAGE_EDIT]: {
    label: "Edit selected image",
    description: "Uses the selected image as the source and applies either a mask edit or a prompt-based transform.",
  },
};

const TASK_RESULT_TYPE_META = {
  [TASK_RESULT_TYPES.HTML]: {
    label: "HTML",
    description: "Embeds the response as a single HTML result.",
  },
  [TASK_RESULT_TYPES.MINDMAP]: {
    label: "Mind Map",
    description: "Imports the response into MindMap Builder.",
    runtimeRequirement: TASK_RUNTIME_APIS.MINDMAP_BUILDER,
  },
  [TASK_RESULT_TYPES.MERMAID]: {
    label: "Mermaid",
    description: "Creates a Mermaid diagram.",
  },
  [TASK_RESULT_TYPES.SVG]: {
    label: "Excalidraw Strokes",
    description: "Uses SVG behind the scenes to generate Excalidraw strokes.",
  },
  [TASK_RESULT_TYPES.IMAGE]: {
    label: "Image + prompt note",
    description: "Generates an image and adds the model's revised prompt underneath when available.",
  },
  [TASK_RESULT_TYPES.IMAGE_SILENT]: {
    label: "Image only",
    description: "Generates only the image, without adding the revised prompt underneath.",
  },
};

const getTaskExecutionModeMeta = (mode) => (
  TASK_EXECUTION_MODE_META[mode] ?? TASK_EXECUTION_MODE_META[TASK_EXECUTION_MODES.TEXT_RESULT]
);

const getTaskExecutionModeLabel = (mode) => (
  getTaskExecutionModeMeta(mode).label
);

const getTaskExecutionModeDescription = (mode) => (
  getTaskExecutionModeMeta(mode).description
);

const getTaskResultTypeMeta = (resultType) => (
  TASK_RESULT_TYPE_META[resultType] ?? TASK_RESULT_TYPE_META[TASK_RESULT_TYPES.HTML]
);

const getTaskResultTypeLabel = (resultType) => (
  getTaskResultTypeMeta(resultType).label
);

const getTaskResultTypeDescription = (resultType) => (
  getTaskResultTypeMeta(resultType).description
);

const getTaskRuntimeRequirement = (taskConfig) => (
  getTaskResultTypeMeta(taskConfig?.execution?.resultType ?? TASK_RESULT_TYPES.HTML).runtimeRequirement
  ?? TASK_RUNTIME_APIS.NONE
);

const getTaskRuntimeRequirementLabel = (runtimeRequirement) => {
  switch(runtimeRequirement) {
    case TASK_RUNTIME_APIS.MINDMAP_BUILDER:
      return "MindMap Builder";
    default:
      return "None";
  }
};

const normalizeEnumValue = (value, validValues, fallbackValue) => (
  validValues.includes(value) ? value : fallbackValue
);

const cloneJSON = (value) => {
  if(value == null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
};

const createTaskIdFromName = (value = "") => {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalizedValue || "task";
};

const getDefaultOutputInstruction = (resultType) => {
  switch(resultType) {
    case TASK_RESULT_TYPES.HTML:
      return "Turn this into a single html file using tailwind. Return a single message containing only the html file in a codeblock.";
    case TASK_RESULT_TYPES.MINDMAP:
      return "Return only the mind map as plain text. Use one # heading for the central node, then nested - bullets for branches. Do not use bold, italics, code fences, tables, or explanatory text.";
    case TASK_RESULT_TYPES.MERMAID:
      return "Return a single message containing only the mermaid diagram in a codeblock.";
    case TASK_RESULT_TYPES.SVG:
      return "Return a single message containing only the SVG code in an html codeblock.";
    case TASK_RESULT_TYPES.IMAGE:
    case TASK_RESULT_TYPES.IMAGE_SILENT:
      return "Return a single message with the generated image prompt in a codeblock";
    default:
      return "";
  }
};

const getDefaultResultTypeForMode = (mode) => {
  switch(mode) {
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
    TASK_EXECUTION_MODES.TEXT_RESULT,
  );
  const resultType = normalizeEnumValue(
    execution.resultType,
    VALID_TASK_RESULT_TYPES,
    getDefaultResultTypeForMode(mode),
  );
  const imageInputFallback = mode === TASK_EXECUTION_MODES.IMAGE_DIRECT
    ? TASK_INPUT_RULES.DISABLED
    : mode === TASK_EXECUTION_MODES.IMAGE_EDIT
      ? TASK_INPUT_RULES.REQUIRED
      : TASK_INPUT_RULES.OPTIONAL;

  return {
    id: createTaskIdFromName(task.id ?? task.name ?? `task-${index + 1}`),
    name: String(task.name ?? "").trim() || `Task ${index + 1}`,
    help: String(task.help ?? "").trim(),
    systemPrompt: task.systemPrompt == null ? null : String(task.systemPrompt),
    outputInstruction: String(task.outputInstruction ?? getDefaultOutputInstruction(resultType)),
    execution: {
      mode,
      resultType,
      userPrompt: normalizeEnumValue(
        execution.userPrompt,
        VALID_TASK_INPUT_RULES,
        TASK_INPUT_RULES.OPTIONAL,
      ),
      imageInput: normalizeEnumValue(
        execution.imageInput,
        VALID_TASK_INPUT_RULES,
        imageInputFallback,
      ),
      maskMode: normalizeEnumValue(
        execution.maskMode,
        VALID_TASK_MASK_MODES,
        mode === TASK_EXECUTION_MODES.IMAGE_EDIT
          ? TASK_MASK_MODES.OPTIONAL
          : TASK_MASK_MODES.DISABLED,
      ),
      requiresApi: getTaskResultTypeMeta(resultType).runtimeRequirement ?? TASK_RUNTIME_APIS.NONE,
    },
  };
};

const normalizeTaskConfigs = (tasks, {fallbackToDefaults = false} = {}) => {
  if(!Array.isArray(tasks)) {
    return fallbackToDefaults ? normalizeTaskConfigs(createDefaultTaskConfigs()) : [];
  }

  const usedIds = new Set();
  return tasks.map((task, index) => {
    const normalizedTask = normalizeTaskConfig(task, index);
    if(normalizedTask.execution.mode !== TASK_EXECUTION_MODES.IMAGE_EDIT) {
      normalizedTask.execution.maskMode = TASK_MASK_MODES.DISABLED;
    }
    let nextId = normalizedTask.id || createTaskIdFromName(normalizedTask.name) || `task-${index + 1}`;
    let duplicateCount = 2;
    while(usedIds.has(nextId)) {
      nextId = `${normalizedTask.id}-${duplicateCount++}`;
    }
    usedIds.add(nextId);
    normalizedTask.id = nextId;
    return normalizedTask;
  });
};

const createDefaultTaskConfigs = () => ([
  {
    id: "challenge-my-thinking",
    name: "Challenge my thinking",
    help: "Turn the selected image and optional prompt into a Mermaid mind map. If conversion fails, open More Tools > Mermaid to Excalidraw and edit the generated script.",
    systemPrompt: `Your task is to interpret a screenshot of a whiteboard, translating its ideas into a Mermaid graph. The whiteboard will encompass thoughts on a subject. Within the mind map, distinguish ideas that challenge, dispute, or contradict the whiteboard content. Additionally, include concepts that expand, complement, or advance the user's thinking. Utilize the Mermaid graph diagram type and present the resulting Mermaid diagram within a code block. Ensure the Mermaid script excludes the use of parentheses ().`,
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.MERMAID),
    execution: {
      mode: TASK_EXECUTION_MODES.TEXT_RESULT,
      resultType: TASK_RESULT_TYPES.MERMAID,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "convert-sketch-to-shapes",
    name: "Convert sketch to shapes",
    help: "Convert selected sketches into Excalidraw strokes. Works best with a small number of simple shapes. Experimental.",
    systemPrompt: `Given an image featuring various geometric shapes drawn by the user, your objective is to analyze the input and generate SVG code that accurately represents these shapes. Your output will be the SVG code enclosed in an HTML code block.`,
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.SVG),
    execution: {
      mode: TASK_EXECUTION_MODES.TEXT_RESULT,
      resultType: TASK_RESULT_TYPES.SVG,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "create-a-simple-excalidraw-icon",
    name: "Create a simple Excalidraw icon",
    help: "Turn a text prompt into a simple icon and insert it into Excalidraw as strokes. Text prompt only. Experimental.",
    systemPrompt: `Given a description of an SVG image from the user, your objective is to generate the corresponding SVG code. Avoid incorporating textual elements within the generated SVG. Your output should be the resulting SVG code enclosed in an HTML code block.`,
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.SVG),
    execution: {
      mode: TASK_EXECUTION_MODES.TEXT_RESULT,
      resultType: TASK_RESULT_TYPES.SVG,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.DISABLED,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "create-a-stick-figure",
    name: "Create a stick figure",
    help: "Send only the text prompt to the configured image model. Be specific. To keep the prompt unchanged, start with: 'DO NOT add any detail, just use it AS-IS:'",
    systemPrompt: "You will receive a prompt from the user. Your task involves drawing a simple stick figure or a scene involving a few stick figures based on the user's prompt. Create the stick figure based on the following style description. DO NOT add any detail, just use it AS-IS: Create a simple stick figure character with a large round head and a face in the style of sketchy caricatures. The stick figure should have a rudimentary body composed of straight lines representing the arms and legs. Hands and toes should be represented with round shapes, do not add details such as fingers or toes. Use fine lines, smooth curves, rounded shapes. The stick figure should retain a playful and childlike simplicity, reminiscent of a doodle someone might draw on the corner of a notebook page. Create a black and white drawing, a hand-drawn figure on white background.",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
      resultType: TASK_RESULT_TYPES.IMAGE,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.DISABLED,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "edit-an-image",
    name: "Edit an image",
    help: "Image elements are used as the source image. In mask mode, shapes on top become the mask. Turn mask edit off to flatten non-image elements into the source image and apply a prompt-based transform.",
    systemPrompt: null,
    outputInstruction: "",
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_EDIT,
      resultType: TASK_RESULT_TYPES.IMAGE,
      userPrompt: TASK_INPUT_RULES.REQUIRED,
      imageInput: TASK_INPUT_RULES.REQUIRED,
      maskMode: TASK_MASK_MODES.OPTIONAL,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "generate-an-image-from-image-and-prompt",
    name: "Generate an image from image and prompt",
    help: "Generate an image from the selected image and your prompt. Add context in the prompt to guide how the image should be interpreted.",
    systemPrompt: "Your task involves receiving an image and a textual prompt from the user. Your goal is to craft a detailed, accurate, and descriptive narrative of the image, tailored for effective image generation. Utilize the user-provided text prompt to inform and guide your depiction of the image. Ensure the resulting image remains text-free.",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
      resultType: TASK_RESULT_TYPES.IMAGE,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "generate-an-image-from-prompt",
    name: "Generate an image from prompt",
    help: "Send only the text prompt to the configured image model. Be specific. To keep the prompt unchanged, start with: 'DO NOT add any detail, just use it AS-IS:'",
    systemPrompt: null,
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_DIRECT,
      resultType: TASK_RESULT_TYPES.IMAGE,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.DISABLED,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "generate-an-image-to-illustrate-a-quote",
    name: "Generate an image to illustrate a quote",
    help: "Turn a quote into an illustrated scene. Include the author's name if you want the result to reference them.",
    systemPrompt: "Your task involves transforming a user-provided quote into a detailed and imaginative illustration. Craft a visual representation that captures the essence of the quote and resonates well with a broad audience. If the Author's name is provided, aim to establish a connection between the illustration and the Author. This can be achieved by referencing a well-known story from the Author, situating the image in the Author's era or setting, or employing other creative methods of association. Additionally, provide preferences for styling, such as the chosen medium and artistic direction, to guide the image creation process. Ensure the resulting image remains text-free. Your task output should comprise a descriptive and detailed narrative aimed at facilitating the creation of a captivating illustration from the quote.",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
      resultType: TASK_RESULT_TYPES.IMAGE,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.DISABLED,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "generate-4-icon-variants-based-on-input-image",
    name: "Generate 4 icon-variants based on input image",
    help: "Generate a 2x2 sheet of four icon variations from the selected sketch. Add a prompt if you want to steer the result.",
    systemPrompt: "Given a simple sketch and an optional text prompt from the user, your task is to generate a descriptive narrative tailored for effective image generation, capturing the style of the sketch. Utilize the text prompt to guide the description. Your objective is to instruct DALL-E to create a collage of four minimalist black and white hand-drawn pencil sketches in a 2x2 matrix format. Each sketch should convert the user's sketch into simple artistic SVG icons with transparent backgrounds. Ensure the resulting images remain text-free, maintaining a minimalist, easy-to-understand style, and omit framing borders. Only include a pencil in the drawing if it is explicitly mentioned in the user prompt or included in the sketch.",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE_SILENT),
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
      resultType: TASK_RESULT_TYPES.IMAGE_SILENT,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "visual-brainstorm",
    name: "Visual brainstorm",
    help: "Generate an image from the selected image and prompt to spark new ideas.",
    systemPrompt: "Your objective is to interpret a screenshot of a whiteboard, creating an image aimed at sparking further thoughts on the subject. The whiteboard will present diverse ideas about a specific topic. Your generated image should achieve one of two purposes: highlighting concepts that challenge, dispute, or contradict the whiteboard content, or introducing ideas that expand, complement, or enrich the user's thinking. You have the option to include multiple tiles in the resulting image, resembling a sequence akin to a comic strip. Ensure that the image remains devoid of text.",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.IMAGE),
    execution: {
      mode: TASK_EXECUTION_MODES.IMAGE_PROMPT,
      resultType: TASK_RESULT_TYPES.IMAGE,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "wireframe-to-code",
    name: "Wireframe to code",
    help: "Interpret the selected wireframe and generate a web app as a single HTML file. You can copy the result from the embeddable menu.",
    systemPrompt: `You are an expert tailwind developer. A user will provide you with a low-fidelity wireframe of an application and you will return a single html file that uses tailwind to create the website. Use creative license to make the application more fleshed out. Write the necessary javascript code. If you need to insert an image, use placehold.co to create a placeholder image.`,
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.HTML),
    execution: {
      mode: TASK_EXECUTION_MODES.TEXT_RESULT,
      resultType: TASK_RESULT_TYPES.HTML,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  },
  {
    id: "create-mindmap",
    name: "Create Mindmap",
    help: "Create a hierarchical mind map from the selected image, if any, and your prompt, then import it into MindMap Builder. Requires MindMap Builder to be available.",
    systemPrompt: "You will receive a text prompt and may also receive an image. Create a mind map as a hierarchical plain-text outline based on the image content, if provided, and the text prompt. Return only the mind map. Use exactly one markdown H1 heading for the central node, then - bullets for branches and indented - bullets for sub-branches. Do not use bold, italics, code fences, numbering, commentary, or any markdown formatting other than the heading and bullet list.",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.MINDMAP),
    execution: {
      mode: TASK_EXECUTION_MODES.TEXT_RESULT,
      resultType: TASK_RESULT_TYPES.MINDMAP,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.MINDMAP_BUILDER,
    },
  },
]);

const DEFAULT_TASK_CONFIGS = normalizeTaskConfigs(createDefaultTaskConfigs());
const DEFAULT_TASK_ID = DEFAULT_TASK_CONFIGS.find(task => task.id === "wireframe-to-code")?.id
  ?? DEFAULT_TASK_CONFIGS[0]?.id
  ?? "";

const createDefaultState = (taskConfigs = []) => ({
  selectedTaskId: taskConfigs.find(task => task.id === DEFAULT_TASK_ID)?.id ?? taskConfigs[0]?.id ?? "",
  userPrompt: "",
  maskEdit: true,
  textModel: "",
  imageModel: "",
  maxTokens: "",
  imageSize: DEFAULT_IMAGE_SIZE,
});

const normalizeState = (state = {}, taskConfigs = []) => {
  const defaultState = createDefaultState(taskConfigs);
  const knownTaskIds = new Set(taskConfigs.map(task => task.id));
  const selectedTaskId = String(state.selectedTaskId ?? defaultState.selectedTaskId).trim();
  return {
    selectedTaskId: knownTaskIds.has(selectedTaskId) ? selectedTaskId : defaultState.selectedTaskId,
    userPrompt: String(state.userPrompt ?? defaultState.userPrompt),
    maskEdit: state.maskEdit !== false,
    textModel: String(state.textModel ?? defaultState.textModel),
    imageModel: String(state.imageModel ?? defaultState.imageModel),
    maxTokens: String(state.maxTokens ?? defaultState.maxTokens).trim(),
    imageSize: String(state.imageSize ?? defaultState.imageSize).trim() || defaultState.imageSize,
  };
};

const createDefaultExcaliAISettings = () => ({
  schemaVersion: EXCALIAI_SETTINGS_VERSION,
  config: {
    tasks: cloneJSON(DEFAULT_TASK_CONFIGS),
  },
  state: createDefaultState(DEFAULT_TASK_CONFIGS),
});

const LEGACY_TASK_NAME_TO_ID = Object.fromEntries(
  DEFAULT_TASK_CONFIGS.map(task => [task.name, task.id]),
);

const loadExcaliAISettings = (rawSettings) => {
  const sourceSettings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const normalizedSettings = createDefaultExcaliAISettings();
  normalizedSettings.config.tasks = normalizeTaskConfigs(sourceSettings.config?.tasks, {fallbackToDefaults: true});

  const legacyState = {
    selectedTaskId: LEGACY_TASK_NAME_TO_ID[String(sourceSettings["Agent's Task"] ?? "").trim()] ?? normalizedSettings.state.selectedTaskId,
    userPrompt: sourceSettings["User Prompt"] ?? normalizedSettings.state.userPrompt,
    maskEdit: sourceSettings["Mask Edit"] !== false,
    textModel: sourceSettings["Text Model"] ?? normalizedSettings.state.textModel,
    imageModel: sourceSettings["Image Model"] ?? normalizedSettings.state.imageModel,
    maxTokens: sourceSettings["Max Tokens"] ?? normalizedSettings.state.maxTokens,
    imageSize: sourceSettings["Image Size"] ?? normalizedSettings.state.imageSize,
  };

  normalizedSettings.state = normalizeState({
    ...legacyState,
    ...(sourceSettings.state ?? {}),
  }, normalizedSettings.config.tasks);

  return {
    settings: normalizedSettings,
    needsSave: JSON.stringify(sourceSettings) !== JSON.stringify(normalizedSettings),
  };
};

// --------------------------------------
// Initialize values and settings
// --------------------------------------
let settings = ea.getScriptSettings();
const loadedExcaliAISettings = loadExcaliAISettings(settings);
settings = loadedExcaliAISettings.settings;
if(loadedExcaliAISettings.needsSave) {
  await ea.setScriptSettings(settings);
}

let userPrompt = settings.state.userPrompt ?? "";
let selectedTaskId = settings.state.selectedTaskId;
let imageSize = settings.state.imageSize ?? DEFAULT_IMAGE_SIZE;
let selectedTextModel = settings.state.textModel ?? "";
let selectedImageModel = settings.state.imageModel ?? "";
let selectedMaxTokens = String(settings.state.maxTokens ?? "").trim();
let prefersMaskEdit = settings.state.maskEdit !== false;

const aiSettings = ea.getAISettings();
if(!aiSettings?.enabled) {
  new Notice("Excalidraw AI is disabled or unavailable. Enable it in plugin settings.");
  return;
}
let textModel, imageModel, validSizes;
let imageDataURL = null;
let maskDataURL = null;

const parsePositiveInteger = (value) => {
  const normalizedValue = String(value ?? "").trim();
  if(!normalizedValue) {
    return null;
  }

  const parsedValue = parseInt(normalizedValue, 10);
  if(Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const getTaskConfigs = () => settings.config?.tasks ?? [];

const isTaskRuntimeAvailable = (taskConfig) => {
  switch(getTaskRuntimeRequirement(taskConfig)) {
    case TASK_RUNTIME_APIS.MINDMAP_BUILDER:
      return Boolean(window?.MindMapBuilderAPI);
    default:
      return true;
  }
};

const getVisibleTaskConfigs = () => getTaskConfigs().filter(isTaskRuntimeAvailable);

const getTaskConfigById = (taskId = selectedTaskId) => (
  getTaskConfigs().find(taskConfig => taskConfig.id === taskId) ?? null
);

const getVisibleTaskConfigById = (taskId = selectedTaskId) => (
  getVisibleTaskConfigs().find(taskConfig => taskConfig.id === taskId) ?? null
);

const ensureSelectedTaskId = () => {
  const activeVisibleTask = getVisibleTaskConfigById(selectedTaskId);
  const fallbackTask = activeVisibleTask ?? getVisibleTaskConfigs()[0] ?? null;
  const nextTaskId = fallbackTask?.id ?? "";
  if(selectedTaskId !== nextTaskId) {
    selectedTaskId = nextTaskId;
    dirty = true;
  }
  return fallbackTask;
};

const getActiveTaskConfig = () => ensureSelectedTaskId();

const getTaskExecutionConfig = (taskId = selectedTaskId) => (
  getTaskConfigById(taskId)?.execution ?? null
);

const getTaskOutputType = (taskId = selectedTaskId) => {
  const taskConfig = typeof taskId === "string" ? getTaskConfigById(taskId) : taskId;
  return {
    instruction: taskConfig?.outputInstruction ?? "",
    blocktype: taskConfig?.execution?.resultType ?? TASK_RESULT_TYPES.HTML,
  };
};

const isImageEditTask = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.mode === TASK_EXECUTION_MODES.IMAGE_EDIT
);

const isImageGenerationTask = (taskId = selectedTaskId) => {
  const mode = getTaskExecutionConfig(taskId)?.mode;
  return mode === TASK_EXECUTION_MODES.IMAGE_PROMPT
    || mode === TASK_EXECUTION_MODES.IMAGE_DIRECT
    || mode === TASK_EXECUTION_MODES.IMAGE_EDIT;
};

const doesTaskUseTextModel = (taskId = selectedTaskId) => {
  const mode = getTaskExecutionConfig(taskId)?.mode;
  return mode === TASK_EXECUTION_MODES.TEXT_RESULT || mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
};

const doesTaskAllowUserPrompt = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.userPrompt !== TASK_INPUT_RULES.DISABLED
);

const taskRequiresUserPrompt = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.userPrompt === TASK_INPUT_RULES.REQUIRED
);

const doesTaskAllowImageInput = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.imageInput !== TASK_INPUT_RULES.DISABLED
);

const taskRequiresImageInput = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.imageInput === TASK_INPUT_RULES.REQUIRED
);

const taskUsesDirectImageModel = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.mode === TASK_EXECUTION_MODES.IMAGE_DIRECT
);

const taskUsesImagePromptPipeline = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.mode === TASK_EXECUTION_MODES.IMAGE_PROMPT
);

const getTaskMaskMode = (taskId = selectedTaskId) => (
  getTaskExecutionConfig(taskId)?.maskMode ?? TASK_MASK_MODES.DISABLED
);

const getTaskConfigValidationMessage = (taskConfig = getActiveTaskConfig()) => {
  if(!taskConfig) {
    return "No runnable AI tasks are configured. Open Task Editor to add a task or reset the shipped presets.";
  }

  const {mode, resultType, maskMode} = taskConfig.execution;
  const isImageResultType = resultType === TASK_RESULT_TYPES.IMAGE || resultType === TASK_RESULT_TYPES.IMAGE_SILENT;

  if(mode === TASK_EXECUTION_MODES.TEXT_RESULT && isImageResultType) {
    return `Task \"${taskConfig.name}\" uses an image result with ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.TEXT_RESULT)}. Use ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_PROMPT)} or ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)} instead.`;
  }

  if(mode === TASK_EXECUTION_MODES.IMAGE_PROMPT && !isImageResultType) {
    return `Task \"${taskConfig.name}\" must use an image result when ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_PROMPT)} is selected.`;
  }

  if(mode === TASK_EXECUTION_MODES.IMAGE_DIRECT && !isImageResultType) {
    return `Task \"${taskConfig.name}\" must use an image result when ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)} is selected.`;
  }

  if(mode === TASK_EXECUTION_MODES.IMAGE_DIRECT && taskConfig.execution.imageInput !== TASK_INPUT_RULES.DISABLED) {
    return `Task \"${taskConfig.name}\" cannot send a canvas image when ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT)} is selected.`;
  }

  if(mode === TASK_EXECUTION_MODES.IMAGE_EDIT && resultType !== TASK_RESULT_TYPES.IMAGE) {
    return `Task \"${taskConfig.name}\" must use the image result when ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_EDIT)} is selected.`;
  }

  if(mode !== TASK_EXECUTION_MODES.IMAGE_EDIT && maskMode !== TASK_MASK_MODES.DISABLED) {
    return `Task \"${taskConfig.name}\" can only enable mask mode when ${getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_EDIT)} is selected.`;
  }

  return "";
};

const getConfiguredTextMaxTokens = () => {
  const scriptOverride = parsePositiveInteger(selectedMaxTokens);
  if(scriptOverride) {
    return scriptOverride;
  }

  const pluginDefault = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
  return pluginDefault;
};

const getProviderProfiles = () => (
  aiSettings.providerProfiles ?? {}
);

const getTextModelConfigs = () => (
  aiSettings.textModels ?? {}
);

const getImageModelConfigs = () => (
  aiSettings.imageModels ?? {}
);

const hasConfiguredProviderApiKey = (providerId) => (
  Boolean(getProviderProfiles()[providerId]?.hasApiKey)
);

const getConfiguredModelIdsForKind = (kind) => {
  const configs = kind === "text"
    ? getTextModelConfigs()
    : getImageModelConfigs();

  return Object.keys(configs)
    .filter(modelId => hasConfiguredProviderApiKey(configs[modelId]?.providerId))
    .sort((left, right) => left.localeCompare(right));
};

const getMissingModelConfigurationMessage = (kind) => {
  if(kind === "text") {
    return "No text or multimodal models are ready to use. Add an API key to a provider profile and assign at least one text model in Excalidraw AI settings.";
  }

  return "No image models are ready to use. Add an API key to a provider profile and assign at least one image model in Excalidraw AI settings.";
};

const getConfiguredTextModel = () => (
  ((doesTaskAllowImageInput() && imageDataURL) ? aiSettings.defaultMultimodalTextModel : aiSettings.defaultTextModel)
  || aiSettings.defaultTextModel
  || aiSettings.defaultMultimodalTextModel
  || getConfiguredModelIdsForKind("text")[0]
  || ""
);

const getConfiguredImageModel = () => (
  aiSettings.defaultImageModel
  || getConfiguredModelIdsForKind("image")[0]
  || ""
);

const getModelConfigId = (configs, modelId) => {
  if(configs[modelId]) {
    return modelId;
  }
  return Object.keys(configs).find(configId => configs[configId]?.model === modelId) ?? "";
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
  if(configuredModels.length > 0) {
    return configuredModels;
  }
  return [];
};

const getAvailableImageModels = () => {
  const configuredModels = getConfiguredModelIdsForKind("image");
  if(configuredModels.length > 0) {
    return configuredModels;
  }
  return [];
};

const getValidSizesForModel = (model) => {
  if(!model) {
    return [];
  }
  const configuredSizes = getImageModelConfig(model)?.supportedSizes
    ?.map(size => size?.trim())
    .filter(Boolean);
  if(configuredSizes?.length) {
    return configuredSizes;
  }
  return ["1024x1024"];
};

const parseImageSizeDimensions = (size) => {
  const match = String(size ?? "").trim().match(/^(\d+)x(\d+)$/i);
  if(!match) {
    return null;
  }
  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if(Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
    return null;
  }
  return {width, height};
};

const greatestCommonDivisor = (a, b) => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while(y !== 0) {
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
  "21:9",
].map((label) => {
  const [width, height] = label.split(":").map((value) => parseInt(value, 10));
  return {
    label,
    ratio: width/height,
  };
});

const ASPECT_RATIO_LABEL_RELATIVE_EPSILON = 0.02;

const getCanonicalAspectRatioLabel = (width, height) => {
  const ratio = width/height;
  const nearest = CANONICAL_ASPECT_RATIOS
    .map((candidate) => ({
      ...candidate,
      delta: Math.abs(candidate.ratio - ratio),
    }))
    .sort((left, right) => left.delta - right.delta)[0];

  if(
    nearest &&
    nearest.delta/Math.max(nearest.ratio, Number.EPSILON)
      <= ASPECT_RATIO_LABEL_RELATIVE_EPSILON
  ) {
    return nearest.label;
  }

  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width/divisor)}:${Math.round(height/divisor)}`;
};

const getAspectRatioLabelFromDimensions = (width, height) => {
  return getCanonicalAspectRatioLabel(width, height);
};

const getImageSizeDropdownOptions = (sizes = []) => {
  return sizes
    .map((size) => {
      const dimensions = parseImageSizeDimensions(size);
      if(!dimensions) {
        return {
          value: size,
          label: String(size ?? ""),
          ratioOrder: Number.POSITIVE_INFINITY,
          pixels: Number.POSITIVE_INFINITY,
          width: Number.POSITIVE_INFINITY,
          height: Number.POSITIVE_INFINITY,
        };
      }

      const ratioLabel = getAspectRatioLabelFromDimensions(dimensions.width, dimensions.height);
      return {
        value: size,
        label: `(${ratioLabel}) ${dimensions.width}x${dimensions.height}`,
        ratioOrder: dimensions.width/dimensions.height,
        pixels: dimensions.width * dimensions.height,
        width: dimensions.width,
        height: dimensions.height,
      };
    })
    .sort((left, right) => {
      if(left.ratioOrder !== right.ratioOrder) {
        return left.ratioOrder - right.ratioOrder;
      }
      if(left.pixels !== right.pixels) {
        return left.pixels - right.pixels;
      }
      if(left.width !== right.width) {
        return left.width - right.width;
      }
      if(left.height !== right.height) {
        return left.height - right.height;
      }
      return String(left.value).localeCompare(String(right.value));
    });
};

const getResolvedTextModelSelection = (requestedModelId = selectedTextModel) => {
  const availableModels = getAvailableTextModels();
  const requestedConfigId = getTextModelConfigId(requestedModelId);
  const configuredDefaultId = getTextModelConfigId(getConfiguredTextModel());
  const resolvedModelId = [requestedConfigId, configuredDefaultId, availableModels[0], requestedModelId]
    .find(modelId => modelId && availableModels.includes(modelId))
    || "";
  const modelConfig = getTextModelConfig(resolvedModelId);
  const providerProfiles = getProviderProfiles();
  const providerId = modelConfig?.providerId ?? Object.keys(providerProfiles)[0] ?? "";
  const providerProfile = providerProfiles[providerId] ?? null;

  return {
    modelId: resolvedModelId,
    modelConfig,
    providerId,
    providerProfile,
    requestConfig: {
      textModelId: resolvedModelId,
    },
  };
};

const getResolvedImageModelSelection = (requestedModelId = selectedImageModel) => {
  const availableModels = getAvailableImageModels();
  const requestedConfigId = getImageModelConfigId(requestedModelId);
  const configuredDefaultId = getImageModelConfigId(getConfiguredImageModel());
  const resolvedModelId = [requestedConfigId, configuredDefaultId, availableModels[0], requestedModelId]
    .find(modelId => modelId && availableModels.includes(modelId))
    || "";
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
      imageModelId: resolvedModelId,
    },
  };
};

const getTextModelValidationMessage = (modelId, {requireMultimodal = false} = {}) => {
  if(getAvailableTextModels().length === 0) {
    return getMissingModelConfigurationMessage("text");
  }
  const textSelection = getResolvedTextModelSelection(modelId);
  if(!textSelection.modelConfig) {
    return `The selected text model (${modelId || "unknown"}) isn't configured in Excalidraw AI settings.`;
  }
  if(!textSelection.providerProfile) {
    return `The provider profile (${textSelection.providerId || "unknown"}) for text model ${textSelection.modelId} is missing from Excalidraw AI settings.`;
  }
  if(!textSelection.providerProfile.hasApiKey) {
    return `The selected provider profile (${textSelection.providerId}) doesn't have an API key configured.`;
  }
  if(requireMultimodal && textSelection.modelConfig.multimodalSupport === false) {
    return `The selected text model (${textSelection.modelId}) is set to text-only. Choose a multimodal model for image analysis tasks.`;
  }
  return "";
};

const getImageModelValidationMessage = (modelId, {requirePromptTransformSupport = false, requireMaskEditSupport = false} = {}) => {
  if(getAvailableImageModels().length === 0) {
    return getMissingModelConfigurationMessage("image");
  }
  const imageSelection = getResolvedImageModelSelection(modelId);
  if(!imageSelection.modelConfig) {
    return getMissingModelConfigurationMessage("image");
  }
  if(!imageSelection.providerProfile) {
    return `The provider profile (${imageSelection.providerId || "unknown"}) for image model ${imageSelection.modelId} is missing from Excalidraw AI settings.`;
  }
  if(!imageSelection.providerProfile.hasApiKey) {
    return `The selected provider profile (${imageSelection.providerId}) doesn't have an API key configured.`;
  }
  if(requirePromptTransformSupport && imageSelection.modelConfig.supportsPromptImageTransforms === false) {
    return `The selected image model (${imageSelection.modelId}) doesn't support prompt-based transforms in Excalidraw AI settings.`;
  }
  if(requireMaskEditSupport && imageSelection.modelConfig.supportsMaskImageEdits === false) {
    return `The selected image model (${imageSelection.modelId}) doesn't support mask-based edits in Excalidraw AI settings.`;
  }
  return "";
};

const getImageRequestErrorMessage = (result, modelId) => {
  const baseMessage = result?.json?.error?.message ?? "The image request failed.";
  const errorContext = result?.json?.error;
  const imageSelection = getResolvedImageModelSelection(modelId);
  const contextParts = [];
  if(errorContext?.provider) {
    contextParts.push(`provider=${errorContext.provider}`);
  }
  if(errorContext?.status) {
    contextParts.push(`status=${errorContext.status}`);
  }
  if(errorContext?.endpoint) {
    contextParts.push(`endpoint=${errorContext.endpoint}`);
  }
  if(errorContext?.imageRequest?.model) {
    contextParts.push(`model=${errorContext.imageRequest.model}`);
  }
  if(errorContext?.imageRequest?.size) {
    contextParts.push(`size=${errorContext.imageRequest.size}`);
  }
  if(errorContext?.imageRequest?.mode) {
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
  activeImageSelection,
}) => {
  if(usesTextModel) {
    const textValidationMessage = getTextModelValidationMessage(activeTextSelection.modelId, {
      requireMultimodal: requiresMultimodalText,
    });
    if(textValidationMessage) {
      return textValidationMessage;
    }
  }

  if(isImageGenRequest || isImageEditRequest) {
    return getImageModelValidationMessage(activeImageSelection.modelId, {
      requirePromptTransformSupport: requiresPromptTransformSupport,
      requireMaskEditSupport: requiresMaskEditSupport,
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

const canUseMaskEdit = () => (
  isImageEditTask()
  && getTaskMaskMode() !== TASK_MASK_MODES.DISABLED
  && activeImageModelSupportsMaskEdits()
);

const shouldUseMaskEdit = () => {
  switch(getTaskMaskMode()) {
    case TASK_MASK_MODES.REQUIRED:
      return canUseMaskEdit();
    case TASK_MASK_MODES.OPTIONAL:
      return canUseMaskEdit() && prefersMaskEdit;
    default:
      return false;
  }
};

const shouldGenerateMaskPreview = () => (
  shouldUseMaskEdit()
);

const hasAvailableTextModels = () => getAvailableTextModels().length > 0;

const hasAvailableImageModels = () => getAvailableImageModels().length > 0;

const parseImageSize = (size) => {
  const [width, height] = (size ?? "1024x1024").split("x").map(value => parseInt(value, 10));
  if(Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
    return {width: 1024, height: 1024};
  }
  return {width, height};
};

const getEditTargetBoundingBox = (bb, size) => {
  const {width: targetWidth, height: targetHeight} = parseImageSize(size);
  const targetRatio = targetWidth/targetHeight;
  const sourceRatio = bb.width/bb.height;

  let width = bb.width;
  let height = bb.height;
  let topX = bb.topX;
  let topY = bb.topY;

  if(sourceRatio > targetRatio) {
    height = width/targetRatio;
    topY = bb.topY - (height - bb.height)/2;
  } else if(sourceRatio < targetRatio) {
    width = height*targetRatio;
    topX = bb.topX - (width - bb.width)/2;
  }

  return {topX, topY, width, height, targetWidth, targetHeight};
};

const setTextAndImageModels = () => {
  const nextTextModel = getActiveTextModel();
  if(selectedTextModel !== nextTextModel) {
    dirty = true;
  }
  textModel = nextTextModel;
  selectedTextModel = textModel;

  const nextImageModel = getActiveImageModel();
  if(selectedImageModel !== nextImageModel) {
    dirty = true;
  }
  imageModel = nextImageModel;
  selectedImageModel = imageModel;
  validSizes = imageModel ? getValidSizesForModel(imageModel) : [];
  if(imageModel && !validSizes.includes(imageSize)) {
    imageSize = validSizes[0] ?? "1024x1024";
    dirty = true;
  }
}
setTextAndImageModels();

// --------------------------------------
// Generate Image Blob From Selected Excalidraw Elements
// --------------------------------------
const calculateImageScale = (elements) => {
  const bb = ea.getBoundingBox(elements);
  const size = (bb.width*bb.height);
  const minRatio = Math.sqrt(360000/size);
  const maxRatio = Math.sqrt(size/16000000);
  return minRatio > 1 
    ? minRatio
    : (
        maxRatio > 1 
        ? 1/maxRatio
        : 1
      );
}

const createMask = async (dataURL) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // If opaque (alpha > 0), make it transparent
        if (data[i + 3] > 0) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        } else if (data[i + 3] === 0) {
          // If fully transparent, make it red
          data[i] = 255; // Red
          data[i + 1] = 0; // Green
          data[i + 2] = 0; // Blue
          data[i + 3] = 255; // make it opaque
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const maskDataURL = canvas.toDataURL();

      resolve(maskDataURL);
    };

    img.onerror = error => {
      reject(error);
    };

    img.src = dataURL;
  });
}

// For image edits, the selected content is padded to the requested output aspect ratio
// so the exported image and mask match the requested model size.
const generateCanvasDataURL = async (view, targetImageEdit=false) => {
  let PADDING = 5;
  await view.forceSave(true); //to ensure recently embedded PNG and other images are saved to file
  const viewElements = ea.getViewSelectedElements();
  if(viewElements.length === 0) {
    return {imageDataURL: null, maskDataURL: null} ;
  }
  ea.copyViewElementsToEAforEditing(viewElements, true); //copying the images objects over to EA for PNG generation
  
  let maskDataURL;
  const loader = ea.getEmbeddedFilesLoader(false);
  let scale = calculateImageScale(ea.getElements());
  const bb = ea.getBoundingBox(viewElements);
  if(ea.getElements()
    .filter(el=>el.type==="image")
    .some(el=>Math.round(el.width) === Math.round(bb.width) && Math.round(el.height) === Math.round(bb.height))
  ) { PADDING = 0; }
  
  let exportSettings = {withBackground: true, withTheme: true};
  
  if(targetImageEdit) {
    PADDING = 0;  
    const strokeColor = ea.style.strokeColor;
    const backgroundColor = ea.style.backgroundColor;
    ea.style.backgroundColor = "transparent";
    ea.style.strokeColor = "transparent";
    const targetBounds = getEditTargetBoundingBox(bb, imageSize);
    const rectID = ea.addRect(targetBounds.topX, targetBounds.topY, targetBounds.width, targetBounds.height);
    const rect = ea.getElement(rectID);
    ea.style.strokeColor = strokeColor;
    ea.style.backgroundColor = backgroundColor;
    ea.getElements().filter(el=>el.type === "image").forEach(el=>{el.isDeleted = true});

    scale = targetBounds.targetWidth/rect.width;
    exportSettings = {withBackground: false, withTheme: true};
    maskDataURL= await ea.createPNGBase64(
      null, scale, exportSettings, loader, "light", PADDING
    );
    maskDataURL = await createMask(maskDataURL)
    ea.getElements().filter(el=>el.type === "image").forEach(el=>{el.isDeleted = false});
    ea.getElements().filter(el=>el.type !== "image" && el.id !== rectID).forEach(el=>{el.isDeleted = true});
  }

  const imageDataURL = await ea.createPNGBase64(
    null, scale, exportSettings, loader, "light", PADDING
  );
  ea.clear();
  return {imageDataURL, maskDataURL};
}

({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));

// --------------------------------------
// Support functions - embeddable spinner and error
// --------------------------------------
const spinner = await ea.convertStringToDataURL(`
  <html><head><style>
    html, body {width: 100%; height: 100%; color: ${ea.getExcalidrawAPI().getAppState().theme === "dark" ? "white" : "black"};}
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
    <div>Generating...</div>
  </body></html>`);

  const errorMessage = async (spinnerID, message) => {
    const error = "Something went wrong! Check developer console for more.";
    const details = message ? `<p>${message}</p>` : "";
    const errorDataURL = await ea.convertStringToDataURL(`
      <html><head><style>
        html, body {height: 100%;}
        body {display: flex; flex-direction: column; align-items: center; justify-content: center; color: red;}
        h1, h3 {margin-top: 0;margin-bottom: 0.5rem;}
      </style></head><body>
        <h1>Error!</h1>
        <h3>${error}</h3>${details}
      </body></html>`);
    new Notice (error);
    ea.getElement(spinnerID).link = errorDataURL;
    ea.addElementsToView(false,true);
  }

// --------------------------------------
// Utility to write Mermaid to dialog
// --------------------------------------
const EDITOR_LS_KEYS = {
  OAI_API_KEY: "excalidraw-oai-api-key",
  MERMAID_TO_EXCALIDRAW: "mermaid-to-excalidraw",
  PUBLISH_LIBRARY: "publish-library-data",
};

const setMermaidDataToStorage = (mermaidDefinition) => {
  try {
    window.localStorage.setItem(
      EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW,
      JSON.stringify(mermaidDefinition)
    );
    return true;
  } catch (error) {
    console.warn(`localStorage.setItem error: ${error.message}`);
    return false;
  }
};

const getGeneratedImageSource = (result) => {
  return result?.firstImage?.dataURL
    || result?.firstImage?.url
    || result?.images?.[0]?.dataURL
    || result?.images?.[0]?.url
    || null;
};

const getResultFinishReason = (result) => {
  const finishReason = result?.json?.choices?.[0]?.finish_reason;
  return typeof finishReason === "string" ? finishReason : "";
};

const isMaxTokenFinishReason = (finishReason) => {
  const normalized = (finishReason ?? "").trim().toLowerCase();
  return normalized === "max_tokens" || normalized === "max_tokens_exceeded" || normalized === "length";
};

const extractStructuredContent = (rawContent, blocktype) => {
  const contentText = (rawContent ?? "").trim();
  if(!contentText) {
    return "";
  }

  const codeBlocks = ea.extractCodeBlocks(contentText);
  const matchingBlock = codeBlocks.find(block => (block.type ?? "").toLowerCase() === blocktype)
    || (blocktype === "svg" ? codeBlocks.find(block => (block.type ?? "").toLowerCase() === "html") : null)
    || codeBlocks[0];

  if(matchingBlock?.data) {
    return matchingBlock.data;
  }

  if(blocktype === "html") {
    const doctypeIndex = contentText.indexOf("<!DOCTYPE html>");
    const htmlOpenIndex = contentText.indexOf("<html");
    const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlOpenIndex;
    const endIndex = contentText.lastIndexOf("</html>");
    if(startIndex >= 0 && endIndex >= 0) {
      return contentText.slice(startIndex, endIndex + "</html>".length);
    }
  }

  if(blocktype === "mermaid" && contentText.startsWith("mermaid")) {
    return contentText.replace(/^mermaid/, "").trim();
  }

  if(blocktype === "mindmap") {
    return contentText;
  }

  return "";
};

// --------------------------------------
// Submit Prompt
// --------------------------------------
const generateImage = async(text, spinnerID, bb, silent=false) => {
  const validationMessage = getImageModelValidationMessage(selectedImageModel);
  if(validationMessage) {
    new Notice(validationMessage, 8000);
    await errorMessage(spinnerID, validationMessage);
    return;
  }

  const imageSelection = getResolvedImageModelSelection(selectedImageModel);
  const result = await ea.generateAIImage({
    ...imageSelection.requestConfig,
    text,
    imageGenerationProperties: {
      size: imageSize, 
      //quality: "standard", //not supported by dall-e-2
      n:1,
    },
  });

  const imageSource = getGeneratedImageSource(result);
  
  if(!imageSource) {
    await errorMessage(spinnerID, getImageRequestErrorMessage(result, imageSelection.modelId));
    return;
  }
  
  const spinner = ea.getElement(spinnerID)
  spinner.isDeleted = true;
  const imageID = await ea.addImage(spinner.x, spinner.y, imageSource);
  const imageEl = ea.getElement(imageID);
  const revisedPrompt = result.revisedPrompt;
  if(revisedPrompt && !silent) {
    ea.style.fontSize = 16;
    const rectID = ea.addText(imageEl.x+15, imageEl.y + imageEl.height + 50, revisedPrompt, {
      width: imageEl.width-30,
      textAlign: "center",
      textVerticalAlign: "top",
      box: true,
    })
    ea.getElement(rectID).strokeColor = "transparent";
    ea.getElement(rectID).backgroundColor = "transparent";
    ea.addToGroup(ea.getElements().filter(el=>el.id !== spinnerID).map(el=>el.id));
  }
  
  await ea.addElementsToView(false, true, true);
  if(silent) return;

}

const run = async (text) => {
  const taskConfig = getActiveTaskConfig();
  const taskConfigValidationMessage = getTaskConfigValidationMessage(taskConfig);
  if(taskConfigValidationMessage) {
    new Notice(taskConfigValidationMessage, 8000);
    return;
  }

  const trimmedText = String(text ?? "").trim();
  const allowsTextInput = doesTaskAllowUserPrompt(taskConfig.id);
  const allowsImageInput = doesTaskAllowImageInput(taskConfig.id);
  const hasAllowedText = allowsTextInput && Boolean(trimmedText);
  const hasAllowedImage = allowsImageInput && Boolean(imageDataURL);

  if(!hasAllowedText && !hasAllowedImage) {
    const emptyInputMessage = allowsImageInput && !allowsTextInput
      ? "Select content before running ExcaliAI."
      : allowsTextInput && !allowsImageInput
        ? "Enter a prompt before running ExcaliAI."
        : "Enter a prompt or select content before running ExcaliAI.";
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
    activeImageSelection,
  });

  if(validationMessage) {
    new Notice(validationMessage, 8000);
    return;
  }

  if(taskRequiresUserPrompt(taskConfig.id) && !trimmedText) {
    new Notice(isImageEditRequest
      ? "Enter instructions for how the image should be changed."
      : "Enter a prompt before running ExcaliAI.");
    return;
  }

  if(taskRequiresImageInput(taskConfig.id) && !imageDataURL) {
    new Notice(isImageEditRequest ? "Select an image." : "Select canvas content before running this task.");
    return;
  }

  if(isMaskEditRequest && !maskDataURL) {
    new Notice("Select or create a mask.");
    return;
  }
  
  //place spinner next to selected elements
  const bb = ea.getBoundingBox(ea.getViewSelectedElements()); 
  const spinnerID = ea.addEmbeddable(bb.topX+bb.width+100,bb.topY-(720-bb.height)/2,550,720,spinner);
  
  let isEACompleted = false;
  setTimeout(async()=>{
    await ea.addElementsToView(false,true);
    ea.clear();
    const embeddable = ea.getViewElements().filter(el=>el.id===spinnerID);
    ea.copyViewElementsToEAforEditing(embeddable);
    const els = ea.getViewSelectedElements();
    ea.viewZoomToElements(false, els.concat(embeddable));
    isEACompleted = true;
  });

  if(taskUsesDirectImageModel(taskConfig.id)) {
    await generateImage(trimmedText,spinnerID,bb,outputType.blocktype === TASK_RESULT_TYPES.IMAGE_SILENT);
    return;
  }

  let result;
  let requestTextResult = null;
  if(isImageEditRequest) {
    result = isMaskEditRequest
      ? await ea.maskEditAIImage({
          ...activeImageSelection.requestConfig,
          image: {url: imageDataURL},
          ...(trimmedText ? {text: trimmedText} : {}),
          imageGenerationProperties: {
            size: imageSize,
            n: 1,
            mask: maskDataURL,
          },
        })
      : await ea.transformAIImage({
          ...activeImageSelection.requestConfig,
          image: {url: imageDataURL},
          ...(trimmedText ? {text: trimmedText} : {}),
          imageGenerationProperties: {
            size: imageSize,
            n: 1,
          },
        });
  } else {
    requestTextResult = async () => {
      const maxTokens = getConfiguredTextMaxTokens();
      const textRequestObject = {
        ...activeTextSelection.requestConfig,
        ...(sendsCanvasImage ? {image: {url: imageDataURL}} : {}),
        ...(trimmedText ? {text: trimmedText} : {}),
        ...(taskConfig.systemPrompt ? {systemPrompt: taskConfig.systemPrompt} : {}),
        ...(outputType.instruction ? {instruction: outputType.instruction} : {}),
        ...(maxTokens ? {maxTokens} : {}),
      };

      return sendsCanvasImage
        ? await ea.analyzeAIImage(textRequestObject)
        : await ea.generateAIText(textRequestObject);
    };

    result = await requestTextResult();
  }

  let counter = 0
  while(!isEACompleted && counter++<10) sleep(50);
  if(!isEACompleted) {
    await errorMessage(spinnerID, "Unexpected ExcalidrawAutomate error.");
    return;
  }

  if(isImageEditRequest) {   
    const imageSource = getGeneratedImageSource(result);
    if(!imageSource) {
      await errorMessage(spinnerID, getImageRequestErrorMessage(result, activeImageSelection.modelId));
      return;
    }
    
    const spinner = ea.getElement(spinnerID)
    spinner.isDeleted = true;
    const imageID = await ea.addImage(spinner.x, spinner.y, imageSource);    
    await ea.addElementsToView(false, true, true);
    return;
  }

  if(result?.json?.error) {
    await errorMessage(spinnerID, result?.json?.error?.message);
    return;
  }

  //exctract codeblock and display result
  let content = extractStructuredContent(result.content, outputType.blocktype);

  if(!content) {
    const errorDetails = outputType.blocktype === TASK_RESULT_TYPES.HTML && isMaxTokenFinishReason(getResultFinishReason(result))
      ? "The model hit the token limit before it finished the HTML output. Increase 'Text max token override' in ExcaliAI or raise the default AI response token limit in plugin settings."
      : undefined;
    await errorMessage(spinnerID, errorDetails);
    return;
  }

  if(taskUsesImagePromptPipeline(taskConfig.id)) {
    await generateImage(content,spinnerID,bb,outputType.blocktype === TASK_RESULT_TYPES.IMAGE_SILENT);
    return;
  }
  
  switch(outputType.blocktype) {
    case "html":
      ea.getElement(spinnerID).link = await ea.convertStringToDataURL(content);
      ea.addElementsToView(false,true);
      break;
    case "mindmap": {
      const mmb = window?.MindMapBuilderAPI;
      if(!mmb?.setView || !mmb?.importMarkdown) {
        await errorMessage(spinnerID, "MindMap Builder is not available.");
        return;
      }

      const setViewResult = mmb.setView(ea.targetView);
      if(!setViewResult?.ok) {
        await errorMessage(spinnerID, setViewResult?.error?.message || "Could not connect to MindMap Builder.");
        return;
      }

      const importResult = await mmb.importMarkdown({markdown: content});
      if(!importResult?.ok) {
        await errorMessage(spinnerID, importResult?.error?.message || "Could not create the mind map.");
        return;
      }

      ea.getElement(spinnerID).isDeleted = true;
      await ea.addElementsToView(false, true, true);
      new Notice("Mind map created in MindMap Builder.", 8000);
      break;
    }
    case "svg":
      ea.getElement(spinnerID).isDeleted = true;
      ea.importSVG(content);
      ea.addToGroup(ea.getElements().map(el=>el.id));
      if(ea.getViewSelectedElements().length>0) {
        ea.targetView.currentPosition = {x: bb.topX+bb.width+100, y: bb.topY};
      }
      ea.addElementsToView(true, false);
      break;
    case "mermaid":
      if(content.startsWith("mermaid")) {
        content = content.replace(/^mermaid/,"").trim();
      }

      try {
        result = await ea.addMermaid(content);
        if(typeof result === "string") {
          await errorMessage(spinnerID, "Open [More Tools > Mermaid to Excalidraw] to review and fix the generated Mermaid script.<br><br>" + result);
          return;
        }
      } catch (e) {
        ea.addText(0,0,content);
      }
      ea.getElement(spinnerID).isDeleted = true;
      ea.targetView.currentPosition = {x: bb.topX+bb.width+100, y: bb.topY-bb.height};
      await ea.addElementsToView(true, false);
      setMermaidDataToStorage(content);
      new Notice("Open More Tools > Mermaid to Excalidraw to review or edit the generated diagram.",8000);
      break;
  }
}

// --------------------------------------
// User Interface
// --------------------------------------
let previewDiv;

const createUniqueTaskId = (candidateValue, taskConfigs, currentTaskId = "") => {
  const existingTaskIds = new Set(
    taskConfigs
      .filter(taskConfig => taskConfig.id !== currentTaskId)
      .map(taskConfig => taskConfig.id),
  );
  const baseId = createTaskIdFromName(candidateValue) || `task-${taskConfigs.length + 1}`;
  let nextId = baseId;
  let duplicateCount = 2;
  while(existingTaskIds.has(nextId)) {
    nextId = `${baseId}-${duplicateCount++}`;
  }
  return nextId;
};

const createBlankTaskConfig = (taskConfigs = []) => {
  const name = `New Task ${taskConfigs.length + 1}`;
  return normalizeTaskConfig({
    id: createUniqueTaskId(name, taskConfigs),
    name,
    help: "Describe what this task does.",
    systemPrompt: "",
    outputInstruction: getDefaultOutputInstruction(TASK_RESULT_TYPES.HTML),
    execution: {
      mode: TASK_EXECUTION_MODES.TEXT_RESULT,
      resultType: TASK_RESULT_TYPES.HTML,
      userPrompt: TASK_INPUT_RULES.OPTIONAL,
      imageInput: TASK_INPUT_RULES.OPTIONAL,
      maskMode: TASK_MASK_MODES.DISABLED,
      requiresApi: TASK_RUNTIME_APIS.NONE,
    },
  }, taskConfigs.length);
};

const syncStateToSettings = () => {
  settings.config.tasks = normalizeTaskConfigs(settings.config?.tasks, {fallbackToDefaults: false});
  const nextSelectedTaskId = getVisibleTaskConfigById(selectedTaskId)?.id ?? getVisibleTaskConfigs()[0]?.id ?? "";
  settings.state = normalizeState({
    selectedTaskId: nextSelectedTaskId,
    userPrompt,
    maskEdit: prefersMaskEdit,
    textModel: selectedTextModel,
    imageModel: selectedImageModel,
    maxTokens: selectedMaxTokens,
    imageSize,
  }, settings.config.tasks);

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
  await ea.setScriptSettings(settings);
  dirty = false;
};

const addPreviewImage = () => {
  if(!previewDiv) return;
  const activeTask = getActiveTaskConfig();
  previewDiv.empty();

  if(!imageDataURL) {
    return;
  }

  previewDiv.createEl("img",{
    cls: "excali-ai-preview-img",
    attr: { src: imageDataURL }
  });

  if(activeTask && !doesTaskAllowImageInput(activeTask.id)) {
    previewDiv.createEl("p", {
      text: "This task ignores the current canvas selection and uses only the text prompt.",
      cls: "excali-ai-help-text"
    });
    return;
  }

  if(isImageEditTask() && !shouldUseMaskEdit()) {
    previewDiv.createEl("p", {
      text: activeImageModelSupportsMaskEdits()
        ? "Mask edit is off. Non-image elements are flattened into the preview image and sent as a prompt-based transform."
        : "This model doesn't support mask edits. Non-image elements are flattened into the preview image and sent as a prompt-based transform.",
      cls: "excali-ai-help-text"
    });
    return;
  }

  if(maskDataURL) {
    previewDiv.createEl("img",{
      cls: "excali-ai-preview-img",
      attr: { src: maskDataURL }
    });
  }
}

const openTaskEditorModal = ({reopenMainModal = false} = {}) => {
  const taskModal = new ea.obsidian.Modal(app);
  taskModal.modalEl.style.width = "100%";
  taskModal.modalEl.style.maxWidth = "1100px";
  taskModal.modalEl.classList.add("excali-ai-task-editor-modal");

  let editorDirty = false;
  let refreshingEditorFields = false;
  let editableTasks = normalizeTaskConfigs(cloneJSON(getTaskConfigs()), {fallbackToDefaults: false});
  let editorTaskId = editableTasks.find(taskConfig => taskConfig.id === selectedTaskId)?.id ?? editableTasks[0]?.id ?? "";
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
    if(setting?.settingEl) {
      setting.settingEl.classList.add(className);
    }
  };

  const getEditorTask = () => editableTasks.find(taskConfig => taskConfig.id === editorTaskId) ?? null;

  const ensureEditorTaskId = () => {
    if(editableTasks.some(taskConfig => taskConfig.id === editorTaskId)) {
      return editorTaskId;
    }
    editorTaskId = editableTasks[0]?.id ?? "";
    return editorTaskId;
  };

  const refreshTaskEditorDropdown = () => {
    if(!taskSelectDropdown) return;
    ensureEditorTaskId();
    while(taskSelectDropdown.selectEl.options.length > 0) {
      taskSelectDropdown.selectEl.remove(0);
    }
    editableTasks.forEach(taskConfig => taskSelectDropdown.addOption(taskConfig.id, taskConfig.name));
    taskSelectDropdown.setDisabled(editableTasks.length === 0);
    if(editableTasks.length > 0) {
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
      maskModeSetting,
    ].forEach(setting => {
      if(setting) {
        setting.settingEl.style.display = hasTask ? "" : "none";
      }
    });

    updateExecutionModeDescription();
    updateResultTypeDescription();

    if(!taskConfig) {
      return;
    }

    const mode = taskConfig.execution.mode;
    const usesTextPipeline = mode === TASK_EXECUTION_MODES.TEXT_RESULT || mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
    const showsOutputInstruction = mode === TASK_EXECUTION_MODES.TEXT_RESULT || mode === TASK_EXECUTION_MODES.IMAGE_PROMPT;
    if(systemPromptSetting) {
      systemPromptSetting.settingEl.style.display = usesTextPipeline ? "" : "none";
    }
    if(outputInstructionSetting) {
      outputInstructionSetting.settingEl.style.display = showsOutputInstruction ? "" : "none";
    }
    if(maskModeSetting) {
      maskModeSetting.settingEl.style.display = mode === TASK_EXECUTION_MODES.IMAGE_EDIT ? "" : "none";
    }
  };

  const updateExecutionModeDescription = () => {
    if(!executionModeSetting) return;
    const taskConfig = getEditorTask();
    if(!taskConfig) {
      executionModeSetting.descEl.setText("Determines how the task runs.");
      return;
    }
    executionModeSetting.descEl.innerHTML = `Determines how the task runs.<br><span class="excali-ai-task-editor-note">${getTaskExecutionModeDescription(taskConfig.execution.mode)}</span>`;
  };

  const updateResultTypeDescription = () => {
    if(!resultTypeSetting) return;
    const taskConfig = getEditorTask();
    if(!taskConfig) {
      resultTypeSetting.descEl.setText("Controls how ExcaliAI interprets the model response.");
      return;
    }
    const runtimeRequirement = getTaskRuntimeRequirement(taskConfig);
    const runtimeText = runtimeRequirement !== TASK_RUNTIME_APIS.NONE
      ? `<br><span class="excali-ai-task-editor-accent">Requires: ${getTaskRuntimeRequirementLabel(runtimeRequirement)}</span>`
      : "";
    resultTypeSetting.descEl.innerHTML = `Controls how ExcaliAI interprets the model response.<br><span class="excali-ai-task-editor-note">${getTaskResultTypeDescription(taskConfig.execution.resultType)}</span>${runtimeText}`;
  };

  const updateTaskEditorValidation = () => {
    if(!validationEl) return;
    const taskConfig = getEditorTask();
    const validationMessage = getTaskConfigValidationMessage(taskConfig);
    if(!taskConfig) {
      validationEl.innerHTML = "<b>Validation:</b> No tasks configured. Add a task or reset the shipped presets.";
      validationEl.style.color = "var(--text-warning)";
      return;
    }
    if(validationMessage) {
      validationEl.innerHTML = `<b>Validation:</b> ${validationMessage}`;
      validationEl.style.color = "var(--text-error)";
      return;
    }
    validationEl.innerHTML = "<b>Validation:</b> Task configuration is valid.";
    validationEl.style.color = "var(--text-muted)";
  };

  const populateTaskEditorFields = () => {
    const taskConfig = getEditorTask();
    refreshingEditorFields = true;
    if(taskIdText) taskIdText.setValue(taskConfig?.id ?? "");
    if(taskNameText) taskNameText.setValue(taskConfig?.name ?? "");
    if(helpTextArea) helpTextArea.setValue(taskConfig?.help ?? "");
    if(systemPromptTextArea) systemPromptTextArea.setValue(taskConfig?.systemPrompt ?? "");
    if(outputInstructionTextArea) outputInstructionTextArea.setValue(taskConfig?.outputInstruction ?? "");
    if(executionModeDropdown) executionModeDropdown.setValue(taskConfig?.execution?.mode ?? TASK_EXECUTION_MODES.TEXT_RESULT);
    if(resultTypeDropdown) resultTypeDropdown.setValue(taskConfig?.execution?.resultType ?? TASK_RESULT_TYPES.HTML);
    if(userPromptDropdown) userPromptDropdown.setValue(taskConfig?.execution?.userPrompt ?? TASK_INPUT_RULES.OPTIONAL);
    if(imageInputDropdown) imageInputDropdown.setValue(taskConfig?.execution?.imageInput ?? TASK_INPUT_RULES.OPTIONAL);
    if(maskModeDropdown) maskModeDropdown.setValue(taskConfig?.execution?.maskMode ?? TASK_MASK_MODES.DISABLED);
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
      `,
    });
    
    const headerContainer = contentEl.createDiv({ style: "display: flex; align-items: center; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 10px;" });
    headerContainer.innerHTML = `${ea.obsidian.getIcon("bot").outerHTML} <h2 style="margin: 0;">ExcaliAI Task Editor</h2>`;
    
    contentEl.createEl("p", {text: "Tasks are stored in ExcaliAI's script settings JSON. Edit the fields below to add, remove, or change how a task runs."});

    taskHeaderSetting = new ea.obsidian.Setting(contentEl)
      .setName("Task")
      .setDesc("Select which task to edit.")
      .addDropdown(dropdown => {
        taskSelectDropdown = dropdown;
        dropdown.selectEl.style.flex = "1 1 220px";
        dropdown.selectEl.style.minWidth = "220px";
        refreshTaskEditorDropdown();
        dropdown.onChange(value => {
          if(refreshingEditorFields) return;
          editorTaskId = value;
          populateTaskEditorFields();
        });
      })
      .addButton(button => button.setButtonText(" Add task").setIcon("plus").onClick(() => {
        const nextTask = createBlankTaskConfig(editableTasks);
        nextTask.id = createUniqueTaskId(nextTask.id, editableTasks);
        editableTasks.push(nextTask);
        editorTaskId = nextTask.id;
        editorDirty = true;
        populateTaskEditorFields();
      }))
      .addButton(button => button.setButtonText(" Delete task").setIcon("trash-2").onClick(() => {
        const taskConfig = getEditorTask();
        if(!taskConfig) {
          new Notice("No task is selected.", 5000);
          return;
        }
        if(!window.confirm(`Delete the task \"${taskConfig.name}\"?`)) {
          return;
        }
        editableTasks = editableTasks.filter(candidate => candidate.id !== taskConfig.id);
        editorTaskId = editableTasks[0]?.id ?? "";
        editorDirty = true;
        populateTaskEditorFields();
      }))
      .addButton(button => button.setButtonText(" Reset defaults").setIcon("rotate-ccw").onClick(() => {
        if(!window.confirm("Reset all ExcaliAI tasks to the shipped defaults? This overwrites custom tasks.")) {
          return;
        }
        editableTasks = cloneJSON(DEFAULT_TASK_CONFIGS);
        editorTaskId = editableTasks.find(taskConfig => taskConfig.id === DEFAULT_TASK_ID)?.id ?? editableTasks[0]?.id ?? "";
        editorDirty = true;
        populateTaskEditorFields();
      }));
    addTaskEditorFieldClass(taskHeaderSetting, "excali-ai-task-editor-header");

    validationEl = contentEl.createEl("p");

    taskIdSetting = new ea.obsidian.Setting(contentEl)
      .setName("Task ID")
      .setDesc("Settings key, normalized to lowercase with dashes.")
      .addText(text => {
        taskIdText = text;
        text.inputEl.style.width = "100%";
        text.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          const nextId = createUniqueTaskId(value || taskConfig.name, editableTasks, taskConfig.id);
          taskConfig.id = nextId;
          editorTaskId = nextId;
          editorDirty = true;
          populateTaskEditorFields();
        });
      });
    addTaskEditorFieldClass(taskIdSetting);

    taskNameSetting = new ea.obsidian.Setting(contentEl)
      .setName("Task name")
      .setDesc("Shown in the ExcaliAI task picker.")
      .addText(text => {
        taskNameText = text;
        text.inputEl.style.width = "100%";
        text.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.name = value;
          editorDirty = true;
          refreshTaskEditorDropdown();
          updateTaskEditorValidation();
        });
      });
    addTaskEditorFieldClass(taskNameSetting);

    helpSetting = new ea.obsidian.Setting(contentEl)
      .setName("Task help")
      .setDesc("Explains the task in the main ExcaliAI dialog.")
      .addTextArea(text => {
        helpTextArea = text;
        text.inputEl.style.minHeight = "6em";
        text.inputEl.style.width = "100%";
        text.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.help = value;
          editorDirty = true;
        });
      });
    addTaskEditorFieldClass(helpSetting);

    systemPromptSetting = new ea.obsidian.Setting(contentEl)
      .setName("System prompt")
      .setDesc("Sent to the text model when the task uses a text-model step.")
      .addTextArea(text => {
        systemPromptTextArea = text;
        text.inputEl.style.minHeight = "10em";
        text.inputEl.style.width = "100%";
        text.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.systemPrompt = value;
          editorDirty = true;
        });
      });
    addTaskEditorFieldClass(systemPromptSetting);

    outputInstructionSetting = new ea.obsidian.Setting(contentEl)
      .setName("Output instruction")
      .setDesc("Controls the expected response format when the task uses a text-model step.")
      .addTextArea(text => {
        outputInstructionTextArea = text;
        text.inputEl.style.minHeight = "6em";
        text.inputEl.style.width = "100%";
        text.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.outputInstruction = value;
          editorDirty = true;
        });
      });
    addTaskEditorFieldClass(outputInstructionSetting);

    executionModeSetting = new ea.obsidian.Setting(contentEl)
      .setName("Execution mode")
      .setDesc("Determines how the task runs.")
      .addDropdown(dropdown => {
        executionModeDropdown = dropdown;
        dropdown.addOption(TASK_EXECUTION_MODES.TEXT_RESULT, getTaskExecutionModeLabel(TASK_EXECUTION_MODES.TEXT_RESULT));
        dropdown.addOption(TASK_EXECUTION_MODES.IMAGE_PROMPT, getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_PROMPT));
        dropdown.addOption(TASK_EXECUTION_MODES.IMAGE_DIRECT, getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_DIRECT));
        dropdown.addOption(TASK_EXECUTION_MODES.IMAGE_EDIT, getTaskExecutionModeLabel(TASK_EXECUTION_MODES.IMAGE_EDIT));
        dropdown.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.execution.mode = value;
          if(value === TASK_EXECUTION_MODES.TEXT_RESULT && (taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE || taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE_SILENT)) {
            taskConfig.execution.resultType = TASK_RESULT_TYPES.HTML;
          }
          if((value === TASK_EXECUTION_MODES.IMAGE_PROMPT || value === TASK_EXECUTION_MODES.IMAGE_DIRECT) && !(taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE || taskConfig.execution.resultType === TASK_RESULT_TYPES.IMAGE_SILENT)) {
            taskConfig.execution.resultType = TASK_RESULT_TYPES.IMAGE;
          }
          if(value === TASK_EXECUTION_MODES.IMAGE_DIRECT) {
            taskConfig.execution.imageInput = TASK_INPUT_RULES.DISABLED;
            taskConfig.execution.maskMode = TASK_MASK_MODES.DISABLED;
          }
          if(value === TASK_EXECUTION_MODES.IMAGE_EDIT) {
            taskConfig.execution.resultType = TASK_RESULT_TYPES.IMAGE;
            taskConfig.execution.imageInput = TASK_INPUT_RULES.REQUIRED;
            if(taskConfig.execution.maskMode === TASK_MASK_MODES.DISABLED) {
              taskConfig.execution.maskMode = TASK_MASK_MODES.OPTIONAL;
            }
          }
          if(value !== TASK_EXECUTION_MODES.IMAGE_EDIT) {
            taskConfig.execution.maskMode = TASK_MASK_MODES.DISABLED;
          }
          editorDirty = true;
          populateTaskEditorFields();
        });
      });
    addTaskEditorFieldClass(executionModeSetting);

    resultTypeSetting = new ea.obsidian.Setting(contentEl)
      .setName("Result type")
      .setDesc("Controls how ExcaliAI interprets the model response.")
      .addDropdown(dropdown => {
        resultTypeDropdown = dropdown;
        dropdown.addOption(TASK_RESULT_TYPES.HTML, getTaskResultTypeLabel(TASK_RESULT_TYPES.HTML));
        dropdown.addOption(TASK_RESULT_TYPES.MINDMAP, getTaskResultTypeLabel(TASK_RESULT_TYPES.MINDMAP));
        dropdown.addOption(TASK_RESULT_TYPES.MERMAID, getTaskResultTypeLabel(TASK_RESULT_TYPES.MERMAID));
        dropdown.addOption(TASK_RESULT_TYPES.SVG, getTaskResultTypeLabel(TASK_RESULT_TYPES.SVG));
        dropdown.addOption(TASK_RESULT_TYPES.IMAGE, getTaskResultTypeLabel(TASK_RESULT_TYPES.IMAGE));
        dropdown.addOption(TASK_RESULT_TYPES.IMAGE_SILENT, getTaskResultTypeLabel(TASK_RESULT_TYPES.IMAGE_SILENT));
        dropdown.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.execution.resultType = value;
          taskConfig.execution.requiresApi = getTaskResultTypeMeta(value).runtimeRequirement ?? TASK_RUNTIME_APIS.NONE;
          editorDirty = true;
          updateResultTypeDescription();
          updateTaskEditorValidation();
        });
      });
    addTaskEditorFieldClass(resultTypeSetting);

    userPromptSetting = new ea.obsidian.Setting(contentEl)
      .setName("User prompt")
      .setDesc("Controls whether the main prompt box is optional, required, or hidden for this task.")
      .addDropdown(dropdown => {
        userPromptDropdown = dropdown;
        dropdown.addOption(TASK_INPUT_RULES.OPTIONAL, "Optional");
        dropdown.addOption(TASK_INPUT_RULES.REQUIRED, "Required");
        dropdown.addOption(TASK_INPUT_RULES.DISABLED, "Disabled");
        dropdown.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.execution.userPrompt = value;
          editorDirty = true;
        });
      });
    addTaskEditorFieldClass(userPromptSetting);

    imageInputSetting = new ea.obsidian.Setting(contentEl)
      .setName("Canvas image input")
      .setDesc("Controls whether the selected canvas content is optional, required, or ignored.")
      .addDropdown(dropdown => {
        imageInputDropdown = dropdown;
        dropdown.addOption(TASK_INPUT_RULES.OPTIONAL, "Optional");
        dropdown.addOption(TASK_INPUT_RULES.REQUIRED, "Required");
        dropdown.addOption(TASK_INPUT_RULES.DISABLED, "Disabled");
        dropdown.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.execution.imageInput = value;
          editorDirty = true;
          updateTaskEditorValidation();
        });
      });
    addTaskEditorFieldClass(imageInputSetting);

    maskModeSetting = new ea.obsidian.Setting(contentEl)
      .setName("Mask mode")
      .setDesc("Available only in Edit selected image mode.")
      .addDropdown(dropdown => {
        maskModeDropdown = dropdown;
        dropdown.addOption(TASK_MASK_MODES.DISABLED, "Disabled");
        dropdown.addOption(TASK_MASK_MODES.OPTIONAL, "Optional toggle");
        dropdown.addOption(TASK_MASK_MODES.REQUIRED, "Always required");
        dropdown.onChange(value => {
          if(refreshingEditorFields) return;
          const taskConfig = getEditorTask();
          if(!taskConfig) return;
          taskConfig.execution.maskMode = value;
          editorDirty = true;
          updateTaskEditorValidation();
        });
      });
    addTaskEditorFieldClass(maskModeSetting);

    new ea.obsidian.Setting(contentEl)
      .addButton(button => button.setButtonText(" Done").setIcon("check").setCta().onClick(() => taskModal.close()));

    populateTaskEditorFields();
  };

  taskModal.onClose = async () => {
    if(editorDirty) {
      settings.config.tasks = normalizeTaskConfigs(editableTasks, {fallbackToDefaults: false});
      selectedTaskId = getVisibleTaskConfigById(editorTaskId)?.id ?? getVisibleTaskConfigs()[0]?.id ?? "";
      await saveExcaliAISettings();
    }
    if(reopenMainModal) {
      openConfigModal();
    }
  };

  taskModal.open();
};

const openConfigModal = () => {
  dirty = false;
  const configModal = new ea.FloatingModal(app);
  configModal.modalEl.classList.add("excali-ai-floating-modal");

  let openTaskEditorAfterClose = false;
  let refreshingMainFields = false;
  
  let lastSelectedElementIds = ea.getViewSelectedElements().map(e=>e.id).sort().join(",");
  let isUpdatingSelection = false;

  configModal.onOpen = async () => {
    const contentEl = configModal.contentEl;
    
    // --- CSS ---
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
    headerContainer.innerHTML = `${ea.obsidian.getIcon("bot").outerHTML} <h2>ExcaliAI</h2>`;

    const mainContainer = contentEl.createDiv({ cls: "excali-ai-main-container" });
    const leftCol = mainContainer.createDiv({ cls: "excali-ai-left-col" });
    const rightCol = mainContainer.createDiv({ cls: "excali-ai-right-col" });

    // --- WARNINGS ---
    const mmbWarning = leftCol.createDiv({ cls: "excali-ai-warning" });
    mmbWarning.innerHTML = `${ea.obsidian.getIcon("alert-triangle").outerHTML} <span><b>MindMap Builder API is not active.</b> The "Create Mindmap" task requires it to be running.</span>`;
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
      const currentSelectedElementIds = ea.getViewSelectedElements().map(e=>e.id).sort().join(",");
      if (lastSelectedElementIds !== currentSelectedElementIds) {
        isUpdatingSelection = true;
        lastSelectedElementIds = currentSelectedElementIds;
        const taskConfig = getActiveTaskConfig();
        if (taskConfig && (isImageEditTask(taskConfig.id) || doesTaskAllowImageInput(taskConfig.id))) {
          ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
          updatePreviewSection();
        }
        isUpdatingSelection = false;
      }
    };

    configModal.modalEl.addEventListener("pointerenter", checkAndUpdateSelection);
    configModal.modalEl.addEventListener("focusin", checkAndUpdateSelection);

    const refreshTaskDropdown = () => {
      if(!taskDropdown) return;
      const visibleTasks = getVisibleTaskConfigs();
      while(taskDropdown.selectEl.options.length > 0) {
        taskDropdown.selectEl.remove(0);
      }
      visibleTasks.forEach(taskConfig => taskDropdown.addOption(taskConfig.id, taskConfig.name));
      taskDropdown.setDisabled(visibleTasks.length === 0);
      if(visibleTasks.length > 0) {
        taskDropdown.setValue(selectedTaskId);
      }
    };

    const updateTextModelHelp = () => {
      if(!textModelHelpEl) return;
      const taskConfig = getActiveTaskConfig();
      if(!taskConfig) {
        textModelHelpEl.innerHTML = "<b>Text model:</b> No runnable task is selected.";
        return;
      }
      if(!doesTaskUseTextModel(taskConfig.id)) {
        textModelHelpEl.innerHTML = "<b>Text model:</b> This task does not use a text model.";
        return;
      }
      if(!hasAvailableTextModels()) {
        textModelHelpEl.innerHTML = `<b>Text model:</b> ${getMissingModelConfigurationMessage("text")}`;
        return;
      }
      const textSelection = getResolvedTextModelSelection(textModel);
      const multimodalText = textSelection.modelConfig?.multimodalSupport === false
        ? "text-only"
        : "multimodal";
      const usageText = doesTaskAllowImageInput(taskConfig.id) && imageDataURL
        ? "The selected canvas image will also be sent to this model."
        : "Only the text prompt will be sent to this model.";
      textModelHelpEl.innerHTML = `<b>Text model:</b> ${textModel}. <b>Provider:</b> ${textSelection.providerId || "unknown"}. This model is ${multimodalText}. ${usageText}`;
    };

    const updateImageModelHelp = () => {
      if(!imageModelHelpEl) return;
      const taskConfig = getActiveTaskConfig();
      if(!taskConfig) {
        imageModelHelpEl.innerHTML = "<b>Image model:</b> No runnable task is selected.";
        return;
      }
      if(!isImageGenerationTask(taskConfig.id)) {
        imageModelHelpEl.innerHTML = "<b>Image model:</b> This task does not use an image model.";
        return;
      }
      if(!hasAvailableImageModels()) {
        imageModelHelpEl.innerHTML = `<b>Image model:</b> ${getMissingModelConfigurationMessage("image")}`;
        return;
      }
      const configuredSizes = validSizes.length > 0 ? validSizes.join(", ") : DEFAULT_IMAGE_SIZE;
      const modelConfig = getImageModelConfig(imageModel);
      const transformSupportText = modelConfig?.supportsPromptImageTransforms === false
        ? "doesn't support prompt transforms"
        : "supports prompt transforms";
      const maskSupportText = modelConfig?.supportsMaskImageEdits === false
        ? "doesn't support mask edits"
        : "supports mask edits";
      const editModeText = isImageEditTask(taskConfig.id)
        ? shouldUseMaskEdit()
          ? "Mask edit is on, so non-image elements are sent as the mask."
          : activeImageModelSupportsMaskEdits()
            ? "Mask edit is off, so non-image elements are flattened into the source image."
            : "This model doesn't support mask edits, so non-image elements are flattened into the source image."
        : "";
      imageModelHelpEl.innerHTML = `<b>Image model:</b> ${imageModel}. <b>Sizes:</b> ${configuredSizes}. This model ${transformSupportText} and ${maskSupportText}. If the selected image or mask does not match the chosen aspect ratio, ExcaliAI expands the export frame to fit the target ratio instead of cropping the content. ${editModeText}`;
    };

    const updateMaskEditSetting = () => {
      if(!maskEditSetting || !maskEditToggleComponent) return;
      const taskConfig = getActiveTaskConfig();
      const maskMode = getTaskMaskMode(taskConfig?.id);
      const showMaskSetting = Boolean(taskConfig) && isImageEditTask(taskConfig.id) && maskMode !== TASK_MASK_MODES.DISABLED;
      maskEditSetting.settingEl.style.display = showMaskSetting ? "" : "none";
      if(!showMaskSetting) {
        return;
      }

      const maskEditAvailable = activeImageModelSupportsMaskEdits();
      if(maskMode === TASK_MASK_MODES.REQUIRED) {
        maskEditSetting.descEl.setText(maskEditAvailable
          ? "This task always uses mask edit."
          : "This task requires mask edit, but the selected model does not support it.");
        maskEditToggleComponent.setDisabled(true);
        maskEditToggleComponent.setValue(maskEditAvailable);
        return;
      }

      maskEditSetting.descEl.setText(maskEditAvailable
        ? "On: non-image elements become the mask. Off: non-image elements are flattened into the source image for a prompt-based transform."
        : "This model doesn't support mask edits. ExcaliAI will flatten non-image elements into the source image and use a prompt-based transform.");
      maskEditToggleComponent.setDisabled(!maskEditAvailable);
      maskEditToggleComponent.setValue(shouldUseMaskEdit());
    };

    const updateMaxTokensHelp = () => {
      if(!maxTokensHelpEl) return;
      if(!doesTaskUseTextModel()) {
        maxTokensHelpEl.innerHTML = "<b>Text max tokens:</b> This task does not use a text model.";
        return;
      }
      const scriptOverride = parsePositiveInteger(selectedMaxTokens);
      const pluginDefault = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
      const effectiveMaxTokens = getConfiguredTextMaxTokens();
      const sourceText = scriptOverride
        ? "Using the ExcaliAI override."
        : pluginDefault
          ? "Using the plugin default response token limit."
          : "Using the shared AI runtime default behavior.";
      maxTokensHelpEl.innerHTML = `<b>Text max tokens:</b> ${effectiveMaxTokens ?? "runtime default"}. ${sourceText}`;
    };

    const refreshTextModelDropdown = () => {
      if(!textModelSettingDropdown) return;
      while(textModelSettingDropdown.selectEl.options.length > 0) {
        textModelSettingDropdown.selectEl.remove(0);
      }
      getAvailableTextModels().forEach(model => textModelSettingDropdown.addOption(model, model));
      textModelSettingDropdown.setDisabled(!hasAvailableTextModels());
      if(hasAvailableTextModels()) {
        textModelSettingDropdown.setValue(textModel);
      }
    };

    const refreshImageSizeDropdown = () => {
      if(!imageSizeSettingDropdown) return;
      while(imageSizeSettingDropdown.selectEl.options.length > 0) {
        imageSizeSettingDropdown.selectEl.remove(0);
      }
      getImageSizeDropdownOptions(validSizes).forEach(({value, label}) =>
        imageSizeSettingDropdown.addOption(value, label),
      );
      imageSizeSettingDropdown.setDisabled(!hasAvailableImageModels());
      if(hasAvailableImageModels() && validSizes.length > 0) {
        imageSizeSettingDropdown.setValue(imageSize);
      }
    };

    const refreshImageModelDropdown = () => {
      if(!imageModelSettingDropdown) return;
      while(imageModelSettingDropdown.selectEl.options.length > 0) {
        imageModelSettingDropdown.selectEl.remove(0);
      }
      getAvailableImageModels().forEach(model => imageModelSettingDropdown.addOption(model, model));
      imageModelSettingDropdown.setDisabled(!hasAvailableImageModels());
      if(hasAvailableImageModels()) {
        imageModelSettingDropdown.setValue(imageModel);
      }
    };

    const updatePreviewSection = () => {
      if(!previewContainerEl) return;
      previewContainerEl.empty();
      previewContainerEl.createEl("h3", {text: "Preview", attr: { style: "margin-top: 0; margin-bottom: 10px;" } });
      previewDiv = null;

      const taskConfig = getActiveTaskConfig();
      if(!taskConfig) {
        previewContainerEl.createEl("p", {text: "No runnable task is selected.", cls: "excali-ai-help-text"});
        return;
      }

      if(imageDataURL) {
        previewDiv = previewContainerEl.createDiv({ attr: { style: "text-align: center;" } });
        addPreviewImage();
        return;
      }

      if(taskRequiresImageInput(taskConfig.id)) {
        previewContainerEl.createEl("span", {text: "Select content on the canvas. This task requires an image input.", cls: "excali-ai-help-text"});
        return;
      }
      if(doesTaskAllowImageInput(taskConfig.id)) {
        previewContainerEl.createEl("span", {text: "Nothing is selected, so only the text prompt will be sent to the configured text model.", cls: "excali-ai-help-text"});
        return;
      }
      previewContainerEl.createEl("span", {text: "This task uses only the text prompt and ignores canvas selection.", cls: "excali-ai-help-text"});
    };

    const updateHelpText = () => {
      const taskConfig = getActiveTaskConfig();
      helpEl.innerHTML = taskConfig
        ? `<b>How it works:</b> ${taskConfig.help}`
        : "<b>How it works:</b> No runnable task is selected.";
      const validationMessage = getTaskConfigValidationMessage(taskConfig);
      taskValidationEl.style.display = validationMessage ? "" : "none";
      taskValidationEl.innerHTML = validationMessage ? `<b>Task config:</b> ${validationMessage}` : "";
      updateTextModelHelp();
      updateImageModelHelp();
      updateMaxTokensHelp();
      
      if(mmbWarning) {
        const isMmbTask = taskConfig?.execution?.requiresApi === TASK_RUNTIME_APIS.MINDMAP_BUILDER;
        mmbWarning.style.display = (isMmbTask && !window?.MindMapBuilderAPI) ? "flex" : "none";
      }
    };

    const updateTaskSpecificControls = () => {
      const taskConfig = getActiveTaskConfig();
      const taskId = taskConfig?.id ?? "";
      const usesTextModel = Boolean(taskConfig) && doesTaskUseTextModel(taskId);
      const usesImageModel = Boolean(taskConfig) && isImageGenerationTask(taskId);
      const showsSystemPrompt = usesTextModel && taskConfig.systemPrompt !== null;
      const showsUserPrompt = Boolean(taskConfig) && doesTaskAllowUserPrompt(taskId);

      if(systemPromptDiv) {
        systemPromptDiv.style.display = showsSystemPrompt ? "" : "none";
      }
      if(systemPromptTextArea) {
        refreshingMainFields = true;
        systemPromptTextArea.setValue(taskConfig?.systemPrompt ?? "");
        refreshingMainFields = false;
      }
      if(promptHeadingEl) {
        promptHeadingEl.style.display = showsUserPrompt ? "" : "none";
      }
      if(promptSetting) {
        promptSetting.settingEl.style.display = showsUserPrompt ? "" : "none";
      }
      if(textModelSetting) {
        textModelSetting.settingEl.style.display = usesTextModel ? "" : "none";
      }
      if(maxTokensSetting) {
        maxTokensSetting.settingEl.style.display = usesTextModel ? "" : "none";
      }
      if(imageModelSetting) {
        imageModelSetting.settingEl.style.display = usesImageModel ? "" : "none";
      }
      if(imageSizeSetting) {
        imageSizeSetting.settingEl.style.display = usesImageModel ? "" : "none";
      }
      updateMaskEditSetting();
      updateHelpText();
      updatePreviewSection();
    };

    const taskSetting = new ea.obsidian.Setting(leftCol)
      .setName("Task")
      .setDesc("Select the task you want to run.")
      .addDropdown(dropdown => {
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
          if(previousWasImageEdit !== nextWasImageEdit || previousMaskMode !== nextMaskMode) {
            ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
          }
          setTextAndImageModels();
          refreshTaskDropdown();
          refreshTextModelDropdown();
          refreshImageModelDropdown();
          refreshImageSizeDropdown();
          updateTaskSpecificControls();
        });
      })
      .addButton(button => button.setButtonText(" Edit tasks").setIcon("settings").onClick(() => {
        openTaskEditorAfterClose = true;
        configModal.close();
      }));

    taskSetting.settingEl.classList.add("excali-ai-task-setting");

    helpEl = leftCol.createEl("p", { cls: "excali-ai-help-text" });
    taskValidationEl = leftCol.createEl("p", { cls: "excali-ai-validation-text" });

    promptHeadingEl = leftCol.createEl("h4", {text: "Prompt", attr: { style: "margin-bottom: 5px; margin-top: 10px;" } });
    promptSetting = new ea.obsidian.Setting(leftCol)
      .addTextArea(text => {
        text.inputEl.style.minHeight = "8em";
        text.inputEl.style.width = "100%";
        text.setValue(userPrompt);
        text.onChange(value => {
          userPrompt = value;
          dirty = true;
        });
      });
    promptSetting.nameEl.style.display = "none";
    promptSetting.descEl.style.display = "none";
    promptSetting.infoEl.style.display = "none";
    promptSetting.controlEl.style.width = "100%";

    // ADVANCED SETTINGS
    const advancedDetails = leftCol.createEl("details", { cls: "excali-ai-advanced-details" });
    const advancedSummary = advancedDetails.createEl("summary", { cls: "excali-ai-advanced-summary" });
    advancedSummary.innerHTML = `${ea.obsidian.getIcon("chevron-right").outerHTML} <span>Advanced Settings</span>`;
    const advancedContent = advancedDetails.createDiv({ cls: "excali-ai-advanced-content" });

    systemPromptDiv = advancedContent.createDiv();
    systemPromptDiv.createEl("h4", {text: "System prompt", attr: {style: "margin-bottom: 5px;"}});
    systemPromptDiv.createEl("span", {text: "Advanced: change this only if you know why.", cls: "excali-ai-help-text"});
    const systemPromptSetting = new ea.obsidian.Setting(systemPromptDiv)
      .addTextArea(text => {
        systemPromptTextArea = text;
        text.inputEl.style.minHeight = "6em";
        text.inputEl.style.width = "100%";
        text.setValue(getActiveTaskConfig()?.systemPrompt ?? "");
        text.onChange(value => {
          if(refreshingMainFields) return;
          const taskConfig = getTaskConfigById(selectedTaskId);
          if(!taskConfig) return;
          taskConfig.systemPrompt = value;
          dirty = true;
          updateHelpText();
        });
      });
    systemPromptSetting.nameEl.style.display = "none";
    systemPromptSetting.descEl.style.display = "none";
    systemPromptSetting.infoEl.style.display = "none";

    textModelSetting = new ea.obsidian.Setting(advancedContent)
      .setName("Text model")
      .addDropdown(dropdown => {
        textModelSettingDropdown = dropdown;
        refreshTextModelDropdown();
        dropdown.setDisabled(!hasAvailableTextModels());
        dropdown
          .setValue(textModel || getAvailableTextModels()[0] || "")
          .onChange(value => {
            dirty = true;
            selectedTextModel = value;
            setTextAndImageModels();
            refreshTextModelDropdown();
            updateTextModelHelp();
          });
      });
    textModelHelpEl = advancedContent.createEl("p", { cls: "excali-ai-help-text" });

    maxTokensSetting = new ea.obsidian.Setting(advancedContent)
      .setName("Text max token override")
      .addText(text => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.style.width = "100px";
        const placeholderValue = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
        if(placeholderValue) {
          text.setPlaceholder(String(placeholderValue));
        }
        text.setValue(selectedMaxTokens);
        text.onChange(value => {
          selectedMaxTokens = String(value ?? "").trim();
          dirty = true;
          updateMaxTokensHelp();
        });
      });
    maxTokensSetting.settingEl.toggleClass("is-disabled", !hasAvailableTextModels());
    maxTokensHelpEl = advancedContent.createEl("p", { cls: "excali-ai-help-text" });

    imageModelSetting = new ea.obsidian.Setting(advancedContent)
      .setName("Image model")
      .addDropdown(dropdown => {
        imageModelSettingDropdown = dropdown;
        refreshImageModelDropdown();
        dropdown.setDisabled(!hasAvailableImageModels());
        dropdown
          .setValue(imageModel || getAvailableImageModels()[0] || "")
          .onChange(async value => {
            dirty = true;
            selectedImageModel = value;
            setTextAndImageModels();
            refreshTextModelDropdown();
            refreshImageModelDropdown();
            refreshImageSizeDropdown();
            updateMaskEditSetting();
            updateImageModelHelp();
            if(isImageEditTask()) {
              ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
              updatePreviewSection();
            }
          });
      });
    imageModelHelpEl = advancedContent.createEl("p", { cls: "excali-ai-help-text" });

    maskEditSetting = new ea.obsidian.Setting(advancedContent)
      .setName("Use mask edit")
      .addToggle(toggle => {
        maskEditToggleComponent = toggle;
        toggle
          .setValue(shouldUseMaskEdit())
          .setDisabled(!activeImageModelSupportsMaskEdits())
          .onChange(async value => {
            dirty = true;
            prefersMaskEdit = value;
            updateMaskEditSetting();
            updateImageModelHelp();
            ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
            updatePreviewSection();
          });
      });

    imageSizeSetting = new ea.obsidian.Setting(advancedContent)
      .setName("Image size")
      .addDropdown(dropdown => {
        imageSizeSettingDropdown = dropdown;
        refreshImageSizeDropdown();
        dropdown.setDisabled(!hasAvailableImageModels());
        dropdown
          .setValue(imageSize)
          .onChange(async value => {
            dirty = true;
            imageSize = value;
            updateImageModelHelp();
            if(isImageEditTask()) {
              ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
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
    const runSetting = new ea.obsidian.Setting(runContainer);
    if(ea.verifyMinimumPluginVersion && ea.verifyMinimumPluginVersion("2.23.4")) {
      runSetting.addButton(button => {
        button
          .setButtonText(ea.formatAIUsageLabel())
          .setIcon("bar-chart-2")
          .setTooltip("View AI token usage for this session")
          .onClick(() => {
            ea.showAIUsageModal();
          });
      });
    }
    runSetting.addButton(button => button.setButtonText(" Run").setIcon("play").setCta().onClick(() => {
        const taskConfig = getActiveTaskConfig();
        if(!taskConfig) {
          new Notice("No runnable AI task is selected.", 8000);
          return;
        }
        const taskConfigValidationMessage = getTaskConfigValidationMessage(taskConfig);
        if(taskConfigValidationMessage) {
          new Notice(taskConfigValidationMessage, 8000);
          return;
        }
        if(doesTaskUseTextModel(taskConfig.id) && !hasAvailableTextModels()) {
          new Notice(getMissingModelConfigurationMessage("text"), 8000);
          return;
        }
        if(isImageGenerationTask(taskConfig.id) && !hasAvailableImageModels()) {
          new Notice(getMissingModelConfigurationMessage("image"), 8000);
          return;
        }
        run(userPrompt);
        configModal.close();
      }));
  };

  configModal.onClose = async () => {
    if(dirty) {
      await saveExcaliAISettings();
    }
    if(openTaskEditorAfterClose) {
      openTaskEditorModal({reopenMainModal: true});
    }
  };

  configModal.open();
};

openConfigModal();

