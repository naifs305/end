// =============================================================
// تاريخ انتماء المنسق للمشروع
// -------------------------------------------------------------
// المشكلة التي يعالجها هذا الملف:
// لقطة الأداء الشهرية كانت لا تسجّل مشروع المنسق، فكل تقرير مشروع
// — ولو لشهر مضى — كان يُبنى من انتماء المنسق *اليوم*. فنقل منسق
// بين المشاريع كان ينقل معه تاريخه كله: يُحسب أداؤه الماضي على
// مشروعه الجديد، ويختفي من مشروعه القديم، وتتغيّر متوسطات
// المشاريع وترتيبها بأثر رجعي.
//
// العلاج: يُسجَّل المشروع على اللقطة لحظة التقاطها، وتُقرأ تقارير
// المشاريع من هذا الحقل لا من انتماء اليوم.
//
// وما مضى من لقطات لا مشروع عليها يُسترجَع من الدورات: الدورة
// تحفظ مشروعها ومنسقها وتواريخها، فدورات المنسق في ذلك الشهر هي
// الدليل الواقعي على المشروع الذي كان يعمل فيه.
// =============================================================

/** هل تتقاطع الدورة مع نطاق الفترة؟ (نفس قاعدة التقاطع في محرّك المؤشرات) */
function overlapsPeriod(course, periodStart, periodEnd) {
  const start = new Date(course.startDate);
  const end = new Date(course.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= new Date(periodEnd) && end >= new Date(periodStart);
}

/**
 * المشروع الذي كان المنسق يعمل فيه خلال الفترة، مستنتجاً من دوراته.
 * القاعدة: المشروع صاحب أكثر دورات في الفترة. وعند التساوي يُرجَّح
 * المعرّف الأصغر ترتيباً — ليكون الاستنتاج ثابتاً لا عشوائياً.
 * ولو لم تكن له دورة في تلك الفترة فلا دليل، فنرجع للانتماء الحالي.
 */
function pickProjectFromCourses(courses, fallbackProjectId = null) {
  const counts = new Map();

  for (const course of courses || []) {
    const projectId = course && course.operationalProjectId;
    if (!projectId) continue;
    counts.set(projectId, (counts.get(projectId) || 0) + 1);
  }

  if (counts.size === 0) return fallbackProjectId || null;

  const ordered = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });

  return ordered[0][0];
}

/**
 * يبني خطة الاسترجاع للقطات التي لا مشروع عليها.
 * لا يمسّ لقطة سُجّل عليها مشروع — فما ثبت لا يُعاد النظر فيه.
 *
 * @param snapshots لقطات بصيغة { id, userId, periodStart, periodEnd, periodLabel, operationalProjectId }
 * @param coursesByUser Map<userId, Course[]> دورات يملكها المنسق
 * @param currentProjectByUser Map<userId, projectId> انتماء اليوم (احتياطي)
 */
function buildBackfillPlan(snapshots, coursesByUser, currentProjectByUser) {
  const updates = [];
  let fromCourses = 0;
  let fromCurrent = 0;
  let unresolved = 0;

  for (const snapshot of snapshots || []) {
    if (snapshot.operationalProjectId) continue;

    const userCourses = coursesByUser.get(snapshot.userId) || [];
    const inPeriod = userCourses.filter((c) => overlapsPeriod(c, snapshot.periodStart, snapshot.periodEnd));
    const fallback = currentProjectByUser.get(snapshot.userId) || null;
    const resolved = pickProjectFromCourses(inPeriod, fallback);

    if (!resolved) {
      unresolved += 1;
      continue;
    }

    if (inPeriod.length > 0) fromCourses += 1;
    else fromCurrent += 1;

    updates.push({
      id: snapshot.id,
      userId: snapshot.userId,
      periodLabel: snapshot.periodLabel,
      operationalProjectId: resolved,
      source: inPeriod.length > 0 ? 'COURSES' : 'CURRENT_MEMBERSHIP',
      coursesInPeriod: inPeriod.length,
    });
  }

  return { updates, fromCourses, fromCurrent, unresolved };
}

/**
 * المشروع الذي يُنسب إليه أداء الفترة عند التقاط اللقطة أو إعادة احتسابها.
 * الترتيب: ما سُجّل سلفاً على اللقطة يبقى (فإعادة احتساب شهر مضى لا
 * تنقل أداءه إلى مشروع المنسق اليوم)، وإلا فمشروع دوراته في تلك
 * الفترة، وإلا فانتماؤه الحالي.
 */
function resolveSnapshotProject(existingProjectId, coursesInPeriod, currentProjectId) {
  if (existingProjectId) return existingProjectId;
  return pickProjectFromCourses(coursesInPeriod, currentProjectId) || null;
}

module.exports = {
  overlapsPeriod,
  pickProjectFromCourses,
  resolveSnapshotProject,
  buildBackfillPlan,
};
