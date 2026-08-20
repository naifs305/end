// GET  /api/options  — قائمة الخيارات (مصادق): ?category=CITY أو ?all=1 (مدير) لكل الصفوف
// POST /api/options  — إنشاء خيار جديد (مدير فقط)
const { withMethods, withAuth, withManager, withValidation, ok, created, fail } = require('../../../lib/server/http');
const config = require('../../../lib/modules/config/config.service');
const { optionCreateSchema } = require('../../../lib/modules/config/config.schema');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return withAuth(async (r, s) => {
        try {
          if (r.query.all === '1' && r.activeRole === 'MANAGER') {
            return ok(s, await config.listAllOptions());
          }
          return ok(s, await config.listOptions(r.query.category));
        } catch (e) {
          return fail(s, e);
        }
      })(req, res);
    }

    // POST
    return withManager(
      withValidation(optionCreateSchema, async (r, s) => {
        try {
          const actor = { userId: r.user.id, activeRole: r.activeRole };
          return created(s, await config.createOption(r.valid, actor));
        } catch (e) {
          return fail(s, e);
        }
      })
    )(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'POST'], handler);
module.exports.default = module.exports;
