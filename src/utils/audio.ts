/**
 * Lush procedural botanical Web Audio synthesizer for Hedgerow.
 * Produces harp/celesta blooms, filtered leafy rustles, liquid water plops,
 * kalimba scrub ticks, and cheerful bluebird chirps with zero external files.
 */

const DREAMY_LYDIAN_SCALE = [
  293.66, // D4
  329.63, // E4
  369.99, // F#4
  415.3,  // G#4 (Lydian dreamy lift!)
  440.0,  // A4
  493.88, // B4
  554.37, // C#5
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  880.0,  // A5
  1174.66, // D6
];

class BotanicalAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = false;
  private lastNoteTime = 0;
  private lastRippleTime = 0;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.ensureContext();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  private playBell(
    freq: number,
    durationSec: number,
    volume: number,
    type: OscillatorType = 'triangle',
    delaySec = 0
  ): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const overGain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    overGain.gain.setValueAtTime(0.0001, now);
    overGain.gain.exponentialRampToValueAtTime(volume * 0.25, now + 0.01);
    overGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 0.55);

    osc.connect(gain);
    overtone.connect(overGain);
    gain.connect(ctx.destination);
    overGain.connect(ctx.destination);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + durationSec + 0.03);
    overtone.stop(now + durationSec + 0.03);
  }

  /** Filtered leafy rustle noise burst */
  public playLeafRustle(volume = 0.045): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNoteTime < 45) return;
    this.lastNoteTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600 + Math.random() * 900, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + 0.16);
  }

  /** Liquid water-droplet plop (pitch sweep up) */
  public playWaterDrop(pitchMul = 1): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastRippleTime < 85) return;
    this.lastRippleTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const baseFreq = (420 + Math.random() * 140) * pitchMul;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.48, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Cheerful two-note pixel bluebird chirp */
  public playBirdChirp(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.11].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startF = idx === 0 ? 1550 : 1820;
      const endF = idx === 0 ? 2150 : 2480;
      osc.frequency.setValueAtTime(startF, now + offset);
      osc.frequency.exponentialRampToValueAtTime(endF, now + offset + 0.065);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.045, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  public playUnionCarve(progressRatio: number): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNoteTime < 55) return;
    this.lastNoteTime = nowMs;

    const idx = Math.min(
      DREAMY_LYDIAN_SCALE.length - 1,
      Math.floor(progressRatio * DREAMY_LYDIAN_SCALE.length)
    );
    this.playBell(DREAMY_LYDIAN_SCALE[idx], 0.18, 0.05, 'triangle');
  }

  public playCycleSkip(): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNoteTime < 75) return;
    this.lastNoteTime = nowMs;
    this.playBell(220, 0.09, 0.03, 'sine');
  }

  public playBfsSprout(depth: number): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNoteTime < 58) return;
    this.lastNoteTime = nowMs;

    const idx = depth % DREAMY_LYDIAN_SCALE.length;
    this.playBell(DREAMY_LYDIAN_SCALE[idx], 0.22, 0.042, 'sine');
  }

  public playFlowerBloom(progressRatio: number): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNoteTime < 45) return;
    this.lastNoteTime = nowMs;

    const idx = Math.min(
      DREAMY_LYDIAN_SCALE.length - 1,
      Math.floor(progressRatio * DREAMY_LYDIAN_SCALE.length)
    );
    this.playBell(DREAMY_LYDIAN_SCALE[idx] * 1.25, 0.32, 0.052, 'triangle');
  }

  public playInteractiveBloom(): void {
    if (!this.enabled) return;
    const idx = Math.floor(Math.random() * 6) + 4;
    this.playBell(DREAMY_LYDIAN_SCALE[idx], 0.28, 0.055, 'triangle');
  }

  public playPathComplete(): void {
    if (!this.enabled) return;
    const chord = [587.33, 739.99, 880.0, 1108.73, 1174.66];
    chord.forEach((f, i) => {
      this.playBell(f, 0.48, 0.052, 'triangle', i * 0.06);
    });
  }

  public playScrubTick(ratio: number): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNoteTime < 40) return;
    this.lastNoteTime = nowMs;
    const idx = Math.min(
      DREAMY_LYDIAN_SCALE.length - 1,
      Math.floor(ratio * DREAMY_LYDIAN_SCALE.length)
    );
    this.playBell(DREAMY_LYDIAN_SCALE[idx], 0.11, 0.032, 'sine');
  }

  public playSoftClick(): void {
    if (!this.enabled) return;
    this.playBell(587.33, 0.07, 0.028, 'sine');
  }
}

export const audioEngine = new BotanicalAudioEngine();
