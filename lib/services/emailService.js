/**
 * خدمة البريد الإلكتروني — الجسر بين قاعدة البيانات ومكتبة البريد
 * تجلب بيانات المستخدم ثم تُرسل البريد المناسب
 */
const prisma = require('../db/prisma');
const email  = require('../email');

const BADGE_META = {
  COMMITTED:     { label:'الملتزم',     icon:'🎖️', desc:'كل العناصر قبل الموعد المثالي' },
  PRECISE:       { label:'الدقيق',      icon:'🎯', desc:'صفر إعادات في الفترة كاملة' },
  FAST:          { label:'السريع',      icon:'⚡', desc:'أسرع متوسط تقديم في الفريق' },
  IMPROVER:      { label:'المتحسن',     icon:'📈', desc:'أفضل تحسن في مسار الأداء' },
  CONSISTENT:    { label:'الثابت',      icon:'🏛️', desc:'3 أشهر متتالية فوق 80%' },
  PIONEER:       { label:'الرائد',      icon:'🚀', desc:'أول من يكمل كل عناصر دورة' },
  IDEA_CHAMPION: { label:'المبدع',      icon:'💡', desc:'مبادرة تحسين مُنفَّذة' },
  TEAM_PLAYER:   { label:'لاعب الفريق', icon:'🤝', desc:'تحدي فريق شهري محقق' },
  PLEDGE_KEEPER: { label:'الوفي',       icon:'🤲', desc:'وفى بكل تعهداته الشهرية' },
  STAR:          { label:'النجم',       icon:'⭐', desc:'أداء متميز مرتين متتاليتين' },
};

const LEVEL_LABEL = {
  OUTSTANDING: 'متميز', VERY_GOOD: 'جيد جداً', GOOD: 'جيد',
  NEEDS_IMPROVEMENT: 'يحتاج تحسين', WEAK: 'ضعيف',
};

const IND_LABELS = [
  { key:'productivityScore', icon:'📦', label:'الإنتاجية' },
  { key:'timelinessScore',   icon:'🕐', label:'التوقيت' },
  { key:'qualityScore',      icon:'⭐', label:'الجودة' },
  { key:'criticalScore',     icon:'🎯', label:'العناصر الحرجة' },
  { key:'speedScore',        icon:'⚡', label:'الاستجابة' },
  { key:'disciplineScore',   icon:'🛡️', label:'الانضباط' },
];

async function getUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id:true, firstName:true, lastName:true, email:true },
  });
}

// تجاهل النطاقات الوهمية (بيئة الاختبار)
function isRealEmail(address) {
  if (!address) return false;
  const domain = address.split('@')[1] || '';
  return !['test.local', 'test', 'local', 'example.com', 'example.org'].includes(domain.toLowerCase());
}

// ── عنصر مُعاد ──────────────────────────────────────────────────────────────
async function sendElementReturnedEmail({ employeeId, courseName, elementName, reason, courseId }) {
  const user = await getUser(employeeId);
  if (!user?.email || !isRealEmail(user.email)) return;
  return email.sendElementReturned({
    to: user.email,
    firstName: user.firstName,
    courseName, elementName, reason, courseId,
  });
}

// ── ترحيب مستخدم جديد ───────────────────────────────────────────────────────
async function sendWelcomeEmail({ userId, tempPassword }) {
  const user = await getUser(userId);
  if (!user?.email || !isRealEmail(user.email)) return;
  return email.sendWelcome({
    to:          user.email,
    firstName:   user.firstName,
    lastName:    user.lastName,
    email:       user.email,
    tempPassword,
  });
}

// ── نتائج KPI الشهرية ────────────────────────────────────────────────────────
async function sendKpiResultEmail({ userId, periodLabel, snapshot }) {
  const user = await getUser(userId);
  if (!user?.email || !isRealEmail(user.email)) return;
  const indicators = IND_LABELS.map(ind => ({
    ...ind,
    score: Math.round(Number(snapshot[ind.key] || 0)),
  }));
  return email.sendMonthlyKpiEmployee({
    to:          user.email,
    firstName:   user.firstName,
    periodLabel,
    finalScore:  Math.round(Number(snapshot.finalScore || 0)),
    level:       snapshot.performanceLevel,
    levelLabel:  LEVEL_LABEL[snapshot.performanceLevel] || snapshot.performanceLevel,
    indicators,
  });
}

// ── الموظف الأفضل ────────────────────────────────────────────────────────────
async function sendTopEmployeeEmail({ userId, periodLabel, score, projectName }) {
  const user = await getUser(userId);
  if (!user?.email || !isRealEmail(user.email)) return;
  return email.sendTopEmployeeMonth({
    to: user.email, firstName: user.firstName, periodLabel, score, projectName,
  });
}

// ── شارة جديدة ───────────────────────────────────────────────────────────────
async function sendBadgeEmail({ userId, badgeType, periodLabel }) {
  const user = await getUser(userId);
  if (!user?.email || !isRealEmail(user.email)) return;
  const meta = BADGE_META[badgeType] || { label: badgeType, icon:'🏅', desc:'' };
  return email.sendBadgeAwarded({
    to: user.email, firstName: user.firstName,
    badgeLabel: meta.label, badgeIcon: meta.icon, badgeDesc: meta.desc, periodLabel,
  });
}

// ── أداء منخفض للمشرف ────────────────────────────────────────────────────────
async function sendLowScoreToSupervisors({ supervisorIds, employeeId, score, periodLabel }) {
  const employee = await getUser(employeeId);
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'موظف';

  for (const supId of supervisorIds) {
    const sup = await getUser(supId);
    if (!sup?.email) continue;
    await email.sendLowScoreAlert({
      to: sup.email, supervisorName: sup.firstName,
      employeeName, employeeScore: Math.round(score), periodLabel,
      projectName: 'المشروع',
    });
  }
}

// ── إطلاق تحدي ───────────────────────────────────────────────────────────────
async function sendChallengeAnnouncementToAll({ challengeTitle, targetDesc, periodLabel }) {
  const users = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' } },
    select: { email: true, firstName: true },
  });
  for (const u of users) {
    if (!u.email) continue;
    await email.sendChallengeAnnouncement({
      to: u.email, firstName: u.firstName, challengeTitle, targetDesc, periodLabel,
    }).catch(() => {});
  }
}

// ── مبادرة تحديث حالة ────────────────────────────────────────────────────────
async function sendIdeaUpdateEmail({ userId, ideaTitle, status, reviewNotes }) {
  const user = await getUser(userId);
  if (!user?.email || !isRealEmail(user.email)) return;
  return email.sendIdeaStatusUpdate({
    to: user.email, firstName: user.firstName, ideaTitle, status, reviewNotes,
  });
}

module.exports = {
  sendElementReturnedEmail,
  sendWelcomeEmail,
  sendKpiResultEmail,
  sendTopEmployeeEmail,
  sendBadgeEmail,
  sendLowScoreToSupervisors,
  sendChallengeAnnouncementToAll,
  sendIdeaUpdateEmail,
};
