// ============================================================
// USE ITEM SYSTEM (consume from inventory during queue / bouncer)
// ============================================================

const CONSUMABLE_EFFECTS = {
  beer: {
    name: 'Beer', icon: 'beer', iconColor: '#ffd86b', px: 'beer', pxColor: '#ffd86b',
    effect: 'Anxiety −12',
    apply() {
      QueueEngine.modAnxiety(-12);
      state.queue.hadDrink = true;
      state.queue.beerDebuff = true;
    },
    trait: 'Liquid Courage',
  },
  snack: {
    name: 'Döner Roll', icon: 'bag', iconColor: '#fd9927', px: 'bag', pxColor: '#fd9927',
    effect: 'Anxiety −4',
    apply() {
      QueueEngine.modAnxiety(-4);
      state.queue.hadDrink = true;
    },
  },
  water: {
    name: 'Water Bottle', icon: 'drop', iconColor: '#57f2ff', px: 'drop', pxColor: '#57f2ff',
    effect: 'Anxiety −6, hydration',
    apply() {
      QueueEngine.modAnxiety(-6);
      state.queue.hadDrink = true;
    },
  },
  gum: {
    name: 'Gum', icon: 'gum', iconColor: '#a4ff80', px: 'gum', pxColor: '#a4ff80',
    effect: 'Anxiety −2, fresh breath',
    apply() { QueueEngine.modAnxiety(-2); },
  },
  cigarette: {
    name: 'Cigarette', icon: 'cig', iconColor: '#ebe4ff', px: 'cig', pxColor: '#ebe4ff',
    effect: 'Anxiety −6',
    apply() { QueueEngine.modAnxiety(-6); },
  },
  redbull: {
    name: 'Red Bull', icon: 'bolt', iconColor: '#57f2ff', px: 'bolt', pxColor: '#57f2ff',
    effect: 'Hope +8',
    apply() {
      QueueEngine.modHope(8);
      state.queue.hadDrink = true;
    },
  },
  earplugs: {
    name: 'Earplugs', icon: 'ear', iconColor: '#57f2ff', px: 'ear', pxColor: '#57f2ff',
    effect: 'Halves anxiety gains tonight (consumes item)',
    apply() {
      state.queue.earplugsActive = true;
      notify('Earplugs in — anxiety gains halved for the rest of the night', {
        toastMs: 2000,
        logType: 'positive',
        logMsg: 'Used earplugs — strong one-night anxiety shield (passive bonus disabled)',
      });
    },
  },
  glitter: {
    name: 'Glitter', icon: 'diamond', iconColor: '#ff69b4', px: 'diamond', pxColor: '#ff69b4',
    effect: 'Hope +15, Anxiety −20, trait: The Vibe',
    apply() {
      QueueEngine.modHope(15);
      QueueEngine.modAnxiety(-20);
    },
    trait: 'The Vibe',
  },
  turbo: {
    name: 'Turbo Tabs', icon: 'bolt', iconColor: '#39ff14', px: 'bolt', pxColor: '#39ff14',
    effect: 'Hope +20, delayed anxiety spike',
    apply() { QueueEngine.modHope(20); },
    trait: 'Motor Mouth',
    delayedEffect: { turns: 3, anxiety: 25, trait: 'Paranoid', label: '😰 The Turbo Tabs is wearing off...' },
  },
  nosecandy: {
    name: 'Nose Candy', icon: 'snow', iconColor: '#fff', px: 'snow', pxColor: '#fff',
    effect: 'Hope +10, Anxiety −10, trait: Big Energy',
    apply() {
      QueueEngine.modHope(10);
      QueueEngine.modAnxiety(-10);
    },
    trait: 'Big Energy',
  },
  vip: {
    name: 'Fake VIP Wristband', icon: 'band', iconColor: '#ffd86b', px: 'band', pxColor: '#ffd86b',
    effect: 'Flash wristband at the bouncer (risky)',
    bouncerOnly: true,
    apply() {
      notify('You flash the VIP wristband — the bouncer is watching', {
        toastMs: 2000,
        logType: 'info',
        logMsg: 'Showed fake VIP wristband to the bouncer',
      });
      BouncerSystem.sendMessage('*pulls sleeve back to show a VIP wristband* "We\'re on the list — see?"');
    },
  },
};

function applyConsumable(id, { source = 'use' } = {}) {
  const def = CONSUMABLE_EFFECTS[id];
  if (!def) return false;
  def.apply();
  if (def.trait) QueueEngine.addTrait(def.trait);
  if (def.delayedEffect) {
    const label = id === 'turbo' && source === 'use'
      ? 'The Turbo is wearing off...'
      : (def.delayedEffect.label || `😰 The ${def.name} is wearing off...`);
    state.queue.delayedEffects.push({
      turnsLeft: def.delayedEffect.turns,
      anxiety: def.delayedEffect.anxiety || 0,
      trait: def.delayedEffect.trait || null,
      label,
    });
  }
  if (source === 'kiosk') {
    const risky = KIOSK_ITEMS.find(i => i.id === id)?.risky;
    notify(`${def.icon} ${def.name} — ${def.effect}`, {
      toastMs: 1500,
      logType: risky ? 'negative' : 'positive',
      logMsg: `${def.icon} Bought ${def.name} from kiosk — ${def.effect}`,
    });
  } else if (id !== 'earplugs' && id !== 'vip') {
    notify(`Used ${def.name} — ${def.effect}`, {
      toastMs: 2000,
      logType: 'positive',
      logMsg: `${PX.i(def.px, def.pxColor, 10)} Used ${def.name}`,
    });
  }
  return true;
}

const UseItemSystem = {
  get CONSUMABLES() { return CONSUMABLE_EFFECTS; },

  _usableItems() {
    const phase = state.phase;
    return Object.entries(state.inventory).filter(([id, qty]) => {
      if (qty <= 0) return false;
      const def = this.CONSUMABLES[id];
      if (!def) return false;
      if (def.bouncerOnly) return phase === 'BOUNCER';
      if (phase === 'BOUNCER') return !!def.bouncerOnly;
      return phase === 'QUEUE';
    });
  },

  open() {
    const items = this._usableItems();
    if (items.length === 0) {
      showToast(state.phase === 'BOUNCER' ? 'Nothing usable at the door' : 'No consumable items in your inventory', 1500);
      return;
    }

    if (state.phase === 'QUEUE') state.queue.actionLocked = true;
    const panel = $('kiosk-panel');
    panel.innerHTML = `
      <div class="kiosk-title">${state.phase === 'BOUNCER' ? 'At the Door' : 'Your Inventory'}</div>
      <div class="kiosk-subtitle">Use an item · Cash: $${state.cash}</div>
      ${items.map(([id, qty]) => {
        const c = this.CONSUMABLES[id];
        return `<div class="kiosk-item">
          <div class="kiosk-item-left">
            <span class="kiosk-item-icon">${PX.i(c.px, c.pxColor, 22)}</span>
            <div>
              <div class="kiosk-item-name">${c.name} (${qty}x)</div>
              <div class="kiosk-item-effect">${c.effect}</div>
            </div>
          </div>
          <button class="kiosk-buy-btn" data-use="${id}">Use</button>
        </div>`;
      }).join('')}
      <button class="kiosk-close" id="use-close-btn">${state.phase === 'BOUNCER' ? 'Back to Bouncer' : 'Back to Queue'}</button>
    `;

    panel.querySelectorAll('[data-use]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.use;
        if ((state.inventory[id] || 0) <= 0) return;
        state.inventory[id]--;
        applyConsumable(id);
        if (state.phase === 'QUEUE') {
          QueueEngine.resetWaitStreak();
          QueueEngine.advanceTime(1);
          QueueEngine.updateMeters();
          this.open();
        } else {
          $('kiosk-overlay').classList.remove('active');
        }
      });
    });

    $('use-close-btn')?.addEventListener('click', () => {
      $('kiosk-overlay').classList.remove('active');
      if (state.phase === 'QUEUE') {
        state.queue.actionLocked = false;
        QueueEngine.onOverlayClosed();
      }
    });

    $('kiosk-overlay').classList.add('active');
  },
};
