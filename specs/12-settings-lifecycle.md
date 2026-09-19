# Spec: 12 — Settings, Support, Privacy & Lifecycle (P12)

## Objective
Settings sebagai control center; compliance App Store/Play + UU PDP menunggu verifikasi legal (tanpa klaim pasal/periode sebelum counsel).

## Screens
- SettingsHub: grup Akun, Notifikasi, Data & Privasi, Tampilan, Bantuan, Tentang.
- Appearance: Dark/Light/System, aksen (3 opsi netral), font kecil/sedang/besar; toggle label SR ("Mode gelap, saat ini mati").
- DataPrivacy: data terkumpul, sumber API + "Cabut Akses" per API, riwayat consent, "Data dibagikan ke pihak ketiga: apa + tombol cabut".
- ExportRequest: estimasi waktu ("Siap dalam 24 jam via email" — OPEN), progress, retry, completion.
- DeleteAccountRequest: re-auth → konfirmasi → alasan opsional → jelaskan dihapus/disimpan/pihak-ketiga → jendela batal hanya bila kebijakan mewajibkan (tanpa angka 14 hari final) → completion. Warning permanen jelas.
- ActiveSessions (bila didukung), SubscriptionLink (bila premium disetujui; kelola via store, bukan cancel in-app sendiri).
- HelpSupport: FAQ accordion, Chat placeholder (Intercom/Zendesk OPEN), Laporkan Bug form, crash-recovery entry.
- AboutLegal: versi, changelog, Kebijakan Privasi/Syarat, lisensi OSS, URL privasi/support live sebelum rilis.

## Rules
- Re-auth sebelum DataPrivacy + Delete. Low-connectivity path + offline queue.
- Motion: grouped lists 56dp, sub-header, sheet confirm dari bawah, focus kembali.
- Events: `export_requested, deletion_requested/cancelled, access_revoked, support_opened`.
- Trace ke P03/P05/P06; perubahan sensitif → revisi upstream.
