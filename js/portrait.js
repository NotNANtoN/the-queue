// ============================================================
// PORTRAIT GENERATOR (procedural pixel art)
// ============================================================

const Portrait = {
  SKINS: ['#f5d0a9','#e8b88a','#c68642','#8d5524','#6b3e26','#f0c5a0','#dba270','#fce0c5'],
  HAIRS: ['#1a1a2e','#3d2b1f','#8b6914','#c4931a','#e84a5f','#4a90d9','#2d2d2d','#f5f5dc','#d14070','#6b3fa0'],
  SHIRTS: ['#1a1a2e','#2d2d2d','#0d1b2a','#3c1053','#1b4332','#7b2d26','#f0f0f0','#4361ee','#e84a5f','#ff6b35'],
  HAIR_STYLES: ['short','long','curly','bun','mohawk','bald','bob','afro','buzz','ponytail'],
  ACCESSORIES: [null,null,null,'glasses','sunglasses','earring','piercing','headband'],

  _pick(a) { return a[Math.floor(Math.random() * a.length)]; },

  randomProps() {
    return {
      skin: this._pick(this.SKINS),
      hairColor: this._pick(this.HAIRS),
      hairStyle: this._pick(this.HAIR_STYLES),
      shirtColor: this._pick(this.SHIRTS),
      accessory: this._pick(this.ACCESSORIES),
      faceWidth: 6 + Math.floor(Math.random() * 3),
      faceHeight: 7 + Math.floor(Math.random() * 3),
      eyeSpacing: 3 + Math.floor(Math.random() * 2),
      noseSize: Math.random() < 0.5 ? 1 : 2,
      earSize: 1 + Math.floor(Math.random() * 2),
      seed: Math.random(),
    };
  },

  generate(props, disposition, substanceEffects) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const cx = 15, cy = 14;
    const fw = props.faceWidth, fh = props.faceHeight;

    // Shirt / shoulders
    this._ellipse(ctx, cx, 28, 10, 5, props.shirtColor);
    // Neck
    ctx.fillStyle = props.skin;
    ctx.fillRect(cx - 2, cy + fh - 1, 5, 4);
    // Ears
    ctx.fillStyle = props.skin;
    ctx.fillRect(cx - fw - 1, cy - 1, props.earSize, 3);
    ctx.fillRect(cx + fw + 1 - props.earSize + 1, cy - 1, props.earSize, 3);
    // Face
    this._ellipse(ctx, cx, cy, fw, fh, props.skin);
    // Hair
    this._drawHair(ctx, props, cx, cy, fw, fh);
    // Eyes
    this._drawEyes(ctx, props, cx, cy, fw, disposition, substanceEffects);
    // Eyebrows
    this._drawEyebrows(ctx, props, cx, cy, disposition, substanceEffects);
    // Nose
    this._drawNose(ctx, props, cx, cy);
    // Mouth
    this._drawMouth(ctx, props, cx, cy, disposition, substanceEffects);
    // Accessory
    if (props.accessory) this._drawAccessory(ctx, props, cx, cy, fw);

    return c.toDataURL();
  },

  _ellipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
          ctx.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
  },

  _darken(hex, amt) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
    return `rgb(${r},${g},${b})`;
  },

  _drawHair(ctx, props, cx, cy, fw, fh) {
    const hc = props.hairColor;
    const top = cy - fh;
    switch (props.hairStyle) {
      case 'short':
        this._ellipse(ctx, cx, top + 1, fw + 1, 3, hc);
        ctx.fillStyle = hc;
        ctx.fillRect(cx - fw, top, fw * 2 + 1, 3);
        break;
      case 'long':
        this._ellipse(ctx, cx, top + 1, fw + 1, 3, hc);
        ctx.fillStyle = hc;
        ctx.fillRect(cx - fw - 1, top - 1, 3, fh * 2 + 2);
        ctx.fillRect(cx + fw - 1, top - 1, 3, fh * 2 + 2);
        break;
      case 'curly':
        for (let i = -fw - 1; i <= fw + 1; i += 2) {
          const yy = top + (Math.abs(i) % 2);
          ctx.fillStyle = hc;
          ctx.fillRect(cx + i, yy - 1, 2, 3);
        }
        ctx.fillStyle = hc;
        ctx.fillRect(cx - fw - 1, top - 1, fw * 2 + 3, 2);
        break;
      case 'bun':
        this._ellipse(ctx, cx, top + 1, fw, 3, hc);
        this._ellipse(ctx, cx, top - 3, 3, 3, hc);
        break;
      case 'mohawk':
        ctx.fillStyle = hc;
        ctx.fillRect(cx - 1, top - 4, 3, 6);
        ctx.fillRect(cx - 2, top - 3, 5, 4);
        break;
      case 'bald':
        ctx.fillStyle = this._darken(props.skin, 15);
        this._ellipse(ctx, cx, top + 2, fw, 2, this._darken(props.skin, 15));
        break;
      case 'bob':
        this._ellipse(ctx, cx, top + 1, fw + 1, 3, hc);
        ctx.fillStyle = hc;
        ctx.fillRect(cx - fw - 1, top, 2, fh + 3);
        ctx.fillRect(cx + fw, top, 2, fh + 3);
        break;
      case 'afro':
        this._ellipse(ctx, cx, top - 1, fw + 3, fh - 1, hc);
        break;
      case 'buzz':
        ctx.fillStyle = this._darken(hc, 30);
        this._ellipse(ctx, cx, top + 2, fw + 1, 2, this._darken(hc, 30));
        break;
      case 'ponytail':
        this._ellipse(ctx, cx, top + 1, fw + 1, 3, hc);
        ctx.fillStyle = hc;
        ctx.fillRect(cx + fw, top + 2, 4, 2);
        ctx.fillRect(cx + fw + 3, top + 2, 2, 6);
        break;
    }
  },

  _drawEyes(ctx, props, cx, cy, fw, disp, fx) {
    const sp = props.eyeSpacing;
    const lx = cx - sp, rx = cx + sp;
    const ey = cy - 1;
    const isDilated = fx?.includes?.('glitter');
    const isWired = fx?.includes?.('turbo');
    const isIntense = fx?.includes?.('nosecandy');
    const isWasted = fx?.includes?.('dead');

    // White of eyes
    let ew = 3, eh = 2;
    if (disp === 'hostile') eh = 1;
    if (disp === 'anxious' || isWired) { ew = 3; eh = 3; }
    if (disp === 'drunk' || isWasted) eh = 1;

    ctx.fillStyle = '#fff';
    ctx.fillRect(lx - 1, ey, ew, eh);
    ctx.fillRect(rx - 1, ey, ew, eh);

    // Drunk: offset one eye
    const lOff = (disp === 'drunk' || isWasted) ? 1 : 0;

    // Pupil
    let pw = 1, ph = 1;
    if (isDilated) { pw = 2; ph = 2; }
    if (isWired) { pw = 1; ph = 1; }
    ctx.fillStyle = isIntense ? '#222' : '#111';
    ctx.fillRect(lx, ey + lOff, pw, ph);
    ctx.fillRect(rx, ey, pw, ph);

    // Iris color hint
    if (!isDilated && !isWasted) {
      const irisColors = ['#4a6741','#5a3e2b','#3a5f8a','#6b5b3a','#2d4a3a'];
      ctx.fillStyle = props.eyeColor || irisColors[Math.floor(props.seed * irisColors.length)];
      if (eh >= 2) {
        ctx.fillRect(lx - 1, ey + lOff, 1, 1);
        ctx.fillRect(rx + pw, ey, 1, 1);
      }
    }

    // Glitter sparkle effect
    if (isDilated) {
      ctx.fillStyle = '#ff69b4';
      ctx.fillRect(lx + 1, ey - 1, 1, 1);
      ctx.fillRect(rx - 1, ey - 1, 1, 1);
    }
  },

  _drawEyebrows(ctx, props, cx, cy, disp, fx) {
    const sp = props.eyeSpacing;
    const lx = cx - sp, rx = cx + sp;
    const by = cy - 3;
    const isWasted = fx?.includes?.('dead');

    ctx.fillStyle = this._darken(props.hairColor, 20);

    if (disp === 'hostile') {
      // Furrowed (angled inward)
      ctx.fillRect(lx - 1, by + 1, 1, 1);
      ctx.fillRect(lx, by, 2, 1);
      ctx.fillRect(rx, by, 2, 1);
      ctx.fillRect(rx + 1, by + 1, 1, 1);
    } else if (disp === 'anxious') {
      // Raised
      ctx.fillRect(lx - 1, by - 1, 3, 1);
      ctx.fillRect(rx - 1, by - 1, 3, 1);
    } else if (disp === 'drunk' || isWasted) {
      // Relaxed / uneven
      ctx.fillRect(lx - 1, by, 2, 1);
      ctx.fillRect(rx, by + 1, 2, 1);
    } else {
      // Normal
      ctx.fillRect(lx - 1, by, 3, 1);
      ctx.fillRect(rx - 1, by, 3, 1);
    }
  },

  _drawNose(ctx, props, cx, cy) {
    const ny = cy + 2;
    ctx.fillStyle = this._darken(props.skin, 25);
    ctx.fillRect(cx, ny, props.noseSize, 2);
    if (props.noseSize > 1) ctx.fillRect(cx - 1, ny + 1, 3, 1);
  },

  _drawMouth(ctx, props, cx, cy, disp, fx) {
    const my = cy + 5;
    const isDrunk = disp === 'drunk' || fx?.includes?.('dead');
    const isHigh = fx?.includes?.('glitter');

    ctx.fillStyle = '#c44';

    if (disp === 'friendly' || isHigh) {
      // Smile
      ctx.fillRect(cx - 2, my, 5, 1);
      ctx.fillRect(cx - 3, my - 1, 1, 1);
      ctx.fillRect(cx + 3, my - 1, 1, 1);
    } else if (disp === 'hostile') {
      // Frown
      ctx.fillRect(cx - 2, my, 5, 1);
      ctx.fillRect(cx - 3, my + 1, 1, 1);
      ctx.fillRect(cx + 3, my + 1, 1, 1);
    } else if (isDrunk) {
      // Lopsided grin
      ctx.fillRect(cx - 3, my, 6, 1);
      ctx.fillRect(cx - 3, my - 1, 1, 1);
      ctx.fillRect(cx + 3, my, 1, 1);
    } else if (disp === 'anxious') {
      // Slightly open / worried
      ctx.fillStyle = '#511';
      ctx.fillRect(cx - 1, my, 3, 2);
      ctx.fillStyle = '#c44';
      ctx.fillRect(cx - 2, my, 1, 1);
      ctx.fillRect(cx + 2, my, 1, 1);
    } else {
      // Neutral
      ctx.fillRect(cx - 2, my, 4, 1);
    }

    // Jaw tension from nose candy
    if (fx?.includes?.('nosecandy')) {
      ctx.fillStyle = this._darken(props.skin, 20);
      ctx.fillRect(cx - 3, my + 1, 1, 2);
      ctx.fillRect(cx + 3, my + 1, 1, 2);
    }
  },

  _drawAccessory(ctx, props, cx, cy, fw) {
    const sp = props.eyeSpacing;
    const lx = cx - sp, rx = cx + sp;
    const ey = cy - 1;

    switch (props.accessory) {
      case 'glasses':
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx - 2, ey - 1, 5, 4);
        ctx.strokeRect(rx - 2, ey - 1, 5, 4);
        ctx.fillStyle = '#555';
        ctx.fillRect(lx + 2, ey, rx - lx - 4, 1);
        break;
      case 'sunglasses':
        ctx.fillStyle = '#111';
        ctx.fillRect(lx - 2, ey - 1, 5, 3);
        ctx.fillRect(rx - 2, ey - 1, 5, 3);
        ctx.fillRect(lx + 2, ey, rx - lx - 4, 1);
        // Reflection
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(lx - 1, ey - 1, 1, 1);
        ctx.fillRect(rx - 1, ey - 1, 1, 1);
        break;
      case 'earring':
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - fw - 1, cy + 2, 1, 2);
        break;
      case 'piercing':
        ctx.fillStyle = '#ccc';
        ctx.fillRect(cx, cy + 4, 1, 1);
        break;
      case 'headband':
        ctx.fillStyle = props.seed > 0.5 ? '#e84a5f' : '#4a90d9';
        ctx.fillRect(cx - fw, cy - props.faceHeight + 2, fw * 2 + 1, 2);
        break;
    }
  },
};

