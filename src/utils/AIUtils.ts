import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  Notice,
  RequestUrlResponse,
  requestUrl,
} from "obsidian";
import { URLs } from "src/constants/safeUrls";
import ExcalidrawPlugin from "src/core/main";
import {
  AIImageModelConfig,
  AIImageUsageEntry,
  AITextUsageEntry,
  AIUsageData,
  ExcalidrawAISettings,
  AIFileInput,
  AIImageInput,
  AIModelConfig,
  AIProvider,
  AIProviderProfile,
  AIRequest,
  AIRequestMessage,
  AIRequestMessagePart,
  GPTCompletionRequest,
} from "src/types/AIUtilTypes";
import {
  decryptProviderProfiles,
  decryptStoredAPIKey,
} from "src/utils/settingsKeyObfuscation";
import {
  getGeminiImageRequestConfig,
  getGeminiSupportedSizes,
} from "src/utils/geminiImageModelUtils";

type NormalizedBinaryInput = {
  source: string;
  mimeType?: string;
  filename?: string;
  detail?: "low" | "high" | "auto";
};

type NormalizedMessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: NormalizedBinaryInput }
  | { type: "file"; file: NormalizedBinaryInput }
  | { type: "audio"; audio: NormalizedBinaryInput };

type NormalizedMessage = {
  role: "system" | "user" | "assistant";
  content: string | NormalizedMessagePart[];
};

type ResolvedModelConfig = {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  endpoint: string;
  model: string;
  multimodalSupport: boolean;
};

type ResolvedImageConfig = ResolvedModelConfig & {
  supportedSizes: string[];
  supportsPromptImageTransforms: boolean;
  supportsMaskImageEdits: boolean;
};

type ResolvedAIConfig = {
  text: ResolvedModelConfig;
  image: ResolvedImageConfig;
  maxTokens: number;
  maxOutgoingTokens: number;
};

type GenerateAITextOptions = {
  plugin?: ExcalidrawPlugin;
  signal?: AbortSignal;
};

type GenerateAITextResult = {
  response: RequestUrlResponse;
  json: Record<string, unknown>;
  content: string;
  rateLimit: number | null;
  rateLimitRemaining: number | null;
};

export type AIGeneratedImage = {
  url?: string;
  b64_json?: string;
  dataURL?: string;
  mimeType?: string;
  revisedPrompt?: string;
};

export type GenerateAIImageResult = {
  response: RequestUrlResponse;
  json: Record<string, unknown>;
  images: AIGeneratedImage[];
  firstImage: AIGeneratedImage | null;
  revisedPrompt: string;
};

export type AIChatSession = {
  getMessages: () => AIRequestMessage[];
  reset: () => void;
  send: (
    message: string | AIRequestMessage | AIRequestMessagePart[],
    requestOverrides?: Omit<AIRequest, "messages">,
  ) => Promise<GenerateAITextResult>;
};

const AI_DEBUG_PREFIX = "[Excalidraw AI Debug]";
const AI_DEBUG_MAX_LENGTH = 8000;

// ---------------------------------------------------------------------------
// Session-scoped AI usage metering (not persisted across Obsidian restarts)
// ---------------------------------------------------------------------------

const _textUsageStore: Record<string, AITextUsageEntry> = {};
const _imageUsageStore: Record<string, AIImageUsageEntry> = {};

const recordAITextUsage = (
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): void => {
  if (!modelId || (inputTokens === 0 && outputTokens === 0)) {
    return;
  }
  const existing = _textUsageStore[modelId];
  if (existing) {
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
  } else {
    _textUsageStore[modelId] = { inputTokens, outputTokens };
  }
};

const recordAIImageGenerationUsage = (
  modelId: string,
  count: number = 1,
): void => {
  if (!modelId || count <= 0) {
    return;
  }
  const existing = _imageUsageStore[modelId];
  if (existing) {
    existing.generations += count;
  } else {
    _imageUsageStore[modelId] = { generations: count };
  }
};

/**
 * Returns accumulated AI token usage for the current Obsidian session.
 * Usage is not persisted and resets when Obsidian is restarted.
 */
export const getAIUsage = (): AIUsageData => {
  const textModels = { ..._textUsageStore };
  const imageModels = { ..._imageUsageStore };
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalImageGenerations = 0;

  for (const entry of Object.values(textModels)) {
    totalInputTokens += entry.inputTokens;
    totalOutputTokens += entry.outputTokens;
  }
  for (const entry of Object.values(imageModels)) {
    totalImageGenerations += entry.generations;
  }

  return {
    textModels,
    imageModels,
    totalInputTokens,
    totalOutputTokens,
    totalImageGenerations,
  };
};

/**
 * Resets the session-scoped AI usage meter. Primarily for testing and tooling.
 */
export const resetAIUsage = (): void => {
  for (const key of Object.keys(_textUsageStore)) {
    delete _textUsageStore[key];
  }
  for (const key of Object.keys(_imageUsageStore)) {
    delete _imageUsageStore[key];
  }
};

/**
 * Formats total session token usage as a compact label suitable for buttons.
 * Format: "AI Usage: 355k/23k" (input tokens / output tokens).
 * Image generations are appended when present, e.g. "+ 3 imgs".
 */
export const formatAIUsageLabel = (usage?: AIUsageData): string => {
  const data = usage ?? getAIUsage();
  const fmt = (n: number): string => {
    if (n === 0) {
      return "0";
    }
    if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (n >= 1_000) {
      return `${Math.round(n / 1000)}k`;
    }
    return String(n);
  };
  const tokenPart = `${fmt(data.totalInputTokens)}/${fmt(data.totalOutputTokens)}`;
  const imgPart =
    data.totalImageGenerations > 0
      ? ` + ${data.totalImageGenerations} img${data.totalImageGenerations !== 1 ? "s" : ""}`
      : "";
  return `AI Usage: ${tokenPart}${imgPart}`;
};

// ---------------------------------------------------------------------------

const stringifyDebugValue = (value: unknown): string => {
  if (value === undefined) {
    return "<undefined>";
  }
  if (value === null) {
    return "<null>";
  }
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const trimDebugText = (
  value: string,
  maxLength: number = AI_DEBUG_MAX_LENGTH,
): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`;
};

const debugValueLine = (label: string, value: unknown): string => {
  const stringValue = trimDebugText(stringifyDebugValue(value));
  return `${label}: ${stringValue}`;
};

const isAIVerboseLoggingEnabled = (plugin?: ExcalidrawPlugin | null): boolean =>
  Boolean(plugin?.settings?.aiVerboseLogging);

const logAIDebug = (
  plugin: ExcalidrawPlugin | null | undefined,
  label: string,
  lines: string[],
): void => {
  if (!isAIVerboseLoggingEnabled(plugin)) {
    return;
  }

  console.log(`${AI_DEBUG_PREFIX} ${label}\n${lines.join("\n")}`);
};

export const getJsonErrorMessage = (json: unknown): string | undefined => {
  if (typeof json !== "object" || json === null || !("error" in json)) {
    return undefined;
  }

  const error = (json as { error?: unknown }).error;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return undefined;
  }

  const message = (error as { message?: unknown }).message;
  return message == null ? undefined : String(message);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payloads are intentionally dynamic at this normalization boundary.
const getFirstChoice = (json: Record<string, any>) =>
  json?.choices?.[0] ?? null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payloads are intentionally dynamic at this normalization boundary.
const getFirstChoiceContent = (json: Record<string, any>): string => {
  const content = getFirstChoice(json)?.message?.content;
  return typeof content === "string" ? content : "";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payloads are intentionally dynamic at this normalization boundary.
const getFirstChoiceFinishReason = (json: Record<string, any>): string => {
  const finishReason = getFirstChoice(json)?.finish_reason;
  return typeof finishReason === "string" ? finishReason : "";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payloads are intentionally dynamic at this normalization boundary.
const getReasoningTokenCount = (json: Record<string, any>): number => {
  const value = json?.usage?.completion_tokens_details?.reasoning_tokens;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const shouldRetryEmptyMultimodalReasoningResponse = (
  request: AIRequest,
  response: RequestUrlResponse,
): boolean => {
  if (!requestHasImageInput(request) || request.imageGenerationProperties) {
    return false;
  }

  const json = response?.json;
  if (!json || json.error) {
    return false;
  }

  const content = getFirstChoiceContent(json).trim();
  const finishReason = getFirstChoiceFinishReason(json);
  const reasoningTokens = getReasoningTokenCount(json);

  return content === "" && finishReason === "length" && reasoningTokens > 0;
};

const getEmptyMultimodalRetryMaxTokens = (request: AIRequest): number => {
  const currentMaxTokens = request.maxTokens ?? 0;
  return Math.min(Math.max(currentMaxTokens * 2, 8192), 16384);
};

const DEFAULT_PROVIDER_BASE_URLS: Record<AIProvider, string> = {
  openai: URLs.API_OPENAI_COM_V1,
  anthropic: URLs.API_ANTHROPIC_COM_V1,
  google: URLs.GENERATIVELANGUAGE_GOOGLEAPIS_COM_V1BETA,
  xai: URLs.API_X_AI_V1,
  "openai-compatible": URLs.API_OPENAI_COM_V1,
};

const ANTHROPIC_VERSION = "2023-06-01";

const getPlugin = (plugin?: ExcalidrawPlugin): ExcalidrawPlugin | null => {
  return plugin ?? window?.ExcalidrawAutomate?.plugin ?? null;
};

const getAssetSource = (asset?: AIImageInput | AIFileInput): string => {
  if (!asset) {
    return null;
  }
  if (typeof asset === "string") {
    return asset;
  }
  if ("url" in asset) {
    return asset.url;
  }
  if ("dataURL" in asset) {
    return asset.dataURL;
  }
  return null;
};

const getImageURL = (image?: AIImageInput | AIFileInput): string => {
  return getAssetSource(image);
};

const getAssetMimeType = (
  asset?: AIImageInput | AIFileInput,
): string | undefined => {
  if (!asset || typeof asset === "string") {
    return undefined;
  }
  return asset.mimeType;
};

const getAssetFilename = (
  asset?: AIImageInput | AIFileInput,
): string | undefined => {
  if (!asset || typeof asset === "string") {
    return undefined;
  }
  return asset.filename;
};

const getImageDetail = (
  image?: AIImageInput,
): "low" | "high" | "auto" | undefined => {
  if (!image || typeof image === "string") {
    return undefined;
  }
  return image.detail;
};

const normalizeBinaryInput = (
  asset: AIImageInput | AIFileInput,
): NormalizedBinaryInput | null => {
  const source = getAssetSource(asset);
  if (!source) {
    return null;
  }
  return {
    source,
    mimeType: getAssetMimeType(asset),
    filename: getAssetFilename(asset),
    ...(getImageDetail(asset) ? { detail: getImageDetail(asset) } : {}),
  };
};

const normalizeBaseURL = (value: string): string => {
  return (value ?? "").trim().replace(/\/+$/, "");
};

const AI_BASE_URL_SUFFIXES = [
  "/chat/completions",
  "/messages",
  "/images/generations",
  "/images/edits",
  "/images/variations",
];

const joinURL = (baseURL: string, path: string): string => {
  return `${normalizeBaseURL(baseURL)}/${path.replace(/^\/+/, "")}`;
};

const inferLegacyBaseURL = (url: string, suffix: string): string => {
  const normalized = normalizeBaseURL(url);
  if (!normalized) {
    return "";
  }
  return normalized.endsWith(suffix)
    ? normalized.slice(0, -suffix.length)
    : normalized;
};

const inferConfiguredBaseURL = (url: string): string => {
  const normalized = normalizeBaseURL(url);
  if (!normalized) {
    return "";
  }

  const matchingSuffix = AI_BASE_URL_SUFFIXES.find((suffix) =>
    normalized.endsWith(suffix),
  );
  return matchingSuffix
    ? normalized.slice(0, -matchingSuffix.length)
    : normalized;
};

const getResolvedProvider = (
  request: AIRequest,
  plugin: ExcalidrawPlugin,
): AIProvider => {
  return request.provider ?? plugin.settings.aiProvider ?? "openai";
};

const getProviderProfiles = (
  plugin: ExcalidrawPlugin,
): Record<string, AIProviderProfile> => {
  return plugin.settings.aiProviderProfiles &&
    Object.keys(plugin.settings.aiProviderProfiles).length > 0
    ? decryptProviderProfiles(plugin.settings.aiProviderProfiles)
    : {
        OpenAI: {
          provider: plugin.settings.aiProvider ?? "openai",
          apiKey: decryptStoredAPIKey(
            plugin.settings.aiAPIKey || plugin.settings.openAIAPIToken,
          ),
          baseURL:
            inferConfiguredBaseURL(plugin.settings.aiBaseURL) ||
            inferLegacyBaseURL(
              plugin.settings.openAIURL,
              "/chat/completions",
            ) ||
            DEFAULT_PROVIDER_BASE_URLS[plugin.settings.aiProvider ?? "openai"],
        },
      };
};

const getDefaultProviderProfileId = (plugin: ExcalidrawPlugin): string => {
  const profiles = getProviderProfiles(plugin);
  return Object.keys(profiles)[0] ?? "OpenAI";
};

const requestHasImageInput = (request: AIRequest): boolean =>
  Boolean(
    request.image ||
    request.messages?.some(
      (message) =>
        Array.isArray(message.content) &&
        message.content.some((part) => part.type === "image"),
    ),
  );

const getModelConfigs = (plugin: ExcalidrawPlugin, kind: "text" | "image") => {
  if (kind === "text") {
    if (
      plugin.settings.aiTextModelConfigs &&
      Object.keys(plugin.settings.aiTextModelConfigs).length > 0
    ) {
      return plugin.settings.aiTextModelConfigs;
    }

    if (
      plugin.settings.aiVisionModelConfigs &&
      Object.keys(plugin.settings.aiVisionModelConfigs).length > 0
    ) {
      return Object.fromEntries(
        Object.entries(plugin.settings.aiVisionModelConfigs).map(
          ([modelId, config]) => [
            modelId,
            {
              ...config,
              multimodalSupport: config.multimodalSupport ?? true,
            },
          ],
        ),
      );
    }

    const defaultTextModel =
      plugin.settings.aiDefaultTextModel ||
      plugin.settings.aiDefaultVisionModel ||
      plugin.settings.openAIDefaultTextModel ||
      plugin.settings.openAIDefaultVisionModel ||
      "gpt-5-mini";

    return {
      [defaultTextModel]: {
        providerId: getDefaultProviderProfileId(plugin),
        model: defaultTextModel,
        endpoint:
          plugin.settings.aiTextEndpoint || plugin.settings.openAIURL || "",
        multimodalSupport: true,
      },
    };
  }

  const defaultImageModel =
    plugin.settings.aiDefaultImageGenerationModel ||
    plugin.settings.openAIDefaultImageGenerationModel ||
    "gpt-image-1";
  const legacyCapability = plugin.settings.aiImageModelCapabilities?.[
    defaultImageModel
  ] as
    | {
        supportedSizes?: string[];
        supportsPromptImageTransforms?: boolean;
        supportsMaskImageEdits?: boolean;
        supportsImageEdits?: boolean;
      }
    | undefined;

  return plugin.settings.aiImageModelConfigs &&
    Object.keys(plugin.settings.aiImageModelConfigs).length > 0
    ? plugin.settings.aiImageModelConfigs
    : {
        [defaultImageModel]: {
          providerId: getDefaultProviderProfileId(plugin),
          model: defaultImageModel,
          supportedSizes: legacyCapability?.supportedSizes ?? ["1024x1024"],
          supportsPromptImageTransforms:
            legacyCapability?.supportsPromptImageTransforms ??
            legacyCapability?.supportsImageEdits ??
            true,
          supportsMaskImageEdits:
            legacyCapability?.supportsMaskImageEdits ??
            legacyCapability?.supportsImageEdits ??
            true,
        },
      };
};

const getSelectedModelConfigId = (
  plugin: ExcalidrawPlugin,
  kind: "text" | "image",
  request: AIRequest,
  requireMultimodal: boolean = false,
) => {
  const configs = getModelConfigs(plugin, kind);

  if (kind === "text") {
    const configuredIds = requireMultimodal
      ? [
          request.textModelId,
          plugin.settings.aiDefaultMultimodalModel,
          plugin.settings.aiDefaultTextModel,
          plugin.settings.aiDefaultVisionModel,
        ]
      : [
          request.textModelId,
          plugin.settings.aiDefaultTextModel,
          plugin.settings.aiDefaultMultimodalModel,
          plugin.settings.aiDefaultVisionModel,
        ];

    const normalizedConfiguredIds = configuredIds.filter(Boolean);

    const configuredId = normalizedConfiguredIds.find((modelId) => {
      const config = configs[modelId];
      return (
        config && (!requireMultimodal || config.multimodalSupport !== false)
      );
    });
    if (configuredId) {
      return configuredId;
    }

    if (requireMultimodal) {
      const multimodalModelId = Object.entries(configs).find(
        ([, config]) => config.multimodalSupport !== false,
      )?.[0];
      if (multimodalModelId) {
        return multimodalModelId;
      }
    }

    return Object.keys(configs)[0];
  }

  const configuredId =
    request.imageModelId || plugin.settings.aiDefaultImageGenerationModel;
  return configs[configuredId] ? configuredId : Object.keys(configs)[0];
};

const getDerivedTextEndpoint = (
  provider: AIProvider,
  baseURL: string,
  endpoint?: string,
): string => {
  if (provider === "google") {
    return endpoint || baseURL;
  }
  if (provider === "anthropic") {
    return endpoint || joinURL(baseURL, "/messages");
  }
  return endpoint || joinURL(baseURL, "/chat/completions");
};

const getResolvedModelConfig = (
  plugin: ExcalidrawPlugin,
  kind: "text" | "image",
  request: AIRequest,
): ResolvedModelConfig | ResolvedImageConfig => {
  const configs = getModelConfigs(plugin, kind);
  const selectedConfigId = getSelectedModelConfigId(
    plugin,
    kind,
    request,
    kind === "text" && requestHasImageInput(request),
  );
  const selectedConfig = configs[selectedConfigId] || Object.values(configs)[0];
  const profile =
    getProviderProfiles(plugin)[selectedConfig?.providerId] ||
    Object.values(getProviderProfiles(plugin))[0];
  const provider =
    request.provider ??
    profile?.provider ??
    getResolvedProvider(request, plugin);
  const hasRequestBaseURL = Boolean(request.baseURL?.trim());
  const baseURL = normalizeBaseURL(
    (hasRequestBaseURL ? inferConfiguredBaseURL(request.baseURL) : "") ||
      inferConfiguredBaseURL(profile?.baseURL) ||
      DEFAULT_PROVIDER_BASE_URLS[provider],
  );
  const endpoint =
    kind === "image"
      ? ""
      : hasRequestBaseURL
        ? getDerivedTextEndpoint(provider, baseURL)
        : getDerivedTextEndpoint(
            provider,
            baseURL,
            selectedConfig?.endpoint?.trim(),
          );

  const result: ResolvedModelConfig = {
    provider,
    apiKey:
      request.apiKey?.trim() ||
      profile?.apiKey ||
      plugin.settings.aiAPIKey ||
      plugin.settings.openAIAPIToken,
    baseURL,
    endpoint,
    model: request.model?.trim() || selectedConfig?.model || "",
    multimodalSupport: selectedConfig?.multimodalSupport !== false,
  };

  if (kind !== "image") {
    return result;
  }

  const imageConfig = selectedConfig as AIImageModelConfig;
  const legacySupportsImageEdits = (
    imageConfig as AIImageModelConfig & { supportsImageEdits?: boolean }
  ).supportsImageEdits;
  const resolvedModel = request.model?.trim() || selectedConfig?.model || "";
  const geminiSupportedSizes = getGeminiSupportedSizes(provider, resolvedModel);
  return {
    ...result,
    supportedSizes:
      geminiSupportedSizes.length > 0
        ? geminiSupportedSizes
        : [...(imageConfig.supportedSizes ?? ["1024x1024"])],
    supportsPromptImageTransforms:
      imageConfig.supportsPromptImageTransforms ??
      legacySupportsImageEdits ??
      true,
    supportsMaskImageEdits:
      imageConfig.supportsMaskImageEdits ?? legacySupportsImageEdits ?? true,
  };
};

const resolveAIConfig = (
  request: AIRequest,
  plugin?: ExcalidrawPlugin,
): ResolvedAIConfig | null => {
  const resolvedPlugin = getPlugin(plugin);
  if (!resolvedPlugin) {
    return null;
  }

  return {
    text: getResolvedModelConfig(resolvedPlugin, "text", request),
    image: getResolvedModelConfig(
      resolvedPlugin,
      "image",
      request,
    ) as ResolvedImageConfig,
    maxTokens:
      resolvedPlugin.settings.aiDefaultMaxResponseTokens ||
      resolvedPlugin.settings.aiDefaultMaxTokens ||
      resolvedPlugin.settings.openAIDefaultTextModelMaxTokens,
    maxOutgoingTokens: resolvedPlugin.settings.aiDefaultMaxOutgoingTokens || 0,
  };
};

const createSyntheticResponse = (
  message: string,
  status: number = 400,
  extraJson: Record<string, unknown> = {},
): RequestUrlResponse => ({
  status,
  headers: {},
  text: null,
  json: {
    error: {
      message,
    },
    ...extraJson,
  },
  arrayBuffer: null,
});

const getHeaderValue = (
  headers: RequestUrlResponse["headers"],
  key: string,
): string | null => {
  if (!headers) {
    return null;
  }
  const normalizedKey = key.toLowerCase();
  const headerObject = headers;
  return headerObject[key] ?? headerObject[normalizedKey] ?? null;
};

const requestUrlWithAbort = async (
  request: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    contentType?: string;
    body?: string | ArrayBuffer;
  },
  signal?: AbortSignal,
): Promise<RequestUrlResponse> => {
  if (signal?.aborted) {
    return createSyntheticResponse("Request aborted", 499);
  }

  const requestPromise = requestUrl({
    ...request,
    throw: false,
  });

  if (!signal) {
    return await requestPromise;
  }

  return await Promise.race([
    requestPromise,
    new Promise<RequestUrlResponse>((resolve) => {
      signal.addEventListener(
        "abort",
        () => resolve(createSyntheticResponse("Request aborted", 499)),
        { once: true },
      );
    }),
  ]);
};

const usesMaxCompletionTokens = (model: string): boolean => {
  if (!model) {
    return false;
  }
  return ["gpt-4o", "gpt-5", "o1", "o3", "o4"].some((prefix) =>
    model.includes(prefix),
  );
};

const getTextLimitPayload = (
  model: string,
  maxTokens: number,
): { max_tokens?: number; max_completion_tokens?: number } => {
  if (!maxTokens || maxTokens <= 0) {
    return {};
  }
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
};

const normalizeMessagePart = (
  part: AIRequestMessagePart,
): NormalizedMessagePart | null => {
  if (part.type === "text") {
    return part.text?.trim() === "" ? null : { type: "text", text: part.text };
  }

  if (part.type === "image") {
    const image = normalizeBinaryInput(part.image);
    return image ? { type: "image", image } : null;
  }

  if (part.type === "file") {
    const file = normalizeBinaryInput(part.file);
    return file ? { type: "file", file } : null;
  }

  const audio = normalizeBinaryInput(part.audio);
  return audio ? { type: "audio", audio } : null;
};

const normalizeRequestMessage = (
  message: AIRequestMessage,
): NormalizedMessage | null => {
  if (!message) {
    return null;
  }
  if (typeof message.content === "string") {
    return message.content.trim() === ""
      ? null
      : { role: message.role, content: message.content };
  }

  const parts = message.content.map(normalizeMessagePart).filter(Boolean);

  return parts.length === 0 ? null : { role: message.role, content: parts };
};

const buildNormalizedMessages = (request: AIRequest): NormalizedMessage[] => {
  const messages =
    request.messages?.map(normalizeRequestMessage).filter(Boolean) ?? [];

  if (messages.length > 0) {
    if (request.systemPrompt?.trim()) {
      messages.unshift({
        role: "system",
        content: request.systemPrompt.trim(),
      });
    }
    if (request.text?.trim()) {
      messages.push({ role: "user", content: request.text.trim() });
    }
    if (request.instruction?.trim()) {
      messages.push({ role: "user", content: request.instruction.trim() });
    }
    return messages;
  }

  const builtMessages: NormalizedMessage[] = [];
  if (request.systemPrompt?.trim()) {
    builtMessages.push({
      role: "system",
      content: request.systemPrompt.trim(),
    });
  }

  const image = normalizeBinaryInput(request.image);
  if (image) {
    const content: NormalizedMessagePart[] = [{ type: "image", image }];
    if (request.text?.trim()) {
      content.push({ type: "text", text: request.text.trim() });
    }
    if (request.instruction?.trim()) {
      content.push({ type: "text", text: request.instruction.trim() });
    }
    builtMessages.push({ role: "user", content });
    return builtMessages;
  }

  if (request.text?.trim()) {
    builtMessages.push({ role: "user", content: request.text.trim() });
  }
  if (request.instruction?.trim()) {
    builtMessages.push({ role: "user", content: request.instruction.trim() });
  }

  return builtMessages;
};

const estimateTokenCount = (text: string): number => {
  return Math.ceil((text ?? "").length / 4);
};

const trimTextToTokenBudget = (text: string, budget: number): string => {
  if (!text || budget <= 0) {
    return "";
  }
  const maxChars = Math.max(1, budget * 4);
  if (text.length <= maxChars) {
    return text;
  }
  return `[truncated]\n${text.slice(-maxChars)}`;
};

const limitContentByOutgoingTokenBudget = (
  content: string | NormalizedMessagePart[],
  budget: number,
): { content: string | NormalizedMessagePart[] | null; remaining: number } => {
  if (typeof content === "string") {
    if (budget <= 0) {
      return { content: null, remaining: 0 };
    }
    const tokenCount = estimateTokenCount(content);
    if (tokenCount <= budget) {
      return { content, remaining: budget - tokenCount };
    }
    return {
      content: trimTextToTokenBudget(content, budget),
      remaining: 0,
    };
  }

  const limitedParts: NormalizedMessagePart[] = [];
  let remaining = budget;

  for (let i = content.length - 1; i >= 0; i--) {
    const part = content[i];
    if (part.type !== "text") {
      limitedParts.unshift(part);
      continue;
    }

    if (remaining <= 0) {
      continue;
    }

    const tokenCount = estimateTokenCount(part.text);
    if (tokenCount <= remaining) {
      limitedParts.unshift(part);
      remaining -= tokenCount;
      continue;
    }

    const trimmed = trimTextToTokenBudget(part.text, remaining);
    if (trimmed) {
      limitedParts.unshift({ type: "text", text: trimmed });
    }
    remaining = 0;
  }

  return {
    content: limitedParts.length > 0 ? limitedParts : null,
    remaining,
  };
};

const applyOutgoingTokenBudget = (
  messages: NormalizedMessage[],
  maxOutgoingTokens: number,
): NormalizedMessage[] => {
  if (!maxOutgoingTokens || maxOutgoingTokens <= 0) {
    return messages;
  }

  const limitedMessages: NormalizedMessage[] = [];
  let remaining = maxOutgoingTokens;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const limited = limitContentByOutgoingTokenBudget(
      message.content,
      remaining,
    );
    if (!limited.content) {
      continue;
    }
    limitedMessages.unshift({
      role: message.role,
      content: limited.content,
    });
    remaining = limited.remaining;
  }

  return limitedMessages.length > 0 ? limitedMessages : messages.slice(-1);
};

const toOpenAIContent = (content: string | NormalizedMessagePart[]) => {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part) => part.type === "text" || part.type === "image")
    .map((part) =>
      part.type === "text"
        ? { type: "text" as const, text: part.text }
        : {
            type: "image_url" as const,
            image_url: {
              url: part.image.source,
              detail: part.image.detail ?? ("high" as const),
            },
          },
    );
};

const toOpenAIMessages = (
  messages: NormalizedMessage[],
): GPTCompletionRequest["messages"] => {
  return messages.map((message) => ({
    role: message.role,
    content: toOpenAIContent(message.content),
  }));
};

const parseDataURL = (
  dataURL: string,
): { mediaType: string; data: string } | null => {
  const match = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    mediaType: match[1],
    data: match[2],
  };
};

const getFilenameFromMimeType = (
  mimeType: string,
  fallback: string,
): string => {
  const normalized = (mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) {
    return `${fallback}.png`;
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return `${fallback}.jpg`;
  }
  if (normalized.includes("webp")) {
    return `${fallback}.webp`;
  }
  if (normalized.includes("gif")) {
    return `${fallback}.gif`;
  }
  if (normalized.includes("svg")) {
    return `${fallback}.svg`;
  }
  return `${fallback}.bin`;
};

const getBinaryAssetData = async (
  asset: string | NormalizedBinaryInput,
  signal?: AbortSignal,
  fallback: string = "file",
): Promise<{
  mediaType: string;
  data: ArrayBuffer;
  filename: string;
} | null> => {
  const source = typeof asset === "string" ? asset : asset?.source;
  const preferredMimeType =
    typeof asset === "string" ? undefined : asset?.mimeType;
  const preferredFilename =
    typeof asset === "string" ? undefined : asset?.filename;

  if (!source) {
    return null;
  }

  const parsed = parseDataURL(source);
  if (parsed) {
    const mediaType = preferredMimeType || parsed.mediaType;
    return {
      mediaType,
      data: base64ToArrayBuffer(parsed.data),
      filename:
        preferredFilename || getFilenameFromMimeType(mediaType, fallback),
    };
  }

  if (/^https?:\/\//i.test(source)) {
    const response = await requestUrlWithAbort(
      {
        url: source,
        method: "GET",
      },
      signal,
    );

    if (response.status >= 400 || !response.arrayBuffer) {
      throw new Error(`Unable to download file from ${source}`);
    }

    const mediaType =
      preferredMimeType ||
      getHeaderValue(response.headers, "content-type") ||
      "application/octet-stream";
    return {
      mediaType,
      data: response.arrayBuffer,
      filename:
        preferredFilename || getFilenameFromMimeType(mediaType, fallback),
    };
  }

  throw new Error("Unsupported file source. Use a data URL or an http(s) URL.");
};

const toInlineBinaryData = async (
  asset: string | NormalizedBinaryInput,
  signal?: AbortSignal,
  fallback: string = "file",
): Promise<{ mediaType: string; data: string; filename: string } | null> => {
  const binary = await getBinaryAssetData(asset, signal, fallback);
  if (!binary) {
    return null;
  }
  return {
    mediaType: binary.mediaType,
    data: arrayBufferToBase64(binary.data),
    filename: binary.filename,
  };
};

const toAnthropicContent = async (
  content: string | NormalizedMessagePart[],
  signal?: AbortSignal,
) => {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  const parts = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "image") {
      const inlineImage = await toInlineBinaryData(part.image, signal, "image");
      if (!inlineImage) {
        continue;
      }
      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: inlineImage.mediaType,
          data: inlineImage.data,
        },
      });
      continue;
    }

    if (part.type === "file") {
      const inlineFile = await toInlineBinaryData(
        part.file,
        signal,
        "document",
      );
      if (!inlineFile) {
        continue;
      }
      if (inlineFile.mediaType !== "application/pdf") {
        throw new Error(
          "Anthropic file attachments currently support PDF documents only in ExcalidrawAutomate.",
        );
      }
      parts.push({
        type: "document",
        source: {
          type: "base64",
          media_type: inlineFile.mediaType,
          data: inlineFile.data,
        },
        title: inlineFile.filename,
      });
      continue;
    }

    throw new Error(
      "Anthropic audio attachments are not currently supported by ExcalidrawAutomate.",
    );
  }
  return parts;
};

const getAnthropicPayload = async (
  messages: NormalizedMessage[],
  config: ResolvedAIConfig,
  request: AIRequest,
  signal?: AbortSignal,
) => {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");

  const requestMessages = [];
  for (const message of messages.filter((item) => item.role !== "system")) {
    requestMessages.push({
      role: message.role,
      content: await toAnthropicContent(message.content, signal),
    });
  }

  return {
    model: request.model || config.text.model,
    max_tokens: request.maxTokens ?? config.maxTokens,
    ...(request.temperature !== undefined
      ? { temperature: request.temperature }
      : {}),
    ...(system ? { system } : {}),
    messages: requestMessages,
  };
};

const toGoogleParts = async (
  content: string | NormalizedMessagePart[],
  signal?: AbortSignal,
) => {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  const parts = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
      continue;
    }

    const inlineData = await toInlineBinaryData(
      part.type === "image"
        ? part.image
        : part.type === "file"
          ? part.file
          : part.audio,
      signal,
      part.type === "audio"
        ? "audio"
        : part.type === "image"
          ? "image"
          : "document",
    );
    if (!inlineData) {
      continue;
    }
    parts.push({
      inlineData: {
        mimeType: inlineData.mediaType,
        data: inlineData.data,
      },
    });
  }
  return parts;
};

const getGooglePayload = async (
  messages: NormalizedMessage[],
  config: ResolvedAIConfig,
  request: AIRequest,
  signal?: AbortSignal,
) => {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) =>
      typeof message.content === "string"
        ? { text: message.content }
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => ({ text: part.text })),
    )
    .flat();

  const contents = [];
  for (const message of messages.filter((item) => item.role !== "system")) {
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: await toGoogleParts(message.content, signal),
    });
  }

  return {
    ...(systemInstruction.length > 0
      ? { systemInstruction: { parts: systemInstruction } }
      : {}),
    contents,
    generationConfig: {
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...((request.maxTokens ?? config.maxTokens)
        ? { maxOutputTokens: request.maxTokens ?? config.maxTokens }
        : {}),
    },
  };
};

const getGoogleEndpoint = (config: ResolvedModelConfig): string => {
  const baseEndpoint = normalizeBaseURL(config.endpoint || config.baseURL);
  const separator = baseEndpoint.includes("?") ? "&" : "?";
  return `${baseEndpoint}/models/${config.model}:generateContent${separator}key=${encodeURIComponent(config.apiKey)}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party provider payload schemas vary and are normalized in this function.
const normalizeAnthropicResponse = (json: Record<string, any>) => {
  const text =
    json?.content
      ?.filter((item: { type?: string }) => item?.type === "text")
      .map((item: { text?: string }) => item.text)
      .join("\n\n") ?? "";

  return {
    id: json?.id,
    object: "chat.completion",
    created: json?.created_at,
    model: json?.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: json?.stop_reason ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: json?.usage?.input_tokens ?? null,
      completion_tokens: json?.usage?.output_tokens ?? null,
      total_tokens:
        (json?.usage?.input_tokens ?? 0) + (json?.usage?.output_tokens ?? 0),
    },
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party provider payload schemas vary and are normalized in this function.
const normalizeGoogleResponse = (json: Record<string, any>) => {
  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text)
      .filter(Boolean)
      .join("\n\n") ?? "";

  return {
    id: json?.responseId,
    object: "chat.completion",
    created: Date.now(),
    model: json?.modelVersion,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: json?.candidates?.[0]?.finishReason ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: json?.usageMetadata?.promptTokenCount ?? null,
      completion_tokens: json?.usageMetadata?.candidatesTokenCount ?? null,
      total_tokens: json?.usageMetadata?.totalTokenCount ?? null,
    },
  };
};

const normalizeResponseJson = (
  provider: AIProvider,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic provider payload passed through provider-specific normalizers.
  json: Record<string, any>,
) => {
  if (!json || json.error) {
    return json;
  }
  switch (provider) {
    case "anthropic":
      return normalizeAnthropicResponse(json);
    case "google":
      return normalizeGoogleResponse(json);
    default:
      return json;
  }
};

const stripImageDataPrefix = (
  value?: string,
): { data: string; mimeType?: string } | null => {
  if (!value) {
    return null;
  }
  const parsed = parseDataURL(value);
  if (parsed) {
    return {
      data: parsed.data,
      mimeType: parsed.mediaType,
    };
  }

  return {
    data: value,
  };
};

const getMimeTypeForOutputFormat = (
  format?: string,
  fallback: string = "image/png",
): string => {
  if (!format) {
    return fallback;
  }
  const normalized = format.toLowerCase();
  if (normalized === "jpg") {
    return "image/jpeg";
  }
  if (normalized.startsWith("image/")) {
    return normalized;
  }
  return `image/${normalized}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- image provider payload schemas vary and are normalized in this function.
const normalizeOpenAIImageResponse = (json: Record<string, any>) => {
  if (!json || json.error) {
    return json;
  }
  const data = Array.isArray(json.data)
    ? json.data.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- image provider payload schemas vary and are normalized in this function.
        (item: Record<string, any>) => item?.url || item?.b64_json,
      )
    : [];

  return {
    ...json,
    data,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- image provider payload schemas vary and are normalized in this function.
const normalizeGoogleImageResponseForImages = (json: Record<string, any>) => {
  if (!json || json.error) {
    return json;
  }

  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const revisedPrompt = parts
    .map((part: { text?: string }) => part?.text)
    .filter(Boolean)
    .join("\n\n");

  return {
    ...json,
    output_format: getMimeTypeForOutputFormat(
      parts.find(
        (part: { inlineData?: { mimeType?: string } }) =>
          part?.inlineData?.mimeType,
      )?.inlineData?.mimeType,
      "image/png",
    ).replace("image/", ""),
    data: parts
      .filter(
        (part: { inlineData?: { data?: string } }) => part?.inlineData?.data,
      )
      .map(
        (
          part: { inlineData: { data: string; mimeType?: string } },
          index: number,
        ) => ({
          b64_json: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/png",
          ...(revisedPrompt && index === 0
            ? { revised_prompt: revisedPrompt }
            : {}),
        }),
      ),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- image provider payload schemas vary and are normalized in this function.
const normalizeXAIImageResponse = (json: Record<string, any>) => {
  if (!json || json.error) {
    return json;
  }

  const rawItems = Array.isArray(json.data)
    ? json.data
    : Array.isArray(json.images)
      ? json.images
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- image provider payload schemas vary and are normalized in this function.
  const normalizedData = rawItems.flatMap((item: Record<string, any>) => {
    if (!item) {
      return [];
    }
    if (item.url || item.b64_json) {
      return [item];
    }

    if (typeof item.base64 === "string") {
      const normalizedBase64 = stripImageDataPrefix(item.base64);
      return normalizedBase64
        ? [
            {
              b64_json: normalizedBase64.data,
              mimeType: normalizedBase64.mimeType,
            },
          ]
        : [];
    }

    if (item.image?.url || item.image?.b64_json) {
      return [
        {
          url: item.image.url,
          b64_json: item.image.b64_json,
        },
      ];
    }

    if (typeof item.image?.base64 === "string") {
      const normalizedBase64 = stripImageDataPrefix(item.image.base64);
      return normalizedBase64
        ? [
            {
              b64_json: normalizedBase64.data,
              mimeType: normalizedBase64.mimeType,
            },
          ]
        : [];
    }

    return [];
  });

  if (normalizedData.length > 0) {
    return {
      ...json,
      data: normalizedData,
    };
  }

  if (typeof json.url === "string") {
    return {
      ...json,
      data: [{ url: json.url }],
    };
  }

  if (typeof json.base64 === "string") {
    const normalizedBase64 = stripImageDataPrefix(json.base64);
    return {
      ...json,
      data: normalizedBase64
        ? [
            {
              b64_json: normalizedBase64.data,
              mimeType: normalizedBase64.mimeType,
            },
          ]
        : [],
    };
  }

  return {
    ...json,
    data: [],
  };
};

const normalizeImageResponseJson = (
  provider: AIProvider,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic provider payload passed through provider-specific normalizers.
  json: Record<string, any>,
) => {
  switch (provider) {
    case "google":
      return normalizeGoogleImageResponseForImages(json);
    case "xai":
      return normalizeXAIImageResponse(json);
    default:
      return normalizeOpenAIImageResponse(json);
  }
};

const hasMessagePartType = (
  messages: NormalizedMessage[],
  type: NormalizedMessagePart["type"],
): boolean => {
  return messages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((part) => part.type === type),
  );
};

const trimTextForImagePrompt = (
  text: string | undefined,
  maxOutgoingTokens?: number,
): string | undefined => {
  if (!text?.trim() || !maxOutgoingTokens || maxOutgoingTokens <= 0) {
    return text;
  }
  const tokenCount = estimateTokenCount(text);
  return tokenCount <= maxOutgoingTokens
    ? text
    : trimTextToTokenBudget(text, maxOutgoingTokens);
};

const getImagePromptText = (
  request: AIRequest,
  maxOutgoingTokens?: number,
): string | undefined => {
  const text = [request.text?.trim(), request.instruction?.trim()]
    .filter(Boolean)
    .join("\n\n");

  return trimTextForImagePrompt(text || undefined, maxOutgoingTokens);
};

const getErrorMessageFromResponse = (response: RequestUrlResponse): string => {
  if (response.json?.error?.message) {
    return response.json.error.message;
  }
  if (typeof response.text === "string" && response.text.trim()) {
    return response.text.trim();
  }
  return `Request failed with status ${response.status}`;
};

const postJSON = async (
  url: string,
  init: {
    method?: string;
    body?: string | ArrayBuffer;
    headers?: Record<string, string>;
    contentType?: string;
  },
  provider: AIProvider,
  signal?: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- postJSON accepts provider-specific dynamic JSON and delegates normalization.
  normalizeJson: (json: Record<string, any>) => Record<string, any> = (json) =>
    normalizeResponseJson(provider, json),
): Promise<RequestUrlResponse> => {
  const result = await requestUrlWithAbort(
    {
      url,
      method: init.method,
      body: init.body,
      headers: init.headers,
      contentType: init.contentType,
    },
    signal,
  );

  const normalizedJson = normalizeJson(result.json);
  if (result.status >= 400) {
    return {
      status: result.status,
      headers: result.headers,
      text: result.text,
      json: {
        ...(normalizedJson && typeof normalizedJson === "object"
          ? normalizedJson
          : {}),
        error: {
          ...(normalizedJson?.error ?? {}),
          message: getErrorMessageFromResponse({
            ...result,
            json: normalizedJson,
          }),
          provider,
          endpoint: url,
          status: result.status,
        },
      },
      arrayBuffer: result.arrayBuffer,
    };
  }

  return {
    status: result.status,
    headers: result.headers,
    text: result.text,
    json: normalizedJson,
    arrayBuffer: result.arrayBuffer,
  };
};

const concatUint8Arrays = (parts: Uint8Array[]): Uint8Array => {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const buildMultipartFormBody = (
  fields: Array<{ name: string; value: string }>,
  files: Array<{
    name: string;
    filename: string;
    contentType: string;
    data: ArrayBuffer;
  }>,
): { contentType: string; body: ArrayBuffer } => {
  const boundary = `----ExcalidrawAIBoundary${Date.now().toString(16)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const field of fields) {
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(
      encoder.encode(
        `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`,
      ),
    );
    chunks.push(encoder.encode(`${field.value}\r\n`));
  }

  for (const file of files) {
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(
      encoder.encode(
        `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n`,
      ),
    );
    chunks.push(encoder.encode(`Content-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(new Uint8Array(file.data));
    chunks.push(encoder.encode("\r\n"));
  }

  chunks.push(encoder.encode(`--${boundary}--\r\n`));
  const combined = concatUint8Arrays(chunks);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: combined.buffer.slice(
      combined.byteOffset,
      combined.byteOffset + combined.byteLength,
    ) as ArrayBuffer,
  };
};

const handleImageRequest = async (
  request: AIRequest,
  config: ResolvedAIConfig,
  signal?: AbortSignal,
): Promise<RequestUrlResponse> => {
  const imageConfig = config.image;
  const image = getImageURL(request.image);
  const mask = getImageURL(request.imageGenerationProperties?.mask);
  const isEditing = Boolean(mask || image);
  const imageMode = mask ? "mask-edit" : image ? "transform" : "generation";
  const promptText = getImagePromptText(
    request,
    request.maxOutgoingTokens ?? config.maxOutgoingTokens,
  );
  const selectedImageModel = request.model || imageConfig.model;

  if (mask && !imageConfig.supportsMaskImageEdits) {
    return createSyntheticResponse(
      `${imageConfig.model} does not support mask-based image edits in Excalidraw. Choose an image model with mask edit support.`,
      400,
    );
  }

  if (image && !mask && !imageConfig.supportsPromptImageTransforms) {
    return createSyntheticResponse(
      `${imageConfig.model} does not support prompt-based image transforms in Excalidraw. Choose an image model with transform support.`,
      400,
    );
  }

  let response: RequestUrlResponse;

  switch (imageConfig.provider) {
    case "google": {
      if (mask) {
        return createSyntheticResponse(
          `${imageConfig.model} does not currently support mask-based image edits through the Google image API in Excalidraw.`,
          400,
        );
      }

      const geminiImageConfig = request.imageGenerationProperties?.size
        ? getGeminiImageRequestConfig(
            imageConfig.provider,
            selectedImageModel,
            request.imageGenerationProperties.size,
          )
        : null;
      const geminiSupportedSizes = getGeminiSupportedSizes(
        imageConfig.provider,
        selectedImageModel,
      );

      if (
        request.imageGenerationProperties?.size &&
        geminiSupportedSizes.length > 0 &&
        !geminiImageConfig
      ) {
        return createSyntheticResponse(
          `${request.imageGenerationProperties.size} is not a supported Gemini image size for ${selectedImageModel}.`,
          400,
        );
      }

      const parts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }> = [];
      if (image) {
        const inlineImage = await toInlineBinaryData(
          normalizeBinaryInput(request.image),
          signal,
          "image",
        );
        if (inlineImage) {
          parts.push({
            inlineData: {
              mimeType: inlineImage.mediaType,
              data: inlineImage.data,
            },
          });
        }
      }
      if (promptText) {
        parts.push({ text: promptText });
      }

      if (parts.length === 0) {
        return createSyntheticResponse(
          "Google image requests require a prompt or an input image.",
          400,
        );
      }

      response = await postJSON(
        getGoogleEndpoint({ ...imageConfig, endpoint: imageConfig.baseURL }),
        {
          method: "POST",
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              ...(geminiImageConfig
                ? {
                    imageConfig: {
                      aspectRatio: geminiImageConfig.aspectRatio,
                      ...(geminiImageConfig.imageSize
                        ? { imageSize: geminiImageConfig.imageSize }
                        : {}),
                    },
                  }
                : {}),
              ...(request.temperature !== undefined
                ? { temperature: request.temperature }
                : {}),
              ...((request.maxTokens ?? config.maxTokens)
                ? { maxOutputTokens: request.maxTokens ?? config.maxTokens }
                : {}),
            },
          }),
          contentType: "application/json",
          headers: {
            "Content-Type": "application/json",
          },
        },
        imageConfig.provider,
        signal,
        (json) => normalizeImageResponseJson(imageConfig.provider, json),
      );
      break;
    }
    case "xai": {
      if (mask) {
        return createSyntheticResponse(
          `${imageConfig.model} does not currently support mask-based image edits through the xAI image API in Excalidraw.`,
          400,
        );
      }

      const endpoint = isEditing
        ? joinURL(imageConfig.baseURL, "/images/edits")
        : joinURL(imageConfig.baseURL, "/images/generations");
      const payload = isEditing
        ? {
            model: request.model || imageConfig.model,
            ...(promptText ? { prompt: promptText } : {}),
            image: {
              url: image,
              type: "image_url",
            },
          }
        : {
            model: request.model || imageConfig.model,
            ...(promptText ? { prompt: promptText } : {}),
          };

      response = await postJSON(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify(payload),
          contentType: "application/json",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${imageConfig.apiKey}`,
          },
        },
        imageConfig.provider,
        signal,
        (json) => normalizeImageResponseJson(imageConfig.provider, json),
      );
      break;
    }
    default: {
      if (!["openai", "openai-compatible"].includes(imageConfig.provider)) {
        return createSyntheticResponse(
          `${imageConfig.provider} does not currently support image generation or editing in Excalidraw. Configure an OpenAI, Google, or xAI image model for image requests.`,
          400,
        );
      }

      const endpoint = isEditing
        ? joinURL(imageConfig.baseURL, "/images/edits")
        : joinURL(imageConfig.baseURL, "/images/generations");

      if (isEditing) {
        const fields: Array<{ name: string; value: string }> = [
          { name: "model", value: request.model || imageConfig.model },
        ];
        if (promptText) {
          fields.push({ name: "prompt", value: promptText });
        }
        if (request.imageGenerationProperties?.size) {
          fields.push({
            name: "size",
            value: request.imageGenerationProperties.size,
          });
        }
        if (request.imageGenerationProperties?.n) {
          fields.push({
            name: "n",
            value: String(request.imageGenerationProperties.n),
          });
        }
        if (request.imageGenerationProperties?.quality) {
          fields.push({
            name: "quality",
            value: request.imageGenerationProperties.quality,
          });
        }

        const files: Array<{
          name: string;
          filename: string;
          contentType: string;
          data: ArrayBuffer;
        }> = [];

        if (image) {
          const imageFile = await getBinaryAssetData(
            normalizeBinaryInput(request.image),
            signal,
            "image",
          );
          if (imageFile) {
            files.push({
              name: "image",
              filename: imageFile.filename,
              contentType: imageFile.mediaType,
              data: imageFile.data,
            });
          }
        }

        if (mask) {
          const maskFile = await getBinaryAssetData(
            normalizeBinaryInput(request.imageGenerationProperties?.mask),
            signal,
            "mask",
          );
          if (maskFile) {
            files.push({
              name: "mask",
              filename: maskFile.filename,
              contentType: maskFile.mediaType,
              data: maskFile.data,
            });
          }
        }

        const multipart = buildMultipartFormBody(fields, files);
        response = await postJSON(
          endpoint,
          {
            method: "POST",
            body: multipart.body,
            contentType: multipart.contentType,
            headers: {
              Authorization: `Bearer ${imageConfig.apiKey}`,
            },
          },
          imageConfig.provider,
          signal,
          (json) => normalizeImageResponseJson(imageConfig.provider, json),
        );
      } else {
        response = await postJSON(
          endpoint,
          {
            method: "POST",
            body: JSON.stringify({
              model: request.model || imageConfig.model,
              prompt: promptText,
              ...request.imageGenerationProperties,
            }),
            contentType: "application/json",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${imageConfig.apiKey}`,
            },
          },
          imageConfig.provider,
          signal,
          (json) => normalizeImageResponseJson(imageConfig.provider, json),
        );
      }
      break;
    }
  }

  if (response.status >= 400 && response.json?.error) {
    response.json.error.imageRequest = {
      mode: imageMode,
      model: request.model || imageConfig.model,
      size: request.imageGenerationProperties?.size ?? "",
    };
  }
  return response;
};

const handleTextRequest = async (
  request: AIRequest,
  config: ResolvedAIConfig,
  signal?: AbortSignal,
): Promise<RequestUrlResponse> => {
  const messages = applyOutgoingTokenBudget(
    buildNormalizedMessages(request),
    request.maxOutgoingTokens ?? config.maxOutgoingTokens,
  );
  const activeConfig = config.text;
  const model = request.model || activeConfig.model;

  if (
    (getImageURL(request.image) || hasMessagePartType(messages, "image")) &&
    !activeConfig.multimodalSupport
  ) {
    return createSyntheticResponse(
      `${activeConfig.model} is configured as a text-only model. Choose a model with multimodal support enabled for image analysis requests.`,
      400,
    );
  }

  if (
    ["openai", "openai-compatible", "xai"].includes(activeConfig.provider) &&
    (hasMessagePartType(messages, "file") ||
      hasMessagePartType(messages, "audio"))
  ) {
    return createSyntheticResponse(
      `${activeConfig.provider} does not currently support file or audio message parts in Excalidraw's chat-completions pipeline. Use Google for inline audio/PDF inputs, or Anthropic for PDF documents.`,
      400,
    );
  }

  switch (activeConfig.provider) {
    case "anthropic": {
      const payload = await getAnthropicPayload(
        messages,
        config,
        request,
        signal,
      );
      return await postJSON(
        activeConfig.endpoint,
        {
          method: "POST",
          body: JSON.stringify(payload),
          contentType: "application/json",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": activeConfig.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
        },
        activeConfig.provider,
        signal,
      );
    }
    case "google": {
      const payload = await getGooglePayload(messages, config, request, signal);
      return await postJSON(
        getGoogleEndpoint({ ...activeConfig, model }),
        {
          method: "POST",
          body: JSON.stringify(payload),
          contentType: "application/json",
          headers: {
            "Content-Type": "application/json",
          },
        },
        activeConfig.provider,
        signal,
      );
    }
    default: {
      const body: GPTCompletionRequest = {
        model,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
        ...getTextLimitPayload(model, request.maxTokens ?? config.maxTokens),
        messages: toOpenAIMessages(messages),
      };

      return await postJSON(
        activeConfig.endpoint,
        {
          method: "POST",
          body: JSON.stringify(body),
          contentType: "application/json",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeConfig.apiKey}`,
          },
        },
        activeConfig.provider,
        signal,
      );
    }
  }
};

const requestAI = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<RequestUrlResponse> => {
  const plugin = getPlugin(options.plugin);
  const config = resolveAIConfig(request, plugin);
  if (!plugin || !config) {
    return createSyntheticResponse(
      "Excalidraw AI is not available because the plugin instance could not be resolved.",
      500,
    );
  }

  const isImageGeneration = Boolean(request.imageGenerationProperties);
  const activeApiKey = isImageGeneration
    ? config.image.apiKey
    : config.text.apiKey;

  if (!isImageGeneration && requestHasImageInput(request)) {
    logAIDebug(plugin, "multimodal request routing", [
      debugValueLine(
        "requestedTextModelId",
        request.textModelId || "<default>",
      ),
      debugValueLine(
        "defaultTextModel",
        plugin.settings.aiDefaultTextModel || "<empty>",
      ),
      debugValueLine(
        "defaultMultimodalModel",
        plugin.settings.aiDefaultMultimodalModel || "<empty>",
      ),
      debugValueLine(
        "legacyVisionDefault",
        plugin.settings.aiDefaultVisionModel || "<empty>",
      ),
      debugValueLine("resolvedProvider", config.text.provider),
      debugValueLine("resolvedModel", config.text.model),
      debugValueLine("resolvedEndpoint", config.text.endpoint),
      debugValueLine(
        "multimodalSupport",
        String(config.text.multimodalSupport),
      ),
      debugValueLine("textChars", String(request.text?.length ?? 0)),
      debugValueLine(
        "instructionChars",
        String(request.instruction?.length ?? 0),
      ),
      debugValueLine(
        "maxTokens",
        String(request.maxTokens ?? config.maxTokens ?? 0),
      ),
    ]);
  }

  if (!activeApiKey) {
    new Notice("AI API key is not set. Please set it in plugin settings.");
    return createSyntheticResponse(
      "AI API key is not set. Please set it in plugin settings.",
      401,
    );
  }

  try {
    return isImageGeneration
      ? await handleImageRequest(request, config, options.signal)
      : await handleTextRequest(request, config, options.signal);
  } catch (error: unknown) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";
    if (errorName === "AbortError") {
      return createSyntheticResponse("Request aborted", 499);
    }
    console.log(error);
    const errorMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "Request failed")
        : "Request failed";
    return createSyntheticResponse(errorMessage, 500);
  }
};

const cloneAIRequestMessageContent = (
  content: AIRequestMessage["content"],
): AIRequestMessage["content"] => {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => ({ ...part }));
};

const cloneAIRequestMessage = (
  message: AIRequestMessage,
): AIRequestMessage => ({
  role: message.role,
  content: cloneAIRequestMessageContent(message.content),
});

const buildGenerateAIImageResult = (
  response: RequestUrlResponse,
): GenerateAIImageResult => {
  const json = response?.json;
  const images = Array.isArray(json?.data)
    ? json.data
        .map(
          (image: {
            url?: string;
            b64_json?: string;
            mimeType?: string;
            revised_prompt?: string;
          }) => {
            const mimeType =
              image.mimeType || getMimeTypeForOutputFormat(json?.output_format);
            return {
              url: image.url,
              b64_json: image.b64_json,
              mimeType,
              dataURL: image.b64_json
                ? `data:${mimeType};base64,${image.b64_json}`
                : undefined,
              revisedPrompt: image.revised_prompt,
            } satisfies AIGeneratedImage;
          },
        )
        .filter(
          (image: AIGeneratedImage) =>
            image.url || image.dataURL || image.b64_json,
        )
    : [];

  return {
    response,
    json,
    images,
    firstImage: images[0] ?? null,
    revisedPrompt:
      images.find((image: AIGeneratedImage) => image.revisedPrompt)
        ?.revisedPrompt ?? "",
  };
};

export const postAI = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<RequestUrlResponse> => {
  return await requestAI(request, options);
};

export const postOpenAI = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<RequestUrlResponse> => {
  return await requestAI(request, options);
};

export const generateAIText = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<GenerateAITextResult> => {
  const plugin = getPlugin(options.plugin);
  let response = await requestAI(request, options);
  let json = response?.json;
  let content = getFirstChoiceContent(json);

  if (shouldRetryEmptyMultimodalReasoningResponse(request, response)) {
    const retryMaxTokens = getEmptyMultimodalRetryMaxTokens(request);

    logAIDebug(plugin, "multimodal empty-content retry", [
      debugValueLine("status", String(response?.status ?? 0)),
      debugValueLine(
        "finishReason",
        getFirstChoiceFinishReason(json) || "<empty>",
      ),
      debugValueLine("reasoningTokens", String(getReasoningTokenCount(json))),
      debugValueLine("initialMaxTokens", String(request.maxTokens ?? 0)),
      debugValueLine("retryMaxTokens", String(retryMaxTokens)),
    ]);

    response = await requestAI(
      {
        ...request,
        maxTokens: retryMaxTokens,
      },
      options,
    );
    json = response?.json;
    content = getFirstChoiceContent(json);

    logAIDebug(plugin, "multimodal empty-content retry response", [
      debugValueLine("status", String(response?.status ?? 0)),
      debugValueLine(
        "finishReason",
        getFirstChoiceFinishReason(json) || "<empty>",
      ),
      debugValueLine("reasoningTokens", String(getReasoningTokenCount(json))),
      debugValueLine("contentChars", String(content.length)),
      debugValueLine("content", content || "<empty>"),
      debugValueLine("responseJson", json),
    ]);
  }

  const rateLimitHeader = getHeaderValue(
    response?.headers,
    "x-ratelimit-limit",
  );
  const rateLimitRemainingHeader = getHeaderValue(
    response?.headers,
    "x-ratelimit-remaining",
  );

  if (requestHasImageInput(request) && !request.imageGenerationProperties) {
    logAIDebug(plugin, "multimodal response", [
      debugValueLine("status", String(response?.status ?? 0)),
      debugValueLine(
        "finishReason",
        getFirstChoiceFinishReason(json) || "<empty>",
      ),
      debugValueLine("reasoningTokens", String(getReasoningTokenCount(json))),
      debugValueLine("contentChars", String(content.length)),
      debugValueLine("content", content || "<empty>"),
      debugValueLine("responseText", response?.text ?? "<empty>"),
      debugValueLine("responseJson", json),
    ]);
  }

  // Record session-scoped token usage for metering.
  if (response?.status < 400) {
    const meteredModel =
      (json?.model as string | undefined) || request.model || "unknown";
    const inputTokens =
      (json?.usage as Record<string, number> | undefined)?.prompt_tokens ?? 0;
    const outputTokens =
      (json?.usage as Record<string, number> | undefined)?.completion_tokens ??
      0;
    recordAITextUsage(meteredModel, inputTokens, outputTokens);
  }

  return {
    response,
    json,
    content,
    rateLimit:
      rateLimitHeader && !Number.isNaN(Number(rateLimitHeader))
        ? Number(rateLimitHeader)
        : null,
    rateLimitRemaining:
      rateLimitRemainingHeader &&
      !Number.isNaN(Number(rateLimitRemainingHeader))
        ? Number(rateLimitRemainingHeader)
        : null,
  };
};

export const getAISettings = (
  plugin?: ExcalidrawPlugin,
): ExcalidrawAISettings | null => {
  const resolvedPlugin = getPlugin(plugin);
  if (!resolvedPlugin) {
    return null;
  }

  const providerProfiles = getProviderProfiles(resolvedPlugin);
  const textModels = Object.fromEntries(
    Object.entries(getModelConfigs(resolvedPlugin, "text")).map(
      ([modelId, config]) => [
        modelId,
        {
          ...config,
          multimodalSupport: config.multimodalSupport !== false,
        },
      ],
    ),
  );
  const imageModels = Object.fromEntries(
    Object.entries(
      getModelConfigs(resolvedPlugin, "image") as Record<
        string,
        AIImageModelConfig
      >,
    ).map(([modelId, config]) => {
      const legacySupportsImageEdits = (
        config as AIImageModelConfig & { supportsImageEdits?: boolean }
      ).supportsImageEdits;
      const geminiSupportedSizes = getGeminiSupportedSizes(
        providerProfiles[config.providerId]?.provider,
        config.model,
      );
      return [
        modelId,
        {
          ...config,
          supportedSizes:
            geminiSupportedSizes.length > 0
              ? geminiSupportedSizes
              : [...(config.supportedSizes ?? ["1024x1024"])],
          supportsPromptImageTransforms:
            config.supportsPromptImageTransforms ??
            legacySupportsImageEdits ??
            true,
          supportsMaskImageEdits:
            config.supportsMaskImageEdits ?? legacySupportsImageEdits ?? true,
        },
      ];
    }),
  ) as Record<string, AIImageModelConfig>;

  return {
    enabled: resolvedPlugin.settings.aiEnabled ?? true,
    providerProfiles: Object.fromEntries(
      Object.entries(providerProfiles).map(([providerId, profile]) => [
        providerId,
        {
          provider: profile.provider,
          baseURL:
            inferConfiguredBaseURL(profile.baseURL) ||
            DEFAULT_PROVIDER_BASE_URLS[profile.provider],
          hasApiKey: Boolean(profile.apiKey?.trim()),
        },
      ]),
    ),
    textModels,
    imageModels,
    defaultTextModel: getSelectedModelConfigId(resolvedPlugin, "text", {}),
    defaultMultimodalTextModel: getSelectedModelConfigId(
      resolvedPlugin,
      "text",
      {},
      true,
    ),
    defaultImageModel: getSelectedModelConfigId(resolvedPlugin, "image", {}),
    defaultMaxOutgoingTokens:
      resolvedPlugin.settings.aiDefaultMaxOutgoingTokens || 0,
    defaultMaxResponseTokens:
      resolvedPlugin.settings.aiDefaultMaxResponseTokens ||
      resolvedPlugin.settings.aiDefaultMaxTokens ||
      resolvedPlugin.settings.openAIDefaultTextModelMaxTokens,
  };
};

export const analyzeAIImage = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<GenerateAITextResult> => {
  if (!requestHasImageInput(request)) {
    const response = createSyntheticResponse(
      "Image analysis requires an input image.",
      400,
    );
    return {
      response,
      json: response.json,
      content: "",
      rateLimit: null,
      rateLimitRemaining: null,
    };
  }

  return await generateAIText(request, options);
};

export const generateAIImage = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<GenerateAIImageResult> => {
  const plugin = getPlugin(options.plugin);
  const config = resolveAIConfig(request, plugin);
  const imageModelId = config?.image.model ?? request.model ?? "unknown";
  const response = await requestAI(
    {
      ...request,
      imageGenerationProperties: {
        ...(request.imageGenerationProperties ?? {}),
        n: request.imageGenerationProperties?.n ?? 1,
      },
    },
    options,
  );
  const result = buildGenerateAIImageResult(response);
  if (result.images.length > 0) {
    recordAIImageGenerationUsage(imageModelId, result.images.length);
  }
  return result;
};

export const transformAIImage = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<GenerateAIImageResult> => {
  if (!request.image) {
    return buildGenerateAIImageResult(
      createSyntheticResponse("Image transforms require an input image.", 400),
    );
  }

  const plugin = getPlugin(options.plugin);
  const config = resolveAIConfig(request, plugin);
  const imageModelId = config?.image.model ?? request.model ?? "unknown";
  const response = await requestAI(
    {
      ...request,
      imageGenerationProperties: {
        ...(request.imageGenerationProperties ?? {}),
        n: request.imageGenerationProperties?.n ?? 1,
        mask: undefined,
      },
    },
    options,
  );
  const result = buildGenerateAIImageResult(response);
  if (result.images.length > 0) {
    recordAIImageGenerationUsage(imageModelId, result.images.length);
  }
  return result;
};

export const maskEditAIImage = async (
  request: AIRequest,
  options: GenerateAITextOptions = {},
): Promise<GenerateAIImageResult> => {
  if (!request.image) {
    return buildGenerateAIImageResult(
      createSyntheticResponse("Mask edits require an input image.", 400),
    );
  }
  if (!request.imageGenerationProperties?.mask) {
    return buildGenerateAIImageResult(
      createSyntheticResponse("Mask edits require a mask image.", 400),
    );
  }

  const plugin = getPlugin(options.plugin);
  const config = resolveAIConfig(request, plugin);
  const imageModelId = config?.image.model ?? request.model ?? "unknown";
  const response = await requestAI(
    {
      ...request,
      imageGenerationProperties: {
        ...(request.imageGenerationProperties ?? {}),
        n: request.imageGenerationProperties?.n ?? 1,
      },
    },
    options,
  );
  const result = buildGenerateAIImageResult(response);
  if (result.images.length > 0) {
    recordAIImageGenerationUsage(imageModelId, result.images.length);
  }
  return result;
};

export const createAIChatSession = (
  initialRequest: Omit<AIRequest, "messages"> = {},
  options: GenerateAITextOptions = {},
): AIChatSession => {
  const messages: AIRequestMessage[] = [];

  return {
    getMessages: () => messages.map(cloneAIRequestMessage),
    reset: () => {
      messages.length = 0;
    },
    send: async (
      message: string | AIRequestMessage | AIRequestMessagePart[],
      requestOverrides: Omit<AIRequest, "messages"> = {},
    ) => {
      const nextMessage =
        typeof message === "string"
          ? { role: "user" as const, content: message }
          : Array.isArray(message)
            ? { role: "user" as const, content: message }
            : message;

      messages.push(cloneAIRequestMessage(nextMessage));
      const result = await generateAIText(
        {
          ...initialRequest,
          ...requestOverrides,
          messages: messages.map(cloneAIRequestMessage),
        },
        options,
      );

      if (result.content?.trim()) {
        messages.push({ role: "assistant", content: result.content });
      }

      return result;
    },
  };
};

/**
 * Grabs the codeblock contents from the supplied markdown string.
 * @param markdown
 * @param codeblockType
 * @returns an array of dictionaries with the codeblock contents and type
 */
export const extractCodeBlocks = (
  markdown: string,
): { data: string; type: string }[] => {
  if (!markdown) {
    return [];
  }

  markdown = markdown.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const result: { data: string; type: string }[] = [];
  const regex = /```([^\n`]*)\n([\s\S]+?)```/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const codeblockType = (match[1] ?? "").trim().split(/\s+/)[0] ?? "";
    const codeblockString = match[2].trim();
    result.push({ data: codeblockString, type: codeblockType });
  }

  return result;
};

export const errorHTML = (message: string) => `<html>
  <body style="margin: 0; text-align: center">
  <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
    <div style="color:red">There was an error during generation</div>
    </br>
    </br>
    <div>${message}</div>
  </div>
  </body>
  </html>`;
