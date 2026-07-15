// ============================================================
// PHASE 1: CANVAS RENDERER
// ============================================================

const QueueCanvas = {
  canvas: null,
  ctx: null,
  W: 0, H: 0,
  dpr: 1,
  scrollX: 0,
  targetScrollX: 0,
  time: 0,

  GROUND_Y_RATIO: 0.78,
  PERSON_SPACING: 42,
  PERSON_SCALE: 1,
  theme: null,

  THEMES: {
    mainframe:   { sky: ['#05041a','#0a0824','#0d0b22'], wall: '#0e0c28', wallTex: 'rgba(255,255,255,0.015)', ground: '#14122a', curb: '#1c1940', neon1: '#7b75ff', neon2: '#ff4d6d', spill: 'rgba(123,117,255,0.08)', lamp: 'rgba(255,216,107,0.08)', outdoor: false },
    compliance:  { sky: ['#020108','#080614','#0a0918'], wall: '#0a0916', wallTex: 'rgba(255,255,255,0.01)', ground: '#0c0a1a', curb: '#161430', neon1: '#ff4444', neon2: '#440000', spill: 'rgba(255,60,60,0.06)', lamp: 'rgba(255,100,100,0.04)', outdoor: false },
    neon:        { sky: ['#0a0418','#120828','#0d0b22'], wall: '#0f0824', wallTex: 'rgba(255,100,200,0.02)', ground: '#14102a', curb: '#201840', neon1: '#ff69b4', neon2: '#39ff14', spill: 'rgba(255,105,180,0.1)', lamp: 'rgba(57,255,20,0.06)', outdoor: false },
    boardroom:   { sky: ['#02020a','#0a0a1a','#0d0d20'], wall: '#101020', wallTex: 'rgba(255,255,255,0.02)', ground: '#151525', curb: '#202035', neon1: '#ffd86b', neon2: '#ffffff', spill: 'rgba(255,216,107,0.08)', lamp: 'rgba(255,216,107,0.06)', outdoor: false },
    florians:    { sky: ['#03020e','#06051a','#080720'], wall: '#08061a', wallTex: 'rgba(123,117,255,0.01)', ground: '#0e0c22', curb: '#161435', neon1: '#7b75ff', neon2: '#3a3580', spill: 'rgba(123,117,255,0.05)', lamp: 'rgba(123,117,255,0.04)', outdoor: false },
    audit:       { sky: ['#020102','#080408','#0a0610'], wall: '#0a0808', wallTex: 'rgba(255,0,0,0.01)', ground: '#121010', curb: '#1a1418', neon1: '#ff0000', neon2: '#880000', spill: 'rgba(255,0,0,0.06)', lamp: 'rgba(255,50,50,0.04)', outdoor: false },
    sisyphos:    { sky: ['#081a30','#122848','#0a2040'], wall: null, wallTex: null, ground: '#1a2a14', curb: '#2a4020', neon1: '#39ff14', neon2: '#ff69b4', spill: 'rgba(57,255,20,0.2)', lamp: 'rgba(255,200,100,0.15)', outdoor: true, trees: true, fairyLights: true },
    sudpol:      { sky: ['#04061a','#0c1028','#0a0e22'], wall: '#101828', wallTex: 'rgba(255,255,255,0.01)', ground: '#121a28', curb: '#1a2238', neon1: '#57f2ff', neon2: '#7b75ff', spill: 'rgba(87,242,255,0.08)', lamp: 'rgba(87,242,255,0.05)', outdoor: false },
  },

  SKIN_TONES: ['#f5d0a9', '#e8b88a', '#c68642', '#8d5524', '#6b3e26', '#f0c5a0', '#dba270'],
  HAIR_COLORS: ['#1a1a2e', '#3d2b1f', '#8b6914', '#c4931a', '#e84a5f', '#4a90d9', '#2d2d2d', '#f5f5dc', '#d14070'],
  SHIRT_COLORS: ['#1a1a2e', '#2d2d2d', '#0d1b2a', '#3c1053', '#1b4332', '#7b2d26', '#f0f0f0', '#4361ee', '#e84a5f', '#ff6b35', '#2d6a4f'],

  init() {
    this.canvas = $('queue-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    if (!this._resizeBound) {
      window.addEventListener('resize', () => this.resize());
      this._resizeBound = true;
    }
  },

  resize() {
    const wrap = this.canvas.parentElement;
    this.W = wrap.clientWidth;
    this.H = wrap.clientHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.PERSON_SCALE = Math.max(0.7, Math.min(1.2, this.H / 350));
  },

  _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  generatePeople(totalCount, playerPos, squad) {
    const people = [];
    const squadCount = squad.length;
    const allNeighbors = state.queue.allNeighbors || [];
    const behindNeighbors = state.queue.behindNeighbors || [];

    for (let i = 0; i < totalCount; i++) {
      const isPlayer = i === playerPos;
      const squadIdx = i - playerPos - 1;
      const isSquad = !isPlayer && squadIdx >= 0 && squadIdx < squadCount;
      const isBehind = i > playerPos + squadCount;
      const behindIdx = i - playerPos - squadCount - 1;

      // Use persistent neighbor data for appearance
      let skin, hair, shirt, accent, hasHat, hasPhone, hasBag, personName;
      const neighbor = isPlayer || isSquad ? null : (isBehind ? behindNeighbors[behindIdx] : allNeighbors[i]);

      if (isPlayer) {
        skin = PLAYER_OPTIONS.skin[state.playerLook.skin];
        hair = PLAYER_OPTIONS.hair[state.playerLook.hair];
        shirt = PLAYER_OPTIONS.shirt[state.playerLook.shirt];
        accent = '#fff';
        hasHat = false; hasPhone = false; hasBag = false; personName = 'You';
        // Apply equipped wardrobe visuals
        const prog = SaveSystem.load();
        for (const wId of (prog.equippedOutfits || [])) {
          const w = WARDROBE.find(i => i.id === wId);
          if (w?.shirtOverride) shirt = w.shirtOverride;
          if (w?.accentOverride) accent = w.accentOverride;
        }
      } else if (isSquad) {
        const sc = squad[squadIdx];
        const contact = CONTACTS.find(c => c.name === sc?.name);
        skin = contact?.portraitProps?.skin || this._pick(this.SKIN_TONES);
        hair = contact?.portraitProps?.hairColor || this._pick(this.HAIR_COLORS);
        shirt = sc?.color || '#39ff14';
        accent = sc?.color || '#39ff14';
        hasHat = false; hasPhone = false; hasBag = false;
        personName = sc?.name || '?';
      } else if (neighbor?.portraitProps) {
        skin = neighbor.portraitProps.skin;
        hair = neighbor.portraitProps.hairColor;
        shirt = neighbor.portraitProps.shirtColor || this._pick(this.SHIRT_COLORS);
        accent = null;
        hasHat = neighbor.portraitProps.accessory === 'headband';
        hasPhone = neighbor.portraitProps.seed > 0.6;
        hasBag = neighbor.portraitProps.seed < 0.15;
        personName = '';
      } else {
        skin = this._pick(this.SKIN_TONES);
        hair = this._pick(this.HAIR_COLORS);
        shirt = this._pick(this.SHIRT_COLORS);
        accent = null;
        hasHat = Math.random() < 0.15;
        hasPhone = Math.random() < 0.2;
        hasBag = Math.random() < 0.1;
        personName = '';
      }

      people.push({
        baseX: 0, targetX: 0,
        height: neighbor?.portraitProps ? 36 + neighbor.portraitProps.faceHeight * 2 : 36 + Math.random() * 16,
        skin, hair, shirt, accent,
        isPlayer, isSquad,
        squadMember: isSquad ? squad[squadIdx] : null,
        name: personName,
        bobOffset: neighbor?.portraitProps?.seed * Math.PI * 2 || Math.random() * Math.PI * 2,
        bobSpeed: 0.3 + (neighbor?.portraitProps?.seed || Math.random()) * 0.25,
        swayAmp: 0.8 + (neighbor?.portraitProps?.seed || Math.random()) * 1.2,
        hasHat, hasPhone, hasBag,
        pantColor: (neighbor?.portraitProps?.seed || Math.random()) < 0.5 ? '#1a1a2e' : '#2d2d2d',
      });
    }
    state.queue.queuePeople = people;
    this.layoutPeople(true);
  },

  layoutPeople(instant = false) {
    const people = state.queue.queuePeople;
    const sp = this.PERSON_SPACING;
    const startX = 120;
    for (let i = 0; i < people.length; i++) {
      const newX = startX + i * sp;
      if (instant || people[i].baseX === 0) {
        people[i].baseX = newX;
        people[i].targetX = newX;
      } else {
        people[i].targetX = newX;
      }
    }
    const playerIdx = people.findIndex(p => p.isPlayer);
    if (playerIdx >= 0) {
      const px = people[playerIdx].targetX || people[playerIdx].baseX;
      this.targetScrollX = px - this.W * 0.55;
    }
  },

  drawPerson(ctx, p, x, groundY, t) {
    const sc = this.PERSON_SCALE;
    const h = p.height * sc;
    const sway = Math.sin(t * p.bobSpeed + p.bobOffset) * p.swayAmp;
    const bob = Math.sin(t * p.bobSpeed * 0.7 + p.bobOffset + 1) * 0.8;

    const feetY = groundY;
    const headR = 5.5 * sc;
    const bodyW = 10 * sc;
    const legLen = h * 0.38;
    const torsoLen = h * 0.35;
    const neckY = feetY - legLen - torsoLen + bob;
    const headY = neckY - headR - 1 * sc;

    ctx.save();
    ctx.translate(x + sway, 0);

    // Glow for player/squad
    if (p.isPlayer || p.isSquad) {
      const glowColor = p.isPlayer ? 'rgba(123,117,255,0.15)' : (p.accent ? p.accent.replace(')', ',0.12)').replace('rgb', 'rgba') : 'rgba(57,255,20,0.12)');
      const glow = ctx.createRadialGradient(0, feetY - h * 0.5, 5, 0, feetY - h * 0.5, h * 0.7);
      glow.addColorStop(0, p.isPlayer ? 'rgba(123,117,255,0.18)' : 'rgba(57,255,20,0.12)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(-h * 0.7, feetY - h - 10, h * 1.4, h + 20);
    }

    // Legs
    ctx.strokeStyle = p.pantColor;
    ctx.lineWidth = 3.5 * sc;
    ctx.lineCap = 'round';
    const legSpread = 3 * sc;
    ctx.beginPath();
    ctx.moveTo(-legSpread, feetY);
    ctx.lineTo(-1 * sc, feetY - legLen + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(legSpread, feetY);
    ctx.lineTo(1 * sc, feetY - legLen + bob);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#111';
    ctx.fillRect(-legSpread - 2 * sc, feetY - 1.5 * sc, 5 * sc, 2.5 * sc);
    ctx.fillRect(legSpread - 2 * sc, feetY - 1.5 * sc, 5 * sc, 2.5 * sc);

    // Torso
    const torsoTop = feetY - legLen - torsoLen + bob;
    const torsoBot = feetY - legLen + bob;
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.55, torsoBot);
    ctx.lineTo(-bodyW * 0.5, torsoTop + 2 * sc);
    ctx.quadraticCurveTo(0, torsoTop - 1 * sc, bodyW * 0.5, torsoTop + 2 * sc);
    ctx.lineTo(bodyW * 0.55, torsoBot);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.strokeStyle = p.shirt;
    ctx.lineWidth = 3 * sc;
    const armSway = Math.sin(t * p.bobSpeed * 0.5 + p.bobOffset + 2) * 2;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.5, torsoTop + 5 * sc);
    ctx.lineTo(-bodyW * 0.7, torsoBot - 2 * sc + armSway);
    ctx.stroke();
    // Right arm
    if (p.hasPhone) {
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.5, torsoTop + 5 * sc);
      ctx.lineTo(bodyW * 0.55, torsoTop + 12 * sc);
      ctx.stroke();
      // Phone
      ctx.fillStyle = '#333';
      ctx.fillRect(bodyW * 0.4, torsoTop + 10 * sc, 4 * sc, 6 * sc);
      ctx.fillStyle = 'rgba(87,242,255,0.5)';
      ctx.fillRect(bodyW * 0.4 + 0.5 * sc, torsoTop + 10.5 * sc, 3 * sc, 5 * sc);
    } else {
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.5, torsoTop + 5 * sc);
      ctx.lineTo(bodyW * 0.7, torsoBot - 2 * sc - armSway);
      ctx.stroke();
    }

    // Skin for hands
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(-bodyW * 0.7, torsoBot - 2 * sc + armSway, 2 * sc, 0, Math.PI * 2);
    ctx.fill();
    if (!p.hasPhone) {
      ctx.beginPath();
      ctx.arc(bodyW * 0.7, torsoBot - 2 * sc - armSway, 2 * sc, 0, Math.PI * 2);
      ctx.fill();
    }

    // Neck
    ctx.fillStyle = p.skin;
    ctx.fillRect(-2 * sc, neckY + bob, 4 * sc, headR * 0.5);

    // Head
    ctx.beginPath();
    ctx.arc(0, headY + bob, headR, 0, Math.PI * 2);
    ctx.fillStyle = p.skin;
    ctx.fill();

    // Hair
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(0, headY + bob - headR * 0.15, headR * 1.05, Math.PI, Math.PI * 2);
    ctx.fill();
    // Side hair
    ctx.fillRect(-headR * 1.05, headY + bob - headR * 0.3, headR * 0.25, headR * 0.7);

    // Hat
    if (p.hasHat) {
      ctx.fillStyle = p.hair;
      ctx.fillRect(-headR * 1.3, headY + bob - headR - 1, headR * 2.6, 3 * sc);
      ctx.fillRect(-headR * 0.9, headY + bob - headR - 4 * sc, headR * 1.8, 4 * sc);
    }

    // Bag
    if (p.hasBag) {
      ctx.fillStyle = '#444';
      ctx.fillRect(-bodyW * 0.8, torsoTop + 6 * sc, 4 * sc, 8 * sc);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.6, torsoTop + 6 * sc);
      ctx.lineTo(-bodyW * 0.6, torsoTop + 2 * sc);
      ctx.stroke();
    }

    // Player/Squad indicator ring under feet
    if (p.isPlayer || p.isSquad) {
      ctx.strokeStyle = p.isPlayer ? '#7b75ff' : (p.accent || '#39ff14');
      ctx.lineWidth = 2;
      ctx.shadowColor = p.isPlayer ? '#7b75ff' : (p.accent || '#39ff14');
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, feetY + 2, 10 * sc, 3 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Name label for player & squad
    if (p.name) {
      ctx.fillStyle = p.isPlayer ? '#fff' : (p.accent || '#ebe4ff');
      ctx.font = `${p.isPlayer ? '700' : '600'} ${9 * sc}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(p.name, 0, feetY + 14 * sc);
    }

    ctx.restore();
  },

  draw() {
    this.time += 0.016;
    this.scrollX += (this.targetScrollX - this.scrollX) * 0.06;
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const groundY = H * this.GROUND_Y_RATIO;
    const T = this.theme || this.THEMES.mainframe;
    const _hex = (c) => { if (!c) return [0,0,0]; const h = c.length === 4 ? '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3] : c; return [parseInt(h.slice(1,3),16)||0, parseInt(h.slice(3,5),16)||0, parseInt(h.slice(5,7),16)||0]; };

    // Animate people walking toward their target positions
    const people = state.queue.queuePeople;
    for (const p of people) {
      if (p.targetX !== undefined && p.targetX !== p.baseX) {
        p.baseX += (p.targetX - p.baseX) * 0.04;
        if (Math.abs(p.targetX - p.baseX) < 0.5) p.baseX = p.targetX;
      }
    }

    // Sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, T.sky[0]);
    bgGrad.addColorStop(0.5, T.sky[1]);
    bgGrad.addColorStop(1, T.sky[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137.5) % W;
      const sy = (i * 73.1) % (H * 0.3);
      ctx.globalAlpha = 0.15 + Math.abs(Math.sin(this.time * 0.5 + i)) * 0.2;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(-this.scrollX, 0);

    const wallTop = H * 0.15;

    if (T.outdoor) {
      // Outdoor venue: lush background with grass, trees, art, fairy lights
      // Sky is slightly brighter (not pitch black)
      ctx.fillStyle = '#0c1a0a';
      ctx.fillRect(-500, wallTop, 5000, groundY - wallTop);

      // Grass texture
      ctx.fillStyle = '#142a10';
      for (let gx = -500; gx < 3000; gx += 3) {
        const gh = 4 + Math.sin(gx * 0.3) * 3;
        ctx.fillRect(gx, groundY - gh, 2, gh);
      }

      // Trees (bigger, more detailed)
      if (T.trees) {
        for (let tx = -20; tx < 3000; tx += 140 + Math.sin(tx * 0.1) * 50) {
          // Trunk
          ctx.fillStyle = '#2a1a0a';
          ctx.fillRect(tx - 4, wallTop - 10, 8, groundY - wallTop + 10);

          // Canopy layers (lush)
          const treeSway = Math.sin(this.time * 0.3 + tx * 0.01) * 3;
          for (let j = 0; j < 4; j++) {
            const ly = wallTop - 25 + j * 14;
            const lw = 28 - j * 5;
            ctx.fillStyle = j % 2 === 0 ? '#1a4a16' : '#225a1e';
            ctx.beginPath();
            ctx.arc(tx + treeSway, ly, lw, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Fairy lights (string lights between trees, brighter)
      if (T.fairyLights) {
        // String wire
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let fx = -500; fx < 3000; fx += 5) {
          const fy = wallTop + 20 + Math.sin(fx * 0.02) * 12;
          if (fx === -500) ctx.moveTo(fx, fy);
          else ctx.lineTo(fx, fy);
        }
        ctx.stroke();

        // Bulbs
        const bulbColors = ['#ff69b4','#39ff14','#ffd86b','#57f2ff','#ff6b35','#7b75ff','#fff'];
        for (let fx = 0; fx < 3000; fx += 18) {
          const fy = wallTop + 20 + Math.sin(fx * 0.02) * 12;
          const col = bulbColors[Math.floor(fx / 18) % bulbColors.length];
          const bright = 0.5 + Math.sin(this.time * 2.5 + fx * 0.15) * 0.4;
          // Glow
          ctx.fillStyle = col;
          ctx.globalAlpha = bright * 0.15;
          ctx.beginPath();
          ctx.arc(fx, fy, 8, 0, Math.PI * 2);
          ctx.fill();
          // Bulb
          ctx.globalAlpha = bright;
          ctx.beginPath();
          ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Firefly particles
      for (let i = 0; i < 8; i++) {
        const fx = ((this.time * 20 + i * 400) % 3000);
        const fy = wallTop + 30 + Math.sin(this.time * 0.8 + i * 3) * 30;
        ctx.fillStyle = '#39ff14';
        ctx.globalAlpha = 0.3 + Math.sin(this.time * 4 + i * 2) * 0.3;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ground: dirt/gravel path
      ctx.fillStyle = '#1a1a0e';
      ctx.fillRect(-500, groundY, 5000, H - groundY + 100);
      // Path texture
      ctx.fillStyle = '#242014';
      for (let gx = -500; gx < 3000; gx += 8) {
        if (Math.sin(gx * 0.7) > 0.3) ctx.fillRect(gx, groundY + 2, 4, 2);
      }
      ctx.fillStyle = '#2a2518';
      ctx.fillRect(-500, groundY, 5000, 2);
    } else {
      // Indoor venue: wall + sidewalk + venue-specific details
      ctx.fillStyle = T.wall;
      ctx.fillRect(-500, wallTop, 5000, groundY - wallTop);
      if (T.wallTex) {
        ctx.strokeStyle = T.wallTex;
        ctx.lineWidth = 0.5;
        for (let by = wallTop; by < groundY; by += 12) {
          const offset = (Math.floor(by / 12) % 2) * 15;
          for (let bx = -500 + offset; bx < 5000; bx += 30) {
            ctx.strokeRect(bx, by, 28, 11);
          }
        }
      }

      // Venue-specific wall decorations
      const venueId = state.selectedVenue;
      if (venueId === 'neon') {
        // Neon Pharmacy: graffiti-style colored patches on walls
        const grafColors = ['rgba(255,105,180,0.06)','rgba(57,255,20,0.05)','rgba(87,242,255,0.04)','rgba(253,153,39,0.05)'];
        for (let gx = 200; gx < 3000; gx += 150 + Math.sin(gx) * 50) {
          const gy = wallTop + 20 + Math.sin(gx * 0.3) * 20;
          ctx.fillStyle = grafColors[Math.floor(gx / 150) % grafColors.length];
          ctx.fillRect(gx, gy, 30 + Math.sin(gx) * 15, 20 + Math.cos(gx) * 10);
        }
      } else if (venueId === 'compliance') {
        // Compliance Vault: industrial pipes on wall
        ctx.strokeStyle = 'rgba(255,50,50,0.04)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-500, wallTop + 30);
        ctx.lineTo(3000, wallTop + 30);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-500, wallTop + 60);
        ctx.lineTo(3000, wallTop + 60);
        ctx.stroke();
      } else if (venueId === 'boardroom') {
        // Boardroom: faint gold trim lines
        ctx.strokeStyle = 'rgba(255,216,107,0.03)';
        ctx.lineWidth = 1;
        for (let gy = wallTop + 20; gy < groundY; gy += 40) {
          ctx.beginPath();
          ctx.moveTo(-500, gy);
          ctx.lineTo(3000, gy);
          ctx.stroke();
        }
      } else if (venueId === 'audit') {
        // Audit Chamber: warning stripes
        ctx.fillStyle = 'rgba(255,0,0,0.03)';
        for (let sx = -500; sx < 3000; sx += 60) {
          ctx.save();
          ctx.translate(sx, groundY - 5);
          ctx.rotate(-0.3);
          ctx.fillRect(0, 0, 20, 8);
          ctx.restore();
        }
      }

      ctx.fillStyle = T.ground;
      ctx.fillRect(-500, groundY, 5000, H - groundY + 100);
      ctx.fillStyle = T.curb;
      ctx.fillRect(-500, groundY, 5000, 3);
      ctx.fillRect(-500, groundY + 28, 5000, 2);
      ctx.fillStyle = '#0a0918';
      ctx.fillRect(-500, groundY + 30, 5000, 200);

      // Puddles for some venues (adds atmosphere)
      if (venueId === 'compliance' || venueId === 'florians') {
        for (let px = 200; px < 3000; px += 300 + Math.sin(px) * 100) {
          const [pr,pg,pb] = _hex(T.neon1);
          ctx.fillStyle = `rgba(${pr},${pg},${pb},0.03)`;
          ctx.beginPath();
          ctx.ellipse(px, groundY + 15, 25, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Club entrance
    const doorX = 60, doorW = 50;
    const doorTop = wallTop + 5;

    if (!T.outdoor) {
      ctx.fillStyle = T.wall === '#0a0916' ? '#060410' : '#0a0820';
      ctx.fillRect(doorX - 30, wallTop, doorW + 60, groundY - wallTop);
    }

    // Neon arch
    const neonPulse = 0.7 + Math.sin(this.time * 2.5) * 0.3;
    ctx.shadowColor = T.neon1;
    ctx.shadowBlur = 25 * neonPulse;
    const [n1r,n1g,n1b] = _hex(T.neon1);
    ctx.strokeStyle = `rgba(${n1r},${n1g},${n1b},${0.7 * neonPulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(doorX - 5, groundY);
    ctx.lineTo(doorX - 5, doorTop + 15);
    ctx.quadraticCurveTo(doorX + doorW / 2, doorTop - 5, doorX + doorW + 5, doorTop + 15);
    ctx.lineTo(doorX + doorW + 5, groundY);
    ctx.stroke();

    ctx.shadowColor = T.neon2;
    ctx.shadowBlur = 15 * neonPulse;
    const [n2r,n2g,n2b] = _hex(T.neon2);
    ctx.strokeStyle = `rgba(${n2r},${n2g},${n2b},${0.4 * neonPulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(doorX - 8, groundY);
    ctx.lineTo(doorX - 8, doorTop + 18);
    ctx.quadraticCurveTo(doorX + doorW / 2, doorTop - 2, doorX + doorW + 8, doorTop + 18);
    ctx.lineTo(doorX + doorW + 8, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Door glow
    const doorGlow = ctx.createLinearGradient(doorX, doorTop + 20, doorX, groundY);
    doorGlow.addColorStop(0, `rgba(${n1r},${n1g},${n1b},0.12)`);
    doorGlow.addColorStop(0.5, `rgba(${n2r},${n2g},${n2b},0.06)`);
    doorGlow.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = doorGlow;
    ctx.fillRect(doorX, doorTop + 20, doorW, groundY - doorTop - 20);

    // Club name
    ctx.fillStyle = `rgba(${n1r},${n1g},${n1b},${0.6 + neonPulse * 0.3})`;
    ctx.shadowColor = T.neon1;
    ctx.shadowBlur = 10;
    ctx.font = `800 ${8}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(VENUES.find(v => v.id === state.selectedVenue)?.name?.toUpperCase() || 'CLUB', doorX + doorW / 2, doorTop + 10);
    ctx.shadowBlur = 0;

    // Light spill
    const spillGlow = ctx.createRadialGradient(doorX + doorW / 2, groundY, 5, doorX + doorW / 2, groundY, 80);
    spillGlow.addColorStop(0, T.spill);
    spillGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = spillGlow;
    ctx.fillRect(doorX - 60, groundY - 10, doorW + 120, 50);

    // Bouncer
    this._drawBouncer(ctx, doorX + doorW + 20, groundY);

    // Rope barrier
    const ropeStartX = doorX + doorW + 40;
    ctx.setLineDash([]);
    for (let sx = ropeStartX; sx < ropeStartX + 60; sx += 55) {
      ctx.fillStyle = '#444';
      ctx.fillRect(sx - 1.5, groundY - 30, 3, 30);
      ctx.fillStyle = '#ffd86b';
      ctx.beginPath();
      ctx.arc(sx, groundY - 30, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,216,107,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ropeStartX, groundY - 22);
    ctx.quadraticCurveTo(ropeStartX + 27, groundY - 18 + Math.sin(this.time), ropeStartX + 55, groundY - 22);
    ctx.stroke();

    // Street lamps / environment lights
    for (let lx = ropeStartX + 80; lx < 3000; lx += 280) {
      if (T.outdoor) {
        // Outdoor: shorter poles, warm glow
        ctx.fillStyle = '#2a2518';
        ctx.fillRect(lx - 1, groundY - 40, 2, 40);
        const lampGlow = ctx.createRadialGradient(lx, groundY - 42, 2, lx, groundY - 20, 35);
        lampGlow.addColorStop(0, T.lamp);
        lampGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = lampGlow;
        ctx.fillRect(lx - 35, groundY - 60, 70, 50);
      } else {
        ctx.fillStyle = '#1c1940';
        ctx.fillRect(lx - 1.5, wallTop + 20, 3, groundY - wallTop - 20);
        ctx.fillStyle = '#2a2650';
        ctx.fillRect(lx - 6, wallTop + 18, 12, 6);
        const lampGlow = ctx.createRadialGradient(lx, wallTop + 24, 3, lx, groundY - 30, 60);
        lampGlow.addColorStop(0, T.lamp);
        lampGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = lampGlow;
        ctx.beginPath();
        ctx.moveTo(lx - 5, wallTop + 24);
        ctx.lineTo(lx - 45, groundY);
        ctx.lineTo(lx + 45, groundY);
        ctx.lineTo(lx + 5, wallTop + 24);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw people (back to front, so closer = drawn last)
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      this.drawPerson(ctx, p, p.baseX, groundY, this.time);
    }

    // Talkable indicators (person in front and behind player)
    const playerIdx = people.findIndex(pp => pp.isPlayer);
    const squadLen = state.finalSquad?.length || 0;
    const frontIdx = playerIdx - 1;
    const backIdx = playerIdx + 1 + squadLen;

    [frontIdx, backIdx].forEach(idx => {
      if (idx >= 0 && idx < people.length) {
        const p = people[idx];
        const sway = Math.sin(this.time * p.bobSpeed + p.bobOffset) * p.swayAmp;
        const cx = p.baseX + sway;
        const cy = groundY - p.height * this.PERSON_SCALE * 0.5;
        ctx.strokeStyle = 'rgba(255,216,107,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, p.height * this.PERSON_SCALE * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Portrait + "Talk?" label above talkable neighbors
        const neighbor = idx === frontIdx ? state.queue.neighborFront : state.queue.neighborBack;
        if (neighbor?.portrait && !this._portraitCache) this._portraitCache = {};
        if (neighbor?.portrait) {
          const cacheKey = neighbor.name + '_' + idx;
          if (!this._portraitCache[cacheKey]) {
            const img = new Image();
            img.src = neighbor.portrait;
            this._portraitCache[cacheKey] = img;
          }
          const img = this._portraitCache[cacheKey];
          if (img.complete) {
            const ps = 20;
            const px = cx - ps / 2;
            const py = cy - p.height * this.PERSON_SCALE * 0.55 - ps - 8;
            // Border
            ctx.fillStyle = 'rgba(255,216,107,0.3)';
            ctx.fillRect(px - 2, py - 2, ps + 4, ps + 4);
            ctx.drawImage(img, px, py, ps, ps);
          }
        }
        ctx.fillStyle = 'rgba(255,216,107,0.6)';
        ctx.font = `700 ${8}px ${getComputedStyle(document.body).fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(idx === frontIdx ? '💬 Talk' : '🗣️ Talk', cx, cy - p.height * this.PERSON_SCALE * 0.55 - 4);
      }
    });

    ctx.restore();
  },

  _drawBouncer(ctx, x, groundY) {
    const sc = this.PERSON_SCALE;
    const h = 58 * sc;
    const feetY = groundY;
    const headR = 7 * sc;
    const bodyW = 16 * sc;
    const legLen = h * 0.35;
    const torsoLen = h * 0.38;
    const neckY = feetY - legLen - torsoLen;
    const headY = neckY - headR;

    // Legs
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 5 * sc, feetY - legLen, 4.5 * sc, legLen);
    ctx.fillRect(x + 1 * sc, feetY - legLen, 4.5 * sc, legLen);

    // Torso (broad)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, feetY - legLen);
    ctx.lineTo(x - bodyW * 0.55, neckY + 3 * sc);
    ctx.quadraticCurveTo(x, neckY, x + bodyW * 0.55, neckY + 3 * sc);
    ctx.lineTo(x + bodyW * 0.6, feetY - legLen);
    ctx.closePath();
    ctx.fill();

    // Arms (crossed)
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 5 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, neckY + 8 * sc);
    ctx.lineTo(x + 3 * sc, neckY + 16 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.55, neckY + 8 * sc);
    ctx.lineTo(x - 3 * sc, neckY + 16 * sc);
    ctx.stroke();

    // Skin for hands (crossed position)
    ctx.fillStyle = '#8d5524';
    ctx.beginPath();
    ctx.arc(x + 3 * sc, neckY + 16 * sc, 2.5 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 3 * sc, neckY + 16 * sc, 2.5 * sc, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(x - 3 * sc, neckY, 6 * sc, headR * 0.6);

    // Head
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = '#8d5524';
    ctx.fill();

    // Sunglasses
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 6 * sc, headY - 2 * sc, 5 * sc, 3 * sc);
    ctx.fillRect(x + 1 * sc, headY - 2 * sc, 5 * sc, 3 * sc);
    ctx.fillRect(x - 1 * sc, headY - 1 * sc, 2 * sc, 1.5 * sc);

    // Earpiece
    ctx.fillStyle = '#333';
    ctx.fillRect(x + headR * 0.7, headY - headR * 0.3, 2 * sc, headR);
  },

  startLoop() {
    const loop = () => {
      if (state.phase !== 'QUEUE') return;
      this.draw();
      state.queue.animFrame = requestAnimationFrame(loop);
    };
    loop();
  },

  stopLoop() {
    if (state.queue.animFrame) {
      cancelAnimationFrame(state.queue.animFrame);
      state.queue.animFrame = null;
    }
  },
};

