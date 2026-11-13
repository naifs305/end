// POST /api/kpis/backfill-project-history
// استرجاع مشروع الأشهر الماضية من الدورات — للمدير فقط.
// يُطبَّق تلقائياً مرة واحدة عند الرفع، وهذا المسار لإعادة التشغيل
// عند الحاجة. آمن للتكرار: لا يمسّ لقطة سُجّل عليها مشروع.
const { withManager, withMethods, ok, fail } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  try {
    const result = await kpis.backfillSnapshotProjects(req.user.id);
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
