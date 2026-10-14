/*
![](./Reveal Remote File.svg)

This scripts retrieves the code from github links and emplaces the code directly in the document.

```javascript
*/

try {
  const urlPrefix = "https://";
  const contentUrl = `${urlPrefix}raw.githubusercontent.com`;
  const githubUrl = `${urlPrefix}github.com`;

  const elements = ea
    .getViewSelectedElements()
    .filter((el) => el.type == "text")
    .filter(
      (el) => el.rawText.contains(contentUrl) || el.rawText.contains(githubUrl)
    );

  elements.forEach((linkElement) => {
    let url = '';

    const linkRegexp = /\[(.+)\]\((.+)\)/gs;

    const linkText = linkRegexp.exec(linkElement.rawText);
    
    if (linkText) {
      url = linkText[2];
    } else {
      url = linkElement.text.substring(linkElement.text.indexOf(urlPrefix));
    }

    if (url.startsWith(githubUrl)) {
      url = url.replace(githubUrl, contentUrl).replace("/blob", "");
    }

    if (!url.startsWith(urlPrefix)) {
      return new Notice(`"${url}" is not a valid link`);
    }
    
    fetch(url)
      .then((resp) => resp.text())
      .then((text) => {
        const marginY = linkElement.fontSize * 1.5;

        ea.style.fontSize = linkElement.fontSize;
        ea.style.fontFamily = 3;

        const codeElementId = ea.addText(
          linkElement.x,
          linkElement.y + marginY,
          text
        );

        ea.addElementsToView(false, false);

        // ea.addToGroup([linkElement.id, codeElementId]);

        // ea.addElementsToView(false, true, true);
      })
      .catch((err) => new Notice(err.toString()));
  });
} catch (err) {
  _ = new Notice(err.toString())
}

