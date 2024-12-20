
import { DEBUGGING, debug } from "src/utils/debugHelper";
import ExcalidrawView from "../ExcalidrawView";
import { App, Notice, TFile } from "obsidian";
import { AppState, ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { DEVICE, IMAGE_TYPES, REG_LINKINDEX_INVALIDCHARS, viewportCoordsToSceneCoords } from "src/constants/constants";
import { internalDragModifierType, isWinCTRLorMacCMD, localFileDragModifierType, modifierKeyTooltipMessages, webbrowserDragModifierType } from "src/utils/modifierkeyHelper";
import { errorlog, hyperlinkIsImage, hyperlinkIsYouTubeLink } from "src/utils/utils";
import { InsertPDFModal } from "src/shared/Dialogs/InsertPDFModal";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { getEA } from "src/core";
import { insertEmbeddableToView, insertImageToView } from "src/utils/excalidrawViewUtils";
import { t } from "src/lang/helpers";
import ExcalidrawPlugin from "src/core/main";
import { getInternalLinkOrFileURLLink, getNewUniqueFilepath, getURLImageExtension, splitFolderAndFilename } from "src/utils/fileUtils";
import { getAttachmentsFolderAndFilePath } from "src/utils/obsidianUtils";
import { ScriptEngine } from "src/shared/Scripts";
import { UniversalInsertFileModal } from "src/shared/Dialogs/UniversalInsertFileModal";
import { Position } from "src/types/excalidrawViewTypes";

/*
static getDropAction(event: DragEvent): string {
  // Get modifier action
}

static parseDropData(event: DragEvent): DropData {
  // Parse drop data into clean format
}

static handleInternalDrop(data: DropData, context: DropContext): boolean {
  // Handle Obsidian internal file drops
}

static handleExternalFileDrop(data: DropData, context: DropContext): boolean {
  // Handle external file drops
}

static handleTextDrop(data: DropData, context: DropContext): boolean {
  // Handle text/url drops
}*/

export class DropManager {
  private view: ExcalidrawView;
  private app: App;
  private draginfoDiv: HTMLDivElement;
  
  constructor(view: ExcalidrawView) {
    this.view = view;
    this.app = this.view.app;
  }

  public destroy() {
    if(this.draginfoDiv) {
      this.ownerDocument.body.removeChild(this.draginfoDiv);
      delete this.draginfoDiv;
    }
  }

  get ownerDocument(): Document {
    return this.view.ownerDocument;
  }

  get currentPosition(): Position {
    return this.view.currentPosition;
  }

  set currentPosition(pos: Position) {
    this.view.currentPosition = pos;
  }

  get excalidrawAPI():ExcalidrawImperativeAPI {
    return this.view.excalidrawAPI;
  }

  get plugin(): ExcalidrawPlugin {
    return this.view.plugin;
  }

  get file(): TFile {
    return this.view.file;
  }

  public onDrop (event: React.DragEvent<HTMLDivElement>): boolean {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onDrop, "ExcalidrawView.onDrop", event);
    if(this.draginfoDiv) {
      this.ownerDocument.body.removeChild(this.draginfoDiv);
      delete this.draginfoDiv;
    }
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    const st: AppState = api.getAppState();
    this.currentPosition = viewportCoordsToSceneCoords(
      { clientX: event.clientX, clientY: event.clientY },
      st,
    );
    const draggable = (this.app as any).dragManager.draggable;
    const internalDragAction = internalDragModifierType(event);
    const externalDragAction = webbrowserDragModifierType(event);
    const localFileDragAction = localFileDragModifierType(event);

    //Call Excalidraw Automate onDropHook
    const onDropHook = (
      type: "file" | "text" | "unknown",
      files: TFile[],
      text: string,
    ): boolean => {
      if (this.view.getHookServer().onDropHook) {
        try {
          return this.view.getHookServer().onDropHook({
            ea: this.view.getHookServer(), //the ExcalidrawAutomate object
            event, //React.DragEvent<HTMLDivElement>
            draggable, //Obsidian draggable object
            type, //"file"|"text"
            payload: {
              files, //TFile[] array of dropped files
              text, //string
            },
            excalidrawFile: this.file, //the file receiving the drop event
            view: this.view, //the excalidraw view receiving the drop
            pointerPosition: this.currentPosition, //the pointer position on canvas at the time of drop
          });
        } catch (e) {
          new Notice("on drop hook error. See console log for details");
          errorlog({ where: "ExcalidrawView.onDrop", error: e });
          return false;
        }
      } else {
        return false;
      }
    };

    //---------------------------------------------------------------------------------
    // Obsidian internal drag event
    //---------------------------------------------------------------------------------
    switch (draggable?.type) {
      case "file":
        if (!onDropHook("file", [draggable.file], null)) {
          const file:TFile = draggable.file;
          //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
          if (file.path.match(REG_LINKINDEX_INVALIDCHARS)) {
            new Notice(t("FILENAME_INVALID_CHARS"), 4000);
            return false;
          }
          if (
            ["image", "image-fullsize"].contains(internalDragAction) && 
            (IMAGE_TYPES.contains(file.extension) ||
              file.extension === "md"  ||
              file.extension.toLowerCase() === "pdf" )
          ) {
            if(file.extension.toLowerCase() === "pdf") {
              const insertPDFModal = new InsertPDFModal(this.plugin, this.view);
              insertPDFModal.open(file);
            } else {
              (async () => {
                const ea: ExcalidrawAutomate = getEA(this.view);
                ea.selectElementsInView([
                  await insertImageToView(
                    ea,
                    this.currentPosition,
                    file,
                    !(internalDragAction==="image-fullsize")
                  )
                ]);
                ea.destroy();
              })();
            }
            return false;
          }
          
          if (internalDragAction === "embeddable") {
            (async () => {
              const ea: ExcalidrawAutomate = getEA(this.view);
              ea.selectElementsInView([
                await insertEmbeddableToView(
                  ea,
                  this.currentPosition,
                  file,
                )
              ]);
              ea.destroy();
            })();
            return false;
          }

          //internalDragAction === "link"
          this.view.addText(
            `[[${this.app.metadataCache.fileToLinktext(
              draggable.file,
              this.file.path,
              true,
            )}]]`,
          );
        }
        return false;
      case "files":
        if (!onDropHook("file", draggable.files, null)) {
          (async () => {
            if (["image", "image-fullsize"].contains(internalDragAction)) {
              const ea:ExcalidrawAutomate = getEA(this.view);
              ea.canvas.theme = api.getAppState().theme;
              let counter:number = 0;
              const ids:string[] = [];
              for (const f of draggable.files) {
                if ((IMAGE_TYPES.contains(f.extension) || f.extension === "md")) {
                  ids.push(await ea.addImage(
                    this.currentPosition.x + counter*50,
                    this.currentPosition.y + counter*50,
                    f,
                    !(internalDragAction==="image-fullsize"),
                  ));
                  counter++;
                  await ea.addElementsToView(false, false, true);
                  ea.selectElementsInView(ids);
                }
                if (f.extension.toLowerCase() === "pdf") {
                  const insertPDFModal = new InsertPDFModal(this.plugin, this.view);
                  insertPDFModal.open(f);
                }
              }
              ea.destroy();
              return;
            }

            if (internalDragAction === "embeddable") {
              const ea:ExcalidrawAutomate = getEA(this.view);
              let column:number = 0;
              let row:number = 0;
              const ids:string[] = [];
              for (const f of draggable.files) {
                ids.push(await insertEmbeddableToView(
                  ea,
                  {
                    x:this.currentPosition.x + column*500,
                    y:this.currentPosition.y + row*550
                  },
                  f,
                ));
                column = (column + 1) % 3;
                if(column === 0) {
                  row++;
                }
              }
              ea.destroy();
              return false;
            }

            //internalDragAction === "link"
            for (const f of draggable.files) {
              await this.view.addText(
                `[[${this.app.metadataCache.fileToLinktext(
                  f,
                  this.file.path,
                  true,
                )}]]`, undefined,false
              );
              this.currentPosition.y += st.currentItemFontSize * 2;
            }
            this.view.save(false);
          })();
        }
        return false;
    }

    //---------------------------------------------------------------------------------
    // externalDragAction
    //---------------------------------------------------------------------------------
    if (event.dataTransfer.types.includes("Files")) {
      if (event.dataTransfer.types.includes("text/plain")) {
        const text: string = event.dataTransfer.getData("text");
        if (text && onDropHook("text", null, text)) {
          return false;
        }
        if(text && (externalDragAction === "image-url") && hyperlinkIsImage(text)) {
          this.view.addImageWithURL(text);
          return false;
        }
        if(text && (externalDragAction === "link")) {
          if (
            this.plugin.settings.iframelyAllowed &&
            text.match(/^https?:\/\/\S*$/)
          ) {
            this.view.addTextWithIframely(text);
            return false;
          } else {
            this.view.addText(text);
            return false;
          }
        }
        if(text && (externalDragAction === "embeddable")) {
          const ea = getEA(this.view) as ExcalidrawAutomate;
          insertEmbeddableToView(
            ea,
            this.currentPosition,
            undefined,
            text,
          ).then(()=>ea.destroy());
          return false;
        }
      }

      if(event.dataTransfer.types.includes("text/html")) {
        const html = event.dataTransfer.getData("text/html");
        const src = html.match(/src=["']([^"']*)["']/)
        if(src && (externalDragAction === "image-url") && hyperlinkIsImage(src[1])) {
          this.view.addImageWithURL(src[1]);
          return false;
        }
        if(src && (externalDragAction === "link")) {
          if (
            this.plugin.settings.iframelyAllowed &&
            src[1].match(/^https?:\/\/\S*$/)
          ) {
            this.view.addTextWithIframely(src[1]);
            return false;
          } else {
            this.view.addText(src[1]);
            return false;
          }
        }
        if(src && (externalDragAction === "embeddable")) {
          const ea = getEA(this.view) as ExcalidrawAutomate;
          insertEmbeddableToView(
            ea,
            this.currentPosition,
            undefined,
            src[1],
          ).then(ea.destroy);
          return false;
        }
      }
      
      if (event.dataTransfer.types.length >= 1 && ["image-url","image-import","embeddable"].contains(localFileDragAction)) {
        const files = Array.from(event.dataTransfer.files || []);
        
        for(let i = 0; i < files.length; i++) {
          // Try multiple ways to get file path
          const file = files[i];
          let path = file?.path

          if(!path && file && DEVICE.isDesktop) {
            //https://www.electronjs.org/docs/latest/breaking-changes#removed-filepath
            const { webUtils } = require('electron');
            if(webUtils && webUtils.getPathForFile) {
              path = webUtils.getPathForFile(file);
            }
          }
          if(!path) {            
            new Notice(t("ERROR_CANT_READ_FILEPATH"),6000);
            return true; //excalidarw to continue processing
          }
          const link = getInternalLinkOrFileURLLink(path, this.plugin, event.dataTransfer.files[i].name, this.file);
          const {x,y} = this.currentPosition;
          const pos = {x:x+i*300, y:y+i*300};
          if(link.isInternal) {
            if(localFileDragAction === "embeddable") {
              const ea = getEA(this.view) as ExcalidrawAutomate;
              insertEmbeddableToView(ea, pos, link.file).then(()=>ea.destroy());
            } else {
              if(link.file.extension === "pdf") {
                const insertPDFModal = new InsertPDFModal(this.plugin, this.view);
                insertPDFModal.open(link.file);
              }
              const ea = getEA(this.view) as ExcalidrawAutomate;
              insertImageToView(ea, pos, link.file).then(()=>ea.destroy()) ;
            }
          } else {
            const extension = getURLImageExtension(link.url);
            if(localFileDragAction === "image-import") {
              if (IMAGE_TYPES.contains(extension)) {
                (async () => {
                  const droppedFilename = event.dataTransfer.files[i].name;
                  const fileToImport = await event.dataTransfer.files[i].arrayBuffer();
                  let {folder:_, filepath} = await getAttachmentsFolderAndFilePath(this.app, this.file.path, droppedFilename);
                  const maybeFile = this.app.vault.getAbstractFileByPath(filepath);
                  if(maybeFile && maybeFile instanceof TFile) {
                    const action = await ScriptEngine.suggester(
                      this.app,[
                        "Use the file already in the Vault instead of importing",
                        "Overwrite existing file in the Vault",
                        "Import the file with a new name",
                      ],[
                        "Use",
                        "Overwrite",
                        "Import",
                      ],
                      "A file with the same name/path already exists in the Vault",
                    );
                    switch(action) {
                      case "Import":
                        const {folderpath,filename,basename:_,extension:__} = splitFolderAndFilename(filepath);
                        filepath = getNewUniqueFilepath(this.app.vault, filename, folderpath);
                        break;
                        case "Overwrite":
                          await this.app.vault.modifyBinary(maybeFile, fileToImport);
                          // there is deliberately no break here
                      case "Use":
                      default:
                        const ea = getEA(this.view) as ExcalidrawAutomate;
                        await insertImageToView(ea, pos, maybeFile);
                        ea.destroy();
                        return false;
                    }
                  }
                  const file = await this.app.vault.createBinary(filepath, fileToImport)
                  const ea = getEA(this.view) as ExcalidrawAutomate;
                  await insertImageToView(ea, pos, file);
                  ea.destroy();
                })();
              } else if(extension === "excalidraw") {
                return true; //excalidarw to continue processing
              } else {
                (async () => {
                  const {folder:_, filepath} = await getAttachmentsFolderAndFilePath(this.app, this.file.path,event.dataTransfer.files[i].name);
                  const file = await this.app.vault.createBinary(filepath, await event.dataTransfer.files[i].arrayBuffer());
                  const modal = new UniversalInsertFileModal(this.plugin, this.view);
                  modal.open(file, pos);
                })();
              }
            }
            else if(localFileDragAction === "embeddable" || !IMAGE_TYPES.contains(extension)) {
              const ea = getEA(this.view) as ExcalidrawAutomate;
              insertEmbeddableToView(ea, pos, null, link.url).then(()=>ea.destroy());
              if(localFileDragAction !== "embeddable") {
                new Notice("Not imported to Vault. Embedded with local URI");
              }
            } else {
              const ea = getEA(this.view) as ExcalidrawAutomate;
              insertImageToView(ea, pos, link.url).then(()=>ea.destroy());
            }
          }
        };
        return false;
      }

      if(event.dataTransfer.types.length >= 1 && localFileDragAction === "link") {
        const ea = getEA(this.view) as ExcalidrawAutomate;
        for(let i=0;i<event.dataTransfer.files.length;i++) {
          const file = event.dataTransfer.files[i];
          let path = file?.path;
          const name = file?.name;
          if(!path && file && DEVICE.isDesktop) {
            //https://www.electronjs.org/docs/latest/breaking-changes#removed-filepath
            const { webUtils } = require('electron');
            if(webUtils && webUtils.getPathForFile) {
              path = webUtils.getPathForFile(file);
            }
          }
          if(!path || !name) {
            new Notice(t("ERROR_CANT_READ_FILEPATH"),6000);
            ea.destroy();
            return true; //excalidarw to continue processing
          }
          const link = getInternalLinkOrFileURLLink(path, this.plugin, name, this.file);
          const id = ea.addText(
            this.currentPosition.x+i*40,
            this.currentPosition.y+i*20,
            link.isInternal ? link.link :`📂 ${name}`);
          if(!link.isInternal) {
            ea.getElement(id).link = link.link;
          }
        }
        ea.addElementsToView().then(()=>ea.destroy());
        return false;
      }

      return true;
    }

    if (event.dataTransfer.types.includes("text/plain") || event.dataTransfer.types.includes("text/uri-list") || event.dataTransfer.types.includes("text/html")) {

      const html = event.dataTransfer.getData("text/html");
      const src = html.match(/src=["']([^"']*)["']/);
      const htmlText = src ? src[1] : "";
      const textText = event.dataTransfer.getData("text");
      const uriText = event.dataTransfer.getData("text/uri-list");

      let text: string = src ? htmlText : textText;
      if (!text || text === "") {
        text = uriText
      }
      if (!text || text === "") {
        return true;
      }
      if (!onDropHook("text", null, text)) {
        if(text && (externalDragAction==="embeddable") && /^(blob:)?(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text)) {
          return true;
        }
        if(text && (externalDragAction==="image-url") && hyperlinkIsYouTubeLink(text)) {
          this.view.addYouTubeThumbnail(text);
          return false;
        }
        if(uriText && (externalDragAction==="image-url") && hyperlinkIsYouTubeLink(uriText)) {
          this.view.addYouTubeThumbnail(uriText);
          return false;
        }
        if(text && (externalDragAction==="image-url") && hyperlinkIsImage(text)) {
          this.view.addImageWithURL(text);
          return false;
        }
        if(uriText && (externalDragAction==="image-url") && hyperlinkIsImage(uriText)) {
          this.view.addImageWithURL(uriText);
          return false;
        }
        if(text && (externalDragAction==="image-import") && hyperlinkIsImage(text)) {
          this.view.addImageSaveToVault(text);
          return false;
        }
        if(uriText && (externalDragAction==="image-import") && hyperlinkIsImage(uriText)) {
          this.view.addImageSaveToVault(uriText);
          return false;
        }
        if (
          this.plugin.settings.iframelyAllowed &&
          text.match(/^https?:\/\/\S*$/)
        ) {
          this.view.addTextWithIframely(text);
          return false;
        }
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/599
        if(text.startsWith("obsidian://open?vault=")) {
          const html = event.dataTransfer.getData("text/html");
          if(html) {
            const path = html.match(/href="app:\/\/obsidian\.md\/(.*?)"/);
            if(path.length === 2) {
              const link = decodeURIComponent(path[1]).split("#");
              const f = this.app.vault.getAbstractFileByPath(link[0]);
              if(f && f instanceof TFile) {
                const path = this.app.metadataCache.fileToLinktext(f,this.file.path);
                this.view.addText(`[[${
                  path +
                  (link.length>1 ? "#" + link[1] + "|" + path : "")
                }]]`);
                return;
              }
              this.view.addText(`[[${decodeURIComponent(path[1])}]]`);
              return false;  
            }
          }
          const path = text.split("file=");
          if(path.length === 2) {
            this.view.addText(`[[${decodeURIComponent(path[1])}]]`);
            return false;
          }
        }
        this.view.addText(text.replace(/(!\[\[.*#[^\]]*\]\])/g, "$1{40}"));
      }
      return false;
    }
    if (onDropHook("unknown", null, null)) {
      return false;
    }
    return true;
  }

  public onDragOver(e: any) {
    const action = this.dropAction(e.dataTransfer);
    if (action) {
      if(!this.draginfoDiv) {
        this.draginfoDiv = createDiv({cls:"excalidraw-draginfo"});
        this.ownerDocument.body.appendChild(this.draginfoDiv);
      }
      let msg: string = "";
      if((this.app as any).dragManager.draggable) {
        //drag from Obsidian file manager
        msg = modifierKeyTooltipMessages().InternalDragAction[internalDragModifierType(e)];
      } else if(e.dataTransfer.types.length === 1 && e.dataTransfer.types.includes("Files")) {
        //drag from OS file manager
        msg = modifierKeyTooltipMessages().LocalFileDragAction[localFileDragModifierType(e)];
        if(DEVICE.isMacOS && isWinCTRLorMacCMD(e)) {
          msg = "CMD is reserved by MacOS for file system drag actions.\nCan't use it in Obsidian.\nUse a combination of SHIFT, CTRL, OPT instead."
        }
      } else {
        //drag from Internet
        msg = modifierKeyTooltipMessages().WebBrowserDragAction[webbrowserDragModifierType(e)];
      }
      if(!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        msg += DEVICE.isMacOS || DEVICE.isIOS
        ? "\nTry SHIFT, OPT, CTRL combinations for other drop actions" 
        : "\nTry SHIFT, CTRL, ALT, Meta combinations for other drop actions";
      }
      if(this.draginfoDiv.innerText !== msg) this.draginfoDiv.innerText = msg;
      const top = `${e.clientY-parseFloat(getComputedStyle(this.draginfoDiv).fontSize)*8}px`;
      const left = `${e.clientX-this.draginfoDiv.clientWidth/2}px`;
      if(this.draginfoDiv.style.top !== top) this.draginfoDiv.style.top = top;
      if(this.draginfoDiv.style.left !== left) this.draginfoDiv.style.left = left;
      e.dataTransfer.dropEffect = action;
      e.preventDefault();
      return false;
    }
  }

  public onDragLeave() {
    if(this.draginfoDiv) {
      this.ownerDocument.body.removeChild(this.draginfoDiv);
      delete this.draginfoDiv;
    }
  }

  private dropAction(transfer: DataTransfer) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.dropAction, "ExcalidrawView.dropAction");
    // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
    const files = (this.app as any).dragManager.draggable?.files;
    if (files) {
      if (files[0] == this.file) {
        files.shift();
        (
          this.app as any
        ).dragManager.draggable.title = `${files.length} files`;
      }
    }
    if (
      ["file", "files"].includes(
        (this.app as any).dragManager.draggable?.type,
      )
    ) {
      return "link";
    }
    if (
      transfer.types?.includes("text/html") ||
      transfer.types?.includes("text/plain") ||
      transfer.types?.includes("Files")
    ) {
      return "copy";
    }
  };
}