import { arrayBufferToBase64, base64ToArrayBuffer, Notice, RequestUrlResponse, requestUrl } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import {
  AIImageModelConfig,
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
};

type ResolvedImageConfig = ResolvedModelConfig & {
  supportedSizes: string[];
  supportsImageEdits: boolean;
};

type ResolvedAIConfig = {
  text: ResolvedModelConfig;
  vision: ResolvedModelConfig;
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
  json: any;
  content: string;
  rateLimit: number | null;
  rateLimitRemaining: number | null;
};

const DEFAULT_PROVIDER_BASE_URLS: Record<AIProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  xai: "https://api.x.ai/v1",
  "openai-compatible": "https://api.openai.com/v1",
};

const ANTHROPIC_VERSION = "2023-06-01";

const getPlugin = (plugin?: ExcalidrawPlugin): ExcalidrawPlugin | null => {
  return plugin ?? window?.ExcalidrawAutomate?.plugin ?? null;
};

const getAssetSource = (asset?: AIImageInput | AIFileInput): string => {
  if (!asset) return null;
  if (typeof asset === "string") return asset;
  if ("url" in asset) return asset.url;
  if ("dataURL" in asset) return asset.dataURL;
  return null;
};

const getImageURL = (image?: AIImageInput | AIFileInput): string => {
  return getAssetSource(image);
};

const getAssetMimeType = (asset?: AIImageInput | AIFileInput): string | undefined => {
  if (!asset || typeof asset === "string") return undefined;
  return asset.mimeType;
};

const getAssetFilename = (asset?: AIImageInput | AIFileInput): string | undefined => {
  if (!asset || typeof asset === "string") return undefined;
  return asset.filename;
};

const getImageDetail = (image?: AIImageInput): "low" | "high" | "auto" | undefined => {
  if (!image || typeof image === "string") return undefined;
  return image.detail;
};

const normalizeBinaryInput = (
  asset: AIImageInput | AIFileInput,
): NormalizedBinaryInput | null => {
  const source = getAssetSource(asset);
  if (!source) return null;
  return {
    source,
    mimeType: getAssetMimeType(asset),
    filename: getAssetFilename(asset),
    ...(getImageDetail(asset as AIImageInput) ? { detail: getImageDetail(asset as AIImageInput) } : {}),
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
  if (!normalized) return "";
  return normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : normalized;
};

const inferConfiguredBaseURL = (url: string): string => {
  const normalized = normalizeBaseURL(url);
  if (!normalized) return "";

  const matchingSuffix = AI_BASE_URL_SUFFIXES.find(suffix => normalized.endsWith(suffix));
  return matchingSuffix ? normalized.slice(0, -matchingSuffix.length) : normalized;
};

const getResolvedProvider = (request: AIRequest, plugin: ExcalidrawPlugin): AIProvider => {
  return request.provider
    ?? plugin.settings.aiProvider
    ?? "openai";
};

const getProviderProfiles = (plugin: ExcalidrawPlugin): Record<string, AIProviderProfile> => {
  return plugin.settings.aiProviderProfiles && Object.keys(plugin.settings.aiProviderProfiles).length > 0
    ? plugin.settings.aiProviderProfiles
    : {
        OpenAI: {
          provider: plugin.settings.aiProvider ?? "openai",
          apiKey: plugin.settings.aiAPIKey || plugin.settings.openAIAPIToken,
          baseURL: inferConfiguredBaseURL(plugin.settings.aiBaseURL)
            || inferLegacyBaseURL(plugin.settings.openAIURL, "/chat/completions")
            || DEFAULT_PROVIDER_BASE_URLS[plugin.settings.aiProvider ?? "openai"],
        },
      };
};

const getDefaultProviderProfileId = (plugin: ExcalidrawPlugin): string => {
  const profiles = getProviderProfiles(plugin);
  return Object.keys(profiles)[0] ?? "OpenAI";
};

const getModelConfigs = (plugin: ExcalidrawPlugin, kind: "text" | "vision" | "image") => {
  if (kind === "text") {
    return plugin.settings.aiTextModelConfigs && Object.keys(plugin.settings.aiTextModelConfigs).length > 0
      ? plugin.settings.aiTextModelConfigs
      : {
          [plugin.settings.aiDefaultTextModel || plugin.settings.openAIDefaultTextModel || "gpt-5-mini"]: {
            providerId: getDefaultProviderProfileId(plugin),
            model: plugin.settings.aiDefaultTextModel || plugin.settings.openAIDefaultTextModel || "gpt-5-mini",
            endpoint: plugin.settings.aiTextEndpoint || plugin.settings.openAIURL || "",
          },
        };
  }
  if (kind === "vision") {
    return plugin.settings.aiVisionModelConfigs && Object.keys(plugin.settings.aiVisionModelConfigs).length > 0
      ? plugin.settings.aiVisionModelConfigs
      : {
          [plugin.settings.aiDefaultVisionModel || plugin.settings.openAIDefaultVisionModel || "gpt-5-mini"]: {
            providerId: getDefaultProviderProfileId(plugin),
            model: plugin.settings.aiDefaultVisionModel || plugin.settings.openAIDefaultVisionModel || "gpt-5-mini",
            endpoint: plugin.settings.aiTextEndpoint || plugin.settings.openAIURL || "",
          },
        };
  }
  return plugin.settings.aiImageModelConfigs && Object.keys(plugin.settings.aiImageModelConfigs).length > 0
    ? plugin.settings.aiImageModelConfigs
    : {
        [plugin.settings.aiDefaultImageGenerationModel || plugin.settings.openAIDefaultImageGenerationModel || "gpt-image-1"]: {
          providerId: getDefaultProviderProfileId(plugin),
          model: plugin.settings.aiDefaultImageGenerationModel || plugin.settings.openAIDefaultImageGenerationModel || "gpt-image-1",
          supportedSizes: plugin.settings.aiImageModelCapabilities?.[plugin.settings.aiDefaultImageGenerationModel || plugin.settings.openAIDefaultImageGenerationModel || "gpt-image-1"]?.supportedSizes ?? ["1024x1024"],
          supportsImageEdits: plugin.settings.aiImageModelCapabilities?.[plugin.settings.aiDefaultImageGenerationModel || plugin.settings.openAIDefaultImageGenerationModel || "gpt-image-1"]?.supportsImageEdits ?? true,
        },
      };
};

const getSelectedModelConfigId = (plugin: ExcalidrawPlugin, kind: "text" | "vision" | "image") => {
  const configuredId = kind === "text"
    ? plugin.settings.aiDefaultTextModel
    : kind === "vision"
      ? plugin.settings.aiDefaultVisionModel
      : plugin.settings.aiDefaultImageGenerationModel;
  const configs = getModelConfigs(plugin, kind);
  return configs[configuredId] ? configuredId : Object.keys(configs)[0];
};

const getDerivedTextEndpoint = (provider: AIProvider, baseURL: string, endpoint?: string): string => {
  if (provider === "google") return endpoint || baseURL;
  if (provider === "anthropic") return endpoint || joinURL(baseURL, "/messages");
  return endpoint || joinURL(baseURL, "/chat/completions");
};

const getResolvedModelConfig = (
  plugin: ExcalidrawPlugin,
  kind: "text" | "vision" | "image",
  request: AIRequest,
): ResolvedModelConfig | ResolvedImageConfig => {
  const configs = getModelConfigs(plugin, kind);
  const selectedConfigId = getSelectedModelConfigId(plugin, kind);
  const selectedConfig = (configs[selectedConfigId] || Object.values(configs)[0]) as AIModelConfig | AIImageModelConfig;
  const profile = getProviderProfiles(plugin)[selectedConfig?.providerId] || Object.values(getProviderProfiles(plugin))[0];
  const provider = request.provider ?? profile?.provider ?? getResolvedProvider(request, plugin);
  const hasRequestBaseURL = Boolean(request.baseURL?.trim());
  const baseURL = normalizeBaseURL(
    (hasRequestBaseURL ? inferConfiguredBaseURL(request.baseURL) : "")
      || inferConfiguredBaseURL(profile?.baseURL)
      || DEFAULT_PROVIDER_BASE_URLS[provider],
  );
  const endpoint = kind === "image"
    ? ""
    : hasRequestBaseURL
      ? getDerivedTextEndpoint(provider, baseURL)
      : getDerivedTextEndpoint(provider, baseURL, selectedConfig?.endpoint?.trim());

  const result: ResolvedModelConfig = {
    provider,
    apiKey: request.apiKey?.trim() || profile?.apiKey || plugin.settings.aiAPIKey || plugin.settings.openAIAPIToken,
    baseURL,
    endpoint,
    model: request.model?.trim() || selectedConfig?.model || "",
  };

  if (kind !== "image") {
    return result;
  }

  const imageConfig = selectedConfig as AIImageModelConfig;
  return {
    ...result,
    supportedSizes: [...(imageConfig.supportedSizes ?? ["1024x1024"])],
    supportsImageEdits: imageConfig.supportsImageEdits !== false,
  };
};

const resolveAIConfig = (request: AIRequest, plugin?: ExcalidrawPlugin): ResolvedAIConfig | null => {
  const resolvedPlugin = getPlugin(plugin);
  if (!resolvedPlugin) return null;

  return {
    text: getResolvedModelConfig(resolvedPlugin, "text", request) as ResolvedModelConfig,
    vision: getResolvedModelConfig(resolvedPlugin, "vision", request) as ResolvedModelConfig,
    image: getResolvedModelConfig(resolvedPlugin, "image", request) as ResolvedImageConfig,
    maxTokens: resolvedPlugin.settings.aiDefaultMaxResponseTokens
      || resolvedPlugin.settings.aiDefaultMaxTokens
      || resolvedPlugin.settings.openAIDefaultTextModelMaxTokens,
    maxOutgoingTokens: resolvedPlugin.settings.aiDefaultMaxOutgoingTokens || 0,
  };
};

const createSyntheticResponse = (
  message: string,
  status: number = 400,
  extraJson: Record<string, any> = {},
): RequestUrlResponse => ({
  status,
  headers: {} as any,
  text: null,
  json: {
    error: {
      message,
    },
    ...extraJson,
  },
  arrayBuffer: null,
});

const getHeaderValue = (headers: RequestUrlResponse["headers"], key: string): string | null => {
  if (!headers) return null;
  const normalizedKey = key.toLowerCase();
  const headerObject = headers as Record<string, string>;
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
  if (!model) return false;
  return ["gpt-4o", "gpt-5", "o1", "o3", "o4"].some(prefix => model.includes(prefix));
};

const getTextLimitPayload = (model: string, maxTokens: number): { max_tokens?: number; max_completion_tokens?: number } => {
  if (!maxTokens || maxTokens <= 0) return {};
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
};

const normalizeMessagePart = (part: AIRequestMessagePart): NormalizedMessagePart | null => {
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

const normalizeRequestMessage = (message: AIRequestMessage): NormalizedMessage | null => {
  if (!message) return null;
  if (typeof message.content === "string") {
    return message.content.trim() === ""
      ? null
      : { role: message.role, content: message.content };
  }

  const parts = message.content
    .map(normalizeMessagePart)
    .filter(Boolean);

  return parts.length === 0 ? null : { role: message.role, content: parts };
};

const buildNormalizedMessages = (request: AIRequest): NormalizedMessage[] => {
  const messages = request.messages
    ?.map(normalizeRequestMessage)
    .filter(Boolean) ?? [];

  if (messages.length > 0) {
    if (request.systemPrompt?.trim()) {
      messages.unshift({ role: "system", content: request.systemPrompt.trim() });
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
    builtMessages.push({ role: "system", content: request.systemPrompt.trim() });
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
  if (!text || budget <= 0) return "";
  const maxChars = Math.max(1, budget * 4);
  if (text.length <= maxChars) return text;
  return `[truncated]\n${text.slice(-maxChars)}`;
};

const limitContentByOutgoingTokenBudget = (
  content: string | NormalizedMessagePart[],
  budget: number,
): { content: string | NormalizedMessagePart[] | null; remaining: number } => {
  if (typeof content === "string") {
    if (budget <= 0) return { content: null, remaining: 0 };
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
    const limited = limitContentByOutgoingTokenBudget(message.content, remaining);
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
  if (typeof content === "string") return content;

  return content
    .filter(part => part.type === "text" || part.type === "image")
    .map(part => part.type === "text"
      ? { type: "text" as const, text: part.text }
      : {
          type: "image_url" as const,
          image_url: {
            url: part.image.source,
            detail: part.image.detail ?? "high" as const,
          },
        });
};

const toOpenAIMessages = (messages: NormalizedMessage[]): GPTCompletionRequest["messages"] => {
  return messages.map(message => ({
    role: message.role,
    content: toOpenAIContent(message.content),
  }));
};

const parseDataURL = (dataURL: string): { mediaType: string; data: string } | null => {
  const match = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mediaType: match[1],
    data: match[2],
  };
};

const getFilenameFromMimeType = (mimeType: string, fallback: string): string => {
  const normalized = (mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) return `${fallback}.png`;
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return `${fallback}.jpg`;
  if (normalized.includes("webp")) return `${fallback}.webp`;
  if (normalized.includes("gif")) return `${fallback}.gif`;
  if (normalized.includes("svg")) return `${fallback}.svg`;
  return `${fallback}.bin`;
};

const getBinaryAssetData = async (
  asset: string | NormalizedBinaryInput,
  signal?: AbortSignal,
  fallback: string = "file",
): Promise<{ mediaType: string; data: ArrayBuffer; filename: string } | null> => {
  const source = typeof asset === "string" ? asset : asset?.source;
  const preferredMimeType = typeof asset === "string" ? undefined : asset?.mimeType;
  const preferredFilename = typeof asset === "string" ? undefined : asset?.filename;

  if (!source) return null;

  const parsed = parseDataURL(source);
  if (parsed) {
    const mediaType = preferredMimeType || parsed.mediaType;
    return {
      mediaType,
      data: base64ToArrayBuffer(parsed.data),
      filename: preferredFilename || getFilenameFromMimeType(mediaType, fallback),
    };
  }

  if (/^https?:\/\//i.test(source)) {
    const response = await requestUrlWithAbort({
      url: source,
      method: "GET",
    }, signal);

    if (response.status >= 400 || !response.arrayBuffer) {
      throw new Error(`Unable to download file from ${source}`);
    }

    const mediaType = preferredMimeType || getHeaderValue(response.headers, "content-type") || "application/octet-stream";
    return {
      mediaType,
      data: response.arrayBuffer,
      filename: preferredFilename || getFilenameFromMimeType(mediaType, fallback),
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
  if (!binary) return null;
  return {
    mediaType: binary.mediaType,
    data: arrayBufferToBase64(binary.data),
    filename: binary.filename,
  };
};

const toAnthropicContent = async (content: string | NormalizedMessagePart[], signal?: AbortSignal) => {
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
      if (!inlineImage) continue;
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
      const inlineFile = await toInlineBinaryData(part.file, signal, "document");
      if (!inlineFile) continue;
      if (inlineFile.mediaType !== "application/pdf") {
        throw new Error("Anthropic file attachments currently support PDF documents only in ExcalidrawAutomate.");
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

    throw new Error("Anthropic audio attachments are not currently supported by ExcalidrawAutomate.");
  }
  return parts;
};

const getAnthropicPayload = async (messages: NormalizedMessage[], config: ResolvedAIConfig, request: AIRequest, signal?: AbortSignal) => {
  const system = messages
    .filter(message => message.role === "system")
    .map(message => typeof message.content === "string"
      ? message.content
      : message.content.filter(part => part.type === "text").map(part => part.text).join("\n"))
    .filter(Boolean)
    .join("\n\n");

  const requestMessages = [];
  for (const message of messages.filter(item => item.role !== "system")) {
    requestMessages.push({
      role: message.role,
      content: await toAnthropicContent(message.content, signal),
    });
  }

  return {
    model: request.model || (request.image ? config.vision.model : config.text.model),
    max_tokens: request.maxTokens ?? config.maxTokens,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(system ? { system } : {}),
    messages: requestMessages,
  };
};

const toGoogleParts = async (content: string | NormalizedMessagePart[], signal?: AbortSignal) => {
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
      part.type === "image" ? part.image : part.type === "file" ? part.file : part.audio,
      signal,
      part.type === "audio" ? "audio" : part.type === "image" ? "image" : "document",
    );
    if (!inlineData) continue;
    parts.push({
      inlineData: {
        mimeType: inlineData.mediaType,
        data: inlineData.data,
      },
    });
  }
  return parts;
};

const getGooglePayload = async (messages: NormalizedMessage[], config: ResolvedAIConfig, request: AIRequest, signal?: AbortSignal) => {
  const systemInstruction = messages
    .filter(message => message.role === "system")
    .map(message => typeof message.content === "string"
      ? { text: message.content }
      : message.content.filter(part => part.type === "text").map(part => ({ text: part.text })))
    .flat();

  const contents = [];
  for (const message of messages.filter(item => item.role !== "system")) {
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: await toGoogleParts(message.content, signal),
    });
  }

  return {
    ...(systemInstruction.length > 0 ? { systemInstruction: { parts: systemInstruction } } : {}),
    contents,
    generationConfig: {
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens ?? config.maxTokens ? { maxOutputTokens: request.maxTokens ?? config.maxTokens } : {}),
    },
  };
};

const getGoogleEndpoint = (config: ResolvedModelConfig): string => {
  const separator = config.endpoint.includes("?") ? "&" : "?";
  return `${normalizeBaseURL(config.endpoint)}/models/${config.model}:generateContent${separator}key=${encodeURIComponent(config.apiKey)}`;
};

const normalizeAnthropicResponse = (json: any) => {
  const text = json?.content
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
      total_tokens: (json?.usage?.input_tokens ?? 0) + (json?.usage?.output_tokens ?? 0),
    },
  };
};

const normalizeGoogleResponse = (json: any) => {
  const text = json?.candidates?.[0]?.content?.parts
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

const normalizeResponseJson = (provider: AIProvider, json: any) => {
  if (!json || json.error) return json;
  switch (provider) {
    case "anthropic":
      return normalizeAnthropicResponse(json);
    case "google":
      return normalizeGoogleResponse(json);
    default:
      return json;
  }
};

const hasMessagePartType = (messages: NormalizedMessage[], type: NormalizedMessagePart["type"]): boolean => {
  return messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === type));
};

const trimTextForImagePrompt = (text: string | undefined, maxOutgoingTokens?: number): string | undefined => {
  if (!text?.trim() || !maxOutgoingTokens || maxOutgoingTokens <= 0) {
    return text;
  }
  const tokenCount = estimateTokenCount(text);
  return tokenCount <= maxOutgoingTokens ? text : trimTextToTokenBudget(text, maxOutgoingTokens);
};

const getErrorMessageFromResponse = (response: RequestUrlResponse): string => {
  if (response.json?.error?.message) return response.json.error.message;
  if (typeof response.text === "string" && response.text.trim()) return response.text.trim();
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
): Promise<RequestUrlResponse> => {
  const result = await requestUrlWithAbort({
    url,
    method: init.method,
    body: init.body,
    headers: init.headers,
    contentType: init.contentType,
  }, signal);

  const normalizedJson = normalizeResponseJson(provider, result.json);
  if (result.status >= 400) {
    return {
      status: result.status,
      headers: result.headers,
      text: result.text,
      json: {
        ...(normalizedJson && typeof normalizedJson === "object" ? normalizedJson : {}),
        error: {
          ...(normalizedJson?.error ?? {}),
          message: getErrorMessageFromResponse({ ...result, json: normalizedJson } as RequestUrlResponse),
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
  files: Array<{ name: string; filename: string; contentType: string; data: ArrayBuffer }>,
): { contentType: string; body: ArrayBuffer } => {
  const boundary = `----ExcalidrawAIBoundary${Date.now().toString(16)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const field of fields) {
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`));
    chunks.push(encoder.encode(`${field.value}\r\n`));
  }

  for (const file of files) {
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode(`Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n`));
    chunks.push(encoder.encode(`Content-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(new Uint8Array(file.data));
    chunks.push(encoder.encode("\r\n"));
  }

  chunks.push(encoder.encode(`--${boundary}--\r\n`));
  const combined = concatUint8Arrays(chunks);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength) as ArrayBuffer,
  };
};

const handleImageRequest = async (
  request: AIRequest,
  config: ResolvedAIConfig,
  signal?: AbortSignal,
): Promise<RequestUrlResponse> => {
  const imageConfig = config.image;
  if (!["openai", "openai-compatible"].includes(imageConfig.provider)) {
    return createSyntheticResponse(
      `${imageConfig.provider} does not currently support image generation or editing in Excalidraw. Switch to OpenAI or an OpenAI-compatible endpoint for image requests.`,
      400,
    );
  }

  const image = getImageURL(request.image);
  const mask = getImageURL(request.imageGenerationProperties?.mask);
  const isEditing = Boolean(mask || image);
  const endpoint = isEditing
    ? joinURL(imageConfig.baseURL, "/images/edits")
    : joinURL(imageConfig.baseURL, "/images/generations");
  const imageMode = isEditing ? "edit" : "generation";
  const promptText = trimTextForImagePrompt(request.text?.trim(), request.maxOutgoingTokens ?? config.maxOutgoingTokens);

  if (isEditing) {
    const fields: Array<{ name: string; value: string }> = [
      { name: "model", value: request.model || imageConfig.model },
    ];
    if (promptText) {
      fields.push({ name: "prompt", value: promptText });
    }
    if (request.imageGenerationProperties?.size) {
      fields.push({ name: "size", value: request.imageGenerationProperties.size });
    }
    if (request.imageGenerationProperties?.n) {
      fields.push({ name: "n", value: String(request.imageGenerationProperties.n) });
    }
    if (request.imageGenerationProperties?.quality) {
      fields.push({ name: "quality", value: request.imageGenerationProperties.quality });
    }

    const files: Array<{ name: string; filename: string; contentType: string; data: ArrayBuffer }> = [];

    if (image) {
      const imageFile = await getBinaryAssetData(normalizeBinaryInput(request.image), signal, "image");
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
      const maskFile = await getBinaryAssetData(normalizeBinaryInput(request.imageGenerationProperties?.mask), signal, "mask");
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
    const response = await postJSON(endpoint, {
      method: "POST",
      body: multipart.body,
      contentType: multipart.contentType,
      headers: {
        Authorization: `Bearer ${imageConfig.apiKey}`,
      },
    }, imageConfig.provider, signal);

    if (response.status >= 400 && response.json?.error) {
      response.json.error.imageRequest = {
        mode: imageMode,
        model: request.model || imageConfig.model,
        size: request.imageGenerationProperties?.size ?? "",
      };
    }
    return response;
  }

  const payload = {
    model: request.model || imageConfig.model,
    prompt: promptText,
    ...request.imageGenerationProperties,
  };

  const response = await postJSON(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
    contentType: "application/json",
    headers: {
      "Content-Type": "application/json",
        Authorization: `Bearer ${imageConfig.apiKey}`,
    },
    }, imageConfig.provider, signal);

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
  const activeConfig = getImageURL(request.image) || hasMessagePartType(messages, "image") ? config.vision : config.text;
  const model = request.model || activeConfig.model;

  if (["openai", "openai-compatible", "xai"].includes(activeConfig.provider)
    && (hasMessagePartType(messages, "file") || hasMessagePartType(messages, "audio"))) {
    return createSyntheticResponse(
      `${activeConfig.provider} does not currently support file or audio message parts in Excalidraw's chat-completions pipeline. Use Google for inline audio/PDF inputs, or Anthropic for PDF documents.`,
      400,
    );
  }

  switch (activeConfig.provider) {
    case "anthropic": {
      const payload = await getAnthropicPayload(messages, config, request, signal);
      return await postJSON(activeConfig.endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": activeConfig.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
      }, activeConfig.provider, signal);
    }
    case "google": {
      const payload = await getGooglePayload(messages, config, request, signal);
      return await postJSON(getGoogleEndpoint({ ...activeConfig, model }), {
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
      }, activeConfig.provider, signal);
    }
    default: {
      const body: GPTCompletionRequest = {
        model,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...getTextLimitPayload(model, request.maxTokens ?? config.maxTokens),
        messages: toOpenAIMessages(messages),
      };

      return await postJSON(activeConfig.endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeConfig.apiKey}`,
        },
      }, activeConfig.provider, signal);
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
    return createSyntheticResponse("Excalidraw AI is not available because the plugin instance could not be resolved.", 500);
  }

  const isImageGeneration = Boolean(request.imageGenerationProperties);
  const hasVisionInput = Boolean(
    request.image
    || request.messages?.some(message => Array.isArray(message.content) && message.content.some(part => part.type === "image")),
  );
  const activeApiKey = isImageGeneration
    ? config.image.apiKey
    : hasVisionInput
      ? config.vision.apiKey
      : config.text.apiKey;

  if (!activeApiKey) {
    new Notice("AI API key is not set. Please set it in plugin settings.");
    return createSyntheticResponse("AI API key is not set. Please set it in plugin settings.", 401);
  }

  try {
    return isImageGeneration
      ? await handleImageRequest(request, config, options.signal)
      : await handleTextRequest(request, config, options.signal);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return createSyntheticResponse("Request aborted", 499);
    }
    console.log(error);
    return createSyntheticResponse(error?.message ?? "Request failed", 500);
  }
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
  const response = await requestAI(request, options);
  const json = response?.json;
  const content = json?.choices?.[0]?.message?.content ?? "";
  const rateLimitHeader = getHeaderValue(response?.headers, "x-ratelimit-limit");
  const rateLimitRemainingHeader = getHeaderValue(response?.headers, "x-ratelimit-remaining");

  return {
    response,
    json,
    content,
    rateLimit: rateLimitHeader && !Number.isNaN(Number(rateLimitHeader)) ? Number(rateLimitHeader) : null,
    rateLimitRemaining: rateLimitRemainingHeader && !Number.isNaN(Number(rateLimitRemainingHeader)) ? Number(rateLimitRemainingHeader) : null,
  };
};

/**
 * Grabs the codeblock contents from the supplied markdown string.
 * @param markdown 
 * @param codeblockType 
 * @returns an array of dictionaries with the codeblock contents and type
 */
export const extractCodeBlocks = (markdown: string): { data: string, type: string }[] => {
  if (!markdown) return [];

  markdown = markdown.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const result: { data: string, type: string }[] = [];
  const regex = /```([^\n`]*)\n([\s\S]+?)```/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const codeblockType = (match[1] ?? "").trim().split(/\s+/)[0] ?? "";
    const codeblockString = match[2].trim();
    result.push({ data: codeblockString, type: codeblockType });
  }

  return result;
}

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