type AudioContextWithWebkit = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

type ToneOptions = {
  startFreq: number;
  endFreq?: number;
  duration: number;
  volume: number;
  whenOffset?: number;
  type?: OscillatorType;
};

type NoiseOptions = {
  duration: number;
  volume: number;
  whenOffset?: number;
  lowpassHz?: number;
  highpassHz?: number;
};

class SnailSoundEffects {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private bgmGain: GainNode | null = null;
  private bgmInitialized = false;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmModulators: OscillatorNode[] = [];
  private bgmPulseTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.context) {
      return this.context;
    }

    const AudioContextCtor = window.AudioContext ?? (window as AudioContextWithWebkit).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    const context = new AudioContextCtor();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  private unlockContext(context: AudioContext): void {
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(0);
    source.stop(context.currentTime + 0.01);
  }

  prime(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    this.unlockContext(context);
  }


  private ensureBgmGain(context: AudioContext): GainNode | null {
    const masterGain = this.masterGain;
    if (!masterGain) {
      return null;
    }

    if (this.bgmGain) {
      return this.bgmGain;
    }

    const bgmGain = context.createGain();
    bgmGain.gain.value = 0.0001;
    bgmGain.connect(masterGain);
    this.bgmGain = bgmGain;
    return bgmGain;
  }

  private createAmbientVoice(
    context: AudioContext,
    target: AudioNode,
    {
      frequency,
      detune,
      volume,
      type,
      filterHz,
      lfoRate,
      lfoDepth,
      tremoloRate,
      tremoloDepth,
      pan
    }: {
      frequency: number;
      detune: number;
      volume: number;
      type: OscillatorType;
      filterHz: number;
      lfoRate: number;
      lfoDepth: number;
      tremoloRate: number;
      tremoloDepth: number;
      pan: number;
    }
  ): void {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const detuneLfo = context.createOscillator();
    const detuneLfoGain = context.createGain();
    const tremoloLfo = context.createOscillator();
    const tremoloLfoGain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;

    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    filter.Q.value = 0.0001;

    gain.gain.value = volume;

    detuneLfo.type = 'sine';
    detuneLfo.frequency.value = lfoRate;
    detuneLfoGain.gain.value = lfoDepth;

    tremoloLfo.type = 'sine';
    tremoloLfo.frequency.value = tremoloRate;
    tremoloLfoGain.gain.value = tremoloDepth;

    oscillator.connect(filter);
    filter.connect(gain);

    if (typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(target);
    } else {
      gain.connect(target);
    }

    detuneLfo.connect(detuneLfoGain);
    detuneLfoGain.connect(oscillator.detune);
    tremoloLfo.connect(tremoloLfoGain);
    tremoloLfoGain.connect(gain.gain);

    oscillator.start();
    detuneLfo.start();
    tremoloLfo.start();

    this.bgmOscillators.push(oscillator);
    this.bgmModulators.push(detuneLfo, tremoloLfo);
  }

  private createAmbientNoise(context: AudioContext, target: AudioNode): void {
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = this.getNoiseBuffer(context);
    source.loop = true;

    highpass.type = 'highpass';
    highpass.frequency.value = 120;

    lowpass.type = 'lowpass';
    lowpass.frequency.value = 540;

    gain.gain.value = 0.0028;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(target);

    source.start();
  }

  startBgm(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const bgmGain = this.ensureBgmGain(context);
    if (!bgmGain) {
      return;
    }

    if (!this.bgmInitialized) {
      this.bgmInitialized = true;

      this.createAmbientVoice(context, bgmGain, {
        frequency: 196,
        detune: -4,
        volume: 0.075,
        type: 'sine',
        filterHz: 720,
        lfoRate: 0.07,
        lfoDepth: 6,
        tremoloRate: 0.11,
        tremoloDepth: 0.01,
        pan: -0.32
      });

      this.createAmbientVoice(context, bgmGain, {
        frequency: 246.94,
        detune: 3,
        volume: 0.06,
        type: 'triangle',
        filterHz: 840,
        lfoRate: 0.05,
        lfoDepth: 7,
        tremoloRate: 0.09,
        tremoloDepth: 0.012,
        pan: 0.28
      });

      this.createAmbientVoice(context, bgmGain, {
        frequency: 293.66,
        detune: -2,
        volume: 0.034,
        type: 'sine',
        filterHz: 980,
        lfoRate: 0.09,
        lfoDepth: 5,
        tremoloRate: 0.13,
        tremoloDepth: 0.008,
        pan: 0.1
      });

      this.createAmbientVoice(context, bgmGain, {
        frequency: 392,
        detune: 5,
        volume: 0.022,
        type: 'triangle',
        filterHz: 1100,
        lfoRate: 0.04,
        lfoDepth: 4,
        tremoloRate: 0.07,
        tremoloDepth: 0.006,
        pan: -0.08
      });

      this.createAmbientNoise(context, bgmGain);
    }

    const when = context.currentTime;
    bgmGain.gain.cancelScheduledValues(when);
    bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), when);
    bgmGain.gain.exponentialRampToValueAtTime(0.26, when + 2.4);
    this.startBgmPulseLoop();
    this.unlockContext(context);
  }

  stopBgm(): void {
    const context = this.context;
    const bgmGain = this.bgmGain;
    if (!context || !bgmGain) {
      return;
    }

    const when = context.currentTime;
    bgmGain.gain.cancelScheduledValues(when);
    bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), when);
    bgmGain.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
    this.stopBgmPulseLoop();
  }

  private playToneToTarget(target: AudioNode, {
    startFreq,
    endFreq = startFreq,
    duration,
    volume,
    whenOffset = 0,
    type = 'sine'
  }: ToneOptions): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    this.unlockContext(context);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const when = context.currentTime + whenOffset;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), when + duration);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(gain);
    gain.connect(target);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
  }

  private playTone(options: ToneOptions): void {
    const context = this.ensureContext();
    const masterGain = this.masterGain;
    if (!context || !masterGain) {
      return;
    }

    this.playToneToTarget(masterGain, options);
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  private playNoise({
    duration,
    volume,
    whenOffset = 0,
    lowpassHz = 2200,
    highpassHz = 120
  }: NoiseOptions): void {
    const context = this.ensureContext();
    const masterGain = this.masterGain;
    if (!context || !masterGain) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    const when = context.currentTime + whenOffset;

    source.buffer = this.getNoiseBuffer(context);

    highpass.type = 'highpass';
    highpass.frequency.value = highpassHz;

    lowpass.type = 'lowpass';
    lowpass.frequency.value = lowpassHz;

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(masterGain);

    source.start(when);
    source.stop(when + duration + 0.03);
  }

  private playBgmPulse(): void {
    const context = this.context;
    const bgmGain = this.bgmGain;
    if (!context || !bgmGain) {
      return;
    }

    this.unlockContext(context);

    this.playToneToTarget(bgmGain, { startFreq: 261.63, endFreq: 261.63, duration: 2.8, volume: 0.022, type: 'sine' });
    this.playToneToTarget(bgmGain, { startFreq: 329.63, endFreq: 329.63, duration: 2.2, volume: 0.014, whenOffset: 0.32, type: 'triangle' });
    this.playToneToTarget(bgmGain, { startFreq: 392.0, endFreq: 392.0, duration: 1.8, volume: 0.01, whenOffset: 0.9, type: 'triangle' });
    this.playToneToTarget(bgmGain, { startFreq: 523.25, endFreq: 392.0, duration: 0.78, volume: 0.012, whenOffset: 2.4, type: 'sine' });
    this.playToneToTarget(bgmGain, { startFreq: 659.25, endFreq: 523.25, duration: 0.54, volume: 0.008, whenOffset: 2.75, type: 'triangle' });
  }

  private startBgmPulseLoop(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.bgmPulseTimer !== null) {
      return;
    }

    this.playBgmPulse();
    this.bgmPulseTimer = window.setInterval(() => {
      this.playBgmPulse();
    }, 4200);
  }

  private stopBgmPulseLoop(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.bgmPulseTimer !== null) {
      window.clearInterval(this.bgmPulseTimer);
      this.bgmPulseTimer = null;
    }
  }

  playUiTap(): void {
    this.playTone({ startFreq: 840, endFreq: 620, duration: 0.045, volume: 0.05, type: 'triangle' });
  }

  playSoftSelect(): void {
    this.playTone({ startFreq: 680, endFreq: 520, duration: 0.06, volume: 0.04, type: 'triangle' });
  }

  playTouchAction(): void {
    this.playTone({ startFreq: 520, endFreq: 350, duration: 0.13, volume: 0.055, type: 'sine' });
    this.playTone({ startFreq: 730, endFreq: 560, duration: 0.08, volume: 0.02, whenOffset: 0.03, type: 'triangle' });
  }

  playFeedAction(): void {
    this.playTone({ startFreq: 620, endFreq: 520, duration: 0.06, volume: 0.04, type: 'triangle' });
    this.playTone({ startFreq: 760, endFreq: 640, duration: 0.06, volume: 0.03, whenOffset: 0.06, type: 'triangle' });
  }

  playEditToggle(isOpen: boolean): void {
    if (isOpen) {
      this.playTone({ startFreq: 360, endFreq: 520, duration: 0.08, volume: 0.045, type: 'triangle' });
      this.playTone({ startFreq: 580, endFreq: 760, duration: 0.06, volume: 0.02, whenOffset: 0.05, type: 'sine' });
      return;
    }

    this.playTone({ startFreq: 520, endFreq: 320, duration: 0.08, volume: 0.04, type: 'triangle' });
  }

  playPropGrab(): void {
    this.playTone({ startFreq: 260, endFreq: 180, duration: 0.05, volume: 0.04, type: 'triangle' });
  }

  playPropSettle(): void {
    this.playTone({ startFreq: 220, endFreq: 150, duration: 0.09, volume: 0.05, type: 'sine' });
    this.playTone({ startFreq: 560, endFreq: 420, duration: 0.05, volume: 0.02, whenOffset: 0.05, type: 'triangle' });
  }

  playPropRemove(): void {
    this.playTone({ startFreq: 240, endFreq: 120, duration: 0.12, volume: 0.045, type: 'triangle' });
  }

  playBlocked(): void {
    this.playTone({ startFreq: 280, endFreq: 210, duration: 0.08, volume: 0.03, type: 'square' });
    this.playTone({ startFreq: 240, endFreq: 180, duration: 0.08, volume: 0.022, whenOffset: 0.08, type: 'square' });
  }

  playGiftEvent(): void {
    this.playTone({ startFreq: 520, endFreq: 660, duration: 0.12, volume: 0.04, type: 'sine' });
    this.playTone({ startFreq: 660, endFreq: 820, duration: 0.14, volume: 0.032, whenOffset: 0.08, type: 'triangle' });
    this.playTone({ startFreq: 820, endFreq: 980, duration: 0.12, volume: 0.022, whenOffset: 0.18, type: 'triangle' });
  }

  playBreedingStart(): void {
    this.playTone({ startFreq: 190, endFreq: 138, duration: 0.18, volume: 0.06, type: 'sine' });
    this.playNoise({ duration: 0.12, volume: 0.02, lowpassHz: 900, highpassHz: 120, whenOffset: 0.02 });
    this.playTone({ startFreq: 640, endFreq: 520, duration: 0.08, volume: 0.018, whenOffset: 0.12, type: 'triangle' });
  }

  playLayingScene(): void {
    this.playTone({ startFreq: 220, endFreq: 175, duration: 0.14, volume: 0.045, type: 'sine' });
    this.playNoise({ duration: 0.08, volume: 0.016, lowpassHz: 850, highpassHz: 110, whenOffset: 0.02 });
    this.playTone({ startFreq: 420, endFreq: 280, duration: 0.1, volume: 0.03, whenOffset: 0.34, type: 'triangle' });
    this.playNoise({ duration: 0.05, volume: 0.012, lowpassHz: 2400, highpassHz: 900, whenOffset: 0.46 });
    this.playTone({ startFreq: 320, endFreq: 210, duration: 0.16, volume: 0.03, whenOffset: 0.74, type: 'sine' });
  }

  playHatchingScene(): void {
    this.playNoise({ duration: 0.05, volume: 0.016, lowpassHz: 2800, highpassHz: 720, whenOffset: 0 });
    this.playTone({ startFreq: 820, endFreq: 640, duration: 0.03, volume: 0.012, whenOffset: 0.04, type: 'square' });
    this.playNoise({ duration: 0.05, volume: 0.018, lowpassHz: 3200, highpassHz: 780, whenOffset: 0.2 });
    this.playTone({ startFreq: 780, endFreq: 580, duration: 0.04, volume: 0.014, whenOffset: 0.24, type: 'square' });
    this.playNoise({ duration: 0.06, volume: 0.02, lowpassHz: 3400, highpassHz: 840, whenOffset: 0.42 });
    this.playTone({ startFreq: 410, endFreq: 620, duration: 0.16, volume: 0.045, whenOffset: 0.66, type: 'sine' });
    this.playTone({ startFreq: 680, endFreq: 980, duration: 0.12, volume: 0.018, whenOffset: 0.74, type: 'triangle' });
  }
}

export const snailSounds = new SnailSoundEffects();
