// Smoke test for the Ternary Bonsai 8B swap: verifies the chat template's tool
// formatting and runs real generations through the game's own parser.
// Not part of `node --test` (downloads ~2.2 GB, slow CPU inference); run manually:
//   node tests/llm-smoke.mjs [--skip-generation]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const MODEL = 'onnx-community/Ternary-Bonsai-8B-ONNX';
const SKIP_GENERATION = process.argv.includes('--skip-generation');

function loadFromJsFile(file, startMarker, endMarker, exportExpr, replaceExpr = null) {
  const full = readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
  const start = full.indexOf(startMarker);
  const end = endMarker ? full.indexOf(endMarker, start) : full.length;
  if (start === -1 || (endMarker && end === -1)) throw new Error(`Could not extract ${exportExpr} from js/${file}`);
  let source = full.slice(start, end);
  if (replaceExpr) {
    source = source.replace(replaceExpr, 'var ');
  } else {
    source = source.replace(/^const /, 'var ');
  }
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${source}\n${exportExpr};`, context);
  return context[exportExpr];
}

function loadLlm() {
  const source = readFileSync(new URL('../js/llm.js', import.meta.url), 'utf8')
    .replace('const LLM =', 'var LLM =');
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${source}\nLLM;`, context);
  return context.LLM;
}

const LLM = loadLlm();
const NEIGHBOR_TOOLS = loadFromJsFile('llm.js', 'const NEIGHBOR_TOOLS = [', '\nconst CREW_TOOLS', 'NEIGHBOR_TOOLS');
const BOUNCER_TOOLS = loadFromJsFile('llm.js', 'const BOUNCER_TOOLS = [', '\nconst ALL_TOOL_NAMES', 'BOUNCER_TOOLS');

const NEIGHBOR_MESSAGES = [
  {
    role: 'system',
    content: 'You are Mia, 24, an art student waiting in the queue at club Velvet Room. You are chatty and a bit nervous. You know a secret: the door password tonight is "Neon Garden". Stay in character, reply in 1-3 short sentences. Use tools to reflect how the conversation affects you.',
  },
  { role: 'user', content: "Hey! Long queue tonight, huh? I love your jacket by the way." },
];

const BOUNCER_MESSAGES = [
  {
    role: 'system',
    content: 'You are Bruno, the bouncer at club Velvet Room. You are strict but fair. Judge each thing the person says and use the approve/disapprove tools to score it. Only use let_in or reject when you have made a final decision. Reply in 1-2 gruff sentences.',
  },
  { role: 'user', content: 'Evening. My friend Mia inside said the password is "Neon Garden" — we good?' },
];

const results = { pass: 0, fail: 0 };
function check(label, ok, detail = '') {
  results[ok ? 'pass' : 'fail']++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

const { AutoTokenizer, pipeline } = await import('@huggingface/transformers');

// --- Part A: chat template / tool formatting (tokenizer only, no model weights) ---
console.log(`\n=== Part A: chat template for ${MODEL} ===\n`);
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const rendered = tokenizer.apply_chat_template(NEIGHBOR_MESSAGES, {
  tools: NEIGHBOR_TOOLS,
  add_generation_prompt: true,
  tokenize: false,
});
console.log('--- rendered prompt (first 2500 chars) ---');
console.log(rendered.slice(0, 2500));
console.log('--- end ---\n');

check('template includes tool schemas', rendered.includes('share_intel') && rendered.includes('change_affinity'));
check('template instructs <tool_call> XML format', rendered.includes('<tool_call>'));
check('template contains system prompt', rendered.includes('Velvet Room'));
check('template ends with generation prompt', /assistant\s*$/m.test(rendered.trimEnd()) || rendered.trimEnd().endsWith('<|im_start|>assistant'));

// --- Part B: real generation through the game's parser ---
if (SKIP_GENERATION) {
  console.log('\n(skipping generation — --skip-generation)');
} else {
  console.log(`\n=== Part B: generation (CPU, this may take a few minutes) ===\n`);
  // onnxruntime-node's CPU EP lacks 2-bit MatMulNBits kernels; webgpu matches the game.
  const device = process.argv.includes('--webgpu') ? 'webgpu' : undefined;
  const generator = await pipeline('text-generation', MODEL, {
    ...(device ? { device } : {}),
    dtype: 'q2f16',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total && p.file?.endsWith('.onnx_data')) {
        process.stdout.write(`\rdownloading ${p.file}: ${Math.round((p.loaded / p.total) * 100)}%   `);
      }
    },
  });
  console.log('\nmodel loaded');

  const scenarios = [
    { label: 'neighbor chat', messages: NEIGHBOR_MESSAGES, tools: NEIGHBOR_TOOLS, expectTools: ['change_affinity', 'share_intel', 'remember', 'accept_flirt'] },
    { label: 'bouncer duel', messages: BOUNCER_MESSAGES, tools: BOUNCER_TOOLS, expectTools: ['approve', 'disapprove', 'let_in', 'reject', 'inspect_bag'] },
  ];

  for (const { label, messages, tools, expectTools } of scenarios) {
    console.log(`\n--- scenario: ${label} ---`);
    const t0 = Date.now();
    const output = await generator(messages, {
      max_new_tokens: 150,
      temperature: 0.8,
      top_p: 0.92,
      do_sample: true,
      tools,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const generated = output[0]?.generated_text;
    const last = Array.isArray(generated) ? generated[generated.length - 1] : { content: String(generated) };
    const rawText = last?.content || '';
    const nativeCalls = last?.tool_calls || [];
    const toolCalls = nativeCalls.length > 0 ? nativeCalls : LLM._parseToolCalls(rawText);
    const cleanText = LLM._stripToolText(rawText);

    console.log(`generation took ${secs}s`);
    console.log('raw output:', JSON.stringify(rawText));
    console.log('native tool_calls:', JSON.stringify(nativeCalls));
    console.log('parsed tool calls:', JSON.stringify(toolCalls.map(c => ({ name: c.function?.name, args: c.function?.arguments }))));
    console.log('player-visible text:', JSON.stringify(cleanText));

    check(`${label}: produced output`, rawText.length > 0 || toolCalls.length > 0);
    check(`${label}: no tool syntax leaked into visible text`, !/<tool_call>|<think>|\{"name"/.test(cleanText), cleanText.slice(0, 120));
    const usedKnownTool = toolCalls.every(c => tools.some(t => t.function.name === c.function?.name));
    check(`${label}: tool calls (if any) use known tool names`, usedKnownTool, toolCalls.map(c => c.function?.name).join(', ') || 'none emitted');
    if (toolCalls.length === 0) console.log(`note: ${label} emitted no tool call this run (sampled generation; not necessarily a failure)`);
    if (expectTools.some(n => toolCalls.some(c => c.function?.name === n))) {
      console.log(`note: ${label} used an expected tool — good sign`);
    }
  }
}

console.log(`\n=== ${results.pass} passed, ${results.fail} failed ===`);
process.exit(results.fail > 0 ? 1 : 0);
