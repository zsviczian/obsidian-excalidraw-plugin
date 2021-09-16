# [◀ Excalidraw Automate How To](../readme.md)
## Adding objects
These functions will add objects to your drawing. The canvas is infinite, and it accepts negative and positive X and Y values. X values increase left to right, Y values increase top to bottom.

![coordinates](https://user-images.githubusercontent.com/14358394/116825632-6569b980-ab90-11eb-827b-ada598e91e46.png)

### addRect(), addDiamond(), addEllipse()
```typescript
addRect(topX:number, topY:number, width:number, height:number):string
addDiamond(topX:number, topY:number, width:number, height:number):string
addEllipse(topX:number, topY:number, width:number, height:number):string
```
Returns the `id` of the object. The `id` is required when connecting objects with lines. See later.

### addText()
```typescript
addText( 
  topX:number, 
  topY:number, 
  text:string, 
  formatting?:{
    wrapAt?:number, 
    width?:number, 
    height?:number,
    textAlign?:string, 
    box?: "box"|"blob"|"ellipse"|"diamond", 
    boxPadding?:number
  },
  id?:string
):string
```

Adds text to the drawing. 

Formatting parameters are optional:
- If `width` and `height` are not specified, the function will calculate the width and height based on the fontFamily, the fontSize and the text provided.
- In case you want to position a text in the center compared to other elements on the drawing, you can provide a fixed height and width, and you can also specify `textAlign` and `verticalAlign` as described above. e.g.: `{width:500, textAlign:"center"}`
- If you want to add a box around the text, set `{box:"box"|"blob"|"ellipse"|"diamond"}`

Returns the `id` of the object. The `id` is required when connecting objects with lines. See later. If `{box:}` then returns the id of the enclosing box object.

### addLine()
```typescript
addLine(points: [[x:number,y:number]]):string
```
Adds a line following the points provided. Must include at least two points `points.length >= 2`. If more than 2 points are provided the interim points will be added as breakpoints. The line will break with angles if `strokeSharpness` is set to "sharp" and will be curvey if it is set to "round".

Returns the `id` of the object.

### addArrow()
```typescript
addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead?:string,endArrowHead?:string,startObjectId?:string,endObjectId?:string}):string ;
```

Adds an arrow following the points provided. Must include at least two points `points.length >= 2`. If more than 2 points are provided the interim points will be added as breakpoints. The line will break with angles if element `style.strokeSharpness` is set to "sharp" and will be curvey if it is set to "round".

`startArrowHead` and `endArrowHead` specify the type of arrow head to use, as described above. Valid values are "none", "arrow", "dot", and "bar". e.g. `{startArrowHead: "dot", endArrowHead: "arrow"}`

`startObjectId` and `endObjectId` are the object id's of connected objects. I recommend using `connectObjects` instead calling addArrow() for the purpose of connecting objects.

Returns the `id` of the object.

### connectObjects()
```typescript
declare type ConnectionPoint = "top"|"bottom"|"left"|"right";
connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void
```
Connects two objects with an arrow. Will do nothing if either of the two elements is of type `line`, `arrow`, or `freedraw`.

`objectA` and `objectB` are strings. These are the ids of the objects to connect. These IDs are returned by addRect(), addDiamond(), addEllipse() and addText() when creating those objects.

`connectionA` and `connectionB` specify where to connect on the object. Valid values are: "top", "bottom", "left", and "right".

`numberOfPoints` set the number of interim break points for the line. Default value is zero, meaning there will be no breakpoint in between the start and the end points of the arrow. When moving objects on the drawing, these breakpoints will influence how the line is rerouted by Excalidraw.

`startArrowHead` and `endArrowHead` work as described for `addArrow()` above.

### addToGroup()
```typescript
addToGroup(objectIds:[]):string
```
Groups objects listed in `objectIds`. Returns the `id` of the group.