import { App, Modal, Notice, Setting } from "obsidian";
import { t } from "src/lang/helpers";
import {
  AIImageModelConfig,
  AIModelConfig,
  AIProviderProfile,
} from "src/types/AIUtilTypes";
import {
  getGeminiSupportedSizes,
  isGeminiImageModel,
} from "src/utils/geminiImageModelUtils";
import { isWinCTRLorMacCMD } from "src/utils/modifierkeyHelper";

type SaveHandler<TConfig extends AIModelConfig> = (
  modelId: string,
  config: TConfig,
  previousModelId?: string,
) => Promise<void> | void;

type AIModelConfigModalOptions<TConfig extends AIModelConfig> = {
  kind: "text" | "vision" | "image";
  providerIds: string[];
  providerProfiles: Record<string, AIProviderProfile>;
  previousModelId?: string;
  initialModelId?: string;
  initialConfig?: TConfig;
};

export class AIModelConfigModal<
  TConfig extends AIModelConfig | AIImageModelConfig,
> extends Modal {
  private modelId: string;
  private config: TConfig;
  private onKeyDown: (ev: KeyboardEvent) => void;
  private listenerHost: Document | null = null;
  private backdropInteractionHandler: ((ev: Event) => void) | null = null;

  constructor(
    app: App,
    private readonly existingModelIds: string[],
    private readonly onSave: SaveHandler<TConfig>,
    private readonly options: AIModelConfigModalOptions<TConfig>,
  ) {
    super(app);
    const firstProviderId = options.providerIds[0] ?? "";
    this.modelId = options.initialModelId ?? "";
    this.config = {
      providerId: options.initialConfig?.providerId ?? firstProviderId,
      model: options.initialConfig?.model ?? "",
      endpoint: options.initialConfig?.endpoint ?? "",
      ...(options.kind === "text"
        ? {
            multimodalSupport: options.initialConfig?.multimodalSupport ?? true,
          }
        : {}),
      ...(options.kind === "image"
        ? {
            supportedSizes: [
              ...((options.initialConfig as AIImageModelConfig | undefined)
                ?.supportedSizes?.length
                ? (options.initialConfig as AIImageModelConfig).supportedSizes
                : ["1024x1024"]),
            ],
            supportsPromptImageTransforms:
              (options.initialConfig as AIImageModelConfig | undefined)
                ?.supportsPromptImageTransforms ?? true,
            supportsMaskImageEdits:
              (options.initialConfig as AIImageModelConfig | undefined)
                ?.supportsMaskImageEdits ?? true,
          }
        : {}),
    } as TConfig;

    this.syncDerivedGeminiImageSizes();
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

  private getTitle() {
    const isEdit = Boolean(this.options.previousModelId);
    switch (this.options.kind) {
      case "vision":
        return isEdit
          ? t("AI_VISION_MODEL_MODAL_EDIT_TITLE")
          : t("AI_VISION_MODEL_MODAL_ADD_TITLE");
      case "image":
        return isEdit
          ? t("AI_IMAGE_MODEL_MODAL_EDIT_TITLE")
          : t("AI_IMAGE_MODEL_MODAL_ADD_TITLE");
      default:
        return isEdit
          ? t("AI_TEXT_MODEL_MODAL_EDIT_TITLE")
          : t("AI_TEXT_MODEL_MODAL_ADD_TITLE");
    }
  }

  private getCurrentProviderType() {
    return this.options.providerProfiles[this.config.providerId]?.provider;
  }

  private isCurrentGeminiImageModel() {
    return (
      this.options.kind === "image" &&
      isGeminiImageModel(this.getCurrentProviderType(), this.config.model)
    );
  }

  private syncDerivedGeminiImageSizes() {
    if (this.options.kind !== "image") {
      return;
    }

    const supportedSizes = getGeminiSupportedSizes(
      this.getCurrentProviderType(),
      this.config.model,
    );
    if (supportedSizes.length > 0) {
      (this.config as AIImageModelConfig).supportedSizes = [...supportedSizes];
    }
  }

  private createForm() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl("h1", { text: this.getTitle() });
    let updateImageSizeControls = () => {};

    new Setting(contentEl)
      .setName(t("AI_MODEL_CONFIG_MODAL_NAME_NAME"))
      .setDesc(t("AI_MODEL_CONFIG_MODAL_NAME_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_MODEL_CONFIG_MODAL_NAME_PLACEHOLDER"))
          .setValue(this.modelId)
          .onChange((value) => {
            this.modelId = value.trim();
          }),
      );

    new Setting(contentEl)
      .setName(t("AI_MODEL_CONFIG_MODAL_PROVIDER_NAME"))
      .setDesc(t("AI_MODEL_CONFIG_MODAL_PROVIDER_DESC"))
      .addDropdown((dropdown) => {
        this.options.providerIds.forEach((providerId) =>
          dropdown.addOption(providerId, providerId),
        );
        return dropdown.setValue(this.config.providerId).onChange((value) => {
          this.config.providerId = value;
          if (this.options.kind === "image") {
            this.syncDerivedGeminiImageSizes();
            updateImageSizeControls();
          }
        });
      });

    new Setting(contentEl)
      .setName(t("AI_MODEL_CONFIG_MODAL_MODEL_NAME"))
      .setDesc(t("AI_MODEL_CONFIG_MODAL_MODEL_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_MODEL_CONFIG_MODAL_MODEL_PLACEHOLDER"))
          .setValue(this.config.model)
          .onChange((value) => {
            this.config.model = value.trim();
            if (this.options.kind === "image") {
              this.syncDerivedGeminiImageSizes();
              updateImageSizeControls();
            }
          }),
      );

    if (this.options.kind !== "image") {
      new Setting(contentEl)
        .setName(t("AI_MODEL_CONFIG_MODAL_ENDPOINT_NAME"))
        .setDesc(t("AI_MODEL_CONFIG_MODAL_ENDPOINT_DESC"))
        .addText((text) =>
          text
            .setPlaceholder(t("AI_MODEL_CONFIG_MODAL_ENDPOINT_PLACEHOLDER"))
            .setValue(this.config.endpoint ?? "")
            .onChange((value) => {
              this.config.endpoint = value.trim();
            }),
        );
    }

    if (this.options.kind === "text") {
      new Setting(contentEl)
        .setName(t("AI_MODEL_CONFIG_MODAL_MULTIMODAL_NAME"))
        .setDesc(t("AI_MODEL_CONFIG_MODAL_MULTIMODAL_DESC"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.config.multimodalSupport !== false)
            .onChange((value) => {
              this.config.multimodalSupport = value;
            }),
        );
    }

    if (this.options.kind === "image") {
      const imageConfig = this.config as AIImageModelConfig;
      const sizesSection = contentEl.createDiv();
      sizesSection.createEl("h3", {
        text: t("AI_IMAGE_MODEL_CAPABILITIES_SIZES_NAME"),
      });
      sizesSection.createEl("p", {
        text: t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZES_DESC"),
      });
      const sizesContainer = sizesSection.createDiv();
      const renderSizes = () => {
        sizesContainer.empty();
        imageConfig.supportedSizes.forEach((size, index) => {
          new Setting(sizesContainer)
            .setName(
              `${t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZE_LABEL")} ${index + 1}`,
            )
            .addText((text) =>
              text
                .setPlaceholder(
                  t("AI_IMAGE_MODEL_CAPABILITIES_SIZES_PLACEHOLDER"),
                )
                .setValue(size)
                .onChange((value) => {
                  imageConfig.supportedSizes[index] = value.trim();
                }),
            )
            .addButton((button) =>
              button
                .setButtonText(
                  t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_REMOVE_SIZE"),
                )
                .setDisabled(imageConfig.supportedSizes.length <= 1)
                .onClick(() => {
                  imageConfig.supportedSizes.splice(index, 1);
                  renderSizes();
                }),
            );
        });
      };
      updateImageSizeControls = () => {
        sizesSection.style.display = this.isCurrentGeminiImageModel()
          ? "none"
          : "";
        renderSizes();
      };

      new Setting(sizesSection).addButton((button) =>
        button
          .setButtonText(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_ADD_SIZE"))
          .onClick(() => {
            imageConfig.supportedSizes.push("1024x1024");
            renderSizes();
          }),
      );
      updateImageSizeControls();

      new Setting(contentEl)
        .setName(t("AI_IMAGE_MODEL_CAPABILITIES_TRANSFORMS_NAME"))
        .setDesc(t("AI_IMAGE_MODEL_CAPABILITIES_TRANSFORMS_DESC"))
        .addToggle((toggle) =>
          toggle
            .setValue(imageConfig.supportsPromptImageTransforms)
            .onChange((value) => {
              imageConfig.supportsPromptImageTransforms = value;
            }),
        );

      new Setting(contentEl)
        .setName(t("AI_IMAGE_MODEL_CAPABILITIES_MASK_EDITS_NAME"))
        .setDesc(t("AI_IMAGE_MODEL_CAPABILITIES_MASK_EDITS_DESC"))
        .addToggle((toggle) =>
          toggle
            .setValue(imageConfig.supportsMaskImageEdits)
            .onChange((value) => {
              imageConfig.supportsMaskImageEdits = value;
            }),
        );
    }

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
    const normalizedModelId = this.modelId.trim();
    if (!normalizedModelId) {
      new Notice(t("AI_MODEL_CONFIG_MODAL_NAME_REQUIRED"));
      return;
    }
    if (!this.config.providerId) {
      new Notice(t("AI_MODEL_CONFIG_MODAL_PROVIDER_REQUIRED"));
      return;
    }
    if (!this.config.model.trim()) {
      new Notice(t("AI_MODEL_CONFIG_MODAL_MODEL_REQUIRED"));
      return;
    }

    if (this.options.kind === "image") {
      const imageConfig = this.config as AIImageModelConfig;
      if (this.isCurrentGeminiImageModel()) {
        this.syncDerivedGeminiImageSizes();
      }
      imageConfig.supportedSizes = Array.from(
        new Set(
          imageConfig.supportedSizes.map((size) => size.trim()).filter(Boolean),
        ),
      );
      if (imageConfig.supportedSizes.length === 0) {
        new Notice(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZE_REQUIRED"));
        return;
      }
    }

    const duplicateExists =
      this.existingModelIds.includes(normalizedModelId) &&
      normalizedModelId !== this.options.previousModelId;
    if (duplicateExists) {
      new Notice(t("AI_MODEL_CONFIG_MODAL_DUPLICATE_NAME"));
      return;
    }

    await this.onSave(
      normalizedModelId,
      {
        ...this.config,
        model: this.config.model.trim(),
        endpoint: this.config.endpoint?.trim() || "",
      },
      this.options.previousModelId,
    );
    this.close();
  }
}
