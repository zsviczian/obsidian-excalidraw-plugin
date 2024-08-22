/*
```js*/
const selectedElements = ea.getViewSelectedElements();
if (selectedElements.length !== 1 || selectedElements[0].type === "arrow") {
    new Notice("Select a single element that is not an arrow and not a frame");
    return;
}

const visited = new Set(); // Avoiding recursive infinite loops
delete window.ewm;

await ea.targetView.save();

//------------------
// Load Settings
//------------------

let settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Template path"]) {
  settings = {
    "Template path" : {
      value: "",
      description: "The template file path that will receive the concatenated text. If the file includes <<<REPLACE ME>>> then it will be replaced with the generated text, if <<<REPLACE ME>>> is not present in the file the hierarchical markdown generated from the diagram will be added to the end of the template."
    },
    "ZK '# Summary' section": {
      value: "Summary",
      description: "The section in your visual zettelkasten file that contains the short written summary of the idea. This is the text that will be included in the hierarchical markdown file if visual ZK cards are included in your flow"
    },
    "ZK '# Source' section": {
      value: "Source",
      description: "The section in your visual zettelkasten file that contains the reference to your source. If present in the file, this text will be included in the output file as a reference"
    },
    "Embed image links": {
      value: true,
      description: "Should the resulting markdown document include the ![[embedded images]]?"
    }
  };
  await ea.setScriptSettings(settings);
}

const ZK_SOURCE = settings["ZK '# Source' section"].value;
const ZK_SECTION = settings["ZK '# Summary' section"].value;
const INCLUDE_IMG_LINK = settings["Embed image links"].value;
let templatePath = settings["Template path"].value;

//------------------
// Select template file
//------------------

const MSG = "Select another file"
let selection = MSG;
if(templatePath && app.vault.getAbstractFileByPath(templatePath)) {
  selection = await utils.suggester([templatePath, MSG],[templatePath, MSG], "Use previous template or select another?");
  if(!selection) {
    new Notice("process aborted");
    return;
  }
}

if(selection === MSG) {
  const files = app.vault.getMarkdownFiles().map(f=>f.path);
  selection = await utils.suggester(files,files,"Select the template to use. ESC to not use a tempalte");
}

if(selection && selection !== templatePath) {
  settings["Template path"].value = selection;
  await ea.setScriptSettings(settings);
}

templatePath = selection;

//------------------
// supporting functions
//------------------

function getBoundText(el) {
    const textId = el.boundElements?.find(x => x.type === "text")?.id;
    const text = ea.getViewElements().find(x => x.id === textId)?.originalText;
    return text ? text + "\n" : "";
}

function getNextElementFollowingArrow(el, arrow) {
    if (arrow.startBinding?.elementId === el.id) {
        return ea.getViewElements().find(x => x.id === arrow.endBinding?.elementId);
    }
    if (arrow.endBinding?.elementId === el.id) {
        return ea.getViewElements().find(x => x.id === arrow.startBinding?.elementId);
    }
    return null;
}

async function getSectionText(file, section) {
    const content = await app.vault.cachedRead(file);
    const metadata = app.metadataCache.getFileCache(file);
    
    if (!metadata || !metadata.headings) {
        return null;
    }

    const targetHeading = metadata.headings.find(h => h.heading === section);
    if (!targetHeading) {
        return null;
    }

    const startPos = targetHeading.position.start.offset;
    let endPos = content.length;

    const nextHeading = metadata.headings.find(h => h.position.start.offset > startPos);
    if (nextHeading) {
        endPos = nextHeading.position.start.offset;
    }
    
    let sectionContent = content.slice(startPos, endPos).trim();
    sectionContent = sectionContent.substring(sectionContent.indexOf('\n') + 1).trim();

    // Remove Markdown comments enclosed in %%
    sectionContent = sectionContent.replace(/%%[\s\S]*?%%/g, '').trim();
    return sectionContent;
}

function getImageLink(f) {
  return `![${f.name}](${encodeURI(f.path)})`;
}

async function getElementText(el) {
    if (el.type === "text") {
        return el.originalText;
    }
    if (el.type === "image") {
      const f = ea.getViewFileForImageElement(el);
      if(!ea.isExcalidrawFile(f)) return f.name + (INCLUDE_IMG_LINK ? `\n${getImageLink(f)}\n` : "");
      let source = await getSectionText(f, ZK_SOURCE);
      source = source ? ` (source:: ${source})` : "";
      const summary = await getSectionText(f, ZK_SECTION) ;

      if(summary) return (INCLUDE_IMG_LINK ? `${getImageLink(f)}\n${summary + source}` :  summary + source) + "\n";
      return f.name + (INCLUDE_IMG_LINK ? `\n${getImageLink(f)}\n` : "");
    }
    return getBoundText(el);
}

async function crawl(el, level) {
    visited.add(el.id);

    let result = await getElementText(el) + "\n";

    // Process all arrows connected to this element
    const boundElementsData = el.boundElements.filter(x => x.type === "arrow");
    const isFork = boundElementsData.length > 2;
    if(isFork) level++;
    
    for(const bindingData of boundElementsData) {
        const arrow = ea.getViewElements().find(x=> x.id === bindingData.id);
        const nextEl = getNextElementFollowingArrow(el, arrow);
        if (nextEl && !visited.has(nextEl.id)) {
            if(isFork) result += `\n${"#".repeat(level)} `;
            const arrowLabel = getBoundText(arrow);
            if (arrowLabel) {
                // If the arrow has a label, add it as an additional level
                result += arrowLabel + "\n";
                result += await crawl(nextEl, level);
            } else {
                // If no label, continue to the next element
                result += await crawl(nextEl, level);
            }
        }
    };

    return result;
}

window.ewm = "## " + await crawl(selectedElements[0], 2);

const outputPath = await ea.getAttachmentFilepath(`EWM - ${ea.targetView.file.name}.md`);
let result = templatePath
  ? await app.vault.read(app.vault.getAbstractFileByPath(templatePath))
  : "";

if(result.match("<<<REPLACE ME>>>")) {
  result = result.replaceAll("<<<REPLACE ME>>>",window.ewm);
} else {
  result += window.ewm;
}

const outfile = await app.vault.create(outputPath,result);

setTimeout(()=>{
  ea.openFileInNewOrAdjacentLeaf(outfile);
}, 250);
