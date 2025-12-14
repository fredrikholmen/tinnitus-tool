# Tinnitus Assessment & Sound Therapy Tool

A research-based web application for assessing tinnitus characteristics and generating personalized sound therapy files using cross-frequency de-correlating stimulus modulation.

## Background

This tool implements the sound therapy methodology described in the research paper **"Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating stimulus modulation"** by Yukhnovich et al. (2025), published in *Hearing Research*.

The research demonstrates that specific sound modulations can help reduce the perception of chronic tinnitus. Unlike traditional approaches, this method uses carefully modulated sounds that target specific frequency bands related to an individual's tinnitus, employing a technique called "cross-frequency de-correlation" to reduce neural activity patterns associated with tinnitus.

## Research Reference

**Original Study:**
- **Authors:** Yukhnovich et al.
- **Year:** 2025
- **Journal:** Hearing Research
- **Title:** "Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating stimulus modulation"
- **DOI/URL:** [https://www.sciencedirect.com/science/article/pii/S0378595525001534](https://www.sciencedirect.com/science/article/pii/S0378595525001534)

**Citation:**
```
Yukhnovich et al. (2025). Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating stimulus modulation. Hearing Research.
```

## Tool Development

**Developed by:** Fredrik Holmén

This tool is an open-source implementation of the research methodology, providing an accessible web-based interface for tinnitus assessment and sound therapy file generation. The implementation faithfully follows the mathematical equations and algorithms described in the original research paper.

## Features

- **Tinnitus Assessment:** Interactive frequency matching using hybrid tone/noise probes
- **Personalized Sound Generation:** Creates therapy files based on individual tinnitus characteristics
- **Sound Examples:** Pre-generated example files at standard frequencies for listening and comparison
- **Two Modulation Modes:** Phase modulation (recommended) and amplitude modulation
- **Export Functionality:** Download assessment data and generated WAV files
- **Research-Based:** Implements the exact algorithm from the published research

## How to Use

### Prerequisites

- Modern web browser with Web Audio API support
- Headphones (recommended for best results)
- Quiet environment for accurate assessment

### Step-by-Step Instructions

#### 1. Volume Control

- The audio system initializes automatically when you open the tool
- Use the **Master Level** slider to set a comfortable volume (start low!)
- Click **"Play 1 kHz Calibration Tone"** to test your audio setup
- **Important:** Always start at low volume and adjust to a comfortable level

#### 2. Step 1 — Tone ↔ Noise Blend

Many people experience tinnitus as a "fizzy" mix between a pure tone and noise. This step helps you match that character:

- Use the **Blend slider** to adjust the mix:
  - **0 (Pure Tone):** Pure sine wave
  - **0.5 (50/50):** Equal mix of tone and noise
  - **1 (Pure Noise):** Narrowband noise only
- Click **"Preview"** to hear the hybrid sound at your current frequency estimate
- Adjust the blend until it matches your tinnitus character
- This blend will be used for all subsequent assessment sounds

#### 3. Step 2 — Pitch Match (A/B Test)

This step finds the frequency that best matches your tinnitus:

- Click **"Start Pitch Match"** to begin
- You'll hear two hybrid sounds: **A** (lower pitch) then **B** (higher pitch)
- Click **"A is Closer"** or **"B is Closer"** to indicate which matches your tinnitus better
- The tool will narrow down the frequency over 16 trials
- Use **"Replay"** to hear the same pair again without advancing
- If the higher pitch (B) becomes inaudible, click **"B Inaudible"** to set an upper limit
- **Optional:** Use the **Tone Slider** below to manually explore frequencies and click **"Set as Estimate"** to update your current estimate

#### 4. Generate Sound Therapy Files

Once you have a frequency estimate:

- The **Tinnitus Frequency** field is pre-filled from your assessment (editable)
- Choose **Modulation Mode:**
  - **Phase Modulation (Recommended):** Subtle timing variations (default)
  - **Amplitude Modulation:** Volume pulsing effect
- Set **Duration** (5-120 minutes, default: 60 minutes)
- **Optional:** Check **"Use Alternative Active Band (A2)"** or **"Use Alternative Sham Band (C2)"** if your tinnitus frequency is near the upper limit of hearing
- Click **"Generate Sound Files"** to create your personalized therapy files
- Two files will be generated:
  - **Active Therapy:** Modulated sounds in your tinnitus frequency band
  - **Control/Sham:** Same modulation in a different frequency band (for comparison)

#### 5. Download and Use

- Click the **download icon** (⬇) next to each file to save it
- Use **"Play"** to preview the generated sounds
- Use the downloaded WAV files as part of your sound therapy regimen
- **Export Assessment Config** to save your assessment data for future reference

### Examples Page

The **Examples** page provides pre-generated 2-minute sound samples at standard frequencies:

- **Frequency Range:** 1.0 kHz to 11.0 kHz (covering low, mid, and high ranges)
- **Modulation Modes:** Both phase and amplitude modulation for each frequency
- **Purpose:** Listen to examples before generating your own personalized files

To access examples, click **"Examples"** in the navigation menu. Each example includes:
- Frequency information with musical note equivalent
- Frequency band used for modulation
- Play and download buttons
- 2-minute duration for quick listening

These examples help you understand how the therapy sounds differ across frequencies and modulation modes.

### Tips for Best Results

1. **Use Headphones:** Provides better frequency isolation and accuracy
2. **Quiet Environment:** Minimize background noise during assessment
3. **Take Your Time:** Don't rush the A/B test - accuracy matters
4. **Start with Phase Modulation:** This was the primary method in the research
5. **Regular Use:** The research suggests regular exposure over time for best results
6. **Volume Safety:** Never use at volumes that could cause hearing damage

## Technical Details

### Sound Generation Algorithm

The tool implements the exact mathematical equations from the research paper:

- **Equation (1):** Carrier signal generation
- **Equation (2):** Amplitude modulation (when amplitude mode is selected)
- **Equation (3):** Phase modulation (when phase mode is selected)
- **Equation (4):** Frequency-dependent modulation index
- **Equation (5):** SMR (Spectral Modulation Rate) modulation

### Generated Files

- **Format:** WAV files, 44.1 kHz sample rate, 16-bit
- **Duration:** User-selectable (5-120 minutes)
- **Structure:** 4-second blocks with 1-second raised-cosine ramps
- **Frequency Bands:** Selected based on Table 1 from the research paper
- **Naming:** `active_[mode]_[frequency]Hz_[duration]min.wav` and `sham_[mode]_[frequency]Hz_[duration]min.wav`

## Safety and Disclaimer

### Important Safety Guidelines

- ⚠️ **Start at low volume** and adjust to a comfortable level
- ⚠️ **Stop immediately** if you experience any discomfort
- ⚠️ **Use headphones** for best results
- ⚠️ **Do not use** at volumes that could cause hearing damage
- ⚠️ **Take breaks** during long listening sessions

### Medical Disclaimer

**This tool is provided for research and educational purposes only.** It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with any questions you may have regarding tinnitus or any medical condition.

The effectiveness of this sound therapy may vary between individuals. Results from the research study may not apply to all cases of tinnitus. Consult with an audiologist or healthcare professional before starting any tinnitus treatment regimen.

## Development

### Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, ShadCN UI
- **Backend:** Node.js with native HTTP server
- **Audio:** Web Audio API (frontend), custom WAV generation (backend)
- **Build Tool:** Vite

### Running Locally

```bash
# Install dependencies
pnpm install

# Start development server (frontend)
pnpm dev

# Start API server (in separate terminal)
pnpm server
```

The frontend runs on `http://localhost:3020` and the API server on `http://localhost:3021`.

### Building for Production

```bash
# Build frontend
pnpm build

# Generate example sound files (optional, for Examples page)
node generate-examples.js

# Start production server
pnpm start
```

### Generating Example Files

To create example sound files for the Examples page:

```bash
node generate-examples.js
```

This generates 2-minute example files at representative frequencies (1.0, 2.0, 4.0, 6.7, 8.0, 11.0 kHz) in both phase and amplitude modulation modes. Files are saved to `public/examples/` and are automatically served by the application.

### Deployment

The tool is configured for deployment on Render.com. See `render.yaml` for deployment configuration.

## License

ISC License

## Acknowledgments

- **Research Team:** Yukhnovich et al. for the groundbreaking research
- **Tool Developer:** Fredrik Holmén
- **Open Source:** Built with React, Vite, and other open-source technologies

## Support

For questions about the research methodology, please refer to the original research paper. For technical issues with this tool, please open an issue in the project repository.

---

**Remember:** This tool is for research and educational purposes. Always consult with healthcare professionals regarding tinnitus treatment.
