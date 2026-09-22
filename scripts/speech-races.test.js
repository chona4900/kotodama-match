const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const lifecycle = source.slice(source.indexOf('        async function toggleMic()'), source.indexOf('        // --- UI用 ---'));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
async function settle() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
function harness(platform = 'android') {
    const listeners = {}, timers = new Map(), classes = new Set();
    let timerId = 0, starts = 0, tutorialStarts = 0;
    const plugin = {
        async removeAllListeners() {}, async addListener(name, cb) { listeners[name] = cb; },
        async checkPermissions() { return { microphone: 'granted', speechRecognition: 'granted' }; },
        async available() { return { available: true }; },
        async isListening() { return { listening: false }; },
        async start() { starts++; }, async stop() {},
    };
    const context = vm.createContext({
        window: { Capacitor: { getPlatform: () => platform, Plugins: { SpeechRecognition: plugin } } },
        document: { visibilityState: 'visible' }, useNativeSpeech: true, webRecognition: null,
        isListening: false, isStartingMic: false, currentStage: 0,
        micBtnEl: { classList: { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)) } },
        statusTextEl: { textContent: '' }, playButtonSound() {}, alert() {},
        updateNoonRitualMicButton() {}, onMicrophoneStartedForTutorial() { tutorialStarts++; }, initAudio() {},
        selectBestSpeechTranscript: values => values[0], processTranscript() { context.resultCount++; }, resultCount: 0,
        setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); }, console: { warn() {}, error() {} },
    });
    vm.runInContext(lifecycle + '\nthis.requested = () => nativeListeningRequested;', context);
    return { context, plugin, listeners, timers, classes, starts: () => starts, tutorialStarts: () => tutorialStarts };
}

test('a pre-start resume query cannot clear a newly enabled Android microphone', async () => {
    const h = harness();
    const delayedStatus = deferred();
    h.plugin.isListening = () => delayedStatus.promise;
    const check = h.context.syncNativeSpeechState();
    await h.context.startMic();
    delayedStatus.resolve({ listening: false });
    await check;
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, true);
});

test('resume during a pending native start cannot cancel listening intent', async () => {
    const h = harness(), pendingStart = deferred();
    h.plugin.start = () => pendingStart.promise;
    const start = h.context.startMic();
    await settle();
    await h.context.syncNativeSpeechState();
    pendingStart.resolve();
    await start;
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, true);
});

test('a late failed old start cannot cancel a subsequent start', async () => {
    const h = harness(), old = deferred();
    let calls = 0;
    h.plugin.start = () => ++calls === 1 ? old.promise : Promise.resolve();
    const first = h.context.startMic().catch(() => {});
    await settle();
    const stop = h.context.stopMic();
    const next = h.context.startMic();
    old.reject(new Error('old start failed'));
    await Promise.all([first, stop, next]);
    assert.equal(calls, 2);
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, true);
});

test('stopping during permission resolution prevents a delayed microphone start', async () => {
    const h = harness(), permission = deferred();
    h.plugin.checkPermissions = () => permission.promise;
    const toggle = h.context.toggleMic();
    await settle();
    await h.context.stopMic();
    permission.resolve({ microphone: 'granted', speechRecognition: 'granted' });
    await toggle;
    assert.equal(h.starts(), 0);
    assert.equal(h.context.requested(), false);
});

test('a native started event invalidates an older stopped status query', async () => {
    const h = harness(), status = deferred();
    await h.context.startMic();
    h.plugin.isListening = () => status.promise;
    const check = h.context.syncNativeSpeechState();
    h.listeners.listeningState({ status: 'started' });
    status.resolve({ listening: false });
    await check;
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, true);
});

test('audio-session guard stays active while native speech is recovering', async () => {
    const h = harness('ios');
    await h.context.startMic();
    h.listeners.listeningState({ status: 'stopped' });
    assert.equal(h.context.isListening, false);
    assert.equal(h.context.window.isKotodamaSpeechListening(), true);
});

test('native startup resolving after an immediate recoverable stop does not show active MIC', async () => {
    const h = harness('ios');
    h.plugin.start = async () => {
        h.listeners.listeningState({ status: 'started' });
        h.listeners.listeningState({ status: 'stopped' });
    };
    await h.context.startMic();
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, false);
    assert.equal(h.classes.has('mic-active'), false);
});

test('native started event before promise resolution still advances the microphone tutorial', async () => {
    const h = harness('ios');
    h.plugin.start = async () => h.listeners.listeningState({ status: 'started', sessionId: 1 });
    await h.context.startMic();
    assert.equal(h.tutorialStarts(), 1);
    assert.equal(h.context.isListening, true);
});

test('old bridge stop, error and transcript events cannot overwrite a newer native session', async () => {
    const h = harness(); let sessionId = 0;
    h.plugin.start = async () => h.listeners.listeningState({ status: 'started', sessionId: ++sessionId });
    await h.context.startMic(); await h.context.stopMic(); await h.context.startMic();
    h.listeners.partialResults({ matches: ['ありがとう'], sessionId: 1, isFinal: true });
    h.listeners.listeningState({ status: 'stopped', sessionId: 1 });
    h.listeners.recognitionError({ code: 9, willRetry: false, sessionId: 1 });
    assert.equal(h.context.resultCount, 0);
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, true);
});

test('retired transcripts are ignored while an old stop blocks the next native start', async () => {
    const h = harness(), stop = deferred(); let sessionId = 0;
    h.plugin.start = async () => h.listeners.listeningState({ status: 'started', sessionId: ++sessionId });
    await h.context.startMic();
    h.plugin.stop = () => stop.promise;
    const stopping = h.context.stopMic(), next = h.context.startMic();
    await settle();
    h.listeners.partialResults({ matches: ['ありがとう'], sessionId: 1, isFinal: true });
    const receivedBeforeStart = h.context.resultCount;
    stop.resolve(); await Promise.all([stopping, next]);
    h.listeners.partialResults({ matches: ['ありがとう'], sessionId: 2, isFinal: true });
    assert.equal(receivedBeforeStart, 0);
    assert.equal(h.context.resultCount, 1);
});

test('newer native auto-recovery sessions are accepted without another MIC tap', async () => {
    const h = harness();
    h.plugin.start = async () => h.listeners.listeningState({ status: 'started', sessionId: 5 });
    await h.context.startMic();
    h.listeners.partialResults({ matches: ['ありがとう'], sessionId: 5, isFinal: true });
    h.listeners.listeningState({ status: 'recovering', sessionId: 6 });
    h.listeners.listeningState({ status: 'started', sessionId: 7 });
    h.listeners.partialResults({ matches: ['ありがとう'], sessionId: 7, isFinal: true });
    assert.equal(h.context.resultCount, 2);
    assert.equal(h.context.requested(), true);
});

test('recording device errors are not incorrectly presented as denied permissions', () => {
    const h = harness();
    assert.doesNotMatch(h.context.getNativeSpeechErrorMessage({ code: 3 }), /設定で「マイク」をオン/);
    assert.match(h.context.getNativeSpeechErrorMessage({ code: 9 }), /設定で「マイク」をオン/);
});

test('a failed explicit start releases retained native listening intent', async () => {
    const h = harness('ios'); let stops = 0;
    h.plugin.start = async () => { throw new Error('audio device unavailable'); };
    h.plugin.stop = async () => { stops++; };
    await assert.rejects(h.context.startMic(), /audio device unavailable/);
    assert.equal(stops, 1);
    assert.equal(h.context.requested(), false);
});

test('exhausted startup retries explicitly stop the native recovery session', async () => {
    const h = harness('ios'); let stops = 0;
    await h.context.startMic();
    h.plugin.stop = async () => { stops++; };
    h.plugin.start = async () => { throw new Error('audio device unavailable'); };
    h.listeners.listeningState({ status: 'stopped' });
    for (let i = 0; i < 4; i++) {
        const entry = h.timers.entries().next().value;
        assert.ok(entry, 'expected a bounded recovery attempt');
        h.timers.delete(entry[0]);
        await entry[1]();
    }
    assert.equal(stops, 1);
    assert.equal(h.timers.size, 0);
    assert.equal(h.context.requested(), false);
    assert.match(h.context.statusTextEl.textContent, /MICを押してもう一度/);
});

test('an iOS interruption in the utterance gap cancels retries until interruption ends', async () => {
    const h = harness('ios');
    await h.context.startMic();
    h.listeners.listeningState({ status: 'stopped' });
    assert.equal(h.timers.size, 1);
    h.listeners.listeningState({ status: 'recovering', interrupted: true });
    assert.equal(h.timers.size, 0);
    assert.equal(h.context.requested(), true);
    h.listeners.listeningState({ status: 'stopped', reason: 'interruption-ended' });
    assert.equal(h.timers.size, 1);
});

test('an in-flight iOS retry rejected by a long call preserves intent without spending retries', async () => {
    const h = harness('ios'), pending = deferred();
    await h.context.startMic();
    h.plugin.start = () => pending.promise;
    h.listeners.listeningState({ status: 'stopped' });
    const entry = h.timers.entries().next().value;
    h.timers.delete(entry[0]);
    const retry = entry[1](); await settle();
    h.listeners.listeningState({ status: 'recovering', interrupted: true });
    pending.reject(new Error('Audio session is interrupted'));
    await retry;
    assert.equal(h.timers.size, 0);
    assert.equal(h.context.requested(), true);
    assert.equal(h.context.isListening, true);
});

test('MIC off during an iOS call cannot be undone by interruption ending later', async () => {
    const h = harness('ios');
    await h.context.startMic();
    h.listeners.listeningState({ status: 'recovering', interrupted: true });
    await h.context.stopMic();
    h.listeners.listeningState({ status: 'stopped', reason: 'interruption-ended' });
    assert.equal(h.timers.size, 0);
    assert.equal(h.context.requested(), false);
    assert.equal(h.context.isListening, false);
});
