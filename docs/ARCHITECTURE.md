# Architecture — Modular Monolith

A single Next.js 13 app (UI + API). Backend logic is organized into **bounded feature modules** with explicit layers. One deploy, shared types/data, simple transactions.

## Layers

```
pages/api/*                      thin HTTP handlers (route + compose middleware)
  └─ lib/server/http             shared HTTP layer: withMethods/withAuth/withManager,
                                  withValidation (zod), ok/created/fail (respond)
       └─ lib/modules/<name>     a bounded module:
            <name>.schema.js       zod input validation
            <name>.policy.js       RBAC rules (assert*/can*)
            <name>.service.js      use cases — orchestrates repo + policy + audit
            <name>.repo.js         the ONLY place that touches Prisma for this module
       └─ lib/shared              AppError, Result helpers, constants
  └─ lib/db/prisma.js            single Prisma client
PostgreSQL
```

### Rules
1. A handler may call a module's **service** — never a repo directly, never another module's repo.
2. Only **`*.repo.js`** touches `prisma.*` for that module's tables. (Cross-module reads go through the other module's service.)
3. Services throw **`AppError`** (carries `statusCode` + i18n `code`); handlers map it once via **`fail(res, error)`**.
4. Validate at the edge with **zod** + `withValidation(schema, handler)`; the parsed DTO lands in `req.valid`.
5. Authorize twice (defense in depth): route guard (`withManager`, …) **and** `policy.assert*` inside the service.
6. Services receive a clean contract: `(validatedDto, actor)` where `actor = { userId, activeRole }`.

## Reference module: `projects`
- `lib/modules/projects/` — repo / policy / schema / service.
- Wired endpoints: `pages/api/projects/index.js` (GET public/manager list, POST create) and `pages/api/projects/[id].js` (GET/PUT/DELETE).
- Copy this shape for new/migrated modules.

### Handler template
```js
const { withMethods, withManager, withValidation, ok, created, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/<name>/<name>.service');
const { createSchema } = require('../../../lib/modules/<name>/<name>.schema');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'GET') return ok(res, await svc.list(actor));
    return await withValidation(createSchema, (r, s) =>
      svc.create(r.valid, actor).then((x) => created(s, x)))(req, res);
  } catch (e) { return fail(res, e); }
}
module.exports = withMethods(['GET', 'POST'], withManager(handler));
```

## Error → response contract
- Success: the data object/array.
- Error: `{ code: 'serverErrors.<area>.<name>', message: '<ar fallback>' }`. The client axios interceptor translates `code` to the active locale; `message` is the fallback.
- `respond.fail` also maps `ZodError` → 400 and Prisma `P2002`/`P2025` → 409/404.

## Migration playbook (incremental, non-breaking)
Per module, in order, one PR each:
1. Create `lib/modules/<name>/` with `repo` (move Prisma calls out of the legacy `lib/services/<name>.js`), `policy`, `schema`, `service`.
2. Rewire that area's `pages/api/<name>/*` handlers to the shared `lib/server/http` layer + the new service.
3. Delete the legacy `lib/services/<name>.js` once nothing imports it.
4. Add unit tests for the service/policy (mock the repo) — see "Testing" below.

Suggested module order: `projects` ✅ → `config` → `identity` (auth/users/roles) → `notifications`/`messaging` → `kpi` → `closure` (largest; do last, with tests first).

## Next steps to complete the architecture
- **TypeScript**: convert modules to `.ts` (Prisma already emits types). Start with `*.repo.ts`/`*.service.ts`.
- **Testing**: Vitest unit tests (services/policies/state machine) + API route tests (supertest, test DB) + a few Playwright e2e.
- **CI**: GitHub Actions → `prisma generate` · typecheck · lint · test · `next build`.
- **Migrations**: generate a Prisma baseline; use `migrate deploy` (not `db push`).
- **React Query** on the frontend to replace manual `useState/useEffect` fetching + bespoke caches.
- **Object storage** for images; **Redis (Upstash)** for rate-limit/cache.
