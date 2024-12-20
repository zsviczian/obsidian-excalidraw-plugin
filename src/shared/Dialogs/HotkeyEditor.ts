import { BaseComponent, Setting, Modifier } from 'obsidian';
import { DEVICE } from 'src/constants/constants';
import { t } from 'src/lang/helpers';
import { ExcalidrawSettings } from 'src/core/settings';
import { modifierLabel } from 'src/utils/modifierkeyHelper';
import { fragWithHTML } from 'src/utils/utils';

export class HotkeyEditor extends BaseComponent {
  private settings: ExcalidrawSettings;
  private containerEl: HTMLElement;
  private capturing: boolean = false;
  private activeModifiers: Modifier[] = [];
  public isDirty: boolean = false;
  private applySettingsUpdate: Function;

  // Store bound event handlers
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private boundKeyupHandler: (event: KeyboardEvent) => void;

  constructor(containerEl: HTMLElement, settings: ExcalidrawSettings, applySettingsUpdate: Function) {
    super();
    this.containerEl = containerEl.createDiv();
    this.settings = settings;
    this.applySettingsUpdate = applySettingsUpdate;

    // Bind the event handlers once in the constructor
    this.boundKeydownHandler = this.onKeydown.bind(this);
    this.boundKeyupHandler = this.onKeyup.bind(this);
  }

  onload(): void {
    this.render();
  }

  private render(): void {
    // Clear previous content
    this.containerEl.empty();

    // Render current overrides
    this.settings.modifierKeyOverrides.forEach((override, index) => {
      const key = override.key.toUpperCase();
      new Setting(this.containerEl)
        .setDesc(fragWithHTML(`<b>Code:</b> <kbd>${override.modifiers.join("+")} + ${key}</kbd> | ` +
          `<b>Apple:</b> <kbd>${modifierLabel(override.modifiers, "Mac")} + ${key}</kbd> | ` +
          `<b>Windows:</b> <kbd>${modifierLabel(override.modifiers, "Other")} + ${key}</kbd>`))
        .addButton((button) =>
          button
            .setButtonText(t("HOTKEY_BUTTON_REMOVE"))
            .setCta()
            .onClick(() => {
              this.settings.modifierKeyOverrides.splice(index, 1);
              this.isDirty = true;
              this.applySettingsUpdate();
              this.render();
            })
        );
    });

    // Render Add New Override or Capture Instruction
    if (this.capturing) {
      new Setting(this.containerEl)
        .setName(t("HOTKEY_PRESS_COMBO_NANE"))
        .setDesc(t("HOTKEY_PRESS_COMBO_DESC"))
        .controlEl.style.cursor = 'pointer';
    } else {
      new Setting(this.containerEl)
        .addButton((button) =>
          button
            .setButtonText(t("HOTKEY_BUTTON_ADD_OVERRIDE"))
            .setCta()
            .onClick(() => this.startCapture())
        );
    }
  }

  private startCapture(): void {
    this.capturing = true;
    this.activeModifiers = [];
    this.render();
    // Use the pre-bound handlers
    window.addEventListener('keydown', this.boundKeydownHandler);
    window.addEventListener('keyup', this.boundKeyupHandler);
  }

  private onKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const modifiers = this.getModifiersFromEvent(event);

    // If only modifiers are pressed, update activeModifiers and continue listening
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      this.activeModifiers = modifiers;
      return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    // Check for duplicate overrides
    const exists = this.settings.modifierKeyOverrides.some(
      (override) =>
        override.key === key &&
        override.modifiers.length === modifiers.length &&
        override.modifiers.every((mod) => modifiers.includes(mod))
    );

    if (!exists) {
      this.settings.modifierKeyOverrides.push({ modifiers, key });
      this.isDirty = true;
      this.applySettingsUpdate();
    }

    this.stopCapture();
  }

  private onKeyup(event: KeyboardEvent): void {
    // If all modifier keys are released, stop capturing
    if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      this.stopCapture();
    }
  }

  private stopCapture(): void {
    this.capturing = false;
    // Use the pre-bound handlers for removal
    window.removeEventListener('keydown', this.boundKeydownHandler);
    window.removeEventListener('keyup', this.boundKeyupHandler);
    this.render();
  }

  public unload(): void {
    // Ensure listeners are removed when the component is unloaded
    this.stopCapture();
  }

  private getModifiersFromEvent(event: KeyboardEvent): Modifier[] {
    const modifiers: Modifier[] = [];

    if (DEVICE.isMacOS && event.metaKey) {
      modifiers.push('Mod');
    } else if (!DEVICE.isMacOS && event.ctrlKey) {
      modifiers.push('Mod');
    }

    if (DEVICE.isMacOS && event.ctrlKey) {
      modifiers.push('Ctrl');
    }

    if (!DEVICE.isMacOS && event.metaKey) {
      modifiers.push('Meta');
    }

    if (event.shiftKey) {
      modifiers.push('Shift');
    }
    if (event.altKey) {
      modifiers.push('Alt');
    }

    return modifiers;
  }
}
