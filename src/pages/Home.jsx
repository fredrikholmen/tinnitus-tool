import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Volume2, Play, Download, Loader2, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTab } from '@/contexts/TabContext'

function hzToLabel(hz) {
  if (hz >= 1000) return `${(hz/1000).toFixed(2)} kHz`
  return `${hz.toFixed(0)} Hz`
}

function hzToNote(hz) {
  const A4 = 440
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  
  if (hz <= 0) return ''
  
  const semitones = 12 * Math.log2(hz / A4)
  const roundedSemitones = Math.round(semitones)
  const noteIndex = ((9 + roundedSemitones) % 12 + 12) % 12
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

// Large frequency bands (6 total) - each will have 5 sub-bands
const LARGE_BANDS = [
  { name: 'Very Low', lo: 500, hi: 1000, subBands: [
    { name: '500-600 Hz', lo: 500, hi: 600 },
    { name: '600-700 Hz', lo: 600, hi: 700 },
    { name: '700-800 Hz', lo: 700, hi: 800 },
    { name: '800-900 Hz', lo: 800, hi: 900 },
    { name: '900-1000 Hz', lo: 900, hi: 1000 },
  ]},
  { name: 'Low', lo: 1000, hi: 2000, subBands: [
    { name: '1.0-1.2 kHz', lo: 1000, hi: 1200 },
    { name: '1.2-1.4 kHz', lo: 1200, hi: 1400 },
    { name: '1.4-1.6 kHz', lo: 1400, hi: 1600 },
    { name: '1.6-1.8 kHz', lo: 1600, hi: 1800 },
    { name: '1.8-2.0 kHz', lo: 1800, hi: 2000 },
  ]},
  { name: 'Low-Mid', lo: 2000, hi: 4000, subBands: [
    { name: '2.0-2.4 kHz', lo: 2000, hi: 2400 },
    { name: '2.4-2.8 kHz', lo: 2400, hi: 2800 },
    { name: '2.8-3.2 kHz', lo: 2800, hi: 3200 },
    { name: '3.2-3.6 kHz', lo: 3200, hi: 3600 },
    { name: '3.6-4.0 kHz', lo: 3600, hi: 4000 },
  ]},
  { name: 'Mid', lo: 4000, hi: 8000, subBands: [
    { name: '4.0-4.8 kHz', lo: 4000, hi: 4800 },
    { name: '4.8-5.7 kHz', lo: 4800, hi: 5700 },
    { name: '5.7-6.7 kHz', lo: 5700, hi: 6700 },
    { name: '6.7-7.5 kHz', lo: 6700, hi: 7500 },
    { name: '7.5-8.0 kHz', lo: 7500, hi: 8000 },
  ]},
  { name: 'High', lo: 8000, hi: 12000, subBands: [
    { name: '8.0-9.0 kHz', lo: 8000, hi: 9000 },
    { name: '9.0-9.5 kHz', lo: 9000, hi: 9500 },
    { name: '9.5-10.5 kHz', lo: 9500, hi: 10500 },
    { name: '10.5-11.0 kHz', lo: 10500, hi: 11000 },
    { name: '11.0-12.0 kHz', lo: 11000, hi: 12000 },
  ]},
  { name: 'Very High', lo: 12000, hi: 16000, subBands: [
    { name: '12.0-13.0 kHz', lo: 12000, hi: 13000 },
    { name: '13.0-14.0 kHz', lo: 13000, hi: 14000 },
    { name: '14.0-15.0 kHz', lo: 14000, hi: 15000 },
    { name: '15.0-15.5 kHz', lo: 15000, hi: 15500 },
    { name: '15.5-16.0 kHz', lo: 15500, hi: 16000 },
  ]},
]

export default function Home() {
  const { activeTab, setActiveTab } = useTab()
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedLargeBand, setSelectedLargeBand] = useState(null)
  const [selectedSubBand, setSelectedSubBand] = useState(null)
  const [selectedFrequency, setSelectedFrequency] = useState(null)
  const [blendAutoPlaying, setBlendAutoPlaying] = useState(false)
  const [wizardMinutes, setWizardMinutes] = useState(5) // Duration for wizard generation
  
  // Advanced assessment state
  const [estimateHz, setEstimateHz] = useState(8000)
  const [stepOct, setStepOct] = useState(1.0)
  const [trial, setTrial] = useState(0)
  const [maxTrials] = useState(16)
  const [lastPair, setLastPair] = useState(null)
  const [upperLimitHz, setUpperLimitHz] = useState(null)
  const [toneSliderHz, setToneSliderHz] = useState(8000)
  const [abStatus, setAbStatus] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const [mode, setMode] = useState('phase')
  const [minutes, setMinutes] = useState(60)
  const [genTinnitusHz, setGenTinnitusHz] = useState(8000)
  const [useAltActive, setUseAltActive] = useState(false)
  const [useAltSham, setUseAltSham] = useState(false)
  const [generateSham, setGenerateSham] = useState(false)
  
  // Shared state
  const [audioCtx, setAudioCtx] = useState(null)
  const [masterGain, setMasterGain] = useState(null)
  const [masterLevel, setMasterLevel] = useState(0.08)
  const [blend, setBlend] = useState(0.5) // Shared between both tabs
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState('')
  const [generatedFiles, setGeneratedFiles] = useState(null)
  const [playingFile, setPlayingFile] = useState(null)
  const [audioElement, setAudioElement] = useState(null)

  const audioRef = useRef(null)
  const blendIntervalRef = useRef(null)

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
    
    if (blendRatio < 1) {
      playTone(freqHz, durationSec, toneGain)
    }
    
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

  useEffect(() => {
    if (masterGain) {
      masterGain.gain.value = masterLevel
    }
  }, [masterLevel, masterGain])

  // Auto-play blend slider from 0 to 1
  const startBlendAutoPlay = () => {
    if (blendAutoPlaying) {
      stopBlendAutoPlay()
      return
    }
    
    setBlendAutoPlaying(true)
    setBlend(0)
    
    // Use selected frequency or default to 8000 Hz
    const centerFreq = selectedFrequency || (selectedLargeBand ? Math.sqrt(selectedLargeBand.lo * selectedLargeBand.hi) : 8000)
    const duration = 0.5
    const gain = 0.12
    
    // Play initial sound
    playHybrid(centerFreq, duration, gain, 0)
    
    blendIntervalRef.current = setInterval(() => {
      setBlend(prev => {
        const next = Math.min(1.0, prev + 0.01)
        if (next >= 1.0) {
          stopBlendAutoPlay()
          playHybrid(centerFreq, duration, gain, 1.0)
          return 1.0
        }
        // Play sound at current blend
        playHybrid(centerFreq, duration, gain, next)
        return next
      })
    }, 100) // Update every 100ms (slower for better listening)
  }

  const stopBlendAutoPlay = () => {
    if (blendIntervalRef.current) {
      clearInterval(blendIntervalRef.current)
      blendIntervalRef.current = null
    }
    setBlendAutoPlaying(false)
  }

  useEffect(() => {
    return () => {
      if (blendIntervalRef.current) {
        clearInterval(blendIntervalRef.current)
      }
    }
  }, [])

  const playBandSound = (band) => {
    const centerFreq = Math.sqrt(band.lo * band.hi)
    playHybrid(centerFreq, 1.0, 0.12, blend)
  }

  // Advanced assessment functions
  const startAB = () => {
    setTrial(0)
    setStepOct(1.0)
    setUpperLimitHz(null)
    nextABTrial()
  }

  const playCurrentTrial = () => {
    if (!lastPair) {
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

    if (AHz > BHz) {
      [AHz, BHz] = [BHz, AHz]
    }

    if (upperLimitHz !== null && BHz > upperLimitHz) {
      BHz = Math.min(BHz, upperLimitHz * 0.9)
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
    
    setUpperLimitHz(BHz)
    setUseAltSham(true)
    
    const adjustedBHz = BHz * 0.9
    const { AHz } = lastPair
    
    setLastPair({ AHz, BHz: adjustedBHz })
    
    setAbStatus(`Upper limit set at ${hzToLabelWithNote(BHz)}. Contingency sham band enabled. Playing new pair…`)
    
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

  // Auto-populate generation params from assessment
  useEffect(() => {
    if (estimateHz > 0 && activeTab === 'advanced') {
      setGenTinnitusHz(Math.round(estimateHz))
      setToneSliderHz(estimateHz)
    }
  }, [estimateHz, activeTab])

  // Advanced generate sounds function
  const generateSoundsAdvanced = async () => {
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
          generateSham,
          useProgress: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

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
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'start') {
                  setGenerationStatus(data.message || 'Starting generation...')
                  setGenerationProgress(0)
                } else if (data.type === 'complete') {
                  setGeneratedFiles(data.result)
                  setGenerationProgress(100)
                  setGenerationStatus('Complete!')
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                } else if (data.progress !== undefined) {
                  const progressPercent = Math.round(data.progress * 100)
                  setGenerationProgress(progressPercent)
                  
                  const fileType = data.fileType === 'active' ? 'Active' : 'Sham'
                  setGenerationStatus(
                    `Generating ${fileType} file... ${data.block}/${data.totalBlocks} blocks (${progressPercent}%)`
                  )
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
      setGenerationProgress(0)
    } finally {
      setGenerating(false)
    }
  }

  const generateSounds = async () => {
    if (!selectedFrequency || selectedFrequency <= 0) {
      alert("Please complete the frequency selection step.")
      return
    }

    setGenerating(true)
    setGeneratedFiles(null)
    setGenerationProgress(0)
    setGenerationStatus('Initializing...')

    try {
      // Automatically use alternative band if frequency is likely inaudible
      const useAltActive = shouldUseAltBand(selectedFrequency)
      
      // Use EventSource for SSE (but EventSource only supports GET)
      // So we'll use fetch with streaming instead
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tinnitusHz: selectedFrequency,
          mode: 'phase', // Default to phase
          minutes: wizardMinutes, // Use wizard duration slider value
          useAltActive: useAltActive, // Auto-avoid inaudible frequencies
          useAltSham: false,
          generateSham: false,
          useProgress: true, // Request progress updates
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

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
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'start') {
                  setGenerationStatus(data.message || 'Starting generation...')
                  setGenerationProgress(0)
                } else                 if (data.type === 'complete') {
                  setGeneratedFiles(data.result)
                  setGenerationProgress(100)
                  setGenerationStatus('Complete!')
                  // Automatically advance to the last step (download/play)
                  setCurrentStep(6)
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                } else if (data.progress !== undefined) {
                  const progressPercent = Math.round(data.progress * 100)
                  setGenerationProgress(progressPercent)
                  
                  const fileType = data.fileType === 'active' ? 'Active' : 'Sham'
                  setGenerationStatus(
                    `Generating ${fileType} file... ${data.block}/${data.totalBlocks} blocks (${progressPercent}%)`
                  )
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
      setGenerationProgress(0)
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

  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleLargeBandSelect = (band) => {
    setSelectedLargeBand(band)
    setSelectedSubBand(null)
    setSelectedFrequency(null)
  }

  const handleSubBandSelect = (subBand) => {
    setSelectedSubBand(subBand)
    const centerFreq = Math.sqrt(subBand.lo * subBand.hi)
    setSelectedFrequency(centerFreq)
    // Update blend preview frequency
    if (blendAutoPlaying) {
      stopBlendAutoPlay()
    }
  }

  // Determine if we should use alternative band to avoid inaudible frequencies
  const shouldUseAltBand = (freqHz) => {
    // High frequencies (>12 kHz) are more likely to be inaudible for older users
    // Check if the mapped band might contain inaudible frequencies
    const kHz = freqHz / 1000
    const MATCH_KEYS_KHZ = [1.0, 1.2, 1.4, 1.7, 2.0, 2.4, 2.8, 3.4, 4.0, 4.8, 5.7, 6.7, 8.0, 9.5, 11.0, 13.0, 16.0]
    let best = MATCH_KEYS_KHZ[0]
    let bestD = Math.abs(kHz - best)
    for (const k of MATCH_KEYS_KHZ) {
      const d = Math.abs(kHz - k)
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
    
    // For frequencies >= 11 kHz, prefer alternative band if available
    // This helps avoid inaudible high frequencies
    return best >= 11.0
  }

  // Render wizard steps
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-2 w-full mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Welcome to Tinnitus Sound Therapy</CardTitle>
              <CardDescription className="text-base">
                A simple guide to create your personalized therapy file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-lg py-8">
              <p className="text-muted-foreground">
                This tool will help you create a personalized sound therapy file based on your tinnitus. 
                The process takes just a few minutes and involves:
              </p>
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
                <li><strong className="text-foreground">Setting your volume</strong> - Find a comfortable listening level</li>
                <li><strong className="text-foreground">Identifying your tinnitus type</strong> - Is it more like a tone or noise?</li>
                <li><strong className="text-foreground">Finding your frequency</strong> - We'll help you find the pitch that matches your tinnitus</li>
                <li><strong className="text-foreground">Generating your therapy file</strong> - A 5-minute sound file will be created</li>
                <li><strong className="text-foreground">Download and use</strong> - Listen daily for best results</li>
              </ol>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-6">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Research shows:</strong> After 6 weeks of daily use, many people 
                  experience reduced tinnitus loudness. Results vary, and this isn't medical advice.
                </p>
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="border-2 w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Step 1: Set Your Volume</CardTitle>
              <CardDescription className="text-base">
                Adjust the volume to a comfortable level. Start low and increase gradually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 py-8">
              <div className="flex flex-col items-center gap-8">
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Volume Level</span>
                    <span className="text-3xl font-mono font-bold text-primary">
                      {Math.round(masterLevel * 100)}%
                    </span>
                  </div>
                  <div className="relative w-full h-12 flex items-center cursor-pointer select-none"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const slider = e.currentTarget
                      const rect = slider.getBoundingClientRect()
                      const width = rect.width
                      
                      const updateValue = (clientX) => {
                        const x = clientX - rect.left
                        const value = Math.max(0, Math.min(1, x / width))
                        setMasterLevel(value)
                      }
                      
                      updateValue(e.clientX)
                      
                      const handleMouseMove = (moveEvent) => {
                        moveEvent.preventDefault()
                        moveEvent.stopPropagation()
                        const currentRect = slider.getBoundingClientRect()
                        const x = moveEvent.clientX - currentRect.left
                        const value = Math.max(0, Math.min(1, x / currentRect.width))
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
                    <div className="absolute inset-x-0 h-3 bg-muted rounded-full" />
                    <div 
                      className="absolute left-0 h-3 bg-primary rounded-full"
                      style={{ 
                        width: `${masterLevel * 100}%`,
                        transition: 'none'
                      }}
                    />
                    <div 
                      className="absolute w-6 h-6 bg-primary rounded-full border-2 border-background shadow-lg -translate-x-1/2 z-10 pointer-events-none"
                      style={{ 
                        left: `${masterLevel * 100}%`,
                        transition: 'none'
                      }}
                    />
                  </div>
                </div>
                <Button 
                  onClick={calibrationTone} 
                  disabled={!audioCtx} 
                  variant="outline"
                  size="lg"
                  className="w-full max-w-md"
                >
                  <Volume2 className="w-5 h-5 mr-2" />
                  Test Volume
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground max-w-md mx-auto">
                Drag the slider left or right, or click anywhere on it to set your volume. 
                Click "Test Volume" to hear a sample tone.
              </p>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="border-2 w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Step 2: What Does Your Tinnitus Sound Like?</CardTitle>
              <CardDescription className="text-base">
                Is it more like a pure tone (whistle) or noise (hiss)? Or somewhere in between?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 py-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-lg">
                    <strong>
                      {blend === 0 ? 'Pure Tone' : blend === 1 ? 'Pure Noise' : `${Math.round(blend * 100)}% Noise`}
                    </strong>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={startBlendAutoPlay}
                      disabled={!audioCtx}
                      variant={blendAutoPlaying ? "default" : "outline"}
                      size="lg"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {blendAutoPlaying ? 'Stop' : 'Auto Play'}
                    </Button>
                    <Button
                      onClick={() => {
                        const centerFreq = selectedFrequency || (selectedLargeBand ? Math.sqrt(selectedLargeBand.lo * selectedLargeBand.hi) : 8000)
                        playHybrid(centerFreq, 1.0, 0.12, blend)
                      }}
                      disabled={!audioCtx}
                      variant="outline"
                      size="lg"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
                <Slider
                  value={blend}
                  onChange={(e) => {
                    stopBlendAutoPlay()
                    setBlend(Number(e.target.value))
                  }}
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pure Tone (Whistle)</span>
                  <span>50/50 Mix</span>
                  <span>Pure Noise (Hiss)</span>
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Tip:</strong> Click "Auto Play" to hear the sound automatically change from pure tone to pure noise. 
                  When you hear something that matches your tinnitus, click "Stop" and adjust the slider manually if needed.
                </p>
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="border-2 w-full mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">
                Step 3: Find Your Tinnitus Frequency
                {selectedFrequency && ` - ${hzToLabelWithNote(selectedFrequency)}`}
              </CardTitle>
              <CardDescription className="text-base">
                {!selectedLargeBand 
                  ? 'First, choose a large frequency range that might contain your tinnitus'
                  : !selectedSubBand
                  ? `Now choose a more specific range within ${selectedLargeBand.name}`
                  : `Selected: ${selectedSubBand.name} (${hzToLabelWithNote(selectedFrequency)})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 py-8">
              {!selectedLargeBand ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {LARGE_BANDS.map((band, idx) => {
                    const centerFreq = Math.sqrt(band.lo * band.hi)
                    return (
                      <button
                        key={idx}
                        onClick={() => handleLargeBandSelect(band)}
                        className="p-6 border-2 border-primary/30 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="font-semibold text-lg mb-2">{band.name}</div>
                        <div className="text-sm text-muted-foreground mb-3">
                          {hzToLabelWithNote(band.lo)} — {hzToLabelWithNote(band.hi)}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            playBandSound(band)
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          Listen ({hzToLabelWithNote(centerFreq)})
                        </Button>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    onClick={() => {
                      setSelectedLargeBand(null)
                      setSelectedSubBand(null)
                      setSelectedFrequency(null)
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back to Large Bands
                  </Button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedLargeBand.subBands.map((subBand, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSubBandSelect(subBand)}
                        className={`p-4 border-2 rounded-lg hover:bg-primary/5 transition-all text-left ${
                          selectedSubBand === subBand 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border'
                        }`}
                      >
                        <div className="font-semibold mb-1">{subBand.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {hzToLabel(subBand.lo)} - {hzToLabel(subBand.hi)}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            playBandSound(subBand)
                          }}
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Listen
                        </Button>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="border-2 w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Step 4: Generate Your Therapy File</CardTitle>
              <CardDescription className="text-base">
                We'll create a 5-minute sound therapy file using phase modulation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 py-8">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-semibold">Your Settings:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Frequency: <strong className="text-foreground">{hzToLabelWithNote(selectedFrequency)}</strong></li>
                  <li>Tone/Noise: <strong className="text-foreground">
                    {blend === 0 ? 'Pure Tone' : blend === 1 ? 'Pure Noise' : `${Math.round(blend * 100)}% Noise`}
                  </strong></li>
                  <li>Mode: <strong className="text-foreground">Phase Modulation (Recommended)</strong></li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium block">
                    Duration: {wizardMinutes} minutes
                  </label>
                  <Slider
                    value={wizardMinutes}
                    onChange={(e) => setWizardMinutes(Number(e.target.value))}
                    min={5}
                    max={60}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>5 min</span>
                    <span>30 min</span>
                    <span>60 min</span>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={generateSounds}
                disabled={generating || !selectedFrequency}
                size="lg"
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5 mr-2" />
                    Generate Therapy File
                  </>
                )}
              </Button>
              
              {generating && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{generationStatus || 'Generating...'}</span>
                    <span className="text-muted-foreground font-mono">{generationProgress}%</span>
                  </div>
                  <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <Card className="border-2 w-full max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Step 5: Your Therapy File is Ready!</CardTitle>
              <CardDescription className="text-base">
                Download and listen to your personalized sound therapy file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 py-8">
              {generatedFiles ? (
                <div className="space-y-4">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm font-semibold mb-2">File Details:</p>
                    <p className="text-sm text-muted-foreground">
                      {hzToLabelWithNote(generatedFiles.tinnitusHz)} • Phase mode • {generatedFiles.minutes} minutes
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Band: {generatedFiles.activeBand.name}
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      onClick={() => playFile(generatedFiles.active, 'active')}
                      variant={playingFile === generatedFiles.active ? 'default' : 'outline'}
                      size="lg"
                      className="flex-1"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {playingFile === generatedFiles.active ? 'Stop' : 'Play'}
                    </Button>
                    <Button
                      onClick={() => downloadFile(generatedFiles.active)}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="font-semibold text-sm">How to Use:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Listen to the file daily for 6 weeks</li>
                      <li>Use headphones for best results</li>
                      <li>Keep volume at a comfortable level</li>
                      <li>You can listen while doing other activities</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Please complete the generation step first.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  // Render Advanced Assessment UI
  const renderAdvancedUI = () => {
    return (
      <div className="space-y-4">
        {/* Safety Warning - Mobile (horizontal) */}
        <div className="md:hidden flex items-center justify-center gap-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded px-2 py-2">
          <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
          <span><strong className="text-destructive">Safety:</strong> Start at low volume. Use headphones.</span>
        </div>

        {/* Main Content Row: Introduction + Assessment Tools */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Column - Introduction */}
          <Card className="col-span-1 md:col-span-3 border-2">
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
          <div className="col-span-1 md:col-span-9 grid grid-cols-1 md:grid-cols-9 gap-4">
          {/* Master Volume - Vertical Slider */}
          <Card className="col-span-1 md:col-span-1 border-2">
            <CardContent className="pt-6 pb-6 px-3">
              <div className="flex flex-col items-center gap-3">
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
                      
                      updateValue(e.clientY)
                      
                      const handleMouseMove = (moveEvent) => {
                        moveEvent.preventDefault()
                        moveEvent.stopPropagation()
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
                    <div className="absolute inset-y-0 left-1/2 w-2 bg-muted rounded-full -translate-x-1/2" />
                    <div 
                      className="absolute bottom-0 left-1/2 w-2 bg-primary rounded-full -translate-x-1/2"
                      style={{ 
                        height: `${masterLevel * 100}%`,
                        transition: 'none'
                      }}
                    />
                    <div 
                      className="absolute left-1/2 w-6 h-6 bg-primary rounded-full border-2 border-background shadow-lg -translate-x-1/2 z-10 pointer-events-none"
                      style={{ 
                        bottom: `calc(${masterLevel * 100}% - 12px)`,
                        transition: 'none'
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
          <Card className="col-span-1 md:col-span-3 border-2">
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
          <Card className="col-span-1 md:col-span-5 border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Step 2 — Find your tinnitus frequency</CardTitle>
              <CardDescription className="text-xs">
                Choose which sound (A or B) is closer to your tinnitus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <Button 
                onClick={startAB} 
                disabled={!audioCtx} 
                variant="outline"
                size="sm"
                className="flex-1 md:flex-initial"
              >
                {trial === 0 ? 'Start Pitch Match' : 'Restart'}
              </Button>
              {trial > 0 && lastPair && (
                <Button 
                  onClick={playCurrentTrial} 
                  disabled={!audioCtx || trial > maxTrials} 
                  variant="outline"
                  size="sm"
                  className="flex-1 md:flex-initial"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Replay
                </Button>
              )}
              <Button
                onClick={() => pickAB("A")}
                disabled={!audioCtx || trial === 0 || trial > maxTrials || !abStatus.includes("Pick which")}
                variant="outline"
                size="sm"
                className="flex-1 md:flex-initial"
              >
                A is Closer
              </Button>
              <Button
                onClick={() => pickAB("B")}
                disabled={!audioCtx || trial === 0 || trial > maxTrials || !abStatus.includes("Pick which")}
                variant="outline"
                size="sm"
                className="flex-1 md:flex-initial"
              >
                B is Closer
              </Button>
              {trial > 0 && lastPair && (
                <Button
                  onClick={markBInaudible}
                  disabled={!audioCtx || trial > maxTrials || !abStatus.includes("Pick which")}
                  variant="outline"
                  size="sm"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 flex-1 md:flex-initial"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
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
                  checked={generateSham}
                  onChange={(e) => setGenerateSham(e.target.checked)}
                  className="w-4 h-4 rounded border-input"
                />
                <span className="text-sm font-medium">Generate Sham/Control File</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">
                Optional: Only needed for research comparison. Most users only need the Active therapy file.
              </p>
            </div>
            {generateSham && (
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
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Phase Modulation: Subtle timing variations (default). Amplitude Modulation: Volume pulsing effect.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4">
            <Button
              onClick={exportConfig}
              disabled={!audioCtx || generating}
              variant="outline"
              className="flex-1 w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Assessment Config
            </Button>
            <Button
              onClick={generateSoundsAdvanced}
              disabled={generating || !genTinnitusHz || genTinnitusHz <= 0}
              className="flex-1 w-full sm:w-auto"
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

      {/* Results Area - DAW Output Section */}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-card rounded border gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {hzToLabelWithNote(generatedFiles.tinnitusHz)} • {generatedFiles.mode} mode • {generatedFiles.minutes} min
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active Band: {generatedFiles.activeBand.name}
                    {generatedFiles.sham && ` • Sham Band: ${generatedFiles.shamBand.name}`}
                  </p>
                </div>
              </div>
              
              <div className={`grid gap-4 ${generatedFiles.sham ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Active Therapy */}
                <div className="p-4 border-2 border-primary/30 rounded-lg bg-card space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-primary">Active Therapy</h3>
                      <p className="text-xs text-muted-foreground">Band: {generatedFiles.activeBand.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => playFile(generatedFiles.active, 'active')}
                        variant={playingFile === generatedFiles.active ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 sm:flex-initial"
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
                {generatedFiles.sham && (
                  <div className="p-4 border-2 border-border rounded-lg bg-card space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">Control/Sham</h3>
                        <p className="text-xs text-muted-foreground">Band: {generatedFiles.shamBand.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => playFile(generatedFiles.sham, 'sham')}
                          variant={playingFile === generatedFiles.sham ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 sm:flex-initial"
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
                )}
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
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {activeTab === 'simple' ? (
        <div className="flex gap-6 max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          {/* Safety Warning - Sidebar */}
          <div className="hidden md:flex flex-col items-center gap-2 w-16 flex-shrink-0 pt-2">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded-lg px-2 py-4 writing-vertical-rl">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 rotate-90" />
              <span className="text-center">
                <strong className="text-destructive block mb-1">Safety:</strong>
                <span className="block">Start at low volume. Use headphones.</span>
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 flex flex-col items-center">
            {/* Progress Bar */}
            <div className="w-full max-w-4xl bg-muted h-2 mb-6">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>

            {/* Safety Warning - Mobile (horizontal) */}
            <div className="md:hidden flex items-center justify-center gap-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded px-3 py-2 mb-6 w-full max-w-4xl">
              <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
              <span><strong className="text-destructive">Safety:</strong> Start at low volume. Use headphones.</span>
            </div>

            {/* Navigation - Fixed at top */}
            <div className="w-full max-w-4xl flex justify-between items-center sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border py-3 px-4 -mx-4 md:-mx-0 z-50 mb-6">
              <Button
                onClick={prevStep}
                disabled={currentStep === 1}
                variant="outline"
                size="lg"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              
              <div className="text-sm text-muted-foreground font-medium">
                Step {currentStep} of 6
              </div>
              
              <Button
                onClick={nextStep}
                disabled={
                  currentStep === 6 || 
                  (currentStep === 2 && !audioCtx) ||
                  (currentStep === 4 && !selectedFrequency) ||
                  (currentStep === 5 && !generatedFiles)
                }
                size="lg"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Wizard Step */}
            <div className="w-full max-w-4xl">
              {renderStep()}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          {/* Safety Warning - Sidebar */}
          <div className="hidden md:flex flex-col items-center gap-2 w-16 flex-shrink-0 pt-2">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded-lg px-2 py-4 writing-vertical-rl">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 rotate-90" />
              <span className="text-center">
                <strong className="text-destructive block mb-1">Safety:</strong>
                <span className="block">Start at low volume. Use headphones.</span>
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {renderAdvancedUI()}
          </div>
        </div>
      )}

      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
