const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
const handlers = source.slice(source.indexOf('        function handleOnlineBattleMessage('), source.indexOf('        function restoreOnlineBattleActionChoice('));
function harness(started = false) {
    const session = { started, seat: 'host', finished: false };
    const calls = { scenes: 0, sequences: 0, cleared: 0, waiting: 0 };
    const context = {
        onlineBattleSession: session, pendingBattleOptions: null, selectedBattleAction: null,
        battleMessageEl: { style: {} },
        document: { getElementById: () => ({ classList: { remove() {} } }) },
        normalizeAwardRank: value => value || null,
        startBattle: (force, data) => { calls.scenes++; calls.sceneOptions = data; },
        showOnlinePeerWaiting: () => { calls.waiting++; },
        setOnlineBattleAbortVisible() {},
        recordConfirmedOnlineResult: () => true,
        onlineBattleStatus() {},
        clearPersistedOnlineBattleSession: () => { calls.cleared++; },
        runOnlineBattleSequence: () => { calls.sequences++; }
    };
    vm.createContext(context); vm.runInContext(handlers, context);
    return { context, session, calls };
}
const room = { phase: 'finished', host: { connected: false, selected: true }, guest: { connected: false, form: 'adult_1', wins: 2 } };
test('completed-room recovery initializes the battle scene when both sockets were disconnected', () => {
    const h = harness();
    h.context.handleOnlineBattleMessage({ data: JSON.stringify({ type: 'result', room, result: { hostWon: true } }) });
    assert.equal(h.calls.scenes, 1); assert.equal(h.calls.sequences, 1); assert.equal(h.calls.waiting, 0);
    assert.equal(h.calls.sceneOptions.resultReplay, true);
    assert.equal(h.session.started, true); assert.equal(h.session.finished, true);
});
test('duplicate result delivery never applies a second battle/reward sequence', () => {
    const h = harness(true);
    const event = { data: JSON.stringify({ type: 'result', room, result: { hostWon: true } }) };
    h.context.handleOnlineBattleMessage(event); h.context.handleOnlineBattleMessage(event);
    assert.equal(h.calls.sequences, 1); assert.equal(h.calls.cleared, 1);
});
test('ordinary battle setup still waits for the second player', () => {
    const h = harness();
    h.context.startOnlineBattle({ ...room, phase: 'choosing' });
    assert.equal(h.calls.waiting, 1); assert.equal(h.calls.scenes, 0); assert.equal(h.session.started, false);
});

function connectionHarness() {
    const sockets = [], timers = [], messages = [];
    class Socket {
        static OPEN = 1; static CONNECTING = 0;
        constructor() { this.readyState = Socket.CONNECTING; this.events = {}; sockets.push(this); }
        addEventListener(name, callback) { this.events[name] = callback; }
        send() {} close() { this.readyState = 3; }
    }
    const session = { code: '1234', token: 'token', expiresAt: Date.now() + 120000, socket: null };
    const context = { onlineBattleSession: session, ONLINE_BATTLE_API_URL: 'https://test.invalid',
        WebSocket: Socket, Date, setTimeout(callback) { timers.push(callback); },
        onlineBattleStatus() {}, showOnlinePeerWaiting() {},
        handleOnlineBattleMessage: message => messages.push(message) };
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('        function connectOnlineBattleSocket('), source.indexOf('        function showOnlinePeerWaiting(')), context);
    return { context, sockets, timers, messages, session };
}
test('transport open without authentication cannot reset the four retry limit', () => {
    const h = connectionHarness(); h.context.connectOnlineBattleSocket();
    for (let attempt = 0; attempt < 5; attempt++) {
        const socket = h.sockets.at(-1); socket.readyState = 1; socket.events.open();
        socket.readyState = 3; socket.events.close();
        if (h.timers.length) h.timers.shift()();
    }
    assert.equal(h.session.reconnectAttempts, 5);
    assert.equal(h.sockets.length, 5); assert.equal(h.timers.length, 0);
});
test('messages from replaced sockets cannot mutate the active session', () => {
    const h = connectionHarness(); h.context.connectOnlineBattleSocket();
    const old = h.sockets[0]; old.readyState = 3; h.session.socket = null;
    h.context.connectOnlineBattleSocket();
    old.events.message({ data: 'stale' }); h.sockets[1].events.message({ data: 'fresh' });
    assert.deepEqual(h.messages, [{ data: 'fresh' }]);
});
test('reopening the online menu reconnects an existing disconnected session', () => {
    const h = connectionHarness(); h.session.reconnectAttempts = 5;
    Object.assign(h.context, { playButtonSound() {},
        document: { getElementById: () => ({ style: {} }) } });
    vm.runInContext(source.slice(source.indexOf('        function openOnlineBattleMenu('), source.indexOf('        function closeOnlineBattleMenu(')), h.context);
    h.context.openOnlineBattleMenu();
    assert.equal(h.sockets.length, 1); assert.equal(h.session.reconnectAttempts, 0);
});

function battleSceneHarness() {
    const element = () => ({ style: {}, classList: { add() {}, remove() {} } });
    const timers = [];
    const audio = { started: 0, stopped: 0, fights: 0 };
    const context = {
        closePvpMenu() {}, hidePostMatchStampPanel() {}, setOnlineBattleAbortVisible() {},
        postMatchAutoCloseTimer: null, selectedBattleAction: null, pendingBattleOptions: null,
        battleBgList: ['background'], document: { getElementById: element },
        battleArenaEl: element(), battleOverlayEl: element(), battleVsScreenEl: element(),
        battleFlashEl: element(), battleMessageEl: element(), myCharEl: element(), enemyCharEl: element(),
        battleWins: 0, getStoredActiveAwardRank: () => null, applyAwardVisual() {},
        myHpBarEl: element(), enemyHpBarEl: element(), currentForm: 'egg',
        myCanvasCtx: { canvas: {} }, enemyCanvasCtx: { canvas: {} }, renderCanvasArt() {},
        initAudio() {}, audioCtx: null, playOscillator() {},
        clearTimeout() {}, clearInterval() {}, onlineBattleSession: null,
        startBattleBgm: () => audio.started++, stopBattleBgm: () => audio.stopped++,
        playFightSound: () => audio.fights++,
        setTimeout: callback => timers.push(callback),
    };
    vm.createContext(context);
    const from = source.indexOf('        function startBattle(');
    const to = source.indexOf('        function chooseBattleAction(', from);
    assert.ok(to > from);
    vm.runInContext(source.slice(from, to), context);
    vm.runInContext(source.slice(source.indexOf('        function closeBattleOverlay('), source.indexOf('        function abandonOnlineBattleFromArena(')), context);
    return { context, timers, audio };
}
test('recovered battle scene schedules no VS intro that can overwrite its result', () => {
    const { context, timers } = battleSceneHarness();
    context.startBattle(false, { f: 'adult_1', w: 0, resultReplay: true });
    assert.equal(timers.length, 0);
    assert.equal(context.battleArenaEl.style.display, 'block');
    assert.equal(context.battleVsScreenEl.style.display, 'none');
    assert.equal(context.pendingBattleOptions, null);
});
test('closing the VS screen stops audio and prevents delayed BGM from starting', () => {
    const h = battleSceneHarness();
    h.context.startBattle(false, { f: 'adult_1', w: 0 });
    const oldIntro = h.timers[0];
    h.context.closeBattleOverlay();
    const stopsAtClose = h.audio.stopped;
    oldIntro(); // Even a callback already queued before clearTimeout is harmless.
    assert.equal(h.audio.started, 0); assert.equal(h.audio.fights, 0);
    assert.ok(stopsAtClose > 0); assert.equal(h.context.battleOverlayEl.kotodamaBattleScene, null);
});
test('closing an active arena stops its BGM immediately', () => {
    const h = battleSceneHarness();
    h.context.startBattle(false, { f: 'adult_1', w: 0 }); h.timers[0]();
    assert.equal(h.audio.started, 1);
    const stopsBefore = h.audio.stopped;
    h.context.closeBattleOverlay();
    assert.equal(h.audio.stopped, stopsBefore + 1);
});
test('old intro and command timers cannot overwrite an immediately opened next battle', () => {
    const h = battleSceneHarness();
    h.context.startBattle(false, { f: 'adult_1', w: 0 });
    const firstIntro = h.timers[0]; firstIntro(); const firstCommand = h.timers[1];
    h.context.closeBattleOverlay();
    h.context.startBattle(false, { f: 'adult_2', w: 0 });
    h.context.battleMessageEl.textContent = 'next battle';
    const startsBefore = h.audio.started; firstIntro(); firstCommand();
    assert.equal(h.audio.started, startsBefore);
    assert.equal(h.context.battleMessageEl.textContent, 'next battle');
    assert.equal(h.context.battleArenaEl.style.display, 'none');
});
test('a late message for an abandoned session cannot start a battle', () => {
    const h = harness();
    h.context.handleOnlineBattleMessage({ data: JSON.stringify({ type: 'result', room, result: {} }) }, { seat: 'guest' });
    assert.equal(h.calls.scenes, 0); assert.equal(h.calls.sequences, 0);
});

function receiptHarness(entries = new Map()) {
    const h = harness(true);
    const storage = { failPrimary: false, failBackup: false };
    Object.assign(h.context, {
        currentStage: 0, currentForm: 'egg', wordCounts: {}, cycleWordCounts: {},
        totalCount: 10, ultimateAttemptCount: 0, intokuPower: 3,
        battleWins: 4, battleLosses: 2, processedOnlineMatchIds: [],
        isSick: false, sickRecoveryCount: 0, lastInteractionTimestamp: Date.now(),
        finalEvolutionTimestamp: null, unlockedForms: ['egg'], unlockedItems: ['kept-item'],
        pendingUltimateEvolution: null, allWords: [], SICKNESS_DELAY_MS: 72 * 60 * 60 * 1000,
        window: { KotodamaStateMigrations: require('../state-migrations.js') },
        console: { error() {}, warn() {}, info() {} },
        localStorage: {
            getItem: key => entries.get(key) ?? null,
            setItem(key, value) {
                if ((key === 'kotodama_state' && storage.failPrimary)
                    || (key === 'kotodama_state_backup' && storage.failBackup)) throw new Error('storage full');
                entries.set(key, value);
            },
            removeItem: key => entries.delete(key),
        },
    });
    Object.assign(h.session, { code: '1234', token: 'existing-recovery-token' });
    vm.runInContext(source.slice(source.indexOf('        function saveState() {'), source.indexOf('        function getRebirthDeadline() {')), h.context);
    vm.runInContext(source.slice(source.indexOf('        function recordConfirmedOnlineResult('), source.indexOf('        function handleOnlineBattleMessage(')), h.context);
    return { ...h, entries, storage };
}
const confirmedResult = { hostWon: true, finishedAt: 1789700000000, maxHp: { host: 100, guest: 100 }, events: [] };
const resultEvent = () => ({ data: JSON.stringify({ type: 'result', room, result: confirmedResult }) });
test('confirmed win and receipt commit before animation or recovery-token deletion', () => {
    const h = receiptHarness(); const order = [];
    h.context.clearPersistedOnlineBattleSession = () => {
        const saved = JSON.parse(h.entries.get('kotodama_state'));
        assert.equal(saved.battleWins, 5); assert.equal(saved.processedOnlineMatchIds.length, 1);
        order.push('clear');
    };
    h.context.runOnlineBattleSequence = () => {
        assert.equal(JSON.parse(h.entries.get('kotodama_state')).battleWins, 5);
        order.push('animate');
    };
    h.context.handleOnlineBattleMessage(resultEvent());
    assert.deepEqual(order, ['clear', 'animate']);
    const reloaded = receiptHarness(h.entries); reloaded.context.loadState();
    assert.equal(reloaded.context.battleWins, 5); // The process can die before animation finishes.
    assert.deepEqual(Array.from(reloaded.context.unlockedItems), ['kept-item']);
});
test('crash after state commit but before token deletion cannot double-count a recovered result', () => {
    const h = receiptHarness();
    assert.equal(h.context.recordConfirmedOnlineResult(confirmedResult), true);
    const reloaded = receiptHarness(h.entries); reloaded.context.loadState();
    reloaded.context.handleOnlineBattleMessage(resultEvent());
    assert.equal(reloaded.context.battleWins, 5);
    assert.equal(reloaded.context.battleLosses, 2);
    assert.equal(reloaded.context.processedOnlineMatchIds.length, 1);
    assert.equal(reloaded.calls.sequences, 1);
});
test('failed primary commit rolls back counts and receipt without clearing the recovery session', () => {
    const h = receiptHarness(); h.context.saveState();
    const oldState = h.entries.get('kotodama_state'); h.storage.failPrimary = true;
    h.context.handleOnlineBattleMessage(resultEvent());
    assert.equal(h.context.battleWins, 4); assert.equal(h.context.processedOnlineMatchIds.length, 0);
    assert.equal(h.entries.get('kotodama_state'), oldState);
    assert.equal(h.entries.get('kotodama_state_backup'), oldState);
    assert.equal(h.session.finished, false); assert.equal(h.calls.cleared, 0); assert.equal(h.calls.sequences, 0);
    h.storage.failPrimary = false; h.context.handleOnlineBattleMessage(resultEvent());
    assert.equal(h.context.battleWins, 5); assert.equal(h.calls.sequences, 1);
});
test('backup failure does not roll back a successfully committed primary receipt', () => {
    const h = receiptHarness(); h.context.saveState(); h.storage.failBackup = true;
    assert.equal(h.context.recordConfirmedOnlineResult(confirmedResult), true);
    assert.equal(JSON.parse(h.entries.get('kotodama_state')).battleWins, 5);
    const reloaded = receiptHarness(h.entries); reloaded.context.loadState();
    assert.equal(reloaded.context.recordConfirmedOnlineResult(confirmedResult), true);
    assert.equal(reloaded.context.battleWins, 5);
});
test('legacy saves get an empty receipt list and preserve their existing records', () => {
    const h = receiptHarness(); h.context.saveState();
    const old = JSON.parse(h.entries.get('kotodama_state')); delete old.processedOnlineMatchIds;
    h.entries.set('kotodama_state', JSON.stringify(old)); h.context.loadState();
    assert.equal(h.context.battleWins, 4); assert.equal(h.context.battleLosses, 2);
    assert.equal(h.context.processedOnlineMatchIds.length, 0);
    h.session.seat = 'guest'; h.context.recordConfirmedOnlineResult(confirmedResult);
    assert.equal(h.context.battleWins, 4); assert.equal(h.context.battleLosses, 3);
});
test('receipt history is bounded and malformed results cannot alter records', () => {
    const h = receiptHarness();
    h.context.processedOnlineMatchIds = Array.from({ length: 256 }, (_, i) => 'room:1111:' + i);
    assert.equal(h.context.recordConfirmedOnlineResult({ hostWon: true }), false);
    assert.equal(h.context.recordConfirmedOnlineResult({ hostWon: 'true', finishedAt: 100 }), false);
    assert.equal(h.context.battleWins, 4);
    assert.equal(h.context.recordConfirmedOnlineResult(confirmedResult), true);
    assert.equal(h.context.processedOnlineMatchIds.length, 256);
    assert.equal(h.context.recordConfirmedOnlineResult(confirmedResult), true);
    assert.equal(h.context.battleWins, 5);
});
