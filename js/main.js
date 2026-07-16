// ============================================================
// PHASE 1: ENTER QUEUE (transition from Phase 0)
// ============================================================

function resetRunState() {
  state.queue.position = 15;
  state.queue.hope = 70;
  state.queue.anxiety = 10;
  state.queue.gameTime = 23 * 60 + 35;
  state.queue.neighborFront = null;
  state.queue.neighborBack = null;
  state.queue.revealedIntel = [];
  state.queue.turnCount = 0;
  state.queue.beerDebuff = false;
  state.queue.hadDrink = false;
  state.queue.actionLocked = false;
  state.queue.queuePeople = [];
  state.queue.animFrame = null;
  state.queue.activeTraits = [];
  state.queue.delayedEffects = [];
  state.queue.allianceFormed = false;
  state.queue.nightMemories = [];
  state.queue.crewChatHistory = [];
  state.queue.crewMemberChats = {};
  state.queue.startingSquadCount = 0;
  state.queue.allNeighbors = [];
  state.queue.behindNeighbors = [];
  state.queue.allyData = null;
  state.queue.earplugsActive = false;
  state.contactUnlockedThisRun = false;

  LLM.disposeAllCaches();
  clearTimeout(BouncerSystem.timer);
  BouncerSystem.generating = false;
  BouncerSystem.finished = false;
  BouncerSystem._pendingPlayerText = null;
  if (ChatSystem._convo) {
    ChatSystem._convo.generating = false;
    ChatSystem._convo._pendingPlayerText = null;
  }
  if (CrewChatSystem._convo) {
    CrewChatSystem._convo.generating = false;
    CrewChatSystem._convo._pendingPlayerText = null;
  }
  [...state.finalSquad, ...state.selectedSquad].forEach(m => { if (m) m._chimedIn = false; });
}

// ============================================================
// LLM PRELOAD (planning-phase background download)
// ============================================================

function updatePlanningAiIndicator(pct, status) {
  const el = $('ai-load-indicator');
  if (!el) return;
  el.classList.remove('clickable');
  el.removeAttribute('title');
  if (LLM.loaded || status === 'ready') {
    el.classList.add('hidden');
    return;
  }
  if (status === 'failed') {
    el.textContent = 'AI unavailable — simple dialogue';
    el.classList.remove('hidden');
    el.classList.add('clickable');
    el.title = 'Tap to change';
    return;
  }
  if (status === 'off') {
    el.textContent = 'AI off — simple dialogue';
    el.classList.remove('hidden');
    el.classList.add('clickable');
    el.title = 'Tap to change';
    return;
  }
  if (status === 'unsupported') {
    el.textContent = 'AI unsupported — simple dialogue';
    el.classList.remove('hidden');
    el.classList.add('clickable');
    el.title = 'Tap to change';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = pct >= 100 ? 'AI warming up…' : `AI loading… ${pct}%`;
}

function beginLlmPreload() {
  updatePlanningAiIndicator(0, 'loading');
  LLM.load((pct) => updatePlanningAiIndicator(pct, 'loading'))
    .then(() => {
      state.llm.loaded = true;
      updatePlanningAiIndicator(100, 'ready');
    })
    .catch((e) => {
      console.warn('LLM preload failed:', e);
      state.llm.loadFailed = true;
      updatePlanningAiIndicator(0, 'failed');
    });
}

function hideAiConsentOverlay() {
  $('ai-consent-overlay')?.classList.remove('active');
}

function showAiConsentOverlay(preflight) {
  const overlay = $('ai-consent-overlay');
  const warningEl = $('ai-consent-warning');
  const loadBtn = $('ai-consent-load');
  const skipBtn = $('ai-consent-skip');
  const choicesEl = $('ai-consent-choices');
  if (!overlay || !loadBtn || !skipBtn) return;

  const lowMemory = preflight.level === 'low-memory';
  if (warningEl) {
    if (lowMemory) {
      warningEl.textContent =
        `Your device reports ${preflight.deviceMemory} GB of RAM — loading the AI will likely freeze this machine. Simple dialogue mode is recommended.`;
      warningEl.classList.remove('hidden');
    } else {
      warningEl.textContent = '';
      warningEl.classList.add('hidden');
    }
  }

  loadBtn.classList.toggle('caution', lowMemory);
  loadBtn.classList.remove('recommended');
  skipBtn.classList.toggle('recommended', lowMemory);
  skipBtn.classList.remove('caution');

  if (lowMemory && choicesEl) {
    choicesEl.appendChild(skipBtn);
    choicesEl.appendChild(loadBtn);
  } else if (choicesEl) {
    choicesEl.appendChild(loadBtn);
    choicesEl.appendChild(skipBtn);
  }

  const onLoad = () => {
    SaveSystem.setAiChoice('on');
    hideAiConsentOverlay();
    beginLlmPreload();
  };
  const onSkip = () => {
    SaveSystem.setAiChoice('off');
    hideAiConsentOverlay();
    updatePlanningAiIndicator(0, 'off');
  };

  loadBtn.onclick = onLoad;
  skipBtn.onclick = onSkip;
  overlay.classList.add('active');
}

async function startLlmPreload() {
  if (LLM.loaded) {
    updatePlanningAiIndicator(100, 'ready');
    return;
  }

  const choice = SaveSystem.getAiChoice();
  if (choice === 'off') {
    updatePlanningAiIndicator(0, 'off');
    return;
  }
  if (choice === 'on') {
    beginLlmPreload();
    return;
  }

  let preflight;
  try {
    preflight = await LLM.preflight();
  } catch (e) {
    console.warn('LLM preflight failed:', e);
    updatePlanningAiIndicator(0, 'unsupported');
    return;
  }

  if (preflight.level === 'unsupported') {
    updatePlanningAiIndicator(0, 'unsupported');
    return;
  }

  showAiConsentOverlay(preflight);
}

async function enterQueue() {
  state.phase = 'LOADING';
  $('flake-overlay').classList.remove('active');
  resetRunState();

  const venue = VENUES.find(v => v.id === state.selectedVenue);
  const cfg = QUEUE_CONFIG[venue?.policy || 'Easy'];

  // Initialize queue state for this venue
  state.queue.position = cfg.startPos;
  // Deduct entry cost only for people who actually showed up
  const entryCost = venue.entryPrice * (1 + state.finalSquad.length);
  state.cash = Math.max(0, state.cash - entryCost);

  // Apply wardrobe bonuses
  const prog = SaveSystem.load();
  let wardrobeHope = 0;
  prog.equippedOutfits.forEach(id => {
    const w = WARDROBE.find(i => i.id === id);
    if (w?.groupBonus) wardrobeHope += w.groupBonus;
  });

  const groupBonus = state.finalSquad.length * 3;
  state.queue.hope = Math.min(100, 70 + groupBonus + wardrobeHope);
  state.queue.anxiety = Math.max(5, 10 - state.finalSquad.length);
  state.queue.gameTime = 23 * 60 + 35;
  state.queue.revealedIntel = [];
  state.queue.turnCount = 0;
  state.queue.beerDebuff = false;
  state.queue.hadDrink = false;
  state.queue.actionLocked = false;
  // Generate tonight's DJ lineup and door staff (stable per venue for this run)
  tonightsDJs = getTonightsDJs(venue);
  ensureTonightsBouncer(state.selectedVenue);
  generateTonightsSecrets(venue, tonightsBouncer);

  // Rissal: grant starting items
  if (squadHasContact('rissal')) {
    const rissal = CONTACTS.find(c => c.id === 'rissal');
    (rissal?.startsWithItems || []).forEach(itemId => {
      state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    });
    notify('Rissal brought gum and a lighter', { toastMs: 2000, logType: 'positive' });
  }

  // Dex: random kiosk substance
  if (squadHasContact('dex')) {
    const subId = SUBSTANCE_POOL[Math.floor(Math.random() * SUBSTANCE_POOL.length)];
    state.inventory[subId] = (state.inventory[subId] || 0) + 1;
    const subName = KIOSK_ITEMS.find(i => i.id === subId)?.name || subId;
    notify(`Dex slipped you ${subName}`, { toastMs: 2000, logType: 'positive' });
  }

  // Felix: auto-reveal one intel
  if (squadHasContact('felix')) {
    const pool = getIntelPool().filter(i => !state.queue.revealedIntel.includes(i.key));
    if (pool.length > 0) {
      const intel = pool[Math.floor(Math.random() * pool.length)];
      state.queue.revealedIntel.push(intel.key);
      notify(`Felix's insider tip: ${intel.text}`, { toastMs: 3000, logType: 'intel' });
    }
  }

  // Generate persistent queue neighbors — these stay until they leave
  const queueNeighbors = [];
  for (let i = 0; i < cfg.startPos; i++) {
    queueNeighbors.push(generateNeighbor(state.selectedVenue, []));
  }
  state.queue.allNeighbors = queueNeighbors;
  state.queue.neighborFront = queueNeighbors[cfg.startPos - 1] || null;
  state.queue.neighborBack = null; // No one behind you at start
  state.queue.behindNeighbors = [];
  state.queue.activeTraits = [];
  state.queue.delayedEffects = [];
  state.queue.allianceFormed = false;
  state.queue.nightMemories = [];
  state.queue.crewChatHistory = [];
  state.queue.crewMemberChats = {};
  state.queue.startingSquadCount = state.finalSquad.length;
  state.queue.allyData = null;

  // Show loading overlay
  $('loading-overlay').classList.add('active');
  renderLoadingQueue(0);

  const aiChoice = SaveSystem.getAiChoice();
  state.llm.loadFailed = false;

  if (aiChoice === 'on' && !LLM.loaded) {
    $('loading-status').textContent = 'Initializing AI...';
    try {
      const fmtDuration = (ms) => {
        const s = Math.max(0, Math.round(ms / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      };
      const fmtGB = (bytes) => (bytes / 1e9).toFixed(2);
      await LLM.load((pct, info) => {
        renderLoadingQueue(pct);
        if (pct >= 100 || !info) {
          $('loading-status').textContent = pct >= 100 ? 'Ready!' : 'Warming up...';
          return;
        }
        const eta = info.elapsedMs > 3000 && info.remainingMs != null
          ? ` · ~${fmtDuration(info.remainingMs)} left`
          : '';
        $('loading-status').textContent =
          `${pct}% · ${fmtGB(info.loadedBytes)} / ${fmtGB(info.totalBytes)} GB · ${fmtDuration(info.elapsedMs)} elapsed${eta}`;
      });
      state.llm.loaded = true;
      renderLoadingQueue(100);
      updatePlanningAiIndicator(100, 'ready');
    } catch (e) {
      console.warn('LLM failed to load:', e);
      state.llm.loadFailed = true;
      $('loading-status').textContent = 'AI model failed to load — retrying next time';
      updatePlanningAiIndicator(0, 'failed');
      await sleep(1500);
    }
  } else if (LLM.loaded) {
    $('loading-status').textContent = 'Ready!';
    renderLoadingQueue(100);
    updatePlanningAiIndicator(100, 'ready');
  } else {
    $('loading-status').textContent = 'Simple dialogue mode';
    renderLoadingQueue(100);
    await sleep(600);
  }

  startQueuePhase(venue, cfg);
}

function startQueuePhase(venue, cfg) {
  $('loading-overlay').classList.remove('active');
  state.phase = 'QUEUE';

  // Set venue label
  $('q-venue-label').textContent = venue.name;

  // Initialize canvas with venue theme — no one behind you at start
  QueueCanvas.init();
  QueueCanvas.theme = QueueCanvas.THEMES[venue.id] || QueueCanvas.THEMES.mainframe;
  const squadLen = state.finalSquad.length;
  const totalPeople = cfg.startPos + 1 + squadLen; // No one behind at start
  QueueCanvas.generatePeople(totalPeople, cfg.startPos, state.finalSquad);
  // Start camera at the back of the line (you just arrived)
  const playerIdx = state.queue.queuePeople.findIndex(p => p.isPlayer);
  if (playerIdx >= 0) {
    QueueCanvas.scrollX = state.queue.queuePeople[playerIdx].baseX + 100;
  }
  QueueCanvas.startLoop();

  // Update HUD
  QueueEngine.updateMeters();

  // Hip flask: eases squad anxiety at queue start
  const progOutfits = SaveSystem.load();
  if (progOutfits.equippedOutfits.includes('flask')) {
    QueueEngine.modAnxiety(-10);
    notify('Hip flask shared — anxiety eases', { toastMs: 2000, logType: 'positive' });
    EventLog.add('Hip flask shared — the squad feels steadier', 'positive');
  }

  // Music taste and crew bonds → small hope boosts at queue start
  const loggedBondPairs = new Set();
  state.finalSquad.forEach(member => {
    const contact = CONTACTS.find(c => c.name === member.name);
    if (contact?.musicPref && venue?.music && contact.musicPref === venue.music) {
      QueueEngine.modHope(3);
      EventLog.add(`${member.name} is hyped for ${venue.music} tonight (+hope)`, 'positive');
    }
    const otherIds = state.finalSquad
      .filter(m => m.name !== member.name)
      .map(m => CONTACTS.find(c => c.name === m.name)?.id)
      .filter(Boolean);
    otherIds.forEach(otherId => {
      const pairKey = [contact?.id || '', otherId].sort().join(':');
      if (loggedBondPairs.has(pairKey)) return;
      const bond = SaveSystem.getBond(contact?.id || '', otherId);
      if (bond > 0) {
        loggedBondPairs.add(pairKey);
        QueueEngine.modHope(3);
        const other = CONTACTS.find(c => c.id === otherId);
        EventLog.add(`${member.name} and ${other?.name || 'crew'} have history — good vibes (+hope)`, 'positive');
      }
    });
  });

  // Log active squad trait effects
  if (squadHasContact('kai')) EventLog.add("Kai's hype speeds up the line (+15% move, +20% anxiety)", 'info');
  if (squadHasContact('sasha')) EventLog.add("Sasha's chaos brings more random queue events (+50%)", 'info');
  if (squadHasContact('yuki')) EventLog.add("Yuki calms the squad (−25% anxiety gains)", 'info');
  if (squadHasContact('jasper')) EventLog.add("Jasper's model steadies queue movement (less variance)", 'info');
  if (squadHasContact('priya')) EventLog.add("Priya's network boosts bond gains (+50%)", 'info');
  if (squadHasContact('zara')) EventLog.add('Zara will document a successful night (+rep)', 'info');
  if (squadHasContact('ghost')) EventLog.add('Ghost fades from the bouncer head-count', 'info');

  // Show queue screen
  $('queue-screen').classList.add('active');

  EventLog.clear();
  // Track venue visit
  const prog = SaveSystem.load();
  prog.venueVisits = prog.venueVisits || {};
  prog.venueVisits[venue.id] = (prog.venueVisits[venue.id] || 0) + 1;
  SaveSystem.save(prog);

  EventLog.add(`Arrived outside ${venue.name}. Position ${cfg.startPos} in line.`, 'info');
  if (state.llm.loadFailed) {
    notify('AI model could not load — NPCs will use simple dialogue', {
      toastMs: 4500,
      logType: 'negative',
      logMsg: 'AI model failed to load. Neighbor and bouncer chat will use fallbacks.',
    });
  } else if (SaveSystem.getAiChoice() === 'off') {
    notify('Playing with simple dialogue — tap the AI indicator to enable the model later', {
      toastMs: 4500,
      logType: 'info',
    });
  }
  EventLog.add(`You don't know who's playing or what the password is. Talk to people to find out.`, 'info');
  if (state.finalSquad.length > 0) {
    EventLog.add(`Squad: ${state.finalSquad.map(s => s.name).join(', ')}`, 'info');
  } else {
    EventLog.add('Going solo tonight.', 'info');
  }
}

// ============================================================
// RESTART (back to planning)
// ============================================================

function restartPlanning() {
  resetRunState();
  state.phase = 'PLANNING';
  state.selectedVenue = null;
  state.selectedSquad = [];
  state.inventory = {};
  state.finalSquad = [];

  // Apply progression
  SaveSystem.applyToState();

  QueueCanvas.stopLoop();
  $('queue-screen').classList.remove('active');
  $('bouncer-screen').classList.remove('active');
  $('flake-overlay').classList.remove('active');
  $('loading-overlay').classList.remove('active');
  $('phone-container').classList.add('active');

  const repEl = $('rep-display');
  if (repEl && state.progress) {
    const job = SaveSystem.JOBS.slice().reverse().find(j => state.progress.reputation >= j.minRep) || SaveSystem.JOBS[0];
    repEl.textContent = `${job.name} · ★${state.progress.reputation} · $${state.cash}`;
  }

  switchTab(0);
  renderVenues();
  renderContacts();
  renderLoadout();
  renderLookPanel();
  renderPlayerBadge();
  updateConfirmBar();
  updateSquadBadge();
}

// ============================================================
// INIT
// ============================================================

function init() {
  // Load progression from localStorage
  SaveSystem.applyToState();
  const p = state.progress;
  const job = getCurrentJob();
  $('rep-display').textContent = `${job.name} · ★${p.reputation} · $${state.cash}`;

  // Set pixel art icons for UI elements
  $('nav-icon-0').innerHTML = PX.i('pin', '#7b75ff', 18);
  $('nav-icon-1').innerHTML = PX.i('people', '#7b75ff', 18);
  $('nav-icon-2').innerHTML = PX.i('pack', '#7b75ff', 18);
  $('nav-icon-3').innerHTML = PX.i('eye', '#7b75ff', 18);
  $('act-icon-wait').innerHTML = PX.i('clock', '#ebe4ff', 22);
  $('act-icon-front').innerHTML = PX.i('bubble', '#ebe4ff', 22);
  $('act-icon-back').innerHTML = PX.i('bubble2', '#ebe4ff', 22);
  $('act-icon-kiosk').innerHTML = PX.i('beer', '#ffd86b', 22);
  $('act-icon-use').innerHTML = PX.i('pack', '#a4ff80', 22);
  $('bouncer-use-item').innerHTML = PX.i('pack', '#a4ff80', 16);
  $('act-icon-intel').innerHTML = PX.i('key', '#ffd86b', 22);
  $('act-icon-crew').innerHTML = PX.i('people', '#7b75ff', 22);
  $('log-icon').innerHTML = PX.i('scroll', '#ebe4ff', 12);
  $('mute-icon').innerHTML = PX.i('sound', '#ebe4ff', 18);
  $('battery-icon').innerHTML = PX.i('bolt', '#ebe4ff', 10);

  updateStatusBar();
  setInterval(updateStatusBar, 30000);

  // Render initial content
  renderVenues();
  renderContacts();
  renderLoadout();
  renderLookPanel();
  renderPlayerBadge();
  updateConfirmBar();
  updateSquadBadge();

  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(parseInt(btn.dataset.tab));
    });
  });

  // Touch swipe for tabs
  let touchStartX = 0;
  let touchStartY = 0;
  const viewport = document.querySelector('.tab-viewport');
  viewport.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && state.currentTab < 3) switchTab(state.currentTab + 1);
      if (dx > 0 && state.currentTab > 0) switchTab(state.currentTab - 1);
    }
  }, { passive: true });

  // Confirm button
  $('confirm-btn').addEventListener('click', () => {
    if (!state.selectedVenue) return;
    startFlakeRoll();
  });

  // Mute button
  const muteBtn = $('mute-btn');
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    ClubAudio.setMuted(state.muted);
    $('mute-icon').innerHTML = PX.i(state.muted ? 'mute' : 'sound', '#ebe4ff', 18);
  });
  $('debug-clear')?.addEventListener('click', () => Debug.clear());
  $('debug-reset-save')?.addEventListener('click', () => {
    if (confirm('Reset all saved progress? This cannot be undone.')) {
      SaveSystem.clear();
      location.reload();
    }
  });
  $('debug-run-tests')?.addEventListener('click', () => Debug.runToolTests());

  $('ai-load-indicator')?.addEventListener('click', () => {
    const el = $('ai-load-indicator');
    if (!el?.classList.contains('clickable')) return;
    SaveSystem.setAiChoice(null);
    startLlmPreload();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      Debug.toggle();
    }
  });

  // Boot overlay — click to start
  $('boot-overlay').addEventListener('click', () => {
    $('boot-overlay').classList.add('hidden');
    $('phone-container').classList.add('active');
    muteBtn.classList.add('visible');
    state.phase = 'PLANNING';

    if (!state.audioStarted) {
      state.audioStarted = true;
      ClubAudio.init();
    }

    startLlmPreload();
  });

  // Resume audio context on any subsequent click (mobile Safari workaround)
  document.addEventListener('click', () => {
    if (ClubAudio.ctx && ClubAudio.ctx.state === 'suspended') {
      ClubAudio.ctx.resume();
    }
  });

  // Event log toggle
  $('log-toggle')?.addEventListener('click', () => {
    $('event-log-panel').classList.toggle('open');
  });
  $('log-close')?.addEventListener('click', () => {
    $('event-log-panel').classList.remove('open');
  });

  // Phase 1: Action buttons
  $('act-wait').addEventListener('click', () => {
    if (state.phase !== 'QUEUE' || state.queue.actionLocked) return;
    QueueEngine.doWait();
  });

  $('act-talk-front').addEventListener('click', () => {
    if (state.phase !== 'QUEUE' || state.queue.actionLocked) return;
    if (!state.queue.neighborFront) { showToast('No one ahead to talk to', 1500); return; }
    state.queue.actionLocked = true;
    ChatSystem.open(state.queue.neighborFront, 'front');
  });

  $('act-talk-back').addEventListener('click', () => {
    if (state.phase !== 'QUEUE' || state.queue.actionLocked) return;
    if (!state.queue.neighborBack) { showToast('No one behind you yet', 1500); return; }
    state.queue.actionLocked = true;
    ChatSystem.open(state.queue.neighborBack, 'back');
  });

  $('act-kiosk').addEventListener('click', () => {
    if (state.phase !== 'QUEUE' || state.queue.actionLocked) return;
    KioskSystem.open();
  });

  $('act-use-item').addEventListener('click', () => {
    if (state.phase !== 'QUEUE' || state.queue.actionLocked) return;
    UseItemSystem.open();
  });

  $('act-intel').addEventListener('click', () => {
    if (state.phase !== 'QUEUE') return;
    const intel = state.queue.revealedIntel;
    if (intel.length === 0) {
      showToast('No intel gathered yet. Talk to people!', 2000);
    } else {
      const secrets = tonightsSecrets?.facts || {};
      const intelTexts = intel.map(key => secrets[key] || key).join('\n');
      const card = $('event-card');
      card.innerHTML = `
        <div style="font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;color:var(--neon-gold);">${PX.i('key','#ffd86b',16)} Intel Gathered</div>
        ${intel.map(key => `<div style="padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:12px;color:var(--text-secondary);text-align:left;">${PX.i('key','#39ff14',10)} ${secrets[key] || key}</div>`).join('')}
        <button class="event-choice-btn" style="margin-top:12px;" onclick="$('event-overlay').classList.remove('active')">Close</button>
      `;
      $('event-overlay').classList.add('active');
    }
  });

  $('act-crew').addEventListener('click', () => {
    if (state.phase !== 'QUEUE' || state.queue.actionLocked) return;
    CrewChatSystem.openGroup();
  });

  // Phase 1: Chat input
  $('chat-send').addEventListener('click', () => {
    if (CrewChatSystem.active) CrewChatSystem.sendMessage($('chat-input').value);
    else ChatSystem.sendMessage($('chat-input').value);
  });
  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (CrewChatSystem.active) CrewChatSystem.sendMessage($('chat-input').value);
      else ChatSystem.sendMessage($('chat-input').value);
    }
  });
  $('chat-close').addEventListener('click', () => CrewChatSystem.active ? CrewChatSystem.close() : ChatSystem.close());
  $('chat-leave').addEventListener('click', () => CrewChatSystem.active ? CrewChatSystem.close() : ChatSystem.close());

  // Bouncer phase: free text input
  $('bouncer-send').addEventListener('click', () => {
    BouncerSystem.sendMessage($('bouncer-input').value);
  });
  $('bouncer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') BouncerSystem.sendMessage($('bouncer-input').value);
  });
  $('bouncer-use-item')?.addEventListener('click', () => {
    if (state.phase === 'BOUNCER') UseItemSystem.open();
  });

  // Club scene: leave at sunrise
  $('club-done').addEventListener('click', () => {
    ClubScene._finish();
  });
}

init();
