# GJ Performance Dashboard — Scale-Up

Dashboard performa untuk **56 Guru Juara (GJ)** aktif di seluruh grade (SD kelas 4–6, SMP kelas 7–9, SMA kelas 10–12) dan mapel (Matematika & IPA/Science). Scale-up dari versi awal yang hanya mencakup POD 7 SMP Matematika.

Dibangun dengan **React + Vite**, autentikasi via **Firebase Auth (Google)**, data role/akses dari **Supabase**, dan data operasional ditarik dari **Google Sheets** (hasil ETL Apps Script) via **Papaparse**.

Untuk detail arsitektur, tech stack, data pipeline, access control, dan known issues, lihat [ARCHITECTURE.md](./ARCHITECTURE.md). Riwayat perubahan ada di [CHANGELOG.md](./CHANGELOG.md).

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi environment

Buat file `.env` di root project (tidak di-commit) dengan isi:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

> Konfigurasi Firebase di `src/firebase.js` mengarah ke project `gj-performance-dashboard` (terpisah dari project POD 7 production).

### 3. Jalankan dev server
```bash
npm run dev
```

### 4. Build untuk production
```bash
npm run build
```

### 5. Lint
```bash
npm run lint
```

---

## Deployment

Hosting menggunakan **Firebase Hosting** (project `gj-performance-dashboard`), serve dari folder `dist`. Deploy:
```bash
firebase deploy --only hosting
```

---

## Struktur Project

```
src/
├── App.jsx          — Komponen utama: data fetching, access control, routing view
├── App.css          — Styling seluruh dashboard
├── AdminPanel.jsx   — CRUD user_profiles (akses terbatas)
├── Login.jsx        — Halaman login Google
├── Greeting.jsx     — Animasi greeting setelah login
├── firebase.js      — Konfigurasi Firebase Auth (tidak di-commit)
└── supabase.js      — Konfigurasi Supabase client (tidak di-commit)
```

Detail lengkap tiap komponen, alur data, dan klasifikasi akses ada di [ARCHITECTURE.md](./ARCHITECTURE.md).
