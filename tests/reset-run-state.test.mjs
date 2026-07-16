import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJs(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function prepareSource(source) {
  return source.replace(/^const ([A-Za-z_$][\w$]*)\s*=/gm, 'var $1 =');
}

function createCanvasStub() {
  return {
    width: 8,
    height: 8,
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
      fillStyle: '',
    }),
    toDataURL: () => 'data:image/png;base64,',
  };
}

function createStubElement() {
  return {
    style: {},
    textContent: '',
    innerHTML: '',
    disabled: false,
    offsetWidth: 100,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener: () => {},
    focus: () => {},
    after: () => {},
    querySelectorAll: () => [],
    dataset: {},
  };
}

function mutateValue(value) {
  if (value === null) return { mutated: true };
  if (Array.isArray(value)) return [...value, '__mutated__'];
  if (typeof value === 'object') return { ...value, __mutated__: true };
  if (typeof value === 'number') return value + 999;
  if (typeof value === 'boolean') return !value;
  return '__mutated__';
}

function loadMainContext() {
  const localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const createStubEl = () => ({
    style: {},
    textContent: '',
    innerHTML: '',
    disabled: false,
    offsetWidth: 100,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener: () => {},
    focus: () => {},
    after: () => {},
    querySelectorAll: () => [],
    dataset: {},
  });
  const context = {
    console,
    localStorage,
    document: {
      createElement: (tag) => (tag === 'canvas' ? createCanvasStub() : createStubEl()),
      getElementById: () => createStubEl(),
      querySelectorAll: () => [],
    },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    confirm: () => false,
    location: { reload: () => {} },
    ClubAudio: { setMuted: () => {}, ctx: null, lpFilter: null },
    QueueCanvas: { stopLoop: () => {}, THEMES: {}, layoutPeople: () => {}, rebuildQueueViz: () => {} },
    Portrait: { generate: () => '' },
    Particles: { burst: () => {}, confetti: () => {} },
    notify: () => {},
    showToast: () => {},
    Math: globalThis.Math,
    Date: globalThis.Date,
    JSON: globalThis.JSON,
  };
  vm.createContext(context);

  const scripts = [
    'js/pixel.js',
    'js/data.js',
    'js/portrait.js',
    'js/data-phase1.js',
    'js/save.js',
    'js/state.js',
    'js/fx.js',
    'js/ui.js',
    'js/canvas.js',
    'js/llm.js',
    'js/queue.js',
    'js/chat.js',
    'js/kiosk.js',
    'js/bouncer.js',
    'js/use-item.js',
  ];
  for (const file of scripts) {
    vm.runInContext(prepareSource(readJs(file)), context);
  }
  const mainSource = prepareSource(readJs('js/main.js')).replace(/\ninit\(\);\s*$/, '');
  vm.runInContext(mainSource, context);
  return context;
}

test('resetRunState restores every state.queue field to defaults', () => {
  const ctx = loadMainContext();
  const defaults = JSON.parse(JSON.stringify(ctx.state.queue));

  for (const key of Object.keys(ctx.state.queue)) {
    ctx.state.queue[key] = mutateValue(defaults[key]);
  }
  ctx.state.contactUnlockedThisRun = true;

  ctx.resetRunState();

  for (const key of Object.keys(defaults)) {
    assert.equal(
      JSON.stringify(ctx.state.queue[key]),
      JSON.stringify(defaults[key]),
      `state.queue.${key} should match default after resetRunState()`,
    );
  }
  assert.equal(ctx.state.contactUnlockedThisRun, false);
});
