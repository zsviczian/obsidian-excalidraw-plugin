/** Real fullscreen manager against nested workspace DOM fixtures; native layout is checked separately. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(depth=0,header=true) {
  const doc={};
  class Element {
    constructor(classes='',parent=null){this.classes=new Set(classes.split(' ').filter(Boolean));this.parentElement=parent;this.children=[];this.ownerDocument=doc;this.style={};parent?.children.push(this);}
    hasClass(c){return this.classes.has(c);}
    addClass(c){this.classes.add(c);}
    removeClass(c){this.classes.delete(c);}
    matches(selector){
      const simple=(el,s)=>!!el&&[...s.matchAll(/:not\(\.([\w-]+)\)/g)].every(m=>!el.hasClass(m[1]))&&[...s.replace(/:not\([^)]*\)/g,'').matchAll(/\.([\w-]+)/g)].every(m=>el.hasClass(m[1]));
      return selector.split(',').some(s=>{
        const parts=s.trim().split(/\s+/);let node=this;
        if(!simple(node,parts.pop()))return false;
        while(parts.length){const part=parts.pop();if(part==='>'){node=node.parentElement;if(!simple(node,parts.pop()))return false;}else{node=node.parentElement;while(node&&!simple(node,part))node=node.parentElement;if(!node)return false;}}
        return true;
      });
    }
    querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
    querySelector(s){return this.querySelectorAll(s)[0]??null;}
  }
  doc.body=new Element();doc.querySelectorAll=s=>doc.body.querySelectorAll(s);
  const root=new Element('workspace-split mod-root',doc.body),siblings=[];
  let parent=root;
  for(let i=0;i<depth;i++){siblings.push(new Element('workspace-tabs',parent));parent=new Element('workspace-split',parent);}
  const tabs=new Element('workspace-tabs',parent);siblings.push(new Element('workspace-tabs',parent));
  new Element('workspace-tab-header-container',tabs);
  const container=new Element('workspace-tab-container',tabs),leaf=new Element('workspace-leaf',container);
  siblings.push(new Element('workspace-leaf',container));
  const view=new Element('workspace-leaf-content',leaf);if(header)new Element('view-header',view);
  const content=new Element('view-content',view);content.style.marginTop='7px';
  const unrelated=new Element('excalidraw-hidden',doc.body);
  const host={ownerDocument:doc,contentEl:content,excalidrawWrapperRef:{current:{}},toolsPanelRef:{current:{setFullscreen(){}}},plugin:{leafChangeTimeout:null,clearLeafChangeTimeout(){}}};
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/view/managers/ViewFullscreenManager.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,window:{clearTimeout(){}},require(name){
    if(name.includes('styleUtils'))return {setStyle:(el,styles)=>Object.assign(el.style,styles)};
    if(name.includes('typechecks'))return {isInstanceOfHTMLElement:el=>el instanceof Element};
    throw Error(name);
  }});
  return {manager:new module.exports.ViewFullscreenManager(host),host,root,siblings,unrelated,Element};
}

for(const depth of [0,1,2,3])test(`fullscreen preserves the complete ancestor path at split depth ${depth}`,()=>{
  const f=fixture(depth);f.manager.gotoFullscreen();
  for(let node=f.host.contentEl;node;node=node.parentElement)assert.equal(node.hasClass('excalidraw-hidden'),false,'target ancestor hidden');
  assert.ok(f.siblings.every(el=>el.hasClass('excalidraw-hidden')),'surrounding panes hidden');
  f.manager.exitFullscreen();assert.ok(f.siblings.every(el=>!el.hasClass('excalidraw-hidden')));
});
test('fullscreen restores only its own classes and leaves existing inline styles intact',()=>{
  const f=fixture(2);f.root.addClass('excalidraw-visible');
  f.manager.gotoFullscreen();f.manager.gotoFullscreen();f.manager.exitFullscreen();f.manager.exitFullscreen();
  assert.ok(f.unrelated.hasClass('excalidraw-hidden'));
  assert.ok(f.root.hasClass('excalidraw-visible'));
  assert.equal(f.host.contentEl.style.marginTop,'7px');
});
test('missing optional controls and another window are safe',()=>{
  const f=fixture(2,false),other=fixture(1);f.manager.gotoFullscreen();
  assert.equal(other.manager.isFullscreen(),false);other.manager.exitFullscreen();
  assert.equal(f.manager.isFullscreen(),true);f.manager.exitFullscreen();
});
test('another drawing takes over fullscreen without leaking classes; migration cleanup uses the entry document',()=>{
  const f=fixture(2),otherWindow=fixture();
  const secondContent=new f.Element('view-content',f.siblings[0]);
  const second=new f.manager.constructor({...f.host,contentEl:secondContent});
  f.manager.gotoFullscreen();second.gotoFullscreen();
  assert.equal(f.manager.isFullscreen(),false);assert.equal(second.isFullscreen(),true);
  assert.equal(secondContent.hasClass('excalidraw-hidden'),false);
  second.exitFullscreen();
  f.manager.gotoFullscreen();f.host.ownerDocument=otherWindow.host.ownerDocument;
  f.manager.exitFullscreen();assert.ok(f.siblings.every(el=>!el.hasClass('excalidraw-hidden')));
});
