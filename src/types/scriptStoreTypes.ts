export type ScriptStoreCategory = {
  name: string;
  description: string;
};

export type ScriptStoreEntry = {
  name: string;
  file: string;
  installUrl: string;
  iconUrl: string;
  author: string;
  authorUrl: string;
  sourceUrl: string;
  descriptionHtml: string;
  categories: string[];
  featuredRank?: number;
};

export type ScriptStoreCatalog = {
  version: number;
  categories: ScriptStoreCategory[];
  scripts: ScriptStoreEntry[];
};

export type ScriptStoreInstallState =
  | "install"
  | "update"
  | "up-to-date"
  | "error";
