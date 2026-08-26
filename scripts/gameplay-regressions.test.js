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
  assert.match(mainSource, /finishBattle\(enemyHp <= 0\)/);
  assert.doesNotMatch(mainSource, /turnCount > maxTurns/);
});

test('コトダマ杯は明示同意なしに匿名プロフィールを送信しない', () => {
  const profileSource = sourceBetween(
    'function getOnlineProfileConsentDecision()',
    'function setKotodamaCupStatus(message)',
  );

  assert.match(profileSource, /if \(!hasOnlineProfileConsent\(\)\) \{/);
  assert.match(profileSource, /if \(!hasOnlineProfileConsent\(\)\) return null;/);
  assert.match(profileSource, /localStorage\.setItem\(ONLINE_PROFILE_CONSENT_STORAGE_KEY, 'accepted'\)/);
  assert.match(profileSource, /localStorage\.setItem\(ONLINE_PROFILE_CONSENT_STORAGE_KEY, 'declined'\)/);
});

test('本人のランキング履歴はBearer認証し、Bリセットで同意も撤回する', () => {
  const resetSource = sourceBetween(
    'async function deleteOnlineProfileForReset(',
    'function recoverFromSick()',
  );
  const rankingRequestSource = sourceBetween(
    'async function requestWeeklyKotodamaCup(profile)',
    'function openKotodamaCupMenu(',
  );

  assert.match(resetSource, /localStorage\.removeItem\(ONLINE_PROFILE_CONSENT_STORAGE_KEY\)/);
  assert.match(resetSource, /if \(!onlineDataDeleted\) \{/);
  assert.match(rankingRequestSource, /authorization: `Bearer \$\{profile\.playerToken\}`/);
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

test('soul snack total milestones choose from every sacred item, including 八咫烏', () => {
  const rewardSource = sourceBetween(
    'const OYATSU_REWARD_MILESTONE = 10000;',
    '// --- 24x24 拡張ピクセルアート定義',
  );
  const context = vm.createContext({
    WORD_GROUPS: { A: { words: [] }, B: { words: [] }, C: { words: [] } },
    OYATSU_WORDS: [
      'このことがダイヤモンドにかわります',
      'だんだんよくなる未来はあかるい',
    ],
    SECRET_ITEMS_DATA: [
      { id: 'yata_no_kagami' },
      { id: 'kusanagi_no_tsurugi' },
      { id: 'yasakani_no_magatama' },
      { id: 'houju' },
      { id: 'sankosho' },
      { id: 'kagurasuzu' },
      { id: 'yatagarasu' },
    ],
    unlockedItems: [],
  });

  vm.runInContext(
    `${rewardSource}\nthis.getTotalOyatsuCount = getTotalOyatsuCount; this.getRandomSoulSnackRewardItemId = getRandomSoulSnackRewardItemId; this.OYATSU_REWARD_MILESTONE = OYATSU_REWARD_MILESTONE;`,
    context,
  );

  assert.equal(context.OYATSU_REWARD_MILESTONE, 10000);
  assert.equal(context.getTotalOyatsuCount({
    'このことがダイヤモンドにかわります': 6300,
    'だんだんよくなる未来はあかるい': 3700,
  }), 10000);
  assert.equal(context.getRandomSoulSnackRewardItemId(() => 0.999), 'yatagarasu');
  assert.equal(
    context.getRandomSoulSnackRewardItemId(() => 0, [
      'yata_no_kagami', 'kusanagi_no_tsurugi', 'yasakani_no_magatama',
      'houju', 'sankosho', 'kagurasuzu',
    ]),
    'yatagarasu',
  );
  assert.doesNotMatch(mainSource, /const ITEM_MAPPING =/);
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
  assert.match(dataSource, /refreshNativeAudioSession\(\)\.then\(startPlayback, startPlayback\)/);
  assert.doesNotMatch(dataSource, /touchstart', unlockAudio, \{ once: true \}/);

  assert.match(speechPluginSource, /CAPPluginMethod\(name: "refreshAudioSession"/);
  assert.match(speechPluginSource, /try configurePlaybackSession\(session, resetOutput: true\)/);
  assert.match(speechPluginSource, /try session\.setActive\(false, options: \[\.notifyOthersOnDeactivation\]\)/);
  assert.match(speechPluginSource, /try configureRecordingSession\(session\)/);
  assert.match(appDelegateSource, /func applicationDidBecomeActive/);
  assert.match(appDelegateSource, /activatePlaybackAudioSession\(\)/);
});

test('転生しても累計の言霊回数を残し、今回の進化回数だけを戻す', () => {
  const reincarnationSource = sourceBetween(
    'function reincarnate({ announce = true } = {})',
    '// --- 描画ロジック ---',
  );
  const context = vm.createContext({
    currentStage: 3,
    currentForm: 'childA_1_1',
    totalCount: 4900,
    ultimateAttemptCount: 1,
    wordCounts: { ありがとう: 10000, 愛してます: 2400 },
    cycleWordCounts: { ありがとう: 4900, 愛してます: 0 },
    finalEvolutionTimestamp: 123,
    isSick: true,
    sickRecoveryCount: 4,
    document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
    saveState() {},
    renderCanvasArt() {},
    ctx: {},
    updateUI() {},
    statusTextEl: { textContent: '' },
    playRebirthSound() {},
    setTimeout() {},
  });

  vm.runInContext(`${reincarnationSource}\nthis.reincarnate = reincarnate;`, context);
  context.reincarnate({ announce: false });

  assert.equal(context.currentStage, 0);
  assert.equal(context.currentForm, 'egg');
  assert.equal(context.totalCount, 0);
  assert.equal(context.ultimateAttemptCount, 0);
  assert.deepEqual({ ...context.wordCounts }, { ありがとう: 10000, 愛してます: 2400 });
  assert.deepEqual({ ...context.cycleWordCounts }, { ありがとう: 0, 愛してます: 0 });
});

test('究極進化の失敗で回数を4800へ巻き戻さず、二重抽選もしない', () => {
  const addWordSource = sourceBetween(
    'function addWordLog(word, count=1)',
    '// --- 割合表示と図鑑画面 ---',
  );

  assert.doesNotMatch(mainSource, /totalCount\s*=\s*4800/);
  assert.doesNotMatch(addWordSource, /Math\.random\(\)\s*<\s*0\.05/);
  assert.match(mainSource, /何も起きなかった。次は/);
  assert.match(addWordSource, /cycleWordCounts\[word\] \+= count/);
  assert.match(addWordSource, /maybeStartUltimateEvolution\(\)/);
});

test('究極進化に失敗した結果文と次回目標が暗転後に残る', () => {
  const evolveSource = sourceBetween(
    'function evolve(targetStage, { forcedUltimateSuccess = null } = {})',
    'function maybeStartUltimateEvolution()',
  );
  let updateOptions;
  const context = vm.createContext({
    isEvolutionInProgress: false,
    currentStage: 3,
    currentForm: 'childA_1_1',
    totalCount: 4900,
    intokuPower: 0,
    statusTextEl: { textContent: '' },
    canvas: { classList: { add() {}, remove() {} } },
    charNames: { childA_1_1: '天照大御神っち' },
    createEvolutionEffect(callback) { callback(); },
    getNextUltimateEvolutionGoal: () => 9800,
    saveState() {},
    updateUI(options) { updateOptions = options; },
    setTimeout() {},
    checkRebirth() {},
  });

  vm.runInContext(`${evolveSource}\nthis.evolve = evolve;`, context);
  context.evolve(4, { forcedUltimateSuccess: false });

  assert.equal(context.totalCount, 4900);
  assert.equal(context.currentStage, 3);
  assert.equal(context.isEvolutionInProgress, false);
  assert.equal(context.statusTextEl.textContent, '……しかし、何も起きなかった。次は 9,800 回で再挑戦！');
  assert.deepEqual({ ...updateOptions }, { preserveStatus: true, checkEvolution: false });
});
