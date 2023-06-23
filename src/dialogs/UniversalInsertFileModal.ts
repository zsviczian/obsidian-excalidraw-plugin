import { ButtonComponent, DropdownComponent, TFile, ToggleComponent } from "obsidian";
import ExcalidrawView from "../ExcalidrawView";
import ExcalidrawPlugin from "../main";
import {  Modal, Setting, TextComponent } from "obsidian";
import { FileSuggestionModal } from "./FolderSuggester";
import { IMAGE_TYPES, REG_BLOCK_REF_CLEAN } from "src/Constants";
import { insertIFrameToView, insertImageToView } from "src/utils/ExcalidrawViewUtils";
import { getEA } from "src";
import { InsertPDFModal } from "./InsertPDFModal";
import {  ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/types";
import { MAX_IMAGE_SIZE } from "src/Constants";

const {
  viewportCoordsToSceneCoords
  //@ts-ignore
} = excalidrawLib;

export class UniversalInsertFileModal extends Modal {
  private center: { x: number, y: number } = { x: 0, y: 0 };
  constructor(
    private plugin: ExcalidrawPlugin,
    private view: ExcalidrawView,
  ) {
    super(app);
    const appState = (view.excalidrawAPI as ExcalidrawImperativeAPI).getAppState();
    const containerRect = view.containerEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const centerX = containerRect.left + containerRect.width / 2 - MAX_IMAGE_SIZE / 2;
    const centerY = containerRect.top + containerRect.height / 2 - MAX_IMAGE_SIZE / 2;

    const clientX = Math.max(0, Math.min(viewportWidth, centerX));
    const clientY = Math.max(0, Math.min(viewportHeight, centerY));

    this.center = viewportCoordsToSceneCoords ({clientX, clientY}, appState)
  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(`Insert File From Vault`);
    this.createForm();
  }

  async createForm() {
    const ce = this.contentEl;
    let sectionPicker: DropdownComponent;
    let sectionPickerSetting: Setting;
    let actionIFrame: ButtonComponent;
    let actionImage: ButtonComponent;
    let actionPDF: ButtonComponent;
    let sizeToggleSetting: Setting
    let anchorTo100: boolean = false;
    let file: TFile;

    const updateForm = async () => {
      const ea = this.plugin.ea;
      const isMarkdown = file && file.extension === "md" && !ea.isExcalidrawFile(file);
      const isImage = file && (IMAGE_TYPES.contains(file.extension) || ea.isExcalidrawFile(file));
      const isIFrame = file && !isImage;
      const isPDF = file && file.extension === "pdf";
      const isExcalidraw = file && ea.isExcalidrawFile(file);

      if (isMarkdown) {
        sectionPickerSetting.settingEl.style.display = "";
        sectionPicker.selectEl.style.display = "block";
        while(sectionPicker.selectEl.options.length > 0) {
          sectionPicker.selectEl.remove(0);
        }
        sectionPicker.addOption("","");
        (await app.metadataCache.blockCache
          .getForFile({ isCancelled: () => false },file))
          .blocks.filter((b: any) => b.display && b.node?.type === "heading")
          .forEach((b: any) => {
            sectionPicker.addOption(
              `#${b.display.replaceAll(REG_BLOCK_REF_CLEAN, "").trim()}`,
              b.display)
          });
      } else {
        sectionPickerSetting.settingEl.style.display = "none";
        sectionPicker.selectEl.style.display = "none";
      }

      if (isExcalidraw) {
        sizeToggleSetting.settingEl.style.display = "";
      } else {
        sizeToggleSetting.settingEl.style.display = "none";
      }

      if (isImage || (file?.extension === "md")) {
        actionImage.buttonEl.style.display = "block";
      } else {
        actionImage.buttonEl.style.display = "none";
      }

      if (isIFrame) {
        actionIFrame.buttonEl.style.display = "block";
      } else {
        actionIFrame.buttonEl.style.display = "none";
      }

      if (isPDF) {
        actionPDF.buttonEl.style.display = "block";
      } else {
        actionPDF.buttonEl.style.display = "none";
      }

    }

    const search = new TextComponent(ce);
    search.inputEl.style.width = "100%";
    const suggester = new FileSuggestionModal(this.app, search,app.vault.getFiles().filter((f: TFile) => f!==this.view.file));
    search.onChange(() => {
      file = suggester.getSelectedItem();
      updateForm();  
    });

    sectionPickerSetting = new Setting(ce)
      .setName("Select section heading")
      .addDropdown(dropdown => {
        sectionPicker = dropdown;
        sectionPicker.selectEl.style.width = "100%";
      })

    sizeToggleSetting = new Setting(ce)
      .setName("Anchor to 100% of original size")
      .setDesc("This is a pro feature, use it only if you understand how it works. If enabled even if you change the size of the imported image in Excalidraw, the next time you open the drawing this image will pop back to 100% size. This is useful when embedding an atomic Excalidraw idea into another note and preserving relative sizing of text and icons.")
      .addToggle(toggle => {
        toggle.setValue(anchorTo100)
        .onChange((value) => {
          anchorTo100 = value;
        })
      })
    
    new Setting(ce)
      .addButton(button => {
        button
          .setButtonText("As IFrame")
          .setCta()
          .onClick(() => {
            const path = app.metadataCache.fileToLinktext(
              file,
              this.view.file.path,
              file.extension === "md",
            )

            insertIFrameToView (
              getEA(this.view),
              this.center,
              //this.view.currentPosition,
              undefined,
              `[[${path}${sectionPicker.selectEl.value}]]`,
            )
            this.close();
          })
        actionIFrame = button;
      })
      .addButton(button => {
        button
          .setButtonText("As PDF")
          .setCta()
          .onClick(() => {
            const insertPDFModal = new InsertPDFModal(this.plugin, this.view);
            insertPDFModal.open(file);
            this.close();
          })
        actionPDF = button;
      })
      .addButton(button => {
        button
          .setButtonText("As Image")
          .setCta()
          .onClick(() => {
            insertImageToView (
              getEA(this.view),
              this.center,
              //this.view.currentPosition,
              file,
              anchorTo100,
            )
            this.close();
          })
        actionImage = button;
      })

    search.inputEl.focus();
    updateForm();
  }
}
