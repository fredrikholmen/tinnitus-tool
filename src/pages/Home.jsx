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
  const [masterLevel, setMasterLevel] = useState(0.08)
  const [blend, setBlend] = useState(0.5) // 0 = pure tone, 1 = pure noise
  const [toneSliderHz, setToneSliderHz] = useState(8000) // For tone slider assessment
  const [abStatus, setAbStatus] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState('')
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

  // Auto-initialize audio on mount
  useEffect(() => {
    if (!audioCtx) {
      initAudio()
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

  const exportConfig = () => {
    const config = {
      tinnitusHz_estimate: Math.round(estimateHz),
      blend: blend,
      masterLevel,
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
    setGenerationProgress(0)
    setGenerationStatus('Initializing...')

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
          useProgress: true, // Request progress updates
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      // Handle Server-Sent Events stream
      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || '' // Keep incomplete message in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'complete') {
                  setGeneratedFiles(data.result)
                  setGenerationProgress(100)
                  setGenerationStatus('Complete!')
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                } else if (data.type === 'start') {
                  setGenerationStatus(data.message || 'Starting...')
                  setGenerationProgress(0)
                } else if (data.progress !== undefined) {
                  // Progress update
                  const progress = Math.round(data.progress * 100)
                  setGenerationProgress(progress)
                  const fileType = data.fileType === 'active' ? 'Active' : 'Sham'
                  setGenerationStatus(`Generating ${fileType} file... ${data.block}/${data.totalBlocks} blocks`)
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e, line)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert(`Error generating sounds: ${error.message}`)
      setGenerationStatus('Error')
    } finally {
      setGenerating(false)
      setTimeout(() => {
        setGenerationProgress(0)
        setGenerationStatus('')
      }, 2000)
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
    playHybrid(toneSliderHz, 1.2, 0.12, blend)
  }

  const setEstimateFromSlider = () => {
    setEstimateHz(toneSliderHz)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 p-4">
      {/* Header - Compact */}
      <div className="text-center space-y-1 mb-4">
        <h1 className="text-2xl font-bold text-primary">Tinnitus Assessment & Therapy</h1>
        <p className="text-xs text-muted-foreground">
          Assess your tinnitus profile and generate personalized sound therapy files
        </p>
      </div>

      {/* Safety Warning - Compact */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
        <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
        <span><strong className="text-destructive">Safety:</strong> Start at low volume. Use headphones.</span>
      </div>

      {/* Main Content Row: Introduction + Assessment Tools */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Introduction */}
        <Card className="col-span-3 border-2">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-primary">Do you have tinnitus?</h2>
              <p className="text-sm leading-relaxed">
                Use this tool to create a personalized sound therapy file based on your tinnitus pitch. </p>
                <p className="text-sm leading-relaxed">
                First use the frequency slider to find your tinnitus frequency, then generate a treatment file, and download the audio to try at a safe, low volume. You should listen to the file daily over six weeks.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                A research team in the UK reported that after 6 weeks of use, many participants experienced reduced tinnitus loudness — results vary, and this isn't medical advice.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Master Volume, Step 1 & Step 2 */}
        <div className="col-span-9 grid grid-cols-9 gap-4">
        {/* Master Volume - Vertical Slider */}
        <Card className="col-span-1 border-2">
          <CardContent className="pt-6 pb-6 px-3">
            <div className="flex flex-col items-center gap-3 h-full">
              <label className="text-xs font-bold tracking-wider writing-vertical-rl text-center">
                MASTER
              </label>
              <div className="flex-1 flex items-center justify-center w-full">
                <div 
                  className="relative h-64 w-12 flex items-center justify-center cursor-pointer select-none"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const slider = e.currentTarget
                    const rect = slider.getBoundingClientRect()
                    const height = rect.height
                    
                    const updateValue = (clientY) => {
                      const y = clientY - rect.top
                      const value = Math.max(0, Math.min(1, 1 - (y / height)))
                      setMasterLevel(value)
                    }
                    
                    // Update immediately on mousedown
                    updateValue(e.clientY)
                    
                    const handleMouseMove = (moveEvent) => {
                      moveEvent.preventDefault()
                      moveEvent.stopPropagation()
                      // Recalculate rect in case of scrolling/resizing
                      const currentRect = slider.getBoundingClientRect()
                      const y = moveEvent.clientY - currentRect.top
                      const value = Math.max(0, Math.min(1, 1 - (y / currentRect.height)))
                      setMasterLevel(value)
                    }
                    
                    const handleMouseUp = (upEvent) => {
                      upEvent.preventDefault()
                      document.removeEventListener('mousemove', handleMouseMove, { passive: false })
                      document.removeEventListener('mouseup', handleMouseUp, { passive: false })
                    }
                    
                    document.addEventListener('mousemove', handleMouseMove, { passive: false })
                    document.addEventListener('mouseup', handleMouseUp, { passive: false })
                  }}
                >
                  {/* Vertical slider track */}
                  <div className="absolute inset-y-0 left-1/2 w-2 bg-muted rounded-full -translate-x-1/2" />
                  {/* Slider fill - no transition for instant response */}
                  <div 
                    className="absolute bottom-0 left-1/2 w-2 bg-primary rounded-full -translate-x-1/2"
                    style={{ 
                      height: `${masterLevel * 100}%`,
                      transition: 'none' // Disable transitions for instant response
                    }}
                  />
                  {/* Slider thumb - no transition for instant response */}
                  <div 
                    className="absolute left-1/2 w-6 h-6 bg-primary rounded-full border-2 border-background shadow-lg -translate-x-1/2 z-10 pointer-events-none"
                    style={{ 
                      bottom: `calc(${masterLevel * 100}% - 12px)`,
                      transition: 'none' // Disable transitions for instant response
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-mono font-bold text-primary">
                  {Math.round(masterLevel * 100)}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{masterLevel.toFixed(3)}</span>
              </div>
              <Button 
                onClick={calibrationTone} 
                disabled={!audioCtx} 
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Volume2 className="w-4 h-4 mr-1" />
                Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 1 */}
        <Card className="col-span-3 border-2 h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Step 1 — Tone ↔ Noise Blend</CardTitle>
            <CardDescription className="text-xs">
              Adjust blend to match your tinnitus character
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

        {/* Step 2 */}
        <Card className="col-span-5 border-2 h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Step 2 — Find your tinnitus frequency</CardTitle>
            <CardDescription className="text-xs">
              Choose which sound (A or B) is closer to your tinnitus
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
        </div>
      </div>

      {/* Step 3 - Generation - Full Width Row */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Step 3 — Generate Sound Therapy Files</CardTitle>
          <CardDescription className="text-xs">
            Generate personalized therapy files. Parameters are pre-filled from your assessment.
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
              disabled={!audioCtx || generating}
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
          
          {/* Progress Bar */}
          {generating && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{generationStatus || 'Generating...'}</span>
                <span className="text-muted-foreground font-mono">{generationProgress}%</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This may take 20 seconds to 10 minutes depending on file duration
              </p>
            </div>
          )}
          
          {exportStatus && (
            <p className="text-sm text-muted-foreground">{exportStatus}</p>
          )}
        </CardContent>
      </Card>

      {/* Results Area - DAW Output Section - Empty until files are generated */}
      <Card className={`border-2 transition-all ${generatedFiles ? 'border-primary/50 bg-primary/5' : 'border-dashed border-muted-foreground/30 bg-muted/20'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Generated Files
          </CardTitle>
          <CardDescription className="text-xs">
            {generatedFiles ? 'Your personalized therapy files are ready' : 'Complete the steps above to generate your therapy files'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatedFiles ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 bg-card rounded border">
                <div>
                  <p className="text-sm font-semibold">
                    {hzToLabelWithNote(generatedFiles.tinnitusHz)} • {generatedFiles.mode} mode • {generatedFiles.minutes} min
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active Band: {generatedFiles.activeBand.name} • Sham Band: {generatedFiles.shamBand.name}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Therapy */}
                <div className="p-4 border-2 border-primary/30 rounded-lg bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-primary">Active Therapy</h3>
                      <p className="text-xs text-muted-foreground">Band: {generatedFiles.activeBand.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => playFile(generatedFiles.active, 'active')}
                        variant={playingFile === generatedFiles.active ? 'default' : 'outline'}
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {playingFile === generatedFiles.active ? 'Stop' : 'Play'}
                      </Button>
                      <button
                        onClick={() => downloadFile(generatedFiles.active)}
                        className="p-2 hover:bg-accent rounded-md transition-colors border border-border"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Control/Sham */}
                <div className="p-4 border-2 border-border rounded-lg bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Control/Sham</h3>
                      <p className="text-xs text-muted-foreground">Band: {generatedFiles.shamBand.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => playFile(generatedFiles.sham, 'sham')}
                        variant={playingFile === generatedFiles.sham ? 'default' : 'outline'}
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {playingFile === generatedFiles.sham ? 'Stop' : 'Play'}
                      </Button>
                      <button
                        onClick={() => downloadFile(generatedFiles.sham)}
                        className="p-2 hover:bg-accent rounded-md transition-colors border border-border"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Complete Steps 1-3 to generate your therapy files
              </p>
              <p className="text-xs text-muted-foreground/70">
                Generated files will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <audio ref={audioRef} className="hidden" />
    </div>
  )
}

