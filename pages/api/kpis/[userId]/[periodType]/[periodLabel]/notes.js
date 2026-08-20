// POST /api/kpis/[userId]/[periodType]/[periodLabel]/notes
// إضافة ملاحظة مدير على لقطة KPI مُعرّفة بالموظف ونوع الفترة وتسميتها.
const { withManager, withMethods, created, fail } = require('../../../../../../lib/server/http');
const kpis = require('../../../../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { userId, periodType, periodLabel } = req.query;
  const { note } = req.body || {};

  if (!note || !String(note).trim()) {
    return res.status(400).json({ code: 'serverErrors.kpis.noteRequired', message: 'الملاحظة مطلوبة' });
  }

  try {
    const result = await kpis.addManagerNoteByPeriod(userId, periodType, periodLabel, req.user.id, note);
    return created(res, result);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
