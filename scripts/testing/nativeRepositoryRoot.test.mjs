/** Worktree native targets retain the existing repository vault and all canonical path guards. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {nativeRepositoryRoot} from './nativeRepositoryRoot.mjs';
import {localVaultTarget,configureLocalVaultEnvironment} from './localVault.mjs';

/** Use real Git metadata so ownership is established by both ends of an actual linked worktree. */
function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'excalidraw-native-owner-')),primary=join(root,'primary'),worktree=join(root,'source');mkdirSync(primary);
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const git=(cwd,...args)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);};
  git(primary,'init');writeFileSync(join(primary,'fixture.txt'),'owned fixture');git(primary,'add','fixture.txt');
  git(primary,'-c','user.name=Native test','-c','user.email=native@example.invalid','commit','-m','fixture');
  git(primary,'worktree','add','--detach',worktree,'HEAD');return{root,primary,worktree,git};
}

test('linked source worktree shares only its verified primary repository native target',t=>{
  const f=fixture(t);assert.equal(nativeRepositoryRoot(f.worktree),f.primary);
  assert.deepEqual(localVaultTarget(f.worktree),localVaultTarget(f.primary));
  const env={};configureLocalVaultEnvironment(f.worktree,env);
  assert.equal(env.EXCALIDRAW_TEST_VAULT_PATH,join(f.primary,'.test-work/vaults/excalidraw-auto-test'));
  const wrong={...env,EXCALIDRAW_TEST_VAULT_PATH:join(f.root,'personal')};
  assert.throws(()=>configureLocalVaultEnvironment(f.worktree,wrong),/repository-local/);
});

test('another repository cannot substitute worktree metadata or redirect its ownership pointer',t=>{
  const f=fixture(t),other=join(f.root,'other');mkdirSync(other);
  writeFileSync(join(other,'.git'),readFileSync(join(f.worktree,'.git'),'utf8'));
  assert.throws(()=>nativeRepositoryRoot(other),/reverse ownership differs/);
});

test('a redirected source metadata file is rejected before target selection',t=>{
  const f=fixture(t),redirect=join(f.root,'redirect');mkdirSync(redirect);
  symlinkSync(f.worktree,join(redirect,'source'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>nativeRepositoryRoot(join(redirect,'source')),/Redirected/);
});

test('nonrepository synthetic fixtures retain the ordinary fixed target',t=>{
  const root=mkdtempSync(join(tmpdir(),'excalidraw-native-synthetic-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  assert.equal(nativeRepositoryRoot(root),resolve(root));
  assert.equal(localVaultTarget(root).vaultPath,join(root,'.test-work/vaults/excalidraw-auto-test'));
});
