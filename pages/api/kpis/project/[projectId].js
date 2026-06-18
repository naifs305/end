// GET /api/kpis/project/[projectId]?periodType=MONTHLY&periodLabel=2026-01
const { withManagerOrSupervisor, withMethods, ok, fail } = require('../../../../lib/server/http');
const kpis = require('../../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { projectId } = req.query;
  const { periodType, periodLabel } = req.query;

  if (!periodType || !periodLabel) {
    return res.status(400).json({ code: 'serverErrors.kpis.periodTypeAndLabelRequired', message: 'periodType و periodLabel مطلوبان' });
  }

  // المشرف يستطيع فقط رؤية مشاريعه
  if (req.activeRole === 'PROJECT_SUPERVISOR') {
    const ids = req.scope?.supervisedProjectIds || [];
    if (!ids.includes(projectId)) {
      return res.status(403).json({ code: 'serverErrors.kpis.projectAccessDenied', message: 'غير مصرح لك بعرض بيانات هذا المشروع' });
    }
  }

  try {
    const data = await kpis.getProjectKpiSummary(projectId, periodType, periodLabel);
    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
