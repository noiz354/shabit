/**
 * HabitWealth network adaptive — AUD-NET-01 + AUD-WORK-01 hints
 * APIs 170,174,173: Network Information, deviceMemory, hardwareConcurrency
 * - effectiveType downshifts chart fidelity/image size on 2G (spec 16 adaptive)
 * - Never gates functionality (offline events + real requests are truth)
 * - hardwareConcurrency for worker pool sizing, deviceMemory for chart fidelity tiers
 */

export function getNetworkInfo() {
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return { supported: false, effectiveType: "4g", downlink: 10, rtt: 0, saveData: false };
    return {
      supported: true,
      effectiveType: conn.effectiveType || "4g", // slow-2g, 2g, 3g, 4g
      downlink: conn.downlink || 10,
      rtt: conn.rtt || 0,
      saveData: !!conn.saveData,
      type: conn.type || "unknown",
    };
  } catch {
    return { supported: false, effectiveType: "4g", downlink: 10, rtt: 0, saveData: false };
  }
}

export function getDeviceMemory() {
  try {
    return navigator.deviceMemory || 4; // GB, default mid-tier
  } catch {
    return 4;
  }
}

export function getHardwareConcurrency() {
  try {
    return navigator.hardwareConcurrency || 4;
  } catch {
    return 4;
  }
}

// Adaptive tiers (hint only, never gates functionality)
export function getAdaptiveTier() {
  const net = getNetworkInfo();
  const mem = getDeviceMemory();

  // Tier: high, medium, low
  let tier = "high";

  if (net.effectiveType === "slow-2g" || net.effectiveType === "2g" || net.saveData) {
    tier = "low";
  } else if (net.effectiveType === "3g" || mem <= 2) {
    tier = "medium";
  } else if (mem <= 4) {
    tier = "medium";
  }

  // Fidelity mapping for charts (spec 16)
  const fidelity = {
    high: { chartPoints: 100, imageQuality: 0.8, enableScatter: true },
    medium: { chartPoints: 50, imageQuality: 0.6, enableScatter: false },
    low: { chartPoints: 20, imageQuality: 0.4, enableScatter: false },
  }[tier];

  return { tier, fidelity, network: net, memory: mem, concurrency: getHardwareConcurrency() };
}

// Worker pool sizing based on hardwareConcurrency
export function getWorkerPoolSize() {
  const concurrency = getHardwareConcurrency();
  // Cap at 4, min 1, reserve 1 for main thread
  return Math.max(1, Math.min(4, concurrency - 1));
}

// Listen network changes
export function onNetworkChange(callback) {
  try {
    const conn = navigator.connection;
    if (conn) {
      conn.addEventListener("change", () => callback(getNetworkInfo(), getAdaptiveTier()));
      return () => conn.removeEventListener("change", () => {});
    }
  } catch {}
  return () => {};
}

export const netHelpers = {
  getNetworkInfo,
  getDeviceMemory,
  getHardwareConcurrency,
  getAdaptiveTier,
  getWorkerPoolSize,
  onNetworkChange,
};
