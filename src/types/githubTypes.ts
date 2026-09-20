/**
 * Metadata entry describing a file in the legacy remote EA scripts directory listing.
 */
export type RemoteDirectoryInfo = {
  fname: string;
  mtime: number;
};

/**
 * File metadata returned by GitHub's repository contents endpoint.
 */
export type GitHubRepositoryContentFile = {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir" | "symlink" | "submodule";
  download_url?: string | null;
};
