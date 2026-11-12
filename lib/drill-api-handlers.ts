/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Drill API Request Handlers (Task 5.4)
 *
 * Implements pure Web-standard request handlers for Drill fetching,
 * student submission evaluation, and solution authorization.
 */

import { getSessionUser, isAdmin } from "./auth";
import {
  getDrillById,
  getAllDrills,
  getDrillSubmissions,
  getAllSubmissionsForUser,
  computeStudentDrillSummary,
  recordDrillSubmission,
  getStudentDrillSummary,
} from "./drill-storage";
import {
  sanitizeDrillForStudent,
  evaluateDrillSubmission,
} from "./drill-evaluation-engine";
import { computeStudentDrillIntelligence } from "./drill-mastery-engine";
import { generateAdaptiveDrillRecommendations } from "./drill-recommendation-engine";
import { getDatabase } from "./db";
import type { StudentDrillAnswer } from "./drill-types";

export async function handleDrillGetRequest(
  req: Request,
  drillId: string
): Promise<Response> {
  try {
    const drill = getDrillById(drillId);

    if (!drill) {
      return Response.json(
        { error: "Studi kasus drill tidak ditemukan." },
        { status: 404 }
      );
    }

    const user = await getSessionUser(req);

    // If drill is in DRAFT status, restrict strictly to Admins
    if (drill.status === "DRAFT") {
      if (!user || !isAdmin(user)) {
        return Response.json(
          { error: "Studi kasus drill ini masih berstatus DRAFT dan belum dipublikasikan." },
          { status: 403 }
        );
      }
    }

    // Fetch user-specific progress if authenticated
    let userSummary = null;
    let submissions: ReturnType<typeof getDrillSubmissions> = [];

    if (user) {
      submissions = getDrillSubmissions(user.id, drill.id);
      userSummary = computeStudentDrillSummary(user.id, drill.id, submissions);
    }

    // Sanitize drill case to guarantee zero answer-key leakage
    const publicDrill = sanitizeDrillForStudent(drill, userSummary);

    return Response.json({
      success: true,
      drill: publicDrill,
      userSummary,
      submissionsCount: submissions.length,
      latestSubmission: submissions.length > 0 ? submissions[submissions.length - 1] : null,
      history: submissions.map((s) => ({
        id: s.id,
        attemptNumber: s.attempt_number,
        score: s.score,
        invalidationScore: s.invalidation_score,
        safetyGatePassed: s.safety_gate_passed,
        evaluationStatus: s.evaluation_status,
        createdAt: s.created_at,
      })),
    });
  } catch (err) {
    console.error("[DRILL API ERROR] Failed to fetch drill:", err);
    return Response.json(
      { error: "Terjadi kesalahan internal saat mengambil data studi kasus." },
      { status: 500 }
    );
  }
}

export async function handleDrillSubmitRequest(
  req: Request,
  drillId: string
): Promise<Response> {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return Response.json(
        { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    const drill = getDrillById(drillId);

    if (!drill) {
      return Response.json(
        { error: "Studi kasus drill tidak ditemukan." },
        { status: 404 }
      );
    }

    if (drill.status === "DRAFT" && !isAdmin(user)) {
      return Response.json(
        { error: "Studi kasus drill ini masih berstatus DRAFT dan belum dapat dikerjakan." },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "Payload pengajuan jawaban tidak valid." },
        { status: 400 }
      );
    }

    const {
      idempotencyKey,
      bias,
      isNoTrade = false,
      noTradeReason,
      entryPrice,
      invalidationPrice,
      targetPrice,
      clickedCoordinates,
      selectedConfirmations = [],
      rationaleText = "",
    } = body as Partial<StudentDrillAnswer> & { idempotencyKey?: string };

    // 1. Validation: Idempotency Key
    const safeIdempotencyKey = String(idempotencyKey || "").trim();
    if (!safeIdempotencyKey) {
      return Response.json(
        { error: "idempotencyKey wajib disertakan untuk pengiriman yang aman." },
        { status: 400 }
      );
    }

    // 2. Validation: Market Bias
    const validBiases = ["BULLISH", "BEARISH", "SIDEWAYS_NEUTRAL"];
    const safeBias = String(bias || "").toUpperCase().trim() as StudentDrillAnswer["bias"];
    if (!validBiases.includes(safeBias)) {
      return Response.json(
        { error: "Arah bias pasar wajib dipilih (BULLISH, BEARISH, atau SIDEWAYS_NEUTRAL)." },
        { status: 400 }
      );
    }

    // 3. Validation: Trade Stance vs NO-TRADE
    if (!isNoTrade) {
      if (
        typeof entryPrice !== "number" ||
        !Number.isFinite(entryPrice) ||
        typeof invalidationPrice !== "number" ||
        !Number.isFinite(invalidationPrice) ||
        typeof targetPrice !== "number" ||
        !Number.isFinite(targetPrice)
      ) {
        return Response.json(
          { error: "Harga Entry, Stop-Loss (Invalidasi), dan Target wajib diisi dengan angka valid." },
          { status: 400 }
        );
      }

      // Check inverted Stop-Loss
      if (safeBias === "BULLISH" && invalidationPrice >= entryPrice) {
        return Response.json(
          { error: "Untuk posisi Bullish/Long, Stop-Loss harus berada di bawah harga Entry." },
          { status: 400 }
        );
      }
      if (safeBias === "BEARISH" && invalidationPrice <= entryPrice) {
        return Response.json(
          { error: "Untuk posisi Bearish/Short, Stop-Loss harus berada di atas harga Entry." },
          { status: 400 }
        );
      }
      if (safeBias === "BULLISH" && targetPrice <= entryPrice) {
        return Response.json(
          { error: "Untuk posisi Bullish/Long, Target harus berada di atas harga Entry." },
          { status: 400 }
        );
      }
      if (safeBias === "BEARISH" && targetPrice >= entryPrice) {
        return Response.json(
          { error: "Untuk posisi Bearish/Short, Target harus berada di bawah harga Entry." },
          { status: 400 }
        );
      }
    } else {
      // NO-TRADE mode validation
      const safeReason = String(noTradeReason || "").trim();
      const safeRationale = String(rationaleText || "").trim();
      if (!safeReason && safeRationale.length < 5) {
        return Response.json(
          { error: "Keputusan NO-TRADE wajib menyertakan alasan struktural atau penjelasan analisis." },
          { status: 400 }
        );
      }
    }

    // Construct student answers object
    const studentAnswer: StudentDrillAnswer = {
      bias: safeBias,
      isNoTrade: Boolean(isNoTrade),
      noTradeReason: noTradeReason ? String(noTradeReason).trim() : undefined,
      entryPrice: typeof entryPrice === "number" ? entryPrice : undefined,
      invalidationPrice: typeof invalidationPrice === "number" ? invalidationPrice : undefined,
      targetPrice: typeof targetPrice === "number" ? targetPrice : undefined,
      clickedCoordinates,
      selectedConfirmations: Array.isArray(selectedConfirmations)
        ? selectedConfirmations.map((c) => String(c).trim()).filter(Boolean)
        : [],
      rationaleText: String(rationaleText || "").trim(),
    };

    // 4. Pure Deterministic Server-Side Evaluation
    const evalResult = evaluateDrillSubmission({
      submission: studentAnswer,
      modelAnswer: drill.model_answer,
      rubric: drill.rubric,
      instructorDebrief: drill.instructor_debrief,
    });

    // 5. Atomic Storage with Per-User/Drill Mutex and Idempotency
    const recordResult = await recordDrillSubmission({
      userId: user.id,
      drillId: drill.id,
      drillVersion: drill.drill_version,
      rubricVersion: drill.rubric_version,
      idempotencyKey: safeIdempotencyKey,
      score: evalResult.score,
      invalidationScore: evalResult.invalidationScore,
      safetyGatePassed: evalResult.safetyGatePassed,
      evaluationStatus: evalResult.evaluationStatus,
      rubricSnapshot: drill.rubric,
      answers: studentAnswer,
      evaluationBreakdown: evalResult.criteriaBreakdown,
      debriefText: evalResult.instructorDebrief,
    });

    const updatedSummary = getStudentDrillSummary(user.id, drill.id);

    return Response.json({
      success: true,
      isIdempotentReplay: recordResult.isIdempotentReplay,
      submission: recordResult.submission,
      evaluation: evalResult,
      updatedSummary,
    });
  } catch (err) {
    console.error("[DRILL SUBMIT ERROR] Failed to evaluate/record submission:", err);
    return Response.json(
      { error: "Terjadi kesalahan internal saat mengevaluasi jawaban drill." },
      { status: 500 }
    );
  }
}

export async function handleDrillSolutionRequest(
  req: Request,
  drillId: string
): Promise<Response> {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return Response.json(
        { error: "Sesi tidak valid. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const drill = getDrillById(drillId);

    if (!drill) {
      return Response.json(
        { error: "Studi kasus drill tidak ditemukan." },
        { status: 404 }
      );
    }

    // Access authorization check:
    // User must be an Admin, OR must have submitted at least 1 attempt on this drill
    const userSubmissions = getDrillSubmissions(user.id, drill.id);
    const hasAttempted = userSubmissions.length > 0;

    if (!hasAttempted && !isAdmin(user)) {
      return Response.json(
        {
          error:
            "Solusi dan anotasi instruktur hanya dapat diakses setelah Anda menyelesaikan minimal satu kali percobaan pada studi kasus ini.",
        },
        { status: 403 }
      );
    }

    return Response.json({
      success: true,
      drillId: drill.id,
      solutionOverlayUrl: drill.solution_overlay_path || null,
      instructorDebrief: drill.instructor_debrief,
      modelAnswer: {
        expectedBias: drill.model_answer.expectedBias,
        isNoTradeValid: drill.model_answer.isNoTradeValid,
        validNoTradeReasons: drill.model_answer.validNoTradeReasons,
        entryZone: drill.model_answer.entryZone,
        invalidationPrice: drill.model_answer.invalidationPrice,
        targetPrice: drill.model_answer.targetPrice,
        minimumRiskRewardRatio: drill.model_answer.minimumRiskRewardRatio,
        requiredConfirmations: drill.model_answer.requiredConfirmations,
      },
    });
  } catch (err) {
    console.error("[DRILL SOLUTION ERROR] Failed to fetch solution:", err);
    return Response.json(
      { error: "Terjadi kesalahan internal saat mengambil solusi drill." },
      { status: 500 }
    );
  }
}

export async function handleDrillMasteryGetRequest(req: Request): Promise<Response> {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return Response.json(
        { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    // IDOR Protection: Query parameters specifying userId are strictly ignored.
    // Calculations are scoped purely to the authenticated session user.id.
    const publishedDrills = getAllDrills({ status: "PUBLISHED" });
    const userSubmissions = getAllSubmissionsForUser(user.id);

    // Compute derived intelligence projection on-demand
    const drillIntelligence = computeStudentDrillIntelligence(
      user.id,
      publishedDrills,
      userSubmissions
    );

    // Load dismissals for recommendation suppression
    const db = getDatabase();
    const dismissals = Array.isArray(db.recommendation_dismissals)
      ? db.recommendation_dismissals
      : [];

    // Generate adaptive drill recommendations
    const drillRecommendations = generateAdaptiveDrillRecommendations({
      userId: user.id,
      publishedDrills,
      submissions: userSubmissions,
      intelligenceSummary: drillIntelligence,
      dismissals,
    });

    return Response.json({
      success: true,
      drillIntelligence,
      drillRecommendations,
    });
  } catch (err) {
    console.error("[DRILL MASTERY API ERROR] Failed to compute drill intelligence:", err);
    return Response.json(
      { error: "Terjadi kesalahan internal saat menghitung progres dan mastery drill." },
      { status: 500 }
    );
  }
}


