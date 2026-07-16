import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGameModule } from './helpers/load-game-module.mjs';

function createChatContainer() {
  const children = [];
  return {
    children,
    appendChild(el) { children.push(el); },
    scrollTop: 0,
  };
}

function loadBouncerContext() {
  const chatContainer = createChatContainer();
  const createStubEl = () => ({ style: {}, textContent: '', disabled: false, focus() {} });
  const elements = {
    'bouncer-send': { disabled: false, focus() {} },
    'bouncer-input': { value: '', focus() {} },
    'approval-fill': { style: {} },
    'approval-score': { textContent: '' },
    'bouncer-chat': chatContainer,
  };

  const ctx = loadGameModule(
    [
      'js/pixel.js',
      'js/data.js',
      'js/data-phase1.js',
      'js/save.js',
      'js/state.js',
      'js/ui.js',
      'js/llm.js',
      'js/chat.js',
      'js/bouncer.js',
    ],
    {
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      document: {
        createElement: (tag) => {
          if (tag === 'canvas') {
            return {
              width: 8,
              height: 8,
              getContext: () => ({
                clearRect: () => {},
                fillRect: () => {},
                drawImage: () => {},
                fillStyle: '',
              }),
              toDataURL: () => 'data:image/png;base64,',
            };
          }
          return {
            className: '',
            textContent: '',
            innerHTML: '',
            remove() {},
          };
        },
        getElementById: (id) => elements[id] || createStubEl(),
      },
      EventLog: { add: () => {} },
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout: () => {},
      ClubAudio: { ctx: null, lpFilter: null },
      Portrait: { generate: () => '' },
    },
  );

  ctx.LLM.loaded = false;
  ctx.LLM.chat = async () => { throw new Error('LLM.chat should not run in scripted tests'); };

  ctx.state.selectedVenue = 'mainframe';
  ctx.tonightsSecrets = { facts: {}, password: 'Systematic Review', bouncerId: 'florian' };
  ctx.BouncerSystem.bouncer = ctx.BOUNCERS.find((b) => b.id === 'florian');
  ctx.BouncerSystem.approval = 30;
  ctx.BouncerSystem.threshold = 40;
  ctx.BouncerSystem.exchangeCount = 0;
  ctx.BouncerSystem.messages = [];
  ctx.BouncerSystem.finished = false;
  ctx.BouncerSystem.generating = false;
  ctx.BouncerSystem._startTimer = () => {};
  ctx.BouncerSystem._handleVerdict = async (success) => {
    ctx.BouncerSystem._lastVerdict = success;
  };

  return ctx;
}

test('_scriptedBouncerSpeak produces opener on first exchange', async () => {
  const { BouncerSystem } = loadBouncerContext();
  await BouncerSystem._scriptedBouncerSpeak('*A group approaches the door*');
  const assistant = BouncerSystem.messages.find((m) => m.role === 'assistant');
  assert.ok(assistant);
  assert.equal(assistant.content, BouncerSystem._SCRIPTED_OPENERS.florian);
});

test('_scoreScriptedMessage applies positive delta for polite messages', () => {
  const { BouncerSystem } = loadBouncerContext();
  const before = BouncerSystem.approval;
  const delta = BouncerSystem._scoreScriptedMessage('Good evening, thank you for your time.');
  assert.ok(delta > 0);
  BouncerSystem.approval = Math.min(120, before + delta);
  assert.ok(BouncerSystem.approval > before);
});

test('_scoreScriptedMessage applies negative delta for insulting messages', () => {
  const { BouncerSystem } = loadBouncerContext();
  const before = BouncerSystem.approval;
  const delta = BouncerSystem._scoreScriptedMessage('Move aside, you idiot.');
  assert.ok(delta < 0);
  BouncerSystem.approval = Math.max(0, before + delta);
  assert.ok(BouncerSystem.approval < before);
});

test('_scriptedBouncerSpeak triggers verdict at exchange limit', async () => {
  const { BouncerSystem } = loadBouncerContext();
  BouncerSystem.approval = 50;

  await BouncerSystem._scriptedBouncerSpeak('*A group approaches the door*');
  await BouncerSystem._scriptedBouncerSpeak('please let us in, we respect the door');
  await BouncerSystem._scriptedBouncerSpeak('thank you for listening');
  await BouncerSystem._scriptedBouncerSpeak('we would love to get in tonight');

  assert.equal(BouncerSystem.exchangeCount, 4);
  assert.equal(BouncerSystem.finished, true);
  assert.equal(BouncerSystem._lastVerdict, true);
});

test('_bouncerSpeak with LLM unloaded produces scripted reply (regression)', async () => {
  const { BouncerSystem, LLM } = loadBouncerContext();
  LLM.loaded = false;
  const before = BouncerSystem.messages.length;

  await BouncerSystem._bouncerSpeak('*A group approaches the door*');

  assert.ok(BouncerSystem.messages.length > before);
  assert.ok(BouncerSystem.messages.some((m) => m.role === 'assistant'));
});
