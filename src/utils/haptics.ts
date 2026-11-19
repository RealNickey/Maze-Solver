export type HapticPattern =
  | 'tap'
  | 'carve'
  | 'skip'
  | 'scrubTick'
  | 'dragPickup'
  | 'dragDrop'
  | 'bloom'
  | 'waterRipple'
  | 'hedgeShake'
  | 'birdChirp'
  | 'solveSuccess';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 9,
  carve: 8,
  skip: [6, 20, 6],
  scrubTick: 5,
  dragPickup: 14,
  dragDrop: [10, 22, 16],
  bloom: 10,
  waterRipple: 7,
  hedgeShake: [8, 16, 6],
  birdChirp: [7, 18, 9],
  solveSuccess: [14, 34, 18, 34, 30],
};

let lastVibrationAt = 0;

export function triggerHaptic(pattern: HapticPattern, throttleMs = 0): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  const now = performance.now();
  if (throttleMs > 0 && now - lastVibrationAt < throttleMs) {
    return;
  }
  lastVibrationAt = now;

  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Gracefully ignore in unsupported environments
  }
}
