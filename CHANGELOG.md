# Changelog

Semua perubahan penting pada project ini didokumentasikan di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
### Added
- Filter frontend untuk data stickiness (tidak mengubah sumber data):
  - Exclude kelas dengan `slot_name` mengandung "matematika lanjut" atau "fisika dan kimia" (case-insensitive) dari tabel stickiness, line chart, dan overview heatmap.
  - Cutoff history berdasarkan `courseGrade` dan `slotName` (W22 untuk grade 4/5/7/8/10/11, W16 untuk grade 6 & 9 kecuali slot "persiapan smp"/"persiapan sma" → W22, W14 untuk grade 12), dengan recalculation `latest` (stickiness, deviation, status) dari history yang sudah dipangkas.
  - Helper baru: `shouldExcludeSlot`, `getWeekCutoff`, `applyStickinesFilters` di `App.jsx`.
- Modal observasi (`ObsModal`) sekarang menampilkan strip 2 kolom di bagian atas: **Tanggal Observasi** dan **Tanggal Kelas**.

### Changed
- Sesuaikan dengan perubahan kolom pada CSV observasi: kolom `date` → `observation_date`, dan tambahan kolom baru `class_date`. `processObservasi` di `App.jsx` kini membaca `observation_date` (untuk sorting & tampilan) dan `class_date` (ditampilkan di modal observasi).

## [0.1.0] - 2026-06-12
### Added
- Setup awal project **GJ Performance Dashboard** — scale-up dari versi POD 7 SMP Matematika ke 56 Guru Juara aktif (SD–SMA, Matematika & IPA/Science).
- Frontend React + Vite dengan komponen utama:
  - `App.jsx` — data fetching, access control, dan routing view (Overview / Teacher / Admin).
  - `AdminPanel.jsx` — CRUD `user_profiles` (akses terbatas).
  - `Login.jsx` & `Greeting.jsx` — halaman login Google dan animasi greeting.
- Integrasi **Firebase Authentication** (login Google) dan **Firebase Hosting** (`gj-performance-dashboard`).
- Integrasi **Supabase** (`v_users_full`, `user_profiles`) untuk data role, akses, dan foto profil.
- Data pipeline via **Google Apps Script** + **Papaparse** untuk konsumsi CSV: `cuti`, `coaching`, `observasi`, `name_map`.
- Konfigurasi project: `vite.config.js`, `eslint.config.js`, `.firebaserc`, `firebase.json`.

### Docs
- Tambah `ARCHITECTURE.md` — dokumentasi system overview, tech stack, struktur file, data pipeline, access control, komponen UI, deployment, dan key learnings/gotchas.
