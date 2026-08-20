// GET /api/field-reports/[id]/export-eml
// تنزيل تقرير الملاحظات الميداني المؤرشف كمسودة بريد EML
const { withMethods, withAuth } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/reports/reports.service');
const permissions = require('../../../../lib/services/permissions');
const { renderNotesReport } = require('../../../../lib/reports/notesReport');
const { buildEmlMessage, normalizeAttachments, sanitizeFilename } = require('../../../../lib/email/eml');
const configService = require('../../../../lib/modules/config/config.service');

async function handler(req, res) {
  const { id } = req.query;

  const report = await svc.getFieldReportForExport(id);

  if (!report) {
    return res.status(404).json({ message: 'التقرير غير موجود', code: 'serverErrors.fieldReports.notFound' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, report.course);
  if (!canView && report.authorId !== req.user.id) {
    return res.status(403).json({ message: 'غير مصرح لك بتنزيل هذا الملف', code: 'serverErrors.closure.downloadForbidden' });
  }

  const data = report.formData || {};
  const html = renderNotesReport({ course: report.course, data }, { mode: 'email' });

  const [toAddr, ccAddr] = await Promise.all([
    configService.getSetting('report.email.to', 'OD@NAUSS.EDU.SA'),
    configService.getSetting('report.email.cc', 'NALSHAHRANI@NAUSS.EDU.SA'),
  ]);

  const eml = buildEmlMessage({
    to: toAddr,
    cc: ccAddr,
    subject: `تقرير ملاحظات عامة على الدورة - ${report.course?.name || 'دورة تدريبية'}`,
    htmlBody: html,
    attachments: normalizeAttachments(data.attachments),
  });

  const safeCourseName = sanitizeFilename(report.course?.name || 'course', 'course');
  res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="notes-report-${safeCourseName}.eml"`);
  return res.status(200).send(eml);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    responseLimit: '25mb',
  },
};
