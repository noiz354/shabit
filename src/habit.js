/**
 * HabitWealth habit — T6 + AUD-STORE-01 + AUD-HAPT-01
 * CRUD + undo + template + IndexedDB queue
 * Acceptance: CRUD+undo+template
 */

import { idbGetAll, idbPut, idbDel, idbGet } from "./storage/db.js";
import { feedbackHabitComplete } from "./feedback.js";
import { track } from "./analytics.js";
import { enqueue } from "./storage/outbox.js";

const STORE = "habits";
const ENTRIES_STORE = "habit_entries";

const TEMPLATES = [
  { title: "Minum 8 gelas air", goal_type: "count", schedule: { days: [1,2,3,4,5,6,0], time: "08:00" }, category: "kesehatan" },
  { title: "Jalan 10.000 langkah", goal_type: "count", schedule: { days: [1,2,3,4,5], time: "07:00" }, category: "gerak" },
  { title: "Baca 20 halaman", goal_type: "duration", schedule: { days: [1,2,3,4,5,6,0], time: "20:00" }, category: "belajar" },
];

export function getTemplates() {
  return TEMPLATES;
}

export async function listHabits() {
  try {
    const all = await idbGetAll(STORE, null, undefined, 1000);
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

export async function getHabit(id) {
  try {
    return await idbGet(STORE, id);
  } catch {
    return null;
  }
}

export async function createHabit(data) {
  const id = data.id || `habit_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const habit = {
    id,
    title: data.title?.slice(0, 100) || "Habit baru",
    goal_type: data.goal_type || "check",
    schedule: data.schedule || { days: [1,2,3,4,5], time: "08:00" },
    category: data.category || "umum",
    streak: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await idbPut(STORE, habit);

  // Queue to outbox for sync
  try {
    await enqueue("POST", "/habits", habit);
  } catch {}

  track("habit_completed", { habit_type: habit.goal_type }).catch(() => {});

  return habit;
}

export async function updateHabit(id, patch) {
  const existing = await getHabit(id);
  if (!existing) throw new Error("Habit tidak ditemukan");
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await idbPut(STORE, updated);
  try {
    await enqueue("PATCH", `/habits/${id}`, patch);
  } catch {}
  return updated;
}

export async function deleteHabit(id) {
  await idbDel(STORE, id);
  try {
    await enqueue("DELETE", `/habits/${id}`, null);
  } catch {}
  return true;
}

// Entries
export async function listEntries(habitId, range = {}) {
  try {
    const all = await idbGetAll(ENTRIES_STORE, "by_habit", habitId, 1000);
    // Filter by range if provided
    if (range.from || range.to) {
      return all.filter((e) => {
        if (range.from && e.date < range.from) return false;
        if (range.to && e.date > range.to) return false;
        return true;
      });
    }
    return all.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function completeHabit(habitId, dateStr) {
  // dateStr YYYY-MM-DD
  const id = `${habitId}_${dateStr}`;
  const entry = {
    id,
    habit_id: habitId,
    date: dateStr,
    status: "done",
    source: "manual",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await idbPut(ENTRIES_STORE, entry);

  // Update streak (simplified)
  const habit = await getHabit(habitId);
  if (habit) {
    habit.streak = (habit.streak || 0) + 1;
    habit.updatedAt = Date.now();
    await idbPut(STORE, habit);
    // T12: milestone 7/30 → Kotak Masuk (dedup per habit; tanpa judul habit di copy)
    try {
      const { checkStreakMilestone } = await import("./notify.js");
      await checkStreakMilestone(habitId, habit.streak);
    } catch {}
  }

  try {
    await enqueue("POST", "/habit-entries", entry);
  } catch {}

  // Feedback
  feedbackHabitComplete();
  track("habit_completed", { habit_id_hash: habitId, time_of_day: new Date().getHours() < 12 ? "morning" : "afternoon" }).catch(() => {});

  // Mark first habit done for PWA install prompt
  try {
    localStorage.setItem("hw:first-habit:done", "1");
    const { markFirstHabitDone } = await import("./pwa.js");
    markFirstHabitDone();
  } catch {}

  return entry;
}

export async function undoComplete(habitId, dateStr) {
  const id = `${habitId}_${dateStr}`;
  await idbDel(ENTRIES_STORE, id);

  const habit = await getHabit(habitId);
  if (habit) {
    habit.streak = Math.max(0, (habit.streak || 1) - 1);
    habit.updatedAt = Date.now();
    await idbPut(STORE, habit);
  }

  try {
    await enqueue("DELETE", `/habit-entries/${id}`, null);
  } catch {}

  return true;
}

export const habitHelpers = {
  getTemplates,
  listHabits,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  listEntries,
  completeHabit,
  undoComplete,
};
