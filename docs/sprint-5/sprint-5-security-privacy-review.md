# SIGNAL CASPER ACADEMY — SPRINT 5
# SECURITY, PRIVACY & APPLICATION INTEGRITY AUDIT — REVISION 3

**Title:** Practical Drill Threat Model & Security Controls  
**Sprint:** Sprint 5  
**Document Version:** 3.0.0  
**Status:** PLANNING ONLY — REVISED POST PRODUCT OWNER CONSISTENCY REVIEW (REV 3)  
**Baseline:** Sprint 1–4 Accepted & Frozen  
**Date:** November 12, 2026  

---

## 1. REVISED THREAT MODELING MATRIX (STRIDE)

| Threat Category | Attack Vector / Scenario | Severity | Mitigation & Architectural Control |
| :--- | :--- | :--- | :--- |
| **Information Disclosure** | Inspecting Network tab or DOM to retrieve `model_answer`, rubric tolerance, or solution overlay URL before submitting. | **HIGH** | Strict server-side payload projection (`sanitizeDrillForStudent`). The model answer, rubric weights, and solution image are stored exclusively in backend storage and stripped before JSON serialization. Solution overlay is served via authenticated endpoint only after submission. |
| **Cross-Site Scripting (XSS) via File Upload** | Attacker uploading an SVG containing embedded JavaScript (`<script>` or `<svg onload=...>`) disguised as a chart asset. | **CRITICAL** | **SVG is rejected by default**. Only PNG and WebP are accepted. Server inspects file magic bytes (binary file signatures), rejecting any file whose header does not match genuine PNG/WebP signatures regardless of extension. |
| **Decompression Bomb / Malicious Image Chunks** | Uploading an image with crafted dimensions (e.g. $100000 \times 100000$) designed to exhaust server memory. | **HIGH** | Server decodes IHDR/VP8 chunks to validate width ($\le 3840$), height ($\le 2160$), and total pixels ($\le 8,294,400$). Files exceeding limits are rejected immediately. |
| **Race Condition & Double-Submit** | Rapid duplicate POST requests causing race conditions in JSON DB or duplicate attempt numbers. | **HIGH** | Submissions are serialized per `(userId, drillId)` using an in-memory mutex (`withSubmissionLock`). Network retries are deduplicated using client-supplied `Idempotency-Key`. |
| **Premature Solution Access** | Student directly requesting `/api/drills/[id]/solution` before answering the case. | **HIGH** | Route handler queries `drill_submissions` for `(user_id, drill_id)`. If count is 0, returns `403 Forbidden` (`{"ok": false, "error": "Kunci solusi hanya dapat diakses setelah mengirimkan jawaban."}`). |
| **Insecure Direct Object Reference (IDOR)** | Student A viewing Student B's drill submissions or trade preparation checklist. | **HIGH** | Scoped database querying: `getDrillSubmissionsByUserId(session.user.id)`. Requests containing arbitrary `user_id` query params are ignored. |

---

## 2. MULTI-LAYER IMAGE VALIDATION PIPELINE

```typescript
export interface ImageValidationResult {
  ok: boolean;
  mime?: "image/png" | "image/webp";
  width?: number;
  height?: number;
  error?: string;
}

export function validateChartImageBuffer(buffer: Buffer): ImageValidationResult {
  // 1. File size check (Max 2.5 MB)
  if (buffer.length > 2.5 * 1024 * 1024) {
    return { ok: false, error: "Ukuran file melebihi batas maksimum 2.5 MB." };
  }

  // 2. Reject SVG unconditionally
  const headStr = buffer.slice(0, 100).toString("utf8").toLowerCase();
  if (headStr.includes("<svg") || headStr.includes("<?xml")) {
    return { ok: false, error: "Format SVG dilarang demi keamanan sistem. Gunakan PNG atau WebP." };
  }

  // 3. PNG Magic Bytes & Header Chunk Validation
  const isPng = buffer.length > 24 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;

  if (isPng) {
    // Read IHDR dimensions (offset 16: width 4 bytes, height 4 bytes BE)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width > 3840 || height > 2160 || (width * height) > 8294400) {
      return { ok: false, error: `Dimensi gambar (${width}x${height}) melebihi batas 3840x2160.` };
    }
    return { ok: true, mime: "image/png", width, height };
  }

  // 4. WebP Magic Bytes & Dimension Validation
  const isWebP = buffer.length > 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  if (isWebP) {
    // Basic WebP VP8/VP8L dimension inspection
    let width = 0;
    let height = 0;
    const formatChunk = buffer.toString("ascii", 12, 16);
    if (formatChunk === "VP8 ") {
      // Lossy VP8
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (formatChunk === "VP8L") {
      // Lossless VP8L
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      width = 1 + (((b2 & 0x3f) << 8) | b1);
      height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    } else {
      // VP8X Extended
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    }

    if (width > 3840 || height > 2160 || (width * height) > 8294400) {
      return { ok: false, error: `Dimensi gambar (${width}x${height}) melebihi batas 3840x2160.` };
    }
    return { ok: true, mime: "image/webp", width, height };
  }

  return { ok: false, error: "File bukan gambar PNG atau WebP yang valid." };
}
```

---

## 3. SOLUTION ENDPOINT ACCESS POLICY

```typescript
export async function verifySolutionAccess(userId: string, drillId: string): Promise<boolean> {
  const db = loadDatabase();
  const userSubmissions = (db.drill_submissions || []).filter(
    (s) => s.user_id === userId && s.drill_id === drillId
  );
  // Allowed if at least 1 submission is recorded (regardless of pass/fail)
  return userSubmissions.length > 0;
}
```
* **Pedagogical Feedback Alignment**: A student who fails their first attempt is granted access to the debrief and solution overlay to understand the structural error before attempting again.
* **Strict Privacy Isolation**: No admin access to private trading journals is granted through drill endpoints.
