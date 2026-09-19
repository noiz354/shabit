# 200 Web API untuk Aplikasi Mobile

Web API adalah antarmuka browser yang memungkinkan aplikasi web mengakses kamera, lokasi, audio, penyimpanan, jaringan, rendering, dan sebagian kemampuan perangkat. **Tidak semua API tersedia pada seluruh browser mobile.** Dukungan dapat berbeda antara Chrome Android, Safari iOS, Firefox Android, PWA terinstal, dan WebView. Sejumlah API membutuhkan HTTPS, izin pengguna, atau interaksi langsung.

> Catatan: daftar berikut memuat 200 entri berupa API, sub-API, interface, metode, dan spesifikasi platform. Beberapa kemampuan dicantumkan ulang di kategori berbeda. Jadi, ini bukan 200 API unik yang semuanya tersedia di Android dan iOS.

## 1. Kamera, foto, dan video (1–10)

1. **MediaDevices API** — Mengakses perangkat kamera dan mikrofon yang tersedia.
2. **getUserMedia()** — Mengambil video langsung dari kamera untuk scanner atau video call.
3. **enumerateDevices()** — Menampilkan daftar kamera, mikrofon, dan perangkat audio yang tersedia.
4. **MediaStream API** — Mengelola aliran video dan audio secara real-time.
5. **MediaStreamTrack API** — Mengontrol satu track video atau audio, termasuk menghentikannya.
6. **ImageCapture API** — Mengambil foto dari kamera serta mengakses kontrol kamera tertentu.
7. **MediaRecorder API** — Merekam video atau audio menjadi file, misalnya WebM.
8. **Canvas API** — Mengambil frame kamera, mengedit foto, dan membuat gambar.
9. **OffscreenCanvas API** — Memproses gambar di luar main thread untuk mengurangi gangguan pada UI.
10. **Barcode Detection API** — Mendeteksi barcode dan QR code menggunakan kemampuan browser yang mendukungnya.

**Contoh:** POS yang memindai barcode menggunakan kamera, mengunggah bukti pembayaran, mengompresi gambar sebelum upload, dan melakukan video call.

## 2. Audio, suara, dan speech recognition (11–20)

11. **Web Audio API** — Memproses, menghasilkan, dan menggabungkan audio.
12. **AudioContext API** — Mengelola graph pemrosesan audio dan waktu pemutarannya.
13. **AudioWorklet API** — Menjalankan pemrosesan audio khusus di thread audio.
14. **AnalyserNode API** — Menganalisis frekuensi, volume, dan waveform audio.
15. **GainNode API** — Mengatur volume sinyal audio secara terprogram.
16. **BiquadFilterNode API** — Menerapkan filter audio seperti low-pass dan high-pass.
17. **MediaElementAudioSourceNode** — Menghubungkan audio dari elemen HTML ke Web Audio.
18. **SpeechRecognition API** — Mengubah ucapan pengguna menjadi teks pada browser yang mendukungnya.
19. **SpeechSynthesis API** — Membacakan teks menggunakan suara sintetis perangkat.
20. **Media Session API** — Mengintegrasikan pemutar audio dengan kontrol media sistem operasi.

**Contoh:** voice assistant, pembelajaran bahasa, navigasi suara untuk tunanetra, dan visualisasi gelombang suara. Dukungan speech recognition bawaan browser tidak merata; sediakan alternatif model lokal atau backend bila perlu.

## 3. Lokasi, GPS, dan orientasi perangkat (21–30)

21. **Geolocation API** — Mengakses lokasi geografis perangkat dengan izin pengguna.
22. **getCurrentPosition()** — Mengambil posisi geografis pengguna satu kali.
23. **watchPosition()** — Mendapatkan pembaruan lokasi ketika posisi pengguna berubah.
24. **DeviceOrientation API** — Membaca perubahan orientasi perangkat.
25. **DeviceMotion API** — Mendapatkan informasi gerakan serta percepatan perangkat.
26. **Accelerometer API** — Membaca percepatan pada tiga sumbu.
27. **Gyroscope API** — Membaca kecepatan rotasi perangkat.
28. **Magnetometer API** — Membaca medan magnet di sekitar perangkat.
29. **AbsoluteOrientationSensor API** — Mengukur orientasi perangkat terhadap kerangka referensi absolut.
30. **RelativeOrientationSensor API** — Mengukur orientasi relatif berdasarkan sensor gerakan.

**Contoh:** pelacakan kurir, peta lokasi toko, navigasi, game berbasis gerakan, dan AR. GPS sendiri tidak memberikan posisi indoor presisi; perlu kombinasi sensor, kamera, peta indoor, atau infrastruktur positioning.

## 4. Touchscreen, gesture, dan interaksi pengguna (31–40)

31. **Touch Events API** — Mendeteksi sentuhan jari pada layar.
32. **Pointer Events API** — Menyatukan input sentuhan, mouse, dan stylus.
33. **Pointer Capture API** — Mempertahankan target input selama pengguna melakukan gesture.
34. **UI Events API** — Mengelola berbagai event interaksi pengguna.
35. **Keyboard API** — Menyediakan informasi mengenai keyboard fisik pada browser yang mendukungnya.
36. **VirtualKeyboard API** — Mengontrol interaksi dan tata letak keyboard virtual pada browser yang mendukungnya.
37. **Input Events API** — Mendeteksi dan menangani perubahan input teks.
38. **Drag and Drop API** — Memungkinkan pengguna menyeret dan melepaskan elemen atau file.
39. **Gamepad API** — Membaca tombol dan joystick controller yang terhubung.
40. **Vibration API** — Memicu pola getaran pada perangkat yang mendukungnya.

**Contoh:** swipe, joystick virtual, Kanban drag-and-drop, keyboard POS, dan umpan balik getaran setelah barcode berhasil dipindai.

## 5. Penyimpanan lokal dan database (41–50)

41. **Web Storage API** — Menyimpan data sederhana menggunakan localStorage dan sessionStorage.
42. **IndexedDB API** — Menyediakan database lokal terstruktur untuk data berukuran besar.
43. **Cache API** — Menyimpan respons jaringan untuk penggunaan offline dan caching.
44. **StorageManager API** — Memeriksa kuota dan mengelola persistensi penyimpanan browser.
45. **Origin Private File System** — Menyediakan penyimpanan file privat bagi origin aplikasi.
46. **File System Access API** — Membaca atau menyimpan file melalui mekanisme akses file yang didukung browser.
47. **File API** — Membaca metadata dan isi file yang dipilih pengguna.
48. **Blob API** — Mengelola data biner seperti gambar, video, PDF, dan hasil ekspor.
49. **FileReader API** — Membaca isi file sebagai teks, data URL, atau ArrayBuffer.
50. **Storage Access API** — Meminta akses penyimpanan yang dibatasi dalam konteks embedded atau third-party.

**Contoh:** POS offline-first yang tetap dapat membuat transaksi tanpa internet, menyimpan antrean upload, dan menyinkronkan data ketika koneksi kembali.

## 6. Networking dan komunikasi real-time (51–60)

51. **Fetch API** — Mengirim HTTP request ke backend REST atau GraphQL.
52. **XMLHttpRequest API** — Mengirim request HTTP serta memantau progres upload dan download.
53. **WebSocket API** — Membuat koneksi komunikasi dua arah secara real-time.
54. **WebTransport API** — Menyediakan komunikasi melalui HTTP/3 untuk aplikasi real-time yang didukung.
55. **Server-Sent Events API** — Menerima pembaruan real-time satu arah dari server.
56. **WebRTC API** — Menyediakan komunikasi audio, video, dan data secara peer-to-peer.
57. **RTCDataChannel API** — Mengirim data antar-peer melalui WebRTC.
58. **Broadcast Channel API** — Mengirim pesan antara tab atau konteks browser dari origin yang sama.
59. **MessageChannel API** — Membuat saluran komunikasi antara dua konteks JavaScript.
60. **Beacon API** — Mengirim data kecil ke server tanpa harus menunggu request selesai sebelum navigasi.

**Contoh:** dashboard pesanan real-time, live chat, sinkronisasi pembayaran, multiplayer, dan telemetri.

## 7. Progressive Web App dan kemampuan offline (61–70)

61. **Service Worker API** — Menangani fetch, caching, dan event tertentu di luar halaman.
62. **Background Sync API** — Menjadwalkan sinkronisasi tertunda pada browser yang mendukungnya.
63. **Periodic Background Sync API** — Meminta kesempatan sinkronisasi berkala; dukungan terbatas.
64. **Push API** — Menerima push message dari server melalui layanan push browser.
65. **Notifications API** — Menampilkan notifikasi sistem setelah memperoleh izin.
66. **Web App Manifest** — Metadata instalasi PWA, ikon, nama, dan display mode; manifest, bukan JavaScript API.
67. **Badging API** — Menampilkan indikator pada ikon aplikasi PWA yang mendukungnya.
68. **Background Fetch API** — Mendukung pengambilan file besar di background pada implementasi yang menyediakannya.
69. **Navigation Preload API** — Memulai network request saat Service Worker sedang diaktifkan.
70. **Service Worker Clients API** — Mengakses dan berkomunikasi dengan halaman yang dikendalikan Service Worker.

**Contoh:** PWA yang bisa dipasang di home screen, berfungsi offline, menyimpan draft transaksi, dan mengirim notifikasi pesanan. Background Sync tidak menjamin tugas berjalan pada waktu tertentu; browser/OS dapat menundanya.

## 8. Integrasi perangkat keras (71–80; dukungan terbatas)

71. **Web Bluetooth API** — Berkomunikasi dengan perangkat Bluetooth Low Energy yang kompatibel.
72. **WebUSB API** — Berkomunikasi dengan perangkat USB yang diizinkan pengguna.
73. **Web Serial API** — Mengakses perangkat serial melalui port yang didukung.
74. **WebHID API** — Berkomunikasi dengan perangkat Human Interface Device tertentu.
75. **Web NFC API** — Membaca dan menulis pesan NDEF pada tag NFC yang didukung.
76. **Battery Status API** — Mengakses status baterai jika browser mengizinkannya.
77. **Ambient Light Sensor API** — Membaca tingkat cahaya sekitar melalui sensor yang tersedia.
78. **Proximity Sensor API** — Mengakses informasi sensor kedekatan pada implementasi yang menyediakannya.
79. **Screen Wake Lock API** — Mencegah layar terkunci otomatis selama aktivitas tertentu.
80. **WebXR Device API** — Mengakses sesi augmented reality atau virtual reality yang didukung.

**Contoh:** tag NFC inventaris, sensor BLE, aksesori USB, atau menjaga layar kasir tetap menyala. Web NFC bukan pengganti umum NFC card emulation atau pembacaan semua kartu pembayaran.

## 9. Integrasi sistem operasi dan aplikasi lain (81–90)

81. **Web Share API** — Membagikan teks, URL, atau file melalui share sheet perangkat.
82. **Web Share Target API** — Memungkinkan PWA terinstal menerima konten dari aplikasi lain.
83. **Contact Picker API** — Memungkinkan pengguna memilih data kontak tertentu untuk dibagikan.
84. **Clipboard API** — Membaca dan menulis clipboard sesuai izin browser.
85. **Async Clipboard API** — Operasi clipboard asynchronous untuk teks dan format tertentu.
86. **Screen Orientation API** — Membaca orientasi layar dan meminta penguncian jika diizinkan.
87. **Fullscreen API** — Menampilkan elemen aplikasi dalam mode fullscreen.
88. **Picture-in-Picture API** — Menampilkan video pada jendela kecil bila didukung.
89. **Window Controls Overlay API** — Mengatur area title bar pada PWA desktop; tidak relevan secara umum untuk mobile.
90. **Launch Handler API** — Mengatur cara PWA terinstal menangani peluncuran aplikasi.

**Contoh:** berbagi invoice PDF, menerima gambar produk dari galeri, memilih kontak pelanggan, dan game fullscreen.

## 10. Rendering grafis dan game (91–100)

91. **WebGL API** — Merender grafis 2D dan 3D menggunakan GPU.
92. **WebGL2 API** — Menyediakan kemampuan rendering grafis lebih lanjut dari WebGL 1.
93. **WebGPU API** — Memberikan akses modern ke komputasi dan rendering GPU bila didukung.
94. **CanvasRenderingContext2D** — Menggambar bentuk, sprite, gambar, dan teks pada canvas 2D.
95. **Web Animations API** — Mengontrol animasi elemen melalui JavaScript.
96. **requestAnimationFrame()** — Menjadwalkan pembaruan frame sesuai siklus rendering browser.
97. **Screen API** — Menyediakan informasi layar dan kemampuan terkait tampilan.
98. **CSSOM API** — Membaca dan memodifikasi representasi CSS melalui JavaScript.
99. **ResizeObserver API** — Mendeteksi perubahan ukuran elemen.
100. **IntersectionObserver API** — Mendeteksi ketika elemen masuk atau keluar dari area tampilan.

**Contoh:** game balap 3D, grafik interaktif, animasi UI, dan lazy loading objek di luar viewport.

## 11. Video processing dan multimedia tingkat lanjut (101–110)

101. **WebCodecs API** — Mengakses encoder dan decoder audio/video tingkat rendah.
102. **VideoEncoder API** — Mengodekan frame video dengan codec yang didukung.
103. **VideoDecoder API** — Mendekode data video menjadi frame.
104. **AudioEncoder API** — Mengodekan audio dengan codec yang didukung browser.
105. **AudioDecoder API** — Mendekode audio terkompresi.
106. **VideoFrame API** — Mewakili frame video untuk pemrosesan multimedia.
107. **Media Source Extensions API** — Memasok segmen media untuk streaming.
108. **Encrypted Media Extensions API** — Mengintegrasikan pemutaran konten terlindungi DRM.
109. **HTMLMediaElement API** — Mengontrol play, pause, seek, volume, dan status media.
110. **Media Capabilities API** — Memeriksa dukungan dan karakteristik pemutaran/encoding media.

**Contoh:** streaming, editor video, kompresi media, pemrosesan frame kamera, dan adaptasi kualitas video.

## 12. Keamanan dan autentikasi (111–120)

111. **Web Authentication API (WebAuthn)** — Mengautentikasi pengguna dengan passkey/autentikator kompatibel.
112. **Credential Management API** — Mengelola kredensial dan operasi autentikasi yang didukung browser.
113. **Web Crypto API** — Menyediakan operasi kriptografi melalui browser.
114. **SubtleCrypto API** — Hashing, enkripsi, dekripsi, tanda tangan, dan verifikasi kriptografis.
115. **Crypto.getRandomValues()** — Menghasilkan nilai acak yang cocok untuk kebutuhan kriptografi.
116. **Permissions API** — Memeriksa status izin pengguna untuk kemampuan tertentu.
117. **Permissions Policy API** — Memeriksa kebijakan akses fitur yang berlaku pada dokumen.
118. **Secure Contexts API** — Memeriksa apakah halaman berjalan dalam konteks aman.
119. **Content Security Policy (CSP)** — Membatasi sumber script, gambar, koneksi, dan resource melalui kebijakan keamanan.
120. **Reporting API** — Mengumpulkan laporan pelanggaran kebijakan atau masalah browser tertentu.

**Contoh:** login dengan passkey, enkripsi data sensitif, dan laporan CSP. WebAuthn tidak memberi situs akses langsung ke data wajah atau sidik jari; Permissions API juga tidak bisa memberikan izin sepihak.

## 13. Payment dan e-commerce (121–130; dukungan bervariasi)

121. **Payment Request API** — Memfasilitasi permintaan pembayaran melalui metode yang didukung browser.
122. **Payment Handler API** — Memungkinkan aplikasi pembayaran web kompatibel menangani permintaan pembayaran.
123. **Payment Method Manifest** — Metadata metode pembayaran berbasis web.
124. **Payment Request Button API** — API eksperimental terkait penyajian tombol pembayaran terintegrasi.
125. **WebOTP API** — Membantu pengisian OTP SMS dengan persetujuan pengguna.
126. **Credential Management Federated Credential** — Antarmuka federated credential lama; gunakan mekanisme federasi yang masih didukung.
127. **FedCM API** — Mendukung login melalui penyedia identitas federasi.
128. **Digital Credentials API** — Meminta presentasi kredensial digital dari wallet kompatibel.
129. **Web Locks API** — Mengkoordinasikan akses eksklusif terhadap resource antartab/worker.
130. **Background Fetch API** — Download resource besar tanpa mempertahankan halaman aktif; dukungan terbatas.

**Contoh:** checkout, login federasi, OTP, dan koordinasi transaksi offline. Payment Request tidak otomatis memproses uang: QRIS dan metode pembayaran Indonesia tetap membutuhkan integrasi PSP/backend yang sesuai.

## 14. Background processing dan multithreading (131–140)

131. **Web Workers API** — Menjalankan JavaScript di thread terpisah dari UI.
132. **DedicatedWorker API** — Worker yang digunakan oleh satu konteks aplikasi.
133. **SharedWorker API** — Berbagi worker dengan beberapa konteks dari origin yang sama.
134. **Worklet API** — Menjalankan skrip khusus seperti pemrosesan audio.
135. **SharedArrayBuffer API** — Berbagi buffer memori antarkonteks dengan syarat keamanan tertentu.
136. **Atomics API** — Operasi atomik dan sinkronisasi pada shared memory.
137. **Structured Clone Algorithm** — Menyalin data terstruktur antar-konteks; algoritma platform.
138. **scheduler.postTask()** — Menjadwalkan task JavaScript dengan prioritas bila didukung.
139. **requestIdleCallback()** — Menjadwalkan pekerjaan saat browser memiliki waktu idle.
140. **PerformanceObserver API** — Mengamati entri performa seperti resource timing atau long tasks.

**Contoh:** kompresi gambar, OCR/model ML, pengolahan CSV besar, dan UI mobile yang tetap responsif.

## 15. Machine learning dan AI (141–150; sebagian eksperimental)

141. **WebNN API** — Antarmuka neural network yang ditujukan untuk akselerasi ML; dukungan terbatas.
142. **WebGPU Compute API** — Komputasi paralel menggunakan GPU.
143. **WebAssembly API** — Menjalankan modul WebAssembly di browser.
144. **WebAssembly SIMD** — Operasi vektor paralel untuk mempercepat komputasi tertentu.
145. **WebAssembly Threads** — Multithreading pada WebAssembly dengan persyaratan memori bersama.
146. **Compute Pressure API** — Sinyal tekanan komputasi sistem pada browser yang mendukungnya.
147. **Shape Detection API** — Kelompok API deteksi bentuk/objek sederhana via kemampuan platform.
148. **Face Detection API** — Mendeteksi area wajah pada gambar; dukungan sangat terbatas.
149. **Text Detection API** — Mendeteksi lokasi teks pada gambar bila tersedia.
150. **BarcodeDetector API** — Mendeteksi barcode atau QR code dari sumber gambar yang didukung.

**Contoh:** computer vision, OCR, deteksi objek, dan inferensi lokal. Jangan mengasumsikan WebNN dan Shape Detection tersedia di seluruh browser; sediakan fallback seperti runtime berbasis WebAssembly atau backend.

## 16. DOM, navigasi, dan UI (151–160)

151. **DOM API** — Mengakses dan memodifikasi struktur dokumen HTML.
152. **History API** — Mengelola riwayat navigasi tanpa full-page reload.
153. **Navigation API** — Mengelola navigasi dan transisi halaman melalui antarmuka modern.
154. **URL API** — Membaca dan memanipulasi URL secara terstruktur.
155. **URLSearchParams API** — Mengelola parameter query pada URL.
156. **MutationObserver API** — Mengamati perubahan elemen dan struktur DOM.
157. **Selection API** — Mengakses teks/area dokumen yang dipilih pengguna.
158. **Range API** — Mengelola rentang teks dan node dalam dokumen.
159. **Visual Viewport API** — Membaca ukuran/posisi viewport visual, termasuk perubahan karena keyboard.
160. **View Transitions API** — Mendukung transisi visual antartampilan atau dokumen bila didukung.

**Contoh:** animasi antarlayar React, layout yang menyesuaikan keyboard, navigasi SPA, dan editor dokumen.

## 17. Monitoring performa dan observability (161–170)

161. **Performance API** — Mengakses data waktu dan performa aplikasi.
162. **Navigation Timing API** — Mengukur tahapan pemuatan dan navigasi halaman.
163. **Resource Timing API** — Mengukur pemuatan gambar, script, CSS, dan resource lain.
164. **User Timing API** — Membuat performance mark dan measure untuk alur khusus.
165. **Long Tasks API** — Mendeteksi pekerjaan main thread yang terlalu lama.
166. **Event Timing API** — Mengukur waktu pemrosesan interaksi pengguna.
167. **Largest Contentful Paint API** — Mengukur waktu tampil konten terbesar yang terlihat.
168. **Layout Instability API** — Mengamati perubahan layout yang tidak diharapkan.
169. **Performance Memory API** — Sebagian informasi penggunaan memori JavaScript pada browser tertentu.
170. **Network Information API** — Perkiraan jenis/kualitas koneksi pada implementasi yang mendukung.

**Contoh:** observability startup, latency interaksi kasir, durasi upload, dan gangguan rendering. Gunakan feature detection; jangan menganggap semua metrik tersedia.

## 18. Konektivitas, identifikasi, dan kemampuan perangkat (171–180)

171. **Navigator API** — Mengakses informasi dan kemampuan browser melalui `navigator`.
172. **Online and Offline Events** — Mendeteksi perubahan status konektivitas yang dilaporkan browser.
173. **navigator.hardwareConcurrency** — Perkiraan jumlah logical processor yang diekspos browser.
174. **navigator.deviceMemory** — Perkiraan RAM perangkat bila disediakan browser.
175. **User-Agent Client Hints API** — Meminta informasi browser/platform melalui Client Hints.
176. **Network Information API** — Perkiraan koneksi seperti `effectiveType` bila tersedia.
177. **Device Posture API** — Informasi postur perangkat lipat pada browser yang mendukungnya.
178. **Window Segments Enumeration API** — Informasi segmen tampilan pada perangkat dengan lebih dari satu area layar.
179. **Page Visibility API** — Mengetahui ketika halaman aktif atau tersembunyi.
180. **Idle Detection API** — Mendeteksi kondisi idle pengguna/layar dengan izin dan dukungan sesuai.

**Contoh:** adaptasi ukuran gambar menurut koneksi, penurunan kompleksitas grafis, dan penghentian rendering ketika halaman tersembunyi. `navigator.onLine` tidak membuktikan backend bisa dijangkau: tetap gunakan request nyata dan retry.

## 19. Dokumen, printing, dan manipulasi teks (181–190)

181. **CSS Typed OM API** — Mengakses nilai CSS sebagai objek bertipe, bukan hanya string.
182. **CSS Font Loading API** — Memuat dan memeriksa status font melalui JavaScript.
183. **FontFace API** — Membuat dan mengelola font aplikasi.
184. **FontFaceSet API** — Memeriksa dan mengelola kumpulan font dokumen.
185. **DOMParser API** — Mengubah string HTML/XML menjadi struktur dokumen.
186. **XMLSerializer API** — Mengubah struktur DOM/XML menjadi string.
187. **Encoding API** — Mengodekan dan mendekode teks dengan encoding yang didukung.
188. **TextEncoder API** — Mengubah teks menjadi byte UTF-8.
189. **TextDecoder API** — Mengubah byte menjadi teks.
190. **window.print()** — Membuka mekanisme pencetakan browser, termasuk simpan PDF jika tersedia pada perangkat.

**Contoh:** invoice POS, laporan siap cetak, pengelolaan font, dan pengolahan CSV/XML. `window.print()` tidak menjamin PDF otomatis atau dukungan printer thermal.

## 20. API tambahan untuk aplikasi mobile web (191–200)

191. **WebSocketStream API** — Antarmuka WebSocket berbasis Streams dengan backpressure; dukungan terbatas.
192. **Streams API** — Memproses aliran data bertahap tanpa memuat seluruh data ke memori.
193. **Compression Streams API** — Mengompresi/mendekompresi aliran data pada format yang didukung.
194. **Web Locks API** — Mencegah beberapa konteks mengubah resource bersama secara bersamaan.
195. **File Handling API** — Memungkinkan PWA tertentu menangani file dari sistem operasi.
196. **Protocol Handlers API** — Mendaftarkan web app sebagai penangan skema URL tertentu.
197. **URL Pattern API** — Mencocokkan URL terhadap pola untuk routing.
198. **Web Speech API** — Kelompok API speech synthesis dan speech recognition.
199. **Web Animations API** — Membuat, menjalankan, dan mengontrol animasi via JavaScript.
200. **Screen Capture API** — Meminta pengguna memilih layar, tab, atau jendela untuk dibagikan jika browser mendukungnya.

**Contoh:** pemrosesan data besar, pengolahan file, screen sharing, sinkronisasi antar-window, dan integrasi PWA dengan OS.

---

## Mana yang tersedia di Android dan iOS?

| Kelompok | Panduan praktis |
|---|---|
| Fitur web yang umum digunakan | Kamera, mikrofon, GPS, touch events, IndexedDB, Service Worker, WebSocket, Canvas, WebAssembly, Fetch, dan Web Crypto dapat menjadi fondasi lintas platform, dengan pemeriksaan izin dan browser. |
| Perlu pemeriksaan kompatibilitas | Push notifications, file system, Web Share Target, Background Sync, Screen Wake Lock, passkey, WebGPU, dan speech recognition berbeda menurut browser, versi OS, dan status instalasi PWA. |
| Jangan diasumsikan tersedia | WebUSB, Web Serial, WebHID, Web Bluetooth, Web NFC, WebNN, Ambient Light Sensor, Contact Picker, dan Background Fetch memiliki pembatasan/dukungan yang beragam. |

### Empat contoh integrasi

**1. POS mobile dengan barcode scanner**  
Kamera → MediaStream → Barcode Detection atau decoder JavaScript → Lookup produk → IndexedDB → Backend POS. Pengguna memindai barcode, menambah item ke keranjang, dan menyimpan transaksi lokal saat offline.

**2. Navigasi indoor berbasis kamera**  
Kamera → Sensor gerakan → Computer Vision → Indoor map → Routing → Speech Synthesis. Peta dan positioning tambahan dibutuhkan untuk menentukan posisi secara akurat di dalam gedung.

**3. Upload foto offline-first**  
File API → Canvas atau ImageBitmap → Compression → IndexedDB → Upload queue → Backend → Object storage. Gambar dikompresi terlebih dahulu; antrean dicoba ulang saat koneksi tersedia. Background Sync hanya optimasi pada browser yang mendukungnya.

**4. Game balap 3D berbasis browser**  
WebGL atau WebGPU → Touch Events → Gamepad → Web Audio → requestAnimationFrame → IndexedDB. Dapat diperluas dengan multiplayer lewat WebSocket atau WebRTC.

## Contoh feature detection

Jangan hanya menggunakan user-agent. Periksa keberadaan API, lalu tangani penolakan izin, ketidakcocokan perangkat, dan kegagalan aktual.

```javascript
async function detectMobileCapabilities() {
  const nav = navigator;

  const capabilities = {
    camera: !!nav.mediaDevices?.getUserMedia,
    geolocation: "geolocation" in nav,
    serviceWorker: "serviceWorker" in nav,
    indexedDB: "indexedDB" in window,
    webBluetooth: "bluetooth" in nav,
    webNFC: "NDEFReader" in window,
    webGPU: "gpu" in nav,
    webGL2: !!document.createElement("canvas").getContext("webgl2"),
    webAssembly: "WebAssembly" in window,
    webShare: "share" in nav,
    fileSystemAccess: "showOpenFilePicker" in window,
    screenWakeLock: "wakeLock" in nav,
    webAuthn: "PublicKeyCredential" in window,
    notifications: "Notification" in window,
    secureContext: window.isSecureContext,
  };

  return capabilities;
}

detectMobileCapabilities().then(console.table);
```

Hasil kode di atas **hanya menunjukkan keberadaan antarmuka API**, bukan jaminan fitur bisa dipakai. Sebuah API mungkin tersedia tetapi gagal karena izin, perangkat, konteks tidak aman, atau pembatasan browser/OS.

## Referensi

- [MDN — Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)
- [MDN — Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev — Progressive Web Apps](https://web.dev/learn/pwa)
- [Can I use — Browser compatibility tables](https://caniuse.com/)
