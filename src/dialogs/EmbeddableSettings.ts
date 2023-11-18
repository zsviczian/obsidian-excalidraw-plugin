import { ExcalidrawEmbeddableElement } from "@zsviczian/excalidraw/types/element/types";
import { Mutable } from "@zsviczian/excalidraw/types/utility-types";
import { Modal, Notice, Setting, TFile, ToggleComponent } from "obsidian";
import { getEA } from "src";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import ExcalidrawView from "src/ExcalidrawView";
import { t } from "src/lang/helpers";
import ExcalidrawPlugin from "src/main";
import { getNewUniqueFilepath, getPathWithoutExtension, splitFolderAndFilename } from "src/utils/FileUtils";
import { addAppendUpdateCustomData, fragWithHTML } from "src/utils/Utils";
import { getYouTubeStartAt, isValidYouTubeStart, isYouTube, updateYouTubeStartTime } from "src/utils/YoutTubeUtils";
import { EmbeddalbeMDFileCustomDataSettingsComponent } from "./EmbeddableMDFileCustomDataSettingsComponent";

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
  private mdCustomData: EmbeddableMDCustomProps;

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
    this.isMDFile = this.file && this.file.extension === "md" && !this.view.plugin.isExcalidrawFile(this.file)
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
    this.titleEl.setText(t("ES_TITLE"));
    this.createForm();
  }

  onClose() {

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
      return fragWithHTML(`Current zoom is <b>${Math.round(this.zoomValue*100)}%</b>`);
    } 
    const zoomSetting = new Setting(this.contentEl)
      .setName(t("ES_ZOOM"))
      .setDesc(zoomValue())
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

    if(this.isMDFile) {
      this.contentEl.createEl("h3",{text: t("ES_EMBEDDABLE_SETTINGS")});
      new EmbeddalbeMDFileCustomDataSettingsComponent(this.contentEl,this.mdCustomData).render();
    }

    const div = this.contentEl.createDiv({cls: "excalidraw-prompt-buttons-div"});
    const bOk = div.createEl("button", { text: t("PROMPT_BUTTON_OK"), cls: "excalidraw-prompt-button"});
    bOk.onclick = async () => {
      let dirty = false;
      const el = this.ea.getElement(this.element.id) as Mutable<ExcalidrawEmbeddableElement>;
      if(this.updatedFilepath) {
        const newPathWithExt = `${this.updatedFilepath}.${this.file.extension}`;
        if(newPathWithExt !== this.file.path) {
          const fnparts = splitFolderAndFilename(newPathWithExt);
          const newPath = getNewUniqueFilepath(
            this.app.vault,
            fnparts.folderpath,
            fnparts.filename,
          );
          await this.app.vault.rename(this.file,newPath);
          el.link = this.element.link.replace(
            /(\[\[)([^#\]]*)([^\]]*]])/,`$1${
              this.plugin.app.metadataCache.fileToLinktext(
                this.file,this.view.file.path,true)
            }$3`);
          dirty = true;
        }
      }
      if(this.isYouTube && this.youtubeStart !== getYouTubeStartAt(this.element.link)) {
        dirty = true;
        if(isValidYouTubeStart(this.youtubeStart)) {
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
        this.ea.addElementsToView();
      }
      this.close();
    };
    const bCancel = div.createEl("button", { text: t("PROMPT_BUTTON_CANCEL"), cls: "excalidraw-prompt-button" });
    bCancel.onclick = () => {
      this.close();
    };
  }
}

