import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold text-primary">About This Tool</h1>
        <p className="text-lg text-muted-foreground">
          Understanding the science behind tinnitus sound therapy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What is this tool?</CardTitle>
          <CardDescription>
            A research-based application for assessing tinnitus and generating personalized sound therapy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground">
          <p>
            This tool is based on groundbreaking research published in Hearing Research (2025) that explores
            a novel approach to treating chronic tinnitus using sound therapy. The research demonstrates that
            specific sound modulations can help reduce the perception of tinnitus.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How does it work?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">1. Assessment</h3>
            <p className="text-muted-foreground">
              The tool helps you identify the frequency and characteristics of your tinnitus through a series
              of listening tests. You'll compare different sounds to find what matches your tinnitus most closely.
            </p>

            <h3 className="font-semibold text-lg">2. Sound Generation</h3>
            <p className="text-muted-foreground">
              Based on your assessment, the tool generates personalized sound therapy files. These sounds use
              a technique called "cross-frequency de-correlating stimulus modulation" - a method that has shown
              promise in quieting chronic tinnitus.
            </p>

            <h3 className="font-semibold text-lg">3. Treatment</h3>
            <p className="text-muted-foreground">
              The generated sound files can be used as part of a sound therapy regimen. The research suggests
              that regular exposure to these specially modulated sounds may help reduce tinnitus perception over time.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the research found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The study by Yukhnovich et al. (2025) investigated a new type of sound therapy for chronic tinnitus.
            Unlike traditional approaches, this method uses carefully modulated sounds that target specific frequency
            bands related to your tinnitus.
          </p>
          <p>
            The key innovation is the use of "cross-frequency de-correlation" - a technique that modulates sounds
            in a way that may help reduce the neural activity patterns associated with tinnitus. The research found
            that participants experienced significant reductions in tinnitus loudness and annoyance when using this
            approach compared to control conditions.
          </p>
          <p className="text-sm text-muted-foreground italic">
            Important: This tool is for research and educational purposes. Always consult with a healthcare professional
            before starting any tinnitus treatment regimen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The sound generation algorithm implements the mathematical equations from the research paper, creating
            sounds with specific modulation patterns. The tool generates two types of files:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Active therapy:</strong> Modulated sounds in the frequency band matching your tinnitus</li>
            <li><strong>Control/Sham:</strong> Same modulation but in a different frequency band (for comparison)</li>
          </ul>
          <p className="text-muted-foreground">
            The sounds are generated as 60-minute WAV files with smooth transitions between 4-second blocks,
            designed for comfortable listening during therapy sessions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modulation Modes: Phase vs Amplitude</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The tool offers two different modulation methods, each affecting the sound in different ways:
          </p>
          
          <div className="space-y-4">
            <div className="border-l-4 border-primary pl-4">
              <h3 className="font-semibold text-lg mb-2">Phase Modulation</h3>
              <p className="text-muted-foreground mb-2">
                <strong>How it works:</strong> Modulates the timing/phase of the sound waves rather than their volume.
                The phase of frequencies in your tinnitus band shifts continuously, creating subtle timing variations.
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>What it sounds like:</strong> More subtle and smooth. The sound maintains consistent volume
                but has gentle, rhythmic variations in character.
              </p>
              <p className="text-muted-foreground">
                <strong>When to use:</strong> This is the <strong>default and recommended</strong> mode. Phase modulation
                was the primary method used in the research study and showed effective results. It's generally more
                comfortable for extended listening and less likely to cause fatigue.
              </p>
            </div>

            <div className="border-l-4 border-accent pl-4">
              <h3 className="font-semibold text-lg mb-2">Amplitude Modulation</h3>
              <p className="text-muted-foreground mb-2">
                <strong>How it works:</strong> Modulates the volume/amplitude of the sound waves. The loudness of
                frequencies in your tinnitus band varies rhythmically, creating a pulsing or breathing effect.
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>What it sounds like:</strong> More noticeable volume variations. The sound has a rhythmic
                pulsing quality as the volume increases and decreases.
              </p>
              <p className="text-muted-foreground">
                <strong>When to use:</strong> If phase modulation doesn't seem effective for you, or if you prefer
                a more noticeable modulation effect. Some users may find amplitude modulation more engaging, though
                it can be more fatiguing during long listening sessions.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Recommendation:</strong> Start with <strong>Phase Modulation</strong> as it was the primary
              method in the research. If you don't notice improvement after several sessions, you can try
              Amplitude Modulation. Both methods use the same underlying cross-frequency de-correlation technique,
              just applied differently to the sound waves.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Read the Research</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">
            For more detailed information about the scientific methodology and results, please refer to the
            original research paper:
          </p>
          <a
            href="https://www.sciencedirect.com/science/article/pii/S0378595525001534"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button className="w-full sm:w-auto">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Research Paper
            </Button>
          </a>
          <p className="mt-4 text-sm text-muted-foreground">
            <strong>Citation:</strong> Yukhnovich et al. (2025). "Chronic tinnitus is quietened by sound therapy
            using a novel cross-frequency de-correlating stimulus modulation." Hearing Research.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety and Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            <strong>Important safety guidelines:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Start with low volume and adjust to a comfortable level</li>
            <li>Stop immediately if you experience any discomfort</li>
            <li>Use headphones for best results</li>
            <li>Do not use at volumes that could cause hearing damage</li>
          </ul>
          <p className="text-sm text-muted-foreground italic mt-4">
            This tool is provided for research and educational purposes only. It is not a substitute for professional
            medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with any
            questions you may have regarding tinnitus or any medical condition.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credits & Acknowledgments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg mb-2">Tool Developer</h3>
              <p className="text-muted-foreground">
                This web application was developed by{' '}
                <a
                  href="https://www.linkedin.com/in/fredrikholmen/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Fredrik Holmén
                </a>
                {' '}as an open-source implementation of the research methodology.
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-2">Research & Intellectual Property</h3>
              <p className="text-muted-foreground mb-3">
                The sound therapy method, algorithm, and research findings are the intellectual property of the
                research team. This tool implements the methodology described in the following peer-reviewed publication:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">
                  <strong>Yukhnovich et al. (2025)</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  "Chronic tinnitus is quietened by sound therapy using a novel cross-frequency de-correlating
                  stimulus modulation."
                </p>
                <p className="text-sm text-muted-foreground">
                  <em>Hearing Research</em>
                </p>
                <a
                  href="https://www.sciencedirect.com/science/article/pii/S0378595525001534"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Article
                  </Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground italic mt-3">
                All rights to the research methodology, algorithm, and scientific findings belong to the authors
                and their respective institutions as specified in the publication. This tool is provided for
                research and educational purposes in accordance with the article's open access terms.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

