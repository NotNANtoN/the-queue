// ============================================================
// NIGHTLIFE CODEX
// ============================================================

const CodexSystem = {
  VENUE_UNLOCK_THRESHOLDS: {
    boardroom: 2,
    florians: 3,
    audit: 5,
  },

  open() {
    const overlay = $('codex-overlay');
    if (!overlay) return;
    this.render();
    overlay.classList.add('active');
  },

  close() {
    const overlay = $('codex-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
  },

  toggle() {
    const overlay = $('codex-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('active')) this.close();
    else this.open();
  },

  _contactUnlockText(condition) {
    if (!condition) return 'Available';
    if (condition === 'rep5') return 'Reach 5 reputation';
    if (condition === 'rep10') return 'Reach 10 reputation';
    if (condition === 'rep15') return 'Reach 15 reputation';
    if (condition === 'venue_compliance') return 'Clear The Compliance Vault';
    if (condition === 'venue_boardroom') return 'Clear The Boardroom Penthouse';
    if (condition === 'venue_florians') return "Clear Florian's Private Members";
    return 'Unknown';
  },

  render() {
    const panel = $('codex-panel');
    if (!panel) return;
    const prog = SaveSystem.load();
    const cleared = SaveSystem.uniqueVenuesClearedCount(prog);
    const totalRuns = prog.totalRuns || 0;
    const totalSuccesses = prog.totalSuccesses || 0;
    const winRate = totalRuns > 0 ? Math.round((totalSuccesses / totalRuns) * 100) : 0;
    const currentStreak = prog.currentStreak || 0;
    const bestStreak = prog.bestStreak || 0;
    const wonBadge = prog.wonAt
      ? `<span class="codex-badge">Scene Legend</span>`
      : '';

    let html = '';

    // Night stats
    html += `<div class="codex-section">`;
    html += `<div class="codex-section-title">Night Stats ${wonBadge}</div>`;
    html += `<div class="codex-row"><span class="rl">Total nights</span><span class="rv">${totalRuns}</span></div>`;
    html += `<div class="codex-row"><span class="rl">Successful entries</span><span class="rv">${totalSuccesses}</span></div>`;
    html += `<div class="codex-row"><span class="rl">Win rate</span><span class="rv">${winRate}%</span></div>`;
    html += `<div class="codex-row"><span class="rl">Current streak</span><span class="rv">${currentStreak}</span></div>`;
    html += `<div class="codex-row"><span class="rl">Best streak</span><span class="rv">${bestStreak}</span></div>`;
    html += `</div>`;

    // Venues
    html += `<div class="codex-section">`;
    html += `<div class="codex-section-title">Venues</div>`;
    for (const v of VENUES) {
      const isCleared = (prog.venuesCleared || []).includes(v.id);
      const threshold = this.VENUE_UNLOCK_THRESHOLDS[v.id];
      const isLocked = v.locked === true && threshold !== undefined && cleared < threshold;
      if (isCleared) {
        html += `<div class="codex-row unlocked"><span class="rl">${escapeHtml(v.name)}</span><span class="rv">✓ Cleared</span></div>`;
      } else if (isLocked) {
        html += `<div class="codex-row locked"><span class="rl">${escapeHtml(v.name)}</span><span class="rv">Clear ${threshold} different venues — ${cleared}/${threshold}</span></div>`;
      } else {
        html += `<div class="codex-row"><span class="rl">${escapeHtml(v.name)}</span><span class="rv">Open</span></div>`;
      }
    }
    html += `</div>`;

    // Contacts
    html += `<div class="codex-section">`;
    html += `<div class="codex-section-title">Contacts</div>`;
    for (const c of CONTACTS) {
      const unlocked = (prog.unlockedContacts || []).includes(c.id);
      if (unlocked) {
        html += `<div class="codex-row unlocked"><span class="rl">${escapeHtml(c.name)}</span><span class="rv">${escapeHtml(c.trait)}</span></div>`;
      } else {
        const condText = this._contactUnlockText(c.unlockCondition);
        html += `<div class="codex-row locked"><span class="rl">???</span><span class="rv">${escapeHtml(condText)}</span></div>`;
      }
    }
    html += `</div>`;

    // Regulars
    html += `<div class="codex-section">`;
    html += `<div class="codex-section-title">Regulars</div>`;
    const regularIds = Object.keys(prog.regulars || {});
    if (regularIds.length === 0) {
      html += `<div class="codex-row locked"><span class="rl">No regulars yet</span><span class="rv">Meet people, remember them</span></div>`;
    } else {
      for (const id of regularIds) {
        const r = prog.regulars[id];
        const venueName = (VENUES.find(v => v.id === r.homeVenueId) || {}).name || '?';
        const times = r.timesMet || 0;
        html += `<div class="codex-row"><span class="rl">${escapeHtml(r.name)} — ${escapeHtml(venueName)}</span><span class="rv">met ${times} time${times === 1 ? '' : 's'}</span></div>`;
      }
    }
    html += `</div>`;

    panel.innerHTML = html;

    // Wire close button (rendered fresh each open)
    const close = document.createElement('button');
    close.className = 'codex-close';
    close.textContent = '×';
    close.onclick = () => this.close();
    panel.insertBefore(close, panel.firstChild);
  },
};
