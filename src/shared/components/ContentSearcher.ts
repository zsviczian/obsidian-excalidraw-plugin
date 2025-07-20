import { t } from "src/lang/helpers";
import { escapeRegExp } from "../../utils/utils";
// @ts-ignore
import { getIcon, htmlToMarkdown, Notice } from "obsidian";

export class ContentSearcher {
  private contentDiv: HTMLElement;
  private searchBar: HTMLInputElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private exportMarkdown: HTMLButtonElement;
  private hitCount: HTMLSpanElement;
  private searchBarWrapper: HTMLDivElement;

  constructor(contentDiv: HTMLElement) {
    this.contentDiv = contentDiv;
    this.createSearchElements();
    this.setupEventListeners();
  }

  /**
   * Creates search UI elements styled like Obsidian's native search
   */
  private createSearchElements(): void {
    // Outer container
    this.searchBarWrapper = document.createElement("div");
    this.searchBarWrapper.classList.add("document-search-container");

    // Main search bar
    const documentSearch = document.createElement("div");
    documentSearch.classList.add("document-search");

    // Search input container
    const inputContainer = document.createElement("div");
    inputContainer.classList.add("search-input-container", "document-search-input");

    // Search input
    this.searchBar = document.createElement("input");
    this.searchBar.type = "text";
    this.searchBar.placeholder = "Find...";

    // Hit count
    this.hitCount = document.createElement("div");
    this.hitCount.classList.add("document-search-count");

    inputContainer.appendChild(this.searchBar);
    inputContainer.appendChild(this.hitCount);

    // Search buttons (prev/next)
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("document-search-buttons");

    this.prevButton = document.createElement("button");
    this.prevButton.classList.add("clickable-icon", "document-search-button");
    this.prevButton.setAttribute("aria-label", t("SEARCH_PREVIOUS"));
    this.prevButton.setAttribute("data-tooltip-position", "top");
    this.prevButton.type = "button";
    this.prevButton.innerHTML = getIcon("arrow-up").outerHTML;

    this.nextButton = document.createElement("button");
    this.nextButton.classList.add("clickable-icon", "document-search-button");
    this.nextButton.setAttribute("aria-label", t("SEARCH_NEXT"));
    this.nextButton.setAttribute("data-tooltip-position", "top");
    this.nextButton.type = "button";
    this.nextButton.innerHTML = getIcon("arrow-down").outerHTML;

    this.exportMarkdown = document.createElement("button");
    this.exportMarkdown.classList.add("clickable-icon", "document-search-button");
    this.exportMarkdown.setAttribute("aria-label", t("SEARCH_COPY_TO_CLIPBOARD_ARIA"));
    this.exportMarkdown.setAttribute("data-tooltip-position", "top");
    this.exportMarkdown.type = "button";
    this.exportMarkdown.innerHTML = getIcon("clipboard-copy").outerHTML;

    buttonContainer.appendChild(this.prevButton);
    buttonContainer.appendChild(this.nextButton);
    buttonContainer.appendChild(this.exportMarkdown);

    documentSearch.appendChild(inputContainer);
    documentSearch.appendChild(buttonContainer);

    this.searchBarWrapper.appendChild(documentSearch);
  }

  /**
   * Attach event listeners to search elements
   */
  private setupEventListeners(): void {
    this.nextButton.onclick = () => this.navigateSearchResults("next");
    this.prevButton.onclick = () => this.navigateSearchResults("previous");
    this.exportMarkdown.onclick = () => {
      // Get the full HTML content first
      const fullHtml = this.contentDiv.outerHTML;
      
      // Find the index of the first <hr> element
      const startIndex = fullHtml.indexOf('<hr');
      
      // Extract HTML from the first <hr> element onwards
      const html = startIndex > -1 ? fullHtml.substring(startIndex) : fullHtml;

      function replaceHeading(html:string,level:number):string {
        const re = new RegExp(`<summary class="excalidraw-setting-h${level}">([^<]+)<\/summary>`,"g");
        return html.replaceAll(re,`<summary class="excalidraw-setting-h${level}"><h${level}>$1</h${level}></summary>`);
      }

      let x = replaceHeading(html,1);
      x = replaceHeading(x,2);
      x = replaceHeading(x,3);
      x = replaceHeading(x,4);
      x = x.replaceAll(/<div class="setting-item-name">([^<]+)<\/div>/g,"<h5>$1</h5>");

      const md = htmlToMarkdown(x);
      window.navigator.clipboard.writeText(md);
      new Notice(t("SEARCH_COPIED_TO_CLIPBOARD"));
    };

    this.searchBar.addEventListener("input", (e) => {
      this.clearHighlights();
      const searchTerm = (e.target as HTMLInputElement).value;

      if (searchTerm && searchTerm.length > 0) {
        this.highlightSearchTerm(searchTerm);
        const totalHits = this.contentDiv.querySelectorAll("mark.search-highlight").length;
        this.hitCount.textContent = totalHits > 0 ? `1 / ${totalHits}` : "";
        setTimeout(() => this.navigateSearchResults("next"));
      } else {
        this.hitCount.textContent = "";
      }
    });

    this.searchBar.addEventListener("keydown", (e) => {
      // If Ctrl/Cmd + F is pressed, focus on search bar
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        this.searchBar.focus();
      }
      // If Enter is pressed, navigate to next result
      else if (e.key === "Enter") {
        e.preventDefault();
        this.navigateSearchResults(e.shiftKey ? "previous" : "next");
      }
    });
  }

  /**
   * Get the search bar wrapper element to add to the DOM
   */
  public getSearchBarWrapper(): HTMLElement {
    return this.searchBarWrapper;
  }

  /**
   * Highlight all instances of the search term in the content
   */
  public highlightSearchTerm(searchTerm: string): void {
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

  /**
   * Remove all search highlights
   */
  public clearHighlights(): void {
    this.contentDiv.querySelectorAll("mark.search-highlight").forEach((el) => {
      el.outerHTML = el.innerHTML;
    });
  }

  /**
   * Navigate to next or previous search result
   */
  public navigateSearchResults(direction: "next" | "previous"): void {
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
    this.hitCount.textContent = `${nextActiveIndex + 1} / ${highlights.length}`;
  }
}
