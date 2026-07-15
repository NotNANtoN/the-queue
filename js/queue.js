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
      else if (state.queue.turnCount > 4) pool = this.SCRIPTED.bored;
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
  updateMeters() {
    $('hope-fill').style.width = state.queue.hope + '%';
    $('hope-value').textContent = Math.round(state.queue.hope);
    $('anxiety-fill').style.width = state.queue.anxiety + '%';
    $('anxiety-value').textContent = Math.round(state.queue.anxiety);
    $('q-position').textContent = state.queue.position;
    $('queue-time-display').textContent = this.formatTime(state.queue.gameTime);
  },

  formatTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `FRIDAY ${h12}:${String(m).padStart(2, '0')} ${period}`;
  },

  advanceTime(minutes) {
    state.queue.gameTime += minutes;

    // Sober penalty: morale/hope drops faster if you haven't had a drink
    const hadDrink = state.queue.beerDebuff || state.queue.hadDrink || state.queue.activeTraits.includes('Liquid Courage');
    const soberPenalty = hadDrink ? 1.0 : 1.6;

    this.modAnxiety(minutes * 0.4 * soberPenalty);
    this.modHope(-minutes * 0.3 * soberPenalty);
    MemberStats.tick(minutes);
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
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const cfg = QUEUE_CONFIG[venue?.policy || 'Easy'];
    const moveChanceBoost = squadHasContact('kai') ? 1.15 : 1;
    if (Math.random() < (cfg.moveChance + state.queue.turnCount * 0.02) * moveChanceBoost) {
      let moveMin = cfg.moveMin;
      let moveMax = cfg.moveMax;
      if (squadHasContact('jasper')) {
        const avg = (moveMin + moveMax) / 2;
        const halfSpan = Math.max(0, (moveMax - moveMin) / 4);
        moveMin = Math.max(cfg.moveMin, Math.round(avg - halfSpan));
        moveMax = Math.min(cfg.moveMax, Math.round(avg + halfSpan));
        if (moveMin > moveMax) moveMax = moveMin;
      }
      const amount = moveMin + Math.floor(Math.random() * (moveMax - moveMin + 1));
      state.queue.position = Math.max(0, state.queue.position - amount);
      this.modHope(amount * 4);

      // Front neighbor updates as people ahead get in
      if (state.queue.allNeighbors.length > 0) {
        state.queue.neighborFront = state.queue.allNeighbors[state.queue.allNeighbors.length - 1];
      }

      // Rebuild canvas people to match new position
      this.rebuildQueueViz();
      notify(`Queue moved! +${amount} positions`, { toastMs: 1500, logType: 'positive', logMsg: `Queue moved forward +${amount} positions` });

      if (state.queue.position <= 0) {
        this.reachFront();
        return true;
      }
    } else {
      this.modAnxiety(2);
    }
    return false;
  },

  checkEvent() {
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const cfg = QUEUE_CONFIG[venue?.policy || 'Easy'];
    const eventChance = cfg.eventChance * (squadHasContact('sasha') ? 1.5 : 1);
    if (Math.random() < eventChance) {
      this.triggerRandomEvent();
      return true;
    }
    return false;
  },

  triggerRandomEvent() {
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
    const event = pool[Math.floor(Math.random() * pool.length)];
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
    const stats = state.queue.memberStats;
    let gone = null;
    if (stats && Object.keys(stats).length > 0) {
      let lowestMorale = Infinity;
      let lowestName = null;
      for (const member of state.finalSquad) {
        const morale = stats[member.name]?.morale ?? Infinity;
        if (morale < lowestMorale) {
          lowestMorale = morale;
          lowestName = member.name;
        }
      }
      if (lowestName) {
        const idx = state.finalSquad.findIndex(m => m.name === lowestName);
        if (idx >= 0) gone = state.finalSquad.splice(idx, 1)[0];
      }
    }
    if (!gone) gone = state.finalSquad.pop();
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
      <div class="result-row"><span class="rl">Venues cleared</span><span class="rv">${prog.venuesCleared.length} / ${VENUES.length}</span></div>
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
    state.queue.turnCount++;
    this.advanceTime(5);
    this.processDelayedEffects();
    this.updateMeters();

    // People arriving behind you (first few turns)
    if (state.queue.turnCount <= 3 && state.queue.behindNeighbors.length < 6) {
      const arrivals = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < arrivals; i++) {
        const n = generateNeighbor(state.selectedVenue, state.queue.revealedIntel);
        state.queue.behindNeighbors.push(n);
      }
      state.queue.neighborBack = state.queue.behindNeighbors[0];
      this.rebuildQueueViz();
      if (state.queue.turnCount === 1) {
        showToast('People are lining up behind you...', 1500);
      }
    }

    // Group chat banter from squad
    if (state.finalSquad.length > 0) {
      await GroupChat.maybeSay();
    }

    await sleep(600);

    const reached = this.moveQueue();
    if (reached) return;

    await sleep(400);

    if (!this.checkEvent()) {
      state.queue.actionLocked = false;
    }
    this.updateMeters();
  },
};

// ============================================================
// PHASE 1: SOCIAL ACTIONS (Persuade, Eavesdrop, Scout, Flirt, Alliance)
// ============================================================

const SocialActions = {
  scoutUsed: false,
  allianceFormed: false,
  flirtTarget: null,

  reset() {
    this.scoutUsed = false;
    this.allianceFormed = false;
    this.flirtTarget = null;
  },

  eavesdrop() {
    const available = getIntelPool().filter(i => !state.queue.revealedIntel.includes(i.key));
    if (available.length === 0) {
      notify('Nothing new to overhear', { toastMs: 1500, logType: 'info' });
      return;
    }
    state.queue.actionLocked = true;

    const successChance = 0.30;
    const success = Math.random() < successChance && available.length > 0;

    if (success) {
      const intel = available[Math.floor(Math.random() * available.length)];
      const event = {
        icon: '👂', title: 'Overheard Something',
        desc: `You lean in slightly and catch a fragment of conversation from people nearby...`,
        effects: [{ label: 'Intel gained', cls: 'positive' }],
        choices: [{ label: `🔑 "${intel.text}"`, action: () => {
          if (!state.queue.revealedIntel.includes(intel.key)) {
            state.queue.revealedIntel.push(intel.key);
          }
          QueueEngine.modHope(3);
          EventLog.add(`👂 Overheard intel: ${intel.text}`, 'intel');
          updateEavesdropButton();
        }}],
      };
      QueueEngine.advanceTime(3);
      QueueEngine.showEvent(event);
    } else {
      const fragments = [
        "...something about the music being different tonight...",
        "...can't make out what they're saying over the bass...",
        "...they're just talking about their week...",
        "...you catch a name but can't place it...",
        "...just gossip about someone's ex...",
      ];
      const frag = fragments[Math.floor(Math.random() * fragments.length)];
      const event = {
        icon: '👂', title: 'Nothing Useful',
        desc: frag,
        effects: [{ label: 'Time wasted', cls: 'negative' }],
        choices: [{ label: 'Oh well', action: () => {
          QueueEngine.modAnxiety(2);
          EventLog.add('Tried to eavesdrop — heard nothing useful', 'info');
        }}],
      };
      QueueEngine.advanceTime(3);
      QueueEngine.showEvent(event);
    }
  },

  scoutDoor() {
    if (this.scoutUsed) {
      showToast("You already scouted — can't leave the line again", 1500);
      return;
    }
    state.queue.actionLocked = true;
    this.scoutUsed = true;

    const spotStolen = Math.random() < 0.25;
    const available = getIntelPool().filter(i => !state.queue.revealedIntel.includes(i.key));
    const intelGain = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;

    const effects = [];
    if (intelGain) effects.push({ label: 'Intel gained', cls: 'positive' });
    effects.push({ label: 'Trait: Scout Intel', cls: 'positive' });
    if (spotStolen) effects.push({ label: 'Position −2', cls: 'negative' });

    const desc = spotStolen
      ? `You sneak forward to observe the bouncer. When you get back, a group has edged into your spot!`
      : `You slip out of line and get close enough to watch the bouncer work. No one takes your spot.`;

    const event = {
      icon: '🔭', title: 'Scout the Door',
      desc,
      effects,
      choices: [{ label: spotStolen ? '😩 Worth it?' : '😎 Nice recon', action: () => {
        if (intelGain && !state.queue.revealedIntel.includes(intelGain.key)) {
          state.queue.revealedIntel.push(intelGain.key);
          EventLog.add(`🔭 Scouted intel: ${intelGain.text}`, 'intel');
        }
        updateEavesdropButton();
        QueueEngine.addTrait('Scout Intel');
        if (spotStolen) {
          state.queue.position += 2;
          QueueEngine.modHope(-6);
          QueueEngine.rebuildQueueViz();
          EventLog.add('Lost 2 spots while scouting — someone stole your place', 'negative');
        } else {
          QueueEngine.modHope(4);
          EventLog.add('Scouted the door successfully — no spot lost', 'positive');
        }
      }}],
    };

    QueueEngine.advanceTime(5);
    QueueEngine.showEvent(event);
  },

  flirt() {
    const front = state.queue.neighborFront;
    const back = state.queue.neighborBack;
    if (!front && !back) { showToast('No one nearby to flirt with', 1500); return; }
    state.queue.actionLocked = true;

    // Pick target: prefer someone with higher base affinity
    const target = (front && back)
      ? ((front.affinity || 50) >= (back.affinity || 50) ? front : back)
      : (front || back);

    const baseDifficulty = target.disposition === 'friendly' ? 0.55 :
                           target.disposition === 'drunk' ? 0.65 :
                           target.disposition === 'anxious' ? 0.35 :
                           target.disposition === 'hostile' ? 0.15 : 0.30;
    const affinityBonus = ((target.affinity || 50) - 50) * 0.004;
    const chance = Math.min(0.80, Math.max(0.10, baseDifficulty + affinityBonus));
    const success = Math.random() < chance;

    if (success) {
      const event = {
        icon: '💫', title: 'Smooth Talker',
        desc: `You turn on the charm with ${target.name}. They're into it — laughing, leaning in...`,
        effects: [
          { label: 'Affinity +20', cls: 'positive' },
          { label: 'Anxiety −8', cls: 'positive' },
          { label: 'Trait: Charmer', cls: 'positive' },
        ],
        choices: [{ label: '😏 Still got it', action: () => {
          target.affinity = Math.min(100, (target.affinity || 50) + 20);
          QueueEngine.modAnxiety(-8);
          QueueEngine.addTrait('Charmer');
          // Flirting can unlock intel faster if they have it
          if (target.intel && !state.queue.revealedIntel.includes(target.intel.key)) {
            state.queue.revealedIntel.push(target.intel.key);
            showToast(`${target.name} whispers something useful...`, 2000);
            EventLog.add(`💫 Flirted intel from ${target.name}: ${target.intel.text}`, 'intel');
          }
          updateEavesdropButton();
          EventLog.add(`Charmed ${target.name} — they're smitten`, 'positive');
        }}],
      };
      QueueEngine.advanceTime(3);
      QueueEngine.showEvent(event);
    } else {
      const reactions = [
        `${target.name} smiles politely but turns away.`,
        `${target.name} raises an eyebrow. "Seriously?"`,
        `${target.name} is clearly not interested.`,
        `${target.name} laughs awkwardly and checks their phone.`,
      ];
      const event = {
        icon: '💫', title: 'Swing and a Miss',
        desc: reactions[Math.floor(Math.random() * reactions.length)],
        effects: [
          { label: 'Anxiety +5', cls: 'negative' },
          { label: 'Affinity −10', cls: 'negative' },
        ],
        choices: [{ label: '😅 Moving on...', action: () => {
          target.affinity = Math.max(0, (target.affinity || 50) - 10);
          QueueEngine.modAnxiety(5);
          EventLog.add(`Failed to flirt with ${target.name} — cringe`, 'negative');
        }}],
      };
      QueueEngine.advanceTime(2);
      QueueEngine.showEvent(event);
    }
  },

  formAlliance() {
    if (this.allianceFormed) {
      showToast('You already have a queue alliance', 1500);
      return;
    }
    const front = state.queue.neighborFront;
    const back = state.queue.neighborBack;
    const candidates = [front, back].filter(n => n && (n.affinity || 50) >= 55);

    if (candidates.length === 0) {
      showToast('No one trusts you enough yet (need affinity ≥55)', 2000);
      return;
    }
    state.queue.actionLocked = true;

    const ally = candidates[0];
    const chance = ally.disposition === 'friendly' ? 0.75 :
                   ally.disposition === 'drunk' ? 0.60 :
                   ally.disposition === 'anxious' ? 0.50 :
                   ally.disposition === 'hostile' ? 0.20 : 0.40;
    const success = Math.random() < chance;

    if (success) {
      this.allianceFormed = true;
      state.queue.allyData = { name: ally.name, disposition: ally.disposition };
      const event = {
        icon: '🤝', title: 'Alliance Formed!',
        desc: `${ally.name} agrees to vouch for you at the door. "I'll tell the bouncer we're together."`,
        effects: [
          { label: 'Trait: Queue Alliance', cls: 'positive' },
          { label: 'Hope +10', cls: 'positive' },
        ],
        choices: [{ label: '🤝 Solid', action: () => {
          QueueEngine.addTrait('Queue Alliance');
          QueueEngine.modHope(10);
          EventLog.add(`Formed alliance with ${ally.name} — they'll vouch at the door`, 'positive');
        }}],
      };
      QueueEngine.advanceTime(2);
      QueueEngine.showEvent(event);
    } else {
      const event = {
        icon: '🤝', title: 'No Deal',
        desc: `${ally.name} shrugs. "I barely know you. Not risking my spot for a stranger."`,
        effects: [{ label: 'Hope −3', cls: 'negative' }],
        choices: [{ label: 'Fair enough', action: () => {
          QueueEngine.modHope(-3);
          EventLog.add(`${ally.name} declined the alliance`, 'info');
        }}],
      };
      QueueEngine.advanceTime(2);
      QueueEngine.showEvent(event);
    }
  },
};

