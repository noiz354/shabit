/**
 * HabitWealth notifications — AUD-NOTIF-01
 * APIs 65,67: Notifications API + Badging API
 * - Local reminders/budget alerts/celebrations per specs/11 matrix
 * - Permission asked contextually (post-first-habit)
 * - Quiet Hours 22:00-07:00 tz-user, category mute
 */

import { getPrefs } from "./storage/prefs.js";
import { queryPermission, requestNotificationPermission, recordPrimerDecision } from "./permissions.js";
import { track } from "./analytics.js";

const NOTIF_TEMPLATES = {
  habit_reminder: { title: "Waktunya habit", body: "Jangan lupa {habit_title} hari ini", category: "habit", deepLink: "#/habit" },
  budget_80: { title: "Budget hampir habis", body: "Kategori {category} sudah 80% bulan ini", category: "budget", deepLink: "#/uang" },
  budget_100: { title: "Budget tercapai", body: "Kategori {category} mencapai 100% — cek pengeluaran", category: "budget", deepLink: "#/uang" },
  streak_7: { title: "Streak 7 hari! 🎉", body: "Konsisten 7 hari — lanjutkan!", category: "habit", deepLink: "#/habit" },
  streak_30: { title: "Luar biasa — 30 hari!", body: "30 hari konsisten, kamu hebat!", category: "habit", deepLink: "#/beranda" },
  system: { title: "HabitWealth", body: "{message}", category: "system", deepLink: "#/beranda" },
};

function isQuietHours(now = new Date(), quietHours = { start: "22:00", end: "07:00" }) {
  try {
    const [sh, sm] = quietHours.start.split(":").map(Number);
    const [eh, em] = quietHours.end.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const cur = now.getHours() * 60 + now.getMinutes();
    if (start <= end) {
      return cur >= start && cur < end;
    } else {
      // overnight e.g. 22:00-07:00
      return cur >= start || cur < end;
    }
  } catch {
    return false;
  }
}

async function isCategoryMuted(category) {
  try {
    const prefs = await getPrefs();
    const cats = prefs.notifications?.categories || {};
    if (cats[category] === false) return true;
    return false;
  } catch {
    return false;
  }
}

export async function canSendNotification(category = "system") {
  // Check permission
  const perm = await queryPermission("notifications");
  if (perm.state !== "granted") return { allowed: false, reason: "permission-not-granted", state: perm.state };

  // Check quiet hours
  try {
    const prefs = await getPrefs();
    const qh = prefs.notifications?.quietHours;
    if (qh && isQuietHours(new Date(), qh)) {
      return { allowed: false, reason: "quiet-hours" };
    }
    if (await isCategoryMuted(category)) {
      return { allowed: false, reason: "category-muted" };
    }
  } catch {}

  return { allowed: true };
}

export async function sendLocalNotification(templateKey, vars = {}) {
  const template = NOTIF_TEMPLATES[templateKey] || NOTIF_TEMPLATES.system;
  const check = await canSendNotification(template.category);
  if (!check.allowed) {
    // console.debug("[notif] blocked", check.reason);
    return { sent: false, reason: check.reason };
  }

  try {
    if (!("Notification" in window)) return { sent: false, reason: "unsupported" };

    let title = template.title;
    let body = template.body;
    // Replace vars
    for (const [k, v] of Object.entries(vars)) {
      title = title.replace(`{${k}}`, v);
      body = body.replace(`{${k}}`, v);
    }

    // Use SW registration if available for better behavior (showNotification)
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: "icons/icon-192.png",
          badge: "icons/icon-192.png",
          data: { deepLink: template.deepLink, category: template.category },
          tag: `${template.category}-${Date.now()}`,
        });
        track("notification_opened", { category: template.category, deep_link: template.deepLink }).catch(() => {});
        return { sent: true, via: "sw" };
      }
    }

    // Fallback: new Notification
    const notif = new Notification(title, {
      body,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { deepLink: template.deepLink },
    });

    notif.onclick = () => {
      window.focus();
      if (template.deepLink) location.hash = template.deepLink;
      notif.close();
      track("notification_opened", { category: template.category, deep_link: template.deepLink }).catch(() => {});
    };

    return { sent: true, via: "new Notification" };
  } catch (e) {
    console.warn("[notif] send failed", e);
    return { sent: false, error: String(e) };
  }
}

// Badging API (67)
export async function setAppBadge(count) {
  try {
    if ("setAppBadge" in navigator) {
      if (count > 0) await navigator.setAppBadge(count);
      else await navigator.clearAppBadge();
      return true;
    }
  } catch (e) {
    console.warn("[badge] set failed", e);
  }
  return false;
}

export async function clearAppBadge() {
  try {
    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
      return true;
    }
    if ("setAppBadge" in navigator) {
      await navigator.setAppBadge(0);
      return true;
    }
  } catch {}
  return false;
}

// Inbox (local, for NotificationInbox screen spec 02)
const INBOX_KEY = "hw:notif:inbox:v1";

export function getInbox() {
  try {
    const raw = localStorage.getItem(INBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToInbox(item) {
  try {
    const inbox = getInbox();
    inbox.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...item, read: false, at: new Date().toISOString() });
    // Keep max 50
    if (inbox.length > 50) inbox.length = 50;
    localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
    // Update badge
    const unread = inbox.filter((i) => !i.read).length;
    setAppBadge(unread);
    return inbox;
  } catch {
    return [];
  }
}

export function markInboxRead(id) {
  try {
    const inbox = getInbox();
    const idx = inbox.findIndex((i) => i.id === id);
    if (idx >= 0) {
      inbox[idx].read = true;
      localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
      const unread = inbox.filter((i) => !i.read).length;
      setAppBadge(unread);
    }
    return inbox;
  } catch {
    return [];
  }
}

export function clearInbox() {
  try {
    localStorage.setItem(INBOX_KEY, JSON.stringify([]));
    clearAppBadge();
  } catch {}
}

// Request permission contextually (post-first-habit)
export async function requestNotificationPermissionContextual() {
  // Should be called after primer UI granted
  const res = await requestNotificationPermission();
  if (res.state === "granted") {
    await recordPrimerDecision("notifications", "granted");
    track("permission_granted", { scope: "notifications" }).catch(() => {});
  } else if (res.state === "denied") {
    await recordPrimerDecision("notifications", "denied");
    track("permission_denied", { scope: "notifications" }).catch(() => {});
  }
  return res;
}

export const notifications = {
  sendLocalNotification,
  canSendNotification,
  setAppBadge,
  clearAppBadge,
  getInbox,
  addToInbox,
  markInboxRead,
  clearInbox,
  requestNotificationPermissionContextual,
  NOTIF_TEMPLATES,
};
