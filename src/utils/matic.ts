import { EXCALIDRAW_PLUGIN, THEME } from "../constants/constants";
import type { Theme } from "@zsviczian/excalidraw/types/element/src/types";
import type { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { extractCodeBlocks, generateAIText } from "./AIUtils";

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
- Leverage Tailwind for styling and layout (import as script <script src="https://cdn.tailwindcss.com"></script>)
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
  const result = await generateAIText({
    image: { url: image },
    text,
    systemPrompt: SYSTEM_PROMPT,
    instruction: `Above is the reference wireframe. Please make a new website based on these and return just the HTML file. Also, please make it for the ${theme} theme. What follows are the wireframe's text annotations (if any)...`,
    maxTokens: 4096,
  }, {
    plugin: EXCALIDRAW_PLUGIN,
  });

  if (!result.response || result.response.status < 200 || result.response.status >= 300 || result.json?.error) {
    return {
      ok: false,
      error: result.json?.error?.message ?? `Request failed with status ${result.response?.status ?? 0}`,
      json: result.json,
    };
  }

  const htmlBlock = extractCodeBlocks(result.content).find(block => (block.type ?? "").toLowerCase() === "html");
  const contentText = result.content?.trim() ?? "";
  const doctypeIndex = contentText.indexOf("<!DOCTYPE html>");
  const htmlOpenIndex = contentText.indexOf("<html");
  const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlOpenIndex;
  const endIndex = contentText.lastIndexOf("</html>");
  const html = htmlBlock?.data ?? ((startIndex >= 0 && endIndex >= 0)
    ? contentText.slice(startIndex, endIndex + "</html>".length)
    : null);

  if (!html) {
    return {
      ok: false,
      error: "Nothing generated",
      json: result.json,
    };
  }

  return {
    ok: true,
    html,
    json: result.json,
  };
}