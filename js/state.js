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
    revealedIntel: [],
    turnCount: 0,
    beerDebuff: false,
    actionLocked: false,
    queuePeople: [],
    animFrame: null,
    activeTraits: [],
    delayedEffects: [],
    memberStats: {},
    nightMemories: [],
    crewChatHistory: [],
    crewMemberChats: {},
    startingSquadCount: 0,
    warmthBonus: 0,
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

// ============================================================
// PER-MEMBER STATS
// ============================================================

const MemberStats = {
  init(squad) {
    state.queue.memberStats = {};
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    squad.forEach(member => {
      const contact = CONTACTS.find(c => c.name === member.name);
      const warmthRate = contact?.styles?.some(s => ['Dark Minimal', 'All Black', 'Chains'].includes(s)) ? 0.3 : 0.6;

      // Music affinity boost to starting morale
      let moraleBonus = 0;
      if (contact?.musicPref && venue?.music) {
        if (contact.musicPref === venue.music) moraleBonus = 15;
        else moraleBonus = -5;
      }

      // Bond with other squad members boosts morale
      const otherIds = squad.filter(m => m.name !== member.name).map(m => CONTACTS.find(c => c.name === m.name)?.id).filter(Boolean);
      const friendBonus = otherIds.reduce((sum, otherId) => {
        const bond = SaveSystem.getBond(contact?.id || '', otherId);
        return sum + (bond >= 30 ? 5 : bond > 0 ? 2 : 0);
      }, 0);

      state.queue.memberStats[member.name] = {
        warmth: 100 + (state.queue.warmthBonus || 0),
        morale: Math.min(100, 80 + Math.random() * 20 + moraleBonus + friendBonus),
        warmthDecay: warmthRate,
        anxietyThreshold: contact?.anxiety ? contact.anxiety * 10 : 60,
      };
    });
  },

  tick(minutes) {
    const stats = state.queue.memberStats;
    for (const name of Object.keys(stats)) {
      const s = stats[name];
      s.warmth = Math.max(0, s.warmth - s.warmthDecay * minutes);
      s.morale = Math.max(0, s.morale - 0.2 * minutes);

      if (state.queue.anxiety > s.anxietyThreshold) {
        s.morale = Math.max(0, s.morale - 0.5 * minutes);
      }

      if (s.warmth <= 10 || s.morale <= 10) {
        this.memberLeaves(name);
      }
    }
    this.render();
  },

  memberLeaves(name) {
    const idx = state.finalSquad.findIndex(m => m.name === name);
    if (idx < 0) return;
    const stats = state.queue.memberStats[name];

    const reason = stats?.warmth <= 10
      ? `${name} is freezing and went home`
      : `${name}'s morale collapsed — they left`;
    state.finalSquad.splice(idx, 1);
    delete state.queue.memberStats[name];
    notify(reason, { toastMs: 2500, logType: 'negative' });
    QueueEngine.modHope(-8);
    this.render();
  },

  boostWarmth(name, amount) {
    const s = state.queue.memberStats[name];
    if (s) s.warmth = Math.min(100, s.warmth + amount);
    this.render();
  },

  boostMorale(name, amount) {
    const s = state.queue.memberStats[name];
    if (s) s.morale = Math.min(100, s.morale + amount);
    this.render();
  },

  render() {
    let container = $('squad-status-bar');
    if (!container) {
      container = document.createElement('div');
      container.id = 'squad-status-bar';
      container.className = 'squad-status-bar';
      const timeDisplay = $('queue-time-display');
      if (timeDisplay) timeDisplay.after(container);
    }
    if (state.finalSquad.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.innerHTML = state.finalSquad.map(m => {
      const s = state.queue.memberStats[m.name];
      if (!s) return '';
      const warmthPct = Math.min(100, s.warmth);
      const avg = (warmthPct + s.morale) / 2;
      const vibeColor = avg > 60 ? '#39ff14' : avg > 30 ? '#fd9927' : '#ff4d6d';
      const contact = CONTACTS.find(c => c.name === m.name);
      const portrait = contact?.portraitProps ? Portrait.generate(contact.portraitProps, 'friendly', []) : '';
      return `<div class="member-chip" data-member="${m.name}">
        <div class="mc-portrait">${portrait ? `<img src="${portrait}" alt="${m.name}">` : ''}</div>
        <span class="mc-name" style="color:${m.color || '#ebe4ff'}">${m.name}</span>
        <span class="mc-vibe"><span class="mc-vibe-fill" style="width:${avg}%;background:${vibeColor};"></span></span>
      </div>`;
    }).join('');

    container.querySelectorAll('.member-chip').forEach(chip => {
      chip.addEventListener('click', () => this.showDetail(chip.dataset.member));
    });
  },

  showDetail(name) {
    const s = state.queue.memberStats[name];
    if (!s) return;
    const m = state.finalSquad.find(sq => sq.name === name);
    const contact = CONTACTS.find(c => c.name === name);
    const portrait = contact?.portraitProps ? Portrait.generate(contact.portraitProps, 'friendly', []) : '';
    const warmthPct = Math.min(100, s.warmth);

    const content = $('member-detail-content');
    content.innerHTML = `
      <div class="member-detail-header">
        <div class="member-detail-portrait">${portrait ? `<img src="${portrait}" alt="${name}">` : ''}</div>
        <div>
          <div class="member-detail-name" style="color:${m?.color || '#fff'}">${name}</div>
          <div class="member-detail-trait">${contact?.trait || ''} — ${contact?.traitDesc || ''}</div>
        </div>
      </div>
      <div class="member-detail-meters">
        <div class="md-meter">
          ${PX.i('fire','#ff6b35',14)}
          <span class="md-meter-label">Warmth</span>
          <div class="md-meter-track"><div class="md-meter-fill" style="width:${warmthPct}%;background:${s.warmth > 60 ? '#39ff14' : s.warmth > 30 ? '#fd9927' : '#ff4d6d'};"></div></div>
          <span class="md-meter-val" style="color:${s.warmth > 60 ? '#39ff14' : s.warmth > 30 ? '#fd9927' : '#ff4d6d'}">${Math.round(s.warmth)}</span>
        </div>
        <div class="md-meter">
          ${PX.i('heart','#ff69b4',14)}
          <span class="md-meter-label">Morale</span>
          <div class="md-meter-track"><div class="md-meter-fill" style="width:${s.morale}%;background:${s.morale > 60 ? '#ffd86b' : s.morale > 30 ? '#fd9927' : '#ff4d6d'};"></div></div>
          <span class="md-meter-val" style="color:${s.morale > 60 ? '#ffd86b' : s.morale > 30 ? '#fd9927' : '#ff4d6d'}">${Math.round(s.morale)}</span>
        </div>
        <div class="md-meter">
          ${PX.i('shield','#57f2ff',14)}
          <span class="md-meter-label">Anxiety</span>
          <div class="md-meter-track"><div class="md-meter-fill" style="width:${Math.min(100, s.anxietyThreshold)}%;background:rgba(255,255,255,0.1);"></div></div>
          <span class="md-meter-val" style="color:var(--text-muted)">lv${Math.round(s.anxietyThreshold / 10)}</span>
        </div>
      </div>
      <div style="margin-top:10px;font-size:10px;color:var(--text-muted);">
        ${PX.i('note','#666',10)} Likes: ${contact?.musicPref || '?'} · 
        Styles: ${contact?.styles?.join(', ') || '?'}
      </div>
      <button class="event-choice-btn" id="talk-member-btn" style="margin-top:12px;text-align:center;">Talk to ${name}</button>
    `;

    $('member-detail').classList.add('open');
    $('talk-member-btn')?.addEventListener('click', () => {
      $('member-detail').classList.remove('open');
      CrewChatSystem.openMember(name);
    });
  },
};

