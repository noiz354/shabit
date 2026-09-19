/**
 * HabitWealth orientation + fullscreen — AUD-ORIENT-01
 * APIs 86,87,97: Screen Orientation, Fullscreen, Screen
 * - Read orientation for chart layout (portrait vs landscape)
 * - Attempt lock only in fullscreen DeX video (none yet — so read-only use)
 * - Fullscreen ECharts expand with fallback dialog
 */

export function isOrientationAPISupported() {
  return !!(screen.orientation);
}
export function isFullscreenSupported() {
  return !!(document.documentElement.requestFullscreen);
}

export function getOrientation() {
  try {
    if (screen.orientation) {
      return {
        type: screen.orientation.type, // portrait-primary, landscape-primary etc
        angle: screen.orientation.angle,
        isPortrait: screen.orientation.type.includes("portrait"),
        isLandscape: screen.orientation.type.includes("landscape"),
      };
    }
  } catch {}
  // Fallback via window
  return {
    type: window.innerHeight > window.innerWidth ? "portrait-primary" : "landscape-primary",
    angle: 0,
    isPortrait: window.innerHeight > window.innerWidth,
    isLandscape: window.innerWidth > window.innerHeight,
  };
}

export function getScreenInfo() {
  try {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      orientation: getOrientation(),
      dpr: window.devicePixelRatio || 1,
    };
  } catch {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      orientation: getOrientation(),
      dpr: 1,
    };
  }
}

// Fullscreen helpers
export async function enterFullscreen(el) {
  if (!el) el = document.documentElement;
  try {
    if (!isFullscreenSupported()) {
      return { ok: false, reason: "unsupported", fallback: true };
    }
    await el.requestFullscreen();
    return { ok: true };
  } catch (e) {
    console.warn("[fullscreen] enter failed", e);
    return { ok: false, error: String(e), fallback: true };
  }
}

export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return { ok: true };
    }
  } catch (e) {
    console.warn("[fullscreen] exit failed", e);
  }
  return { ok: false };
}

export function isFullscreen() {
  return !!document.fullscreenElement;
}

// Chart fullscreen expand — with fallback enlarged dialog
export function makeChartFullscreenable(chartContainer, options = {}) {
  const { onEnter, onExit } = options;
  if (!chartContainer) return () => {};

  let isFs = false;

  async function toggle() {
    if (isFs) {
      const res = await exitFullscreen();
      if (!res.ok && res.fallback) {
        // fallback: remove enlarged class
        chartContainer.classList.remove("chart-fullscreen-fallback");
        isFs = false;
        if (onExit) onExit({ fallback: true });
      }
    } else {
      const res = await enterFullscreen(chartContainer);
      if (!res.ok && res.fallback) {
        // fallback: enlarged dialog
        chartContainer.classList.add("chart-fullscreen-fallback");
        isFs = true;
        if (onEnter) onEnter({ fallback: true });
      } else if (res.ok) {
        isFs = true;
        if (onEnter) onEnter({ fallback: false });
      }
    }
  }

  // Listen fullscreenchange
  function onFsChange() {
    const fs = isFullscreen();
    isFs = fs;
    if (!fs) {
      chartContainer.classList.remove("chart-fullscreen-fallback");
      if (onExit) onExit({ fallback: false });
    }
  }

  document.addEventListener("fullscreenchange", onFsChange);

  // Add button if not exists
  let btn = chartContainer.querySelector("[data-action='fullscreen']");
  if (!btn) {
    btn = document.createElement("button");
    btn.dataset.action = "fullscreen";
    btn.className = "btn btn-secondary btn-small chart-fs-btn";
    btn.textContent = "⛶";
    btn.setAttribute("aria-label", "Layar penuh");
    btn.style.position = "absolute";
    btn.style.top = "8px";
    btn.style.right = "8px";
    btn.addEventListener("click", toggle);
    chartContainer.style.position = "relative";
    chartContainer.appendChild(btn);
  } else {
    btn.addEventListener("click", toggle);
  }

  return () => {
    document.removeEventListener("fullscreenchange", onFsChange);
    btn.removeEventListener("click", toggle);
  };
}

// Orientation change listener for chart density tiers (spec 16)
export function onOrientationChange(callback) {
  const handler = () => {
    callback(getOrientation(), getScreenInfo());
  };

  if (screen.orientation) {
    try {
      screen.orientation.addEventListener("change", handler);
    } catch {
      window.addEventListener("orientationchange", handler);
    }
  } else {
    window.addEventListener("orientationchange", handler);
  }
  window.addEventListener("resize", handler);

  return () => {
    if (screen.orientation) {
      try {
        screen.orientation.removeEventListener("change", handler);
      } catch {}
    }
    window.removeEventListener("orientationchange", handler);
    window.removeEventListener("resize", handler);
  };
}

export const orientationHelpers = {
  isOrientationAPISupported,
  isFullscreenSupported,
  getOrientation,
  getScreenInfo,
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  makeChartFullscreenable,
  onOrientationChange,
};
