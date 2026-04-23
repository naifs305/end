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

function renderAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
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

function renderOpeningReport({ course, element, data }) {
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
  ];

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
        <div class="info-grid">
          <div class="card">
            <div class="label">اسم الدورة</div>
            <div class="value">${escapeHtml(courseName)}</div>
          </div>
          <div class="card">
            <div class="label">المشروع التشغيلي</div>
            <div class="value">${escapeHtml(projectName)}</div>
          </div>
          <div class="card">
            <div class="label">المشرف الميداني</div>
            <div class="value">${escapeHtml(supervisor)}</div>
          </div>
          <div class="card">
            <div class="label">مكان الانعقاد</div>
            <div class="value">${escapeHtml(city)}</div>
          </div>
          <div class="card">
            <div class="label">مقر التنفيذ</div>
            <div class="value">${escapeHtml(locationType)}</div>
          </div>
          <div class="card">
            <div class="label">فترة التنفيذ</div>
            <div class="value">${escapeHtml(startDate)} - ${escapeHtml(endDate)}</div>
          </div>
          <div class="card">
            <div class="label">المدة</div>
            <div class="value">${escapeHtml(duration)}</div>
          </div>
          <div class="card">
            <div class="label">تاريخ افتتاح الدورة</div>
            <div class="value">${escapeHtml(formatDateTime(element.executionAt))}</div>
          </div>
          <div class="card">
            <div class="label">عدد المتدربين المسجلين</div>
            <div class="value">${escapeHtml(info.traineesCount || course.numTrainees || '-')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">إحصائيات الحضور الأولي</div>
      <div class="section-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(registeredCount)}</div>
            <div class="stat-label">عدد المشاركين المسجلين</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(initialAttendance)}</div>
            <div class="stat-label">عدد الحضور في اليوم الأول</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(initialAttendanceRate)}</div>
            <div class="stat-label">نسبة الحضور الأولية</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(trainersCount)}</div>
            <div class="stat-label">عدد المدربين</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(translatorsCount)}</div>
            <div class="stat-label">عدد المترجمين</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">محاور تقييم الجاهزية</div>
      <div class="section-body">
        <div class="evaluations-grid">
          ${evaluationSections
            .map(
              (section) => `
                <div class="evaluation-card">
                  <div class="evaluation-head">
                    <div class="evaluation-title">${escapeHtml(section.title)}</div>
                    <span class="${getRatingClass(section.rating)}">${escapeHtml(
                      getRatingLabel(section.rating),
                    )}</span>
                  </div>
                  <div class="note-box">
                    ${escapeHtml(section.comment || 'لا توجد ملاحظات مسجلة في هذا المحور')}
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">ملاحظات وتوصيات عند الافتتاح</div>
      <div class="section-body">
        ${renderList(readinessNotes, 'لا توجد ملاحظات مسجلة')}
      </div>
    </div>

    ${renderAttachments(data.attachments)}

    <div class="footer-note">
      نؤكد لسعادتكم استمرار المتابعة الميدانية اليومية حتى ختام البرنامج،
      والرفع بأي مستجدات أو ملاحظات تنفيذية أولًا بأول،
      مع الالتزام بتطبيق أعلى معايير الجودة في الإشراف والمتابعة لضمان تحقيق الأهداف التدريبية المرجوة.
    </div>

    ${renderClosing()}
  </div>

  ${renderAutoPrintScript()}
</body>
</html>
  `;
}

module.exports = { renderOpeningReport };
