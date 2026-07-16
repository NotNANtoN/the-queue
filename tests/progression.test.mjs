import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

// Stub Portrait so we don't need a DOM/canvas for save + spawn logic.
const stubPortrait = {
  SKINS: ['#f5d0a9', '#e8b88a', '#c68642'],
  HAIRS: ['#1a1a2e', '#3d2b1f'],
  HAIR_STYLES: ['short', 'long'],
  SHIRTS: ['#1a1a2e', '#2d2d2d'],
  ACCESSORIES: [null, 'glasses'],
  randomProps() {
    return {
      skin: '#f5d0a9', hairColor: '#1a1a2e', hairStyle: 'short',
      shirtColor: '#1a1a2e', accessory: null,
      faceWidth: 6, faceHeight: 7, eyeSpacing: 3, noseSize: 1, earSize: 1, seed: 0.5,
    };
  },
  generate() { return ''; },
};

function loadContext(localStorage, mathStub) {
  const stubs = { localStorage, Portrait: stubPortrait };
  if (mathStub) stubs.Math = mathStub;
  return loadGameModule(
    ['js/data.js', 'js/data-phase1.js', 'js/save.js', 'js/state.js'],
    stubs,
  );
}

// A Math stub whose random() returns a deterministic cycling sequence so that
// array-index picks differ (avoids the `while (adj2 === adj1)` infinite loop in
// generateNeighbor's stranger path). Other Math.* methods delegate to the real ones.
function seqMath() {
  const real = globalThis.Math;
  let i = 0;
  const next = () => {
    const v = (i * 0.0731) % 1; // varying sequence; first value 0 (< 0.4 spawn threshold)
    i++;
    return v;
  };
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'random') return next;
      return target[prop];
    },
  });
}

// ============================================================
// (a) MIGRATION v1 -> v2
// ============================================================

test('migration v1->v2: orphaned strangerMemories become regulars with re-keyed memories', () => {
  const v1Save = {
    version: 1,
    reputation: 5,
    savings: 10,
    job: 'barista',
    venuesCleared: ['mainframe'],
    wonAt: null,
    unlockedContacts: ['kai'],
    totalRuns: 3,
    totalSuccesses: 1,
    bonds: {},
    contactStats: {},
    ownedOutfits: [],
    equippedOutfits: [],
    playerLook: null,
    djHistory: {},
    venueVisits: {},
    contactMemories: {},
    strangerMemories: {
      stranger_abc: {
        name: 'Ella',
        disposition: 'friendly',
        quirk: 'knows everyone on the guestlist',
        memories: [
          { text: 'talked about her dog', venueId: 'neon', runNumber: 2 },
        ],
      },
      stranger_def: {
        name: 'Marco',
        disposition: 'drunk',
        quirk: 'claims to be a DJ',
        memories: [
          { text: 'spilled a drink', venueId: 'mainframe', runNumber: 1 },
        ],
      },
    },
  };
  const localStorage = createLocalStorage({ thequeue_save_v1: JSON.stringify(v1Save) });
  const ctx = loadContext(localStorage);

  const prog = ctx.SaveSystem.load();

  // Version bumped
  assert.equal(prog.version, 2);
  // Streak fields initialized
  assert.equal(prog.currentStreak, 0);
  assert.equal(prog.bestStreak, 0);
  // regulars pool populated
  const regIds = Object.keys(prog.regulars);
  assert.equal(regIds.length, 2, 'two regulars synthesized from orphaned memories');
  // Each regular carries the right home venue + name
  const byName = Object.values(prog.regulars).reduce((acc, r) => { acc[r.name] = r; return acc; }, {});
  assert.equal(byName.Ella.homeVenueId, 'neon');
  assert.equal(byName.Marco.homeVenueId, 'mainframe');
  assert.equal(byName.Ella.timesMet, 1);
  // Memories re-keyed under the new regular id (not the old stranger_ key)
  assert.ok(!prog.strangerMemories.stranger_abc, 'old key removed');
  assert.ok(!prog.strangerMemories.stranger_def, 'old key removed');
  const ellaId = byName.Ella.id;
  assert.ok(prog.strangerMemories[ellaId], 'memories re-keyed under regular id');
  assert.equal(prog.strangerMemories[ellaId].memories[0].text, 'talked about her dog');
  // portraitProps regenerated deterministically from seed
  assert.ok(byName.Ella.portraitProps, 'portraitProps regenerated');
  assert.ok(byName.Ella.portraitProps.skin);
});

// ============================================================
// (b) PROMOTION + EVICTION
// ============================================================

test('promoteNeighborToRegular: affinity >= 70 with no memories promotes a neighbor', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage);
  ctx.state.selectedVenue = 'mainframe';
  ctx.state.queue.nightMemories = [];
  const prog = ctx.SaveSystem.defaultProgress();

  const neighbor = {
    memoryId: 'stranger_xyz',
    name: 'Lena',
    disposition: 'friendly',
    quirk: 'is celebrating a birthday',
    adjectives: ['stylish', 'tall'],
    portraitProps: stubPortrait.randomProps(),
    affinity: 75,
  };

  const result = ctx.SaveSystem.promoteNeighborToRegular(neighbor, prog);
  assert.ok(result, 'promotion should return a truthy result');
  const regIds = Object.keys(prog.regulars);
  assert.equal(regIds.length, 1);
  const reg = prog.regulars[regIds[0]];
  assert.equal(reg.name, 'Lena');
  assert.equal(reg.homeVenueId, 'mainframe');
  assert.equal(reg.affinityCarry, 75);
  assert.equal(reg.timesMet, 1);
  assert.equal(neighbor._promotedToRegular, true);
});

test('promoteNeighborToRegular: affinity < 70 with no memories does NOT promote', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage);
  ctx.state.selectedVenue = 'mainframe';
  ctx.state.queue.nightMemories = [];
  const prog = ctx.SaveSystem.defaultProgress();

  const neighbor = {
    memoryId: 'stranger_low',
    name: 'Jonas',
    disposition: 'neutral',
    quirk: 'is here for the first time',
    adjectives: ['quiet', 'tall'],
    portraitProps: stubPortrait.randomProps(),
    affinity: 55,
  };

  const result = ctx.SaveSystem.promoteNeighborToRegular(neighbor, prog);
  assert.equal(result, null);
  assert.equal(Object.keys(prog.regulars).length, 0);
});

test('promoteNeighborToRegular: 7th regular in a venue evicts lowest timesMet', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage);
  ctx.state.selectedVenue = 'neon';
  ctx.state.queue.nightMemories = [];
  const prog = ctx.SaveSystem.defaultProgress();

  // Pre-populate 6 regulars at 'neon'. Victim candidate: lowest timesMet, then oldest lastSeenRun.
  const base = {
    homeVenueId: 'neon',
    firstMetRun: 1,
    affinityCarry: 50,
  };
  prog.regulars['regular_victim_1'] = { id: 'regular_victim_1', name: 'Victim', ...base, lastSeenRun: 1, timesMet: 1 };
  prog.regulars['regular_keepa_2'] = { id: 'regular_keep a_2', name: 'KeepA', ...base, lastSeenRun: 5, timesMet: 3 };
  prog.regulars['regular_keepb_3'] = { id: 'regular_keepb_3', name: 'KeepB', ...base, lastSeenRun: 4, timesMet: 2 };
  prog.regulars['regular_keepc_4'] = { id: 'regular_keepc_4', name: 'KeepC', ...base, lastSeenRun: 6, timesMet: 5 };
  prog.regulars['regular_keepd_5'] = { id: 'regular_keepd_5', name: 'KeepD', ...base, lastSeenRun: 3, timesMet: 2 };
  prog.regulars['regular_keepe_6'] = { id: 'regular_keepe_6', name: 'KeepE', ...base, lastSeenRun: 7, timesMet: 4 };
  // Attach a strangerMemories entry to the victim to confirm it gets purged on eviction.
  prog.strangerMemories['regular_victim_1'] = { name: 'Victim', memories: [{ text: 'old' }] };

  const neighbor = {
    memoryId: 'stranger_new',
    name: 'Nadia',
    disposition: 'friendly',
    quirk: 'knows everyone',
    adjectives: ['stylish', 'loud'],
    portraitProps: stubPortrait.randomProps(),
    affinity: 80,
  };

  ctx.SaveSystem.promoteNeighborToRegular(neighbor, prog);

  const regIds = Object.keys(prog.regulars);
  assert.equal(regIds.length, 6, 'cap stays at 6');
  assert.ok(!prog.regulars['regular_victim_1'], 'lowest-timesMet regular evicted');
  assert.ok(!prog.strangerMemories['regular_victim_1'], 'evicted regular memories purged');
  assert.ok(prog.regulars['regular_keepc_4'], 'highest-timesMet kept');
  const nadia = Object.values(prog.regulars).find(r => r.name === 'Nadia');
  assert.ok(nadia, 'new neighbor promoted');
  assert.equal(nadia.homeVenueId, 'neon');
});

// ============================================================
// (c) SPAWN DETERMINISM + ONE-PER-RUN CAP
// ============================================================

test('generateNeighbor: with a venue regular and a hit roll, returns the regular with matching memoryId', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage, seqMath());
  ctx.state.selectedVenue = 'mainframe';
  ctx.state.queue.regularSpawnedThisRun = false;

  const prog = ctx.SaveSystem.defaultProgress();
  prog.regulars['regular_ella_1'] = {
    id: 'regular_ella_1',
    name: 'Ella',
    disposition: 'friendly',
    quirk: 'knows everyone',
    adjectives: ['stylish', 'tall'],
    portraitProps: stubPortrait.randomProps(),
    homeVenueId: 'mainframe',
    firstMetRun: 1,
    lastSeenRun: 1,
    timesMet: 2,
    affinityCarry: 70,
  };
  ctx.SaveSystem.save(prog);

  const n = ctx.generateNeighbor('mainframe', []);
  assert.equal(n.isRegular, true);
  assert.equal(n.memoryId, 'regular_ella_1', 'memoryId matches regular id so MemorySystem lookups hit');
  assert.equal(n.name, 'Ella');
  assert.equal(n.regularId, 'regular_ella_1');
  assert.equal(ctx.state.queue.regularSpawnedThisRun, true, 'flag set after spawn');
});

test('generateNeighbor: respects one-regular-per-run cap', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage, seqMath());
  ctx.state.selectedVenue = 'mainframe';
  ctx.state.queue.regularSpawnedThisRun = false;

  const prog = ctx.SaveSystem.defaultProgress();
  prog.regulars['regular_ella_1'] = {
    id: 'regular_ella_1',
    name: 'Ella',
    disposition: 'friendly',
    quirk: 'knows everyone',
    adjectives: ['stylish', 'tall'],
    portraitProps: stubPortrait.randomProps(),
    homeVenueId: 'mainframe',
    firstMetRun: 1, lastSeenRun: 1, timesMet: 2, affinityCarry: 70,
  };
  ctx.SaveSystem.save(prog);

  const first = ctx.generateNeighbor('mainframe', []);
  assert.equal(first.isRegular, true);
  const second = ctx.generateNeighbor('mainframe', []);
  assert.notEqual(second.isRegular, true, 'second spawn must be a fresh stranger, cap enforced');
  assert.notEqual(second.memoryId, 'regular_ella_1');
});

// ============================================================
// (d) STREAK MATH in recordRun
// ============================================================

test('recordRun: success increments current + best streak; failure resets and flags broken streak', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage, seqMath());
  ctx.state.finalSquad = [];
  ctx.state.cash = 20;
  ctx.state.contactUnlockedThisRun = false;
  ctx.state.queue.revealedIntel = [];
  ctx.state.queue.allNeighbors = [];
  ctx.state.queue.behindNeighbors = [];
  ctx.SaveSystem.save(ctx.SaveSystem.defaultProgress());

  ctx.SaveSystem.recordRun(true, 'mainframe');
  let prog = ctx.SaveSystem.load();
  assert.equal(prog.currentStreak, 1);
  assert.equal(prog.bestStreak, 1);

  ctx.state.contactUnlockedThisRun = false;
  ctx.SaveSystem.recordRun(true, 'compliance');
  prog = ctx.SaveSystem.load();
  assert.equal(prog.currentStreak, 2);
  assert.equal(prog.bestStreak, 2);

  ctx.state.contactUnlockedThisRun = false;
  ctx.SaveSystem.recordRun(false, 'mainframe');
  prog = ctx.SaveSystem.load();
  assert.equal(prog.currentStreak, 0, 'failure resets current streak');
  assert.equal(prog.bestStreak, 2, 'best streak preserved');
  assert.equal(ctx.state.brokenStreak, 2, 'broken streak flagged for result screen');
});

test('recordRun: a single-night failure does not flag a broken streak', () => {
  const localStorage = createLocalStorage();
  const ctx = loadContext(localStorage, seqMath());
  ctx.state.finalSquad = [];
  ctx.state.cash = 20;
  ctx.state.contactUnlockedThisRun = false;
  ctx.state.queue.revealedIntel = [];
  ctx.state.queue.allNeighbors = [];
  ctx.state.queue.behindNeighbors = [];
  ctx.SaveSystem.save(ctx.SaveSystem.defaultProgress());

  ctx.SaveSystem.recordRun(false, 'mainframe');
  assert.equal(ctx.state.brokenStreak, 0, 'no streak to break at 0');
  const prog = ctx.SaveSystem.load();
  assert.equal(prog.currentStreak, 0);
});
