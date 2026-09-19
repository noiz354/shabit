/**
 * HabitWealth speech — AUD-SPCH-01
 * API 19: SpeechSynthesis API
 * - Read aloud weekly insight summary (accessibility complement)
 * - Voice pick + cancel on navigate
 */

let currentUtterance = null;

export function isSpeechSynthesisSupported() {
  return "speechSynthesis" in window;
}

export function getVoices() {
  try {
    return speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

export function findBestVoice(lang = "id-ID") {
  const voices = getVoices();
  if (!voices.length) return null;

  // Prefer id-ID, then en, then first
  let voice = voices.find((v) => v.lang.toLowerCase().includes("id"));
  if (voice) return voice;

  voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  if (voice) return voice;

  voice = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (voice) return voice;

  return voices[0];
}

export async function speak(text, options = {}) {
  const { lang = "id-ID", rate = 1, pitch = 1, onEnd, onError } = options;

  if (!isSpeechSynthesisSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  // Cancel previous
  cancelSpeak();

  return new Promise((resolve) => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = rate;
      utter.pitch = pitch;

      const voice = findBestVoice(lang);
      if (voice) utter.voice = voice;

      utter.onend = () => {
        currentUtterance = null;
        if (onEnd) onEnd();
        resolve({ ok: true });
      };
      utter.onerror = (e) => {
        currentUtterance = null;
        console.warn("[speech] error", e);
        if (onError) onError(e);
        resolve({ ok: false, error: String(e.error || e) });
      };

      currentUtterance = utter;
      speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("[speech] speak failed", e);
      resolve({ ok: false, error: String(e) });
    }
  });
}

export function cancelSpeak() {
  try {
    if (isSpeechSynthesisSupported()) {
      speechSynthesis.cancel();
    }
    currentUtterance = null;
    return true;
  } catch {
    return false;
  }
}

export function isSpeaking() {
  try {
    return speechSynthesis.speaking;
  } catch {
    return false;
  }
}

// Hook for cancel on navigate (call from router)
export function setupCancelOnNavigate() {
  window.addEventListener("hashchange", () => {
    cancelSpeak();
  });
}

export const speechHelpers = {
  isSpeechSynthesisSupported,
  getVoices,
  findBestVoice,
  speak,
  cancelSpeak,
  isSpeaking,
  setupCancelOnNavigate,
};
