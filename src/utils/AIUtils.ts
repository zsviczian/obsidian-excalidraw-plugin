import { Notice, RequestUrlResponse } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import { GPTCompletionRequest, AIRequest } from "src/types/AIUtilTypes";

const handleImageEditPrompt = async (request: AIRequest) : Promise<RequestUrlResponse> => {
  const plugin: ExcalidrawPlugin = window.ExcalidrawAutomate.plugin;
  const {
    openAIAPIToken,
    openAIImageEditsURL,
  } = plugin.settings;
  const { image, text, imageGenerationProperties} = request;

  const body = new FormData();
  body.append("model", "dall-e-2");
  text.trim() !== "" && body.append("prompt", text);

  if (image) {
    const imageBlob = await fetch(image).then((res) => res.blob());
    body.append('image', imageBlob, 'image.png');
  }

  if (imageGenerationProperties.mask) {
    const maskBlob = await fetch(imageGenerationProperties.mask).then((res) => res.blob());
    body.append('mask', maskBlob, 'masik.png');
  }

  imageGenerationProperties.size && body.append("size", imageGenerationProperties.size);
  imageGenerationProperties.n && body.append("n", String(imageGenerationProperties.n));

  try {
    //https://platform.openai.com/docs/api-reference/images
    const resp = await fetch(
       openAIImageEditsURL,
      {
        method: "post",
        body,
        headers: {
          Authorization: `Bearer ${openAIAPIToken}`,
        },
      }
    );
    if(!resp) return null;
    return {
      status: resp.status,
      headers: resp.headers as any,
      text: null,
      json: await resp.json(),
      arrayBuffer: null,
    };
  } catch (e) {
    console.log(e);
  }
  return null;
}

const handleGenericPrompt = async (request: AIRequest) : Promise<RequestUrlResponse> => {
  const plugin: ExcalidrawPlugin = window.ExcalidrawAutomate.plugin;
  const {
    openAIAPIToken,
    openAIDefaultTextModel,
    openAIDefaultTextModelMaxTokens,
    openAIDefaultVisionModel,
    openAIURL,
    openAIImageGenerationURL,
    openAIDefaultImageGenerationModel,
  } = plugin.settings;
  const { image, text, instruction, systemPrompt, imageGenerationProperties} = request;
  const isImageGeneration = Boolean(imageGenerationProperties);
    const requestType = isImageGeneration ? "dall-e" : (image ? "image" : "text");
  let body: GPTCompletionRequest;

  switch (requestType) {
    case "text":
      body = {
        model: openAIDefaultTextModel,
        ...(openAIDefaultTextModelMaxTokens > 0 && { max_tokens: openAIDefaultTextModelMaxTokens }),
        messages: [
          ...(systemPrompt && systemPrompt.trim() !=="" ? [{role: "system" as const,content: systemPrompt}] : []),
          {
            role: "user",
            content: text,
          },
          ...(instruction && instruction.trim() !=="" ? [{role: "user" as const,content: instruction}] : []),
        ],
      };          
      break;
    case "image":
      body = {
        model: openAIDefaultVisionModel,
        ...(openAIDefaultTextModelMaxTokens > 0 && { max_tokens: openAIDefaultTextModelMaxTokens }),
        messages: [
          ...(systemPrompt && systemPrompt.trim() !=="" ? [{role: "system" as const,content: systemPrompt}] : []),
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: image,
              },
              ...(text ? [text] : []),
              ...(instruction && instruction.trim() !== "" ? [instruction] : []),
            ],
          }
        ],
      };                
      break;
    case "dall-e":
      body = {
        model: openAIDefaultImageGenerationModel,
        prompt: text,
        ...imageGenerationProperties
      };
      break;
    default:
      return null;
  }

  try {
    //https://platform.openai.com/docs/api-reference/images
    const resp = await fetch (isImageGeneration ? openAIImageGenerationURL : openAIURL, {
      method: "post",
      //@ts-ignore
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIAPIToken}`,
      }
    });
    if(!resp) return null;
    return {
      status: resp.status,
      headers: resp.headers as any,
      text: null,
      json: await resp.json(),
      arrayBuffer: null,
    };
  } catch (e) {
    console.log(e);
  }
  return null;

  /*
  //does not seem to work on Android :(
  try {
    //https://platform.openai.com/docs/api-reference/images
    const resp = await requestUrl ({
      url:  isImageGeneration ? openAIImageGenerationURL : openAIURL,
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
  return null;*/
}


export const postOpenAI = async (request: AIRequest) : Promise<RequestUrlResponse> => {
  const plugin: ExcalidrawPlugin = window.ExcalidrawAutomate.plugin;
  const { openAIAPIToken } = plugin.settings;
  const { image, imageGenerationProperties} = request;
  const isImageGeneration = Boolean(imageGenerationProperties);
  const isImageVariationOrEditing = isImageGeneration && (Boolean(imageGenerationProperties.mask) || Boolean(image));

  if(openAIAPIToken === "") {
    new Notice("OpenAI API Token is not set. Please set it in plugin settings.");
    return null;
  }

  if(isImageVariationOrEditing) {
    return await handleImageEditPrompt(request);
  }
  return await handleGenericPrompt(request);

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