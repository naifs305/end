// =============================================================
// التقارير الميدانية — مفتوحة لكل المستخدمين
// -------------------------------------------------------------
// كانت التقارير الميدانية لا يراها إلا كاتبها ومشرفه والمدير.
// والغرض منها أن يتعلّم الجميع: يطّلع الزملاء على ملاحظات من كتبها
// فيتلافونها في دوراتهم القادمة، ولهم أن يعلّقوا عليها.
//
// والتقرير بعد إرساله لا يُعدَّل (أرشيف)، والتعليق يحذفه كاتبه أو المدير.
// =============================================================
const repo = require('./fieldReports.repo');
const notifications = require('../../services/notifications');

const MAX_COMMENT = 1000;

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  if (code) err.code = code;
  return err;
}

// المرفقات صور ثقيلة؛ تُعرض في صفحة التقرير وحدها لا في القائمة
function withoutAttachments(formData) {
  const { attachments, ...rest } = formData || {};
  return { ...rest, attachmentsCount: Array.isArray(attachments) ? attachments.length : 0 };
}

async function list() {
  const rows = await repo.findAll();
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    author: r.author,
    course: r.course,
    commentsCount: r._count?.comments || 0,
    formData: withoutAttachments(r.formData),
  }));
}

async function get(id) {
  const r = await repo.findById(id);
  if (!r) throw httpError(404, 'التقرير غير موجود', 'serverErrors.fieldReports.notFound');
  return r;
}

async function addComment(reportId, content, actor) {
  const text = String(content || '').trim();
  if (!text) throw httpError(400, 'اكتب تعليقك أولاً', 'serverErrors.fieldReports.commentRequired');
  if (text.length > MAX_COMMENT) throw httpError(400, `التعليق أطول من ${MAX_COMMENT} حرف`, 'serverErrors.fieldReports.commentTooLong');

  const report = await repo.findReportOwner(reportId);
  if (!report) throw httpError(404, 'التقرير غير موجود', 'serverErrors.fieldReports.notFound');

  const comment = await repo.createComment(reportId, actor.userId, text);

  // يعلم كاتب التقرير بتعليق زميله (لا بتعليقه هو على تقريره)
  if (report.authorId !== actor.userId) {
    const who = `${comment.author?.firstName || ''} ${comment.author?.lastName || ''}`.trim();
    await notifications.createNotification(
      report.authorId,
      'FIELD_REPORT_COMMENT',
      'تعليق على تقريرك الميداني',
      `${who} علّق على تقريرك في دورة «${report.course?.name || ''}»`,
      { reportId },
    );
  }
  return comment;
}

async function removeComment(commentId, actor) {
  const c = await repo.findComment(commentId);
  if (!c) throw httpError(404, 'التعليق غير موجود', 'serverErrors.fieldReports.commentNotFound');
  if (c.authorId !== actor.userId && actor.activeRole !== 'MANAGER') {
    throw httpError(403, 'يحذف التعليقَ كاتبُه أو المدير', 'serverErrors.fieldReports.commentDeleteForbidden');
  }
  await repo.deleteComment(commentId);
  return { id: commentId };
}

/** عناصر شريط الأخبار: تقارير الزملاء في الأيام السبعة الأخيرة */
async function tickerItems(userId, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const rows = await repo.findRecent(since, userId);
  return rows.map((r) => ({
    id: `field-report-${r.id}`,
    icon: '📝',
    tone: 'primary',
    text: `تقرير ميداني جديد من ${r.author?.firstName || ''} ${r.author?.lastName || ''} عن دورة «${r.course?.name || ''}»${r._count?.comments ? ` · ${r._count.comments} تعليق` : ''} — اطّلع عليه في «التقارير الميدانية»`,
    href: `/field-reports?id=${r.id}`,
  }));
}

module.exports = { MAX_COMMENT, list, get, addComment, removeComment, tickerItems, withoutAttachments };
