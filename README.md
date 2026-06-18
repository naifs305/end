# Training Course Closure Platform — NAUSS

An internal platform for the Training Agency at **Naif Arab University for Security Sciences (NAUSS)** that manages the full lifecycle of training courses — from preparation through final closure — with a detailed performance (KPI) engine, internal messaging, gamification, scheduled automation, and bilingual (Arabic/English) UI.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 13 (pages router — UI + API in one app) |
| Database | PostgreSQL (Supabase) |
| ORM / data access | Prisma 5 |
| Auth | JWT (HS256), bcrypt, DB-driven authorization |
| Validation | Zod |
| Styling | Tailwind CSS (RTL/LTR), Cairo font, teal/gold glass design system |
| Icons | lucide-react |
| Charts / docs | recharts · jsPDF · xlsx |
| Email | Resend (+ `.eml` draft export) |
| i18n | DB-backed translations (Arabic/English) with bundled-JSON fallback |
| Testing / CI | Vitest · GitHub Actions |
| Hosting | Vercel (UI + API + cron) |

---

## Key features

- **Course closure workflow** — courses move through `PREPARATION → EXECUTION → AWAITING_CLOSURE → CLOSED → ARCHIVED`; each applicable *closure element* (reports, advances, settlements, tests, …) runs a state machine (`NOT_STARTED → PENDING_APPROVAL → APPROVED / REJECTED / RETURNED / NOT_APPLICABLE`) with deadlines, extensions, manager overrides, separation of duties, and automatic closure.
- **KPI engine** — periodic (monthly/quarterly/yearly) per-employee performance snapshots, weighted scores, leaderboards, and trends.
- **Motivation** — badges, an improvement-ideas bank, team challenges, and monthly pledges.
- **Communication** — internal messaging and notifications.
- **Reports** — opening / closing / field reports, exported as print-to-PDF or `.eml` drafts.
- **Scheduled jobs** — a single daily cron dispatches unlimited DB-defined jobs (delay checks, stale-element checks, KPI snapshots, lifecycle auto-advance, reminders) with retry/backoff.
- **Audit log**, **SOLF (advances) webhook integration**, and a fully **bilingual, RBAC-aware** interface.

---

## Roles & access control

Multi-role users (a person may hold any combination); the active role can be switched in the header.

- **Employee** — assigned to courses; executes closure elements.
- **Project Supervisor** — bound to one operational project; approves closure elements and oversees that project (manager powers scoped to their project, except performance evaluation).
- **Manager** — full access; exclusive right to evaluate performance and manage users/projects/closure-elements/jobs.
- **Quality Viewer** — read-only access to quality dashboards and reports.

Authorization is enforced **server-side** on every request (the user and active role are re-loaded from the DB, not trusted from the token).

---

## Architecture

A **modular monolith**: one Next.js deployment with a thin-handler / fat-service backend.

```
pages/api/*                 thin HTTP handlers (route + compose middleware)
  └─ lib/server/http        shared layer: withMethods/withAuth/withManager,
                            withValidation (zod), ok/created/fail (responses)
       └─ lib/modules/<x>   bounded feature modules:
            <x>.schema.js     zod input validation
            <x>.policy.js     RBAC rules
            <x>.service.js    use cases (orchestrate repo + policy + audit)
            <x>.repo.js       the only place that touches Prisma for <x>
       └─ lib/shared         AppError (statusCode + i18n code), helpers
  └─ lib/db/prisma.js        single Prisma client
PostgreSQL
```

Server errors return a stable `{ code, message }`; the client axios interceptor translates `code` into the active locale. See **`docs/ARCHITECTURE.md`** for the module pattern, rules, and migration playbook.

### Project layout
```
pages/            UI pages + pages/api/* routes
lib/
  server/http/    shared HTTP layer (auth/validation/response helpers)
  modules/        bounded modules (projects, config, identity, kpi, courses, closure, …)
  shared/         AppError + cross-cutting helpers
  services/       shared cross-cutting services (audit, permissions, emailService, notifications)
  db/ auth/ middleware/ reports/ email/ i18n/ hooks/
components/        React components (layout, charts, operational, shared)
context/           AuthContext
styles/            globals.css (design tokens + glass utilities)
prisma/            schema.prisma + seed scripts
docs/              ARCHITECTURE.md
public/            static assets (logo, images)
```

---

## Local setup

> **Note:** the dev server runs on **port 3010**. Use Node 20+.

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Set at least:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/<db>"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/<db>"
JWT_SECRET="<random string, 32+ chars — required in every environment>"
CRON_SECRET="<random string>"
WEBHOOK_SECRET="<random string>"
# optional
RESEND_API_KEY="re_..."          # omit → email runs in mock/log mode
NEXT_PUBLIC_SITE_URL="http://localhost:3010"
OFFICIAL_KPI_START="2026-06"
```
Generate a secret: `openssl rand -base64 32`.

### 3. Create the schema & seed
```bash
npx prisma db push      # creates all tables/indexes from schema.prisma
npm run seed            # base data (projects, closure elements, default jobs, admin)
npm run seed:config     # translations + option lists + system settings
npm run seed:demo       # rich demo data for every page (optional)
```
> Use `prisma db push` (not `migrate`) — the migration history has no baseline yet.

### 4. Run
```bash
npm run dev
```
Open **http://localhost:3010**.

### Demo login (after `seed:demo`)
- Manager: `mgr@demo.nauss.local` / `Demo@1234`
- Other roles: `sup1@demo.nauss.local`, `emp1@demo.nauss.local`, `qa@demo.nauss.local` (same password).

> ⚠️ The base seed also creates an initial admin with credentials defined in `prisma/seed.js` — **change its password after first login** (or move it to env vars) before any real deployment.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on :3010 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (next lint) |
| `npm test` / `npm run test:watch` | Vitest unit tests |
| `npm run seed` / `seed:config` / `seed:demo` | Base data / config & translations / demo data |
| `npx prisma db push` / `prisma studio` | Sync schema / DB GUI |

---

## Internationalization

Fully bilingual (Arabic default/RTL, English/LTR). UI strings resolve through `t()` (`lib/i18n`), which fetches translations from the DB `Translation` table and merges them over the bundled JSON dictionaries (instant fallback). Dropdown option lists come from the `OptionItem` table (`useOptions`) and system settings from `AppSetting` (`useSettings`). Switch language from the header globe — text **and** direction flip live.

---

## Scheduled jobs

A single daily Vercel cron (`/api/cron/run`, secured by `CRON_SECRET`) wakes once a day and runs every due `ScheduledJob`, so an unlimited number of jobs work on the free single-cron tier. Built-in types: course-delay checks, stale-element checks, KPI snapshots, course-lifecycle auto-advance, and reminders. Add jobs from the manager UI or:
```
POST /api/scheduled-jobs   { "name": "...", "type": "COURSE_DELAY_CHECK", "intervalHours": 24 }
```

---

## Reports

- **Opening report** (`opening_report`) and **closing report** (`closing_report`) — formal templates submitted as closure elements.
- **Field/notes report** — an archival report.
- Export: `GET /api/closure/[trackingId]/export` (print-to-PDF HTML) or `/export-eml` (`.eml` draft; recipients configurable via `AppSetting`).

---

## Deployment (Vercel)

1. Import the GitHub repo — Next.js is auto-detected.
2. Add the env vars from the local setup (Supabase `:6543` pooled URL for `DATABASE_URL`, `:5432` for `DIRECT_URL`, plus `JWT_SECRET`, `CRON_SECRET`, `WEBHOOK_SECRET`, optionally `RESEND_API_KEY`).
3. Deploy. Run `npx prisma db push` + the seed scripts against the production database once.
4. The daily cron is preconfigured in `vercel.json`.

---

## License

© Naif Arab University for Security Sciences — Training Agency. All rights reserved.
