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

function renderClosingReport({ course, element, data }) {
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
      title: 'تقييم المادة العلمية واكتمالها على منصة LMS',
      rating: data.lms_content_evaluation?.rating,
      comment: data.lms_content_evaluation?.comment,
    },
    {
      title: 'تقييم المتدربين وانضباطهم والتزامهم',
      rating: data.trainee_evaluation?.rating,
      comment: data.trainee_evaluation?.comment,
    },
    {
      title: 'التقييم العام للبرنامج',
      rating: data.program_evaluation?.rating,
      comment: data.program_evaluation?.comment,
    },
  ];

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
      'نظام إقفال الدورات التدريبية — جامعة نايف العربية للعلوم الأمنية',
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
            <div class="label">تاريخ رفع التقرير</div>
            <div class="value">${escapeHtml(formatDateTime(element.executionAt))}</div>
          </div>
          <div class="card">
            <div class="label">عدد المتدربين المسجلين بالنظام</div>
            <div class="value">${escapeHtml(info.traineesCount || course.numTrainees || '-')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">إحصائيات المشاركة والنتائج النهائية</div>
      <div class="section-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(registeredCount)}</div>
            <div class="stat-label">عدد المشاركين المسجلين</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(actualAttendance)}</div>
            <div class="stat-label">عدد الحضور الفعلي</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(attendanceRate)}</div>
            <div class="stat-label">نسبة الحضور</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(passedCount)}</div>
            <div class="stat-label">عدد المجتازين</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(passingRate)}</div>
            <div class="stat-label">نسبة الاجتياز</div>
          </div>
        </div>
        <div class="stats-grid" style="margin-top: 10px; grid-template-columns: repeat(3, 1fr);">
          <div class="stat-card">
            <div class="stat-number">${escapeHtml(failedCount)}</div>
            <div class="stat-label">عدد غير المجتازين</div>
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
      <div class="section-header">محاور التقييم الختامية المعتمدة</div>
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
      <div class="section-header">التوصيات والمقترحات</div>
      <div class="section-body">
        ${renderList(recommendations, 'لا توجد توصيات مسجلة')}
      </div>
    </div>

    ${renderAttachments(data.attachments)}

    <div class="footer-note">
      نرفع لسعادتكم هذا التقرير الختامي تتويجاً لجهود الإشراف التنفيذي طوال فترة الدورة،
      وسنواصل متابعة إجراءات الإقفال النهائية (المستحقات، التسوية المالية، الأرشفة)
      وفق الأنظمة المعتمدة، مع الرفع بأي مستجدات وملاحظات تنفيذية أولًا بأول،
      التزاماً بأعلى معايير الجودة في تنفيذ البرامج التدريبية.
    </div>

    ${renderClosing()}
  </div>

  ${renderAutoPrintScript()}
</body>
</html>
  `;
}

module.exports = { renderClosingReport };
