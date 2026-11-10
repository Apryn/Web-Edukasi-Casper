# SIGNAL CASPER ACADEMY — SPRINT 5
# REST API SPECIFICATION

**Title:** Practical Drill & Readiness API Specification  
**Sprint:** Sprint 5  
**Document Version:** 1.0.0  
**Status:** PLANNING ONLY — NO IMPLEMENTATION  
**Date:** November 10, 2026  

---

## 1. AUTHORIZATION MATRIX

| Endpoint | Method | Role Allowed | Description |
| :--- | :--- | :--- | :--- |
| `/api/drills` | `GET` | `STUDENT`, `ADMIN` | List published drills with student completion status |
| `/api/drills/[id]` | `GET` | `STUDENT`, `ADMIN` | Retrieve sanitized drill case (answer keys stripped for students) |
| `/api/drills/[id]/submit` | `POST` | `STUDENT`, `ADMIN` | Submit decision drill for deterministic rubric grading |
| `/api/drills/[id]/history` | `GET` | `STUDENT`, `ADMIN` | Retrieve student's past attempts and debriefs for this drill |
| `/api/learning/checklist` | `POST` | `STUDENT`, `ADMIN` | Submit pre-session trade preparation checklist |
| `/api/learning/checklist/history`| `GET` | `STUDENT`, `ADMIN` | Retrieve student's past checklists |
| `/api/admin/drills` | `GET` | `ADMIN` only | List all drills including DRAFT and ARCHIVED with metrics |
| `/api/admin/drills` | `POST` | `ADMIN` only | Create new drill case study draft |
| `/api/admin/drills/[id]` | `PUT` | `ADMIN` only | Update drill metadata, chart assets, model answers, rubric |
| `/api/admin/drills/[id]/publish`| `POST` | `ADMIN` only | Change drill publication status (`PUBLISHED` / `ARCHIVED`) |
| `/api/admin/drills/test-rubric` | `POST` | `ADMIN` only | Test rubric evaluation with mock answers (dry-run simulation) |

---

## 2. STUDENT DRILL ENDPOINTS

### 2.1 GET `/api/drills/[id]`
Retrieve drill case for student practice.

#### Security & Answer Protection:
* Server invokes `sanitizeDrillForStudent(drill)`.
* **STRIPPED FIELDS**: `model_answer`, `rubric`, `solution_overlay_url`, `instructor_debrief`.

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
    "instrument": "XAUUSD",
    "timeframe": "H1",
    "dataSource": "Historical Gold Futures Data",
    "historicalDateRange": "2024-10-14 08:00 - 16:00 UTC",
    "verificationStatus": "VERIFIED_BY_ACADEMY_DESK",
    "chartAssetUrl": "/drills/charts/drill_xauusd_c1_01/case.webp",
    "contextPrompt": "Harga baru saja melakukan sweep pada Asian Session High (2,668.50) dan menunjukkan formasi H1 rejection candle. Susun rencana eksekusi probabilitas tinggi Anda.",
    "instructions": [
      "Tentukan bias arah order flow dominan.",
      "Tentukan apakah kondisi ini valid untuk entry atau No-Trade.",
      "Jika entry, tentukan level Entry, Invalidation (SL), dan Target (TP).",
      "Pilih konfirmasi struktur yang mendukung keputusan Anda."
    ],
    "rubricCriteriaSummary": [
      { "name": "Bias & Market Context", "weight": 20 },
      { "name": "Entry Zone Accuracy", "weight": 25 },
      { "name": "Invalidation (SL) Placement", "weight": 25 },
      { "name": "Risk/Reward Viability", "weight": 15 },
      { "name": "Structural Confirmation", "weight": 15 }
    ],
    "passingScore": 70,
    "userPreviousAttempt": {
      "hasAttempted": true,
      "bestScore": 65,
      "isPassed": false,
      "attemptsCount": 1
    }
  }
}
```

---

### 2.2 POST `/api/drills/[id]/submit`
Submit student technical decision for rubric grading.

#### Rate Limiting:
* Maximum 10 submissions per user per 15 minutes to prevent brute-force price guessing.

#### Request Payload:
```json
{
  "bias": "BEARISH",
  "isNoTrade": false,
  "entryPrice": 2666.80,
  "invalidationPrice": 2670.20,
  "targetPrice": 2655.00,
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
    "score": 92,
    "isPassed": true,
    "passingScore": 70,
    "calculatedRiskReward": 3.47,
    "criteriaBreakdown": [
      {
        "criterionId": "crit_bias",
        "criterionName": "Bias & Market Context",
        "pointsPossible": 20,
        "pointsEarned": 20,
        "status": "FULL_CREDIT",
        "explanation": "Tepat. Rejection pada Asian High mengindikasikan bias Bearish menuju liquidity pool di bawah."
      },
      {
        "criterionId": "crit_entry",
        "criterionName": "Entry Zone Accuracy",
        "pointsPossible": 25,
        "pointsEarned": 25,
        "status": "FULL_CREDIT",
        "explanation": "Level entry 2,666.80 berada di dalam area Premium FVG yang optimal (2,666.50 - 2,667.50)."
      },
      {
        "criterionId": "crit_invalidation",
        "criterionName": "Invalidation (SL) Placement",
        "pointsPossible": 25,
        "pointsEarned": 22,
        "status": "FULL_CREDIT",
        "explanation": "Stop-Loss di 2,670.20 memberikan perlindungan memadai di atas sweep high (2,669.50) dengan buffer wajar."
      },
      {
        "criterionId": "crit_rr",
        "criterionName": "Risk/Reward Viability",
        "pointsPossible": 15,
        "pointsEarned": 15,
        "status": "FULL_CREDIT",
        "explanation": "R:R 1:3.47 melampaui syarat minimum institusional 1:2.0."
      },
      {
        "criterionId": "crit_confirm",
        "criterionName": "Structural Confirmation",
        "pointsPossible": 15,
        "pointsEarned": 10,
        "status": "PARTIAL_CREDIT",
        "explanation": "Konfirmasi Liquidity Sweep dan FVG Tap tepat. M15 CHoCH belum tertutup sempurna pada timestamp ini."
      }
    ],
    "solutionOverlayUrl": "/drills/charts/drill_xauusd_c1_01/solution.webp",
    "instructorDebrief": "Kasus ini memperlihatkan textbook Judas Swing di pembukaan sesi London. Model eksekusi optimal adalah menunggu wick rejection sebelum entry limit di FVG.",
    "newMasteryLevel": "MASTERED"
  }
}
```

---

## 3. TRADE PREPARATION CHECKLIST API

### 3.1 POST `/api/learning/checklist`
Submit pre-session routine assessment.

#### Request Payload:
```json
{
  "sessionType": "LONDON_OPEN",
  "psychologicalReady": true,
  "calendarChecked": true,
  "setupConfirmed": true,
  "riskDefined": true,
  "executionPlanned": true,
  "riskPercentage": 1.0,
  "generalNotes": "Fokus hanya pada XAUUSD jika setup Liquidity Sweep muncul di London open."
}
```

#### Success Response (`200 OK`):
```json
{
  "ok": true,
  "checklistId": "chk_1731235678_xyz",
  "advisoryVerdict": "OPTIMAL",
  "advisoryMessage": "Kesiapan trading Anda lengkap. Disiplin pada batasan risiko 1.0% dan ikuti invalidation plan.",
  "createdAt": "2026-11-10T19:30:00.000Z"
}
```

---

## 4. ADMIN DRILL BUILDER API

### 4.1 POST `/api/admin/drills/test-rubric`
Simulate rubric scoring without persisting data (Dry-run).

#### Request Payload:
Contains complete `rubric`, `modelAnswer`, and simulated `mockSubmission`.

#### Success Response (`200 OK`):
Returns simulated `score`, `criteriaBreakdown`, and formula warnings (e.g. if sum of criterion weights $\ne 100$).

