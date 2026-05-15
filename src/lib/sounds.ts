// src/lib/sounds.ts
// Lightweight sound-effect utility using the Web Audio API.
// No external assets required — tones are synthesized at runtime.
// Safe to call on the server (no-op).

'use client';

let audioCtx: AudioContext | null = null;
let isMuted = false;

const MUTE_KEY = 'jnex_sounds_muted';

function readMutedFromStorage() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  isMuted = readMutedFromStorage();
}

export function setSoundsMuted(muted: boolean) {
  isMuted = muted;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}

export function getSoundsMuted() {
  return isMuted;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (isMuted) return null;
  if (!audioCtx) {
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.18,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Quick attack, then exponential decay for a clean, non-clipping envelope.
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/**
 * Pleasant ascending two-note chime — used for successful returns,
 * successful bulk updates, etc.
 */
export function playSuccessSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  // C6 -> E6 -> G6 (a quick happy arpeggio)
  tone(ctx, 1046.5, t, 0.1, 0.18, 'sine');
  tone(ctx, 1318.5, t + 0.09, 0.1, 0.18, 'sine');
  tone(ctx, 1568.0, t + 0.18, 0.16, 0.18, 'sine');
}

/**
 * Low descending buzzer — used for failed returns, rejected uploads, etc.
 */
export function playErrorSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 220, t, 0.18, 0.22, 'square');
  tone(ctx, 165, t + 0.16, 0.26, 0.22, 'square');
}

/**
 * Subtle confirmation click — used for individual rows being marked
 * during a bulk update.
 */
export function playClickSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 1200, t, 0.04, 0.1, 'triangle');
}
