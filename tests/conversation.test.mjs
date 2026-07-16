import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

function createDocumentStub() {
  const container = { children: [], appendChild(el) { this.children.push(el); }, scrollTop: 0 };
  return {
    container,
    createElement() {
      return {
        className: '',
        textContent: '',
        innerHTML: '',
        remove() {},
      };
    },
  };
}

function loadConversationContext(llmOverrides = {}) {
  const doc = createDocumentStub();
  const sendBtn = { disabled: false };

  const ctx = loadGameModule(
    ['js/state.js', 'js/ui.js', 'js/llm.js', 'js/chat.js'],
    {
      document: doc,
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout: () => {},
    },
  );

  Object.assign(ctx.LLM, llmOverrides);

  const convo = ctx.Conversation.create({
    getContainer: () => doc.container,
    getSendBtn: () => sendBtn,
    fallbackText: 'fallback-line',
    errorLogMessage: 'test chat failed',
  });

  return { ctx, convo, sendBtn };
}

function baseOptions(overrides = {}) {
  const messages = [];
  return {
    buildMessages: (pt) => {
      messages.push({ role: 'user', content: pt });
      return [{ role: 'user', content: pt }];
    },
    tools: [],
    maxTokens: 32,
    cacheKey: null,
    onSuccess: ({ dialogText }) => {
      messages.push({ role: 'assistant', content: dialogText });
    },
    _messages: messages,
    ...overrides,
  };
}

test('generate queues text while generating and drains afterward', async () => {
  let resolveFirst;
  const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
  let chatCalls = 0;

  const { convo } = loadConversationContext({
    loaded: true,
    chat: async () => {
      chatCalls++;
      if (chatCalls === 1) return await firstPromise;
      return { text: 'second reply', toolCalls: [] };
    },
  });

  const opts1 = baseOptions();
  const opts2 = baseOptions();
  const run1 = convo.generate('first', opts1);
  assert.equal(convo.generating, true);

  const run2 = convo.generate('second', opts2);
  assert.equal(convo._pendingPlayerText, 'second');

  resolveFirst({ text: 'first reply', toolCalls: [] });
  await run1;
  await run2;

  assert.equal(opts1._messages.filter((m) => m.role === 'assistant').length, 1);
  assert.equal(opts2._messages.filter((m) => m.role === 'assistant').length, 1);
  assert.equal(convo.generating, false);
});

test('generate uses fallback when LLM.loaded is false', async () => {
  const { convo } = loadConversationContext({ loaded: false });
  const opts = baseOptions({ fallback: () => 'scripted-fallback' });

  await convo.generate('hello', opts);

  assert.equal(opts._messages.at(-1).content, 'scripted-fallback');
});

test('throw in queued drained run does not cause unhandled rejection', async () => {
  let resolveFirst;
  const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
  let chatCalls = 0;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const { convo } = loadConversationContext({
      loaded: true,
      chat: async () => {
        chatCalls++;
        if (chatCalls === 1) return await firstPromise;
        throw new Error('queued run boom');
      },
    });

    const opts1 = baseOptions({
      onSuccess: () => {},
    });
    const opts2 = baseOptions({
      buildMessages: () => { throw new Error('queued run boom'); },
    });

    const run1 = convo.generate('first', opts1);
    convo.generate('second', opts2);
    resolveFirst({ text: 'done', toolCalls: [] });

    await run1;
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(warnings.some((w) => w.includes('Queued chat generation failed')));
  } finally {
    console.warn = originalWarn;
  }
});

test('invalidate aborts in-flight generation before onSuccess runs', async () => {
  let resolveLate;
  const latePromise = new Promise((resolve) => { resolveLate = resolve; });
  let onSuccessCalls = 0;

  const { convo } = loadConversationContext({
    loaded: true,
    chat: async () => await latePromise,
  });

  const opts = baseOptions({
    onSuccess: () => { onSuccessCalls++; },
  });

  const run = convo.generate('hello', opts);
  convo.invalidate();
  resolveLate({ text: 'late reply', toolCalls: [] });
  await run;

  assert.equal(onSuccessCalls, 0);
  assert.equal(opts._messages.filter((m) => m.role === 'assistant').length, 0);
});
