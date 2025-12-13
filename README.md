# Tinnitus Therapy Tool

A research-based web application for assessing tinnitus profiles and generating personalized sound therapy files based on the study: "Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating stimulus modulation" (Yukhnovich et al., Hearing Research 2025).

## Features

- **Tinnitus Assessment**: Interactive tools to identify tinnitus frequency and characteristics
  - Tone vs Noise character identification
  - Pitch matching using A/B comparison
  - Loudness matching
- **Sound Generation**: Generate personalized sound therapy files based on assessment results
  - Active therapy files (modulation in tinnitus-related frequency band)
  - Control/Sham files (modulation in control band)
  - Configurable duration (5-120 minutes) and modulation mode (phase/amplitude)
- **Play & Download**: Preview and download generated sound files

## Technology Stack

- **Frontend**: React 18 + Vite
- **UI**: ShadCN UI components with Tailwind CSS
- **Backend**: Node.js HTTP server
- **Audio**: Web Audio API for assessment, server-side WAV generation

## Setup

### Prerequisites

- Node.js 18+ 
- pnpm (package manager)

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start the development servers:

Terminal 1 - API Server (port 3021):
```bash
pnpm run server
```

Terminal 2 - Vite Dev Server (port 3020):
```bash
pnpm run dev
```

3. Open your browser to `http://localhost:3020`

## Usage

1. **Enable Audio**: Click "Enable Audio" to initialize the Web Audio API
2. **Calibrate**: Use the 1 kHz calibration tone to set a comfortable volume
3. **Assess Tinnitus**:
   - Step 1: Determine if your tinnitus is more tone-like or noise-like
   - Step 2: Complete the pitch matching test (A/B comparisons)
   - Step 3: Match the loudness of your tinnitus
4. **Generate Sounds**: Configure duration and modulation mode, then generate therapy files
5. **Download**: Play previews and download the generated WAV files

## Safety

⚠️ **Important**: 
- Start with low volume
- Stop immediately if uncomfortable
- Use headphones for best results
- Do not use at volumes that could cause hearing damage
- This tool is for research and educational purposes only
- Always consult with a healthcare professional before starting any tinnitus treatment regimen

## Project Structure

```
tinnitus-tool/
├── src/
│   ├── components/       # React components
│   │   ├── ui/         # ShadCN UI components
│   │   └── Layout.jsx  # Main layout with navigation
│   ├── pages/          # Page components
│   │   ├── Home.jsx    # Main assessment page
│   │   └── About.jsx   # About page with research summary
│   ├── lib/            # Utility functions
│   ├── server.js       # Node.js API server
│   ├── soundGenerator.js      # Original CLI sound generator
│   ├── soundGeneratorAPI.js   # API version of sound generator
│   └── main.jsx        # React entry point
├── package.json
└── vite.config.js
```

## Research Reference

**Paper**: Yukhnovich et al. (2025). "Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating stimulus modulation." Hearing Research.

**Link**: https://www.sciencedirect.com/science/article/pii/S0378595525001534

## License

ISC

