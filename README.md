# Drunk Pomodoro

A Pomodoro study timer where every completed study cycle earns you a beer. Instead of a progress bar, your goal is a row of beer cans — one per cycle — that crack open as you go, each with the sound of a real can being opened.

No build step, no dependencies, no install. It's three files and a browser.

---

## Running it

Open `index.html` in any modern browser. That's it.

```
open index.html
```

Chrome, Safari, Firefox and Edge all work. The only browser requirement is the Web Audio API, which is used to synthesize the can-opening sound.

---

## How a session works

The app has three screens, shown one at a time inside the central card.

### 1. Setup

You configure three things before starting:

| Field | Meaning | Default |
| --- | --- | --- |
| **Study time** | Minutes of focused work per cycle | 25 |
| **Drinking time** | Minutes of break between cycles | 5 |
| **Number of study cycles** | How many beers you're aiming for | 4 |

### 2. Timer

The session alternates `STUDY → DRINK → STUDY → DRINK → ...`, starting with study.

A **cycle counts as complete when a study period ends** — not when the break ends. So a 4-cycle session is 4 study periods with 3 breaks between them; there's no trailing break after the last one. The moment the final study period ends, you go straight to the completion screen.

### 3. Complete

Shows how many beers you earned, a nudge to keep going, and the total time you actually spent studying.

---

## The interface

**The semicircle** fills up as the current period elapses — empty at the start, full when it ends. It's red during study and green during drinking, matching the mode label underneath.

**The cans** sit outside the card, one per cycle in your goal. They start closed and grey. When you finish a study period, the matching can opens: it turns amber, the lid goes silver, a hole appears in the tab, and foam pops out of the top. They stay on screen on the completion page as a trophy shelf.

**The controls:**

- **Pause / Resume** — stops and restarts the countdown
- **Skip** — jumps to the next period immediately (skipping a study period still counts the cycle and opens the can)
- **Reset** — restarts the whole session from cycle 1
- **Change settings** — returns to the setup screen

---

## How it works under the hood

### State

Everything lives in a handful of module-level variables in `script.js`:

```js
mode                 // "study" or "break"
secondsLeft          // countdown for the current period
totalSecondsForPhase // length of the current period, used for the arc
cyclesCompleted      // beers earned so far
targetCycles         // the goal
studySecondsElapsed  // real seconds spent studying
```

`updateDisplay()` is the single function that renders all of that to the DOM. Nothing else touches the screen, so the display can never drift out of sync with the state.

### The timer loop

A plain `setInterval(tick, 1000)`. Each tick decrements `secondsLeft`; when it goes below zero, `switchMode()` flips to the other period and resets the countdown.

Pausing just calls `clearInterval` — the state is untouched, so resuming picks up exactly where it left off.

### The progress arc

The semicircle is an SVG `<path>` drawn as an arc of radius 90, so its length is `π × 90 ≈ 282.7` user units. That value is set as the `stroke-dasharray`, making the dash exactly as long as the path. Animating `stroke-dashoffset` from that length down to `0` slides the dash into view, which reads as the arc filling up:

```js
const progress = elapsed / totalSecondsForPhase;   // 0 → 1
progressArc.style.strokeDashoffset = ARC_LENGTH * (1 - progress);
```

### The cans

`renderCans()` builds one `<div class="can">` per target cycle, each containing the same inline SVG. `updateCans()` then only toggles an `opened` class based on `i < cyclesCompleted`.

All the visual difference between a closed and an open can is CSS — fill colours transition over 0.5s, the hole fades in, and the foam circles run a `foam-pop` keyframe animation. Because the class is toggled rather than re-set, the foam animation fires exactly once, on the tick where the can actually opens.

### The can-opening sound

There's no audio file. The sound is synthesized at runtime from a two-second buffer of white noise, played twice through different filters:

1. **The crack** — the noise through a high-pass filter at 2.5 kHz, with the gain collapsing over 70 ms. That's the sharp metallic snap of the tab.
2. **The hiss** — the same noise through a band-pass filter whose centre frequency slides from 7 kHz down to 1.8 kHz over a second, fading out as it goes. That's the gas escaping.

The `AudioContext` is created lazily on first use, which is after you've clicked Start — browsers block audio until a user gesture has occurred.

The sound plays **only when a study period ends**, i.e. when a can actually opens. The end of a drinking period is silent.

### Study time tracking

`studySecondsElapsed` is incremented once per tick, but only while `mode === "study"`. This counts *real* elapsed study time rather than multiplying cycles by the configured length — so pausing the timer or hitting Skip halfway through gives you an honest number on the completion screen instead of a planned one.

---

## Files

```
index.html   All three screens, plus the inline SVG for the progress arc
style.css    Everything visual, including the can states and foam animation
script.js    Timer logic, screen routing, can rendering, sound synthesis
```

## Customizing the look

The colour scheme is a set of CSS custom properties at the top of `style.css`:

```css
--bg           /* page background       */
--card-bg      /* the central card      */
--study-color  /* arc + label, studying */
--break-color  /* arc + label, drinking */
--primary      /* buttons               */
```

Change those five values and the whole app re-themes, cans included.
