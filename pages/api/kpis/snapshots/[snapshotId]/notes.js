// POST /api/kpis/snapshots/[snapshotId]/notes
const { withManager, withMethods, created, fail } = require('../../../../../lib/server/http');
const kpis = require('../../../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { snapshotId } = req.query;
  const { userId, note } = req.body || {};

  if (!userId || !note) {
    return res.status(400).json({ code: 'serverErrors.kpis.userIdAndNoteRequired', message: 'معرف المستخدم والملاحظة مطلوبان' });
  }

  try {
    const result = await kpis.addManagerNote(snapshotId, userId, req.user.id, note);
    return created(res, result);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
