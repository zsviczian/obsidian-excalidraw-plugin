/** Read optional capabilities through K-Plex's documented public v1 API. */
type PublicRecord = Record<string, unknown>;
type PublicRead = (this: PublicRecord, ...args: unknown[]) => unknown;

export function isPublicRecord(value: unknown): value is PublicRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicRead(value: unknown): value is PublicRead {
  return typeof value === "function";
}

export function getKplexPublicRead(owner: Window, operation: string) {
  try {
    const local: unknown = Reflect.get(owner, "kplexApi");
    const provider: unknown = isPublicRecord(local) ? local : Reflect.get(window, "kplexApi");
    if (!isPublicRecord(provider) || provider.version !== 1 || !isPublicRecord(provider.v1)) return null;
    const api = provider.v1;
    const read = api[operation];
    if (api.version !== 1 || !isPublicRead(api.capabilities) || !isPublicRead(read)) return null;
    const capabilities = api.capabilities();
    if (!isPublicRecord(capabilities) || capabilities.ok !== true || !isPublicRecord(capabilities.value) ||
        !Array.isArray(capabilities.value.operations) || capabilities.value.operations.length > 64 ||
        !capabilities.value.operations.includes(operation)) return null;
    return { provider, api, read };
  } catch { return null; }
}
