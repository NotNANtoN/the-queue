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
    _timer: null,
    appendChild() {},
    scrollTop: 0,
  };
}

function loadFlakeContext() {
  const document = {
    getElementById: () => createStubElement(),
  };

  return loadGameModule(
    ['js/data.js', 'js/data-phase1.js', 'js/ui.js'],
    {
      document,
      EventLog: { add: () => {} },
      SaveSystem: {
        load: () => ({ equippedOutfits: [] }),
        getBond: () => 0,
        getContactStat: () => ({ loyalty: 50 }),
        updateContactStat: () => {},
      },
      state: { selectedSquad: [], selectedVenue: null, phase: 'BOOT' },
      sleep: async () => {},
    },
  );
}

test('computeEffectiveFlake uses base flake rate', () => {
  const { computeEffectiveFlake, CONTACTS } = loadFlakeContext();
  const kai = CONTACTS.find(c => c.id === 'kai');

  assert.equal(computeEffectiveFlake(kai, null), 15);
});

test('computeEffectiveFlake applies music match and mismatch', () => {
  const { computeEffectiveFlake, CONTACTS, VENUES } = loadFlakeContext();
  const kai = CONTACTS.find(c => c.id === 'kai');
  const matchVenue = VENUES.find(v => v.music === kai.musicPref);
  const mismatchVenue = { music: 'Techno' };

  assert.equal(computeEffectiveFlake(kai, matchVenue), 2);
  assert.equal(computeEffectiveFlake(kai, mismatchVenue), 25);
});

test('computeEffectiveFlake applies venue price tiers', () => {
  const { computeEffectiveFlake, CONTACTS } = loadFlakeContext();
  const kai = CONTACTS.find(c => c.id === 'kai');
  const venueMid = { music: kai.musicPref, entryPrice: 15 };
  const venueHigh = { music: kai.musicPref, entryPrice: 25 };

  assert.equal(computeEffectiveFlake(kai, venueMid), 3);
  assert.equal(computeEffectiveFlake(kai, venueHigh), 10);
});

test('computeEffectiveFlake applies bond and lucky charm reductions', () => {
  const { computeEffectiveFlake, CONTACTS } = loadFlakeContext();
  const kai = CONTACTS.find(c => c.id === 'kai');

  assert.equal(computeEffectiveFlake(kai, null, { playerBond: 40 }), 5);
  assert.equal(computeEffectiveFlake(kai, null, { equippedOutfits: ['lucky_charm'] }), 10);
});

test('computeEffectiveFlake applies loyalty adjustment and clamps to floor 2%', () => {
  const { computeEffectiveFlake, CONTACTS } = loadFlakeContext();
  const kai = CONTACTS.find(c => c.id === 'kai');
  const rissal = CONTACTS.find(c => c.id === 'rissal');

  assert.equal(computeEffectiveFlake(kai, null, { loyalty: 80 }), 12);
  assert.equal(computeEffectiveFlake(kai, null, { loyalty: 0 }), 20);
  assert.equal(computeEffectiveFlake(rissal, null, { loyalty: 100 }), 2);
});
