const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const data = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const audioSource = data.slice(0, data.indexOf('        // --- 設定・状態 ---'));
const bgmSource = main.slice(main.indexOf('        const bgmFileList = ['), main.indexOf('        function playFightSound()'));
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function deferred() {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return { promise, resolve };
}
function harness() {
    const tracks = [], contexts = [];
    let refreshes = 0;
    class FakeContext {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; contexts.push(this); }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        createBufferSource() { return { connect() {}, start() {} }; }
        createBuffer() { return {}; }
    }
    class FakeAudio {
        constructor(src) { this.src = src; this.paused = true; this.playCalls = 0; this.currentTime = 0; tracks.push(this); }
        play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
    }
    const plugin = { refreshAudioSession() { refreshes++; return Promise.resolve(); } };
    const context = vm.createContext({
        window: { AudioContext: FakeContext, Capacitor: { isNativePlatform: () => true, Plugins: { SpeechRecognition: plugin } }, addEventListener() {} },
        document: { hidden: false, addEventListener() {} }, Audio: FakeAudio, soundEnabled: true,
        console: { warn() {}, log() {} },
    });
    vm.runInContext(audioSource + '\n' + bgmSource + '\nthis.recover = recoverAudioOutput;', context);
    return { context, plugin, tracks, contexts, refreshes: () => refreshes };
}

test('a synchronous native audio bridge failure cannot break a game action', async () => {
    const h = harness(); let played = 0;
    h.plugin.refreshAudioSession = () => { throw new Error('bridge temporarily unavailable'); };
    assert.doesNotThrow(() => h.context.playWhenAudioReady(() => { played++; }));
    await settle();
    assert.equal(played, 1);
});

test('an effect waiting for native recovery does not play after sound is disabled', async () => {
    const h = harness(), refresh = deferred(); let played = 0;
    h.plugin.refreshAudioSession = () => refresh.promise;
    h.context.playWhenAudioReady(() => { played++; });
    h.context.soundEnabled = false;
    refresh.resolve(); await settle();
    assert.equal(played, 0);
});

test('audio recovery retries the existing interrupted battle BGM', async () => {
    const h = harness();
    h.context.startBattleBgm(); await settle();
    h.tracks[0].pause();
    h.context.recover({ force: true }); await settle();
    assert.equal(h.tracks.length, 1);
    assert.equal(h.tracks[0].paused, false);
    assert.equal(h.tracks[0].playCalls, 2);
});

test('duplicate battle start does not leave an untracked overlapping BGM', async () => {
    const h = harness();
    h.context.startBattleBgm(); h.context.startBattleBgm(); await settle();
    assert.equal(h.tracks.length, 1);
    assert.equal(h.tracks[0].playCalls, 1);
    h.context.stopBattleBgm();
    assert.equal(h.tracks[0].paused, true);
});

test('late audio recovery cannot revive the BGM after a battle is closed', async () => {
    const h = harness(), refresh = deferred();
    h.context.startBattleBgm(); await settle();
    h.plugin.refreshAudioSession = () => refresh.promise;
    h.tracks[0].pause(); h.context.recover({ force: true });
    h.context.stopBattleBgm();
    const playsAtStop = h.tracks[0].playCalls;
    refresh.resolve(); await settle();
    assert.equal(h.tracks[0].paused, true);
    assert.equal(h.tracks[0].playCalls, playsAtStop);
});

test('microphone start in the same turn prevents a queued audio session reset', async () => {
    const h = harness(); let listening = false;
    h.context.window.isKotodamaSpeechListening = () => listening;
    const refresh = h.context.refreshNativeAudioSession();
    listening = true;
    await refresh;
    assert.equal(h.refreshes(), 0);
});
