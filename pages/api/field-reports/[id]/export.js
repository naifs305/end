// GET /api/field-reports/[id]/export
// تصدير تقرير الملاحظات الميداني المؤرشف كصفحة HTML قابلة للطباعة
const { withMethods, withAuth } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/reports/reports.service');
const { renderNotesReport } = require('../../../../lib/reports/notesReport');

async function handler(req, res) {
  const { id } = req.query;

  const report = await svc.getFieldReportForExport(id);

  if (!report) {
    return res.status(404).json({ message: 'التقرير غير موجود', code: 'serverErrors.fieldReports.notFound' });
  }

  // التقارير الميدانية مفتوحة لكل المستخدمين — ليطّلع الزملاء على الملاحظات فيتلافوها

  const html = renderNotesReport({ course: report.course, data: report.formData || {} }, { mode: 'print' });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    responseLimit: '12mb',
  },
};
