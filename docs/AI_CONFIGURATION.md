# AI models and credential sources

AI remains optional. Text, images and files are sent only when an AI workflow is
invoked. Provider profiles select the API family, base URL and credential source;
model entries select a model ID and its capabilities.

## Credential storage

Existing profiles and Taskbone continue using their saved keys by default. These
are **obfuscated**, not plain text, in the vault's plugin settings. Obfuscation is
reversible and is not encryption.

On Obsidian 1.11.4 or newer, create a secret in Obsidian's settings, then choose
**Obsidian SecretStorage (this device)** and its name in the provider or Taskbone
settings. Choosing that source removes the saved key from Excalidraw settings.
Only the source and reference name are synced. Configure that secret on each
device; an unavailable secret produces an error rather than falling back to a
synced key. Excalidraw does not create, change or delete shared secrets.

Switching back to **Obfuscated settings** requires entering a key again. Existing
backups and version-control history may still contain previously saved keys.
The script-facing `getAISettings()` exposes availability, never credential values
or secret names. Secret values are resolved afresh for each request.

## Reasoning effort

Add or edit an OpenAI text model and select **Reasoning effort**. **Default** omits
the parameter and keeps the API's default. Choices are filtered through the
reviewed capability table in `src/utils/aiReasoning.ts`; unrecognized models offer
Default only. Dated snapshots of listed model IDs use the same capabilities.

For example, `gpt-6.1-sol` supports low, medium, high, xhigh and max; Terra and Luna
also support none. Unsupported stored or scripted values fail before transport.
OpenAI-only fields never enter Anthropic, Google, xAI or compatible-provider
requests. Sampling parameters are omitted for reasoning models that reject them,
including models reasoning at their API default. GPT-6 uses
`max_completion_tokens`, including its reasoning-token budget.

EA requests inherit the selected text-model preference. A `reasoningEffort`
override chooses another supported level; `null` explicitly restores the API
default for that request. Raw `model` overrides do not inherit another model's
effort. ExcaliAI applies and displays the selected OpenAI model's effort for
text results, image analysis and the prompt-writing step before image generation.

## Recommendations for new installations

| Purpose | Default | Reason |
| --- | --- | --- |
| Text | `gpt-6-luna` | Efficient general text tasks |
| Image-aware text | `gpt-6.1-terra` | Visual reasoning |
| Image generation/editing | `gpt-image-2.6-flare` | Fast interactive iteration |

The new-install catalog also offers Sol, Claude Sonnet/Haiku/Opus 5.5, Gemini 3.8
Flash, Grok 4.7, GPT Image 2.6 Sunburst, stable Gemini image models and Grok Imagine
Image 2.0. Existing users keep their complete model maps, defaults, provider URLs,
keys and custom fields; an upgrade never replaces their configured entries.
Add current model IDs explicitly when retiring an old user-configured model.

GPT Image 2.6 supports custom dimensions. The settings supply a useful subset
within its documented limits rather than claiming that the old GPT Image sizes
are exhaustive. PNG remains the pipeline's default output; SVG/GIF-specific
options are not exposed by this change. Gemini Lite exposes only its supported
1K tier; xAI pixel selections are converted to its `aspect_ratio` parameter.

Provider documentation reviewed on November 16, 2026:

- [OpenAI model compatibility](https://developers.openai.com/api/docs/guides/latest-model)
- [OpenAI image generation and dimensions](https://developers.openai.com/api/docs/guides/image-generation)
- [Claude models](https://platform.claude.com/docs/en/models/overview)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini image Lite](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite-image)
- [xAI image generation](https://docs.x.ai/developers/model-capabilities/images/generation)

Automated tests use fake credentials and mocked transport. They validate request
construction, response normalization, secret isolation and persistence without
paid API access. Live model availability, account permissions, provider billing
and output quality require a separate test with the maintainer's own keys.
