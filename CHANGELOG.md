# Changelog

Semua perubahan penting pada project ini didokumentasikan di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
### Changed
- **Badge semester di section "Leave per Class"** (`.cuti-pill`, dua tempat di `App.jsx` — admin/lead view & guru biasa view) — sebelumnya menampilkan label semester statis ("SMT 2 2025/2026") yang tidak memberi konteks apa pun. Diganti jadi hint "Hover bar for dates" supaya user tahu bar di kolom "Meetings missed" (`CutiBar`) bisa di-hover untuk melihat tanggal-tanggal detail meninggalkan kelas (tooltip ini sudah ada sebelumnya, hanya belum ada penanda visual).

### Fixed
- **Layout responsif tabel "Stickiness Index per Slot"** — badge status (`.badge`) dan streak (`.streak-badge`) sekarang `white-space: nowrap` + `flex-shrink: 0` agar tidak pecah jadi 2 baris saat kolom sempit; `.left-col`/`.right-col` ditambah `min-width: 0` supaya lebar tabel tidak ikut mendistorsi lebar grid `.two-col` (penyebab kolom Slot jadi sempit & hint "Click a slot to view the trend" pindah baris secara tidak konsisten antar guru). Tabel `.slot-box .obs-scroll` diberi `min-width: 360px` + `min-width` per kolom pertama/terakhir; jika tetap tidak cukup, scroll horizontal lokal di dalam box (bukan memepetkan isi).
- **Scroll horizontal yang tebal/native** — `.sidebar-main`, `.sidebar-list`, dan `.modal` sebelumnya hanya set `overflow-y: auto` tanpa `overflow-x`, sehingga browser otomatis mempromosikan `overflow-x` jadi `auto` juga (CSS overflow propagation) dan menampilkan scrollbar horizontal native yang tebal. Ditambahkan `overflow-x: hidden` pada ketiganya, serta `height: 4px` pada rule `::-webkit-scrollbar` di `.obs-scroll`, `.app-body`, dan `.ov-heatmap-wrap` supaya scroll horizontal yang memang disengaja (mis. di dalam `.obs-scroll`) tampilannya tetap tipis konsisten dengan scroll vertikal.
- **Box "GJ Utilization" (`.util-strip`) meluber keluar card saat window sempit/zoom** — strip ini flex row tanpa wrap; ketika tidak cukup lebar, badge status (Min. 50%/75%) keluar dari border card dan ikut terpotong oleh `overflow-x: hidden` di atas. Ditambahkan `flex-wrap: wrap` + `row-gap: 10px` pada `.util-strip`, dan `flexWrap: 'wrap'` pada inline style baris status (`App.jsx`) agar konten reflow rapi di dalam card, bukan meluber atau hilang.
- **KPI card (Slot Performance/Observation Result/Observation Assignment/Punctuality) terpotong & terlalu sempit saat window sempit/zoom** — baris 4 card ini sebelumnya `display: flex` dengan `flex: 1` tanpa `flexWrap`; karena card SVG donut punya min-content width besar, card terakhir (Punctuality) ikut terpotong begitu total lebar minimum melebihi ruang tersedia. Diganti jadi `display: grid` dengan `gridTemplateColumns: repeat(auto-fit, minmax(190px, 1fr))` di `App.jsx`, sehingga 4 card tetap sejajar penuh saat lebar cukup, dan wrap rapi ke 2×2 (tanpa ada card yang melar penuh sendirian) saat sempit.

## [0.3.1] - 2026-06-26
### Changed
- **User avatar di header kanan** (`UserAvatar`, `.user-avatar-wrapper`) sekarang dibungkus pill putih (`border-radius: 999px`), foto/inisial dan nama panggilan + role lebih kontras di atas header biru. Sekaligus perbaiki typo lama `width: 32x` → `32px` pada `.user-avatar-img`, dan sesuaikan warna fallback `.user-avatar-initials` (background biru header) supaya tetap terbaca di pill putih.
- **Fallback nama panggilan & role untuk super admin tanpa row di `v_users_full`**: `nickName` sekarang fallback ke kata pertama `user.displayName` (mis. "Fatah" bukan "Fatah Abdul"), dan `role` fallback ke `"Admin"` jika `accessProfile.isSuperAdmin` true dan kolom `role` kosong. Jika row-nya ada di database, data database tetap diprioritaskan apa adanya (termasuk `role` aslinya, bukan dipaksa "Admin").
- Sub-header `header-v3-bottom` (nama, role badge, pod, "Reports to: ...") sekarang juga tampil di GJ view, sebelumnya hanya muncul di manager view. Memakai `teacherProfiles[selTeacher]` yang sama, dengan `selTeacher` = `accessProfile.nickName` sehingga otomatis menampilkan profile GJ yang login.

### Fixed
- **Loading data lambat (kadang sampai ~15 detik)** — `loadAll()` di `App.jsx` sebelumnya menunggu (`await`) fetch `CSV_NAMEMAP` selesai dulu sebelum memulai 8 fetch CSV/Supabase lainnya, menambah satu round-trip network penuh di setiap load. Sekarang semua fetch dimulai paralel sejak awal lewat `nameMapPromise`; processor yang butuh nameMap (`processObservasi`, `processCuti`, `processCoaching`, `processObservationAssignment`, `processLiveClassIssues`, `processEventAttendance`, mapping `teacher_utilization`) tetap menunggu promise itu resolve sebelum diproses, sehingga proteksi race condition (full name vs nick name di sidebar) tidak berubah. Hasil pengukuran di DevTools: ~15 detik → ~5 detik.

## [0.3.0] - 2026-06-26
### Added
- **Section GJ Utilization** — strip ringkasan utilisasi guru di bagian atas detail teacher (manager view & GJ view).
  - Integrasi project Supabase baru `supabaseUtil`, query tabel `semesters` (filter `name = "Semester 2 2025/2026"`) lalu `teacher_utilization` untuk semester tersebut, dengan normalisasi `teacher_name` lewat `nameMap`.
  - Menampilkan persentase utilisasi, total jam mengajar (mandatory + non-mandatory), jam sebagai mentor (jika > 0), dan status terhadap threshold minimum 50% & 75% (badge hijau/merah).
  - Tambah font icon **Tabler Icons** (`index.html`) untuk ikon-ikon di strip ini dan KPI card Punctuality.
- **Fitur Punctuality** — KPI card baru (Late entry / Early exit) di sebelah KPI Slot Performance & Observation Result, klik untuk buka modal `PunctualityModal` berisi detail per kejadian (jam join/leave vs jam mulai/selesai kelas, overage).
  - CSV baru `CSV_PUNCTUALITY` (`gid=1486822041`), diproses oleh `processPunctuality(rows)`.
  - Access gate `canSeePunctuality(teacherNick, courseGrade, slotName)`: GJ lihat punya sendiri, direct manager & super admin lihat semua, lainnya dibatasi scope POD.
- **Fitur Live Class Issues** — section baru di kolom kiri menampilkan daftar isu kelas live (problem, slot, tanggal, alasan) per GJ.
  - CSV baru `CSV_LIVE_CLASS_ISSUES` (`gid=1535291009`), diproses oleh `processLiveClassIssues(rows, nameMap)`, di-filter dengan `canSeeClassForTeacher` berdasarkan grade hasil parsing kolom `course_grade` (sebelumnya sempat di-regex dari `slot_name`, sekarang CSV sudah menyediakan kolom `course_grade` langsung) dan ditampilkan via `formatClassName`.
- **Fitur Event Attendance** — section baru "Event attendance" di kolom kiri, badge ringkasan jumlah Attend/Absent, list per event (tanggal, jenis, nama event, status).
  - CSV baru `CSV_EVENT_ATTENDANCE` (`gid=191479940`), diproses oleh `processEventAttendance(rawData, nameMap)`, diurutkan terlama ke terbaru.
  - Access gate `canSeeEventAttendance(teacherNick)`: GJ lihat punya sendiri, direct manager & super admin lihat semua.

### Changed
- Tabel **Stickiness index per slot** sekarang scrollable (`maxHeight: 180px`) dengan border, begitu juga list **Live class issues** (`maxHeight: 220px`), agar layout kolom kiri tidak melebar saat data banyak.
- Counter `tryFinish` loading state disesuaikan mengikuti penambahan fetch paralel baru (CSV + Supabase `teacher_utilization`, lalu `CSV_EVENT_ATTENDANCE`).
- Urutan email di `SUPER_ADMIN_EMAILS` dirapikan; `tyas.ahadriansya@colearn.id` dihapus dari daftar super admin.

## [0.2.0] - 2026-06-16
### Added
- **Fitur Observation Assignment** — penugasan observasi kelas untuk GJ Level 3 & 4.
  - CSV baru `CSV_ASSIGNMENT_OBSERVASI` (`gid=1134271417`) di-fetch paralel bersama CSV lainnya via Papaparse.
  - Fungsi `processObservationAssignment(rows, nameMap)`: group by observer nick name, sort deadline descending. Normalisasi nama observer dengan strip karakter `'` sebelum lookup ke `nameMap` (menangani mismatch "A'yuna" vs "Ayuna").
  - Access gate baru `canSeeObservationAssignment(teacherNick)`: hanya GJ itu sendiri, direct manager-nya, atau super admin yang bisa melihat — POD/STEM/Science Lead yang bukan direct manager tidak bisa.
  - KPI card **Observation Assignment** (donut 3 segmen: On Time hijau, Late merah, Not Yet abu) ditampilkan full-width sejajar dengan Slot Performance dan Observation Result.
    - Persentase On Time di tengah donut, legend 3 baris di samping.
    - Empty state: `"Tidak ada assignment"` untuk GJ level 1–2 (tidak mendapat penugasan), `"Belum ada assignment"` untuk GJ level 3–4 (belum ada data).
  - Modal `ObservationAssignmentModal`: list assignment diurutkan terbaru ke terlama, badge status berwarna (On Time / Late / Not Yet), link class recording (fallback "Belum tersedia").
  - Supabase fetch `v_users_full` ditambah kolom `level` untuk menentukan teks empty state per teacher.

### Changed
- **Layout teacher detail** (manager view & GJ view): 3 KPI card (Slot Performance, Observation Result, Observation Assignment) kini ditampilkan **full-width** sejajar di atas, bukan di dalam kolom kiri. Kolom kiri sekarang berisi Stickiness dan Tren saja; kolom kanan tetap (Riwayat Observasi, Coaching, Kehadiran, Cuti).
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
