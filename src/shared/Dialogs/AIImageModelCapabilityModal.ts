import { App, Modal, Notice, Setting } from "obsidian";
import { t } from "src/lang/helpers";
import { AIImageModelCapability } from "src/types/AIUtilTypes";
import { isWinCTRLorMacCMD } from "src/utils/modifierkeyHelper";

type SaveHandler = (
  modelId: string,
  capability: AIImageModelCapability,
  previousModelId?: string,
) => Promise<void> | void;

export class AIImageModelCapabilityModal extends Modal {
  private modelId: string;
  private supportsPromptImageTransforms: boolean;
  private supportsMaskImageEdits: boolean;
  private supportedSizes: string[];
  private onKeyDown: (ev: KeyboardEvent) => void;
  private listenerHost: Document | null = null;

  constructor(
    app: App,
    private readonly existingModelIds: string[],
    private readonly onSave: SaveHandler,
    private readonly options: {
      previousModelId?: string;
      initialModelId?: string;
      initialCapability?: AIImageModelCapability;
    } = {},
  ) {
    super(app);
    this.modelId = options.initialModelId ?? "";
    this.supportsPromptImageTransforms =
      options.initialCapability?.supportsPromptImageTransforms ?? true;
    this.supportsMaskImageEdits =
      options.initialCapability?.supportsMaskImageEdits ?? true;
    this.supportedSizes = [
      ...(options.initialCapability?.supportedSizes?.length
        ? options.initialCapability.supportedSizes
        : ["1024x1024"]),
    ];
  }

  onOpen(): void {
    this.createForm();
  }

  onClose() {
    if (this.listenerHost && this.onKeyDown) {
      this.listenerHost.removeEventListener("keydown", this.onKeyDown);
      this.listenerHost = null;
    }
    this.contentEl.empty();
  }

  private createForm() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl("h1", {
      text: this.options.previousModelId
        ? t("AI_IMAGE_MODEL_CAPABILITY_MODAL_EDIT_TITLE")
        : t("AI_IMAGE_MODEL_CAPABILITY_MODAL_ADD_TITLE"),
    });

    new Setting(contentEl)
      .setName(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_NAME"))
      .setDesc(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(
            t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_PLACEHOLDER"),
          )
          .setValue(this.modelId)
          .onChange((value) => {
            this.modelId = value.trim();
          }),
      );

    new Setting(contentEl)
      .setName(t("AI_IMAGE_MODEL_CAPABILITIES_TRANSFORMS_NAME"))
      .setDesc(t("AI_IMAGE_MODEL_CAPABILITIES_TRANSFORMS_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.supportsPromptImageTransforms)
          .onChange((value) => {
            this.supportsPromptImageTransforms = value;
          }),
      );

    new Setting(contentEl)
      .setName(t("AI_IMAGE_MODEL_CAPABILITIES_MASK_EDITS_NAME"))
      .setDesc(t("AI_IMAGE_MODEL_CAPABILITIES_MASK_EDITS_DESC"))
      .addToggle((toggle) =>
        toggle.setValue(this.supportsMaskImageEdits).onChange((value) => {
          this.supportsMaskImageEdits = value;
        }),
      );

    contentEl.createEl("h3", {
      text: t("AI_IMAGE_MODEL_CAPABILITIES_SIZES_NAME"),
    });
    contentEl.createEl("p", {
      text: t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZES_DESC"),
    });

    const sizesContainer = contentEl.createDiv();
    const renderSizes = () => {
      sizesContainer.empty();
      this.supportedSizes.forEach((size, index) => {
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
                this.supportedSizes[index] = value.trim();
              }),
          )
          .addButton((button) =>
            button
              .setButtonText(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_REMOVE_SIZE"))
              .setDisabled(this.supportedSizes.length <= 1)
              .onClick(() => {
                this.supportedSizes.splice(index, 1);
                renderSizes();
              }),
          );
      });
    };

    renderSizes();

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_ADD_SIZE"))
        .onClick(() => {
          this.supportedSizes.push("1024x1024");
          renderSizes();
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
      if (isWinCTRLorMacCMD(ev) && ev.key === "Enter") {
        void this.save();
      }
    };

    const ownerDoc = this.containerEl.ownerDocument;
    if (ownerDoc) {
      this.listenerHost = ownerDoc;
      ownerDoc.addEventListener("keydown", this.onKeyDown);
    }
  }

  private async save() {
    const normalizedModelId = this.modelId.trim();
    const normalizedSizes = Array.from(
      new Set(this.supportedSizes.map((size) => size.trim()).filter(Boolean)),
    );

    if (!normalizedModelId) {
      new Notice(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_REQUIRED"));
      return;
    }

    if (normalizedSizes.length === 0) {
      new Notice(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZE_REQUIRED"));
      return;
    }

    const duplicateExists =
      this.existingModelIds.includes(normalizedModelId) &&
      normalizedModelId !== this.options.previousModelId;
    if (duplicateExists) {
      new Notice(t("AI_IMAGE_MODEL_CAPABILITIES_MODAL_DUPLICATE_MODEL"));
      return;
    }

    await this.onSave(
      normalizedModelId,
      {
        supportedSizes: normalizedSizes,
        supportsPromptImageTransforms: this.supportsPromptImageTransforms,
        supportsMaskImageEdits: this.supportsMaskImageEdits,
      },
      this.options.previousModelId,
    );
    this.close();
  }
}
