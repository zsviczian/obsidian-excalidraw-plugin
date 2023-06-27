/* 
Creates a new Excalidraw.com collaboration room and places the link to the room on the clipboard.
```js*/
const room = Array.from(window.crypto.getRandomValues(new Uint8Array(10))).map((byte) => `0${byte.toString(16)}`.slice(-2)).join("");
const key = (await window.crypto.subtle.exportKey("jwk",await window.crypto.subtle.generateKey({name:"AES-GCM",length:128},true,["encrypt", "decrypt"]))).k;
const link = `https://excalidraw.com/#room=${room},${key}`;

ea.addIFrame(0,0,800,600,link);
ea.addElementsToView(true,true);

window.navigator.clipboard.writeText(link);
new Notice("The collaboration room link is available on the clipboard.",4000);