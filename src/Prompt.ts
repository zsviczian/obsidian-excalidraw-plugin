import { App, Modal } from "obsidian";

export class Prompt extends Modal {
    private promptEl: HTMLInputElement;
    private resolve: (value: string) => void;

    constructor(app: App, private prompt_text: string, private default_value: string, private placeholder:string) {
        super(app);
    }

    onOpen(): void {
        this.titleEl.setText(this.prompt_text);
        this.createForm();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    createForm(): void {
        const div = this.contentEl.createDiv();
        div.addClass("excalidarw-prompt-div");

        const form = div.createEl("form");
        form.addClass("excalidraw-prompt-form");
        form.type = "submit";
        form.onsubmit = (e: Event) => {
            e.preventDefault();
            this.resolve(this.promptEl.value);
            this.close();
        }

        this.promptEl = form.createEl("input");
        this.promptEl.type = "text";
        this.promptEl.placeholder = this.placeholder;
        this.promptEl.value = this.default_value ?? "";
        this.promptEl.addClass("excalidraw-prompt-input")
        this.promptEl.select();
    }

    async openAndGetValue(resolve: (value: string) => void): Promise<void> {
        this.resolve = resolve;
        this.open();
    }
}