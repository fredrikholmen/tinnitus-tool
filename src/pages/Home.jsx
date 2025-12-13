import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Volume2, Play, Download, Loader2, AlertCircle } from 'lucide-react'

function hzToLabel(hz) {
  if (hz >= 1000) return `${(hz/1000).toFixed(2)} kHz`
  return `${hz.toFixed(0)} Hz`
}

function hzToNote(hz) {
  // A4 = 440 Hz is the reference (MIDI note 69)
  // A4 is note 9 (A) in octave 4
  const A4 = 440
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  
  if (hz <= 0) return ''
  
  // Calculate semitones from A4
  const semitones = 12 * Math.log2(hz / A4)
  // Round to nearest semitone
  const roundedSemitones = Math.round(semitones)
  
  // A4 is note 9 (A) in octave 4
  // Calculate note index: start from A (9), add semitones, wrap around
  const noteIndex = ((9 + roundedSemitones) % 12 + 12) % 12
  // Calculate octave: start from 4, adjust based on semitones
  const octave = 4 + Math.floor((9 + roundedSemitones) / 12)
  
  const noteName = noteNames[noteIndex]
  
  return `${noteName}${octave}`
}

function hzToLabelWithNote(hz) {
  const note = hzToNote(hz)
  const freqLabel = hzToLabel(hz)
  if (note) {
    return `${freqLabel} (${note})`
  }
  return freqLabel
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
function pow2(x) { return Math.pow(2, x) }

export default function Home() {
  const [audioCtx, setAudioCtx] = useState(null)
  const [masterGain, setMasterGain] = useState(null)
  const [estimateHz, setEstimateHz] = useState(8000)
  const [stepOct, setStepOct] = useState(1.0)
  const [trial, setTrial] = useState(0)
  const [maxTrials] = useState(16)
  const [lastPair, setLastPair] = useState(null)
  const [upperLimitHz, setUpperLimitHz] = useState(null) // Track upper frequency limit
  const [tinnitusCharacter, setTinnitusCharacter] = useState(null)
  const [masterLevel, setMasterLevel] = useState(0.08)
  const [matchGain, setMatchGain] = useState(0.05)
  const [blend, setBlend] = useState(0.5) // 0 = pure tone, 1 = pure noise
  const [toneSliderHz, setToneSliderHz] = useState(8000) // For tone slider assessment
  const [tnStatus, setTnStatus] = useState('')
  const [abStatus, setAbStatus] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  
  const [generating, setGenerating] = useState(false)
  const [generatedFiles, setGeneratedFiles] = useState(null)
  const [playingFile, setPlayingFile] = useState(null)
  const [audioElement, setAudioElement] = useState(null)
  const [mode, setMode] = useState('phase')
  const [minutes, setMinutes] = useState(60)
  const [genTinnitusHz, setGenTinnitusHz] = useState(8000)
  const [useAltActive, setUseAltActive] = useState(false)
  const [useAltSham, setUseAltSham] = useState(false)

  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) {
      setAudioElement(audioRef.current)
    }
  }, [])

  const playTone = (freqHz, durationSec, gain) => {
    if (!audioCtx || !masterGain) return
    const osc = audioCtx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = freqHz

    const g = audioCtx.createGain()
    const now = audioCtx.currentTime

    g.gain.setValueAtTime(0.0, now)
    g.gain.linearRampToValueAtTime(gain, now + 0.02)
    g.gain.setValueAtTime(gain, now + durationSec - 0.03)
    g.gain.linearRampToValueAtTime(0.0, now + durationSec)

    osc.connect(g).connect(masterGain)
    osc.start(now)
    osc.stop(now + durationSec)
  }

  const playNarrowbandNoise = (centerHz, durationSec, gain) => {
    if (!audioCtx || !masterGain) return
    const bufferSize = Math.floor(audioCtx.sampleRate * durationSec)
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1)

    const src = audioCtx.createBufferSource()
    src.buffer = buffer

    const bp = audioCtx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = centerHz
    bp.Q.value = 6

    const g = audioCtx.createGain()
    const now = audioCtx.currentTime
    g.gain.setValueAtTime(0.0, now)
    g.gain.linearRampToValueAtTime(gain, now + 0.02)
    g.gain.setValueAtTime(gain, now + durationSec - 0.03)
    g.gain.linearRampToValueAtTime(0.0, now + durationSec)

    src.connect(bp).connect(g).connect(masterGain)
    src.start(now)
    src.stop(now + durationSec)
  }

  const playHybrid = (freqHz, durationSec, gain, blendRatio) => {
    if (!audioCtx || !masterGain) return
    
    const toneGain = gain * (1 - blendRatio)
    const noiseGain = gain * blendRatio
    
    // Play tone component if blend < 1
    if (blendRatio < 1) {
      playTone(freqHz, durationSec, toneGain)
    }
    
    // Play noise component if blend > 0
    if (blendRatio > 0) {
      playNarrowbandNoise(freqHz, durationSec, noiseGain)
    }
  }

  const initAudio = async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = masterLevel
    gain.connect(ctx.destination)
    setAudioCtx(ctx)
    setMasterGain(gain)
  }

  const calibrationTone = () => {
    playTone(1000, 1.2, 0.15)
  }

  const startToneVsNoise = () => {
    setTnStatus("Playing tone then noise…")
    playTone(estimateHz, 0.8, 0.12)
    setTimeout(() => playNarrowbandNoise(estimateHz, 0.8, 0.12), 900)
    setTimeout(() => {
      setTnStatus("Pick which is closer.")
    }, 1800)
  }

  const pickCharacter = (kind) => {
    setTinnitusCharacter(kind)
    setTnStatus(`${kind.toUpperCase()}-like`)
  }

  const startAB = () => {
    setTrial(0)
    setStepOct(1.0)
    setUpperLimitHz(null)
    nextABTrial()
  }

  const playCurrentTrial = () => {
    if (!lastPair) {
      // If no pair exists, start a new trial
      if (trial === 0) {
        startAB()
      } else {
        nextABTrial()
      }
      return
    }
    
    const { AHz, BHz } = lastPair
    const gain = 0.12
    const d = 0.55

    // Always play A (lower) then B (higher)
    setAbStatus(`Trial ${trial}/${maxTrials}: Playing A (${hzToLabelWithNote(AHz)}) then B (${hzToLabelWithNote(BHz)})…`)
    
    playHybrid(AHz, d, gain, blend)
    setTimeout(() => playHybrid(BHz, d, gain, blend), (d + 0.25) * 1000)

    setTimeout(() => {
      setAbStatus(`Pick which was closer to your tinnitus (A or B). Step=${stepOct.toFixed(2)} oct`)
    }, (2*d + 0.35) * 1000)
  }

  const nextABTrial = () => {
    const newTrial = trial + 1
    setTrial(newTrial)
    if (newTrial > maxTrials) {
      setAbStatus(`Done. Final estimate: ${hzToLabelWithNote(estimateHz)}`)
      return
    }

    const half = stepOct / 2
    let AHz = clamp(estimateHz * pow2(-half), 500, 16000)
    let BHz = clamp(estimateHz * pow2(+half), 500, 16000)

    // Ensure A is always lower than B
    if (AHz > BHz) {
      [AHz, BHz] = [BHz, AHz]
    }

    // Apply upper limit if set
    if (upperLimitHz !== null && BHz > upperLimitHz) {
      BHz = Math.min(BHz, upperLimitHz * 0.9) // Set B to 90% of upper limit
      // Recalculate A to maintain the step size
      AHz = clamp(BHz * pow2(-stepOct), 500, 16000)
    }

    setLastPair({ AHz, BHz })

    playCurrentTrial()
  }

  const pickAB = (which) => {
    if (!lastPair) return
    const { AHz, BHz } = lastPair

    const newEstimate = (which === "A") ? AHz : BHz
    setEstimateHz(newEstimate)
    setStepOct(stepOct * 0.70)
    nextABTrial()
  }

  const markBInaudible = () => {
    if (!lastPair) return
    const { BHz } = lastPair
    
    // Set upper limit to current B frequency
    setUpperLimitHz(BHz)
    
    // Auto-set useAltSham when B is inaudible (use contingency band)
    setUseAltSham(true)
    
    // Adjust B to be slightly lower (about 10% lower)
    const adjustedBHz = BHz * 0.9
    const { AHz } = lastPair
    
    setLastPair({ AHz, BHz: adjustedBHz })
    
    setAbStatus(`Upper limit set at ${hzToLabelWithNote(BHz)}. Contingency sham band enabled. Playing new pair…`)
    
    // Play the adjusted pair
    setTimeout(() => {
      playCurrentTrial()
    }, 500)
  }

  const playAtEstimate = () => {
    playHybrid(estimateHz, 1.2, clamp(matchGain, 0, 0.5), blend)
  }

  const exportConfig = () => {
    const config = {
      tinnitusHz_estimate: Math.round(estimateHz),
      tinnitusCharacter: tinnitusCharacter ?? "unknown",
      blend: blend,
      masterLevel,
      matchGain,
      suggestedMode: "phase"
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "tinnitus_config.json"
    a.click()
    setExportStatus("Downloaded tinnitus_config.json")
  }

  const generateSounds = async () => {
    if (!genTinnitusHz || genTinnitusHz <= 0) {
      alert("Please enter a valid tinnitus frequency (Hz).")
      return
    }

    setGenerating(true)
    setGeneratedFiles(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tinnitusHz: genTinnitusHz,
          mode,
          minutes,
          useAltActive,
          useAltSham,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      const result = await response.json()
      setGeneratedFiles(result)
    } catch (error) {
      console.error('Generation error:', error)
      alert(`Error generating sounds: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const playFile = (filename, type) => {
    if (audioElement) {
      if (playingFile === filename) {
        audioElement.pause()
        audioElement.currentTime = 0
        setPlayingFile(null)
        return
      }

      const url = `/api/download/${filename}`
      audioElement.src = url
      audioElement.play()
      setPlayingFile(filename)

      audioElement.onended = () => {
        setPlayingFile(null)
      }
    }
  }

  const downloadFile = (filename) => {
    const url = `/api/download/${filename}`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  useEffect(() => {
    if (masterGain) {
      masterGain.gain.value = masterLevel
    }
  }, [masterLevel, masterGain])

  // Auto-populate generation params from assessment
  useEffect(() => {
    if (estimateHz > 0) {
      setGenTinnitusHz(Math.round(estimateHz))
      setToneSliderHz(estimateHz) // Sync tone slider with estimate
    }
  }, [estimateHz])

  // Convert linear slider value (0-100) to logarithmic frequency (500-16000 Hz)
  const sliderToHz = (value) => {
    const minHz = 500
    const maxHz = 16000
    const minLog = Math.log10(minHz)
    const maxLog = Math.log10(maxHz)
    const logValue = minLog + (maxLog - minLog) * (value / 100)
    return Math.pow(10, logValue)
  }

  // Convert frequency to linear slider value (0-100)
  const hzToSlider = (hz) => {
    const minHz = 500
    const maxHz = 16000
    const minLog = Math.log10(minHz)
    const maxLog = Math.log10(maxHz)
    const logHz = Math.log10(hz)
    return ((logHz - minLog) / (maxLog - minLog)) * 100
  }

  const playToneSlider = () => {
    playHybrid(toneSliderHz, 1.2, clamp(matchGain, 0, 0.5), blend)
  }

  const setEstimateFromSlider = () => {
    setEstimateHz(toneSliderHz)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold text-primary">Tinnitus Assessment & Therapy</h1>
        <p className="text-lg text-muted-foreground">
          Assess your tinnitus profile and generate personalized sound therapy files
        </p>
      </div>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-destructive">Safety First</p>
              <p className="text-sm text-muted-foreground">
                Start at low volume. Stop if uncomfortable. Use headphones for best results.
                Do not use at volumes that could cause hearing damage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio Setup</CardTitle>
          <CardDescription>Initialize audio and adjust master volume</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={initAudio} disabled={!!audioCtx}>
              {audioCtx ? 'Audio Enabled' : 'Enable Audio'}
            </Button>
            <Button onClick={calibrationTone} disabled={!audioCtx} variant="outline">
              <Volume2 className="w-4 h-4 mr-2" />
              Play 1 kHz Calibration Tone
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Master Level: {masterLevel.toFixed(3)}
            </label>
            <Slider
              value={masterLevel}
              onChange={(e) => setMasterLevel(Number(e.target.value))}
              min={0}
              max={1}
              step={0.001}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1 — Tone vs Noise Character</CardTitle>
          <CardDescription>
            Compare a pure tone vs narrowband noise at the current estimate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={startToneVsNoise} disabled={!audioCtx} variant="outline">
              Start (Tone vs Noise)
            </Button>
            <Button
              onClick={() => pickCharacter("tone")}
              disabled={!audioCtx || tnStatus !== "Pick which is closer."}
              variant="outline"
            >
              More like TONE
            </Button>
            <Button
              onClick={() => pickCharacter("noise")}
              disabled={!audioCtx || tnStatus !== "Pick which is closer."}
              variant="outline"
            >
              More like NOISE
            </Button>
          </div>
          {tnStatus && (
            <p className="text-sm text-muted-foreground">{tnStatus}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1.5 — Tone ↔ Noise Blend</CardTitle>
          <CardDescription>
            Adjust the blend to match your tinnitus character. Many people experience a "fizzy" mix between tone and noise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">
                Blend: {blend === 0 ? 'Pure Tone' : blend === 1 ? 'Pure Noise' : `${Math.round(blend * 100)}% Noise`}
              </label>
              <Button
                onClick={() => playHybrid(estimateHz, 0.8, 0.12, blend)}
                disabled={!audioCtx}
                variant="outline"
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </div>
            <Slider
              value={blend}
              onChange={(e) => setBlend(Number(e.target.value))}
              min={0}
              max={1}
              step={0.01}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pure Tone</span>
              <span>50/50 Mix</span>
              <span>Pure Noise</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2 — Pitch Match (A/B)</CardTitle>
          <CardDescription>
            You'll hear two hybrid sounds: A (lower pitch) then B (higher pitch). Choose which is closer to your tinnitus.
            Use "Replay" to hear the same pair again without advancing. If B is inaudible, click "B Inaudible" to set an upper limit.
            Optionally use the tone slider below to manually explore frequencies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button 
              onClick={startAB} 
              disabled={!audioCtx} 
              variant="outline"
            >
              {trial === 0 ? 'Start Pitch Match' : 'Restart'}
            </Button>
            {trial > 0 && lastPair && (
              <Button 
                onClick={playCurrentTrial} 
                disabled={!audioCtx || trial > maxTrials} 
                variant="outline"
              >
                <Play className="w-4 h-4 mr-2" />
                Replay
              </Button>
            )}
            <Button
              onClick={() => pickAB("A")}
              disabled={!audioCtx || trial === 0 || trial > maxTrials || !abStatus.includes("Pick which")}
              variant="outline"
            >
              A is Closer
            </Button>
            <Button
              onClick={() => pickAB("B")}
              disabled={!audioCtx || trial === 0 || trial > maxTrials || !abStatus.includes("Pick which")}
              variant="outline"
            >
              B is Closer
            </Button>
            {trial > 0 && lastPair && (
              <Button
                onClick={markBInaudible}
                disabled={!audioCtx || trial > maxTrials || !abStatus.includes("Pick which")}
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                B Inaudible
              </Button>
            )}
          </div>
          {abStatus && (
            <p className="text-sm text-muted-foreground">{abStatus}</p>
          )}
          <div className="pt-2">
            <p className="text-sm">
              Current estimate: <code className="bg-muted px-2 py-1 rounded">{hzToLabelWithNote(estimateHz)}</code>
            </p>
          </div>

          <div className="pt-4 border-t space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">
                  Tone Slider (Optional): {hzToLabelWithNote(toneSliderHz)}
                </label>
                <div className="flex gap-2">
                  <Button
                    onClick={playToneSlider}
                    disabled={!audioCtx}
                    variant="outline"
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </Button>
                  <Button
                    onClick={setEstimateFromSlider}
                    disabled={!audioCtx}
                    variant="outline"
                    size="sm"
                  >
                    Set as Estimate
                  </Button>
                </div>
              </div>
              <Slider
                value={hzToSlider(toneSliderHz)}
                onChange={(e) => setToneSliderHz(sliderToHz(Number(e.target.value)))}
                min={0}
                max={100}
                step={0.1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>500 Hz</span>
                <span>~2.8 kHz</span>
                <span>16 kHz</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this slider to manually explore frequencies. Click "Set as Estimate" to update your current estimate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3 — Loudness Match</CardTitle>
          <CardDescription>
            Adjust until the played hybrid sound (using your selected blend) matches perceived tinnitus loudness
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={playAtEstimate} disabled={!audioCtx} variant="outline">
              <Play className="w-4 h-4 mr-2" />
              Play at Estimate
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Match Gain: {matchGain.toFixed(3)}
            </label>
            <Slider
              value={matchGain}
              onChange={(e) => setMatchGain(Number(e.target.value))}
              min={0}
              max={0.5}
              step={0.001}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate Sound Therapy Files</CardTitle>
          <CardDescription>
            Generate personalized sound therapy files. Parameters are pre-filled from your assessment but can be edited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">
                Tinnitus Frequency (Hz)
              </label>
              
              <input
                type="number"
                value={genTinnitusHz}
                onChange={(e) => setGenTinnitusHz(Number(e.target.value))}
                min={500}
                max={16000}
                step={100}
                className="w-full px-3 py-2 bg-background border border-input rounded-md"
              />
              {estimateHz > 0 && (
                <p className="text-xs text-muted-foreground">
                  from assessment: {hzToLabelWithNote(estimateHz)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Modulation Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md"
              >
                <option value="phase">Phase Modulation (Recommended)</option>
                <option value="amplitude">Amplitude Modulation</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Duration: {minutes} minutes</label>
              <Slider
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                min={5}
                max={120}
                step={5}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAltActive}
                  onChange={(e) => setUseAltActive(e.target.checked)}
                  className="w-4 h-4 rounded border-input"
                />
                <span className="text-sm font-medium">Use Alternative Active Band (A2)</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">
                Use contingency band if preferred active band contains inaudible frequencies
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAltSham}
                  onChange={(e) => setUseAltSham(e.target.checked)}
                  className="w-4 h-4 rounded border-input"
                />
                <span className="text-sm font-medium">Use Alternative Sham Band (C2)</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">
                Use contingency band if preferred sham band contains inaudible frequencies
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Phase Modulation: Subtle timing variations (default). Amplitude Modulation: Volume pulsing effect.
          </p>

          <div className="flex items-center gap-4">
            <Button
              onClick={exportConfig}
              disabled={!audioCtx}
              variant="outline"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Assessment Config
            </Button>
            <Button
              onClick={generateSounds}
              disabled={generating || !genTinnitusHz || genTinnitusHz <= 0}
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Generate Sound Files
                </>
              )}
            </Button>
          </div>
          {exportStatus && (
            <p className="text-sm text-muted-foreground">{exportStatus}</p>
          )}

          {generatedFiles && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                Generated files: {hzToLabelWithNote(generatedFiles.tinnitusHz)}, {generatedFiles.mode} mode, {generatedFiles.minutes}min
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Active Therapy</p>
                  <p className="text-xs text-muted-foreground">
                    Band: {generatedFiles.activeBand.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => playFile(generatedFiles.active, 'active')}
                      variant="outline"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {playingFile === generatedFiles.active ? 'Stop' : 'Play'}
                    </Button>
                    <button
                      onClick={() => downloadFile(generatedFiles.active)}
                      className="p-2 hover:bg-accent rounded-md transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Control/Sham</p>
                  <p className="text-xs text-muted-foreground">
                    Band: {generatedFiles.shamBand.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => playFile(generatedFiles.sham, 'sham')}
                      variant="outline"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {playingFile === generatedFiles.sham ? 'Stop' : 'Play'}
                    </Button>
                    <button
                      onClick={() => downloadFile(generatedFiles.sham)}
                      className="p-2 hover:bg-accent rounded-md transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <audio ref={audioRef} className="hidden" />
        </CardContent>
      </Card>
    </div>
  )
}

