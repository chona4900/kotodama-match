import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSendPostMatchStamp,
  createSafeDisplayName,
  getKotodamaCupNumber,
  getJstDayKey,
  getSeasonWindow,
  isSeasonReadyToFinalize,
  isAllowedStamp,
  rankLeaderboardEntries,
  sanitizePlayerDisplayName,
  shouldCountDailyWin
} from '../src/ranking-rules.mjs';

test('JST月曜00:00で週と日付を切り替える', () => {
  const before = getSeasonWindow('2026-08-23T14:59:59.999Z');
  const after = getSeasonWindow('2026-08-23T15:00:00.000Z');

  assert.equal(before.seasonKey, '2026-08-17');
  assert.equal(after.seasonKey, '2026-08-24');
  assert.equal(after.startsAt, '2026-08-23T15:00:00.000Z');
  assert.equal(after.endsAt, '2026-08-30T15:00:00.000Z');
  assert.equal(getJstDayKey('2026-08-23T14:59:59.999Z'), '2026-08-23');
  assert.equal(getJstDayKey('2026-08-23T15:00:00.000Z'), '2026-08-24');
});

test('コトダマ杯は公開開始週を第1回として毎週回数を増やす', () => {
  assert.equal(getKotodamaCupNumber('2026-08-24'), 1);
  assert.equal(getKotodamaCupNumber('2026-08-31'), 2);
  assert.equal(getKotodamaCupNumber('2026-08-17'), null);
  assert.equal(getKotodamaCupNumber('invalid'), null);
});

test('前週の表彰はルーム再試行猶予15分を過ぎてから確定する', () => {
  assert.equal(isSeasonReadyToFinalize('2026-08-17', '2026-08-23T15:14:59.999Z'), false);
  assert.equal(isSeasonReadyToFinalize('2026-08-17', '2026-08-23T15:15:00.000Z'), true);
  assert.equal(isSeasonReadyToFinalize('invalid', '2026-08-23T15:15:00.000Z'), false);
});

test('同じ勝者と敗者の勝利はJSTの1日3回まで数える', () => {
  assert.equal(shouldCountDailyWin(0), true);
  assert.equal(shouldCountDailyWin(1), true);
  assert.equal(shouldCountDailyWin(2), true);
  assert.equal(shouldCountDailyWin(3), false);
  assert.equal(shouldCountDailyWin(4), false);
});

test('勝利数、ご縁、到達時刻、playerIdの順で順位が安定する', () => {
  const ranked = rankLeaderboardEntries([
    { playerId: 'c', wins: 4, connections: 3, achievedAt: 30 },
    { playerId: 'b', wins: 5, connections: 1, achievedAt: 20 },
    { playerId: 'a', wins: 5, connections: 2, achievedAt: 30 },
    { playerId: 'd', wins: 5, connections: 2, achievedAt: 10 },
    { playerId: 'e', wins: 5, connections: 2, achievedAt: 10 }
  ]);

  assert.deepEqual(ranked.map(({ playerId, rank }) => [playerId, rank]), [
    ['d', 1], ['e', 2], ['a', 3], ['b', 4], ['c', 5]
  ]);
});

test('表示名はサーバー管理の安全な語だけから作る', () => {
  const name = createSafeDisplayName(new Uint8Array([4, 1, 0x12, 0x34]));
  assert.match(name, /^(あおぞら|おひさま|きらきら|そよかぜ|にじいろ|ほしぞら|まんまる|わくわく)の.+っち・\d{3}$/);
});

test('ユーザーが設定する表示名は安全な16文字以内の表記だけを受け付ける', () => {
  assert.equal(sanitizePlayerDisplayName('  ことだま 太郎  '), 'ことだま 太郎');
  assert.equal(sanitizePlayerDisplayName('コトダマっち・1'), 'コトダマっち・1');
  assert.equal(sanitizePlayerDisplayName(''), null);
  assert.equal(sanitizePlayerDisplayName('abcdefghijklmnopq'), null);
  assert.equal(sanitizePlayerDisplayName('name@example.com'), null);
});

test('対戦後スタンプは固定3種だけを許可する', () => {
  assert.equal(isAllowedStamp('thanks'), true);
  assert.equal(isAllowedStamp('nice'), true);
  assert.equal(isAllowedStamp('again'), true);
  assert.equal(isAllowedStamp('free text'), false);
  assert.equal(canSendPostMatchStamp({ phase: 'finished', existingStamp: null, stamp: 'thanks' }), true);
  assert.equal(canSendPostMatchStamp({ phase: 'choosing', existingStamp: null, stamp: 'thanks' }), false);
  assert.equal(canSendPostMatchStamp({ phase: 'finished', existingStamp: 'nice', stamp: 'thanks' }), false);
});
