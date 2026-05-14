import { App, Modal, Notice, Setting, TextComponent } from "obsidian";
import { t } from "src/lang/helpers";
import { AIProvider, AIProviderProfile } from "src/types/AIUtilTypes";
import { isWinCTRLorMacCMD } from "src/utils/modifierkeyHelper";

type SaveHandler = (
  profileId: string,
  profile: AIProviderProfile,
  previousProfileId?: string,
) => Promise<void> | void;

const configurePasswordTextInput = (text: TextComponent) => {
  const { inputEl } = text;
  inputEl.type = "password";
  inputEl.autocomplete = "off";
  inputEl.spellcheck = false;
  inputEl.addEventListener("focus", () => {
    inputEl.type = "text";
  });
  inputEl.addEventListener("blur", () => {
    inputEl.type = "password";
  });
};

export class AIProviderProfileModal extends Modal {
  private profileId: string;
  private profile: AIProviderProfile;
  private onKeyDown: (ev: KeyboardEvent) => void;
  private listenerHost: Document | null = null;
  private backdropInteractionHandler: ((ev: Event) => void) | null = null;

  constructor(
    app: App,
    private readonly existingProfileIds: string[],
    private readonly onSave: SaveHandler,
    private readonly options: {
      previousProfileId?: string;
      initialProfileId?: string;
      initialProfile?: AIProviderProfile;
    } = {},
  ) {
    super(app);
    this.profileId = options.initialProfileId ?? "";
    this.profile = {
      provider: options.initialProfile?.provider ?? "openai",
      apiKey: options.initialProfile?.apiKey ?? "",
      baseURL: options.initialProfile?.baseURL ?? "",
    };
  }

  onOpen(): void {
    this.backdropInteractionHandler = (ev: Event) => {
      if (ev.target === this.containerEl) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    };
    this.containerEl.addEventListener(
      "mousedown",
      this.backdropInteractionHandler,
      true,
    );
    this.containerEl.addEventListener(
      "click",
      this.backdropInteractionHandler,
      true,
    );
    this.createForm();
  }

  onClose() {
    if (this.backdropInteractionHandler) {
      this.containerEl.removeEventListener(
        "mousedown",
        this.backdropInteractionHandler,
        true,
      );
      this.containerEl.removeEventListener(
        "click",
        this.backdropInteractionHandler,
        true,
      );
      this.backdropInteractionHandler = null;
    }
    if (this.listenerHost && this.onKeyDown) {
      this.listenerHost.removeEventListener("keydown", this.onKeyDown, true);
      this.listenerHost = null;
    }
    this.contentEl.empty();
  }

  private createForm() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl("h1", {
      text: this.options.previousProfileId
        ? t("AI_PROVIDER_PROFILE_MODAL_EDIT_TITLE")
        : t("AI_PROVIDER_PROFILE_MODAL_ADD_TITLE"),
    });

    new Setting(contentEl)
      .setName(t("AI_PROVIDER_PROFILE_MODAL_NAME_NAME"))
      .setDesc(t("AI_PROVIDER_PROFILE_MODAL_NAME_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_PROVIDER_PROFILE_MODAL_NAME_PLACEHOLDER"))
          .setValue(this.profileId)
          .onChange((value) => {
            this.profileId = value.trim();
          }),
      );

    new Setting(contentEl)
      .setName(t("AI_PROVIDER_PROFILE_MODAL_TYPE_NAME"))
      .setDesc(t("AI_PROVIDER_PROFILE_MODAL_TYPE_DESC"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("openai", t("AI_PROVIDER_OPTION_OPENAI"))
          .addOption("anthropic", t("AI_PROVIDER_OPTION_ANTHROPIC"))
          .addOption("google", t("AI_PROVIDER_OPTION_GOOGLE"))
          .addOption("xai", t("AI_PROVIDER_OPTION_XAI"))
          .addOption(
            "openai-compatible",
            t("AI_PROVIDER_OPTION_OPENAI_COMPATIBLE"),
          )
          .setValue(this.profile.provider)
          .onChange((value) => {
            this.profile.provider = value as AIProvider;
            updateProviderTypeHint();
          }),
      );

    const providerTypeHintEl = contentEl.createDiv({
      cls: "setting-item-description",
    });
    const updateProviderTypeHint = () => {
      if (this.profile.provider === "openai-compatible") {
        providerTypeHintEl.setText(
          t("AI_PROVIDER_PROFILE_MODAL_OPENAI_COMPATIBLE_HINT"),
        );
        return;
      }

      providerTypeHintEl.empty();
    };
    updateProviderTypeHint();

    new Setting(contentEl)
      .setName(t("AI_PROVIDER_PROFILE_MODAL_API_KEY_NAME"))
      .setDesc(t("AI_PROVIDER_PROFILE_MODAL_API_KEY_DESC"))
      .addText((text) => {
        configurePasswordTextInput(text);
        return text
          .setPlaceholder(t("AI_PROVIDER_PROFILE_MODAL_API_KEY_PLACEHOLDER"))
          .setValue(this.profile.apiKey)
          .onChange((value) => {
            this.profile.apiKey = value;
          });
      });

    new Setting(contentEl)
      .setName(t("AI_PROVIDER_PROFILE_MODAL_BASE_URL_NAME"))
      .setDesc(t("AI_PROVIDER_PROFILE_MODAL_BASE_URL_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_PROVIDER_PROFILE_MODAL_BASE_URL_PLACEHOLDER"))
          .setValue(this.profile.baseURL)
          .onChange((value) => {
            this.profile.baseURL = value.trim();
          }),
      );

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(t("PROMPT_BUTTON_CANCEL"))
          .onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText(t("PROMPT_BUTTON_OK"))
          .setCta()
          .onClick(() => void this.save()),
      );

    this.onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      if (isWinCTRLorMacCMD(ev) && ev.key === "Enter") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        void this.save();
      }
    };

    const ownerDoc = this.containerEl.ownerDocument;
    if (ownerDoc) {
      this.listenerHost = ownerDoc;
      ownerDoc.addEventListener("keydown", this.onKeyDown, true);
    }
  }

  private async save() {
    const normalizedProfileId = this.profileId.trim();
    if (!normalizedProfileId) {
      new Notice(t("AI_PROVIDER_PROFILE_MODAL_NAME_REQUIRED"));
      return;
    }

    const duplicateExists =
      this.existingProfileIds.includes(normalizedProfileId) &&
      normalizedProfileId !== this.options.previousProfileId;
    if (duplicateExists) {
      new Notice(t("AI_PROVIDER_PROFILE_MODAL_DUPLICATE_NAME"));
      return;
    }

    await this.onSave(
      normalizedProfileId,
      {
        provider: this.profile.provider,
        apiKey: this.profile.apiKey,
        baseURL: this.profile.baseURL,
      },
      this.options.previousProfileId,
    );
    this.close();
  }
}
