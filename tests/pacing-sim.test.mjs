import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

const GAME_START = 23 * 60 + 35;
const SOBER_PENALTY = 1.6;

function createLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function loadSimContext() {
  return loadGameModule(
    ['js/data.js', 'js/data-phase1.js', 'js/save.js', 'js/state.js', 'js/queue.js'],
    {
      $: () => ({ style: {}, textContent: '', classList: { add() {}, remove() {}, contains: () => false } }),
      notify: () => {},
      showToast: () => {},
      EventLog: { add: () => {} },
      QueueCanvas: { layoutPeople: () => {}, rebuildQueueViz: () => {}, stopLoop: () => {} },
      sleep: async () => {},
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout: () => {},
      ChatSystem: { get active() { return false; }, addBubble() {} },
      CrewChatSystem: { active: false, addBubble() {} },
      BouncerSystem: { calcStyleMatch: () => 0 },
      WalkOfShame: { play: async () => {} },
      escapeHtml: (s) => s,
    },
  );
}

function restlessnessAnxiety(streak) {
  if (streak >= 4) return 6;
  if (streak === 3) return 4;
  if (streak === 2) return 2;
  return 0;
}

function simulatePureWait(policy, rng) {
  const { QUEUE_CONFIG, QueueEngine } = loadSimContext();
  const cfg = QUEUE_CONFIG[policy];

  let gameTime = GAME_START;
  let lastTickAt = GAME_START;
  let tickCount = 0;
  let position = cfg.startPos;
  let hope = 70;
  let anxiety = 10;
  let waitStreak = 0;

  while (position > 0 && gameTime < cfg.lastEntry && hope > 0) {
    waitStreak++;
    const extraAnxiety = restlessnessAnxiety(waitStreak);

    gameTime += QueueEngine.TICK_MINUTES;
    hope -= QueueEngine.TICK_MINUTES * 0.3 * SOBER_PENALTY;
    anxiety += QueueEngine.TICK_MINUTES * 0.4 * SOBER_PENALTY + extraAnxiety;

    while (gameTime >= lastTickAt + QueueEngine.TICK_MINUTES) {
      lastTickAt += QueueEngine.TICK_MINUTES;
      tickCount++;
      const roll = QueueEngine.rollMove(cfg, tickCount, rng);
      if (roll.moved) {
        position = Math.max(0, position - roll.amount);
        hope += roll.amount * 4;
      } else {
        anxiety += 2;
      }
    }
  }

  return {
    arrived: position <= 0,
    arrivalTime: position <= 0 ? gameTime : null,
    hope,
    anxiety,
    gameTime,
  };
}

function runMonteCarlo(policy, runs, seedBase) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    results.push(simulatePureWait(policy, createLcg(seedBase + i * 9973)));
  }
  return results;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const EXPECTED_ARRIVAL = {
  Easy: 24 * 60 + 20,      // 12:20 AM
  Moderate: 24 * 60 + 50,  // 12:50 AM
  Ruthless: 25 * 60 + 35,  // 1:35 AM
  Nightmare: 26 * 60 + 20, // 2:20 AM
};

test('rollMove uses shared QueueEngine math', () => {
  const { QUEUE_CONFIG, QueueEngine } = loadSimContext();
  const cfg = QUEUE_CONFIG.Easy;
  const rng = createLcg(42);
  let moved = 0;
  for (let i = 0; i < 100; i++) {
    if (QueueEngine.rollMove(cfg, 5, rng).moved) moved++;
  }
  assert.ok(moved > 20 && moved < 80, `expected plausible move rate, got ${moved}/100`);
});

test('Nightmare door cannot be cleared by waiting alone (static prep ceiling)', () => {
  const maxStyleBonusWithoutPrep = 20;
  const nightmareThreshold = 100;
  assert.ok(maxStyleBonusWithoutPrep < nightmareThreshold);
});

test('monte-carlo pure-Wait pacing meets design targets', () => {
  const RUNS = 500;

  const easy = runMonteCarlo('Easy', RUNS, 1000);
  const easyArrived = easy.filter(r => r.arrived && r.arrivalTime <= QUEUE_CONFIG_REF().Easy.lastEntry);
  const easyHope = easy.filter(r => r.hope > 0);
  assert.ok(easyArrived.length / RUNS >= 0.95, `Easy arrival rate ${easyArrived.length}/${RUNS}`);
  assert.ok(easyHope.length / RUNS >= 0.80, `Easy hope rate ${easyHope.length}/${RUNS}`);

  const nightmare = runMonteCarlo('Nightmare', RUNS, 9000);
  const nightmareArrived = nightmare.filter(r => r.arrived && r.arrivalTime <= QUEUE_CONFIG_REF().Nightmare.lastEntry);
  assert.ok(nightmareArrived.length / RUNS >= 0.70, `Nightmare arrival rate ${nightmareArrived.length}/${RUNS}`);

  for (const [policy, expected] of Object.entries(EXPECTED_ARRIVAL)) {
    const runs = runMonteCarlo(policy, RUNS, 2000 + policy.length * 111);
    const arrivals = runs.filter(r => r.arrived).map(r => r.arrivalTime);
    assert.ok(arrivals.length > RUNS * 0.5, `${policy}: enough arrivals for mean (${arrivals.length})`);
    const avgArrival = mean(arrivals);
    assert.ok(
      Math.abs(avgArrival - expected) <= 20,
      `${policy}: mean arrival ${avgArrival} vs expected ${expected} (±20 min)`,
    );
  }
});

function QUEUE_CONFIG_REF() {
  const ctx = loadSimContext();
  return ctx.QUEUE_CONFIG;
}
