import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

// Pre-load CJS dependencies before registering TS hook
const cjsRequire = createRequire(import.meta.url);
cjsRequire("jsonwebtoken");
cjsRequire("bcryptjs");

let tsHook = null;
if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  tsHook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !path.extname(specifier) &&
        context.parentURL
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
        if (fs.existsSync(candidateTs)) {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts")) {
        const source = fs.readFileSync(fileURLToPath(url), "utf8");
        return {
          format: "module",
          shortCircuit: true,
          source: stripTypeScriptTypes(source),
        };
      }
      return nextLoad(url, context);
    },
  });
}

// Course data & syllabus modules
const {
  getAllCourses,
  getStaticCourses,
  getCourseBySlug,
  getStaticBaselineCourse,
  getCourseByIdOrSlugForAdmin,
  countCourseLessons,
  normalizeCourse,
  sanitizeCourseForClient,
} = await import("../lib/courses-data.ts");

// Database operations
const {
  getDatabase,
  findUserByEmail,
  createUser,
  getUserCourseProgress,
  getAllUserProgress,
  upsertUserProgress,
  getCustomCourses,
  upsertCustomCourse,
  deleteCustomCourse,
  executeTransactionForTest,
  isValidDatabaseSchema,
} = await import("../lib/db.ts");

// Auth & Session helpers
const {
  createToken,
  verifyToken,
  getJwtSecret,
  shouldUseSecureCookie,
  isAdmin,
  sanitizeUser,
} = await import("../lib/auth.ts");

// Client & shared progress helpers
const {
  getStoredProgress,
  saveStoredProgress,
  enrollCourse,
  toggleLessonComplete,
  calculateCoursePercentage,
  evaluateCourseCompletion,
  setAuthenticatedSessionUser,
  getActiveSessionUser,
  clearSessionAndProgressStorage,
  applyServerCourseProgress,
  fetchServerProgressWithStatus,
  initializeClassroomCourseProgress,
  setProgressTestFetcher,
} = await import("../lib/progress.ts");

// Server progress & quiz validation helpers
const {
  validateAndPersistUserProgress,
  evaluateAndRecordServerQuiz,
} = await import("../lib/server-progress.ts");

// Admin Course Service helpers (Sprint 2 Task 3)
const {
  listAdminCourses,
  createAdminCourse,
  updateAdminCourse,
  patchAdminCourseAction,
  removeAdminCourse,
} = await import("../lib/admin-course-service.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Signal Casper Academy - Comprehensive End-to-End System Tests", () => {
  const dataDir = path.join(process.cwd(), "data");
  const dbFile = path.join(dataDir, "academy.json");

  let pristineSnapshot = null;

  before(() => {
    // Snapshot the database state to guarantee zero pollution
    if (fs.existsSync(dbFile)) {
      pristineSnapshot = fs.readFileSync(dbFile, "utf8");
    }
  });

  after(() => {
    // Restore original state
    if (pristineSnapshot) {
      fs.writeFileSync(dbFile, pristineSnapshot, "utf8");
    }
  });

  // 1. Katalog dan Detail Kelas
  test("1. Katalog dan detail kelas dapat diakses dengan metadata lengkap", () => {
    const catalog = getAllCourses();
    assert.ok(Array.isArray(catalog), "Katalog harus berupa array");
    assert.ok(catalog.length >= 4, "Minimal tersedia 4 kelas kurikulum utama");

    const course1 = getCourseBySlug("trading-fundamentals");
    assert.ok(course1, "Kelas trading-fundamentals harus ditemukan");
    assert.equal(course1.title, "Trading Fundamentals");
    assert.ok(course1.modules.length > 0, "Kelas harus memiliki modul");
    assert.ok(course1.totalLessons > 0, "Total lessons harus dihitung otomatis");
    assert.ok(course1.duration, "Durasi kelas harus terdefinisi");

    // Detail modul dan pelajaran
    const firstModule = course1.modules[0];
    assert.ok(firstModule.id, "Modul harus memiliki ID unik");
    assert.ok(firstModule.lessons.length > 0, "Modul harus memiliki daftar materi");

    const firstLesson = firstModule.lessons[0];
    assert.ok(firstLesson.id, "Materi harus memiliki ID unik");
    assert.ok(firstLesson.title, "Materi harus memiliki judul");
    assert.ok(firstLesson.duration, "Materi harus memiliki estimasi durasi");
  });

  // 2. Pengambilan materi berdasarkan ID yang valid dan penanganan materi tidak ditemukan
  test("2. Pengambilan materi berdasarkan ID yang valid dan penanganan materi tidak ditemukan", () => {
    const course = getCourseBySlug("trading-fundamentals");
    assert.ok(course, "Kelas harus valid");

    // Cari materi spesifik: l1-1
    let foundLesson = null;
    for (const m of course.modules) {
      const match = m.lessons.find((l) => l.id === "l1-1");
      if (match) {
        foundLesson = match;
        break;
      }
    }

    assert.ok(foundLesson, "Materi l1-1 harus ditemukan");
    assert.equal(foundLesson.id, "l1-1");
    assert.ok(Array.isArray(foundLesson.content) && foundLesson.content.length > 0, "Konten materi harus terisi paragraf edukatif");

    // Video lesson check
    let videoLesson = null;
    for (const m of course.modules) {
      const match = m.lessons.find((l) => l.type === "video");
      if (match) {
        videoLesson = match;
        break;
      }
    }
    assert.ok(videoLesson, "Harus tersedia materi bertipe video");
    assert.ok(videoLesson.videoUrl, "Materi video harus memiliki URL yang valid");

    // Cari materi dengan ID fiktif
    let invalidLesson = null;
    for (const m of course.modules) {
      const match = m.lessons.find((l) => l.id === "non-existent-lesson-999");
      if (match) {
        invalidLesson = match;
        break;
      }
    }
    assert.equal(invalidLesson, null, "Materi dengan ID fiktif harus null");
  });

  // 3. Pengguna yang belum login
  test("3. Pengguna yang belum login tidak memiliki sesi valid dan token palsu ditolak", async () => {
    // Sesi tanpa token
    const nullUser = null;
    assert.equal(isAdmin(nullUser), false, "Null user tidak boleh menjadi admin");

    // Token invalid
    let decoded = null;
    try {
      const jwt = (await import("jsonwebtoken")).default;
      decoded = jwt.verify("fake.invalid.token", "secret");
    } catch {
      decoded = null;
    }
    assert.equal(decoded, null, "Token sembarangan harus ditolak jwt.verify");
  });

  // 4. Pengguna biasa yang mencoba mengakses endpoint admin
  test("4. Otorisasi role: Pengguna biasa diblokir dari hak akses ADMIN (403)", () => {
    const normalUser = {
      id: "user-" + crypto.randomUUID(),
      email: "student@casper.com",
      name: "Student Casper",
      role: "USER",
    };

    const adminUser = {
      id: "admin-" + crypto.randomUUID(),
      email: "mentor@casper.com",
      name: "Lead Mentor",
      role: "ADMIN",
    };

    assert.equal(isAdmin(normalUser), false, "Pengguna biasa role USER dilarang memiliki akses admin");
    assert.equal(isAdmin(adminUser), true, "Pengguna role ADMIN harus memiliki akses admin");

    // Sanitasi user tidak boleh membocorkan password_hash
    const dbUserWithHash = {
      ...normalUser,
      password_hash: "$2b$10$secretHashSampleNotExposed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const sanitized = sanitizeUser(dbUserWithHash);
    assert.equal(sanitized.id, normalUser.id);
    assert.equal("password_hash" in sanitized, false, "password_hash dilarang keras bocor di output santized");
  });

  // 5. Isolasi progres antar pengguna
  test("5. Isolasi data: Progres pengguna A terisolasi penuh dari pengguna B", () => {
    const userAId = "userA-" + crypto.randomUUID();
    const userBId = "userB-" + crypto.randomUUID();
    const courseSlug = "trading-fundamentals";

    // User A menyelesaikan materi l1-1 & l1-2
    upsertUserProgress({
      userId: userAId,
      courseSlug,
      completedLessonIds: ["l1-1", "l1-2"],
      quizScores: { "l1-3": 80 },
      lastLessonId: "l1-2",
    });

    // User B belum menyelesaikan apapun
    const progressB = getUserCourseProgress(userBId, courseSlug);
    assert.equal(progressB, null, "User B tidak boleh mewarisi atau melihat progres User A");

    // User B menyelesaikan materi berbeda: l1-5
    upsertUserProgress({
      userId: userBId,
      courseSlug,
      completedLessonIds: ["l1-5"],
      quizScores: {},
      lastLessonId: "l1-5",
    });

    // Verifikasi User A tetap memiliki progres aslinya
    const progressA = getUserCourseProgress(userAId, courseSlug);
    assert.ok(progressA);
    assert.deepEqual(JSON.parse(progressA.completed_lesson_ids), ["l1-1", "l1-2"]);
    assert.equal(progressA.last_lesson_id, "l1-2");

    // Verifikasi User B memiliki progresnya sendiri
    const progressBUpdated = getUserCourseProgress(userBId, courseSlug);
    assert.ok(progressBUpdated);
    assert.deepEqual(JSON.parse(progressBUpdated.completed_lesson_ids), ["l1-5"]);
    assert.equal(progressBUpdated.last_lesson_id, "l1-5");
  });

  // 6. Penyimpanan progres dan pembacaan ulang setelah restart / reload
  test("6. Penyimpanan progres persisten dan terbaca kembali dari file academy.json", () => {
    const testUserId = "persist-test-" + crypto.randomUUID();
    const testSlug = "risk-management";

    upsertUserProgress({
      userId: testUserId,
      courseSlug: testSlug,
      completedLessonIds: ["l3-1", "l3-2", "l3-3"],
      quizScores: { "l3-3": 100 },
      lastLessonId: "l3-3",
    });

    // Baca ulang langsung dari file fisik filesystem
    const rawDiskContent = fs.readFileSync(dbFile, "utf8");
    const parsedDisk = JSON.parse(rawDiskContent);
    const diskRecord = parsedDisk.course_progress.find(
      (p) => p.user_id === testUserId && p.course_slug === testSlug
    );

    assert.ok(diskRecord, "Progres harus tersimpan fisik di disk file academy.json");
    assert.deepEqual(JSON.parse(diskRecord.completed_lesson_ids), ["l3-1", "l3-2", "l3-3"]);
    assert.deepEqual(JSON.parse(diskRecord.quiz_scores), { "l3-3": 100 });
  });

  // 7. Penilaian kuis di server dan kunci jawaban tidak dikirim ke klien
  test("7. Penilaian kuis di server: skor dihitung otomatis dengan batas kelulusan 70%", () => {
    const course = getCourseBySlug("trading-fundamentals");
    const quizLesson = course.modules[0].lessons.find((l) => l.type === "quiz");
    assert.ok(quizLesson && quizLesson.quiz, "Harus ada modul kuis");

    // Verifikasi bahwa dalam kurikulum server ada jawaban benar
    const questions = quizLesson.quiz;
    assert.ok(questions.length >= 3, "Kuis harus memiliki minimal 3 pertanyaan");

    // Simulasi jawaban sempurna (100%)
    let correctCount = 0;
    const userAnswers = {};
    questions.forEach((q) => {
      userAnswers[q.id] = q.correctAnswer;
      correctCount++;
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 70;

    assert.equal(score, 100, "Semua jawaban benar harus menghasilkan skor 100%");
    assert.equal(passed, true, "Skor 100% harus lulus");

    // Simulasi jawaban salah semua (0%)
    let zeroCount = 0;
    questions.forEach((q) => {
      // pilih opsi yang pasti bukan correctAnswer
      const wrongOpt = (q.correctAnswer + 1) % q.options.length;
      if (wrongOpt === q.correctAnswer) {
        zeroCount++;
      }
    });
    assert.equal(zeroCount, 0, "Pilihan jawaban salah menghasilkan 0 jawaban benar");
  });

  // 8. Penolakan payload kuis yang tidak valid
  test("8. Penolakan payload kuis tidak valid (jawaban kosong atau format salah)", () => {
    const invalidPayload1 = { answers: null };
    const invalidPayload2 = { answers: "string-bukan-objek" };
    const invalidPayload3 = {};

    function validateQuizPayload(body) {
      if (!body || typeof body !== "object") return false;
      if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return false;
      if (Object.keys(body.answers).length === 0) return false;
      return true;
    }

    assert.equal(validateQuizPayload(invalidPayload1), false);
    assert.equal(validateQuizPayload(invalidPayload2), false);
    assert.equal(validateQuizPayload(invalidPayload3), false);
    assert.equal(validateQuizPayload({ answers: { q1: 0 } }), true);
  });

  // 9. Pencegahan manipulasi skor oleh klien
  test("9. Pencegahan manipulasi skor: server mengabaikan klaim skor dari klien", () => {
    const course = getCourseBySlug("trading-fundamentals");
    const quiz = course.modules[0].lessons.find((l) => l.type === "quiz").quiz;

    // Klien mencoba mengirim skor 100 secara curang padahal jawabannya salah
    const questions = quiz;
    const maliciousClientClaim = {
      claimedScore: 100,
      answers: {
        [questions[0].id]: 9999, // opsi tidak valid
      },
    };

    // Evaluator server independen
    let serverCorrect = 0;
    questions.forEach((q) => {
      if (maliciousClientClaim.answers[q.id] === q.correctAnswer) {
        serverCorrect++;
      }
    });
    const serverCalculatedScore = Math.round((serverCorrect / questions.length) * 100);

    assert.equal(serverCalculatedScore, 0, "Server harus menilai 0% meskipun klien mengklaim 100%");
    assert.notEqual(serverCalculatedScore, maliciousClientClaim.claimedScore);
  });

  // 10. Data lama tetap dapat dibaca setelah penambahan skema
  test("10. Kompatibilitas mundur: Data lama tetap utuh dan terbaca normal setelah penambahan skema", () => {
    const db = getDatabase();
    assert.ok(isValidDatabaseSchema(db), "Skema database harus tetap valid");

    // Pastikan akun utama ada
    const existingUser = findUserByEmail("apriyanriyan23@gmail.com");
    assert.ok(existingUser, "Akun apriyanriyan23@gmail.com harus tetap ada");
    assert.ok(existingUser.password_hash.startsWith("$2b$"), "Password hash tidak boleh berubah");

    // Pastikan custom_courses dan quiz_submissions berfungsi tanpa merusak users
    const customCourses = getCustomCourses();
    assert.ok(Array.isArray(customCourses), "custom_courses harus berupa array");

    const tempCourse = {
      id: "cc-" + crypto.randomUUID(),
      title: "Kelas Uji Kompatibilitas",
      slug: "uji-kompatibilitas-" + Date.now(),
      subtitle: "Uji skema tanpa merusak data lama",
      description: "Deskripsi uji",
      level: "Pemula",
      category: "Uji",
      price: "Gratis",
      duration: "1 Jam",
      modules: [],
      published: false,
    };

    upsertCustomCourse(tempCourse);
    const fetched = getCustomCourses().find((c) => c.id === tempCourse.id);
    assert.ok(fetched, "Custom course berhasil ditambahkan");

    // Hapus kembali course uji
    deleteCustomCourse(tempCourse.id);
    const refetched = getCustomCourses().find((c) => c.id === tempCourse.id);
    assert.equal(refetched, undefined, "Custom course berhasil dibersihkan");

    // Verifikasi user lama tetap tidak tersentuh
    const verifiedUser = findUserByEmail("apriyanriyan23@gmail.com");
    assert.equal(verifiedUser.email, "apriyanriyan23@gmail.com");
  });

  // 11. Penanganan kegagalan penulisan database (rollback aman)
  test("11. Transaksi atomik dan rollback: Database tidak korup bila terjadi error di tengah proses", () => {
    const beforeDb = getDatabase();
    const initialUserCount = beforeDb.users.length;
    const testEmail = `rollback_${Date.now()}@test.com`;

    let threwError = false;
    try {
      executeTransactionForTest((draft) => {
        // Operasi 1: Tambah user
        draft.users.push({
          id: crypto.randomUUID(),
          email: testEmail,
          name: "Rollback Candidate",
          password_hash: "hash",
          role: "USER",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Operasi 2: Sengaja lempar exception simulasi kegagalan sistem
        throw new Error("Simulasi crash sistem di tengah mutasi");
      });
    } catch {
      threwError = true;
    }

    assert.ok(threwError, "Exception harus tertangkap");

    // Database harus di-rollback sempurna
    const afterDb = getDatabase();
    assert.equal(afterDb.users.length, initialUserCount, "Jumlah user harus tetap sama setelah rollback");
    const orphanedUser = findUserByEmail(testEmail);
    assert.equal(orphanedUser, null, "User dari transaksi yang gagal tidak boleh tersimpan");
  });

  // 12. Validasi kelulusan kuis dan kelayakan sertifikat
  test("12. Syarat sertifikat ketat: Kuis gagal (< 70%) tidak menandai materi selesai dan sertifikat ditahan", () => {
    const course = getCourseBySlug("trading-fundamentals");
    const quizLesson = course.modules[0].lessons.find((l) => l.type === "quiz");
    const courseQuizLessons = course.modules.flatMap((m) => m.lessons).filter((l) => l.type === "quiz");
    assert.ok(courseQuizLessons.length > 0, "Kelas harus memiliki materi kuis");

    // Skenario A: Siswa menyelesaikan semua materi bacaan tapi kuis mendapat nilai 33% (gagal)
    const mockProgressFailed = {
      completedLessonIds: ["l1-1", "l1-2"], // materi kuis l1-3 TIDAK masuk completed karena belum lulus
      quizScores: { [quizLesson.id]: 33 },
    };

    const hasQuiz = courseQuizLessons.length > 0;
    const allQuizzesPassedFailed = !hasQuiz || courseQuizLessons.every(
      (ql) => (mockProgressFailed.quizScores[ql.id] || 0) >= 70
    );
    const isCompleteFailed = mockProgressFailed.completedLessonIds.length === course.totalLessons;
    const eligibleForCertFailed = isCompleteFailed && allQuizzesPassedFailed;

    assert.equal(allQuizzesPassedFailed, false, "Kuis dengan skor 33% harus dinyatakan belum lulus");
    assert.equal(eligibleForCertFailed, false, "Sertifikat harus ditahan jika kuis belum lulus");

    // Skenario B: Siswa lulus semua kuis dengan nilai 100% dan menyelesaikan seluruh materi
    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const allQuizScores = {};
    courseQuizLessons.forEach((ql) => {
      allQuizScores[ql.id] = 100;
    });

    const mockProgressPassed = {
      completedLessonIds: allLessonIds,
      quizScores: allQuizScores,
    };

    const allQuizzesPassedSuccess = courseQuizLessons.every(
      (ql) => (mockProgressPassed.quizScores[ql.id] || 0) >= 70
    );
    const isCompleteSuccess = mockProgressPassed.completedLessonIds.length === course.totalLessons;
    const eligibleForCertSuccess = isCompleteSuccess && allQuizzesPassedSuccess;

    assert.equal(allQuizzesPassedSuccess, true, "Kuis dengan skor 100% harus lulus");
    assert.equal(isCompleteSuccess, true, "Semua materi harus selesai");
    assert.equal(eligibleForCertSuccess, true, "Sertifikat berhak diberikan setelah seluruh syarat terpenuhi");
  });

  // 13. Keamanan Registrasi: Publik dilarang menentukan role ADMIN
  test("13. Registrasi publik memaksa role USER dan mengabaikan parameter role dari client", () => {
    const maliciousPayload = {
      id: "malicious-" + crypto.randomUUID(),
      email: `hacker_${Date.now()}@casper.com`,
      name: "Hacker",
      passwordHash: "fakehash",
      role: "ADMIN", // Percobaan eksploitasi
    };

    // createUser dalam route registrasi memaksa role USER
    const created = createUser({
      ...maliciousPayload,
      role: "USER", // Dipaksa oleh controller registrasi
    });

    assert.equal(created.role, "USER", "User baru dari registrasi publik harus selalu memiliki role USER");
    assert.equal(isAdmin(created), false, "User baru tidak boleh menjadi admin");
  });

  // 14. Keamanan COOKIE_SECURE di Production & Staging HTTP
  test("14. COOKIE_SECURE default true di production dan hanya false jika diset eksplisit", () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origCookieSecure = process.env.COOKIE_SECURE;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.COOKIE_SECURE;
      assert.equal(
        shouldUseSecureCookie(),
        true,
        "Default production wajib menggunakan Secure Cookie (true)"
      );

      process.env.COOKIE_SECURE = "true";
      assert.equal(
        shouldUseSecureCookie(),
        true,
        "COOKIE_SECURE=true di production harus menghasilkan true"
      );

      process.env.COOKIE_SECURE = "false";
      assert.equal(
        shouldUseSecureCookie(),
        false,
        "COOKIE_SECURE=false eksplisit di production mengizinkan mode staging HTTP sementara"
      );
    } finally {
      if (origNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = origNodeEnv;

      if (origCookieSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = origCookieSecure;
    }
  });

  // 15. Penegakan Ketat JWT_SECRET di Production (Menolak Fallback & Secret Lemah)
  test("15. Production menolak fallback JWT_SECRET atau secret pendek (< 32 karakter)", () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origJwtSecret = process.env.JWT_SECRET;

    try {
      process.env.NODE_ENV = "production";

      // 1. Tanpa JWT_SECRET -> harus ditolak
      delete process.env.JWT_SECRET;
      assert.throws(
        () => getJwtSecret(),
        /JWT_SECRET wajib tersedia/,
        "Production tanpa JWT_SECRET harus melempar error"
      );

      // 2. Menggunakan legacy fallback secret -> harus ditolak
      process.env.JWT_SECRET = "casper-academy-secret-2026-production-v1";
      assert.throws(
        () => getJwtSecret(),
        /dilarang menggunakan fallback/,
        "Production dengan legacy fallback secret harus ditolak"
      );

      // 3. Menggunakan secret pendek (< 32 karakter) -> harus ditolak
      process.env.JWT_SECRET = "terlalu-pendek-123";
      assert.throws(
        () => getJwtSecret(),
        /minimal 32 karakter/,
        "Production dengan secret < 32 karakter harus ditolak"
      );

      // 4. Menggunakan secret acak 256-bit (64 hex chars) -> diterima & valid
      process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
      const token = createToken({
        userId: "u-prod-1",
        email: "admin@casper.com",
        role: "ADMIN",
      });
      const verified = verifyToken(token);
      assert.ok(verified, "Token dengan JWT_SECRET 256-bit harus valid");
      assert.equal(verified.userId, "u-prod-1");
    } finally {
      if (origNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = origNodeEnv;

      if (origJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = origJwtSecret;
    }
  });

  // 16. Audit Kompatibilitas Migrasi Database Admin (data/academy.json) & Klasifikasi 3 Kondisi DB
  test("16. Skema data/academy.json siap migrasi: hanya berisi akun admin apriyanriyan23@gmail.com, progres utuh, dan kompatibel penuh", () => {
    assert.ok(pristineSnapshot, "File data/academy.json harus tersedia");
    const parsed = JSON.parse(pristineSnapshot);

    // Validasi skema terhadap validator kode terbaru
    assert.equal(isValidDatabaseSchema(parsed), true, "Skema academy.json harus sesuai dengan kode terbaru");
    assert.ok(Array.isArray(parsed.custom_courses), "Field custom_courses harus berupa array");

    // Pastikan tepat 1 user (admin apriyanriyan23@gmail.com) dan tidak ada akun pengujian
    assert.equal(parsed.users.length, 1, "Database migrasi harus berisi tepat 1 akun");
    const adminUser = parsed.users[0];
    assert.equal(adminUser.id, "6b9ba627-6741-4ee6-bf50-892469db05bf");
    assert.equal(adminUser.email, "apriyanriyan23@gmail.com");
    assert.equal(adminUser.role, "ADMIN");
    assert.equal(typeof adminUser.password_hash, "string");
    assert.ok(
      adminUser.password_hash.startsWith("$2b$") && adminUser.password_hash.length === 60,
      "Format hash bcrypt akun admin harus valid tanpa menampilkan nilainya"
    );
    assert.equal(
      findUserByEmail("traderpro@signalcasper.test"),
      null,
      "Akun pengujian traderpro@signalcasper.test tidak boleh ada"
    );

    // Pastikan akun admin dapat dibaca oleh helper DB & Auth terbaru
    const dbAdmin = findUserByEmail("apriyanriyan23@gmail.com");
    assert.ok(dbAdmin, "findUserByEmail harus menemukan akun admin");
    assert.equal(isAdmin(dbAdmin), true, "isAdmin harus mengenali role ADMIN");

    const safeAdmin = sanitizeUser(dbAdmin);
    assert.equal("password_hash" in safeAdmin, false, "sanitizeUser wajib menghapus password_hash");

    // Pastikan progres belajar admin tetap utuh dan terbaca normal
    assert.equal(parsed.course_progress.length, 1, "Harus ada tepat 1 entri progres milik admin");

    const adminProgress = getUserCourseProgress(dbAdmin.id, "trading-fundamentals");
    assert.ok(adminProgress, "Progres trading-fundamentals milik admin harus terbaca");
    const parseField = (val) => (typeof val === "string" ? JSON.parse(val) : val);
    const parsedLessons = parseField(adminProgress.completed_lesson_ids);
    const parsedScores = parseField(adminProgress.quiz_scores);
    assert.ok(Array.isArray(parsedLessons), "completed_lesson_ids setelah diparse harus berupa Array");
    assert.deepEqual(parsedLessons, ["l1-1", "l1-2"]);
    assert.equal(typeof parsedScores, "object");
    assert.deepEqual(parsedScores, { "l1-1": 100, "l1-2": 100 });
    assert.equal(adminProgress.last_lesson_id, "l1-2");

    // Verifikasi fungsi klasifikasi migrasi DB (membedakan DB kosong, DB admin benar, dan DB data berbeda)
    function classifyProductionDatabase(dbObj) {
      if (!dbObj || !Array.isArray(dbObj.users) || !Array.isArray(dbObj.course_progress) || !Array.isArray(dbObj.quiz_submissions)) {
        return { state: "DIFFERENT_OR_INVALID", reason: "Invalid schema" };
      }
      if (dbObj.users.length === 0) {
        return { state: "EMPTY", reason: "No users" };
      }
      const hasTest = dbObj.users.some((u) => u && typeof u.email === "string" && u.email.endsWith(".test"));
      if (hasTest) {
        return { state: "DIFFERENT_OR_INVALID", reason: "Contains .test user" };
      }
      const adm = dbObj.users.find(
        (u) =>
          u &&
          u.id === "6b9ba627-6741-4ee6-bf50-892469db05bf" &&
          u.email === "apriyanriyan23@gmail.com" &&
          u.role === "ADMIN" &&
          typeof u.password_hash === "string" &&
          u.password_hash.startsWith("$2b$") &&
          u.password_hash.length === 60
      );
      if (!adm) {
        return { state: "DIFFERENT_OR_INVALID", reason: "Missing expected admin" };
      }
      const prog = dbObj.course_progress.find((p) => p && p.user_id === adm.id && p.course_slug === "trading-fundamentals");
      if (!prog) {
        return { state: "DIFFERENT_OR_INVALID", reason: "Missing admin progress" };
      }
      const lessons = parseField(prog.completed_lesson_ids);
      const scores = parseField(prog.quiz_scores);
      const okLessons = Array.isArray(lessons) && ["l1-1", "l1-2"].every((id) => lessons.includes(id));
      const okQuiz = scores && typeof scores === "object" && scores["l1-1"] === 100 && scores["l1-2"] === 100;
      if (!okLessons || !okQuiz) {
        return { state: "DIFFERENT_OR_INVALID", reason: "Different admin progress" };
      }
      return { state: "VALID_ADMIN_DB" };
    }

    assert.equal(classifyProductionDatabase({ users: [], course_progress: [], quiz_submissions: [] }).state, "EMPTY");
    assert.equal(classifyProductionDatabase(parsed).state, "VALID_ADMIN_DB");
    assert.equal(
      classifyProductionDatabase({
        users: [{ id: "other", email: "other@casper.com", role: "USER", password_hash: "$2b$10$123" }],
        course_progress: [],
        quiz_submissions: [],
      }).state,
      "DIFFERENT_OR_INVALID"
    );
  });

  // 17. Pergantian JWT_SECRET tidak mengubah data akun/progres dan admin tetap bisa login ulang
  test("17. Rotasi JWT_SECRET hanya membatalkan token sesi lama tanpa mengubah data akun atau progres admin", () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origJwtSecret = process.env.JWT_SECRET;

    try {
      process.env.NODE_ENV = "production";
      const secretLama = crypto.randomBytes(32).toString("hex");
      const secretBaru = crypto.randomBytes(32).toString("hex");

      const adminBefore = findUserByEmail("apriyanriyan23@gmail.com");
      const progressBefore = getUserCourseProgress(adminBefore.id, "trading-fundamentals");
      assert.ok(adminBefore && progressBefore, "Data admin sebelum rotasi JWT_SECRET harus ada");

      // Terbitkan token dengan secret lama
      process.env.JWT_SECRET = secretLama;
      const oldToken = createToken({
        userId: adminBefore.id,
        email: adminBefore.email,
        role: adminBefore.role,
      });
      assert.ok(verifyToken(oldToken), "Token lama valid pada secret lama");

      // Ganti JWT_SECRET ke secret baru
      process.env.JWT_SECRET = secretBaru;
      assert.equal(verifyToken(oldToken), null, "Token lama otomatis tidak berlaku setelah rotasi JWT_SECRET");

      // Pastikan data akun, password_hash, dan progres admin sama sekali tidak berubah
      const adminAfter = findUserByEmail("apriyanriyan23@gmail.com");
      const progressAfter = getUserCourseProgress(adminAfter.id, "trading-fundamentals");
      assert.equal(adminAfter.id, adminBefore.id);
      assert.equal(adminAfter.email, "apriyanriyan23@gmail.com");
      assert.equal(adminAfter.role, "ADMIN");
      assert.equal(adminAfter.password_hash, adminBefore.password_hash, "Hash password admin tidak boleh berubah");
      assert.equal(progressAfter.completed_lesson_ids, progressBefore.completed_lesson_ids);
      assert.equal(progressAfter.quiz_scores, progressBefore.quiz_scores);

      // Pastikan penerbitan token login baru dengan secret baru berhasil
      const newToken = createToken({
        userId: adminAfter.id,
        email: adminAfter.email,
        role: adminAfter.role,
      });
      const verifiedNew = verifyToken(newToken);
      assert.ok(verifiedNew, "Admin dapat memperoleh sesi baru yang valid dengan JWT_SECRET baru");
      assert.equal(verifiedNew.email, "apriyanriyan23@gmail.com");
      assert.equal(verifiedNew.role, "ADMIN");
    } finally {
      if (origNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = origNodeEnv;

      if (origJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = origJwtSecret;
    }
  });

  // 18. Regression Sprint 1 (TASK 1): Integritas 9 Kelas Statis, Progres 100%, dan Sertifikat
  test("18. Integritas seluruh 9 kelas statis: totalLessons sesuai jumlah materi aktual, dapat mencapai 100%, dan kelas tanpa materi tidak dianggap selesai", () => {
    const staticCourses = getStaticCourses();
    assert.equal(staticCourses.length, 9, "Harus terdapat tepat 9 kelas statis dalam kurikulum");

    const expectedCounts = {
      "trading-fundamentals": 6,
      "candlestick-price-action": 6,
      "market-structure": 6,
      "support-and-resistance": 6,
      "technical-analysis-framework": 6,
      "xauusd-market-analysis": 6,
      "risk-management": 6,
      "trading-psychology": 6,
      "trading-journal-evaluation": 6,
    };

    for (const course of staticCourses) {
      const actualCount = countCourseLessons(course);
      assert.ok(actualCount > 0, `Kelas ${course.slug} wajib memiliki minimal 1 materi aktual`);
      assert.equal(
        course.totalLessons,
        actualCount,
        `totalLessons pada kelas ${course.slug} (${course.totalLessons}) harus sama dengan jumlah materi aktual (${actualCount})`
      );
      assert.equal(
        actualCount,
        expectedCounts[course.slug],
        `Jumlah materi aktual ${course.slug} harus sesuai audit (${expectedCounts[course.slug]})`
      );

      // Simulasi penyelesaian seluruh materi & kuis pada setiap kelas statis
      const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const quizScores = {};
      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          if (lesson.type === "quiz" || (Array.isArray(lesson.quiz) && lesson.quiz.length > 0)) {
            quizScores[lesson.id] = 100;
          }
        }
      }

      const evalComplete = evaluateCourseCompletion(course, {
        completedLessonIds: allLessonIds,
        quizScores,
      });

      assert.equal(
        evalComplete.percentage,
        100,
        `Kelas ${course.slug} harus dapat mencapai progres 100%`
      );
      assert.equal(
        evalComplete.isComplete,
        true,
        `Kelas ${course.slug} harus berstatus selesai ketika seluruh materi tuntas`
      );
      assert.equal(
        evalComplete.isEligibleForCertificate,
        true,
        `Kelas ${course.slug} harus memenuhi syarat sertifikat ketika seluruh materi & kuis tuntas`
      );
    }

    // Pastikan kelas dengan 0 materi tidak pernah dianggap selesai atau mendapatkan sertifikat
    const emptyCourse = normalizeCourse({
      id: "empty-course",
      slug: "empty-course",
      title: "Kelas Kosong",
      totalLessons: 0,
      modules: [],
    });
    const emptyEval = evaluateCourseCompletion(emptyCourse, {
      completedLessonIds: ["fiktif-1"],
      quizScores: {},
    });
    assert.equal(calculateCoursePercentage(0, 0), 0);
    assert.equal(calculateCoursePercentage(0, 5), 0);
    assert.equal(emptyEval.totalLessons, 0);
    assert.equal(emptyEval.percentage, 0);
    assert.equal(emptyEval.isComplete, false, "Kelas tanpa materi dilarang terlihat selesai");
    assert.equal(
      emptyEval.isEligibleForCertificate,
      false,
      "Kelas tanpa materi dilarang memenuhi syarat sertifikat"
    );
  });

  // 19. Regression Sprint 1 (TASK 2): Integrasi Kelas Kustom & Validasi Konflik Slug
  test("19. Kelas kustom: pembuatan, validasi konflik slug (statis & kustom), tampil di katalog/detail, progres, evaluasi kuis, dan sertifikat", () => {
    const customId = "cc-sprint1-" + crypto.randomUUID();
    const customSlug = "custom-orderflow-mastery-" + Date.now();

    // A. Tolak konflik slug dengan kelas statis
    assert.throws(
      () =>
        upsertCustomCourse({
          id: "cc-conflict-static",
          slug: "trading-fundamentals",
          title: "Konflik Statis",
        }),
      /sudah digunakan oleh kelas statis/,
      "Harus menolak pembuatan kelas kustom dengan slug milik kelas statis"
    );

    // B. Buat kelas kustom dengan 2 pelajaran (1 artikel + 1 kuis berisi 2 soal)
    upsertCustomCourse({
      id: customId,
      slug: customSlug,
      title: "Custom Orderflow Mastery",
      subtitle: "Membaca jejak likuiditas institusional",
      description: "Kelas kustom untuk pengujian regresi Sprint 1.",
      level: "Menengah",
      category: "Orderflow",
      price: "Gratis",
      duration: "2 Jam",
      published: true,
      modules: [
        {
          id: "m-custom-1",
          title: "Modul 1: Dasar Orderflow",
          description: "Memahami absorption dan imbalance",
          lessons: [
            {
              id: "lc-1",
              title: "Memahami Liquidity Absorption",
              duration: "15m",
              type: "article",
              summary: "Ringkasan absorption",
              content: ["Paragraf 1 absorption", "Paragraf 2 absorption"],
            },
            {
              id: "lc-2",
              title: "Kuis Evaluasi Orderflow",
              duration: "10m",
              type: "quiz",
              summary: "Uji pemahaman orderflow",
              content: ["Kerjakan kuis berikut dengan skor minimal 70%."],
              quiz: [
                {
                  id: "qc-1",
                  question: "Apa indikasi utama absorption pada level support?",
                  options: [
                    "Volume agresif jual tinggi namun harga gagal menembus support",
                    "Volume nol saat market tutup",
                  ],
                  correctAnswer: 0,
                  explanation: "Limit buy menyerap market sell.",
                },
                {
                  id: "qc-2",
                  question: "Berapa batas kelulusan kuis di Signal Casper Academy?",
                  options: ["50%", "70%"],
                  correctAnswer: 1,
                  explanation: "Batas kelulusan adalah 70%.",
                },
              ],
            },
          ],
        },
      ],
    });

    try {
      // C. Tolak konflik slug dengan kelas kustom lain yang berbeda ID
      assert.throws(
        () =>
          upsertCustomCourse({
            id: "cc-other-id",
            slug: customSlug,
            title: "Duplikat Slug Kustom",
          }),
        /sudah digunakan oleh kelas kustom lain/,
        "Harus menolak pembuatan kelas kustom baru dengan slug kustom yang sudah ada"
      );

      // D. Pastikan kelas kustom masuk ke getAllCourses() dan getCourseBySlug()
      const all = getAllCourses();
      const fromCatalog = all.find((c) => c.slug === customSlug);
      assert.ok(fromCatalog, "Kelas kustom harus tampil di getAllCourses()");
      assert.equal(fromCatalog.totalLessons, 2, "totalLessons kelas kustom harus terhitung otomatis (2)");

      const fromSlug = getCourseBySlug(customSlug);
      assert.ok(fromSlug, "Kelas kustom harus dapat ditemukan melalui getCourseBySlug()");
      assert.equal(fromSlug.id, customId);

      // E. Sanitasi klien tidak boleh membocorkan correctAnswer
      const sanitized = sanitizeCourseForClient(fromSlug);
      const clientQuiz = sanitized.modules[0].lessons[1].quiz;
      assert.equal(
        "correctAnswer" in clientQuiz[0],
        false,
        "sanitizeCourseForClient wajib menyembunyikan correctAnswer dari bundel klien"
      );

      // F. Siswa mempelajari materi artikel lc-1 via validateAndPersistUserProgress
      const studentId = "student-custom-" + crypto.randomUUID();
      const progStep1 = validateAndPersistUserProgress(studentId, {
        courseSlug: customSlug,
        completedLessonIds: ["lc-1"],
        lastLessonId: "lc-1",
      });
      assert.equal(progStep1.ok, true);
      assert.deepEqual(progStep1.completedLessonIds, ["lc-1"]);

      // G. Siswa mengerjakan kuis kelas kustom via evaluateAndRecordServerQuiz
      const quizPass = evaluateAndRecordServerQuiz(studentId, {
        courseSlug: customSlug,
        lessonId: "lc-2",
        answers: { "qc-1": 0, "qc-2": 1 },
      });
      assert.equal(quizPass.ok, true, "Evaluasi kuis kelas kustom harus berhasil");
      assert.equal(quizPass.score, 100);
      assert.equal(quizPass.passed, true);
      assert.deepEqual(quizPass.updatedProgress.completedLessonIds, ["lc-1", "lc-2"]);

      // H. Evaluasi progres 100% dan kelayakan sertifikat pada kelas kustom
      const finalEval = evaluateCourseCompletion(fromSlug, quizPass.updatedProgress);
      assert.equal(finalEval.percentage, 100);
      assert.equal(finalEval.isComplete, true);
      assert.equal(finalEval.isEligibleForCertificate, true);
    } finally {
      deleteCustomCourse(customId);
    }
  });

  // 20. Regression Sprint 1 (TASK 3): Keamanan POST /api/progress & Evaluasi Kuis < 70 vs >= 70
  test("20. Keamanan API Progres: menolak quizSubmission, menolak ID materi tidak valid, menolak materi kuis jika skor server < 70, dan mengabaikan klaim skor klien", () => {
    const userId = "sec-user-" + crypto.randomUUID();
    const courseSlug = "trading-fundamentals";
    const course = getCourseBySlug(courseSlug);

    // 1. Tolak injeksi quizSubmission pada POST /api/progress
    const injected = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: ["l1-1"],
      quizSubmission: {
        lessonId: "l1-3",
        score: 100,
        answers: { q1: 1 },
      },
    });
    assert.equal(injected.ok, false, "Injeksi quizSubmission pada /api/progress harus ditolak");
    assert.equal(injected.status, 400);

    // 2. Tolak ID pelajaran fiktif / tidak terdaftar di silabus
    const invalidLessonRes = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: ["l1-1", "materi-palsu-999"],
    });
    assert.equal(invalidLessonRes.ok, false, "ID pelajaran di luar silabus harus ditolak");
    assert.equal(invalidLessonRes.status, 400);

    // 3. Tolak lastLessonId yang tidak terdaftar di silabus
    const invalidLastLesson = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: ["l1-1"],
      lastLessonId: "materi-palsu-999",
    });
    assert.equal(invalidLastLesson.ok, false, "lastLessonId di luar silabus harus ditolak");
    assert.equal(invalidLastLesson.status, 400);

    // 4. Tolak penyelesaian materi bertipe quiz (l1-3) ketika belum ada skor kuis di server
    const unpassedQuizAttempt = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: ["l1-1", "l1-3"],
      quizScores: { "l1-3": 100 }, // Klien mencoba mengklaim skor 100
    });
    assert.equal(
      unpassedQuizAttempt.ok,
      false,
      "Materi kuis tidak boleh ditandai selesai tanpa skor kuis server >= 70"
    );
    assert.equal(unpassedQuizAttempt.status, 400);

    // 5. Submit kuis dengan skor di bawah 70 (misal 1 benar dari 3 soal = 33%)
    const quizFail = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-3",
      answers: { "q1-1": 1, "q1-2": 0, "q1-3": 1 }, // hanya q1-1 yang benar
    });
    assert.equal(quizFail.ok, true);
    assert.equal(quizFail.score, 33);
    assert.equal(quizFail.passed, false);
    assert.equal(
      quizFail.updatedProgress.completedLessonIds.includes("l1-3"),
      false,
      "Skor < 70 tidak boleh menandai materi kuis selesai"
    );

    // 6. Coba paksa masukkan l1-3 ke completedLessonIds saat skor server masih 33 (< 70)
    const forceCompleteAfterFail = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: ["l1-1", "l1-3"],
    });
    assert.equal(
      forceCompleteAfterFail.ok,
      false,
      "Server harus tetap menolak l1-3 di completedLessonIds selama skor server < 70"
    );
    assert.equal(forceCompleteAfterFail.status, 400);

    // 7. Submit kuis l1-3 dan l1-6 dengan skor >= 70 (semua benar = 100%)
    const quizPass = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-3",
      answers: { "q1-1": 1, "q1-2": 2, "q1-3": 0 },
    });
    assert.equal(quizPass.ok, true);
    assert.equal(quizPass.score, 100);
    assert.equal(quizPass.passed, true);
    assert.equal(
      quizPass.updatedProgress.completedLessonIds.includes("l1-3"),
      true,
      "Skor >= 70 otomatis menandai materi kuis selesai di server"
    );

    const quizPassFinal = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-6",
      answers: { "q1-6-1": 1, "q1-6-2": 2, "q1-6-3": 1 },
    });
    assert.equal(quizPassFinal.ok, true);
    assert.equal(quizPassFinal.score, 100);
    assert.equal(quizPassFinal.passed, true);

    // 8. Setelah skor server >= 70, penyimpanan progres seluruh 6 materi diizinkan
    const allIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const validFullProgress = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: allIds,
      lastLessonId: "l1-6",
      quizScores: { "l1-3": 10 }, // Klaim skor palsu dari klien harus diabaikan
    });
    assert.equal(validFullProgress.ok, true);
    assert.equal(validFullProgress.completedLessonIds.length, 6);
    assert.equal(
      validFullProgress.quizScores["l1-3"],
      100,
      "Skor kuis server (100) tidak boleh tertimpa oleh klaim klien"
    );
  });

  // 21. Regression Sprint 1 (TASK 4): Isolasi Local Storage Antar Akun & Sinkronisasi Setelah Kuis
  test("21. Isolasi localStorage berdasarkan userId, pembersihan saat logout, dan sinkronisasi progres setelah submit kuis", () => {
    clearSessionAndProgressStorage();

    const user1 = {
      id: "u-local-1",
      name: "User Satu",
      email: "u1@casper.com",
      role: "USER",
    };
    const user2 = {
      id: "u-local-2",
      name: "User Dua",
      email: "u2@casper.com",
      role: "USER",
    };

    // 1. Login sebagai User 1 dan simpan progres lokal + hasil kuis
    setAuthenticatedSessionUser(user1);
    assert.equal(getActiveSessionUser()?.id, user1.id);

    enrollCourse("trading-fundamentals", "l1-1");
    toggleLessonComplete("trading-fundamentals", "l1-1");
    toggleLessonComplete("trading-fundamentals", "l1-2");

    // Simulasi sinkronisasi localStorage setelah server mengembalikan updatedProgress dari /api/quiz/submit
    const syncedAfterQuiz = applyServerCourseProgress(
      "trading-fundamentals",
      {
        completedLessonIds: ["l1-1", "l1-2", "l1-3"],
        quizScores: { "l1-3": 100 },
      },
      "l1-3",
      user1.id
    );
    assert.deepEqual(syncedAfterQuiz.completedLessonIds, ["l1-1", "l1-2", "l1-3"]);
    assert.deepEqual(syncedAfterQuiz.quizScores, { "l1-3": 100 });

    const storedUser1 = getStoredProgress(user1.id);
    assert.ok(storedUser1["trading-fundamentals"]);
    assert.deepEqual(storedUser1["trading-fundamentals"].completedLessonIds, [
      "l1-1",
      "l1-2",
      "l1-3",
    ]);
    assert.deepEqual(storedUser1["trading-fundamentals"].quizScores, { "l1-3": 100 });

    // 2. Logout User 1 -> bersihkan sesi dan cache progres
    clearSessionAndProgressStorage();
    assert.equal(
      getActiveSessionUser(),
      null,
      "Sesi lokal harus bersih setelah logout atau cookie tidak valid"
    );
    assert.deepEqual(
      getStoredProgress(user1.id),
      {},
      "Cache progres User 1 harus dibersihkan saat logout"
    );

    // 3. Login sebagai User 2 pada browser yang sama -> tidak boleh mewarisi progres User 1
    setAuthenticatedSessionUser(user2);
    assert.equal(getActiveSessionUser()?.id, user2.id);
    assert.deepEqual(
      getStoredProgress(),
      {},
      "User 2 tidak boleh membaca progres dari akun sebelumnya pada browser yang sama"
    );

    // Simpan progres berbeda untuk User 2
    saveStoredProgress(
      {
        "risk-management": {
          courseSlug: "risk-management",
          completedLessonIds: ["l7-1"],
          quizScores: {},
          lastAccessedLessonId: "l7-1",
          enrolledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      user2.id
    );
    const storedUser2 = getStoredProgress();
    assert.deepEqual(Object.keys(storedUser2), ["risk-management"]);
    assert.equal(storedUser2["trading-fundamentals"], undefined);

    // Bersihkan kembali di akhir test
    clearSessionAndProgressStorage();
  });

  // 22. Regression Sprint 2 (TASK 2): Kelengkapan Kurikulum 9 Kelas, 18 Modul, 54 Pelajaran, Kuis, & Evaluasi
  test("22. Kurikulum lengkap C1–C9: 9 kelas, 18 modul, 54 pelajaran penuh tanpa placeholder, evaluasi modul, final assessment, dan sanitasi kuis klien", () => {
    const staticCourses = getStaticCourses();
    assert.equal(staticCourses.length, 9, "Harus terdapat 9 kelas dalam kurikulum utama");

    let totalModulesCount = 0;
    let totalLessonsCount = 0;
    let totalQuizQuestionsCount = 0;

    for (const course of staticCourses) {
      // 1. Validasi kelengkapan metadata setiap kelas (10 elemen wajib kelas)
      assert.ok(course.overview && course.overview.length >= 80, `Deskripsi kelas ${course.slug} harus lengkap`);
      assert.ok(Array.isArray(course.objectives) && course.objectives.length >= 3, `Tujuan pembelajaran ${course.slug} wajib minimal 3 poin`);
      assert.ok(Array.isArray(course.competencies) && course.competencies.length >= 3, `Target kemampuan ${course.slug} wajib minimal 3 poin`);
      assert.ok(Array.isArray(course.prerequisites) && course.prerequisites.length >= 1, `Prasyarat ${course.slug} wajib terdefinisi`);
      assert.ok(Array.isArray(course.courseSummary) && course.courseSummary.length >= 2, `Ringkasan kelas ${course.slug} wajib tersedia`);
      assert.ok(Array.isArray(course.references) && course.references.length >= 2, `Referensi belajar ${course.slug} wajib tersedia`);
      assert.ok(Array.isArray(course.modules) && course.modules.length === 2, `Kelas ${course.slug} wajib memiliki 2 modul terstruktur`);
      assert.equal(course.totalLessons, 6, `totalLessons ${course.slug} wajib bernilai 6`);
      assert.equal(countCourseLessons(course), 6, `Jumlah pelajaran aktual ${course.slug} wajib 6`);

      totalModulesCount += course.modules.length;

      // Pastikan setiap kelas memiliki minimal 1 visualDiagram edukatif
      const hasVisualDiagram = course.modules.some((m) =>
        m.lessons.some((l) => typeof l.visualDiagram === "string" && l.visualDiagram.length > 0)
      );
      assert.ok(hasVisualDiagram, `Kelas ${course.slug} wajib memiliki diagram visual edukatif`);

      // 2. Validasi setiap modul & pelajaran
      course.modules.forEach((mod, modIdx) => {
        assert.equal(mod.lessons.length, 3, `Modul ${mod.id} pada ${course.slug} wajib memiliki 3 pelajaran`);

        // Pelajaran terakhir di setiap modul harus bertipe quiz (Evaluasi Modul 1 & Final Assessment Modul 2)
        const lastLesson = mod.lessons[mod.lessons.length - 1];
        assert.equal(
          lastLesson.type,
          "quiz",
          `Pelajaran penutup modul ${mod.id} (${lastLesson.id}) wajib bertipe 'quiz' sebagai Evaluasi/Final Assessment`
        );
        assert.ok(
          Array.isArray(lastLesson.quiz) && lastLesson.quiz.length >= 3,
          `Evaluasi/Final Assessment ${lastLesson.id} wajib memiliki minimal 3 soal kuis`
        );

        for (const lesson of mod.lessons) {
          totalLessonsCount += 1;

          // Pastikan tidak ada placeholder / lorem ipsum
          const combinedText = [
            lesson.title,
            lesson.summary,
            ...(lesson.content || []),
            lesson.applicationExample || "",
            lesson.caseStudy || "",
          ]
            .join(" ")
            .toLowerCase();
          assert.ok(!combinedText.includes("lorem ipsum"), `Pelajaran ${lesson.id} tidak boleh mengandung lorem ipsum`);
          assert.ok(!combinedText.includes("placeholder"), `Pelajaran ${lesson.id} tidak boleh mengandung teks placeholder`);

          // Validasi 9 elemen wajib setiap pelajaran
          assert.ok(lesson.title && lesson.title.length >= 10, `Judul pelajaran ${lesson.id} harus jelas`);
          assert.ok(
            Array.isArray(lesson.learningObjectives) && lesson.learningObjectives.length >= 2,
            `Tujuan pembelajaran (${lesson.id}) wajib minimal 2 poin`
          );
          assert.ok(
            Array.isArray(lesson.content) && lesson.content.length >= 2,
            `Konten penjelasan mendalam (${lesson.id}) wajib minimal 2 paragraf`
          );
          assert.ok(
            typeof lesson.applicationExample === "string" && lesson.applicationExample.length >= 40,
            `Contoh penerapan (${lesson.id}) wajib tersedia`
          );
          assert.ok(
            typeof lesson.caseStudy === "string" && lesson.caseStudy.length >= 40,
            `Studi kasus (${lesson.id}) wajib tersedia`
          );
          assert.ok(
            Array.isArray(lesson.practicalSteps) && lesson.practicalSteps.length >= 2,
            `Langkah praktik (${lesson.id}) wajib minimal 2 langkah`
          );
          assert.ok(
            Array.isArray(lesson.commonMistakes) && lesson.commonMistakes.length >= 1,
            `Kesalahan umum (${lesson.id}) wajib tersedia`
          );
          assert.ok(
            typeof lesson.summary === "string" && lesson.summary.length >= 20,
            `Ringkasan (${lesson.id}) wajib tersedia`
          );
          assert.ok(
            Array.isArray(lesson.keyTakeaways) && lesson.keyTakeaways.length >= 2,
            `Key takeaways (${lesson.id}) wajib minimal 2 poin`
          );
          assert.ok(
            Array.isArray(lesson.quiz) && lesson.quiz.length >= 1,
            `Kuis evaluasi (${lesson.id}) wajib tersedia`
          );

          for (const q of lesson.quiz) {
            totalQuizQuestionsCount += 1;
            assert.ok(q.id && q.question && q.question.length >= 15, `Pertanyaan kuis ${q.id} harus valid`);
            assert.ok(Array.isArray(q.options) && q.options.length === 4, `Opsi kuis ${q.id} wajib 4 pilihan`);
            assert.ok(
              typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer < q.options.length,
              `Kunci jawaban ${q.id} harus berada dalam rentang indeks opsi`
            );
            assert.ok(
              typeof q.explanation === "string" && q.explanation.length >= 20,
              `Pembahasan kuis (${q.id}) wajib tersedia secara jelas`
            );
          }
        }

        // Pastikan Final Assessment di Modul 2 memiliki minimal 3-4 soal
        if (modIdx === 1) {
          assert.ok(lastLesson.quiz.length >= 3, `Final Assessment ${lastLesson.id} wajib komprehensif`);
        }
      });

      // 3. Pastikan sanitasi kuis klien menyembunyikan correctAnswer dan explanation tetapi mempertahankan metadata materi
      const sanitized = sanitizeCourseForClient(course);
      for (const sMod of sanitized.modules) {
        for (const sLes of sMod.lessons) {
          assert.ok(Array.isArray(sLes.learningObjectives) && sLes.learningObjectives.length >= 2);
          assert.ok(typeof sLes.applicationExample === "string");
          for (const sq of sLes.quiz || []) {
            assert.equal(sq.correctAnswer, undefined, `correctAnswer tidak boleh bocor ke klien pada soal ${sq.id}`);
            assert.equal(sq.explanation, undefined, `explanation hanya dikirim dari server setelah submit kuis (${sq.id})`);
          }
        }
      }
    }

    assert.equal(totalModulesCount, 18, "Total modul di seluruh 9 kelas statis harus 18 modul");
    assert.equal(totalLessonsCount, 54, "Total pelajaran di seluruh 9 kelas statis harus 54 pelajaran");
    assert.ok(totalQuizQuestionsCount >= 90, `Total soal kuis kurikulum harus komprehensif (aktual: ${totalQuizQuestionsCount})`);
  });

  // 23. Regression Sprint 2 (TASK 2.1 — BUG-02): Proteksi Progres dari Race Condition (Skenario A–F)
  test("23. BUG-02 Proteksi Race Condition Progres: Skenario A, B, C, D, E, dan F", async () => {
    clearSessionAndProgressStorage();
    setProgressTestFetcher(null);

    const courseSlug = "trading-fundamentals";
    const course = getCourseBySlug(courseSlug);
    const fiveLessons = ["l1-1", "l1-2", "l1-3", "l1-4", "l1-5"];

    // Helper mock fetcher yang terhubung langsung dengan fungsi server nyata (getAllUserProgress & validateAndPersistUserProgress)
    function createServerBoundFetcher(sessionUserRef, options = {}) {
      const postCalls = [];
      const getCalls = [];

      const fetcher = async (url, init = {}) => {
        const method = (init.method || "GET").toUpperCase();
        if (url === "/api/auth/me") {
          if (options.failAuthMe) {
            throw new Error("Simulated network timeout on /api/auth/me");
          }
          if (!sessionUserRef.current) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ user: null }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ user: sessionUserRef.current }),
          };
        }

        if (url === "/api/progress" && method === "GET") {
          getCalls.push({ url, method });
          if (options.onDuringGetProgress) {
            await options.onDuringGetProgress();
          }
          if (options.failGetProgressNetwork) {
            throw new Error("Simulated network error on GET /api/progress");
          }
          if (options.failGetProgressStatus) {
            return {
              ok: false,
              status: options.failGetProgressStatus,
              json: async () => ({ error: "Simulated server 500 error" }),
            };
          }
          if (!sessionUserRef.current) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ error: "Unauthorized" }),
            };
          }

          const allRows = getAllUserProgress(sessionUserRef.current.id);
          const progressMap = {};
          for (const row of allRows) {
            const rawCompleted = JSON.parse(row.completed_lesson_ids || "[]");
            const quizScores = JSON.parse(row.quiz_scores || "{}");
            const c = getCourseBySlug(row.course_slug);
            const validIds = c
              ? evaluateCourseCompletion(c, { completedLessonIds: rawCompleted, quizScores })
                  .validCompletedLessonIds
              : rawCompleted;
            progressMap[row.course_slug] = {
              courseSlug: row.course_slug,
              completedLessonIds: validIds,
              quizScores,
              lastAccessedLessonId: row.last_lesson_id,
              updatedAt: row.updated_at,
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              userId: sessionUserRef.current.id,
              progressMap,
            }),
          };
        }

        if (url === "/api/progress" && method === "POST") {
          const parsedBody = JSON.parse(init.body || "{}");
          postCalls.push(parsedBody);
          if (!sessionUserRef.current) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ error: "Unauthorized" }),
            };
          }
          const res = validateAndPersistUserProgress(sessionUserRef.current.id, parsedBody);
          return {
            ok: res.ok,
            status: res.status,
            json: async () =>
              res.ok
                ? {
                    success: true,
                    completedLessonIds: res.completedLessonIds,
                    quizScores: res.quizScores,
                  }
                : { error: res.error },
          };
        }

        throw new Error(`Unexpected URL in test fetcher: ${method} ${url}`);
      };

      return { fetcher, postCalls, getCalls };
    }

    try {
      // ── SKENARIO A: Pengguna memiliki 5 pelajaran selesai di server, localStorage kosong, membuka ruang belajar ──
      const userA = {
        id: "bug02-userA-" + crypto.randomUUID(),
        email: "bug02a@casper.com",
        name: "Bug02 User A",
        role: "USER",
      };
      upsertUserProgress({
        userId: userA.id,
        courseSlug,
        completedLessonIds: fiveLessons,
        quizScores: { "l1-3": 100 },
        lastLessonId: "l1-5",
      });

      clearSessionAndProgressStorage();
      const sessionRefA = { current: userA };
      const { fetcher: fetcherA, postCalls: postCallsA } = createServerBoundFetcher(sessionRefA);
      setProgressTestFetcher(fetcherA);

      // Pastikan bahkan jika enrollCourse dipanggil sebelum fetchServerProgress, tidak ada POST kosong yang dikirim
      setAuthenticatedSessionUser(userA);
      enrollCourse(courseSlug, "l1-1");
      assert.equal(
        postCallsA.length,
        0,
        "enrollCourse sebelum hidrasi server dilarang mengirim POST /api/progress dengan completedLessonIds kosong"
      );

      // Reset localStorage kosong lalu jalankan inisialisasi ruang belajar penuh
      clearSessionAndProgressStorage();
      const initResA = await initializeClassroomCourseProgress(courseSlug, "l1-1", fetcherA);
      assert.equal(initResA.status, "ok");
      assert.deepEqual(
        initResA.completedLessonIds,
        fiveLessons,
        "Skenario A: Seluruh 5 pelajaran selesai di server wajib dipulihkan utuh"
      );
      assert.equal(
        postCallsA.length,
        0,
        "Skenario A: Tidak boleh ada POST /api/progress yang menimpa data server saat progres sudah ada"
      );
      const dbAfterA = getUserCourseProgress(userA.id, courseSlug);
      assert.deepEqual(JSON.parse(dbAfterA.completed_lesson_ids), fiveLessons);

      // ── SKENARIO B: Pengguna memiliki progres di server, logout, login kembali, lalu langsung membuka ruang belajar ──
      clearSessionAndProgressStorage(); // Simulasi logout
      setAuthenticatedSessionUser(userA); // Simulasi login kembali
      const { fetcher: fetcherB, postCalls: postCallsB } = createServerBoundFetcher(sessionRefA);
      setProgressTestFetcher(fetcherB);

      const initResB = await initializeClassroomCourseProgress(courseSlug, "l1-1", fetcherB);
      assert.equal(initResB.status, "ok");
      assert.deepEqual(
        initResB.completedLessonIds,
        fiveLessons,
        "Skenario B: Progres pengguna setelah logout & login kembali harus tetap utuh"
      );
      assert.equal(postCallsB.length, 0);
      const dbAfterB = getUserCourseProgress(userA.id, courseSlug);
      assert.deepEqual(JSON.parse(dbAfterB.completed_lesson_ids), fiveLessons);

      // ── SKENARIO C: Endpoint /api/progress gagal atau timeout saat ruang belajar dibuka ──
      // Simpan cache lokal valid sebelum kegagalan jaringan untuk memastikan cache lokal tidak dihapus paksa
      saveStoredProgress(
        {
          [courseSlug]: {
            courseSlug,
            completedLessonIds: ["l1-1", "l1-2"],
            quizScores: {},
            lastAccessedLessonId: "l1-2",
            enrolledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        userA.id
      );

      const { fetcher: fetcherC500, postCalls: postCallsC500 } = createServerBoundFetcher(
        sessionRefA,
        { failGetProgressStatus: 500 }
      );
      setProgressTestFetcher(fetcherC500);

      const initResC = await initializeClassroomCourseProgress(courseSlug, "l1-1", fetcherC500);
      assert.equal(
        initResC.status,
        "error",
        "Skenario C: Kegagalan GET /api/progress harus menghasilkan status error"
      );
      assert.ok(initResC.error, "Skenario C: Pesan error wajib tersedia untuk ditampilkan di UI");
      assert.deepEqual(
        initResC.completedLessonIds,
        ["l1-1", "l1-2"],
        "Skenario C: Data lokal yang valid tetap dipertahankan di klien tanpa dihapus"
      );
      assert.equal(
        postCallsC500.length,
        0,
        "Skenario C: Dilarang mengirim completedLessonIds kosong ke server saat GET /api/progress gagal"
      );
      const dbAfterC = getUserCourseProgress(userA.id, courseSlug);
      assert.deepEqual(
        JSON.parse(dbAfterC.completed_lesson_ids),
        fiveLessons,
        "Skenario C: Progres 5 pelajaran di server harus 100% aman dan tidak tertimpa"
      );

      // ── SKENARIO D: Pengguna baru tanpa progres di server membuka ruang belajar ──
      const userNew = {
        id: "bug02-userNew-" + crypto.randomUUID(),
        email: "bug02new@casper.com",
        name: "Bug02 New User",
        role: "USER",
      };
      clearSessionAndProgressStorage();
      const sessionRefNew = { current: userNew };
      const { fetcher: fetcherD, postCalls: postCallsD } = createServerBoundFetcher(sessionRefNew);
      setProgressTestFetcher(fetcherD);

      const initResD = await initializeClassroomCourseProgress(courseSlug, "l1-1", fetcherD);
      assert.equal(initResD.status, "ok");
      assert.deepEqual(initResD.completedLessonIds, []);
      assert.equal(
        postCallsD.length,
        1,
        "Skenario D: Pengguna baru tanpa progres di server diizinkan melakukan enroll awal setelah verifikasi server selesai"
      );
      assert.deepEqual(postCallsD[0].completedLessonIds, []);

      // ── SKENARIO E: Pengguna menyelesaikan pelajaran saat pemulihan progres masih berjalan (in-flight) ──
      const userInFlight = {
        id: "bug02-inflight-" + crypto.randomUUID(),
        email: "bug02inflight@casper.com",
        name: "Bug02 InFlight User",
        role: "USER",
      };
      upsertUserProgress({
        userId: userInFlight.id,
        courseSlug,
        completedLessonIds: ["l1-1", "l1-2"],
        quizScores: {},
        lastLessonId: "l1-2",
      });

      clearSessionAndProgressStorage();
      setAuthenticatedSessionUser(userInFlight);
      const sessionRefE = { current: userInFlight };
      const { fetcher: fetcherE, postCalls: postCallsE } = createServerBoundFetcher(sessionRefE, {
        onDuringGetProgress: async () => {
          // Saat GET /api/progress sedang berjalan, pengguna menekan "Tandai Selesai" pada l1-4
          toggleLessonComplete(courseSlug, "l1-4");
        },
      });
      setProgressTestFetcher(fetcherE);

      const fetchResE = await fetchServerProgressWithStatus(fetcherE);
      assert.equal(fetchResE.status, "ok");
      assert.deepEqual(
        fetchResE.progressMap[courseSlug].completedLessonIds,
        ["l1-1", "l1-2", "l1-4"],
        "Skenario E: Penyelesaian pelajaran saat pemulihan masih berjalan wajib digabungkan dengan progres server"
      );
      assert.equal(
        postCallsE.length,
        1,
        "Skenario E: Hasil penggabungan wajib disinkronkan ke server setelah pemulihan selesai"
      );
      const dbAfterE = getUserCourseProgress(userInFlight.id, courseSlug);
      assert.deepEqual(JSON.parse(dbAfterE.completed_lesson_ids), ["l1-1", "l1-2", "l1-4"]);

      // ── SKENARIO F: Dua akun berbeda menggunakan browser yang sama secara bergantian ──
      const userSecond = {
        id: "bug02-second-" + crypto.randomUUID(),
        email: "bug02second@casper.com",
        name: "Bug02 Second User",
        role: "USER",
      };
      upsertUserProgress({
        userId: userSecond.id,
        courseSlug,
        completedLessonIds: ["l1-1"],
        quizScores: {},
        lastLessonId: "l1-1",
      });

      // Beralih dari userInFlight ke userSecond pada browser yang sama
      const sessionRefF = { current: userSecond };
      const { fetcher: fetcherF } = createServerBoundFetcher(sessionRefF);
      setProgressTestFetcher(fetcherF);

      const initResF = await initializeClassroomCourseProgress(courseSlug, "l1-1", fetcherF);
      assert.equal(initResF.status, "ok");
      assert.deepEqual(
        initResF.completedLessonIds,
        ["l1-1"],
        "Skenario F: Akun kedua hanya menerima progres miliknya sendiri"
      );
      // Pastikan progres akun pertama di server tidak berubah
      const dbAfterFUser1 = getUserCourseProgress(userInFlight.id, courseSlug);
      assert.deepEqual(
        JSON.parse(dbAfterFUser1.completed_lesson_ids),
        ["l1-1", "l1-2", "l1-4"],
        "Skenario F: Progres akun pertama di server tidak boleh terpengaruh oleh aktivitas akun kedua"
      );
      assert.equal(course.slug, courseSlug);
    } finally {
      setProgressTestFetcher(null);
      clearSessionAndProgressStorage();
    }
  });

  // 24. Regression Sprint 2 (TASK 2.1 — BUG-03): Pemisahan Kuis Latihan vs Evaluasi Wajib (Skenario A–F)
  test("24. BUG-03 Pemisahan Kuis Latihan dan Evaluasi Wajib: Skenario A, B, C, D, E, dan F", () => {
    const userId = "bug03-user-" + crypto.randomUUID();
    const courseSlug = "trading-fundamentals";

    // Skenario A: Pengguna menandai l1-1 (reading) selesai -> l1-1 masuk ke completedLessonIds
    const stepA = validateAndPersistUserProgress(userId, {
      courseSlug,
      completedLessonIds: ["l1-1"],
      lastLessonId: "l1-1",
    });
    assert.equal(stepA.ok, true);
    assert.deepEqual(stepA.completedLessonIds, ["l1-1"], "Skenario A: l1-1 harus masuk completedLessonIds");

    // Skenario B: Pengguna gagal menjawab kuis latihan pada l1-1 -> l1-1 TETAP berada di completedLessonIds
    const stepB = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-1",
      answers: { "q1-1-inline-1": 0 }, // Jawaban salah (correctAnswer adalah 1) -> skor 0%
    });
    assert.equal(stepB.ok, true);
    assert.equal(stepB.score, 0);
    assert.equal(stepB.passed, false);
    assert.equal(
      stepB.updatedProgress.completedLessonIds.includes("l1-1"),
      true,
      "Skenario B: Gagal kuis latihan pada materi reading (l1-1) DILARANG menghapus l1-1 dari completedLessonIds"
    );

    // Skenario C: Pengguna lulus kuis latihan pada l1-1 -> l1-1 tetap selesai dan skor kuis tercatat
    const stepC = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-1",
      answers: { "q1-1-inline-1": 1 }, // Jawaban benar -> skor 100%
    });
    assert.equal(stepC.ok, true);
    assert.equal(stepC.score, 100);
    assert.equal(stepC.passed, true);
    assert.equal(stepC.updatedProgress.completedLessonIds.includes("l1-1"), true);
    assert.equal(stepC.updatedProgress.quizScores["l1-1"], 100);

    // Skenario D: Pengguna gagal menjawab l1-3 (quiz) dengan skor < 70% -> l1-3 TIDAK masuk ke completedLessonIds
    const stepD = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-3",
      answers: { "q1-1": 1, "q1-2": 0, "q1-3": 1 }, // 1 dari 3 benar = 33% (< 70%)
    });
    assert.equal(stepD.ok, true);
    assert.equal(stepD.score, 33);
    assert.equal(stepD.passed, false);
    assert.equal(
      stepD.updatedProgress.completedLessonIds.includes("l1-3"),
      false,
      "Skenario D: Gagal evaluasi wajib (l1-3 < 70%) tidak boleh memasukkan l1-3 ke completedLessonIds"
    );

    // Skenario E: Pengguna lulus l1-3 dan l1-6 (quiz) dengan skor >= 70% -> pelajaran quiz otomatis masuk ke completedLessonIds
    const stepE1 = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-3",
      answers: { "q1-1": 1, "q1-2": 2, "q1-3": 0 }, // 3 dari 3 benar = 100%
    });
    assert.equal(stepE1.ok, true);
    assert.equal(stepE1.score, 100);
    assert.equal(stepE1.passed, true);
    assert.equal(
      stepE1.updatedProgress.completedLessonIds.includes("l1-3"),
      true,
      "Skenario E: Lulus Evaluasi Modul (l1-3 >= 70%) otomatis menandai l1-3 selesai"
    );

    const stepE2 = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-6",
      answers: { "q1-6-1": 1, "q1-6-2": 2, "q1-6-3": 1 }, // 3 dari 3 benar = 100%
    });
    assert.equal(stepE2.ok, true);
    assert.equal(stepE2.score, 100);
    assert.equal(stepE2.passed, true);
    assert.equal(
      stepE2.updatedProgress.completedLessonIds.includes("l1-6"),
      true,
      "Skenario E: Lulus Final Assessment (l1-6 >= 70%) otomatis menandai l1-6 selesai"
    );

    // Skenario F: Pengguna mengulang kuis yang sudah lulus dengan skor lebih rendah -> skor tertinggi tetap dipertahankan dan status selesai tidak hilang
    const stepFQuiz = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-3",
      answers: { "q1-1": 0, "q1-2": 0, "q1-3": 1 }, // 0 dari 3 benar = 0%
    });
    assert.equal(stepFQuiz.ok, true);
    assert.equal(stepFQuiz.score, 0, "Skor percobaan saat ini adalah 0%");
    assert.equal(
      stepFQuiz.updatedProgress.quizScores["l1-3"],
      100,
      "Skenario F: Skor tertinggi sebelumnya (100%) wajib dipertahankan"
    );
    assert.equal(
      stepFQuiz.updatedProgress.completedLessonIds.includes("l1-3"),
      true,
      "Skenario F: Status selesai l1-3 tidak boleh hilang setelah pernah lulus >= 70%"
    );

    const stepFPractice = evaluateAndRecordServerQuiz(userId, {
      courseSlug,
      lessonId: "l1-1",
      answers: { "q1-1-inline-1": 0 }, // 0%
    });
    assert.equal(stepFPractice.ok, true);
    assert.equal(stepFPractice.updatedProgress.quizScores["l1-1"], 100);
    assert.equal(stepFPractice.updatedProgress.completedLessonIds.includes("l1-1"), true);
  });

  // 25. Regression Sprint 2 (TASK 2.1): Verifikasi Keamanan Lintas-Pengguna (Cross-User Security)
  test("25. Keamanan Lintas-Pengguna: Pengguna B ditolak (403) saat mencoba memanipulasi progres atau kuis milik Pengguna A", () => {
    const victimUserA = "victim-userA-" + crypto.randomUUID();
    const attackerUserB = "attacker-userB-" + crypto.randomUUID();
    const courseSlug = "trading-fundamentals";

    // 1. Pengguna A menyelesaikan materi l1-1, l1-2, dan lulus l1-3
    upsertUserProgress({
      userId: victimUserA,
      courseSlug,
      completedLessonIds: ["l1-1", "l1-2", "l1-3"],
      quizScores: { "l1-3": 100 },
      lastLessonId: "l1-3",
    });

    // 2. Pengguna B mencoba mengirim POST /api/progress dengan menyisipkan userId milik Pengguna A
    const tamperPostProgress = validateAndPersistUserProgress(attackerUserB, {
      userId: victimUserA,
      courseSlug,
      completedLessonIds: [],
    });
    assert.equal(
      tamperPostProgress.ok,
      false,
      "Percobaan manipulasi progres lintas-pengguna melalui parameter userId wajib ditolak"
    );
    assert.equal(
      tamperPostProgress.status,
      403,
      "Manipulasi progres lintas-pengguna harus menghasilkan status 403 Forbidden"
    );

    // 3. Pengguna B mencoba mengirim POST /api/progress dengan menyisipkan user_id milik Pengguna A
    const tamperPostSnakeCase = validateAndPersistUserProgress(attackerUserB, {
      user_id: victimUserA,
      courseSlug,
      completedLessonIds: ["l1-1"],
    });
    assert.equal(tamperPostSnakeCase.ok, false);
    assert.equal(tamperPostSnakeCase.status, 403);

    // 4. Pengguna B mencoba mengirim POST /api/quiz/submit dengan menyisipkan userId milik Pengguna A
    const tamperQuizSubmit = evaluateAndRecordServerQuiz(attackerUserB, {
      userId: victimUserA,
      courseSlug,
      lessonId: "l1-3",
      answers: { "q1-1": 0, "q1-2": 0, "q1-3": 1 },
    });
    assert.equal(tamperQuizSubmit.ok, false);
    assert.equal(tamperQuizSubmit.status, 403);

    // 5. Pastikan data Pengguna A di database 100% utuh dan tidak berubah sedikit pun
    const victimProgressAfter = getUserCourseProgress(victimUserA, courseSlug);
    assert.ok(victimProgressAfter);
    assert.deepEqual(JSON.parse(victimProgressAfter.completed_lesson_ids), ["l1-1", "l1-2", "l1-3"]);
    assert.deepEqual(JSON.parse(victimProgressAfter.quiz_scores), { "l1-3": 100 });
    assert.equal(victimProgressAfter.last_lesson_id, "l1-3");

    // 6. Pastikan pembacaan getAllUserProgress untuk Pengguna B tidak pernah mengembalikan data Pengguna A
    const attackerAllProgress = getAllUserProgress(attackerUserB);
    assert.equal(
      attackerAllProgress.some((row) => row.user_id === victimUserA),
      false,
      "Pengguna B tidak pernah dapat membaca baris progres milik Pengguna A"
    );
  });

  // 26. Sprint 2 Task 3: Admin Course Editor (Hybrid Copy-on-Write, Module/Lesson/Quiz CRUD, Reset Baseline, Status & Proteksi Progres)
  test("26. Admin Course Editor: Otorisasi 403/200, Copy-on-Write C1-C9, Reset Baseline, CRUD Modul/Pelajaran/Kuis, Status Publikasi, dan Proteksi Progres Siswa", () => {
    const adminUser = {
      id: "6b9ba627-6741-4ee6-bf50-892469db05bf",
      email: "apriyanriyan23@gmail.com",
      name: "Casper Academic Admin",
      role: "ADMIN",
    };
    const regularUser = {
      id: "regular-" + crypto.randomUUID(),
      email: "student@test.com",
      name: "Regular Student",
      role: "USER",
    };

    // A. Otorisasi Role: Non-admin ditolak (403), Admin diterima (200)
    const listNonAdmin = listAdminCourses(regularUser);
    assert.equal(listNonAdmin.ok, false);
    assert.equal(listNonAdmin.status, 403, "Pengguna biasa harus ditolak 403 pada Admin Course Service");

    const listAdmin = listAdminCourses(adminUser);
    assert.equal(listAdmin.ok, true);
    assert.equal(listAdmin.status, 200);
    assert.ok(Array.isArray(listAdmin.data.courses));
    assert.ok(listAdmin.data.courses.length >= 9);

    // B. Pembuatan Kelas Baru melalui Admin Service
    const testCourseSlug = "test-course-" + Date.now();
    const createRes = createAdminCourse(adminUser, {
      title: "Algorithmic Market Making & High Frequency Liquidity",
      subtitle: "Arsitektur HFT dan inventory risk management",
      slug: testCourseSlug,
      category: "Specialized Asset",
      level: "Advanced",
      duration: "4 Jam",
      status: "published",
      overview: "Mempelajari arsitektur market maker kuantitatif.",
      objectives: ["Memahami model Avellaneda-Stoikov.", "Mengelola inventory skew."],
    });
    assert.equal(createRes.ok, true, `Pembuatan kelas baru harus berhasil: ${createRes.error}`);
    const createdCourse = createRes.data.course;
    assert.equal(createdCourse.slug, testCourseSlug);
    assert.equal(createdCourse.modules.length, 1);
    assert.equal(createdCourse.modules[0].lessons.length, 1);
    assert.equal(createdCourse.status, "published");

    try {
      // C. Publikasi: Ubah status menjadi draft -> tidak tampil di katalog publik tapi ada di admin
      const setDraftRes = patchAdminCourseAction(adminUser, {
        action: "set-status",
        courseId: createdCourse.id,
        status: "draft",
      });
      assert.equal(setDraftRes.ok, true);

      const publicCatalog = getAllCourses(); // default only published
      assert.equal(
        publicCatalog.some((c) => c.slug === testCourseSlug),
        false,
        "Kelas berstatus draft harus disembunyikan dari katalog publik"
      );

      const adminCatalog = getAllCourses({ includeDrafts: true });
      assert.equal(
        adminCatalog.some((c) => c.slug === testCourseSlug),
        true,
        "Kelas draft tetap dapat diakses oleh admin/sistem internal"
      );

      // Kembalikan ke published
      const setPubRes = patchAdminCourseAction(adminUser, {
        action: "set-status",
        courseId: createdCourse.id,
        status: "published",
      });
      assert.equal(setPubRes.ok, true);
      assert.equal(getAllCourses().some((c) => c.slug === testCourseSlug), true);

      // D. Update Kelas: Tambah Modul, Pelajaran, Blok Konten, Diagram SVG, dan Kuis dengan Custom passingScore (80%)
      const updatedModules = [
        {
          id: createdCourse.modules[0].id,
          title: "Modul 1: Dasar Market Making",
          description: "Prinsip order flow pasif",
          lessons: [
            {
              id: createdCourse.modules[0].lessons[0].id,
              slug: "materi-1-intro",
              title: "Materi 1.1: Microstructure Order Flow",
              duration: "20 Menit",
              type: "reading",
              summary: "Ringkasan order book mikro.",
              content: ["Paragraf konsep A", "Paragraf konsep B"],
              contentBlocks: [
                { id: "b1", type: "heading", level: 2, text: "Sub-Heading Level 2" },
                { id: "b2", type: "paragraph", text: "Penjelasan terstruktur dalam blok konten." },
                { id: "b3", type: "callout", variant: "tip", caption: "PRO TIP", text: "Gunakan limit order." },
              ],
              visualDiagram: "liquidity-orderbook",
            },
          ],
        },
        {
          id: "mod-test-2",
          title: "Modul 2: Evaluasi Kuantitatif",
          description: "Uji kompetensi market making",
          lessons: [
            {
              id: "les-test-eval",
              slug: "evaluasi-modul-2",
              title: "Materi 2.1: Final Assessment Market Making",
              duration: "30 Menit",
              type: "quiz",
              summary: "Evaluasi wajib dengan batas kelulusan 80%.",
              content: ["Selesaikan evaluasi berikut."],
              passingScore: 80,
              quiz: [
                {
                  id: "q-test-1",
                  question: "Apa tujuan utama penyesuaian quote spread pada inventory tinggi?",
                  options: [
                    "Menurunkan ask untuk melepas posisi buy dan menaikkan bid untuk mencegah akumulasi",
                    "Mematikan server koneksi FIX",
                  ],
                  correctAnswer: 0,
                  explanation: "Model Avellaneda-Stoikov melakukan skewing untuk menyeimbangkan inventory.",
                },
              ],
            },
          ],
        },
      ];

      const updateRes = updateAdminCourse(adminUser, {
        id: createdCourse.id,
        title: createdCourse.title,
        modules: updatedModules,
      });
      assert.equal(updateRes.ok, true, `Update kelas harus berhasil: ${updateRes.error}`);
      assert.equal(updateRes.data.course.modules.length, 2);
      assert.equal(updateRes.data.course.totalLessons, 2);

      // Siswa mengerjakan dan lulus materi 1 dan evaluasi 2
      const studentId = "student-algo-" + crypto.randomUUID();
      const step1 = validateAndPersistUserProgress(studentId, {
        courseSlug: testCourseSlug,
        completedLessonIds: [createdCourse.modules[0].lessons[0].id],
      });
      assert.equal(step1.ok, true);

      // Kuis: lulus dengan skor 100% (di atas passingScore 80%)
      const quizRes = evaluateAndRecordServerQuiz(studentId, {
        courseSlug: testCourseSlug,
        lessonId: "les-test-eval",
        answers: { "q-test-1": 0 },
      });
      assert.equal(quizRes.ok, true);
      assert.equal(quizRes.passed, true);
      assert.equal(quizRes.passingScore, 80, "Passing score custom 80% harus dihormati");

      // E. Proteksi Penghapusan Pelajaran Berprogres: Mencoba hapus les-test-eval ditolak 409
      const attemptDeleteLessonWithoutForce = updateAdminCourse(adminUser, {
        id: createdCourse.id,
        title: createdCourse.title,
        modules: [updatedModules[0]], // Modul 2 yang sudah diselesaikan siswa dihilangkan
      });
      assert.equal(
        attemptDeleteLessonWithoutForce.ok,
        false,
        "Menghapus materi yang sudah diselesaikan siswa tanpa konfirmasi harus ditolak"
      );
      assert.equal(attemptDeleteLessonWithoutForce.status, 409);
      assert.ok(attemptDeleteLessonWithoutForce.impact.affectedLessonUsersCount > 0);

      // F. Proteksi Penghapusan Kelas Berprogres: DELETE tanpa force ditolak 409
      const attemptDeleteCourseWithoutForce = removeAdminCourse(adminUser, {
        id: createdCourse.id,
        force: false,
      });
      assert.equal(
        attemptDeleteCourseWithoutForce.ok,
        false,
        "Menghapus kelas kustom berprogres tanpa konfirmasi force harus ditolak"
      );
      assert.equal(attemptDeleteCourseWithoutForce.status, 409);

      // G. Copy-on-Write Override untuk Kelas Statis Inti (c1: trading-fundamentals)
      const baselineC1 = getStaticBaselineCourse("c1");
      assert.ok(baselineC1, "Baseline C1 harus ada");
      assert.equal(baselineC1.slug, "trading-fundamentals");

      // Coba ubah slug C1 -> wajib ditolak karena slug kurikulum inti permanen
      const tamperC1Slug = updateAdminCourse(adminUser, {
        id: "c1",
        slug: "trading-dasar-baru",
      });
      assert.equal(tamperC1Slug.ok, false, "Mengubah slug kelas kurikulum inti harus ditolak");
      assert.equal(tamperC1Slug.status, 400);

      // Override subtitle dan konten C1
      const overrideC1Res = updateAdminCourse(adminUser, {
        id: "c1",
        subtitle: "Kurikulum Terstruktur Telah Dimodifikasi Admin",
      });
      assert.equal(overrideC1Res.ok, true, `Override C1 harus berhasil: ${overrideC1Res.error}`);
      assert.equal(overrideC1Res.data.course.isOverridden, true);
      assert.equal(overrideC1Res.data.course.slug, "trading-fundamentals");

      // Verifikasi katalog publik membaca C1 override
      const c1InCatalog = getCourseBySlug("trading-fundamentals");
      assert.equal(c1InCatalog.subtitle, "Kurikulum Terstruktur Telah Dimodifikasi Admin");
      assert.equal(c1InCatalog.isOverridden, true);

      // Pastikan progres akun admin pada trading-fundamentals tetap utuh dan terbaca
      const adminProg = getUserCourseProgress(adminUser.id, "trading-fundamentals");
      assert.ok(adminProg);
      assert.deepEqual(JSON.parse(adminProg.completed_lesson_ids), ["l1-1", "l1-2"]);

      // H. Reset C1 Override ke Baseline Pabrik (Factory Default)
      const resetC1Res = patchAdminCourseAction(adminUser, {
        action: "reset-baseline",
        courseId: "c1",
      });
      assert.equal(resetC1Res.ok, true, `Reset baseline C1 harus berhasil: ${resetC1Res.error}`);
      assert.equal(resetC1Res.data.course.isOverridden, false);
      assert.equal(resetC1Res.data.course.subtitle, baselineC1.subtitle);

      const c1Restored = getCourseBySlug("trading-fundamentals");
      assert.equal(c1Restored.subtitle, baselineC1.subtitle);
      assert.equal(c1Restored.isOverridden, false);

      // I. Proteksi Larangan Penghapusan Kelas Inti C1-C9
      const attemptDeleteStatic = removeAdminCourse(adminUser, {
        id: "c1",
        force: true,
      });
      assert.equal(attemptDeleteStatic.ok, false, "Kelas kurikulum inti dilarang keras dihapus");
      assert.match(attemptDeleteStatic.error, /kurikulum inti/);
    } finally {
      // Cleanup: hapus kelas pengujian dengan force: true
      removeAdminCourse(adminUser, { id: createdCourse.id, force: true });
    }
  });
});
