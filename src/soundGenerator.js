#!/usr/bin/env node
/**
 * Generate tinnitus sound-therapy files based on:
 * "Chronic tinnitus is quietened by sound therapy using a novel cross-frequency
 * de-correlating stimulus modulation" (Yukhnovich et al., Hearing Research 2025).
 *
 * Produces two WAV files:
 *  - active.wav : modulation in tinnitus-related band
 *  - sham.wav   : same modulation but in control band (Table 1 mapping)
 *
 * Default: 60 minutes, 44.1 kHz, mono, 16-bit PCM, 4 s blocks with 1 s ramps.
 *
 * Usage:
 *   node generate-tinnitus-stimuli.js --tinnitusHz 8000 --mode phase --minutes 60 --out ./out
 *
 * Modes:
 *   --mode amplitude | phase
 *
 * Notes:
 * - This script implements Eq (1)-(5) from the paper.
 * - Hearing-slope correction profiles are NOT implemented (flat spectrum carrier).
 */

const fs = require("fs");
const path = require("path");

// -------------------- CLI parsing --------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const tinnitusHz = Number(args.tinnitusHz ?? args.tinnitus ?? NaN);
if (!Number.isFinite(tinnitusHz) || tinnitusHz <= 0) {
  console.error("Missing/invalid --tinnitusHz (e.g., --tinnitusHz 8000)");
  process.exit(1);
}

const mode = String(args.mode ?? "phase").toLowerCase();
if (!["phase", "amplitude"].includes(mode)) {
  console.error("Invalid --mode. Use 'phase' or 'amplitude'.");
  process.exit(1);
}

const outDir = String(args.out ?? "./out");
const minutes = Number(args.minutes ?? 60);
const sampleRate = Number(args.sampleRate ?? 44100);
const blockSec = Number(args.blockSec ?? 4);
const rampSec = Number(args.rampSec ?? 1);

const seed = Number(args.seed ?? Date.now());
const targetPeak = Number(args.targetPeak ?? 0.80); // keep headroom

// Modulation parameters from the paper:
const d = 1.0;       // modulation depth
const omega = 1.0;   // temporal modulation rate (Hz)
const mu = 4.5;      // mean SMR (cycles/octave)
const r = 3.0;       // SMR variability (cycles/octave)
const nu = 0.125;    // SMR rate (Hz) => 8 s cycle

// Carrier / harmonic limits per paper:
const carrierMinHz = 1000;
const carrierMaxHz = 16000;

// -------------------- Table 1 band mapping (preferred A1/C1, with contingency A2/C2 available) --------------------
const BANDS = [
  { name: "1-2k",    lo: 1000, hi: 2000 },
  { name: "1.4-2.8k",lo: 1400, hi: 2800 },
  { name: "2-4k",    lo: 2000, hi: 4000 },
  { name: "2.8-5.7k",lo: 2800, hi: 5700 },
  { name: "4-8k",    lo: 4000, hi: 8000 },
  { name: "5.7-11k", lo: 5700, hi: 11000 },
  { name: "8-16k",   lo: 8000, hi: 16000 },
];

// nearest-match keys from the paper’s tinnitus-match set (kHz):
const MATCH_KEYS_KHZ = [1.0, 1.2, 1.4, 1.7, 2.0, 2.4, 2.8, 3.4, 4.0, 4.8, 5.7, 6.7, 8.0, 9.5, 11.0, 13.0, 16.0];

// mapping: keyKHz -> { activePreferredBandIdx, activeAltBandIdx|null, shamPreferredBandIdx, shamAltBandIdx|null }
const TABLE1_MAP = new Map([
  [1.0,  { a1: 0, a2: null, c1: 2, c2: null }],
  [1.2,  { a1: 0, a2: null, c1: 2, c2: null }],
  [1.4,  { a1: 0, a2: null, c1: 2, c2: null }],
  [1.7,  { a1: 1, a2: 0,    c1: 3, c2: null }],
  [2.0,  { a1: 1, a2: null, c1: 3, c2: null }],
  [2.4,  { a1: 2, a2: 1,    c1: 4, c2: null }],
  [2.8,  { a1: 2, a2: null, c1: 4, c2: null }],
  [3.4,  { a1: 3, a2: 2,    c1: 5, c2: null }],
  [4.0,  { a1: 3, a2: null, c1: 5, c2: null }],
  [4.8,  { a1: 4, a2: 3,    c1: 2, c2: 1    }], // sham has C1 and C2
  [5.7,  { a1: 4, a2: null, c1: 2, c2: null }],
  [6.7,  { a1: 5, a2: 4,    c1: 3, c2: 2    }], // sham has C1 and C2
  [8.0,  { a1: 5, a2: null, c1: 3, c2: null }],
  [9.5,  { a1: 5, a2: null, c1: 3, c2: null }],
  [11.0, { a1: 6, a2: null, c1: 4, c2: null }],
  [13.0, { a1: 6, a2: null, c1: 4, c2: null }],
  [16.0, { a1: 6, a2: null, c1: 4, c2: null }],
]);

function nearestMatchKeyKHz(freqHz) {
  const kHz = freqHz / 1000;
  let best = MATCH_KEYS_KHZ[0];
  let bestD = Math.abs(kHz - best);
  for (const k of MATCH_KEYS_KHZ) {
    const d = Math.abs(kHz - k);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

const matchKey = nearestMatchKeyKHz(tinnitusHz);
const mapEntry = TABLE1_MAP.get(matchKey);
if (!mapEntry) {
  console.error("Internal mapping error for match key:", matchKey);
  process.exit(1);
}

const useAltActive = Boolean(args.useAltActive ?? false);
const useAltSham = Boolean(args.useAltSham ?? false);

const activeBandIdx = (useAltActive && mapEntry.a2 != null) ? mapEntry.a2 : mapEntry.a1;
const shamBandIdx   = (useAltSham && mapEntry.c2 != null)   ? mapEntry.c2 : mapEntry.c1;

const activeBand = BANDS[activeBandIdx];
const shamBand = BANDS[shamBandIdx];

console.log("Tinnitus Hz:", tinnitusHz);
console.log("Nearest paper match key (kHz):", matchKey);
console.log("Mode:", mode);
console.log("Active band:", activeBand);
console.log("Sham band:", shamBand);

// -------------------- PRNG (xorshift32) --------------------
class XorShift32 {
  constructor(seed) {
    this.state = (seed >>> 0) || 0x12345678;
  }
  nextUint() {
    let x = this.state;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    this.state = x;
    return x;
  }
  random() {
    return this.nextUint() / 0x100000000; // [0,1)
  }
  uniform(a, b) {
    return a + (b - a) * this.random();
  }
}

const rng = new XorShift32(seed);

// -------------------- WAV writer (PCM16) --------------------
function writeWavHeader(fd, { sampleRate, numChannels, bitsPerSample, dataBytes }) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const riffChunkSize = 36 + dataBytes;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(riffChunkSize, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);               // PCM fmt chunk size
  header.writeUInt16LE(1, 20);                // audio format = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);

  fs.writeSync(fd, header, 0, header.length, 0);
}

function finalizeWav(fd, { sampleRate, numChannels, bitsPerSample }) {
  const stat = fs.fstatSync(fd);
  const fileBytes = stat.size;
  const dataBytes = fileBytes - 44;
  writeWavHeader(fd, { sampleRate, numChannels, bitsPerSample, dataBytes });
}

// -------------------- DSP helpers --------------------
const TAU = Math.PI * 2;

function raisedCosineRamp(i, nRamp, nTotal) {
  // 1 s ramp in + 1 s ramp out inside a 4 s block, per paper.
  // i is sample index in block
  if (nRamp <= 0) return 1.0;
  if (i < nRamp) {
    const x = i / nRamp; // 0..1
    return 0.5 * (1 - Math.cos(Math.PI * x));
  }
  if (i >= nTotal - nRamp) {
    const x = (nTotal - 1 - i) / nRamp; // 1..0
    return 0.5 * (1 - Math.cos(Math.PI * x));
  }
  return 1.0;
}

function log2(x) {
  return Math.log(x) / Math.log(2);
}

// Eq (5): S(t) = μ + r sin(p + 2π ν t)
function buildSMRArray(N, fsHz, pPhase) {
  const S = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / fsHz;
    S[i] = mu + r * Math.sin(pPhase + TAU * nu * t);
  }
  return S;
}

// Precompute omega term: 2π ω t
function buildOmegaArray(N, fsHz) {
  const W = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / fsHz;
    W[i] = TAU * omega * t;
  }
  return W;
}

function clamp16(x) {
  if (x > 32767) return 32767;
  if (x < -32768) return -32768;
  return x;
}

// Generate one 4s block
function generateBlock({
  fsHz,
  seconds,
  band,          // {lo, hi}
  mode,          // "phase" | "amplitude"
}) {
  const N = Math.floor(fsHz * seconds);
  const rampN = Math.floor(fsHz * rampSec);

  // random phases per block (paper: p and q random 0..2π)
  const pPhase = rng.uniform(0, TAU);
  const qPhase = rng.uniform(0, TAU);

  const S = buildSMRArray(N, fsHz, pPhase);
  const W = buildOmegaArray(N, fsHz);

  // random fundamental frequency per block (96–256 Hz)
  const f0 = rng.uniform(96, 256);

  const nMin = Math.ceil(carrierMinHz / f0);
  const nMax = Math.floor(carrierMaxHz / f0);

  const c = Math.sqrt(band.lo * band.hi); // log-centre
  const out = new Float32Array(N);

  // Synthesis: sum harmonics
  for (let n = nMin; n <= nMax; n++) {
    const freq = n * f0;
    const inBand = (freq >= band.lo && freq <= band.hi);
    const phi = rng.uniform(0, TAU);

    // Eq (4): F_n = log2( (n f0) / c )
    const Fn = log2(freq / c);

    for (let i = 0; i < N; i++) {
      // shared inner: 2π[ωt + F_n S(t)] + q
      const modAngle = W[i] + TAU * (Fn * S[i]) + qPhase;
      const modSin = Math.sin(modAngle);

      let A = 1.0;   // Eq (2)
      let psi = 0.0; // Eq (3)
      if (inBand) {
        if (mode === "amplitude") {
          A = 1.0 + d * modSin; // range 0..2, mean 1
        } else if (mode === "phase") {
          psi = Math.PI * (1.0 + d * modSin); // range 0..2π (max 1 cycle)
        }
      }

      const t = i / fsHz;
      const s = Math.sin(TAU * freq * t + phi + psi);
      out[i] += A * s;
    }
  }

  // Apply ramps and normalize block peak
  let peak = 1e-9;
  for (let i = 0; i < N; i++) {
    const env = raisedCosineRamp(i, rampN, N);
    out[i] *= env;
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  const scale = Math.min(1.0, targetPeak / peak);
  for (let i = 0; i < N; i++) out[i] *= scale;

  return { samples: out, f0 };
}

function writePcm16(fd, floatSamples) {
  const buf = Buffer.alloc(floatSamples.length * 2);
  for (let i = 0; i < floatSamples.length; i++) {
    const x = Math.max(-1, Math.min(1, floatSamples[i]));
    const s = clamp16(Math.round(x * 32767));
    buf.writeInt16LE(s, i * 2);
  }
  fs.writeSync(fd, buf);
}

// Generate full file by concatenating blocks
function generateFile(filepath, band) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const fd = fs.openSync(filepath, "w");

  // placeholder header; finalize later
  writeWavHeader(fd, { sampleRate, numChannels: 1, bitsPerSample: 16, dataBytes: 0 });

  const totalSec = minutes * 60;
  const blocks = Math.floor(totalSec / blockSec);
  const remainder = totalSec - blocks * blockSec;

  console.log(`Writing ${filepath}`);
  console.log(`  totalSec=${totalSec}, blocks=${blocks}, remainder=${remainder.toFixed(3)}s`);

  for (let b = 0; b < blocks; b++) {
    const { samples } = generateBlock({ fsHz: sampleRate, seconds: blockSec, band, mode });
    writePcm16(fd, samples);

    if ((b + 1) % 10 === 0) {
      console.log(`  progress: ${b + 1}/${blocks} blocks`);
    }
  }

  if (remainder > 1e-6) {
    const { samples } = generateBlock({ fsHz: sampleRate, seconds: remainder, band, mode });
    writePcm16(fd, samples);
  }

  finalizeWav(fd, { sampleRate, numChannels: 1, bitsPerSample: 16 });
  fs.closeSync(fd);
}

(function main() {
  const activePath = path.join(outDir, `active_${mode}_${Math.round(tinnitusHz)}Hz.wav`);
  const shamPath = path.join(outDir, `sham_${mode}_${Math.round(tinnitusHz)}Hz.wav`);

  generateFile(activePath, activeBand);
  generateFile(shamPath, shamBand);

  console.log("Done.");
})();