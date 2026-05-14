import { normalizePath, type App } from "obsidian";
import {
  REG_BLOCK_REF_CLEAN,
  REG_SECTION_REF_CLEAN,
} from "src/constants/constants";

export function splitFolderAndFilename(filepath: string | undefined): {
  folderpath: string;
  filename: string;
  basename: string;
  extension: string;
} {
  if (!filepath) {
    return {
      folderpath: "",
      filename: "",
      basename: "",
      extension: "",
    };
  }
  const lastIndex = filepath.lastIndexOf("/");
  const filename =
    lastIndex === -1 ? filepath : filepath.substring(lastIndex + 1);
  const lastDotIndex = filename.lastIndexOf(".");
  const folderpath = filepath.substring(0, lastIndex);
  return {
    folderpath: folderpath ? normalizePath(folderpath) : "",
    filename,
    basename: filename.replace(/\.[^/.]+$/, ""),
    extension: lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : "",
  };
}

export const cleanSectionHeading = (heading: string) => {
  if (!heading) {
    return heading;
  }
  return heading.replace(REG_SECTION_REF_CLEAN, "").replace(/\s+/g, " ").trim();
};

export const cleanBlockRef = (blockRef: string) => {
  if (!blockRef) {
    return blockRef;
  }
  return blockRef.replace(REG_BLOCK_REF_CLEAN, "").replace(/\s+/g, " ").trim();
};

export const getAttachmentsFolderAndFilePath = async (
  app: App,
  activeViewFilePath: string,
  newFileName: string,
): Promise<{ folder: string; filepath: string }> => {
  const attachmentFilePath =
    await app.fileManager.getAvailablePathForAttachment(
      newFileName,
      activeViewFilePath,
    );
  const { folderpath } = splitFolderAndFilename(attachmentFilePath);
  return {
    folder: folderpath,
    filepath: attachmentFilePath,
  };
};
