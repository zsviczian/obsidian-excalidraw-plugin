import { arrayBufferToBase64, base64ToArrayBuffer, Notice, RequestUrlResponse, requestUrl } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import {
  AIImageInput,
  AIProvider,
  AIRequest,
  AIRequestMessage,
  AIRequestMessagePart,
  GPTCompletionRequest,
} from "src/types/AIUtilTypes";

type NormalizedMessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

type NormalizedMessage = {
  role: "system" | "user" | "assistant";
  content: string | NormalizedMessagePart[];
};

type ResolvedAIConfig = {
  provider: AIProvider;
  apiKey: string;
  textModel: string;
  visionModel: string;
  imageModel: string;
  maxTokens: number;
  textEndpoint: string;
  imageGenerationEndpoint: string;
  imageEditsEndpoint: string;
  imageVariationsEndpoint: string;
  baseURL: string;
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

const getImageURL = (image?: AIImageInput): string => {
  if (!image) return null;
  return typeof image === "string" ? image : image.url;
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

const resolveAIConfig = (request: AIRequest, plugin?: ExcalidrawPlugin): ResolvedAIConfig | null => {
  const resolvedPlugin = getPlugin(plugin);
  if (!resolvedPlugin) return null;

  const provider = getResolvedProvider(request, resolvedPlugin);
  const legacyTextBaseURL = inferLegacyBaseURL(resolvedPlugin.settings.openAIURL, "/chat/completions");
  const baseURL = normalizeBaseURL(
    inferConfiguredBaseURL(resolvedPlugin.settings.aiBaseURL)
      || legacyTextBaseURL
      || DEFAULT_PROVIDER_BASE_URLS[provider],
  );

  const textEndpoint = provider === "google"
    ? baseURL
    : provider === "anthropic"
      ? joinURL(baseURL, "/messages")
      : resolvedPlugin.settings.aiTextEndpoint
        || resolvedPlugin.settings.openAIURL
        || joinURL(baseURL, "/chat/completions");

  const imageGenerationEndpoint = resolvedPlugin.settings.aiImageGenerationEndpoint
    || resolvedPlugin.settings.openAIImageGenerationURL
    || joinURL(baseURL, "/images/generations");

  const imageEditsEndpoint = resolvedPlugin.settings.aiImageEditsEndpoint
    || resolvedPlugin.settings.openAIImageEditsURL
    || joinURL(baseURL, "/images/edits");

  const imageVariationsEndpoint = resolvedPlugin.settings.aiImageVariationsEndpoint
    || resolvedPlugin.settings.openAIImageVariationURL
    || joinURL(baseURL, "/images/variations");

  return {
    provider,
    apiKey: resolvedPlugin.settings.aiAPIKey || resolvedPlugin.settings.openAIAPIToken,
    textModel: resolvedPlugin.settings.aiDefaultTextModel || resolvedPlugin.settings.openAIDefaultTextModel,
    visionModel: resolvedPlugin.settings.aiDefaultVisionModel || resolvedPlugin.settings.openAIDefaultVisionModel,
    imageModel: resolvedPlugin.settings.aiDefaultImageGenerationModel || resolvedPlugin.settings.openAIDefaultImageGenerationModel,
    maxTokens: resolvedPlugin.settings.aiDefaultMaxTokens || resolvedPlugin.settings.openAIDefaultTextModelMaxTokens,
    textEndpoint,
    imageGenerationEndpoint,
    imageEditsEndpoint,
    imageVariationsEndpoint,
    baseURL,
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

  const image = getImageURL(part.image);
  return image ? { type: "image", image } : null;
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

  const image = getImageURL(request.image);
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

const toOpenAIContent = (content: string | NormalizedMessagePart[]) => {
  if (typeof content === "string") return content;

  return content.map(part => part.type === "text"
    ? { type: "text" as const, text: part.text }
    : {
        type: "image_url" as const,
        image_url: {
          url: part.image,
          detail: "high" as const,
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

const getBinaryImageData = async (
  image: string,
  signal?: AbortSignal,
): Promise<{ mediaType: string; data: ArrayBuffer; filename: string } | null> => {
  if (!image) return null;

  const parsed = parseDataURL(image);
  if (parsed) {
    return {
      mediaType: parsed.mediaType,
      data: base64ToArrayBuffer(parsed.data),
      filename: getFilenameFromMimeType(parsed.mediaType, "image"),
    };
  }

  if (/^https?:\/\//i.test(image)) {
    const response = await requestUrlWithAbort({
      url: image,
      method: "GET",
    }, signal);

    if (response.status >= 400 || !response.arrayBuffer) {
      throw new Error(`Unable to download image from ${image}`);
    }

    const mediaType = getHeaderValue(response.headers, "content-type") || "application/octet-stream";
    return {
      mediaType,
      data: response.arrayBuffer,
      filename: getFilenameFromMimeType(mediaType, "image"),
    };
  }

  throw new Error("Unsupported image source. Use a data URL or an http(s) URL.");
};

const toInlineImageData = async (image: string): Promise<{ mediaType: string; data: string } | null> => {
  if (!image) return null;

  const parsed = parseDataURL(image);
  if (parsed) return parsed;

  const response = await requestUrlWithAbort({
    url: image,
    method: "GET",
  });

  if (response.status >= 400 || !response.arrayBuffer) {
    return null;
  }

  return {
    mediaType: getHeaderValue(response.headers, "content-type") || "image/png",
    data: arrayBufferToBase64(response.arrayBuffer),
  };
};

const toAnthropicContent = async (content: string | NormalizedMessagePart[]) => {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  const parts = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ type: "text", text: part.text });
      continue;
    }

    const inlineImage = await toInlineImageData(part.image);
    if (!inlineImage) continue;
    parts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: inlineImage.mediaType,
        data: inlineImage.data,
      },
    });
  }
  return parts;
};

const getAnthropicPayload = async (messages: NormalizedMessage[], config: ResolvedAIConfig, request: AIRequest) => {
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
      content: await toAnthropicContent(message.content),
    });
  }

  return {
    model: request.image ? config.visionModel : config.textModel,
    max_tokens: request.maxTokens ?? config.maxTokens,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(system ? { system } : {}),
    messages: requestMessages,
  };
};

const toGoogleParts = async (content: string | NormalizedMessagePart[]) => {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  const parts = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
      continue;
    }

    const inlineImage = await toInlineImageData(part.image);
    if (!inlineImage) continue;
    parts.push({
      inlineData: {
        mimeType: inlineImage.mediaType,
        data: inlineImage.data,
      },
    });
  }
  return parts;
};

const getGooglePayload = async (messages: NormalizedMessage[], config: ResolvedAIConfig, request: AIRequest) => {
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
      parts: await toGoogleParts(message.content),
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

const getGoogleEndpoint = (config: ResolvedAIConfig, model: string): string => {
  const separator = config.baseURL.includes("?") ? "&" : "?";
  return `${normalizeBaseURL(config.textEndpoint)}/models/${model}:generateContent${separator}key=${encodeURIComponent(config.apiKey)}`;
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
  return {
    status: result.status,
    headers: result.headers,
    text: result.text,
    json: normalizeResponseJson(provider, result.json),
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
  if (!["openai", "openai-compatible"].includes(config.provider)) {
    return createSyntheticResponse(
      `${config.provider} does not currently support image generation or editing in Excalidraw. Switch to OpenAI or an OpenAI-compatible endpoint for image requests.`,
      400,
    );
  }

  const image = getImageURL(request.image);
  const mask = getImageURL(request.imageGenerationProperties?.mask);
  const isEditing = Boolean(mask || image);
  const endpoint = isEditing ? config.imageEditsEndpoint : config.imageGenerationEndpoint;

  if (isEditing) {
    const fields: Array<{ name: string; value: string }> = [
      { name: "model", value: config.imageModel },
    ];
    if (request.text?.trim()) {
      fields.push({ name: "prompt", value: request.text.trim() });
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
      const imageFile = await getBinaryImageData(image, signal);
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
      const maskFile = await getBinaryImageData(mask, signal);
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
    return await postJSON(endpoint, {
      method: "POST",
      body: multipart.body,
      contentType: multipart.contentType,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    }, config.provider, signal);
  }

  const payload = {
    model: config.imageModel,
    prompt: request.text,
    ...request.imageGenerationProperties,
  };

  return await postJSON(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
    contentType: "application/json",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
  }, config.provider, signal);
};

const handleTextRequest = async (
  request: AIRequest,
  config: ResolvedAIConfig,
  signal?: AbortSignal,
): Promise<RequestUrlResponse> => {
  const messages = buildNormalizedMessages(request);
  const model = getImageURL(request.image) ? config.visionModel : config.textModel;

  switch (config.provider) {
    case "anthropic": {
      const payload = await getAnthropicPayload(messages, config, request);
      return await postJSON(config.textEndpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
      }, config.provider, signal);
    }
    case "google": {
      const payload = await getGooglePayload(messages, config, request);
      return await postJSON(getGoogleEndpoint(config, model), {
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
      }, config.provider, signal);
    }
    default: {
      const body: GPTCompletionRequest = {
        model,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...getTextLimitPayload(model, request.maxTokens ?? config.maxTokens),
        messages: toOpenAIMessages(messages),
      };

      return await postJSON(config.textEndpoint, {
        method: "POST",
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
      }, config.provider, signal);
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

  if (!config.apiKey) {
    new Notice("AI API key is not set. Please set it in plugin settings.");
    return createSyntheticResponse("AI API key is not set. Please set it in plugin settings.", 401);
  }

  const isImageGeneration = Boolean(request.imageGenerationProperties);
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