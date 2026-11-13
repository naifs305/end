// =============================================================
// مستندات مترجم الدورة
// -------------------------------------------------------------
// أربعة مخرجات تُبنى كلها من بيانات واحدة (بيانات المترجم + بيانات
// الدورة)، فلا يُعاد إدخال شيء ولا يختلف اسم بين مستند وآخر:
//
//   • عقد مترجم          → صفحة قابلة للتعديل ثم الطباعة PDF
//   • نموذج استحقاق      → صفحة قابلة للتعديل ثم الطباعة PDF
//   • شهادة إنجاز ترجمة  → صفحة للطباعة على مطبوعات الجامعة
//   • طلب صرف بتحويل     → رسالة بريد جاهزة (ملف EML)
//
// الخط: Boutros Jazirah Text Light، مضمَّن من /fonts ويُحمَّل مع
// الصفحة، فيخرج في الـ PDF كما هو. وبيانات الطرف الأول (الجامعة)
// ثابتة هنا في القالب لا تُدخَل في كل مرة.
// =============================================================

const { escapeHtml, formatDate, formatLocationType, calculateDurationDays } = require('./helpers');

// ── الطرف الأول: ثابت لا يتغيّر بين عقد وآخر ─────────────────
const UNIVERSITY = {
  name: 'جامعة نايف العربية للعلوم الأمنية',
  agency: 'وكالة الجامعة للتدريب — إدارة عمليات التدريب',
  city: 'الرياض',
  country: 'المملكة العربية السعودية',
  logo: '/nauss-logo.png',
};

const DOC_TITLES = {
  contract:    'عقد ترجمة',
  entitlement: 'نموذج استحقاق مترجم',
  certificate: 'شهادة إنجاز ترجمة',
};

// ── الخط الرسمي للمستندات ────────────────────────────────────
function fontFaceCss() {
  return `
  @font-face {
    font-family: 'Boutros Jazirah Text';
    src: url('/fonts/BoutrosJazirahTextLight.ttf') format('truetype');
    font-weight: 300 400;
    font-style: normal;
    font-display: swap;
  }`;
}

function documentCss() {
  return `
  ${fontFaceCss()}

  @page { size: A4; margin: 18mm 16mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: #eef3f2;
    color: #11202b;
    font-family: 'Boutros Jazirah Text', 'Cairo', Tahoma, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.95;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    background: #fff;
    padding: 20mm 16mm;
    min-height: 297mm;
  }

  .doc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border-bottom: 3px solid #016564;
    padding-bottom: 12px;
  }

  .doc-header h1 { margin: 0; font-size: 21px; font-weight: 700; color: #016564; }
  .doc-header p  { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
  .doc-header img { width: 130px; height: auto; object-fit: contain; }

  .doc-title {
    margin: 22px 0 6px;
    text-align: center;
    font-size: 23px;
    font-weight: 700;
    color: #013b3c;
    letter-spacing: 0.3px;
  }

  .doc-meta { text-align: center; font-size: 12px; color: #6b7280; margin-bottom: 20px; }

  table.data { width: 100%; border-collapse: collapse; margin: 14px 0 20px; }
  table.data th, table.data td {
    border: 1px solid #d6e0df;
    padding: 9px 11px;
    font-size: 14px;
    text-align: right;
    vertical-align: top;
  }
  table.data th { background: #f0f6f5; color: #013b3c; font-weight: 700; width: 32%; }

  .section-title {
    margin: 22px 0 8px;
    font-size: 16px;
    font-weight: 700;
    color: #016564;
    border-right: 4px solid #016564;
    padding-right: 10px;
  }

  .editable {
    min-height: 60px;
    padding: 10px 12px;
    border-radius: 8px;
    outline: none;
    white-space: pre-wrap;
  }

  .signatures {
    display: flex;
    gap: 24px;
    margin-top: 42px;
    page-break-inside: avoid;
  }
  .signature {
    flex: 1;
    text-align: center;
    padding-top: 10px;
  }
  .signature .role { font-weight: 700; font-size: 14px; color: #013b3c; }
  .signature .who  { font-size: 13px; color: #374151; margin-top: 2px; }
  .signature .line {
    margin-top: 48px;
    border-top: 1px solid #9aa8a7;
    padding-top: 6px;
    font-size: 12px;
    color: #6b7280;
  }

  /* ── شريط الأدوات: على الشاشة فقط ───────────────────────── */
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    max-width: 210mm;
    margin: 12px auto;
    padding: 12px 14px;
    background: #013b3c;
    color: #fff;
    border-radius: 12px;
    font-family: 'Cairo', Tahoma, Arial, sans-serif;
    font-size: 13px;
  }
  .toolbar button {
    font: inherit;
    font-weight: 700;
    border: 0;
    border-radius: 9px;
    padding: 9px 16px;
    cursor: pointer;
    background: #f3b229;
    color: #11202b;
  }
  .toolbar button.ghost { background: rgba(255,255,255,.14); color: #fff; }
  .toolbar .hint { opacity: .85; }
  .toolbar .state { margin-right: auto; font-weight: 700; }

  body.editing .editable {
    border: 1px dashed #9aa8a7;
    background: #fbfdfc;
  }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheet { padding: 0; min-height: auto; }
    .editable { border: 0 !important; background: transparent !important; padding: 0; }
  }`;
}

function renderDocHeader() {
  return `
    <div class="doc-header">
      <div>
        <h1>${escapeHtml(UNIVERSITY.name)}</h1>
        <p>${escapeHtml(UNIVERSITY.agency)}</p>
      </div>
      <img src="${UNIVERSITY.logo}" alt="شعار الجامعة" />
    </div>`;
}

/** شريط التعديل والطباعة — لا يظهر في الـ PDF */
function renderToolbar(trackingId, canEdit) {
  const saveButton = canEdit && trackingId
    ? `<button type="button" id="saveBtn">حفظ النص</button>`
    : '';

  return `
    <div class="toolbar">
      <span class="hint">عدّل النص ثم اطبع — واختر «حفظ بصيغة PDF» من نافذة الطباعة.</span>
      ${saveButton}
      <button type="button" class="ghost" id="printBtn">طباعة / حفظ PDF</button>
      <span class="state" id="state"></span>
    </div>`;
}

function renderToolbarScript(trackingId, canEdit) {
  return `
    <script>
      (function () {
        document.body.classList.add('editing');
        var state = document.getElementById('state');
        var printBtn = document.getElementById('printBtn');
        var saveBtn = document.getElementById('saveBtn');

        function collect() {
          var out = {};
          document.querySelectorAll('[data-field]').forEach(function (node) {
            out[node.getAttribute('data-field')] = node.innerText.trim();
          });
          return out;
        }

        if (printBtn) {
          printBtn.addEventListener('click', function () {
            document.body.classList.remove('editing');
            window.print();
            setTimeout(function () { document.body.classList.add('editing'); }, 400);
          });
        }

        if (saveBtn) {
          saveBtn.addEventListener('click', function () {
            state.textContent = 'جارٍ الحفظ…';
            fetch('/api/closure/${escapeHtml(trackingId || '')}/interpreter-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ sections: collect() }),
            })
              .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function () { state.textContent = 'حُفظ النص ✓'; })
              .catch(function () { state.textContent = 'تعذّر الحفظ — انسخ النص قبل الإغلاق'; });
          });
        }
      })();
    </script>`;
}

function courseRows(course) {
  const duration = calculateDurationDays(course.startDate, course.endDate);
  return `
    <tr><th>اسم البرنامج التدريبي</th><td>${escapeHtml(course.name || '-')}</td></tr>
    <tr><th>رقم البرنامج</th><td>${escapeHtml(course.code || '-')}</td></tr>
    <tr><th>تاريخ التنفيذ</th><td>من ${escapeHtml(formatDate(course.startDate))} إلى ${escapeHtml(formatDate(course.endDate))}${duration ? ` (${duration} يوماً)` : ''}</td></tr>
    <tr><th>مقر التنفيذ</th><td>${escapeHtml(course.city || '-')} — ${escapeHtml(formatLocationType(course.locationType))}</td></tr>
    <tr><th>الجهة المستفيدة</th><td>${escapeHtml(course.beneficiaryEntity || '-')}</td></tr>`;
}

function interpreterRows(interpreter, { withAmount = false } = {}) {
  const amount = interpreter.amount === null || interpreter.amount === undefined
    ? null
    : Number(interpreter.amount);

  return `
    <tr><th>الاسم</th><td>${escapeHtml(interpreter.fullName || '-')}</td></tr>
    <tr><th>رقم الهوية الوطنية</th><td>${escapeHtml(interpreter.nationalId || '-')}</td></tr>
    <tr><th>البريد الإلكتروني</th><td>${escapeHtml(interpreter.email || '-')}</td></tr>
    <tr><th>رقم الجوال</th><td>${escapeHtml(interpreter.mobile || '-')}</td></tr>
    <tr><th>العنوان</th><td>${escapeHtml(interpreter.address || '-')}</td></tr>
    ${withAmount && amount !== null
      ? `<tr><th>قيمة المستحق</th><td>${escapeHtml(amount.toLocaleString('ar-SA'))} ريال</td></tr>`
      : ''}`;
}

function editableBlock(field, saved, placeholder) {
  const text = saved && String(saved).trim() ? String(saved) : '';
  return `
    <div class="editable" contenteditable="true" data-field="${escapeHtml(field)}"
         data-placeholder="${escapeHtml(placeholder)}">${escapeHtml(text) || escapeHtml(placeholder)}</div>`;
}

function renderPage({ title, meta, body, trackingId, canEdit }) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap');
    ${documentCss()}
  </style>
</head>
<body>
  ${renderToolbar(trackingId, canEdit)}
  <div class="sheet">
    ${renderDocHeader()}
    <h2 class="doc-title">${escapeHtml(title)}</h2>
    <p class="doc-meta">${escapeHtml(meta)}</p>
    ${body}
  </div>
  ${renderToolbarScript(trackingId, canEdit)}
</body>
</html>`;
}

// ======================================================================
// (١) عقد مترجم الدورة
// ----------------------------------------------------------------------
// الطرف الأول ثابت، والطرف الثاني من بيانات المترجم، وبيانات البرنامج
// من الدورة. ونصّ البنود منطقة قابلة للتعديل — تُملأ بالصيغة المعتمدة.
// ======================================================================
function renderInterpreterContract({ course, interpreter, sections = {} }, options = {}) {
  const body = `
    <div class="section-title">الطرف الأول</div>
    <table class="data">
      <tr><th>الجهة</th><td>${escapeHtml(UNIVERSITY.name)}</td></tr>
      <tr><th>الإدارة</th><td>${escapeHtml(UNIVERSITY.agency)}</td></tr>
      <tr><th>المقر</th><td>${escapeHtml(UNIVERSITY.city)} — ${escapeHtml(UNIVERSITY.country)}</td></tr>
    </table>

    <div class="section-title">الطرف الثاني (المترجم)</div>
    <table class="data">${interpreterRows(interpreter, { withAmount: true })}</table>

    <div class="section-title">بيانات البرنامج</div>
    <table class="data">${courseRows(course)}</table>

    <div class="section-title">التمهيد</div>
    ${editableBlock('preamble', sections.preamble, 'يُكتب هنا تمهيد العقد بالصيغة المعتمدة.')}

    <div class="section-title">بنود العقد</div>
    ${editableBlock('terms', sections.terms, 'تُكتب هنا بنود العقد بالصيغة المعتمدة.')}

    <div class="signatures">
      <div class="signature">
        <div class="role">الطرف الأول</div>
        <div class="who">${escapeHtml(UNIVERSITY.agency)}</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
      <div class="signature">
        <div class="role">الطرف الثاني</div>
        <div class="who">${escapeHtml(interpreter.fullName || '-')}</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
    </div>`;

  return renderPage({
    title: DOC_TITLES.contract,
    meta: `${course.name || ''} — ${formatDate(course.startDate)}`,
    body,
    trackingId: options.trackingId,
    canEdit: options.canEdit !== false,
  });
}

// ======================================================================
// (٢) نموذج استحقاق المترجم (مترجم بسلفة)
// ======================================================================
function renderInterpreterEntitlement({ course, interpreter, sections = {} }, options = {}) {
  const body = `
    <div class="section-title">بيانات المترجم</div>
    <table class="data">${interpreterRows(interpreter, { withAmount: true })}</table>

    <div class="section-title">بيانات البرنامج</div>
    <table class="data">${courseRows(course)}</table>

    <div class="section-title">بيان الاستحقاق</div>
    ${editableBlock(
      'statement',
      sections.statement,
      'يُكتب هنا بيان الاستحقاق بالصيغة المعتمدة.',
    )}

    <div class="section-title">إقرار المترجم</div>
    ${editableBlock(
      'acknowledgement',
      sections.acknowledgement,
      'يُكتب هنا إقرار المترجم باستلام المستحق بالصيغة المعتمدة.',
    )}

    <div class="signatures">
      <div class="signature">
        <div class="role">المترجم</div>
        <div class="who">${escapeHtml(interpreter.fullName || '-')}</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
      <div class="signature">
        <div class="role">منسق البرنامج</div>
        <div class="who">${escapeHtml(
          `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-',
        )}</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
      <div class="signature">
        <div class="role">مدير إدارة عمليات التدريب</div>
        <div class="who">&nbsp;</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
    </div>`;

  return renderPage({
    title: DOC_TITLES.entitlement,
    meta: `${course.name || ''} — ${formatDate(course.endDate)}`,
    body,
    trackingId: options.trackingId,
    canEdit: options.canEdit !== false,
  });
}

// ======================================================================
// (٣) شهادة إنجاز الترجمة
// ----------------------------------------------------------------------
// تُطبع على مطبوعات الجامعة، فالصفحة بلا ترويسة مطبوعة افتراضياً
// (خيار «بترويسة» متاح لمن يطبع على ورق أبيض).
// ======================================================================
function renderInterpreterCertificate({ course, interpreter, sections = {} }, options = {}) {
  const duration = calculateDurationDays(course.startDate, course.endDate);

  const body = `
    <div style="text-align:center; margin-top:18mm;">
      <p style="font-size:16px; margin:0 0 10px;">تشهد ${escapeHtml(UNIVERSITY.name)} بأن</p>
      <p style="font-size:26px; font-weight:700; color:#013b3c; margin:10px 0;">${escapeHtml(interpreter.fullName || '-')}</p>
      <p style="font-size:16px; margin:10px 0 0; line-height:2.2;">
        قد قام بأعمال الترجمة في البرنامج التدريبي
        <strong>«${escapeHtml(course.name || '-')}»</strong>،
        المنفَّذ في ${escapeHtml(course.city || '-')}
        خلال الفترة من ${escapeHtml(formatDate(course.startDate))}
        إلى ${escapeHtml(formatDate(course.endDate))}${duration ? ` (${duration} يوماً)` : ''}،
        وأنجز ما أُسنِد إليه على الوجه المطلوب.
      </p>
    </div>

    <div style="margin-top:14mm;">
      ${editableBlock('note', sections.note, 'سطر إضافي اختياري — يُحذف إن لم يُحتج إليه.')}
    </div>

    <div class="signatures" style="margin-top:26mm;">
      <div class="signature">
        <div class="role">وكالة الجامعة للتدريب</div>
        <div class="who">إدارة عمليات التدريب</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
    </div>`;

  return renderPage({
    title: DOC_TITLES.certificate,
    meta: `${escapeHtml(course.code || '')}`,
    body,
    trackingId: options.trackingId,
    canEdit: options.canEdit !== false,
  });
}

// ======================================================================
// (٤) طلب صرف مستحقات المترجم — مترجم بتحويل
// ----------------------------------------------------------------------
// لا عقد ولا نموذج: رسالة بريد جاهزة تُفتح في برنامج البريد وتُرسل
// بتوقيع المنسق نفسه. والخطوط هنا بريدية (لا تُحمَّل خطوط خارجية).
// ======================================================================
function renderInterpreterTransferEmail({ course, interpreter }) {
  const amount = interpreter.amount === null || interpreter.amount === undefined
    ? null
    : Number(interpreter.amount);

  const coordinator = `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim();

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /></head>
<body style="margin:0; padding:18px; background:#ffffff; font-family:'Cairo',Tahoma,Arial,sans-serif; color:#11202b; line-height:1.9; font-size:14px;">
  <p style="margin:0 0 14px;">سعادة الأستاذ/ـة المحترم/ـة،</p>
  <p style="margin:0 0 14px;">السلام عليكم ورحمة الله وبركاته، وبعد:</p>

  <p style="margin:0 0 14px;">
    نفيدكم بأن المترجم <strong>${escapeHtml(interpreter.fullName || '-')}</strong>
    قد أتمّ أعمال الترجمة المطلوبة منه في البرنامج التدريبي
    <strong>«${escapeHtml(course.name || '-')}»</strong>
    ${course.code ? `(${escapeHtml(course.code)})` : ''}،
    المنفَّذ في ${escapeHtml(course.city || '-')}
    خلال الفترة من ${escapeHtml(formatDate(course.startDate))}
    إلى ${escapeHtml(formatDate(course.endDate))}،
    على الوجه المطلوب.
  </p>

  <p style="margin:0 0 14px;">
    عليه، نأمل التكرّم بالتوجيه بصرف مستحقاته عن أعمال الترجمة
    ${amount !== null ? `بمبلغ <strong>${escapeHtml(amount.toLocaleString('ar-SA'))} ريال</strong> ` : ''}
    عن طريق التحويل، وفق البيانات أدناه.
  </p>

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; margin:0 0 16px;">
    <tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700; width:34%;">الاسم</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(interpreter.fullName || '-')}</td></tr>
    <tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700;">رقم الهوية الوطنية</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(interpreter.nationalId || '-')}</td></tr>
    <tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700;">البريد الإلكتروني</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(interpreter.email || '-')}</td></tr>
    <tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700;">رقم الجوال</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(interpreter.mobile || '-')}</td></tr>
    <tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700;">العنوان</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(interpreter.address || '-')}</td></tr>
    ${interpreter.notes ? `<tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700;">ملاحظات</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(interpreter.notes)}</td></tr>` : ''}
  </table>

  <p style="margin:0 0 6px;">وتقبلوا تحياتي،</p>
  <p style="margin:0; font-weight:700;">${escapeHtml(coordinator || 'منسق البرنامج')}</p>
  <p style="margin:2px 0 0; color:#6b7280; font-size:12px;">${escapeHtml(UNIVERSITY.agency)}</p>
</body>
</html>`;
}

module.exports = {
  UNIVERSITY,
  DOC_TITLES,
  fontFaceCss,
  renderInterpreterContract,
  renderInterpreterEntitlement,
  renderInterpreterCertificate,
  renderInterpreterTransferEmail,
};
