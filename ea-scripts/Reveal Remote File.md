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
      (el) => el.text.contains(contentUrl) || el.text.contains(githubUrl)
    );

  elements.forEach((linkElement) => {
    let url = linkElement.text.substring(linkElement.text.indexOf(urlPrefix));

    if (url.startsWith(githubUrl)) {
      url = url.replace(githubUrl, contentUrl).replace("/blob", "");
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
      })
      .catch((err) => new Notice(err.toString()));
  });
} catch (err) {
  _ = new Notice(err.toString())
}
