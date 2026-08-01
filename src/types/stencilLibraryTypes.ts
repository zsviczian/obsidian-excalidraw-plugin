import type {
  LibraryItem,
  LibraryItems,
} from "@zsviczian/excalidraw/types/excalidraw/types";

export type StencilLibraryStorageMode = "data-json" | "vault";

export type StencilLibraryMigrationStatus =
  | "not-required"
  | "pending"
  | "later"
  | "completed"
  | "opted-out";

export type StencilLibraryData = {
  type?: "excalidrawlib";
  version?: number;
  source?: string;
  library?: LibraryItems;
  libraryItems?: LibraryItems;
};

export type StencilLibraryFileData = Omit<
  StencilLibraryData,
  "library" | "libraryItems"
> & {
  libraryItems: LibraryItems;
};

export type StencilLibraryMigrationChoice =
  | "migrate"
  | "later"
  | "keep-data-json";

export type MutableLibraryItem = LibraryItem & {
  status: LibraryItem["status"];
};
