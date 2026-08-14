const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

function loadEvolutionEffect() {
  const start = mainSource.indexOf('function createEvolutionEffect');
  const end = mainSource.indexOf('function evolve', start);
  assert.notEqual(start, -1, 'createEvolutionEffect must exist');
  assert.notEqual(end, -1, 'evolve must follow createEvolutionEffect');

  const listeners = new Map();
  const classes = new Set();
  const timeouts = new Map();
  let nextTimerId = 1;

  const overlay = {
    offsetWidth: 320,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
    },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => {
      if (listeners.get(name) === handler) listeners.delete(name);
    },
  };

  const context = {
    document: { getElementById: () => overlay },
    playEvolutionSound: () => {},
    playUltimateEvolutionSound: () => {},
    setTimeout: (handler, delay) => {
      const id = nextTimerId++;
      timeouts.set(id, { handler, delay });
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id),
  };
  vm.createContext(context);
  vm.runInContext(`${mainSource.slice(start, end)}; this.createEvolutionEffect = createEvolutionEffect;`, context);

  return {
    createEvolutionEffect: context.createEvolutionEffect,
    emitAnimationEnd(animationName) {
      listeners.get('animationend')?.({ target: overlay, animationName });
    },
    classes,
    timeouts,
  };
}

test('normal evolution clears the dark overlay when its animation ends', () => {
  const effect = loadEvolutionEffect();
  let callbackCount = 0;

  effect.createEvolutionEffect(() => callbackCount += 1, false);
  assert.equal(effect.classes.has('flashing'), true);

  effect.emitAnimationEnd('evolutionPulsate');
  assert.equal(callbackCount, 1);
  assert.equal(effect.classes.has('flashing'), false);
  assert.equal(effect.timeouts.size, 0);
});

test('reduced-motion evolution also clears the dark overlay when its short pulse ends', () => {
  const effect = loadEvolutionEffect();
  let callbackCount = 0;

  effect.createEvolutionEffect(() => callbackCount += 1, false);
  effect.emitAnimationEnd('evolutionPulsateReduced');

  assert.equal(callbackCount, 1);
  assert.equal(effect.classes.has('flashing'), false);
  assert.equal(effect.timeouts.size, 0);
});

test('fallback clears the overlay if WebKit does not emit animationend', () => {
  const effect = loadEvolutionEffect();
  let callbackCount = 0;

  effect.createEvolutionEffect(() => callbackCount += 1, false);
  const fallback = [...effect.timeouts.values()][0];
  assert.equal(fallback.delay, 6500);
  fallback.handler();

  assert.equal(callbackCount, 1);
  assert.equal(effect.classes.has('flashing'), false);
});

test('reduced-motion CSS uses a visible short pulse instead of a 0.01ms black frame', () => {
  assert.match(styleSource, /\.evolution-overlay\.flashing\s*\{[\s\S]*?animation-name:\s*evolutionPulsateReduced\s*!important;[\s\S]*?animation-duration:\s*1\.2s\s*!important;/);
  assert.match(styleSource, /@keyframes evolutionPulsateReduced/);
});
