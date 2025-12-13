let audioCtx = null;
let masterGain = null;

const el = (id) => document.getElementById(id);

const state = {
  // starting guess (you can change this)
  estimateHz: 8000,
  // A/B step size in octaves (shrinks each trial)
  stepOct: 1.0,
  trial: 0,
  maxTrials: 16,
  // randomize order each trial
  lastPair: null, // {AHz, BHz}
  tinnitusCharacter: null, // "tone" | "noise"
  matchGain: 0.05,
};

function hzToLabel(hz) {
  if (hz >= 1000) return `${(hz/1000).toFixed(2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function pow2(x) { return Math.pow(2, x); }

// Simple limiter: keep master low; still add short ramps to avoid clicks
function playTone(freqHz, durationSec, gain) {
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freqHz;

  const g = audioCtx.createGain();
  const now = audioCtx.currentTime;

  // click-free envelope
  g.gain.setValueAtTime(0.0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.02);
  g.gain.setValueAtTime(gain, now + durationSec - 0.03);
  g.gain.linearRampToValueAtTime(0.0, now + durationSec);

  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + durationSec);
}

function playNarrowbandNoise(centerHz, durationSec, gain) {
  // quick-and-dirty narrowband noise using bandpass filter
  const bufferSize = Math.floor(audioCtx.sampleRate * durationSec);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = centerHz;
  bp.Q.value = 6; // moderate bandwidth

  const g = audioCtx.createGain();
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.02);
  g.gain.setValueAtTime(gain, now + durationSec - 0.03);
  g.gain.linearRampToValueAtTime(0.0, now + durationSec);

  src.connect(bp).connect(g).connect(masterGain);
  src.start(now);
  src.stop(now + durationSec);
}

function updateUI() {
  el("estimateHz").textContent = hzToLabel(state.estimateHz);
  el("masterVal").textContent = `(${Number(el("master").value).toFixed(3)})`;
  el("gainVal").textContent = `(${Number(el("matchGain").value).toFixed(3)})`;

  const config = buildConfig();
  el("configPreview").textContent = JSON.stringify(config, null, 2);
}

function buildConfig() {
  return {
    tinnitusHz_estimate: Math.round(state.estimateHz),
    tinnitusCharacter: state.tinnitusCharacter ?? "unknown",
    masterLevel: Number(el("master").value),
    matchGain: Number(el("matchGain").value),
    // generator hints (you can extend)
    suggestedMode: "phase"
  };
}

// --- Step handlers ---
async function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = Number(el("master").value);
  masterGain.connect(audioCtx.destination);

  el("btnCalTone").disabled = false;
  el("btnTNStart").disabled = false;
  el("btnABStart").disabled = false;
  el("btnLoudPlay").disabled = false;
  el("btnExport").disabled = false;

  updateUI();
}

function calibrationTone() {
  playTone(1000, 1.2, 0.15);
}

function startToneVsNoise() {
  el("tnStatus").textContent = "Playing tone then noise…";
  playTone(state.estimateHz, 0.8, 0.12);
  setTimeout(() => playNarrowbandNoise(state.estimateHz, 0.8, 0.12), 900);
  setTimeout(() => {
    el("tnStatus").textContent = "Pick which is closer.";
    el("btnToneLike").disabled = false;
    el("btnNoiseLike").disabled = false;
  }, 1800);
}

function pickCharacter(kind) {
  state.tinnitusCharacter = kind;
  el("tnStatus").textContent = `Saved: ${kind.toUpperCase()}-like`;
  el("btnToneLike").disabled = true;
  el("btnNoiseLike").disabled = true;
  updateUI();
}

function startAB() {
  state.trial = 0;
  state.stepOct = 1.0;
  nextABTrial();
}

function nextABTrial() {
  state.trial += 1;
  if (state.trial > state.maxTrials) {
    el("abStatus").textContent = `Done. Final estimate: ${hzToLabel(state.estimateHz)}`;
    el("btnPickA").disabled = true;
    el("btnPickB").disabled = true;
    updateUI();
    return;
  }

  // Create two candidates around estimate in octave space
  const half = state.stepOct / 2;
  const AHz = clamp(state.estimateHz * pow2(-half), 500, 16000);
  const BHz = clamp(state.estimateHz * pow2(+half), 500, 16000);

  // Randomize order of presentation
  const order = Math.random() < 0.5 ? ["A","B"] : ["B","A"];
  state.lastPair = { AHz, BHz, order };

  el("abStatus").textContent = `Trial ${state.trial}/${state.maxTrials}: playing ${order[0]} then ${order[1]}…`;
  el("btnPickA").disabled = true;
  el("btnPickB").disabled = true;

  const gain = 0.12;
  const d = 0.55;

  const firstHz = order[0] === "A" ? AHz : BHz;
  const secondHz = order[1] === "A" ? AHz : BHz;

  playTone(firstHz, d, gain);
  setTimeout(() => playTone(secondHz, d, gain), (d + 0.25) * 1000);

  setTimeout(() => {
    el("abStatus").textContent = `Pick which was closer to your tinnitus (A or B). Step=${state.stepOct.toFixed(2)} oct`;
    el("btnPickA").disabled = false;
    el("btnPickB").disabled = false;
  }, (2*d + 0.35) * 1000);
}

function pickAB(which) {
  const { AHz, BHz } = state.lastPair;

  // Move estimate toward chosen
  state.estimateHz = (which === "A") ? AHz : BHz;

  // Shrink step
  state.stepOct *= 0.70;

  updateUI();
  nextABTrial();
}

function playAtEstimate() {
  state.matchGain = Number(el("matchGain").value);
  playTone(state.estimateHz, 1.2, clamp(state.matchGain, 0, 0.5));
}

function exportConfig() {
  const config = buildConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tinnitus_config.json";
  a.click();
  el("exportStatus").textContent = "Downloaded tinnitus_config.json";
}

// --- Wire UI ---
el("btnInit").onclick = initAudio;
el("btnCalTone").onclick = calibrationTone;

el("btnTNStart").onclick = startToneVsNoise;
el("btnToneLike").onclick = () => pickCharacter("tone");
el("btnNoiseLike").onclick = () => pickCharacter("noise");

el("btnABStart").onclick = startAB;
el("btnPickA").onclick = () => pickAB("A");
el("btnPickB").onclick = () => pickAB("B");

el("btnLoudPlay").onclick = playAtEstimate;

el("master").oninput = () => {
  if (masterGain) masterGain.gain.value = Number(el("master").value);
  updateUI();
};
el("matchGain").oninput = updateUI;

el("btnExport").onclick = exportConfig;

updateUI();