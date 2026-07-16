# The Queue — Gameplay System Design

Design doc for the pacing/difficulty rework. Status: **implemented.**

## 1. Diagnosis (current build)

- `moveQueue()` is only called from `doWait()` — the line literally never moves unless
  you click Wait. Chatting costs 1 min and delays your own progress. The optimal
  strategy at every venue is to spam Wait.
- There is no deadline. `gameTime` starts at 11:35 PM and nothing ever happens no
  matter how late it gets, so time pressure exists only as slow hope/anxiety drift.
- Door difficulty is real (thresholds 40/60/85/100 by tier) but illegible: the player
  is never told that waiting alone can't clear a Ruthless door.
- Result: Wait is both the safest and the only progressing action. The social systems
  (chat, intel, alliances) are content the mechanics quietly punish you for using.

## 2. Design pillars

1. **Time is the only currency.** Every action spends minutes. Nothing else is a cost.
2. **The queue moves on elapsed time, not on Wait.** Waiting = fast-forwarding,
   nothing more. You reach the door quickly and unprepared, or slowly and prepared.
3. **The door demands preparation scaled by tier.** Easy doors forgive; Nightmare
   doors require everything the social systems can produce.
4. **Deadlines make the trade-off real.** Miss last entry and the night is over.

## 3. Systems

### 3.1 Time & queue movement

- Keep a `lastMoveRollAt` timestamp on `state.queue`. Whenever `advanceTime()` crosses
  a 5-minute boundary, roll queue movement (same `moveChance`/`moveMin..moveMax`
  mechanics, `turnBonus` becomes time-based: `min(0.20, elapsedTicks * 0.02)`).
- Random events also roll on these 5-minute ticks (same `eventChance`), but only
  interrupt between actions — if the player is mid-chat, the event queues and fires
  when the chat closes ("while you were talking, ...").
- **Wait**: advances 5 min instantly. Its only purpose is fast-forwarding.
- **Chat message** (neighbor or crew): 2 min (up from 1). Giving an item: 1 min.
  Kiosk: 2 min. Use item: 1 min. A real prep conversation (~6 messages) ≈ 12 min
  ≈ 2.4 waits — talking finally *spends the night*, as it should.
- If the queue moves while a chat is open, show it inline as a system bubble
  ("the line shuffles forward — you're at #8 now") instead of interrupting.

### 3.2 Last entry (the deadline)

- Each venue gets a `lastEntry` clock time. If you are still in the queue when it
  passes, the bouncer waves the line away → run fails (a new, gentler fail screen:
  "the door shut at 1 AM — walk home", still records the run).
- A visible countdown appears in the queue HUD once you're within 30 min of cutoff.
- This is the anti-grind: you cannot farm affinity forever; every chat message is
  bought with deadline slack.

### 3.3 Restlessness (anti-wait pressure)

- Consecutive Waits stack a small penalty: the 2nd Wait in a row costs +2 extra
  anxiety, 3rd +4, 4th +6 (cap +6). Any social action (chat message, kiosk, item,
  crew) resets the streak. Flavor: standing in silence makes the night feel longer.
- Deliberately mild — waiting stays viable at Easy tiers, it just never feels free.

### 3.4 Door readiness (legible preparation)

Existing bouncer thresholds stay (Easy 40 / Moderate 60 / Ruthless 85 / Nightmare
100), but preparation becomes legible and the required amount scales:

| Prep source | Approval value (existing mechanics, tuned) |
|---|---|
| Dress/vibe match | +10..+20 (unchanged) |
| Charmer trait (flirt via chat) | +5 |
| Intel used in conversation | +20 scripted / prompt-weighted LLM |
| Ally vouch (alliance via chat) | +5..+15 |
| Niko in squad | +15 |

- New HUD element: a small **"Door read"** hint on the queue screen (tap the door):
  shows the venue's dress code (already known), a one-line strictness read
  ("this door turns away half the line"), and greys in prep you've secured
  (intel ✓, ally ✓, look ✓). No numbers shown — just what you have vs. what the
  door looks like. This teaches "waiting alone won't cut it here" *before* the front.
- Tier expectations (with base style match, no prep):
  Easy — clearable by waiting alone. Moderate — needs roughly one prep source.
  Ruthless — two to three. Nightmare — everything plus a good conversation.

### 3.5 Retuned venue table

Expected arrival = startPos / (moveChance × avgMove) × 5 min, from an 11:35 PM start.
Slack = time available for chatting/kiosk before cutoff.

| Tier | startPos | moveChance/tick | move | E[arrival] | lastEntry | slack |
|---|---|---|---|---|---|---|
| Easy | 12 | 0.45 | 2–4 | ~12:20 AM | 1:00 AM | ~40 min |
| Moderate | 18 | 0.40 | 2–4 | ~12:50 AM | 1:45 AM | ~55 min |
| Ruthless | 25 | 0.34 | 1–4 | ~1:35 AM | 2:30 AM | ~55 min |
| Nightmare | 28 | 0.30 | 1–3 | ~2:20 AM | 3:00 AM | ~40 min |

Harder queues are longer *and* need more of the slack spent on prep, while passive
hope drain (unchanged: −0.3/min, ×1.6 sober) makes long nights demand kiosk/crew
resource management. Numbers are starting points — validated by simulation, below.

### 3.6 What explicitly does NOT change

- Hope/anxiety drift rates, bail thresholds, kiosk prices, item effects.
- Bouncer conversation mechanics, tools, thresholds, silence timer.
- Chat tool effects (affinity, intel, alliance, exchange_numbers).
- Queue length (per your call: not halved).

## 4. Validation: simulation harness

Add `tests/pacing-sim.test.mjs`: a monte-carlo bot (no LLM, no DOM) that plays
pure-Wait and wait+scripted-prep strategies over the extracted math. Assertions:

- Easy, pure Wait: reaches door before cutoff ≥ 95% of runs, hope > 0 ≥ 80%.
- Nightmare, pure Wait: arrives before cutoff, but door approval < threshold
  ≥ 95% of runs (waiting must not clear Nightmare).
- All tiers: expected arrival within ±20 min of the table above.

This pins the tuning table so future balance edits fail loudly.

## 5. Implementation stages

1. **Time-driven movement + action costs** (queue.js, chat.js, kiosk.js, use-item.js;
   the core inversion; sim harness lands here).
2. **Last entry + countdown + fail screen** (data.js, queue.js, ui.js, main.js).
3. **Restlessness + door-read HUD** (queue.js, ui.js, bouncer.js hint data).
4. Tuning pass against the simulation, docs update.
