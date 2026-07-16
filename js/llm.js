// ============================================================
// PHASE 1: LLM ENGINE
// ============================================================

// ============================================================
// NATIVE TOOL DEFINITIONS (OpenAI format)
// ============================================================

const NEIGHBOR_TOOLS = [
  { type: 'function', function: { name: 'share_intel', description: 'Share a piece of secret information about tonight with the player', parameters: { type: 'object', properties: { intel: { type: 'string', description: 'The intel to share' } }, required: ['intel'] } } },
  { type: 'function', function: { name: 'offer_item', description: 'Offer an item to the player', parameters: { type: 'object', properties: { item: { type: 'string', description: 'Item name' } }, required: ['item'] } } },
  { type: 'function', function: { name: 'give_money', description: 'Give cash to the player', parameters: { type: 'object', properties: { amount: { type: 'number', description: 'Dollar amount' } }, required: ['amount'] } } },
  { type: 'function', function: { name: 'want_item', description: 'Ask the player for an item', parameters: { type: 'object', properties: { item: { type: 'string', description: 'Item you want' } }, required: ['item'] } } },
  { type: 'function', function: { name: 'change_affinity', description: 'How much you like or dislike this person after their message', parameters: { type: 'object', properties: { delta: { type: 'number', description: '-15 to +15' } }, required: ['delta'] } } },
  { type: 'function', function: { name: 'exchange_numbers', description: 'Offer to become contacts and stay in touch', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'end_conversation', description: 'End the conversation', parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } } },
  { type: 'function', function: { name: 'leave_queue', description: 'Decide to leave the queue entirely — give up and go home', parameters: { type: 'object', properties: { reason: { type: 'string', description: 'Why you are leaving' } }, required: ['reason'] } } },
  { type: 'function', function: { name: 'swap_spots', description: 'Agree to swap your queue position with the player', parameters: { type: 'object', properties: { reason: { type: 'string', description: 'Why you agreed' } }, required: ['reason'] } } },
  { type: 'function', function: { name: 'accept_flirt', description: 'Reciprocate the player flirting with you and let it meaningfully affect the queue interaction', parameters: { type: 'object', properties: { reason: { type: 'string', description: 'Why you are into it' } }, required: ['reason'] } } },
  { type: 'function', function: { name: 'form_alliance', description: 'Agree to ally with the player and vouch for them later at the bouncer', parameters: { type: 'object', properties: { reason: { type: 'string', description: 'Why you agree to vouch for them' } }, required: ['reason'] } } },
  { type: 'function', function: { name: 'remember', description: 'Store a memory that this character may recall in a future conversation', parameters: { type: 'object', properties: { subject: { type: 'string', description: 'self, player, crew, or night' }, type: { type: 'string', description: 'personal_fact, shared_event, favor, conflict, promise, inside_joke, or first_meeting' }, text: { type: 'string', description: 'Specific memory in one sentence' }, valence: { type: 'number', description: '-1 negative, 0 neutral, 1 positive' }, salience: { type: 'number', description: '0.0 trivial to 1.0 unforgettable' }, confidence: { type: 'number', description: '0.0 fuzzy to 1.0 certain' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['text'] } } },
];

const CREW_TOOLS = [
  { type: 'function', function: { name: 'remember', description: 'Store a memory that this crew member may recall in a future conversation', parameters: { type: 'object', properties: { subject: { type: 'string' }, type: { type: 'string' }, text: { type: 'string' }, valence: { type: 'number' }, salience: { type: 'number' }, confidence: { type: 'number' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['text'] } } },
  { type: 'function', function: { name: 'reduce_anxiety', description: 'Reduce overall squad anxiety because the player reassured or grounded the crew', parameters: { type: 'object', properties: { amount: { type: 'number', description: '1 to 12' }, reason: { type: 'string' } }, required: ['amount', 'reason'] } } },
  { type: 'function', function: { name: 'boost_hope', description: 'Increase overall hope because the crew feels the night is worth it', parameters: { type: 'object', properties: { amount: { type: 'number', description: '1 to 12' }, reason: { type: 'string' } }, required: ['amount', 'reason'] } } },
];

const BOUNCER_TOOLS = [
  { type: 'function', function: { name: 'approve', description: 'Increase approval — they said something good', parameters: { type: 'object', properties: { amount: { type: 'number', description: '5 to 35' }, reason: { type: 'string' } }, required: ['amount', 'reason'] } } },
  { type: 'function', function: { name: 'disapprove', description: 'Decrease approval — they said something bad', parameters: { type: 'object', properties: { amount: { type: 'number', description: '5 to 25' }, reason: { type: 'string' } }, required: ['amount', 'reason'] } } },
  { type: 'function', function: { name: 'let_in', description: 'Let them into the club', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'reject', description: 'Reject them — not tonight', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'ban', description: 'Ban them from the venue', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'inspect_bag', description: 'Check their bag and pockets', parameters: { type: 'object', properties: {}, required: [] } } },
];

const ALL_TOOL_NAMES = [...new Set([...NEIGHBOR_TOOLS, ...CREW_TOOLS, ...BOUNCER_TOOLS].map(t => t.function.name))];

// ============================================================
// LLM ENGINE
// ============================================================

const LLM = {
  pipeline: null,
  DynamicCache: null,
  loaded: false,
  loading: false,
  _loadPromise: null,
  _progressListeners: [],
  cacheSessions: {},
  _toolNameAlternation: null,
  _toolStripRegexes: null,
  _toolParseRegexes: null,

  _assessPreflight({ hasWebGPU, deviceMemory }) {
    const reasons = [];
    if (!hasWebGPU) {
      reasons.push('WebGPU is not available in this browser');
      return { level: 'unsupported', reasons };
    }
    if (deviceMemory !== undefined && deviceMemory < 8) {
      reasons.push(`Device reports ${deviceMemory} GB of total RAM`);
      reasons.push('The AI model needs roughly 6–8 GB of free memory while running');
      return { level: 'low-memory', reasons };
    }
    reasons.push('WebGPU is available');
    if (deviceMemory === undefined) {
      reasons.push('Total RAM could not be detected');
    } else {
      reasons.push(`Device reports ${deviceMemory} GB of RAM`);
    }
    return { level: 'ok', reasons };
  },

  async preflight() {
    const hasWebGPU = !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null));
    const deviceMemory = navigator.deviceMemory;
    const assessment = this._assessPreflight({ hasWebGPU, deviceMemory });
    return { ...assessment, hasWebGPU, deviceMemory };
  },

  _getToolNameAlternation() {
    if (!this._toolNameAlternation) {
      this._toolNameAlternation = ALL_TOOL_NAMES.join('|');
    }
    return this._toolNameAlternation;
  },

  _getToolStripRegexes() {
    if (!this._toolStripRegexes) {
      const alt = this._getToolNameAlternation();
      this._toolStripRegexes = {
        xmlPaired: new RegExp(`<\\s*(${alt})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, 'gi'),
        xmlSelf: new RegExp(`<\\s*(${alt})\\b[^>]*\\/?\\s*>`, 'gi'),
        bareBrace: new RegExp(`\\b(${alt})\\s*\\{[^}]*\\}`, 'g'),
        paren: new RegExp(`\\b(${alt})\\s*\\([^)]*\\)`, 'g'),
      };
    }
    return this._toolStripRegexes;
  },

  _getToolParseRegexes() {
    if (!this._toolParseRegexes) {
      const alt = this._getToolNameAlternation();
      this._toolParseRegexes = {
        bareCall: new RegExp(`\\b(${alt})\\s*\\{([^}]*)\\}`, 'g'),
        fn: new RegExp(`\\b(${alt})\\s*\\(([^)]*)\\)`, 'g'),
        xmlPaired: new RegExp(`<\\s*(${alt})\\b([^>]*)>(.*?)<\\s*\\/\\s*\\1\\s*>`, 'gis'),
        xmlSelf: new RegExp(`<\\s*(${alt})\\b([^>]*)\\/?\\s*>`, 'gi'),
      };
    }
    return this._toolParseRegexes;
  },

  _stripToolText(text) {
    const strip = this._getToolStripRegexes();
    return (text || '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      .replace(/<\|channel>thought[\s\S]*?(?:<channel\|>|$)/g, '')
      .replace(/<\|channel>[\s\S]*?(?:<channel\|>|$)/g, '')
      .replace(/<\|tool_call>[\s\S]*?(?:<tool_call\|>|$)/g, '')
      .replace(/<\|tool_response>[\s\S]*?(?:<tool_response\|>|$)/g, '')
      .replace(strip.xmlPaired, '')
      .replace(strip.xmlSelf, '')
      .replace(/call:\w+\{[^}]*\}/g, '')
      .replace(strip.bareBrace, '')
      .replace(strip.paren, '')
      .replace(/\\?turn\|>|<\|turn>[^]*$/g, '')
      .replace(/<eos>|<\/s>|<bos>/g, '')
      .replace(/\[[A-Z_]+(?::.*?)?\]/g, '')
      .trim();
  },

  _notifyProgress(pct, info) {
    this._progressListeners.forEach(fn => {
      try { fn(pct, info); } catch (e) { console.warn('LLM progress listener error:', e); }
    });
  },

  async load(onProgress) {
    if (this.loaded) {
      onProgress?.(100, null);
      return Promise.resolve();
    }
    if (onProgress) this._progressListeners.push(onProgress);
    if (this._loadPromise) return this._loadPromise;

    this.loading = true;
    this._loadPromise = (async () => {
      try {
        const { pipeline, env, DynamicCache } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
        env.allowLocalModels = false;
        this.DynamicCache = DynamicCache || null;

        // Aggregate download progress across all model files so the bar and
        // time estimate move predictably instead of jumping per file.
        const files = {};
        const startedAt = Date.now();
        const report = () => {
          const entries = Object.values(files);
          const totalBytes = entries.reduce((s, f) => s + f.total, 0);
          const loadedBytes = entries.reduce((s, f) => s + f.loaded, 0);
          if (!totalBytes) return;
          const pct = Math.round((loadedBytes / totalBytes) * 100);
          const elapsedMs = Date.now() - startedAt;
          const rate = loadedBytes / Math.max(elapsedMs, 1); // bytes per ms
          const remainingMs = rate > 0 ? (totalBytes - loadedBytes) / rate : null;
          this._notifyProgress(pct, { loadedBytes, totalBytes, elapsedMs, remainingMs });
        };
        // Gemma 4 E4B chosen via tests/model-bench.mjs: far stronger tool-calling than
        // Ternary Bonsai 8B ONNX (see tests/bench-reports/), which is also ~14x slower in ONNX.
        this.pipeline = await pipeline('text-generation', 'onnx-community/gemma-4-E4B-it-ONNX', {
          device: 'webgpu',
          dtype: 'q4f16',
          progress_callback: (p) => {
            if ((p.status === 'progress' || p.status === 'done') && p.file) {
              const total = p.total || files[p.file]?.total || 0;
              files[p.file] = {
                total,
                loaded: p.status === 'done' ? total : (p.loaded || 0),
              };
              report();
            } else if (p.status === 'ready') {
              this._notifyProgress(100, null);
            }
          },
        });
        this.loaded = true;
        this.loading = false;
        Debug.log('LLM cache support', this.DynamicCache ? 'DynamicCache available' : 'DynamicCache unavailable');
      } catch (e) {
        console.error('LLM load failed:', e);
        this.loading = false;
        this._loadPromise = null;
        throw e;
      } finally {
        this._progressListeners = [];
      }
    })();
    return this._loadPromise;
  },

  _messageComparable(message) {
    return {
      role: message.role,
      content: message.content || '',
      tool_calls: message.tool_calls || null,
      tool_responses: message.tool_responses || null,
    };
  },

  _sameMessage(a, b) {
    return JSON.stringify(this._messageComparable(a)) === JSON.stringify(this._messageComparable(b));
  },

  _isPrefix(prefix, full) {
    if (!prefix || prefix.length > full.length) return false;
    for (let i = 0; i < prefix.length; i++) {
      if (!this._sameMessage(prefix[i], full[i])) return false;
    }
    return true;
  },

  _cloneMessages(messages) {
    return messages.map(m => ({ ...m, tool_calls: m.tool_calls ? JSON.parse(JSON.stringify(m.tool_calls)) : undefined, tool_responses: m.tool_responses ? JSON.parse(JSON.stringify(m.tool_responses)) : undefined }));
  },

  _getCacheSession(cacheKey, messages) {
    if (!cacheKey || !this.DynamicCache) return null;
    let session = this.cacheSessions[cacheKey];
    if (session?.messages && !this._isPrefix(session.messages, messages)) {
      this.disposeCache(cacheKey);
      session = null;
    }
    if (!session) {
      session = { cache: new this.DynamicCache(), messages: null };
      this.cacheSessions[cacheKey] = session;
    }
    return session;
  },

  disposeCache(cacheKey) {
    const session = this.cacheSessions[cacheKey];
    if (!session) return;
    try {
      session.cache?.dispose?.();
    } catch (e) {
      console.warn('Failed to dispose KV cache:', e);
    }
    delete this.cacheSessions[cacheKey];
  },

  disposeAllCaches() {
    Object.keys(this.cacheSessions).forEach(k => this.disposeCache(k));
  },

  async chat(messages, tools = null, maxTokens = 150, cacheKey = null) {
    if (!this.loaded || !this.pipeline) return null;
    try {
      const opts = {
        max_new_tokens: maxTokens,
        temperature: 0.8,
        top_p: 0.92,
        do_sample: true,
      };
      if (tools) opts.tools = tools;
      const cacheSession = this._getCacheSession(cacheKey, messages);
      if (cacheSession) opts.past_key_values = cacheSession.cache;

      const CHAT_TIMEOUT_MS = 60000;
      const output = await Promise.race([
        this.pipeline(messages, opts),
        new Promise(resolve => setTimeout(() => resolve('__timeout__'), CHAT_TIMEOUT_MS)),
      ]);
      if (output === '__timeout__') {
        const msg = 'LLM generation timed out after 60s';
        console.warn(msg);
        Debug.log('LLM timeout', msg);
        if (typeof EventLog !== 'undefined') EventLog.add(msg, 'negative');
        return null;
      }
      const generated = output[0]?.generated_text;
      Debug.log('LLM.chat generated', {
        hasTools: !!tools,
        generatedType: Array.isArray(generated) ? 'array' : typeof generated,
        last: Array.isArray(generated) ? generated[generated.length - 1] : String(generated).slice(0, 800),
      });

      if (Array.isArray(generated)) {
        const last = generated[generated.length - 1];
        const rawText = last?.content || '';
        const nativeCalls = last?.tool_calls || [];
        const parsedCalls = nativeCalls.length > 0 ? [] : this._parseToolCalls(rawText);
        const toolCalls = nativeCalls.length > 0 ? nativeCalls : parsedCalls;
        Debug.log('LLM.chat parsed tool calls', toolCalls);
        if (cacheSession) {
          cacheSession.messages = this._cloneMessages(generated);
          Debug.log('LLM KV cache', { cacheKey, seqLength: cacheSession.cache?.get_seq_length?.() });
        }
        return { text: this._stripToolText(rawText), rawText, toolCalls, assistantMessage: last };
      }

      const rawText = typeof generated === 'string' ? generated : '';
      const toolCalls = this._parseToolCalls(rawText);
      Debug.log('LLM.chat parsed tool calls', toolCalls);
      const cleanText = this._stripToolText(rawText);
      if (cacheSession) {
        cacheSession.messages = this._cloneMessages([...messages, { role: 'assistant', content: rawText }]);
        Debug.log('LLM KV cache', { cacheKey, seqLength: cacheSession.cache?.get_seq_length?.() });
      }
      return { text: cleanText, rawText, toolCalls, assistantMessage: { role: 'assistant', content: rawText } };
    } catch (e) {
      console.error('LLM chat error:', e);
      return null;
    }
  },

  _parseToolCalls(text) {
    const calls = [];

    // Qwen3-style XML tool calls (kept for future models): <tool_call>{"name":"fn","arguments":{...}}</tool_call>
    const qwenToolPattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
    let match;
    while ((match = qwenToolPattern.exec(text)) !== null) {
      try {
        // Models emit almost-JSON like {"delta": +5} — strip leading + on numbers and trailing commas.
        const jsonish = match[1]
          .replace(/:\s*\+(?=\d)/g, ': ')
          .replace(/,\s*([}\]])/g, '$1');
        const parsed = JSON.parse(jsonish);
        if (parsed.name) calls.push({ function: { name: parsed.name, arguments: parsed.arguments || {} } });
      } catch (e) {}
    }
    if (calls.length > 0) return calls;

    // Legacy pipeline formats:
    // <|tool_call>call:function_name{arg:<|"|>value<|"|>}<tool_call|>
    // call:function_name{arg:value}
    const toolCallPattern = /<\|tool_call>call:(\w+)\{(.*?)\}<tool_call\|>/gs;
    while ((match = toolCallPattern.exec(text)) !== null) {
      calls.push({ function: { name: match[1], arguments: this._parseLegacyArgs(match[2]) } });
    }
    if (calls.length === 0) {
      const callPattern = /call:(\w+)\{([^}]*)\}/g;
      while ((match = callPattern.exec(text)) !== null) {
        calls.push({ function: { name: match[1], arguments: this._parseLegacyArgs(match[2]) } });
      }
    }
    if (calls.length === 0) {
      // Bare function_name{arg:value} without the call: prefix.
      const parse = this._getToolParseRegexes();
      while ((match = parse.bareCall.exec(text)) !== null) {
        calls.push({ function: { name: match[1], arguments: this._parseLegacyArgs(match[2]) } });
      }
    }

    // Pipeline fallback: sometimes emits function_name(...) text.
    const parseRegexes = this._getToolParseRegexes();
    while ((match = parseRegexes.fn.exec(text)) !== null) {
      calls.push({ function: { name: match[1], arguments: this._parseParenArgs(match[1], match[2]) } });
    }

    // Pipeline fallback: sometimes emits XML-ish tags.
    while ((match = parseRegexes.xmlPaired.exec(text)) !== null) {
      calls.push({ function: { name: match[1], arguments: this._parseLooseToolArgs(match[1], match[2], match[3]) } });
    }
    while ((match = parseRegexes.xmlSelf.exec(text)) !== null) {
      if (match[0].startsWith('</') || text.slice(match.index).match(/^<[^>]+>.*?<\/\s*\w+\s*>/s)) continue;
      calls.push({ function: { name: match[1], arguments: this._parseLooseToolArgs(match[1], match[2], '') } });
    }

    // Also try JSON format: {"name": "fn", "arguments": {...}}
    if (calls.length === 0) {
      try {
        const jsonMatch = text.match(/\{[^{}]*"name"\s*:\s*"[^"]+"/);
        if (jsonMatch) {
          const startIdx = text.indexOf(jsonMatch[0]);
          let depth = 0, endIdx = startIdx;
          for (let i = startIdx; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
          }
          const parsed = JSON.parse(text.slice(startIdx, endIdx));
          if (parsed.name) calls.push({ function: { name: parsed.name, arguments: parsed.arguments || {} } });
        }
      } catch (e) {}
    }
    return calls;
  },

  _parseLegacyArgs(argsStr) {
    const args = {};
    const raw = (argsStr || '').trim();
    if (raw.startsWith('{')) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    const argPattern = /(\w+):(?:<\|"\|>(.*?)<\|"\|>|([^,}]*))/g;
    let match;
    while ((match = argPattern.exec(raw)) !== null) {
      let value = (match[2] ?? match[3] ?? '').trim().replace(/^["']|["']$/g, '');
      if (!isNaN(value) && value !== '') value = Number(value);
      args[match[1]] = value;
    }
    return args;
  },

  _parseParenArgs(name, argsStr) {
    const args = {};
    const trimmed = (argsStr || '').trim();
    if (!trimmed) return args;
    const parts = trimmed.includes('=') ? trimmed.split(',') : [trimmed];
    parts.forEach(part => {
      const [rawKey, ...rawValueParts] = part.split('=');
      const key = rawValueParts.length > 0 ? rawKey.trim() : (name === 'change_affinity' ? 'delta' : ['give_money', 'reduce_anxiety', 'boost_hope'].includes(name) ? 'amount' : name === 'remember' ? 'text' : 'reason');
      let value = (rawValueParts.length > 0 ? rawValueParts.join('=') : rawKey).trim().replace(/^["']|["']$/g, '');
      if (!isNaN(value) && value !== '') value = Number(value);
      if (key) args[key] = value;
    });
    return args;
  },

  _parseLooseToolArgs(name, attrText = '', bodyText = '') {
    const args = {};
    const raw = `${attrText || ''} ${bodyText || ''}`.trim();

    const attrPattern = /(\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    let attr;
    while ((attr = attrPattern.exec(raw)) !== null) {
      let value = attr[2].trim().replace(/^["']|["']$/g, '');
      if (!isNaN(value) && value !== '') value = Number(value);
      args[attr[1]] = value;
    }

    if (Object.keys(args).length > 0) return args;

    const cleaned = raw.replace(/^[:=\s]+/, '').trim();
    if (!cleaned) return args;

    if (name === 'change_affinity') args.delta = parseInt(cleaned) || 0;
    else if (name === 'give_money') args.amount = parseInt(cleaned) || 0;
    else if (name === 'reduce_anxiety' || name === 'boost_hope') args.amount = parseInt(cleaned) || 0;
    else if (name === 'offer_item' || name === 'want_item') args.item = cleaned;
    else if (name === 'share_intel') args.intel = cleaned;
    else if (name === 'remember') {
      args.text = cleaned;
      args.type = 'shared_event';
      args.salience = 0.35;
    }
    else if (name === 'approve' || name === 'disapprove') {
      const amount = parseInt(cleaned);
      args.amount = Math.abs(amount) || 10;
      args.reason = cleaned.replace(/^[+-]?\d+\s*/, '').trim();
    } else if (['end_conversation', 'leave_queue', 'swap_spots', 'accept_flirt', 'form_alliance'].includes(name)) {
      args.reason = cleaned;
    }
    return args;
  },
};

