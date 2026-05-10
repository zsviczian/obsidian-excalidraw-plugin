export type AIProvider = "openai" | "anthropic" | "google" | "xai" | "openai-compatible";

export type AIFileInput =
  | string
  | { url: string; filename?: string; mimeType?: string }
  | { dataURL: string; filename?: string; mimeType?: string };

export type AIImageInput =
  | string
  | { url: string; detail?: "low" | "high" | "auto"; filename?: string; mimeType?: string }
  | { dataURL: string; detail?: "low" | "high" | "auto"; filename?: string; mimeType?: string };

export type AIImageModelCapability = {
  supportedSizes: string[];
  supportsImageEdits: boolean;
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
};

export type AIImageModelConfig = AIModelConfig & AIImageModelCapability;

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
  functions?: any[] | undefined;
  function_call?: any | undefined;
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

export type AIRequest = {
  provider?: AIProvider;
  baseURL?: string;
  apiKey?: string;
  model?: string;
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