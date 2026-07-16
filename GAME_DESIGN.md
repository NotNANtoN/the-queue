# The Queue: Access Granted — Detailed Game Design

---

## Phase 0: Friday Night Planning

### The Phone Screen
The entire phase plays out on a stylized smartphone UI. Dark background, notification bubbles, group chat threads. The player swipes between tabs.

### Tab 1: Venue Selection

Each venue has:
- **Name & Vibe** (visual theme + music genre)
- **Door Policy** (Easy / Moderate / Ruthless)
- **Tonight's Bouncer** (hidden until intel is gathered, or revealed by a Promoter contact)
- **Music Style** (Deep House / Techno / Tech-House / Drum & Bass / Disco)
- **Dress Code Bias** (Dark Minimal / Streetwear / Smart Casual / Eccentric OK)

#### Starter Venues (Unlocked)
| Venue | Policy | Music | Dress Bias |
|-------|--------|-------|-----------|
| Mainframe Basement | Easy | Deep House 122 BPM | Dark Minimal |
| The Compliance Vault | Moderate | Techno 136 BPM | All Black, No Logos |
| Neon Pharmacy | Moderate | Drum & Bass 174 BPM | Streetwear / Eccentric |
| Sisyphos | Easy | Deep House 120 BPM | Anything Goes (vibe check) |
| Südpol | Moderate | Techno 130 BPM | Vibe Over Fashion (vibe check) |

#### Unlockable Venues (After Completing Earlier Ones)
| Venue | Policy | Music | Dress Bias |
|-------|--------|-------|-----------|
| The Boardroom Penthouse | Ruthless | Tech-House 128 BPM | Smart Casual, Watches |
| Florian's Private Members | Ruthless | Minimal Techno 132 BPM | Invite-Only Aura |
| The Audit Chamber | Nightmare | Industrial 145 BPM | Full Uniform or Nothing |

*(8 venues total.)*

### Tab 2: Squad Assembly

You pick 0–3 crew members from your contact list. Going solo is possible but harder (lower collective Vibe, no backup intel sources). Going with too many people makes the bouncer more suspicious ("big groups are trouble").

#### Contact Properties
Each contact has:
- **Name** & **Avatar**
- **Style Tags**: e.g. [Dark Minimal, Chains, No Logo] or [Bright Colors, Vintage, Sneakers]
- **Music Pref**: What genre they vibe with (affects their Anxiety in line)
- **Anxiety Threshold**: 1–10 scale. Low = they leave early. High = they can endure hours.
- **Flake Rating**: 0–100%. Chance they text "sorry can't make it" after you've committed to the venue.
- **Special Trait** (one per contact):
  - *Hype Engine*: Queue moves 15% faster when they're present, but everyone's anxiety rises 20% faster too.
  - *Connected Promoter*: Bouncer difficulty drops one tier, but 40% flake chance.
  - *The Chill Coder*: Starts with 2 barter items (lighter, gum). Anxiety threshold 9/10. Boring but reliable.
  - *The Fashionista*: Doubles your squad's Style Match score, but refuses to go to venues below "Moderate" policy.
  - *Chaos Agent*: Triggers bonus random events in line (can be good or bad). Unpredictable.
  - *The Insider*: Starts the queue phase with one free piece of Intel already revealed.
  - *The Dealer (Dex)*: Starts with a random kiosk substance in inventory.
  - *The Diplomat (Yuki)*: −25% anxiety gains for the whole squad while present.
  - *The Local Legend (Niko)*: +15 starting bouncer approval.
  - *The Networker (Priya)*: +50% bond gains on successful runs.
  - *The Shadow (Ghost)*: Invisible to bouncers — doesn't count toward group size.
  - *The Algorithm (Jasper)*: Narrows queue movement variance (more predictable waits).
  - *The Photographer (Zara)*: +1 reputation on successful runs (capped with base rep gain).

#### Wardrobe perks (when equipped)
- *Lucky Charm*: −5% flake rate during the pre-queue roll.
- *Hip Flask*: −10 anxiety at queue start (+3 group hope from wardrobe bonus).
- *Instant Camera (Polaroid)*: +50% bond gains on successful runs (stacks with Priya).

#### Item notes
- *Earplugs*: passive −40% anxiety gain while owned; active use consumes them and halves anxiety gains for the rest of the night.
- *Fake VIP Wristband*: visible to the bouncer; can be shown during the door phase (risky).
- *Rissal's starter kit*: gum + lighter granted at queue start when Rissal is in the final squad.

#### The Flake Roll
After you confirm your squad and venue, the game does a "loading" animation ("Friday 11:30 PM — Meeting Point"). During this, each contact's Flake Rating is rolled. If they flake:
- You get a notification bubble: *"Yo sorry bro, deploy broke prod, can't come 😭"*
- Your remaining squad adjusts. If everyone flakes, you go solo.

### Tab 3: Loadout / Items
You start each run with a small budget of "Friday Cash" (earned from previous successful entries). You can pre-buy:
- **Gum** (cheap, low-value barter item)
- **Lighter** (medium barter value)
- **Water Bottle** (high barter value — it's 2 AM and everyone is dehydrated)
- **VIP Wristband (Fake)** (expensive, risky — can boost or backfire at bouncer)
- **Earplugs** (reduces Anxiety gain from loud queue events)

---

## Phase 1: The Queue

### Visual Layout
A vertical strip showing the queue from above or from a slight isometric angle. Your squad is a cluster of colored dots/avatars. The club entrance (glowing neon arch) is visible at the top of the screen but far away. People ahead of you sway gently. The bass thumps rhythmically (lowpass-filtered).

### Core Mechanic: The Hope & Despair Engine

Two meters run simultaneously:
- **Hope** (0–100): Starts at 70. Rises when the queue moves. Decays slowly when stalled. Crashes on negative events. If it hits 0, everyone goes home.
- **Squad Anxiety** (0–100): Starts at 10. Rises when stalled, when bad events trigger, or when the Hype Engine contact is present. If it hits 100, a random squad member bails.

The queue itself advances in **bursts**, not smoothly:
1. Long stall (30–90 seconds of real time, compressed with a "time passes" animation).
2. Sudden burst forward (3–8 positions). Hope spikes.
3. Another stall. Anxiety creeps.
4. Occasionally a VIP group walks past the entire line → Despair event (Hope drops 15, Anxiety +10).

The player's job is to manage these meters using interactions and item usage.

### Interaction: Talking to Neighbors

At any time during a stall, you can tap on:
- **Person Ahead**: They might share intel, or be annoyed, or try to sell you something.
- **Person Behind**: More likely to be friendly (they want you to move). Might offer items in exchange for favors.

Intel comes from neighbor conversation — flirting, alliances, and intel sharing emerge from chat tool calls (`accept_flirt`, `form_alliance`, `share_intel`), not separate action buttons.

### Conversational Persuasion (Emergent via Chat)

During conversation with neighbors, the player can naturally convince people to:
- **Leave the queue** — talk them into giving up ("It's not worth it tonight", "The bouncer is rejecting everyone"). The NPC decides based on their disposition and affinity whether to bail.
- **Swap spots** — ask them to let you ahead. Requires rapport or a compelling offer.

These are NOT buttons — they emerge from the LLM conversation. The NPC has instructions in their system prompt about when they'd leave or swap, varying by disposition:
- Anxious: very susceptible to being talked out of waiting
- Drunk: easily swayed if someone suggests going elsewhere
- Hostile: already annoyed, might say "screw this" if pushed
- Friendly: committed, rarely leaves unless extreme persuasion
- Neutral: patient, takes a LOT to convince

Success scales with **disposition**, **affinity**, and conversation length (minimum 2-3 exchanges before they'd consider it).

Each neighbor is procedurally generated with:
- **Disposition**: Friendly / Neutral / Hostile / Drunk / Anxious
- **Knowledge**: May or may not know something about tonight's bouncer.
- **Wants**: Might want an item from you in exchange for intel.

#### Dialogue Structure (Simple Branching)
```
[You tap Person Ahead]

"Hey, been here long?"

A) "Yeah, like an hour. The bouncer's being weird tonight."
   → Follow-up: "Weird how?"
      → INTEL REVEALED: "He's rejecting everyone in white shoes."

B) "Mind your own business."
   → Dead end. Try the person behind you instead.

C) "Yo, you got a lighter? I'll tell you something useful."
   → BARTER PROMPT: Give Lighter? [Yes / No]
   → If yes: INTEL REVEALED: "The password tonight is 'Systematic Review'."
```

### Intel System

Intel is the key resource for Phase 2. Each bouncer has 2–4 hidden conditions. Intel reveals them one by one.

Example bouncer conditions for "The Compliance Vault":
- ❌ Rejects white sneakers
- ✅ Responds to name-drop "DJ Synthax"
- ✅ Likes groups of exactly 3 (not 2, not 4)
- ❌ Hates people who seem too eager

You can gather 0–3 pieces of intel during Phase 1 depending on how well you barter and who your neighbors are. Going in blind is possible but risky.

### Queue Events (Random Triggers)

| Event | Effect | Player Choice |
|-------|--------|---------------|
| Line-Cutter Group | Pushes ahead of you (-2 positions, Hope -10) | Confront / Bribe / Ignore |
| Street Performer | Entertaining distraction (Anxiety -5 for whole squad) | Watch / Ignore / Tip for Intel |
| Rain Starts | Everyone's mood drops (Anxiety +8) | Use umbrella item if you have one |
| Bouncer Steps Out | He scans the line. Your squad's Style is evaluated silently. | Stand tall / Look away / Adjust outfit |
| Someone Leaves the Line | Queue advances (+1, Hope +5) | — |
| Your Contact Gets Antsy | Squad member threatens to leave | Reassure / Bribe with drink / Let them go |
| A Friend Spots You | Random bonus contact appears and joins your squad mid-line | Accept / Decline |

---

## Phase 2: The Bouncer

### Setup
The screen transitions. The muffled bass gets louder. The queue behind you fades into blur. You now face the bouncer — a large, shadowed figure under the neon entrance arch. Your squad stands slightly behind you.

### Bouncer Archetypes

Each venue has a pool of possible bouncers. One is randomly selected per run.

| Bouncer | Personality | Soft Spot | Trigger |
|---------|------------|-----------|---------|
| Florian | Cold, corporate, evaluative | Respects confidence + name-drops | Hates nervousness, fidgeting |
| Big Marko | Intimidating but fair | Respects honesty, small groups | Hates arrogance, loud people |
| DJ-Turned-Bouncer Kai | Chill, music-obsessed | Loves genre knowledge, vinyl talk | Hates people who "don't know the lineup" |
| The Silent One | Says almost nothing, just stares | Evaluates pure Style Match score | No dialogue helps — it's all appearance |
| Desk Lady Mira | Clipboard, guest list pretense | Name on the list (requires Promoter or Insider intel) | Rejects anyone who argues |

### The Dialogue Duel (Free-Text LLM + Tools)

The bouncer phase is a timed, free-text conversation powered by the on-device LLM. There are no multiple-choice buttons — you type what you say, and the bouncer responds in character.

**Flow:**
1. Bouncer speaks first (mood/backstory + opening line).
2. You reply in free text under a policy-based timer (Easy ≈ 16s, Nightmare ≈ 8s per turn).
3. The model uses structured **tool calls** (not bracket tags): `approve`, `disapprove`, `inspect_bag`, `let_in`, `reject`, `ban`.
4. Every bouncer turn must include `approve` or `disapprove` (typically ±5–35 approval).
5. Conversation ends when the bouncer calls `let_in`, `reject`, or `ban` — usually within 3–5 exchanges.

**Approval meter:** Starts from Style Match bonus + queue traits (Charmer, Queue Alliance, Niko's +15, etc.). You need to reach a venue-specific threshold:
- Easy: 40 · Moderate: 60 · Ruthless: 85 · Nightmare: 100  
(Pia in squad eases the effective tier by one step for threshold and timer.)

**Intel in dialogue:** Facts learned in line (password, headliner, bouncer name, dress tips, etc.) are injected into the bouncer system prompt as true intel the player *may* mention. Street Cred, Insider Info, Charmer, and Queue Alliance traits also appear in what the bouncer "sees."

**Interjections:** Queue allies can vouch; squad members can chime in. The bouncer reacts to these in-character.

**Items at the door:** Bag contents are visible on `inspect_bag`. Fake VIP wristband can be shown via the inventory button — prompt-level only, no extra tools.

**Silence:** Letting the timer expire counts as awkward silence (−15 approval).

### Style Match Bonus
Before dialogue starts, the bouncer silently evaluates your squad's combined Style Tags against the venue's Dress Code Bias. This gives you a starting bonus:
- Perfect match: +20 starting approval
- Partial match: +10
- Mismatch: +0
- Offensive mismatch (e.g., bright sneakers at all-black venue): -10 starting penalty

### Example Dialogue (The Compliance Vault, Bouncer: Florian)

```
[Florian looks at your group. Arms crossed.]

Florian: "Names?"

You type: "We're here for DJ Synthax's set — Synthax crew."

→ LLM may approve +20 if intel matches; disapprove if tone is off.

[Beat. He looks at your shoes.]

You type: "Berlin vintage boots — bit bold for tonight, but we know the password."

→ Style + intel in natural language; bouncer tools adjust approval.

[Final exchange — bouncer calls let_in or reject when convinced.]
```

### Outcome

**Success** (approval >= threshold):
- Florian steps aside. The heavy door swings open.
- The lowpass filter on the music sweeps from 300Hz → 20000Hz in 1.5 seconds.
- Screen fills with neon light and particle burst.
- Stats screen: Time waited, Intel gathered, Squad intact (Y/N), Style bonus.
- Unlock next venue tier.

**Failure** (approval < threshold):
- Florian: *"Not tonight."*
- The music cuts. The neon dims.
- Your squad disperses into the night. Brief sad animation.
- You keep any Intel contacts you made (persistent between runs).
- Try again next Friday.

---

## Phase 3: Inside the Club

After a successful door conversation, a short club scene plays:
1. **Flavor cards** (2–3): atmospheric beats with no mechanical rewards.
2. **One choice**: stick with your crew (+bond), work the room (~67% contact unlock + rep), or chase the night (50% cash/item gamble).
3. **Sunrise** card and results screen.

Tap to skip flavor and jump straight to the choice; after the choice resolves, tap or use **Leave at Sunrise** to finish.

---

## Progression & Meta-Loop

### Between Runs ("The Week")
- New contacts may appear in your phone (unlocked by successful entries or random events).
- **Reputation** grows with each run (+3 success / +1 failure, +1 more with Zara on success). Higher rep unlocks better **jobs** (weekly pay), new contacts, and contributes to venue/contact unlock gates — it does **not** directly boost starting Hope.
- Failed attempts still grant rep and small bond gains.
- Certain contacts are only available after you've entered specific venues.

### Difficulty Scaling
- Later venues have: shorter timers, more bouncer exchanges, stricter Style requirements, rarer Intel availability in line, and higher flake rates on good contacts.
- The queue itself gets longer and has more negative events at higher tiers.

### Win Condition
Successfully enter all 8 venues at least once. The first time you clear the final venue, a one-time **Scene Legend** victory screen appears (`progress.wonAt` is saved) — every door in the city is open. You can keep playing Fridays after that; there is no hard game over. The final venue ("The Audit Chamber") remains the ultimate challenge — a gauntlet that requires a strong crew, solid intel, and a convincing door conversation.

---

## Tech Notes (Implementation)

- **Classic scripts** under `js/`, loaded in order by `index.html` (shared global scope, no modules).
- **No 3D engine** — UI-driven with CSS transitions, canvas for queue/bouncer/club visuals, Web Audio for soundscape.
- **State machine**: `BOOT → PLANNING → FLAKE_ROLL → LOADING → QUEUE → BOUNCER → CLUB → RESULT` (then back to `PLANNING`).
- **Procedural generation**: Neighbors, events, DJ lineup, and bouncer (deterministic per venue per run) are randomized per night.
- **Audio**: Procedural synth kick loop with dynamic lowpass filter.
- **Save state**: `localStorage` for unlocked venues, contacts, reputation, bonds, wardrobe, and cash.
