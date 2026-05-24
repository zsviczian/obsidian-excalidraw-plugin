import {
  LOCALE,
  DEVICE,
  FRONTMATTER_KEYS,
  CJK_FONTS,
} from "src/constants/constants";
import {
  TAG_AUTOEXPORT,
  TAG_MDREADINGMODE,
  TAG_PDFEXPORT,
} from "src/constants/constSettingsTags";
import { URLs } from "src/constants/safeUrls";
import {
  labelALT,
  labelCTRL,
  labelMETA,
  labelSHIFT,
} from "src/utils/modifierKeyLabels";
import en from "./locale/en";
import { errorHandler } from "src/utils/ErrorHandler";

declare const PLUGIN_LANGUAGES: Record<string, string>;
declare const PLUGIN_VERSION: string;
declare var LZString: any;

let locale: Partial<typeof en> | null = null;

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

    // Construct a factory function string.
    // This allows safeEval (which runs in the global scope) to access our imported variables
    // because we pass them explicitly as arguments to this function.
    const factoryCode = `(function(
      DEVICE, FRONTMATTER_KEYS, CJK_FONTS,
      TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT,
      URLs,
      labelALT, labelCTRL, labelMETA, labelSHIFT,
      PLUGIN_VERSION
    ) {
      let x = {};
      ${decompressed}
      return x;
    })`;

    // Evaluate the function declaration using your ErrorHandler
    const factory = errorHandler.safeEval<Function>(
      factoryCode,
      "loadLocale - parsing language pack",
      window,
    );

    if (typeof factory !== "function") {
      return en;
    }

    // Execute the evaluated function, injecting the actual imported dependencies
    const x = factory(
      DEVICE,
      FRONTMATTER_KEYS,
      CJK_FONTS,
      TAG_AUTOEXPORT,
      TAG_MDREADINGMODE,
      TAG_PDFEXPORT,
      URLs,
      labelALT,
      labelCTRL,
      labelMETA,
      labelSHIFT,
      PLUGIN_VERSION,
    );

    return x || en;
  } catch (_) {
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
