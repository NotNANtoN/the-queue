// ============================================================
// PARTICLE SYSTEM (visual polish)
// ============================================================

const Particles = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'particle-container';
    document.body.appendChild(this.container);
  },

  burst(count = 40, colors = ['#39ff14', '#57f2ff', '#7b75ff', '#ff4d6d', '#ffd86b']) {
    this.init();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      const size = 4 + Math.random() * 8;
      const x = 20 + Math.random() * 60;
      const dur = 1.5 + Math.random() * 2;
      const delay = Math.random() * 0.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      el.style.cssText = `width:${size}px;height:${size}px;background:${color};left:${x}%;bottom:-10px;animation-duration:${dur}s;animation-delay:${delay}s;box-shadow:0 0 ${size * 2}px ${color};`;
      this.container.appendChild(el);
      setTimeout(() => el.remove(), (dur + delay) * 1000 + 100);
    }
  },

  confetti(count = 60) {
    this.init();
    const colors = ['#39ff14', '#57f2ff', '#7b75ff', '#ff4d6d', '#ffd86b', '#fd9927', '#a4ff80'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const w = 3 + Math.random() * 6;
      const h = 6 + Math.random() * 10;
      const x = Math.random() * 100;
      const dur = 2 + Math.random() * 3;
      const delay = Math.random() * 0.8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rot = Math.random() * 360;
      el.style.cssText = `position:absolute;width:${w}px;height:${h}px;background:${color};left:${x}%;top:-20px;border-radius:2px;transform:rotate(${rot}deg);animation:confettiFall ${dur}s ${delay}s ease-in forwards;opacity:0.9;`;
      this.container.appendChild(el);
      setTimeout(() => el.remove(), (dur + delay) * 1000 + 100);
    }
  },
};

// ============================================================
// AUDIO ENGINE
// ============================================================

const ClubAudio = {
  ctx: null,
  masterGain: null,
  lpFilter: null,
  musicGain: null,
  isPlaying: false,
  nextNoteTime: 0,
  stepIndex: 0,
  musicInterval: null,
  bpm: 126,
  muted: false,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;

      this.lpFilter = this.ctx.createBiquadFilter();
      this.lpFilter.type = 'lowpass';
      this.lpFilter.frequency.value = 280;
      this.lpFilter.Q.value = 2.5;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);

      const reverbGain = this.ctx.createGain();
      reverbGain.gain.value = 0.25;
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this._buildImpulse(1.8, 3.0);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;

      // Signal chain: musicGain → lpFilter → compressor → masterGain → destination
      this.musicGain.connect(this.lpFilter);
      this.lpFilter.connect(this.compressor);

      // Reverb send
      this.musicGain.connect(reverbGain);
      reverbGain.connect(this.reverb);
      this.reverb.connect(this.lpFilter);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.startLoop();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  },

  _buildImpulse(decay, duration) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buffer = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buffer;
  },

  startLoop() {
    if (!this.ctx || this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.stepIndex = 0;

    const lookahead = 0.15;
    const scheduleInterval = 50;

    const scheduler = () => {
      if (!this.isPlaying) return;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        this._scheduleStep(this.stepIndex, this.nextNoteTime);
        const secPerStep = 60.0 / this.bpm / 4.0;
        this.nextNoteTime += secPerStep;
        this.stepIndex = (this.stepIndex + 1) % 64;
      }
      this.musicInterval = setTimeout(scheduler, scheduleInterval);
    };
    scheduler();
  },

  style: 'deep_house',

  _scheduleStep(step, time) {
    const beat = step % 16;
    const bar = Math.floor(step / 16);

    switch (this.style) {
      case 'techno':
        // Hard four-on-the-floor, running hi-hats, industrial
        if (beat === 0 || beat === 4 || beat === 8 || beat === 12) this._playKick(time, true);
        if (beat % 2 === 0) this._playHat(time);
        if (beat === 4 || beat === 12) this._playClap(time);
        if (beat === 0) this._playSub(time, step, 44);
        // Faint industrial noise every 4 bars
        if (beat === 0 && bar % 4 === 0) this._playPad(time, 'dark', step);
        break;

      case 'dnb':
        // Fast breakbeat: amen-style syncopation at 174 BPM
        if (beat === 0 || beat === 6 || beat === 10 || beat === 14) this._playKick(time, true);
        if (beat === 4 || beat === 12) this._playClap(time);
        // Running hi-hats — every step for that DnB drive
        this._playHat(time, beat % 4 === 0);
        // Rolling sub bass, changes every 4 beats
        if (beat % 4 === 0) this._playSub(time, step, 50 + (beat % 8 === 0 ? 0 : 5));
        // Reese bass hint every 2 bars
        if (beat === 0 && bar % 2 === 0) this._playPad(time, 'reese', step);
        // Extra percussion ghost hits for energy
        if (beat === 3 || beat === 7 || beat === 11) this._playHat(time);
        break;

      case 'tech_house':
        // Groovy, shaker-heavy
        if (beat === 0 || beat === 4 || beat === 8 || beat === 12) this._playKick(time, false);
        if (beat % 2 === 1) this._playHat(time);
        if (beat === 4 || beat === 12) this._playClap(time);
        if (beat === 0) this._playSub(time, step, 50);
        // Stab every 2 bars
        if (beat === 0 && bar % 2 === 0) this._playPad(time, 'stab', step);
        break;

      case 'minimal_techno':
        // Sparse, hypnotic
        if (beat === 0 || beat === 4 || beat === 8 || beat === 12) this._playKick(time, true);
        if (beat === 6 || beat === 14) this._playHat(time);
        if (beat === 4) this._playClap(time);
        if (beat === 0) this._playSub(time, step, 41);
        break;

      case 'industrial':
        // Pounding, distorted
        if (beat === 0 || beat === 4 || beat === 8 || beat === 12) this._playKick(time, true);
        if (beat === 2 || beat === 6 || beat === 10 || beat === 14) this._playKick(time, false);
        if (beat === 4 || beat === 12) this._playClap(time);
        if (beat === 0) this._playSub(time, step, 36);
        if (beat === 8 && bar % 2 === 0) this._playPad(time, 'dark', step);
        break;

      default: // deep_house
        // Mellow four-on-the-floor with warm pad
        if (beat === 0 || beat === 4 || beat === 8 || beat === 12) this._playKick(time, false);
        if (beat === 2 || beat === 6 || beat === 10 || beat === 14) this._playHat(time);
        if (beat === 4 || beat === 12) this._playClap(time);
        if (beat === 0) this._playSub(time, step, 55);
        // Warm chord pad every 4 bars
        if (beat === 0 && bar % 4 === 0) this._playPad(time, 'warm', step);
        break;
    }
  },

  _playKick(time, heavy = false) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = heavy ? 200 : 165;
    const endFreq = heavy ? 30 : 35;
    const decay = heavy ? 0.15 : 0.12;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.6, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    // Distortion for punch
    const dist = this.ctx.createWaveShaper();
    const n = 128;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 3);
    }
    dist.curve = curve;
    dist.oversample = '2x';

    // Transient click
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(3500, time);
    click.frequency.exponentialRampToValueAtTime(200, time + 0.012);
    clickGain.gain.setValueAtTime(0.001, time);
    clickGain.gain.linearRampToValueAtTime(0.15, time + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    click.connect(clickGain);
    clickGain.connect(this.musicGain);
    click.start(time);
    click.stop(time + 0.025);

    osc.connect(gain);
    gain.connect(dist);
    dist.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.22);
  },

  _playHat(time, open = false) {
    if (!this.ctx) return;
    const dur = open ? 0.09 : 0.04;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const gain = this.ctx.createGain();
    gain.gain.value = open ? 0.05 : 0.035;
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
  },

  _playSub(time, step, baseFreq = 55) {
    if (!this.ctx) return;
    const bar = Math.floor(step / 16);
    const ratios = [1, 1, 0.84, 1]; // root, root, minor 6th, root
    const freq = baseFreq * ratios[bar % ratios.length];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const beatDur = 60.0 / this.bpm;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.35, time + 0.05);
    gain.gain.setValueAtTime(0.35, time + beatDur * 2);
    gain.gain.exponentialRampToValueAtTime(0.001, time + beatDur * 3.5);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + beatDur * 4);
  },

  _playClap(time) {
    if (!this.ctx) return;
    const dur = 0.06;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.pow(1 - i / bufSize, 2.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 1.5;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.025;
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
  },

  _playPad(time, type, step) {
    if (!this.ctx) return;
    const bar = Math.floor(step / 16);
    const beatDur = 60.0 / this.bpm;
    const padDur = beatDur * 4;

    if (type === 'warm') {
      // Deep house warm minor 7th chord
      const root = [110, 110, 92.5, 110][bar % 4];
      [root, root * 1.2, root * 1.5, root * 1.8].forEach(f => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(0.04, time + 0.3);
        g.gain.setValueAtTime(0.04, time + padDur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, time + padDur);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + padDur + 0.1);
      });
    } else if (type === 'dark') {
      // Techno dark atmosphere noise
      const dur = padDur * 2;
      const bufSize = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 200;
      bp.Q.value = 8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, time);
      g.gain.linearRampToValueAtTime(0.02, time + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.musicGain);
      src.start(time);
      src.stop(time + dur + 0.1);
    } else if (type === 'reese') {
      // DnB reese bass hint
      const root = [55, 55, 46.25, 49][bar % 4];
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.value = root;
      osc2.frequency.value = root * 1.005;
      g.gain.setValueAtTime(0.001, time);
      g.gain.linearRampToValueAtTime(0.03, time + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, time + padDur);
      osc1.connect(g);
      osc2.connect(g);
      g.connect(this.musicGain);
      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + padDur + 0.1);
      osc2.stop(time + padDur + 0.1);
    } else if (type === 'stab') {
      // Tech-house chord stab
      const root = 220;
      [root, root * 1.25, root * 1.5].forEach(f => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(0.025, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.2);
      });
    }
  },

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  },

  stopLoop() {
    this.isPlaying = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  },
};

