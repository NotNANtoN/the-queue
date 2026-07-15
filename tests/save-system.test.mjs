import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

function loadSaveContext() {
  const localStorage = createLocalStorage();
  const ctx = loadGameModule(
    ['js/data.js', 'js/data-phase1.js', 'js/save.js', 'js/state.js'],
    { localStorage },
  );
  return { ctx, localStorage };
}

test('defaultProgress has expected shape', () => {
  const { ctx } = loadSaveContext();
  const defaults = ctx.SaveSystem.defaultProgress();

  assert.equal(defaults.reputation, 0);
  assert.equal(defaults.savings, 0);
  assert.equal(defaults.job, 'barista');
  assert.deepEqual(plain(defaults.venuesCleared), []);
  assert.equal(defaults.wonAt, null);
  assert.deepEqual(plain(defaults.unlockedContacts), ['kai', 'rissal', 'mona']);
  assert.equal(defaults.totalRuns, 0);
  assert.equal(defaults.totalSuccesses, 0);
  assert.deepEqual(plain(defaults.bonds), {});
  assert.deepEqual(plain(defaults.contactStats), {});
  assert.deepEqual(plain(defaults.ownedOutfits), []);
  assert.deepEqual(plain(defaults.equippedOutfits), []);
  assert.equal(defaults.playerLook, null);
  assert.deepEqual(plain(defaults.djHistory), {});
  assert.deepEqual(plain(defaults.venueVisits), {});
  assert.deepEqual(plain(defaults.contactMemories), {});
  assert.deepEqual(plain(defaults.strangerMemories), {});
});

test('dedupeVenuesCleared removes duplicate venue ids', () => {
  const { ctx } = loadSaveContext();
  const progress = { venuesCleared: ['mainframe', 'compliance', 'mainframe', 'compliance'] };

  ctx.SaveSystem.dedupeVenuesCleared(progress);

  assert.deepEqual(plain(progress.venuesCleared), ['mainframe', 'compliance']);
  assert.equal(ctx.SaveSystem.uniqueVenuesClearedCount(progress), 2);
});

test('tryUnlockContact respects one-per-run flag', () => {
  const { ctx } = loadSaveContext();
  const progress = ctx.SaveSystem.defaultProgress();

  const first = ctx.SaveSystem.tryUnlockContact(progress, 'pia', { where: 'test', bond: 20 });
  assert.equal(first?.id, 'pia');
  assert.equal(ctx.state.contactUnlockedThisRun, true);
  assert.ok(progress.unlockedContacts.includes('pia'));

  const second = ctx.SaveSystem.tryUnlockContact(progress, 'ghost', { where: 'test', bond: 20 });
  assert.equal(second, null);
  assert.ok(!progress.unlockedContacts.includes('ghost'));
});

test('recordRun success increments reputation and saves remaining cash', () => {
  const { ctx } = loadSaveContext();
  const originalRandom = Math.random;
  Math.random = () => 1;

  try {
    ctx.state.finalSquad = [];
    ctx.state.cash = 42;
    ctx.state.contactUnlockedThisRun = false;
    ctx.state.queue.revealedIntel = [];
    ctx.SaveSystem.save(ctx.SaveSystem.defaultProgress());

    ctx.SaveSystem.recordRun(true, 'mainframe');
    const progress = ctx.SaveSystem.load();

    assert.equal(progress.totalRuns, 1);
    assert.equal(progress.totalSuccesses, 1);
    assert.equal(progress.reputation, 3);
    assert.deepEqual(plain(progress.venuesCleared), ['mainframe']);
    assert.equal(progress.savings, 42);
  } finally {
    Math.random = originalRandom;
  }
});

test('applyToState upgrades job tier from reputation thresholds', () => {
  const { ctx } = loadSaveContext();
  const progress = ctx.SaveSystem.defaultProgress();
  progress.reputation = 12;
  progress.savings = 25;
  ctx.SaveSystem.save(progress);

  ctx.SaveSystem.applyToState();

  assert.equal(ctx.state.progress.job, 'promoter');
  assert.equal(ctx.state.cash, 85);
});
