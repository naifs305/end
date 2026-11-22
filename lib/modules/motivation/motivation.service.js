// =============================================================
// وحدة التحفيز — حالات الاستخدام (Service)
// تنسّق بين المستودع (repo) والصلاحيات (policy).
// تحافظ على السلوك ورموز/رسائل الأخطاء الأصلية بالحرف نفسه،
// بما في ذلك المسارات الاحتياطية (fallback) عند عدم جاهزية الجداول.
// =============================================================
const repo = require('./motivation.repo');
const policy = require('./motivation.policy');
const { AppError } = require('../../shared/AppError');

function currentLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------
// الشارات (Badges)
// ---------------------------------------------------------------
async function listBadges({ userId }, actor) {
  const filter = actor.activeRole === 'EMPLOYEE'
    ? { userId: actor.userId }
    : userId ? { userId } : {};

  try {
    return await repo.findBadges(filter.userId);
  } catch {
    // الجدول قد لا يكون موجوداً بعد
    return [];
  }
}

async function awardBadge(body, actor) {
  // POST — منح شارة يدوياً (مدير فقط)
  policy.assertManager(actor.activeRole);
  const { userId, badgeType, periodLabel, note } = body || {};
  if (!userId || !badgeType) {
    throw new AppError('حدّد الموظف ونوع الشارة', { code: 'serverErrors.motivation.userIdAndBadgeTypeRequired', statusCode: 400 });
  }

  try {
    await repo.insertBadge(userId, badgeType, periodLabel, note, actor.userId);
    return { ok: true };
  } catch (e) {
    throw new AppError('الجدول غير جاهز — أعد البناء', { code: 'serverErrors.motivation.tableNotReady', statusCode: 500 });
  }
}

// ---------------------------------------------------------------
// التحديات (Challenges)
// ---------------------------------------------------------------
async function getChallenge({ periodLabel }) {
  const label = periodLabel || currentLabel();

  const rows = await repo.findChallengeByLabel(label);

  const challenge = rows[0] || null;
  if (!challenge) return null;

  // التقدم يُحسب من «رصيد الإنجاز» نفسه لحظة الطلب: ما ينجزه الفريق
  // يظهر في التحدي مباشرة، ومن أسهم يُذكر باسمه
  try {
    const progress = await require('../points/points.service').challengeProgress(challenge);
    return { ...challenge, ...progress };
  } catch {
    return { ...challenge, currentValue: null };
  }
}

async function createChallenge(body, actor) {
  // POST — مدير فقط
  policy.assertManager(actor.activeRole);

  const { title, description, targetMetric, targetValue, periodLabel } = body || {};
  if (!title || !targetMetric || targetValue == null) {
    throw new AppError('عنوان التحدي ومقياسه وهدفه مطلوبة', { code: 'serverErrors.motivation.challengeFieldsRequired', statusCode: 400 });
  }

  const label = periodLabel || currentLabel();

  try {
    await repo.upsertChallenge(label, title, description, targetMetric, targetValue, actor.userId);
    return { ok: true };
  } catch (e) {
    throw new AppError(e.message, { code: 'serverErrors.common.serverError', statusCode: 500 });
  }
}

// ---------------------------------------------------------------
// المبادرات (Ideas)
// ---------------------------------------------------------------
async function listIdeas({ status, mine }, actor) {
  try {
    return await repo.findIdeas({
      supportUserId: actor.userId,
      status,
      mine,
      mineUserId: actor.userId,
    });
  } catch {
    return [];
  }
}

async function createIdea(body, actor) {
  const { title, description, category } = body || {};
  if (!title?.trim() || !description?.trim()) {
    throw new AppError('العنوان والوصف مطلوبان', { code: 'serverErrors.motivation.titleAndDescriptionRequired', statusCode: 400 });
  }
  await repo.insertIdea(actor.userId, title.trim(), description.trim(), category || 'general');
  return { ok: true };
}

async function updateIdea(id, body, actor) {
  const { action, status, reviewNotes } = body || {};

  if (action === 'support') {
    // تأييد مبادرة
    try {
      await repo.insertIdeaSupport(id, actor.userId);
      await repo.incrementIdeaSupportCount(id);
      return { ok: true, action: 'supported' };
    } catch {
      // إلغاء التأييد إذا كان موجوداً
      await repo.deleteIdeaSupport(id, actor.userId);
      await repo.decrementIdeaSupportCount(id);
      return { ok: true, action: 'unsupported' };
    }
  }

  // تحديث الحالة — مدير/مشرف فقط
  policy.assertManagerOrSupervisor(actor.activeRole);
  if (!status) {
    throw new AppError('الحالة مطلوبة', { code: 'serverErrors.motivation.statusRequired', statusCode: 400 });
  }

  const validStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'IMPLEMENTED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    throw new AppError('حالة غير صحيحة', { code: 'serverErrors.motivation.invalidStatus', statusCode: 400 });
  }

  const implementedAt = status === 'IMPLEMENTED' ? 'NOW()' : 'NULL';
  await repo.updateIdeaStatus(status, reviewNotes, actor.userId, id, implementedAt);

  // منح شارة مبدع عند التنفيذ
  if (status === 'IMPLEMENTED') {
    const idea = await repo.findIdeaOwner(id);
    if (idea[0]) {
      await repo.insertIdeaChampionBadge(idea[0].userId, `مبادرة مُنفَّذة: ${id}`, actor.userId);
    }
  }

  return { ok: true };
}

// «تعهدي» أُلغي: الرصيد وفرصه القريبة يغنيان عنه، والسجلات القديمة باقية في القاعدة

module.exports = {
  listBadges,
  awardBadge,
  getChallenge,
  createChallenge,
  listIdeas,
  createIdea,
  updateIdea,
};
