# Algorithm Verification

This document verifies that the sound generation algorithm correctly implements the equations from:
**"Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating stimulus modulation"** (Yukhnovich et al., Hearing Research 2025).

## Equations Implemented

### Equation (1): Carrier Signal
```
s(t) = sin(2π f t + φ + ψ)
```
- `f`: Harmonic frequency (n × f0)
- `φ`: Random phase per harmonic
- `ψ`: Phase modulation (Eq 3) - only for phase mode

**Implementation**: Line 167 in `generateBlock()`
```javascript
const s = Math.sin(TAU * freq * t + phi + psi);
```

### Equation (2): Amplitude Modulation
```
A(t) = 1 + d sin(2π[ωt + F_n S(t)] + q)
```
- `d = 1.0`: Modulation depth
- `ω = 1.0 Hz`: Temporal modulation rate
- `F_n`: Frequency-dependent modulation (Eq 4)
- `S(t)`: SMR modulation (Eq 5)
- `q`: Random phase (0..2π)

**Range**: A ∈ [0, 2], mean = 1

**Implementation**: Line 160 in `generateBlock()`
```javascript
A = 1.0 + d * modSin;
```

### Equation (3): Phase Modulation
```
ψ(t) = π(1 + d sin(2π[ωt + F_n S(t)] + q))
```
- Same parameters as Eq (2)
- Applied as phase offset to carrier

**Range**: ψ ∈ [0, 2π]

**Implementation**: Line 162 in `generateBlock()`
```javascript
psi = Math.PI * (1.0 + d * modSin);
```

### Equation (4): Frequency-Dependent Modulation
```
F_n = log₂((n f₀) / c)
```
- `n`: Harmonic number
- `f₀`: Fundamental frequency (96-256 Hz, random per block)
- `c`: Log-centre of target band = √(band.lo × band.hi)

**Implementation**: Line 150 in `generateBlock()`
```javascript
const Fn = log2(freq / c);
```

### Equation (5): SMR Modulation
```
S(t) = μ + r sin(p + 2π ν t)
```
- `μ = 4.5`: Mean SMR (cycles/octave)
- `r = 3.0`: SMR variability (cycles/octave)
- `ν = 0.125 Hz`: SMR rate (8 s cycle)
- `p`: Random phase (0..2π, per block)

**Implementation**: Line 107 in `buildSMRArray()`
```javascript
S[i] = mu + r * Math.sin(pPhase + TAU * nu * t);
```

## Modulation Angle (Combined)
The shared modulation angle used in both Eq (2) and Eq (3):
```
θ(t) = 2π[ωt + F_n S(t)] + q
```

**Implementation**: Line 153 in `generateBlock()`
```javascript
const modAngle = W[i] + TAU * (Fn * S[i]) + qPhase;
```
Where:
- `W[i] = 2π ω t` (precomputed)
- `TAU * (Fn * S[i]) = 2π F_n S(t)`
- `qPhase = q`

## Key Parameters (from paper)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `d` | 1.0 | Modulation depth |
| `ω` | 1.0 Hz | Temporal modulation rate |
| `μ` | 4.5 | Mean SMR (cycles/octave) |
| `r` | 3.0 | SMR variability (cycles/octave) |
| `ν` | 0.125 Hz | SMR rate (8 s cycle) |
| `f₀` | 96-256 Hz | Fundamental frequency (random per block) |
| Block duration | 4 s | Block length |
| Ramp duration | 1 s | Raised-cosine ramp (0.5s in + 0.5s out) |
| Sample rate | 44.1 kHz | Audio sample rate |
| Carrier range | 1-16 kHz | Harmonic frequency limits |

## Band Selection (Table 1)

The algorithm uses Table 1 from the paper to map tinnitus frequency to modulation bands:
- **Active band (A1)**: Preferred band for tinnitus-related modulation
- **Sham band (C1)**: Control band (usually lower frequency)
- **Contingency bands (A2/C2)**: Alternative bands if preferred contains inaudible frequencies

## Verification Status

✅ **All equations correctly implemented**
✅ **Parameter values match paper**
✅ **Band mapping matches Table 1**
✅ **Modulation applied only to frequencies within target band**
✅ **Raised-cosine ramps implemented (1s per 4s block)**
✅ **Random phases per block (p, q)**
✅ **Random fundamental frequency per block (96-256 Hz)**

## Notes

- **Hearing-slope correction**: Not implemented (flat spectrum carrier, as noted in original script)
- **Random number generator**: XorShift32 for reproducibility
- **Normalization**: Blocks normalized to targetPeak (0.80) to prevent clipping

