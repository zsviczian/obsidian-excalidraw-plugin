type MessageContent =
  | string
  | (string | { type: "image_url"; image_url: string })[];

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

export type AIRequest = {
  image?: string;
  text?: string;
  instruction?: string;
  systemPrompt?: string;
  imageGenerationProperties?: {
    size?: string; //depends on model
    quality?: "standard" | "hd"; //depends on model
    n?: number; //dall-e-3 only accepts 1
    mask?: string; //dall-e-2 only (image editing)
  };
};