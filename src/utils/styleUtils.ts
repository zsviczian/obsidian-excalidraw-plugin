export const setButtonBgColor = (
  button: HTMLButtonElement,
  state: "normal" | "accent" | "success",
) => {
  button.removeClass("excalidraw-button-bgcolor-normal");
  button.removeClass("excalidraw-button-bgcolor-accent");
  button.removeClass("excalidraw-button-bgcolor-success");
  button.addClass(`excalidraw-button-bgcolor-${state}`);
};

export const hideElement = (el: HTMLElement) => {
  el.addClass("excalidraw-display-none");
};

export const showElement = (el: HTMLElement) => {
  el.removeClass("excalidraw-display-none");
};
