/**
 * HabitWealth share — AUD-SHARE-01
 * APIs 81,84: Web Share API + Clipboard API
 * - Share streak card (no financial specifics, spec 10) + referral link
 * - navigator.share with clipboard fallback + toast
 */

import { showToast } from "./ui.js"; // toast bersama, token-only

export function isWebShareSupported() {
  return !!(navigator.share);
}

export function isClipboardSupported() {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}

export async function shareStreakCard({ streakDays, message }) {
  const text = message || `Konsisten ${streakDays} hari di HabitWealth! 🎉`;
  const url = `${location.origin}${location.pathname}#/beranda?source=share`;

  // No financial specifics per spec 10
  const shareData = {
    title: "HabitWealth",
    text,
    url,
  };

  if (isWebShareSupported()) {
    try {
      // Check canShare if files needed (we don't share files for streak card per spec — no financial specifics)
      await navigator.share(shareData);
      return { shared: true, via: "web-share" };
    } catch (e) {
      if (e.name === "AbortError") return { shared: false, reason: "aborted" };
      console.warn("[share] web share failed, fallback clipboard", e);
    }
  }

  // Fallback: clipboard
  const clipboardText = `${text} ${url}`;
  const copied = await copyToClipboard(clipboardText);
  if (copied) {
    showToast("Tautan disalin — bagikan ke teman!");
    return { shared: true, via: "clipboard" };
  }

  return { shared: false, reason: "unsupported" };
}

export async function shareReferralLink(code) {
  const url = `${location.origin}${location.pathname}#/beranda?ref=${code}&source=referral`;
  const text = `Coba HabitWealth bareng! Pakai kode referral ku: ${code}`;

  if (isWebShareSupported()) {
    try {
      await navigator.share({ title: "HabitWealth Referral", text, url });
      return { shared: true, via: "web-share" };
    } catch (e) {
      if (e.name === "AbortError") return { shared: false, reason: "aborted" };
    }
  }

  const copied = await copyToClipboard(url);
  if (copied) {
    showToast("Link referral disalin!");
    return { shared: true, via: "clipboard" };
  }
  return { shared: false };
}

export async function copyToClipboard(text) {
  try {
    if (isClipboardSupported()) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn("[clipboard] write failed", e);
  }

  // Fallback: execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copySummaryText(text) {
  const ok = await copyToClipboard(text);
  if (ok) showToast("Disalin!");
  return ok;
}

export const shareHelpers = {
  isWebShareSupported,
  isClipboardSupported,
  shareStreakCard,
  shareReferralLink,
  copyToClipboard,
  copySummaryText,
};
