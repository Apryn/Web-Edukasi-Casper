# SIGNAL CASPER ACADEMY — SPRINT 4 ANALYTICS SPECIFICATION
## Mathematical Formulas, Cohorts, Denominators, States & Recommendation Rules

---

## 1. Prinsip Umum & Status Ketersediaan Data

Setiap metrik menggunakan status eksplisit:
- `NO_DATA`: Denominator $= 0$ atau belum ada aktivitas/percobaan sama sekali. Nilai persentase/rata-rata direpresentasikan sebagai `null` (bukan `0%` palsu).
- `INSUFFICIENT_DATA`: Data ada ($> 0$), tetapi belum memenuhi ambang batas minimum kepercayaan statistik (misal $< 2$ percobaan untuk tren peningkatan topik, atau kohort siswa $< 3$ untuk pemecahan detail admin).
- `AVAILABLE`: Denominator valid dan memenuhi syarat perhitungan.

**Aturan Pembulatan:**
- Seluruh persentase dan skor rata-rata dibulatkan ke 1 desimal (`Math.round(val * 10) / 10`) untuk metrik analitik detail, dan ke bilangan bulat terdekat (`Math.round`) untuk bar progres kursus sesuai [`calculateCoursePercentage`](file:///d:/Developer/Web%20Casper%20Signal/lib/progress.ts#L601-L605), dengan batas atas ketat $\le 100\%$.

---

## 2. Rumus Student Learning Progress Intelligence

### 2.1 Kurikulum yang Memenuhi Syarat (*Eligible Published Courses*)
Hanya kursus dengan `status === "published"` (default untuk `SC-01` s/d `SC-09`) yang masuk ke dalam himpunan kursus tersedia $\mathcal{C}_{\text{pub}}$.
- Kursus berstatus `draft` atau `archived` **dikecualikan** dari $\mathcal{C}_{\text{pub}}$ agar tidak menurunkan persentase penyelesaian siswa.
- Jika siswa memiliki riwayat progres pada kursus yang kemudian diubah menjadi `archived`, riwayat tersebut tetap disimpan dan dilaporkan secara terpisah di `archivedCourseHistory` tanpa merusak denominator $\mathcal{C}_{\text{pub}}$.

### 2.2 Metrik Progres Keseluruhan Siswa
Misalkan $\mathcal{C}_{\text{pub}}$ adalah himpunan kursus `published` dengan $\text{totalLessons}(c) > 0$:
- **Total Published Courses ($N_{\text{courses}}$):** $|\mathcal{C}_{\text{pub}}|$
- **Total Available Lessons ($L_{\text{avail}}$):** $\sum_{c \in \mathcal{C}_{\text{pub}}} \text{totalLessons}(c)$
- **Course Started ($c \in \mathcal{C}_{\text{started}}$):** Kursus $c \in \mathcal{C}_{\text{pub}}$ di mana siswa memiliki baris `course_progress` ATAU minimal 1 `quiz_submission` ATAU minimal 1 `learning_event`.
- **Course Completed ($c \in \mathcal{C}_{\text{completed}}$):** Kursus $c \in \mathcal{C}_{\text{pub}}$ di mana evaluasi otoritatif [`evaluateCourseCompletion(c, progress)`](file:///d:/Developer/Web%20Casper%20Signal/lib/progress.ts#L618-L688) menghasilkan `isComplete === true && allQuizzesPassed === true`.
- **Courses In Progress ($N_{\text{in\_progress}}$):** $|\mathcal{C}_{\text{started}} \setminus \mathcal{C}_{\text{completed}}|$
- **Courses Not Started ($N_{\text{not\_started}}$):** $|\mathcal{C}_{\text{pub}} \setminus \mathcal{C}_{\text{started}}|$
- **Lessons Completed ($L_{\text{done}}$):** $\sum_{c \in \mathcal{C}_{\text{pub}}} |\text{validCompletedLessonIds}(c)|$
- **Overall Lesson Completion Rate:**
  $$\text{OverallLessonCompletionRate} = \begin{cases} \text{null} \ (\text{NO\_DATA}) & \text{jika } L_{\text{avail}} = 0 \\ \min\left(100, \text{round}_1\left(\frac{L_{\text{done}}}{L_{\text{avail}}} \times 100\right)\right) & \text{jika } L_{\text{avail}} > 0 \end{cases}$$
- **Started Course Completion Rate:**
  $$\text{StartedCourseCompletionRate} = \begin{cases} \text{null} \ (\text{NO\_DATA}) & \text{jika } |\mathcal{C}_{\text{started}}| = 0 \\ \min\left(100, \text{round}_1\left(\frac{|\mathcal{C}_{\text{completed}}|}{|\mathcal{C}_{\text{started}}|} \times 100\right)\right) & \text{jika } |\mathcal{C}_{\text{started}}| > 0 \end{cases}$$

### 2.3 Metrik Kuis & Penguasaan Topik (*Topic Mastery*)
Untuk setiap siswa, himpunan pengumpulan kuis valid adalah $\mathcal{Q}_{\text{user}}$ (diurutkan berdasarkan `created_at` ascending, lalu `id` ascending):
- **Average Quiz Score (Across Submissions):**
  $$\text{AvgQuizScore} = \begin{cases} \text{null} \ (\text{NO\_DATA}) & \text{jika } |\mathcal{Q}_{\text{user}}| = 0 \\ \text{round}_1\left(\frac{\sum_{q \in \mathcal{Q}_{\text{user}}} q.\text{score}}{|\mathcal{Q}_{\text{user}}|}\right) & \text{jika } |\mathcal{Q}_{\text{user}}| > 0 \end{cases}$$
  Status: `NO_DATA` jika $0$ submission, `INSUFFICIENT_DATA` jika $1 \le |\mathcal{Q}_{\text{user}}| < 2$, `AVAILABLE` jika $|\mathcal{Q}_{\text{user}}| \ge 2$.
- **Per-Topic Mastery (Per Modul / Kategori Kurikulum):**
  Setiap pelajaran berkuis dipetakan secara deterministik ke modul induknya (`moduleId`, `moduleTitle`, `courseSlug`, `category`, `passingScore`, default `70`).
  Untuk setiap topik $T$ dengan percobaan $A_T = [a_1, a_2, \dots, a_k]$:
  - `attemptsCount` $= k$
  - `averageScore` $= \text{round}_1\left(\frac{1}{k}\sum_{i=1}^k a_i.\text{score}\right)$
  - `latestScore` $= a_k.\text{score}$
  - `bestScore` $= \max_{i} a_i.\text{score}$
  - `improvementDelta` $= \begin{cases} \text{null} & \text{jika } k < 2 \\ a_k.\text{score} - a_1.\text{score} & \text{jika } k \ge 2 \end{cases}$
  - **Klasifikasi Penguasaan Topik (`masteryLevel`):**
    - `NO_DATA`: $k = 0$
    - `NEEDS_PRACTICE` (*Weak Topic*): $k \ge 1$ dan (`bestScore` $< \text{passingScore}$ ATAU `averageScore` $< 70$)
    - `DEVELOPING`: `bestScore` $\ge \text{passingScore}$ dan $70 \le \text{averageScore} < 85$
    - `MASTERED`: `bestScore` $\ge \text{passingScore}$ dan `averageScore` $\ge 85$

### 2.4 Metrik Kontinuitas Belajar Siswa (*Learning Continuity*)
Himpunan kejadian aktivitas belajar yang memenuhi syarat (*qualifying learning events*) untuk siswa adalah gabungan tanggal UTC unik (`YYYY-MM-DD`) dari:
1. `db.learning_events` milik siswa (`COURSE_STARTED`, `LESSON_STARTED`, `LESSON_COMPLETED`, `QUIZ_SUBMITTED`, `COURSE_COMPLETED`),
2. `db.quiz_submissions.created_at` milik siswa,
3. `db.course_progress.updated_at` milik siswa.
*(Membuka halaman dashboard saja tidak pernah menghasilkan event aktivitas).*

- `lastActivityAt`: Timestamp ISO-8601 terbaru dari aktivitas valid, atau `null` jika belum pernah belajar.
- `inactiveDays`: $\lfloor (\text{nowMs} - \text{lastActivityMs}) / 86.400.000 \rfloor$ jika `lastActivityAt` tersedia, selain itu `null`.
- `activeDaysLast7d` / `activeDaysLast30d`: Jumlah tanggal UTC unik dengan aktivitas belajar dalam 7 / 30 hari terakhir.
- `currentStreakDays` & `longestStreakDays`: Dihitung hanya jika siswa memiliki riwayat event bertanggal (`status: "AVAILABLE"` bila terdapat $\ge 1$ aktivitas terverifikasi; `"NO_DATA"` bila $0$).

---

## 3. Spesifikasi Adaptive Learning Recommendation Engine

Mesin menghasilkan rekomendasi dari data aktual siswa dan mengurutkannya berdasarkan **Skor Prioritas Deterministik** (0–100), lalu `course.order` ascending, lalu `recommendationId` ascending:

| Urutan Prioritas | Kategori (`type`) | Syarat Pemicu (*Eligibility Rule*) | Skor Prioritas Dasar | Tujuan Aksi (`destination`) |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `RETRY_QUIZ` | Siswa telah mengumpulkan kuis pada suatu pelajaran di kursus `published`, dan `bestScore < passingScore` (belum lulus). | `95` | `/kelas/[slug]?lesson=[lessonId]` |
| **2** | `CONTINUE_LEARNING` | Siswa memiliki kursus `published` yang sudah dimulai namun belum selesai (`0 < completedCount < totalLessons` atau `lastAccessedLessonId` belum selesai). | `90` | `/kelas/[slug]?lesson=[resumeLessonId]` |
| **3** | `REVIEW_WEAK_TOPIC` | Topik memiliki `attemptsCount >= 2` dan `averageScore < 70` (meskipun pernah lulus sekali atau belum lulus). | `84` | `/kelas/[slug]?lesson=[lessonId]` |
| **4** | `RETURN_TO_LEARNING` | Siswa memiliki kursus yang belum selesai dan `inactiveDays >= 7`. | `80` | `/kelas/[slug]?lesson=[resumeLessonId]` |
| **5** | `NEXT_LESSON` | Siswa baru saja menyelesaikan sebuah pelajaran pada kursus aktif dan terdapat pelajaran berikutnya yang belum selesai di silabus kursus tersebut. | `75` | `/kelas/[slug]?lesson=[nextLessonId]` |
| **6** | `START_FOUNDATION` | Siswa belum memulai kursus fondasi pertama (`SC-01: Trading Fundamentals` atau kursus `Beginner` urutan pertama), atau langsung melompat ke kursus lanjutan tanpa menyelesaikan fondasi. | `70` | `/kelas/[foundationSlug]` |
| **7** | `ADVANCE_TO_NEXT_COURSE` | Siswa telah menyelesaikan $\ge 1$ kursus secara penuh (100% + lulus kuis) dan terdapat kursus `published` berikutnya dalam urutan kurikulum yang belum dimulai. | `65` | `/belajar/[nextCourseSlug]` |

**Aturan Anti-Duplikasi & Non-Kontradiksi:**
- Maksimal 5 rekomendasi teratas ditampilkan sekaligus.
- Jika `CONTINUE_LEARNING` dan `NEXT_LESSON` menunjuk ke `(courseSlug, lessonId)` yang persis sama, keduanya digabung menjadi satu rekomendasi `CONTINUE_LEARNING` dengan penjelasan yang mencakup pelajaran berikutnya agar tidak duplikatif.
- Pelajaran yang sudah berstatus selesai (`validCompletedLessonIds`) tidak pernah direkomendasikan sebagai `NEXT_LESSON` atau `CONTINUE_LEARNING`.

---

## 4. Rumus Admin Education Intelligence & Engagement/Retention

### 4.1 Populasi Siswa (`Student Cohort`)
$$\mathcal{U}_{\text{students}} = \{ u \in \text{db.users} \mid u.\text{role} = \text{"USER"} \}$$
Akun dengan `role` `"ADMIN"`, `"MASTER_ADMIN"`, atau `"MENTOR"` **tidak pernah** dimasukkan ke dalam populasi siswa $\mathcal{U}_{\text{students}}$.

### 4.2 Filter Jendela Waktu (`period`: `7d` | `30d` | `90d` | `all`)
Untuk jendela waktu $W$:
- **Total Registered Students:** $|\mathcal{U}_{\text{students}}|$
- **Students Who Started Learning:** $|\{ u \in \mathcal{U}_{\text{students}} \mid u \text{ memiliki progres/kuis/event pada kursus published} \}|$
- **Active Learners in Window ($W$):** $|\{ u \in \mathcal{U}_{\text{students}} \mid u \text{ memiliki } \ge 1 \text{ qualifying learning event dalam } W \}|$

### 4.3 Performa Kursus & Denominator Penyelesaian
Untuk setiap kursus `published` $c$:
- `startedStudentsCount` ($S_c$): Jumlah siswa $u \in \mathcal{U}_{\text{students}}$ yang telah memulai kursus $c$.
- `completedStudentsCount` ($K_c$): Jumlah siswa $u \in \mathcal{U}_{\text{students}}$ yang telah menyelesaikan kursus $c$ (100% pelajaran + kuis wajib lulus).
- `courseCompletionRate`:
  $$\text{CourseCompletionRate}(c) = \begin{cases} \text{null} \ (\text{NO\_DATA}) & \text{jika } S_c = 0 \\ \text{round}_1\left(\frac{K_c}{S_c} \times 100\right) & \text{jika } S_c > 0 \end{cases}$$
  *(Denominator adalah siswa yang memulai kursus $S_c$, **bukan** seluruh akun terdaftar).*

### 4.4 Lesson & Module Progression / Drop-Off
Untuk kursus $c$ dengan urutan pelajaran $l_1, l_2, \dots, l_m$ dan siswa yang memulai kursus $S_c$:
- `reachedCount(l_i)`: Jumlah siswa yang telah menyelesaikan $l_i$, ATAU memiliki `last_lesson_id === l_i`, ATAU memiliki `learning_event` / `quiz_submission` pada $l_i$, ATAU telah menyelesaikan pelajaran setelahnya ($l_j$ dengan $j > i$).
- `completedCount(l_i)`: Jumlah siswa di mana $l_i \in \text{validCompletedLessonIds}$.
- `proceededToNextCount(l_i)`: Untuk $i < m$, jumlah siswa yang menyelesaikan $l_i$ dan telah mencapai/menyelesaikan $l_{i+1}$.
- `notYetProceededRate(l_i)` (*Belum Melanjutkan*):
  $$\text{NotYetProceededRate}(l_i) = \begin{cases} \text{null} & \text{jika } \text{reachedCount}(l_i) = 0 \\ \text{round}_1\left(\frac{\text{reachedCount}(l_i) - \text{completedCount}(l_i)}{\text{reachedCount}(l_i)} \times 100\right) & \text{jika } \text{reachedCount}(l_i) > 0 \end{cases}$$
  Menggunakan istilah netral **"Belum Melanjutkan"** (*Not Yet Proceeded*), bukan klaim sepihak bahwa siswa berhenti permanen.

### 4.5 Quiz & Question Difficulty Intelligence
Untuk setiap pertanyaan kuis $q$ pada kursus `published`:
- Menghitung jumlah jawaban benar dan total percobaan dari `db.quiz_submissions.answers` milik siswa $u \in \mathcal{U}_{\text{students}}$.
- **Ambang Kepercayaan Sampel Soal:**
  - Jika total percobaan soal $< 3$: `difficultyStatus = "INSUFFICIENT_SAMPLE"` (tidak dilabeli "sulit" atau "buruk" pada sampel kecil).
  - Jika total percobaan $\ge 3$:
    - `successRate < 50%` -> `"HIGH_DIFFICULTY"`
    - `50% <= successRate < 75%` -> `"MODERATE_DIFFICULTY"`
    - `successRate >= 75%` -> `"WELL_UNDERSTOOD"`

### 4.6 Retensi Berbasis Kohort & Perlindungan Kohort Kecil
- **Definisi Kohort Retensi:** Siswa dikelompokkan berdasarkan minggu ISO (`YYYY-Www`) dari **aktivitas belajar pertama mereka** ($t_{\text{first}}$).
  - **Returned in Day 1–7 / Next Period:** Siswa dalam kohort tersebut yang memiliki aktivitas belajar valid pada tanggal berbeda setelah tanggal aktivitas pertama ($\text{date}(t_{\text{later}}) > \text{date}(t_{\text{first}})$).
- **Ambang Perlindungan Kohort Kecil (`MIN_SAFE_COHORT_SIZE = 3`):**
  - Jika jumlah siswa aktif pada suatu breakdown sub-kelompok $< 3$, sistem menyertakan flag `smallCohortProtected: true` dan menekan rincian distribusi per-individu agar tidak dapat digunakan untuk mengidentifikasi siswa tunggal dari tabel agregat.

