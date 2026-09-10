import assert from 'node:assert/strict';
import test from 'node:test';
import { getClientRoomPhase, hasBothPlayersConnected } from '../src/room-readiness.mjs';

const room = {
  phase: 'connecting',
  host: { snapshot: {} },
  guest: { snapshot: {} }
};

test('入室API完了だけでは対戦開始にせず、両端末の接続を待つ', () => {
  assert.equal(hasBothPlayersConnected(room, new Set(['host'])), false);
  assert.equal(getClientRoomPhase(room, new Set(['host'])), 'connecting');
  assert.equal(getClientRoomPhase(room, new Set(['guest'])), 'connecting');
});

test('両端末の接続が確認できた時だけ作戦選択へ進む', () => {
  const both = new Set(['host', 'guest']);
  assert.equal(hasBothPlayersConnected(room, both), true);
  assert.equal(getClientRoomPhase(room, both), 'choosing');
});

test('開始後に片方が切断した時も、1人だけの対戦へ戻さない', () => {
  const choosingRoom = { ...room, phase: 'choosing' };
  assert.equal(getClientRoomPhase(choosingRoom, new Set(['host'])), 'connecting');
  assert.equal(getClientRoomPhase(choosingRoom, new Set(['host', 'guest'])), 'choosing');
});

test('終了済みの結果表示は接続状態に左右されない', () => {
  assert.equal(getClientRoomPhase({ ...room, phase: 'finished' }, new Set()), 'finished');
});
