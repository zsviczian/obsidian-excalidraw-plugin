/** Exercise production chooser and creation boundaries without changing the public EA/CLI contracts. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function methods(file,names){const tree=ts.createSourceFile(file,readFileSync(new URL('../../'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true),result=[];const visit=node=>{if(ts.isMethodDeclaration(node)&&names.includes(node.name.getText(tree)))result.push(node.getText(tree));ts.forEachChild(node,visit);};visit(tree);return result.join('\n');}
function chooser(){let opened;class Modal {constructor(){opened=this;}setPlaceholder(){}open(){}onClose(){}selectSuggestion(value){this.onClose();this.onChooseItem(value.item);}}
  const module={exports:{}};vm.runInNewContext(compile(readFileSync(new URL('../../src/shared/Dialogs/TemplatePrompt.ts',import.meta.url),'utf8')),{module,exports:module.exports,require:name=>name==='obsidian'?{FuzzySuggestModal:Modal}:{t:key=>key}});return {...module.exports,get opened(){return opened;}};}
test('zero/single templates keep automatic behavior; a chooser has blank first and unique path labels',async()=>{
  const c=chooser(),files=[{path:'Templates/Alpha/Same.md'},{path:'Templates/Beta/Same.md'}];
  assert.equal((await c.selectDrawingTemplate(null,{})).kind,'blank');
  assert.equal((await c.selectDrawingTemplate([files[0]],{})).file,files[0]);
  const pending=c.selectDrawingTemplate(files,{},'Templates'),items=c.opened.getItems();
  assert.equal(items[0].kind,'blank');assert.notEqual(c.opened.getItemText(items[1]),c.opened.getItemText(items[2]));
  assert.equal(c.opened.getItemText(items[1]),'Alpha/Same.md');
  c.opened.selectSuggestion({item:items[2]},{});assert.equal((await pending).file,files[1]);
});
test('explicit blank and close/dismissal produce different results without rejection',async()=>{
  const c=chooser();let pending=c.selectDrawingTemplate([{},{}],{});c.opened.selectSuggestion({item:c.opened.getItems()[0]},{});assert.equal((await pending).kind,'blank');
  pending=c.selectDrawingTemplate([{},{}],{});c.opened.onClose();assert.equal((await pending).kind,'cancel');
});
test('creation resolves drawing contents before making its destination directory',async()=>{
  const calls=[],module={exports:{}};
  class File {}
  vm.runInNewContext(compile(`export class Manager {${methods('src/core/managers/FileManager.ts',['createDrawing'])}}`),{module,exports:module.exports,TFile:File,normalizePath:s=>s,checkAndCreateFolder:async()=>{calls.push('folder');},getNewUniqueFilepath:()=> 'new/file.md',errorlog(){}});
  const m=new module.exports.Manager();m.settings={folder:'new'};m.app={vault:{create:async()=>new File()}};m.isExcalidrawFile=()=>true;
  m.plugin={getBlankDrawing:async()=>{assert.equal(calls.length,0,'folder created before chooser');calls.push('content');return 'drawing';}};
  await m.createDrawing('file.md');assert.equal(calls.join(','),'content,folder');
});
test('interactive cancellation never creates a file or opens a leaf; explicit initialization bypasses the chooser',async()=>{
  const module={exports:{}};vm.runInNewContext(compile(`export class Plugin {${methods('src/core/main.ts',['createAndOpenDrawing'])}}`),{module,exports:module.exports});
  const p=new module.exports.Plugin();let created=0,opened=0,prepared=0;
  p.fileManager={prepareDrawing:async()=>{prepared++;return {kind:'cancel'};},openDrawing:()=>opened++};p.createDrawing=async()=>{created++;return {path:'drawing.md'};};
  assert.equal(await p.createAndOpenDrawing('file.md','new-tab'), '');assert.equal(created,0);assert.equal(opened,0);
  assert.equal(await p.createAndOpenDrawing('file.md','new-tab',undefined,'explicit-data'),'drawing.md');assert.equal(prepared,1);assert.equal(created,1);assert.equal(opened,1);
});
test('public blank data keeps template/theme/compatibility/compression behavior and its string contract',async()=>{
  let selection={kind:'cancel'};const module={exports:{}};
  vm.runInNewContext(compile(`export class Manager {${methods('src/core/managers/FileManager.ts',['prepareDrawing','getBlankDrawing','getDrawingContent'])}}`),{
    module,exports:module.exports,selectDrawingTemplate:async()=>selection,getListOfTemplateFiles:()=>[],normalizePath:s=>s,
    isObsidianThemeDark:()=>true,changeThemeOfExcalidrawMD:data=>'dark:'+data,
    BLANK_DRAWING:'light-json',DARK_BLANK_DRAWING:'dark-json',FRONTMATTER:'frontmatter',getMarkdownDrawingSection:(data,compress)=>`section:${data}:${compress}`,
  });
  const m=new module.exports.Manager();m.plugin={};m.app={vault:{read:async()=> 'template-data'}};
  for(const compatibilityMode of [false,true])for(const matchTheme of [false,true])for(const compress of [false,true]){
    m.settings={compatibilityMode,matchTheme,compress};selection={kind:'cancel'};
    assert.equal((await m.prepareDrawing()).kind,'cancel');
    const blank=await m.getBlankDrawing();assert.equal(typeof blank,'string');assert.ok(blank.includes(matchTheme?'dark-json':'light-json'));
    if(!compatibilityMode)assert.ok(blank.endsWith(':'+compress));
    selection={kind:'template',file:{extension:compatibilityMode?'excalidraw':'md'}};
    assert.equal((await m.prepareDrawing()).data,matchTheme?'dark:template-data':'template-data');
    selection={kind:'blank'};assert.equal((await m.prepareDrawing()).data,blank);
  }
});
