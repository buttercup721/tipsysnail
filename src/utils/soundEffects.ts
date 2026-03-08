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

  prime(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
  }

  private playTone({
    startFreq,
    endFreq = startFreq,
    duration,
    volume,
    whenOffset = 0,
    type = 'sine'
  }: ToneOptions): void {
    const context = this.ensureContext();
    const masterGain = this.masterGain;
    if (!context || !masterGain) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

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
    gain.connect(masterGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
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
