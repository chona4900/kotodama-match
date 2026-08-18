const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

function calculateStats(score, currentForm = 'egg') {
  const start = mainSource.indexOf('function diminishingStatGrowth');
  const end = mainSource.indexOf('function getEnemyStats', start);
  assert.notEqual(start, -1, 'diminishingStatGrowth must exist');
  assert.notEqual(end, -1, 'getEnemyStats must follow getBattleStats');

  const context = {
    currentForm,
    wordCounts: {
      '愛してます': score / 2,
      'ゆるします': score / 2,
      'ありがとう': score / 2,
      '感謝してます': score / 2,
      '楽しい': score / 2,
      'うれしい': score / 2,
      'ツイてる': score / 2,
      'しあわせ': score / 2
    }
  };
  vm.createContext(context);
  vm.runInContext(`${mainSource.slice(start, end)}; this.getBattleStats = getBattleStats;`, context);
  return context.getBattleStats();
}

test('battle stats grow with diminishing returns', () => {
  const early = calculateStats(100);
  const experienced = calculateStats(1000);
  const veteran = calculateStats(5000);

  assert.ok(early.hp < experienced.hp && experienced.hp < veteran.hp);
  assert.ok(early.attack < experienced.attack && experienced.attack < veteran.attack);
  assert.ok(experienced.hp < 1000, '1000育成時点のHPが急増しすぎない');
  assert.ok(experienced.attack < 150, '1000育成時点の攻撃が急増しすぎない');
});

test('evasion and critical rates approach their cap gradually', () => {
  const experienced = calculateStats(1000);
  const veteran = calculateStats(5000);

  assert.ok(experienced.evasionRate < 25);
  assert.ok(experienced.criticalRate < 25);
  assert.ok(veteran.evasionRate > experienced.evasionRate && veteran.evasionRate < 45);
  assert.ok(veteran.criticalRate > experienced.criticalRate && veteran.criticalRate < 45);
});

test('ultimate evolution gives a useful but limited bonus', () => {
  const normal = calculateStats(1000);
  const ultimate = calculateStats(1000, 'ultimate_1');

  assert.ok(ultimate.hp > normal.hp && ultimate.hp <= normal.hp * 1.12);
  assert.ok(ultimate.attack > normal.attack && ultimate.attack <= normal.attack * 1.12);
  assert.ok(ultimate.evasionRate - normal.evasionRate <= 5);
  assert.ok(ultimate.criticalRate - normal.criticalRate <= 5);
});
