// GET /api/field-reports/[id]/export-eml
// تنزيل تقرير الملاحظات الميداني المؤرشف كمسودة بريد EML
const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderNotesReport } = require('../../../../lib/reports/notesReport');
const { buildEmlMessage, normalizeAttachments, sanitizeFilename } = require('../../../../lib/email/eml');

async function handler(req, res) {
  const { id } = req.query;

  const report = await prisma.fieldReport.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: true,
        },
      },
    },
  });

  if (!report) {
    return res.status(404).json({ message: 'التقرير غير موجود' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, report.course);
  if (!canView && report.authorId !== req.user.id) {
    return res.status(403).json({ message: 'غير مصرح لك بتنزيل هذا الملف' });
  }

  const data = report.formData || {};
  const html = renderNotesReport({ course: report.course, data }, { mode: 'email' });

  const eml = buildEmlMessage({
    to: 'OD@NAUSS.EDU.SA',
    cc: 'NALSHAHRANI@NAUSS.EDU.SA',
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
