/**
 * HabitWealth store — AUD-STORE-01 + AUD-SYNC-01 + AUD-ANAL-01
 * Single source range {preset, from, to, tz} (specs/17) + outbox + prefs
 * Now backed by versioned IDB + LS wrapper
 */

import { initStorage, subscribeRange } from "./storage/index.js";
import { getRange, setRange, getPrefs, setPrefs } from "./storage/prefs.js";
import { listOutbox, setupAutoDrain, drainOutbox } from "./storage/outbox.js";
import { api } from "./api.js";

export const store = {
  // range is getter for live value
  get range() {
    return getRange();
  },
  set range(val) {
    setRange(val);
  },

  // outbox live list
  async getOutbox() {
    return listOutbox();
  },

  async drain() {
    return drainOutbox(api);
  },

  prefs: {
    get: getPrefs,
    set: setPrefs,
  },

  async init() {
    await initStorage();
    // setup auto-drain for outbox
    setupAutoDrain(api);

    // sync range changes to URL is handled in router.js
    // but we also want to keep store.range in sync with prefs
    subscribeRange((newRange) => {
      // dispatch event for views that listen
      window.dispatchEvent(new CustomEvent("hw:store:range", { detail: newRange }));
    });

    return true;
  },

  // helper for views to subscribe to range
  subscribeRange(callback) {
    const handler = (ev) => callback(ev.detail);
    window.addEventListener("hw:store:range", handler);
    window.addEventListener("hw:range-changed", handler);
    return () => {
      window.removeEventListener("hw:store:range", handler);
      window.removeEventListener("hw:range-changed", handler);
    };
  },
};
