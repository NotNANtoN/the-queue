// ============================================================
// GROUP CHAT BANTER
// ============================================================

const GroupChat = {
  lastSpeaker: null,

  SCRIPTED: {
    cold: [
      "{name}: bro it's freezing out here",
      "{name}: my hands are literally numb",
      "{name}: should've worn more layers",
      "{name}: anyone got hand warmers?",
    ],
    bored: [
      "{name}: how long have we been here",
      "{name}: this line is not moving",
      "{name}: I swear we haven't moved in 20 min",
      "{name}: are they even letting people in??",
    ],
    hopeful: [
      "{name}: ok it's moving!! let's go",
      "{name}: we're getting closer, I can feel it",
      "{name}: the music sounds so good from here",
      "{name}: I can see the door now",
    ],
    anxious: [
      "{name}: what if they don't let us in",
      "{name}: do I look ok? be honest",
      "{name}: I heard the bouncer's been tough tonight",
      "{name}: maybe we should have gone somewhere else",
    ],
    vibing: [
      "{name}: this pre-game energy is fire",
      "{name}: best crew, best night",
      "{name}: no matter what happens, glad we came",
      "{name}: ok honestly this wait is kind of fun with you guys",
    ],
    substance: [
      "{name}: yo that glitter is hitting",
      "{name}: everything looks so... nice",
      "{name}: I love you guys. seriously.",
      "{name}: the bass is vibrating through the pavement",
    ],
  },

  async maybeSay() {
    if (Math.random() > 0.6) return;
    if (state.finalSquad.length === 0) return;

    // Pick a squad member (not the same one twice in a row)
    const candidates = state.finalSquad.filter(m => m.name !== this.lastSpeaker);
    const speaker = candidates[Math.floor(Math.random() * candidates.length)] || state.finalSquad[0];
    this.lastSpeaker = speaker.name;

    let msg = '';

    if (LLM.loaded && Math.random() < 0.5) {
      const contact = CONTACTS.find(c => c.name === speaker.name);
      const venue = VENUES.find(v => v.id === state.selectedVenue);
      try {
        const result = await LLM.chat([
          { role: 'system', content: `You are ${speaker.name}, texting in a group chat while waiting in line at ${venue?.name || 'a club'}. Your personality: ${contact?.trait || 'chill'}. You like ${contact?.musicPref || 'music'}. Current mood: hope is ${Math.round(state.queue.hope)}%, anxiety is ${Math.round(state.queue.anxiety)}%. Position in queue: ${state.queue.position}. Write ONE short text message (max 10 words). Be casual, funny, in-character. No emojis. No quotes.` },
        ], null, 30);
        if (result?.text) msg = `${speaker.name}: ${result.text.replace(/^["']|["']$/g, '').trim()}`;
      } catch (e) { msg = ''; }
    }

    if (!msg) {
      let pool;
      const hasSubstance = state.queue.activeTraits.some(t => ['The Vibe', 'Motor Mouth', 'Big Energy'].includes(t));
      if (hasSubstance && Math.random() < 0.3) pool = this.SCRIPTED.substance;
      else if (state.queue.hope > 60) pool = Math.random() < 0.5 ? this.SCRIPTED.hopeful : this.SCRIPTED.vibing;
      else if (state.queue.anxiety > 50) pool = this.SCRIPTED.anxious;
      else if (state.queue.tickCount > 4) pool = this.SCRIPTED.bored;
      else pool = this.SCRIPTED.cold;
      msg = pool[Math.floor(Math.random() * pool.length)].replace('{name}', speaker.name);
    }

    if (msg) {
      notify(msg, { toastMs: 3000, logType: 'info' });
    }
  },
};

// ============================================================
// PHASE 1: QUEUE ENGINE
// ============================================================

const QueueEngine = {
  TICK_MINUTES: 5,

  updateMeters() {
    $('hope-fill').style.width = state.queue.hope + '%';
    $('hope-value').textContent = Math.round(state.queue.hope);
    $('anxiety-fill').style.width = state.queue.anxiety + '%';
    $('anxiety-value').textContent = Math.round(state.queue.anxiety);
    $('q-position').textContent = state.queue.position;
    $('queue-time-label').textContent = this.formatTime(state.queue.gameTime);
    this._updateLastEntryWarning();
  },

  formatTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `FRIDAY ${h12}:${String(m).padStart(2, '0')} ${period}`;
  },

  formatClockTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const periodLabel = h >= 12 ? 'PM' : 'AM';
    return `${h12}:${String(m).padStart(2, '0')} ${periodLabel}`;
  },

  _getQueueCfg() {
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    return QUEUE_CONFIG[venue?.policy || 'Easy'];
  },

  _isSocialOverlayOpen() {
    if (ChatSystem.active || CrewChatSystem.active) return true;
    const kiosk = $('kiosk-overlay');
    return kiosk?.classList?.contains('active') || false;
  },

  resetWaitStreak() {
    state.queue.waitStreak = 0;
  },

  onOverlayClosed() {
    if (state.queue.pendingReachFront && state.queue.position <= 0 && state.phase === 'QUEUE') {
      state.queue.pendingReachFront = false;
      this.reachFront();
      return;
    }
    if (state.queue.pendingEvent) {
      const event = state.queue.pendingEvent;
      state.queue.pendingEvent = null;
      EventLog.add('While you were talking, something happened...', 'info');
      this.showEvent(event);
    }
  },

  advanceTime(minutes) {
    state.queue.gameTime += minutes;

    const hadDrink = state.queue.beerDebuff || state.queue.hadDrink || state.queue.activeTraits.includes('Liquid Courage');
    const soberPenalty = hadDrink ? 1.0 : 1.6;

    this.modAnxiety(minutes * 0.4 * soberPenalty);
    this.modHope(-minutes * 0.3 * soberPenalty);

    this._processTimeTicks();

    if (state.phase === 'QUEUE' && !state.queue.pendingReachFront && state.queue.position > 0) {
      const cfg = this._getQueueCfg();
      if (state.queue.gameTime >= cfg.lastEntry) {
        this.missedLastEntry();
      }
    }
  },

  _processTimeTicks() {
    while (state.queue.gameTime >= state.queue.lastTickAt + this.TICK_MINUTES) {
      state.queue.lastTickAt += this.TICK_MINUTES;
      state.queue.tickCount++;
      const reached = this.moveQueue();
      if (reached || state.phase !== 'QUEUE') return;
      this.checkEvent();
      if (state.phase !== 'QUEUE') return;
    }
  },

  _updateLastEntryWarning() {
    const warnEl = $('queue-cutoff-warning');
    if (!warnEl || state.phase !== 'QUEUE') return;

    const cfg = this._getQueueCfg();
    const minsLeft = cfg.lastEntry - state.queue.gameTime;

    if (minsLeft > 30 || minsLeft <= 0) {
      warnEl.textContent = '';
      warnEl.classList.remove('active');
      return;
    }

    warnEl.textContent = `last entry ${minsLeft} min`;
    warnEl.classList.add('active');

    if (!state.queue.lastEntryWarningShown) {
      state.queue.lastEntryWarningShown = true;
      const cutoffLabel = this.formatClockTime(cfg.lastEntry);
      EventLog.add(`Last entry at ${cutoffLabel} — ${minsLeft} min left`, 'negative');
      notify(`Last entry in ${minsLeft} min`, { toastMs: 2500, logType: 'negative' });
    }
  },

  _tickBonus(tickCount) {
    return Math.min(0.20, tickCount * 0.02);
  },

  _turnBonus(turnCount) {
    return this._tickBonus(turnCount);
  },

  rollMove(cfg, tickCount, rng, opts = {}) {
    const moveChanceBoost = opts.kaiBoost ? 1.15 : 1;
    const turnBonus = this._tickBonus(tickCount);
    if (rng() >= (cfg.moveChance + turnBonus) * moveChanceBoost) {
      return { moved: false, amount: 0 };
    }

    let moveMin = cfg.moveMin;
    let moveMax = cfg.moveMax;
    if (opts.jasperBoost) {
      const avg = (moveMin + moveMax) / 2;
      const halfSpan = Math.max(0, (moveMax - moveMin) / 4);
      moveMin = Math.max(cfg.moveMin, Math.round(avg - halfSpan));
      moveMax = Math.min(cfg.moveMax, Math.round(avg + halfSpan));
      if (moveMin > moveMax) moveMax = moveMin;
    }

    const amount = moveMin + Math.floor(rng() * (moveMax - moveMin + 1));
    return { moved: true, amount };
  },

  modHope(delta) {
    state.queue.hope = Math.max(0, Math.min(100, state.queue.hope + delta));
    this.updateMeters();
    if (state.queue.hope <= 0) this.squadBailsAll();
  },

  modAnxiety(delta) {
    if (delta > 0) {
      let mult = 1;
      // Passive earplugs: −40% anxiety gain while owned and not actively used tonight
      const hasPassiveEarplugs = (state.inventory.earplugs || 0) > 0 && !state.queue.earplugsActive;
      if (hasPassiveEarplugs) mult *= 0.6;
      // Active earplugs use: halve anxiety gains for the rest of the night
      if (state.queue.earplugsActive) mult *= 0.5;
      if (squadHasContact('yuki')) mult *= 0.75;
      if (squadHasContact('kai')) mult *= 1.2;
      delta *= mult;
    }

    state.queue.anxiety = Math.max(0, Math.min(100, state.queue.anxiety + delta));
    this.updateMeters();
    if (state.queue.anxiety >= 100 && state.finalSquad.length > 0) this.squadMemberBails();
  },

  moveQueue() {
    const cfg = this._getQueueCfg();
    const roll = this.rollMove(cfg, state.queue.tickCount, () => Math.random(), {
      kaiBoost: squadHasContact('kai'),
      jasperBoost: squadHasContact('jasper'),
    });

    if (!roll.moved) {
      this.modAnxiety(2);
      return false;
    }

    const amount = roll.amount;
    state.queue.position = Math.max(0, state.queue.position - amount);
    this.modHope(amount * 4);

    if (state.queue.allNeighbors.length > 0) {
      state.queue.neighborFront = state.queue.allNeighbors[state.queue.allNeighbors.length - 1];
    }

    this.rebuildQueueViz();

    if (this._isSocialOverlayOpen()) {
      const msg = `The line shuffles forward — you're #${state.queue.position} now`;
      if (ChatSystem.active) ChatSystem.addBubble(msg, 'system-msg');
      else if (CrewChatSystem.active) CrewChatSystem.addBubble(msg, 'system-msg');
    } else {
      notify(`Queue moved! +${amount} positions`, { toastMs: 1500, logType: 'positive', logMsg: `Queue moved forward +${amount} positions` });
    }

    if (state.queue.position <= 0) {
      if (this._isSocialOverlayOpen()) {
        state.queue.pendingReachFront = true;
        return true;
      }
      this.reachFront();
      return true;
    }
    return false;
  },

  checkEvent() {
    const cfg = this._getQueueCfg();
    const eventChance = cfg.eventChance * (squadHasContact('sasha') ? 1.5 : 1);
    if (Math.random() >= eventChance) return false;

    const event = this._pickRandomEvent();
    if (this._isSocialOverlayOpen()) {
      state.queue.pendingEvent = event;
      return true;
    }
    this.showEvent(event);
    EventLog.add(`${event.icon} ${event.title}`, event.effects[0]?.cls === 'positive' ? 'positive' : 'negative');
    return true;
  },

  _pickRandomEvent() {
    const events = [
      {
        id: 'line_cutter', icon: '😤', title: 'Line Cutters!',
        desc: 'A flashy group of 4 pushes ahead of you. They clearly know someone.',
        effects: [{ label: 'Confront: hold spot', cls: 'neutral' }, { label: 'Ignore: −2 positions', cls: 'negative' }],
        choices: [
          { label: '😤 Confront them', action: () => {
            this.modAnxiety(8);
            this.modHope(-3);
            if (Math.random() < 0.2) {
              state.queue.position += 1;
              this.modHope(-5);
              QueueEngine.rebuildQueueViz();
              EventLog.add('Confrontation escalated — you lost a spot', 'negative');
              showToast('They shoved back — you lost a spot', 2000);
            } else {
              EventLog.add('You stood your ground — spot held', 'info');
              showToast('They back off but give you dirty looks', 2000);
            }
          } },
          { label: '💸 Bribe them ($10)', action: () => { if (state.cash >= 10) { state.cash -= 10; showToast("They let you keep your spot", 2000); } else { showToast("Not enough cash", 1500); state.queue.position += 2; this.modHope(-10); } }, },
          { label: '😑 Ignore it', action: () => { state.queue.position += 2; this.modHope(-5); QueueCanvas.layoutPeople(); EventLog.add('Line cutters took 2 spots ahead of you', 'negative'); } },
        ],
      },
      {
        id: 'someone_leaves', icon: '👋', title: 'Someone Left!',
        desc: 'A group ahead of you gives up and walks away. The queue shuffles forward.',
        effects: [{ label: 'Position +1', cls: 'positive' }, { label: 'Hope +5', cls: 'positive' }],
        choices: [
          { label: 'Nice', action: () => { state.queue.position = Math.max(0, state.queue.position - 1); this.modHope(5); QueueCanvas.layoutPeople(); } },
        ],
      },
      {
        id: 'vip_skip', icon: '🕶️', title: 'VIP Skip',
        desc: 'A VIP group walks past the entire line and goes straight in. The bouncer holds the rope open for them.',
        effects: [{ label: 'Hope −15', cls: 'negative' }, { label: 'Anxiety +10', cls: 'negative' }],
        choices: [
          { label: 'Sigh...', action: () => { this.modHope(-15); this.modAnxiety(10); } },
        ],
      },
      {
        id: 'contact_antsy', icon: '😰', title: 'Squad Member Antsy',
        desc: state.finalSquad.length > 0
          ? `${state.finalSquad[0]?.name || 'Your friend'} is getting restless. "How much longer is this gonna take?"`
          : 'You feel your own patience wearing thin.',
        effects: [{ label: 'Anxiety +6', cls: 'negative' }],
        choices: state.finalSquad.length > 0 ? [
          { label: '🤝 Reassure them', action: () => { this.modAnxiety(-3); showToast("They calm down... for now", 1500); } },
          { label: '🍺 Buy them a drink ($8)', action: () => { if (state.cash >= 8) { state.cash -= 8; this.modAnxiety(-5); showToast("They cheer up", 1500); } else { this.modAnxiety(6); showToast("No cash. They're annoyed.", 1500); } } },
          { label: '🚶 Let them go', action: () => { if (state.finalSquad.length > 0) { const gone = state.finalSquad.shift(); showToast(`${gone.name} left the queue`, 2000); this.modHope(-8); } } },
        ] : [
          { label: 'Take a deep breath', action: () => { this.modAnxiety(3); } },
        ],
      },
    ];

    // Additional atmosphere events (no choice needed)
    const atmoEvents = [
      {
        id: 'person_gives_up', icon: '🚶', title: 'Someone Gave Up',
        desc: 'A person a few spots ahead sighs, checks their phone, and walks away into the night.',
        effects: [{ label: 'Position +1', cls: 'positive' }, { label: 'Hope +3', cls: 'positive' }],
        choices: [{ label: 'Their loss', action: () => { state.queue.position = Math.max(0, state.queue.position - 1); this.modHope(3); this.rebuildQueueViz(); EventLog.add('Someone ahead gave up and left', 'positive'); } }],
      },
      {
        id: 'queue_grows', icon: '👥', title: 'Queue Growing',
        desc: 'You look behind you — the line has grown way longer since you arrived. At least you\'re ahead of them.',
        effects: [{ label: 'Hope +2', cls: 'positive' }],
        choices: [{ label: 'Glad we came early', action: () => {
          this.modHope(2);
          // Add 3-5 persistent people behind you
          const newCount = 3 + Math.floor(Math.random() * 3);
          for (let i = 0; i < newCount; i++) {
            const newNeighbor = generateNeighbor(state.selectedVenue, state.queue.revealedIntel);
            state.queue.behindNeighbors.push(newNeighbor);
          }
          // Update back neighbor to the closest person behind
          state.queue.neighborBack = state.queue.behindNeighbors[0] || null;
          // Rebuild viz with new people
          this.rebuildQueueViz();
          EventLog.add(`${newCount} people joined the queue behind you`, 'info');
        } }],
      },
      {
        id: 'bouncer_scans', icon: '👁️', title: 'Bouncer Scanning',
        desc: 'The bouncer steps out and slowly scans the line. His gaze lingers on your group for a moment.',
        effects: [{ label: 'Anxiety +6', cls: 'negative' }],
        choices: [
          { label: '😎 Stand tall', action: () => { this.modAnxiety(3); EventLog.add('Bouncer scanned the line — you held your ground', 'info'); } },
          { label: '👀 Look away', action: () => { this.modAnxiety(6); EventLog.add('Bouncer scanned the line — you avoided eye contact', 'negative'); } },
        ],
      },
      {
        id: 'group_leaves', icon: '😤', title: 'Group Storms Off',
        desc: '"This is ridiculous!" A group of 3 ahead of you gives up and storms off. The queue shuffles forward.',
        effects: [{ label: 'Position +3', cls: 'positive' }, { label: 'Hope +8', cls: 'positive' }],
        choices: [{ label: 'Big moves', action: () => { state.queue.position = Math.max(0, state.queue.position - 3); this.modHope(8); this.rebuildQueueViz(); EventLog.add('A whole group ahead gave up — +3 positions!', 'positive'); } }],
      },
    ];

    events.push(...atmoEvents);

    // Filter: only show contact_antsy if we have squad
    const pool = events.filter(e => e.id !== 'contact_antsy' || state.finalSquad.length > 0 || Math.random() < 0.3);
    return pool[Math.floor(Math.random() * pool.length)];
  },

  triggerRandomEvent() {
    const event = this._pickRandomEvent();
    this.showEvent(event);
    EventLog.add(`${event.icon} ${event.title}`, event.effects[0]?.cls === 'positive' ? 'positive' : 'negative');
  },

  showEvent(event) {
    state.queue.actionLocked = true;
    const card = $('event-card');
    card.innerHTML = `
      <div class="event-icon">${event.icon}</div>
      <div class="event-title">${event.title}</div>
      <div class="event-desc">${event.desc}</div>
      <div class="event-effects">
        ${event.effects.map(e => `<span class="effect-tag ${e.cls}">${e.label}</span>`).join('')}
      </div>
      <div class="event-choices">
        ${event.choices.map((c, i) => `<button class="event-choice-btn" data-choice="${i}">${c.label}</button>`).join('')}
      </div>
    `;
    $('event-overlay').classList.add('active');

    card.querySelectorAll('.event-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.choice);
        event.choices[idx]?.action();
        $('event-overlay').classList.remove('active');
        state.queue.actionLocked = false;
        this.updateMeters();
        if (state.queue.position <= 0) this.reachFront();
      });
    });
  },

  squadMemberBails() {
    if (state.finalSquad.length === 0) return;
    const idx = Math.floor(Math.random() * state.finalSquad.length);
    const gone = state.finalSquad.splice(idx, 1)[0];
    showToast(`${gone.name} couldn't take it anymore and left`, 3000);
    state.queue.anxiety = Math.max(state.queue.anxiety - 20, 30);
    this.modHope(-10);
  },

  squadBailsAll() {
    showToast("You've lost all hope. Everyone goes home.", 3000);
    setTimeout(() => this.gameOver(), 2000);
  },

  reachFront() {
    state.queue.position = 0;
    QueueCanvas.stopLoop();
    notify('You reached the front...', { toastMs: 2000, logType: 'positive', logMsg: 'Reached the front of the queue!' });
    setTimeout(() => {
      $('queue-screen').classList.remove('active');
      BouncerSystem.start();
    }, 2500);
  },

  async missedLastEntry() {
    if (state.phase !== 'QUEUE') return;
    state.phase = 'ENDED';
    state.queue.pendingEvent = null;
    state.queue.pendingReachFront = false;
    if (ChatSystem.active) ChatSystem.close();
    if (CrewChatSystem.active) CrewChatSystem.close();
    $('kiosk-overlay')?.classList.remove('active');
    QueueCanvas.stopLoop();
    $('queue-screen').classList.remove('active');
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const cfg = this._getQueueCfg();
    const cutoffLabel = this.formatClockTime(cfg.lastEntry);
    const subtitle = `The door shut at ${cutoffLabel}. The night walks home without you.`;

    await WalkOfShame.play(subtitle);

    const overlay = $('result-overlay');
    overlay.className = 'result-overlay active failure';
    $('result-title').className = 'result-title lose';
    $('result-title').textContent = 'Last Entry';
    $('result-subtitle').textContent = subtitle;

    const waitTime = state.queue.gameTime - (23 * 60 + 35);
    $('result-stats').innerHTML = `
      <div class="result-row"><span class="rl">Reason</span><span class="rv">Missed last entry</span></div>
      <div class="result-row"><span class="rl">Cutoff</span><span class="rv">${cutoffLabel}</span></div>
      <div class="result-row"><span class="rl">Time waited</span><span class="rv">${waitTime} min</span></div>
      <div class="result-row"><span class="rl">Position</span><span class="rv">#${state.queue.position}</span></div>
      <div class="result-row"><span class="rl">Cash remaining</span><span class="rv">$${state.cash}</span></div>
    `;

    SaveSystem.recordRun(false, venue?.id);
    SaveSystem.applyToState();
    renderPlayerBadge();

    const brokenStreak = state.brokenStreak || 0;
    if (brokenStreak >= 2) {
      $('result-stats').innerHTML += `<div class="result-row"><span class="rl" style="color:var(--neon-red)">Streak broken</span><span class="rv" style="color:var(--neon-red)">Was ${brokenStreak} in a row</span></div>`;
    }

    $('result-btn').textContent = 'Try Again';
    $('result-btn').onclick = () => {
      overlay.classList.remove('active');
      restartPlanning();
    };
  },

  showDoorRead() {
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    if (!venue) return;

    const policy = venue.policy || 'Easy';
    const styleBonus = BouncerSystem.calcStyleMatch(venue);
    const hasLook = styleBonus > 0;
    const hasIntel = state.queue.revealedIntel.length > 0;
    const hasAlly = !!state.queue.allyData;
    const hasCharmer = state.queue.activeTraits.includes('Charmer');
    const hasNiko = squadHasContact('niko');

    const check = (ok) => ok ? '✓' : '✗';

    const card = $('door-read-card');
    card.innerHTML = `
      <div class="event-title">${escapeHtml(venue.name)}</div>
      <div class="event-desc">Dress code: ${escapeHtml(venue.dressCode || 'Unknown')}</div>
      <div class="event-desc" style="margin-top:8px;font-style:italic;">${escapeHtml(DOOR_STRICTNESS[policy] || '')}</div>
      <div class="event-effects" style="margin-top:12px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="effect-tag ${hasLook ? 'positive' : 'neutral'}">${check(hasLook)} Look</span>
        <span class="effect-tag ${hasIntel ? 'positive' : 'neutral'}">${check(hasIntel)} Intel</span>
        <span class="effect-tag ${hasAlly ? 'positive' : 'neutral'}">${check(hasAlly)} Ally</span>
        <span class="effect-tag ${hasCharmer ? 'positive' : 'neutral'}">${check(hasCharmer)} Charmer</span>
        ${hasNiko ? '<span class="effect-tag positive">✓ Niko has the bouncer\'s respect</span>' : ''}
      </div>
      <div class="event-choices">
        <button class="event-choice-btn" id="door-read-close">Close</button>
      </div>
    `;
    $('door-read-overlay').classList.add('active');
    $('door-read-close').addEventListener('click', () => this.hideDoorRead());
  },

  hideDoorRead() {
    $('door-read-overlay').classList.remove('active');
  },

  async gameOver() {
    QueueCanvas.stopLoop();
    $('queue-screen').classList.remove('active');
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    await WalkOfShame.play('You lost all hope and went home.');

    const overlay = $('result-overlay');
    overlay.className = 'result-overlay active failure';
    $('result-title').className = 'result-title lose';
    $('result-title').textContent = 'Hopeless';
    $('result-subtitle').textContent = 'You lost all hope and everyone went home.';

    const waitTime = state.queue.gameTime - (23 * 60 + 35);
    const intelCount = state.queue.revealedIntel.length;
    const traitCount = state.queue.activeTraits.length;
    const squadIntact = state.finalSquad.length === (state.queue.startingSquadCount || 0);

    $('result-stats').innerHTML = `
      <div class="result-row"><span class="rl">Reason</span><span class="rv">Hope reached zero</span></div>
      <div class="result-row"><span class="rl">Intel gathered</span><span class="rv">${intelCount}</span></div>
      <div class="result-row"><span class="rl">Active traits</span><span class="rv">${traitCount}</span></div>
      <div class="result-row"><span class="rl">Time waited</span><span class="rv">${waitTime} min</span></div>
      <div class="result-row"><span class="rl">Squad intact</span><span class="rv">${squadIntact ? 'Yes' : 'No'}</span></div>
      <div class="result-row"><span class="rl">Cash remaining</span><span class="rv">$${state.cash}</span></div>
    `;

    SaveSystem.recordRun(false, venue?.id);
    const promotedMemories = MemorySystem.promoteNightMemories(false, venue?.id);
    SaveSystem.applyToState();
    renderPlayerBadge();
    const prog = SaveSystem.load();
    const newContacts = SaveSystem.getPendingUnlocks();

    const brokenStreak = state.brokenStreak || 0;
    if (brokenStreak >= 2) {
      $('result-stats').innerHTML += `<div class="result-row"><span class="rl" style="color:var(--neon-red)">Streak broken</span><span class="rv" style="color:var(--neon-red)">Was ${brokenStreak} in a row</span></div>`;
    }

    if (newContacts.length > 0) {
      const contactLines = newContacts.map(u => `
        <div class="result-row"><span class="rl" style="color:var(--neon-green)">🆕 New contact</span><span class="rv" style="color:var(--neon-green)">${u.name} (met in ${u.where})</span></div>
      `).join('');
      $('result-stats').innerHTML += contactLines;
    }

    if (promotedMemories.length > 0) {
      const memoryLines = promotedMemories.slice(0, 3).map(m => `
        <div class="result-row"><span class="rl" style="color:var(--neon-cyan)">Memory saved</span><span class="rv" style="color:var(--neon-cyan)">${m.sourceName}: ${m.text}</span></div>
      `).join('');
      $('result-stats').innerHTML += memoryLines;
    }

    const nextJob = SaveSystem.JOBS.slice().reverse().find(j => prog.reputation >= j.minRep) || SaveSystem.JOBS[0];
    $('result-stats').innerHTML += `
      <div class="result-row" style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:8px;">
        <span class="rl">Reputation</span><span class="rv" style="color:var(--neon-gold);">★ ${prog.reputation}</span>
      </div>
      <div class="result-row"><span class="rl">Job</span><span class="rv">${nextJob.name} ($${nextJob.pay}/week)</span></div>
      <div class="result-row"><span class="rl">Savings</span><span class="rv">$${state.cash}</span></div>
      <div class="result-row"><span class="rl">Venues cleared</span><span class="rv">${SaveSystem.uniqueVenuesClearedCount(prog)} / ${VENUES.length}</span></div>
    `;

    $('result-btn').textContent = 'Try Again';
    $('result-btn').onclick = () => {
      overlay.classList.remove('active');
      restartPlanning();
    };
  },

  rebuildQueueViz() {
    const pos = state.queue.position;
    const people = state.queue.queuePeople;
    const playerIdx = people.findIndex(p => p.isPlayer);

    if (playerIdx > pos && playerIdx >= 0) {
      // Remove people from the front (they got in)
      const toRemove = playerIdx - pos;
      state.queue.queuePeople = people.slice(toRemove);
      // Also remove those neighbors from the persistent list
      state.queue.allNeighbors = state.queue.allNeighbors.slice(toRemove);
      // Update front neighbor
      state.queue.neighborFront = state.queue.allNeighbors[state.queue.allNeighbors.length - 1] || null;
      // Smooth layout
      QueueCanvas.layoutPeople(false);
    } else {
      // Full rebuild using persistent data
      const squadLen = state.finalSquad.length;
      const behindCount = state.queue.behindNeighbors.length;
      const totalPeople = pos + 1 + squadLen + behindCount;
      QueueCanvas.generatePeople(totalPeople, pos, state.finalSquad);
    }
  },

  addTrait(traitName) {
    if (!TRAIT_DEFS[traitName]) return;
    if (state.queue.activeTraits.includes(traitName)) return;
    // Too many substances = Dead Eyes
    const substanceTraits = ['The Vibe', 'Motor Mouth', 'Big Energy', 'Liquid Courage'];
    const activeSubstances = state.queue.activeTraits.filter(t => substanceTraits.includes(t));
    if (activeSubstances.length >= 2 && substanceTraits.includes(traitName)) {
      state.queue.activeTraits = state.queue.activeTraits.filter(t => !substanceTraits.includes(t));
      state.queue.activeTraits.push('Dead Eyes');
      showToast('💀 Too much... everything feels heavy', 2500);
    } else {
      state.queue.activeTraits.push(traitName);
      const def = TRAIT_DEFS[traitName];
      notify(`Trait acquired: ${traitName}`, { toastMs: 2000, logType: 'trait', logMsg: `Trait acquired: ${traitName} — ${def.desc}` });
    }
    this.renderTraits();
  },

  renderTraits() {
    let container = $('trait-display');
    if (!container) {
      container = document.createElement('div');
      container.id = 'trait-display';
      container.style.cssText = 'display:flex;gap:6px;padding:4px 16px 6px;flex-wrap:wrap;background:rgba(8,6,26,0.95);';
      const hud = document.querySelector('.queue-hud');
      hud.parentNode.insertBefore(container, hud);
    }
    if (state.queue.activeTraits.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.innerHTML = state.queue.activeTraits.map(t => {
      const def = TRAIT_DEFS[t];
      if (!def) return '';
      const iconHtml = def.px ? PX.i(def.px, def.color, 12) : '';
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:8px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:rgba(${parseInt(def.color.slice(1,3),16)},${parseInt(def.color.slice(3,5),16)},${parseInt(def.color.slice(5,7),16)},0.12);color:${def.color};border:1px solid ${def.color}33;" title="${def.desc}">${iconHtml} ${t}</span>`;
    }).join('');
  },

  processDelayedEffects() {
    const remaining = [];
    for (const eff of state.queue.delayedEffects) {
      eff.turnsLeft--;
      if (eff.turnsLeft <= 0) {
        if (eff.anxiety) this.modAnxiety(eff.anxiety);
        if (eff.hope) this.modHope(eff.hope);
        if (eff.trait) this.addTrait(eff.trait);
        showToast(`${eff.label || 'Something kicked in...'}`, 2000);
      } else {
        remaining.push(eff);
      }
    }
    state.queue.delayedEffects = remaining;
  },

  async doWait() {
    if (state.queue.actionLocked) return;
    state.queue.actionLocked = true;

    state.queue.waitStreak++;
    const streak = state.queue.waitStreak;
    let extraAnxiety = 0;
    if (streak >= 4) extraAnxiety = 6;
    else if (streak === 3) extraAnxiety = 4;
    else if (streak === 2) extraAnxiety = 2;

    this.advanceTime(5);

    if (extraAnxiety > 0) {
      if (streak === 2) EventLog.add('Standing in silence is getting to you', 'info');
      this.modAnxiety(extraAnxiety);
    }

    this.processDelayedEffects();
    this.updateMeters();

    if (state.phase !== 'QUEUE') return;

    if (state.queue.tickCount <= 3 && state.queue.behindNeighbors.length < 6) {
      const arrivals = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < arrivals; i++) {
        const n = generateNeighbor(state.selectedVenue, state.queue.revealedIntel);
        state.queue.behindNeighbors.push(n);
      }
      state.queue.neighborBack = state.queue.behindNeighbors[0];
      this.rebuildQueueViz();
      if (state.queue.tickCount === 1) {
        showToast('People are lining up behind you...', 1500);
      }
    }

    if (state.finalSquad.length > 0) {
      await GroupChat.maybeSay();
    }

    await sleep(600);

    if (state.phase !== 'QUEUE') return;

    if (!state.queue.pendingEvent && !$('event-overlay')?.classList?.contains('active')) {
      state.queue.actionLocked = false;
    }
    this.updateMeters();
  },
};

