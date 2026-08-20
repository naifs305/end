// GET  /api/translations  — القواميس المتداخلة { ar, en } (عام، قبل الدخول)
//                            ?format=list يعيد الصفوف المسطّحة (لمحرّر الإدارة)
// PUT  /api/translations   — إدراج/تحديث مجموعة ترجمات (مدير فقط)
const { withMethods, withManager, withValidation, ok, fail } = require('../../../lib/server/http');
const config = require('../../../lib/modules/config/config.service');
const { translationsBulkSchema } = require('../../../lib/modules/config/config.schema');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // format=list يعيد الصفوف المسطّحة (لمحرّر لوحة الإدارة)
      if (req.query.format === 'list') {
        return ok(res, await config.listTranslations());
      }
      const dicts = await config.getTranslationsNested();
      // تخزين مؤقت قصير على الحافة لتقليل الضغط
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return ok(res, dicts);
    }

    // PUT
    return withManager(
      withValidation(translationsBulkSchema, async (r, s) => {
        try {
          const actor = { userId: r.user.id, activeRole: r.activeRole };
          await config.bulkUpsertTranslations(r.valid, actor);
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
