/**
 * HabitWealth gestures — AUD-GEST-01 + AUD-MOTION-01
 * APIs 31,32,33: Touch Events, Pointer Events, Pointer Capture
 * Pointer-first with touch fallback, button alternatives, cancel snap-back
 * Spec 04 §1C/§2: drag, swipe-down sheet, pull-to-refresh, slider press
 */

import { clamp, lerp, prefersReducedMotion, motion } from "./motion.js";

const DEFAULTS = {
  dismissDistance: 120,
  progressThreshold: 0.5,
  velocityThreshold: 800, // px/s
};

// Utility: get pointer position
function getPoint(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

// Sheet drag handler (bottom sheet from bottom)
export function makeSheetDraggable(sheetEl, scrimEl, options = {}) {
  const { onDismiss, onDrag, dismissDistance = DEFAULTS.dismissDistance, progressThreshold = DEFAULTS.progressThreshold, velocityThreshold = DEFAULTS.velocityThreshold } = options;

  if (!sheetEl) return () => {};

  let startY = 0;
  let currentY = 0;
  let dragging = false;
  let startTime = 0;
  let pointerId = null;

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // only left click / touch
    const point = getPoint(e);
    startY = point.y;
    currentY = point.y;
    startTime = Date.now();
    dragging = true;
    sheetEl.dataset.state = "dragging";
    sheetEl.style.transition = "none";
    if (scrimEl) scrimEl.style.transition = "none";

    if (e.pointerId !== undefined) {
      pointerId = e.pointerId;
      try {
        sheetEl.setPointerCapture(pointerId);
      } catch {}
    }

    if (onDrag) onDrag({ state: "pressed", progress: 0 });
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const point = getPoint(e);
    currentY = point.y;
    const deltaY = currentY - startY;
    if (deltaY < 0) return; // only allow drag down for bottom sheet
    const progress = clamp(deltaY / dismissDistance, 0, 1);
    sheetEl.style.transform = `translateY(${deltaY}px)`;
    if (scrimEl) {
      scrimEl.style.opacity = String(1 - progress * 0.35);
    }
    if (onDrag) onDrag({ state: "dragging", progress, deltaY });
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    sheetEl.dataset.state = "open";
    sheetEl.style.transition = "";
    if (scrimEl) scrimEl.style.transition = "";

    const deltaY = currentY - startY;
    const dt = (Date.now() - startTime) / 1000;
    const velocityY = dt > 0 ? deltaY / dt : 0;
    const progress = clamp(deltaY / dismissDistance, 0, 1);
    const shouldCommit = progress >= progressThreshold || velocityY >= velocityThreshold;

    if (pointerId !== null) {
      try {
        sheetEl.releasePointerCapture(pointerId);
      } catch {}
      pointerId = null;
    }

    if (shouldCommit) {
      // Dismiss
      const duration = prefersReducedMotion() ? motion.duration.fast : motion.duration.normal;
      sheetEl.style.transition = `transform ${duration}ms ${motion.easing.exit}`;
      sheetEl.style.transform = `translateY(100%)`;
      if (scrimEl) {
        scrimEl.style.transition = `opacity ${duration}ms ${motion.easing.exit}`;
        scrimEl.style.opacity = "0";
      }
      setTimeout(() => {
        if (onDismiss) onDismiss();
      }, duration);
    } else {
      // Snap back
      const duration = prefersReducedMotion() ? motion.duration.fast : motion.duration.normal;
      sheetEl.style.transition = `transform ${duration}ms ${motion.easing.enter}`;
      sheetEl.style.transform = `translateY(0)`;
      if (scrimEl) {
        scrimEl.style.transition = `opacity ${duration}ms ${motion.easing.enter}`;
        scrimEl.style.opacity = "1";
      }
      if (onDrag) onDrag({ state: "cancelled", progress: 0 });
    }
  }

  // Pointer events first, touch fallback
  if (window.PointerEvent) {
    sheetEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  } else {
    sheetEl.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);
  }

  // Button alternative: close button inside sheet should call onDismiss
  const closeBtn = sheetEl.querySelector("[data-close-sheet]");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (onDismiss) onDismiss();
    });
  }

  return () => {
    if (window.PointerEvent) {
      sheetEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    } else {
      sheetEl.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
    }
  };
}

// Slider press feedback (spec 04 §6)
export function makeSliderInteractive(sliderEl, options = {}) {
  const { onChange, onCommit } = options;
  if (!sliderEl) return () => {};

  let dragging = false;
  let pointerId = null;

  function onPointerDown(e) {
    dragging = true;
    sliderEl.classList.add("dragging");
    // thumb scale 1.15 via CSS :active, but also JS for fallback
    const thumb = sliderEl;
    thumb.style.transform = "scale(1.15)";
    if (e.pointerId !== undefined) {
      pointerId = e.pointerId;
      try {
        sliderEl.setPointerCapture(pointerId);
      } catch {}
    }
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const rect = sliderEl.getBoundingClientRect();
    const point = getPoint(e);
    const ratio = clamp((point.x - rect.left) / rect.width, 0, 1);
    const min = parseFloat(sliderEl.min) || 0;
    const max = parseFloat(sliderEl.max) || 100;
    const value = lerp(min, max, ratio);
    sliderEl.value = String(Math.round(value));
    if (onChange) onChange(sliderEl.value, ratio);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    sliderEl.classList.remove("dragging");
    sliderEl.style.transform = "";
    if (pointerId !== null) {
      try {
        sliderEl.releasePointerCapture(pointerId);
      } catch {}
      pointerId = null;
    }
    if (onCommit) onCommit(sliderEl.value);
  }

  if (window.PointerEvent) {
    sliderEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  } else {
    sliderEl.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);
  }

  // Keyboard alternative
  sliderEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      sliderEl.stepDown();
      if (onChange) onChange(sliderEl.value);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      sliderEl.stepUp();
      if (onChange) onChange(sliderEl.value);
    }
  });

  return () => {
    if (window.PointerEvent) {
      sliderEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    } else {
      sliderEl.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
    }
  };
}

// List → detail swipe (peer) with snap-back
export function makeListSwipeable(listEl, options = {}) {
  const { onSwipeLeft, onSwipeRight, threshold = 80 } = options;
  if (!listEl) return () => {};

  let startX = 0;
  let currentX = 0;
  let dragging = false;

  function onPointerDown(e) {
    const p = getPoint(e);
    startX = p.x;
    dragging = true;
    listEl.style.transition = "none";
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const p = getPoint(e);
    currentX = p.x;
    const deltaX = currentX - startX;
    // Only horizontal, small vertical tolerance
    listEl.style.transform = `translateX(${deltaX}px)`;
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const deltaX = currentX - startX;
    listEl.style.transition = `transform ${motion.duration.normal}ms ${motion.easing.standard}`;
    if (Math.abs(deltaX) >= threshold) {
      if (deltaX < 0 && onSwipeLeft) onSwipeLeft();
      else if (deltaX > 0 && onSwipeRight) onSwipeRight();
      // Keep translated briefly then snap back? Or commit?
      // For now snap back after callback
      setTimeout(() => {
        listEl.style.transform = "translateX(0)";
      }, 100);
    } else {
      // snap back
      listEl.style.transform = "translateX(0)";
    }
  }

  if (window.PointerEvent) {
    listEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  } else {
    listEl.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);
  }

  return () => {
    if (window.PointerEvent) {
      listEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    } else {
      listEl.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
    }
  };
}

// Pull-to-refresh (optional, for feed)
export function makePullToRefresh(containerEl, options = {}) {
  const { onRefresh, threshold = 80 } = options;
  if (!containerEl) return () => {};

  let startY = 0;
  let currentY = 0;
  let dragging = false;

  function onTouchStart(e) {
    if (containerEl.scrollTop !== 0) return;
    const p = getPoint(e);
    startY = p.y;
    dragging = true;
  }

  function onTouchMove(e) {
    if (!dragging) return;
    const p = getPoint(e);
    currentY = p.y;
    const deltaY = currentY - startY;
    if (deltaY > 0) {
      containerEl.style.transform = `translateY(${clamp(deltaY * 0.5, 0, threshold)}px)`;
    }
  }

  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    const deltaY = currentY - startY;
    containerEl.style.transition = `transform ${motion.duration.normal}ms ${motion.easing.standard}`;
    containerEl.style.transform = "translateY(0)";
    if (deltaY >= threshold && onRefresh) {
      onRefresh();
    }
    setTimeout(() => (containerEl.style.transition = ""), motion.duration.normal);
  }

  containerEl.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd);

  return () => {
    containerEl.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  };
}
