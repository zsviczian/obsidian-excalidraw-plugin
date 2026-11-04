/** Resolve one Git repository's persistent native-test owner across isolated source worktrees.
 * Source/seed/build provenance remains worktree-local; only the existing marker-owned vault is
 * shared. No caller-supplied vault path, redirected metadata or unrelated repository is accepted. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,join,relative,resolve,isAbsolute,sep} from 'node:path';
import {ownedPath} from './contracts.mjs';

/** Read Git's own canonical metadata location without a shell or mutation. */
function metadataPath(root,args){
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
  assert.ok(!result.error&&result.status===0,'Cannot verify native worktree ownership: '+(result.error?.message||result.stderr));
  return realpathSync(result.stdout.trim());
}

/** Ordinary repositories and synthetic fixtures own their local vault. A linked worktree may
 * share only its primary checkout's vault, after both common metadata and the reverse worktree
 * pointer agree. Existing canonical path/marker guards continue to validate that destination. */
export function nativeRepositoryRoot(projectRoot){
  const root=resolve(projectRoot),dotGit=join(root,'.git');
  if(!existsSync(dotGit)||lstatSync(dotGit).isDirectory())return root;
  ownedPath(root,'.git');
  assert.ok(lstatSync(dotGit).isFile(),'Native source metadata must be a regular Git worktree file');
  const common=metadataPath(root,['rev-parse','--path-format=absolute','--git-common-dir']);
  const gitDir=metadataPath(root,['rev-parse','--absolute-git-dir']);
  const primary=dirname(common),worktrees=join(common,'worktrees'),entry=relative(worktrees,gitDir);
  assert.ok(entry&&entry!=='..'&&!entry.startsWith('..'+sep)&&!isAbsolute(entry),'Native source is not a linked repository worktree');
  assert.equal(common,realpathSync(join(primary,'.git')),'Native common metadata must belong to its primary repository');
  ownedPath(primary,'.git/config');
  const backPointer=readFileSync(ownedPath(common,'worktrees/'+entry.split(sep).join('/')+'/gitdir'),'utf8').trim();
  assert.equal(realpathSync(resolve(gitDir,backPointer)),realpathSync(dotGit),'Native worktree reverse ownership differs');
  return primary;
}
