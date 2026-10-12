import { SoundscapeType } from '../../types/garden';

export class ZenAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private masterGain: GainNode | null = null;
  private soundscapeGain: GainNode | null = null;
  private rakeGain: GainNode | null = null;
  
  // Ambient generators
  private currentSoundscape: SoundscapeType = 'none';
  private ambientNoiseNode: AudioNode | null = null;
  private ambientTimer: number | null = null;

  // Tactile rake generator
  private rakeNoiseNode: AudioNode | null = null;
  private rakeFilter: BiquadFilterNode | null = null;
  private isRaking = false;

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.soundscapeGain = this.ctx.createGain();
      this.soundscapeGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.soundscapeGain.connect(this.masterGain);

      this.rakeGain = this.ctx.createGain();
      this.rakeGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.rakeGain.connect(this.masterGain);

      this.setupRakeAudio();
    } catch (e) {
      console.warn('Web Audio API not supported or initialized:', e);
    }
  }

  public setVolume(vol: number) {
    if (!this.ctx || !this.masterGain) return;
    const clamped = Math.max(0, Math.min(1, vol));
    this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
  }

  public setSoundscape(type: SoundscapeType) {
    this.initContext();
    if (!this.ctx || !this.soundscapeGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.currentSoundscape === type) return;
    this.stopCurrentSoundscape();
    this.currentSoundscape = type;

    if (type === 'none') {
      this.soundscapeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }

    this.soundscapeGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.3);

    switch (type) {
      case 'rain':
        this.startRain();
        break;
      case 'wind':
        this.startWind();
        break;
      case 'birds':
        this.startBirds();
        break;
      case 'water':
        this.startWater();
        break;
    }
  }

  private stopCurrentSoundscape() {
    if (this.ambientNoiseNode) {
      try {
        (this.ambientNoiseNode as AudioBufferSourceNode).stop();
        this.ambientNoiseNode.disconnect();
      } catch {
        // ignore
      }
      this.ambientNoiseNode = null;
    }
    if (this.ambientTimer) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  // --- Rain Synthesis ---
  private startRain() {
    if (!this.ctx || !this.soundscapeGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.soundscapeGain);
    noise.start();
    this.ambientNoiseNode = noise;
  }

  // --- Soft Wind Synthesis ---
  private startWind() {
    if (!this.ctx || !this.soundscapeGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    // Brown noise
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 0.8;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, this.ctx.currentTime);

    // LFO for breathing wind sensation
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(160, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    noise.connect(filter);
    filter.connect(this.soundscapeGain);
    noise.start();
    this.ambientNoiseNode = noise;
  }

  // --- Water Stream Synthesis ---
  private startWater() {
    if (!this.ctx || !this.soundscapeGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.2;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.soundscapeGain);
    noise.start();
    this.ambientNoiseNode = noise;
  }

  // --- Distant Birds Synthesis ---
  private startBirds() {
    if (!this.ctx || !this.soundscapeGain) return;
    // Ambient soft rustle base
    this.startWind();

    // Occasional gentle bird chirp
    this.ambientTimer = window.setInterval(() => {
      if (!this.ctx || !this.soundscapeGain) return;
      if (Math.random() > 0.4) {
        this.playGentleChirp();
      }
    }, 4500);
  }

  private playGentleChirp() {
    if (!this.ctx || !this.soundscapeGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();

    const startFreq = 2200 + Math.random() * 600;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.3, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.9, now + 0.18);

    chirpGain.gain.setValueAtTime(0, now);
    chirpGain.gain.linearRampToValueAtTime(0.04, now + 0.04);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(chirpGain);
    chirpGain.connect(this.soundscapeGain);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  // --- Tactile Sand Raking Friction Sound ---
  private setupRakeAudio() {
    if (!this.ctx || !this.rakeGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.rakeFilter = this.ctx.createBiquadFilter();
    this.rakeFilter.type = 'bandpass';
    this.rakeFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.rakeFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    noise.connect(this.rakeFilter);
    this.rakeFilter.connect(this.rakeGain);
    noise.start();
    this.rakeNoiseNode = noise;
  }

  public setRaking(active: boolean, speed = 1) {
    this.initContext();
    if (!this.ctx || !this.rakeGain || !this.rakeFilter) return;

    if (active) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const targetGain = Math.min(0.25, 0.08 + speed * 0.05);
      this.rakeGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
      this.rakeFilter.frequency.setTargetAtTime(650 + speed * 150, this.ctx.currentTime, 0.05);
      this.isRaking = true;
    } else if (this.isRaking) {
      this.rakeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      this.isRaking = false;
    }
  }

  public destroy() {
    this.stopCurrentSoundscape();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
