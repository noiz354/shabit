// T13 QA setup — lingkungan "tanpa backend": fetch gagal, IDB palsu, API perangkat di-stub aman.
import "fake-indexeddb/auto";
import { beforeEach, vi } from "vitest";

// Tidak ada backend di unit test → semua fetch gagal (offline_created path)
globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));

// Secure context + WebCrypto (Node 22 punya webcrypto; happy-dom tidak selalu meneruskannya)
try {
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
} catch {}
try {
  const { webcrypto } = await import("node:crypto");
  if (!globalThis.crypto || !globalThis.crypto.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  if (!window.crypto || !window.crypto.subtle) Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
} catch {}

// Stub API perangkat yang tidak ada di happy-dom
if (!("vibrate" in navigator)) Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
if (!("locks" in navigator)) Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
if (!("onLine" in navigator)) Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
if (typeof window.matchMedia !== "function") {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
if (typeof window.scrollTo !== "function") window.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!("animate" in Element.prototype)) Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
window.alert = () => {};
window.confirm = () => true;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = "";
  location.hash = "";
});
