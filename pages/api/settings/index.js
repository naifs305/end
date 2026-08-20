// GET  /api/settings  — خريطة الإعدادات key/value (مصادق)
// PUT  /api/settings  — إدراج/تحديث مجموعة إعدادات (مدير فقط)
const { withMethods, withAuth, withManager, withValidation, ok, fail } = require('../../../lib/server/http');
const config = require('../../../lib/modules/config/config.service');
const { settingsBulkSchema } = require('../../../lib/modules/config/config.schema');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return withAuth(async (r, s) => {
        try {
          return ok(s, await config.getSettingsMap());
        } catch (e) {
          return fail(s, e);
        }
      })(req, res);
    }

    // PUT
    return withManager(
      withValidation(settingsBulkSchema, async (r, s) => {
        try {
          const actor = { userId: r.user.id, activeRole: r.activeRole };
          await config.bulkUpsertSettings(r.valid, actor);
          return ok(s, { updated: r.valid.length });
        } catch (e) {
          return fail(s, e);
        }
      })
    )(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'PUT'], handler);
module.exports.default = module.exports;
