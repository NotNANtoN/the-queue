import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

const { LLM } = loadGameModule('js/llm.js');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('parses and strips supported tool call formats', () => {
  const cases = [
    {
      name: 'bare Gemma affinity call',
      raw: '(I manage a small smile.) Hi! change_affinity{delta:5}',
      expectedName: 'change_affinity',
      expectedArgs: { delta: 5 },
      expectedClean: '(I manage a small smile.) Hi!',
    },
    {
      name: 'prefixed Gemma affinity call',
      raw: 'You look ready for this. call:change_affinity{delta:5}',
      expectedName: 'change_affinity',
      expectedArgs: { delta: 5 },
      expectedClean: 'You look ready for this.',
    },
    {
      name: 'paren remember call',
      raw: 'That was oddly sweet. remember(text="The player made a funny queue joke", salience=0.2)',
      expectedName: 'remember',
      expectedArgs: {
        text: 'The player made a funny queue joke',
        salience: 0.2,
      },
      expectedClean: 'That was oddly sweet.',
    },
    {
      name: 'xml tool call',
      raw: 'Fine, I trust you. <form_alliance reason="good vibe" />',
      expectedName: 'form_alliance',
      expectedArgs: { reason: 'good vibe' },
      expectedClean: 'Fine, I trust you.',
    },
    {
      name: 'qwen3 single tool call',
      raw: 'Sure thing! <tool_call>\n{"name": "change_affinity", "arguments": {"delta": 5}}\n</tool_call>',
      expectedName: 'change_affinity',
      expectedArgs: { delta: 5 },
      expectedClean: 'Sure thing!',
    },
  ];

  for (const testCase of cases) {
    const calls = LLM._parseToolCalls(testCase.raw);
    const clean = LLM._stripToolText(testCase.raw);
    const first = calls[0]?.function || {};

    assert.equal(first.name, testCase.expectedName, testCase.name);
    assert.deepEqual(plain(first.arguments), testCase.expectedArgs, testCase.name);
    assert.equal(clean, testCase.expectedClean, testCase.name);
    assert.equal(clean.includes(testCase.expectedName), false, testCase.name);
  }
});

test('parses qwen3 tool call with non-strict JSON (+5 delta, trailing comma)', () => {
  const raw = 'Nice jacket! <tool_call>\n{"name": "change_affinity", "arguments": {"delta": +5,}}\n</tool_call>';
  const calls = LLM._parseToolCalls(raw);
  const clean = LLM._stripToolText(raw);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'change_affinity');
  assert.deepEqual(plain(calls[0].function.arguments), { delta: 5 });
  assert.equal(clean, 'Nice jacket!');
});

test('parses two sequential qwen3 tool call blocks', () => {
  const raw = [
    'Deal.',
    '<tool_call>',
    '{"name": "share_intel", "arguments": {"intel": "password is Velvet Room"}}',
    '</tool_call>',
    '<tool_call>',
    '{"name": "change_affinity", "arguments": {"delta": 3}}',
    '</tool_call>',
  ].join('\n');

  const calls = LLM._parseToolCalls(raw);
  const clean = LLM._stripToolText(raw);

  assert.equal(calls.length, 2);
  assert.deepEqual(plain(calls.map(call => call.function.name)), ['share_intel', 'change_affinity']);
  assert.deepEqual(plain(calls.map(call => call.function.arguments)), [
    { intel: 'password is Velvet Room' },
    { delta: 3 },
  ]);
  assert.equal(clean, 'Deal.');
  assert.equal(clean.includes('tool_call'), false);
  assert.equal(clean.includes('share_intel'), false);
});

test('strips think blocks from player-visible text', () => {
  const tag = 'think';
  const raw = `Hello there.<${tag}>\nThey seem nice.\n</${tag}> Nice night!`;
  const clean = LLM._stripToolText(raw);

  assert.equal(clean, 'Hello there. Nice night!');
  assert.equal(clean.includes(tag), false);
  assert.equal(clean.includes('They seem nice'), false);
});

test('handles multiple leaked bare tool calls without showing them to players', () => {
  const raw = [
    '(I jump slightly, caught off guard, and nervously adjust the strap of my bag.)',
    'You... you look like you\'re ready for this, though.',
    'change_affinity{delta:5}',
    '(I manage a small, slightly panicked smile.) Hi! Not much, just waiting.',
    'change_affinity{delta:5}',
  ].join(' ');

  const calls = LLM._parseToolCalls(raw);
  const clean = LLM._stripToolText(raw);

  assert.equal(calls.length, 2);
  assert.deepEqual(plain(calls.map(call => call.function.name)), ['change_affinity', 'change_affinity']);
  assert.deepEqual(plain(calls.map(call => call.function.arguments)), [{ delta: 5 }, { delta: 5 }]);
  assert.equal(clean.includes('change_affinity'), false);
  assert.match(clean, /caught off guard/);
  assert.match(clean, /Not much, just waiting/);
});
