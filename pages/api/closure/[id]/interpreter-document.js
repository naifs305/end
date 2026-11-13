// =============================================================
// GET /api/closure/[id]/interpreter-document?output=...
// -------------------------------------------------------------
// يُخرج مستندات المترجم ورسائلها. العنصر يحدد المتاح منها، فلا
// يختار المنسق من قائمة ولا يُخطئ في الوجهة:
//
//   interpreter_contract    → document    عقد ترجمة (صفحة تُعدَّل وتُطبع)
//                             legal-eml   رسالة مراجعة قانونية
//                             finance-eml طلب صرف الدفعة الأولى
//   interpreter_advance     → document    نموذج استحقاق
//   interpreter_certificate → document    شهادة إنجاز
//                             finance-eml طلب صرف بقية المستحقات
//   interpreter_transfer    → document    رسالة طلب صرف بالتحويل
//
// وعناوين الجهات كلها من إعدادات المنصة لا من الكود.
// =============================================================
const { withMethods, withAuth } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');
const interpreterSvc = require('../../../../lib/modules/courses/interpreter.service');
const permissions = require('../../../../lib/services/permissions');
const configService = require('../../../../lib/modules/config/config.service');
const { buildEmlMessage, sanitizeFilename } = require('../../../../lib/email/eml');
const {
  CONTRACT_DEFAULTS,
  contractFacts,
  renderInterpreterContract,
  renderInterpreterEntitlement,
  renderInterpreterCertificate,
  renderInterpreterTransferEmail,
  renderLegalReviewEmail,
  renderFinancePaymentEmail,
} = require('../../../../lib/reports/interpreterDocs');

// الوجهات الافتراضية — تُغيَّر من شاشة «إعدادات التشغيل»
const MAIL_DEFAULTS = {
  'interpreter.transfer.email.to': 'AAlfaifi@nauss.edu.sa',
  'interpreter.legal.email.to': 'Legal@nauss.edu.sa',
  'interpreter.legal.email.cc': 'NAlshahrani@nauss.edu.sa',
  'interpreter.finance.email.to': 'finance@nauss.edu.sa',
  'interpreter.finance.email.cc':
    'AAlaraj@nauss.edu.sa, SAlbayoumi@nauss.edu.sa, NAlshahrani@nauss.edu.sa, AAlfaifi@nauss.edu.sa',
};

// ما يتاح من مخرجات لكل عنصر
const ALLOWED_OUTPUTS = {
  interpreter_contract: ['document', 'legal-eml', 'finance-eml'],
  interpreter_advance: ['document'],
  interpreter_certificate: ['document', 'finance-eml'],
  interpreter_transfer: ['document'],
};

const setting = (key) => configService.getSetting(key, MAIL_DEFAULTS[key]);

function sendEml(res, { eml, course, prefix }) {
  const safeName = sanitizeFilename(course.name || 'course', 'course');
  res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${safeName}.eml"`);
  return res.status(200).send(eml);
}

async function handler(req, res) {
  const { id } = req.query;
  const output = String(req.query.output || 'document');

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

  if (!(ALLOWED_OUTPUTS[key] || []).includes(output)) {
    return res.status(400).json({ message: 'هذا المخرج غير متاح لهذا العنصر', code: 'serverErrors.interpreter.outputNotAllowed' });
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
  const missing = interpreterSvc.missingForDocument(
    output === 'finance-eml' ? 'interpreter_transfer' : key,
    interpreter,
  );
  if (missing.length) {
    return res.status(400).json({
      message: `أكمل بيانات المترجم أولاً: ${missing.join('، ')}`,
      code: 'serverErrors.interpreter.dataIncomplete',
    });
  }

  // بيانات الطرف الأول من الإعدادات لا من الكود
  const [rep, repTitle, repEmail, bufferDays] = await Promise.all([
    configService.getSetting('interpreter.contract.rep', CONTRACT_DEFAULTS.rep),
    configService.getSetting('interpreter.contract.repTitle', CONTRACT_DEFAULTS.repTitle),
    configService.getSetting('interpreter.contract.email', CONTRACT_DEFAULTS.email),
    configService.getSetting('interpreter.contract.bufferDays', String(CONTRACT_DEFAULTS.bufferDays)),
  ]);
  const config = { rep, repTitle, email: repEmail, bufferDays: Number(bufferDays) };
  const facts = contractFacts({ course, interpreter, config });
  const courseRef = course.code ? ` (${course.code})` : '';

  // ── رسالة الإدارة القانونية ─────────────────────────────────
  if (output === 'legal-eml') {
    const [to, cc] = await Promise.all([setting('interpreter.legal.email.to'), setting('interpreter.legal.email.cc')]);
    const eml = buildEmlMessage({
      to,
      cc,
      subject: `طلب مراجعة واعتماد عقد مترجم — ${course.name || 'برنامج تدريبي'}${courseRef} — عقد رقم ${facts.contractNo}`,
      htmlBody: renderLegalReviewEmail({ course, interpreter, config }),
    });
    return sendEml(res, { eml, course, prefix: 'interpreter-legal-review' });
  }

  // ── رسالة الإدارة المالية ───────────────────────────────────
  if (output === 'finance-eml') {
    const stage = key === 'interpreter_contract' ? 'FIRST' : 'FINAL';
    const [to, cc] = await Promise.all([setting('interpreter.finance.email.to'), setting('interpreter.finance.email.cc')]);
    const subject = stage === 'FIRST'
      ? `طلب صرف الدفعة الأولى لمترجم — ${course.name || 'برنامج تدريبي'}${courseRef}`
      : `طلب صرف بقية مستحقات مترجم وفق شهادة الإنجاز — ${course.name || 'برنامج تدريبي'}${courseRef}`;

    const eml = buildEmlMessage({
      to,
      cc,
      subject,
      htmlBody: renderFinancePaymentEmail({ course, interpreter, stage, config }),
    });
    return sendEml(res, {
      eml, course, prefix: stage === 'FIRST' ? 'interpreter-finance-first' : 'interpreter-finance-final',
    });
  }

  // ── مترجم بتحويل: رسالة بريد جاهزة، لا مستند مطبوع ─────────
  if (key === 'interpreter_transfer') {
    const to = await setting('interpreter.transfer.email.to');
    const eml = buildEmlMessage({
      to,
      subject: `طلب صرف مستحقات مترجم — ${course.name || 'برنامج تدريبي'}${courseRef}`,
      htmlBody: renderInterpreterTransferEmail({ course, interpreter }),
    });
    return sendEml(res, { eml, course, prefix: 'interpreter-transfer' });
  }

  // ── المستندات المطبوعة: صفحة A4 تُعدَّل ثم تُطبع بصيغة PDF ──
  const sections = (element.formData && element.formData.documentSections) || {};
  const canEdit = await permissions.canSubmitElement(req.user, req.activeRole, course);
  const payload = { course, interpreter, sections, config };
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
