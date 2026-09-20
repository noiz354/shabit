# HabitWealth — CSR One UI (PHP shared hosting)

## Setup (wajib setelah clone/checkout branch)
```
npm ci            # pasang dependensi PERSIS dari package-lock.json (jangan lewati; node_modules tidak di-commit)
npm test          # vitest (happy-dom + fake-indexeddb) — bukti T13
npm run build     # vite build → dist/ (deploy FTP → public_html/)
npm run dev       # dev server (bind 0.0.0.0)
```
> Pelajaran verifikasi PR #2: `node_modules` yang basi membuat test gagal palsu. Selalu `npm ci` (bukan `npm install`) setelah checkout agar lockfile yang dipakai.

Node ≥ 20. Backend PHP tipis di `public_html/api/v1/` (tanpa composer). Dokumen sumber kebenaran: `specs/`, `AGENTS.md`, `TODO.md`, `PROGRESS.md`, QA: `docs/qa/`.
