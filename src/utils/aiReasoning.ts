import type { AIProvider, AIReasoningEffort } from "src/types/AIUtilTypes";

/**
 * Chat Completions capabilities, verified against the provider model pages.
 * Unknown models keep API defaults until their capabilities are reviewed.
 * https://developers.openai.com/api/docs/guides/latest-model
 * https://developers.openai.com/api/docs/guides/reasoning
 */
const MODEL_EFFORTS: Record<string, readonly AIReasoningEffort[]> = {
  "gpt-6.1-sol": ["low", "medium", "high", "xhigh", "max"],
  "gpt-6.1-terra": ["none", "low", "medium", "high", "xhigh", "max"],
  "gpt-6-sol": ["none", "low", "medium", "high", "xhigh", "max"],
  "gpt-6-luna": ["none", "low", "medium", "high", "xhigh", "max"],
  "gpt-6-astra": ["low", "medium", "high", "xhigh", "max"],
  "gpt-5": ["minimal", "low", "medium", "high"],
  "gpt-5-mini": ["minimal", "low", "medium", "high"],
  "gpt-5-nano": ["minimal", "low", "medium", "high"],
  "gpt-5.1": ["none", "low", "medium", "high"],
  "gpt-5.2": ["none", "low", "medium", "high", "xhigh"],
  "gpt-5.4": ["none", "low", "medium", "high", "xhigh"],
  "o1": ["low", "medium", "high"],
  "o3": ["low", "medium", "high"],
  "o3-mini": ["low", "medium", "high"],
  "o4-mini": ["low", "medium", "high"],
};

/** Lists reviewed effort values, including dated snapshots of known models. */
export function getAIReasoningEfforts(provider: AIProvider, model: string): readonly AIReasoningEffort[] {
  return provider === "openai"
    ? MODEL_EFFORTS[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")] ?? []
    : [];
}

/** Omits sampling for models that reason by default, as well as explicit reasoning. */
export function supportsAITextTemperature(provider: AIProvider, model: string, effort?: AIReasoningEffort): boolean {
  if (provider !== "openai") return true;
  if (/^(o[134](?:-|$)|gpt-5(?:-mini|-nano)?(?:-\d{4}-\d{2}-\d{2})?$)/.test(model)) return false;
  if (/^gpt-6/.test(model)) return effort === "none";
  return !effort || effort === "none";
}
