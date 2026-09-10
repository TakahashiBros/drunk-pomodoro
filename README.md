# Drunk Pomodoro

A Pomodoro study timer where every completed study cycle earns you a beer. Instead of a progress bar, your goal is a shelf of beer cans — one per cycle — that crack open as you go, each with the sound of a real can being opened.

No build step and no package manager. It's three files and a browser.

---

## Running it

Open `index.html` in any modern browser:

```
open index.html
```

Chrome, Safari, Firefox and Edge all work.

Two notes on what the page reaches for at runtime:

- **Web Audio API** — used to synthesize the can-opening sound. Required.
- **Google Fonts** (`Caprasimo` for headings, `Figtree` for body text) — loaded over the network. Offline, the page falls back to `system-ui` and stays fully usable, just less characterful.

---

## How a session works

Three screens, shown one at a time inside the central card.

### 1. Setup

| Field | Meaning | Default | Range |
| --- | --- | --- | --- |
| **Study time** | Minutes of focus per cycle | 25 | 1–180 |
| **Drinking time** | The break between cycles | 5 | 1–60 |
| **Beers to earn** | One per study cycle | 4 | 1–20 |

Below the fields, *Tonight's shelf* previews your goal as a row of unopened cans. It follows the "Beers to earn" field as you type.

### 2. Timer

The session alternates `Study → Drink → Study → Drink → ...`, starting with study.

A **cycle counts as complete when a study period ends** — not when the break ends. So a 4-beer session is 4 study periods with 3 breaks between them; there's no trailing break after the last one. The moment the final study period ends, you go straight to the completion screen.

### 3. Complete

Shows how many beers you earned, the shelf of opened cans, and the total time you actually spent studying. *One more round* restarts with the same settings; *Change settings* takes you back to setup.

---

## The interface

**The ring** fills clockwise from twelve o'clock as the current period elapses — empty at the start, closed at the end. It's terracotta during study and sage green during drinking, matching the label inside it. Under the countdown, a line tells you what comes next (`then 5 min to drink`).

**The shelves** hold one can per cycle in your goal. They start closed and grey. When you finish a study period, the matching can opens: it turns amber, a hole appears in the lid, and foam pops out of the top. The timer screen pairs its shelf with a running *Earned* count.

**The controls:**

- **Pause / Resume** — freezes and restarts the countdown
- **Skip** — jumps to the next period immediately (skipping a study period still earns the beer, but only the time you actually sat there counts toward your study total)
- **Reset** — restarts the whole session from cycle 1
- **Change settings** — returns to the setup screen

---

## How it works under the hood

### State

Everything lives in a handful of module-level variables in `script.js`:

```js
mode                 // "study" or "break"
secondsLeft          // countdown for the current period
totalSecondsForPhase // length of the current period, used for the ring
cyclesCompleted      // beers earned so far
targetCycles         // the goal
studySecondsElapsed  // real seconds spent studying
```

`updateDisplay()` is the single function that renders all of that to the DOM. Nothing else touches the screen, so the display can never drift out of sync with the state.

### The clock is wall-clock based

The timer does **not** count down by subtracting one per tick. Instead it records `phaseStart = Date.now()` when a period begins, and each frame derives the remaining time from the real elapsed wall time:

```js
const elapsed = (Date.now() - phaseStart) / 1000;
const left = Math.max(0, Math.ceil(totalSecondsForPhase - elapsed));
```

This matters because browsers throttle `setInterval` in background tabs. A naive decrementing timer silently loses time whenever you switch away; this one stays anchored to the real clock and catches up on the next frame.

Frames run every 200 ms rather than every second, so the ring's CSS transition always has a fresh target to glide toward instead of stepping once per second.

Pausing stores how far into the period you'd got (`pausedElapsed`) and clears the interval. Resuming rewinds `phaseStart` by that amount, so the period picks up exactly where it left off.

### The progress ring

The ring is an SVG `<circle>` of radius 52, so its circumference is `2π × 52 ≈ 326.7` user units. That value is set as the `stroke-dasharray`, making the dash exactly as long as the path. Animating `stroke-dashoffset` from that length down to `0` slides the dash into view, which reads as the ring closing:

```js
progressArc.style.strokeDashoffset = ARC_LENGTH * (1 - progress);
```

The SVG itself carries `transform: rotate(-90deg)` so the fill starts at twelve o'clock instead of three.

### The cans

There are three shelves — one per screen — each holding its own copy of the same inline SVG, built by `fillCans()`.

The timer and complete shelves track progress: `updateCans()` toggles an `opened` class based on `i < cyclesCompleted`. The setup shelf is different — it previews *tonight's goal*, so it always renders closed cans and follows the input field rather than progress.

All the visual difference between a closed and an open can is CSS: fill colours transition over 0.5s, the hole fades in, and the foam circles run a `foam-pop` keyframe animation. Because the class is toggled rather than re-set, the foam animation fires exactly once, on the frame where the can actually opens.

### The can-opening sound

There's no audio file. The sound is synthesized at runtime from a two-second buffer of white noise, played twice through different filters:

1. **The crack** — the noise through a high-pass filter at 2.5 kHz, with the gain collapsing over 70 ms. That's the sharp metallic snap of the tab.
2. **The hiss** — the same noise through a band-pass filter whose centre frequency slides from 7 kHz down to 1.8 kHz over a second, fading out as it goes. That's the gas escaping.

The `AudioContext` is created lazily on first use, which is after you've clicked Start — browsers block audio until a user gesture has occurred.

The sound plays **only when a study period ends**, i.e. when a can actually opens. The end of a drinking period is silent.

### Study time tracking

`studySecondsElapsed` accumulates the change in `secondsLeft`, but only while `mode === "study"`. This counts *real* elapsed study time rather than multiplying cycles by the configured length — so pausing the timer or hitting Skip halfway through gives you an honest number on the completion screen instead of a planned one.

### Input clamping

A `<input type="number">` enforces its `min`/`max` on the stepper arrows but not on typed text, so `clampInput()` re-applies the declared bounds when a session starts. Without it, typing `500` into "Beers to earn" would render 500 cans across three shelves.

---

## Files

```
index.html   The three screens, plus the inline SVG for the ring
style.css    Everything visual, including the can states and foam animation
script.js    Clock, screen routing, can rendering, sound synthesis
```

## Customizing the look

The theme is a set of CSS custom properties at the top of `style.css`:

```css
--bg, --surface, --sand   /* cream grounds and the shelf              */
--accent, --accent-ink    /* terracotta: study mode, buttons, open cans */
--sage, --sage-ink        /* the second voice: drinking mode           */
--font-heading            /* Caprasimo, the display face               */
--font-body               /* Figtree                                   */
```

Change those and the whole app re-themes, cans included.
