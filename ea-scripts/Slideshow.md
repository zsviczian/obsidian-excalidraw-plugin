/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-slideshow-1.jpg)
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-slideshow-2.jpg)
The script will convert your drawing into a slideshow presentation.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.8.17")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const statusBar = document.querySelector("div.status-bar");
const ctrlKey = ea.targetView.modifierKeyDown.ctrlKey || ea.targetView.modifierKeyDown.metaKey;
const altKey = ea.targetView.modifierKeyDown.altKey || ctrlKey;

//constants
const STEPCOUNT = 100;
const TRANSITION_DELAY = 1500; //maximum time for transition between slides in milliseconds
const FRAME_SLEEP = 1; //milliseconds
const EDIT_ZOOMOUT = 0.7; //70% of original slide zoom, set to a value between 1 and 0

//utility & convenience functions
const inPopoutWindow = altKey || ea.targetView.ownerDocument !== document;
const win = ea.targetView.ownerWindow;
const api = ea.getExcalidrawAPI();
const contentEl = ea.targetView.contentEl;
const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//clean up potential clutter from previous run
window.removePresentationEventHandlers?.();

//check if line or arrow is selected, if not inform the user and terminate presentation
let lineEl = ea.getViewElements().filter(el=>["line","arrow"].contains(el.type) && el.customData?.slideshow)[0];
const selectedEl = ea.getViewSelectedElement();
let preventHideAction = false;
if(lineEl && selectedEl && ["line","arrow"].contains(selectedEl.type)) {
  api.setToast({
    message:"Using selected line instead of hidden line. Note that there is a hidden presentation path for this drawing. Run the slideshow script without selecting any elements to access the hidden presentation path",
    duration: 5000,
    closable: true
  })
  preventHideAction = true;
  lineEl = selectedEl;
}
if(!lineEl) lineEl = selectedEl;
if(!lineEl || !["line","arrow"].contains(lineEl.type)) {
  api.setToast({
    message:"Please select the line or arrow for the presentation path",
    duration: 3000,
    closable: true
  })
  return;
}

//goto fullscreen
const gotoFullscreen = async () => {
	if(app.isMobile) {
	  ea.viewToggleFullScreen(true);
	} else {
	  if(!inPopoutWindow) {
	    await contentEl.webkitRequestFullscreen();
	    await sleep(500);
	  }
	  ea.setViewModeEnabled(true);
	}
	const deltaWidth = () => contentEl.clientWidth-api.getAppState().width;
	let watchdog = 0;
	while (deltaWidth()>50 && watchdog++<20) await sleep(100); //wait for Excalidraw to resize to fullscreen
	contentEl.querySelector(".layer-ui__wrapper").addClass("excalidraw-hidden");
}

//hide the arrow and save the arrow color before doing so
const originalProps = lineEl.customData?.slideshow?.hidden
  ? lineEl.customData.slideshow.originalProps
  : {
	  strokeColor: lineEl.strokeColor,
	  backgroundColor: lineEl.backgroundColor,
	  locked: lineEl.locked,
  };
let hidden = lineEl.customData?.slideshow?.hidden ?? false;

const hideArrow = async (setToHidden) => {
  ea.clear();
  ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(el=>el.id === lineEl.id));
  const el = ea.getElement(lineEl.id);
	el.strokeColor = "transparent";
	el.backgroundColor = "transparent";
  const customData = el.customData;
	if(setToHidden && !preventHideAction) {
    el.locked = true;
		el.customData = {
		  ...customData,
		  slideshow: {
			  originalProps,
			  hidden: true
		  }
		}
    hidden = true;
	} else {
    if(customData) delete el.customData.slideshow;
    hidden = false;
  }
	await ea.addElementsToView();
}

//----------------------------
//scroll-to-location functions
//----------------------------
let slide = -1;
const slideCount = Math.floor(lineEl.points.length/2)-1;

const getNextSlide = (forward) => {
  slide = forward
    ? slide < slideCount ? slide + 1  : 0
    : slide <= 0         ? slideCount : slide - 1;
	return {
    pointA:lineEl.points[slide*2],
    pointB:lineEl.points[slide*2+1]
  }
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
const scrollToNextRect = async ({left,top,right,bottom,nextZoom},steps = STEPCOUNT) => {
  const startTimer = Date.now();
  let watchdog = 0;
  while(busy && watchdog++<15) await(100);
  if(busy && watchdog >= 15) return;
  busy = true;
  api.updateScene({appState:{shouldCacheIgnoreZoom:true}});
  const {scrollX, scrollY, zoom} = api.getAppState();
  const zoomStep = (zoom.value-nextZoom)/steps;
  const xStep = (left+scrollX)/steps;
  const yStep = (top+scrollY)/steps;
  let i=1;
  while(i<=steps) {
    api.updateScene({
      appState: {
        scrollX:scrollX-(xStep*i),
        scrollY:scrollY-(yStep*i),
        zoom:{value:zoom.value-zoomStep*i},
      }
    });
    const ellapsed = Date.now()-startTimer;
    if(ellapsed > TRANSITION_DELAY) {
      i = i<steps ? steps : steps+1;
    } else {
      const timeProgress = ellapsed / TRANSITION_DELAY;
      i=Math.min(Math.round(steps*timeProgress),steps)
      await sleep(FRAME_SLEEP);
    }
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
    exitPresentation();
    return;
  }
  if(slideNumberEl) slideNumberEl.innerText = `${slide+1}/${slideCount+1}`;
  const nextRect = getSlideRect(nextSlide);
  await scrollToNextRect(nextRect);
  if(settingsModal) {
    slideNumberDropdown.setValue(`${slide}`.padStart(3,"0"));
  }
}

//--------------------------
// Settings Modal
//--------------------------
let settingsModal;
let slideNumberDropdown;
const presentationSettings = () => {
	let dirty = false;
	settingsModal = new ea.obsidian.Modal(app);

	const getSlideNumberLabel = (i) => {
		switch(i) {
		  case 0: return "1 - Start";
		  case slideCount: return `${i+1} - End`;
		  default: return `${i+1}`;
		}
	}

  const getSlidesList = () => {
	  const options = {};
	  for(i=0;i<=slideCount;i++) {
	    options[`${i}`.padStart(3,"0")] = getSlideNumberLabel(i);
	  }
	  return options;
	}

	settingsModal.onOpen = () => {
		settingsModal.contentEl.createEl("h1",{text: "Slideshow Actions"});
    settingsModal.contentEl.createEl("p",{text: "To open this window CTRL/CMD + click the presentation script icon or press ENTER during presentation."});
    settingsModal.contentEl.createEl("p",{text: "If you don't want the presentation in fullscreen mode, hold down the ALT/OPT key when clicking the script button."});
		new ea.obsidian.Setting(settingsModal.contentEl)
		  .setName("Jump to slide")
		  .addDropdown(dropdown => {
        slideNumberDropdown = dropdown;
        dropdown
          .addOptions(getSlidesList()) 
          .setValue(`${slide}`.padStart(3,"0"))
          .onChange(value => {
            slide = parseInt(value)-1;
            navigate("fwd");
          })
      })
    
    if(!preventHideAction) {
      new ea.obsidian.Setting(settingsModal.contentEl)
        .setName("Hide navigation arrow after slideshow")
        .setDesc("Toggle on: arrow hidden, toggle off: arrow visible")
        .addToggle(toggle => toggle
          .setValue(hidden)
          .onChange(value => hideArrow(value))
        )  
    }

    new ea.obsidian.Setting(settingsModal.contentEl)
		  .setName("Edit current slide")
      .setDesc("Pressing 'e' during the presentation will open the current slide for editing.")
		  .addButton(button => button
		    .setButtonText("Edit")
        .onClick(async ()=>{
          await hideArrow(false);
          exitPresentation(true);
        })
      )  
	}
	
	settingsModal.onClose = () => {
    setTimeout(()=>delete settingsModal);
	}
	
	settingsModal.open();
	contentEl.appendChild(settingsModal.containerEl);
}

//--------------------------------------
//Slideshow control
//--------------------------------------
let controlPanelEl;
let slideNumberEl;
const createNavigationPanel = () => {
  //create slideshow controlpanel container
  const top = contentEl.innerHeight; 
  const left = contentEl.innerWidth; 
  controlPanelEl = contentEl.createDiv({
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
  const panelColumn = controlPanelEl.createDiv({
    cls: "panelColumn",
  });
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
}

//keyboard navigation
const keydownListener = (e) => {
  if(ea.targetView.leaf !== app.workspace.activeLeaf) return;
  e.preventDefault();
  switch(e.key) {
    case "Escape":
      if(app.isMobile || inPopoutWindow) exitPresentation();
      break;
    case "ArrowRight":
    case "ArrowDown": 
      navigate("fwd");
      break;
    case "ArrowLeft":
    case "ArrowUp":
      navigate("bkwd");
      break;
    case "Enter":
      presentationSettings();
      break;
    case "End":
      slide = slideCount - 1;
      navigate("fwd");
      break;
    case "Home":
      slide = -1;
      navigate("fwd");
      break;
    case "e": 
      (async ()=>{
        await hideArrow(false);
        exitPresentation(true);
      })()
      break;
  }
}

//slideshow panel drag
let pos1 = pos2 = pos3 = pos4 = 0;

const updatePosition = (deltaY = 0, deltaX = 0) => {
  const {
    offsetTop,
    offsetLeft,
    clientWidth: width,
    clientHeight: height,
   } = controlPanelEl;
  controlPanelEl.style.top = (offsetTop - deltaY) + 'px';
  controlPanelEl.style.left = (offsetLeft - deltaX) + 'px';
}
   
const pointerUp = () => {
  win.removeEventListener('pointermove', onDrag, true);
}

let dblClickTimer = 0;
const pointerDown = (e) => {
  const now = Date.now();
  pos3 = e.clientX;
  pos4 = e.clientY;
  win.addEventListener('pointermove', onDrag, true);
  if(now-dblClickTimer < 400) {
    presentationSettings();
  }
  dblClickTimer = now;
}

const onDrag = (e) => {
  e.preventDefault();
  pos1 = pos3 - e.clientX;
  pos2 = pos4 - e.clientY;
  pos3 = e.clientX;
  pos4 = e.clientY;
  updatePosition(pos2, pos1);
}

const initializeEventListners = () => {
	win.addEventListener('keydown',keydownListener);
  controlPanelEl.addEventListener('pointerdown', pointerDown, false);
  win.addEventListener('pointerup', pointerUp, false);

	//event listners for terminating the presentation
	window.removePresentationEventHandlers = () => {
	  ea.onLinkClickHook = null;
	  controlPanelEl.parentElement?.removeChild(controlPanelEl);
	  if(!app.isMobile) win.removeEventListener('fullscreenchange', fullscreenListener);
	  win.removeEventListener('keydown',keydownListener);
	  win.removeEventListener('pointerup',pointerUp);
	  contentEl.querySelector(".layer-ui__wrapper")?.removeClass("excalidraw-hidden");
	  delete window.removePresentationEventHandlers;
	}

	ea.onLinkClickHook = () => {
    exitPresentation();
    return true;
  };
  
  if(!app.isMobile) {
    win.addEventListener('fullscreenchange', fullscreenListener);
  }
}

const exitPresentation = async (openForEdit = false) => {
  statusBar.style.display = "inherit";
  if(openForEdit) ea.targetView.preventAutozoom();
  if(!app.isMobile && !inPopoutWindow && document?.fullscreenElement) await document.exitFullscreen();
  if(app.isMobile) {
    ea.viewToggleFullScreen(true);
  } else {
    ea.setViewModeEnabled(false);
  }
  if(settingsModal) settingsModal.close();
  ea.clear();
  ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(el=>el.id === lineEl.id));
  const el = ea.getElement(lineEl.id);
  if(!hidden) {
    el.strokeColor = originalProps.strokeColor;
    el.backgroundProps = originalProps.backgroundColor;
    el.locked = openForEdit ? false : originalProps.locked;
  }
  await ea.addElementsToView();
  if(!hidden) ea.selectElementsInView([el]);
  if(openForEdit) {
    const nextSlide = getNextSlide(--slide);
    let nextRect = getSlideRect(nextSlide);
    const offsetW = (nextRect.right-nextRect.left)*(1-EDIT_ZOOMOUT)/2;
    const offsetH = (nextRect.bottom-nextRect.top)*(1-EDIT_ZOOMOUT)/2
    nextRect = {
      left: nextRect.left-offsetW,
      right: nextRect.right+offsetW,
      top: nextRect.top-offsetH,
      bottom: nextRect.bottom+offsetH,
      nextZoom: nextRect.nextZoom*EDIT_ZOOMOUT > 0.1 ? nextRect.nextZoom*EDIT_ZOOMOUT : 0.1 //0.1 is the minimu zoom value
    };
    await scrollToNextRect(nextRect,1);
    api.startLineEditor(
      ea.getViewSelectedElement(),
      [slide*2,slide*2+1]
    );
  }
  window.removePresentationEventHandlers?.();
  setTimeout(()=>{
    //Resets pointer offsets. Ugly solution. 
    //During testing offsets were wrong after presentation, but don't know why.
    //This should solve it even if they are wrong.
    ea.targetView.refresh(); 
  })
}

const fullscreenListener = (e) => {
  e.preventDefault();
  exitPresentation();
}


//--------------------------
// Start presentation or open presentation settings on double click
//--------------------------
const start = async () => {
  await gotoFullscreen();
  await hideArrow(hidden);
  createNavigationPanel();
  initializeEventListners();
  //navigate to the first slide on start
  setTimeout(()=>navigate("fwd"));
  statusBar.style.display = "none";
}

const timestamp = Date.now();
if(window.ExcalidrawSlideshow && (window.ExcalidrawSlideshow.script === utils.scriptFile.path) && (timestamp - window.ExcalidrawSlideshow.timestamp <400) ) {
  if(window.ExcalidrawSlideshowStartTimer) {
    clearTimeout(window.ExcalidrawSlideshowStartTimer);
    delete window.ExcalidrawSlideshowStartTimer;
  }
  await start();
  presentationSettings();
} else {
  if(window.ExcalidrawSlideshowStartTimer) {
    clearTimeout(window.ExcalidrawSlideshowStartTimer);
    delete window.ExcalidrawSlideshowStartTimer;
  }
  if(ctrlKey) {
    await start();
    presentationSettings();
		return;
  }
  window.ExcalidrawSlideshow = {
    script: utils.scriptFile.path,
    timestamp
  };
  window.ExcalidrawSlideshowStartTimer = setTimeout(start,500);
}