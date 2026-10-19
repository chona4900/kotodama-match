const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Set GAMEPLAY_SOURCE_ROOT to replay these same cases against the shipped source.
const root = process.env.GAMEPLAY_SOURCE_ROOT || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const migrations = require(path.join(root, 'state-migrations.js'));
const progression = require(path.join(root, 'progression.js'));
const between = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `source section: ${start}`);
  return source.slice(from, to);
};

function harness(initial = {}) {
  const entries = new Map();
  const timers = new Map();
  const issuedTimers = [];
  let nextTimer = 1;
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      const listeners = new Map();
      elements.set(id, {
        offsetWidth: 320, classes, listeners,
        classList: { add: (...names) => names.forEach(n => classes.add(n)),
          remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n) },
        addEventListener: (name, fn) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name).add(fn);
        },
        removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
      });
    }
    return elements.get(id);
  };
  const noop = () => {};
  const context = vm.createContext({
    window: { KotodamaStateMigrations: migrations, KotodamaProgression: progression },
    localStorage: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) },
    console, Date, currentStage: 0, currentForm: 'egg', totalCount: 1000,
    wordCounts: { ありがとう: 1000, 愛してます: 0, 自分はすごいんだ: 12 },
    cycleWordCounts: { ありがとう: 1000, 愛してます: 0, 自分はすごいんだ: 0 },
    allWords: ['ありがとう', '愛してます', '自分はすごいんだ'], KOKORO_GO_HAN_WORDS: ['ありがとう', '愛してます'], OYATSU_WORDS: ['自分はすごいんだ'],
    WORD_GROUPS: { A: { words: ['ありがとう', '愛してます'] }, B: { words: [] }, C: { words: [] } },
    STAGE1_GOAL: 1000, STAGE2_GOAL: 2000, STAGE3_GOAL: 3000,
    REBIRTH_STAGE3_DELAY_MS: 3 * 86400000, REBIRTH_STAGE4_DELAY_MS: 4 * 86400000,
    SICKNESS_DELAY_MS: 72 * 3600000, SICKNESS_RECOVERY_GOAL: 10,
    isEvolutionInProgress: false, evolutionGeneration: 0, cancelActiveEvolutionEffect: null,
    rebirthGeneration: 0, rebirthTimer: null,
    ultimateAttemptCount: 0, pendingUltimateEvolution: null,
    intokuPower: 7, battleWins: 10, battleLosses: 2, processedOnlineMatchIds: ['retained'],
    isSick: false, sickRecoveryCount: 0, lastInteractionTimestamp: Date.now(), finalEvolutionTimestamp: null,
    unlockedForms: ['egg'], unlockedItems: ['yata_no_kagami'],
    charNames: { childA_1_1: '天照大御神っち' }, statusTextEl: { textContent: '' },
    canvas: element('pixelCanvas'), ctx: {}, overlayState: 0,
    document: { getElementById: element }, onlineRoomRequestInFlight: false, onlineBattleSession: null,
    confirm: () => true, alert: noop, playButtonSound: noop, playEvolutionSound: noop,
    playUltimateEvolutionSound: noop, playRebirthSound: noop, renderCanvasArt: noop,
    updateUI: noop, updateRebirthCountdown: noop, closeOverlays: noop,
    handleTutorialWordRecognized: noop, createWordEffect: noop, animateProgressGain: noop,
    showCelebration: noop, updateStatsList: noop, updateOyatsuList: noop,
    setTimeout(fn, delay) { const id = nextTimer++; const timer = { id, fn, delay }; timers.set(id, timer); issuedTimers.push(timer); return id; },
    clearTimeout: id => timers.delete(id),
    ...initial,
  });
  vm.runInContext([
    between('function saveState()', 'function updateRebirthCountdown()'),
    between('function checkRebirth(', '// --- 描画ロジック ---'),
    between('function createEvolutionEffect(', 'function createWordEffect('),
    between('function addWordLog(', '// --- 割合表示と図鑑画面 ---'),
    between('function resetGame()', 'async function deleteKotodamaCupData()'),
    'function getNextUltimateEvolutionGoal() { return window.KotodamaProgression.getUltimateAttemptGoal(ultimateAttemptCount); }',
  ].join('\n'), context);
  return {
    context, entries, timers, issuedTimers, element,
    saved: () => JSON.parse(entries.get('kotodama_state')),
    finish(name = 'evolutionPulsate') {
      const overlay = element('evolutionOverlay');
      [...(overlay.listeners.get('animationend') || [])].forEach(fn => fn({ target: overlay, animationName: name }));
    },
  };
}

for (const [targetStage, previousForm, count] of [[1, 'egg', 1000], [2, 'childA', 2000], [3, 'childA_1', 3000]]) {
  test(`stage ${targetStage}: speech during animation saves a coherent previous form and resumes after reload`, () => {
    const h = harness({ currentStage: targetStage - 1, currentForm: previousForm, totalCount: count });
    h.context.evolve(targetStage);
    h.context.addWordLog('ありがとう', 1);
    const saved = h.saved();
    assert.equal(saved.currentStage, targetStage - 1);
    assert.equal(saved.currentForm, previousForm);
    assert.equal(saved.totalCount, count + 1);
    const reloaded = harness();
    reloaded.entries.set('kotodama_state', JSON.stringify(saved));
    reloaded.context.loadState();
    reloaded.context.continueProgressionAfterEvolution();
    reloaded.finish();
    assert.equal(reloaded.context.currentStage, targetStage);
    assert.notEqual(reloaded.context.currentForm, previousForm);
    assert.equal(reloaded.context.totalCount, count + 1);
  });
}

test('a failed ultimate attempt interrupted by speech/reload stays retryable, not MAX', () => {
  const h = harness({ currentStage: 3, currentForm: 'childA_1_1', totalCount: 4900, ultimateAttemptCount: 1, finalEvolutionTimestamp: Date.now() });
  h.context.evolve(4, { forcedUltimateSuccess: false });
  h.context.addWordLog('ありがとう', 1);
  const saved = h.saved();
  assert.equal(saved.currentStage, 3);
  assert.equal(saved.currentForm, 'childA_1_1');
  assert.equal(saved.pendingUltimateEvolution, null);
  assert.equal(saved.ultimateAttemptCount, 1);
  const reloaded = harness();
  reloaded.entries.set('kotodama_state', JSON.stringify(saved));
  reloaded.context.loadState();
  assert.equal(reloaded.context.resolvePendingUltimateEvolution(), false);
  assert.equal(progression.isUltimateAttemptDue(reloaded.context.currentStage, 5800, reloaded.context.ultimateAttemptCount), true);
});

test('a saved ultimate win survives reload and retains its longer lifetime during animation', () => {
  const outcome = { isSuccess: true, form: 'ultimate_1', name: '八大龍王っち' };
  const h = harness({ currentStage: 3, currentForm: 'childA_1_1', totalCount: 4900, pendingUltimateEvolution: outcome, finalEvolutionTimestamp: Date.now() - 3 * 86400000 - 1000 });
  h.context.evolve(4, { ultimateOutcome: outcome });
  h.context.addWordLog('ありがとう', 1);
  assert.equal(h.context.currentForm, 'childA_1_1');
  const saved = h.saved();
  const reloaded = harness();
  reloaded.entries.set('kotodama_state', JSON.stringify(saved));
  reloaded.context.loadState();
  assert.equal(reloaded.context.resolvePendingUltimateEvolution(), true);
  reloaded.context.checkRebirth({ announce: false });
  assert.equal(reloaded.context.currentStage, 4);
  assert.equal(reloaded.context.currentForm, 'ultimate_1');
  assert.equal(reloaded.context.totalCount, 4901);
  h.finish('ultimatePulsateReduced');
  assert.equal(h.context.currentStage, 4);
  assert.equal(h.context.currentForm, 'ultimate_1');
  assert.equal(h.saved().pendingUltimateEvolution, null);
  assert.equal(h.element('evolutionOverlay').classes.has('flashing-ultimate'), false);
});

test('B reset cancels the old effect, so a queued fallback cannot overwrite a newer evolution', () => {
  const h = harness();
  h.context.evolve(1);
  const staleFallback = h.issuedTimers.find(timer => timer.delay === 6500).fn;
  h.context.resetGame();
  assert.equal(h.context.currentStage, 0);
  assert.equal(h.context.currentForm, 'egg');
  assert.equal(h.element('evolutionOverlay').classes.has('flashing'), false);
  assert.equal(h.timers.size, 0);
  h.context.totalCount = 1000;
  h.context.cycleWordCounts.ありがとう = 1000;
  h.context.evolve(1);
  staleFallback();
  assert.equal(h.context.currentForm, 'egg');
  assert.equal(h.context.isEvolutionInProgress, true);
  assert.equal(h.element('evolutionOverlay').classes.has('flashing'), true);
  h.finish('evolutionPulsateReduced');
  assert.equal(h.context.currentStage, 1);
  assert.equal(h.context.currentForm, 'childA');
  assert.equal(h.element('evolutionOverlay').classes.has('flashing'), false);
});

test('reset cancels a pending ultimate form switch but retains its earned collection entry', () => {
  const outcome = { isSuccess: true, form: 'ultimate_1', name: '八大龍王っち' };
  const h = harness({ currentStage: 3, currentForm: 'childA_1_1', totalCount: 4900, pendingUltimateEvolution: outcome });
  h.context.evolve(4, { ultimateOutcome: outcome });
  h.context.resetGame();
  assert.equal(h.saved().pendingUltimateEvolution, null);
  assert.equal(h.context.resolvePendingUltimateEvolution(), false);
  assert.equal(h.context.currentForm, 'egg');
  assert.equal(h.saved().unlockedForms.filter(form => form === outcome.form).length, 1);
  assert.equal(h.saved().intokuPower, 7);
  assert.equal(h.saved().battleWins, 10);
  assert.deepEqual(h.saved().unlockedItems, ['yata_no_kagami']);
  assert.equal(h.saved().wordCounts.自分はすごいんだ, 12);
});

test('an ultimate win unlocks its collection entry when awarded, before animation completes', () => {
  const outcome = { isSuccess: true, form: 'ultimate_2', name: '天之御中主神っち' };
  const h = harness({ currentStage: 3, currentForm: 'childA_1_1', totalCount: 4900 });
  h.context.rollUltimateEvolutionOutcome = () => outcome;
  h.context.maybeStartUltimateEvolution();
  assert.equal(h.saved().unlockedForms.filter(form => form === outcome.form).length, 1);
  assert.equal(h.saved().pendingUltimateEvolution.form, outcome.form);
  assert.equal(h.saved().currentStage, 3);
  assert.equal(h.context.isEvolutionInProgress, true);
  h.finish('ultimatePulsate');
  assert.equal(h.saved().unlockedForms.filter(form => form === outcome.form).length, 1);
});

for (const announce of [false, true]) {
  test(`an expired legacy pending ultimate keeps its collection entry on ${announce ? 'animated' : 'silent'} reincarnation, matching cold load`, () => {
    const outcome = { isSuccess: true, form: 'ultimate_3', name: 'バステトっち' };
    const h = harness({ currentStage: 3, currentForm: 'childA_1_1', unlockedForms: ['egg', 'childA_1_1'], totalCount: 4900, pendingUltimateEvolution: outcome, finalEvolutionTimestamp: Date.now() - 4 * 86400000 - 1000 });
    h.context.saveState();
    const legacySave = h.entries.get('kotodama_state');
    h.context.evolve(4, { ultimateOutcome: outcome });
    if (announce) h.context.checkRebirth();
    h.context.addWordLog('ありがとう', 1);
    assert.equal(h.context.currentForm, 'egg');
    assert.equal(h.context.totalCount, 1);
    assert.equal(h.saved().pendingUltimateEvolution, null);
    assert.equal(h.saved().unlockedForms.filter(form => form === outcome.form).length, 1);
    const reloaded = harness();
    reloaded.entries.set('kotodama_state', legacySave);
    reloaded.context.loadState();
    reloaded.context.resolvePendingUltimateEvolution();
    reloaded.context.checkRebirth({ announce: false });
    reloaded.context.addWordLog('ありがとう', 1);
    assert.deepEqual(h.saved().unlockedForms, reloaded.saved().unlockedForms);
    assert.equal(reloaded.context.currentForm, 'egg');
    assert.equal(reloaded.context.totalCount, 1);
  });
}

for (const action of ['speech', 'reset']) {
  test(`a delayed reincarnation cannot erase new-egg progress after ${action}`, () => {
    const h = harness({ currentStage: 3, currentForm: 'childA_1_1', totalCount: 4000, finalEvolutionTimestamp: Date.now() - 4 * 86400000 });
    h.context.checkRebirth();
    const staleRebirth = h.issuedTimers.find(timer => timer.delay === 3000).fn;
    if (action === 'reset') h.context.resetGame();
    h.context.addWordLog('ありがとう', 2);
    assert.equal(h.context.currentForm, 'egg');
    assert.equal(h.context.totalCount, 2);
    staleRebirth();
    assert.equal(h.context.totalCount, 2);
    assert.equal(h.saved().totalCount, 2);
    assert.equal(h.element('rebirthOverlay').classes.has('active'), false);
  });
}

test('normal reincarnation still waits for its dark frame and cancels an older evolution', () => {
  const h = harness({ currentStage: 3, currentForm: 'childA_1_1', totalCount: 4900, finalEvolutionTimestamp: Date.now() - 4 * 86400000 });
  h.context.evolve(4, { forcedUltimateSuccess: false });
  const oldEffect = h.issuedTimers.find(timer => timer.delay === 9500).fn;
  h.context.reincarnate();
  assert.equal(h.context.currentForm, 'childA_1_1');
  const rebirth = h.issuedTimers.find(timer => timer.delay === 3000);
  rebirth.fn();
  oldEffect();
  assert.equal(h.context.currentStage, 0);
  assert.equal(h.context.currentForm, 'egg');
  assert.equal(h.context.isEvolutionInProgress, false);
});

for (const [stage, form, expected] of [[1, 'egg', 0], [2, 'childA', 1], [3, 'childB_2', 2], [4, 'childC_2_4', 3]]) {
  test(`existing interrupted-save repair preserves data: ${stage}/${form} -> ${expected}/${form}`, () => {
    const original = { saveDataVersion: 3, currentStage: stage, currentForm: form, totalCount: 6000, ultimateAttemptCount: 2, wordCounts: { ありがとう: 6000 }, cycleWordCounts: { ありがとう: 6000 }, unlockedForms: ['egg', form], pendingUltimateEvolution: { isSuccess: true, form: 'ultimate_2' }, battleWins: 8, finalEvolutionTimestamp: 123 };
    const result = migrations.migrateSavedState(original, ['ありがとう']);
    assert.equal(result.state.currentStage, expected);
    assert.equal(result.didChange, true);
    const { currentStage: ignoredOriginal, ...oldRest } = original;
    const { currentStage: ignoredNew, ...newRest } = result.state;
    assert.deepEqual(newRest, oldRest);
  });
}

test('valid, unknown, and ambiguous forms are not rewritten by interrupted-save repair', () => {
  for (const [stage, form] of [[3, 'childA_1_1'], [4, 'ultimate_2'], [2, 'future_form'], [0, 'childA'], [3, 'childA']]) {
    const state = { saveDataVersion: 3, currentStage: stage, currentForm: form, totalCount: 3000, ultimateAttemptCount: 0, cycleWordCounts: {} };
    const result = migrations.migrateSavedState(state, []);
    assert.deepEqual(result.state, state);
    assert.equal(result.didChange, false);
  }
});
