# SIGNAL CASPER ACADEMY — SPRINT 4 PRIVACY & ACCESS MATRIX
## Role Authorization, Private Journal Isolation & Small-Cohort Protection

---

## 1. Prinsip Privasi Inti Sprint 4

1. **Zero Private Trading Journal Access in Learning Intelligence:**
   - Seluruh endpoint `/api/learning/*` dan `/api/admin/learning-intelligence/*` **dilarang** membaca file di `data/journals/`, tidak mengakses `TradingAccount`, `TradeRecord`, `CashTransaction`, `netPnl`, `initialBalance`, maupun `StudentConsent`.
   - Tidak ada korelasi atau penggabungan antara hasil kuis/progres belajar dengan profitabilitas atau kerugian trading siswa.
2. **Zero Client-Supplied Identity Trust:**
   - Endpoint siswa (`/api/learning/*`) selalu mengambil `userId` dari sesi JWT server (`getSessionUser(req)`). Jika request menyertakan `?userId=` atau `body.userId` milik pengguna lain, server menolak dengan `HTTP 403 Forbidden`.
3. **Zero Quiz Answer Key Leakage:**
   - Endpoint siswa dan publik tidak pernah mengembalikan `correctAnswer` atau `explanation` untuk kuis yang belum dikumpulkan. Bahkan pada endpoint Admin Quiz Intelligence, hanya teks pertanyaan, distribusi keberhasilan, dan statistik agregat yang dikembalikan—bukan kunci jawaban mentah.
4. **Small Cohort Protection (`MIN_SAFE_COHORT_SIZE = 3`):**
   - Pada Admin Education Intelligence, apabila jumlah siswa yang memulai seluruh akademi atau suatu sub-kelompok $< 3$, flag `smallCohortProtected: true` diaktifkan dan rincian yang berpotensi mengidentifikasi individu disamarkan/digabungkan.

---

## 2. Matriks Otorisasi Endpoint Sprint 4

| Endpoint | HTTP Method | Unauthenticated | Student (`USER` — Own Data) | Student (`USER` — Other `userId`) | `MENTOR` | `ADMIN` / `MASTER_ADMIN` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/api/learning/dashboard` | `GET` | `401 Unauthorized` | `200 OK` (Hanya data sendiri) | `403 Forbidden` | `200 OK` (Hanya progres belajar milik akun mentor sendiri; `403` jika meminta `userId` siswa) | `200 OK` (Hanya progres akun admin sendiri jika tanpa `userId`; `403` jika meminta `userId` siswa di endpoint siswa) |
| `/api/learning/recommendations` | `GET` | `401 Unauthorized` | `200 OK` (Hanya rekomendasi sendiri) | `403 Forbidden` | `200 OK` (Diri sendiri) / `403` (Siswa lain) | `200 OK` (Diri sendiri) / `403` (Siswa lain) |
| `/api/learning/recommendations` | `POST` (Dismiss / Restore) | `401 Unauthorized` | `200 OK` (Hanya milik sendiri) | `403 Forbidden` | `200 OK` (Diri sendiri) / `403` (Siswa lain) | `200 OK` (Diri sendiri) / `403` (Siswa lain) |
| `/api/learning/progress` | `GET` | `401 Unauthorized` | `200 OK` (Progres & topik sendiri) | `403 Forbidden` | `200 OK` (Diri sendiri) / `403` (Siswa lain) | `200 OK` (Diri sendiri) / `403` (Siswa lain) |
| `/api/learning/activity` | `GET` / `POST` | `401 Unauthorized` | `200 OK` / `201 Created` (Diri sendiri) | `403 Forbidden` | `200 OK` (Diri sendiri) / `403` (Siswa lain) | `200 OK` (Diri sendiri) / `403` (Siswa lain) |
| `/api/admin/learning-intelligence/overview` | `GET` | `401 Unauthorized` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `200 OK` (Agregat Pendidikan) |
| `/api/admin/learning-intelligence/courses` | `GET` | `401 Unauthorized` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `200 OK` (Agregat Performa Kursus) |
| `/api/admin/learning-intelligence/lessons` | `GET` | `401 Unauthorized` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `200 OK` (Agregat Drop-Off Materi) |
| `/api/admin/learning-intelligence/quizzes` | `GET` | `401 Unauthorized` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `200 OK` (Agregat Evaluasi Kuis) |
| `/api/admin/learning-intelligence/engagement` | `GET` | `401 Unauthorized` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `200 OK` (Agregat Engagement & Retensi) |

---

## 3. Perbandingan Batas Akses: Education Intelligence vs Journal Intelligence

| Aspek | Admin Education Intelligence (Sprint 4) | Admin Journal Intelligence (Sprint 3) | Private Student Trading Journal (Sprint 3) |
| :--- | :--- | :--- | :--- |
| **Sumber Data** | `data/academy.json` (`users`, `course_progress`, `quiz_submissions`, `learning_events`) | Metadata partisi `data/journals/u_*.json` (tanpa P/L & tanpa catatan) | `data/journals/u_<studentId>.json` |
| **Akses `ADMIN` / `MASTER_ADMIN`** | **Diizinkan** (Agregat pendidikan & kurikulum) | **Diizinkan** (Agregat adopsi & psikologi anonim) | **DITOLAK (`403 Forbidden`)** |
| **Akses `MENTOR`** | **Ditolak (`403 Forbidden`)** | **Ditolak (`403 Forbidden`)** | Hanya jika siswa memberikan `StudentConsent` aktif |
| **Akses `USER` (Siswa)** | **Ditolak (`403 Forbidden`)** | **Ditolak (`403 Forbidden`)** | Hanya pemilik jurnal (`actor.id === ownerId`) |

