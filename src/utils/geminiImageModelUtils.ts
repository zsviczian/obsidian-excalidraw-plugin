import { AIProvider } from "src/types/AIUtilTypes";

export type GeminiImageSizeTier = "512" | "1K" | "2K" | "4K";

export type GeminiImageSizeEntry = {
  aspectRatio: string;
  size: string;
  imageSize?: GeminiImageSizeTier;
};

type GeminiImageModelSpec = {
  entries: GeminiImageSizeEntry[];
};

const COMMON_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

const FLASH_IMAGE_PREVIEW_EXTRA_ASPECT_RATIOS = [
  "1:4",
  "1:8",
  "4:1",
  "8:1",
] as const;

const GEMINI_IMAGE_DIMENSIONS: Record<
  string,
  Partial<Record<GeminiImageSizeTier, string>>
> = {
  "1:1": {
    "512": "512x512",
    "1K": "1024x1024",
    "2K": "2048x2048",
    "4K": "4096x4096",
  },
  "1:4": {
    "512": "256x1024",
    "1K": "512x2048",
    "2K": "1024x4096",
    "4K": "2048x8192",
  },
  "1:8": {
    "512": "192x1536",
    "1K": "384x3072",
    "2K": "768x6144",
    "4K": "1536x12288",
  },
  "2:3": {
    "512": "424x632",
    "1K": "848x1264",
    "2K": "1696x2528",
    "4K": "3392x5056",
  },
  "3:2": {
    "512": "632x424",
    "1K": "1264x848",
    "2K": "2528x1696",
    "4K": "5056x3392",
  },
  "3:4": {
    "512": "448x600",
    "1K": "896x1200",
    "2K": "1792x2400",
    "4K": "3584x4800",
  },
  "4:1": {
    "512": "1024x256",
    "1K": "2048x512",
    "2K": "4096x1024",
    "4K": "8192x2048",
  },
  "4:3": {
    "512": "600x448",
    "1K": "1200x896",
    "2K": "2400x1792",
    "4K": "4800x3584",
  },
  "4:5": {
    "512": "464x576",
    "1K": "928x1152",
    "2K": "1856x2304",
    "4K": "3712x4608",
  },
  "5:4": {
    "512": "576x464",
    "1K": "1152x928",
    "2K": "2304x1856",
    "4K": "4608x3712",
  },
  "8:1": {
    "512": "1536x192",
    "1K": "3072x384",
    "2K": "6144x768",
    "4K": "12288x1536",
  },
  "9:16": {
    "512": "384x688",
    "1K": "768x1376",
    "2K": "1536x2752",
    "4K": "3072x5504",
  },
  "16:9": {
    "512": "688x384",
    "1K": "1376x768",
    "2K": "2752x1536",
    "4K": "5504x3072",
  },
  "21:9": {
    "512": "792x168",
    "1K": "1584x672",
    "2K": "3168x1344",
    "4K": "6336x2688",
  },
};

const buildGeminiImageEntries = (
  aspectRatios: readonly string[],
  tiers: readonly GeminiImageSizeTier[],
  includeImageSize: boolean,
): GeminiImageSizeEntry[] =>
  aspectRatios.flatMap((aspectRatio) =>
    tiers.flatMap((tier) => {
      const size = GEMINI_IMAGE_DIMENSIONS[aspectRatio]?.[tier];
      return size
        ? [
            {
              aspectRatio,
              size,
              ...(includeImageSize ? { imageSize: tier } : {}),
            },
          ]
        : [];
    }),
  );

const GEMINI_IMAGE_MODEL_SPECS: Record<string, GeminiImageModelSpec> = {
  "gemini-2.5-flash-image": {
    entries: buildGeminiImageEntries(COMMON_ASPECT_RATIOS, ["1K"], false),
  },
  "gemini-3-pro-image-preview": {
    entries: buildGeminiImageEntries(
      COMMON_ASPECT_RATIOS,
      ["1K", "2K", "4K"],
      true,
    ),
  },
  "gemini-3.1-flash-image-preview": {
    entries: buildGeminiImageEntries(
      [...COMMON_ASPECT_RATIOS, ...FLASH_IMAGE_PREVIEW_EXTRA_ASPECT_RATIOS],
      ["512", "1K", "2K", "4K"],
      true,
    ),
  },
};

const normalizeModelName = (value?: string): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getGeminiImageModelSpec = (
  provider?: AIProvider,
  model?: string,
): GeminiImageModelSpec | null => {
  if (provider !== "google") {
    return null;
  }

  return GEMINI_IMAGE_MODEL_SPECS[normalizeModelName(model)] ?? null;
};

export const isGeminiImageModel = (
  provider?: AIProvider,
  model?: string,
): boolean => Boolean(getGeminiImageModelSpec(provider, model));

export const getGeminiSupportedSizes = (
  provider?: AIProvider,
  model?: string,
): string[] =>
  getGeminiImageModelSpec(provider, model)?.entries.map(
    (entry) => entry.size,
  ) ?? [];

export const getGeminiImageRequestConfig = (
  provider?: AIProvider,
  model?: string,
  size?: string,
): { aspectRatio: string; imageSize?: GeminiImageSizeTier } | null => {
  const normalizedSize = String(size ?? "").trim();
  if (!normalizedSize) {
    return null;
  }

  const entry = getGeminiImageModelSpec(provider, model)?.entries.find(
    (candidate) => candidate.size === normalizedSize,
  );

  return entry
    ? {
        aspectRatio: entry.aspectRatio,
        ...(entry.imageSize ? { imageSize: entry.imageSize } : {}),
      }
    : null;
};
