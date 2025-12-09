# [◀ Excalidraw Automate 使用指南](../readme.md)

## 使用 dataviewjs 从任务列表生成思维导图

这个方法与使用 templater 生成思维导图的脚本类似，但由于 dataview 已经以树形结构返回任务，所以实现起来稍微简单一些

### 输出效果

![image](https://user-images.githubusercontent.com/14358394/117548665-71dd8e80-b036-11eb-8a45-4169fdd7cc05.png)

### 输入文件

输入文件是 `Demo.md`，其内容如下：

```markdown
- [ ] Root task
    - [ ] task 1.1
    - [ ] task 1.2
        - [ ] task 1.2.1
        - [ ] task 1.2.2
    - [ ] task 1.3
        - [ ] task 1.3.1
```

### dataviewjs 脚本

`dataviewjs` 脚本如下所示：

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

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