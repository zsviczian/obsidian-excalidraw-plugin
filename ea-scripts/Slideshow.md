/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-slideshow-1.jpg)
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-slideshow-2.jpg)
The script will convert your drawing into a slideshow presentation.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.8.2")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

//constants
const STEPCOUNT = 100;
const FRAME_SLEEP = 1; //milliseconds

//utility & convenience functions
const doc = ea.targetView.ownerDocument;
const win = ea.targetView.ownerWindow;
const api = ea.getExcalidrawAPI();
const contentEl = ea.targetView.contentEl;
const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//clean up potential clutter from previous run
window.removePresentationEventHandlers?.();

//check if line or arrow is selected, if not inform the user and terminate presentation
const lineEl = ea.getViewSelectedElement();
if(!lineEl || !["line","arrow"].contains(lineEl.type)) {
  new Notice("Please select the line or arrow for the presentation path");
  return;
}

//goto fullscreen
if(app.isMobile) {
  ea.viewToggleFullScreen(true);
} else {
  await contentEl.webkitRequestFullscreen();
  await sleep(500);
  ea.setViewModeEnabled(true);
}
const deltaWidth = () => contentEl.clientWidth-api.getAppState().width;
let watchdog = 0;
while (deltaWidth()>50 && watchdog++<20) await sleep(100); //wait for Excalidraw to resize to fullscreen
contentEl.querySelector(".layer-ui__wrapper").addClass("excalidraw-hidden");

//hide the arrow and save the arrow color before doing so
const originalColor = {
	strokeColor: lineEl.strokeColor,
	backgroundColor: lineEl.backgroundColor
}
ea.copyViewElementsToEAforEditing([lineEl]);
ea.getElement(lineEl.id).strokeColor = "transparent";
ea.getElement(lineEl.id).backgroundColor = "transparent";
await ea.addElementsToView();

//----------------------------
//scroll-to-location functions
//----------------------------
let slide = -1;
const slideCount = Math.floor(lineEl.points.length/2)-1;

const getNextSlide = (forward) => {
  slide = forward
    ? slide < slideCount ? slide + 1  : 0
	: slide <= 0         ? slideCount : slide - 1;
	return {pointA:lineEl.points[slide*2], pointB:lineEl.points[slide*2+1]}
}

const getSlideRect = ({pointA, pointB}) => {
  const {width, height} = api.getAppState();
  const x1 = lineEl.x+pointA[0];
  const y1 = lineEl.y+pointA[1];
  const x2 = lineEl.x+pointB[0];
  const y2 = lineEl.y+pointB[1];
  const ratioX = width/Math.abs(x1-x2);
  const ratioY = height/Math.abs(y1-y2);
  let ratio = ratioX<ratioY?ratioX:ratioY;
  if (ratio < 0.1) ratio = 0.1;
  if (ratio > 10) ratio = 10;
  const deltaX = (ratio===ratioY)?(width/ratio - Math.abs(x1-x2))/2:0;
  const deltaY = (ratio===ratioX)?(height/ratio - Math.abs(y1-y2))/2:0;
  return {
    left: (x1<x2?x1:x2)-deltaX,
    top: (y1<y2?y1:y2)-deltaY,
    right: (x1<x2?x2:x1)+deltaX,
    bottom: (y1<y2?y2:y1)+deltaY,
    nextZoom: ratio
  };
}

let busy = false;
const scrollToNextRect = async ({left,top,right,bottom,nextZoom}) => {
  let watchdog = 0;
  while(busy && watchdog++<15) await(100);
  if(busy && watchdog >= 15) return;
  busy = true;
  const {scrollX, scrollY, zoom} = api.getAppState();
  const zoomStep = (zoom.value-nextZoom)/STEPCOUNT;
  const xStep = (left+scrollX)/STEPCOUNT;
  const yStep = (top+scrollY)/STEPCOUNT;
  for(i=1;i<=STEPCOUNT;i++) {
    api.updateScene({
      appState: {
        scrollX:scrollX-(xStep*i),
        scrollY:scrollY-(yStep*i),
        zoom:{value:zoom.value-zoomStep*i},
        shouldCacheIgnoreZoom:true,
      }
    });
    await sleep(FRAME_SLEEP);
  }
  api.updateScene({appState:{shouldCacheIgnoreZoom:false}});
  busy = false;
}

const navigate = async (dir) => {
  const forward = dir === "fwd";
  const prevSlide = slide;
  const nextSlide = getNextSlide(forward);
  
  //exit if user navigates from last slide forward or first slide backward
  const shouldExit = forward
    ? slide<=prevSlide
    : slide>=prevSlide;
  if(shouldExit) {
    if(!app.isMobile) await doc.exitFullscreen();
    exitPresentation();
    return;
  }
  if(slideNumberEl) slideNumberEl.innerText = `${slide+1}/${slideCount+1}`;
  const nextRect = getSlideRect(nextSlide);
  await scrollToNextRect(nextRect);
}

//--------------------------------------
//Slideshow control
//--------------------------------------
//create slideshow controlpanel container
const top = contentEl.innerHeight; 
const left = contentEl.innerWidth; 
const containerEl = contentEl.createDiv({
  cls: ["excalidraw","excalidraw-presentation-panel"],
  attr: {
    style: `
      width: calc(var(--default-button-size)*3);
      z-index:5;
      position: absolute;
      top:calc(${top}px - var(--default-button-size)*2);
      left:calc(${left}px - var(--default-button-size)*3.5);`
  }
}); 
const panelColumn = containerEl.createDiv({
  cls: "panelColumn",
});
let slideNumberEl;
panelColumn.createDiv({
  cls: ["Island", "buttonList"],
  attr: {
    style: `
      height: calc(var(--default-button-size)*1.5);
      width: 100%;
      background: var(--island-bg-color);`,
  }
}, el=>{
  el.createEl("button",{
    text: "<",
    attr: {
      style: `
        margin-top: calc(var(--default-button-size)*0.25);
        margin-left: calc(var(--default-button-size)*0.25);`
    }
  }, button => button .onclick = () => navigate("bkwd"));
  el.createEl("button",{
    text: ">",
    attr: {
      style: `
        margin-top: calc(var(--default-button-size)*0.25);
        margin-right: calc(var(--default-button-size)*0.25);`
    }
  }, button => button.onclick = () => navigate("fwd"));
  slideNumberEl = el.createEl("span",{
	  text: "1",
	  cls: ["ToolIcon__keybinding"],
  })
});

//keyboard navigation
const keydownListener = (e) => {
  e.preventDefault();
  switch(e.key) {
    case "escape":
      if(app.isMobile) exitPresentation();
      break;
    case "ArrowRight":
    case "ArrowDown": 
      navigate("fwd");
      break;
    case "ArrowLeft":
    case "ArrowUp":
      navigate("bkwd");
      break;
  }  
}
doc.addEventListener('keydown',keydownListener);

//slideshow panel drag
let pos1 = pos2 = pos3 = pos4 = 0;

const updatePosition = (deltaY = 0, deltaX = 0) => {
  const {
    offsetTop,
    offsetLeft,
    clientWidth: width,
    clientHeight: height,
   } = containerEl;
  containerEl.style.top = (offsetTop - deltaY) + 'px';
  containerEl.style.left = (offsetLeft - deltaX) + 'px';
}
   
const pointerUp = () => {
  win.removeEventListener('pointermove', onDrag, true);
}

const pointerDown = (e) => {
  pos3 = e.clientX;
  pos4 = e.clientY;
  win.addEventListener('pointermove', onDrag, true);
}

const onDrag = (e) => {
  e.preventDefault();
  pos1 = pos3 - e.clientX;
  pos2 = pos4 - e.clientY;
  pos3 = e.clientX;
  pos4 = e.clientY;
  updatePosition(pos2, pos1);
}

containerEl.addEventListener('pointerdown', pointerDown, false);
win.addEventListener('pointerup', pointerUp, false);

//event listners for terminating the presentation
window.removePresentationEventHandlers = () => {
  ea.onLinkClickHook = null;
  containerEl.parentElement?.removeChild(containerEl);
  if(!app.isMobile) win.removeEventListener('fullscreenchange', fullscreenListener);
  doc.removeEventListener('keydown',keydownListener);
  win.removeEventListener('pointerup',pointerUp);
  contentEl.querySelector(".layer-ui__wrapper").removeClass("excalidraw-hidden");
  delete window.removePresentationEventHandlers;
}

const exitPresentation = () => {
  window.removePresentationEventHandlers?.();
  if(app.isMobile) ea.viewToggleFullScreen(true);
  else ea.setViewModeEnabled(false);
  ea.clear();
  ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(el=>el.id === lineEl.id));
  ea.getElement(lineEl.id).strokeColor = originalColor.strokeColor;
  ea.getElement(lineEl.id).backgroundColor = originalColor.backgroundColor;
  ea.addElementsToView();  
  ea.selectElementsInView(ea.getElements());
}

ea.onLinkClickHook = () => {
  exitPresentation();
  return true;
};

const fullscreenListener = (e) => {
  e.preventDefault();
  exitPresentation();
}

if(!app.isMobile) {
  win.addEventListener('fullscreenchange', fullscreenListener);
}

//navigate to the first slide on start
setTimeout(()=>navigate("fwd"));