# The Queue: Access Granted

A single-file browser roguelite about surviving the social physics of a club queue. Pick a venue, build a squad, gather intel from strangers, manage anxiety and hope, then talk your way past the bouncer.

Live repo: <https://github.com/NotNANtoN/the-queue>

## Run

No build step, no dependencies.

Open `index.html` in a browser, or serve the folder locally (the `js/` scripts must load from the same origin):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The game uses an on-device Hugging Face Transformers model for NPC and bouncer conversations. First load can take a while because the model is downloaded and cached by the browser.

## Code layout

`index.html` holds CSS and markup. Game logic lives in classic (non-module) scripts under `js/`, loaded in dependency order — `pixel.js`, `data.js`, `llm.js`, `queue.js`, `main.js`, and others. No build step; concatenating the files in include order reproduces the original single-script game.

### Model benchmarking

Compare on-device LLM candidates with `npm run bench -- --model <id> --dtype <dtype> [--device webgpu]`. For an OpenAI-compatible server (e.g. local llama-server): `npm run bench -- --endpoint http://localhost:8080/v1 --api-model <id> --dry-run`. Use `--dry-run` to validate scenarios and model size without loading weights. Reports land in `tests/bench-reports/`.

Run unit tests with `npm test` (Node's built-in test runner over `tests/*.test.mjs`).

## Game Loop

1. **Plan the night**: choose a venue, assemble up to 3 squad members, buy items, equip outfits, and customize your own avatar.
2. **Survive the queue**: wait through stalls and bursts, talk to people in front/behind you, and barter for intel through conversation.
3. **Face the bouncer**: answer in free text under pressure. Intel gathered in line is useful when you naturally mention the right names, lineup details, password, door mood, style cues, or connections. Squad traits, wardrobe, and items (VIP wristband, substances) affect what the bouncer sees.
4. **Inside the club**: a short flavor sequence, one meaningful choice (crew / room / chase), then sunrise and results.
5. **Progress**: success and failure both move the meta-loop forward via reputation (job tier, unlocks), venue clears, contacts, bonds, outfits, and saved player appearance.

## Current Features

- `index.html` plus ordered classic scripts in `js/` — HTML, CSS, Canvas 2D, Web Audio, and browser `localStorage`.
- Phone-style planning UI with venues, squad selection, loadout, wardrobe, and player appearance editing.
- Editable player avatar: skin, hair, hair style, shirt, eye color, face width/height, eye spacing, nose, and ears.
- Persistent player badge outside the phone UI showing avatar and current job.
- Procedural queue visualization with player, squad, neighbors, line movement, and mood meters.
- Hope and anxiety engine with queue stalls, movement bursts, squad bailouts, and random events.
- LLM-driven neighbor chats with tool calls for intel, item offers, money, affinity changes, contact unlocks, leaving the queue, and swapping spots.
- Queue actions: wait, talk front/back, kiosk, use item, view intel, and crew chat.
- LLM-driven free-text bouncer dialogue with approval/disapproval tool calls (`let_in`, `reject`, `inspect_bag`, etc.).
- Contact traits wired to queue/bouncer/save (Hype Engine, Promoter intel, Insider auto-intel, Dealer stash, Diplomat calm, Niko rep, Networker/Polaroid bonds, Ghost head-count, Jasper variance, Zara rep, Mona 2× style).
- Wardrobe perks: Lucky Charm flake reduction, Hip Flask anxiety ease, Polaroid bond boost.
- Items: Rissal starter kit, earplugs passive/active, fake VIP wristband at the door.
- Loyalty subtly reduces flake rate; memory disposition `chance` gates remember rolls.
- Bouncer interjections: squad members can chime in and queue allies can vouch for you.
- Wardrobe items affect both style scoring and the player’s visible appearance/accent.
- Web Audio club bass that opens up when access is granted.

## Key Controls

- In planning, use the bottom phone tabs to switch between venue, squad, loadout, and look.
- In the queue, use action buttons at the bottom to wait, talk, view intel, or manage resources.
- In conversations, type naturally. NPCs can react to persuasion attempts, trades, jokes, flirting, and pressure.
- At the bouncer, answer quickly and work gathered intel into your replies naturally.

## Deployment

This repo is GitHub Pages-ready because `index.html` sits at the repo root.

In GitHub:

1. Go to **Settings → Pages**.
2. Set **Source** to `Deploy from a branch`.
3. Set **Branch** to `main`.
4. Set **Folder** to `/ (root)`.
5. Save.

The page should become available at:

<https://notnanton.github.io/the-queue/>

## Design Notes

- The queue should feel psychologically real: long stalls, sudden hope, strange strangers, and squad anxiety that can break the group.
- Intel gathered in line gives you concrete facts to mention during the free-text bouncer conversation.
- LLM tool calls drive game state, while the visible text stays conversational.
- The Regulaido visual style is deep lavender, cyber green, hot pink, glass panels, and neon club haze.
