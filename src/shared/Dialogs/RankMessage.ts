import { App, MarkdownRenderer, Modal } from "obsidian";
import ExcalidrawPlugin from "../../core/main";
import { Rank, SwordColors } from "src/constants/actionIcons";

export class RankMessage extends Modal {

  constructor(app: App, private plugin: ExcalidrawPlugin, private filecount: number, private rank: Rank, private color: string, private shield: string, private dark: string) {
    super(app);
  }

  onOpen(): void {
    //this.contentEl.classList.add("excalidraw-release");
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText("Congratulations, glorious knight!");
    this.createForm();
  }

  async onClose() {
    this.contentEl.empty();
    this.plugin = null;
  }

  async createForm() {
    const { title} = SwordColors[this.rank];
    this.contentEl.createDiv({ cls: "excalidraw-rank" }, (el) => {
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="enable-background:new 0 0 512 512" viewBox="0 0 511 512"><path fill="${this.color}" d="m389 495 36 7c6 1 11-4 10-10l-6-36a22 22 0 0 0-9-14l-61-46-29 28 45 62a22 22 0 0 0 14 9zm0 0" data-original="#97a7a7"/><path fill="#ffd3bc" d="m333 361-33 4-27 29 1 5 15 13c11 10 27 12 39 3 7-4 12-11 13-20 1-11-3-23-8-34zm0 0" data-original="#ffd3bc"/><path fill="#a5b0bc" d="m288 450-3-50-88-15-87 15-3 50 27 16 28-16v-8c0-6 4-11 10-11h51c6 0 10 5 10 11v8l28 16 27-16zm28-114a332 332 0 0 0-4-6c-14-17-32-30-55-29l16 93 60-33c-5-9-11-18-17-25zm0 0" data-original="#a5b0bc"/><path fill="${this.shield}" d="M281 371c-9-54-24-70-24-70H138s-15 16-24 70l-4 29h175l-4-29zm0 0" data-original="${this.shield}"/><path fill="${this.color}" d="M383 160a30 30 0 1 1-59 0 30 30 0 0 1 59 0zm-312 0a30 30 0 1 1-59 0 30 30 0 0 1 59 0zm0 0" data-original="#97a7a7"/><path fill="#a5b0bc" d="M44 160a153 153 0 1 1 306 0 153 153 0 0 1-306 0zm0 0" data-original="#a5b0bc"/><path fill="#748A8A" d="M107 450v13s-12 10-17 27c-2 7 4 14 11 14h49c7 1 12-5 12-11v-43zm181 0v13s12 10 17 27c2 7-4 14-11 14h-49c-7 1-12-5-12-11v-43zm0 0" data-original="#748A8A"/><path fill="#ffd3bc" d="M44 160s44 76 153 76c110 0 153-76 153-76l-17-30-136-27-127 24zm0 0" data-original="#ffd3bc"/><path fill="#ffbe9c" d="M197 103 70 127l-26 33s5 9 16 20c6-4 50-29 137-29s131 25 138 29c11-11 15-20 15-20l-17-30zm0 0" data-original="#ffbe9c"/><path fill="${this.color}" d="M271 59c-47-18-100-18-147 0-39 15-80 45-80 101 0 0 48-34 153-34s153 34 153 34c0-56-40-86-79-101zm0 0" data-original="#97a7a7"/><path fill="#ff889e" d="M274 201h-18a7 7 0 1 1 0-15h18a7 7 0 1 1 0 15zm-135 0h-18a7 7 0 1 1 0-15h18a7 7 0 1 1 0 15zm0 0" data-original="#ff889e"/><path fill="#748A8A" d="m185 387-75 13-2 47a39 39 0 0 0 2 0c31-10 57-30 75-60zm0 0" data-original="#748A8A"/><path fill="#00000060" d="M186 386c15-24 22-50 25-67a43 43 0 0 0 0-18h-73s-15 16-24 70l-4 29h67a160 160 0 0 0 9-14zm0 0" data-original="#00000060"/><path fill="#748A8A" d="M174 268c-29-4-46-12-54-17a43 43 0 0 0-45 0h-1a153 153 0 0 0 138 62 43 43 0 0 0-38-45zm0 0" data-original="#748A8A"/><path fill="${this.dark}" d="M171 293c-32-4-53-14-64-21a18 18 0 0 0-19 0c-11 7-32 17-64 21-10 1-18 11-16 21 6 31 25 90 84 109a18 18 0 0 0 11 0c58-19 77-78 83-109 2-10-5-20-15-21zm0 0" data-original="${this.dark}"/><path fill="${this.shield}" d="M97 387c-29-11-43-39-50-62 22-5 38-12 50-18 12 6 29 13 50 18-7 23-21 51-50 62zm0 0" data-original="${this.shield}"/><path fill="${this.dark}" d="m327 444 52-51a6 6 0 0 0 0-9c-9-9-24-9-33 0l-28 27c-9 9-9 24 0 33a6 6 0 0 0 9 0zm0 0" data-original="${this.dark}"/><path d="M100 88a8 8 0 0 0-7 8v18a8 8 0 1 0 15 0V96c0-4-3-8-8-8zm49-20a7 7 0 0 0-8 8v36a8 8 0 1 0 15 0V76a8 8 0 0 0-7-8zm145 20a7 7 0 0 0-7 8v18c0 4 3 8 7 8a8 8 0 0 0 8-8V96a8 8 0 0 0-8-8zm-48-20a8 8 0 0 0-8 8v36a8 8 0 1 0 15 0V76c0-4-3-8-7-8zm-49-6c-4 0-7 3-7 7v36a8 8 0 0 0 15 0V69c0-4-3-7-8-7zm68 120c4 0 8-3 8-8v-13a8 8 0 1 0-15 0v13a8 8 0 0 0 7 8zm-135 0c4 0 7-3 7-8v-13a8 8 0 1 0-15 0v13a8 8 0 0 0 8 8zm85 0a8 8 0 0 0-11 1l-7 2-6-2a7 7 0 0 0-11-1c-3 3-3 7 0 11 4 5 11 7 17 7 7 0 14-2 18-7a8 8 0 0 0 0-11zM95 394a8 8 0 0 0 5 0c32-13 47-44 55-67 1-4-2-9-6-10-18-3-34-9-48-17a7 7 0 0 0-7 0c-14 8-30 14-48 17-4 1-7 6-6 10 7 23 22 54 55 67zm2-78c13 6 26 10 41 14-7 18-19 39-41 49a83 83 0 0 1-40-49c15-4 28-8 40-14zm0 0" data-original="#000000"/><path d="M436 455a29 29 0 0 0-11-19l-45-34 4-4c5-5 5-14 0-19-6-6-13-9-22-9a30 30 0 0 0-16 4l-6-16c-5-9-10-17-18-27a375 375 0 0 0-4-6 86 86 0 0 0-37-27c36-22 63-58 73-101a37 37 0 0 0 0-74 161 161 0 0 0-313 0 37 37 0 0 0 0 74c6 27 19 51 38 71-12 7-30 14-56 17-14 2-25 16-22 30 4 19 12 47 29 71a8 8 0 1 0 12-9c-16-22-23-47-26-64-1-6 3-12 9-13 33-4 54-14 67-22 3-2 8-2 11 0 20 13 43 19 67 22 8 1 10 8 8 15-3 18-12 46-31 69-12 15-28 26-47 32h-6c-12-4-23-10-33-18a8 8 0 1 0-9 11c11 10 24 16 38 21l11 1a694 694 0 0 0-1 19v10c-4 4-13 14-17 28-3 12 6 24 18 24h49c11 0 19-8 19-19v-51c0-2 1-3 3-3h51a3 3 0 0 1 3 3v51c0 11 8 19 19 19h49c12 0 21-12 18-24-4-14-13-24-17-28v-10a699 699 0 0 0-1-25 41 41 0 0 0 10 3c0 8 3 15 9 21a14 14 0 0 0 9 4c4 0 7-1 10-4l4-4 33 46a29 29 0 0 0 19 11s36 7 36 7c10 2 20-8 18-18zm-272-68c16-22 24-45 28-65l1-1 21-1a159 159 0 0 0 40-9c4 6 12 22 18 52l4 29H160l4-5zm142-52 17 23-33 18a473 473 0 0 0-19-66c16 4 27 15 35 25zm32-190c-23-11-48-17-73-21a426 426 0 0 0-136 0 267 267 0 0 0-76 23c5-37 29-64 74-81a195 195 0 0 1 141 0c44 17 69 44 74 81a173 173 0 0 0-4-2zm18-6a22 22 0 0 1 0 43h1a162 162 0 0 0 0-43h-1zM197 15c49 0 91 23 118 60-12-9-26-17-41-23A210 210 0 0 0 80 75c27-37 69-60 117-60zM19 160c0-11 9-20 19-21a163 163 0 0 0 0 43c-10-1-19-10-19-22zm130 121c-14-3-27-8-38-16a25 25 0 0 0-14-3 26 26 0 0 0-4 0c-20-21-33-46-38-73a8 8 0 0 0 0-1l-1-3 21 19a196 196 0 0 0 150 38 7 7 0 1 0-1-15 217 217 0 0 1-27 2c-43 0-81-12-112-36-15-12-25-23-30-30l30-13c36-12 74-16 112-16a320 320 0 0 1 143 29c-10 13-38 45-88 59a8 8 0 0 0-5 9 7 7 0 0 0 9 5c42-12 69-34 85-51a138 138 0 0 1 0 2 146 146 0 0 1-140 119h-7c-2-11-12-20-22-21l-23-4zm5 212a4 4 0 0 1-4 4h-49c-2 0-4-3-3-5 4-14 14-23 14-23a8 8 0 0 0 3-6v-5h39v35zm69-69h-51c-10 0-18 8-18 18v1h-39l1-17a115 115 0 0 0 15-8 111 111 0 0 0 15-11h132v3l2 33h-39v-1c0-10-8-18-18-18zm74 68c1 2-1 5-3 5h-49a4 4 0 0 1-4-4v-35h39a872 872 0 0 1 0 5 8 8 0 0 0 3 6s10 9 14 23zm-4-88-1-12 37-21c3 6 4 10 4 15l-20 20-5 7a26 26 0 0 1-14-6l-1-1v-2zm26 23c0-4 2-8 5-11l28-27a15 15 0 0 1 10-4c4 0 8 1 10 3l-50 49a15 15 0 0 1-3-10zm108 67a1 1 0 0 1-1 0l-36-6a14 14 0 0 1-9-6l-34-47 6-6 42 43c2 3 7 3 10 0a8 8 0 0 0 0-11l-42-43 6-5 47 35a14 14 0 0 1 5 9l6 37zm0 0" data-original="#000000"/></svg>`;
    });

    await MarkdownRenderer.render(
      this.app,
      `You have ${this.filecount} Excalidraw drawings in your Vault earning you a new rank: **${this.rank}**! You've ascended to **${title}**!\n\nI've spent the past 3+ years building this plugin. If you appreciate my work, consider supporting me on [Ko-Fi](https://ko-fi.com/zsolt) or join the next [Visual Thinking Workshop](https://visual-thinking-workshop.com) cohort.`,
      this.contentEl,
      "",
      this.plugin,
    );

    this.contentEl.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.style.textAlign = "right";
      const bOk = el.createEl("button", { text: "Close" });
      bOk.onclick = () => this.close();
    });
  }
}
