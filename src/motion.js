/**
 * HabitWealth motion — AUD-MOTION-01 + T3/T4
 * APIs 95,96,99,156,160: Web Animations, rAF, ResizeObserver, MutationObserver, View Transitions
 * Implements spec 04: deeper=up, back=down, peer=horizontal, sheet from bottom
 * Reduced-motion support + FA fallback
 */

import motionTokens from "../specs/04-motion.tokens.json";

// Tokens
export const motion = {
  duration: {
    instant: motionTokens.duration.instant,
    fast: motionTokens.duration.fast,
    normal: motionTokens.duration.normal,
    emphasized: motionTokens.duration.emphasized,
    large: motionTokens.duration.largeTransition,
  },
  easing: motionTokens.easing,
  spring: motionTokens.spring,
};

// Reduced motion check
export function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Navigation relation → transition
export function transitionFor(relation) {
  // relation: deeper | back | peer | modal
  switch (relation) {
    case "deeper":
      return { enter: "slide-up", exit: "stay", duration: motion.duration.emphasized, easing: motion.easing.enter };
    case "back":
      return { enter: "stay", exit: "slide-down", duration: motion.duration.normal, easing: motion.easing.exit };
    case "peer":
      return { enter: "slide-horizontal", exit: "slide-horizontal", duration: motion.duration.normal, easing: motion.easing.standard };
    case "modal":
      return { enter: "slide-up", exit: "slide-down", duration: motion.duration.emphasized, easing: motion.easing.enter };
    default:
      return { enter: "fade", exit: "fade", duration: motion.duration.fast, easing: motion.easing.standard };
  }
}

// lerp helpers
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
export function interpolateFrame(from, to, progress) {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
    radius: lerp(from.radius, to.radius, progress),
    opacity: lerp(from.opacity, to.opacity, progress),
  };
}

// rAF loop for shared element / appbar progress
export function createRAFLoop(callback) {
  let rafId = null;
  let running = false;

  function loop(ts) {
    if (!running) return;
    callback(ts);
    rafId = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}

// View Transitions API progressive enhancement (ID 160)
export function withViewTransition(updateFn, options = {}) {
  const { types = [] } = options;
  if (prefersReducedMotion()) {
    // reduced-motion: short fade, no travel
    updateFn();
    return Promise.resolve();
  }

  if (document.startViewTransition) {
    try {
      const transition = document.startViewTransition(() => {
        updateFn();
      });
      // Optionally set types if supported (Chrome 125+)
      if (types.length && transition.types) {
        try {
          transition.types.add(...types);
        } catch {}
      }
      return transition.finished || Promise.resolve();
    } catch (e) {
      console.warn("[motion] ViewTransition failed", e);
      updateFn();
      return Promise.resolve();
    }
  } else {
    // Fallback: CSS classes (nav-deeper-enter etc)
    updateFn();
    return Promise.resolve();
  }
}

// Animate element with Web Animations API (ID 95) with reduced-motion fallback
export function animateElement(el, keyframes, opts = {}) {
  if (!el) return null;
  const reduced = prefersReducedMotion();
  const duration = reduced ? motion.duration.fast : opts.duration || motion.duration.normal;
  const easing = reduced ? motion.easing.standard : opts.easing || motion.easing.standard;

  // If reduced motion, convert long travel to fade
  let finalKeyframes = keyframes;
  if (reduced && Array.isArray(keyframes)) {
    // Map translate to opacity only
    finalKeyframes = keyframes.map((kf) => {
      const { transform, ...rest } = kf;
      return { opacity: kf.opacity ?? (kf.transform ? undefined : 1), ...rest };
    });
  }

  try {
    const anim = el.animate(finalKeyframes, {
      duration,
      easing,
      fill: opts.fill || "both",
      ...opts,
    });
    return anim;
  } catch (e) {
    console.warn("[motion] animate failed", e);
    // Fallback: apply final frame directly
    if (Array.isArray(finalKeyframes) && finalKeyframes.length) {
      const last = finalKeyframes[finalKeyframes.length - 1];
      Object.assign(el.style, last);
    }
    return null;
  }
}

// App bar progress — single source (spec 04 §3)
export function createAppBarController(appBarEl) {
  if (!appBarEl) return null;
  let progress = 0; // 0 = expanded, 1 = collapsed
  let state = "expanded"; // expanded | dragging | collapsed

  function setProgress(p, dragging = false) {
    progress = clamp(p, 0, 1);
    state = dragging ? "dragging" : progress >= 0.5 ? "collapsed" : "expanded";
    appBarEl.style.setProperty("--appbar-p", String(progress));
    appBarEl.dataset.state = state;
    // interpolate height, title scale, etc via CSS var
    // height = lerp(expandedHeight, collapsedHeight, progress)
    const expandedH = 152;
    const collapsedH = 56;
    const h = lerp(expandedH, collapsedH, progress);
    appBarEl.style.height = `${h}px`;

    // title scale
    const title = appBarEl.querySelector(".appbar-title");
    if (title) {
      const scale = lerp(1.2, 1, progress);
      const y = lerp(20, 0, progress);
      title.style.transform = `translateY(${y}px) scale(${scale})`;
      title.style.opacity = String(lerp(1, 0.8, progress));
    }
  }

  function settle(velocityY = 0) {
    const VELOCITY_THRESHOLD = 500; // px/s, TBD per spec 04
    if (velocityY < -VELOCITY_THRESHOLD) return setProgress(1);
    if (velocityY > VELOCITY_THRESHOLD) return setProgress(0);
    return setProgress(progress >= 0.5 ? 1 : 0);
  }

  return { setProgress, settle, getProgress: () => progress, getState: () => state };
}

// Skeleton helpers (T3)
export function createSkeleton(type = "card") {
  const el = document.createElement("div");
  el.className = `skeleton skeleton-${type}`;
  el.setAttribute("aria-busy", "true");
  el.setAttribute("aria-label", "Memuat...");
  return el;
}

// Focus trap for sheets/dialogs (spec 04 §4)
export function trapFocus(container) {
  if (!container) return () => {};
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKey(e) {
    if (e.key !== "Tab") return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === "Escape") {
      container.dispatchEvent(new CustomEvent("hw:close-sheet"));
    }
  }

  container.addEventListener("keydown", handleKey);
  // Focus first
  if (first) first.focus();

  return () => container.removeEventListener("keydown", handleKey);
}

// Export for gestures
export const motionHelpers = {
  motion,
  prefersReducedMotion,
  transitionFor,
  lerp,
  clamp,
  interpolateFrame,
  createRAFLoop,
  withViewTransition,
  animateElement,
  createAppBarController,
  createSkeleton,
  trapFocus,
};
