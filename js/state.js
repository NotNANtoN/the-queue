// ============================================================
// GAME STATE
// ============================================================

const PLAYER_OPTIONS = {
  skin: ['#f5d0a9', '#e8b88a', '#dba270', '#c68642', '#8d5524', '#6b3e26', '#3d2217'],
  hair: ['#1a1a2e', '#2d2d2d', '#6b4c2a', '#c4931a', '#e8d44d', '#d14070', '#4a90d9', '#e84a5f', '#ff6b35'],
  hairStyle: ['short', 'buzz', 'curly', 'mohawk', 'long', 'bob', 'ponytail', 'afro', 'bun'],
  shirt: ['#7b75ff', '#0d1b2a', '#1b4332', '#2d2d2d', '#ff4d6d', '#39ff14', '#fd9927', '#e84a5f', '#3c1053'],
  eyeColor: ['#3a5f8a', '#4a90d9', '#4a6741', '#5a3e2b', '#6b5b3a', '#2d4a3a'],
  faceWidth: [6, 7, 8],
  faceHeight: [7, 8, 9],
  eyeSpacing: [3, 4],
  noseSize: [1, 2],
  earSize: [1, 2],
};

const state = {
  phase: 'BOOT',
  selectedVenue: null,
  selectedSquad: [],
  inventory: {},
  cash: 50,
  currentTab: 0,
  audioStarted: false,
  muted: false,
  finalSquad: [],
  progress: null,
  playerLook: { skin: 1, hair: 0, hairStyle: 0, shirt: 0, eyeColor: 1, faceWidth: 1, faceHeight: 1, eyeSpacing: 1, noseSize: 0, earSize: 0 },
  // Phase 1 state
  queue: {
    position: 15,
    hope: 70,
    anxiety: 10,
    gameTime: 23 * 60 + 35,
    neighborFront: null,
    neighborBack: null,
    allNeighbors: [],
    behindNeighbors: [],
    allyData: null,
    revealedIntel: [],
    turnCount: 0,
    lastTickAt: 23 * 60 + 35,
    tickCount: 0,
    waitStreak: 0,
    pendingEvent: null,
    pendingReachFront: false,
    lastEntryWarningShown: false,
    beerDebuff: false,
    hadDrink: false,
    actionLocked: false,
    queuePeople: [],
    animFrame: null,
    activeTraits: [],
    delayedEffects: [],
    allianceFormed: false,
    nightMemories: [],
    crewChatHistory: [],
    crewMemberChats: {},
    startingSquadCount: 0,
    earplugsActive: false,
  },
  llm: { loaded: false, loadFailed: false },
  contactUnlockedThisRun: false,
};

// Squad helpers — match by contact id (preferred) or trait name on CONTACTS entry
function squadHasContact(contactId) {
  return state.finalSquad.some(m => {
    const c = CONTACTS.find(ct => ct.id === m.id || ct.name === m.name);
    return c?.id === contactId;
  });
}

function squadHasTrait(traitName) {
  return state.finalSquad.some(m => {
    const c = CONTACTS.find(ct => ct.id === m.id || ct.name === m.name);
    return c?.trait === traitName;
  });
}

function getBondGainMultiplier() {
  let mult = 1;
  if (squadHasContact('priya')) mult *= 1.5;
  const prog = SaveSystem.load();
  if (prog.equippedOutfits.includes('polaroid')) mult *= 1.5;
  return mult;
}

const Debug = {
  enabled: false,
  entries: [],

  toggle() {
    this.enabled = !this.enabled;
    $('debug-panel')?.classList.toggle('active', this.enabled);
    this.log('debug', this.enabled ? 'enabled' : 'disabled');
  },

  log(label, data) {
    const entry = {
      time: new Date().toLocaleTimeString(),
      label,
      data,
    };
    this.entries.push(entry);
    if (this.entries.length > 80) this.entries.shift();
    if (this.enabled) this.render();
    // Keep console useful even if panel is hidden.
    console.debug('[The Queue Debug]', label, data);
  },

  render() {
    const el = $('debug-log');
    if (!el) return;
    el.textContent = this.entries.map(e => {
      const data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data, null, 2);
      return `[${e.time}] ${e.label}\n${data}`;
    }).join('\n\n');
    el.scrollTop = el.scrollHeight;
  },

  clear() {
    this.entries = [];
    this.render();
  },

  async runToolTests() {
    this.enabled = true;
    $('debug-panel')?.classList.add('active');
    this.log('tool tests', 'starting');

    if (!LLM.loaded) {
      this.log('tool tests', 'LLM not loaded. Start a run first, or wait for the model to finish loading.');
      return;
    }

    const cases = [
      {
        name: 'neighbor: change_affinity',
        tools: NEIGHBOR_TOOLS,
        maxTokens: 64,
        messages: [
          { role: 'system', content: 'You are a queue NPC. The player was kind. Reply with at most five words, and use the change_affinity tool with delta +7.' },
          { role: 'user', content: 'I brought you water because you looked stressed.' },
        ],
      },
      {
        name: 'neighbor: offer_item',
        tools: NEIGHBOR_TOOLS,
        maxTokens: 64,
        messages: [
          { role: 'system', content: 'You are a queue NPC who has gum. Reply with at most five words, and use the offer_item tool with item gum.' },
          { role: 'user', content: 'Do you have any gum?' },
        ],
      },
      {
        name: 'neighbor: form_alliance',
        tools: NEIGHBOR_TOOLS,
        maxTokens: 80,
        messages: [
          { role: 'system', content: 'You are a friendly queue NPC. The player has earned your trust. Reply with at most eight words, and use the form_alliance tool with a short reason.' },
          { role: 'user', content: 'Want to team up and vouch for each other at the door?' },
        ],
      },
      {
        name: 'bouncer: approve',
        tools: BOUNCER_TOOLS,
        maxTokens: 64,
        messages: [
          { role: 'system', content: 'You are a bouncer. The player gave the correct password. Reply with at most five words, and use the approve tool with amount 20 and reason password.' },
          { role: 'user', content: 'The password is Systematic Review.' },
        ],
      },
      {
        name: 'bouncer: reject',
        tools: BOUNCER_TOOLS,
        maxTokens: 64,
        messages: [
          { role: 'system', content: 'You are a strict bouncer. The player was rude. Reply with at most five words, and use the reject tool.' },
          { role: 'user', content: 'Move aside, door guy.' },
        ],
      },
    ];

    for (const testCase of cases) {
      this.log(`tool test: ${testCase.name}`, 'running');
      const result = await LLM.chat(testCase.messages, testCase.tools, testCase.maxTokens);
      this.log(`tool test result: ${testCase.name}`, result || 'no result');
      await sleep(250);
    }

    this.log('tool tests', 'done');
  },
};

