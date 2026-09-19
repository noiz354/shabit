# 02 — Canonical API Inventory (200 IDs preserved)

> Kind: `standalone` | `method` | `interface` | `spec` | `alias` | `subset`. Status: Stable / Baseline / Limited / Experimental / Deprecated / N/A (declarative). Compat shorthand: CA=Chrome Android, SI=Safari iOS, FA=Firefox Android, WV=WebView. Detail per-platform in matrix doc 03.

## Cat 1 — Camera/photo/video (1–10)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 1 | MediaDevices API | `navigator.mediaDevices` | interface | Stable; CA/SI/FA yes (HTTPS) |
| 2 | getUserMedia() | `mediaDevices.getUserMedia` | method | Stable; CA/SI yes, FA yes |
| 3 | enumerateDevices() | `mediaDevices.enumerateDevices` | method | Stable; labels need permission |
| 4 | MediaStream API | `MediaStream` | interface | Stable all |
| 5 | MediaStreamTrack API | `MediaStreamTrack` | interface | Stable all |
| 6 | ImageCapture API | `ImageCapture` | standalone | Limited; CA yes, SI no |
| 7 | MediaRecorder API | `MediaRecorder` | standalone | Stable CA/FA; SI 14.3+ partial |
| 8 | Canvas API | `HTMLCanvasElement` + 2D ctx | interface | Stable all |
| 9 | OffscreenCanvas API | `OffscreenCanvas` | standalone | Baseline; SI 16.4+ |
| 10 | Barcode Detection API | `BarcodeDetector` (Shape Detection fam.) | standalone | Limited; CA yes, SI/FA no |

## Cat 2 — Audio/speech (11–20)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 11 | Web Audio API | `AudioContext` graph | standalone | Stable all |
| 12 | AudioContext API | `AudioContext` | alias | Same as 11 (entry point) |
| 13 | AudioWorklet API | `AudioWorklet` | subset | Stable CA/FA; SI 14.1+ |
| 14 | AnalyserNode API | `AnalyserNode` | subset | Stable all |
| 15 | GainNode API | `GainNode` | subset | Stable all |
| 16 | BiquadFilterNode API | `BiquadFilterNode` | subset | Stable all |
| 17 | MediaElementAudioSourceNode | `MediaElementAudioSourceNode` | subset | Stable all |
| 18 | SpeechRecognition API | `SpeechRecognition` (+ webkit prefix) | standalone | Limited; CA yes, SI 14.1+ partial, FA no |
| 19 | SpeechSynthesis API | `speechSynthesis` | standalone | Stable (voices vary) |
| 20 | Media Session API | `navigator.mediaSession` | standalone | Stable CA; SI partial |

## Cat 3 — Location/sensors (21–30)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 21 | Geolocation API | `navigator.geolocation` | standalone | Stable all (HTTPS+perm) |
| 22 | getCurrentPosition() | `geolocation.getCurrentPosition` | method | Same as 21 |
| 23 | watchPosition() | `geolocation.watchPosition` | method | Same as 21 |
| 24 | DeviceOrientation API | `deviceorientation` events | standalone | Stable; iOS needs permission request |
| 25 | DeviceMotion API | `devicemotion` events | standalone | Stable; iOS needs permission request |
| 26 | Accelerometer API | Generic Sensor `Accelerometer` | standalone | Limited; CA yes, SI/FA no |
| 27 | Gyroscope API | Generic Sensor `Gyroscope` | standalone | Limited; CA yes, SI/FA no |
| 28 | Magnetometer API | Generic Sensor `Magnetometer` | standalone | Limited; CA yes, SI/FA no |
| 29 | AbsoluteOrientationSensor API | Generic Sensor absolute | subset | Limited; CA yes, SI/FA no |
| 30 | RelativeOrientationSensor API | Generic Sensor relative | subset | Limited; CA yes, SI/FA no |

## Cat 4 — Touch/input (31–40)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 31 | Touch Events API | `TouchEvent` | standalone | Stable all (mobile) |
| 32 | Pointer Events API | `PointerEvent` | standalone | Stable all |
| 33 | Pointer Capture API | `setPointerCapture` | method | Stable all |
| 34 | UI Events API | `UIEvent` family | spec | Stable (umbrella) |
| 35 | Keyboard API | `navigator.keyboard` | standalone | Limited; CA 68+ partial, SI/FA no |
| 36 | VirtualKeyboard API | `navigator.virtualKeyboard` | standalone | Limited; CA 94+, SI/FA no |
| 37 | Input Events API | `InputEvent` (+ `beforeinput`) | standalone | Stable all |
| 38 | Drag and Drop API | HTML DnD | standalone | Desktop-oriented; mobile touch poor |
| 39 | Gamepad API | `navigator.getGamepads` | standalone | Desktop/CA; mobile rare |
| 40 | Vibration API | `navigator.vibrate` | standalone | CA/FA yes; SI no, WV varies |

## Cat 5 — Storage (41–50)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 41 | Web Storage API | local/sessionStorage | standalone | Stable all |
| 42 | IndexedDB API | `indexedDB` | standalone | Stable all |
| 43 | Cache API | `caches` (SW-adjacent) | standalone | Stable all |
| 44 | StorageManager API | `navigator.storage` | standalone | Stable; `persist()` varies |
| 45 | Origin Private File System | OPFS | subset | Stable CA/FA; SI 15.2+ |
| 46 | File System Access API | showOpen/SaveFilePicker | standalone | Limited; CA yes, SI/FA no |
| 47 | File API | `File`/`Blob` inputs | standalone | Stable all |
| 48 | Blob API | `Blob` | subset | Stable all |
| 49 | FileReader API | `FileReader` | subset | Stable all |
| 50 | Storage Access API | `requestStorageAccess` | standalone | Embedded/third-party contexts |

## Cat 6 — Networking (51–60)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 51 | Fetch API | `fetch` | standalone | Stable all |
| 52 | XMLHttpRequest API | `XMLHttpRequest` | standalone | Stable (upload progress niche) |
| 53 | WebSocket API | `WebSocket` | standalone | Stable all (needs server) |
| 54 | WebTransport API | `WebTransport` (HTTP/3) | standalone | Limited; CA 97+, SI 26+ partial |
| 55 | Server-Sent Events API | `EventSource` | standalone | Stable; needs server |
| 56 | WebRTC API | `RTCPeerConnection` | standalone | Stable (needs peers/STUN) |
| 57 | RTCDataChannel API | `RTCDataChannel` | subset | Same as 56 |
| 58 | Broadcast Channel API | `BroadcastChannel` | standalone | Stable CA/FA/SI 15.4+ |
| 59 | MessageChannel API | `MessageChannel`/`MessagePort` | standalone | Stable all |
| 60 | Beacon API | `navigator.sendBeacon` | standalone | Stable all |

## Cat 7 — PWA/offline (61–70)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 61 | Service Worker API | `navigator.serviceWorker` | standalone | Stable all (HTTPS) |
| 62 | Background Sync API | `SyncManager` | standalone | CA yes; SI/FA no |
| 63 | Periodic Background Sync API | `PeriodicSyncManager` | standalone | CA only + installed PWA |
| 64 | Push API | `PushManager` | standalone | CA/FA yes; SI 16.4+ installed PWA |
| 65 | Notifications API | `Notification` | standalone | Stable; SI 16.4+ PWA |
| 66 | Web App Manifest | manifest JSON | spec | Stable (declarative) |
| 67 | Badging API | `navigator.setAppBadge` | standalone | CA/SI-installed; FA no |
| 68 | Background Fetch API | `BackgroundFetchManager` | standalone | CA only |
| 69 | Navigation Preload API | `navigationPreload` | subset | CA/FA; SI no |
| 70 | Service Worker Clients API | `Clients` | subset | Stable all |

## Cat 8 — Hardware (71–80)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 71 | Web Bluetooth API | `navigator.bluetooth` | standalone | CA yes; SI/FA/WV no |
| 72 | WebUSB API | `navigator.usb` | standalone | CA yes; SI/FA no |
| 73 | Web Serial API | `navigator.serial` | standalone | CA yes; SI/FA no |
| 74 | WebHID API | `navigator.hid` | standalone | CA yes; SI/FA no |
| 75 | Web NFC API | `NDEFReader` | standalone | CA only (Android HW) |
| 76 | Battery Status API | `navigator.getBattery` | standalone | CA only (removed elsewhere) |
| 77 | Ambient Light Sensor API | Generic Sensor ALS | standalone | CA only |
| 78 | Proximity Sensor API | Generic Sensor proximity | standalone | Experimental, near-zero support |
| 79 | Screen Wake Lock API | `navigator.wakeLock` | standalone | CA/FA; SI 16.4+ |
| 80 | WebXR Device API | `navigator.xr` | standalone | CA (ARCore); SI/WV no |

## Cat 9 — OS integration (81–90)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 81 | Web Share API | `navigator.share` (+ `canShare`) | standalone | CA/SI yes; FA partial |
| 82 | Web Share Target API | manifest `share_target` | spec | CA yes; SI/FA no |
| 83 | Contact Picker API | `navigator.contacts` | standalone | CA only |
| 84 | Clipboard API | `navigator.clipboard` (read) | standalone | Stable; read needs perm/focus |
| 85 | Async Clipboard API | `clipboard.read/write` async | alias | Same as 84 (async shape) |
| 86 | Screen Orientation API | `screen.orientation` | standalone | CA/FA; SI partial (lock iOS no) |
| 87 | Fullscreen API | `requestFullscreen` | standalone | CA/FA; SI iPhone partial |
| 88 | Picture-in-Picture API | `requestPictureInPicture` | standalone | Video only; CA/SI partial |
| 89 | Window Controls Overlay API | `navigator.windowControlsOverlay` | standalone | Desktop only |
| 90 | Launch Handler API | manifest `launch_handler` | spec | CA yes; SI/FA no |

## Cat 10 — Graphics (91–100)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 91 | WebGL API | `webgl` context | standalone | Stable all |
| 92 | WebGL2 API | `webgl2` context | standalone | Stable CA/FA/SI 15+ |
| 93 | WebGPU API | `navigator.gpu` | standalone | CA 121+; SI 26+ partial; FA no |
| 94 | CanvasRenderingContext2D | `getContext('2d')` | subset | Stable all |
| 95 | Web Animations API | `Element.animate` | standalone | Stable all |
| 96 | requestAnimationFrame() | `requestAnimationFrame` | method | Stable all |
| 97 | Screen API | `screen` (+ detailed) | interface | Basic stable; detailed limited |
| 98 | CSSOM API | `CSSStyleSheet`/`CSS.*` | interface | Stable (parts vary) |
| 99 | ResizeObserver API | `ResizeObserver` | standalone | Stable all |
| 100 | IntersectionObserver API | `IntersectionObserver` | standalone | Stable all |

## Cat 11 — Media processing (101–110)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 101 | WebCodecs API | `VideoEncoder/Decoder` fam. | standalone | CA yes; SI 16+ partial |
| 102 | VideoEncoder API | `VideoEncoder` | subset | Same as 101 |
| 103 | VideoDecoder API | `VideoDecoder` | subset | Same as 101 |
| 104 | AudioEncoder API | `AudioEncoder` | subset | Same as 101 |
| 105 | AudioDecoder API | `AudioDecoder` | subset | Same as 101 |
| 106 | VideoFrame API | `VideoFrame` | subset | Same as 101 |
| 107 | Media Source Extensions API | `MediaSource` | standalone | Stable CA/FA; SI partial |
| 108 | Encrypted Media Extensions API | `requestMediaKeySystemAccess` | standalone | DRM; needs license server |
| 109 | HTMLMediaElement API | `<audio>/<video>` | interface | Stable all |
| 110 | Media Capabilities API | `navigator.mediaCapabilities` | standalone | CA/FA; SI partial |

## Cat 12 — Security/auth (111–120)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 111 | Web Authentication API | `PublicKeyCredential` | standalone | CA/SI/FA (platform auth) |
| 112 | Credential Management API | `navigator.credentials` | standalone | CA; SI/FA partial |
| 113 | Web Crypto API | `crypto.subtle` + helpers | standalone | Stable all (secure ctx) |
| 114 | SubtleCrypto API | `SubtleCrypto` | subset | Same as 113 |
| 115 | Crypto.getRandomValues() | `getRandomValues` | method | Stable all |
| 116 | Permissions API | `navigator.permissions.query` | standalone | CA/FA; SI partial (few descriptors) |
| 117 | Permissions Policy API | `Permissions-Policy` / iframe allow | spec | Stable (enforcement varies) |
| 118 | Secure Contexts API | `window.isSecureContext` | spec | Stable all |
| 119 | Content Security Policy | CSP headers/meta | spec | Stable all |
| 120 | Reporting API | `Reporting-Observer`/endpoints | standalone | CA; SI/FA partial |

## Cat 13 — Payment/commerce (121–130)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 121 | Payment Request API | `PaymentRequest` | standalone | CA; SI partial; needs PSP/backend |
| 122 | Payment Handler API | `PaymentManager` (SW) | standalone | CA only; needs payment app |
| 123 | Payment Method Manifest | pm manifest JSON | spec | Declarative; tied to 122 |
| 124 | Payment Request Button API | experimental button | spec | Experimental, near-zero |
| 125 | WebOTP API | `navigator.credentials.get(otp)` | standalone | CA only |
| 126 | Federated Credential (legacy) | `FederatedCredential` | spec | Deprecated → FedCM |
| 127 | FedCM API | `navigator.credentials.get(fedcm)` | standalone | CA; SI 26+ partial; FA no |
| 128 | Digital Credentials API | `navigator.credentials.get(dc)` | standalone | Experimental; CA/SI-wallet Coop |
| 129 | Web Locks API | `navigator.locks` | standalone | Stable CA/FA/SI 15.4+ |
| 130 | Background Fetch API (cat13 dup) | same as 68 | alias | Same as 68 |

## Cat 14 — Background/threading (131–140)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 131 | Web Workers API | `Worker` | standalone | Stable all |
| 132 | DedicatedWorker API | dedicated `Worker` | subset | Same as 131 |
| 133 | SharedWorker API | `SharedWorker` | standalone | CA/FA; SI no |
| 134 | Worklet API | `Worklet` (generic) | spec | Audio/paint impls; generic limited |
| 135 | SharedArrayBuffer API | `SharedArrayBuffer` | standalone | Needs COOP/COEP |
| 136 | Atomics API | `Atomics` | subset | Tied to 135 |
| 137 | Structured Clone Algorithm | postMessage cloning | spec | Stable all |
| 138 | scheduler.postTask() | `scheduler.postTask` | method | CA; SI/FA partial |
| 139 | requestIdleCallback() | `requestIdleCallback` | method | CA/FA; SI no (needs fallback) |
| 140 | PerformanceObserver API | `PerformanceObserver` | standalone | Stable (entry support varies) |

## Cat 15 — ML/AI (141–150)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 141 | WebNN API | `navigator.ml` | standalone | Experimental; CA 123+ partial |
| 142 | WebGPU Compute API | GPU compute shaders | subset | Same constraints as 93 |
| 143 | WebAssembly API | `WebAssembly` | standalone | Stable all |
| 144 | WebAssembly SIMD | SIMD proposal | subset | CA/FA; SI 16.4+ |
| 145 | WebAssembly Threads | threads proposal | subset | Needs COOP/COEP; SI no |
| 146 | Compute Pressure API | `ComputePressureObserver` | standalone | Experimental; CA only |
| 147 | Shape Detection API | `ShapeDetector` family | spec | CA only |
| 148 | Face Detection API | `FaceDetector` | subset | CA (deprecated path); SI/FA no |
| 149 | Text Detection API | `TextDetector` | subset | CA only |
| 150 | BarcodeDetector API | `BarcodeDetector` | alias | Same as 10 |

## Cat 16 — DOM/navigation/UI (151–160)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 151 | DOM API | `document` | interface | Stable all |
| 152 | History API | `history.pushState` | standalone | Stable all |
| 153 | Navigation API | `navigation` | standalone | CA 102+; SI 26.4+; FA no |
| 154 | URL API | `URL` | standalone | Stable all |
| 155 | URLSearchParams API | `URLSearchParams` | standalone | Stable all |
| 156 | MutationObserver API | `MutationObserver` | standalone | Stable all |
| 157 | Selection API | `getSelection` | standalone | Stable all |
| 158 | Range API | `Range` | standalone | Stable all |
| 159 | Visual Viewport API | `window.visualViewport` | standalone | Stable CA/SI; FA partial |
| 160 | View Transitions API | `document.startViewTransition` | standalone | CA 111+; SI 18+; FA no |

## Cat 17 — Performance (161–170)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 161 | Performance API | `performance.now` | standalone | Stable all |
| 162 | Navigation Timing API | `PerformanceNavigationTiming` | subset | Stable all |
| 163 | Resource Timing API | `PerformanceResourceTiming` | subset | Stable all |
| 164 | User Timing API | `performance.mark/measure` | subset | Stable all |
| 165 | Long Tasks API | `longtask` entries | subset | CA/FA; SI no |
| 166 | Event Timing API | `event`/`first-input` entries | subset | CA; SI/FA partial |
| 167 | Largest Contentful Paint API | `largest-contentful-paint` | subset | CA/FA; SI 18.2+ as image-only |
| 168 | Layout Instability API | `layout-shift` entries | subset | CA/FA; SI partial |
| 169 | Performance Memory API | `performance.memory` | subset | CA only |
| 170 | Network Information API | `navigator.connection` | standalone | CA only (see also 176) |

## Cat 18 — Connectivity/device (171–180)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 171 | Navigator API | `navigator` | interface | Stable all |
| 172 | Online and Offline Events | `online`/`offline` events | subset | Stable all (signal only) |
| 173 | navigator.hardwareConcurrency | `hardwareConcurrency` | method | Stable all (capped) |
| 174 | navigator.deviceMemory | `deviceMemory` | method | CA only |
| 175 | User-Agent Client Hints API | `navigator.userAgentData` | standalone | CA; SI/FA no; needs opt-in |
| 176 | Network Information API (dup) | same as 170 | alias | Same as 170 |
| 177 | Device Posture API | `navigator.devicePosture` | standalone | CA foldables; SI/FA no |
| 178 | Window Segments Enumeration API | `window.getWindowSegments` | standalone | CA foldables; SI/FA no |
| 179 | Page Visibility API | `document.visibilityState` | standalone | Stable all |
| 180 | Idle Detection API | `IdleDetector` | standalone | CA (perm); SI/FA no |

## Cat 19 — Docs/printing/text (181–190)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 181 | CSS Typed OM API | `CSS.*`/`attributeStyleMap` | standalone | CA/FA; SI partial |
| 182 | CSS Font Loading API | `document.fonts` | standalone | Stable all |
| 183 | FontFace API | `FontFace` | subset | Stable all |
| 184 | FontFaceSet API | `FontFaceSet` | subset | Stable all |
| 185 | DOMParser API | `DOMParser` | standalone | Stable all |
| 186 | XMLSerializer API | `XMLSerializer` | subset | Stable all |
| 187 | Encoding API | `TextEncoder/Decoder` | standalone | Stable all |
| 188 | TextEncoder API | `TextEncoder` | method | Same as 187 |
| 189 | TextDecoder API | `TextDecoder` | method | Same as 187 |
| 190 | window.print() | `print()` | method | Stable; output varies by OS |

## Cat 20 — Misc mobile web (191–200)
| ID | Original | Canonical | Kind | Status |
|---|---|---|---|---|
| 191 | WebSocketStream API | `WebSocketStream` | standalone | Experimental; CA only |
| 192 | Streams API | `ReadableStream` family | standalone | Stable all |
| 193 | Compression Streams API | `CompressionStream` | standalone | Stable CA/FA/SI 16.4+ |
| 194 | Web Locks API (dup) | same as 129 | alias | Same as 129 |
| 195 | File Handling API | manifest `file_handlers` | spec | CA (PWA); SI/FA no |
| 196 | Protocol Handlers API | `registerProtocolHandler` | standalone | CA/FA; SI no; allowlist limits |
| 197 | URL Pattern API | `URLPattern` | standalone | CA/FA; SI no |
| 198 | Web Speech API (dup) | speech family | alias | Same as 18/19 |
| 199 | Web Animations API (dup) | same as 95 | alias | Same as 95 |
| 200 | Screen Capture API | `getDisplayMedia` | standalone | Desktop-oriented; Android partial, iOS no |
