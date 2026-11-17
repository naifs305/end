// =============================================================
// وحدة بلاغات العوائق — حالات الاستخدام (Service)
// -------------------------------------------------------------
// المبدأ الحاكم: البلاغ يُرفع قبل الموعد لا بعده.
//   • يسري بمجرد رفعه ما دام المنسق تحت سقفه الفصلي — فلا يتوقف
//     الإنصاف على اجتهاد مُراجِع قد لا يفعل.
//   • منشور ومنسوب لجهة بالاسم — فالحارس عليه الجهة المتّهمة.
//   • مَن تجاوز سقفه وصل إلى مكتب المدير وحده، آلياً.
//   • والمرفوع بعد فوات الموعد يُسجَّل ولا يُحتسب (lib/shared/deadlines).
// =============================================================
const repo = require('./blockers.repo');
const { AppError } = require('../../shared/AppError');
const deadlines = require('../../shared/deadlines');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const notifications = require('../../services/notifications');
const config = require('../config/config.service');

const logAudit = (...args) => audit.logAudit(...args);
const createNotification = (...args) => notifications.createNotification(...args);

const DEFAULT_QUARTER_QUOTA = 3;
const QUOTA_SETTING_KEY = 'blockers.quarterQuota';

const REASON_LABELS = {
  TRAINER_GRADES: 'تأخر تسجيل الدرجات من المدرب',
  TRAINEE_NAMES: 'تأخر استلام أسماء المتدربين',
  INSURANCE_SUSPENDED: 'إيقاف إصدار التأمين الطبي',
  FINANCE_PENDING: 'بانتظار إجراء مالي',
  BENEFICIARY_PENDING: 'بانتظار الجهة المستفيدة',
  OTHER: 'سبب آخر',
};

// الحالات التي يجوز رفع بلاغ عليها — العنصر لم يُقدَّم بعد.
// بلاغ على عنصر مُقدَّم أو مُعتمد لا معنى له: صاحبه غير متوقف.
const BLOCKABLE_STATUSES = ['NOT_STARTED', 'RETURNED'];

// ── مفتاح الفصل ──────────────────────────────────────────────
function quarterKeyOf(date = new Date()) {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function quarterRange(quarterKey) {
  const [yearPart, qPart] = String(quarterKey).split('-Q');
  const year = Number(yearPart);
  const q = Number(qPart);
  const startMonth = (q - 1) * 3;
  return {
    from: new Date(year, startMonth, 1, 0, 0, 0, 0),
    to: new Date(year, startMonth + 3, 0, 23, 59, 59, 999),
  };
}

async function getQuarterQuota() {
  const raw = await config.getSetting(QUOTA_SETTING_KEY, String(DEFAULT_QUARTER_QUOTA));
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_QUARTER_QUOTA;
}

/**
 * حالة رصيد المنسق في الفصل الحالي — تُعرض له قبل أن يرفع البلاغ
 * حتى يعرف أنه يُنفق من رصيد محدود.
 */
async function getQuotaStatus(userId, now = new Date()) {
  const quarterKey = quarterKeyOf(now);
  const [quota, used] = await Promise.all([
    getQuarterQuota(),
    repo.countCreditedInQuarter(userId, quarterKey),
  ]);
  return {
    quarterKey,
    quota,
    used,
    remaining: Math.max(0, quota - used),
    exhausted: used >= quota,
  };
}

// ── رفع بلاغ ─────────────────────────────────────────────────
async function raiseBlocker(dto, user, activeRole, now = new Date()) {
  const tracking = await repo.findTrackingForBlocker(dto.trackingId);

  if (!tracking) {
    throw AppError.notFound('عنصر الإقفال غير موجود', 'serverErrors.closureElements.notFound');
  }

  const allowed = await permissions.canSubmitElement(user, activeRole, tracking.course);
  if (!allowed) {
    throw AppError.forbidden('لا تملك صلاحية رفع بلاغ على هذا العنصر', 'serverErrors.blockers.raiseForbidden');
  }

  if (!BLOCKABLE_STATUSES.includes(tracking.status)) {
    throw AppError.badRequest(
      'لا يُرفع البلاغ إلا على عنصر لم يُقدَّم بعد',
      'serverErrors.blockers.elementNotBlockable',
    );
  }

  const existing = await repo.findOpenBlockerForTracking(dto.trackingId);
  if (existing) {
    throw AppError.badRequest('يوجد بلاغ قائم على هذا العنصر', 'serverErrors.blockers.alreadyOpen');
  }

  // السقف الفصلي: تحت السقف يسري تلقائياً، وفوقه ينتظر قرار المدير.
  const quarterKey = quarterKeyOf(now);
  const quota = await getQuarterQuota();
  const used = await repo.countCreditedInQuarter(user.id, quarterKey);
  const underQuota = used < quota;

  // هل سيُحتسب أصلاً؟ البلاغ بعد فوات الموعد الأقصى يُسجَّل ولا يؤجّل.
  const d = deadlines.computeElementDeadlines(tracking, tracking.course, now);
  const tooLateToCredit = d.hasDeadline && now > d.maxDeadline;

  const blocker = await repo.createBlocker({
    trackingId: tracking.id,
    courseId: tracking.courseId,
    raisedById: user.id,
    reason: dto.reason,
    awaitedParty: dto.awaitedParty.trim(),
    details: dto.details.trim(),
    raisedAt: now,
    status: 'OPEN',
    isCredited: underQuota,
    credit: underQuota ? 'AUTO_APPROVED' : 'QUOTA_EXCEEDED_PENDING',
    quarterKey,
  });

  await logAudit(user.id, activeRole, 'BLOCKER_RAISED', {
    blockerId: blocker.id,
    elementKey: tracking.element?.key,
    elementName: tracking.element?.name,
    reason: dto.reason,
    awaitedParty: dto.awaitedParty.trim(),
    isCredited: underQuota,
    tooLateToCredit,
  }, tracking.courseId);

  // النشر هو الحارس: المشرف والمدير يريان البلاغ فور رفعه.
  await notifyOversight(tracking, blocker, user, underQuota);

  return {
    ...blocker,
    quota: { quarterKey, quota, used: underQuota ? used + 1 : used, remaining: Math.max(0, quota - used - (underQuota ? 1 : 0)) },
    warnings: buildWarnings({ underQuota, tooLateToCredit, deadlineInfo: d, now }),
  };
}

// التحذيرات تُقاس بلحظة رفع البلاغ لا بالوقت الحالي — فالقاعدة كلها
// قائمة على وقت الرفع، ولو قِسناها بغيره ناقض التحذير ما يُحتسب فعلاً.
function buildWarnings({ underQuota, tooLateToCredit, deadlineInfo, now }) {
  const warnings = [];
  if (tooLateToCredit) {
    warnings.push({
      code: 'RAISED_AFTER_DEADLINE',
      message: 'رُفع البلاغ بعد فوات الموعد الأقصى — يُسجَّل للمتابعة ولا يرفع العقوبة.',
    });
  } else if (deadlineInfo.hasDeadline && deadlineInfo.baseIdealDeadline && now > deadlineInfo.baseIdealDeadline) {
    warnings.push({
      code: 'RAISED_AFTER_IDEAL',
      message: 'رُفع البلاغ بعد الموعد المثالي — يرفع العقوبة ولا يُعيد درجة التميّز.',
    });
  }
  if (!underQuota) {
    warnings.push({
      code: 'QUOTA_EXCEEDED',
      message: 'تجاوزت رصيدك الفصلي — البلاغ مسجّل وينتظر قرار المدير قبل احتسابه.',
    });
  }
  return warnings;
}

async function notifyOversight(tracking, blocker, raiser, underQuota) {
  const courseName = tracking.course?.name || '';
  const elementName = tracking.element?.name || '';
  const raiserName = `${raiser.firstName || ''} ${raiser.lastName || ''}`.trim();
  const title = underQuota ? `بلاغ عائق: ${elementName}` : `بلاغ عائق تجاوز الرصيد: ${elementName}`;
  const body = underQuota
    ? `رفع ${raiserName} بلاغ عائق على "${elementName}" في الدورة "${courseName}". الجهة المنتظَرة: ${blocker.awaitedParty}. السبب: ${REASON_LABELS[blocker.reason] || blocker.reason}.`
    : `رفع ${raiserName} بلاغ عائق على "${elementName}" في الدورة "${courseName}" بعد تجاوز رصيده الفصلي. يلزم قرارك قبل احتسابه. الجهة المنتظَرة: ${blocker.awaitedParty}.`;

  const recipients = await repo.findOversightRecipients(tracking.course?.operationalProjectId);
  for (const userId of recipients) {
    if (userId === raiser.id) continue;
    await createNotification(userId, underQuota ? 'BLOCKER_RAISED' : 'BLOCKER_QUOTA_EXCEEDED', title, body, {
      blockerId: blocker.id,
      courseId: tracking.courseId,
      trackingId: tracking.id,
      elementName,
    });
  }
}

// ── إغلاق بلاغ (زال العائق) ──────────────────────────────────
async function resolveBlocker(id, dto, user, activeRole, now = new Date()) {
  const blocker = await repo.findBlockerById(id);
  if (!blocker) {
    throw AppError.notFound('البلاغ غير موجود', 'serverErrors.blockers.notFound');
  }
  if (blocker.status !== 'OPEN') {
    throw AppError.badRequest('البلاغ غير قائم', 'serverErrors.blockers.notOpen');
  }

  const isOwner = blocker.raisedById === user.id;
  // المشرف يغلق بلاغات دورات مشروعه وحدها، والمدير كل البلاغات
  const isOversight = activeRole === 'MANAGER'
    || (activeRole === 'PROJECT_SUPERVISOR' && !!blocker.course && await permissions.canDecideElement(user, activeRole, blocker.course));
  if (!isOwner && !isOversight) {
    throw AppError.forbidden('لا تملك صلاحية إغلاق هذا البلاغ', 'serverErrors.blockers.resolveForbidden');
  }

  const updated = await repo.updateBlocker(id, {
    status: 'RESOLVED',
    resolvedAt: now,
    ...(dto.note ? { decisionNote: dto.note } : {}),
  });

  await logAudit(user.id, activeRole, 'BLOCKER_RESOLVED', {
    blockerId: id,
    elementName: blocker.tracking?.element?.name,
    pausedHours: Math.round((now - new Date(blocker.raisedAt)) / 3600000),
  }, blocker.courseId);

  return updated;
}

// ── سحب بلاغ (رُفع خطأً) ─────────────────────────────────────
async function cancelBlocker(id, dto, user, activeRole, now = new Date()) {
  const blocker = await repo.findBlockerById(id);
  if (!blocker) {
    throw AppError.notFound('البلاغ غير موجود', 'serverErrors.blockers.notFound');
  }
  if (blocker.status === 'CANCELLED') {
    throw AppError.badRequest('البلاغ مسحوب بالفعل', 'serverErrors.blockers.alreadyCancelled');
  }
  if (blocker.raisedById !== user.id && activeRole !== 'MANAGER') {
    throw AppError.forbidden('لا تملك صلاحية سحب هذا البلاغ', 'serverErrors.blockers.cancelForbidden');
  }

  const updated = await repo.updateBlocker(id, {
    status: 'CANCELLED',
    isCredited: false,
    resolvedAt: blocker.resolvedAt || now,
    ...(dto.note ? { decisionNote: dto.note } : {}),
  });

  await logAudit(user.id, activeRole, 'BLOCKER_CANCELLED', {
    blockerId: id,
    elementName: blocker.tracking?.element?.name,
  }, blocker.courseId);

  return updated;
}

// ── قرار المدير على بلاغ تجاوز الرصيد ────────────────────────
async function decideBlocker(id, dto, user, activeRole, now = new Date()) {
  const blocker = await repo.findBlockerById(id);
  if (!blocker) {
    throw AppError.notFound('البلاغ غير موجود', 'serverErrors.blockers.notFound');
  }
  if (blocker.credit !== 'QUOTA_EXCEEDED_PENDING') {
    throw AppError.badRequest(
      'هذا البلاغ لا ينتظر قراراً — يسري تلقائياً أو سبق البتّ فيه',
      'serverErrors.blockers.noDecisionPending',
    );
  }

  const updated = await repo.updateBlocker(id, {
    isCredited: !!dto.approve,
    credit: dto.approve ? 'MANAGER_APPROVED' : 'MANAGER_REJECTED',
    decidedById: user.id,
    decidedAt: now,
    decisionNote: dto.note ? dto.note.trim() : null,
  });

  await logAudit(user.id, activeRole, dto.approve ? 'BLOCKER_APPROVED' : 'BLOCKER_REJECTED', {
    blockerId: id,
    elementName: blocker.tracking?.element?.name,
    note: dto.note || null,
  }, blocker.courseId);

  await createNotification(
    blocker.raisedById,
    dto.approve ? 'BLOCKER_APPROVED' : 'BLOCKER_REJECTED',
    dto.approve ? `اعتُمد بلاغك: ${blocker.tracking?.element?.name || ''}` : `رُفض بلاغك: ${blocker.tracking?.element?.name || ''}`,
    dto.approve
      ? `اعتمد المدير بلاغك على "${blocker.tracking?.element?.name || ''}" في الدورة "${blocker.course?.name || ''}" رغم تجاوز رصيدك الفصلي.`
      : `رفض المدير بلاغك على "${blocker.tracking?.element?.name || ''}" في الدورة "${blocker.course?.name || ''}". السبب: ${dto.note || '—'}. التأخير محتسب.`,
    { blockerId: id, courseId: blocker.courseId },
  );

  return updated;
}

// ── القوائم ──────────────────────────────────────────────────
async function listBlockers(filters, user, activeRole) {
  const where = {};

  if (filters.status) where.status = filters.status;
  if (filters.reason) where.reason = filters.reason;
  if (filters.courseId) where.courseId = filters.courseId;
  if (filters.pendingDecision) where.credit = 'QUOTA_EXCEEDED_PENDING';

  // المنسق يرى بلاغاته، والمشرف بلاغات مشاريعه، والمدير الكل.
  if (activeRole === 'MANAGER') {
    if (filters.userId) where.raisedById = filters.userId;
  } else if (activeRole === 'PROJECT_SUPERVISOR') {
    const projectIds = await permissions.getSupervisedProjectIds(user.id);
    where.course = { operationalProjectId: { in: projectIds } };
    if (filters.userId) where.raisedById = filters.userId;
  } else {
    where.raisedById = user.id;
  }

  return repo.listBlockers(where);
}

module.exports = {
  REASON_LABELS,
  BLOCKABLE_STATUSES,
  quarterKeyOf,
  quarterRange,
  getQuarterQuota,
  getQuotaStatus,
  raiseBlocker,
  resolveBlocker,
  cancelBlocker,
  decideBlocker,
  listBlockers,
};
