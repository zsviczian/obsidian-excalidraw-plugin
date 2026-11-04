/** Optional public K-Plex completion boundary. Matching and ontology policy stay in K-Plex;
 * this consumer validates bounded detached data and retains only the offered API incarnation.
 * Every read reacquires the public window entry point, including after reload or in a popout. */

type DataRecord = Record<string, unknown>;
type PublicRead = (this: DataRecord, ...args: unknown[]) => unknown;
export type OntologyFieldSuggestion = Readonly<{name: string; partner?: string; description?: string}>;
export type OntologyCompletionOffer = Readonly<{
  provider: DataRecord;
  api: DataRecord;
  read: PublicRead;
  configuration: number;
  text: string;
  cursor: number;
  range: Readonly<{start: number; end: number}>;
  items: readonly OntologyFieldSuggestion[];
}>;

const MAX_TEXT = 65_536;
const MAX_ITEMS = 100;
const MAX_OUTPUT = 1_048_576;

/** Narrow only plain object-shaped protocol values; arrays are never envelopes or API roots. */
function record(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A public method is invoked with its captured API as receiver, preserving service ownership. */
function callable(value: unknown): value is PublicRead {
  return typeof value === "function";
}

/** Read the documented public root, preferring the input's realm and its supported popout alias. */
function providerFor(input: HTMLInputElement | HTMLTextAreaElement): DataRecord | null {
  const owner = input.ownerDocument.defaultView ?? window;
  const local: unknown = Reflect.get(owner, "kplexApi");
  if (record(local)) return local;
  const main: unknown = Reflect.get(window, "kplexApi");
  return record(main) ? main : null;
}

/** Request current public completion without loading K-Plex, reading private settings or issuing
 * graph work. Missing, old, disabled, retired, malformed and throwing providers are silent fallbacks.
 * Replacement integrity is checked against the original input, never a normalized display label. */
export function readKplexOntologyCompletion(
  input: HTMLInputElement | HTMLTextAreaElement,
  limit = 20,
): OntologyCompletionOffer | null {
  const text = input.value, cursor = input.selectionStart;
  if (input.isConnected === false || cursor === null || cursor !== input.selectionEnd ||
    text.length > MAX_TEXT || !Number.isInteger(limit) || limit < 1 || limit > MAX_ITEMS) return null;
  try {
    const provider = providerFor(input);
    if (!provider || provider.version !== 1 || !record(provider.v1)) return null;
    const api = provider.v1;
    if (api.version !== 1 || !callable(api.capabilities) || !callable(api.completeOntology)) return null;
    const capabilities: unknown = api.capabilities.call(api);
    if (!record(capabilities) || capabilities.ok !== true || !record(capabilities.value) ||
      !Array.isArray(capabilities.value.operations) || capabilities.value.operations.length > 64 ||
      !capabilities.value.operations.includes("completeOntology")) return null;
    const read = api.completeOntology;
    const result: unknown = read.call(api, {text, cursor, limit});
    if (!record(result) || result.ok !== true || !record(result.revision) ||
      !Number.isSafeInteger(result.revision.configuration) || Number(result.revision.configuration) < 0 ||
      !record(result.value) || result.value.state !== "matched") return null;
    const value = result.value, context = value.context;
    if (!record(context) || !record(context.range) || !Array.isArray(value.items) || value.items.length > limit) return null;
    const start = context.range.start, end = context.range.end;
    if (typeof start !== "number" || !Number.isInteger(start) || start < 0 || start > cursor || end !== cursor ||
      typeof context.trigger !== "string" || typeof context.query !== "string" ||
      text.slice(start, cursor) !== context.trigger + context.query) return null;
    const items: OntologyFieldSuggestion[] = [];
    let budget = text.length + context.trigger.length + context.query.length;
    for (const field of value.items) {
      if (!record(field) || typeof field.name !== "string" || !field.name || field.name.length > MAX_TEXT ||
        (field.partner !== undefined && typeof field.partner !== "string") ||
        (field.description !== undefined && typeof field.description !== "string")) return null;
      const partner = typeof field.partner === "string" ? field.partner : undefined;
      const description = typeof field.description === "string" ? field.description : undefined;
      budget += field.name.length + (partner?.length ?? 0) + (description?.length ?? 0);
      if (budget > MAX_OUTPUT) return null;
      items.push({name: field.name, partner, description});
    }
    return {provider, api, read, configuration: Number(result.revision.configuration), text, cursor,
      range: {start, end: cursor}, items};
  } catch {
    // Another optional plugin's failure must not interrupt ordinary input or existing suggestions.
    return null;
  }
}

/** Recheck identity, configuration and the exact input/range before a captured row may mutate it.
 * Semantic/source revisions are deliberately irrelevant to this configuration-only completion. */
export function isKplexOntologyOfferCurrent(
  input: HTMLInputElement | HTMLTextAreaElement,
  offer: OntologyCompletionOffer,
  name: string,
): boolean {
  if (input.value !== offer.text || input.selectionStart !== offer.cursor || input.selectionEnd !== offer.cursor) return false;
  const current = readKplexOntologyCompletion(input, Math.max(20, offer.items.length));
  return current !== null && current.provider === offer.provider && current.api === offer.api && current.read === offer.read &&
    current.configuration === offer.configuration && current.range.start === offer.range.start && current.range.end === offer.range.end &&
    current.items.some(field => field.name === name);
}
