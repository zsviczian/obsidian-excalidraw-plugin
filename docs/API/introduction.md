# Introduction to the API
You can access Excalidraw Automate via the ExcalidrawAutomate object. I recommend staring your Automate scripts with the following code.

*Use CTRL+Shift+V to paste code into Obsidian!*
```javascript
const ea = ExcalidrawAutomate;
ea.reset();
```

The first line creates a practical constant so you can avoid writing ExcalidrawAutomate 100x times.

The second line resets ExcalidrawAutomate to defaults. This is important as you will not know which template you executed before, thus you won't know what state you left Excalidraw in.

## Basic logic of using Excalidraw Automate
1. Set the styling of the elements you want to draw
2. Add elements. As you add elements, each new element is added one layer above the previous, thus in case of overlapping objects the later one will be on the top of the prior one.
3. Call `await ea.create();` to instantiate the drawing

You can change styling between adding different elements. My logic for separating element styling and creation is based on the assumption that you will probably set a stroke color, stroke style, stroke roughness, etc. and draw most of your elements using this. There would be no point in setting all these parameters each time you add an element.

## Before we dive deeper, here are two a simple example scripts
### Create a new drawing with custom name, in a custom folder, using a template
This simple script gives you significant additional flexibility over Excalidraw Plugin settings to name your drawings, place them into folders, and to apply templates.

*Use CTRL+Shift+V to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  await ea.create({
    filename    : tp.date.now("HH.mm"), 
    foldername  : tp.date.now("YYYY-MM-DD"),
    templatePath: "Excalidraw/Template1.excalidraw",
    onNewPane   : false
  });
%>
```

#### Create a simple drawing
*Use CTRL+Shift+V to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.addRect(-150,-50,450,300);
  ea.addText(-100,70,"Left to right");
  ea.addArrow([[-100,100],[100,100]]);

  ea.style.strokeColor = "red";
  ea.addText(100,-30,"top to bottom",{width:200,textAligh:"center"});
  ea.addArrow([[200,0],[200,200]]);
  await ea.create();
%>
```
The script will generate the following drawing:

![FristDemo](https://user-images.githubusercontent.com/14358394/116825643-6e5a8b00-ab90-11eb-9e3a-37c524620d0d.png)