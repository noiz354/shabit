/**
 * HabitWealth notifications — AUD-NOTIF-01
 * APIs 65,67: Notifications API + Badging API
 * - Local reminders/budget alerts/celebrations per specs/11 matrix
 * - Permission asked contextually (post-first-habit)
 * - Quiet Hours 22:00-07:00 tz-user, category mute
 */

import { queryPermission, requestNotificationPermission, recordPrimerDecision } from "./permissions.js";
import { track } from "./analytics.js";

// T12: mesin dipindah ke ./notify.js (Kotak Masuk IDB, Quiet Hours tz-user, dedup, prioritas). Berkas ini = lapisan kompatibilitas.
const engine = () => import("./notify.js"); // lazy: mesin di chunk terpisah

export const NOTIF_TEMPLATES = { habit_reminder: "habit_morning", budget_80: "budget_80", budget_100: "budget_100", streak_7: "streak_7", streak_30: "streak_30", system: "system" };

export async function canSendNotification(category = "system") {
  const perm = await queryPermission("notifications");
  if (perm.state !== "granted") return { allowed: false, reason: "permission-not-granted", state: perm.state };
  return { allowed: true };
}

/** Kompat: kirim via mesin baru (event notification_opened TIDAK lagi dipicu saat tampil — hanya saat user tap). */
export async function sendLocalNotification(templateKey, vars = {}) {
  const { notify, TEMPLATES } = await engine();
  const key = TEMPLATES[templateKey] ? templateKey : NOTIF_TEMPLATES[templateKey] || "system";
  const r = await notify(key, TEMPLATES[key] && key !== "system" ? vars : { message: vars.message || templateKey });
  return { sent: !!r.created, via: r.os ? "sw" : "inbox", reason: r.reason };
}

export async function setAppBadge(count) {
  try {
    if ("setAppBadge" in navigator) {
      if (count > 0) await navigator.setAppBadge(count);
      else await navigator.clearAppBadge();
      return true;
    }
  } catch {}
  return false;
}

export async function clearAppBadge() {
  try {
    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
      return true;
    }
  } catch {}
  return false;
}

export const getInbox = () => engine().then((m) => m.listInbox());
export const markInboxRead = (id) => engine().then((m) => m.markRead(id, { open: false }));
export const archiveInbox = (id) => engine().then((m) => m.archive(id));
export const clearInbox = () => engine().then((m) => m.refreshBadge());

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
  markInboxRead,
  archiveInbox,
  clearInbox,
  requestNotificationPermissionContextual,
  NOTIF_TEMPLATES,
};
