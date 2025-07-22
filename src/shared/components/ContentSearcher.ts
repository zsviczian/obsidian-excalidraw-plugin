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
  private showHideButton: HTMLButtonElement;
  private customElemenentContainer: HTMLDivElement;
  private inputContainer: HTMLDivElement;
  private customElement: HTMLElement;
  private hitCount: HTMLSpanElement;
  private searchBarWrapper: HTMLDivElement;

  constructor(contentDiv: HTMLElement, customElement?: HTMLElement) {
    this.contentDiv = contentDiv;
    this.customElement = customElement;
    this.createSearchElements();
    this.setupEventListeners();
    contentDiv.prepend(this.getSearchBarWrapper());
  }

  /**
   * Creates search UI elements styled like Obsidian's native search
   */
  private createSearchElements(): void {
    this.searchBarWrapper = createDiv("document-search-container");
    const documentSearch = createDiv("document-search");
    this.inputContainer = createDiv("search-input-container document-search-input");
    this.searchBar = createEl("input",{type: "text", placeholder: "Find..."});
    this.hitCount = createDiv("document-search-count");

    this.inputContainer.appendChild(this.searchBar);
    this.inputContainer.appendChild(this.hitCount);
    const buttonContainer = createDiv("document-search-buttons");

    this.prevButton = createEl("button", {
      cls: ["clickable-icon", "document-search-button"],
      attr: {
        "aria-label": t("SEARCH_PREVIOUS"),
        "data-tooltip-position": "top",
      },
      type: "button",
    });
    this.prevButton.innerHTML = getIcon("arrow-up").outerHTML;

    this.nextButton = createEl("button", {
      cls: ["clickable-icon", "document-search-button"],
      attr: {
        "aria-label": t("SEARCH_NEXT"),
        "data-tooltip-position": "top",
      },
      type: "button",
    });
    this.nextButton.innerHTML = getIcon("arrow-down").outerHTML;

    this.exportMarkdown = createEl("button", {
      cls: ["clickable-icon", "document-search-button"],
      attr: {
        "aria-label": t("SEARCH_COPY_TO_CLIPBOARD_ARIA"),
        "data-tooltip-position": "top",
      },
      type: "button",
    });
    this.exportMarkdown.innerHTML = getIcon("clipboard-copy").outerHTML;

    this.showHideButton = createEl("button", {
      cls: ["clickable-icon", "document-search-button", "search-visible"],
      attr: {
        "aria-label": t("SEARCH_SHOWHIDE_ARIA"),
        "data-tooltip-position": "top",
      },
      type: "button",
    });
    this.showHideButton.innerHTML = getIcon("minimize-2").outerHTML;

    buttonContainer.appendChild(this.prevButton);
    buttonContainer.appendChild(this.nextButton);
    buttonContainer.appendChild(this.exportMarkdown);
    buttonContainer.appendChild(this.showHideButton);

    documentSearch.appendChild(this.inputContainer);
    documentSearch.appendChild(buttonContainer);

    this.searchBarWrapper.appendChild(documentSearch);

    this.customElemenentContainer = createDiv();
    if(this.customElement) {
      this.customElemenentContainer.appendChild(this.customElement);
      this.searchBarWrapper.appendChild(this.customElemenentContainer)
    }
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
    this.showHideButton.onclick = () => {
      const setOpacity = (value:string|null) => {
        this.inputContainer.style.opacity = value;
        this.prevButton.style.opacity = value;
        this.nextButton.style.opacity = value;
        this.exportMarkdown.style.opacity = value;
        this.customElemenentContainer.style.opacity = value;
      }
      if(this.showHideButton.hasClass("search-visible")) {
        this.showHideButton.removeClass("search-visible");
        this.showHideButton.addClass("search-hidden");
        this.searchBarWrapper.style.backgroundColor = "transparent";
        setOpacity("0");
        this.showHideButton.innerHTML = getIcon("maximize-2").outerHTML;
      } else {
        this.showHideButton.removeClass("search-hidden");
        this.showHideButton.addClass("search-visible");
        this.searchBarWrapper.style.backgroundColor = null;
        setOpacity(null);
        this.showHideButton.innerHTML = getIcon("minimize-2").outerHTML;
      }
    }

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
    
    // Expand all parent details elements
    this.expandParentDetails(nextActiveHighlight);
    
    // Use setTimeout to ensure DOM has time to update after expanding details
    setTimeout(() => {
      nextActiveHighlight.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);

    // Update the hit count
    this.hitCount.textContent = `${nextActiveIndex + 1} / ${highlights.length}`;
  }
  
  /**
   * Expand all parent <details> elements to make the element visible
   */
  private expandParentDetails(element: HTMLElement): void {
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === "DETAILS") {
        parent.setAttribute("open", "");
      }
      parent = parent.parentElement;
    }
  }
}
