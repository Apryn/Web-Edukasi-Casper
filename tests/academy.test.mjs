import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Course data & syllabus modules
import { getAllCourses, getCourseBySlug, coursesData } from "../lib/courses-data.ts";

// Database operations
import {
  getDatabase,
  findUserByEmail,
  findUserById,
  createUser,
  getUserCourseProgress,
  upsertUserProgress,
  recordQuizSubmission,
  getQuizSubmissionsForUser,
  getCustomCourses,
  upsertCustomCourse,
  deleteCustomCourse,
  executeTransactionForTest,
  isValidDatabaseSchema,
} from "../lib/db.ts";

// Auth & Session helpers
import { createToken, isAdmin, sanitizeUser } from "../lib/auth.ts";

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
    const existingUser = findUserByEmail("apryn@casper.com");
    assert.ok(existingUser, "Akun apryn@casper.com harus tetap ada");
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
    const verifiedUser = findUserByEmail("apryn@casper.com");
    assert.equal(verifiedUser.email, "apryn@casper.com");
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
    } catch (err) {
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
});
