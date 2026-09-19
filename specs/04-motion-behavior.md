# Spec: 04 — Motion Behavior (binding untuk semua interaksi)

- version: 1.0 | status: BINDING | date: 19 Sep 2026
- source: `oneui_design_guide_eng.pdf` (2019) — behavior reference only
- caveat: PDF tidak memberi angka durasi/easing/velocity/spring. Angka di §9 adalah baseline TEAM-DEFINED, bukan spesifikasi resmi Samsung/Android terbaru. Jangan sajikan sebagai official values.
- Berlaku untuk: semua navigasi, sheet/dialog, app bar, shared-element, slider, loading, feedback, reduced-motion. Setiap spec fitur P07–P12 wajib mengisi kontrak motion ini.
- Token mesin: `specs/04-motion.tokens.json`. CSS: `assets/css/motion.css`.

---

Dokumen One UI ini dapat dijadikan **behavior specification**, tetapi belum menjadi motion specification lengkap. Dokumen menjelaskan arah gerak, hubungan gesture–UI, serta state awal/akhir, tetapi hampir tidak memberikan angka durasi, easing curve, velocity threshold, atau spring parameters.

Karena PDF dibuat pada 2019, gunakan prinsip interaksinya sebagai referensi; jangan menganggap seluruh detailnya sebagai spesifikasi Samsung/Android terbaru.

## 1. Tiga prinsip motion utama

### A. Intuitive

Animasi harus menjelaskan:

* Dari mana elemen berasal.
* Ke mana elemen pergi.
* Hubungan antara layar lama dan layar baru.
* Apakah pengguna sedang masuk lebih dalam atau kembali.

| Interaksi | Perilaku |
|---|---|
| Membuka item daftar | Layar detail masuk dari bawah ke atas |
| Kembali ke daftar | Detail keluar dari atas ke bawah |
| Berpindah antar-app/screen sejajar | Transisi horizontal |
| Membuka dialog | Dialog muncul dari bawah |
| Menutup dialog | Dialog turun kembali |

```ts
type NavigationRelation = "deeper" | "back" | "peer" | "modal";
function transitionFor(relation: NavigationRelation) {
  switch (relation) {
    case "deeper": return { enter: "slide-up", exit: "stay" };
    case "back": return { enter: "stay", exit: "slide-down" };
    case "peer": return { enter: "slide-horizontal", exit: "slide-horizontal" };
    case "modal": return { enter: "slide-up", exit: "slide-down" };
  }
}
```

Jangan menggunakan satu animasi `fade` untuk seluruh navigasi.

### B. Seamless

* Ikon aplikasi membesar menjadi layar aplikasi sambil mempertahankan bentuk dan corner radius.
* App bar mengikuti scroll expanded → collapsed.
* Shared element tetap terlihat; gambar yang sama dipertahankan.
* Prioritas: shared-element transition, interpolasi posisi/ukuran/radius, continuity gambar/judul/avatar/kartu, gesture progress mengontrol transition progress.

```ts
type SharedElementFrame = { x: number; y: number; width: number; height: number; radius: number; opacity: number };
function interpolateFrame(from: SharedElementFrame, to: SharedElementFrame, progress: number): SharedElementFrame {
  return {
    x: lerp(from.x, to.x, progress), y: lerp(from.y, to.y, progress),
    width: lerp(from.width, to.width, progress), height: lerp(from.height, to.height, progress),
    radius: lerp(from.radius, to.radius, progress), opacity: lerp(from.opacity, to.opacity, progress),
  };
}
```

### C. Tangible

* Slider membesar saat disentuh, kembali normal saat dilepas. Gambar/screen mengikuti jari. Jika gesture belum melewati threshold, kembali ke awal.

```ts
type GestureState = "idle" | "pressed" | "dragging" | "settling" | "committed" | "cancelled";
```

Selama `dragging`, posisi dari gesture (bukan animasi waktu):

```ts
progress = clamp(translationY / dismissDistance, 0, 1);
translateY = progress * dismissDistance;
backgroundOpacity = 1 - progress * 0.35;
const shouldCommit = progress >= progressThreshold || velocityY >= velocityThreshold;
```

## 2. Transition yang dapat langsung diimplementasikan

| Kasus | Initial | Interactive | Final | Cancel |
|---|---|---|---|---|
| List → detail | Detail di bawah viewport | Opsional ikut gesture | Penuhi layar | Kembali ke bawah |
| Detail → list | Penuhi layar | Turun | Keluar ke bawah | Kembali penuh |
| Peer | Baru di kanan/kiri | Ikut swipe horizontal | Aktif | Snap kembali |
| Bottom dialog | Di bawah viewport | Drag vertikal opsional | Berhenti di anchor | Turun kembali |
| App bar collapse | Expanded | Tinggi ikut scroll | Collapsed | Snap terdekat |
| Shared image | Frame sumber | Posisi/ukuran/radius interpolasi | Frame tujuan | Kembali ke sumber |
| Slider press | Normal | Membesar | Nilai baru + normal | Kembali tanpa nilai |
| Drag image | Normal | Menempel jari | Dismiss/open | Spring kembali |

## 3. Expandable app bar

Hanya 2 settled states (`expanded`/`collapsed`); tengah hanya saat gesture; scroll naik collapse, scroll turun dari atas expand; gesture di tengah → snap; first-level boleh expanded; deeper umumnya collapsed; landscape fullscreen tidak disarankan; layout besar min ~580dp.

```ts
type AppBarState = { type: "expanded" } | { type: "dragging"; progress: number } | { type: "collapsed" };
function settleAppBar(progress: number, velocityY: number) {
  if (velocityY < -VELOCITY_THRESHOLD) return "collapsed";
  if (velocityY > VELOCITY_THRESHOLD) return "expanded";
  return progress >= 0.5 ? "collapsed" : "expanded";
}
height = lerp(expandedHeight, collapsedHeight, progress);
titleScale = lerp(expandedTitleScale, 1, progress);
titleY = lerp(expandedTitleY, collapsedTitleY, progress);
supportingOpacity = 1 - progress; searchOpacity = 1 - progress;
```

Satu sumber `progress` untuk tinggi/judul/konten/search.

## 4. Bottom sheet dan dialog

Dari bawah (jangkauan satu tangan). States: `hidden|entering|open|dragging|exiting`. Buka: scrim → sheet dari bawah → focus ke sheet → background nonaktif. Tutup: sheet turun → scrim hilang → focus kembali ke pemicu. TBD yang harus diputuskan per sheet: tap scrim menutup?, swipe-down?, min drag, velocity threshold, anchors, keyboard, dirty-guard.

## 5. Shared-element transition

Cocok: thumbnail→detail, avatar→detail, habit card→habit detail, transaction card→transaction detail, product→detail. Pertahankan identity; animasikan x/y/width/height/cornerRadius/clipPath/contentScale/elevation/scrim opacity. Utamakan transform+clip, bukan layout ulang page.

```ts
type SharedElementSpec = { id: string; sourceRect: Rect; destinationRect: Rect; sourceRadius: number; destinationRadius: number; contentModeFrom: "cover"|"contain"; contentModeTo: "cover"|"contain" };
```

## 6. Slider dan direct manipulation

`onPointerDown: pressed, thumb→1.15; onPointerMove: value=positionToValue, render seframe, clamp, announce throttled; onPointerUp: commit + kembali normal`. Sediakan keyboard + increment/decrement + haptic discrete-step saja.

## 7. Progress dan loading

Tampilkan struktur dulu → skeleton/progress lokal → pertahankan navigasi → blocking hanya bila interaksi benar-benar dilarang.

```ts
type AsyncState<T> = { status: "idle" } | { status: "loading"; previous?: T } | { status: "success"; data: T } | { status: "partial"; data: T; failedSections: string[] } | { status: "error"; previous?: T; retryable: boolean };
```

## 8. Sound dan haptic

Mendukung visual, konsisten, hemat, hanya setelah tujuan tercapai, tidak berulang. Contoh: success sound setelah upload berhasil.

```ts
type FeedbackEvent = "selection" | "action_confirmed" | "task_succeeded" | "task_failed" | "warning";
```

Sound opsional + ikut pengaturan sistem; selalu ada padanan visual/haptic.

## 9. Motion tokens (TEAM baseline, bukan resmi)

Lihat `specs/04-motion.tokens.json`: durations 100/150/250/350/450; easings standard/enter/exit; springs responsive/returnToOrigin. Wajib diuji di device nyata.

## 10. Reduced motion

Hapus parallax; hindari zoom/travel panjang; slide panjang → crossfade singkat; tanpa dekorasi berulang; direct manipulation tetap ikut jari tapi settling sederhana; feedback state tetap ada.

```ts
const transition = reduceMotion ? { type: "fade", duration: motion.duration.fast } : { type: "shared-element", duration: motion.duration.emphasized };
```

## 11. Acceptance criteria

Transition menunjukkan relasi navigasi benar; tanpa teleport; ikut jari tanpa delay; cancel kembali stabil; app bar tidak berhenti partial; shared element jaga identity+aspect; loading tidak blokir tanpa alasan; tanpa layout shift/input tertunda; focus benar setelah dialog; semua gesture ada alternatif tombol/a11y action; reduced motion didukung; stabil di target device; sound/haptic sekali di hasil final.

Kesimpulan: **motion harus merepresentasikan struktur, menjaga continuity, dan merespons jari secara langsung.**
