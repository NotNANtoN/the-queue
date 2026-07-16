# The Queue — Progression & Meta-Loop Audit

A complete inventory of persistent/progression elements, a replayability diagnosis, and a concrete proposal set. Numbers are pulled from the code; file refs in parens.

---

## Section 1 — Inventory of Current Progression Elements

### 1.1 Save schema (`js/save.js` `defaultProgress()`, lines 38–59)

| Field | Type | Purpose | Actually used? |
|---|---|---|---|
| `version` | int | Save migration | yes |
| `reputation` | int | Job tier + contact/venue unlocks | yes, but dead-ends at 35 |
| `savings` | int | Carried cash = next week's budget | yes, weak sinks (§5) |
| `job` | string | Weekly pay tier | auto-set from rep |
| `venuesCleared` | string[] | Win-state tracking + unlock gates | yes |
| `wonAt` | timestamp | One-time "Scene Legend" flag | yes, terminal |
| `unlockedContacts` | string[] | Roster of selectable squadmates | yes |
| `totalRuns` / `totalSuccesses` | int | Counters | shown nowhere |
| `bonds` | `{id:id → 0..100}` | Pairwise affinity (player↔contact, contact↔contact) | yes, but no sink |
| `contactStats` | `{id → {runsTogether, successes, flakes, loyalty}}` | Per-contact history | tracked, barely surfaced |
| `ownedOutfits` / `equippedOutfits` | string[] | Wardrobe ownership + loadout | yes |
| `playerLook` | object | Avatar appearance | yes |
| `djHistory` | `{}` | (intended DJ history) | **DEAD — never read or written outside default** |
| `venueVisits` | `{venueId → count}` | Per-venue run count | shown as "Visited Nx" on card |
| `contactMemories` | `{contactId → memory[]}` | Promoted memories, surfaced in crew chat | yes (crew chat only) |
| `strangerMemories` | `{memoryId → {name,disposition,quirk,memories[]}}` | Promoted stranger memories | **EFFECTIVELY DEAD — written but never re-read in play** (see §1.6) |

### 1.2 Reputation & jobs (`js/save.js` lines 30–36, 140–141, 173–179)

- Jobs: `barista(30,rep0)`, `bartender(45,rep5)`, `promoter(60,rep12)`, `dj(80,rep20)`, `owner(120,rep35)`.
- Auto-upgrade: highest job whose `minRep ≤ reputation` is assigned in `applyToState()`.
- **Rep gain per run (`recordRun`, line 173):** `+3` success / `+1` failure, `+1` more if Zara in squad on success, **capped at 4**.
- Max useful reputation = **35** (owner). After that, rep is a dead currency.

### 1.3 Cash & sinks (`js/save.js` line 146, 255; `js/main.js` 203–204; `js/ui.js` 380–413; `js/kiosk.js` 33; `js/queue.js` 332, 360)

- Weekly budget = `pay + savings` (line 146). End-of-run `state.cash` → `savings` (line 255, `Math.max(0,…)`). **No decay, no cap.**
- Entry cost (`main.js` 203): `venue.entryPrice × (1 + squadSize)`. Range $8–$40 per person × 1–4 people = **$8–$160/run**.
- Item shop (`ITEMS`, `data.js` 357–363): gum 5, lighter 10, earplugs 12, water 15, vip 25.
- Wardrobe (`WARDROBE`, `data-phase1.js` 357–368): 10 items, $8–$30, **one-time purchases** (owned flag, no resale, no durability).
- Kiosk (`KIOSK_ITEMS`, `data-phase1.js` 19–27): 7 items, $3–$25, per-run consumables.
- Bribes in events: $8–$10 (`queue.js` 332, 360).
- **No recurring cash sink that scales with wealth.** Once wardrobe is fully owned (~$200 total), only entry + consumables drain cash — and an owner-tier player earns $120/wk against ~$40–$80 of necessary spend.

### 1.4 Venues & unlock gates (`js/data.js` 5–109; `js/save.js` 149–155)

8 venues. 5 unlocked from start (mainframe, compliance, neon, sisyphos, sudpol). 3 gated by **unique clears count**:
- `boardroom` (Ruthless) → 2 clears
- `florians` (Ruthless) → 3 clears
- `audit` (Nightmare) → 5 clears

Door thresholds (`bouncer.js`): Easy 40 / Moderate 60 / Ruthless 85 / Nightmare 100. Pia eases effective tier by one step.

Win state: `allVenuesCleared()` → sets `wonAt` once → "Scene Legend" screen (`bouncer.js` 1030–1033). **No post-win goal.**

### 1.5 Contacts — 13 total (`js/data.js` 111–355)

Starter roster: `kai`, `rissal`, `mona` (3). Unlock conditions:
- `zara`, `jasper` → rep ≥ 5
- `yuki` → rep ≥ 10
- `priya` → rep ≥ 15
- `dex` → clear `compliance`
- `niko` → clear `boardroom`
- `ghost` → clear `florians`
- `pia`, `sasha`, `felix` → no condition (gated only by the per-run unlock roll)

**Per-run unlock mechanics (`save.js` 109–121, 222–247; `chat.js` 507–540):**
- `contactUnlockedThisRun` flag — **hard cap of 1 new contact per run**.
- On success: 60% chance to unlock one (bond 20) (`save.js` 225–233).
- On ≥2 intel revealed: 40% chance to unlock one (bond 10) (235–247).
- Via `exchange_numbers` LLM tool in neighbor chat: neighbor offers, player accepts → `pickLockedContact` → bond = `affinity × 0.3` (chat.js 530–534).
- Inside-club "Work the room" choice: 67.5% chance, bond 25 (bouncer.js 1418–1424).

### 1.6 Bonds & loyalty (`js/save.js` 173–221, 260–275; `js/state.js` 82–88)

- Bond gain multiplier: `priya ×1.5`, `polaroid outfit ×1.5` (stacking).
- Success: squad-pair bonds +`15 × mult`, player↔contact +`10 × mult` (lines 188–202).
- Failure: player↔contact +`3 × mult` only (217–220).
- Club "Stick with crew" choice: +1 to all pairs (bouncer.js 1391–1404).
- Bonds **cap at 100** and have **no sink, no threshold effect, no UI** beyond driving `getSquadBondAvg` (which is computed but only used for a subtle flake reduction per `README` — not visibly surfaced).
- `contactStats.loyalty`: +8 on success, +2 on fail, −5 on flake, cap 0–100. **Surfaced nowhere.**

### 1.7 Memory system (`js/save.js` 312–549)

- 5 disposition profiles with `chance`/`confidence`/`salience` modifiers (313–319).
- `rememberFromNeighbor` / `rememberFromCrewMember` stage memories into `state.queue.nightMemories`.
- `promoteNightMemories` rolls per-memory promotion chance (0.05–0.95) and persists to `contactMemories` (cap 30) or `strangerMemories` (cap 20).
- **Read path:** `buildPromptContextForNeighbor` (377–390) and `buildPromptContextForContact` (421–432) inject top-N memories into LLM prompts.
- **Critical bug/gap:** `strangerMemories` is keyed by `neighbor.memoryId`, which is generated as `'stranger_' + Date.now() + '_' + Math.random()` (`data-phase1.js` 168) — **unique per neighbor per run, never reused**. So a promoted stranger memory can never be matched to a future neighbor. The entire `strangerMemories` store is write-only. The "named regulars who remember you" loop is wired but **does not function**.

### 1.8 Bouncer variety (`js/bouncer.js` 5–56)

- 5 archetypes: Florian, Big Marko, Kai, Silent One, Mira.
- `pickTonightsBouncer(venueId)` is **deterministic** — seeded by `totalRuns × 31 + venueId char codes`. So venue X on run N always has the same bouncer for a given save. Only 5 archetypes → cycles every 5 runs per venue.

### 1.9 Queue content variety (`js/data-phase1.js`; `js/queue.js` 311–417)

- Neighbors: 5 dispositions (weights 0.35/0.20/0.10/0.28/0.07), 28 quirks, 28 adjectives, random intel from 11 secret templates. Combinatorial but archetypes repeat quickly.
- Queue events: **8 total** (4 choice + 4 atmosphere), **all venue-agnostic**. No venue-specific events.
- DJ lineup: 6 genre pools of 5–7 names, reshuffled per run — **cosmetic only** (used as intel text, no mechanical effect).
- `djHistory` field exists to track this but is never written.

### 1.10 Club phase (`js/bouncer.js` 1208–1470)

- 13 flavor events (random, mostly +bond/+rep).
- One choice: `crew` (+1 bond all pairs), `room` (+1 rep, 67.5% contact unlock), `chase` (50% cash/item). **No long-tail rewards, no venue-specific outcomes.**

### 1.11 Result screens (`js/bouncer.js` 1013–1094; `js/queue.js` 477–518, 558–619)

Three fail paths (missed last entry, hope zero, bouncer reject) + one win path. All show: bouncer, approval/threshold, intel count, traits, time, squad intact, cash, rep, job, savings, venues cleared, new contacts, promoted memories. **No near-miss highlighting, no streak display, no "X venues remaining" goal hint.**

---

## Section 2 — Loop Diagnosis (ranked by severity)

### Dead-end #1 — The win state is terminal, not generative (CRITICAL)
After clearing all 8 venues, `wonAt` is set and a one-time "Scene Legend" screen plays. There is no post-win content: no new venues, no prestige, no harder mode, no collection to complete. A player who "beats" the game has zero reason to launch run N+1. The single most important grind killer.

### Dead-end #2 — Cash has no scaling sink (CRITICAL)
Savings carry 1:1 with no cap or decay. Job pay outscales necessary spend (owner $120/wk vs ~$40–$80 needed). Wardrobe is a finite one-time pool (~$200 total). Within ~10–15 successful runs a player owns everything and cash becomes a meaningless number. No reason to grind for money.

### Dead-end #3 — Reputation dies at 35 (HIGH)
Max useful rep = 35 (owner job). Rep gain continues to accrue but does nothing. No prestige, no cosmetics, no post-35 unlocks. The +3/+1 reward loop becomes invisible.

### Dead-end #4 — Bonds cap at 100 with no use (HIGH)
Bonds drive only a subtle, undocumented flake reduction. There is no bond-gated content, no bond sink, no bond UI. Re-running with the same crew to deepen relationships yields nothing the player can see or use.

### Dead-end #5 — The LLM's "named regulars" loop is broken (HIGH, and it is the game's USP)
`strangerMemories` is keyed by a per-run-unique `memoryId`, so a stranger can never recur. The single most distinctive thing an on-device-LLM game could do — "the person you met outside Mainframe last Friday, the one who told you about the password, is here again and remembers you" — is wired but non-functional. The MemorySystem is doing 80% of the work for 0% of the payoff.

### Dead-end #6 — Contacts are a finite pool with a hard per-run cap (MEDIUM)
13 contacts, max 1 unlock per run (`contactUnlockedThisRun`). Once the roster is full (~13 successful runs at the cap), the "new contact" reward vanishes entirely. No rotating roster, no contact retirements, no contact progression beyond `loyalty` (which is invisible).

### Dead-end #7 — Bouncers are deterministic and only 5 deep (MEDIUM)
`pickTonightsBouncer` is seeded by `totalRuns × 31 + venueId`. Same venue on the same run number = same bouncer. With only 5 archetypes, variety is exhausted within 5 visits per venue. No bouncer moods, no bouncer memory of past rejections, no rare/legendary bouncers.

### Dead-end #8 — Variety is perceived as samey (MEDIUM)
8 queue events, all venue-agnostic. 28 quirks × 28 adjectives × 5 dispositions is large but the event layer is thin and identical everywhere. A run at Mainframe and a run at Südpol differ in palette and dress code, not in what happens. No venue-specific events, no rare encounters, no named regulars.

### Dead-end #9 — Invisible goals (LOW–MEDIUM)
Venue unlock gates (2/3/5 clears) and contact unlock conditions (rep5/10/15, venue clears) exist in code but are not shown to the player. Locked venue cards say "complete earlier venues" without numbers. Contact conditions are entirely hidden. Players cannot form a mid-term plan they can see.

### Dead-end #10 — `djHistory` and `totalRuns`/`totalSuccesses` are dead counters (LOW)
Tracked, never surfaced. Free progress-psychology fuel going unused.

---

## Section 3 — Proposals

Ordered by impact/effort ratio (highest first). Effort: S = <1 day, M = 1–3 days, L = >3 days.

### P1 — Fix the stranger-memory recurrence loop (the LLM-unique feature) · Effort: M
**What:** Replace the timestamp-unique `memoryId` with a stable identity so a stranger can recur across runs. Generate `memoryId` as a hash of `disposition + quirk + adjectives + name` (or a small "regular" roster of ~20 named NPCs with fixed memoryIds). On neighbor generation, with probability scaling on `venueVisits[venueId]`, pull an existing `strangerMemories` entry instead of generating fresh — inject its memories via `buildPromptContextForNeighbor` (already works). The LLM then gets a stranger who *actually remembers* the player.
**Builds on:** `MemorySystem` (already writes + reads), `generateNeighbor` (`data-phase1.js` 166), `buildPromptContextForNeighbor` (already injects).
**Fixes:** Dead-end #5. This is the one idea no non-LLM game can do. It turns the memory system from dead weight into the core replay hook.
**Risk:** Cap recurrence rate (~15–25%) so the queue still feels populated by new faces.

### P2 — Bouncer memory + mood + rare bouncers · Effort: M
**What:** (a) Seed `pickTonightsBouncer` with `Math.random` instead of a deterministic formula so it varies per run. (b) Add a `bouncerMood` field (e.g. "strict", "distracted", "in a rush") that modifies thresholds ±10 and is revealed via intel. (c) Add 2–3 "legendary" bouncers that appear only after `wonAt` with a small chance, requiring a specific intel type to pass. (d) Inject the player's past rejection/entry history with this bouncer into the bouncer system prompt via a `bouncerMemories` store (mirror of `contactMemories`).
**Builds on:** `BOUNCERS` pool, `pickTonightsBouncer`, `generateTonightsSecrets`, `MemorySystem` pattern.
**Fixes:** Dead-end #7, and gives the LLM a second memory surface (bouncer remembers you).

### P3 — Venue-specific event decks + rare encounters · Effort: M
**What:** Tag each queue event with `venues: [...]` (or `venueTypes: [...])` and add 2–3 events per venue. Examples: Mainframe — "the bass shakes the ceiling tiles, dust falls" (anxiety +4 unless you have earplugs); Südpol — "the bouncer yells 'show me your dance moves' to the line" (style check, hope ±10); Audit — "an inspector walks the line noting outfits" (style match preview). Add a ~5% "rare encounter" slot per run: a named legendary neighbor, a celebrity walk-in, a police raid threat.
**Builds on:** `_pickRandomEvent` (`queue.js` 311), `QUEUE_CONFIG` per-tier.
**Fixes:** Dead-end #8. Cheapest perceived-variety lever.

### P4 — A visible "Nightlife Codex" collection screen · Effort: S–M
**What:** A new phone tab showing: venues (cleared / visits / best approval), contacts (unlocked + unlock condition hint), bouncers met, wardrobe owned, secrets discovered, memories made. Surface the hidden gates: "Unlock Niko: clear The Boardroom Pentagon". Show `totalRuns`, `totalSuccesses`, win streak.
**Builds on:** All existing save fields (already tracked, just not rendered). `djHistory` can finally log DJs seen.
**Fixes:** Dead-end #9, #10. The single highest impact-per-effort change because the data already exists.

### P5 — Post-win prestige loop ("Scene Legend" tiers) · Effort: M
**What:** After `wonAt`, introduce a prestige counter: clearing all 8 venues again at a higher difficulty tier increments `prestige` (1, 2, 3...). Each prestige tier: +1 bouncer archetype, +5% flake on good contacts, unlocks 1 new wardrobe piece, unlocks 1 new contact variant, and a cosmetic title ("Regular", "Fixture", "Legend of the Scene"). Reset `venuesCleared` on prestige (keep contacts, outfits, memories) so there is a fresh 8-venue climb each cycle.
**Builds on:** `wonAt`, `venuesCleared`, `applyToState` unlock gates, `JOBS` pattern.
**Fixes:** Dead-end #1. Gives the long-term grind a shape.

### P6 — Cash sink: "Reservations" and consumable perks · Effort: M
**What:** Add a recurring high-value cash sink so late-game wealth matters. Options: (a) "Reserve a spot" — pay $50–$150 to skip the first N positions of a queue (scales with venue tier); (b) "Buy a round for the line" — $40, hope +15 for whole queue, one-time per run; (c) "Hire a promoter for the night" — $80, reveals 1 intel at run start; (d) Wardrobe durability / seasonal rotation so ownership is not permanent. Pick (a)+(c) first.
**Builds on:** `state.cash`, `queue.position`, `revealedIntel`, planning loadout.
**Fixes:** Dead-end #2. The sink must scale with wealth (percentage of savings, or flat high price).

### P7 — Bond-gated content: crew combos and bond scenes · Effort: M–L
**What:** Make bonds do something visible. (a) Bond ≥ 60 with a contact unlocks a "combo" — e.g. Kai+Rissal at 60+ gives "the coders sync" (+1 starting intel, +10 hope). (b) Bond ≥ 80 unlocks a one-line pre-queue scene in crew chat where the contact references a past memory. (c) Add a bond sink: "ask a contact to vouch harder" at the door costs 5 bond for +5 approval. (d) Show bond as a small heart bar on the contact card.
**Builds on:** `bonds`, `getSquadBondAvg`, `MemorySystem.buildPromptContextForContact` (crew chat already reads memories).
**Fixes:** Dead-end #4.

### P8 — Reputation past 35: scene influence + cosmetics · Effort: S
**What:** Rep above 35 converts to "Scene Influence" — a parallel currency. Sinks: rename your character, unlock alternate player-look palettes, unlock a "promoter mode" where you can bring a 4th squad member, unlock venue recolors. Small, cosmetic, no power creep.
**Builds on:** `reputation`, `playerLook`, `PLAYER_OPTIONS` (`state.js` 5–16).
**Fixes:** Dead-end #3. Cheap because it is cosmetic-only and avoids invalidating the existing balance.

### P9 — Near-miss amplification + streaks · Effort: S
**What:** (a) On a bouncer rejection within 10 approval of threshold, show a special result subtitle: "So close — 78/85. One more intel, one more ally, one better line." with a one-tap "Run it back at the same venue" button that pre-selects the venue. (b) Track `currentStreak` (consecutive successes) and `bestStreak`; show on result screen and codex. (c) On a 3-streak, give +1 rep bonus; on a streak break, a "the run ends" beat. Streaks are visible goals that cost nothing.
**Builds on:** `showResult` (`bouncer.js` 1013), `recordRun`, `state.queue.revealedIntel`.
**Fixes:** Reward-psychology gap (variable-ratio + near-miss). Not exploitative because streaks reward skill, not spend.

### P10 — Rotating contact roster + loyalty effect · Effort: M
**What:** Once all 13 contacts are unlocked, introduce a rotating "this week's scene" — 2 contacts are "out of town" each week (random), encouraging squad variety. Make `contactStats.loyalty` visible on the contact card and give it a small mechanical effect: loyalty ≥ 80 → flake rate halved; loyalty ≥ 95 → +5 starting approval when in squad. Add a rare "rival" contact who appears only after prestige 1.
**Builds on:** `unlockedContacts`, `contactStats.loyalty`, `applyToState`.
**Fixes:** Dead-end #6.

### P11 — Replayable cleared venues: venue "quests" + best-run scoring · Effort: M
**What:** Give already-cleared venues a reason to be revisited. (a) Per-venue "quests": "Clear Mainframe solo", "Clear Compliance with 0 intel", "Clear Audit with a full squad of 3" — each grants a cosmetic or a bond bump. (b) Track `bestApproval[venueId]` and show a per-venue high score. (c) After prestige, cleared venues can be re-cleared for prestige credit (ties to P5).
**Builds on:** `venueVisits`, `venuesCleared`, `state.finalSquad`, `state.queue.revealedIntel`.
**Fixes:** The brief's explicit "one reason to replay already-cleared venues" requirement. Currently cleared venues are dead content.

---

## Section 4 — Recommended MVP Subset

Build these first, in order; one sentence why each.

1. **P4 — Nightlife Codex screen (S–M).** ✅ IMPLEMENTED — `js/codex.js` (`CodexSystem`), Codex button in the planning app-header, modal overlay (z-index 48) showing night stats (runs, successes, win rate, current/best streak, Scene Legend badge), all 8 venues with cleared ✓ / locked unlock requirements, contacts (unlocked by name + trait, locked as silhouettes with human-readable unlock conditions), and regulars (name + home venue + times met). Backdrop-click + × close. All content escaped.
2. **P1 — Fix stranger-memory recurrence (M).** ✅ IMPLEMENTED — Save schema bumped to v2 (`SAVE_VERSION = 2`); `defaultProgress()` adds `regulars`, `currentStreak`, `bestStreak`. `load()` runs `_migrate()` → `_migrateV1toV2()` which synthesizes regulars from orphaned `strangerMemories`, re-keys memories under the new stable `regularId`, regenerates deterministic `portraitProps` via `_seededPortraitProps()`. `generateNeighbor()` spawns an existing regular (40% chance, one per run via `state.queue.regularSpawnedThisRun`) using `memoryId = regular.id` so `MemorySystem` lookups hit; `buildNeighborSystemPrompt` injects "you genuinely remember them". `promoteNeighborToRegular()` upserts on chat-close/end-of-night sweep (persisted memory OR affinity ≥ 70), enforces 6-per-venue cap evicting lowest `timesMet`/oldest. UI: "· regular — you've met" suffix in chat header; cyan talk marker on the queue canvas.
3. **P9 — Near-miss amplification + streaks (S).** ✅ IMPLEMENTED — `recordRun()` tracks `currentStreak`/`bestStreak` and sets `state.brokenStreak` on failure. `BouncerSystem.showResult` rejection subtitle flavors near-miss (within 15 of threshold: heartbreakingly/painfully/frustratingly close) + a "Near miss — within N of the door" row; success shows streak ("N nights in a row!") and a venue-unlock teaser when the next threshold is within 1 clear. `gameOver`/`missedLastEntry` show "Streak broken at N" when a streak ≥ 2 was broken.
4. **P6a + P6c — Two new cash sinks: reserve-a-spot and hire-a-promoter (M).** Why: cash is the first currency that breaks; two sinks that scale with venue tier stop late-game wealth from making the game pointless.
5. **P3 — Venue-specific event decks (M).** Why: the cheapest way to make run #5 feel different from run #2 — a few lines of event data per venue, no new systems.
6. **P5 — Post-win prestige loop (M).** Why: without it the game has no endgame; with it, the win becomes the start of the real grind.

Defer P2, P7, P8, P10, P11 to a second pass once the MVP proves the loop retains players.

---

## Section 5 — Shipped Progress (v2)

- **Schema v2 migration** ships with deterministic v1→v2 upgrade (orphaned stranger memories → named regulars, re-keyed; streak fields initialized).
- **Tests:** `tests/progression.test.mjs` covers migration, promotion/eviction, spawn determinism + one-per-run cap, and streak math. Full suite 48/48 green (`npm test`).
- **Files touched:** `js/save.js`, `js/data-phase1.js`, `js/chat.js`, `js/state.js`, `js/main.js`, `js/canvas.js`, `js/bouncer.js`, `js/queue.js`, `js/codex.js` (new), `index.html`, `tests/reset-run-state.test.mjs`, `tests/progression.test.mjs` (new).

