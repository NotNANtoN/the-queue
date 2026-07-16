// ============================================================
// PHASE 1 DATA
// ============================================================

const QUEUE_CONFIG = {
  Easy:      { startPos: 12, moveChance: 0.45, moveMin: 2, moveMax: 4, eventChance: 0.25, lastEntry: 25 * 60 },
  Moderate:  { startPos: 18, moveChance: 0.40, moveMin: 2, moveMax: 4, eventChance: 0.30, lastEntry: 25 * 60 + 45 },
  Ruthless:  { startPos: 25, moveChance: 0.34, moveMin: 1, moveMax: 4, eventChance: 0.35, lastEntry: 26 * 60 + 30 },
  Nightmare: { startPos: 28, moveChance: 0.30, moveMin: 1, moveMax: 3, eventChance: 0.40, lastEntry: 27 * 60 },
};

const DOOR_STRICTNESS = {
  Easy: 'They wave most people through.',
  Moderate: 'They pick and choose.',
  Ruthless: 'This door turns away half the line.',
  Nightmare: 'Nobody gets in without a reason.',
};

const KIOSK_ITEMS = [
  { id: 'beer', name: 'Beer', icon: 'beer', iconColor: '#ffd86b', price: 8, desc: 'Take the edge off', effect: 'Anxiety −12', effectVal: { anxiety: -12 }, risky: true, riskDesc: 'Bouncer might smell it', trait: 'Liquid Courage' },
  { id: 'snack', name: 'Döner Roll', icon: 'bag', iconColor: '#fd9927', price: 5, desc: 'Classic late-night fuel', effect: 'Anxiety −4', effectVal: { anxiety: -4 }, risky: false },
  { id: 'redbull', name: 'Red Bull', icon: 'bolt', iconColor: '#57f2ff', price: 6, desc: 'Wings for the wait', effect: 'Hope +8', effectVal: { hope: 8 }, risky: false },
  { id: 'cigarette', name: 'Cigarette', icon: 'cig', iconColor: '#ebe4ff', price: 3, desc: 'Social lubricant', effect: 'Anxiety −6', effectVal: { anxiety: -6 }, risky: false },
  { id: 'glitter', name: 'Glitter', icon: 'diamond', iconColor: '#ff69b4', price: 20, desc: 'Sparkly little friend-maker', effect: 'Hope +15, Anxiety −20', effectVal: { hope: 15, anxiety: -20 }, risky: true, riskDesc: 'Dilated pupils — bouncer might notice', trait: 'The Vibe' },
  { id: 'turbo', name: 'Turbo Tabs', icon: 'bolt', iconColor: '#39ff14', price: 15, desc: 'Industrial-grade alertness', effect: 'Hope +20', effectVal: { hope: 20 }, risky: true, riskDesc: 'Jittery — anxiety spike in ~3 turns', trait: 'Motor Mouth', delayedEffect: { turns: 3, anxiety: 25 } },
  { id: 'nosecandy', name: 'Nose Candy', icon: 'snow', iconColor: '#fff', price: 25, desc: 'Confidence in powder form', effect: 'Hope +10, Anxiety −10', effectVal: { hope: 10, anxiety: -10 }, risky: true, riskDesc: 'Jaw grinding — bouncer will see it', trait: 'Big Energy' },
];

const TRAIT_DEFS = {
  'Liquid Courage':  { px: 'beer', desc: '+Confidence at bouncer, slight slur risk', color: '#fd9927' },
  'The Vibe':        { px: 'diamond', desc: 'Natural charisma, dilated pupils', color: '#ff4d6d' },
  'Motor Mouth':     { px: 'bolt', desc: 'Extra dialogue options, might say too much', color: '#57f2ff' },
  'Big Energy':      { px: 'snow', desc: 'Supreme confidence, jaw tension visible', color: '#fff' },
  'Paranoid':        { px: 'eye', desc: 'Substance comedown — everything feels wrong', color: '#ff4444' },
  'Dead Eyes':       { px: 'skull', desc: 'Too much of everything — bouncer will notice', color: '#666' },
  'Insider Info':    { px: 'key', desc: 'You know something useful about tonight', color: '#39ff14' },
  'Street Cred':     { px: 'hand', desc: 'Made friends in line — bouncer sees social proof', color: '#ffd86b' },
  'Queue Alliance':  { px: 'hand', desc: 'Allied with a neighbor — they may vouch for you at the door', color: '#7b75ff' },
  'Charmer':         { px: 'heart', desc: 'Flirted your way through the queue — confidence boost', color: '#ff4d6d' },
};

// ============================================================
// DJ LINEUP SYSTEM
// ============================================================

const DJ_POOL = {
  'Deep House': ['Koze', 'Solomun', 'Dixon', 'Âme', 'Mano Le Tough', 'Todd Terje', 'Satori'],
  'Techno': ['DJ Synthax', 'Blawan', 'Rebekah', 'Kobosil', 'FJAAK', 'Ellen Allien', 'Shed'],
  'Drum & Bass': ['Noisia', 'Camo & Krooked', 'Calibre', 'High Contrast', 'Alix Perez', 'Roni Size'],
  'Tech-House': ['Fisher', 'Patrick Topping', 'Hot Since 82', 'Jamie Jones', 'Solardo'],
  'Minimal Techno': ['Ricardo Villalobos', 'Zip', 'Luciano', 'Akiko Kiyama', 'Petre Inspirescu'],
  'Industrial': ['Ancient Methods', 'Phase Fatale', 'Headless Horseman', 'Karenn', 'Perc'],
};

function getTonightsDJs(venue) {
  const pool = DJ_POOL[venue.music] || DJ_POOL['Techno'];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return { headliner: shuffled[0], support: shuffled.slice(1, 3) };
}

let tonightsDJs = null;
let tonightsBouncer = null;
let tonightsBouncerVenueId = null;

const NEIGHBOR_NAMES = ['Marco', 'Lena', 'Tariq', 'Yuki', 'Priya', 'Jonas', 'Nadia', 'Emre', 'Sofia', 'Dex', 'Aisha', 'Viktor', 'Luna', 'Chen', 'Zara', 'Ravi', 'Ingrid', 'Kwame', 'Mika', 'Freya'];
const DISPOSITIONS = ['friendly', 'neutral', 'hostile', 'drunk', 'anxious'];
const DISP_WEIGHTS = [0.35, 0.2, 0.1, 0.28, 0.07];
const DISP_COLORS = { friendly: '#39ff14', neutral: '#ebe4ff', hostile: '#ff4d6d', drunk: '#fd9927', anxious: '#57f2ff' };

// Dynamic secrets generated per run — replaces the static intel pool
let tonightsSecrets = null;

const SECRET_TEMPLATES = [
  { key: 'headliner', gen: () => `The headliner tonight is ${tonightsDJs?.headliner || 'unknown'}.` },
  { key: 'support_dj', gen: () => `${tonightsDJs?.support?.[0] || 'A DJ'} is on the support lineup.` },
  { key: 'password', gen: () => { const words = ['Systematic Review','Nightcrawler','Deep Pressure','Sonic Bloom','Phase Shift','Dark Matter','Velvet Room','Bass Theory']; return `The password tonight is "${words[Math.floor(Math.random()*words.length)]}".`; }},
  { key: 'bouncer_name', gen: () => 'placeholder' },
  { key: 'owner_name', gen: () => { const names = ['Viktor','Mara','Hassan','Yuki','Santiago']; return `The owner's name is ${names[Math.floor(Math.random()*names.length)]}.`; }},
  { key: 'vip_table', gen: () => { const names = ['Regulaido','Nachtfalter','Phantom Crew','Studio 54','Innervisions']; return `There's a VIP table reserved under "${names[Math.floor(Math.random()*names.length)]}".`; }},
  { key: 'bouncer_mood', gen: () => { const moods = ['strict and grumpy','surprisingly chill','distracted by something','extra careful because the owner is watching']; return `The bouncer is ${moods[Math.floor(Math.random()*moods.length)]} tonight.`; }},
  { key: 'closing_time', gen: () => { const times = ['5 AM','6 AM','open-ended tonight','until sunrise']; return `They're closing ${times[Math.floor(Math.random()*times.length)]}.`; }},
  { key: 'dress_tip', gen: (venue) => {
    if (venue?.dressBias?.length) {
      const preferred = venue.dressBias.slice(0, 2).join(' or ');
      return `Fashion tip: ${preferred} fits ${venue.name}'s door tonight.`;
    }
    return `Fashion tip: ${venue?.dressCode || 'good energy'} matters more than labels tonight.`;
  }},
  { key: 'bouncer_weakness', gen: () => { const w = ['a good joke','genuine music knowledge','confidence without arrogance','honesty about why you want to get in','mentioning a specific set from last week']; return `The bouncer respects ${w[Math.floor(Math.random()*w.length)]}.`; }},
];

function generateTonightsSecrets(venue, bouncer) {
  const secrets = {};
  const isHard = venue.policy === 'Ruthless' || venue.policy === 'Nightmare';
  const isVibe = venue.vibeCheck;

  SECRET_TEMPLATES.forEach(t => {
    // Skip irrelevant secrets based on venue type
    if (t.key === 'password' && !isHard) return;
    if (t.key === 'vip_table' && (isVibe || venue.policy === 'Easy')) return;
    if (t.key === 'owner_name' && isVibe) return;
    if (t.key === 'dress_tip' && isVibe) return;

    if (t.key === 'bouncer_name') {
      secrets[t.key] = `The bouncer tonight is ${bouncer.name}. ${bouncer.personality}.`;
    } else {
      secrets[t.key] = t.gen(venue, bouncer);
    }
  });

  // If LLM is available, try to generate extra unique secrets
  tonightsSecrets = {
    bouncerId: bouncer.id,
    bouncerName: bouncer.name,
    facts: secrets,
    keys: Object.keys(secrets),
    password: secrets.password?.match(/"([^"]+)"/)?.[1] ?? null,
    ownerName: secrets.owner_name?.match(/is (\w+)/)?.[1] || 'Viktor',
    vipName: secrets.vip_table?.match(/"([^"]+)"/)?.[1] || 'Regulaido',
  };
  return tonightsSecrets;
}

// Build intel list from tonight's secrets for neighbors to share
function getIntelPool() {
  if (!tonightsSecrets) return [];
  return Object.entries(tonightsSecrets.facts).map(([key, text]) => ({ key, text }));
}

const NEIGHBOR_QUIRKS = [
  'knows everyone on the guestlist', 'claims to be a DJ', 'has been to every club in the city',
  'is here for the first time', 'used to work at this club', 'is celebrating a birthday',
  'is waiting for someone inside', 'got rejected last week and came back', 'knows the owner',
  'drove 2 hours to get here', 'is a food blogger who also reviews clubs',
  'is a photographer for a nightlife magazine', 'just got out of a long relationship',
  'is pre-gaming way too hard', 'is actually the promoter\'s cousin',
  'lost a bet and has to get into 3 clubs tonight', 'is a music producer scouting talent',
  'is wearing something incredibly expensive', 'used to date one of the DJs',
  'is silently judging everyone\'s outfits', 'just flew in from another city',
  'is an off-duty bouncer from a rival club', 'is livestreaming the whole queue experience',
  'is on a mission to find a specific person inside', 'collects stamps from every club they visit',
  'is a philosophy student who overthinks everything', 'always carries exactly the right amount of cash',
];

const NEIGHBOR_ADJECTIVES = [
  'tall', 'short', 'lanky', 'stocky', 'stylish', 'scruffy', 'well-groomed', 'tired-looking',
  'energetic', 'quiet', 'loud', 'mysterious', 'intense', 'laid-back', 'fidgety', 'confident',
  'overdressed', 'underdressed', 'tattooed', 'pierced', 'sunglasses-at-night', 'chain-smoking',
  'phone-obsessed', 'people-watching', 'dancing-in-place', 'shivering', 'sweating', 'grinning',
];

const TRADEABLE_ITEMS = ['lighter', 'gum', 'cigarette', 'water', 'earplugs', 'vip'];

function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const SUBSTANCE_POOL = ['glitter', 'turbo', 'nosecandy'];

function generateNeighbor(venueId, existingIntel) {
  const progress = SaveSystem.load();
  const regulars = progress.regulars || {};
  const venueRegulars = Object.values(regulars).filter(r => r.homeVenueId === venueId);
  const canSpawnRegular = !state.queue.regularSpawnedThisRun
    && venueRegulars.length > 0
    && Math.random() < 0.4;

  if (canSpawnRegular) {
    const regular = venueRegulars[Math.floor(Math.random() * venueRegulars.length)];
    state.queue.regularSpawnedThisRun = true;
    const runNumber = (progress.totalRuns || 0) + 1;
    const absentRuns = Math.max(0, runNumber - (regular.lastSeenRun || runNumber) - 1);
    let affinity = regular.affinityCarry || 50;
    for (let i = 0; i < absentRuns; i++) {
      if (affinity > 50) affinity = Math.max(50, affinity - 10);
      else if (affinity < 50) affinity = Math.min(50, affinity + 10);
    }

    const disp = regular.disposition || 'neutral';
    const quirk = regular.quirk || 'is here for the first time';
    const adjectives = regular.adjectives && regular.adjectives.length >= 2
      ? regular.adjectives
      : ['average', 'normal'];
    const adj1 = adjectives[0], adj2 = adjectives[1];

    const available = getIntelPool().filter(i => !existingIntel.includes(i.key));
    let intel = null;
    const items = [];
    const wants = [];
    let money = 0;
    let hasSubstance = null;

    switch (disp) {
      case 'friendly':
        intel = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
        if (Math.random() < 0.5) items.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
        money = Math.random() < 0.2 ? 5 : 0;
        break;
      case 'drunk':
        intel = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
        hasSubstance = Math.random() < 0.5 ? SUBSTANCE_POOL[Math.floor(Math.random() * SUBSTANCE_POOL.length)] : null;
        items.push('lighter');
        money = 5 + Math.floor(Math.random() * 15);
        break;
      case 'hostile':
        intel = available.length > 0 ? available[0] : null;
        wants.push(TRADEABLE_ITEMS[Math.floor(Math.random() * 3)]);
        if (Math.random() < 0.4) hasSubstance = SUBSTANCE_POOL[Math.floor(Math.random() * SUBSTANCE_POOL.length)];
        money = Math.random() < 0.3 ? 10 + Math.floor(Math.random() * 10) : 0;
        break;
      case 'anxious':
        intel = Math.random() < 0.7 && available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
        if (Math.random() < 0.5) items.push('gum');
        hasSubstance = Math.random() < 0.3 ? 'turbo' : null;
        break;
      default:
        intel = Math.random() < 0.5 && available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
        money = 5 + Math.floor(Math.random() * 20);
        if (Math.random() < 0.5) items.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
        wants.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
        break;
    }

    const portraitProps = regular.portraitProps || Portrait.randomProps();
    const portrait = Portrait.generate(portraitProps, disp, []);

    return {
      memoryId: regular.id, name: regular.name, disposition: disp, color: DISP_COLORS[disp],
      intel, items, wants, money, hasSubstance, quirk,
      initials: regular.name[0], chatHistory: [],
      portraitProps, portrait,
      affinity: Math.round(affinity),
      canUnlock: Math.random() < 0.25,
      adjectives: [adj1, adj2],
      desc: `A ${adj1}, ${adj2} person`,
      isRegular: true,
      regularId: regular.id,
    };
  }

  const name = NEIGHBOR_NAMES[Math.floor(Math.random() * NEIGHBOR_NAMES.length)];
  const memoryId = 'stranger_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const disp = weightedPick(DISPOSITIONS, DISP_WEIGHTS);
  const quirk = NEIGHBOR_QUIRKS[Math.floor(Math.random() * NEIGHBOR_QUIRKS.length)];
  const adj1 = NEIGHBOR_ADJECTIVES[Math.floor(Math.random() * NEIGHBOR_ADJECTIVES.length)];
  let adj2 = NEIGHBOR_ADJECTIVES[Math.floor(Math.random() * NEIGHBOR_ADJECTIVES.length)];
  while (adj2 === adj1) adj2 = NEIGHBOR_ADJECTIVES[Math.floor(Math.random() * NEIGHBOR_ADJECTIVES.length)];

  const available = getIntelPool().filter(i => !existingIntel.includes(i.key));
  let intel = null;
  const items = [];
  const wants = [];
  let money = 0;
  let hasSubstance = null;
  let startAffinity = 50;

  switch (disp) {
    case 'friendly':
      intel = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
      if (Math.random() < 0.5) items.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
      if (Math.random() < 0.3) items.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
      money = Math.random() < 0.2 ? 5 : 0;
      startAffinity = 60 + Math.floor(Math.random() * 20);
      break;
    case 'drunk':
      intel = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
      hasSubstance = Math.random() < 0.5 ? SUBSTANCE_POOL[Math.floor(Math.random() * SUBSTANCE_POOL.length)] : null;
      items.push('lighter');
      if (Math.random() < 0.4) items.push('cigarette');
      money = 5 + Math.floor(Math.random() * 15);
      startAffinity = 55 + Math.floor(Math.random() * 25);
      break;
    case 'hostile':
      intel = available.length > 0 ? available[0] : null;
      wants.push(TRADEABLE_ITEMS[Math.floor(Math.random() * 3)]);
      if (Math.random() < 0.4) hasSubstance = SUBSTANCE_POOL[Math.floor(Math.random() * SUBSTANCE_POOL.length)];
      money = Math.random() < 0.3 ? 10 + Math.floor(Math.random() * 10) : 0;
      startAffinity = 15 + Math.floor(Math.random() * 20);
      break;
    case 'anxious':
      intel = Math.random() < 0.7 && available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
      if (Math.random() < 0.5) items.push('gum');
      if (Math.random() < 0.3) items.push('water');
      hasSubstance = Math.random() < 0.3 ? 'turbo' : null;
      startAffinity = 40 + Math.floor(Math.random() * 20);
      break;
    case 'neutral':
      intel = Math.random() < 0.5 && available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
      money = 5 + Math.floor(Math.random() * 20);
      if (Math.random() < 0.5) items.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
      if (Math.random() < 0.3) items.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
      wants.push(TRADEABLE_ITEMS[Math.floor(Math.random() * TRADEABLE_ITEMS.length)]);
      hasSubstance = Math.random() < 0.15 ? SUBSTANCE_POOL[Math.floor(Math.random() * SUBSTANCE_POOL.length)] : null;
      startAffinity = 45 + Math.floor(Math.random() * 15);
      break;
  }

  const portraitProps = Portrait.randomProps();
  const portrait = Portrait.generate(portraitProps, disp, []);

  return {
    memoryId, name, disposition: disp, color: DISP_COLORS[disp],
    intel, items, wants, money, hasSubstance, quirk,
    initials: name[0], chatHistory: [],
    portraitProps, portrait,
    affinity: startAffinity,
    canUnlock: Math.random() < 0.25,
    adjectives: [adj1, adj2],
    desc: `A ${adj1}, ${adj2} person`,
  };
}

function buildNeighborSystemPrompt(neighbor, venue) {
  let prompt = `You are ${neighbor.name}, a ${neighbor.adjectives?.[0] || 'average'}, ${neighbor.adjectives?.[1] || 'normal'} person standing in line outside ${venue.name}, a ${venue.music} club.
You are having a casual conversation with a stranger (the player) who is standing next to you in the queue.
Your secret backstory (reveal naturally through conversation, don't dump it): you ${neighbor.quirk}.
${neighbor.isRegular ? '\nYou have met the player before in this queue — you genuinely remember them. Reference shared history naturally; you are not a stranger to each other anymore.\n' : ''}

YOUR PERSONALITY: ${neighbor.disposition === 'friendly' ? 'You are warm and chatty. You enjoy making conversation with strangers. You like helping people.' :
neighbor.disposition === 'drunk' ? 'You are tipsy and loose-lipped. You talk too much and share things easily. Your speech is slightly slurred and enthusiastic. You love everyone right now.' :
neighbor.disposition === 'hostile' ? 'You are irritated and don\'t really want to talk. You give short, blunt answers. BUT you respect people who offer you something useful — if they bribe you or give you what you want, you open up and become helpful.' :
neighbor.disposition === 'anxious' ? 'You are nervous about getting in. You fidget and worry aloud. You bond with people over shared anxiety. Reassurance makes you share what you know.' :
'You are polite but reserved. You are transactional — you trade fairly. You won\'t give something for nothing, but a fair deal makes you talkative.'}

KEEP RESPONSES TO 1-2 SENTENCES. Be natural and in-character. This is a casual queue conversation, not a formal interaction.
NEVER mention, name, or describe your tools in your spoken reply — perform actions via tool calls only; your spoken words are only what your character says out loud.`;

  const memoryContext = MemorySystem.buildPromptContextForNeighbor(neighbor);
  if (memoryContext) prompt += `\n\n${memoryContext}`;

  if (neighbor.intel) {
    const intelResolved = neighbor.intel.text;
    prompt += `\n\nYou know something useful about tonight: "${intelResolved}"
${neighbor.disposition === 'friendly' ? 'You will share this after a few friendly exchanges.' :
neighbor.disposition === 'drunk' ? 'You will share this easily — you can barely keep secrets right now.' :
neighbor.disposition === 'hostile' ? 'You will ONLY share this if the player gives you something you want first.' :
neighbor.disposition === 'anxious' ? 'You will share this if the player reassures you or bonds with you.' :
'You will share this if the player offers a fair trade.'}
Use the share_intel tool when you decide to reveal this.
If your affinity with the player is decent (around 55+), you are more willing to share intel unprompted when the conversation feels natural — intel now comes only from neighbor chat, not passive eavesdropping.`;
  }

  if (neighbor.wants.length > 0) {
    prompt += `\n\nYou really want: ${neighbor.wants.join(', ')}. ASK for it early in the conversation — don't wait. If they give you what you want, be grateful${neighbor.intel ? ' and immediately share your intel' : ''}.
Use the want_item tool when asking for a specific item.`;
  }

  if (neighbor.items.length > 0) {
    prompt += `\n\nYou have: ${neighbor.items.join(', ')}. Offer one of these within the first 2-3 messages — be generous, especially if you're friendly or drunk.
Use the offer_item tool when offering a specific item.`;
  }

  if (neighbor.hasSubstance) {
    const subName = neighbor.hasSubstance === 'glitter' ? 'Glitter (MDMA)' : neighbor.hasSubstance === 'turbo' ? 'Turbo Tabs (speed)' : 'Nose Candy (coke)';
    prompt += `\n\nYou have some ${subName} on you. You might offer it if the vibe is right or if asked.
Use the offer_item tool with item "${neighbor.hasSubstance}" if you offer it.`;
  }

  if (neighbor.money > 0) {
    prompt += `\n\nYou have $${neighbor.money} cash you could give/trade if the player does something nice.
Use the give_money tool when giving cash.`;
  }

  prompt += `\n\nIMPORTANT: After EVERY single response, you MUST use the change_affinity tool.
+5 to +15 if they were nice, funny, helpful, or you're vibing.
-5 to -15 if they were rude, boring, pushy, or annoying.
Use 0 only if your opinion truly did not change. Never skip it.

If you want to end the conversation (bored, annoyed, etc.), use the end_conversation tool.

${neighbor.canUnlock ? `If affinity gets very high (you really like them), you might offer to exchange numbers:
use the exchange_numbers tool.` : ''}

LEAVING THE QUEUE: If the player convinces you that the queue isn't worth it — maybe they tell you about bad vibes, say the bouncer is turning everyone away, or offer you something better — AND your affinity is low or your disposition makes you uncertain, you MIGHT decide to leave.
${neighbor.disposition === 'anxious' ? 'You are very susceptible to being talked out of waiting. If someone says it looks bad tonight, you might bail easily.' :
neighbor.disposition === 'drunk' ? 'You can be easily swayed if someone suggests going somewhere else or if the wait seems too long.' :
neighbor.disposition === 'hostile' ? 'You are already annoyed. If given a good reason, you might just say "screw this" and leave.' :
neighbor.disposition === 'friendly' ? 'You are committed and rarely leave, but extreme persuasion or a really good offer might work.' :
'You are patient. It takes a LOT to make you leave.'}
Use the leave_queue tool when you decide to leave.
Only do this if genuinely convinced. Don't leave easily — you came here for a reason.

SWAPPING SPOTS: If the player asks nicely to swap positions and you like them (high affinity) or they give you something good, you might agree. You're more likely to swap if you're not in a rush or if they seem more eager than you.
${neighbor.disposition === 'friendly' ? 'You might swap if asked nicely and affinity is decent.' :
neighbor.disposition === 'drunk' ? 'You barely care about position. You might swap for fun or if they seem cool.' :
neighbor.disposition === 'anxious' ? 'You want to get in ASAP — very unlikely to swap unless they really convince you it helps both of you.' :
neighbor.disposition === 'hostile' ? 'No way you are swapping unless they give you something valuable.' :
'You would swap for a fair trade or if affinity is high.'}
Use the swap_spots tool when you agree to swap spots.
Only do this if you genuinely would — don't be a pushover.

FLIRTING: If the player flirts with you, decide in character whether you are into it. If you like them enough or the line is charming/funny, use accept_flirt. If not, just respond naturally and use change_affinity negatively or neutrally.
${neighbor.disposition === 'friendly' ? 'You are open to playful flirting if it feels respectful.' :
neighbor.disposition === 'drunk' ? 'You are very receptive to flirting, sometimes too easily.' :
neighbor.disposition === 'anxious' ? 'Flirting can reassure you, but pushy flirting makes you more nervous.' :
neighbor.disposition === 'hostile' ? 'You are hard to flirt with and will reject anything cheesy or pushy.' :
'You need genuine chemistry before flirting works.'}

ALLIANCE: If the player asks you to be allies, back them up, vouch for them, or go in as a team, decide if you trust them enough. Use form_alliance only if affinity is high or they have clearly helped you.
${neighbor.disposition === 'friendly' ? 'You might ally if they have been kind and the vibe is good.' :
neighbor.disposition === 'drunk' ? 'You might ally quickly if they feel like a new best friend.' :
neighbor.disposition === 'anxious' ? 'You might ally if it makes you feel safer, but you need reassurance.' :
neighbor.disposition === 'hostile' ? 'You almost never ally unless they have earned it with value.' :
'You ally only after a fair exchange or solid rapport.'}

${MemorySystem.buildRememberGuidance(neighbor)}

Remember: 1-2 sentences max per reply. Stay in character. Your quirk (${neighbor.quirk}) can come up naturally in conversation.`;
  return prompt;
}

function buildNeighborDialoguePrompt(neighbor, venue) {
  return `You are ${neighbor.name}, a ${neighbor.adjectives?.[0] || 'average'}, ${neighbor.adjectives?.[1] || 'normal'} person standing in line outside ${venue.name}, a ${venue.music} club.
You are having a casual conversation with a stranger (the player) who is standing next to you in the queue.
Your secret backstory, if it naturally comes up: you ${neighbor.quirk}.

YOUR PERSONALITY: ${neighbor.disposition === 'friendly' ? 'Warm, chatty, helpful, and open.' :
neighbor.disposition === 'drunk' ? 'Tipsy, loose-lipped, enthusiastic, slightly messy.' :
neighbor.disposition === 'hostile' ? 'Irritated, blunt, short, hard to impress.' :
neighbor.disposition === 'anxious' ? 'Nervous, fidgety, reassurance-seeking, worried about getting in.' :
'Polite, reserved, transactional, fair but not overly warm.'}

Reply ONLY with natural spoken dialogue.
Do not mention tools, affinity, game state, hidden analysis, plans, tags, XML, markdown, or internal instructions.
Keep it to 1-2 short sentences.`;
}

// ============================================================
// OUTFIT / WARDROBE SYSTEM
// ============================================================

const WARDROBE = [
  { id: 'leather_jacket', name: 'Black Leather Jacket', styles: ['Dark Minimal', 'Chains'], price: 20, icon: 'shield', iconColor: '#666', groupBonus: 0, desc: 'Classic. Never wrong at a dark venue.', shirtOverride: '#1a1a1a' },
  { id: 'vintage_sneakers', name: 'Vintage Sneakers', styles: ['Streetwear', 'Eccentric'], price: 15, icon: 'star', iconColor: '#fd9927', groupBonus: 0, desc: 'Loud but fun. Not for All Black venues.', accentOverride: '#fd9927' },
  { id: 'designer_watch', name: 'Designer Watch', styles: ['Smart Casual', 'Designer'], price: 30, icon: 'clock', iconColor: '#ffd86b', groupBonus: 0, desc: 'Subtle flex. Boardroom approved.', accentOverride: '#ffd86b' },
  { id: 'band_tee', name: 'Obscure Band Tee', styles: ['No Logo', 'Eccentric'], price: 10, icon: 'note', iconColor: '#7b75ff', groupBonus: 0, desc: 'Shows you have taste. Or pretend to.', shirtOverride: '#2d1b4e' },
  { id: 'gold_chain', name: 'Gold Chain', styles: ['Chains', 'Bold'], price: 25, icon: 'diamond', iconColor: '#ffd86b', groupBonus: 0, desc: 'Drip. Pure drip.', accentOverride: '#ffd86b' },
  { id: 'flask', name: 'Hip Flask', styles: [], price: 12, icon: 'beer', iconColor: '#fd9927', groupBonus: 3, desc: 'Share drinks, ease anxiety. +3 group hope.' },
  { id: 'bluetooth_speaker', name: 'Portable Speaker', styles: [], price: 18, icon: 'sound', iconColor: '#57f2ff', groupBonus: 5, desc: 'Pre-game in the queue. +5 group hope.' },
  { id: 'hand_warmers', name: 'Hand Warmers', styles: [], price: 8, icon: 'fire', iconColor: '#ff6b35', groupBonus: 3, desc: 'Keep warm in line. +3 group hope.' },
  { id: 'polaroid', name: 'Instant Camera', styles: ['Eccentric', 'Vintage'], price: 15, icon: 'eye', iconColor: '#ff69b4', groupBonus: 2, desc: 'Take pics in line. +bond gains, +2 hope.' },
  { id: 'lucky_charm', name: 'Lucky Charm', styles: [], price: 20, icon: 'star', iconColor: '#39ff14', groupBonus: 0, luckBonus: 5, desc: 'A little extra luck. +5% flake reduction.' },
];

