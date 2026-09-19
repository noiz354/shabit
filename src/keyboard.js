/**
 * HabitWealth keyboard-aware CTA + viewport handling — AUD-KBD-01
 * APIs 36,159: VirtualKeyboard API + Visual Viewport API
 * - CTA sticky above keyboard (Android Chrome)
 * - Autosave draft on blur
 * - Zoom 200% layout test support
 */

let vkbSupported = false;
let vvSupported = false;

try {
  vkbSupported = "virtualKeyboard" in navigator;
} catch {
  vkbSupported = false;
}
try {
  vvSupported = "visualViewport" in window;
} catch {
  vvSupported = false;
}

export function isVirtualKeyboardSupported() {
  return vkbSupported;
}
export function isVisualViewportSupported() {
  return vvSupported;
}

// Make CTA sticky above keyboard
export function makeCTAKeyboardAware(ctaEl, inputEl, options = {}) {
  const { offset = 16 } = options;
  if (!ctaEl) return () => {};

  let cleanupFns = [];

  // VirtualKeyboard API (CA 94+)
  if (vkbSupported && navigator.virtualKeyboard) {
    try {
      navigator.virtualKeyboard.overlaysContent = true;

      const onGeometryChange = (e) => {
        const rect = e.target.boundingRect;
        const kbHeight = rect.height;
        if (kbHeight > 0) {
          ctaEl.style.transform = `translateY(-${kbHeight + offset}px)`;
          ctaEl.style.transition = "transform 150ms cubic-bezier(0.2, 0, 0, 1)";
        } else {
          ctaEl.style.transform = "translateY(0)";
        }
      };

      navigator.virtualKeyboard.addEventListener("geometrychange", onGeometryChange);
      cleanupFns.push(() => navigator.virtualKeyboard.removeEventListener("geometrychange", onGeometryChange));
    } catch (e) {
      console.warn("[kbd] virtualKeyboard setup failed", e);
    }
  }

  // VisualViewport fallback (CA/SI)
  if (vvSupported && window.visualViewport) {
    const vv = window.visualViewport;

    const onResize = () => {
      const viewportHeight = vv.height;
      const windowHeight = window.innerHeight;
      const kbHeight = windowHeight - viewportHeight;
      if (kbHeight > 100) {
        // keyboard visible
        ctaEl.style.transform = `translateY(-${kbHeight + offset}px)`;
      } else {
        ctaEl.style.transform = "translateY(0)";
      }
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    cleanupFns.push(() => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    });
  }

  // Fallback: window resize (FA)
  const onWindowResize = () => {
    // Heuristic: if innerHeight shrank significantly, keyboard likely visible
    // We keep CTA visible via CSS sticky + push-up already; this is extra
  };
  window.addEventListener("resize", onWindowResize);
  cleanupFns.push(() => window.removeEventListener("resize", onWindowResize));

  // Autosave draft on input blur (spec 08, 09)
  if (inputEl) {
    const onBlur = () => {
      try {
        const draft = inputEl.value;
        if (draft) {
          localStorage.setItem(`hw:draft:${inputEl.name || inputEl.id || "default"}`, draft);
        }
      } catch {}
    };
    const onFocus = () => {
      // Ensure CTA visible when focused
      ctaEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    inputEl.addEventListener("blur", onBlur);
    inputEl.addEventListener("focus", onFocus);
    cleanupFns.push(() => {
      inputEl.removeEventListener("blur", onBlur);
      inputEl.removeEventListener("focus", onFocus);
    });
  }

  return () => {
    cleanupFns.forEach((fn) => fn());
    ctaEl.style.transform = "";
  };
}

// Draft helpers
export function saveDraft(key, value) {
  try {
    localStorage.setItem(`hw:draft:${key}`, JSON.stringify({ v: value, at: Date.now() }));
  } catch {}
}
export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(`hw:draft:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.v ?? parsed;
  } catch {
    return null;
  }
}
export function clearDraft(key) {
  try {
    localStorage.removeItem(`hw:draft:${key}`);
  } catch {}
}

// Zoom 200% test helper (spec 03 requires 200% text)
export function checkZoom200() {
  const zoom = Math.round((window.visualViewport ? window.visualViewport.scale : 1) * 100);
  return { zoom, is200: zoom >= 200 };
}

// Export
export const keyboardHelpers = {
  isVirtualKeyboardSupported,
  isVisualViewportSupported,
  makeCTAKeyboardAware,
  saveDraft,
  loadDraft,
  clearDraft,
  checkZoom200,
};
