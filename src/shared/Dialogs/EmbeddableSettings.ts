import { ExcalidrawEmbeddableElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { Modal, Notice, Setting, TFile, ToggleComponent } from "obsidian";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import ExcalidrawView from "src/view/ExcalidrawView";
import { t } from "src/lang/helpers";
import ExcalidrawPlugin from "src/core/main";
import { getNewUniqueFilepath, getPathWithoutExtension, splitFolderAndFilename } from "src/utils/fileUtils";
import { addAppendUpdateCustomData, fragWithHTML } from "src/utils/utils";
import { getYouTubeStartAt, isValidYouTubeStart, isYouTube, updateYouTubeStartTime } from "src/utils/YoutTubeUtils";
import { EmbeddalbeMDFileCustomDataSettingsComponent } from "./EmbeddableMDFileCustomDataSettingsComponent";
import { isWinCTRLorMacCMD } from "src/utils/modifierkeyHelper";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";

export type EmbeddableMDCustomProps = {
  useObsidianDefaults: boolean;
  backgroundMatchCanvas: boolean;
  backgroundMatchElement: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  borderMatchElement: boolean;
  borderColor: string;
  borderOpacity: number;
  filenameVisible: boolean;
}

export class EmbeddableSettings extends Modal {
  private ea: ExcalidrawAutomate;
  private updatedFilepath: string = null;
  private zoomValue: number;
  private isYouTube: boolean;
  private youtubeStart: string = null;
  private isMDFile: boolean;
  private notExcalidrawIsInternal: boolean;
  private isLocalURI: boolean;
  private mdCustomData: EmbeddableMDCustomProps;
  private onKeyDown: (ev: KeyboardEvent) => void;

  constructor(
    private plugin: ExcalidrawPlugin,
    private view: ExcalidrawView,
    private file: TFile,
    private element: ExcalidrawEmbeddableElement
  ) {
    super(plugin.app);
    this.ea = getEA(this.view);
    this.ea.copyViewElementsToEAforEditing([this.element]);
    this.zoomValue = element.scale[0];
    this.isYouTube = isYouTube(this.element.link);
    this.notExcalidrawIsInternal = this.file && !this.view.plugin.isExcalidrawFile(this.file)
    this.isMDFile = this.file && this.file.extension === "md"; // && !this.view.plugin.isExcalidrawFile(this.file);
    this.isLocalURI = this.element.link.startsWith("file://");
    if(isYouTube) this.youtubeStart = getYouTubeStartAt(this.element.link);

    this.mdCustomData = element.customData?.mdProps ?? view.plugin.settings.embeddableMarkdownDefaults;
    if(!element.customData?.mdProps) {
      const bgCM = this.plugin.ea.getCM(element.backgroundColor);
      this.mdCustomData.backgroundColor = bgCM.stringHEX({alpha: false});
      this.mdCustomData.backgroundOpacity = element.opacity;
      const borderCM = this.plugin.ea.getCM(element.strokeColor);
      this.mdCustomData.borderColor = borderCM.stringHEX({alpha: false});
      this.mdCustomData.borderOpacity = element.opacity;
    }
  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    //this.titleEl.setText(t("ES_TITLE"));
    this.createForm();
  }

  onClose() {
    this.containerEl.removeEventListener("keydown",this.onKeyDown);
    this.plugin = null;
    this.view = null;
    this.file = null;
    this.element = null;
    this.ea.destroy();
    this.ea = null;
    this.mdCustomData = null;
  }


  async createForm() {

    this.contentEl.createEl("h1",{text: t("ES_TITLE")});

    if(this.file) {
      new Setting(this.contentEl)
        .setName(t("ES_RENAME"))
        .addText(text =>
          text
          .setValue(getPathWithoutExtension(this.file))
          .onChange(async (value) => {
            this.updatedFilepath = value;
          })
        )
    }

    const zoomValue = ():DocumentFragment => {
      return fragWithHTML(`${t("ES_ZOOM_100_RELATIVE_DESC")}<br>Current zoom is <b>${Math.round(this.zoomValue*100)}%</b>`);
    }

    const zoomSetting = new Setting(this.contentEl)
      .setName(t("ES_ZOOM"))
      .setDesc(zoomValue())
      .addButton(button =>
        button
          .setButtonText(t("ES_ZOOM_100"))
          .onClick(() => {
            const api = this.view.excalidrawAPI as ExcalidrawImperativeAPI;
            this.zoomValue = 1/api.getAppState().zoom.value;
            zoomSetting.setDesc(zoomValue());
          })
      )
      .addSlider(slider => 
        slider
          .setLimits(10,400,5)
          .setValue(this.zoomValue*100)
          .onChange(value => {
            this.zoomValue = value/100;
            zoomSetting.setDesc(zoomValue());
          })
      )

    if(this.isYouTube) {
      new Setting(this.contentEl)
        .setName(t("ES_YOUTUBE_START"))
        .setDesc(t("ES_YOUTUBE_START_DESC"))
        .addText(text =>
          text
          .setValue(this.youtubeStart)
          .onChange(async (value) => {
            this.youtubeStart = value;
          })
        )
    }

    if(this.isMDFile  || this.notExcalidrawIsInternal) {
      this.contentEl.createEl("h3",{text: t("ES_EMBEDDABLE_SETTINGS")});
      new EmbeddalbeMDFileCustomDataSettingsComponent(this.contentEl,this.mdCustomData, undefined, this.isMDFile).render();
    }
  
    new Setting(this.contentEl)
    .addButton(button =>
      button
        .setButtonText(t("PROMPT_BUTTON_CANCEL"))
        .setTooltip("ESC")
        .onClick(this.close.bind(this))
    )
    .addButton(button =>
      button
        .setButtonText(t("PROMPT_BUTTON_OK"))
        .setTooltip("CTRL/Opt+Enter")
        .setCta()
        .onClick(this.applySettings.bind(this))
    )


    const onKeyDown = (ev: KeyboardEvent) => {
      if(isWinCTRLorMacCMD(ev) && ev.key === "Enter") {
        this.applySettings();
      }
    }

    this.onKeyDown = onKeyDown;
    this.containerEl.ownerDocument.addEventListener("keydown",onKeyDown);
  }

  private async applySettings() {
    let dirty = false;
    const el = this.ea.getElement(this.element.id) as Mutable<ExcalidrawEmbeddableElement>;
    if(this.updatedFilepath) {
      const newPathWithExt = `${this.updatedFilepath}.${this.file.extension}`;
      if(newPathWithExt !== this.file.path) {
        const fnparts = splitFolderAndFilename(newPathWithExt);
        const newPath = getNewUniqueFilepath(
          this.app.vault,
          fnparts.filename,
          fnparts.folderpath,
        );
        if(this.app.vault.getAbstractFileByPath(newPath)) {
          new Notice("File rename failed. A file with this name already exists.\n"+newPath,10000);
        } else {
          try {
            await this.app.fileManager.renameFile(this.file,newPath);
            el.link = this.element.link.replace(
              /(\[\[)([^#\]]*)([^\]]*]])/,`$1${
                this.plugin.app.metadataCache.fileToLinktext(
                  this.file,this.view.file.path,true)
              }$3`);
            dirty = true;
          } catch(e) {
            new Notice("File rename failed. "+e,10000);
          }
        }
      }
    }
    if(this.isYouTube && this.youtubeStart !== getYouTubeStartAt(this.element.link)) {
      dirty = true;
      if(this.youtubeStart === "" || isValidYouTubeStart(this.youtubeStart)) {
        el.link = updateYouTubeStartTime(el.link,this.youtubeStart);
      } else {
        new Notice(t("ES_YOUTUBE_START_INVALID"));
      }
    }
    if(
      this.isMDFile && (
        this.mdCustomData.backgroundColor !== this.element.customData?.backgroundColor ||
        this.mdCustomData.borderColor !== this.element.customData?.borderColor ||
        this.mdCustomData.backgroundOpacity !== this.element.customData?.backgroundOpacity ||
        this.mdCustomData.borderOpacity !== this.element.customData?.borderOpacity ||
        this.mdCustomData.filenameVisible !== this.element.customData?.filenameVisible)
    ) {
      addAppendUpdateCustomData(el,{mdProps: this.mdCustomData});
      dirty = true;
    }

    if(this.zoomValue !== this.element.scale[0]) {
      dirty = true;
      
      el.scale = [this.zoomValue,this.zoomValue];
    }
    if(dirty) {
      (async() => {
        await this.ea.addElementsToView();
        //@ts-ignore
        this.ea.viewUpdateScene({appState: {}, storeAction: "update"});
        this.close(); //close should only run once update scene is done
      })();
    } else {
      this.close();
    }
  };
}

