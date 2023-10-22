import { MarkdownRenderer, Modal, Notice, request } from "obsidian";
import ExcalidrawPlugin from "../main";
import { errorlog, escapeRegExp, log } from "../utils/Utils";

const URL =
  "https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/index-new.md";

export class ScriptInstallPrompt extends Modal {
  private contentDiv: HTMLDivElement;
  constructor(private plugin: ExcalidrawPlugin) {
    super(plugin.app);
    //    this.titleEl.setText(t("INSTAL_MODAL_TITLE"));
  }

  async onOpen(): Promise<void> {
    const searchBarWrapper = document.createElement("div");
    searchBarWrapper.classList.add('search-bar-wrapper');


    const searchBar = document.createElement("input");
    searchBar.type = "text";
    searchBar.id = "search-bar";
    searchBar.placeholder = "Search...";
    searchBar.style.width = "calc(100% - 120px)"; // space for the buttons and hit count

    const nextButton = document.createElement("button");
    nextButton.textContent = "→";
    nextButton.onclick = () => this.navigateSearchResults("next");

    const prevButton = document.createElement("button");
    prevButton.textContent = "←";
    prevButton.onclick = () => this.navigateSearchResults("previous");

    const hitCount = document.createElement("span");
    hitCount.id = "hit-count";
    hitCount.classList.add('hit-count');

    searchBarWrapper.appendChild(prevButton);
    searchBarWrapper.appendChild(nextButton);
    searchBarWrapper.appendChild(searchBar);
    searchBarWrapper.appendChild(hitCount);

    this.contentEl.prepend(searchBarWrapper);

    searchBar.addEventListener("input", (e) => {
      this.clearHighlights();
      const searchTerm = (e.target as HTMLInputElement).value;
      
      if (searchTerm && searchTerm.length > 0) {
        this.highlightSearchTerm(searchTerm);
        const totalHits = this.contentDiv.querySelectorAll("mark.search-highlight").length;
        hitCount.textContent = totalHits > 0 ? `1/${totalHits}` : "";
        setTimeout(()=>this.navigateSearchResults("next"));
      } else {
        hitCount.textContent = "";
      }
    });
    

    searchBar.addEventListener("keydown", (e) => {
      // If Ctrl/Cmd + F is pressed, focus on search bar
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchBar.focus();
      }
      // If Enter is pressed, navigate to next result
      else if (e.key === "Enter") {
        e.preventDefault();
        this.navigateSearchResults(e.shiftKey ? "previous" : "next");
      }
    });

    this.contentEl.classList.add("excalidraw-scriptengine-install");
    this.contentDiv = document.createElement("div");
    this.contentEl.appendChild(this.contentDiv);

    this.containerEl.classList.add("excalidraw-scriptengine-install");
    try {
      const source = await request({ url: URL });
      if (!source) {
        new Notice(
          "Error opening the Excalidraw Script Store page. " +
            "Please double check that you can access the website. " +
            "I've logged the link in developer console (press CTRL+SHIFT+i)",
          5000,
        );
        log(URL);
        this.close();
        return;
      }
      await MarkdownRenderer.renderMarkdown(
        source,
        this.contentDiv,
        "",
        this.plugin,
      );
      this.contentDiv
        .querySelectorAll("h1[data-heading],h2[data-heading],h3[data-heading]")
        .forEach((el) => {
          el.setAttribute("id", el.getAttribute("data-heading"));
        });
      this.contentDiv.querySelectorAll("a.internal-link").forEach((el) => {
        el.removeAttribute("target");
      });
    } catch (e) {
      errorlog({ where: "ScriptInstallPrompt.onOpen", error: e });
      new Notice("Could not open ScriptEngine repository");
      this.close();
    }
  }

  highlightSearchTerm(searchTerm: string): void {
    // Create a walker to traverse text nodes
    const walker = document.createTreeWalker(
      this.contentDiv,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Text) => {
          return node.nodeValue!.toLowerCase().includes(searchTerm.toLowerCase()) ?
            NodeFilter.FILTER_ACCEPT : 
            NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodesToReplace: Text[] = [];
    while (walker.nextNode()) {
      nodesToReplace.push(walker.currentNode as Text);
    }

    nodesToReplace.forEach(node => {
      const nodeContent = node.nodeValue!;
      const newNode = document.createDocumentFragment();

      let lastIndex = 0;
      let match;
      const regex = new RegExp(escapeRegExp(searchTerm), 'gi');

      // Iterate over all matches in the text node
      while ((match = regex.exec(nodeContent)) !== null) {
        const before = document.createTextNode(nodeContent.slice(lastIndex, match.index));
        const highlighted = document.createElement('mark');
        highlighted.className = 'search-highlight';
        highlighted.textContent = match[0];
        highlighted.classList.add('search-result');

        newNode.appendChild(before);
        newNode.appendChild(highlighted);

        lastIndex = regex.lastIndex;
      }
      newNode.appendChild(document.createTextNode(nodeContent.slice(lastIndex)));
      node.replaceWith(newNode);
    });
  }

  
  clearHighlights(): void {
    this.contentDiv.querySelectorAll("mark.search-highlight").forEach((el) => {
      el.outerHTML = el.innerHTML;
    });
  }
  
  navigateSearchResults(direction: "next" | "previous"): void {
    const highlights: HTMLElement[] = Array.from(
      this.contentDiv.querySelectorAll("mark.search-highlight")
    );
    
    if (highlights.length === 0) return;
  
    const currentActiveIndex = highlights.findIndex((highlight) =>
      highlight.classList.contains("active-highlight")
    );
  
    if (currentActiveIndex !== -1) {
      highlights[currentActiveIndex].classList.remove("active-highlight");
      highlights[currentActiveIndex].style.border = "none";
    }
  
    let nextActiveIndex = 0;
    if (direction === "next") {
      nextActiveIndex =
        currentActiveIndex === highlights.length - 1
          ? 0
          : currentActiveIndex + 1;
    } else if (direction === "previous") {
      nextActiveIndex =
        currentActiveIndex === 0
          ? highlights.length - 1
          : currentActiveIndex - 1;
    }
  
    const nextActiveHighlight = highlights[nextActiveIndex];
    nextActiveHighlight.classList.add("active-highlight");
    nextActiveHighlight.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    
    // Update the hit count
    const hitCount = document.getElementById("hit-count");
    hitCount.textContent = `${nextActiveIndex + 1}/${highlights.length}`;
  }  

  onClose(): void {
    this.contentEl.empty();
  }
}
