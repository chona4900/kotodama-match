import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSnapshot, simulateBattle } from '../src/battle-engine.mjs';

const snapshot = { form: 'adult_1', hp: 100, attack: 10, evasionRate: 5, criticalRate: 5, wins: 0 };

test('sanitizeSnapshot rejects values beyond battle limits', () => {
  assert.throws(() => sanitizeSnapshot({ ...snapshot, hp: 999999 }));
  assert.throws(() => sanitizeSnapshot({ ...snapshot, attack: 1.5 }));
});

test('same random source produces one deterministic shared result', () => {
  const values = [0.9, 0.8, 0.1, 0.2, 0.1, 0.4, 0.9, 0.6, 0.3, 0.2, 0.9, 0.4, 0.7, 0.8, 0.2, 0.1, 0.6, 0.5, 0.9, 0.2, 0.8, 0.6, 0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.4, 0.6, 0.7, 0.5];
  const randomA = () => values.shift() ?? 0.5;
  const result = simulateBattle({ host: snapshot, guest: { ...snapshot, form: 'adult_2' }, hostAction: 'attack', guestAction: 'guard', random: randomA });
  assert.ok(result.events.length > 0 && result.events.length <= 8);
  assert.equal(typeof result.hostWon, 'boolean');
  assert.equal(result.maxHp.guest, 140);
  assert.equal(result.maxHp.host, 100);
});
