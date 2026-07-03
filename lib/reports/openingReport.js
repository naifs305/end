// =============================================================
// قالب تقرير افتتاح الدورة التدريبية
// -------------------------------------------------------------
// يُقدَّم في مرحلة التنفيذ (بعد افتتاح الدورة)
// يركّز على: الجاهزية التشغيلية، الانطلاق، الحضور الأولي
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

function renderOpeningReport({ course, element, data }, options = {}) {
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
  const initialAttendance = data.initial_attendance_count ?? registeredCount;
  const registeredCountNumber = toNumberOrNull(registeredCount);
  const initialAttendanceNumber = toNumberOrNull(initialAttendance);

  const initialAttendanceRate =
    registeredCountNumber && initialAttendanceNumber !== null && registeredCountNumber > 0
      ? `${((initialAttendanceNumber / registeredCountNumber) * 100).toFixed(1)}%`
      : '-';

  const trainersCount = data.trainers_count ?? '-';
  const translatorsCount = data.translators_count ?? '-';

  const readinessNotes = toListItems(data.readiness_notes || data.notes);

  const evaluationSections = [
    {
      title: 'تقييم البيئة التدريبية',
      rating: data.training_environment?.rating,
      comment: data.training_environment?.comment,
    },
    {
      title: 'تقييم المدرب',
      rating: data.trainer_evaluation?.rating,
      comment: data.trainer_evaluation?.comment,
    },
    {
      title: 'تقييم المتدرب',
      rating: data.trainee_evaluation?.rating || data.trainee_attendance?.rating,
      comment: data.trainee_evaluation?.comment || data.trainee_attendance?.comment,
    },
    {
      title: 'تقييم المحتوى',
      rating: data.content_evaluation?.rating,
      comment: data.content_evaluation?.comment,
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
  <title>تقرير افتتاح دورة تدريبية</title>
  <style>${sharedCSS}</style>
</head>
<body>
  <div class="page">
    ${renderHeader(
      'تقرير افتتاح دورة تدريبية',
      'نظام إقفال الدورات التدريبية — جامعة نايف العربية للعلوم الأمنية',
    )}

    ${renderTitleBox(courseName, 'تقرير تنفيذي ميداني لافتتاح البرنامج ومتابعة الجاهزية التشغيلية')}

    <div class="letter">
      <p class="paragraph"><strong>سعادة وكيل الجامعة للتدريب – سلّمه الله</strong></p>
      <p class="paragraph">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="paragraph">تحية طيبة وبعد،،</p>
      <p class="paragraph">
        نفيد سعادتكم بأنه تم – بفضل الله – افتتاح الدورة التدريبية:
        "<strong>${escapeHtml(courseName)}</strong>"،
        والمنعقدة في مدينة <strong>${escapeHtml(city)}</strong>،
        وذلك ضمن الخطة التنفيذية المعتمدة للبرامج التدريبية.
      </p>
      <p class="paragraph">
        وقد باشر فريق إدارة عمليات التدريب الإشراف الميداني على انطلاق البرنامج،
        وتم التحقق من الجاهزية التشغيلية والتنظيمية، واستقبال المشاركين بما يليق بمكانة الجامعة ورسالتها التدريبية.
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
            { label: 'تاريخ افتتاح الدورة', value: escapeHtml(formatDateTime(element.executionAt)) },
            { label: 'عدد المتدربين المسجلين', value: escapeHtml(info.traineesCount || course.numTrainees || '-') },
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
      <div class="section-header">إحصائيات الحضور الأولي</div>
      <div class="section-body">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:8px 0;">
          <tr>
            ${[
              { num: registeredCount, label: 'عدد المشاركين المسجلين' },
              { num: initialAttendance, label: 'عدد الحضور في اليوم الأول' },
              { num: initialAttendanceRate, label: 'نسبة الحضور الأولية' },
              { num: trainersCount, label: 'عدد المدربين' },
              { num: translatorsCount, label: 'عدد المترجمين' },
            ].map(({ num, label }) => `
              <td width="20%" style="text-align:center; padding:12px 8px; background:linear-gradient(180deg,#ffffff 0%,#f0f6f5 100%); border:1px solid #d9e3e1; border-radius:12px; vertical-align:middle;">
                <div style="color:#016564; font-size:22px; font-weight:900; line-height:1; margin-bottom:6px;">${escapeHtml(num)}</div>
                <div style="color:#374151; font-size:11px; font-weight:700;">${label}</div>
              </td>
            `).join('')}
          </tr>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-header">محاور تقييم الجاهزية</div>
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
                      ${escapeHtml(section.comment || 'لا توجد ملاحظات مسجلة في هذا المحور')}
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
      <div class="section-header">ملاحظات وتوصيات عند الافتتاح</div>
      <div class="section-body">
        ${renderList(readinessNotes, 'لا توجد ملاحظات مسجلة')}
      </div>
    </div>

    ${renderAttachments(data.attachments, mode)}

    <div class="footer-note">
      نؤكد لسعادتكم استمرار المتابعة الميدانية اليومية حتى ختام البرنامج،
      والرفع بأي مستجدات أو ملاحظات تنفيذية أولًا بأول،
      مع الالتزام بتطبيق أعلى معايير الجودة في الإشراف والمتابعة لضمان تحقيق الأهداف التدريبية المرجوة.
    </div>

    ${renderClosing()}
  </div>

  ${mode === 'print' ? renderAutoPrintScript() : ''}
</body>
</html>
  `;
}

module.exports = { renderOpeningReport };
