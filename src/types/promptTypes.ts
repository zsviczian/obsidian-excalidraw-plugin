export type ButtonDefinition = { caption: string; tooltip?:string; action: Function };

export interface InputPromptOptions {
  header: string,
  placeholder?: string,
  value?: string,
  buttons?: ButtonDefinition[],
  lines?: number,
  displayEditorButtons?: boolean,
  customComponents?: (container: HTMLElement) => void,
  blockPointerInputOutsideModal?: boolean,
  controlsOnTop?: boolean,
  draggable?: boolean,
}