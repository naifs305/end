// =============================================================
// قالب تقرير اختتام الدورة التدريبية
// -------------------------------------------------------------
// يُقدَّم في مرحلة الإقفال (بعد انتهاء الدورة)
// يركّز على: المخرجات النهائية، التقييمات، التوصيات، الإحصائيات النهائية
// =============================================================

const {
  escapeHtml,
  getRatingLabel,
  getRatingClass,
  formatDate,
  formatDateTime,
  formatLocationType,
  calculateDurationDays,
  toListItems,
  renderList,
  renderComment,
  sharedCSS,
  renderHeader,
  renderTitleBox,
  renderClosing,
  renderAutoPrintScript,
} = require('./helpers');

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function renderAttachments(attachments = [], mode = 'print') {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  if (mode === 'email') {
    return `
      <div class="section">
        <div class="section-header">الصور والمرفقات الداعمة</div>
        <div class="section-body">
          <div class="note-box" style="margin-bottom:10px;">تم إرفاق الصور والملفات الداعمة مع هذه الرسالة بصيغة مرفقات بريدية مستقلة.</div>
          <ol class="list">
            ${attachments.map((file) => `<li>${escapeHtml(file.name || 'مرفق')}</li>`).join('')}
          </ol>
        </div>
      </div>`;
  }
  return `
    <div class="section">
      <div class="section-header">الصور والمرفقات الداعمة</div>
      <div class="section-body">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
          ${attachments.map((file) => `
            <div class="card">
              <div class="label">${escapeHtml(file.name || 'مرفق')}</div>
              <img src="${file.content}" alt="${escapeHtml(file.name || 'مرفق')}" style="width:100%;height:180px;object-fit:cover;border-radius:14px;border:1px solid #e5e7eb;" />
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function renderClosingReport({ course, element, data }, options = {}) {
  const mode = options.mode === 'email' ? 'email' : 'print';
  const info = data.generatedCourseInfo || {};

  const courseName = info.name || course.name || '-';
  const city = info.city || course.city || '-';
  const locationType = formatLocationType(info.locationType || course.locationType);
  const projectName = info.project || course.operationalProject?.name || '-';
  const supervisor =
    info.supervisor ||
    `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() ||
    '-';
  const startDate = info.startDate || formatDate(course.startDate);
  const endDate = info.endDate || formatDate(course.endDate);
  const duration = calculateDurationDays(course.startDate, course.endDate);

  const registeredCount = data.registered_trainees_count ?? info.traineesCount ?? course.numTrainees ?? '-';
  const actualAttendance = data.actual_attendance_count ?? data.attendance_count ?? registeredCount;
  const registeredCountNumber = toNumberOrNull(registeredCount);
  const actualAttendanceNumber = toNumberOrNull(actualAttendance);
  const attendanceRate =
    data.attendance_rate ??
    (registeredCountNumber && actualAttendanceNumber !== null && registeredCountNumber > 0
      ? `${((actualAttendanceNumber / registeredCountNumber) * 100).toFixed(1)}%`
      : '-');

  const trainersCount = data.trainers_count ?? '-';
  const translatorsCount = data.translators_count ?? '-';
  const passedCount = data.passed_count ?? '-';
  const failedCount = data.failed_count ?? '-';
  const actualAttendanceForPassing = toNumberOrNull(actualAttendance);
  const passedCountNumber = toNumberOrNull(passedCount);
  const passingRate = data.passing_rate ?? (actualAttendanceForPassing && passedCountNumber !== null && actualAttendanceForPassing > 0 ? `${((passedCountNumber / actualAttendanceForPassing) * 100).toFixed(1)}%` : '-');

  const recommendations = toListItems(data.recommendations || data.suggestions || data.proposals);

  const evaluationSections = [
    {
      title: 'تقييم البيئة التدريبية',
      rating: data.training_environment?.rating,
      comment: data.training_environment?.comment,
    },
    {
      title: 'تقييم المدرب والتزامه وانضباطه',
      rating: data.trainer_evaluation?.rating,
      comment: data.trainer_evaluation?.comment,
    },
    {
      title: 'تقييم المتدربين وانضباطهم والتزامهم',
      rating: data.trainee_evaluation?.rating,
      comment: data.trainee_evaluation?.comment,
    },
    {
      title: 'تقييم المحتوى العلمي',
      rating: data.content_evaluation?.rating || data.lms_content_evaluation?.rating,
      comment: data.content_evaluation?.comment || data.lms_content_evaluation?.comment,
    },
    {
      title: 'تقييم منصة LMS',
      rating: data.lms_evaluation?.rating || data.lms_content_evaluation?.rating,
      comment: data.lms_evaluation?.comment || data.lms_content_evaluation?.comment,
    },
    {
      title: 'تقييم الإدارات المساندة',
      rating: data.support_services_evaluation?.rating,
      comment: data.support_services_evaluation?.comment,
    },
  ].filter((section) => section.rating !== 'not_applicable');

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تقرير اختتام دورة تدريبية</title>
  <style>${sharedCSS}</style>
</head>
<body>
  <div class="page">
    ${renderHeader(
      'تقرير اختتام دورة تدريبية',
      'ادارة عمليات التدريب - وكالة التدريب',
    )}

    ${renderTitleBox(courseName, 'تقرير تنفيذي ميداني عن اختتام البرنامج والمخرجات والتقييمات النهائية')}

    <div class="letter">
      <p class="paragraph"><strong>سعادة وكيل الجامعة للتدريب – سلّمه الله</strong></p>
      <p class="paragraph">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="paragraph">تحية طيبة وبعد،،</p>
      <p class="paragraph">
        نرفع لسعادتكم تقرير الاختتام النهائي للدورة التدريبية:
        "<strong>${escapeHtml(courseName)}</strong>"،
        والتي انعقدت في مدينة <strong>${escapeHtml(city)}</strong>
        خلال الفترة من <strong>${escapeHtml(startDate)}</strong>
        إلى <strong>${escapeHtml(endDate)}</strong>،
        ضمن الخطة التنفيذية المعتمدة للبرامج التدريبية.
      </p>
      <p class="paragraph">
        يتضمن هذا التقرير ملخصاً شاملاً للمخرجات التدريبية والتقييمات التنفيذية،
        ونتائج المشاركة والاجتياز، والتوصيات التي رصدها فريق الإشراف الميداني،
        وذلك استكمالاً لدورة متابعة الجودة في تنفيذ البرامج التدريبية.
      </p>
    </div>

    <div class="section">
      <div class="section-header">المعلومات الأساسية للدورة</div>
      <div class="section-body">
        ${[
          [
            { label: 'اسم الدورة', value: escapeHtml(courseName) },
            { label: 'المشروع التشغيلي', value: escapeHtml(projectName) },
            { label: 'المشرف الميداني', value: escapeHtml(supervisor) },
          ],
          [
            { label: 'مكان الانعقاد', value: escapeHtml(city) },
            { label: 'مقر التنفيذ', value: escapeHtml(locationType) },
            { label: 'فترة التنفيذ', value: `${escapeHtml(startDate)} - ${escapeHtml(endDate)}` },
          ],
          [
            { label: 'المدة', value: escapeHtml(duration) },
            { label: 'تاريخ رفع التقرير', value: escapeHtml(formatDateTime(element.executionAt)) },
            { label: 'عدد المتدربين المسجلين بالنظام', value: escapeHtml(info.traineesCount || course.numTrainees || '-') },
          ],
        ].map(row => `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:8px 0; margin-bottom:8px;">
            <tr>
              ${row.map(({ label, value }) => `
                <td width="33%" style="background:#fafbfb; border:1px solid #e4ebea; border-radius:10px; padding:10px 12px; vertical-align:top;">
                  <div style="color:#6b7280; font-size:10.5px; font-weight:700; margin-bottom:4px;">${label}</div>
                  <div style="color:#013b3c; font-size:13px; font-weight:700;">${value}</div>
                </td>
              `).join('')}
            </tr>
          </table>
        `).join('')}
      </div>
    </div>

    <div class="section">
      <div class="section-header">إحصائيات المشاركة والنتائج النهائية</div>
      <div class="section-body">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:8px 0;">
          <tr>
            ${[
              { num: registeredCount, label: 'عدد المشاركين المسجلين' },
              { num: actualAttendance, label: 'عدد الحضور الفعلي' },
              { num: attendanceRate, label: 'نسبة الحضور' },
              { num: passedCount, label: 'عدد المجتازين' },
              { num: passingRate, label: 'نسبة الاجتياز' },
            ].map(({ num, label }) => `
              <td width="20%" style="text-align:center; padding:12px 8px; background:linear-gradient(180deg,#ffffff 0%,#f0f6f5 100%); border:1px solid #d9e3e1; border-radius:12px; vertical-align:middle;">
                <div style="color:#016564; font-size:22px; font-weight:900; line-height:1; margin-bottom:6px;">${escapeHtml(num)}</div>
                <div style="color:#374151; font-size:11px; font-weight:700;">${label}</div>
              </td>
            `).join('')}
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:8px 0; margin-top:10px;">
          <tr>
            ${[
              { num: failedCount, label: 'عدد غير المجتازين' },
              { num: trainersCount, label: 'عدد المدربين' },
              { num: translatorsCount, label: 'عدد المترجمين' },
            ].map(({ num, label }) => `
              <td width="33%" style="text-align:center; padding:12px 8px; background:linear-gradient(180deg,#ffffff 0%,#f0f6f5 100%); border:1px solid #d9e3e1; border-radius:12px; vertical-align:middle;">
                <div style="color:#016564; font-size:22px; font-weight:900; line-height:1; margin-bottom:6px;">${escapeHtml(num)}</div>
                <div style="color:#374151; font-size:11px; font-weight:700;">${label}</div>
              </td>
            `).join('')}
          </tr>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-header">محاور التقييم الختامية المعتمدة</div>
      <div class="section-body">
        ${(() => {
          const rows = [];
          for (let i = 0; i < evaluationSections.length; i += 2) {
            rows.push(evaluationSections.slice(i, i + 2));
          }
          return rows.map(row => `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:8px 0; margin-bottom:8px;">
              <tr>
                ${row.map(section => `
                  <td width="50%" style="background:#fafbfb; border:1px solid #e4ebea; border-radius:10px; padding:10px 12px; vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="color:#013b3c; font-size:12.5px; font-weight:800; vertical-align:middle;">${escapeHtml(section.title)}</td>
                        <td style="text-align:left; vertical-align:middle; white-space:nowrap;">
                          <span style="display:inline-block; padding:4px 12px; font-size:11px; font-weight:800; border-radius:999px; color:#ffffff; background:${section.rating === 'excellent' ? '#047857' : section.rating === 'good' ? '#2563eb' : section.rating === 'needs_improvement' ? '#d97706' : section.rating === 'weak' ? '#b91c1c' : section.rating === 'requires_development' ? '#7c3aed' : '#6b7280'};">${escapeHtml(getRatingLabel(section.rating))}</span>
                        </td>
                      </tr>
                    </table>
                    <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:8px 10px; font-size:12px; line-height:1.65; color:#334155;">
                      ${renderComment(section.comment)}
                    </div>
                  </td>
                `).join('')}
                ${row.length === 1 ? '<td width="50%"></td>' : ''}
              </tr>
            </table>
          `).join('');
        })()}
      </div>
    </div>

    <div class="section">
      <div class="section-header">التوصيات والمقترحات</div>
      <div class="section-body">
        ${renderList(recommendations, 'لا توجد توصيات مسجلة')}
      </div>
    </div>

    ${renderAttachments(data.attachments, mode)}

    <div class="footer-note">
      نرفع لسعادتكم هذا التقرير الختامي تتويجاً لجهود الإشراف التنفيذي طوال فترة الدورة،
      وسنواصل متابعة إجراءات الإقفال النهائية (المستحقات، التسوية المالية، الأرشفة)
      وفق الأنظمة المعتمدة، مع الرفع بأي مستجدات وملاحظات تنفيذية أولًا بأول،
      التزاماً بأعلى معايير الجودة في تنفيذ البرامج التدريبية.
    </div>

    ${renderClosing()}
  </div>

  ${mode === 'print' ? renderAutoPrintScript() : ''}
</body>
</html>
  `;
}

module.exports = { renderClosingReport };
