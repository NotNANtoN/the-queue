// ============================================================
// SAVE / PROGRESSION SYSTEM
// ============================================================

const SaveSystem = {
  KEY: 'thequeue_save_v1',

  JOBS: [
    { id: 'barista', name: 'Barista', pay: 30, minRep: 0 },
    { id: 'bartender', name: 'Bartender', pay: 45, minRep: 5 },
    { id: 'promoter', name: 'Club Promoter', pay: 60, minRep: 12 },
    { id: 'dj', name: 'Resident DJ', pay: 80, minRep: 20 },
    { id: 'owner', name: 'Venue Owner', pay: 120, minRep: 35 },
  ],

  defaultProgress() {
    return {
      reputation: 0,
      savings: 0,
      job: 'barista',
      venuesCleared: [],
      wonAt: null,
      unlockedContacts: ['kai', 'rissal', 'mona'],
      totalRuns: 0,
      totalSuccesses: 0,
      bonds: {},
      contactStats: {},
      ownedOutfits: [],
      equippedOutfits: [],
      playerLook: null,
      djHistory: {},
      venueVisits: {},
      contactMemories: {},
      strangerMemories: {},
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const p = { ...this.defaultProgress(), ...JSON.parse(raw) };
        this.dedupeVenuesCleared(p);
        return p;
      }
    } catch (e) {}
    return this.defaultProgress();
  },

  dedupeVenuesCleared(progress) {
    if (!progress?.venuesCleared) return;
    progress.venuesCleared = [...new Set(progress.venuesCleared)];
  },

  uniqueVenuesClearedCount(progress) {
    this.dedupeVenuesCleared(progress);
    return progress.venuesCleared.length;
  },

  allVenuesCleared(progress) {
    this.dedupeVenuesCleared(progress);
    const allIds = VENUES.map(v => v.id);
    return allIds.every(id => progress.venuesCleared.includes(id));
  },

  pickLockedContact(progress, venue) {
    const locked = CONTACTS.map(c => c.id).filter(id => !progress.unlockedContacts.includes(id));
    if (locked.length === 0) return null;
    const music = (venue?.music || '').toLowerCase();
    const matched = locked.filter(id => {
      const pref = (CONTACTS.find(c => c.id === id)?.musicPref || '').toLowerCase();
      if (!pref || !music) return false;
      const prefRoot = pref.split(/[\s&]+/)[0];
      return pref === music || music.includes(prefRoot) || pref.includes(music.split(/[\s&]+/)[0]);
    });
    const pool = matched.length > 0 ? matched : locked;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  tryUnlockContact(progress, contactId, { where, bond = 20, neighbor = null } = {}) {
    if (state.contactUnlockedThisRun) return null;
    if (!contactId || progress.unlockedContacts.includes(contactId)) return null;
    progress.unlockedContacts.push(contactId);
    state.contactUnlockedThisRun = true;
    const c = CONTACTS.find(ct => ct.id === contactId);
    const key = ['player', contactId].sort().join(':');
    progress.bonds[key] = Math.max(progress.bonds[key] || 0, bond);
    this._pendingUnlocks = this._pendingUnlocks || [];
    this._pendingUnlocks.push({ name: c?.name || contactId, where, bond });
    if (neighbor) MemorySystem.linkNeighborToContact(neighbor, contactId, progress, 'exchanged_numbers');
    return c;
  },

  save(progress) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(progress));
    } catch (e) {}
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },

  applyToState() {
    const p = this.load();
    p.contactMemories = p.contactMemories || {};
    p.strangerMemories = p.strangerMemories || {};
    state.progress = p;

    // Auto-upgrade job based on reputation
    const bestJob = this.JOBS.slice().reverse().find(j => p.reputation >= j.minRep) || this.JOBS[0];
    p.job = bestJob.id;
    if (p.playerLook) state.playerLook = { ...state.playerLook, ...p.playerLook };

    // Weekly budget = job pay + savings
    const pay = bestJob.pay;
    state.cash = pay + (p.savings || 0);

    // Unlock venues based on unique clears
    const clearedCount = this.uniqueVenuesClearedCount(p);
    VENUES.forEach(v => {
      if (!v.locked) return;
      if (v.id === 'boardroom' && clearedCount >= 2) v.locked = false;
      if (v.id === 'florians' && clearedCount >= 3) v.locked = false;
      if (v.id === 'audit' && clearedCount >= 5) v.locked = false;
    });

    // Unlock contacts based on conditions
    CONTACTS.forEach(c => {
      if (p.unlockedContacts.includes(c.id)) return;
      if (!c.unlockCondition) return;
      let unlocked = false;
      if (c.unlockCondition === 'rep5' && p.reputation >= 5) unlocked = true;
      if (c.unlockCondition === 'rep10' && p.reputation >= 10) unlocked = true;
      if (c.unlockCondition === 'rep15' && p.reputation >= 15) unlocked = true;
      if (c.unlockCondition === 'venue_compliance' && p.venuesCleared.includes('compliance')) unlocked = true;
      if (c.unlockCondition === 'venue_boardroom' && p.venuesCleared.includes('boardroom')) unlocked = true;
      if (c.unlockCondition === 'venue_florians' && p.venuesCleared.includes('florians')) unlocked = true;
      if (unlocked) p.unlockedContacts.push(c.id);
    });
    this.save(p);
  },

  recordRun(success, venueId) {
    const p = this.load();
    p.totalRuns++;
    let repGain = success ? 3 : 1;
    if (success && squadHasContact('zara')) repGain += 1;
    repGain = Math.min(repGain, 4);
    p.reputation += repGain;
    if (success) {
      p.totalSuccesses++;
      this.dedupeVenuesCleared(p);
      if (venueId && !p.venuesCleared.includes(venueId)) {
        p.venuesCleared.push(venueId);
      }
      // Increase bonds between all squad members who succeeded together
      const bondMult = getBondGainMultiplier();
      const squadBondDelta = Math.round(15 * bondMult);
      const playerBondDelta = Math.round(10 * bondMult);
      const ids = state.finalSquad.map(m => {
        const c = CONTACTS.find(ct => ct.name === m.name);
        return c?.id;
      }).filter(Boolean);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join(':');
          p.bonds[key] = Math.min(100, (p.bonds[key] || 0) + squadBondDelta);
        }
        // Bond with the player too
        const playerKey = ['player', ids[i]].sort().join(':');
        p.bonds[playerKey] = Math.min(100, (p.bonds[playerKey] || 0) + playerBondDelta);
      }
      // Track success for each squad member
      state.finalSquad.forEach(m => {
        const c = CONTACTS.find(ct => ct.name === m.name);
        if (c) this.updateContactStat(c.id, { success: true });
      });
    } else {
      // Track failure for each squad member
      state.finalSquad.forEach(m => {
        const c = CONTACTS.find(ct => ct.name === m.name);
        if (c) this.updateContactStat(c.id, { fail: true });
      });
      // Failed runs still build small bonds (shared suffering)
      const failBondMult = getBondGainMultiplier();
      const ids = state.finalSquad.map(m => CONTACTS.find(ct => ct.name === m.name)?.id).filter(Boolean);
      ids.forEach(id => {
        const key = ['player', id].sort().join(':');
        p.bonds[key] = Math.min(100, (p.bonds[key] || 0) + Math.round(3 * failBondMult));
      });
    }
    // Unlock new contacts based on milestones — at most one per run
    const venue = VENUES.find(v => v.id === venueId);

    if (success && !state.contactUnlockedThisRun) {
      const locked = CONTACTS.map(c => c.id).filter(id => !p.unlockedContacts.includes(id));
      if (locked.length > 0 && Math.random() < 0.6) {
        const newContact = this.pickLockedContact(p, venue);
        if (newContact) {
          this.tryUnlockContact(p, newContact, { where: 'inside the club', bond: 20 });
        }
      }
    }

    if (!state.contactUnlockedThisRun && state.queue.revealedIntel.length >= 2) {
      const locked = CONTACTS.map(c => c.id).filter(id => !p.unlockedContacts.includes(id));
      if (locked.length > 0 && Math.random() < 0.4) {
        const queueUnlock = this.pickLockedContact(p, venue) || locked[0];
        this.tryUnlockContact(p, queueUnlock, { where: 'the queue', bond: 10 });
        const rememberedStranger = (state.queue.nightMemories || [])
          .filter(m => m.sourceMemoryId)
          .sort((a, b) => (b.salience || 0) - (a.salience || 0))[0];
        if (rememberedStranger) {
          MemorySystem.linkStagedStrangerToContact(rememberedStranger.sourceMemoryId, queueUnlock, p, 'queue_unlock');
        }
      }
    }

    // One-time win state when every venue has been cleared
    if (success && this.allVenuesCleared(p) && !p.wonAt) {
      p.wonAt = Date.now();
    }

    // Save remaining cash as savings for next week
    p.savings = Math.max(0, state.cash);
    this.save(p);
    state.progress = p;
  },

  getContactStat(contactId) {
    const p = this.load();
    return p.contactStats[contactId] || { runsTogether: 0, successes: 0, flakes: 0, loyalty: 0 };
  },

  updateContactStat(contactId, updates) {
    const p = this.load();
    if (!p.contactStats[contactId]) {
      p.contactStats[contactId] = { runsTogether: 0, successes: 0, flakes: 0, loyalty: 0 };
    }
    const s = p.contactStats[contactId];
    if (updates.run) s.runsTogether++;
    if (updates.success) { s.successes++; s.loyalty = Math.min(100, s.loyalty + 8); }
    if (updates.fail) s.loyalty = Math.min(100, s.loyalty + 2);
    if (updates.flake) { s.flakes++; s.loyalty = Math.max(0, s.loyalty - 5); }
    this.save(p);
  },

  getPendingUnlocks() {
    const unlocks = this._pendingUnlocks || [];
    this._pendingUnlocks = [];
    return unlocks;
  },

  getBond(id1, id2) {
    const p = this.load();
    const key = [id1, id2].sort().join(':');
    return p.bonds[key] || 0;
  },

  getSquadBondAvg(selectedIds) {
    if (selectedIds.length < 2) return 0;
    const p = this.load();
    let total = 0, count = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      for (let j = i + 1; j < selectedIds.length; j++) {
        const key = [selectedIds[i], selectedIds[j]].sort().join(':');
        total += p.bonds[key] || 0;
        count++;
      }
      const playerKey = ['player', selectedIds[i]].sort().join(':');
      total += p.bonds[playerKey] || 0;
      count++;
    }
    return count > 0 ? Math.round(total / count) : 0;
  },
};

// ============================================================
// MEMORY SYSTEM
// ============================================================

const MemorySystem = {
  PROFILES: {
    friendly: { chance: 1.1, confidence: 0.9, salience: 0.05, note: 'You remember warm social moments, favors, jokes, and promises.' },
    neutral:  { chance: 0.9, confidence: 0.8, salience: 0.0, note: 'You remember fair trades, useful facts, and unusually specific moments.' },
    hostile:  { chance: 1.0, confidence: 0.85, salience: 0.08, note: 'You remember slights, bribes, conflicts, and people who earn your respect.' },
    drunk:    { chance: 0.55, confidence: 0.45, salience: -0.05, note: 'You remember less often. If you do, memories are emotional, funny, and a bit unreliable.' },
    anxious:  { chance: 1.25, confidence: 0.75, salience: 0.12, note: 'You strongly remember reassurance, stress, rejection, and people who helped you feel safe.' },
  },

  _clamp(n, min, max) {
    const val = Number(n);
    if (Number.isNaN(val)) return min;
    return Math.max(min, Math.min(max, val));
  },

  _tags(raw) {
    if (Array.isArray(raw)) return raw.map(String).slice(0, 6);
    if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
    return [];
  },

  _profileFor(neighbor) {
    return this.PROFILES[neighbor?.disposition] || this.PROFILES.neutral;
  },

  rememberFromNeighbor(neighbor, args = {}) {
    if (!neighbor || !args.text) return null;
    const profile = this._profileFor(neighbor);
    if (Math.random() > profile.chance) {
      Debug.log('memory skipped', `${neighbor.name}: chance roll failed (${profile.chance})`);
      return null;
    }
    const memory = {
      id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      source: 'queue_neighbor',
      sourceName: neighbor.name,
      sourceMemoryId: neighbor.memoryId,
      sourceDisposition: neighbor.disposition,
      sourceQuirk: neighbor.quirk,
      venueId: state.selectedVenue,
      gameTime: state.queue.gameTime,
      runNumber: (state.progress?.totalRuns || 0) + 1,
      subject: args.subject || 'self',
      type: args.type || 'shared_event',
      text: String(args.text).slice(0, 220),
      valence: this._clamp(args.valence ?? 0, -1, 1),
      salience: this._clamp((args.salience ?? 0.45) + profile.salience, 0, 1),
      confidence: this._clamp((args.confidence ?? profile.confidence), 0.1, 1),
      tags: this._tags(args.tags),
    };
    if (neighbor.linkedContactId) memory.targetContactId = neighbor.linkedContactId;
    state.queue.nightMemories.push(memory);
    EventLog.add(`Memory noted: ${neighbor.name} — ${memory.text}`, 'info');
    Debug.log('memory staged', memory);
    return memory;
  },

  buildRememberGuidance(neighbor) {
    const profile = this._profileFor(neighbor);
    return `MEMORY: You may use the remember tool when something feels worth recalling later: a favor, conflict, promise, inside joke, personal fact, first meeting detail, or strange queue moment.
${profile.note}
Use remember sparingly. Do not remember generic small talk. Set salience 0.1-0.3 for tiny funny details, 0.4-0.7 for useful or emotional moments, and 0.8-1.0 for major favors, conflicts, promises, or first-meeting details.
If you are unsure or intoxicated, lower confidence instead of pretending certainty.`;
  },

  buildPromptContextForNeighbor(neighbor) {
    if (!neighbor) return '';
    const p = SaveSystem.load();
    const permanent = neighbor.linkedContactId
      ? (p.contactMemories?.[neighbor.linkedContactId] || [])
      : (p.strangerMemories?.[neighbor.memoryId]?.memories || []);
    const tonight = (state.queue.nightMemories || []).filter(m => m.sourceMemoryId === neighbor.memoryId);
    const memories = [...permanent, ...tonight]
      .sort((a, b) => (b.salience || 0) - (a.salience || 0))
      .slice(0, 4);
    if (memories.length === 0) return '';
    return `RELEVANT MEMORIES YOU CAN NATURALLY REFERENCE:
${memories.map(m => `- ${m.text}${m.confidence < 0.6 ? ' (you are fuzzy on the details)' : ''}`).join('\n')}`;
  },

  rememberFromCrewMember(contact, args = {}, source = 'crew_chat') {
    if (!contact || !args.text) return null;
    const profile = this.PROFILES.neutral;
    if (Math.random() > profile.chance) {
      Debug.log('memory skipped', `${contact.name}: chance roll failed (${profile.chance})`);
      return null;
    }
    const memory = {
      id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      source,
      sourceName: contact.name,
      targetContactId: contact.id,
      venueId: state.selectedVenue,
      gameTime: state.queue.gameTime,
      runNumber: (state.progress?.totalRuns || 0) + 1,
      subject: args.subject || 'self',
      type: args.type || 'shared_event',
      text: String(args.text).slice(0, 220),
      valence: this._clamp(args.valence ?? 0, -1, 1),
      salience: this._clamp(args.salience ?? 0.5, 0, 1),
      confidence: this._clamp(args.confidence ?? 0.85, 0.1, 1),
      tags: this._tags(args.tags),
    };
    state.queue.nightMemories.push(memory);
    EventLog.add(`Memory noted: ${contact.name} — ${memory.text}`, 'info');
    Debug.log('crew memory staged', memory);
    return memory;
  },

  buildPromptContextForContact(contactId) {
    if (!contactId) return '';
    const p = SaveSystem.load();
    const permanent = p.contactMemories?.[contactId] || [];
    const tonight = (state.queue.nightMemories || []).filter(m => m.targetContactId === contactId);
    const memories = [...permanent, ...tonight]
      .sort((a, b) => (b.salience || 0) - (a.salience || 0))
      .slice(0, 5);
    if (memories.length === 0) return '';
    return `RELEVANT MEMORIES:
${memories.map(m => `- ${m.text}${m.confidence < 0.6 ? ' (fuzzy memory)' : ''}`).join('\n')}`;
  },

  linkNeighborToContact(neighbor, contactId, progress, reason = 'exchanged_numbers') {
    if (!neighbor || !contactId || !progress) return;
    progress.contactMemories = progress.contactMemories || {};
    progress.contactMemories[contactId] = progress.contactMemories[contactId] || [];
    neighbor.linkedContactId = contactId;

    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const firstMeeting = {
      id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      source: 'queue_neighbor',
      sourceName: neighbor.name,
      sourceMemoryId: neighbor.memoryId,
      targetContactId: contactId,
      venueId: state.selectedVenue,
      runNumber: (state.progress?.totalRuns || 0) + 1,
      type: 'first_meeting',
      subject: 'self',
      text: `First met the player outside ${venue?.name || 'a club'} while ${neighbor.quirk}.`,
      valence: Math.max(0, ((neighbor.affinity || 50) - 50) / 50),
      salience: 0.95,
      confidence: neighbor.disposition === 'drunk' ? 0.55 : 0.9,
      tags: ['first_meeting', 'queue', reason],
      promoted: true,
    };
    progress.contactMemories[contactId].push(firstMeeting);

    const staged = (state.queue.nightMemories || []).filter(m => m.sourceMemoryId === neighbor.memoryId);
    staged.forEach(m => {
      m.targetContactId = contactId;
      m.promoted = true;
      progress.contactMemories[contactId].push({ ...m, promoted: true });
    });
    progress.contactMemories[contactId] = progress.contactMemories[contactId].slice(-30);
  },

  linkStagedStrangerToContact(sourceMemoryId, contactId, progress, reason = 'joined_crew') {
    if (!sourceMemoryId || !contactId || !progress) return 0;
    const staged = (state.queue.nightMemories || []).filter(m => m.sourceMemoryId === sourceMemoryId);
    if (staged.length === 0) return 0;
    progress.contactMemories = progress.contactMemories || {};
    progress.contactMemories[contactId] = progress.contactMemories[contactId] || [];

    const first = staged[0];
    progress.contactMemories[contactId].push({
      id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      source: 'queue_neighbor',
      sourceName: first.sourceName,
      sourceMemoryId,
      targetContactId: contactId,
      venueId: first.venueId || state.selectedVenue,
      runNumber: first.runNumber,
      type: 'first_meeting',
      subject: 'self',
      text: `First met the player in the queue while ${first.sourceQuirk || 'waiting outside the club'}.`,
      valence: 0.5,
      salience: 0.9,
      confidence: first.sourceDisposition === 'drunk' ? 0.5 : 0.85,
      tags: ['first_meeting', 'queue', reason],
      promoted: true,
    });
    staged.forEach(m => {
      m.targetContactId = contactId;
      m.promoted = true;
      progress.contactMemories[contactId].push({ ...m, targetContactId: contactId, promoted: true });
    });
    progress.contactMemories[contactId] = progress.contactMemories[contactId].slice(-30);
    return staged.length;
  },

  _promotionChance(memory) {
    let chance = 0.1 + (memory.salience || 0) * 0.55 + Math.abs(memory.valence || 0) * 0.1 + (memory.confidence || 0.5) * 0.05;
    if (memory.type === 'first_meeting' || memory.type === 'promise' || memory.type === 'conflict' || memory.type === 'favor') chance += 0.2;
    if ((memory.tags || []).includes('inside_joke')) chance += 0.1;
    if (memory.sourceDisposition === 'drunk') chance *= 0.75;
    if (memory.sourceDisposition === 'anxious' && Math.abs(memory.valence || 0) > 0) chance += 0.1;
    return this._clamp(chance, 0.05, 0.95);
  },

  promoteNightMemories(success, venueId) {
    const staged = state.queue.nightMemories || [];
    if (staged.length === 0) return [];
    const p = SaveSystem.load();
    p.contactMemories = p.contactMemories || {};
    p.strangerMemories = p.strangerMemories || {};
    const promoted = [];

    staged.forEach(memory => {
      if (memory.promoted) return;
      const important = ['first_meeting', 'promise', 'conflict', 'favor'].includes(memory.type);
      const chance = important ? Math.max(0.85, this._promotionChance(memory)) : this._promotionChance(memory);
      if (Math.random() > chance) return;

      const saved = { ...memory, venueId: memory.venueId || venueId, success, promoted: true };
      if (saved.targetContactId) {
        p.contactMemories[saved.targetContactId] = p.contactMemories[saved.targetContactId] || [];
        p.contactMemories[saved.targetContactId].push(saved);
        p.contactMemories[saved.targetContactId] = p.contactMemories[saved.targetContactId].slice(-30);
      } else if (saved.sourceMemoryId) {
        p.strangerMemories[saved.sourceMemoryId] = p.strangerMemories[saved.sourceMemoryId] || {
          name: saved.sourceName,
          disposition: saved.sourceDisposition,
          quirk: saved.sourceQuirk,
          memories: [],
        };
        p.strangerMemories[saved.sourceMemoryId].memories.push(saved);
        p.strangerMemories[saved.sourceMemoryId].memories = p.strangerMemories[saved.sourceMemoryId].memories.slice(-20);
      }
      promoted.push(saved);
    });

    SaveSystem.save(p);
    state.queue.nightMemories = [];
    Debug.log('memory promoted', promoted);
    return promoted;
  },
};

