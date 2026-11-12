# SIGNAL CASPER ACADEMY — SPRINT 5
# REST API SPECIFICATION — REVISION 3

**Title:** Practical Drill & Readiness API Specification  
**Sprint:** Sprint 5  
**Document Version:** 3.0.0  
**Status:** PLANNING ONLY — REVISED POST PRODUCT OWNER CONSISTENCY REVIEW (REV 3)  
**Baseline:** Sprint 1–4 Accepted & Frozen  
**Date:** November 12, 2026  

---

## 1. AUTHORIZATION MATRIX & ENDPOINTS

| Endpoint | Method | Role Allowed | Description |
| :--- | :--- | :--- | :--- |
| `/api/drills` | `GET` | `STUDENT`, `ADMIN` | List published drills with student summary (`bestScore`, `isPassed`) |
| `/api/drills/[id]` | `GET` | `STUDENT`, `ADMIN` | Retrieve sanitized drill case (answer keys & solutions stripped) |
| `/api/drills/[id]/submit` | `POST` | `STUDENT`, `ADMIN` | Submit decision drill (idempotent, serialized, with safety gate check) |
| `/api/drills/[id]/solution`| `GET` | `STUDENT`, `ADMIN` | Retrieve solution overlay image (allowed **only** after submission) |
| `/api/drills/[id]/history` | `GET` | `STUDENT`, `ADMIN` | Retrieve student's immutable attempt history & derived summary |
| `/api/learning/checklist` | `POST` | `STUDENT`, `ADMIN` | Submit pre-session trade preparation checklist |
| `/api/admin/drills` | `GET` | `ADMIN` only | List all drills including DRAFT and ARCHIVED with aggregate metrics |
| `/api/admin/drills` | `POST` | `ADMIN` only | Create new drill case study draft |
| `/api/admin/drills/[id]` | `PUT` | `ADMIN` only | Update drill metadata, model answers, rubric, and price bounds |
| `/api/admin/drills/[id]/assets` | `POST` | `ADMIN` only | Upload PNG/WebP chart assets (SVG rejected by default) |
| `/api/admin/drills/[id]/publish` | `POST` | `ADMIN` only | Publish or archive drill (increments versions, copies clean static chart) |
| `/api/admin/drills/test-rubric` | `POST` | `ADMIN` only | Dry-run rubric simulation tool |

---

## 2. STUDENT DRILL ENDPOINTS

### 2.1 GET `/api/drills/[id]`
Retrieve sanitized drill case. Answer keys, instructor annotations, and solution overlays are completely stripped.

#### Success Response (`200 OK`):
```json
{
  "ok": true,
  "drill": {
    "id": "drill_xauusd_c1_01",
    "courseId": "course_xauusd_basic",
    "courseSlug": "xauusd-basic",
    "lessonId": "c1-market-structure",
    "title": "Studi Kasus 01: Identifikasi Liquidity Sweep H1",
    "slug": "xauusd-liquidity-sweep-h1",
    "drillType": "SETUP_EXECUTION",
    "drillVersion": 1,
    "rubricVersion": 1,
    "instrument": "XAUUSD",
    "timeframe": "H1",
    "dataPeriod": "2024-10-14 08:00 - 16:00 UTC",
    "dataSource": "Institutional Tick History (Curated)",
    "classification": "HISTORICAL_MARKET",
    "timezone": "UTC",
    "transformationNotes": "Asian session high highlighted; candle bodies unmodified",
    "priceBounds": {
      "minPrice": 2640.00,
      "maxPrice": 2680.00,
      "decimals": 2
    },
    "chartAssetUrl": "/drills/published/drill_xauusd_c1_01/v1/case.webp",
    "contextPrompt": "Harga baru saja melakukan sweep pada Asian Session High (2,668.50) dan menunjukkan formasi H1 rejection candle. Susun rencana eksekusi probabilitas tinggi Anda.",
    "instructions": [
      "Tentukan bias arah order flow dominan.",
      "Pilih apakah kondisi ini valid untuk ambil posisi atau NO-TRADE.",
      "Jika entry, tentukan level Entry, Invalidation (SL), dan Target (TP).",
      "Pilih konfirmasi struktur pendukung."
    ],
    "rubricCriteriaSummary": [
      { "id": "CRIT_BIAS", "name": "Bias & Market Context", "weight": 20 },
      { "id": "CRIT_ENTRY", "name": "Entry Zone Accuracy", "weight": 25 },
      { "id": "CRIT_INVALID", "name": "Invalidation (SL) Placement", "weight": 25, "safetyGateMin": 18 },
      { "id": "CRIT_RR", "name": "Risk/Reward Viability", "weight": 15 },
      { "id": "CRIT_CONFIRM", "name": "Structural Confirmation", "weight": 15 }
    ],
    "passingScore": 70,
    "safetyGateMin": 18,
    "userSummary": {
      "hasAttempted": true,
      "attemptsCount": 2,
      "firstScore": 60,
      "latestScore": 88,
      "bestScore": 88,
      "isPassed": true,
      "safetyGateMet": true
    }
  }
}
```

---

### 2.2 POST `/api/drills/[id]/submit`
Submit student decision. Evaluated server-side within the per-user mutex lock.

#### Headers Required:
- `Authorization`: Handled via HTTP-only cookie `sc_auth_token`
- `Content-Type`: `application/json`
- `Idempotency-Key`: `<uuid>` (e.g. `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`)

#### Request Payload:
```json
{
  "bias": "BEARISH",
  "isNoTrade": false,
  "entryPrice": 2666.80,
  "invalidationPrice": 2670.20,
  "targetPrice": 2655.00,
  "clickedCoordinates": {
    "entry": { "x": 0.65, "y": 0.33 },
    "invalidation": { "x": 0.65, "y": 0.24 },
    "target": { "x": 0.65, "y": 0.62 }
  },
  "selectedConfirmations": ["LIQUIDITY_SWEEP", "M15_CHOC", "FVG_TAP"],
  "rationaleText": "Asian High di-sweep lalu terbentuk M15 change of character dengan imbalance FVG di 2666.80. Target di sell-side liquidity 2655."
}
```

#### Success Response (`200 OK`):
```json
{
  "ok": true,
  "evaluation": {
    "submissionId": "sub_drill_1731234567_abc123",
    "attemptNumber": 3,
    "score": 92,
    "invalidationScore": 22,
    "safetyGatePassed": true,
    "evaluationStatus": "PASSED",
    "isPassed": true,
    "passingScore": 70,
    "safetyGateRequirement": 18,
    "calculatedRiskReward": 3.47,
    "criteriaBreakdown": [
      {
        "criterionId": "CRIT_BIAS",
        "criterionName": "Bias & Market Context",
        "pointsPossible": 20,
        "pointsEarned": 20,
        "status": "FULL_CREDIT",
        "explanation": "Tepat. Rejection pada Asian High mengindikasikan bias Bearish menuju liquidity pool di bawah."
      },
      {
        "criterionId": "CRIT_ENTRY",
        "criterionName": "Entry Zone Accuracy",
        "pointsPossible": 25,
        "pointsEarned": 25,
        "status": "FULL_CREDIT",
        "explanation": "Level entry 2,666.80 berada di dalam area Premium FVG yang optimal (2,666.50 - 2,667.50)."
      },
      {
        "criterionId": "CRIT_INVALID",
        "criterionName": "Invalidation (SL) Placement",
        "pointsPossible": 25,
        "pointsEarned": 22,
        "status": "FULL_CREDIT",
        "explanation": "Stop-Loss di 2,670.20 memenuhi standar keselamatan (≥18/25). Perlindungan berada di atas sweep high dengan buffer wajar."
      },
      {
        "criterionId": "CRIT_RR",
        "criterionName": "Risk/Reward Viability",
        "pointsPossible": 15,
        "pointsEarned": 15,
        "status": "FULL_CREDIT",
        "explanation": "R:R 1:3.47 melampaui syarat minimum institusional 1:2.0."
      },
      {
        "criterionId": "CRIT_CONFIRM",
        "criterionName": "Structural Confirmation",
        "pointsPossible": 15,
        "pointsEarned": 10,
        "status": "PARTIAL_CREDIT",
        "explanation": "Konfirmasi Liquidity Sweep dan FVG Tap tepat. M15 CHoCH belum tertutup sempurna pada timestamp ini."
      }
    ],
    "instructorDebrief": "Kasus ini memperlihatkan Judas Swing di pembukaan sesi London. Model eksekusi optimal adalah menunggu wick rejection sebelum entry limit di FVG.",
    "solutionOverlayUrl": "/api/drills/drill_xauusd_c1_01/solution",
    "updatedTopicMastery": "MASTERED"
  }
}
```

---

### 2.3 GET `/api/drills/[id]/solution`
Retrieve instructor solution overlay image.
* **Security & Pedagogical Access Policy**:
  - Requires valid student authentication.
  - Queries `drill_submissions` for `(user_id, drill_id)`.
  - **Allowed after Attempt 1**: Regardless of whether the first attempt passed or failed, students are granted access to the debrief and solution overlay to learn from their mistakes.
  - **Denied with 403 Forbidden** if the student has 0 submissions recorded on disk (`{"ok": false, "error": "Kunci solusi hanya dapat diakses setelah mengirimkan jawaban."}`).
  - Streams the file from `data/drills/solutions/[id]/` with `Content-Type: image/webp` and `Cache-Control: private, no-store`.

---

### 2.4 GET `/api/drills/[id]/history`
Retrieve student's immutable attempt history and derived progress summary.

#### Success Response (`200 OK`):
```json
{
  "ok": true,
  "summary": {
    "drillId": "drill_xauusd_c1_01",
    "attemptsCount": 2,
    "firstScore": 60,
    "firstAttemptPassed": false,
    "latestScore": 92,
    "bestScore": 92,
    "isPassed": true,
    "safetyGateMet": true,
    "firstAttemptAt": "2026-11-12T08:00:00.000Z",
    "lastAttemptAt": "2026-11-12T08:15:00.000Z"
  },
  "history": [
    {
      "submissionId": "sub_drill_01",
      "attemptNumber": 1,
      "drillVersion": 1,
      "rubricVersion": 1,
      "score": 60,
      "invalidationScore": 14,
      "safetyGatePassed": false,
      "evaluationStatus": "FAILED",
      "createdAt": "2026-11-12T08:00:00.000Z"
    },
    {
      "submissionId": "sub_drill_02",
      "attemptNumber": 2,
      "drillVersion": 1,
      "rubricVersion": 1,
      "score": 92,
      "invalidationScore": 22,
      "safetyGatePassed": true,
      "evaluationStatus": "PASSED",
      "createdAt": "2026-11-12T08:15:00.000Z"
    }
  ]
}
```

---

## 3. ADMIN ASSET UPLOAD ENDPOINT

### 3.1 POST `/api/admin/drills/[id]/assets`
Upload chart image. Accepts `multipart/form-data` with fields `file` and `assetType` (`DRAFT_CASE` or `SOLUTION_OVERLAY`).

#### Multi-Layer Validation:
- Accepts **PNG and WebP only**. SVG is rejected with `HTTP 400 Bad Request` (`"Format SVG ditolak. Gunakan PNG atau WebP."`).
- Binary magic bytes inspection matches genuine image signatures.
- Image dimensions parsed from header: width $\le 3840\text{px}$, height $\le 2160\text{px}$, total pixels $\le 8.3\text{M}$.
- Max file size: $2.5\text{MB}$.
- Server generates unique filename (`crypto.randomUUID() + ".webp"`).
- Saved to private staging directory `data/drills/drafts/[id]/` or `data/drills/solutions/[id]/`.
