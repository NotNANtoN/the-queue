import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

const { LLM } = loadGameModule('js/llm.js');

test('LLM._assessPreflight: no WebGPU → unsupported', () => {
  const result = LLM._assessPreflight({ hasWebGPU: false, deviceMemory: 16 });
  assert.equal(result.level, 'unsupported');
  assert.ok(result.reasons.some(r => r.includes('WebGPU')));
});

test('LLM._assessPreflight: WebGPU + 4 GB RAM → low-memory', () => {
  const result = LLM._assessPreflight({ hasWebGPU: true, deviceMemory: 4 });
  assert.equal(result.level, 'low-memory');
  assert.ok(result.reasons.some(r => r.includes('4 GB')));
});

test('LLM._assessPreflight: WebGPU + 8 GB RAM → ok', () => {
  const result = LLM._assessPreflight({ hasWebGPU: true, deviceMemory: 8 });
  assert.equal(result.level, 'ok');
  assert.ok(result.reasons.some(r => r.includes('WebGPU')));
});

test('LLM._assessPreflight: WebGPU + undefined deviceMemory → ok', () => {
  const result = LLM._assessPreflight({ hasWebGPU: true, deviceMemory: undefined });
  assert.equal(result.level, 'ok');
  assert.ok(result.reasons.some(r => r.includes('could not be detected')));
});
