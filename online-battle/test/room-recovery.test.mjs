import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, timingSafeEqual, webcrypto } from 'node:crypto';
import { ACTIONS, sanitizeSnapshot, simulateBattle } from '../src/battle-engine.mjs';
import { getClientRoomPhase, hasBothPlayersConnected } from '../src/room-readiness.mjs';
import { isAllowedStamp } from '../src/ranking-rules.mjs';

// Execute the actual room implementation. Only Cloudflare's host and storage
// transport are replaced; no hand-copied state machine is tested here.
const source = fs.readFileSync(new URL('../src/index.mjs', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '')
  .replace('export class BattleRoom', 'class BattleRoom')
  .split('export default {')[0];
const BattleRoom = vm.runInNewContext(`${source}\nBattleRoom`, {
  DurableObject: class { constructor(ctx, env) { this.ctx = ctx; this.env = env; } },
  ACTIONS, sanitizeSnapshot, simulateBattle, getClientRoomPhase, hasBothPlayersConnected, isAllowedStamp,
  crypto: {
    getRandomValues: array => webcrypto.getRandomValues(array),
    subtle: { digest: (...args) => webcrypto.subtle.digest(...args), timingSafeEqual }
  },
  TextEncoder, TextDecoder, URL, Response, Date, console: { error() {} }
});
const hash = value => createHash('sha256').update(value).digest('hex');
const snapshot = { form: 'adult_1', hp: 100, attack: 100, evasionRate: 5, criticalRate: 5, wins: 0 };
const result = { hostWon: true, maxHp: { host: 100, guest: 100 }, hp: { host: 90, guest: 0 }, events: [], finishedAt: Date.now() };
function roomState(phase = 'finished') {
  return { code: '1234', matchId: 'one-match', expiresAt: Date.now() + 120000, phase,
    host: { snapshot, tokenHash: hash('host-token'), action: 'attack', stamp: null },
    guest: { snapshot, tokenHash: hash('guest-token'), action: 'guard', stamp: null },
    result: structuredClone(result), ranking: null };
}
function socket(seat = null) {
  let attachment = { seat };
  return { messages: [], closed: false,
    serializeAttachment(value) { attachment = value; }, deserializeAttachment() { return attachment; },
    send(value) { this.messages.push(JSON.parse(value)); }, close() { this.closed = true; } };
}
function harness(initial = roomState()) {
  let stored = structuredClone(initial);
  const sockets = [];
  const storage = {
    alarmAt: null, async get() { return structuredClone(stored); },
    async put(key, value) { stored = structuredClone(value); },
    async setAlarm(at) { this.alarmAt = at; }, async deleteAll() { stored = undefined; }
  };
  const ctx = { storage, getWebSockets: () => sockets.filter(value => !value.closed) };
  return { room: new BattleRoom(ctx, {}), ctx, storage, sockets, stored: () => structuredClone(stored) };
}
test('authenticated reconnect replays a completed result without the opponent being online', async () => {
  const h = harness();
  const returning = socket(); h.sockets.push(returning);
  await h.room.webSocketMessage(returning, JSON.stringify({ type: 'auth', token: 'host-token' }));
  assert.deepEqual(returning.messages.map(message => message.type), ['room', 'result']);
  assert.deepEqual(returning.messages[1].result, result);
  assert.equal(returning.messages[1].room.guest.connected, false);
  assert.equal(returning.messages[0].seat, 'host');
});
test('unauthenticated sockets never receive a stored result', async () => {
  const h = harness(); const intruder = socket(); h.sockets.push(intruder);
  await h.room.webSocketMessage(intruder, JSON.stringify({ type: 'auth', token: 'wrong' }));
  assert.equal(intruder.closed, true);
  assert.equal(intruder.messages.some(message => message.type === 'result'), false);
});
test('alarm completes an interrupted finalization using the saved outcome and match ID', async () => {
  const initial = roomState('finalizing');
  const h = harness(initial); const host = socket('host'); h.sockets.push(host);
  const recorded = [];
  h.room.recordRoomRanking = async room => {
    recorded.push({ matchId: room.matchId, result: structuredClone(room.result) });
    return { eligible: true, counted: true, pending: false };
  };
  await h.room.alarm();
  assert.equal(h.stored().phase, 'finished');
  assert.deepEqual(recorded, [{ matchId: initial.matchId, result: initial.result }]);
  assert.equal(host.messages.filter(message => message.type === 'result').length, 1);
  assert.equal(h.storage.alarmAt, initial.expiresAt);
});
test('result and retry alarm are durable before D1; a late response preserves stamps and does not rebroadcast result', async () => {
  const initial = roomState('choosing'); initial.guest.action = null; initial.result = null;
  const h = harness(initial); const host = socket('host'); const guest = socket('guest');
  h.sockets.push(host, guest);
  let releaseOriginal, recordStarted;
  const started = new Promise(resolve => { recordStarted = resolve; });
  h.room.recordRoomRanking = () => { recordStarted(); return new Promise(resolve => { releaseOriginal = resolve; }); };
  const choosing = h.room.choose(guest, await h.room.load(), 'guest', 'guard');
  await started;
  const checkpoint = h.stored();
  assert.equal(checkpoint.phase, 'finalizing');
  assert.equal(checkpoint.ranking.pending, true);
  assert.ok(h.storage.alarmAt <= Date.now() + 30000 && h.storage.alarmAt < checkpoint.expiresAt);
  const recovered = new BattleRoom(h.ctx, {});
  recovered.recordRoomRanking = async () => ({ eligible: true, counted: true, pending: false });
  await recovered.alarm();
  const current = h.stored(); current.host.stamp = 'thanks'; await h.storage.put('room', current);
  releaseOriginal({ eligible: true, counted: true, pending: false }); await choosing;
  assert.deepEqual(h.stored().result, checkpoint.result);
  assert.equal(h.stored().host.stamp, 'thanks');
  assert.equal(host.messages.filter(message => message.type === 'result').length, 1);
});
test('failed ranking does not lose the battle result and later retry does not replay the battle', async () => {
  const h = harness(roomState('finalizing')); const host = socket('host'); h.sockets.push(host);
  h.room.recordRoomRanking = async () => { throw new Error('D1 unavailable'); };
  await h.room.alarm();
  assert.equal(h.stored().phase, 'finished'); assert.equal(h.stored().ranking.pending, true);
  h.room.recordRoomRanking = async () => ({ eligible: true, counted: true, pending: false });
  await h.room.alarm();
  assert.equal(h.stored().ranking.pending, false);
  assert.equal(host.messages.filter(message => message.type === 'result').length, 1);
});
test('late D1 response cannot recreate an expired or replacement room', async () => {
  const h = harness(roomState('finalizing'));
  let resolveRecord; const original = h.stored();
  h.room.recordRoomRanking = () => new Promise(resolve => { resolveRecord = resolve; });
  const pending = h.room.finalizeRoomRanking(original);
  const replacement = roomState('waiting'); replacement.matchId = 'new-match';
  await h.storage.put('room', replacement);
  resolveRecord({ eligible: true, counted: true, pending: false }); await pending;
  assert.equal(h.stored().matchId, 'new-match'); assert.equal(h.stored().phase, 'waiting');
});
