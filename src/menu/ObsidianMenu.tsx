import { AppState } from "@zsviczian/excalidraw/types/types";
import clsx from "clsx";
import * as React from "react";
import ExcalidrawPlugin from "../main";


export class ObsidianMenu {
  plugin: ExcalidrawPlugin;
  toolsRef: React.MutableRefObject<any>;

  constructor(plugin: ExcalidrawPlugin, toolsRef: React.MutableRefObject<any>) {
    this.plugin = plugin;
    this.toolsRef = toolsRef;
  }

  renderButton = (isMobile: boolean, appState: AppState) => {
    return (
      <label
        className={clsx(
          "ToolIcon ToolIcon_type_floating",
          "ToolIcon_size_medium",
          {
            "is-mobile": isMobile,
          },
        )}
        onClick={() => {
          this.toolsRef.current.setTheme(appState.theme);
          this.toolsRef.current.toggleVisibility(
            appState.zenModeEnabled || isMobile,
          );
        }}
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          <svg
            aria-hidden="true"
            focusable="false"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 166 267"
          >
            <path fill="transparent" d="M0 0h165.742v267.245H0z" />
            <g fillRule="evenodd">
              <path
                fill="#bd7efc"
                strokeWidth="0"
                d="M55.5 96.49 39.92 57.05 111.28 10l4.58 36.54L55.5 95.65"
              />
              <path
                fill="none"
                stroke="#410380"
                strokeWidth=".5"
                d="M55.5 96.49c-5.79-14.66-11.59-29.33-15.58-39.44M55.5 96.49c-3.79-9.59-7.58-19.18-15.58-39.44m0 0C60.13 43.72 80.34 30.4 111.28 10M39.92 57.05C60.82 43.27 81.73 29.49 111.28 10m0 0c.97 7.72 1.94 15.45 4.58 36.54M111.28 10c1.14 9.12 2.29 18.24 4.58 36.54m0 0C95.41 63.18 74.96 79.82 55.5 95.65m60.36-49.11C102.78 57.18 89.71 67.82 55.5 95.65m0 0v.84m0-.84v.84"
              />
            </g>
            <g fillRule="evenodd">
              <path
                fill="#e2c4ff"
                strokeWidth="0"
                d="m111.234 10.06 44.51 42.07-40.66-5.08-3.85-36.99"
              />
              <path
                fill="none"
                stroke="#410380"
                strokeWidth=".5"
                d="M111.234 10.06c11.83 11.18 23.65 22.36 44.51 42.07m-44.51-42.07 44.51 42.07m0 0c-13.07-1.63-26.13-3.27-40.66-5.08m40.66 5.08c-11.33-1.41-22.67-2.83-40.66-5.08m0 0c-1.17-11.29-2.35-22.58-3.85-36.99m3.85 36.99c-1.47-14.17-2.95-28.33-3.85-36.99m0 0s0 0 0 0m0 0s0 0 0 0"
              />
            </g>
            <g fillRule="evenodd">
              <path
                fill="#2f005e"
                strokeWidth="0"
                d="m10 127.778 45.77-32.99-15.57-38.08-30.2 71.07"
              />
              <path
                fill="none"
                stroke="#410380"
                strokeWidth=".5"
                d="M10 127.778c16.85-12.14 33.7-24.29 45.77-32.99M10 127.778c16.59-11.95 33.17-23.91 45.77-32.99m0 0c-6.14-15.02-12.29-30.05-15.57-38.08m15.57 38.08c-4.08-9.98-8.16-19.96-15.57-38.08m0 0c-11.16 26.27-22.33 52.54-30.2 71.07m30.2-71.07c-10.12 23.81-20.23 47.61-30.2 71.07m0 0s0 0 0 0m0 0s0 0 0 0"
              />
            </g>
            <g fillRule="evenodd">
              <path
                fill="#410380"
                strokeWidth="0"
                d="m40.208 235.61 15.76-140.4-45.92 32.92 30.16 107.48"
              />
              <path
                fill="none"
                stroke="#410380"
                strokeWidth=".5"
                d="M40.208 235.61c3.7-33.01 7.41-66.02 15.76-140.4m-15.76 140.4c3.38-30.16 6.77-60.32 15.76-140.4m0 0c-10.83 7.76-21.66 15.53-45.92 32.92m45.92-32.92c-11.69 8.38-23.37 16.75-45.92 32.92m0 0c6.84 24.4 13.69 48.8 30.16 107.48m-30.16-107.48c6.67 23.77 13.33 47.53 30.16 107.48m0 0s0 0 0 0m0 0s0 0 0 0"
              />
            </g>
            <g fillRule="evenodd">
              <path
                fill="#943feb"
                strokeWidth="0"
                d="m111.234 240.434-12.47 16.67-42.36-161.87 58.81-48.3 40.46 5.25-44.44 188.25"
              />
              <path
                fill="none"
                stroke="#410380"
                strokeWidth=".5"
                d="M111.234 240.434c-3.79 5.06-7.57 10.12-12.47 16.67m12.47-16.67c-4.43 5.93-8.87 11.85-12.47 16.67m0 0c-16.8-64.17-33.59-128.35-42.36-161.87m42.36 161.87c-9.74-37.2-19.47-74.41-42.36-161.87m0 0c15.03-12.35 30.07-24.7 58.81-48.3m-58.81 48.3c22.49-18.47 44.97-36.94 58.81-48.3m0 0c9.48 1.23 18.95 2.46 40.46 5.25m-40.46-5.25c13.01 1.69 26.02 3.38 40.46 5.25m0 0c-10.95 46.41-21.91 92.82-44.44 188.25m44.44-188.25c-12.2 51.71-24.41 103.42-44.44 188.25m0 0s0 0 0 0m0 0s0 0 0 0"
              />
            </g>
            <g fillRule="evenodd">
              <path
                fill="#6212b3"
                strokeWidth="0"
                d="m40.379 235.667 15.9-140.21 42.43 161.79-58.33-21.58"
              />
              <path
                fill="none"
                stroke="#410380"
                strokeWidth=".5"
                d="M40.379 235.667c4.83-42.62 9.67-85.25 15.9-140.21m-15.9 140.21c5.84-51.52 11.69-103.03 15.9-140.21m0 0c10.98 41.87 21.96 83.74 42.43 161.79m-42.43-161.79c13.28 50.63 26.56 101.25 42.43 161.79m0 0c-11.8-4.37-23.6-8.74-58.33-21.58m58.33 21.58c-21.73-8.04-43.47-16.08-58.33-21.58m0 0s0 0 0 0m0 0s0 0 0 0"
              />
            </g>
          </svg>
        </div>
      </label>
    );
  };
}
