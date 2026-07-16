// ============================================================
// PHASE 2: BOUNCER DATA
// ============================================================

const BOUNCERS = [
  {
    id: 'florian', name: 'Florian',
    personality: 'Cold, corporate, evaluative',
    softSpot: 'Respects confidence and name-drops',
    trigger: 'Hates nervousness and fidgeting',
    portraitProps: { skin: '#e8b88a', hairColor: '#2d2d2d', hairStyle: 'buzz', shirtColor: '#1a1a2e', accessory: 'sunglasses', faceWidth: 7, faceHeight: 8, eyeSpacing: 4, noseSize: 2, earSize: 1, seed: 0.3 },
  },
  {
    id: 'marko', name: 'Big Marko',
    personality: 'Intimidating but fair',
    softSpot: 'Respects honesty and small groups',
    trigger: 'Hates arrogance and loud people',
    portraitProps: { skin: '#8d5524', hairColor: '#1a1a2e', hairStyle: 'bald', shirtColor: '#1a1a2e', accessory: 'earring', faceWidth: 8, faceHeight: 8, eyeSpacing: 4, noseSize: 2, earSize: 2, seed: 0.7 },
  },
  {
    id: 'kai', name: 'Kai',
    personality: 'Chill, music-obsessed DJ-turned-bouncer',
    softSpot: 'Loves genre knowledge and vinyl talk',
    trigger: 'Hates people who don\'t know the lineup',
    portraitProps: { skin: '#c68642', hairColor: '#4a90d9', hairStyle: 'mohawk', shirtColor: '#3c1053', accessory: 'headband', faceWidth: 6, faceHeight: 8, eyeSpacing: 3, noseSize: 1, earSize: 1, seed: 0.5 },
  },
  {
    id: 'silent', name: 'The Silent One',
    personality: 'Says almost nothing. Just stares.',
    softSpot: 'Evaluates pure style and composure',
    trigger: 'Any talking makes it worse',
    portraitProps: { skin: '#6b3e26', hairColor: '#1a1a2e', hairStyle: 'bald', shirtColor: '#0d0b22', accessory: 'sunglasses', faceWidth: 8, faceHeight: 9, eyeSpacing: 4, noseSize: 2, earSize: 1, seed: 0.9 },
  },
  {
    id: 'mira', name: 'Desk Lady Mira',
    personality: 'Clipboard, guest list, bureaucratic precision',
    softSpot: 'Names on the list, proper credentials',
    trigger: 'Arguing or showing attitude',
    portraitProps: { skin: '#f0c5a0', hairColor: '#3d2b1f', hairStyle: 'bob', shirtColor: '#2d2d2d', accessory: 'glasses', faceWidth: 6, faceHeight: 7, eyeSpacing: 3, noseSize: 1, earSize: 1, seed: 0.2 },
  },
];

const POLICY_TIERS = ['Easy', 'Moderate', 'Ruthless', 'Nightmare'];

function easePolicyTier(policy) {
  const idx = POLICY_TIERS.indexOf(policy);
  if (idx <= 0) return policy;
  return POLICY_TIERS[idx - 1];
}

function pickTonightsBouncer(venueId) {
  const prog = SaveSystem.load();
  let seed = (prog.totalRuns || 0) * 31;
  for (let i = 0; i < venueId.length; i++) seed += venueId.charCodeAt(i) * (i + 7);
  return BOUNCERS[Math.abs(seed) % BOUNCERS.length];
}

function ensureTonightsBouncer(venueId) {
  if (tonightsBouncer && tonightsBouncerVenueId === venueId) return tonightsBouncer;
  tonightsBouncer = pickTonightsBouncer(venueId);
  tonightsBouncerVenueId = venueId;
  return tonightsBouncer;
}

const VENUE_THRESHOLDS = { Easy: 40, Moderate: 60, Ruthless: 85, Nightmare: 100 };

// ============================================================
// PHASE 2: BOUNCER INTERJECTIONS (Alliance Vouch + Squad Chime-in)
// ============================================================

const BouncerInterjections = {
  async generateAllyVouch(allyData, bouncerName, venueName) {
    const { name, disposition } = allyData;
    const dispDesc = disposition === 'friendly' ? 'warm and confident' :
                     disposition === 'drunk' ? 'tipsy and loud' :
                     disposition === 'anxious' ? 'nervous but trying' :
                     disposition === 'hostile' ? 'reluctant and terse' : 'calm and measured';

    if (LLM.loaded) {
      try {
        const result = await LLM.chat([
          { role: 'system', content: `You are ${name}, a ${dispDesc} person who just walked up to vouch for your friends at a club door. The bouncer's name is ${bouncerName}. The club is ${venueName}.
Write ONE sentence (max 15 words) that you say to the bouncer to vouch for the group. Stay in character — if you're drunk, slur a bit. If you're nervous, stammer. If you're hostile, be minimal. If you're friendly, be warm and natural.
Reply with ONLY the spoken line, no quotes, no narration.` },
          { role: 'user', content: 'What do you say to the bouncer?' },
        ], null, 40);
        if (result?.text?.trim()) return result.text.trim();
      } catch (e) {}
    }

    const fallbacks = {
      friendly: [`Hey ${bouncerName}, they're with me — good people, I promise.`, `These are my friends, we come here all the time.`],
      drunk: [`${bouncerName}!! These are my BEST friends, let them innnn!`, `Brooo they're cool I swear, I know them!`],
      anxious: [`Um, hey — they're, uh, they're with me? If that helps?`, `I can vouch for them... they're really nice, I think.`],
      hostile: [`They're fine. Let them in.`, `I know them. That's all you need.`],
      neutral: [`${bouncerName}, they're with me tonight.`, `I can confirm they're good people.`],
    };
    const pool = fallbacks[disposition] || fallbacks.neutral;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  async generateSquadChimeIn(member, bouncerName, venueName, conversationContext) {
    const contact = CONTACTS.find(c => c.name === member.name);
    const trait = contact?.trait || 'unknown';
    const musicPref = contact?.musicPref || '';

    const traitDesc = trait === 'Hype Engine' ? 'loud, energetic, always hyping everything up' :
                      trait === 'Connected Promoter' ? 'well-connected, name-drops naturally, socially savvy' :
                      trait === 'The Chill Coder' ? 'quiet, calm, minimal words but grounding presence' :
                      trait === 'The Fashionista' ? 'fashion-obsessed, style-conscious, a bit vain' :
                      trait === 'Chaos Agent' ? 'unpredictable, wild, says whatever comes to mind' :
                      trait === 'The Insider' ? 'knows the scene well, drops knowledge casually' :
                      trait === 'The Photographer' ? 'artsy, observant, always framing things visually' :
                      trait === 'The Dealer' ? 'street-smart, transactional, reads people quickly' :
                      'a regular person in the group';

    if (LLM.loaded) {
      try {
        const result = await LLM.chat([
          { role: 'system', content: `You are ${member.name}, standing behind your friend at the door of ${venueName}. The bouncer ${bouncerName} is deciding whether to let your group in.
Your personality: ${traitDesc}. ${musicPref ? `You love ${musicPref}.` : ''}
The conversation so far: the bouncer just spoke and your friend just replied.

You decide to chime in with ONE short sentence (max 12 words). Stay in character.
- If you're a Hype Engine: be enthusiastic but it might be too much
- If you're a Promoter: name-drop or mention connections
- If you're a Chill Coder: say something calm and grounding
- If you're a Fashionista: comment on style or the venue's aesthetic
- If you're a Chaos Agent: say something completely random or wild
- If you're an Insider: drop a relevant fact about the venue/scene
Reply with ONLY the spoken line, no quotes, no narration.` },
          { role: 'user', content: `Context: ${conversationContext}\nWhat do you say?` },
        ], null, 40);
        if (result?.text?.trim()) return result.text.trim();
      } catch (e) {}
    }

    const fallbacks = {
      'Hype Engine': ["LET'S GO! Best night of the year!", "We're SO ready for this!", "The energy tonight is INSANE!"],
      'Connected Promoter': [`We know the promoter — check with them.`, `Sven said we're good tonight.`, `The whole crew is inside already.`],
      'The Chill Coder': ["We're just here for the music, nothing crazy.", "*nods calmly*", "Good vibes only, promise."],
      'The Fashionista': ["We dressed specifically for tonight.", "*adjusts outfit confidently*", "Notice the coordination? We planned this."],
      'Chaos Agent': ["I once got in by doing a backflip. Want to see?", "My horoscope said tonight's THE night.", "You remind me of my therapist. That's a compliment."],
      'The Insider': [`${tonightsDJs?.headliner || 'The headliner'} is a friend.`, "Been coming here since opening week.", "I know the sound system better than the sound guy."],
      'The Photographer': ["I'm shooting content tonight — the venue looks incredible.", "This lighting is perfect for the series I'm working on."],
      'The Dealer': ["We're good people. No trouble.", "Business and pleasure — we know the difference."],
    };
    const pool = fallbacks[trait] || ["We're cool, promise.", "Yeah, what they said."];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  shouldAllyFire(exchangeCount, allyFired) {
    if (!state.queue.allyData || allyFired) return false;
    if (exchangeCount < 2 || exchangeCount > 4) return false;
    return Math.random() < 0.75;
  },

  shouldSquadChimeIn(exchangeCount, chimeInCount) {
    if (state.finalSquad.length === 0) return false;
    if (chimeInCount >= 2) return false;
    if (exchangeCount < 1) return false;
    return Math.random() < 0.25;
  },

  pickSquadMember(chimeInCount) {
    const available = state.finalSquad.filter(m => !m._chimedIn);
    if (available.length === 0) return state.finalSquad[Math.floor(Math.random() * state.finalSquad.length)];
    return available[Math.floor(Math.random() * available.length)];
  },
};

// ============================================================
// PHASE 2: BOUNCER ENGINE
// ============================================================

const BouncerSystem = {
  bouncer: null,
  messages: [],
  exchangeCount: 0,
  approval: 0,
  threshold: 40,
  timer: null,
  timerDuration: 10000,
  canvas: null,
  ctx: null,
  backstory: '',
  finished: false,
  _convo: null,
  _pendingPlayerText: null,

  _SCRIPTED_OPENERS: {
    florian: 'Name. Guest list or move along.',
    marko: 'How many of you? Keep it short.',
    kai: "You know who's playing tonight?",
    silent: '*stares without speaking*',
    mira: 'ID and guest list name, please.',
  },

  _SCRIPTED_REPLIES: [
    'And?',
    'Keep talking.',
    'Not convinced yet.',
    'Hmm.',
    'Go on.',
  ],

  _SCRIPTED_POLITE: ['please', 'thank', 'respect', 'excuse', 'sorry', 'appreciate', 'honored', 'would love', 'good evening', 'hello'],
  _SCRIPTED_INSULTS: ['let me in', 'come on', 'idiot', 'stupid', 'hate', 'suck', 'asshole', 'desperate', 'please please', 'beg', 'dick', 'loser'],

  _scoreScriptedMessage(text) {
    const lower = (text || '').toLowerCase();
    const secrets = tonightsSecrets?.facts || {};
    const password = tonightsSecrets?.password;
    let delta = 0;

    const haystacks = [...Object.values(secrets), password].filter(Boolean);
    for (const fact of haystacks) {
      const factLower = String(fact).toLowerCase();
      const words = factLower.split(/\s+/).filter(w => w.length > 4);
      if (lower.includes(factLower) || words.some(w => lower.includes(w))) {
        delta += 20;
        break;
      }
    }

    if (this._SCRIPTED_POLITE.some(w => lower.includes(w))) delta += 8;
    if (this._SCRIPTED_INSULTS.some(w => lower.includes(w))) delta -= 10;
    return delta;
  },

  async _scriptedBouncerSpeak(context, options = {}) {
    const internal = options.internal;
    if (!internal && this.generating) return;
    if (!internal) {
      this.generating = true;
      $('bouncer-send').disabled = true;
    }

    try {
      this.messages.push({ role: 'user', content: context });

      let cleanText = '';
      const bouncerToolCalls = [];
      const isOpening = context.includes('approaches the door');

      if (isOpening) {
        cleanText = this._SCRIPTED_OPENERS[this.bouncer?.id] || 'State your business.';
      } else {
        const delta = this._scoreScriptedMessage(context);
        if (delta !== 0) {
          if (delta > 0) {
            this.approval = Math.min(120, this.approval + delta);
            EventLog.add(`${PX.i('heart','#39ff14',10)} +${delta}: they said something useful`, 'positive');
          } else {
            this.approval = Math.max(0, this.approval + delta);
            EventLog.add(`${PX.i('skull','#ff4d6d',10)} ${delta}: rubbed you the wrong way`, 'negative');
          }
        }
        cleanText = this._SCRIPTED_REPLIES[this.exchangeCount % this._SCRIPTED_REPLIES.length];
      }

      $('approval-fill').style.width = Math.min(this.approval, 100) + '%';
      $('approval-score').textContent = this.approval;

      this.messages.push({ role: 'assistant', content: cleanText });
      if (cleanText) this._addBubble(cleanText, 'npc');
      this.exchangeCount++;

      if (this.exchangeCount >= 4) {
        const success = this.approval >= this.threshold;
        bouncerToolCalls.push({ function: { name: success ? 'let_in' : 'reject', arguments: {} } });
      }

      let hasLetIn = false, hasReject = false;
      for (const tc of bouncerToolCalls) {
        const fn = tc.function?.name || tc.name;
        if (fn === 'let_in') hasLetIn = true;
        if (fn === 'reject') hasReject = true;
      }

      if (hasLetIn) {
        this.finished = true;
        await sleep(1000);
        await this._handleVerdict(true);
        return;
      }
      if (hasReject) {
        this.finished = true;
        await sleep(1000);
        await this._handleVerdict(false);
        return;
      }

      this._startTimer();
      $('bouncer-input').focus();
    } catch (e) {
      console.error('Scripted bouncer speak failed:', e);
      EventLog.add('Bouncer response failed — try again', 'negative');
    } finally {
      if (!internal) {
        this.generating = false;
        $('bouncer-send').disabled = false;
        const pending = this._pendingPlayerText;
        this._pendingPlayerText = null;
        if (pending && !this.finished) this.sendMessage(pending);
      }
    }
  },

  _getConvo() {
    if (!this._convo) {
      this._convo = Conversation.create({
        getContainer: () => $('bouncer-chat'),
        getSendBtn: () => $('bouncer-send'),
        errorLogMessage: 'Bouncer response failed — try again',
      });
    }
    return this._convo;
  },

  get generating() { return this._getConvo().generating; },
  set generating(v) { this._getConvo().generating = v; },

  _squadDesc() {
    const ghostPresent = squadHasContact('ghost');
    const visibleGroupSize = Math.max(1, state.finalSquad.length + 1 - (ghostPresent ? 1 : 0));
    return visibleGroupSize <= 1
      ? 'one person, alone'
      : `a group of ${visibleGroupSize} people`;
  },

  _appearanceDesc() {
    const appearance = [];
    const prog = SaveSystem.load();
    prog.equippedOutfits.forEach(id => {
      const w = WARDROBE.find(i => i.id === id);
      if (w) appearance.push(w.name);
    });
    state.finalSquad.forEach(s => {
      const c = CONTACTS.find(ct => ct.name === s.name);
      if (c?.styles) appearance.push(...c.styles.slice(0, 2));
    });
    return appearance;
  },

  _visibleTells() {
    const visible = [];
    if (state.queue.activeTraits.includes('Dead Eyes')) visible.push('One of them has glazed, unfocused eyes — clearly on something heavy.');
    if (state.queue.activeTraits.includes('The Vibe')) visible.push('One of them has noticeably dilated pupils and a wide grin.');
    if (state.queue.activeTraits.includes('Motor Mouth')) visible.push('One of them is talking very fast and fidgeting.');
    if (state.queue.activeTraits.includes('Big Energy')) visible.push('One of them is subtly grinding their jaw.');
    if (state.queue.beerDebuff) visible.push('They smell faintly of beer.');
    if (state.queue.activeTraits.includes('Liquid Courage')) visible.push('One of them seems a bit tipsy but confident.');
    if (state.queue.activeTraits.includes('Queue Alliance')) visible.push('Someone in line vouches for them — they seem to know people here.');
    if (state.queue.activeTraits.includes('Charmer')) visible.push('One of them has confident, flirtatious energy — socially smooth.');
    if (state.queue.activeTraits.includes('Street Cred')) visible.push('They carry themselves like someone the regulars recognize — social proof in the line.');
    if (state.queue.activeTraits.includes('Insider Info')) visible.push('They drop specific details about tonight like they already know the door.');
    if ((state.inventory.vip || 0) > 0) visible.push('The lead person wears a VIP wristband — it might be real, or an obvious fake.');
    return visible;
  },

  _bagContents() {
    const bagContents = [];
    Object.entries(state.inventory).forEach(([id, qty]) => {
      if (qty > 0) {
        const item = [...ITEMS, ...KIOSK_ITEMS].find(i => i.id === id);
        bagContents.push(`${qty}x ${item?.name || id}`);
      }
    });
    return bagContents;
  },

  _venueContext(venue, djs, secrets) {
    const queueLen = state.queue.allNeighbors?.length || 15;
    const isVibeVenue = venue.vibeCheck;
    const isEasy = venue.policy === 'Easy';
    const isHard = venue.policy === 'Ruthless' || venue.policy === 'Nightmare';

    if (isVibeVenue) {
      return `VENUE TYPE: Vibe-check venue. No password, no guest list. You judge based on ENERGY and GROUP VIBE.
What matters: Are they genuinely here for the music? Do they seem fun and respectful? Is the group energy good?
What doesn't matter: What they're wearing, who they know, VIP tables.
There is NO password tonight. Don't ask for one.
- The headliner tonight is ${djs.headliner}. Support: ${djs.support.join(', ')}.
- The queue is ${queueLen} people long right now.
- ${secrets.facts.bouncer_weakness || 'You respect genuine vibes.'}`;
    }
    if (isEasy) {
      return `VENUE TYPE: Relaxed door. You let most people in unless they're being rude or obviously wasted.
- ${secrets.facts.headliner || 'Headliner: ' + djs.headliner}
- ${secrets.facts.support_dj || 'Support: ' + djs.support.join(', ')}
- The queue is ${queueLen} people long right now.
- Dress code: ${venue.dressCode} (but you're flexible)
- ${secrets.facts.bouncer_weakness || 'You respect people who are polite.'}
There is NO password tonight. Just be cool and you're in.`;
    }
    if (isHard) {
      return `VENUE TYPE: Exclusive door. You are highly selective.
- ${secrets.facts.headliner || 'Headliner: ' + djs.headliner}
- ${secrets.facts.support_dj || 'Support: ' + djs.support.join(', ')}
- ${secrets.facts.password || 'Password tonight: Systematic Review'}
- ${secrets.facts.owner_name || 'Owner: Viktor'}
- ${secrets.facts.vip_table || 'VIP table: Regulaido'}
- Dress code: ${venue.dressCode} (strictly enforced)
- The queue is ${queueLen} people long. You've already turned away many tonight.
- ${secrets.facts.bouncer_weakness || 'You respect genuine connections.'}
Password, name-drops, and VIP references matter here. Music knowledge is a plus.`;
    }
    return `VENUE TYPE: Standard door. Selective but not impossible.
- ${secrets.facts.headliner || 'Headliner: ' + djs.headliner}
- ${secrets.facts.support_dj || 'Support: ' + djs.support.join(', ')}
- Dress code: ${venue.dressCode}
- The queue is ${queueLen} people long right now.
- ${secrets.facts.bouncer_weakness || 'You respect people who know why they\'re here.'}
No password required, but knowing the lineup and being respectful goes a long way.`;
  },

  _intelContext(secrets) {
    const intelFacts = Object.values(secrets.facts || {});
    return intelFacts.length > 0
      ? `TRUE INTEL THE PLAYER MAY HAVE LEARNED IN LINE:\n${intelFacts.map(fact => `- ${fact}`).join('\n')}`
      : 'TRUE INTEL THE PLAYER MAY HAVE LEARNED IN LINE: none';
  },

  _promptRules(venue) {
    const isVibeVenue = venue.vibeCheck;
    const isEasy = venue.policy === 'Easy';
    const isHard = venue.policy === 'Ruthless' || venue.policy === 'Nightmare';

    return `YOUR TOOLS — use structured tool calls, not bracket tags:
- approve: impression UP. amount = 5 to 35. Use when they say something good.
- disapprove: impression DOWN. amount = 5 to 25. Use when they say something bad.
- inspect_bag: check their bag/pockets. Game shows you what they carry.
- let_in: let them in. Use when you're convinced (don't drag it out forever).
- reject: not tonight. Use when you've made up your mind.
- ban: they crossed a line badly.

CRITICAL RULES:
- 1-2 sentences MAX per response.
- You speak first.
- You MUST use approve or disapprove after EVERY response. Never skip it.
- NEVER say tool names out loud (no "disapprove 10", no "reject" as narration) — perform actions as tool calls only; your spoken words are only what you say to their face.
- Make a decision with let_in or reject within 3-5 exchanges. Don't drag it out.
- You decide when conversation ends — no fixed count, but be decisive.
- ${isVibeVenue ? 'This is a vibe venue. If the energy feels right, let them in quickly. Don\'t overthink it.' : isEasy ? 'You are lenient. Most people get in. Only reject if they\'re rude, wasted, or disrespectful.' : isHard ? 'You are very strict. They need specific knowledge, connections, or the password. Turn away anyone who can\'t prove they belong.' : 'Be selective. They should show they know what tonight is about.'}
- Stay in character.

INTERJECTIONS: Sometimes other people chime in — friends in the group or someone from the queue vouching.
- A confident, sober vouch from someone in the queue = strong social proof; use approve +15 to +25.
- A drunk or sloppy vouch = questionable credibility; use approve +5 or disapprove -5.
- A nervous vouch = doesn't help much; use approve +5.
- Group members chiming in: judge what they say independently. Good energy helps, cringe or aggression hurts.
- Acknowledge interjections briefly in your response — react to them in-character.`;
  },

  _vipWristbandBlock() {
    if ((state.inventory.vip || 0) <= 0) return '';
    return `

VIP WRISTBAND: The lead person is wearing a VIP wristband. It MIGHT be fake — on Ruthless/Nightmare doors you may call the bluff and reject hard if they lean on it without proof; on easier doors you might let a convincing story slide. If they flash it, judge whether it matches tonight's real VIP setup.`;
  },

  _buildSystemPrompt(venue) {
    const djs = tonightsDJs || { headliner: 'Koze', support: ['DJ Synthax'] };
    const secrets = tonightsSecrets || { facts: {}, password: null, ownerName: 'Viktor', vipName: 'Regulaido' };
    const squadDesc = this._squadDesc();
    const appearance = this._appearanceDesc();
    const visible = this._visibleTells();
    this._bagContents();
    const venueContext = this._venueContext(venue, djs, secrets);
    const intelContext = this._intelContext(secrets);

    let prompt = `You are ${this.bouncer.name}, the bouncer at ${venue.name} tonight.
Personality: ${this.bouncer.personality}
What you respect: ${this.bouncer.softSpot}
What you hate: ${this.bouncer.trigger}
Tonight's mood: ${this.backstory}

${venueContext}

${intelContext}

WHAT YOU SEE RIGHT NOW:
- ${squadDesc} approaching the door
- Their style: ${appearance.length > 0 ? appearance.join(', ') : 'nothing remarkable'}
${visible.length > 0 ? visible.map(v => '- ' + v).join('\n') : '- They look sober and normal.'}

${this._promptRules(venue)}`;
    prompt += this._vipWristbandBlock();
    return prompt;
  },

  _effectiveDoorPolicy(venue) {
    if (squadHasContact('pia')) return easePolicyTier(venue?.policy || 'Easy');
    return venue?.policy || 'Easy';
  },

  async start() {
    state.phase = 'BOUNCER';
    const venue = VENUES.find(v => v.id === state.selectedVenue);

    this.bouncer = tonightsBouncer || ensureTonightsBouncer(state.selectedVenue);
    tonightsBouncer = this.bouncer;
    if (!tonightsSecrets || tonightsSecrets.bouncerId !== this.bouncer.id) {
      generateTonightsSecrets(venue, this.bouncer);
    }
    const doorPolicy = this._effectiveDoorPolicy(venue);
    this.threshold = VENUE_THRESHOLDS[doorPolicy];
    this.timerDuration = { Easy: 16000, Moderate: 13500, Ruthless: 10800, Nightmare: 8100 }[doorPolicy];

    const styleBonus = this.calcStyleMatch(venue);
    let traitBonus = 0;
    if (state.queue.activeTraits.includes('Charmer')) traitBonus += 5;
    if (squadHasContact('niko')) traitBonus += 15;
    this.approval = styleBonus + traitBonus;
    this.exchangeCount = 0;
    this.chimeInCount = 0;
    this.allyFired = false;
    this.messages = [];
    this.generating = false;
    this._pendingPlayerText = null;
    this.finished = false;

    // Backstory
    const moods = [
      `${this.bouncer.name} just started the shift. Coffee hasn't kicked in yet.`,
      `${this.bouncer.name}'s been here since 10 PM. Three fights already tonight.`,
      `${this.bouncer.name} is in a decent mood — the last group was cool.`,
      `${this.bouncer.name} just got a noise complaint from upstairs. Not happy.`,
      `${this.bouncer.name} heard the owner is watching tonight. Extra strict.`,
    ];
    this.backstory = moods[Math.floor(Math.random() * moods.length)];

    this.initCanvas();

    $('approval-fill').style.width = Math.min(this.approval, 100) + '%';
    $('approval-score').textContent = this.approval;
    $('approval-threshold').style.left = Math.min(this.threshold, 100) + '%';
    $('bouncer-speaker').textContent = this.bouncer.name.toUpperCase();
    $('bouncer-chat').innerHTML = '';
    $('bouncer-input').value = '';
    $('timer-fill').style.width = '100%';

    $('bouncer-screen').classList.add('active');

    EventLog.add(`Face to face with ${this.bouncer.name}. ${this.bouncer.personality}.`, 'info');
    if (styleBonus > 0) EventLog.add(`Style match bonus: +${styleBonus}`, 'positive');
    if (styleBonus < 0) EventLog.add(`Style mismatch penalty: ${styleBonus}`, 'negative');
    if (traitBonus > 0) EventLog.add(`Queue trait bonus: +${traitBonus}`, 'positive');
    if (squadHasContact('pia')) EventLog.add(`Pia's connections eased the door (${doorPolicy} tier)`, 'positive');
    if (squadHasContact('niko')) EventLog.add(`Niko's rep: +15 starting approval`, 'positive');

    // Show backstory briefly
    this._addBubble(this.backstory, 'system-msg');
    await sleep(2000);

    // Bouncer speaks first
    await this._bouncerSpeak('*A group approaches the door*');
  },

  calcStyleMatch(venue) {
    // Vibe-check venues don't care about outfits — they care about group energy
    if (venue?.vibeCheck) {
      let vibeScore = 0;
      vibeScore += state.finalSquad.length * 5;
      const avgBond = SaveSystem.getSquadBondAvg(state.finalSquad.map(m => CONTACTS.find(c => c.name === m.name)?.id).filter(Boolean));
      vibeScore += Math.floor(avgBond / 10);
      // Equipped group-vibe items help
      const prog = SaveSystem.load();
      prog.equippedOutfits.forEach(id => {
        const w = WARDROBE.find(i => i.id === id);
        if (w?.groupBonus) vibeScore += w.groupBonus;
      });
      if (squadHasContact('mona')) vibeScore *= 2;
      return Math.min(40, vibeScore);
    }

    if (!venue?.dressBias || venue.dressBias.length === 0) return 0;

    const squadStyles = [];
    state.finalSquad.forEach(s => {
      const contact = CONTACTS.find(c => c.id === s.id || c.name === s.name);
      if (contact?.styles) squadStyles.push(...contact.styles);
    });
    // Add styles from equipped wardrobe items
    const prog = SaveSystem.load();
    prog.equippedOutfits.forEach(id => {
      const w = WARDROBE.find(i => i.id === id);
      if (w?.styles) squadStyles.push(...w.styles);
    });

    const matches = squadStyles.filter(s => venue.dressBias.includes(s)).length;
    const total = squadStyles.length || 1;
    const ratio = matches / total;
    let bonus = 0;
    if (ratio >= 0.6) bonus = 20;
    else if (ratio >= 0.3) bonus = 10;
    else if (ratio > 0) bonus = 0;
    else bonus = squadStyles.length > 0 ? -10 : 0;
    if (squadHasContact('mona')) bonus *= 2;
    return bonus;
  },

  initCanvas() {
    this.canvas = $('bouncer-canvas');
    this.ctx = this.canvas.getContext('2d');
    const wrap = this.canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawBouncerScene(w, h);
  },

  drawBouncerScene(W, H) {
    const ctx = this.ctx;

    // Dark background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#030212');
    bg.addColorStop(1, '#0a0820');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Neon arch (large, centered)
    const archCX = W / 2, archBot = H;
    const archW = Math.min(W * 0.4, 160);
    const archH = H * 0.7;

    // Outer glow
    for (let i = 3; i > 0; i--) {
      ctx.strokeStyle = `rgba(123,117,255,${0.06 * i})`;
      ctx.lineWidth = 4 + i * 6;
      ctx.beginPath();
      ctx.moveTo(archCX - archW, archBot);
      ctx.lineTo(archCX - archW, archBot - archH + 30);
      ctx.quadraticCurveTo(archCX, archBot - archH - 20, archCX + archW, archBot - archH + 30);
      ctx.lineTo(archCX + archW, archBot);
      ctx.stroke();
    }

    // Arch neon
    ctx.strokeStyle = '#7b75ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#7b75ff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(archCX - archW, archBot);
    ctx.lineTo(archCX - archW, archBot - archH + 30);
    ctx.quadraticCurveTo(archCX, archBot - archH - 20, archCX + archW, archBot - archH + 30);
    ctx.lineTo(archCX + archW, archBot);
    ctx.stroke();

    // Pink inner arch
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(archCX - archW + 6, archBot);
    ctx.lineTo(archCX - archW + 6, archBot - archH + 36);
    ctx.quadraticCurveTo(archCX, archBot - archH - 10, archCX + archW - 6, archBot - archH + 36);
    ctx.lineTo(archCX + archW - 6, archBot);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Door (dark with light spill)
    const doorGlow = ctx.createLinearGradient(archCX, archBot - archH, archCX, archBot);
    doorGlow.addColorStop(0, 'rgba(123,117,255,0.06)');
    doorGlow.addColorStop(0.7, 'rgba(255,77,109,0.03)');
    doorGlow.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = doorGlow;
    ctx.fillRect(archCX - archW + 10, archBot - archH + 40, archW * 2 - 20, archH - 40);

    // Bouncer silhouette (large, centered)
    const bx = archCX, by = archBot;
    const scale = Math.min(W, H) / 350;
    const bh = 120 * scale;

    // Legs
    ctx.fillStyle = '#0a0918';
    ctx.fillRect(bx - 16 * scale, by - bh * 0.4, 12 * scale, bh * 0.4);
    ctx.fillRect(bx + 4 * scale, by - bh * 0.4, 12 * scale, bh * 0.4);

    // Torso
    ctx.fillStyle = '#0d0b20';
    ctx.beginPath();
    ctx.moveTo(bx - 28 * scale, by - bh * 0.4);
    ctx.lineTo(bx - 24 * scale, by - bh * 0.85);
    ctx.quadraticCurveTo(bx, by - bh * 0.92, bx + 24 * scale, by - bh * 0.85);
    ctx.lineTo(bx + 28 * scale, by - bh * 0.4);
    ctx.closePath();
    ctx.fill();

    // Arms crossed
    ctx.strokeStyle = '#0d0b20';
    ctx.lineWidth = 12 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 24 * scale, by - bh * 0.7);
    ctx.lineTo(bx + 8 * scale, by - bh * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 24 * scale, by - bh * 0.7);
    ctx.lineTo(bx - 8 * scale, by - bh * 0.55);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#0d0b20';
    ctx.beginPath();
    ctx.arc(bx, by - bh * 0.92, 16 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Portrait (pixel art face overlaid on silhouette head)
    const portrait = Portrait.generate(this.bouncer.portraitProps, 'hostile', []);
    const img = new Image();
    img.onload = () => {
      const ps = 32 * scale;
      ctx.drawImage(img, bx - ps / 2, by - bh * 0.92 - ps / 2, ps, ps);
    };
    img.src = portrait;
  },

  _addBubble(text, cls, opts) {
    return this._getConvo().addBubble(text, cls, opts);
  },

  async _bouncerSpeak(context, options = {}) {
    if (!LLM.loaded) return this._scriptedBouncerSpeak(context, options);

    const internal = options.internal;
    if (!internal && this.generating) return;
    if (!internal) {
      this.generating = true;
      $('bouncer-send').disabled = true;
    }

    const venue = VENUES.find(v => v.id === state.selectedVenue);
    const sysPrompt = this._buildSystemPrompt(venue);

    this.messages.push({ role: 'user', content: context });

    let response = '';
    let bouncerToolCalls = [];

    try {
      const result = await LLM.chat([
        { role: 'system', content: sysPrompt },
        ...this.messages.slice(-10),
      ], BOUNCER_TOOLS, 100, `bouncer:${state.selectedVenue}:${this.bouncer.id}`);
      if (result) {
        response = result.text || '';
        bouncerToolCalls = result.toolCalls || [];
      }

      if (!response) {
        // Error fallback — LLM failed to generate
        response = '*stares at you*';
        if (this.exchangeCount >= 4) {
          bouncerToolCalls.push({ function: { name: this.approval >= this.threshold ? 'let_in' : 'reject', arguments: {} } });
        }
      }

      // Parse tool calls — from native tool calling or text fallback
      if (bouncerToolCalls.length === 0 && response) {
        bouncerToolCalls = LLM._parseToolCalls(response);
      }

      const cleanText = response
        ? LLM._stripToolText(response)
        : '';

      // Process tool calls
      let hasLetIn = false, hasReject = false, hasBan = false, hasInspect = false;

      for (const tc of bouncerToolCalls) {
        const fn = tc.function?.name || tc.name;
        let args = normalizeToolArgs(tc.function?.arguments || tc.arguments || {});
        switch (fn) {
          case 'approve': {
            const delta = args.amount || 10;
            this.approval = Math.min(120, this.approval + delta);
            EventLog.add(`${PX.i('heart','#39ff14',10)} +${delta}: ${args.reason || 'good'}`, 'positive');
            break;
          }
          case 'disapprove': {
            const delta = args.amount || 10;
            this.approval = Math.max(0, this.approval - delta);
            EventLog.add(`${PX.i('skull','#ff4d6d',10)} -${delta}: ${args.reason || 'bad'}`, 'negative');
            break;
          }
          case 'let_in': hasLetIn = true; break;
          case 'reject': hasReject = true; break;
          case 'ban': hasBan = true; break;
          case 'inspect_bag': hasInspect = true; break;
        }
      }

      $('approval-fill').style.width = Math.min(this.approval, 100) + '%';
      $('approval-score').textContent = this.approval;

      this.messages.push({ role: 'assistant', content: response });

      // Show bouncer's spoken line after full cleanup/parsing
      if (cleanText) this._addBubble(cleanText, 'npc');

      this.exchangeCount++;

      // Handle INSPECT_BAG — show bag contents and let bouncer react
      if (hasInspect) {
        const bagItems = [];
        Object.entries(state.inventory).forEach(([id, qty]) => {
          if (qty > 0) {
            const item = [...ITEMS, ...KIOSK_ITEMS].find(i => i.id === id);
            bagItems.push(`${qty}x ${item?.name || id}`);
          }
        });
        const bagDesc = bagItems.length > 0 ? bagItems.join(', ') : 'Nothing suspicious';
        this._addBubble(`${PX.i('pack','#ebe4ff',12)} Bouncer inspects your bag: ${bagDesc}`, 'system-msg', { html: true });
        EventLog.add(`Bouncer checked your bag: ${bagDesc}`, 'info');

        // Feed result back to bouncer
        await sleep(1000);
        const hasSubstances = Object.keys(state.inventory).some(id => ['glitter','turbo','nosecandy'].includes(id) && state.inventory[id] > 0);
        const bagContext = hasSubstances
          ? `*The bouncer finds suspicious substances in their bag: ${bagDesc}*`
          : `*The bouncer checks the bag and finds: ${bagDesc}. Nothing suspicious.*`;
        await this._bouncerSpeak(bagContext, { internal: true });
        return;
      }

      // Handle final decisions
      if (hasLetIn) {
        this.finished = true;
        await sleep(1000);
        await this._handleVerdict(true);
        return;
      }
      if (hasReject) {
        this.finished = true;
        await sleep(1000);
        await this._handleVerdict(false);
        return;
      }
      if (hasBan) {
        this.finished = true;
        this._addBubble(`${PX.i('skull','#ff0000',14)} BANNED from ${VENUES.find(v => v.id === state.selectedVenue)?.name || 'this venue'} tonight.`, 'system-msg negative', { html: true });
        EventLog.add('BANNED from this venue!', 'negative');
        await sleep(2000);
        await this._handleVerdict(false);
        return;
      }

      // Start timer for player response
      this._startTimer();
      $('bouncer-input').focus();
    } catch (e) {
      console.error('Bouncer speak failed:', e);
      EventLog.add('Bouncer response failed — try again', 'negative');
    } finally {
      if (!internal) {
        this.generating = false;
        $('bouncer-send').disabled = false;
        const pending = this._pendingPlayerText;
        this._pendingPlayerText = null;
        if (pending && !this.finished) {
          this.sendMessage(pending);
        }
      }
    }
  },

  _startTimer() {
    clearTimeout(this.timer);
    const fill = $('timer-fill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    fill.classList.remove('urgent');
    void fill.offsetWidth;
    fill.style.transition = `width ${this.timerDuration}ms linear`;
    fill.style.width = '0%';
    setTimeout(() => fill.classList.add('urgent'), this.timerDuration * 0.4);
    this.timer = setTimeout(() => {
      if (this.finished || this.generating) return;
      this._addBubble('*silence*', 'player');
      EventLog.add('Said nothing to the bouncer...', 'negative');
      this.approval = Math.max(0, this.approval - 15);
      $('approval-fill').style.width = Math.min(this.approval, 100) + '%';
      $('approval-score').textContent = this.approval;
      EventLog.add(`${PX.i('skull','#ff4d6d',10)} -15: awkward silence`, 'negative');
      this._bouncerSpeak('*the player says nothing and just stares awkwardly*').catch(e => {
        console.error('Bouncer speak failed:', e);
        EventLog.add('Bouncer response failed — try again', 'negative');
      });
    }, this.timerDuration);
  },

  async sendMessage(text) {
    if (!text.trim() || this.finished) return;
    if (this.generating) {
      this._pendingPlayerText = text;
      return;
    }
    clearTimeout(this.timer);
    $('timer-fill').style.transition = 'none';
    $('timer-fill').style.width = '0%';
    $('bouncer-input').value = '';

    this._addBubble(text, 'player');
    EventLog.add(`You: "${text}"`, 'info');

    let fullContext = text;

    // Alliance interjection — ally walks up and vouches
    if (BouncerInterjections.shouldAllyFire(this.exchangeCount, this.allyFired)) {
      this.allyFired = true;
      const venue = VENUES.find(v => v.id === state.selectedVenue);
      const vouch = await BouncerInterjections.generateAllyVouch(
        state.queue.allyData, this.bouncer.name, venue?.name || 'the club'
      );
      this._addBubble(`🤝 ${state.queue.allyData.name}: "${vouch}"`, 'system-msg');
      EventLog.add(`🤝 ${state.queue.allyData.name} vouches for you: "${vouch}"`, 'positive');
      fullContext += `\n*A person named ${state.queue.allyData.name} steps forward from the queue and says to you: "${vouch}"*`;
      // Direct approval bonus when LLM not handling bouncer reaction
      if (!LLM.loaded) {
        const allyBonus = state.queue.allyData.disposition === 'friendly' ? 15 :
                          state.queue.allyData.disposition === 'drunk' ? 5 :
                          state.queue.allyData.disposition === 'anxious' ? 5 :
                          state.queue.allyData.disposition === 'hostile' ? -5 : 10;
        this.approval = Math.max(0, Math.min(120, this.approval + allyBonus));
        $('approval-fill').style.width = Math.min(this.approval, 100) + '%';
        $('approval-score').textContent = this.approval;
        EventLog.add(`Vouch effect: ${allyBonus > 0 ? '+' : ''}${allyBonus} approval`, allyBonus > 0 ? 'positive' : 'negative');
      }
      await sleep(800);
    }

    // Squad chime-in — a squad member says something
    if (BouncerInterjections.shouldSquadChimeIn(this.exchangeCount, this.chimeInCount)) {
      this.chimeInCount++;
      const member = BouncerInterjections.pickSquadMember(this.chimeInCount);
      const venue = VENUES.find(v => v.id === state.selectedVenue);
      const line = await BouncerInterjections.generateSquadChimeIn(
        member, this.bouncer.name, venue?.name || 'the club', text
      );
      const contact = CONTACTS.find(c => c.name === member.name);
      this._addBubble(`💬 ${member.name}: "${line}"`, 'system-msg');
      EventLog.add(`💬 ${member.name} chimes in: "${line}"`, 'info');
      fullContext += `\n*One of the group, ${member.name}, adds: "${line}"*`;
      member._chimedIn = true;
      // Direct approval bonus based on trait risk
      if (!LLM.loaded) {
        const trait = contact?.trait || '';
        const chimeBonus = trait === 'Chaos Agent' ? (Math.random() < 0.4 ? 12 : -10) :
                           trait === 'Hype Engine' ? (Math.random() < 0.5 ? 8 : -5) :
                           trait === 'The Chill Coder' ? 5 :
                           trait === 'Connected Promoter' ? 10 :
                           trait === 'The Insider' ? 10 :
                           trait === 'The Fashionista' ? 6 : 5;
        this.approval = Math.max(0, Math.min(120, this.approval + chimeBonus));
        $('approval-fill').style.width = Math.min(this.approval, 100) + '%';
        $('approval-score').textContent = this.approval;
        EventLog.add(`Chime-in effect: ${chimeBonus > 0 ? '+' : ''}${chimeBonus} approval`, chimeBonus > 0 ? 'positive' : 'negative');
      }
      await sleep(800);
    }

    this._bouncerSpeak(fullContext).catch(e => {
      console.error('Bouncer speak failed:', e);
      EventLog.add('Bouncer response failed — try again', 'negative');
    });
  },

  async _handleVerdict(success) {
    const venue = VENUES.find(v => v.id === state.selectedVenue);
    if (this.bouncer?.id) LLM.disposeCache(`bouncer:${state.selectedVenue}:${this.bouncer.id}`);

    if (success) {
      this._addBubble(`*${this.bouncer.name} steps aside. The heavy door swings open.*`, 'system-msg');
      EventLog.add('ACCESS GRANTED — the door opens!', 'positive');

      if (ClubAudio.ctx && ClubAudio.lpFilter) {
        const now = ClubAudio.ctx.currentTime;
        ClubAudio.lpFilter.frequency.cancelScheduledValues(now);
        ClubAudio.lpFilter.frequency.setValueAtTime(280, now);
        ClubAudio.lpFilter.frequency.exponentialRampToValueAtTime(18000, now + 2.0);
      }

      await sleep(2500);
      ClubScene.start(venue);
    } else {
      this._addBubble('"Not tonight."', 'npc');
      EventLog.add('"Not tonight." — rejected at the door.', 'negative');

      if (ClubAudio.ctx && ClubAudio.lpFilter) {
        const now = ClubAudio.ctx.currentTime;
        ClubAudio.lpFilter.frequency.setValueAtTime(280, now);
        ClubAudio.lpFilter.frequency.exponentialRampToValueAtTime(80, now + 1.0);
      }

      await sleep(2000);
      $('bouncer-screen').classList.remove('active');
      await WalkOfShame.play();
      this.showResult(false, venue);
    }
  },

  showResult(success, venue) {
    const overlay = $('result-overlay');
    overlay.className = 'result-overlay active ' + (success ? 'success' : 'failure');

    const progBefore = SaveSystem.load();
    const hadWon = !!progBefore.wonAt;

    // Progression
    SaveSystem.recordRun(success, venue?.id);
    const promotedMemories = MemorySystem.promoteNightMemories(success, venue?.id);
    SaveSystem.applyToState();
    renderPlayerBadge();
    const progAfter = SaveSystem.load();
    const justWon = success && progAfter.wonAt && !hadWon;
    const newContacts = SaveSystem.getPendingUnlocks();

    $('result-title').className = 'result-title ' + (success ? 'win' : 'lose');
    if (success && justWon) {
      $('result-title').textContent = 'Scene Legend';
      $('result-subtitle').textContent = 'Every door in the city is open. You made it.';
      notify('Scene Legend — you cleared every venue in the city', { toastMs: 5000, logType: 'positive' });
    } else {
      $('result-title').textContent = success ? 'Access Granted' : 'Not Tonight';
      $('result-subtitle').textContent = success
        ? 'The doors open. The bass hits. You\'re in.'
        : `${this.bouncer.name} shakes their head. Your squad disperses into the night.`;
    }

    const waitTime = state.queue.gameTime - (23 * 60 + 35);
    const intelCount = state.queue.revealedIntel.length;
    const traitCount = state.queue.activeTraits.length;
    const squadIntact = state.finalSquad.length === (state.queue.startingSquadCount || 0);

    $('result-stats').innerHTML = `
      <div class="result-row"><span class="rl">Bouncer</span><span class="rv">${this.bouncer.name}</span></div>
      <div class="result-row"><span class="rl">Approval</span><span class="rv">${this.approval} / ${this.threshold}</span></div>
      <div class="result-row"><span class="rl">Intel gathered</span><span class="rv">${intelCount}</span></div>
      <div class="result-row"><span class="rl">Active traits</span><span class="rv">${traitCount}</span></div>
      <div class="result-row"><span class="rl">Time waited</span><span class="rv">${waitTime} min</span></div>
      <div class="result-row"><span class="rl">Squad intact</span><span class="rv">${squadIntact ? 'Yes' : 'No'}</span></div>
      <div class="result-row"><span class="rl">Cash remaining</span><span class="rv">$${state.cash}</span></div>
    `;

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

    const nextJob = SaveSystem.JOBS.slice().reverse().find(j => progAfter.reputation >= j.minRep) || SaveSystem.JOBS[0];
    $('result-stats').innerHTML += `
      <div class="result-row" style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:8px;">
        <span class="rl">Reputation</span><span class="rv" style="color:var(--neon-gold);">★ ${progAfter.reputation}</span>
      </div>
      <div class="result-row"><span class="rl">Job</span><span class="rv">${nextJob.name} ($${nextJob.pay}/week)</span></div>
      <div class="result-row"><span class="rl">Savings</span><span class="rv">$${state.cash}</span></div>
      <div class="result-row"><span class="rl">Venues cleared</span><span class="rv">${SaveSystem.uniqueVenuesClearedCount(progAfter)} / ${VENUES.length}</span></div>
    `;

    // Particles!
    if (success) {
      Particles.burst(50);
      setTimeout(() => Particles.confetti(60), 500);
    }

    $('result-btn').textContent = success ? 'Next Friday →' : 'Try Again';
    $('result-btn').onclick = () => {
      overlay.classList.remove('active');
      if (ClubAudio.ctx && ClubAudio.lpFilter) {
        ClubAudio.lpFilter.frequency.setValueAtTime(280, ClubAudio.ctx.currentTime);
      }
      restartPlanning();
    };
  },
};

// ============================================================
// WALK OF SHAME
// ============================================================

const WalkOfShame = {
  QUOTES: [
    '"Maybe next Friday."',
    '"The walk home is always longer than the walk there."',
    '"At least the döner place is still open."',
    '"It\'s not about getting in. It\'s about the friends we didn\'t lose along the way."',
    '"The night is young. You are not."',
    '"There\'s always Sisyphos."',
    '"You replay the bouncer\'s face in your mind. Cold."',
    '"The bass fades behind you. Someone else\'s night now."',
  ],

  _finished: false,
  _resolve: null,
  _animId: null,
  _timeoutId: null,

  _finish() {
    if (this._finished) return;
    this._finished = true;
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._timeoutId) clearTimeout(this._timeoutId);
    $('shame-overlay').classList.remove('active');
    $('shame-overlay').onclick = null;
    this._resolve?.();
    this._resolve = null;
  },

  async play(customText) {
    const overlay = $('shame-overlay');
    const canvas = $('shame-canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    this._finished = false;
    $('shame-text').textContent = customText || this.QUOTES[Math.floor(Math.random() * this.QUOTES.length)];
    overlay.classList.add('active');
    overlay.onclick = () => this._finish();

    const W = 200, H = 100;
    const squadCount = 1 + state.finalSquad.length;
    let frame = 0;

    const draw = () => {
      if (this._finished) return;
      if (frame > 180) {
        this._finish();
        return;
      }
      frame++;

      // Night sky
      ctx.fillStyle = '#030210';
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 15; i++) {
        ctx.fillRect((i * 17) % W, (i * 11) % 40, 1, 1);
      }

      // Ground
      ctx.fillStyle = '#0a0918';
      ctx.fillRect(0, 75, W, 25);
      ctx.fillStyle = '#14122a';
      ctx.fillRect(0, 75, W, 2);

      // Street lamp (fading behind)
      const lampX = W - 30 - frame * 0.3;
      if (lampX > -20) {
        ctx.fillStyle = '#1c1940';
        ctx.fillRect(lampX, 35, 2, 40);
        ctx.fillStyle = 'rgba(255,216,107,0.06)';
        ctx.beginPath();
        ctx.arc(lampX + 1, 36, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Walking figures (silhouettes, heads down)
      for (let i = 0; i < squadCount; i++) {
        const x = 60 + i * 16 + Math.sin(frame * 0.08 + i) * 2;
        const y = 58;
        const bob = Math.abs(Math.sin(frame * 0.1 + i * 2)) * 2;

        ctx.fillStyle = '#1a1730';
        ctx.fillRect(x, y - 8 + bob, 4, 4);
        ctx.fillRect(x - 1, y - 4 + bob, 6, 8);
        const legPhase = Math.sin(frame * 0.15 + i);
        ctx.fillRect(x + (legPhase > 0 ? 0 : 2), y + 4 + bob, 2, 6);
        ctx.fillRect(x + (legPhase > 0 ? 2 : 0), y + 4 + bob, 2, 6);
      }

      this._animId = requestAnimationFrame(draw);
    };
    draw();

    return new Promise((resolve) => {
      this._resolve = resolve;
      this._timeoutId = setTimeout(() => this._finish(), 6000);
    });
  },
};

// ============================================================
// INSIDE THE CLUB PHASE
// ============================================================

const CLUB_EVENTS = [
  { px: 'people', pxColor: '#39ff14', text: 'The dance floor is packed. Your crew finds a spot near the speakers.', effect: '+Bond', type: 'positive', bondBoost: 5 },
  { px: 'note', pxColor: '#7b75ff', text: 'The DJ drops a massive tune. Everyone loses their minds.', effect: '+Bond', type: 'positive', bondBoost: 3, rep: 1 },
  { px: 'beer', pxColor: '#ffd86b', text: 'You grab drinks at the bar. Round for everyone.', effect: '-$8, +Bond', type: 'positive', cost: 8, bondBoost: 4 },
  { px: 'hand', pxColor: '#ffd86b', text: (sq) => `${sq.length > 0 ? sq[0].name : 'You'} bumps into someone they know. Numbers exchanged.`, effect: 'New connection', type: 'special', contactChance: true },
  { px: 'fire', pxColor: '#fd9927', text: 'Someone drops a lighter on the dance floor. Finders keepers.', effect: '+Lighter', type: 'positive', item: 'lighter' },
  { px: 'eye', pxColor: '#ff69b4', text: 'Your crew takes a group photo in the neon light. Memories made.', effect: '+Bond, +Rep', type: 'positive', bondBoost: 10, rep: 1 },
  { px: 'shield', pxColor: '#ff4d6d', text: 'The bass is relentless. One of you needs fresh air but you stick together.', effect: '+Bond (shared struggle)', type: 'positive', bondBoost: 3 },
  { px: 'star', pxColor: '#ffd86b', text: (sq) => `A stranger compliments ${sq.length > 0 ? sq[Math.floor(Math.random() * sq.length)].name + "'s" : 'your'} outfit. Squad proud.`, effect: '+Bond', type: 'positive', bondBoost: 2, rep: 1 },
  { px: 'drop', pxColor: '#57f2ff', text: 'You all drink water. Staying hydrated like responsible adults.', effect: '+Bond', type: 'positive', bondBoost: 2 },
  { px: 'note', pxColor: '#ff69b4', text: 'The headliner starts their set. The whole room shifts energy.', effect: '+Rep, +Bond', type: 'positive', bondBoost: 5, rep: 1 },
  { px: 'star', pxColor: '#ffd86b', text: 'The lights slowly come up. It\'s 6 AM. What a night.', effect: 'Sunrise', type: 'special', final: true },
  { px: 'coin', pxColor: '#ffd86b', text: 'You find $10 on the bathroom floor. Don\'t ask questions.', effect: '+$10', type: 'positive', cash: 10 },
  { px: 'skull', pxColor: '#ff4d6d', text: 'The substances are catching up. But your crew keeps you steady.', effect: '+Bond', type: 'positive', bondBoost: 5, conditionalOnSubstance: true },
  { px: 'heart', pxColor: '#ff69b4', text: (sq) => `${sq.length > 1 ? sq[0].name + ' and ' + sq[1].name : 'You and a stranger'} have an amazing conversation about life.`, effect: '+Deep bond', type: 'special', bondBoost: 15 },
];

const ClubChoiceEffects = {
  applyBondBoost(bondBoost, squad, bonds = {}) {
    const ids = squad.map(m => m.id).filter(Boolean);
    const next = { ...bonds };
    ids.forEach(id => {
      const key = ['player', id].sort().join(':');
      next[key] = Math.min(100, (next[key] || 0) + bondBoost);
    });
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join(':');
        next[key] = Math.min(100, (next[key] || 0) + bondBoost);
      }
    }
    return { bonds: next, memberCount: ids.length, bondBoost };
  },

  resolveWorkTheRoom(chance, contactUnlockedThisRun, venueId, progress, pickLockedContact, tryUnlockContact) {
    const repGain = 1;
    let contact = null;
    if (!contactUnlockedThisRun && chance < 0.675) {
      const newId = pickLockedContact(progress, { id: venueId });
      if (newId) contact = tryUnlockContact(progress, newId, { where: 'inside the club', bond: 25 });
    }
    return { repGain, contact, unlocked: !!contact };
  },

  resolveChaseTheNight(chance) {
    if (chance < 0.5) {
      const rewards = [
        { type: 'cash', value: 10 + Math.floor(Math.random() * 16) },
        { type: 'cash', value: 15 },
        { type: 'item', value: 'lighter' },
        { type: 'item', value: 'gum' },
      ];
      return { success: true, reward: rewards[Math.floor(Math.random() * rewards.length)] };
    }
    return { success: false, reward: null };
  },
};

const ClubScene = {
  eventIndex: 0,
  flavorEvents: [],
  timer: null,
  _venue: null,
  _finished: false,
  _phase: 'flavor',
  _choiceMade: false,

  _finish() {
    if (this._finished) return;
    this._finished = true;
    clearTimeout(this.timer);
    $('club-screen').classList.remove('active');
    $('club-screen').onclick = null;
    BouncerSystem.showResult(true, this._venue);
  },

  _handleSkip() {
    if (this._finished) return;
    if (this._phase === 'flavor') {
      clearTimeout(this.timer);
      this._showChoice();
    } else if (this._phase === 'sunrise') {
      this._finish();
    }
  },

  _appendCard({ px, pxColor, text, effect, effectType }) {
    const feed = $('club-feed');
    const el = document.createElement('div');
    el.className = 'club-event';
    el.innerHTML = `
      <span class="ce-icon">${PX.i(px || 'star', pxColor || '#ebe4ff', 20)}</span>
      <div>
        <div class="ce-text">${text}</div>
        ${effect ? `<div class="ce-effect ${effectType || 'positive'}">${effect}</div>` : ''}
      </div>
    `;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    return el;
  },

  async start(venue) {
    state.phase = 'CLUB';
    this._venue = venue;
    this._finished = false;
    this._phase = 'flavor';
    this._choiceMade = false;
    this.eventIndex = 0;
    $('bouncer-screen').classList.remove('active');
    $('club-screen').classList.add('active');
    $('club-screen').onclick = () => this._handleSkip();
    $('club-name').textContent = venue.name;
    $('club-sub').textContent = `${venue.music} · ${venue.bpm} BPM · The night unfolds...`;
    $('club-feed').innerHTML = '';
    $('club-done').style.display = 'none';

    this.drawClubViz(venue);

    const pool = CLUB_EVENTS.filter(e => !e.final && !e.conditionalOnSubstance);
    const shuffled = pool.sort(() => Math.random() - 0.5);
    this.flavorEvents = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

    await sleep(1200);
    this._playNextFlavor();
  },

  async _playNextFlavor() {
    if (this._finished || this._phase !== 'flavor') return;
    if (this.eventIndex >= this.flavorEvents.length) {
      this._showChoice();
      return;
    }

    const evt = this.flavorEvents[this.eventIndex];
    const text = typeof evt.text === 'function' ? evt.text(state.finalSquad) : evt.text;
    this._appendCard({ px: evt.px, pxColor: evt.pxColor, text });
    this.eventIndex++;

    this.timer = setTimeout(() => this._playNextFlavor(), 1500 + Math.random() * 500);
  },

  _showChoice() {
    if (this._finished || this._choiceMade) return;
    this._phase = 'choice';
    clearTimeout(this.timer);

    const feed = $('club-feed');
    const el = document.createElement('div');
    el.className = 'club-event club-choice-card';
    el.innerHTML = `
      <span class="ce-icon">${PX.i('star', '#ffd86b', 20)}</span>
      <div style="flex:1;">
        <div class="ce-text" style="font-weight:700;color:var(--text-primary);">How do you spend the peak of the night?</div>
        <div class="event-choices" style="margin-top:10px;">
          <button class="event-choice-btn" data-choice="crew">Stick with your crew</button>
          <button class="event-choice-btn" data-choice="room">Work the room</button>
          <button class="event-choice-btn" data-choice="chase">Chase the night</button>
        </div>
      </div>
    `;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;

    el.querySelectorAll('[data-choice]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._resolveChoice(btn.dataset.choice);
      });
    });
  },

  async _resolveChoice(choiceId) {
    if (this._choiceMade || this._finished) return;
    this._choiceMade = true;
    this._phase = 'resolving';
    $('club-screen').onclick = null;

    const feed = $('club-feed');
    feed.querySelectorAll('.club-choice-card').forEach(card => {
      card.querySelectorAll('.event-choice-btn').forEach(btn => { btn.disabled = true; });
    });

    if (choiceId === 'crew') {
      const p = SaveSystem.load();
      const ids = state.finalSquad.map(m => CONTACTS.find(c => c.name === m.name)?.id).filter(Boolean);
      ids.forEach(id => {
        const key = ['player', id].sort().join(':');
        p.bonds[key] = Math.min(100, (p.bonds[key] || 0) + 1);
      });
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join(':');
          p.bonds[key] = Math.min(100, (p.bonds[key] || 0) + 1);
        }
      }
      SaveSystem.save(p);
      const names = state.finalSquad.map(m => m.name).join(', ') || 'your crew';
      this._appendCard({
        px: 'people', pxColor: '#39ff14',
        text: `You stay close to ${names}. No drama, just the crew.`,
        effect: '+Bond with every squad member',
        effectType: 'positive',
      });
      EventLog.add('Inside the club: stuck with the crew — bonds strengthened', 'positive');
    } else if (choiceId === 'room') {
      const roll = Math.random();
      const p = SaveSystem.load();
      p.reputation += 1;
      let unlockText = '';
      if (!state.contactUnlockedThisRun && roll < 0.675) {
        const newId = SaveSystem.pickLockedContact(p, this._venue);
        const contact = newId ? SaveSystem.tryUnlockContact(p, newId, { where: 'inside the club', bond: 25 }) : null;
        if (contact) {
          state.contactUnlockedThisRun = true;
          unlockText = ` You exchanged numbers with ${contact.name}!`;
        }
      }
      SaveSystem.save(p);
      this._appendCard({
        px: 'hand', pxColor: '#ffd86b',
        text: `You work the room — smiling, nodding, making yourself known.${unlockText}`,
        effect: unlockText ? '+Rep, new connection' : '+Rep',
        effectType: 'positive',
      });
      EventLog.add(`Inside the club: worked the room (+rep${unlockText ? ', met someone new' : ''})`, 'positive');
    } else if (choiceId === 'chase') {
      const success = Math.random() < 0.5;
      if (success) {
        const rewards = [
          { type: 'cash', value: 10 + Math.floor(Math.random() * 16) },
          { type: 'item', value: 'lighter' },
          { type: 'item', value: 'gum' },
        ];
        const reward = rewards[Math.floor(Math.random() * rewards.length)];
        if (reward.type === 'cash') {
          state.cash += reward.value;
          this._appendCard({
            px: 'coin', pxColor: '#ffd86b',
            text: `Fortune favors the bold — you find $${reward.value} and ride the wave.`,
            effect: `+$${reward.value}`,
            effectType: 'positive',
          });
          EventLog.add(`Inside the club: chased the night — found $${reward.value}`, 'positive');
        } else {
          state.inventory[reward.value] = (state.inventory[reward.value] || 0) + 1;
          const itemName = [...ITEMS, ...KIOSK_ITEMS].find(i => i.id === reward.value)?.name || reward.value;
          this._appendCard({
            px: 'fire', pxColor: '#fd9927',
            text: `The night delivers — someone presses a ${itemName.toLowerCase()} into your hand.`,
            effect: `+${itemName}`,
            effectType: 'positive',
          });
          EventLog.add(`Inside the club: chased the night — scored ${itemName}`, 'positive');
        }
      } else {
        this._appendCard({
          px: 'clock', pxColor: '#666',
          text: 'You chase every corner of the club, but the night slips away between beats.',
          effect: 'Nothing gained',
          effectType: 'negative',
        });
        EventLog.add('Inside the club: chased the night — it slipped away', 'info');
      }
    }

    await sleep(1800);
    this._showSunrise();
  },

  _showSunrise() {
    if (this._finished) return;
    this._phase = 'sunrise';
    const sunrise = CLUB_EVENTS.find(e => e.final);
    this._appendCard({
      px: sunrise.px,
      pxColor: sunrise.pxColor,
      text: typeof sunrise.text === 'function' ? sunrise.text(state.finalSquad) : sunrise.text,
      effect: sunrise.effect,
      effectType: 'special',
    });
    $('club-done').style.display = 'block';
    $('club-screen').onclick = () => this._finish();
  },

  drawClubViz(venue) {
    const canvas = $('club-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Animated club interior with pulsing lights
    let t = 0;
    const draw = () => {
      if (state.phase !== 'CLUB') return;
      t += 0.016;

      // Dark background
      ctx.fillStyle = '#030210';
      ctx.fillRect(0, 0, W, H);

      // Pulsing colored lights
      const colors = ['rgba(123,117,255,', 'rgba(255,77,109,', 'rgba(57,255,20,', 'rgba(253,153,39,'];
      for (let i = 0; i < 4; i++) {
        const x = W * (0.15 + i * 0.23);
        const y = H * 0.3;
        const pulse = 0.08 + Math.abs(Math.sin(t * 2 + i * 1.5)) * 0.12;
        const r = 60 + Math.sin(t * 3 + i) * 20;
        const glow = ctx.createRadialGradient(x, y, 5, x, y, r);
        glow.addColorStop(0, colors[i] + (pulse + 0.1) + ')');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Laser beams
      ctx.globalAlpha = 0.15 + Math.sin(t * 4) * 0.1;
      ctx.strokeStyle = '#7b75ff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const angle = Math.sin(t * 0.5 + i * 2) * 0.8;
        ctx.beginPath();
        ctx.moveTo(W * 0.5, 0);
        ctx.lineTo(W * 0.5 + Math.sin(angle) * W * 0.6, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Dancing silhouettes
      const groundY = H * 0.85;
      for (let i = 0; i < 12; i++) {
        const x = W * 0.08 + i * (W * 0.08);
        const bounce = Math.abs(Math.sin(t * 3 + i * 0.8)) * 5;
        const sway = Math.sin(t * 1.5 + i * 1.2) * 3;
        ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.04})`;
        ctx.beginPath();
        ctx.arc(x + sway, groundY - 15 - bounce, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + sway - 3, groundY - 11 - bounce, 6, 12);
      }

      requestAnimationFrame(draw);
    };
    draw();
  },
};

