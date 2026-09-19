// Scaffold-only: store stub. IndexedDB/outbox/search-index = sesi T6+ (AUD-STORE-01).
// Kontrak: single source range {preset, from, to, tz} (specs/17) + outbox antrian.
export const store = {
  range: { preset: "month", from: null, to: null, tz: "Asia/Jakarta" },
  outbox: [],
  async init() {
    // TODO(T6): buka IndexedDB + migrasi + drain outbox + BroadcastChannel sync.
    return true;
  }
};
