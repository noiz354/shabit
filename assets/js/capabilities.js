/* HabitWealth capability detection — §12 audit artifact.
 * Reports interface EXISTENCE only, never functional guarantees
 * (permission, hardware, secure context, OS limits still apply).
 * No dependencies. Safe to load first; exposes window.HWCapabilities.
 * Usage: const c = await HWCapabilities.detect(); gate features on c.flags.
 */
(function () {
  "use strict";

  function bool(v) { return !!v; }

  function canvas2d() {
    try { return !!document.createElement("canvas").getContext("2d"); } catch (e) { return false; }
  }
  function webgl2() {
    try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
  }

  // Live permission probes that are safe (query-only, no prompts).
  async function probePermissions() {
    var out = {};
    try {
      if (!navigator.permissions || !navigator.permissions.query) return { supported: false };
      out.supported = true;
      var names = ["notifications", "camera", "microphone", "geolocation"];
      for (var i = 0; i < names.length; i++) {
        try {
          var s = await navigator.permissions.query({ name: names[i] });
          out[names[i]] = s.state; // "granted" | "denied" | "prompt"
        } catch (e) { out[names[i]] = "unsupported"; }
      }
    } catch (e) { out = { supported: false, error: String(e) }; }
    return out;
  }

  async function detect() {
    var nav = navigator || {};
    var flags = {
      // audit IDs 1-10
      mediaDevices: bool(nav.mediaDevices && nav.mediaDevices.getUserMedia),
      enumerateDevices: bool(nav.mediaDevices && nav.mediaDevices.enumerateDevices),
      mediaRecorder: "MediaRecorder" in window,
      canvas2d: canvas2d(),
      offscreenCanvas: "OffscreenCanvas" in window,
      barcodeDetector: "BarcodeDetector" in window,
      webgl2: webgl2(),
      // 11-20
      webAudio: "AudioContext" in window || "webkitAudioContext" in window,
      speechRecognition: "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
      speechSynthesis: "speechSynthesis" in window,
      mediaSession: "mediaSession" in nav,
      // 21-40
      geolocation: "geolocation" in nav,
      deviceOrientation: "DeviceOrientationEvent" in window,
      vibration: "vibrate" in nav,
      pointerEvents: "PointerEvent" in window,
      virtualKeyboard: "virtualKeyboard" in nav,
      // 41-50
      localStorage: (function () { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; } catch (e) { return false; } })(),
      indexedDB: "indexedDB" in window,
      cacheAPI: "caches" in window,
      storageManager: "storage" in nav,
      fileSystemAccess: "showOpenFilePicker" in window,
      // 51-70
      fetch: "fetch" in window,
      webSocket: "WebSocket" in window,
      broadcastChannel: "BroadcastChannel" in window,
      beacon: "sendBeacon" in nav,
      serviceWorker: "serviceWorker" in nav,
      syncManager: "SyncManager" in window,
      pushManager: "PushManager" in window,
      notifications: "Notification" in window,
      wakeLock: "wakeLock" in nav,
      // 71-90
      webBluetooth: "bluetooth" in nav,
      webNFC: "NDEFReader" in window,
      webShare: "share" in nav,
      canShareFiles: bool(nav.canShare && (function () { try { return nav.canShare({ files: [] }); } catch (e) { return false; } })()),
      clipboard: "clipboard" in nav,
      fullscreen: "requestFullscreen" in document.documentElement,
      // 91-110
      webGPU: "gpu" in nav,
      webAnimations: "animate" in Element.prototype,
      resizeObserver: "ResizeObserver" in window,
      intersectionObserver: "IntersectionObserver" in window,
      webAuthn: "PublicKeyCredential" in window,
      webCrypto: bool(window.crypto && window.crypto.subtle),
      // 111-140
      cspReporting: "ReportingObserver" in window,
      webLocks: "locks" in nav,
      worker: "Worker" in window,
      sharedWorker: "SharedWorker" in window,
      schedulerPostTask: bool(window.scheduler && window.scheduler.postTask),
      idleCallback: "requestIdleCallback" in window,
      // 141-160
      webAssembly: "WebAssembly" in window,
      history: "pushState" in history,
      visualViewport: "visualViewport" in window,
      viewTransitions: "startViewTransition" in document,
      // 161-180
      userTiming: bool(window.performance && performance.mark),
      lcpObserved: false, // filled only after observer fires; see note
      networkInfo: "connection" in nav,
      hardwareConcurrency: nav.hardwareConcurrency || 0,
      deviceMemory: nav.deviceMemory || 0,
      pageVisibility: "visibilityState" in document,
      // 181-200
      fontLoading: bool(document.fonts && document.fonts.ready),
      textEncoder: "TextEncoder" in window,
      compressionStreams: "CompressionStream" in window,
      urlPattern: "URLPattern" in window,
      // context
      secureContext: window.isSecureContext === true,
      standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
    };
    var permissions = await probePermissions();
    return { flags: flags, permissions: permissions, ua: nav.userAgent || "", at: new Date().toISOString() };
  }

  window.HWCapabilities = { detect: detect };
})();
