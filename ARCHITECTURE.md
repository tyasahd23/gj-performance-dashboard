# ARCHITECTURE.md
## GJ Performance Dashboard — Scale-Up
**Dibuat oleh:** Tyas Ahadriansya (POD Lead, SMP Matematika)
**Last updated:** Juni 2026

---

## 1. Gambaran Umum

Dashboard performa untuk **56 Guru Juara (GJ)** aktif di seluruh grade (SD kelas 4–6, SMP kelas 7–9, SMA kelas 10–12) dan mapel (Matematika & IPA/Science). Merupakan scale-up dari versi awal yang hanya mencakup POD 7 SMP Matematika.

```
Google Sheets (data operasional)
        |
        ▼ Google Apps Script (ETL Pipeline)
Target Spreadsheet (13ZyYZv3udZuwWbwXvkgwI2Oi6YzqtDrShx4dLEahnF0)
  ├── sheet: cuti
  ├── sheet: coaching
  ├── sheet: observasi
  └── sheet: name_map
        │
        ▼ Published CSV (Papaparse)
React + Vite (Frontend)
        │
        ▼ Firebase Auth + Hosting
User (GJ / POD Lead / STEM Lead / Science Lead / Super Admin)
```

---

## 2. Tech Stack

| Teknologi | Fungsi |
|---|---|
| React + Vite | Framework frontend |
| Firebase Authentication | Login Google (email CoLearn) |
| Firebase Hosting | Deploy (`gj-performance-dashboard`) |
| Supabase (PostgreSQL) | Data user, role, akses — `v_users_full`, `user_profiles` |
| Google Sheets | Sumber data operasional utama |
| Google Apps Script | ETL pipeline: sync data ke target sheet |
| Papaparse | Fetch & parse CSV dari Google Sheets |
| Recharts | Line chart tren stickiness |

---

## 3. Struktur File

```
src/
├── App.jsx          — Komponen utama: data fetching, access control, routing view
├── App.css          — Styling seluruh dashboard (design token system)
├── AdminPanel.jsx   — CRUD user_profiles (akses terbatas)
├── Login.jsx        — Halaman login Google
├── Greeting.jsx     — Animasi greeting setelah login
├── firebase.js      — Konfigurasi Firebase Auth (tidak di-commit)
└── supabase.js      — Konfigurasi Supabase client (tidak di-commit)

public/
└── favicon.png      — Logo CoLearn
```

---

## 4. Data Pipeline (Google Apps Script)

Semua script berjalan container-bound di **target spreadsheet**
(`13ZyYZv3udZuwWbwXvkgwI2Oi6YzqtDrShx4dLEahnF0`).

### 4.1 Sheet `cuti`
- **Script:** `copyDataToTarget_v2.gs`
- **Source:** Semester 2 (2025–2026) — ID `1UJZwoHo9ITN4F37RRkY22YPWub61GOo6zqWUn3WAlaE`
- **Trigger:** Daily, jam 08:00 WIB (`setupTriggerCuti`)
- **Schema (9 kolom):**
  `date, time, teacher_name, replace_by, course_grade, slot_name, class_rules, reason, note`
- **Deduplication:** Composite key 8 field (exclude `time` — bug timezone serial number)

### 4.2 Sheet `coaching`
- **Script:** `copyCoachingData.gs`
- **Source:** Master FORM — ID `19BaHqkDmQ4nt4wi1M10i65AfR4geauTrrSIV0trjN6s`
- **Trigger:** Daily,jam 08:00 WIB `copyCoachingData`
- **Deduplication:** Composite key 4 field: `dateCoaching|teacher|tanggalKelas|slotName`

### 4.3 Sheet `observasi`
- **Script:** `tarikData()` — dikelola Fatah Abdul
- **Source:** Master — ID `1uGAW_CdEPskIZux7eaomt2C7x8xcM7kMwej03mPU84Q`
- **Mekanisme:** Incremental sync via `LAST_SYNCED_ROW` property

### 4.4 Sheet `name_map`
- **Script:** `syncNameMap()`
- **Source:** POD LIST — ID `1PX4vKSuiJ-mUI6-_qr13DgzDRN9yLMsqmBmMIys56vk`
  (Col A = Display Name / full name, Col C = Nick Name)
- **Tujuan:** Mapping `full_name → nick_name` karena sheet operasional pakai full name,
  sedangkan stickiness & Supabase pakai nick name
- **GID tab:** `1915278661`
- **Catatan:** Pendekatan CSV (bukan GAS Web App endpoint) dipilih karena cold start
  endpoint ~10 detik tidak acceptable untuk dashboard load

---

## 5. Supabase

**URL:** lihat `.env` → `VITE_SUPABASE_URL`
**Dikelola oleh:** Imam Fachrudin

### Tabel & View Utama

**`user_profiles`** — data role dan akses GJ
```
email, full_name, nick_name, url_photo, level, role, main_pod, direct_manager_email
```

**`v_users_full`** — view gabungan auth + profiles
Digunakan untuk: sidebar photo map, teacher profile strip di header, access control,
dropdown direct manager di AdminPanel.

### Catatan Penting
- `full_name` di Supabase di-derive dari email → **tidak reliable** untuk nama 3+ kata.
  Gunakan `name_map` CSV sebagai source of truth untuk name matching.
- **Known issue:** `user_profiles` terhapus harian akibat `ON DELETE CASCADE`
  pada `user_profiles_user_id_fkey` + daily truncate+insert sync dari Metabase.
  **Fix yang diperlukan (Imam):** Drop foreign key constraint agar `user_profiles` persist independen.

---

## 6. React — Alur Data

```
loadAll() dipanggil saat Dashboard mount
│
├── Papa.parse(CSV_NAMEMAP)      → nameMap {}
├── Papa.parse(CSV_STICKINESS)   → processStickiness() → stickinessData
├── Papa.parse(CSV_OBSERVASI)    → processObservasi(nameMap) → observasiData
├── Papa.parse(CSV_CUTI)         → processCuti / processKelasDitinggal / processMembantuPiket
├── Papa.parse(CSV_COACHING)     → processCoaching(nameMap) → coachingData
└── supabase.from("v_users_full") → photoMapData + teacherProfiles
```

Semua fetch berjalan paralel; `setLoading(false)` dipanggil setelah semua 5 selesai via counter `tryFinish()`.

### CSV URLs (dari target spreadsheet, published)
| Key | GID |
|---|---|
| CSV_STICKINESS | `0` |
| CSV_OBSERVASI | `485635753` |
| CSV_CUTI | `1751476240` |
| CSV_COACHING | `1523639724` |
| CSV_NAMEMAP | `1915278661` |

---

## 7. Access Control

Login via Firebase Auth (Google), kemudian profil di-fetch dari `v_users_full`.

### Role & Akses

| Role | Level | Dapat Melihat |
|---|---|---|
| GJ | L1/L2 | Data diri sendiri saja |
| Direct Manager | L3/L4 | Semua kelas semua direct report-nya (tanpa filter mapel/grade) |
| POD Lead | L3 | Matematika/Persiapan di grade-nya sendiri |
| Science Lead | L4 | IPA/Fisika/Kimia/Fisika dan Kimia di semua grade |
| STEM Lead | L4 | Matematika/Persiapan di jenjangnya (SD=4–6, SMP=7–9, SMA=10–12) |
| SUPER_ADMIN | — | Semua data, semua guru, bypass semua filter |

**Super Admin emails:** `imam.fachrudin@`, `fatah.abdul@`, `anatasya.ellena@` (CoLearn)

**Admin panel emails** (tambahan): `tyas.ahadriansya@` (CoLearn)

### Klasifikasi Mapel
```
"Matematika", "Matematika Lanjut", "Persiapan SMP", "Persiapan SMA"  → matematika
"IPA", "Fisika", "Kimia", "Fisika dan Kimia"                         → science
```

### Fungsi kunci
- `canSeeClassForTeacher(teacherNick, courseGrade, slotName)` — per-row filter
- `classifySubject(slotName)` — klasifikasi mapel
- `getJenjang(grade)` — SD / SMP / SMA dari nomor grade

---

## 8. Komponen UI

### Views (dikendalikan `activeView`)
| State | Konten |
|---|---|
| `"overview"` | Overview heatmap per guru + KPI cards + Guru Aman banner |
| `"teacher"` | Detail satu GJ (stickiness, observasi, coaching, cuti, kehadiran) |
| `"admin"` | AdminPanel CRUD (akses terbatas) |

### Komponen Utama
- **`Overview`** — heatmap streak per minggu, Guru Aman collapsible banner, KPI cards (status badge design)
- **`AdminPanel`** — user table, search/filter, pagination 10 rows/page, edit modal, upsert ke `user_profiles`
- **`ObsModal`** — detail observasi (critical score, important score, need improvement, catatan)
- **`CoachingModal`** — detail coaching: variasi badge biru ("Berdasarkan Hasil Observasi") / kuning ("Berdasarkan Temuan")
- **`KelasDitinggalModal`** / **`MembantuPiketModal`** — riwayat kehadiran
- **`CutiBar`** — progress bar cuti dengan tooltip tanggal, badge "Hampir Batas"
- **`GuruAmanBanner`** — collapsible list guru tanpa kelas below average; klik nama → navigate ke teacher view

### Header Sub-row
Strip animasi di bawah header (visible saat `activeView === "teacher"`):
menampilkan nick name + role badge + pod + direct manager dari `teacherProfiles` state.

---

## 9. Deployment

| Item | Detail |
|---|---|
| Firebase project | `gj-performance-dashboard` (terpisah dari POD 7 production) |
| Hosting URL | *(pending — belum final)* |
| POD 7 lama | `gj-performance-dashboard-pod-7.web.app` |

---

## 10. Pending / Belum Selesai

| Item | PIC | Keterangan |
|---|---|---|
| GitHub repo scale-up | Tyas | `git init`, `.gitignore` (exclude `.env`/credentials), push ke private repo |
| Handoff ke teacher portal Imam | Tyas + Imam | Pendekatan embedded vs iframe/subdomain belum diputuskan |
| `tanggal_kelas` di observasi pipeline | Fatah | Kolom tambahan yang diusulkan Fatah — belum final |
| Full launch | — | Target: 22 Juni 2026 |

---

## 11. Key Learnings & Gotchas

- **Google Sheets time serial number bug:** `setValue()` menyimpan string waktu sebagai serial number internal; `getValues()` mengembalikan objek Date yang mengalami timezone shift. Fix: hapus `time` dari composite key, atau gunakan `Utilities.formatDate(val, getSpreadsheetTimeZone(), "HH:mm")`.
- **Trigger naming collision:** Beberapa script dalam satu Apps Script project bisa konflik nama fungsi. Gunakan nama deskriptif unik (contoh: `setupTriggerCuti`).
- **GAS Web App cold start:** ~10 detik setelah idle 5+ menit — tidak acceptable untuk dashboard load. Gunakan CSV-from-sheet via Papaparse.
- **React fetch GAS endpoint:** Wajib `redirect: "follow"`.
- **`full_name` Supabase tidak reliable:** Di-derive dari email; gagal untuk nama 3+ kata. Gunakan POD LIST sheet sebagai source of truth.
- **`ON DELETE CASCADE` risk:** Foreign key cascade bisa menghapus `user_profiles` saat upstream melakukan truncate+insert.
- **Nick name vs full name mismatch:** Stickiness pakai nick name; coaching/observasi/cuti pakai full name. Name mapping adalah cross-cutting concern yang harus konsisten di semua data processor.
- **Batch `setValues()` wajib:** Untuk performa di skala 56 GJ — jangan pakai individual `setValue()` di dalam loop.