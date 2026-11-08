# SIGNAL CASPER ACADEMY — SPRINT 3
# TASK 3.6 — AUTHORIZATION, PRIVACY/CONSENT & ANALYTICS API SPECIFICATION

**Document Version:** 1.0.0  
**Date:** 2026-11-08  
**Role:** Principal Software Architect & Security Engineer  
**Status:** IMPLEMENTED & 100% VERIFIED  

---

## 1. Daftar Endpoint API Sprint 3

| Endpoint | Metode | Deskripsi & Fungsi |
| :--- | :---: | :--- |
| `/api/journal/accounts` | `GET`, `POST`, `PUT`, `PATCH` | Daftar akun trading (dilengkapi `balanceSummary`), buat akun baru, ubah metadata, arsipkan (`action: "archive"`), dan pulihkan (`action: "restore"`). |
| `/api/journal/trades` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Daftar riwayat trade (mendukung filter), catat trade (`OPEN`/`CLOSED`), ubah trade, tutup trade (`action: "close"`), batalkan (`action: "cancel"`), dan hapus trade. |
| `/api/journal/cash` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Daftar transaksi kas (`DEPOSIT`/`WITHDRAWAL`), tambah deposit/withdrawal, ubah, dan hapus transaksi kas. |
| `/api/journal/analytics` | `GET` | Menjalankan Analytics Orchestration penuh (Core Metrics, Drawdown, Time-Series, Dimensional Slicer) dengan dukungan filter lengkap. |
| `/api/journal/consent` | `GET`, `POST`, `DELETE`, `PATCH` | Membaca status consent & audit trail, memberikan izin akses mentor (`ANALYTICS_ONLY` / `FULL_JOURNAL`), serta mencabut consent secara instan. |
| `/api/admin/journal-intelligence` | `GET` | Menyediakan agregat edukasi anonim (*Admin Student Intelligence*) khusus `ADMIN` / `MASTER_ADMIN` tanpa membocorkan jurnal pribadi siswa. |

---

## 2. Authorization Matrix (Server-Side Enforced)

| Aktor Pemanggil | Operasi pada Jurnal Sendiri | Baca Analitik Siswa Lain (`READ_ANALYTICS`) | Baca Jurnal Penuh Siswa Lain (`READ_FULL_JOURNAL`) | Mutasi Jurnal / Consent Siswa Lain | Akses `/api/admin/journal-intelligence` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Unauthenticated** | `401 Unauthorized` | `401 Unauthorized` | `401 Unauthorized` | `401 Unauthorized` | `401 Unauthorized` |
| **Student (`USER`)** | **200 / 201 Allowed** | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Mentor (`MENTOR`) — Tanpa Consent** | **200 / 201 Allowed** | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Mentor (`MENTOR`) — Consent `ANALYTICS_ONLY`** | **200 / 201 Allowed** | **200 Allowed (Logged)** | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Mentor (`MENTOR`) — Consent `FULL_JOURNAL`** | **200 / 201 Allowed** | **200 Allowed (Logged)** | **200 Allowed (Logged)** | `403 Forbidden` | `403 Forbidden` |
| **Mentor (`MENTOR`) — Setelah Consent Dicabut** | **200 / 201 Allowed** | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Admin (`ADMIN` / `MASTER_ADMIN`)** | **200 / 201 Allowed** | `403 Forbidden` *(Private by Default)* | `403 Forbidden` *(Private by Default)* | `403 Forbidden` | **200 Allowed (Anonymized Aggregate)** |

---

## 3. Model Privasi, Consent & Audit Trail (`lib/journal-consent.ts`)

1. **Private by Default:** Setiap partisi `u_[userId].json` memiliki `consent: null` secara default.
2. **Explicit Student Grant:** Hanya pemilik jurnal (`actor.id === studentId`) yang dapat memberikan izin (`grantStudentConsent`) dengan masa berlaku maksimal 90 hari.
3. **Instant Revocation:** Saat siswa memanggil `DELETE /api/journal/consent`, flag `isRevoked: true` dan `revokedAt` langsung ditulis secara atomik ke disk. Permintaan mentor berikutnya langsung ditolak (`403 Forbidden`).
4. **Immutable Audit Trail:** Setiap pembuatan akun, perubahan trade, pemberian/pencabutan consent, akses mentor, maupun percobaan akses ilegal dicatat ke `data/journals/audit/audit_u_[studentId].json`.

---

## 4. Hasil Pengujian Keamanan (`tests/journal-api-authorization.test.mjs`)

Seluruh 10 skenario keamanan (`SEC-01` s/d `SEC-10`) lulus 100% (`10/10 PASS`), memverifikasi proteksi terhadap IDOR, Broken Access Control, XSS payload injection, Path Traversal, serta kebocoran data privat pada endpoint Admin Intelligence.

