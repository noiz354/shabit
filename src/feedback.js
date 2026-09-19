/**
 * HabitWealth feedback — AUD-HAPT-01 + AUD-SND-01
 * APIs 40, 11, 79: Vibration, Web Audio, Wake Lock
 * - Setting-gated vibration map
 * - Optional blip OFF default
 * - Transient wake-lock during celebration
 */

import { getPrefs } from "./storage/prefs.js";

const VIBRATION_MAP = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [20, 30, 20],
  error: [50, 30, 50],
  warning: [20, 50],
  selection: [10],
  action_confirmed: [20],
  task_succeeded: [20, 30, 20],
  task_failed: [50, 30, 50],
};

let audioCtx = null;
let wakeLockSentinel = null;

function getAudioContext() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

export async function vibrate(patternName) {
  try {
    const prefs = await getPrefs().catch(() => ({ feedback: { haptics: true } }));
    if (!prefs.feedback?.haptics) return false;
    if (!("vibrate" in navigator)) return false;
    const pattern = VIBRATION_MAP[patternName] || VIBRATION_MAP.light;
    // SI no-op (unsupported) — guarded
    const ok = navigator.vibrate(pattern);
    return !!ok;
  } catch {
    return false;
  }
}

export async function playBlip(type = "success") {
  try {
    const prefs = await getPrefs().catch(() => ({ feedback: { sound: false } }));
    if (!prefs.feedback?.sound) return false; // OFF default per spec 04
    // Respect silent mode? Web Audio can't detect silent switch, but we respect user setting OFF default

    const ctx = getAudioContext();
    if (!ctx) return false;

    // Resume if suspended (needs user gesture)
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Simple blip: 800Hz → 1200Hz quick
    osc.type = "sine";
    osc.frequency.setValueAtTime(type === "success" ? 800 : 400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(type === "success" ? 1200 : 200, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);

    return true;
  } catch (e) {
    console.warn("[feedback] blip failed", e);
    return false;
  }
}

// Transient wake-lock during celebration (AUD-SND-01, API 79)
export async function requestWakeLock() {
  try {
    if (!("wakeLock" in navigator)) return null;
    if (document.visibilityState !== "visible") return null;
    const sentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel = sentinel;
    sentinel.addEventListener("release", () => {
      // console.debug("[wakeLock] released");
      wakeLockSentinel = null;
    });
    return sentinel;
  } catch (e) {
    console.warn("[wakeLock] request failed", e);
    return null;
  }
}

export async function releaseWakeLock() {
  try {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch {}
}

// Combined feedback for habit complete (spec 08: haptic heavy + confetti 300ms)
export async function feedbackHabitComplete() {
  vibrate("task_succeeded");
  playBlip("success");
  // Wake-lock transient during confetti
  const lock = await requestWakeLock();
  setTimeout(() => releaseWakeLock(), 1000);
  return lock;
}

export async function feedbackError() {
  vibrate("task_failed");
  playBlip("error");
}

export async function feedbackSelection() {
  vibrate("selection");
}

export const feedback = {
  vibrate,
  playBlip,
  requestWakeLock,
  releaseWakeLock,
  feedbackHabitComplete,
  feedbackError,
  feedbackSelection,
  VIBRATION_MAP,
};
