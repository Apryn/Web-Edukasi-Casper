# SIGNAL CASPER ACADEMY — SPRINT 5
# SECURITY, PRIVACY & APPLICATION INTEGRITY AUDIT

**Title:** Practical Drill Threat Model & Security Controls  
**Sprint:** Sprint 5  
**Document Version:** 1.0.0  
**Status:** PLANNING ONLY — NO IMPLEMENTATION  
**Date:** November 10, 2026  

---

## 1. THREAT MODELING MATRIX (STRIDE)

| Threat Category | Attack Vector / Scenario | Severity | Mitigation & Architectural Control |
| :--- | :--- | :--- | :--- |
| **Information Disclosure** | Inspecting Network tab or client DOM to retrieve `model_answer`, rubric tolerance, or solution overlay URL before submitting. | **HIGH** | Strict server-side payload projection (`sanitizeDrillForStudent`). The model answer, rubric weights, and solution image are stored exclusively in backend storage and stripped before JSON serialization. |
| **Elevation of Privilege** | Student submitting an admin payload to create or publish a drill (`POST /api/admin/drills`). | **CRITICAL** | Handlers check `verifyAdminUser(session.user)` extracting role from signed HTTP-only JWT. |
| **Insecure Direct Object Reference (IDOR)** | Student A viewing Student B's drill submissions or trade preparation checklist. | **HIGH** | Scoped database querying: `getDrillSubmissionsByUserId(session.user.id)`. Requests containing arbitrary `user_id` query params are ignored. |
| **Malicious File Upload** | Attacker uploading an SVG containing embedded JavaScript (`<script>` or `<svg onload=...>`) disguised as a chart asset. | **CRITICAL** | Strict image validation: File magic bytes inspection (reject executable files), enforce MIME types (`image/png`, `image/webp`, `image/svg+xml`), and run regex sanitization on SVGs stripping all event handlers (`on\w+`), `<script>`, and `<foreignObject>` tags before saving to disk. |
| **Brute-Force Answer Guessing** | Student scripting rapid submission requests to probe price tolerances. | **MEDIUM** | Rate-limiting applied via `lib/rate-limit.ts`: Maximum 10 submissions per user per 15-minute window for drill evaluation routes. |
| **Production DB Override Risk** | Test runner or unauthorized call attempting to switch DB to test scratch during live usage. | **HIGH** | Pre-deployment hardening rule: In production runtime (`NODE_ENV === "production"`), path override is unconditionally disabled. |

---

## 2. ANSWER-KEY PROTECTION CONTRACT

```
       [ Client Browser ]
              │
              │  GET /api/drills/xauusd-01
              ▼
   ┌─────────────────────────────────────────┐
   │ Route: app/api/drills/[id]/route.ts     │
   │ Authenticates user via server-auth.ts    │
   └─────────────────────────────────────────┘
              │
              ▼
   ┌─────────────────────────────────────────┐
   │ Database Query: getDrillById(id)        │
   │ Loads raw DbDrillCase from academy.json │
   └─────────────────────────────────────────┘
              │
              ▼
   ┌────────────────────────────────────────────────────────┐
   │ FUNCTION: sanitizeDrillForStudent(rawDrill)            │
   │                                                        │
   │ const {                                                │
   │   model_answer,                                        │
   │   rubric,                                              │
   │   solution_overlay_url,                                │
   │   instructor_debrief,                                  │
   │   ...publicFields                                      │
   │ } = rawDrill;                                          │
   │                                                        │
   │ return {                                               │
   │   ...publicFields,                                     │
   │   rubricCriteriaSummary: rubric.criteria.map(c => ({   │
   │     name: c.name, weight: c.weight                     │
   │   }))                                                  │
   │ };                                                     │
   └────────────────────────────────────────────────────────┘
              │
              ▼
     Transmits Sanitized DTO (Zero secrets in payload)
```

---

## 3. FILE UPLOAD & ASSET SANITIZATION SPECIFICATION

Admin upload of chart case studies requires strict handling:
1. **Filename Sanitization**: Uploaded files are renamed using SHA-256 hashes:
   ```typescript
   const safeFileName = `${crypto.randomUUID()}.${ext}`;
   const targetPath = path.join(process.cwd(), "public", "drills", "charts", drillId, safeFileName);
   ```
2. **Directory Traversal Prevention**: Path resolution verifies that `targetPath.startsWith(path.resolve(process.cwd(), "public", "drills"))`.
3. **SVG Content Sanitizer**:
   ```typescript
   export function sanitizeSvgContent(rawSvg: string): string {
     return rawSvg
       .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
       .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
       .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "");
   }
   ```

---

## 4. AUDIT TRAIL LOGGING

All administrative modifications (creating drills, changing rubrics, uploading charts, toggling publication status) emit records into `admin_audit_logs`:
* **Action Types**:
  - `DRILL_CREATED`
  - `DRILL_UPDATED`
  - `DRILL_PUBLISHED`
  - `DRILL_ARCHIVED`
* **Recorded Metadata**: `admin_id`, `admin_email`, `action`, `target_drill_id`, `summary`, and `timestamp`.

