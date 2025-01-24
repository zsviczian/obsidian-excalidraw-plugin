import { Setting } from "obsidian";
import { PageOrientation, PageSize, PDFPageAlignment, PDFPageMarginString, STANDARD_PAGE_SIZES } from "src/utils/exportUtils";
import { t } from "src/lang/helpers";

export interface PDFExportSettings {
  pageSize: PageSize;
  pageOrientation: PageOrientation;
  fitToPage: number;
  paperColor: "white" | "scene" | "custom";
  customPaperColor: string;
  alignment: PDFPageAlignment;
  margin: PDFPageMarginString;
}

export class PDFExportSettingsComponent {
  constructor(
    private contentEl: HTMLElement,
    private settings: PDFExportSettings,
    private update?: Function,
  ) {
    if (!update) this.update = () => {};
  }

  render() {
    const pageSizeOptions: Record<string, string> = Object.keys(STANDARD_PAGE_SIZES)
      .reduce((acc, key) => ({
        ...acc,
        [key]: key
      }), {});

    new Setting(this.contentEl)
      .setName(t("EXPORTDIALOG_PAGE_SIZE"))
      .addDropdown(dropdown => 
        dropdown
          .addOptions(pageSizeOptions)
          .setValue(this.settings.pageSize)
          .onChange(value => {
            this.settings.pageSize = value as PageSize;
            this.update();
          })
      );

    new Setting(this.contentEl)
      .setName(t("EXPORTDIALOG_PAGE_ORIENTATION"))
      .addDropdown(dropdown => 
        dropdown
          .addOptions({
            "portrait": t("EXPORTDIALOG_ORIENTATION_PORTRAIT"),
            "landscape": t("EXPORTDIALOG_ORIENTATION_LANDSCAPE")
          })
          .setValue(this.settings.pageOrientation)
          .onChange(value => {
            this.settings.pageOrientation = value as PageOrientation;
            this.update();
          })
      );
    
    new Setting(this.contentEl)
      .setName(t("EXPORTDIALOG_PDF_FIT_TO_PAGE"))
      .addDropdown(dropdown => 
        dropdown
          .addOptions({
            "scale": t("EXPORTDIALOG_PDF_SCALE_OPTION"),
            "fit": t("EXPORTDIALOG_PDF_FIT_OPTION"),
            "fit-2": t("EXPORTDIALOG_PDF_FIT_2_OPTION"),
            "fit-4": t("EXPORTDIALOG_PDF_FIT_4_OPTION"),
            "fit-6": t("EXPORTDIALOG_PDF_FIT_6_OPTION"),
            "fit-8": t("EXPORTDIALOG_PDF_FIT_8_OPTION"),
            "fit-12": t("EXPORTDIALOG_PDF_FIT_12_OPTION"),
            "fit-16": t("EXPORTDIALOG_PDF_FIT_16_OPTION")
          })
          .setValue(this.settings.fitToPage === 1 ? "fit" : 
            (typeof this.settings.fitToPage === "number" ? `fit-${this.settings.fitToPage}` : "scale"))
          .onChange(value => {
            this.settings.fitToPage = value === "scale" ? 0 : 
              (value === "fit" ? 1 : parseInt(value.split("-")[1]));
            this.update();
          })
      );

    new Setting(this.contentEl)
      .setName(t("EXPORTDIALOG_PDF_MARGIN"))
      .addDropdown(dropdown => 
        dropdown
          .addOptions({
            "none": t("EXPORTDIALOG_PDF_MARGIN_NONE"),
            "tiny": t("EXPORTDIALOG_PDF_MARGIN_TINY"),
            "normal": t("EXPORTDIALOG_PDF_MARGIN_NORMAL")
          })
          .setValue(this.settings.margin)
          .onChange(value => {
            this.settings.margin = value as PDFPageMarginString;
            this.update();
          })
      );

    const paperColorSetting = new Setting(this.contentEl)
      .setName(t("EXPORTDIALOG_PDF_PAPER_COLOR"))
      .addDropdown(dropdown => 
        dropdown
          .addOptions({
            "white": t("EXPORTDIALOG_PDF_PAPER_WHITE"),
            "scene": t("EXPORTDIALOG_PDF_PAPER_SCENE"),
            "custom": t("EXPORTDIALOG_PDF_PAPER_CUSTOM")
          })
          .setValue(this.settings.paperColor)
          .onChange(value => {
            this.settings.paperColor = value as typeof this.settings.paperColor;
            colorInput.style.display = (value === "custom") ? "block" : "none";
            this.update();
          })
      );

    const colorInput = paperColorSetting.controlEl.createEl("input", {
      type: "color",
      value: this.settings.customPaperColor
    });
    colorInput.style.width = "50px";
    colorInput.style.marginLeft = "10px";
    colorInput.style.display = this.settings.paperColor === "custom" ? "block" : "none";
    colorInput.addEventListener("change", (e) => {
      this.settings.customPaperColor = (e.target as HTMLInputElement).value;
      this.update();
    });

    new Setting(this.contentEl)
      .setName(t("EXPORTDIALOG_PDF_ALIGNMENT"))
      .addDropdown(dropdown => 
        dropdown
          .addOptions({
            "center": t("EXPORTDIALOG_PDF_ALIGN_CENTER"),
            "center-left": t("EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT"),
            "center-right": t("EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT"),
            "top-left": t("EXPORTDIALOG_PDF_ALIGN_TOP_LEFT"),
            "top-center": t("EXPORTDIALOG_PDF_ALIGN_TOP_CENTER"),
            "top-right": t("EXPORTDIALOG_PDF_ALIGN_TOP_RIGHT"),
            "bottom-left": t("EXPORTDIALOG_PDF_ALIGN_BOTTOM_LEFT"),
            "bottom-center": t("EXPORTDIALOG_PDF_ALIGN_BOTTOM_CENTER"),
            "bottom-right": t("EXPORTDIALOG_PDF_ALIGN_BOTTOM_RIGHT")
          })
          .setValue(this.settings.alignment)
          .onChange(value => {
            this.settings.alignment = value as PDFPageAlignment;
            this.update();
          })
      );
  }
}
