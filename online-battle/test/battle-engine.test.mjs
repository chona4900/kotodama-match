import assert from 'node:assert/strict';
import test from 'node:test';
import { balanceMatchup, sanitizeSnapshot, simulateBattle } from '../src/battle-engine.mjs';

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

test('large training gaps are compressed before actions are applied', () => {
  const weak = { ...snapshot };
  const strong = { ...snapshot, hp: 1500, attack: 220, evasionRate: 45, criticalRate: 45, wins: 200 };
  const balanced = balanceMatchup(weak, strong);

  assert.ok(balanced.guest.hp / balanced.host.hp <= 1.36);
  assert.ok(balanced.guest.attack / balanced.host.attack <= 1.36);
  assert.ok(balanced.guest.evasionRate - balanced.host.evasionRate <= 16);
  assert.ok(balanced.guest.criticalRate - balanced.host.criticalRate <= 16);
  assert.equal(balanced.host.wins, 0);
  assert.equal(balanced.guest.wins, 200);
});
