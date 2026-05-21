import { AIProviderProfile } from "src/types/AIUtilTypes";

const API_KEY_OBFUSCATION_PREFIX = "ex-obf:v1:";
const API_KEY_OBFUSCATION_SECRET = "ExcalidrawAISettingsKeyObfuscation2026";
const API_KEY_PAYLOAD_MARKER = "EXCALIDRAW_API_KEY:";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const obfuscationKeyBytes = textEncoder.encode(API_KEY_OBFUSCATION_SECRET);

const xorWithSecret = (value: Uint8Array): Uint8Array => {
  if (obfuscationKeyBytes.length === 0) {
    return value;
  }

  const output = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index++) {
    const salt = (index * 131) & 255;
    output[index] =
      value[index] ^
      obfuscationKeyBytes[index % obfuscationKeyBytes.length] ^
      salt;
  }
  return output;
};

const encodeBase64 = (value: Uint8Array): string => {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of value) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }

  return "";
};

const decodeBase64 = (value: string): Uint8Array | null => {
  try {
    if (typeof atob === "function") {
      const binary = atob(value);
      const output = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) {
        output[index] = binary.charCodeAt(index);
      }
      return output;
    }

    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(value, "base64"));
    }
  } catch (_) {
    return null;
  }

  return null;
};

export const isObfuscatedAPIKey = (value: unknown): value is string => {
  return (
    typeof value === "string" && value.startsWith(API_KEY_OBFUSCATION_PREFIX)
  );
};

const decodeObfuscatedAPIKeyPayload = (value: string): string | null => {
  if (!isObfuscatedAPIKey(value)) {
    return null;
  }

  const encodedPayload = value.slice(API_KEY_OBFUSCATION_PREFIX.length);
  if (!encodedPayload) {
    return null;
  }

  const decoded = decodeBase64(encodedPayload);
  if (!decoded) {
    return null;
  }

  try {
    const payload = textDecoder.decode(xorWithSecret(decoded));
    return payload.startsWith(API_KEY_PAYLOAD_MARKER)
      ? payload.slice(API_KEY_PAYLOAD_MARKER.length)
      : null;
  } catch (_) {
    return null;
  }
};

const isEncryptedStoredAPIKey = (value: string): boolean => {
  return decodeObfuscatedAPIKeyPayload(value) !== null;
};

export const encryptStoredAPIKey = (value: string): string => {
  if (!value) {
    return value;
  }

  if (isEncryptedStoredAPIKey(value)) {
    return value;
  }

  const encoded = encodeBase64(
    xorWithSecret(textEncoder.encode(`${API_KEY_PAYLOAD_MARKER}${value}`)),
  );
  return encoded ? `${API_KEY_OBFUSCATION_PREFIX}${encoded}` : value;
};

export const decryptStoredAPIKey = (value: string): string => {
  if (!value) {
    return value;
  }

  return decodeObfuscatedAPIKeyPayload(value) ?? value;
};

export const decryptProviderProfiles = (
  profiles: Record<string, AIProviderProfile>,
): Record<string, AIProviderProfile> => {
  return Object.fromEntries(
    Object.entries(profiles).map(([profileId, profile]) => [
      profileId,
      {
        ...profile,
        apiKey: decryptStoredAPIKey(profile.apiKey ?? ""),
      },
    ]),
  );
};

export const encryptProviderProfiles = (
  profiles: Record<string, AIProviderProfile>,
): Record<string, AIProviderProfile> => {
  return Object.fromEntries(
    Object.entries(profiles).map(([profileId, profile]) => [
      profileId,
      {
        ...profile,
        apiKey: encryptStoredAPIKey(profile.apiKey ?? ""),
      },
    ]),
  );
};

type PersistedSettingsWithAPIKeys = {
  aiProviderProfiles?: Record<string, AIProviderProfile>;
  taskboneAPIkey?: string;
};

export const decryptPersistedAPIKeys = <T extends PersistedSettingsWithAPIKeys>(
  settings: T,
): T => {
  const nextSettings = { ...settings };

  if (nextSettings.aiProviderProfiles) {
    nextSettings.aiProviderProfiles = decryptProviderProfiles(
      nextSettings.aiProviderProfiles,
    );
  }

  if (typeof nextSettings.taskboneAPIkey === "string") {
    nextSettings.taskboneAPIkey = decryptStoredAPIKey(
      nextSettings.taskboneAPIkey,
    );
  }

  return nextSettings;
};

export const encryptPersistedAPIKeys = <T extends PersistedSettingsWithAPIKeys>(
  settings: T,
): T => {
  const nextSettings = { ...settings };

  if (nextSettings.aiProviderProfiles) {
    nextSettings.aiProviderProfiles = encryptProviderProfiles(
      nextSettings.aiProviderProfiles,
    );
  }

  if (typeof nextSettings.taskboneAPIkey === "string") {
    nextSettings.taskboneAPIkey = encryptStoredAPIKey(
      nextSettings.taskboneAPIkey,
    );
  }

  return nextSettings;
};
