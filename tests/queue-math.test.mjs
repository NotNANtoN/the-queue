import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

function createStubElement() {
  return {
    style: {},
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    innerHTML: '',
    disabled: false,
    focus() {},
    offsetWidth: 0,
    appendChild() {},
    scrollTop: 0,
    parentElement: { clientWidth: 100, clientHeight: 100 },
    getContext: () => ({}),
    querySelectorAll: () => [],
    addEventListener: () => {},
    after: () => {},
  };
}

function loadQueueContext() {
  const localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const $ = () => createStubElement();

  const ctx = loadGameModule(
    ['js/data.js', 'js/data-phase1.js', 'js/save.js', 'js/state.js', 'js/queue.js'],
    {
      localStorage,
      $,
      notify: () => {},
      showToast: () => {},
      EventLog: { add: () => {} },
      QueueCanvas: { layoutPeople: () => {}, rebuildQueueViz: () => {} },
      Particles: { burst: () => {}, confetti: () => {} },
      ClubAudio: {},
      sleep: async () => {},
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout: () => {},
    },
  );

  ctx.state.finalSquad = [];
  ctx.state.queue.hope = 50;
  ctx.state.queue.anxiety = 10;
  ctx.state.inventory = {};
  ctx.state.queue.earplugsActive = false;

  return ctx;
}

test('modHope and modAnxiety clamp values to [0, 100]', () => {
  const { QueueEngine, state } = loadQueueContext();

  state.queue.hope = 50;
  QueueEngine.modHope(80);
  assert.equal(state.queue.hope, 100);

  QueueEngine.modHope(-20);
  assert.equal(state.queue.hope, 80);

  state.queue.anxiety = 10;
  QueueEngine.modAnxiety(120);
  assert.equal(state.queue.anxiety, 100);

  QueueEngine.modAnxiety(-200);
  assert.equal(state.queue.anxiety, 0);
});

test('modAnxiety applies earplug, yuki, and kai multipliers', () => {
  const { QueueEngine, state } = loadQueueContext();
  state.queue.anxiety = 0;

  QueueEngine.modAnxiety(10);
  assert.equal(state.queue.anxiety, 10);

  state.queue.anxiety = 0;
  state.inventory.earplugs = 1;
  state.queue.earplugsActive = false;
  QueueEngine.modAnxiety(10);
  assert.equal(state.queue.anxiety, 6);

  state.queue.anxiety = 0;
  state.queue.earplugsActive = true;
  QueueEngine.modAnxiety(10);
  assert.equal(state.queue.anxiety, 5);

  state.queue.anxiety = 0;
  state.queue.earplugsActive = false;
  state.inventory.earplugs = 0;
  state.finalSquad = [{ id: 'yuki', name: 'Yuki' }];
  QueueEngine.modAnxiety(10);
  assert.equal(state.queue.anxiety, 7.5);

  state.queue.anxiety = 0;
  state.finalSquad = [{ id: 'kai', name: 'Kai' }];
  QueueEngine.modAnxiety(10);
  assert.equal(state.queue.anxiety, 12);
});

test('QueueEngine._turnBonus caps queue move bonus at +0.20', () => {
  const { QueueEngine } = loadQueueContext();

  assert.equal(QueueEngine._turnBonus(0), 0);
  assert.equal(QueueEngine._turnBonus(5), 0.1);
  assert.equal(QueueEngine._turnBonus(10), 0.2);
  assert.equal(QueueEngine._turnBonus(20), 0.2);
});
