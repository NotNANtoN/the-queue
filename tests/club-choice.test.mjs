import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

const { ClubChoiceEffects } = loadGameModule('js/bouncer.js');

test('ClubChoiceEffects.applyBondBoost increases player and pairwise bonds', () => {
  const squad = [{ id: 'kai' }, { id: 'yuki' }];
  const bonds = { 'kai:player': 10, 'kai:yuki': 5 };
  const result = ClubChoiceEffects.applyBondBoost(1, squad, bonds);

  assert.equal(result.bondBoost, 1);
  assert.equal(result.memberCount, 2);
  assert.equal(result.bonds['kai:player'], 11);
  assert.equal(result.bonds['kai:yuki'], 6);
});

test('ClubChoiceEffects.resolveWorkTheRoom unlocks contact when roll succeeds', () => {
  const progress = { contacts: [] };
  const result = ClubChoiceEffects.resolveWorkTheRoom(
    0.5,
    false,
    'mainframe',
    progress,
    () => 'dex',
    (p, id) => ({ id, name: 'Dex' }),
  );

  assert.equal(result.repGain, 1);
  assert.equal(result.unlocked, true);
  assert.equal(result.contact.name, 'Dex');
});

test('ClubChoiceEffects.resolveWorkTheRoom skips unlock when already met someone tonight', () => {
  const result = ClubChoiceEffects.resolveWorkTheRoom(
    0.1,
    true,
    'mainframe',
    {},
    () => 'dex',
    () => ({ id: 'dex', name: 'Dex' }),
  );

  assert.equal(result.unlocked, false);
  assert.equal(result.contact, null);
});

test('ClubChoiceEffects.resolveChaseTheNight returns reward on success', () => {
  const result = ClubChoiceEffects.resolveChaseTheNight(0.2);
  assert.equal(result.success, true);
  assert.ok(result.reward);
});

test('ClubChoiceEffects.resolveChaseTheNight returns empty on failure', () => {
  const result = ClubChoiceEffects.resolveChaseTheNight(0.8);
  assert.equal(result.success, false);
  assert.equal(result.reward, null);
});
