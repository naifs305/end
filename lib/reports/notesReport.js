// =============================================================
// قالب تقرير ملاحظات عامة على الدورة التدريبية
// -------------------------------------------------------------
// تقرير مفتوح يُستخدم في أي وقت أثناء تنفيذ الدورة لتوثيق أي
// ملاحظات ميدانية ورفعها لسعادة وكيل الجامعة للتدريب
// =============================================================

const {
  escapeHtml,
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

function renderNotesReport({ course, data = {} }, options = {}) {
  const mode = options.mode === 'email' ? 'email' : 'print';

  const courseName = course.name || '-';
  const city = course.city || '-';
  const locationType = formatLocationType(course.locationType);
  const projectName = course.operationalProject?.name || '-';
  const supervisor =
    `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-';
  const startDate = formatDate(course.startDate);
  const endDate = formatDate(course.endDate);
  const duration = calculateDurationDays(course.startDate, course.endDate);

  const notesItems = toListItems(data.notes);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تقرير ملاحظات عامة على الدورة</title>
  <style>${sharedCSS}</style>
</head>
<body>
  <div class="page">
    ${renderHeader(
      'تقرير ملاحظات عامة على الدورة',
      'نظام إقفال الدورات التدريبية — جامعة نايف العربية للعلوم الأمنية',
    )}

    ${renderTitleBox(courseName, 'تقرير ميداني مفتوح لتوثيق الملاحظات والمستجدات أثناء تنفيذ البرنامج')}

    <div class="letter">
      <p class="paragraph"><strong>سعادة وكيل الجامعة للتدريب – سلّمه الله</strong></p>
      <p class="paragraph">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="paragraph">تحية طيبة وبعد،،</p>
      <p class="paragraph">
        نرفع لسعادتكم تقرير ملاحظات عامة بخصوص الدورة التدريبية:
        "<strong>${escapeHtml(courseName)}</strong>"،
        والمنعقدة في مدينة <strong>${escapeHtml(city)}</strong>،
        وذلك لإطلاع سعادتكم على أبرز المستجدات والملاحظات الميدانية المرصودة أثناء التنفيذ.
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
            <div class="value">${escapeHtml(formatDateTime(new Date()))}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">الملاحظات والمستجدات</div>
      <div class="section-body">
        ${renderList(notesItems, 'لم تُسجَّل أي ملاحظات')}
      </div>
    </div>

    ${renderAttachments(data.attachments, mode)}

    <div class="footer-note">
      نأمل من سعادتكم التكرم بالاطلاع، مع استمرار فريق الإشراف الميداني
      في رصد المستجدات والرفع بها أولًا بأول حرصاً على سير العمل وفق المستوى المطلوب.
    </div>

    ${renderClosing()}
  </div>

  ${mode === 'print' ? renderAutoPrintScript() : ''}
</body>
</html>
  `;
}

module.exports = { renderNotesReport };
