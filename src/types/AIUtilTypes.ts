export type AIProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "openai-compatible";

export type AIFileInput =
  | string
  | { url: string; filename?: string; mimeType?: string }
  | { dataURL: string; filename?: string; mimeType?: string };

export type AIImageInput =
  | string
  | {
      url: string;
      detail?: "low" | "high" | "auto";
      filename?: string;
      mimeType?: string;
    }
  | {
      dataURL: string;
      detail?: "low" | "high" | "auto";
      filename?: string;
      mimeType?: string;
    };

export type AIImageModelCapability = {
  supportedSizes: string[];
  supportsPromptImageTransforms: boolean;
  supportsMaskImageEdits: boolean;
};

export type AIProviderProfile = {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
};

export type AIModelConfig = {
  providerId: string;
  model: string;
  endpoint?: string;
  multimodalSupport?: boolean;
};

export type AIImageModelConfig = AIModelConfig & AIImageModelCapability;

export type ExcalidrawAISettings = {
  enabled: boolean;
  providerProfiles: Record<
    string,
    {
      provider: AIProvider;
      baseURL: string;
      hasApiKey: boolean;
    }
  >;
  textModels: Record<string, AIModelConfig>;
  imageModels: Record<string, AIImageModelConfig>;
  defaultTextModel: string;
  defaultMultimodalTextModel: string;
  defaultImageModel: string;
  defaultMaxOutgoingTokens: number;
  defaultMaxResponseTokens: number;
};

export type OpenAIImageURLPart = {
  type: "image_url";
  image_url: string | { url: string; detail?: "low" | "high" | "auto" };
};

type MessageContent =
  | string
  | ({ type: "text"; text: string } | OpenAIImageURLPart)[];

export type GPTCompletionRequest = {
  model: string;
  messages?: {
    role?: "system" | "user" | "assistant" | "function";
    content?: MessageContent;
    name?: string | undefined;
  }[];
  functions?:
    | {
        name: string;
        description?: string;
        parameters?: Record<
          string,
          | string
          | number
          | boolean
          | null
          | Record<string, string | number | boolean | null>
        >;
      }[]
    | undefined;
  function_call?: "none" | "auto" | { name: string } | undefined;
  stream?: boolean | undefined;
  temperature?: number | undefined;
  top_p?: number | undefined;
  max_tokens?: number | undefined;
  max_completion_tokens?: number | undefined;
  n?: number | undefined;
  best_of?: number | undefined;
  frequency_penalty?: number | undefined;
  presence_penalty?: number | undefined;
  logit_bias?:
    | {
        [x: string]: number;
      }
    | undefined;
  stop?: (string[] | string) | undefined;
  size?: string;
  quality?: "standard" | "hd";
  prompt?: string;
  image?: string;
  mask?: string;
};

export type AIRequestMessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: AIImageInput }
  | { type: "file"; file: AIFileInput }
  | { type: "audio"; audio: AIFileInput };

export type AIRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string | AIRequestMessagePart[];
};

export type AITextUsageEntry = {
  inputTokens: number;
  outputTokens: number;
};

export type AIImageUsageEntry = {
  generations: number;
};

export type AIUsageData = {
  textModels: Record<string, AITextUsageEntry>;
  imageModels: Record<string, AIImageUsageEntry>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalImageGenerations: number;
};

export type AIRequest = {
  provider?: AIProvider;
  baseURL?: string;
  apiKey?: string;
  model?: string;
  textModelId?: string;
  imageModelId?: string;
  image?: AIImageInput;
  text?: string;
  instruction?: string;
  systemPrompt?: string;
  messages?: AIRequestMessage[];
  temperature?: number;
  maxOutgoingTokens?: number;
  maxTokens?: number;
  imageGenerationProperties?: {
    size?: string; //depends on model
    quality?: "standard" | "hd"; //depends on model
    n?: number; //dall-e-3 only accepts 1
    mask?: AIImageInput; //dall-e-2 only (image editing)
  };
};
