import { AppState } from "@zsviczian/excalidraw/types/types";
import clsx from "clsx";
import * as React from "react";
import ExcalidrawPlugin from "../main";


export class MenuLinks {
  plugin: ExcalidrawPlugin;
  ref: React.MutableRefObject<any>;

  constructor(plugin: ExcalidrawPlugin, ref: React.MutableRefObject<any>) {
    this.plugin = plugin;
    this.ref = ref;
  }

  render = (isMobile: boolean, appState: AppState) => {
    return (
        <div>Hello</div>
    );
    }
}
