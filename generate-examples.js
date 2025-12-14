import { generateSoundFiles } from './src/soundGeneratorAPI.js';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Representative frequency intervals from the research (kHz)
// Selected to cover low, mid, and high frequency ranges
const EXAMPLE_FREQUENCIES = [
  { hz: 1000, label: '1.0 kHz (Low)' },
  { hz: 2000, label: '2.0 kHz (Low-Mid)' },
  { hz: 4000, label: '4.0 kHz (Mid)' },
  { hz: 6700, label: '6.7 kHz (Mid-High)' },
  { hz: 8000, label: '8.0 kHz (High)' },
  { hz: 11000, label: '11.0 kHz (Very High)' },
];

const MODES = ['phase', 'amplitude'];
const MINUTES = 2; // 2-minute examples as requested

async function generateExamples() {
  const examplesDir = path.join(__dirname, 'public', 'examples');
  
  // Ensure examples directory exists
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir, { recursive: true });
  }

  console.log('Generating example sound files...\n');
  console.log('='.repeat(60));

  const examples = [];

  for (const freq of EXAMPLE_FREQUENCIES) {
    for (const mode of MODES) {
      console.log(`\nGenerating: ${freq.label}, ${mode} modulation...`);
      
      try {
        const result = await generateSoundFiles({
          tinnitusHz: freq.hz,
          mode: mode,
          minutes: MINUTES,
          useAltActive: false,
          useAltSham: false,
        });

        // Copy active file to examples directory with a clean name
        const exampleFilename = `example_${freq.hz}Hz_${mode}.wav`;
        const generatedDir = path.join(__dirname, 'src', 'generated');
        const sourcePath = path.join(generatedDir, result.active);
        const destPath = path.join(examplesDir, exampleFilename);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`  ✓ Created: ${exampleFilename}`);
          
          examples.push({
            frequency: freq.hz,
            frequencyLabel: freq.label,
            mode: mode,
            filename: exampleFilename,
            band: result.activeBand.name,
          });
        } else {
          console.error(`  ✗ Source file not found: ${sourcePath}`);
        }
      } catch (error) {
        console.error(`  ✗ Error generating ${freq.label} ${mode}: ${error.message}`);
      }
    }
  }

  // Generate examples metadata JSON
  const metadataPath = path.join(examplesDir, 'examples.json');
  fs.writeFileSync(metadataPath, JSON.stringify(examples, null, 2));
  console.log(`\n✓ Generated metadata: examples.json`);

  console.log('\n' + '='.repeat(60));
  console.log(`\nGenerated ${examples.length} example files in: ${examplesDir}`);
  console.log('\nExample files are ready to use in the Examples page.');
}

generateExamples().catch(console.error);

