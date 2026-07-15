// ============================================================
// SHARED CONVERSATION CONTROLLER
// ============================================================

function normalizeToolArgs(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'string') {
    try { return JSON.parse(rawArgs); } catch (e) { return {}; }
  }
  return rawArgs;
}

const Conversation = {
  create({
    getContainer,
    getSendBtn,
    fallbackText = '...',
    errorLogMessage = 'Chat failed — try again',
  }) {
    return {
      generating: false,
      _pendingPlayerText: null,
      _pendingOptions: null,
      _typingEl: null,

      addBubble(text, cls, { html } = {}) {
        const el = document.createElement('div');
        el.className = 'chat-bubble ' + cls;
        if (html || text.includes('<img') || text.includes('<span')) {
          el.innerHTML = text;
        } else {
          el.textContent = text;
        }
        const container = getContainer();
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
        return el;
      },

      async generate(playerText, options) {
        if (this.generating) {
          if (options.queueWhileGenerating !== false) {
            this._pendingPlayerText = playerText;
            this._pendingOptions = options;
          }
          return;
        }
        this.generating = true;
        this._pendingOptions = options;
        const sendBtn = getSendBtn();
        if (options.disableSend !== false && sendBtn) sendBtn.disabled = true;

        if (options.showTypingIndicator !== false) {
          this._typingEl = this.addBubble('', 'npc');
          this._typingEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        }

        try {
          const llmMessages = options.buildMessages(playerText);
          let llmResult = null;
          if (LLM.loaded) {
            llmResult = await LLM.chat(
              llmMessages,
              options.tools,
              options.maxTokens,
              options.cacheKey,
            );
          }

          let dialogText = '';
          let toolCalls = [];
          if (llmResult) {
            dialogText = LLM._stripToolText(llmResult.text || '');
            toolCalls = llmResult.toolCalls || [];
          }

          const fb = options.fallback ?? fallbackText;
          if (!dialogText && toolCalls.length === 0) {
            dialogText = typeof fb === 'function' ? fb() : fb;
            if (dialogText !== '...') await sleep(500);
          }

          if (options.onToolCalls) options.onToolCalls(toolCalls);
          if (options.onSuccess) {
            await options.onSuccess({ dialogText, llmResult, toolCalls });
          }

          if (this._typingEl) {
            this._typingEl.innerHTML = '';
            this._typingEl.textContent = dialogText || '...';
            this._typingEl = null;
          }
        } catch (e) {
          console.error(errorLogMessage, e);
          EventLog.add(errorLogMessage, 'negative');
          if (this._typingEl) {
            this._typingEl.innerHTML = '';
            this._typingEl.textContent = '...';
            this._typingEl = null;
          }
        } finally {
          this.generating = false;
          if (options.disableSend !== false && sendBtn) sendBtn.disabled = false;
          const pending = this._pendingPlayerText;
          const pendingOpts = this._pendingOptions;
          this._pendingPlayerText = null;
          if (pending && pendingOpts) {
            await this.generate(pending, pendingOpts);
          }
        }
      },
    };
  },
};

// ============================================================
// PHASE 1: CHAT SYSTEM
// ============================================================

const ChatSystem = {
  currentNeighbor: null,
  messages: [],
  _convo: null,

  _getConvo() {
    if (!this._convo) {
      this._convo = Conversation.create({
        getContainer: () => $('chat-messages'),
        getSendBtn: () => $('chat-send'),
        fallbackText: '...',
        errorLogMessage: 'Neighbor chat failed — try again',
      });
    }
    return this._convo;
  },

  get generating() { return this._getConvo().generating; },

  open(neighbor, direction) {
    this.currentNeighbor = neighbor;
    this.messages = neighbor.chatHistory.length > 0 ? [...neighbor.chatHistory] : [];
    this._getConvo().generating = false;
    this._getConvo()._pendingPlayerText = null;

    $('chat-name').textContent = neighbor.name;
    $('chat-disp').textContent = neighbor.disposition + ` · ${neighbor.affinity || 50}/100`;

    // Generate portrait with current substance effects
    const fx = [];
    if (neighbor.disposition === 'drunk') fx.push('drunk');
    if (neighbor.hasSubstance === 'glitter') fx.push('glitter');
    if (neighbor.hasSubstance === 'turbo') fx.push('turbo');
    const portraitUrl = neighbor.portraitProps
      ? Portrait.generate(neighbor.portraitProps, neighbor.disposition, fx)
      : neighbor.portrait;
    const avatar = $('chat-avatar');
    avatar.style.background = 'none';
    avatar.style.border = '2px solid ' + neighbor.color;
    avatar.innerHTML = portraitUrl
      ? `<img src="${portraitUrl}" alt="${neighbor.name}">`
      : `<span style="color:#fff;font-size:13px;font-weight:800">${neighbor.initials}</span>`;

    const msgContainer = $('chat-messages');
    msgContainer.innerHTML = '';

    // Restore previous conversation if returning
    if (neighbor.chatHistory.length > 0) {
      this.addBubble(`Continuing conversation with ${neighbor.name}...`, 'system-msg');
      const lastFew = neighbor.chatHistory.slice(-4);
      for (const msg of lastFew) {
        if (msg.role === 'user') this.addBubble(msg.content, 'player');
        else if (msg.role === 'assistant') {
          const clean = LLM._stripToolText(msg.content).split('\n').join(' ').trim();
          if (clean) this.addBubble(clean, 'npc');
        }
      }
    } else {
      this.addBubble(`You turned to the person ${direction === 'front' ? 'ahead of' : 'behind'} you.`, 'system-msg');
    }

    $('chat-overlay').classList.add('active');
    $('chat-input').focus();
    this.renderItemButtons();

    // Initial greeting only on first conversation
    if (neighbor.chatHistory.length === 0) {
      this.generateResponse('*you make eye contact*').catch(e => {
        console.error('Chat generation failed:', e);
        EventLog.add('Neighbor chat failed — try again', 'negative');
      });
    }
  },

  renderItemButtons() {
    const container = $('chat-actions');
    if (!container) return;
    const allItems = { ...state.inventory };
    // Add Rissal's free items (only if Rissal made it through the flake roll)
    if (squadHasContact('rissal')) {
      allItems.gum = (allItems.gum || 0) + 1;
      allItems.lighter = (allItems.lighter || 0) + 1;
    }

    const buttons = [];
    for (const [id, qty] of Object.entries(allItems)) {
      if (qty <= 0) continue;
      const item = ITEMS.find(i => i.id === id) || KIOSK_ITEMS.find(i => i.id === id);
      const iconName = item?.icon || 'gum';
      const iconColor = item?.iconColor || '#ebe4ff';
      const name = item?.name || id;
      buttons.push(`<button class="chat-give-btn" data-give="${id}" title="Give ${name}">${PX.i(iconName, iconColor, 14)} Give ${name} (${qty})</button>`);
    }
    if (state.cash > 0) {
      buttons.push(`<button class="chat-give-btn" data-give="_money" title="Give some cash">${PX.i('coin','#ffd86b',14)} Give $5</button>`);
    }
    container.innerHTML = buttons.length > 0 ? buttons.join('') : '<span style="font-size:10px;color:var(--text-muted);padding:4px;">No items to give</span>';

    container.querySelectorAll('.chat-give-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.give;
        this.giveItem(itemId);
      });
    });
  },

  _refreshChatReactiveUi() {
    if (this.currentNeighbor) {
      $('chat-disp').textContent = this.currentNeighbor.disposition + ` · ${this.currentNeighbor.affinity || 50}/100`;
    }
    this.renderItemButtons();
    renderLoadout();
    updateConfirmBar();
  },

  giveItem(itemId) {
    if (this.generating) return;
    if (itemId === '_money') {
      if (state.cash < 5) { showToast('Not enough cash'); return; }
      state.cash -= 5;
      this.addBubble('Here, take five bucks.', 'player');
      this.addBubble('💵 You gave $5', 'system-msg');
      EventLog.add(`Gave $5 to ${this.currentNeighbor.name}`, 'info');
      this._refreshChatReactiveUi();
      this.generateResponse('*the player hands you $5*').catch(e => {
        console.error('Chat generation failed:', e);
        EventLog.add('Neighbor chat failed — try again', 'negative');
      });
    } else {
      if ((state.inventory[itemId] || 0) <= 0) { showToast('You don\'t have that'); return; }
      state.inventory[itemId]--;
      const item = ITEMS.find(i => i.id === itemId) || KIOSK_ITEMS.find(i => i.id === itemId);
      const name = item?.name || itemId;
      this.addBubble(`Here, take this ${name}.`, 'player');
      this.addBubble(`${item?.icon || '📦'} You gave ${name}`, 'system-msg');
      EventLog.add(`Gave ${name} to ${this.currentNeighbor.name}`, 'info');
      this._refreshChatReactiveUi();
      this.generateResponse(`*the player hands you a ${name}*`).catch(e => {
        console.error('Chat generation failed:', e);
        EventLog.add('Neighbor chat failed — try again', 'negative');
      });
    }
    QueueEngine.advanceTime(1);
    this.renderItemButtons();
  },

  close() {
    if (this.currentNeighbor) {
      const aff = this.currentNeighbor.affinity || 50;
      const label = aff >= 80 ? 'They love you' : aff >= 60 ? 'Good vibes' : aff >= 40 ? 'Neutral' : aff >= 20 ? 'Not feeling it' : 'They dislike you';
      showToast(`${this.currentNeighbor.name}: ${label} (${aff}/100)`, 2000);
    }
    $('chat-overlay').classList.remove('active');
    if (this.currentNeighbor?.memoryId) LLM.disposeCache(`neighbor:${this.currentNeighbor.memoryId}`);
    this.currentNeighbor = null;
    state.queue.actionLocked = false;
    QueueEngine.updateMeters();
  },

  addBubble(text, cls) {
    return this._getConvo().addBubble(text, cls);
  },

  async sendMessage(text) {
    if (!text.trim() || this.generating) return;
    this.addBubble(text, 'player');
    $('chat-input').value = '';

    // Each message = 1 min game time
    QueueEngine.advanceTime(1);

    await this.generateResponse(text);
  },

  async generateResponse(playerText) {
    const neighbor = this.currentNeighbor;
    await this._getConvo().generate(playerText, {
      buildMessages: (pt) => {
        const venue = VENUES.find(v => v.id === state.selectedVenue);
        const systemPrompt = buildNeighborSystemPrompt(neighbor, venue);
        this.messages.push({ role: 'user', content: pt });
        return [
          { role: 'system', content: systemPrompt },
          ...this.messages.slice(-8),
        ];
      },
      tools: NEIGHBOR_TOOLS,
      maxTokens: 150,
      cacheKey: neighbor ? `neighbor:${neighbor.memoryId}` : null,
      onToolCalls: (toolCalls) => this._handleToolCalls(toolCalls),
      onSuccess: ({ dialogText, llmResult }) => {
        this.messages.push({ role: 'assistant', content: llmResult?.rawText || dialogText });
        if (this.currentNeighbor) {
          this.currentNeighbor.chatHistory = [...this.messages];
        }
      },
    });
  },

  _handleToolCalls(toolCalls) {
    for (const tc of toolCalls) {
      const fn = tc.function?.name || tc.name;
      const args = normalizeToolArgs(tc.function?.arguments || tc.arguments || {});
      switch (fn) {
        case 'share_intel':
          this.handleIntel(args.intel || '');
          break;
        case 'want_item':
          this.handleWant(args.item || '');
          break;
        case 'offer_item':
          this.handleOffer(args.item || '');
          break;
        case 'give_money': {
          const amt = args.amount || 0;
          if (amt > 0) {
            state.cash += amt;
            setTimeout(() => this.addBubble(`${PX.i('coin','#ffd86b',12)} Received $${amt}`, 'system-msg'), 200);
            this._refreshChatReactiveUi();
          }
          break;
        }
        case 'change_affinity':
          if (this.currentNeighbor) {
            this.currentNeighbor.affinity = Math.max(0, Math.min(100, (this.currentNeighbor.affinity || 50) + (args.delta || 0)));
            this._refreshChatReactiveUi();
          }
          break;
        case 'exchange_numbers':
          this.handleUnlock('');
          break;
        case 'end_conversation':
          setTimeout(() => { this.addBubble(`${this.currentNeighbor.name} turned away.`, 'system-msg negative'); setTimeout(() => this.close(), 1000); }, 500);
          break;
        case 'leave_queue':
          this._handleLeaveQueue(args.reason || '');
          break;
        case 'swap_spots':
          this._handleSwapSpots(args.reason || '');
          break;
        case 'accept_flirt':
          this._handleAcceptFlirt(args.reason || '');
          break;
        case 'form_alliance':
          this._handleFormAlliance(args.reason || '');
          break;
        case 'remember':
          this.handleRemember(args);
          break;
      }
    }
  },

  handleRemember(args) {
    if (!this.currentNeighbor) return;
    MemorySystem.rememberFromNeighbor(this.currentNeighbor, args);
  },

  handleIntel(text) {
    const key = this.currentNeighbor?.intel?.key || 'unknown_' + Date.now();
    if (!state.queue.revealedIntel.includes(key)) {
      state.queue.revealedIntel.push(key);
      setTimeout(() => {
        this.addBubble(`🔑 INTEL ACQUIRED: ${text}`, 'system-msg');
        QueueEngine.modHope(5);
        QueueEngine.addTrait('Insider Info');
        QueueEngine.addTrait('Street Cred');
        EventLog.add(`🔑 Intel from ${this.currentNeighbor?.name || 'stranger'}: ${text}`, 'intel');
      }, 300);
    }
  },

  handleWant(itemName) {
    const normalized = itemName.toLowerCase().trim();
    const hasIt = (state.inventory[normalized] || 0) > 0;
    if (hasIt) {
      setTimeout(() => {
        this.addBubble(`${this.currentNeighbor.name} wants your ${itemName}. Tap here to give it.`, 'system-msg');
        const giveBtn = this.addBubble(`Give ${itemName}?`, 'system-msg');
        giveBtn.style.cursor = 'pointer';
        giveBtn.style.textDecoration = 'underline';
        giveBtn.addEventListener('click', () => {
          state.inventory[normalized]--;
          this.addBubble(`You gave ${this.currentNeighbor.name} your ${itemName}.`, 'system-msg');
          this._refreshChatReactiveUi();
          giveBtn.remove();
          const intelText = this.currentNeighbor?.intel?.text || '';
          const nudge = intelText
            ? `*the player gave you the ${itemName} you wanted* Now share the intel you promised. Your intel: ${intelText}`
            : `*the player gave you the ${itemName} you wanted* Now share the intel you promised.`;
          this.generateResponse(nudge).catch(e => {
            console.error('Chat generation failed:', e);
            EventLog.add('Neighbor chat failed — try again', 'negative');
          });
        });
      }, 200);
    }
  },

  handleUnlock(reason) {
    if (!this.currentNeighbor) return;
    const n = this.currentNeighbor;
    setTimeout(() => {
      this.addBubble(`${PX.i('heart','#ff69b4',12)} ${n.name} wants to exchange numbers!`, 'system-msg');
      const acceptBtn = this.addBubble('Add to contacts?', 'system-msg');
      acceptBtn.style.cursor = 'pointer';
      acceptBtn.style.textDecoration = 'underline';
      acceptBtn.addEventListener('click', () => {
        const p = SaveSystem.load();
        const allIds = CONTACTS.map(c => c.id);
        const locked = allIds.filter(id => !p.unlockedContacts.includes(id));
        if (locked.length > 0) {
          const newId = locked[Math.floor(Math.random() * locked.length)];
          p.unlockedContacts.push(newId);
          const key = ['player', newId].sort().join(':');
          p.bonds[key] = Math.max(p.bonds[key] || 0, Math.round(n.affinity * 0.3));
          MemorySystem.linkNeighborToContact(n, newId, p, 'exchanged_numbers');
          SaveSystem.save(p);
          const c = CONTACTS.find(ct => ct.id === newId);
          this.addBubble(`${PX.i('star','#39ff14',12)} New contact unlocked: ${c?.name || 'someone new'}!`, 'system-msg');
          EventLog.add(`New contact: ${c?.name} (met ${n.name} in queue, affinity ${n.affinity})`, 'positive');
        } else {
          this.addBubble('You already know everyone!', 'system-msg');
        }
        acceptBtn.remove();
      });
    }, 300);
  },

  handleOffer(itemName) {
    setTimeout(() => {
      const normalized = itemName.toLowerCase().trim();
      const substance = KIOSK_ITEMS.find(i => i.id === normalized && i.trait);
      if (substance) {
        this.addBubble(`${this.currentNeighbor.name} slipped you some ${substance.name}`, 'system-msg');
        const acceptBtn = this.addBubble(`Take the ${substance.name}?`, 'system-msg');
        acceptBtn.style.cursor = 'pointer';
        acceptBtn.style.textDecoration = 'underline';
        acceptBtn.addEventListener('click', () => {
          if (substance.effectVal.anxiety) QueueEngine.modAnxiety(substance.effectVal.anxiety);
          if (substance.effectVal.hope) QueueEngine.modHope(substance.effectVal.hope);
          if (substance.trait) QueueEngine.addTrait(substance.trait);
          if (substance.delayedEffect) {
            state.queue.delayedEffects.push({
              turnsLeft: substance.delayedEffect.turns,
              anxiety: substance.delayedEffect.anxiety || 0,
              trait: 'Paranoid',
              label: '😰 The Turbo is wearing off...',
            });
          }
          this.addBubble(`You took the ${substance.name}.`, 'system-msg');
          this._refreshChatReactiveUi();
          acceptBtn.remove();
        });
      } else {
        this.addBubble(`${this.currentNeighbor.name} offers you: ${itemName}`, 'system-msg');
        state.inventory[normalized] = (state.inventory[normalized] || 0) + 1;
        this._refreshChatReactiveUi();
      }
    }, 200);
  },

  _handleLeaveQueue(reason) {
    const neighbor = this.currentNeighbor;
    if (!neighbor) return;
    setTimeout(() => {
      this.addBubble(`👋 ${neighbor.name} decides to leave the queue.`, 'system-msg');
      if (reason) this.addBubble(`"${reason}"`, 'system-msg');
      EventLog.add(`${neighbor.name} left the queue! Position +1`, 'positive');
      state.queue.position = Math.max(0, state.queue.position - 1);
      QueueEngine.modHope(8);
      // Remove from neighbor lists
      state.queue.allNeighbors = state.queue.allNeighbors.filter(n => n !== neighbor);
      state.queue.behindNeighbors = state.queue.behindNeighbors.filter(n => n !== neighbor);
      state.queue.neighborFront = state.queue.allNeighbors[state.queue.allNeighbors.length - 1] || null;
      state.queue.neighborBack = state.queue.behindNeighbors[0] || null;
      QueueEngine.rebuildQueueViz();
      setTimeout(() => this.close(), 1500);
      if (state.queue.position <= 0) setTimeout(() => QueueEngine.reachFront(), 2000);
    }, 300);
  },

  _handleSwapSpots(reason) {
    const neighbor = this.currentNeighbor;
    if (!neighbor) return;
    const isFront = state.queue.allNeighbors.includes(neighbor);
    if (!isFront) {
      this.addBubble(`(They're behind you — swap doesn't help here)`, 'system-msg');
      return;
    }
    setTimeout(() => {
      this.addBubble(`🔄 ${neighbor.name} steps back and lets you ahead.`, 'system-msg');
      if (reason) this.addBubble(`"${reason}"`, 'system-msg');
      EventLog.add(`Swapped spots with ${neighbor.name}! Position +1`, 'positive');
      state.queue.position = Math.max(0, state.queue.position - 1);
      QueueEngine.modHope(5);
      // Move neighbor from front to behind
      state.queue.allNeighbors = state.queue.allNeighbors.filter(n => n !== neighbor);
      state.queue.behindNeighbors.unshift(neighbor);
      state.queue.neighborFront = state.queue.allNeighbors[state.queue.allNeighbors.length - 1] || null;
      state.queue.neighborBack = state.queue.behindNeighbors[0] || null;
      QueueEngine.rebuildQueueViz();
      setTimeout(() => this.close(), 1500);
      if (state.queue.position <= 0) setTimeout(() => QueueEngine.reachFront(), 2000);
    }, 300);
  },

  _handleAcceptFlirt(reason) {
    const neighbor = this.currentNeighbor;
    if (!neighbor) return;
    setTimeout(() => {
      this.addBubble(`💫 ${neighbor.name} is into it.`, 'system-msg');
      if (reason) this.addBubble(`"${reason}"`, 'system-msg');
      neighbor.affinity = Math.min(100, (neighbor.affinity || 50) + 20);
      QueueEngine.modAnxiety(-8);
      QueueEngine.addTrait('Charmer');
      if (neighbor.intel && !state.queue.revealedIntel.includes(neighbor.intel.key)) {
        state.queue.revealedIntel.push(neighbor.intel.key);
        this.addBubble(`🔑 ${neighbor.name} leans in and whispers useful intel.`, 'system-msg');
        EventLog.add(`💫 Flirted intel from ${neighbor.name}: ${neighbor.intel.text}`, 'intel');
      }
      EventLog.add(`Flirted successfully with ${neighbor.name}`, 'positive');
      this._refreshChatReactiveUi();
    }, 250);
  },

  _handleFormAlliance(reason) {
    const neighbor = this.currentNeighbor;
    if (!neighbor) return;
    setTimeout(() => {
      if (SocialActions.allianceFormed) {
        this.addBubble(`🤝 You already have a queue alliance tonight.`, 'system-msg');
        return;
      }
      SocialActions.allianceFormed = true;
      state.queue.allyData = { name: neighbor.name, disposition: neighbor.disposition };
      neighbor.affinity = Math.min(100, (neighbor.affinity || 50) + 10);
      QueueEngine.addTrait('Queue Alliance');
      QueueEngine.modHope(10);
      this.addBubble(`🤝 ${neighbor.name} agrees to vouch for you at the door.`, 'system-msg');
      if (reason) this.addBubble(`"${reason}"`, 'system-msg');
      EventLog.add(`Formed alliance with ${neighbor.name} — they'll vouch at the door`, 'positive');
      this._refreshChatReactiveUi();
    }, 250);
  },
};

// ============================================================
// PHASE 1: CREW CHAT SYSTEM
// ============================================================

const CrewChatSystem = {
  active: false,
  mode: null,
  memberName: null,
  contact: null,
  _convo: null,

  _getConvo() {
    if (!this._convo) {
      this._convo = Conversation.create({
        getContainer: () => $('chat-messages'),
        getSendBtn: () => $('chat-send'),
        errorLogMessage: 'Crew chat failed — try again',
      });
    }
    return this._convo;
  },

  get generating() { return this._getConvo().generating; },

  openGroup() {
    if (state.finalSquad.length === 0) {
      showToast('No crew tonight — you are solo', 1500);
      return;
    }
    this.active = true;
    this.mode = 'group';
    this.memberName = null;
    this.contact = null;
    state.queue.actionLocked = true;

    $('chat-name').textContent = 'Your Crew';
    $('chat-disp').textContent = `${state.finalSquad.length} friend${state.finalSquad.length > 1 ? 's' : ''} · hope ${Math.round(state.queue.hope)} · anxiety ${Math.round(state.queue.anxiety)}`;
    const avatar = $('chat-avatar');
    avatar.style.background = 'rgba(123,117,255,0.12)';
    avatar.style.border = '2px solid var(--neon-purple)';
    avatar.innerHTML = PX.i('people', '#7b75ff', 26);

    $('chat-messages').innerHTML = '';
    this.addBubble('You pull your crew into a quick group huddle.', 'system-msg');
    (state.queue.crewChatHistory || []).slice(-6).forEach(msg => {
      if (msg.role === 'user') this.addBubble(msg.content, 'player');
      if (msg.role === 'assistant') this.addBubble(LLM._stripToolText(msg.content), 'npc');
    });
    $('chat-actions').innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:4px;">Crew chat can calm anxiety, restore morale, and create memories.</span>';
    $('chat-input').placeholder = 'Say something to the crew...';
    $('chat-overlay').classList.add('active');
    $('chat-input').focus();
  },

  openMember(name) {
    const member = state.finalSquad.find(m => m.name === name);
    const contact = CONTACTS.find(c => c.name === name);
    if (!member || !contact) return;
    this.active = true;
    this.mode = 'member';
    this.memberName = name;
    this.contact = contact;
    state.queue.actionLocked = true;

    $('chat-name').textContent = name;
    const stats = state.queue.memberStats[name];
    $('chat-disp').textContent = `${contact.trait} · morale ${Math.round(stats?.morale ?? 0)} · warmth ${Math.round(stats?.warmth ?? 0)}`;
    const portrait = contact.portraitProps ? Portrait.generate(contact.portraitProps, 'friendly', []) : '';
    const avatar = $('chat-avatar');
    avatar.style.background = 'none';
    avatar.style.border = '2px solid ' + (contact.color || '#7b75ff');
    avatar.innerHTML = portrait ? `<img src="${portrait}" alt="${name}">` : `<span>${contact.initials}</span>`;

    $('chat-messages').innerHTML = '';
    this.addBubble(`You step aside with ${name} for a quick one-on-one.`, 'system-msg');
    const history = state.queue.crewMemberChats[name] || [];
    history.slice(-6).forEach(msg => {
      if (msg.role === 'user') this.addBubble(msg.content, 'player');
      if (msg.role === 'assistant') this.addBubble(LLM._stripToolText(msg.content), 'npc');
    });
    $('chat-actions').innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:4px;">One-on-one talks are best for morale, promises, and personal memories.</span>';
    $('chat-input').placeholder = `Say something to ${name}...`;
    $('chat-overlay').classList.add('active');
    $('chat-input').focus();
  },

  close() {
    $('chat-overlay').classList.remove('active');
    $('chat-input').placeholder = 'Say something...';
    if (this.mode === 'group') LLM.disposeCache(`crew:group:${state.selectedVenue}`);
    if (this.mode === 'member' && this.contact) LLM.disposeCache(`crew:member:${this.contact.id}:${state.selectedVenue}`);
    this.active = false;
    this.mode = null;
    this.memberName = null;
    this.contact = null;
    this._getConvo().generating = false;
    this._getConvo()._pendingPlayerText = null;
    state.queue.actionLocked = false;
    QueueEngine.updateMeters();
    MemberStats.render();
  },

  addBubble(text, cls) {
    return this._getConvo().addBubble(text, cls);
  },

  _history() {
    if (this.mode === 'group') return state.queue.crewChatHistory;
    state.queue.crewMemberChats[this.memberName] = state.queue.crewMemberChats[this.memberName] || [];
    return state.queue.crewMemberChats[this.memberName];
  },

  _buildGroupPrompt() {
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const crewLines = state.finalSquad.map(m => {
      const c = CONTACTS.find(ct => ct.name === m.name);
      const stats = state.queue.memberStats[m.name];
      const memory = c ? MemorySystem.buildPromptContextForContact(c.id) : '';
      return `- ${m.name}: ${c?.trait || 'Crew member'}, likes ${c?.musicPref || 'music'}, morale ${Math.round(stats?.morale ?? 0)}, warmth ${Math.round(stats?.warmth ?? 0)}${memory ? `\n${memory}` : ''}`;
    }).join('\n');
    return `You are writing the crew's group-chat style response while everyone waits outside ${venue?.name || 'the club'}.
Current meters: Hope ${Math.round(state.queue.hope)}, Anxiety ${Math.round(state.queue.anxiety)}, queue position ${state.queue.position}.
Crew:
${crewLines}

Reply as one or more crew members in short casual lines. Keep the total response under 4 short sentences.
Use reduce_anxiety if the player's message genuinely calms the group.
Use boost_hope if it makes the night feel worth it again.
Use boost_morale when a specific member feels supported.
Use remember for promises, inside jokes, emotional moments, or funny details worth future callbacks.
NEVER mention tool names in the chat lines themselves — tools are silent actions, the lines are only what the crew actually types.`;
  },

  _buildMemberPrompt() {
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const contact = this.contact;
    const stats = state.queue.memberStats[this.memberName];
    const memories = MemorySystem.buildPromptContextForContact(contact.id);
    return `You are ${contact.name}, a crew member waiting with the player outside ${venue?.name || 'the club'}.
Trait: ${contact.trait} — ${contact.traitDesc}
Music preference: ${contact.musicPref}
Current state: morale ${Math.round(stats?.morale ?? 0)}, warmth ${Math.round(stats?.warmth ?? 0)}, squad anxiety ${Math.round(state.queue.anxiety)}, hope ${Math.round(state.queue.hope)}.
${memories || 'No strong memories with the player yet.'}

Reply to the player in 1-2 short sentences, in character.
If they reassure you, use reduce_anxiety and boost_morale.
If they make a meaningful promise, share a vulnerable detail, or create an inside joke, use remember.
If they pressure you selfishly, do not reward them.
NEVER mention tool names in your spoken reply — tools are silent actions.`;
  },

  async sendMessage(text) {
    if (!text.trim() || this.generating) return;
    this.addBubble(text, 'player');
    $('chat-input').value = '';
    QueueEngine.advanceTime(1);
    await this.generateResponse(text);
  },

  async generateResponse(playerText) {
    await this._getConvo().generate(playerText, {
      buildMessages: (pt) => {
        const history = this._history();
        history.push({ role: 'user', content: pt });
        return [
          { role: 'system', content: this.mode === 'group' ? this._buildGroupPrompt() : this._buildMemberPrompt() },
          ...history.slice(-8),
        ];
      },
      tools: CREW_TOOLS,
      maxTokens: 140,
      cacheKey: this.mode === 'group'
        ? `crew:group:${state.selectedVenue}`
        : `crew:member:${this.contact?.id}:${state.selectedVenue}`,
      fallback: () => this.mode === 'group'
        ? `${state.finalSquad[0]?.name || 'Crew'}: Yeah... okay, let's keep it together.`
        : `${this.memberName}: Yeah. I needed to hear that.`,
      onToolCalls: (toolCalls) => this._handleToolCalls(toolCalls),
      onSuccess: ({ dialogText, llmResult }) => {
        const history = this._history();
        history.push({ role: 'assistant', content: llmResult?.rawText || dialogText });
      },
    });
  },

  _handleToolCalls(toolCalls) {
    for (const tc of toolCalls) {
      const fn = tc.function?.name || tc.name;
      let args = normalizeToolArgs(tc.function?.arguments || tc.arguments || {});
      if (fn === 'remember') {
        if (this.mode === 'member' && this.contact) {
          MemorySystem.rememberFromCrewMember(this.contact, args, 'crew_one_on_one');
        } else {
          state.finalSquad.forEach(m => {
            const c = CONTACTS.find(ct => ct.name === m.name);
            if (c) MemorySystem.rememberFromCrewMember(c, args, 'crew_group');
          });
        }
      } else if (fn === 'reduce_anxiety') {
        const amount = Math.min(12, Math.max(1, Math.abs(Number(args.amount) || 4)));
        QueueEngine.modAnxiety(-amount);
        this.addBubble(`Crew anxiety -${amount}: ${args.reason || 'they feel steadier'}`, 'system-msg');
      } else if (fn === 'boost_hope') {
        const amount = Math.min(12, Math.max(1, Math.abs(Number(args.amount) || 4)));
        QueueEngine.modHope(amount);
        this.addBubble(`Hope +${amount}: ${args.reason || 'the night feels worth it'}`, 'system-msg');
      } else if (fn === 'boost_morale') {
        const amount = Math.min(20, Math.max(1, Math.abs(Number(args.amount) || 6)));
        const target = args.member || this.memberName;
        if (target && state.queue.memberStats[target]) {
          MemberStats.boostMorale(target, amount);
          this.addBubble(`${target} morale +${amount}: ${args.reason || 'supported'}`, 'system-msg');
        } else if (this.mode === 'group') {
          state.finalSquad.forEach(m => MemberStats.boostMorale(m.name, Math.ceil(amount / 2)));
          this.addBubble(`Crew morale +${Math.ceil(amount / 2)}: ${args.reason || 'group support'}`, 'system-msg');
        }
      }
    }
  },
};

