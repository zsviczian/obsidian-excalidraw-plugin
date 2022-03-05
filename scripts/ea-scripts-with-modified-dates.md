<%*
/*
```javascript
*/

const executeRequest = async(url) => JSON.parse(await request({url}));

fileList = await executeRequest(
  "https://api.github.com/repos/zsviczian/obsidian-excalidraw-plugin/contents/ea-scripts"
);
if(!fileList || fileList.length === 0) return;

const msgHead = "https://api.github.com/repos/zsviczian/obsidian-excalidraw-plugin/commits?path=ea-scripts%2F";
const msgTail = "&page=1&per_page=1";
const filesWithDates = [];
for(f of fileList.filter((f)=>f.type==="file")) {
  const fname = f.name;
  const data = await executeRequest(
    msgHead + encodeURI(fname) + msgTail
  );
  if(!data || data.length===0 || !data[0].commit?.committer?.date)
    console.log("Commit missing: " + fname);
  else {
    const mtime = new Date(data[0].commit.committer.date) / 1;
    filesWithDates.push({fname, mtime});
  }
};
const jsonData = JSON.stringify(filesWithDates);

const dirFileName = "directory-info.json";
let file = app.vault.getAbstractFileByPath(dirFileName);
if(!file)
  app.vault.create(dirFileName,jsonData);
else 
  app.vault.modify(file,jsonData);
%>