// ============================================================
// PHASE 1: KIOSK SYSTEM
// ============================================================

const KioskSystem = {
  _closeListenerAttached: false,

  open() {
    const panel = $('kiosk-panel');
    panel.innerHTML = `
      <div class="kiosk-title">Late Night Kiosk</div>
      <div class="kiosk-subtitle">Cash: $${state.cash}${state.queue.beerDebuff ? ' · ⚠️ You smell like beer' : ''}</div>
      ${KIOSK_ITEMS.map(item => `
        <div class="kiosk-item">
          <div class="kiosk-item-left">
            <span class="kiosk-item-icon">${PX.i(item.icon, item.iconColor || '#ebe4ff', 22)}</span>
            <div>
              <div class="kiosk-item-name">${item.name}</div>
              <div class="kiosk-item-desc">${item.desc}</div>
              <div class="kiosk-item-effect ${item.risky ? 'risky' : ''}">${item.effect}${item.risky ? ' · ' + item.riskDesc : ''}</div>
            </div>
          </div>
          <button class="kiosk-buy-btn" data-kiosk="${item.id}" ${state.cash < item.price ? 'disabled' : ''}>$${item.price}</button>
        </div>
      `).join('')}
      <button class="kiosk-close" id="kiosk-close-btn">Back to Queue</button>
    `;

    panel.querySelectorAll('.kiosk-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = KIOSK_ITEMS.find(i => i.id === btn.dataset.kiosk);
        if (!item || state.cash < item.price) return;
        state.cash -= item.price;
        applyConsumable(item.id, { source: 'kiosk' });
        QueueEngine.advanceTime(2);
        this.open(); // Refresh
        QueueEngine.updateMeters();
      });
    });

    if (!this._closeListenerAttached) {
      $('kiosk-panel')?.addEventListener('click', (e) => {
        if (e.target.id === 'kiosk-close-btn') this.close();
      });
      this._closeListenerAttached = true;
    }

    $('kiosk-overlay').classList.add('active');
    state.queue.actionLocked = true;
  },

  close() {
    $('kiosk-overlay').classList.remove('active');
    state.queue.actionLocked = false;
  },
};

