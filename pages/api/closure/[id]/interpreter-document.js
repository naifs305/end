// =============================================================
// GET /api/closure/[id]/interpreter-document
// -------------------------------------------------------------
// يُخرج مستند المترجم المناسب للعنصر، ويختاره من مفتاح العنصر نفسه
// فلا يختار المنسق شيئاً ولا يخطئ:
//   interpreter_contract    → عقد ترجمة (صفحة تُعدَّل ثم تُطبع PDF)
//   interpreter_advance     → نموذج استحقاق (كذلك)
//   interpreter_certificate → شهادة إنجاز ترجمة (كذلك)
//   interpreter_transfer    → رسالة طلب صرف جاهزة (ملف EML)
// =============================================================
const { withMethods, withAuth } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');
const interpreterSvc = require('../../../../lib/modules/courses/interpreter.service');
const permissions = require('../../../../lib/services/permissions');
const configService = require('../../../../lib/modules/config/config.service');
const { buildEmlMessage, sanitizeFilename } = require('../../../../lib/email/eml');
const {
  CONTRACT_DEFAULTS,
  renderInterpreterContract,
  renderInterpreterEntitlement,
  renderInterpreterCertificate,
  renderInterpreterTransferEmail,
} = require('../../../../lib/reports/interpreterDocs');

// جهة طلب صرف مستحقات المترجم — قابلة للتغيير من إعدادات المنصة
const TRANSFER_RECIPIENT_KEY = 'interpreter.transfer.email.to';
const TRANSFER_RECIPIENT_DEFAULT = 'AAlfaifi@nauss.edu.sa';

async function handler(req, res) {
  const { id } = req.query;

  const element = await svc.getElementDetails(id);

  if (!element) {
    return res.status(404).json({ message: 'العنصر غير موجود', code: 'serverErrors.closureElements.notFound' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, element.course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بعرض هذا المستند', code: 'serverErrors.closure.viewReportForbidden' });
  }

  const key = element.element?.key;
  if (!svc.INTERPRETER_ELEMENT_KEYS.includes(key)) {
    return res.status(400).json({ message: 'هذا العنصر ليس من مستندات المترجم', code: 'serverErrors.interpreter.notInterpreterElement' });
  }

  const course = element.course;
  const interpreter = course?.interpreter;

  if (!interpreter) {
    return res.status(400).json({
      message: 'أدخل بيانات المترجم أولاً — المستند يُبنى منها',
      code: 'serverErrors.interpreter.dataMissing',
    });
  }

  // مستند مالي بخانة ناقصة لا قيمة له — نقول ما ينقص بدل إخراجه ناقصاً
  const missing = interpreterSvc.missingForDocument(key, interpreter);
  if (missing.length) {
    return res.status(400).json({
      message: `أكمل بيانات المترجم أولاً: ${missing.join('، ')}`,
      code: 'serverErrors.interpreter.dataIncomplete',
    });
  }

  const sections = (element.formData && element.formData.documentSections) || {};
  const canEdit = await permissions.canSubmitElement(req.user, req.activeRole, course);

  // ── مترجم بتحويل: رسالة بريد جاهزة، لا مستند مطبوع ─────────
  if (key === 'interpreter_transfer') {
    const to = await configService.getSetting(TRANSFER_RECIPIENT_KEY, TRANSFER_RECIPIENT_DEFAULT);

    const eml = buildEmlMessage({
      to,
      subject: `طلب صرف مستحقات مترجم — ${course.name || 'برنامج تدريبي'}${course.code ? ` (${course.code})` : ''}`,
      htmlBody: renderInterpreterTransferEmail({ course, interpreter }),
    });

    const safeName = sanitizeFilename(course.name || 'course', 'course');
    res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="interpreter-transfer-${safeName}.eml"`);
    return res.status(200).send(eml);
  }

  // ── بقية المستندات: صفحة A4 تُعدَّل ثم تُطبع بصيغة PDF ──────
  // بيانات الطرف الأول من الإعدادات لا من الكود — تتغيّر بلا تعديل برمجي
  const [rep, repTitle, repEmail, bufferDays] = await Promise.all([
    configService.getSetting('interpreter.contract.rep', CONTRACT_DEFAULTS.rep),
    configService.getSetting('interpreter.contract.repTitle', CONTRACT_DEFAULTS.repTitle),
    configService.getSetting('interpreter.contract.email', CONTRACT_DEFAULTS.email),
    configService.getSetting('interpreter.contract.bufferDays', String(CONTRACT_DEFAULTS.bufferDays)),
  ]);

  const payload = {
    course,
    interpreter,
    sections,
    config: { rep, repTitle, email: repEmail, bufferDays: Number(bufferDays) },
  };
  const options = { trackingId: id, canEdit };

  let html;
  if (key === 'interpreter_contract') {
    html = renderInterpreterContract(payload, options);
  } else if (key === 'interpreter_advance') {
    html = renderInterpreterEntitlement(payload, options);
  } else {
    html = renderInterpreterCertificate(payload, options);
  }

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
