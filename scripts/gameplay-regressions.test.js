const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const speechPluginSource = fs.readFileSync(
  path.join(root, 'plugins/kotodama-speech-recognition/ios/Sources/KotodamaSpeechRecognitionPlugin/SpeechRecognitionPlugin.swift'),
  'utf8',
);
const appDelegateSource = fs.readFileSync(path.join(root, 'ios/App/App/AppDelegate.swift'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = mainSource.indexOf(startMarker);
  const end = mainSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return mainSource.slice(start, end);
}

test('CPU battles do not update the persistent win/loss record', () => {
  const finishBattleSource = sourceBetween(
    'function finishBattle(isWin, recordOnlineResult = false)',
    'function setupBattleMessage(isWin)',
  );
  const classList = { add() {}, remove() {} };
  let saveCount = 0;
  const context = vm.createContext({
    battleWins: 4,
    battleLosses: 2,
    stopBattleBgm() {},
    document: { getElementById: () => ({ classList }) },
    pendingBattleOptions: null,
    setupBattleMessage() {},
    myCharEl: { classList, className: '' },
    enemyCharEl: { classList, className: '' },
    playCelebrateSound() {},
    initAudio() {},
    audioCtx: null,
    playOscillator() {},
    saveState() { saveCount += 1; },
    updateUI() {},
    setTimeout() {},
    battleOverlayEl: { classList },
    selectedBattleAction: null,
    myCanvasCtx: { canvas: {} },
    enemyCanvasCtx: { canvas: {} },
    clearInterval() {},
  });

  vm.runInContext(`${finishBattleSource}\nthis.finishBattle = finishBattle;`, context);

  context.finishBattle(true);
  assert.equal(context.battleWins, 4);
  assert.equal(context.battleLosses, 2);
  assert.equal(saveCount, 0);

  context.finishBattle(false);
  assert.equal(context.battleWins, 4);
  assert.equal(context.battleLosses, 2);
  assert.equal(saveCount, 0);

  context.finishBattle(true, true);
  assert.equal(context.battleWins, 5);
  assert.equal(context.battleLosses, 2);
  assert.equal(saveCount, 1);
});

test('the online battle result path explicitly enables record keeping', () => {
  assert.match(mainSource, /finishBattle\(didWin, true\)/);
  assert.match(mainSource, /finishBattle\(myHpRatio >= enemyHpRatio\)/);
});

test('soul snack phrases can be recognized in consecutive utterances', () => {
  const speechSource = sourceBetween(
    'let lastWordMatchTime = {};',
    'async function toggleMic()',
  );
  let now = 1_000;
  const additions = [];
  const context = vm.createContext({
    allWords: ['自分はすごいんだ'],
    WORD_ALIASES: {},
    Date: { now: () => now },
    addWordLog(word, amount) { additions.push({ word, amount }); },
    currentStage: 0,
    statusTextEl: { textContent: '' },
  });

  vm.runInContext(`${speechSource}\nthis.processTranscript = processTranscript;`, context);
  const interimCounts = {};

  context.processTranscript('自分はすごいんだ', false, interimCounts);
  assert.deepEqual(additions, [{ word: '自分はすごいんだ', amount: 1 }]);

  // The same interim transcript must not be counted twice by recognition jitter.
  now += 200;
  context.processTranscript('自分はすごいんだ', false, interimCounts);
  assert.equal(additions.length, 1);

  // Native recognition may shorten/reset its transcript between utterances.
  context.processTranscript('', false, interimCounts);
  now += 700;
  context.processTranscript('自分はすごいんだ', false, interimCounts);
  assert.deepEqual(additions, [
    { word: '自分はすごいんだ', amount: 1 },
    { word: '自分はすごいんだ', amount: 1 },
  ]);
});

test('the normal gratitude phrase does not match the bare word 感謝', () => {
  const aliasesSource = sourceBetween(
    'const WORD_ALIASES = {',
    'const OYATSU_WORDS = [',
  );
  const speechSource = sourceBetween(
    'let lastWordMatchTime = {};',
    'async function toggleMic()',
  );
  let now = 1_000;
  const additions = [];
  const context = vm.createContext({
    allWords: ['感謝してます'],
    Date: { now: () => now },
    addWordLog(word, amount) { additions.push({ word, amount }); },
    currentStage: 0,
    statusTextEl: { textContent: '' },
  });

  vm.runInContext(
    `${aliasesSource}\n${speechSource}\nthis.processTranscript = processTranscript;`,
    context,
  );

  context.processTranscript('感謝', true, {});
  assert.equal(additions.length, 0);

  now += 700;
  context.processTranscript('感謝しています', true, {});
  assert.deepEqual(additions, [{ word: '感謝してます', amount: 1 }]);
});

test('word feedback is louder than the deliberately reduced battle BGM', () => {
  assert.match(mainSource, /const BATTLE_BGM_VOLUME = 0\.08/);
  assert.match(mainSource, /playOscillator\(659\.25, now \+ 0\.08, 0\.24, 0\.40, 'sine'\)/);
  assert.match(mainSource, /playOscillator\(783\.99, now \+ 0\.16, 0\.28, 0\.42, 'sine'\)/);
});

test('iOS audio output can recover after mute, interruption, or app resume', () => {
  assert.match(dataSource, /function refreshNativeAudioSession\(\)/);
  assert.match(dataSource, /document\.addEventListener\('touchstart', recoverAudioOutput/);
  assert.match(dataSource, /document\.addEventListener\('click', recoverAudioOutput\)/);
  assert.match(dataSource, /visibilitychange/);
  assert.doesNotMatch(dataSource, /touchstart', unlockAudio, \{ once: true \}/);

  assert.match(speechPluginSource, /CAPPluginMethod\(name: "refreshAudioSession"/);
  assert.match(speechPluginSource, /try configurePlaybackSession\(AVAudioSession\.sharedInstance\(\)\)/);
  assert.match(speechPluginSource, /try configureRecordingSession\(session\)/);
  assert.match(appDelegateSource, /func applicationDidBecomeActive/);
  assert.match(appDelegateSource, /activatePlaybackAudioSession\(\)/);
});
