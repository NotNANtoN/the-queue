# The Queue: Access Granted (MVP Plan)

A tactical social-engineering and resource-management roguelite simulator about standing in line, gathering intel, managing squad vibes, and facing the ultimate gatekeeper: the bouncer.

---

## 🛠️ MVP Game Loop

```
+-----------------------------------------------------+
|                      PHASE 0                        |
|   Select Venue (Music/Rules) & Assemble Crew        |
+-----------------------------------------------------+
                          |
                          v
+-----------------------------------------------------+
|                      PHASE 1                        |
|     Stand in the Queue (Hope & Despair Cycles)      |
|  - Talk to front/back  - Gather Intel  - Manage Anxiety|
+-----------------------------------------------------+
                          |
                          v
+-----------------------------------------------------+
|                      PHASE 2                        |
|                  Face the Bouncer                   |
|  - Dialogue choices  - Apply Intel  - Gatekeeper Test|
+-----------------------------------------------------+
                          |
            +-------------+-------------+
            |                           |
            v                           v
+-----------------------+   +-----------------------+
|        SUCCESS        |   |        FAILURE        |
|  "Doors slide open!"  |   |    "Not tonight."     |
|   [LEVEL COMPLETE]    |   |     [GAME OVER]       |
+-----------------------+   +-----------------------+
```

---

## 📅 Step-by-Step MVP Milestones

### Milestone 1: Phase 0 — Squad & Club Setup
*   **The Mobile Phone Lobby UI**: A sleek, vertical smartphone interface where you plan your Friday night.
*   **Club Registry (Venues)**:
    1.  *Mainframe Basement* (Mellow deep house, lenient door policy, bouncer values comfort).
    2.  *The Compliance Vault* (Relentless techno, strict dark-apparel dress code, bouncer values attitude).
    3.  *The Boardroom Penthouse* (Posh tech-house, ultra-exclusive, bouncer values social-status indicators).
*   **The Contact Roster (Squad Building)**:
    *   Select up to 3 crew members from your phone contacts.
    *   Each member has:
        *   **Style**: (Casual, Sleek, Formal, Eccentric).
        *   **Anxiety Threshold**: (How long they can stand waiting).
        *   **Music Preference**: Matching or mismatching the club's genre.
        *   **Traits**:
            *   *The Hype-man*: Boosts queue speed, but increases squad anxiety.
            *   *The Promoter*: Lowers bouncer restrictiveness, but has a high weekend *Flake Rating* (might drop out right before you arrive).
            *   *The Chill Coder*: Low profile, highly resilient to waiting, carries lighters/gum.

### Milestone 2: Phase 1 — The Hope & Despair Engine (Standing in Line)
*   **The Waiting Screen**: A stylized, top-down or isometric 2D queue line. People slowly sway, the club bass thumps from behind the doors (lowpass-filtered audio).
*   **The Hope & Despair Cycle**:
    *   A dynamic queue progress bar that represents the line movement.
    *   *The Cycle*: The queue moves forward (Hope rises) -> The queue stalls for a long period (Anxiety rises, Hope decays) -> A VIP passes the line (Despair spike).
    *   If any squad member's Anxiety peaks or squad Hope hits 0, they bail, ruining your group presence.
*   **Micro-Interactions (The Grid Neighbors)**:
    *   You can click on the passenger directly in front or behind you.
    *   **The Barter System**: Give them items (Gum, Water, Lighter, Cash) to buy information.
    *   **Intel Acquisition**: Learn bouncer traits or secret entry conditions (*"I heard Florian is running the door tonight. He hates white sneakers, but if you mention the promoter 'DJ Synthax', he lets you in instantly."*).
*   **Queue Events**:
    *   *The Line-Cutter*: A flashy, arrogant group pushes in front. Do you:
        *   Confront them (increases squad vibe, but risks bouncer attention).
        *   Bribe them (costs cash).
        *   Ignore them (decreases squad Hope).

### Milestone 3: Phase 2 — Confronting the Bouncer
*   **The Gatekeeper Interaction**:
    *   The lowpass filter on the music partially lifts. The camera zooms in on the bouncer’s dark silhouette standing under a glowing neon archway.
    *   The bouncer inspects your squad and makes an observation or asks a sharp question.
*   **The Dialogue Duel**:
    *   A timed conversation tree appears.
    *   Use the **Intel** you gathered in line to choose your answers correctly.
    *   The bouncer evaluates your squad's total Style match, Music preference alignment, and your dialogue choices.
*   **Outcomes**:
    *   *Success*: The doors slide open, the music explodes into high-fidelity sound, and you get the level complete stats screen.
    *   *Failure*: *"Not tonight."* The screen fades to black, and your squad is sent home.

---

## 🎨 Visual & Audio Theme

*   **Color Palette**: Regulaido deep lavenders, cyber greens (`#39ff14`), hot pinks, and glassmorphic translucent panels.
*   **Soundscape (Web Audio API)**:
    *   Procedural synth-loop engine running a rhythmic four-on-the-floor kick.
    *   *In Line*: Lowpass filter at 300Hz with reverb (gives the "muffled club bass through thick walls" feeling).
    *   *Line Progress*: Every step closer to the door increases the cutoff frequency slightly.
    *   *Access Granted*: Cutoff slides to 20000Hz (full stereo high-fidelity blast).
