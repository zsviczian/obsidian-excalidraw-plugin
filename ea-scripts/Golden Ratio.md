/*
The script performs two different functions depending on the elements selected in the view.
1) In case you select text elements, the script will cycle through a set of font scales. First the 2 larger fonts following the Fibonacci sequence (fontsize * φ; fonsize * φ^2), then the 2 smaller fonts (fontsize / φ; fontsize / φ^2), finally the original size, followed again by the 2 larger fonts. If you wait 2 seconds, the sequence clears and starts from which ever font size you are on. So if you want the 3rd larges font, then toggle twice, wait 2 sec, then toggle again.
2) In case you select a single rectangle, the script will open the "Golden Grid", "Golden Spiral" window, where you can set up the type of grid or spiral you want to insert into the document.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/golden-ratio.jpg)


<iframe width="560" height="315" src="https://www.youtube.com/embed/2SHn_ruax-s" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>


Gravitational point of spiral: $$\left[x,y\right]=\left[ x + \frac{{\text{width} \cdot \phi^2}}{{\phi^2 + 1}}\;, \; y + \frac{{\text{height} \cdot \phi^2}}{{\phi^2 + 1}} \right]$$
Dimensions of inner rectangles in case of Double Spiral: $$[width, height] = \left[\frac{width\cdot(\phi^2+1)}{2\phi^2}\;, \;\frac{height\cdot(\phi^2+1)}{2\phi^2}\right]$$

```js*/
const phi = (1 + Math.sqrt(5)) / 2; // Golden Ratio (φ)
const inversePhi = (1-1/phi);
const pointsPerCurve = 20; // Number of points per curve segment
const ownerWindow = ea.targetView.ownerWindow;
const hostLeaf = ea.targetView.leaf;
let dirty = false;
const ids = [];

const textEls = ea.getViewSelectedElements().filter(el=>el.type === "text");
let rect = ea.getViewSelectedElements().length === 1 ? ea.getViewSelectedElement() : null;
if(!rect || rect.type !== "rectangle") {
  //Fontsize cycle
  if(textEls.length>0) {
    if(window.excalidrawGoldenRatio) {
      clearTimeout(window.excalidrawGoldenRatio?.timer); 
    } else {
      window.excalidrawGoldenRatio = {timer: null, cycle:-1};
    }
    window.excalidrawGoldenRatio.timer = setTimeout(()=>{delete window.excalidrawGoldenRatio;},2000);
    window.excalidrawGoldenRatio.cycle = (window.excalidrawGoldenRatio.cycle+1)%5;
    
    ea.copyViewElementsToEAforEditing(textEls);
    ea.getElements().forEach(el=> {
      el.fontSize = window.excalidrawGoldenRatio.cycle === 2
        ? el.fontSize / Math.pow(phi,4)
        : el.fontSize * phi;
      const font = ExcalidrawLib.getFontString(el);
      const lineHeight = ExcalidrawLib.getDefaultLineHeight(el.fontFamily);
      const {width, height, baseline} = ExcalidrawLib.measureText(el.originalText, font, lineHeight);
      el.width = width;
      el.height = height;
      el.baseline = baseline;
    });
    ea.addElementsToView();
    return;
  }
  new Notice("Select text elements, or a select a single rectangle");
  return;
}
ea.copyViewElementsToEAforEditing([rect]);
rect = ea.getElement(rect.id);
ea.style.strokeColor = rect.strokeColor;
ea.style.strokeWidth = rect.strokeWidth;
ea.style.roughness = rect.roughness;
ea.style.angle = rect.angle;
let {x,y,width,height} = rect;

// --------------------------------------------
// Load Settings
// --------------------------------------------
let settings = ea.getScriptSettings();
if(!settings["Horizontal Grid"]) {
  settings = {
    "Horizontal Grid" : {
	  value: "left-right",
      valueset: ["none","letf-right","right-left","center-out","center-in"]
	},
    "Vertical Grid": {
      value: "none",
      valueset: ["none","top-down","bottom-up","center-out","center-in"]
    },
    "Size": {
      value: "6",
      valueset: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"]
    },
    "Aspect Choice": {
      value: "none",
      valueset: ["none","adjust-width","adjust-height"]
    },
    "Type": "grid",
    "Spiral Orientation": {
      value: "top-left",
      valueset: ["double","top-left","top-right","bottom-right","bottom-left"]
    },
    "Lock Elements": false,
    "Send to Back": false,
    "Update Style": false,
    "Bold Spiral": false,
  };
  await ea.setScriptSettings(settings);
}

let hDirection = settings["Horizontal Grid"].value;
let vDirection = settings["Vertical Grid"].value;
let aspectChoice = settings["Aspect Choice"].value;
let type = settings["Type"];
let spiralOrientation = settings["Spiral Orientation"].value;
let lockElements = settings["Lock Elements"];
let sendToBack = settings["Send to Back"];
let size = parseInt(settings["Size"].value);
let updateStyle = settings["Update Style"];
let boldSpiral = settings["Bold Spiral"];

// --------------------------------------------
// Rotation
// --------------------------------------------
let centerX, centerY;
const rotatePointAndAddToElementList = (elementID) => {
    ids.push(elementID);
    const line = ea.getElement(elementID);
    
    // Calculate the initial position of the line's center
    const lineCenterX = line.x + line.width / 2;
    const lineCenterY = line.y + line.height / 2;

    // Calculate the difference between the line's center and the rectangle's center
    const diffX = lineCenterX - (rect.x + rect.width / 2);
    const diffY = lineCenterY - (rect.y + rect.height / 2);

    // Apply the rotation to the difference
    const cosTheta = Math.cos(rect.angle);
    const sinTheta = Math.sin(rect.angle);
    const rotatedX = diffX * cosTheta - diffY * sinTheta;
    const rotatedY = diffX * sinTheta + diffY * cosTheta;

    // Calculate the new position of the line's center with respect to the rectangle's center
    const newLineCenterX = rotatedX + (rect.x + rect.width / 2);
    const newLineCenterY = rotatedY + (rect.y + rect.height / 2);

    // Update the line's coordinates by adjusting for the change in the center
    line.x += newLineCenterX - lineCenterX;
    line.y += newLineCenterY - lineCenterY;
}

const rotatePointsWithinRectangle = (points) => {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const cosTheta = Math.cos(rect.angle);
    const sinTheta = Math.sin(rect.angle);

    const rotatedPoints = points.map(([x, y]) => {
        // Translate the point relative to the rectangle's center
        const translatedX = x - centerX;
        const translatedY = y - centerY;

        // Apply the rotation to the translated coordinates
        const rotatedX = translatedX * cosTheta - translatedY * sinTheta;
        const rotatedY = translatedX * sinTheta + translatedY * cosTheta;

        // Translate back to the original coordinate system
        const finalX = rotatedX + centerX;
        const finalY = rotatedY + centerY;

        return [finalX, finalY];
    });

    return rotatedPoints;
}

// --------------------------------------------
// Grid
// --------------------------------------------
const calculateGoldenSum = (baseOfGoldenGrid, pow) => {
  const ratio = 1 / phi;
  const geometricSum = baseOfGoldenGrid * ((1 - Math.pow(ratio, pow)) / (1 - ratio));
  return geometricSum;
};

const findBaseForGoldenGrid = (targetValue, n, scenario) => {
  const ratio = 1 / phi;
      if (scenario === "center-out") {
      return targetValue * (2-2*ratio) / (1 + ratio + 2*Math.pow(ratio,n));
    } else if (scenario === "center-in") {
      return targetValue*2*(1-ratio)*Math.pow(phi,n-1) /(2*Math.pow(phi,n-1)*(1-Math.pow(ratio,n))-1+ratio);
    } else {
      return targetValue * (1-ratio)/(1-Math.pow(ratio,n));
    } 
}

const calculateOffsetVertical = (scenario, base) => {
  if (scenario === "center-out") return base / 2;
  if (scenario === "center-in") return base / Math.pow(phi, size + 1) / 2;
  return 0;
};

const horizontal = (direction, scenario) => {
  const base = findBaseForGoldenGrid(width, size + 1, scenario);
  const totalGridWidth = calculateGoldenSum(base, size + 1);

  for (i = 1; i <= size; i++) {
    const offset =
      scenario === "center-out"
        ? totalGridWidth - calculateGoldenSum(base, i)
        : calculateGoldenSum(base, size + 1 - i);

    const x2 =
      direction === "left"
        ? x + offset
        : x + width - offset;

    rotatePointAndAddToElementList(
      ea.addLine([
        [x2, y],
        [x2, y + height],
      ])
    );
  }
};

const vertical = (direction, scenario) => {
  const base = findBaseForGoldenGrid(height, size + 1, scenario);
  const totalGridWidth = calculateGoldenSum(base, size + 1);

  for (i = 1; i <= size; i++) {
    const offset =
      scenario === "center-out"
        ? totalGridWidth - calculateGoldenSum(base, i)
        : calculateGoldenSum(base, size + 1 - i);

    const y2 =
      direction === "top"
        ? y + offset
        : y + height - offset;

    rotatePointAndAddToElementList(
      ea.addLine([
        [x, y2],
        [x+width, y2],
      ])
    );
  }
};

const centerHorizontal = (scenario) => {
  width = width / 2;
  horizontal("left", scenario);
  x += width;
  horizontal("right", scenario);
  x -= width;
  width = 2*width;
  
};

const centerVertical = (scenario) => {
  height = height / 2;
  vertical("top", scenario);
  y += height;
  vertical("bottom", scenario);
  y -= height;
  height = 2*height;
};

const drawGrid = () => {
  switch(hDirection) {
    case "none": break;
    case "left-right": horizontal("left"); break;
    case "right-left": horizontal("right"); break;
    case "center-out": centerHorizontal("center-out"); break;
    case "center-in": centerHorizontal("center-in"); break;
  }
  switch(vDirection) {
    case "none": break;
    case "top-down": vertical("top"); break;
    case "bottom-up": vertical("bottom"); break;
    case "center-out": centerVertical("center-out"); break;
    case "center-in": centerVertical("center-in"); break;
  }
}

// --------------------------------------------
// Draw Spiral
// --------------------------------------------
const drawSpiral = () => {
  let nextX, nextY, nextW, nextH;
  let spiralPoints = [];
  let curveEndX, curveEndY, curveX, curveY;
  
  const phaseShift = {
    "bottom-right": 0,
    "bottom-left": 2,
    "top-left": 2,
    "top-right": 0,
  }[spiralOrientation];

  let curveStartX = {
    "bottom-right": x,
    "bottom-left": x+width,
    "top-left": x+width,
    "top-right": x,
  }[spiralOrientation];
  
  let curveStartY = {
    "bottom-right": y+height,
    "bottom-left": y+height,
    "top-left": y,
    "top-right": y,
  }[spiralOrientation];

  const mirror = spiralOrientation === "bottom-left" || spiralOrientation === "top-right";
  for (let i = phaseShift; i < size+phaseShift; i++) {
    const curvePhase = i%4;
    const linePhase = mirror?[0,3,2,1][curvePhase]:curvePhase;
    const longHorizontal = width/phi;
    const shortHorizontal = width*inversePhi;
    const longVertical = height/phi;
    const shortVertical = height*inversePhi;
    switch(linePhase) {
      case 0: //right
        nextX = x + longHorizontal;
        nextY = y;
        nextW = shortHorizontal;
        nextH = height;
        break;
      case 1: //down
        nextX = x;
        nextY = y + longVertical;
        nextW = width;
        nextH = shortVertical;
        break;
      case 2: //left
        nextX = x;
        nextY = y;
        nextW = shortHorizontal;
        nextH = height;
        break;
      case 3: //up
        nextX = x;
        nextY = y;
        nextW = width;
        nextH = shortVertical;
        break;
    }

    switch(curvePhase) {
      case 0: //right
        curveEndX = nextX;
        curveEndY = mirror ? nextY + nextH : nextY;
        break;
      case 1: //down
        curveEndX = nextX + nextW;
        curveEndY = mirror ? nextY + nextH : nextY;
        break;
      case 2: //left
        curveEndX = nextX + nextW;
        curveEndY = mirror ? nextY : nextY + nextH;
        break;
      case 3: //up
        curveEndX = nextX;
        curveEndY = mirror ? nextY : nextY + nextH;
        break;    
    }

    // Add points for the curve segment
  
    for (let j = 0; j <= pointsPerCurve; j++) {
      const t = j / pointsPerCurve;
      const angle = -Math.PI / 2 * t;
  
      switch(curvePhase) {
        case 0:
          curveX = curveEndX + (curveStartX - curveEndX) * Math.cos(angle);
          curveY = curveStartY + (curveStartY - curveEndY) * Math.sin(angle);
          break;
        case 1:
          curveX = curveStartX + (curveStartX - curveEndX) * Math.sin(angle);
          curveY = curveEndY + (curveStartY - curveEndY) * Math.cos(angle);
          break;
        case 2:
          curveX = curveEndX + (curveStartX - curveEndX) * Math.cos(angle);
          curveY = curveStartY + (curveStartY - curveEndY) * Math.sin(angle);
          break;
        case 3:
          curveX = curveStartX + (curveStartX - curveEndX) * Math.sin(angle);
          curveY = curveEndY + (curveStartY - curveEndY) * Math.cos(angle);
          break;
      }
      spiralPoints.push([curveX, curveY]);
    }
    x = nextX;
    y = nextY;
    curveStartX = curveEndX;
    curveStartY = curveEndY;
    width = nextW;
    height = nextH;
    switch(linePhase) {
      case 0: rotatePointAndAddToElementList(ea.addLine([[x,y],[x,y+height]]));break;
      case 1: rotatePointAndAddToElementList(ea.addLine([[x,y],[x+width,y]]));break;
      case 2: rotatePointAndAddToElementList(ea.addLine([[x+width,y],[x+width,y+height]]));break;
      case 3: rotatePointAndAddToElementList(ea.addLine([[x,y+height],[x+width,y+height]]));break;
    }
  }
  const strokeWidth = ea.style.strokeWidth;
  ea.style.strokeWidth = strokeWidth * (boldSpiral ? 3 : 1);
  const angle = ea.style.angle;
  ea.style.angle = 0;
  ids.push(ea.addLine(rotatePointsWithinRectangle(spiralPoints)));
  ea.style.angle = angle;
  ea.style.strokeWidth = strokeWidth;
}

// --------------------------------------------
// Update Aspect Ratio
// --------------------------------------------
const updateAspectRatio = () => {
  switch(aspectChoice) {
    case "none": break;
    case "adjust-width": rect.width = rect.height/phi; break;
    case "adjust-height": rect.height = rect.width/phi; break;
  }
  ({x,y,width,height} = rect);
  centerX = x + width/2;
  centerY = y + height/2;
}
// --------------------------------------------
// UI
// --------------------------------------------
draw = async () => {
  if(updateStyle) {
    ea.style.strokeWidth = 0.5; rect.strokeWidth;
    ea.style.roughness = 0; rect.roughness;
    ea.style.roundness = null;
    rect.strokeWidth = 0.5;
    rect.roughness = 0;
    rect.roundness = null;
  }
  updateAspectRatio();
  switch(type) {
    case "grid": drawGrid(); break;
    case "spiral":
      if(spiralOrientation === "double") {
        wInner = width * (Math.pow(phi,2)+1)/(2*Math.pow(phi,2));
        hInner = height * (Math.pow(phi,2)+1)/(2*Math.pow(phi,2));
        x2 = width - wInner + x;
        y2 = height - hInner + y;
        width = wInner;
        height = hInner;
        rotatePointAndAddToElementList(ea.addRect(x,y,width,height));
        spiralOrientation = "bottom-right";
        drawSpiral();
        x = x2;
        y = y2;
        width = wInner;
        height = hInner;
        rotatePointAndAddToElementList(ea.addRect(x,y,width,height));
        spiralOrientation = "top-left";
        drawSpiral();
        spiralOrientation = "double";
      } else {
        drawSpiral();
      }
      break;
  }
  ea.addToGroup(ids);
  ids.push(rect.id);
  ea.addToGroup(ids);
  lockElements && ea.getElements().forEach(el=>{el.locked = true;});
  await ea.addElementsToView(false,false,!sendToBack);
  !lockElements && ea.selectElementsInView(ea.getViewElements().filter(el => ids.includes(el.id)));
}

const modal = new ea.obsidian.Modal(app);

const fragWithHTML = (html) => createFragment((frag) => (frag.createDiv().innerHTML = html));

const keydownListener = (e) => {
  if(hostLeaf !== app.workspace.activeLeaf) return;
  if(hostLeaf.width === 0 && hostLeaf.height === 0) return;
  if(e.key === "Enter" && (e.ctrlKey || e.shiftKey || e.metaKey || e.altKey)) {
    e.preventDefault();
    modal.close();
    draw()
  }
}
ownerWindow.addEventListener('keydown',keydownListener);

modal.onOpen = async () => {
  const contentEl = modal.contentEl;
  contentEl.createEl("h1", {text: "Golden Ratio"});

  new ea.obsidian.Setting(contentEl)
    .setName("Adjust Rectangle Aspect Ratio to Golden Ratio")
    .addDropdown(dropdown=>dropdown
      .addOption("none","None")
      .addOption("adjust-width","Adjust Width")
      .addOption("adjust-height","Adjust Height")
      .setValue(aspectChoice)
      .onChange(value => {
        aspectChoice = value;
        dirty = true;
      })
   );

  new ea.obsidian.Setting(contentEl)
    .setName("Change Line Style To: thin, architect, sharp")
    .addToggle(toggle=>
      toggle
      .setValue(updateStyle)
      .onChange(value => {
        dirty = true;
        updateStyle = value;
      })
    )
  
  let sizeEl;
  new ea.obsidian.Setting(contentEl)
    .setName("Number of lines")
    .addSlider(slider => slider
      .setLimits(2, 20, 1)
      .setValue(size)
      .onChange(value => {
        sizeEl.innerText = ` ${value.toString()}`;
        size = value;
        dirty = true;
      }),
    )
    .settingEl.createDiv("", el => {
      sizeEl = el;
      el.style.minWidth = "2.3em";
      el.style.textAlign = "right";
      el.innerText = ` ${size.toString()}`;
    });
    
  new ea.obsidian.Setting(contentEl)
    .setName("Lock Rectangle and Gridlines")
    .addToggle(toggle=>
      toggle
      .setValue(lockElements)
      .onChange(value => {
        dirty = true;
        lockElements = value;
      })
    )
  
  new ea.obsidian.Setting(contentEl)
    .setName("Send to Back")
    .addToggle(toggle=>
      toggle
      .setValue(sendToBack)
      .onChange(value => {
        dirty = true;
        sendToBack = value;
      })
    )

  let bGrid, bSpiral;
  let sHGrid, sVGrid, sSpiral, sBoldSpiral;
  const showGridSettings = (value) => {
    value
      ? (bGrid.setCta(), bSpiral.removeCta())
      : (bGrid.removeCta(), bSpiral.setCta());
    sHGrid.settingEl.style.display = value ? "" : "none";
    sVGrid.settingEl.style.display = value ? "" : "none";
    sSpiral.settingEl.style.display = !value ? "" : "none";
    sBoldSpiral.settingEl.style.display = !value ? "" : "none";
  }
  
  new ea.obsidian.Setting(contentEl)
    .setName(fragWithHTML("<h3>Output Type</h3>"))
    .addButton(button => {
      bGrid = button;
      button
      .setButtonText("Grid")
      .setCta(type === "grid")
      .onClick(event => {
        type = "grid";
        showGridSettings(true);
        dirty = true;
      })
    })
    .addButton(button => {
      bSpiral = button;
      button
      .setButtonText("Spiral")
      .setCta(type === "spiral")
      .onClick(event => {
        type = "spiral";
        showGridSettings(false);
        dirty = true;
      })
    });

  sSpiral = new ea.obsidian.Setting(contentEl)
    .setName("Spiral Orientation")
    .addDropdown(dropdown=>dropdown
      .addOption("double","Double")
      .addOption("top-left","Top left")
      .addOption("top-right","Top right")
      .addOption("bottom-right","Bottom right")
      .addOption("bottom-left","Bottom left")
      .setValue(spiralOrientation)
      .onChange(value => {
        spiralOrientation = value;
        dirty = true;
      })
   );
  
  sBoldSpiral = new ea.obsidian.Setting(contentEl)
    .setName("Spiral with Bold Line")
    .addToggle(toggle=>
      toggle
      .setValue(boldSpiral)
      .onChange(value => {
        dirty = true;
        boldSpiral = value;
      })
    )
    
  sHGrid = new ea.obsidian.Setting(contentEl)
    .setName("Horizontal Grid")
    .addDropdown(dropdown=>dropdown
      .addOption("none","None")
      .addOption("left-right","Left to right")
      .addOption("right-left","Right to left")
      .addOption("center-out","Center out")
      .addOption("center-in","Center in")
      .setValue(hDirection)
      .onChange(value => {
        hDirection = value;
        dirty = true;
      })
   );

  sVGrid = new ea.obsidian.Setting(contentEl)
    .setName("Vertical Grid")
    .addDropdown(dropdown=>dropdown
      .addOption("none","None")
      .addOption("top-down","Top down")
      .addOption("bottom-up","Bottom up")
      .addOption("center-out","Center out")
      .addOption("center-in","Center in")
      .setValue(vDirection)
      .onChange(value => {
        vDirection = value;
        dirty = true;
      })
   );

  showGridSettings(type === "grid");
  new ea.obsidian.Setting(contentEl)
    .addButton(button => button
      .setButtonText("Run")
      .setCta(true)
      .onClick(async (event) => {
        draw();
        modal.close();
      })
    );
}
  
modal.onClose = () => {
  if(dirty) {
    settings["Horizontal Grid"].value = hDirection;
    settings["Vertical Grid"].value = vDirection;
    settings["Size"].value = size.toString();
    settings["Aspect Choice"].value = aspectChoice;
    settings["Type"] = type;
    settings["Spiral Orientation"].value = spiralOrientation;
    settings["Lock Elements"] = lockElements;
    settings["Send to Back"] = sendToBack;
    settings["Update Style"] = updateStyle;
    settings["Bold Spiral"] = boldSpiral;
    ea.setScriptSettings(settings);
  }
  ownerWindow.removeEventListener('keydown',keydownListener);
}
  
modal.open();