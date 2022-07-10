# [◀ Excalidraw Automate How To](../readme.md)
## Mindmap from Tasklist using dataviewjs
This is similar to the mindmap script using templater, but because dataview already returns tasks in a tree, it is slightly simpler

### Output
![image](https://user-images.githubusercontent.com/14358394/117548665-71dd8e80-b036-11eb-8a45-4169fdd7cc05.png)

### Input file
The input file is `Demo.md` with the following contents:
```markdown
- [ ] Root task
    - [ ] task 1.1
    - [ ] task 1.2
        - [ ] task 1.2.1
        - [ ] task 1.2.2
    - [ ] task 1.3
        - [ ] task 1.3.1
```

### dataviewjs script
The `dataviewjs` script looks like this: 
*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
function crawl(subtasks) {
  let size = subtasks.length > 0 ? 0 : 1; //if no children then a leaf with size 1
  for (let task of subtasks) {
    task["size"] = crawl(task.subtasks);
    size += task.size;
  }
  return size;
}

const tasks = dv.page("Demo.md").file.tasks[0];
tasks["size"] = crawl(tasks.subtasks);

const width = 300;
const height = 100;
const ea = ExcalidrawAutomate;
ea.reset();

function buildMindmap(subtasks, depth, offset, parentObjectID) {
  if (subtasks.length == 0) return;
  for (let task of subtasks) {
    if (depth == 1) ea.style.strokeColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,"0");
    task["objectID"] = ea.addText(depth*width,(task.size/2+offset)*height,task.text,{box:true})
    ea.connectObjects(parentObjectID,"right",task.objectID,"left",{startArrowHead: 'dot'});
    buildMindmap(task.subtasks, depth+1,offset,task.objectID);
    offset += task.size;
  }
}

tasks["objectID"] = ea.addText(0,(tasks.size/2)*height,tasks.text,{box:true});    
buildMindmap(tasks.subtasks, 1, 0, tasks.objectID);

ea.createSVG().then((svg)=>dv.span(svg.outerHTML));
```