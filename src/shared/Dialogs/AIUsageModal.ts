import { App, Modal, Notice, Setting } from "obsidian";
import { t } from "src/lang/helpers";
import { AIUsageData } from "src/types/AIUtilTypes";

/**
 * Displays accumulated AI token usage for the current session.
 * Provides a per-model breakdown table and a button to copy the data
 * as a Markdown table.
 */
export class AIUsageModal extends Modal {
  constructor(
    app: App,
    private readonly usage: AIUsageData,
  ) {
    super(app);
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private formatTokens(n: number): string {
    if (n === 0) {
      return "0";
    }
    if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(2)}M`;
    }
    if (n >= 1_000) {
      return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return String(n);
  }

  private buildMarkdownTable(): string {
    const { textModels, imageModels } = this.usage;
    const textEntries = Object.entries(textModels);
    const imageEntries = Object.entries(imageModels);

    const lines: string[] = [t("AI_USAGE_MODAL_TABLE_MARKDOWN_TITLE"), ""];

    if (textEntries.length > 0) {
      lines.push(
        `| ${t("AI_USAGE_MODAL_TABLE_COL_MODEL")} | ${t("AI_USAGE_MODAL_TABLE_COL_INPUT")} | ${t("AI_USAGE_MODAL_TABLE_COL_OUTPUT")} |`,
        `|---|---:|---:|`,
      );
      for (const [modelId, entry] of textEntries) {
        lines.push(
          `| ${modelId} | ${entry.inputTokens.toLocaleString()} | ${entry.outputTokens.toLocaleString()} |`,
        );
      }
      lines.push(
        `| **${t("AI_USAGE_MODAL_TABLE_TOTAL")}** | **${this.usage.totalInputTokens.toLocaleString()}** | **${this.usage.totalOutputTokens.toLocaleString()}** |`,
      );
    }

    if (imageEntries.length > 0) {
      if (textEntries.length > 0) {
        lines.push("");
      }
      lines.push(
        `| ${t("AI_USAGE_MODAL_TABLE_COL_IMAGE_MODEL")} | ${t("AI_USAGE_MODAL_TABLE_COL_GENERATIONS")} |`,
        `|---|---:|`,
      );
      for (const [modelId, entry] of imageEntries) {
        lines.push(`| ${modelId} | ${entry.generations} |`);
      }
      const totalImgs = this.usage.totalImageGenerations;
      lines.push(
        `| **${t("AI_USAGE_MODAL_TABLE_TOTAL")}** | **${totalImgs}** |`,
      );
    }

    if (textEntries.length === 0 && imageEntries.length === 0) {
      lines.push(t("AI_USAGE_MODAL_NO_USAGE"));
    }

    return lines.join("\n");
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: t("AI_USAGE_MODAL_TITLE") });

    const { textModels, imageModels } = this.usage;
    const textEntries = Object.entries(textModels);
    const imageEntries = Object.entries(imageModels);
    const hasAnyUsage = textEntries.length > 0 || imageEntries.length > 0;

    if (!hasAnyUsage) {
      contentEl.createEl("p", { text: t("AI_USAGE_MODAL_NO_USAGE") });
    } else {
      // Text / multimodal model table
      if (textEntries.length > 0) {
        contentEl.createEl("h3", {
          text: t("AI_USAGE_MODAL_TEXT_MODELS_HEADING"),
        });

        const table = contentEl.createEl("table", {
          cls: "excalidraw-ai-usage-table",
        });
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.createEl("th", {
          text: t("AI_USAGE_MODAL_TABLE_COL_MODEL"),
        });
        headerRow.createEl("th", {
          text: t("AI_USAGE_MODAL_TABLE_COL_INPUT"),
          attr: { style: "text-align:right" },
        });
        headerRow.createEl("th", {
          text: t("AI_USAGE_MODAL_TABLE_COL_OUTPUT"),
          attr: { style: "text-align:right" },
        });

        const tbody = table.createEl("tbody");
        for (const [modelId, entry] of textEntries) {
          const row = tbody.createEl("tr");
          row.createEl("td", { text: modelId });
          row.createEl("td", {
            text: this.formatTokens(entry.inputTokens),
            attr: {
              style: "text-align:right; font-variant-numeric: tabular-nums",
            },
          });
          row.createEl("td", {
            text: this.formatTokens(entry.outputTokens),
            attr: {
              style: "text-align:right; font-variant-numeric: tabular-nums",
            },
          });
        }

        // Totals row
        const tfoot = table.createEl("tfoot");
        const totalRow = tfoot.createEl("tr");
        totalRow.createEl("td", {
          text: t("AI_USAGE_MODAL_TABLE_TOTAL"),
          attr: { style: "font-weight:bold" },
        });
        totalRow.createEl("td", {
          text: this.formatTokens(this.usage.totalInputTokens),
          attr: {
            style:
              "text-align:right; font-weight:bold; font-variant-numeric: tabular-nums",
          },
        });
        totalRow.createEl("td", {
          text: this.formatTokens(this.usage.totalOutputTokens),
          attr: {
            style:
              "text-align:right; font-weight:bold; font-variant-numeric: tabular-nums",
          },
        });
      }

      // Image generation table
      if (imageEntries.length > 0) {
        contentEl.createEl("h3", {
          text: t("AI_USAGE_MODAL_IMAGE_MODELS_HEADING"),
        });

        const table = contentEl.createEl("table", {
          cls: "excalidraw-ai-usage-table",
        });
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.createEl("th", {
          text: t("AI_USAGE_MODAL_TABLE_COL_IMAGE_MODEL"),
        });
        headerRow.createEl("th", {
          text: t("AI_USAGE_MODAL_TABLE_COL_GENERATIONS"),
          attr: { style: "text-align:right" },
        });

        const tbody = table.createEl("tbody");
        for (const [modelId, entry] of imageEntries) {
          const row = tbody.createEl("tr");
          row.createEl("td", { text: modelId });
          row.createEl("td", {
            text: String(entry.generations),
            attr: {
              style: "text-align:right; font-variant-numeric: tabular-nums",
            },
          });
        }

        // Totals row
        const tfoot = table.createEl("tfoot");
        const totalRow = tfoot.createEl("tr");
        totalRow.createEl("td", {
          text: t("AI_USAGE_MODAL_TABLE_TOTAL"),
          attr: { style: "font-weight:bold" },
        });
        totalRow.createEl("td", {
          text: String(this.usage.totalImageGenerations),
          attr: {
            style:
              "text-align:right; font-weight:bold; font-variant-numeric: tabular-nums",
          },
        });
      }
    }

    // Session note
    contentEl.createEl("p", {
      text: t("AI_USAGE_MODAL_SESSION_NOTE"),
      cls: "setting-item-description",
      attr: { style: "margin-top: 0.75em" },
    });

    // Buttons
    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText(t("AI_USAGE_MODAL_COPY_MARKDOWN")).onClick(() => {
          const md = this.buildMarkdownTable();
          navigator.clipboard.writeText(md).then(
            () => new Notice(t("AI_USAGE_MODAL_COPY_SUCCESS")),
            () => new Notice(t("AI_USAGE_MODAL_COPY_FAILURE")),
          );
        }),
      )
      .addButton((button) =>
        button
          .setButtonText(t("PROMPT_BUTTON_OK"))
          .setCta()
          .onClick(() => this.close()),
      );
  }
}
