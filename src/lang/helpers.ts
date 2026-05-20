//Solution copied from obsidian-kanban: https://github.com/mgmeyers/obsidian-kanban/blob/44118e25661bff9ebfe54f71ae33805dc88ffa53/src/lang/helpers.ts

import {
  CJK_FONTS,
  DEVICE,
  FRONTMATTER_KEYS,
  LOCALE,
} from "src/constants/constants";
import {
  labelALT,
  labelCTRL,
  labelMETA,
  labelSHIFT,
} from "src/utils/modifierKeyLabels";
import { URLs } from "src/constants/safeUrls";
import en from "./locale/en";

declare const PLUGIN_LANGUAGES: Record<string, string>;
declare const PLUGIN_VERSION: string;

let locale: Partial<typeof en> | null = null;

// Runtime token map for compressed locales.
// Keep this in sync with token emission in rollup.config.js tokenizeLocaleContent.
// If you add a locale and it needs a new dynamic placeholder, add it in both places.
const TOKENS = {
  IF_DESKTOP_START: "__EXD_IF_DESKTOP__",
  IF_DESKTOP_END: "__EXD_END_IF_DESKTOP__",
  LABEL_ALT: "__EXD_LABEL_ALT__",
  LABEL_CTRL: "__EXD_LABEL_CTRL__",
  LABEL_META: "__EXD_LABEL_META__",
  LABEL_SHIFT: "__EXD_LABEL_SHIFT__",
  FRONTMATTER_LINK_BRACKETS: "__EXD_FRONTMATTER_LINK_BRACKETS__",
  FRONTMATTER_LINK_PREFIX: "__EXD_FRONTMATTER_LINK_PREFIX__",
  FRONTMATTER_URL_PREFIX: "__EXD_FRONTMATTER_URL_PREFIX__",
  CJK_FONTS: "__EXD_CJK_FONTS__",
  PLUGIN_VERSION: "__EXD_PLUGIN_VERSION__",
  DEVTOOLS_SHORTCUT: "__EXD_DEVTOOLS_SHORTCUT__",
} as const;

function resolveTokenizedString(value: string): string {
  // Evaluate deferred desktop-only fragments generated during build.
  const desktopResolved = value.replace(
    /__EXD_IF_DESKTOP__([\s\S]*?)__EXD_END_IF_DESKTOP__/g,
    (_, content: string) => (DEVICE.isDesktop ? content : ""),
  );

  // Evaluate deferred Apple vs non-Apple fragments generated during build.
  const appleResolved = desktopResolved.replace(
    /__EXD_IF_APPLE__([\s\S]*?)__EXD_ELSE_APPLE__([\s\S]*?)__EXD_END_IF_APPLE__/g,
    (_, appleValue: string, nonAppleValue: string) =>
      DEVICE.isIOS || DEVICE.isMacOS ? appleValue : nonAppleValue,
  );

  // Resolve URL placeholders emitted during build from safeUrls constants.
  const withResolvedUrls = appleResolved.replace(
    /__EXD_URL_([A-Z0-9_]+)__/g,
    (match: string, key: string) =>
      (URLs as Record<string, string>)[key] ?? match,
  );

  // Token replacements for runtime-dependent values.
  const replacements: Record<string, string> = {
    [TOKENS.LABEL_ALT]: labelALT(),
    [TOKENS.LABEL_CTRL]: labelCTRL(),
    [TOKENS.LABEL_META]: labelMETA(),
    [TOKENS.LABEL_SHIFT]: labelSHIFT(),
    [TOKENS.FRONTMATTER_LINK_BRACKETS]: FRONTMATTER_KEYS["link-brackets"].name,
    [TOKENS.FRONTMATTER_LINK_PREFIX]: FRONTMATTER_KEYS["link-prefix"].name,
    [TOKENS.FRONTMATTER_URL_PREFIX]: FRONTMATTER_KEYS["url-prefix"].name,
    [TOKENS.CJK_FONTS]: CJK_FONTS,
    [TOKENS.PLUGIN_VERSION]: PLUGIN_VERSION,
    [TOKENS.DEVTOOLS_SHORTCUT]:
      DEVICE.isIOS || DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i",
  };

  let resolved = withResolvedUrls;
  for (const [token, replacement] of Object.entries(replacements)) {
    resolved = resolved.split(token).join(replacement);
  }
  return resolved;
}

function resolveTokensDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return resolveTokenizedString(value);
  }

  if (Array.isArray(value)) {
    return value.map(resolveTokensDeep);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return Object.fromEntries(
      entries.map(([k, v]) => [k, resolveTokensDeep(v)]),
    );
  }

  return value;
}

function loadLocale(lang: string): Partial<typeof en> {
  if (lang === "zh") {
    lang = "zh-cn";
  } //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2247
  if (!Object.prototype.hasOwnProperty.call(PLUGIN_LANGUAGES, lang)) {
    return en;
  }

  try {
    const compressed = PLUGIN_LANGUAGES[lang];
    const decompressed = LZString.decompressFromBase64(compressed);
    if (!decompressed) {
      return en;
    }

    const parsed = JSON.parse(decompressed) as Partial<typeof en>;
    return resolveTokensDeep(parsed) as Partial<typeof en>;
  } catch {
    return en;
  }
}

export function t(str: keyof typeof en): string {
  if (!locale) {
    locale = loadLocale(LOCALE);
  }
  return (locale && locale[str]) || en[str];
}

/*
import ar from "./locale/ar";
import cz from "./locale/cz";
import da from "./locale/da";
import de from "./locale/de";
import en from "./locale/en";
import enGB from "./locale/en-gb";
import es from "./locale/es";
import fr from "./locale/fr";
import hi from "./locale/hi";
import id from "./locale/id";
import it from "./locale/it";
import ja from "./locale/ja";
import ko from "./locale/ko";
import nl from "./locale/nl";
import no from "./locale/no";
import pl from "./locale/pl";
import pt from "./locale/pt";
import ptBR from "./locale/pt-br";
import ro from "./locale/ro";
import ru from "./locale/ru";
import tr from "./locale/tr";
import zhCN from "./locale/zh-cn";
import zhTW from "./locale/zh-tw";
import { LOCALE } from "src/constants/constants";

const localeMap: { [k: string]: Partial<typeof en> } = {
  ar,
  cs: cz,
  da,
  de,
  en,
  "en-gb": enGB,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  nn: no,
  pl,
  pt,
  "pt-br": ptBR,
  ro,
  ru,
  tr,
  "zh-cn": zhCN,
  "zh-tw": zhTW,
};*/
