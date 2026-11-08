# SIGNAL CASPER ACADEMY — SPRINT 4 DATA DICTIONARY
## Existing Database Schema & Backward-Compatible Sprint 4 Extensions

**Sumber Kebenaran Database:** [`data/academy.json`](file:///d:/Developer/Web%20Casper%20Signal/data/academy.json) dikelola oleh [`lib/db.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/db.ts)

---

## 1. Koleksi Eksisting di `data/academy.json`

### 1.1 `users` (`DbUser[]`)
| Field | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `string` | UUID unik pengguna. |
| `email` | `string` | Email pengguna (unik, huruf kecil). |
| `name` | `string` | Nama tampilan pengguna. |
| `password_hash` | `string` | Hash kata sandi (`scrypt$...` atau `bcrypt`). Tidak pernah diekspos ke API. |
| `role` | `string` | `"USER"` (Siswa), `"MENTOR"`, `"ADMIN"`, atau `"MASTER_ADMIN"`. |
| `created_at` | `string` | Timestamp ISO-8601 pembuatan akun. |
| `updated_at` | `string` | Timestamp ISO-8601 pembaruan terakhir akun. |

### 1.2 `course_progress` (`DbCourseProgress[]`)
| Field | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `string` | ID unik baris progres. |
| `user_id` | `string` | Referensi ke `users.id`. |
| `course_slug` | `string` | Slug kelas (contoh: `"market-structure"`). |
| `completed_lesson_ids` | `string` | JSON string dari `string[]` berisi ID pelajaran yang telah diselesaikan. |
| `quiz_scores` | `string` | JSON string dari `Record<string, number>` berisi skor tertinggi per `lessonId` (0–100). |
| `last_lesson_id` | `string \| null` | ID pelajaran terakhir yang diakses/diselesaikan. |
| `started_at` *(Opsional, Sprint 4)* | `string \| undefined` | Timestamp ISO-8601 saat siswa pertama kali memulai kelas. Jika tidak ada pada record lama, dinormalisasi dari event pertama atau `updated_at`. |
| `completed_at` *(Opsional, Sprint 4)* | `string \| null \| undefined` | Timestamp ISO-8601 saat seluruh pelajaran & kuis wajib pada kelas lulus 100%. |
| `updated_at` | `string` | Timestamp ISO-8601 pembaruan terakhir. |

### 1.3 `quiz_submissions` (`DbQuizSubmission[]`)
| Field | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `string` | UUID unik pengumpulan kuis. |
| `user_id` | `string` | Referensi ke `users.id`. |
| `course_slug` | `string` | Slug kelas tempat kuis berada. |
| `lesson_id` | `string` | ID pelajaran tempat kuis berada. |
| `score` | `number` | Skor kuis (0–100) yang dihitung di server. |
| `answers` | `string` | JSON string dari `Record<string, number>` (`questionId -> selectedOptionIndex`). |
| `created_at` | `string` | Timestamp ISO-8601 saat kuis dikumpulkan. |

### 1.4 `custom_courses` (`Record<string, unknown>[]`, Opsional)
Menyimpan kelas kustom baru maupun *copy-on-write override* untuk kelas statis `c1`–`c9`. Memiliki atribut `status` (`"published"` | `"draft"` | `"archived"`), `order`, `modules`, dan `lessons`.

### 1.5 `admin_audit_logs` (`DbAdminAuditLog[]`, Opsional)
Menyimpan riwayat mutasi kurikulum dan peran pengguna oleh Administrator (maksimal 200 entri terbaru).

---

## 2. Ekstensi Skema Baru Sprint 4 (100% Backward-Compatible)

Koleksi baru ditambahkan sebagai properti opsional pada `DatabaseSchema` di [`lib/db.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/db.ts). Database lama yang belum memiliki properti ini tetap lulus `isValidDatabaseSchema` dan dinormalisasi secara aman dengan array kosong `[]`.

### 2.1 `learning_events` (`DbLearningEvent[]`, Opsional)
Mencatat kejadian belajar esensial yang dihasilkan oleh server (tanpa pelacakan invasif seperti keystroke, riwayat halaman penuh, atau fingerprint perangkat).

| Field | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `string` | ID unik event (`evt_<timestamp>_<random>`). |
| `user_id` | `string` | ID siswa yang terautentikasi di server. |
| `event_type` | `LearningEventType` | Salah satu dari: `"COURSE_STARTED"`, `"LESSON_STARTED"`, `"LESSON_COMPLETED"`, `"QUIZ_SUBMITTED"`, `"COURSE_COMPLETED"`. |
| `course_id` | `string` | ID stabil kelas (contoh: `"c1"`). |
| `course_slug` | `string` | Slug kelas (contoh: `"trading-fundamentals"`). |
| `module_id` | `string \| null` | ID modul terkait (jika relevan). |
| `lesson_id` | `string \| null` | ID pelajaran terkait (jika relevan). |
| `score` | `number \| null` | Skor kuis (0–100) khusus untuk `"QUIZ_SUBMITTED"`, selain itu `null`. |
| `created_at` | `string` | Timestamp ISO-8601 yang dihasilkan oleh server. |
| `schema_version` | `1` | Versi skema event (`1`). |

**Aturan Idempotensi, Deduplikasi & Retensi:**
- `COURSE_STARTED`: Maksimal 1 kali per `(user_id, course_slug)`.
- `LESSON_COMPLETED`: Tidak menduplikasi event jika pelajaran sudah berstatus selesai pada `course_progress` sebelumnya, atau jika event identik tercatat dalam jendela 60 detik terakhir.
- `LESSON_STARTED`: Dide-duplikasi per `(user_id, course_slug, lesson_id)` pada tanggal UTC yang sama (`YYYY-MM-DD`) agar refresh halaman tidak menggandakan event.
- `COURSE_COMPLETED`: Maksimal 1 kali per `(user_id, course_slug)` ketika transisi penyelesaian kelas mencapai 100% lulus.
- **Batas Retensi:** Maksimal `10.000` event terbaru disimpan di `db.learning_events` (dan otomatis dibersihkan saat user dihapus melalui `deleteUserById`).

### 2.2 `recommendation_dismissals` (`DbRecommendationDismissal[]`, Opsional)
Menyimpan preferensi siswa yang menyembunyikan sementara rekomendasi tertentu, dengan kunci bukti (*evidence hash*) agar rekomendasi otomatis muncul kembali bila bukti dasarnya berubah.

| Field | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `string` | ID unik dismissal. |
| `user_id` | `string` | ID siswa pemilik rekomendasi. |
| `recommendation_id` | `string` | ID stabil rekomendasi (contoh: `"rec_continue_c3"`). |
| `evidence_signature` | `string` | Tanda tangan ringkas kondisi bukti saat di-dismiss (contoh: `"lessons:2/6|quiz:none"`). Jika progres berubah, tanda tangan tidak lagi cocok sehingga rekomendasi aktif kembali. |
| `dismissed_at` | `string` | Timestamp ISO-8601 server saat di-dismiss. |

---

## 3. Struktur Pemetaan Topik Kuis (Topic Mapping)

Karena setiap pelajaran (`Lesson`) berada di dalam sebuah modul (`CourseModule`) dan kursus (`Course` dengan `category`), pemetaan topik dilakukan secara deterministik melalui 2 tingkat yang selalu tersedia di silabus:
1. **Topik Modul (`moduleId` / `moduleTitle`):** Mengelompokkan seluruh kuis (baik kuis latihan inline maupun evaluasi wajib `type === "quiz"`) berdasarkan modul kurikulum tempat pelajaran berada.
2. **Kategori Kompetensi (`course.category`):** Mengelompokkan penguasaan lintas kelas ke dalam 5 pilar kompetensi Signal Casper Academy (`Trading Foundation`, `Technical Analysis`, `Market Structure`, `Risk & Psychology`, `Specialized Asset`).

