/* HabitWealth — SW add-on (di-importScripts oleh workbox generateSW, lihat vite.config.js)
 * T12: klik notifikasi OS lokal → fokus/buka klien + deep-link + kabari app (tandai dibaca, event notification_opened).
 * Tanpa PII: data hanya {id, template, category, deepLink}. */
self.addEventListener("notificationclick", (event) => {
  var data = (event.notification && event.notification.data) || {};
  var deepLink = data.deepLink || "#/beranda";
  var withNid = data.id ? deepLink + (deepLink.indexOf("?") >= 0 ? "&" : "?") + "nid=" + encodeURIComponent(data.id) : deepLink;
  event.notification.close();
  event.waitUntil((async function () {
    var all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if ("focus" in c) {
        try { await c.focus(); } catch (e) {}
        c.postMessage({ type: "hw:notification-click", id: data.id, deepLink: deepLink });
        return;
      }
    }
    if (self.clients.openWindow) {
      var base = self.registration && self.registration.scope ? self.registration.scope : "./";
      await self.clients.openWindow(base + withNid);
    }
  })());
});
