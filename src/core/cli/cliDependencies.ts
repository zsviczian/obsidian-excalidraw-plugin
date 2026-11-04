/** Request-owned content checks for disk exports; never trust attachment mtimes alone. */
import type { EventRef, TFile, Vault } from "obsidian";
import { CLIError } from "./cliProtocol";

/**
 * Observe files before the loader consumes them (including nested drawings), and
 * re-read their content before publication. Keep only per-file SHA-256 digests,
 * process reads sequentially, and reject any intervening Vault mutation. This
 * also catches a change followed by restoration while rendering. External edits
 * without Vault events are detected by the final content read, even with equal stats.
 */
export class CLIDiskDependencies {
  private files = new Map<string, { file: TFile; digest: string }>();
  private refs: EventRef[];
  private changed = false;
  private disposed = false;
  /** Optional policy-specific source check, invoked before the loader may decode it. */
  public preflight?: (file: TFile, bytes: ArrayBuffer) => void;

  public constructor(private readonly vault: Vault, private readonly isCurrent: () => boolean) {
    const changed = () => { this.changed = true; };
    this.refs = [vault.on("modify", changed), vault.on("delete", changed), vault.on("rename", changed)];
  }

  /** Fail synchronously after the final awaited read and immediately before writing. */
  public assertCurrent(): void {
    if (this.disposed || !this.isCurrent()) throw new CLIError("NOT_READY", "Disk export session ended.");
    if (this.changed) throw new CLIError("STALE_REVISION", "Vault dependencies changed during disk rendering; retry from a fresh snapshot.");
  }

  private async digest(file: TFile): Promise<string> {
    this.assertCurrent();
    if (this.vault.getFileByPath(file.path) !== file) throw new CLIError("STALE_REVISION", "A disk dependency was replaced.");
    const bytes = await this.vault.readBinary(file);
    this.preflight?.(file, bytes);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    this.assertCurrent();
    if (this.vault.getFileByPath(file.path) !== file) throw new CLIError("STALE_REVISION", "A disk dependency was replaced.");
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  /** Invoked by the request's loader before every local source, never omitted images. */
  public observe = async (file: TFile): Promise<void> => {
    const digest = await this.digest(file), previous = this.files.get(file.path);
    if (previous && (previous.file !== file || previous.digest !== digest)) throw new CLIError("STALE_REVISION", "Disk dependency content changed during rendering.");
    this.files.set(file.path, { file, digest });
  };

  /** Content-aware validation covers same-size, same-mtime and last-byte replacements. */
  public async validate(): Promise<void> {
    for (const { file, digest } of this.files.values()) {
      if (await this.digest(file) !== digest) throw new CLIError("STALE_REVISION", "Disk dependency content changed during rendering.");
    }
    this.assertCurrent();
  }

  /** Idempotent operation/unload cleanup releases every listener and captured handle. */
  public destroy = (): void => {
    this.disposed = true;
    for (const ref of this.refs) this.vault.offref(ref);
    this.refs = [];
    this.files.clear();
    this.preflight = undefined;
  };
}
