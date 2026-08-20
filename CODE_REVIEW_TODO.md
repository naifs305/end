# Code Review — Status

Findings from the full source review of the NAUSS Training-Course Closure Platform,
reconciled against the current code after the modular-monolith migration.

Legend: `[x]` done · `[~]` partially done / needs a product decision · `[ ]` open
🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

> **Note on paths:** the backend moved to a modular monolith. Logic that used to live in
> `lib/services/{courses,closure,reports,kpis,analytics,messages,scheduler,config,projects}.js`
> now lives under `lib/modules/<name>/` (`repo`/`policy`/`schema`/`service`). Only the shared
> cross-cutting services remain in `lib/services/` (`audit`, `permissions`, `notifications`, `emailService`).

---

## 🔴 Critical — all resolved

- [x] **C1** Hardcoded admin backdoor removed (login + seed).
- [x] **C2** `JWT_SECRET` mandatory in every environment (`lib/auth/jwt.js`).
- [x] **C3** Cron auth fail-closed + constant-time compare (`pages/api/cron/run.js`).
- [x] **C4** Motivation SQL parameterized (`lib/modules/motivation/motivation.repo.js`).
- [x] **C5** Course lifecycle state machine — `ALLOWED_TRANSITIONS` + `isValidCourseStatusTransition` (`lib/modules/courses/courses.service.js`).
- [x] **C6** Separation of duties — executor cannot decide the same element (`lib/modules/closure`; covered by `closure.service.test.js`).
- [x] **C7** Email/EML templates HTML-escape interpolated values.

## 🟠 High — resolved except one product decision

- [x] **H1** Server-side write authz on optional-reports & notes-report.
- [x] **H2** `QUALITY_VIEWER` scoping made explicit.
- [x] **H3** Stopped emailing cleartext passwords (set-password link).
- [x] **H4** Token revocation via `tokenVersion`; 401→logout interceptor.
- [x] **H5** Wired the weights in. `resolveWeights()` now (a) normalizes intra-category sub-weights so each category score is a proper 0–100 average — fixing a latent deflation bug under settings — and (b) derives the six-category `finalBlend` from the settings' category totals (timing & critical fixed, as they have no DB weight). The stored `finalScore` now reflects `EmployeeKpiSetting` instead of hardcoded constants; falls back to the exact prior blend when no settings row exists. **Note:** there's no edit UI yet — weights come from the seed; and live scores shift (the deflation fix raises previously-deflated scores), so recompute snapshots after deploy.
- [x] **H6** `supervisor-performance` period filter fixed for all period types.
- [x] **H7** Atomic element state-machine guards (`status` in `where`; transactional close).
- [x] **H8** Constant-time webhook/cron secret compare; secret via header.
- [x] **H9** User-update mass-assignment replaced with an explicit allowlist (`identity.schema.js` `USER_UPDATE_ALLOWLIST`).

## 🟡 Medium

- [x] **M1** Honor `isDeadlineWorkingDays` — added `addDeadlineHours()` (skips Fri/Sat) and applied it at both KPI deadline sites (`calcElementTimeScore`, `buildElementBreakdown`).
- [x] **M2** Removed dead `firstPassElements` logic.
- [x] **M3** Scheduled jobs retry/backoff (`lib/modules/scheduling/scheduling.service.js`).
- [x] **M4** Password policy unified — all password-**setting** schemas use 8-char + complexity (`identity.schema.js`); login keeps the lighter 6-char input check by design.
- [x] **M5** Hardened in place: anti-spoof IP derivation (`x-real-ip`, else `x-forwarded-for` counted from the trusted end via `TRUST_PROXY_HOPS`), and a **pluggable async store** — default in-memory, swap a shared backend via `setRateLimitStore()` (prefers an atomic `incr` op for cross-instance correctness). A real Upstash/Redis adapter can drop in without touching call sites.
- [x] **M6** KPI hot loops index by `Map`; notify/email loops batched.
- [x] **M7** Scoped messaging to project + managers. Non-managers see/can-message only their own project members, MANAGERs, and their project's supervisors; MANAGERs are unrestricted. Enforced **server-side in both** the directory (`getUsersForMessaging`) and `sendMessage` (403 for out-of-scope recipients) — not just hidden in the UI.
- [x] **M8** `intervalHours` coerced in job update.
- [x] **M9** Webhook force-approve & element-withdraw now audited (`ELEMENT_WITHDRAWN`).
- [x] **M10** Reset flow uses typed Prisma (no `RawUnsafe`).

## 🟢 Low

- [x] **L1** Conditional-hook ordering fixed in `pages/kpis.js` (hooks precede early returns).
- [x] **L2** `pages/quality.js` uses `reportKey` and branches to `/field-reports/{id}/export` for notes reports.
- [x] **L3** `pages/approvals.js` guards null employee name (`(group.employeeName || '?').charAt(0)`).
- [x] **L4** Course filters: list payload includes `closureElements: { status }`; filter buttons match `courseType` values.
- [x] **L8** `prompt()`/`confirm()` replaced with styled modals; `aria-label` on icon buttons; Esc-to-close; **focus-trap** added via the shared `useFocusTrap` hook (initial focus, Tab/Shift+Tab cycling, focus restored on close) and wired into `Modal`, `ConfirmModal`, `ReasonModal`.
- [x] **L9** Removed the stray duplicate route `pages/api/kpis/snapshotId/[snapshotId]/notes.js`.
- [x] **Bug found during reconciliation:** the manager "add KPI note" action posted to `/kpis/{userId}/{periodType}/{periodLabel}/notes`, which had **no handler** (404). Added `pages/api/kpis/[userId]/[periodType]/[periodLabel]/notes.js` + `kpi.service.addManagerNoteByPeriod()` (resolves the snapshot by the composite key, reuses `addManagerNote`).

- [x] **L5** Already addressed — `pages/archive.js` export handlers already try/catch + `toast.error`. All other swallowed catches are passive background loads or non-destructive optimistic updates (left intentionally).
- [x] **L6** Already de-hardcoded — no `[2024..2027]` arrays remain; `kpis.js`/`executive-report.js` compute year options from `new Date().getFullYear()`. One literal left: `OFFICIAL_START='2026-06'` in `kpis.js` (a client component) has no `NEXT_PUBLIC_*` env to read; needs `NEXT_PUBLIC_OFFICIAL_KPI_START` if it should be configurable (env owner's call).
- [x] **L10** Already done — all chart components (`RadarKPI`, `StatusDonut`, `TeamBarChart`) export via `memo()`, and `radarData` in `kpis.js` is `useMemo`'d.
- [x] **L11** Removed dead code: unused `dynamic`+`RadarKPI` (`quality.js`), unused `dynamic`+`TeamBarChart` (`executive-report.js`), unused `locale` (`quality.js`).
- [x] **L12** KPI metric correctness: added `Course.closedAt` (set on every CLOSED transition), and `avgCourseClosureDelayDays` now uses `closedAt || updatedAt`; stale-element baseline now uses the element's actionable date (deadline ref point) instead of `course.createdAt`. **Needs `prisma db push`** to add the `closedAt` column.

---

## What genuinely remains

All Critical/High/Medium items and the low-priority polish are now closed. Optional follow-ups, each gated on infra/product input you'd provide:

1. **KPI settings edit UI (H5):** weights now drive the score but come from the seed — there's no admin screen to edit `EmployeeKpiSetting`. Add one if admins should tune weights at runtime.
2. **Shared rate-limit backend (M5):** the limiter is pluggable; provide Upstash/Redis credentials to make it truly multi-instance on Vercel.
3. **`NEXT_PUBLIC_OFFICIAL_KPI_START` (L6):** add the env var if the official KPI start month should be configurable on the client.
4. **Deploy steps:** run `npx prisma db push` (adds `Course.closedAt`) and recompute KPI snapshots (H5 weight-wiring + the deflation fix shift live scores).

_Reconciled after the modular-monolith migration + H5/M5/M7 + M1/L12 + L-series polish. Test suite: 64/64 passing._
