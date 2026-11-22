import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeCLIActions } from './nativeCLITransport.mjs';

test('native stdout timeout recovers only the exact settled receipt without replaying a write', () => {
  const calls = [], receipt = { command: 'export', requestId: 'original', session: 'session', status: 'completed', ok: true };
  const { action, recoveries } = createNativeCLIActions((command, flag) => {
    calls.push([command, flag]);
    if (command.endsWith(':export')) throw Error('spawnSync ETIMEDOUT');
    return JSON.stringify(receipt);
  });
  assert.deepEqual(action('export', { requestId: 'original' }), receipt);
  assert.equal(calls.length, 2); assert.equal(calls[1][0], 'obsidian-excalidraw-plugin:result');
  assert.equal(calls[1][1], 'requestId=original');
  assert.equal(recoveries.length, 1); assert.equal(recoveries[0].session, 'session');
});

test('pending, unknown and mismatched native receipts retain the original transport failure', () => {
  for (const receipt of [
    { command: 'export', requestId: 'original', status: 'pending' },
    { command: 'result', requestId: 'original', status: 'failed', error: { code: 'OUTCOME_UNKNOWN' } },
    { command: 'export', requestId: 'different', status: 'completed' },
  ]) {
    const failure = Error('spawnSync ETIMEDOUT'); let calls = 0;
    const { action, recoveries } = createNativeCLIActions(() => { if (++calls === 1) throw failure; return JSON.stringify(receipt); });
    assert.throws(() => action('export', { requestId: 'original' }), error => error === failure);
    assert.equal(calls, 2); assert.equal(recoveries.length, 0);
  }
});

test('native operation failures and unrelated transport errors are never converted into success', () => {
  const receipt = { command: 'script', requestId: 'original', status: 'failed', ok: false, error: { code: 'OUTCOME_UNKNOWN' } };
  let calls = 0;
  const { action } = createNativeCLIActions(() => { if (++calls === 1) throw Error('ETIMEDOUT'); return JSON.stringify(receipt); });
  assert.equal(action('script', { requestId: 'original' }).ok, false);
  const other = Error('permission denied');
  assert.throws(() => createNativeCLIActions(() => { throw other; }).action('export', { requestId: 'original' }), error => error === other);
});
