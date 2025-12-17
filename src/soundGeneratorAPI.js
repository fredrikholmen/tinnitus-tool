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
 * This module implements Eq (1)-(5) from the paper:
 * - Eq (1): Carrier signal with harmonics
 * - Eq (2): Amplitude modulation A(t) = 1 + d sin(2π[ωt + F_n S(t)] + q)
 * - Eq (3): Phase modulation ψ(t) = π(1 + d sin(2π[ωt + F_n S(t)] + q))
 * - Eq (4): Frequency-dependent modulation F_n = log2((n f0) / c)
 * - Eq (5): SMR modulation S(t) = μ + r sin(p + 2π ν t)
 *
 * Notes:
 * - Hearing-slope correction profiles are NOT implemented (flat spectrum carrier).
 * - Modulation is applied only to frequencies within the target band (active or sham).
 */

import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ==================== Modulation Parameters (from paper) ====================
// These parameters define the cross-frequency de-correlating modulation:
const d = 1.0;       // modulation depth (Eq 2, 3)
const omega = 1.0;   // temporal modulation rate (Hz) - Eq 2, 3
const mu = 4.5;      // mean SMR (cycles/octave) - Eq 5
const r = 3.0;       // SMR variability (cycles/octave) - Eq 5
const nu = 0.125;    // SMR rate (Hz) => 8 s cycle - Eq 5

// Carrier / harmonic limits per paper:
const carrierMinHz = 1000;
const carrierMaxHz = 16000;

// ==================== Table 1 Band Mapping ====================
// Frequency bands for modulation (from paper Table 1)
const BANDS = [
  { name: "1-2k",    lo: 1000, hi: 2000 },
  { name: "1.4-2.8k",lo: 1400, hi: 2800 },
  { name: "2-4k",    lo: 2000, hi: 4000 },
  { name: "2.8-5.7k",lo: 2800, hi: 5700 },
  { name: "4-8k",    lo: 4000, hi: 8000 },
  { name: "5.7-11k", lo: 5700, hi: 11000 },
  { name: "8-16k",   lo: 8000, hi: 16000 },
];

// Nearest-match keys from the paper's tinnitus-match set (kHz):
const MATCH_KEYS_KHZ = [1.0, 1.2, 1.4, 1.7, 2.0, 2.4, 2.8, 3.4, 4.0, 4.8, 5.7, 6.7, 8.0, 9.5, 11.0, 13.0, 16.0];

// Mapping: keyKHz -> { activePreferredBandIdx, activeAltBandIdx|null, shamPreferredBandIdx, shamAltBandIdx|null }
// A1/C1 are preferred, A2/C2 are contingency options for inaudible frequencies
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

// ==================== PRNG (xorshift32) ====================
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

// ==================== WAV Writer (PCM16) ====================
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

function writePcm16(fd, floatSamples) {
  const buf = Buffer.alloc(floatSamples.length * 2);
  for (let i = 0; i < floatSamples.length; i++) {
    const x = Math.max(-1, Math.min(1, floatSamples[i]));
    const s = clamp16(Math.round(x * 32767));
    buf.writeInt16LE(s, i * 2);
  }
  fs.writeSync(fd, buf);
}

function clamp16(x) {
  if (x > 32767) return 32767;
  if (x < -32768) return -32768;
  return x;
}

// ==================== DSP Helpers ====================
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
// SMR (Spectral Modulation Rate) array - modulates the frequency-dependent modulation
function buildSMRArray(N, fsHz, pPhase) {
  const S = new Float32Array(N);
  const invFsHz = 1.0 / fsHz;
  const tauNu = TAU * nu;
  let t = 0;
  for (let i = 0; i < N; i++) {
    S[i] = mu + r * Math.sin(pPhase + tauNu * t);
    t += invFsHz;
  }
  return S;
}

// Precompute omega term: 2π ω t (for Eq 2, 3)
function buildOmegaArray(N, fsHz) {
  const W = new Float32Array(N);
  const invFsHz = 1.0 / fsHz;
  const tauOmega = TAU * omega;
  let t = 0;
  for (let i = 0; i < N; i++) {
    W[i] = tauOmega * t;
    t += invFsHz;
  }
  return W;
}

// ==================== Sound Generation (Core Algorithm) ====================
/**
 * Generate one block of sound (default 4 seconds with 1s ramps)
 * Implements equations (1)-(5) from the paper.
 * 
 * @param {Object} params
 * @param {number} params.fsHz - Sample rate in Hz
 * @param {number} params.seconds - Block duration in seconds
 * @param {Object} params.band - Frequency band {lo, hi} in Hz
 * @param {string} params.mode - "phase" or "amplitude"
 * @param {XorShift32} params.rng - Random number generator instance
 * @param {number} params.rampSec - Ramp duration in seconds
 * @param {number} params.targetPeak - Target peak amplitude (0-1)
 * @returns {Object} {samples: Float32Array, f0: number}
 */
function generateBlock({ fsHz, seconds, band, mode, rng, rampSec, targetPeak }) {
  const N = Math.floor(fsHz * seconds);
  const rampN = Math.floor(fsHz * rampSec);

  // Random phases per block (paper: p and q random 0..2π)
  // p: phase for SMR modulation (Eq 5)
  // q: phase for cross-frequency modulation (Eq 2, 3)
  const pPhase = rng.uniform(0, TAU);
  const qPhase = rng.uniform(0, TAU);

  // Eq (5): S(t) = μ + r sin(p + 2π ν t)
  const S = buildSMRArray(N, fsHz, pPhase);
  
  // Precompute: 2π ω t (for Eq 2, 3)
  const W = buildOmegaArray(N, fsHz);

  // Random fundamental frequency per block (96–256 Hz)
  // This creates a harmonic series carrier
  const f0 = rng.uniform(96, 256);

  // Calculate harmonic range that fits within carrier limits
  const nMin = Math.ceil(carrierMinHz / f0);
  const nMax = Math.floor(carrierMaxHz / f0);

  // Log-centre of the target band (for Eq 4)
  const c = Math.sqrt(band.lo * band.hi);
  const out = new Float32Array(N);

  // Pre-compute time array once per block (optimization)
  // Use incremental addition for better performance
  const timeArray = new Float32Array(N);
  const invFsHz = 1.0 / fsHz;
  let t = 0;
  for (let i = 0; i < N; i++) {
    timeArray[i] = t;
    t += invFsHz;
  }

  // Synthesis: sum harmonics (Eq 1)
  for (let n = nMin; n <= nMax; n++) {
    const freq = n * f0;  // Harmonic frequency
    const inBand = (freq >= band.lo && freq <= band.hi);
    
    // Random phase for this harmonic
    const phi = rng.uniform(0, TAU);

    // Eq (4): F_n = log2( (n f0) / c )
    // Frequency-dependent modulation index
    const Fn = log2(freq / c);
    
    // Pre-compute constants outside inner loop (optimization)
    const omegaFreq = TAU * freq;  // 2π * freq (constant per harmonic)
    const tauFn = TAU * Fn;  // 2π * Fn (constant per harmonic)
    
    // Pre-compute modulation terms if in band (optimization)
    let modArray = null;
    if (inBand) {
      modArray = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        // Shared modulation angle: 2π[ωt + F_n S(t)] + q
        const modAngle = W[i] + tauFn * S[i] + qPhase;
        modArray[i] = Math.sin(modAngle);
      }
    }

    // Inner loop: generate samples for this harmonic
    for (let i = 0; i < N; i++) {
      // Eq (2): Amplitude modulation (default)
      let A = 1.0;
      // Eq (3): Phase modulation (alternative)
      let psi = 0.0;
      
      // Apply modulation only to frequencies within the target band
      if (inBand && modArray) {
        const modSin = modArray[i];
        if (mode === "amplitude") {
          // Eq (2): A(t) = 1 + d sin(2π[ωt + F_n S(t)] + q)
          // Range: 0..2, mean 1
          A = 1.0 + d * modSin;
        } else if (mode === "phase") {
          // Eq (3): ψ(t) = π(1 + d sin(2π[ωt + F_n S(t)] + q))
          // Range: 0..2π (max 1 cycle)
          psi = Math.PI * (1.0 + d * modSin);
        }
      }

      // Eq (1): Carrier signal with modulation
      // sin(2π f t + φ + ψ)
      const s = Math.sin(omegaFreq * timeArray[i] + phi + psi);
      out[i] += A * s;
    }
  }

  // Apply raised-cosine ramps and normalize block peak
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

/**
 * Generate full WAV file by concatenating blocks
 * 
 * @param {string} filepath - Output file path
 * @param {Object} band - Frequency band {lo, hi}
 * @param {Object} config - Generation configuration
 */
async function generateFile(filepath, band, { sampleRate, minutes, blockSec, rampSec, mode, targetPeak, seed, onProgress, progressScale = 1.0 }) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const fd = fs.openSync(filepath, "w");

  // Placeholder header; finalize later
  writeWavHeader(fd, { sampleRate, numChannels: 1, bitsPerSample: 16, dataBytes: 0 });

  const totalSec = minutes * 60;
  const blocks = Math.floor(totalSec / blockSec);
  const remainder = totalSec - blocks * blockSec;
  const totalBlocks = blocks + (remainder > 1e-6 ? 1 : 0);

  // Create RNG instance for this file (ensures reproducibility with seed)
  const rng = new XorShift32(seed);

  for (let b = 0; b < blocks; b++) {
    const { samples } = generateBlock({
      fsHz: sampleRate,
      seconds: blockSec,
      band,
      mode,
      rng,
      rampSec,
      targetPeak,
    });
    writePcm16(fd, samples);
    
    // Report progress (scaled by progressScale - 0.5 if sham enabled, 1.0 if not)
    if (onProgress) {
      onProgress({
        file: path.basename(filepath),
        block: b + 1,
        totalBlocks: totalBlocks, // Use totalBlocks to account for remainder
        progress: ((b + 1) / totalBlocks) * progressScale, // Use totalBlocks in denominator
      });
      // Yield control to allow SSE stream to flush
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  if (remainder > 1e-6) {
    const { samples } = generateBlock({
      fsHz: sampleRate,
      seconds: remainder,
      band,
      mode,
      rng,
      rampSec,
      targetPeak,
    });
    writePcm16(fd, samples);
    
    if (onProgress) {
      onProgress({
        file: path.basename(filepath),
        block: blocks + 1,
        totalBlocks: totalBlocks,
        progress: progressScale, // File complete
      });
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  finalizeWav(fd, { sampleRate, numChannels: 1, bitsPerSample: 16 });
  fs.closeSync(fd);
}

// ==================== Public API ====================
/**
 * Generate sound therapy files (active and sham)
 * 
 * @param {Object} params
 * @param {number} params.tinnitusHz - Estimated tinnitus frequency in Hz
 * @param {string} params.mode - "phase" or "amplitude" modulation
 * @param {number} params.minutes - Duration in minutes (default: 60)
 * @param {boolean} params.useAltActive - Use alternative active band (A2) if available
 * @param {boolean} params.useAltSham - Use alternative sham band (C2) if available
 * @returns {Promise<Object>} File information
 */
export async function generateSoundFiles({ 
  tinnitusHz, 
  mode = "phase", 
  minutes = 60,
  useAltActive = false,
  useAltSham = false,
  generateSham = false,
  onProgress = null
}) {
  // Map tinnitus frequency to nearest match key from paper
  const matchKey = nearestMatchKeyKHz(tinnitusHz);
  const mapEntry = TABLE1_MAP.get(matchKey);
  if (!mapEntry) {
    throw new Error(`Internal mapping error for match key: ${matchKey}`);
  }

  // Select bands according to Table 1 (with contingency options)
  const activeBandIdx = (useAltActive && mapEntry.a2 != null) ? mapEntry.a2 : mapEntry.a1;
  const shamBandIdx = (useAltSham && mapEntry.c2 != null) ? mapEntry.c2 : mapEntry.c1;

  const activeBand = BANDS[activeBandIdx];
  const shamBand = BANDS[shamBandIdx];

  // Generation parameters (per paper defaults)
  const sampleRate = 44100;
  const blockSec = 4;      // 4-second blocks
  const rampSec = 1;       // 1-second ramps (0.5s in + 0.5s out per block)
  const targetPeak = 0.80; // Keep headroom to avoid clipping
  const seed = Date.now(); // Random seed for reproducibility

  const outDir = path.join(__dirname, "generated");
  // Filename format: active_phase_8000Hz_60min.wav
  const activePath = path.join(outDir, `active_${mode}_${Math.round(tinnitusHz)}Hz_${minutes}min.wav`);
  const shamPath = path.join(outDir, `sham_${mode}_${Math.round(tinnitusHz)}Hz_${minutes}min.wav`);

  const progressScale = generateSham ? 0.5 : 1.0;
  
  const config = {
    sampleRate,
    minutes,
    blockSec,
    rampSec,
    mode,
    targetPeak,
    seed,
    progressScale,
    onProgress: onProgress ? (progress) => {
      // Adjust progress: active file is 0-50% if sham is enabled, 0-100% if not
      onProgress({
        ...progress,
        progress: progress.progress,
        fileType: 'active',
      });
    } : null,
  };

  await generateFile(activePath, activeBand, config);
  
  let shamResult = null;
  if (generateSham) {
    // Update config for sham file (50-100%)
    config.onProgress = onProgress ? (progress) => {
      onProgress({
        ...progress,
        progress: 0.5 + (progress.progress * 0.5), // Second file is 50-100%
        fileType: 'sham',
      });
    } : null;
    
    await generateFile(shamPath, shamBand, config);
    shamResult = path.basename(shamPath);
  }

  return {
    active: path.basename(activePath),
    sham: shamResult,
    tinnitusHz: Math.round(tinnitusHz),
    mode,
    minutes,
    activeBand,
    shamBand: generateSham ? shamBand : null,
  };
}
