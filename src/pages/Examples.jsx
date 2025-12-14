import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Download, Volume2, AlertCircle } from 'lucide-react'

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

export default function Examples() {
  const [examples, setExamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [playingFile, setPlayingFile] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    // Load examples metadata
    fetch('/examples/examples.json')
      .then(res => res.json())
      .then(data => {
        setExamples(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load examples:', err)
        setLoading(false)
      })
  }, [])

  const playFile = (filename) => {
    if (audioRef.current) {
      if (playingFile === filename) {
        // Stop if already playing
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setPlayingFile(null)
        return
      }

      const url = `/examples/${filename}`
      audioRef.current.src = url
      audioRef.current.play()
      setPlayingFile(filename)

      audioRef.current.onended = () => {
        setPlayingFile(null)
      }
    }
  }

  const downloadFile = (filename) => {
    const url = `/examples/${filename}`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  // Group examples by frequency
  const groupedExamples = examples.reduce((acc, example) => {
    if (!acc[example.frequency]) {
      acc[example.frequency] = {
        frequency: example.frequency,
        frequencyLabel: example.frequencyLabel,
        band: example.band,
        phase: null,
        amplitude: null,
      }
    }
    if (example.mode === 'phase') {
      acc[example.frequency].phase = example
    } else {
      acc[example.frequency].amplitude = example
    }
    return acc
  }, {})

  const sortedFrequencies = Object.keys(groupedExamples)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold text-primary">Sound Examples</h1>
        <p className="text-lg text-muted-foreground">
          Listen to example sound therapy files at different frequencies and modulation modes
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-primary">Why Frequency Matters</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tinnitus isn't the same for everyone. People hear it at different pitches (often somewhere between a few kHz and 16 kHz). That's why the therapy is delivered in frequency bands.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The Active sound is designed to target the band that matches your tinnitus pitch. If you choose the wrong band, you may be stimulating the wrong part of your hearing system — which can reduce the effect (and for some people feel unpleasant). Finding your own tinnitus pitch helps the tool pick the right band and generate the most relevant sound file.
            </p>
          </div>
        </CardContent>
      </Card>

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

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading examples...</p>
          </CardContent>
        </Card>
      ) : examples.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No examples found. Please run the generate-examples.js script to create example files.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedFrequencies.map(freq => {
            const group = groupedExamples[freq]
            return (
              <Card key={freq}>
                <CardHeader>
                  <CardTitle>
                    {hzToLabelWithNote(freq)} — {group.frequencyLabel}
                  </CardTitle>
                  <CardDescription>
                    Frequency band: {group.band}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Phase Modulation */}
                    {group.phase && (
                      <div className="space-y-3 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">Phase Modulation</h3>
                            <p className="text-sm text-muted-foreground">
                              Subtle timing variations (Recommended)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => playFile(group.phase.filename)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {playingFile === group.phase.filename ? 'Stop' : 'Play'}
                          </Button>
                          <button
                            onClick={() => downloadFile(group.phase.filename)}
                            className="p-2 hover:bg-accent rounded-md transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          2 minutes • {group.phase.filename}
                        </p>
                      </div>
                    )}

                    {/* Amplitude Modulation */}
                    {group.amplitude && (
                      <div className="space-y-3 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">Amplitude Modulation</h3>
                            <p className="text-sm text-muted-foreground">
                              Volume pulsing effect
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => playFile(group.amplitude.filename)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {playingFile === group.amplitude.filename ? 'Stop' : 'Play'}
                          </Button>
                          <button
                            onClick={() => downloadFile(group.amplitude.filename)}
                            className="p-2 hover:bg-accent rounded-md transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          2 minutes • {group.amplitude.filename}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About These Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            These example sound files demonstrate the therapy sounds at different tinnitus frequencies
            from the research study. Each example is 2 minutes long and shows both phase and amplitude
            modulation modes.
          </p>
          <div className="space-y-2">
            <h3 className="font-semibold">Frequency Ranges:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
              <li><strong>Low (1-2 kHz):</strong> Common for many types of tinnitus</li>
              <li><strong>Mid (4-6.7 kHz):</strong> Typical range for age-related hearing loss</li>
              <li><strong>High (8-11 kHz):</strong> Often associated with noise-induced tinnitus</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Modulation Modes:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
              <li><strong>Phase Modulation:</strong> Subtle timing variations (recommended default)</li>
              <li><strong>Amplitude Modulation:</strong> Noticeable volume pulsing effect</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground italic">
            These examples use the active therapy band for each frequency. For personalized therapy,
            use the Assessment tool to generate files matched to your specific tinnitus frequency.
          </p>
        </CardContent>
      </Card>

      <audio ref={audioRef} className="hidden" />
    </div>
  )
}

