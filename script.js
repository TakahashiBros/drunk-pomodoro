const setupScreen = document.getElementById("setup-screen");
const timerScreen = document.getElementById("timer-screen");
const completeScreen = document.getElementById("complete-screen");

const studyInput = document.getElementById("study-input");
const breakInput = document.getElementById("break-input");
const cyclesInput = document.getElementById("cycles-input");
const startBtn = document.getElementById("start-btn");

const modeLabel = document.getElementById("mode-label");
const timeDisplay = document.getElementById("time-display");
const nextLabel = document.getElementById("next-label");
const cycleCount = document.getElementById("cycle-count");
const earnedCount = document.getElementById("earned-count");
const progressArc = document.getElementById("progress-arc");

const setupCans = document.getElementById("setup-cans");
const timerCans = document.getElementById("timer-cans");
const completeCans = document.getElementById("complete-cans");

const toggleBtn = document.getElementById("toggle-btn");
const skipBtn = document.getElementById("skip-btn");
const resetBtn = document.getElementById("reset-btn");
const settingsBtn = document.getElementById("settings-btn");
const completeSettingsBtn = document.getElementById("complete-settings-btn");
const finalCycles = document.getElementById("final-cycles");
const finalStudyTime = document.getElementById("final-study-time");
const newSessionBtn = document.getElementById("new-session-btn");

const ARC_RADIUS = 52;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS; // full ring
progressArc.style.strokeDasharray = ARC_LENGTH;

let studyMinutes = 25;
let breakMinutes = 5;
let targetCycles = 4;
let mode = "study";
let totalSecondsForPhase = studyMinutes * 60;
let secondsLeft = totalSecondsForPhase;
let cyclesCompleted = 0;
let studySecondsElapsed = 0;

// The phase clock is wall-clock based, so the ring fills smoothly and the
// countdown stays honest when the tab is throttled in the background.
let phaseStart = Date.now();
let pausedElapsed = 0;
let running = false;
let intervalId = null;

let audioCtx = null;
let noiseBuffer = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const length = audioCtx.sampleRate * 2;
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return audioCtx;
}

// "Tsss-psshhh": the sharp crack of the tab followed by escaping gas.
function playCanOpen() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;

  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer;
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = "highpass";
  crackFilter.frequency.value = 2500;
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  crack.connect(crackFilter).connect(crackGain).connect(ctx.destination);
  crack.start(now);
  crack.stop(now + 0.1);

  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = "bandpass";
  hissFilter.Q.value = 0.7;
  hissFilter.frequency.setValueAtTime(7000, now + 0.05);
  hissFilter.frequency.exponentialRampToValueAtTime(1800, now + 1.0);
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.0001, now + 0.05);
  hissGain.gain.exponentialRampToValueAtTime(0.3, now + 0.15);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  hiss.connect(hissFilter).connect(hissGain).connect(ctx.destination);
  hiss.start(now + 0.05);
  hiss.stop(now + 1.3);
}

const CAN_SVG = `
  <svg class="can-svg" viewBox="0 0 44 90">
    <g class="can-foam">
      <circle cx="16" cy="12" r="3.4" />
      <circle cx="24" cy="7" r="4.2" />
      <circle cx="30" cy="13" r="3" />
    </g>
    <ellipse class="can-base" cx="22" cy="80" rx="14" ry="4" />
    <rect class="can-body" x="8" y="24" width="28" height="58" rx="7" />
    <rect class="can-band" x="8" y="44" width="28" height="17" />
    <path class="can-neck" d="M 8 34 L 11 19 L 33 19 L 36 34 Z" />
    <ellipse class="can-lid" cx="22" cy="19" rx="11.5" ry="3.6" />
    <ellipse class="can-hole" cx="22" cy="18.4" rx="5.5" ry="2" />
    <ellipse class="can-tab" cx="22" cy="18.4" rx="3.6" ry="1.4" />
  </svg>
`;

function fillCans(container, count) {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const can = document.createElement("div");
    can.className = "can";
    can.innerHTML = CAN_SVG;
    container.appendChild(can);
  }
}

function readGoal() {
  return clampInput(cyclesInput, 4);
}

function renderCans() {
  fillCans(timerCans, targetCycles);
  fillCans(completeCans, targetCycles);
  renderSetupPreview();
}

// The setup shelf previews tonight's goal, so it tracks the input rather than
// progress and its cans always sit closed.
function renderSetupPreview() {
  fillCans(setupCans, readGoal());
}

function updateCans() {
  [timerCans, completeCans].forEach((container) => {
    const cans = container.children;
    for (let i = 0; i < cans.length; i++) {
      cans[i].classList.toggle("opened", i < cyclesCompleted);
    }
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return "under a minute";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

// A typed-in number ignores the input's own min/max, so clamp to them here.
function clampInput(input, fallback) {
  const min = Number(input.min) || 1;
  const max = Number(input.max) || Infinity;
  const raw = parseInt(input.value, 10);
  return Math.min(max, Math.max(min, Number.isNaN(raw) ? fallback : raw));
}

function phaseElapsed() {
  return running ? (Date.now() - phaseStart) / 1000 : pausedElapsed;
}

function beginPhase() {
  phaseStart = Date.now();
  pausedElapsed = 0;
}

function updateDisplay() {
  const elapsed = Math.min(totalSecondsForPhase, phaseElapsed());
  const progress = Math.min(1, Math.max(0, elapsed / totalSecondsForPhase));

  timeDisplay.textContent = formatTime(secondsLeft);
  modeLabel.textContent = mode === "study" ? "Study" : "Drink";
  nextLabel.textContent =
    mode === "study" ? `then ${breakMinutes} min to drink` : `then ${studyMinutes} min of study`;
  cycleCount.textContent = `Cycle ${
    mode === "study" ? cyclesCompleted + 1 : cyclesCompleted
  } / ${targetCycles}`;
  earnedCount.textContent = cyclesCompleted;

  document.body.classList.toggle("break-mode", mode === "break");
  document.title = `${formatTime(secondsLeft)} — ${mode === "study" ? "Study" : "Drink"}`;

  progressArc.style.strokeDashoffset = ARC_LENGTH * (1 - progress);
  updateCans();
}

function switchMode() {
  beginPhase();
  if (mode === "study") {
    cyclesCompleted++;
    playCanOpen();
    if (cyclesCompleted >= targetCycles) {
      goToCompleteScreen();
      return;
    }
    mode = "break";
    totalSecondsForPhase = breakMinutes * 60;
  } else {
    mode = "study";
    totalSecondsForPhase = studyMinutes * 60;
  }
  secondsLeft = totalSecondsForPhase;
  updateDisplay();
}

// 200 ms so the ring's CSS transition always has a fresh target to glide to.
function frame() {
  const elapsed = phaseElapsed();
  const left = Math.max(0, Math.ceil(totalSecondsForPhase - elapsed));
  if (left !== secondsLeft) {
    if (mode === "study") studySecondsElapsed += secondsLeft - left;
    secondsLeft = left;
  }
  updateDisplay();
  if (running && elapsed >= totalSecondsForPhase) switchMode();
}

function startClock() {
  if (intervalId) return;
  intervalId = setInterval(frame, 200);
}

function stopClock() {
  clearInterval(intervalId);
  intervalId = null;
}

function resume() {
  phaseStart = Date.now() - pausedElapsed * 1000;
  running = true;
  toggleBtn.textContent = "Pause";
  startClock();
}

function pause() {
  pausedElapsed = (Date.now() - phaseStart) / 1000;
  running = false;
  toggleBtn.textContent = "Resume";
  stopClock();
  updateDisplay();
}

function startSession() {
  studyMinutes = clampInput(studyInput, 25);
  breakMinutes = clampInput(breakInput, 5);
  targetCycles = readGoal();
  mode = "study";
  totalSecondsForPhase = studyMinutes * 60;
  secondsLeft = totalSecondsForPhase;
  cyclesCompleted = 0;
  studySecondsElapsed = 0;
  renderCans();
  beginPhase();
  running = true;
  toggleBtn.textContent = "Pause";
  updateDisplay();
  goToTimerScreen();
  startClock();
}

function goToTimerScreen() {
  setupScreen.classList.add("hidden");
  completeScreen.classList.add("hidden");
  timerScreen.classList.remove("hidden");
}

function goToSetupScreen() {
  stopClock();
  running = false;
  timerScreen.classList.add("hidden");
  completeScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  document.body.classList.remove("break-mode");
  renderSetupPreview();
  document.title = "Drunk Pomodoro";
}

function goToCompleteScreen() {
  stopClock();
  running = false;
  timerScreen.classList.add("hidden");
  completeScreen.classList.remove("hidden");
  updateCans();
  finalCycles.textContent = `${cyclesCompleted} ${cyclesCompleted === 1 ? "beer" : "beers"} earned`;
  finalStudyTime.textContent = formatDuration(studySecondsElapsed);
  document.title = "Session done";
}

startBtn.addEventListener("click", startSession);
newSessionBtn.addEventListener("click", startSession);
settingsBtn.addEventListener("click", goToSetupScreen);
completeSettingsBtn.addEventListener("click", goToSetupScreen);
skipBtn.addEventListener("click", switchMode);
cyclesInput.addEventListener("input", renderSetupPreview);

toggleBtn.addEventListener("click", () => {
  if (running) pause();
  else resume();
});

resetBtn.addEventListener("click", () => {
  mode = "study";
  totalSecondsForPhase = studyMinutes * 60;
  secondsLeft = totalSecondsForPhase;
  cyclesCompleted = 0;
  studySecondsElapsed = 0;
  beginPhase();
  running = true;
  toggleBtn.textContent = "Pause";
  updateDisplay();
  startClock();
});

renderCans();
updateDisplay();
