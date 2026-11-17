import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {sourceHarness} from './sourceHarness.mjs';
const graph=sourceHarness({
  obsidian:{TFile:class{},MarkdownView:class{},Menu:class{},FileView:class{}},
  '../../utils/fileUtils':{getLink:()=>''},
  '../../utils/obsidianUtils':{editorInsertText(){},getExcalidrawViews:()=>[],getParentOfClass:()=>null,isUnwantedLeaf:()=>false,setExcalidrawView(){}},
  'src/shared/ExcalidrawAutomate':{ExcalidrawAutomate:class{}},
  'src/constants/constants':{FRONTMATTER_KEYS:{},ICON_NAME:'',VIEW_TYPE_EXCALIDRAW:'excalidraw'},
  'src/view/ExcalidrawView':{default:class{}},
  'src/lang/helpers':{t:key=>key},
  'src/utils/excalidrawViewUtils':{getChangedTopLevelDependencyFileIDs:()=>[],setMobileNavbarPosition(){}},
  'src/utils/styleUtils':{setStyle(){}},
});
after(()=>graph.close());
const {EventManager}=await graph.importModule('src/core/managers/EventManager.ts');
test('click and file-menu saving ignore a retired editor before reading its persistence state',()=>{
  const plugin={app:{},activeExcalidrawView:{excalidrawAPI:null,isDirty(){throw Error('Retired persistence owner');},save(){throw Error('Retired save');}}};
  const manager=new EventManager(plugin);
  assert.doesNotThrow(()=>manager.onClickSaveActiveDrawing({target:{className:'markdown'}}));
  assert.doesNotThrow(()=>manager.onFileMenuSaveActiveDrawing());
});
test('click and file-menu saving retain the live dirty editor behavior',()=>{
  let saves=0;const view={excalidrawAPI:{},isDirty:()=>true,save(){saves++;}};
  const manager=new EventManager({app:{},activeExcalidrawView:view});
  manager.onClickSaveActiveDrawing({target:{className:'markdown'}});
  manager.onFileMenuSaveActiveDrawing();assert.equal(saves,2);
  manager.onClickSaveActiveDrawing({target:{className:'excalidraw__canvas'}});assert.equal(saves,2);
  view.isDirty=()=>false;manager.onFileMenuSaveActiveDrawing();assert.equal(saves,2);
});
