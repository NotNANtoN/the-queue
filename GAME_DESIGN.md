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

#### Unlockable Venues (After Completing Earlier Ones)
| Venue | Policy | Music | Dress Bias |
|-------|--------|-------|-----------|
| The Boardroom Penthouse | Ruthless | Tech-House 128 BPM | Smart Casual, Watches |
| Florian's Private Members | Ruthless | Minimal Techno 132 BPM | Invite-Only Aura |
| The Audit Chamber | Nightmare | Industrial 145 BPM | Full Uniform or Nothing |

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
- **Hope** (0–100): Starts at 70. Rises when the queue moves. Decays slowly when stalled. Crashes on negative events.
- **Squad Anxiety** (0–100): Starts at 10. Rises when stalled, when bad events trigger, or when the Hype Engine contact is present. If it hits 100, a squad member bails.

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

### The Dialogue Duel

A timed conversation with 3–5 exchanges. Each exchange:
1. Bouncer says something or asks a question.
2. You get 3 response options (one correct, one neutral, one bad).
3. Timer runs (4–8 seconds depending on difficulty). No response = worst outcome.

**Scoring**: Each exchange adds or removes points from a hidden "Approval Meter."
- Correct answer (using Intel): +30
- Neutral answer: +5
- Bad answer: -20
- No answer (timeout): -15

**Threshold**: You need to reach a venue-specific approval score to get in.
- Easy venue: 40 points needed (2 correct answers out of 4 is enough)
- Moderate: 60 points
- Ruthless: 85 points (basically need Intel for every exchange)
- Nightmare: 100 points (need perfect dialogue + max Style Match)

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

  A) "We're on the list under DJ Synthax's crew." [REQUIRES INTEL]
     → +30 (his eyebrow raises slightly, he checks the clipboard)

  B) "Anton, Rissal, and Pia."
     → +5 (neutral, he doesn't care about your actual names)

  C) "Does it matter? Just let us in, it's freezing."
     → -20 (he hates impatience)

[Beat. He looks at your shoes.]

Florian: "Interesting choice of footwear."

  A) [If wearing dark boots]: "Thanks. Berlin vintage." → +10
  B) [If wearing white sneakers + no intel]: "What about them?" → -15
  C) [If wearing white sneakers + HAVE INTEL about shoe bias]:
     "Yeah, I know — bit bold for tonight. But Synthax vouched for us." → +15 (intel override)

[Final exchange]

Florian: "Why should I let you in?"

  A) "Because we actually know the residents playing tonight." [REQUIRES INTEL about lineup]
     → +30

  B) "We just want to dance, man."
     → +5

  C) "Do you know who I am?"
     → -25 (instant fail with Florian)
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

## Progression & Meta-Loop

### Between Runs ("The Week")
- New contacts may appear in your phone (unlocked by successful entries or random events).
- Your "Reputation" grows with each successful entry → better starting Hope, more item budget.
- Failed attempts still grant XP toward unlocking new contacts.
- Certain contacts are only available after you've entered specific venues.

### Difficulty Scaling
- Later venues have: shorter timers, more bouncer exchanges, stricter Style requirements, rarer Intel availability in line, and higher flake rates on good contacts.
- The queue itself gets longer and has more negative events at higher tiers.

### Win Condition (MVP)
Successfully enter all 6 venues at least once. The final venue ("The Audit Chamber") is the ultimate challenge — a gauntlet that requires a perfect crew, full Intel, and flawless dialogue.

---

## Tech Notes (Implementation)

- **Single `index.html` file**, same philosophy as Turbo Kart.
- **No 3D engine needed** — this is UI-driven with CSS transitions, canvas for the queue visualization, and Web Audio for the soundscape.
- **State machine**: `PLANNING → FLAKE_ROLL → QUEUE → BOUNCER → RESULT`
- **Procedural generation**: Neighbors, events, and bouncer selection are randomized per run.
- **Audio**: Procedural synth kick loop with dynamic lowpass filter is the sonic backbone. Simple to implement with Web Audio API oscillators (similar to Turbo Kart's music system).
- **Save state**: `localStorage` for unlocked venues, contacts, reputation, and cash.
