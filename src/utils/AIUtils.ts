import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import ExcalidrawPlugin from "src/main";

type MessageContent =
  | string
  | (string | { type: "image_url"; image_url: string })[];

export type GPTCompletionRequest = {
  model: string;
  messages: {
    role: "system" | "user" | "assistant" | "function";
    content: MessageContent;
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
};

export type AIRequest = {
  image?: string;
  text?: string;
  instruction?: string;
  systemPrompt?: string;
};

export const postOpenAI = async (request: AIRequest) : Promise<RequestUrlResponse> => {
  const plugin: ExcalidrawPlugin = window.ExcalidrawAutomate.plugin;
  const { openAIAPIToken, openAIDefaultTextModel, openAIDefaultVisionModel} = plugin.settings;
  const { image, text, instruction, systemPrompt } = request;
  const requestType = image ? "image" : "text";
  let body: GPTCompletionRequest;

  if(openAIAPIToken === "") {
    new Notice("OpenAI API Token is not set. Please set it in plugin settings.");
    return null;
  }
  switch (requestType) {
    case "text":
      body = {
        model: openAIDefaultTextModel,
        max_tokens: 4096,
        messages: [
          ...(systemPrompt ? [{role: "system" as const,content: systemPrompt}] : []),
          {
            role: "user",
            content: text,
          },
          ...(instruction ? [{role: "user" as const,content: instruction}] : [])
        ],
      };          
      break;
    case "image":
      body = {
        model: openAIDefaultVisionModel,
        max_tokens: 4096,
        messages: [
          ...(systemPrompt ? [{role: "system" as const,content: [systemPrompt]}] : []),
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: image,
              },
              ...(instruction ? [instruction] : []), //"Turn this into a single html file using tailwind.",
            ],
          },
        ],
      };                
      break;
    default:
      return null;
  }

  try {
    const resp = await requestUrl ({
      url: "https://api.openai.com/v1/chat/completions",
      method: "post",
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIAPIToken}`,
      },
      throw: false
    });
    return resp;
  } catch (e) {
    console.log(e);
  }
  return null;
}

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
  const regex = /```([a-zA-Z0-9]*)\n([\s\S]+?)```/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const codeblockType = match[1]??"";
    const codeblockString = match[2].trim();
    result.push({ data: codeblockString, type: codeblockType });
  }

  return result;
}