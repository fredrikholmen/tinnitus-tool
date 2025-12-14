import { generateSoundFiles } from './src/soundGeneratorAPI.js';
import { performance } from 'perf_hooks';

async function testPerformance() {
  console.log('Performance Test: Sound Generation\n');
  console.log('='.repeat(50));
  
  const testCases = [
    { minutes: 5, name: '5 minutes' },
    { minutes: 10, name: '10 minutes' },
    { minutes: 30, name: '30 minutes' },
  ];
  
  for (const test of testCases) {
    console.log(`\nTesting ${test.name}...`);
    const startTime = performance.now();
    
    try {
      const result = await generateSoundFiles({
        tinnitusHz: 8000,
        mode: 'phase',
        minutes: test.minutes,
        useAltActive: false,
        useAltSham: false,
      });
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const samplesPerSecond = (test.minutes * 60 * 44100 * 2) / duration; // 2 files
      
      console.log(`  ✓ Completed in ${duration.toFixed(2)}s`);
      console.log(`  ✓ Generated: ${result.active}, ${result.sham}`);
      console.log(`  ✓ Processing rate: ${(samplesPerSecond / 1000000).toFixed(2)}M samples/sec`);
      console.log(`  ✓ Real-time factor: ${(test.minutes * 60 / duration).toFixed(2)}x`);
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Performance test complete');
}

testPerformance().catch(console.error);

