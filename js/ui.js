// ============================================================
// UI HELPERS
// ============================================================

function $(id) { return document.getElementById(id); }

function showToast(msg, duration = 2000) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

function notify(msg, { logType = 'info', toastMs = 2500, toast = true, log = true, logMsg = null } = {}) {
  if (toast) showToast(msg, toastMs);
  if (log) EventLog.add(logMsg || msg, logType);
}

function updateStatusBar() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  $('status-time').textContent = `${h}:${m}`;
  const battery = 8 + Math.floor(Math.random() * 12);
  $('status-battery').textContent = `${battery}%`;
}

function renderLoadingQueue(progress = 0) {
  const line = $('loading-line');
  const label = $('loading-queue-label');
  if (!line || !label) return;
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const maxPeople = 24;
  const count = Math.max(pct >= 100 ? 0 : 1, Math.ceil(maxPeople * (1 - pct / 100)));
  const colors = ['#7b75ff', '#ff4d6d', '#39ff14', '#57f2ff', '#fd9927', '#ffd86b', '#ebe4ff'];
  const skins = ['#f5d0a9', '#e8b88a', '#c68642', '#8d5524', '#6b3e26', '#dba270'];
  if (line.children.length !== maxPeople) {
    line.innerHTML = Array.from({ length: maxPeople }, (_, i) => '<span class="loading-person" data-person="' + i + '"></span>').join('');
  }
  const lineWidth = Math.max(1, line.clientWidth || 260);
  Array.from(line.children).forEach((el, i) => {
    const height = 24 + ((i * 7) % 18);
    const bob = Math.sin((Date.now() / 480) + i) * 1.5;
    const shirt = colors[i % colors.length];
    const skin = skins[i % skins.length];
    const visible = i < count;
    const activeIndex = Math.min(i, Math.max(0, count - 1));
    const spacing = count > 1 ? Math.min(12, lineWidth / Math.max(count, 1)) : 0;
    const visibleX = Math.max(0, lineWidth - (count - activeIndex) * spacing);
    const exitX = -54 - i * 3;
    el.style.setProperty('--person-height', height + 'px');
    el.style.setProperty('--person-bob', bob.toFixed(1) + 'px');
    el.style.setProperty('--person-shirt', shirt);
    el.style.setProperty('--person-skin', skin);
    el.style.setProperty('--person-x', (visible ? visibleX : exitX).toFixed(1) + 'px');
    el.style.setProperty('--person-opacity', visible ? (0.45 + Math.min(0.5, (count - i) / maxPeople)).toFixed(2) : '0');
    el.style.setProperty('--person-scale', visible ? '1' : '0.82');
  });
  label.textContent = count === 0 ? 'Model door is open' : `Queue outside the model: ${count} ahead`;
}

function switchTab(idx) {
  state.currentTab = idx;
  $('tab-slider').style.transform = `translateX(-${idx * (100 / 4)}%)`;
  document.querySelectorAll('.nav-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
}

// ============================================================
// RENDER: VENUES
// ============================================================

function renderVenues() {
  const container = $('venue-list');
  const diffOrder = { Easy: 0, Moderate: 1, Ruthless: 2, Nightmare: 3 };
  const sortedVenues = [...VENUES].sort((a, b) => (diffOrder[a.policy] || 0) - (diffOrder[b.policy] || 0));
  const prog = SaveSystem.load();

  container.innerHTML = sortedVenues.map(v => {
    const selected = state.selectedVenue === v.id;
    const locked = v.locked;
    const visits = prog.venueVisits?.[v.id] || 0;
    const cleared = prog.venuesCleared?.includes(v.id);
    const cls = ['venue-card'];
    if (selected) cls.push('selected');
    if (locked) cls.push('locked');

    if (locked) {
      const lTheme = QueueCanvas.THEMES[v.id] || QueueCanvas.THEMES.mainframe;
      const ln1 = lTheme.neon1;
      const _lh = (c) => { if (!c) return [0,0,0]; const h = c.length===4?'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]:c; return [parseInt(h.slice(1,3),16)||0,parseInt(h.slice(3,5),16)||0,parseInt(h.slice(5,7),16)||0]; };
      const [lr,lg,lb] = _lh(ln1);
      return `
        <div class="${cls.join(' ')}" style="border-color:rgba(${lr},${lg},${lb},0.08);">
          <div class="venue-top">
            <div class="venue-name" style="color:rgba(${lr},${lg},${lb},0.4)">${v.name}</div>
            <span class="venue-policy ${v.policyClass}">${v.policy}</span>
          </div>
          <div class="venue-locked-label">${PX.i('key','#666',12)} Complete earlier venues to unlock</div>
        </div>
      `;
    }

    const theme = QueueCanvas.THEMES[v.id] || QueueCanvas.THEMES.mainframe;
    const n1 = theme.neon1;
    const _h = (c) => { if (!c) return [0,0,0]; const h = c.length===4?'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]:c; return [parseInt(h.slice(1,3),16)||0,parseInt(h.slice(3,5),16)||0,parseInt(h.slice(5,7),16)||0]; };
    const [n1r,n1g,n1b] = _h(n1);
    const cardBg = `linear-gradient(135deg, rgba(${n1r},${n1g},${n1b},0.06) 0%, transparent 60%)`;
    const borderAccent = `rgba(${n1r},${n1g},${n1b},0.15)`;
    const vibeLabel = v.vibeCheck ? `<span style="font-size:9px;font-weight:700;color:${n1};letter-spacing:1px;text-transform:uppercase;margin-left:6px;">VIBE CHECK</span>` : '';
    const outdoorLabel = theme.outdoor ? `<span style="font-size:9px;font-weight:700;color:var(--neon-green);letter-spacing:1px;margin-left:6px;">OUTDOOR</span>` : '';

    return `
      <div class="${cls.join(' ')}" data-venue="${v.id}" style="background:${cardBg};border-color:${borderAccent};">
        <div class="venue-top">
          <div class="venue-name" style="color:${n1}">${v.name}${vibeLabel}${outdoorLabel}</div>
          <span class="venue-policy ${v.policyClass}">${v.policy}</span>
        </div>
        <div class="venue-meta">
          <span class="venue-tag">${PX.i('note', n1, 12)} ${v.music}</span>
          <span class="venue-tag">${PX.i('clock','#ebe4ff',12)} ${v.bpm} BPM</span>
          <span class="venue-tag" style="color:var(--neon-gold)">${PX.i('coin','#ffd86b',12)} $${v.entryPrice}/person</span>
        </div>
        <div class="venue-dress">Dress code: ${v.dressCode}</div>
        ${v.desc ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${v.desc}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:6px;font-size:10px;">
          ${visits > 0 ? `<span style="color:var(--text-muted);">Visited ${visits}x</span>` : ''}
          ${cleared ? `<span style="color:var(--neon-green);font-weight:700;">${PX.i('star','#39ff14',10)} Cleared</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.venue-card[data-venue]').forEach(card => {
    card.addEventListener('click', () => {
      const venueId = card.dataset.venue;
      state.selectedVenue = venueId;
      ensureTonightsBouncer(venueId);

      const venue = VENUES.find(v => v.id === venueId);
      if (venue) {
        ClubAudio.bpm = venue.bpm;
        const styleMap = { 'Deep House': 'deep_house', 'Techno': 'techno', 'Drum & Bass': 'dnb', 'Tech-House': 'tech_house', 'Minimal Techno': 'minimal_techno', 'Industrial': 'industrial' };
        ClubAudio.style = styleMap[venue.music] || 'deep_house';
      }

      renderVenues();
      renderContacts();
      renderLoadout();
      updateConfirmBar();
    });
  });
}

// ============================================================
// RENDER: CONTACTS
// ============================================================

function renderContacts() {
  const container = $('contact-list');
  const selectedVenue = VENUES.find(v => v.id === state.selectedVenue);
  const unlocked = state.progress?.unlockedContacts || ['kai', 'rissal', 'mona'];
  const availableContacts = CONTACTS.filter(c => unlocked.includes(c.id));
  const lockedContacts = CONTACTS.filter(c => !unlocked.includes(c.id));

  container.innerHTML = availableContacts.map(c => {
    const selected = state.selectedSquad.includes(c.id);
    const atMax = !selected && state.selectedSquad.length >= 3;
    const venueBlock = c.refusesEasy && selectedVenue?.policy === 'Easy';
    const disabled = atMax || venueBlock;

    const cls = ['crew-profile'];
    if (selected) cls.push('selected');

    const bond = SaveSystem.getBond('player', c.id);
    const stats = SaveSystem.getContactStat(c.id);
    const portrait = c.portraitProps ? Portrait.generate(c.portraitProps, 'friendly', []) : '';

    const loyaltyLevel = stats.loyalty >= 80 ? 'Ride or Die' : stats.loyalty >= 50 ? 'Solid' : stats.loyalty >= 20 ? 'Warming Up' : 'New';
    const loyaltyColor = stats.loyalty >= 80 ? 'var(--neon-green)' : stats.loyalty >= 50 ? 'var(--neon-cyan)' : stats.loyalty >= 20 ? 'var(--neon-gold)' : 'var(--text-muted)';
    const loyaltyBg = stats.loyalty >= 80 ? 'rgba(57,255,20,0.12)' : stats.loyalty >= 50 ? 'rgba(87,242,255,0.12)' : stats.loyalty >= 20 ? 'rgba(255,216,107,0.12)' : 'rgba(255,255,255,0.04)';

    let musicNote = '';
    if (selectedVenue && c.musicPref) {
      musicNote = c.musicPref === selectedVenue.music
        ? `<span style="color:var(--neon-green);font-size:10px;">${PX.i('note','#39ff14',10)} Into it</span>`
        : `<span style="color:var(--text-muted);font-size:10px;">${PX.i('note','#666',10)} Meh</span>`;
    }

    let warning = '';
    if (venueBlock) warning = `<div style="font-size:10px;color:var(--neon-orange);margin-top:4px;">Won't go to Easy venues</div>`;
    if (disabled && !selected && !venueBlock) warning = `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Squad full (3/3)</div>`;

    return `
      <div class="${cls.join(' ')} ${disabled && !selected ? 'disabled' : ''}" data-contact="${c.id}" style="${selected ? 'border-color:' + c.color + ';box-shadow:0 0 16px ' + c.color + '22;' : ''}">
        <div class="crew-top">
          <div class="crew-portrait"><img src="${portrait}" alt="${c.name}"></div>
          <div class="crew-header">
            <div class="crew-name-row">
              <span class="crew-name" style="color:${selected ? c.color : '#fff'}">${c.name}</span>
              <span class="crew-loyalty" style="color:${loyaltyColor};background:${loyaltyBg};border:1px solid ${loyaltyColor}33;">${loyaltyLevel}</span>
              ${musicNote}
            </div>
            <div class="crew-trait-label" style="color:${c.traitTextColor}">${c.trait}</div>
          </div>
          ${selected ? `<span style="color:${c.color};font-size:18px;font-weight:900;">✓</span>` : ''}
        </div>
        <div class="crew-stats-row">
          <div class="crew-stat"><span class="crew-stat-val" style="color:var(--neon-cyan)">${stats.runsTogether}</span><span class="crew-stat-label">Runs</span></div>
          <div class="crew-stat"><span class="crew-stat-val" style="color:var(--neon-green)">${stats.successes}</span><span class="crew-stat-label">Wins</span></div>
          <div class="crew-stat"><span class="crew-stat-val" style="color:var(--neon-pink)">${stats.flakes}</span><span class="crew-stat-label">Flakes</span></div>
          <div class="crew-stat"><span class="crew-stat-val" style="color:var(--neon-gold)">${bond}</span><span class="crew-stat-label">Bond</span></div>
          <div class="crew-stat"><span class="crew-stat-val" style="color:${loyaltyColor}">${stats.loyalty}</span><span class="crew-stat-label">Loyalty</span></div>
        </div>
        ${(() => {
          const otherContacts = availableContacts.filter(o => o.id !== c.id);
          const connections = otherContacts.map(o => {
            const b = SaveSystem.getBond(c.id, o.id);
            if (b <= 0) return '';
            const lbl = b >= 60 ? 'bestie' : b >= 30 ? 'friend' : 'met';
            const col = b >= 60 ? '#ff69b4' : b >= 30 ? '#57f2ff' : '#666';
            return `<span style="font-size:9px;color:${col};padding:1px 5px;border:1px solid ${col}33;border-radius:4px;background:rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},0.06);">${o.name} (${lbl})</span>`;
          }).filter(Boolean);
          return connections.length > 0 ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">${connections.join('')}</div>` : '';
        })()}
        ${warning}
      </div>
    `;
  }).join('');

  // Locked contacts
  if (lockedContacts.length > 0) {
    container.innerHTML += `<div class="section-header" style="padding-top:12px;">Unknown — meet them out there</div>`;
    container.innerHTML += lockedContacts.map(c => {
      const portrait = c.portraitProps ? Portrait.generate(c.portraitProps, 'neutral', []) : '';
      const hint = c.unlockCondition === 'rep5' ? 'Reach 5 rep' : c.unlockCondition === 'rep10' ? 'Reach 10 rep' : c.unlockCondition === 'rep15' ? 'Reach 15 rep' : c.unlockCondition?.startsWith('venue_') ? 'Clear a venue' : 'Go out more';
      return `<div class="crew-profile" style="opacity:0.3;cursor:default;">
        <div class="crew-top">
          <div class="crew-portrait locked">${portrait ? `<img src="${portrait}" alt="?">` : ''}</div>
          <div class="crew-header">
            <div class="crew-name-row"><span class="crew-name" style="color:var(--text-muted)">???</span></div>
            <div class="crew-trait-label">Unknown</div>
          </div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px;">${PX.i('key','#666',10)} ${hint}</div>
      </div>`;
    }).join('');
  }

  container.querySelectorAll('.crew-profile[data-contact]').forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('disabled') && !card.classList.contains('selected')) {
        const contact = CONTACTS.find(c => c.id === card.dataset.contact);
        if (contact?.refusesEasy) {
          showToast(`${contact.name} refuses Easy venues`);
        } else {
          showToast('Max 3 squad members');
        }
        return;
      }
      const contactId = card.dataset.contact;
      const idx = state.selectedSquad.indexOf(contactId);
      if (idx >= 0) {
        state.selectedSquad.splice(idx, 1);
      } else {
        if (state.selectedSquad.length >= 3) return;
        state.selectedSquad.push(contactId);
      }
      renderContacts();
      renderLoadout();
      updateConfirmBar();
      updateSquadBadge();
    });
  });
}

function updateSquadBadge() {
  const badge = $('squad-badge');
  const count = state.selectedSquad.length;
  $('squad-count').textContent = `${count} / 3`;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================================
// RENDER: LOADOUT
// ============================================================

function renderLoadout() {
  const container = $('item-list');
  const hasRissal = state.selectedSquad.includes('rissal');
  const freeItems = hasRissal ? ['gum', 'lighter'] : [];

  container.innerHTML = ITEMS.map(item => {
    const owned = state.inventory[item.id] || 0;
    const free = freeItems.includes(item.id);
    const canAfford = state.cash >= item.price;

    return `
      <div class="item-card" data-item="${item.id}">
        <div class="item-left">
          <div class="item-icon">${PX.i(item.icon, item.iconColor || '#ebe4ff', 20)}</div>
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-desc">${item.desc}</div>
          </div>
        </div>
        <div class="item-right">
          <div class="item-price">$${item.price}</div>
          <div class="item-controls">
            <button class="item-btn" data-action="remove" data-item="${item.id}" ${owned <= 0 ? 'disabled' : ''}>−</button>
            <span class="item-qty">${owned}${free ? `<span class="item-free-tag">+1</span>` : ''}</span>
            <button class="item-btn" data-action="add" data-item="${item.id}" ${!canAfford ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  $('budget-display').innerHTML = `<span class="currency">$</span>${state.cash}`;

  // Wardrobe section
  const prog = SaveSystem.load();
  container.innerHTML += `<div class="section-header" style="padding-top:12px;">Wardrobe</div>`;
  container.innerHTML += WARDROBE.map(w => {
    const owned = prog.ownedOutfits.includes(w.id);
    const equipped = prog.equippedOutfits.includes(w.id);
    const canBuy = !owned && state.cash >= w.price;
    return `
      <div class="item-card" style="${equipped ? 'border-color:var(--neon-green);background:rgba(57,255,20,0.04);' : ''}">
        <div class="item-left">
          <div class="item-icon">${PX.i(w.icon, w.iconColor, 20)}</div>
          <div class="item-info">
            <div class="item-name">${w.name} ${equipped ? '<span style="color:var(--neon-green);font-size:10px;">EQUIPPED</span>' : ''}</div>
            <div class="item-desc">${w.desc}</div>
            ${w.styles.length > 0 ? `<div style="display:flex;gap:3px;margin-top:3px;flex-wrap:wrap;">${w.styles.map(s => `<span class="style-pill">${s}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="item-right">
          ${owned
            ? `<button class="item-btn" style="width:auto;padding:0 8px;font-size:10px;${equipped ? 'color:var(--neon-green);border-color:var(--neon-green);' : ''}" data-wardrobe="${w.id}">${equipped ? 'ON' : 'OFF'}</button>`
            : `<button class="item-btn" style="width:auto;padding:0 8px;font-size:10px;color:var(--neon-gold);" data-buy-wardrobe="${w.id}" ${!canBuy ? 'disabled' : ''}>$${w.price}</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  const note = $('loadout-note');
  if (hasRissal) {
    note.textContent = "Rissal brings a free gum & lighter — the chill coder always comes prepared";
  } else {
    note.textContent = '';
  }

  container.querySelectorAll('.item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const itemId = btn.dataset.item;
      const item = ITEMS.find(i => i.id === itemId);
      if (!item) return;

      if (action === 'add') {
        if (state.cash < item.price) {
          showToast("Not enough cash");
          return;
        }
        state.cash -= item.price;
        state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
      } else {
        if ((state.inventory[itemId] || 0) <= 0) return;
        state.cash += item.price;
        state.inventory[itemId]--;
      }
      renderLoadout();
      updateConfirmBar();
    });
  });

  // Wardrobe: buy
  container.querySelectorAll('[data-buy-wardrobe]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wId = btn.dataset.buyWardrobe;
      const w = WARDROBE.find(i => i.id === wId);
      if (!w || state.cash < w.price) return;
      state.cash -= w.price;
      const p = SaveSystem.load();
      p.ownedOutfits.push(wId);
      p.equippedOutfits.push(wId);
      SaveSystem.save(p);
      showToast(`Bought ${w.name}`, 1500);
      renderLoadout();
      renderLookPanel();
      renderPlayerBadge();
      updateConfirmBar();
    });
  });

  // Wardrobe: toggle equip
  container.querySelectorAll('[data-wardrobe]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wId = btn.dataset.wardrobe;
      const p = SaveSystem.load();
      const idx = p.equippedOutfits.indexOf(wId);
      if (idx >= 0) p.equippedOutfits.splice(idx, 1);
      else p.equippedOutfits.push(wId);
      SaveSystem.save(p);
      renderLoadout();
      renderLookPanel();
      renderPlayerBadge();
    });
  });
}

// ============================================================
// RENDER: PLAYER LOOK
// ============================================================

function renderLookPanel() {
  const opts = $('look-options');
  const look = state.playerLook;
  const prog = SaveSystem.load();
  const equipped = (prog.equippedOutfits || []).map(id => WARDROBE.find(w => w.id === id)).filter(Boolean);
  const labels = {
    skin: 'Skin Tone',
    hair: 'Hair Color',
    hairStyle: 'Hair Style',
    shirt: 'Shirt Color',
    eyeColor: 'Eye Color',
    faceWidth: 'Face Width',
    faceHeight: 'Face Height',
    eyeSpacing: 'Eye Spacing',
    noseSize: 'Nose',
    earSize: 'Ears',
  };

  const optionRows = Object.keys(PLAYER_OPTIONS).map(key => {
    const values = PLAYER_OPTIONS[key];
    const idx = look[key];
    const val = values[idx];
    let display;
    if (['skin', 'hair', 'shirt', 'eyeColor'].includes(key)) {
      display = `<span class="look-swatch" style="background:${val}"></span>`;
    } else if (key === 'hairStyle') {
      display = `<span class="look-value">${val}</span>`;
    } else {
      display = `<span class="look-value">${val}</span>`;
    }
    return `
      <div class="look-row">
        <span class="look-row-label">${labels[key]}</span>
        <div class="look-row-controls">
          <button class="look-cycle-btn" data-key="${key}" data-dir="-1">‹</button>
          ${display}
          <button class="look-cycle-btn" data-key="${key}" data-dir="1">›</button>
        </div>
      </div>
    `;
  }).join('');

  const equippedRows = equipped.length > 0 ? `
    <div style="margin-top:12px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;padding:0 4px;">Equipped Outfits</div>
    ${equipped.map(w => `
      <div class="look-row" style="opacity:0.85;">
        <span class="look-row-label" style="display:flex;align-items:center;gap:6px;">${PX.i(w.icon, w.iconColor, 14)} ${w.name}</span>
        ${w.shirtOverride ? `<span class="look-swatch" style="background:${w.shirtOverride}"></span>` : ''}
        ${w.accentOverride ? `<span class="look-swatch" style="background:${w.accentOverride}"></span>` : ''}
        ${!w.shirtOverride && !w.accentOverride ? '<span class="look-value" style="font-size:10px">no visual</span>' : ''}
      </div>
    `).join('')}
  ` : '';

  opts.innerHTML = optionRows + equippedRows;

  opts.querySelectorAll('.look-cycle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const dir = parseInt(btn.dataset.dir);
      const max = PLAYER_OPTIONS[key].length;
      state.playerLook[key] = (state.playerLook[key] + dir + max) % max;
      const progress = SaveSystem.load();
      progress.playerLook = { ...state.playerLook };
      SaveSystem.save(progress);
      renderLookPanel();
      renderPlayerBadge();
    });
  });

  // Draw preview
  const canvas = $('look-canvas');
  if (canvas) {
    const props = getPlayerPortraitProps(true);
    const url = Portrait.generate(props, 'friendly', []);
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 80, 80);
      ctx.drawImage(img, 0, 0, 80, 80);
    };
    img.src = url;
  }
}

function getPlayerPortraitProps(includeWardrobe = false) {
  const look = state.playerLook;
  const props = {
    skin: PLAYER_OPTIONS.skin[look.skin],
    hairColor: PLAYER_OPTIONS.hair[look.hair],
    hairStyle: PLAYER_OPTIONS.hairStyle[look.hairStyle],
    shirtColor: PLAYER_OPTIONS.shirt[look.shirt],
    eyeColor: PLAYER_OPTIONS.eyeColor[look.eyeColor],
    accessory: null,
    faceWidth: PLAYER_OPTIONS.faceWidth[look.faceWidth],
    faceHeight: PLAYER_OPTIONS.faceHeight[look.faceHeight],
    eyeSpacing: PLAYER_OPTIONS.eyeSpacing[look.eyeSpacing],
    noseSize: PLAYER_OPTIONS.noseSize[look.noseSize],
    earSize: PLAYER_OPTIONS.earSize[look.earSize],
    seed: 0.5,
  };
  if (includeWardrobe) {
    const prog = SaveSystem.load();
    for (const wId of (prog.equippedOutfits || [])) {
      const w = WARDROBE.find(i => i.id === wId);
      if (w?.shirtOverride) props.shirtColor = w.shirtOverride;
    }
  }
  return props;
}

function getCurrentJob() {
  const prog = state.progress || SaveSystem.load();
  return SaveSystem.JOBS.slice().reverse().find(j => prog.reputation >= j.minRep) || SaveSystem.JOBS[0];
}

function renderPlayerBadge() {
  const canvas = $('player-badge-canvas');
  if (!canvas) return;

  const job = getCurrentJob();
  $('player-badge-job').textContent = job.name;

  const url = Portrait.generate(getPlayerPortraitProps(true), 'friendly', []);
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = url;
}

// ============================================================
// CONFIRM BAR
// ============================================================

function updateConfirmBar() {
  const btn = $('confirm-btn');
  const summary = $('confirm-summary');
  const venue = VENUES.find(v => v.id === state.selectedVenue);

  if (!venue) {
    summary.textContent = 'Select a venue to get started';
    btn.disabled = true;
    btn.classList.remove('ready');
    return;
  }

  const squadCount = state.selectedSquad.length;
  const headCount = 1 + squadCount;
  const entryCost = venue.entryPrice * headCount;
  const canAfford = state.cash >= entryCost;

  const parts = [venue.name];
  parts.push(`$${entryCost} entry (${headCount}×$${venue.entryPrice})`);
  if (squadCount > 0) parts.push(`${squadCount} friend${squadCount > 1 ? 's' : ''}`);
  if (state.selectedSquad.includes('pia')) {
    ensureTonightsBouncer(venue.id);
    if (tonightsBouncer) parts.push(`Door: ${tonightsBouncer.name}`);
  }
  summary.textContent = parts.join(' · ');

  if (!canAfford) {
    summary.textContent += ' — NOT ENOUGH CASH';
    summary.style.color = 'var(--neon-pink)';
    btn.disabled = true;
    btn.classList.remove('ready');
  } else {
    summary.style.color = '';
    btn.disabled = false;
    btn.classList.add('ready');
  }
}

// ============================================================
// FLAKE ROLL
// ============================================================

function computeEffectiveFlake(contact, venue, {
  playerBond = 0,
  otherSquadBonds = [],
  selectedSquadCount = 1,
  equippedOutfits = [],
  loyalty = 50,
} = {}) {
  let effectiveFlake = contact.flakeRate;

  if (venue && contact.musicPref) {
    if (contact.musicPref === venue.music) effectiveFlake -= 15;
    else effectiveFlake += 10;
  }

  if (venue?.entryPrice >= 25) effectiveFlake += 10;
  else if (venue?.entryPrice >= 15) effectiveFlake += 3;

  effectiveFlake -= Math.floor(playerBond / 20) * 5;

  otherSquadBonds.forEach(bond => {
    if (bond >= 30) effectiveFlake -= 5;
  });

  if (selectedSquadCount >= 3) effectiveFlake -= 8;
  else if (selectedSquadCount >= 2) effectiveFlake -= 3;

  equippedOutfits.forEach(id => {
    const w = WARDROBE.find(i => i.id === id);
    if (w?.luckBonus) effectiveFlake -= w.luckBonus;
  });

  effectiveFlake -= (loyalty - 50) * 0.1;

  return Math.max(2, Math.min(90, effectiveFlake));
}

async function startFlakeRoll() {
  state.phase = 'FLAKE_ROLL';
  const venue = VENUES.find(v => v.id === state.selectedVenue);

  $('phone-container').classList.remove('active');
  $('flake-overlay').classList.add('active');
  $('flake-location').textContent = `Outside ${venue.name}`;

  const msgContainer = $('flake-messages');
  msgContainer.innerHTML = '';
  $('flake-result').innerHTML = '';
  $('flake-result').classList.remove('visible');

  if (state.selectedSquad.length === 0) {
    await sleep(800);
    showSoloResult(venue);
    return;
  }

  const results = [];

  for (const contactId of state.selectedSquad) {
    const contact = CONTACTS.find(c => c.id === contactId);
    if (!contact) continue;

    // Show typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'flake-msg visible';
    typingEl.innerHTML = `
      <div class="msg-avatar" style="background:${contact.traitColor};border:1px solid ${contact.traitBorder};">
        <span style="color:${contact.color};font-size:13px;font-weight:800;">${contact.initials}</span>
      </div>
      <div class="msg-bubble">
        <div class="msg-name" style="color:${contact.color}">${contact.name}</div>
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    `;
    msgContainer.appendChild(typingEl);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    await sleep(1200 + Math.random() * 1200);

    const otherSelected = state.selectedSquad.filter(id => id !== contact.id);
    const otherSquadBonds = otherSelected.map(otherId => SaveSystem.getBond(contact.id, otherId));
    const prog = SaveSystem.load();
    const effectiveFlake = computeEffectiveFlake(contact, venue, {
      playerBond: SaveSystem.getBond('player', contact.id),
      otherSquadBonds,
      selectedSquadCount: state.selectedSquad.length,
      equippedOutfits: prog.equippedOutfits,
      loyalty: SaveSystem.getContactStat(contact.id).loyalty,
    });

    const roll = Math.random() * 100;
    const flaked = roll < effectiveFlake;
    results.push({ contact, flaked });

    // Track stats
    SaveSystem.updateContactStat(contact.id, { run: true, flake: flaked });

    // Replace typing with actual message
    typingEl.innerHTML = `
      <div class="msg-avatar" style="background:${contact.traitColor};border:1px solid ${contact.traitBorder};">
        <span style="color:${contact.color};font-size:13px;font-weight:800;">${contact.initials}</span>
      </div>
      <div class="msg-bubble">
        <div class="msg-name" style="color:${contact.color}">${contact.name}</div>
        <div class="msg-text">${flaked ? contact.flakeMsg : contact.confirmMsg}</div>
        <div class="msg-status ${flaked ? 'flaked' : 'confirmed'}">
          ${flaked ? '✗ FLAKED' : '✓ CONFIRMED'}
        </div>
      </div>
    `;
    msgContainer.scrollTop = msgContainer.scrollHeight;

    await sleep(600);
  }

  await sleep(800);

  // Show final squad
  state.finalSquad = results.filter(r => !r.flaked).map(r => r.contact);
  showFlakeResult(venue, state.finalSquad, results);
}

function showSoloResult(venue) {
  const resultEl = $('flake-result');
  const playerPortrait = Portrait.generate(getPlayerPortraitProps(true), 'friendly', []);
  resultEl.innerHTML = `
    <div class="flake-result-title">Going solo tonight</div>
    <div class="flake-squad">
      <div class="flake-squad-member">
        <div class="member-dot" style="background:linear-gradient(135deg, var(--neon-purple), var(--neon-pink));border:2px solid var(--neon-purple);overflow:hidden;border-radius:50%;">
          <img src="${playerPortrait}" style="width:48px;height:48px;image-rendering:pixelated;border-radius:50%;" alt="You">
        </div>
        <div class="member-name">You</div>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">Brave. Stupid. Let's go.</div>
    <button class="enter-queue-btn" onclick="enterQueue()">Enter the Queue →</button>
  `;
  resultEl.classList.add('visible');
}

function showFlakeResult(venue, squad, allResults) {
  const resultEl = $('flake-result');
  const flakeCount = allResults.filter(r => r.flaked).length;
  const survivorCount = squad.length;
  const playerPortrait = Portrait.generate(getPlayerPortraitProps(true), 'friendly', []);

  let subtitle = '';
  if (flakeCount === 0) {
    subtitle = "Everyone's in. Let's move.";
  } else if (survivorCount === 0) {
    subtitle = "Everyone flaked. Going solo.";
  } else {
    subtitle = `${flakeCount} down, ${survivorCount} standing. Let's go.`;
  }

  const memberDots = squad.length > 0 ? squad.map(c => {
    const props = Portrait.randomProps();
    props.shirtColor = c.color || props.shirtColor;
    const portrait = Portrait.generate(props, 'friendly', []);
    return `<div class="flake-squad-member">
      <div class="member-dot" style="background:${c.traitColor};border:2px solid ${c.color};overflow:hidden;border-radius:50%;">
        <img src="${portrait}" style="width:48px;height:48px;image-rendering:pixelated;border-radius:50%;" alt="${c.name}">
      </div>
      <div class="member-name">${c.name}</div>
    </div>`;
  }).join('') : '';

  const youDot = `
    <div class="flake-squad-member">
      <div class="member-dot" style="background:linear-gradient(135deg, var(--neon-purple), var(--neon-pink));border:2px solid var(--neon-purple);overflow:hidden;border-radius:50%;">
        <img src="${playerPortrait}" style="width:48px;height:48px;image-rendering:pixelated;border-radius:50%;" alt="You">
      </div>
      <div class="member-name">You</div>
    </div>
  `;

  resultEl.innerHTML = `
    <div class="flake-result-title">Your squad tonight</div>
    <div class="flake-squad">
      ${youDot}
      ${memberDots}
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">${subtitle}</div>
    <button class="enter-queue-btn" onclick="enterQueue()">Enter the Queue →</button>
  `;
  resultEl.classList.add('visible');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// EVENT LOG
// ============================================================

// ============================================================
// QUEUE UI HELPERS
// ============================================================

function updateEavesdropButton() {
  const btn = $('act-eavesdrop');
  if (!btn) return;
  const available = typeof getIntelPool === 'function'
    ? getIntelPool().filter(i => !state.queue.revealedIntel.includes(i.key))
    : [];
  const disabled = available.length === 0;
  btn.disabled = disabled;
  btn.style.opacity = disabled ? '0.45' : '';
  btn.title = disabled ? 'Nothing new to overhear' : '';
}

// ============================================================
// EVENT LOG
// ============================================================

const EventLog = {
  entries: [],

  add(text, type = 'info') {
    this.entries.push({ text, type, time: state.queue.gameTime });
    this.render();
  },

  render() {
    const list = $('event-log-list');
    if (!list) return;
    list.innerHTML = this.entries.slice().reverse().map(e => {
      const h = Math.floor(e.time / 60) % 24;
      const m = e.time % 60;
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const period = h >= 12 ? 'PM' : 'AM';
      const ts = `${h12}:${String(m).padStart(2, '0')} ${period}`;
      return `<div class="log-entry"><span class="log-time">${ts}</span><span class="log-text ${e.type}">${e.text}</span></div>`;
    }).join('');
  },

  clear() { this.entries = []; },
};

