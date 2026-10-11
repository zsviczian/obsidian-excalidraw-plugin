/**
 * Type-only Obsidian 1.12.2 CLI boundary, mirrored from obsidianmd/obsidian-api
 * obsidian.d.ts. The project deliberately compiles against 1.8.7. Replace with
 * type imports when that dependency includes the API; declarations do not
 * establish runtime availability.
 */
export interface CliData {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- Mirrors the canonical 1.12.2 API, including its documented bare-flag literal.
  [key: string]: string | "true";
}

export interface CliFlag {
  value?: string;
  description: string;
  required?: boolean;
}

export type CliFlags = Record<string, CliFlag>;
export type CliHandler = (params: CliData) => string | Promise<string>;

export interface ObsidianCliRuntime {
  registerCliHandler(command: string, description: string, flags: CliFlags | null, handler: CliHandler): void;
}
