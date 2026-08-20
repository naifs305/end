const { withMethods, withAuth } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');
const permissions = require('../../../../lib/services/permissions');
const { renderOpeningReport } = require('../../../../lib/reports/openingReport');
const { renderClosingReport } = require('../../../../lib/reports/closingReport');
const { buildEmlMessage, normalizeAttachments, sanitizeFilename } = require('../../../../lib/email/eml');
const configService = require('../../../../lib/modules/config/config.service');

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

  const element = await svc.getElementDetails(id);

  if (!element) {
    return res.status(404).json({ message: 'العنصر غير موجود', code: 'serverErrors.closureElements.notFound' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, element.course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بتنزيل هذا الملف', code: 'serverErrors.closure.downloadForbidden' });
  }

  const data = element.formData || {};
  const html = element.element.key === 'opening_report'
    ? renderOpeningReport({ course: element.course, element, data }, { mode: 'email' })
    : renderClosingReport({ course: element.course, element, data }, { mode: 'email' });

  const [toAddr, ccAddr] = await Promise.all([
    configService.getSetting('report.email.to', 'OD@NAUSS.EDU.SA'),
    configService.getSetting('report.email.cc', 'NALSHAHRANI@NAUSS.EDU.SA'),
  ]);

  const eml = buildEmlMessage({
    to: toAddr,
    cc: ccAddr,
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
