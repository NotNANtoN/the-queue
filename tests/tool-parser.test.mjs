import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadLlmParser() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('const LLM = {');
  const endMarker = '\n// ============================================================\n// GROUP CHAT BANTER';
  const end = html.indexOf(endMarker, start);

  assert.notEqual(start, -1, 'Could not find LLM object in index.html');
  assert.notEqual(end, -1, 'Could not find end of LLM object in index.html');

  const source = html.slice(start, end).replace('const LLM =', 'var LLM =');
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${source}\nLLM;`, context);
  return context.LLM;
}

const LLM = loadLlmParser();

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
