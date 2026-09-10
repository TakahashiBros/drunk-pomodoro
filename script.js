const setupScreen = document.getElementById("setup-screen");
const timerScreen = document.getElementById("timer-screen");
const completeScreen = document.getElementById("complete-screen");

const studyInput = document.getElementById("study-input");
const breakInput = document.getElementById("break-input");
const cyclesInput = document.getElementById("cycles-input");
const startBtn = document.getElementById("start-btn");

const modeLabel = document.getElementById("mode-label");
const timeDisplay = document.getElementById("time-display");
const cycleCount = document.getElementById("cycle-count");
const cansContainer = document.getElementById("cans-container");
const toggleBtn = document.getElementById("toggle-btn");
const skipBtn = document.getElementById("skip-btn");
const resetBtn = document.getElementById("reset-btn");
const settingsBtn = document.getElementById("settings-btn");
const progressArc = document.getElementById("progress-arc");
const finalCycles = document.getElementById("final-cycles");
const finalStudyTime = document.getElementById("final-study-time");
const newSessionBtn = document.getElementById("new-session-btn");

const ARC_RADIUS = 90;
const ARC_LENGTH = Math.PI * ARC_RADIUS;
progressArc.style.strokeDasharray = ARC_LENGTH;

let studyMinutes = 25;
let breakMinutes = 5;
let targetCycles = 4;
let mode = "study";
let totalSecondsForPhase = studyMinutes * 60;
let secondsLeft = studyMinutes * 60;
let intervalId = null;
let cyclesCompleted = 0;
let studySecondsElapsed = 0;

let audioCtx = null;
let noiseBuffer = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const length = audioCtx.sampleRate * 2;
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
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
  <svg class="can-svg" viewBox="0 0 44 84">
    <ellipse class="can-body" cx="22" cy="75" rx="14" ry="4" />
    <rect class="can-body" x="8" y="21" width="28" height="54" />
    <rect class="can-label" x="8" y="39" width="28" height="18" />
    <path class="can-body" d="M 8 21 L 11 16 L 33 16 L 36 21 Z" />
    <ellipse class="can-lid" cx="22" cy="16" rx="11" ry="3.5" />
    <ellipse class="can-hole" cx="22" cy="15.5" rx="5.5" ry="2" />
    <ellipse class="can-tab" cx="22" cy="15.5" rx="4" ry="1.5" />
    <g class="can-foam">
      <circle cx="16" cy="9" r="3" />
      <circle cx="24" cy="5" r="3.6" />
      <circle cx="29" cy="10" r="2.6" />
    </g>
  </svg>
`;

function renderCans() {
  cansContainer.innerHTML = "";
  for (let i = 0; i < targetCycles; i++) {
    const can = document.createElement("div");
    can.className = "can";
    can.innerHTML = CAN_SVG;
    cansContainer.appendChild(can);
  }
}

function updateCans() {
  const cans = cansContainer.children;
  for (let i = 0; i < cans.length; i++) {
    cans[i].classList.toggle("opened", i < cyclesCompleted);
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return "less than a minute";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function updateDisplay() {
  timeDisplay.textContent = formatTime(secondsLeft);
  modeLabel.textContent = mode === "study" ? "STUDY" : "DRINK";

  const displayedCycle = mode === "study" ? cyclesCompleted + 1 : cyclesCompleted;
  cycleCount.textContent = `Cycle ${displayedCycle} of ${targetCycles}`;
  updateCans();

  document.body.classList.toggle("break-mode", mode === "break");
  document.title = `${formatTime(secondsLeft)} - ${mode === "study" ? "Study" : "Drink"}`;

  const elapsed = totalSecondsForPhase - secondsLeft;
  const progress = Math.min(1, Math.max(0, elapsed / totalSecondsForPhase));
  progressArc.style.strokeDashoffset = ARC_LENGTH * (1 - progress);
}

function switchMode() {
  if (mode === "study") {
    cyclesCompleted++;
    playCanOpen();
    if (cyclesCompleted >= targetCycles) {
      goToCompleteScreen();
      return;
    }
    mode = "break";
    totalSecondsForPhase = breakMinutes * 60;
    secondsLeft = totalSecondsForPhase;
  } else {
    mode = "study";
    totalSecondsForPhase = studyMinutes * 60;
    secondsLeft = totalSecondsForPhase;
  }
  updateDisplay();
}

function tick() {
  secondsLeft--;
  if (secondsLeft < 0) {
    switchMode();
    return;
  }
  if (mode === "study") studySecondsElapsed++;
  updateDisplay();
}

function startInterval() {
  if (intervalId) return;
  intervalId = setInterval(tick, 1000);
  toggleBtn.textContent = "Pause";
}

function stopInterval() {
  clearInterval(intervalId);
  intervalId = null;
  toggleBtn.textContent = "Resume";
}

function goToTimerScreen() {
  setupScreen.classList.add("hidden");
  completeScreen.classList.add("hidden");
  timerScreen.classList.remove("hidden");
  cansContainer.classList.remove("hidden");
}

function goToSetupScreen() {
  stopInterval();
  timerScreen.classList.add("hidden");
  completeScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  cansContainer.classList.add("hidden");
  document.title = "Drunk Pomodoro";
}

function goToCompleteScreen() {
  stopInterval();
  timerScreen.classList.add("hidden");
  completeScreen.classList.remove("hidden");
  updateCans();
  finalCycles.textContent = `${cyclesCompleted} ${cyclesCompleted === 1 ? "beer" : "beers"}`;
  finalStudyTime.textContent = formatDuration(studySecondsElapsed);
  document.title = "Drinking session complete";
}

startBtn.addEventListener("click", () => {
  studyMinutes = Math.max(1, parseInt(studyInput.value, 10) || 25);
  breakMinutes = Math.max(1, parseInt(breakInput.value, 10) || 5);
  targetCycles = Math.max(1, parseInt(cyclesInput.value, 10) || 4);
  mode = "study";
  totalSecondsForPhase = studyMinutes * 60;
  secondsLeft = totalSecondsForPhase;
  cyclesCompleted = 0;
  studySecondsElapsed = 0;
  renderCans();
  updateDisplay();
  goToTimerScreen();
  startInterval();
});

newSessionBtn.addEventListener("click", () => {
  goToSetupScreen();
});

toggleBtn.addEventListener("click", () => {
  if (intervalId) {
    stopInterval();
  } else {
    startInterval();
  }
});

skipBtn.addEventListener("click", () => {
  switchMode();
});

resetBtn.addEventListener("click", () => {
  stopInterval();
  mode = "study";
  totalSecondsForPhase = studyMinutes * 60;
  secondsLeft = totalSecondsForPhase;
  cyclesCompleted = 0;
  studySecondsElapsed = 0;
  updateDisplay();
  startInterval();
});

settingsBtn.addEventListener("click", () => {
  goToSetupScreen();
});
