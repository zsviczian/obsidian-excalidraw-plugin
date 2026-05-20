import { EXCALIDRAW_PLUGIN, THEME } from "../constants/constants";
import type { Theme } from "@zsviczian/excalidraw/types/element/src/types";
import type { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  analyzeAIImage,
  extractCodeBlocks,
  getJsonErrorMessage,
} from "./AIUtils";
import { URLs } from "src/constants/safeUrls";

const DIAGRAM_TO_HTML_DEBUG_PREFIX = "[Excalidraw diagram-to-code debug]";
const DIAGRAM_TO_HTML_DEBUG_MAX_LENGTH = 8000;
const DIAGRAM_TO_HTML_INITIAL_MAX_TOKENS = 4096;
const DIAGRAM_TO_HTML_RETRY_MAX_TOKENS = 12288;

const stringifyDiagramDebugValue = (value: unknown): string => {
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

const trimDiagramDebugText = (
  value: string,
  maxLength: number = DIAGRAM_TO_HTML_DEBUG_MAX_LENGTH,
): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`;
};

const isDiagramToHTMLDebugEnabled = (): boolean =>
  Boolean(EXCALIDRAW_PLUGIN?.settings?.aiVerboseLogging);

const logDiagramToHTMLDebug = (label: string, lines: string[]): void => {
  if (!isDiagramToHTMLDebugEnabled()) {
    return;
  }

  console.log(`${DIAGRAM_TO_HTML_DEBUG_PREFIX} ${label}\n${lines.join("\n")}`);
};

const getDiagramToHTMLFinishReason = (
  json: Record<string, unknown>,
): string => {
  const choices = json.choices;
  const finishReason = Array.isArray(choices)
    ? (choices[0] as { finish_reason?: unknown } | undefined)?.finish_reason
    : undefined;
  return typeof finishReason === "string" ? finishReason : "";
};

const isMaxTokenFinishReason = (finishReason: string): boolean => {
  const normalized = finishReason.trim().toLowerCase();
  return (
    normalized === "max_tokens" ||
    normalized === "max_tokens_exceeded" ||
    normalized === "length"
  );
};

const extractDiagramHTML = (content: string) => {
  const contentText = content?.trim() ?? "";
  const htmlBlock = extractCodeBlocks(contentText).find(
    (block) => (block.type ?? "").toLowerCase() === "html",
  );
  const doctypeIndex = contentText.indexOf("<!DOCTYPE html>");
  const htmlOpenIndex = contentText.indexOf("<html");
  const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlOpenIndex;
  const endIndex = contentText.lastIndexOf("</html>");
  const html =
    htmlBlock?.data ??
    (startIndex >= 0 && endIndex >= 0
      ? contentText.slice(startIndex, endIndex + "</html>".length)
      : null);

  return {
    html,
    htmlBlock,
    contentText,
    doctypeIndex,
    htmlOpenIndex,
    endIndex,
  };
};

const shouldRetryDiagramToHTML = (
  json: Record<string, unknown>,
  extraction: ReturnType<typeof extractDiagramHTML>,
  attemptedMaxTokens: number,
): boolean => {
  if (attemptedMaxTokens >= DIAGRAM_TO_HTML_RETRY_MAX_TOKENS) {
    return false;
  }

  if (extraction.html || extraction.contentText === "") {
    return false;
  }

  const finishReason = getDiagramToHTMLFinishReason(json);
  return (
    isMaxTokenFinishReason(finishReason) &&
    (extraction.doctypeIndex >= 0 ||
      extraction.htmlOpenIndex >= 0 ||
      extraction.contentText.startsWith("```html"))
  );
};

export type MagicCacheData =
  | {
      status: "pending";
    }
  | { status: "done"; html: string }
  | {
      status: "error";
      message?: string;
      code: "ERR_GENERATION_INTERRUPTED" | string;
    };

const SYSTEM_PROMPT = `You are a skilled front-end developer who builds interactive prototypes from wireframes, and is an expert at CSS Grid and Flex design.
Your role is to transform low-fidelity wireframes into working front-end HTML code.
YOU MUST FOLLOW FOLLOWING RULES:
- Use HTML, CSS, JavaScript to build a responsive, accessible, polished prototype
- Leverage Tailwind for styling and layout (import as script <script src="${URLs.CDN_TAILWINDCSS_COM}"></script>)
- Inline JavaScript when needed
- Fetch dependencies from CDNs when needed (using unpkg or skypack)
- Source images from Unsplash or create applicable placeholders
- Interpret annotations as intended vs literal UI
- Fill gaps using your expertise in UX and business logic
- generate primarily for desktop UI, but make it responsive.
- Use grid and flexbox wherever applicable.
- Convert the wireframe in its entirety, don't omit elements if possible.
If the wireframes, diagrams, or text is unclear or unreadable, refer to provided text for clarification.
Your goal is a production-ready prototype that brings the wireframes to life.
Please output JUST THE HTML file containing your best attempt at implementing the provided wireframes.`;

export async function diagramToHTML({
  image,
  text,
  theme = THEME.LIGHT,
}: {
  image: DataURL;
  text: string;
  theme?: Theme;
}) {
  const requestDiagramHTML = async (maxTokens: number) =>
    await analyzeAIImage(
      {
        image: { url: image },
        text,
        systemPrompt: SYSTEM_PROMPT,
        instruction: `Above is the reference wireframe. Please make a new website based on these and return just the HTML file. Also, please make it for the ${theme} theme. What follows are the wireframe's text annotations (if any)...`,
        maxTokens,
      },
      {
        plugin: EXCALIDRAW_PLUGIN,
      },
    );

  const isRequestFailure = (
    result: Awaited<ReturnType<typeof requestDiagramHTML>>,
  ) =>
    !result.response ||
    result.response.status < 200 ||
    result.response.status >= 300 ||
    result.json?.error;

  let attemptedMaxTokens = DIAGRAM_TO_HTML_INITIAL_MAX_TOKENS;
  let result = await requestDiagramHTML(attemptedMaxTokens);
  let extraction = extractDiagramHTML(result.content);

  if (
    !isRequestFailure(result) &&
    shouldRetryDiagramToHTML(result.json, extraction, attemptedMaxTokens)
  ) {
    logDiagramToHTMLDebug("html extraction retry", [
      `attemptedMaxTokens: ${String(attemptedMaxTokens)}`,
      `retryMaxTokens: ${String(DIAGRAM_TO_HTML_RETRY_MAX_TOKENS)}`,
      `finishReason: ${getDiagramToHTMLFinishReason(result.json) || "<empty>"}`,
      `contentChars: ${String(extraction.contentText.length)}`,
      `doctypeIndex: ${String(extraction.doctypeIndex)}`,
      `htmlOpenIndex: ${String(extraction.htmlOpenIndex)}`,
      `endIndex: ${String(extraction.endIndex)}`,
    ]);

    attemptedMaxTokens = DIAGRAM_TO_HTML_RETRY_MAX_TOKENS;
    result = await requestDiagramHTML(attemptedMaxTokens);
    extraction = extractDiagramHTML(result.content);
  }

  if (isRequestFailure(result)) {
    logDiagramToHTMLDebug("request failure", [
      `status: ${String(result.response?.status ?? 0)}`,
      `attemptedMaxTokens: ${String(attemptedMaxTokens)}`,
      `error: ${getJsonErrorMessage(result.json) ?? "<none>"}`,
      `content: ${trimDiagramDebugText(result.content || "<empty>")}`,
      `responseJson: ${trimDiagramDebugText(stringifyDiagramDebugValue(result.json))}`,
    ]);

    return {
      ok: false,
      error:
        getJsonErrorMessage(result.json) ??
        `Request failed with status ${result.response?.status ?? 0}`,
      json: result.json,
    };
  }

  const {
    html,
    htmlBlock,
    contentText,
    doctypeIndex,
    htmlOpenIndex,
    endIndex,
  } = extraction;

  if (!html) {
    logDiagramToHTMLDebug("html extraction failure", [
      `status: ${String(result.response?.status ?? 0)}`,
      `attemptedMaxTokens: ${String(attemptedMaxTokens)}`,
      `finishReason: ${getDiagramToHTMLFinishReason(result.json) || "<empty>"}`,
      `contentChars: ${String(contentText.length)}`,
      `hasHtmlCodeBlock: ${String(Boolean(htmlBlock))}`,
      `doctypeIndex: ${String(doctypeIndex)}`,
      `htmlOpenIndex: ${String(htmlOpenIndex)}`,
      `endIndex: ${String(endIndex)}`,
      `content: ${trimDiagramDebugText(contentText || "<empty>")}`,
      `responseJson: ${trimDiagramDebugText(stringifyDiagramDebugValue(result.json))}`,
    ]);

    return {
      ok: false,
      error: contentText
        ? isMaxTokenFinishReason(getDiagramToHTMLFinishReason(result.json))
          ? "The AI model hit its maximum token limit before completing the HTML output."
          : "The AI model returned content, but no HTML document could be extracted from it."
        : "The AI model did not return any HTML content.",
      json: result.json,
    };
  }

  return {
    ok: true,
    html,
    json: result.json,
  };
}
