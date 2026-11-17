import type { App } from "obsidian";
import { decryptStoredAPIKey } from "src/utils/settingsKeyObfuscation";

/** A persisted credential source. Secret values are resolved only at use time. */
export interface APIKeyStorage {
  apiKey: string;
  apiKeySource?: "settings" | "secret";
  apiKeySecret?: string;
}

/** Returns the selected key without falling back to a synced key in secret mode. */
export function resolveStoredAPIKey(app: App, config: APIKeyStorage): string {
  if (config.apiKeySource !== "secret") return decryptStoredAPIKey(config.apiKey ?? "");
  try {
    return config.apiKeySecret ? app.secretStorage?.getSecret(config.apiKeySecret) ?? "" : "";
  } catch {
    return "";
  }
}
