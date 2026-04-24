const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderOpeningReport } = require('../../../../lib/reports/openingReport');
const { renderClosingReport } = require('../../../../lib/reports/closingReport');
const { buildEmlMessage, normalizeAttachments, sanitizeFilename } = require('../../../../lib/email/eml');

function buildSubject(courseName, elementKey) {
  const label = elementKey === 'opening_report' ? 'تقرير افتتاح الدورة' : 'تقرير اختتام الدورة';
  return `${label} - ${courseName || 'دورة تدريبية'}`;
}

function buildFilename(courseName, elementKey) {
  const prefix = elementKey === 'opening_report' ? 'opening-report' : 'closing-report';
  const safeCourseName = sanitizeFilename(courseName || 'course', 'course');
  return `${prefix}-${safeCourseName}.eml`;
}

async function handler(req, res) {
  const { id } = req.query;

  const element = await prisma.courseClosureTracking.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: true,
        },
      },
      element: true,
    },
  });

  if (!element) {
    return res.status(404).json({ message: 'العنصر غير موجود' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, element.course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بتنزيل هذا الملف' });
  }

  const data = element.formData || {};
  const html = element.element.key === 'opening_report'
    ? renderOpeningReport({ course: element.course, element, data }, { mode: 'email' })
    : renderClosingReport({ course: element.course, element, data }, { mode: 'email' });

  const eml = buildEmlMessage({
    to: 'OD@NAUSS.EDU.SA',
    cc: 'NALSHAHRANI@NAUSS.EDU.SA',
    subject: buildSubject(element.course?.name, element.element.key),
    htmlBody: html,
    attachments: normalizeAttachments(data.attachments),
  });

  res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(element.course?.name, element.element.key)}"`);
  return res.status(200).send(eml);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    responseLimit: '25mb',
  },
};
