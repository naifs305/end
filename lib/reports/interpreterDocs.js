// =============================================================
// مستندات مترجم الدورة
// -------------------------------------------------------------
// أربعة مخرجات تُبنى كلها من بيانات واحدة (بيانات المترجم + بيانات
// الدورة)، فلا يُعاد إدخال شيء ولا يختلف اسم بين مستند وآخر:
//
//   • عقد تقديم خدمات أعمال الترجمة الفورية → صفحة تُعدَّل ثم PDF
//   • نموذج استحقاق مالي (TF05)             → كذلك
//   • شهادة إنجاز ترجمة                     → كذلك
//   • طلب صرف مستحقات بتحويل                → رسالة بريد (EML)
//
// نصوص العقد ونموذج الاستحقاق والشهادة منقولة من الصيغ المعتمدة،
// وكل فقرة قابلة للتعديل في الصفحة قبل التصدير — وما يُعدَّل يُحفظ
// مع العنصر فيعود كما تُرك.
//
// الخط: Boutros Jazirah Text Light، مضمَّن من /fonts فيخرج في الـ
// PDF كما هو. وبيانات الطرف الأول من إعدادات المنصة لا من الكود.
// =============================================================

const { escapeHtml, formatDate, calculateDurationDays } = require('./helpers');
const { amountInWords, formatAmount, toArabicDigits } = require('./arabicNumbers');

// ── الطرف الأول: ثابت، وما قد يتغيّر منه يأتي من الإعدادات ────
const UNIVERSITY = {
  name: 'جامعة نايف العربية للعلوم الأمنية',
  agency: 'وكالة الجامعة للتدريب — إدارة عمليات التدريب',
  trainingAgency: 'وكالة التدريب',
  addressLine: 'مقرها الرئيسي الرياض طريق خريص، المملكة العربية السعودية، ص.ب 6830، الرياض 11452',
  phone: '0112463444',
  fax: '011246471',
  city: 'الرياض',
  country: 'المملكة العربية السعودية',
  taxCertificate: '300116564600003',
  taxCertificateHijri: '1438/12/02هـ',
  taxCertificateGregorian: '2017/08/24م',
  logo: '/nauss-logo.png',
};

const CONTRACT_DEFAULTS = {
  rep: 'عبد الرزاق عبد العزيز المرجان',
  repTitle: 'وكيل الجامعة للتدريب',
  email: 't-aalmargan@nauss.edu.sa',
  bufferDays: 2,
};

const DOC_TITLES = {
  contract: 'عقد تقديم خدمات أعمال الترجمة الفورية',
  entitlement: 'نموذج استحقـاق مالـي',
  certificate: 'شهادة إنجاز ترجمة',
};

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// ── تواريخ ───────────────────────────────────────────────────

function gregorian(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

/** التاريخ الهجري بتقويم أم القرى — فلا يُكتب يداً ولا يُخطأ فيه */
function hijri(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).formatToParts(d);
    const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
    const year = get('year').replace(/\D/g, '');
    return `${year}/${get('month')}/${get('day')}`;
  } catch {
    return '';
  }
}

function weekday(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getDay()];
}

function shiftDays(date, days) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

/** عدد الأيام شاملاً الطرفين — مدة العقد تُحسب كذلك */
function inclusiveDays(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

// ── الخط والتنسيق ────────────────────────────────────────────

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

  @page { size: A4; margin: 16mm 15mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: #eef3f2;
    color: #11202b;
    font-family: 'Boutros Jazirah Text', 'Cairo', Tahoma, Arial, sans-serif;
    font-size: 14.5px;
    line-height: 1.95;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto 20px;
    background: #fff;
    padding: 16mm 15mm;
  }

  .doc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border-bottom: 3px solid #016564;
    padding-bottom: 10px;
  }
  .doc-header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #016564; }
  .doc-header p  { margin: 3px 0 0; font-size: 11.5px; color: #6b7280; }
  .doc-header img { width: 120px; height: auto; object-fit: contain; }

  .doc-title {
    margin: 18px 0 2px;
    text-align: center;
    font-size: 21px;
    font-weight: 700;
    color: #013b3c;
  }
  .doc-ref { text-align: center; font-size: 13px; color: #374151; margin: 0 0 16px; }

  .article-title {
    margin: 18px 0 4px;
    font-size: 15.5px;
    font-weight: 700;
    color: #016564;
  }

  table.data { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
  table.data th, table.data td {
    border: 1px solid #c9d6d5;
    padding: 8px 10px;
    font-size: 13.5px;
    text-align: center;
    vertical-align: middle;
  }
  table.data th { background: #f0f6f5; color: #013b3c; font-weight: 700; }
  table.data td.label, table.data th.label { text-align: right; width: 32%; background: #f0f6f5; }
  table.data td.rtl { text-align: right; }

  .editable { outline: none; white-space: pre-wrap; }
  .editable ol, .editable ul { margin: 6px 0; padding-inline-start: 22px; }
  .editable li { margin-bottom: 2px; }
  .editable p { margin: 0 0 8px; }

  /* رقم الايبان نص لاتيني: يُقرأ من اليسار، ويُحاذى يمين الصفحة */
  .iban-boxes {
    display: flex; flex-wrap: wrap; gap: 2px; margin: 8px 0 14px;
    direction: ltr; justify-content: flex-end;
  }
  .iban-boxes span {
    width: 22px; height: 28px;
    border: 1px solid #c9d6d5;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
  }

  .choices { display: flex; flex-wrap: wrap; gap: 14px; margin: 6px 0 14px; }
  .choice { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; }
  .box {
    width: 15px; height: 15px;
    border: 1.4px solid #44514f;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; line-height: 1;
  }

  .signatures { display: flex; gap: 22px; margin-top: 34px; page-break-inside: avoid; }
  .signature { flex: 1; text-align: center; }
  .signature .role { font-weight: 700; font-size: 13.5px; color: #013b3c; }
  .signature .who  { font-size: 13px; color: #374151; margin-top: 2px; min-height: 20px; }
  .signature .line {
    margin-top: 40px;
    border-top: 1px solid #9aa8a7;
    padding-top: 5px;
    font-size: 12px;
    color: #6b7280;
  }

  .note { font-size: 12.5px; color: #6b7280; }

  /* الطباعة على مطبوعات الجامعة: الترويسة مطبوعة سلفاً على الورق */
  body.no-header .doc-header { display: none; }
  body.no-header .sheet { padding-top: 38mm; }

  /* ── شريط الأدوات: على الشاشة فقط ───────────────────────── */
  .toolbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    max-width: 210mm; margin: 12px auto; padding: 12px 14px;
    background: #013b3c; color: #fff; border-radius: 12px;
    font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 13px;
  }
  .toolbar button {
    font: inherit; font-weight: 700; border: 0; border-radius: 9px;
    padding: 9px 16px; cursor: pointer; background: #f3b229; color: #11202b;
  }
  .toolbar button.ghost { background: rgba(255,255,255,.14); color: #fff; }
  .toolbar .hint { opacity: .85; }
  .toolbar .state { margin-right: auto; font-weight: 700; }

  body.editing .editable {
    border: 1px dashed #b9c5c4;
    border-radius: 6px;
    padding: 6px 8px;
    background: #fbfdfc;
  }
  body.editing .editable:focus { border-color: #016564; background: #fff; }
  body.editing .inline-edit {
    border-bottom: 1px dashed #016564;
    padding: 0 3px;
  }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheet { padding: 0; margin: 0; }
    .editable, .inline-edit { border: 0 !important; background: transparent !important; padding: 0 !important; }
  }`;
}

function renderDocHeader(subtitle) {
  return `
    <div class="doc-header">
      <div>
        <h1>${escapeHtml(UNIVERSITY.name)}</h1>
        <p>${escapeHtml(subtitle || UNIVERSITY.agency)}</p>
      </div>
      <img src="${UNIVERSITY.logo}" alt="شعار الجامعة" />
    </div>`;
}

function renderToolbar(trackingId, canEdit, letterheadOption) {
  // خيار الطباعة على مطبوعات الجامعة: يُخفي الترويسة فلا تتكرر
  const letterhead = letterheadOption
    ? `<label class="choice" style="color:#fff;"><input type="checkbox" id="noHeader" /> بلا ترويسة (للطباعة على مطبوعات الجامعة)</label>`
    : '';

  return `
    <div class="toolbar">
      <span class="hint">عدّل أي نص في الصفحة، ثم اطبع واختر «حفظ بصيغة PDF».</span>
      ${letterhead}
      ${canEdit && trackingId ? '<button type="button" id="saveBtn">حفظ النص</button>' : ''}
      <button type="button" class="ghost" id="printBtn">طباعة / حفظ PDF</button>
      <span class="state" id="state"></span>
    </div>`;
}

function renderToolbarScript(trackingId, canEdit) {
  const endpoint = `/api/closure/${encodeURIComponent(trackingId || '')}/interpreter-text`;
  return `
    <script>
      (function () {
        document.body.classList.add('editing');
        var state = document.getElementById('state');
        var printBtn = document.getElementById('printBtn');
        var saveBtn = document.getElementById('saveBtn');
        var noHeader = document.getElementById('noHeader');

        if (noHeader) {
          noHeader.addEventListener('change', function () {
            document.body.classList.toggle('no-header', noHeader.checked);
          });
        }

        if (printBtn) {
          printBtn.addEventListener('click', function () {
            document.body.classList.remove('editing');
            window.print();
            setTimeout(function () { document.body.classList.add('editing'); }, 500);
          });
        }

        if (saveBtn) {
          saveBtn.addEventListener('click', function () {
            var out = {};
            document.querySelectorAll('[data-field]').forEach(function (node) {
              out[node.getAttribute('data-field')] = node.innerText.replace(/\\u00a0/g, ' ').trim();
            });
            state.textContent = 'جارٍ الحفظ…';
            fetch(${JSON.stringify(endpoint)}, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ sections: out }),
            })
              .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function () { state.textContent = 'حُفظ النص ✓'; })
              .catch(function () { state.textContent = 'تعذّر الحفظ — انسخ النص قبل الإغلاق'; });
          });
        }
      })();
    </script>`;
}

/**
 * فقرة قابلة للتعديل.
 * النص المحفوظ يُعرض نصاً مهروباً (لا HTML) — فما يكتبه المنسق
 * لا يُنفَّذ في الصفحة. وما لم يُعدَّل يُعرض بالصيغة المعتمدة كاملة.
 */
function editable(field, saved, defaultHtml, tag = 'div') {
  const text = typeof saved === 'string' ? saved.trim() : '';
  const content = text ? escapeHtml(text) : defaultHtml;
  return `<${tag} class="editable" contenteditable="true" data-field="${escapeHtml(field)}">${content}</${tag}>`;
}

function inlineEdit(field, saved, defaultText) {
  const text = typeof saved === 'string' && saved.trim() ? saved.trim() : String(defaultText ?? '');
  return `<span class="inline-edit editable" contenteditable="true" data-field="${escapeHtml(field)}">${escapeHtml(text)}</span>`;
}

function renderPage({ title, subtitle, refLine, body, trackingId, canEdit, letterheadOption }) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap');
    ${documentCss()}
  </style>
</head>
<body>
  ${renderToolbar(trackingId, canEdit, letterheadOption)}
  <div class="sheet">
    ${renderDocHeader(subtitle)}
    <h2 class="doc-title">${escapeHtml(title)}</h2>
    ${refLine ? `<p class="doc-ref">${refLine}</p>` : ''}
    ${body}
  </div>
  ${renderToolbarScript(trackingId, canEdit)}
</body>
</html>`;
}

// ======================================================================
// (١) عقد تقديم خدمات أعمال الترجمة الفورية
// ======================================================================

function contractFacts({ course, interpreter, config = {} }) {
  const cfg = { ...CONTRACT_DEFAULTS, ...config };
  const buffer = Number.isFinite(Number(cfg.bufferDays)) ? Number(cfg.bufferDays) : CONTRACT_DEFAULTS.bufferDays;

  const from = shiftDays(course.startDate, -buffer);
  const to = shiftDays(course.endDate, buffer);

  const total = interpreter.amount === null || interpreter.amount === undefined
    ? null
    : Number(interpreter.amount);
  const half = total !== null ? Math.round((total / 2) * 100) / 100 : null;

  // رقم العقد: تسلسل الدورة مع سنتها — od-2026-0042 → 0042/NAUSS/26
  const codeSerial = String(course.code || '').split('-').pop() || '----';
  const year2 = String(new Date(course.startDate).getFullYear() || '').slice(-2) || '--';

  return {
    cfg,
    buffer,
    contractNo: `${codeSerial}/NAUSS/${year2}`,
    today: new Date(),
    from,
    to,
    durationDays: from && to ? inclusiveDays(from, to) : 0,
    total,
    half,
    courseDays: calculateDurationDays(course.startDate, course.endDate),
  };
}

function renderInterpreterContract({ course, interpreter, sections = {}, config = {} }, options = {}) {
  const f = contractFacts({ course, interpreter, config });
  const s = sections || {};

  const amountCell = f.total !== null
    ? `(${escapeHtml(formatAmount(f.total))}) (${escapeHtml(amountInWords(f.total))})`
    : '(................) (................)';
  const halfCell = f.half !== null
    ? `(${escapeHtml(formatAmount(f.half))}) (${escapeHtml(amountInWords(f.half))})`
    : '(................) (................)';

  const body = `
    <p>
      إنـه في يوم ${inlineEdit('day', s.day, weekday(f.today))}
      بتاريخ ${inlineEdit('hijriDate', s.hijriDate, hijri(f.today))}هـ،
      الموافق ${inlineEdit('gregDate', s.gregDate, gregorian(f.today))}م
      تم الاتفاق بمدينة ${escapeHtml(UNIVERSITY.city)} على توقيع وتنفيذ هذا العقد بين كل من:
    </p>

    <p>
      <strong>1-</strong> ${escapeHtml(UNIVERSITY.name)}، ${escapeHtml(UNIVERSITY.addressLine)}،
      هاتف: ${escapeHtml(UNIVERSITY.phone)} فاكس ${escapeHtml(UNIVERSITY.fax)}
      بريد إلكتروني (${escapeHtml(f.cfg.email)}) ويمثلها لتوقيع هذا العقد
      سعادة الدكتور ${escapeHtml(f.cfg.rep)}، بصفته ${escapeHtml(f.cfg.repTitle)}،
      ويشار إليها فيما بعد بـ("الطرف الأول" أو "الجامعة").
    </p>

    <p>
      <strong>2-</strong> ${escapeHtml(interpreter.fullName || '')}،
      ${interpreter.nationality ? `(${escapeHtml(interpreter.nationality)} الجنسية)، ` : ''}
      بموجب هوية وطنية رقم (${escapeHtml(interpreter.nationalId || '')})
      بريد إلكتروني (${escapeHtml(interpreter.email || '')})
      هاتف الجوال: ${escapeHtml(interpreter.mobile || '')}
      العنوان ${escapeHtml(interpreter.address || '')}
      (ويشار إليه فيما بعد بـ "الطرف الثاني" أو "المتعاون").
    </p>

    <div class="article-title">التمهيد</div>
    ${editable('preamble', s.preamble, `حيث إن الطرف الأول مؤسسة علمية عربية أمنية ذات شخصية اعتبارية مستقلة، وهي الجهاز العلمي لمجلس وزراء الداخلية العرب تعنى بالتعليم العالي والبحث العلمي والتدريب في المجالات الأمنية والميادين ذات العلاقة، ولديها الرغبة في التعاقد مع شخص يمتلك خبرة أمنية وعسكرية كافية وإتقانه للغة الإنجليزية تؤهله لتقديم خدمات الترجمة الفورية باحترافية وكفاءة عالية، وبما أن الطرف الثاني أبدى قبوله بتنفيذها فقد تلاقت إرادة الطرفين إيجابا وقبولا وهما بكامل أهليتهما المعتبرة شرعا ونظاما على إبرام وتنفيذ هذا العقد، وتم الاتفاق فيما بينهما على ما يلي.`)}

    <div class="article-title">المادة الأولى: إلزامية التمهيد</div>
    ${editable('art1', s.art1, `يُعد التمهيد أعلاه، وكافة الوثائق المرفقة بهذا العقد أو الملاحق اللاحقة جزء لا يتجزأ من هذا العقد وتسري عليها كافة أحكامه، ويرجع إليها لبيان إرادة الطرفين وما اتجهت إليه.`)}

    <div class="article-title">المادة الثانية: وثائق العقد</div>
    ${editable('art2', s.art2, `يتألف هذا العقد من المستندات والوثائق التالية:
<ol><li>وثيقة العقد الأساسية.</li><li>الشروط الخاصة لوكالة الجامعة للتدريب.</li></ol>`)}

    <div class="article-title">المادة الثالثة: موضوع العقد</div>
    ${editable('art3', s.art3, `اتفق الطرفان على أن يلتزم الطرف الثاني بتقديم خدمات الترجمة الفورية بين اللغتين العربية والإنجليزية للطرف الأول ومستفيديه، وذلك أثناء تنفيذ الدورة التدريبية المقرر عقدها في ${escapeHtml(course.city || '')}، بما يضمن نقل المحتوى التدريبي بدقة، ووفقا للتعليمات، والمتطلبات التي يحددها الطرف الأول، وبما يتوافق مع تفاصيل الدورة الموضحة في الجدول الآتي:`)}
    <table class="data">
      <tr><th>عنوان الدورة التدريبية</th><th>تاريخ البداية</th><th>تاريخ النهاية</th></tr>
      <tr>
        <td class="rtl">${escapeHtml(course.name || '')}</td>
        <td>${escapeHtml(gregorian(course.startDate))}</td>
        <td>${escapeHtml(gregorian(course.endDate))}م</td>
      </tr>
    </table>

    <div class="article-title">المادة الرابعة: مدة العقد</div>
    ${editable('art4', s.art4, `مدة هـذا العقـد (${f.durationDays}) يوما يبدأ سريانه بتاريخ ${escapeHtml(gregorian(f.from))}م، وينتهي بتاريخ ${escapeHtml(gregorian(f.to))}م.`)}

    <div class="article-title">المادة الخامسة: قيمة العقد وطريقة الدفع</div>
    ${editable('art5', s.art5, `يلتزم الطرف الثاني بتنفيذ المهام المشار إليها في ("البند الثالث") من هذا العقد مقابل مبلغ إجمالي مقداره ${amountCell}، ويدفع الطرف الأول قيمة هذا العقد بـ(الريال السعودي) إلى الطرف الثاني على دفعتين وفقا لما يلي:
<ol><li>دفعة أولى (50%) من قيمة هذا العقد بإجمالي مبلغ وقدره ${halfCell} تدفع بعد توقيع العقد من الطرفين وحصول الطرف الثاني على تأشيرة السفر.</li><li>دفعة أخيرة (50%) من قيمة هذا العقد بإجمالي مبلغ وقدره ${halfCell} تدفع بعد نهاية الدورة التدريبية وإكمال الترجمة الفورية محل العقد، ويشترط لدفعها حصول الطرف الثاني على شهادة إنجاز من الطرف الأول (الجامعة) تؤكد تنفيذه جميع التزاماته الواردة في هذا العقد دون الإخلال بأي بند من بنوده.</li><li>تكون طريقة الدفع عبر حوالة بنكية إلى حساب الطرف الثاني الموضح أدناه:</li></ol>`)}
    <table class="data">
      <tr><th>بنك المستفيد</th><th>رقم الحساب الدولي (IBAN)</th></tr>
      <tr>
        <td>${escapeHtml(interpreter.bankName || '................')}</td>
        <td>${escapeHtml(interpreter.iban || '................')}</td>
      </tr>
    </table>

    <div class="article-title">المادة السادسة: التزامات الطرف الأول</div>
    ${editable('art6', s.art6, `<ol><li>دفع قيمة هذا العقد المستحقة للطرف الثاني وفقا للدفعات المشار إليها في ("المادة الخامسة") من هذا العقد.</li><li>تقوم الجامعة باتخاذ الإجراءات اللازمة لحصول الطرف الثاني على تأشيرة سفر للطرف الثاني لدولة مقر تنفيذ الدورة التدريبية، وتعود مسألة إصدار التأشيرة لسلطات الدولة المعنية ولا تضمن الجامعة صدور التأشيرة للطرف الثاني.</li><li>توفير تذاكر طيران للطرف الثاني داخلية وخارجية من وإلى مدينة الإقامة على (درجة الضيافة).</li><li>توفير إقامة للطرف الثاني طوال فترة الدورة التدريبية مع يومين قبل بدايتها ويومين بعدها، في فندق من صنف 4 نجوم، شاملة لوجبة الإفطار.</li><li>تأمين المواصلات للطرف الثاني (من وإلى المطار، ومن وإلى مقر التدريب - في حال لم يكن مقر الإقامة هو نفس مقر إقامة الدورة التدريبية).</li><li>توفير تأمين طبي على السفر للطرف الثاني خلال فترة السفر وتنفيذ الدورة، متى كان ذلك شرطا نظاميا مطلوبا لحصول الطرف الثاني على التأشيرة، ويكون التأمين الطبي وفق ما يقرره الطرف الأول.</li><li>توفير بطاقة تتيح الدخول إلى مقر انعقاد الدورة التدريبية وفقا للمواعيد المقررة لها.</li></ol>`)}

    <div class="article-title">المادة السابعة: التزامات الطرف الثاني</div>
    ${editable('art7', s.art7, `يوافق الطرف الثاني على:
<ol><li>تقديم خدمات الترجمة الفورية الدقيقة والمهنية بين اللغتين الإنجليزية والعربية أثناء الدورات التدريبية وفقا لما يطلبه الطرف الأول.</li><li>التعاون الوثيق مع الطرف الأول والمدرب للتحضير والتعرف على مصطلحات ومحتوى الدورة لتقديم الترجمة بدون تحيز أو نقص.</li><li>تسهيل التفاعل السلس بين المدرب والمتدربين لتجاوز أي حواجز في التواصل.</li><li>الحفاظ على المهنية والسرية والحيادية في جميع الأوقات.</li><li>يلتزم الطرف الثاني بتقديم المستندات الضريبية اللازمة متى كان خاضعا لأحكام ضريبة القيمة المضافة، ويُعد المقابل المالي المتفق عليه في هذا العقد شاملا للضريبة متى كانت مستحقة نظاما، دون أن يترتب على الجامعة أي زيادة في إجمالي قيمة العقد، علما وأن الجامعة ضمن قائمة الأشخاص المؤهلين للاسترداد الضريبي، بموجب شهادة التسجيل رقم (${escapeHtml(UNIVERSITY.taxCertificate)}) وتاريخ ${escapeHtml(UNIVERSITY.taxCertificateHijri)}، الموافق ${escapeHtml(UNIVERSITY.taxCertificateGregorian)}.</li><li>الالتزام بجميع التعليمات الإدارية والأمنية والسلامة التي يقدمها الطرف الأول خلال الدورة.</li><li>إبلاغ الطرف الأول بأي مشاكل أو تحديات قد تؤثر على عملية الترجمة.</li><li>الوصول إلى مكان التدريب قبل 30 دقيقة على الأقل من الوقت المحدد للبدء للاستعداد لمهام الترجمة.</li><li>أداء مهام الترجمة تحت إشراف وتوجيهات الطرف الأول لضمان الالتزام بأنظمة وقواعد الجامعة.</li><li>قبول ملاحظات الطرف الأول والعمل على تنفيذها مع المشاركة في أي عمليات تقييم لتحسين جودة الخدمة.</li><li>إعادة أي معدات أو مواد ترجمة مقدمة من الطرف الاول أو مقدم الدورة وتسليمها للطرف الاول عند انتهاء العقد.</li></ol>`)}

    <div class="article-title">المادة الثامنة: انقضاء العقد</div>
    ${editable('art8', s.art8, `يتم إنهاء العقد في الحالات التالية:
<ol><li>إذا اتفق الطرفان على ذلك كتابيا.</li><li>عدم التزام الطرف الثاني بالقيام بالأعمال محل هذا العقد خلال المدة المذكورة في (البند الرابع) من هذا العقد.</li><li>إذا تأخر الطرف الثاني عن البدء في تنفيذ أعماله، أو أظهر تقصيرا في أدائها.</li><li>إذا خالف الطرف الثاني الأنظمة المعمول بها في دولة المقر (${escapeHtml(UNIVERSITY.country)}) أو لأنظمة ولوائح وتعليمات الجامعة.</li><li>إذا أخل الطرف الثاني بأي شرط من شروط هذا العقد، أو امتنع عن تنفيذ أي من التزاماته التعاقدية مع احتفاظ الطرف الأول بحقه في التعويض.</li><li>إذا تبين أن الطرف الثاني قد شرع بنفسه أو بوساطة غيره بطريق مباشر أو غير مباشر في رشوة أحد موظفي الجامعة أو حصل على العقد عن طريق الرشوة، أو الغش، أو التحايل، أو التزوير، أو التلاعب، أو مارس أيًّا من ذلك أثناء تنفيذ العقد.</li><li>إذا تنازل الطرف الثاني عن العقد أو تعاقد لتنفيذه من الباطن دون موافقة الجامعة.</li><li>إذا انسحب الطرف الثاني من الاتفاق موضوع العقد، أو تخلى عن التزاماته أو ترك كل أو جزء من أعماله المناطة به دون موافقة الطرف الأول.</li><li>إذا أصبح تنفيذ الأعمال مستحيلا بسبب القوة القاهرة.</li><li>صدور أحكام قضائية في دولة المقر (${escapeHtml(UNIVERSITY.country)}) تقضي بذلك.</li></ol>`)}

    <div class="article-title">المادة التاسعة: الالتزام بالسرية</div>
    ${editable('art9', s.art9, `تعتبر كافة المعلومات التي يفصح عنها أحد الطرفين إلى الطرف الآخر، أو التي يطلع عليها أحدهما خلال تنفيذه أعماله بموجب العقد سرية، ويحظر على الطرفين استخدام أو الإفصاح عن تلك المعلومات والبيانات لأي طرف آخر، وكقاعدة عامة، يلتزم الطرفان بالحفاظ على سرية تلك المعلومات كما يلتزم الطرفان وكل من له علاقة مباشرة أو غير مباشرة بهما بما يلي:
<ol><li>المحافظة على سرية ما ورد بهذا العقد، وعدم الكشف عن أي معلومات تم الاطلاع عليها بحكم موقعه أو وظيفته بموجب هذا العقد وبعد انتهاء العمل به إلا بموجب موافقة خطية مسبقة من الطرف صاحب المصلحة.</li><li>عدم السماح للغير بالاطلاع عليها أو باستخدامها في أية أعمال أخرى بأي صورة كانت سواء بمقابل أو بدون مقابل وسواء كان لجهة عامة أو خاصة لغير تنفيذ هذا العقد.</li><li>في حال انقضاء هذا العقد لأي من الحالات المشار إليها في (المادة الثامنة)، يلتزم الطرف الثاني بتسليم كافة المستندات والأوراق التي تم الحصول عليها من الطرف الأول لغرض تنفيذ هذا العقد. وحذف محتواها إذا كانت أرسلت عبر وسيلة إلكترونية وعدم الاحتفاظ بأي منها أو نسخها، أو تصويرها، أو نشرها، أو تسجيلها بأية وسيلة كانت.</li></ol>`)}

    <div class="article-title">المادة العاشرة: تسوية النزاعات والنظام واجب التطبيق</div>
    ${editable('art10', s.art10, `يخضع هذا العقد لأحكام أنظمة ولوائح الجامعة، وفي حال نشوء أي نزاع حول تفسيره أو تطبيق بنوده يعمل الطرفان على حل النزاع وديا عبر ممثلين لكل طرف، وفي حال تعذر حل النزاع وديا خلال (60) ستين يوما من تاريخ نشوئه، يُحال النزاع إلى الجهة القضائية المختصة في ${escapeHtml(UNIVERSITY.country)}.`)}

    <div class="article-title">المادة الحادية عشرة: المراسلات والإشعارات</div>
    ${editable('art11', s.art11, `تعد المراسلات أو الإشعارات الخطية الموجهة من أحد الطرفين إلى الآخر على عنوانه المبين سابقا في متن هذا العقد صحيحة ومنتجة لكافة آثارها إذا تم إرسالها بالبريد المسجل، أو بواسطة الفاكس، أو عبر البريد الإلكتروني المبين في صدر هذا العقد، أو سُلمت عن طريق اليد شخصيا، مقابل إشعار خطي بالاستلام، وفي حال تغيير أي من الطرفين لعنوانه المبين بهذا العقد فعليه إخطار الطرف الآخر.`)}

    <div class="article-title">المادة الثانية عشرة: نسخ العقد</div>
    ${editable('art12', s.art12, `حرر هذا العقد من نسختين أصليتين تسلم لكل طرف نسخة للعمل بموجبها بعد توقيعها وتعتبر كل نسخة موقعة من الطرفين نسخة أصلية، ويقر الطرفان بقراءتهما لكافة بنود هذا العقد وفهمهما فهما نافيا للجهالة وبموافقتهما الصريحة على كل ما ورد فيه وهما بكامل الأهلية المعتبرة شرعا ونظاما،`)}

    <p style="text-align:center; font-weight:700; margin-top:18px;">وعليــه جـرى التوقيــع</p>

    <div class="signatures">
      <div class="signature">
        <div class="role">الطرف الأول: ${escapeHtml(UNIVERSITY.name)}</div>
        <div class="who">${escapeHtml(f.cfg.repTitle)}<br />${escapeHtml(f.cfg.rep)}</div>
        <div class="line">التوقيع</div>
      </div>
      <div class="signature">
        <div class="role">الطرف الثاني</div>
        <div class="who">${escapeHtml(interpreter.fullName || '')}</div>
        <div class="line">التوقيع</div>
      </div>
    </div>`;

  return renderPage({
    title: DOC_TITLES.contract,
    subtitle: UNIVERSITY.agency,
    refLine: `(${inlineEdit('contractNo', s.contractNo, f.contractNo)})`,
    body,
    trackingId: options.trackingId,
    canEdit: options.canEdit !== false,
  });
}

// ======================================================================
// (٢) نموذج استحقاق مالي (TF05)
// ======================================================================

const ACTIVITY_TYPES = ['دورة تدريبية', 'برنامج تدريبي', 'دبلوم', 'خاصة', 'برنامج عمل', 'فصل مفتوح'];
const BENEFICIARY_ROLES = [
  'محاضر', 'مدرب تطبيقات عملية', 'اعداد ورقة علمية',
  'مشرف علمي', 'مشرف إداري', 'ترجمة فورية',
];

function renderChoices(items, checked) {
  return `<div class="choices">${items.map((item) => `
    <span class="choice"><span class="box">${item === checked ? '✓' : ''}</span>${escapeHtml(item)}</span>
  `).join('')}</div>`;
}

function renderIbanBoxes(iban) {
  const chars = String(iban || '').replace(/\s+/g, '').toUpperCase().split('');
  const cells = [];
  for (let i = 0; i < 24; i += 1) {
    cells.push(`<span>${escapeHtml(chars[i] || '')}</span>`);
  }
  return `<div class="iban-boxes">${cells.join('')}</div>`;
}

function renderInterpreterEntitlement({ course, interpreter, sections = {} }, options = {}) {
  const s = sections || {};
  const amount = interpreter.amount === null || interpreter.amount === undefined
    ? null
    : Number(interpreter.amount);

  const body = `
    <table class="data">
      <tr><td class="label">اسم الإدارة</td><td class="rtl">${escapeHtml(UNIVERSITY.trainingAgency)}</td></tr>
      <tr><td class="label">عنوان النشاط</td><td class="rtl">${escapeHtml(course.name || '')}</td></tr>
      <tr><td class="label">مكان الانعقاد</td><td class="rtl">${escapeHtml(course.city || '')}</td></tr>
      <tr><td class="label">التاريخ</td><td class="rtl">${escapeHtml(gregorian(course.startDate))} — ${escapeHtml(gregorian(course.endDate))}</td></tr>
    </table>

    <div class="article-title">نوع النشاط</div>
    ${renderChoices(ACTIVITY_TYPES, 'دورة تدريبية')}

    <div class="article-title">دور صاحب الاستحقاق فيه</div>
    ${renderChoices(BENEFICIARY_ROLES, 'ترجمة فورية')}
    <p>عدد الساعات: ${inlineEdit('hours', s.hours, '')}</p>

    <table class="data">
      <tr><td class="label">اسم صاحب الاستحقاق</td><td class="rtl" colspan="3">${escapeHtml(interpreter.fullName || '')}</td></tr>
      <tr>
        <td class="label">مقدار المبلغ المستحق</td>
        <td class="label" style="width:12%;">رقماً</td>
        <td>${amount !== null ? escapeHtml(formatAmount(amount)) : ''}</td>
        <td class="rtl">كتابة: ${amount !== null ? escapeHtml(amountInWords(amount)) : ''}</td>
      </tr>
    </table>

    <div class="article-title">بيانات الحساب</div>
    <table class="data">
      <tr>
        <td class="label">البنك</td><td class="rtl">${escapeHtml(interpreter.bankName || '')}</td>
        <td class="label">الفرع</td><td class="rtl">${escapeHtml(interpreter.bankBranch || '')}</td>
        <td class="label">الدولة</td><td class="rtl">${escapeHtml(interpreter.bankCountry || '')}</td>
      </tr>
    </table>
    <p class="note">رقم الايبان</p>
    ${renderIbanBoxes(interpreter.iban)}

    ${editable('closing', s.closing, `مع التحية لمدير الإدارة المالية
نأمل تحويل المستحقات المالية لصاحبها وفق البيانات المدونة أعلاه.`)}

    <div class="signatures">
      <div class="signature">
        <div class="role">وكيل الجامعة للتدريب</div>
        <div class="who">&nbsp;</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
    </div>`;

  return renderPage({
    title: `${DOC_TITLES.entitlement} (TF05)`,
    subtitle: UNIVERSITY.trainingAgency,
    refLine: '',
    body,
    trackingId: options.trackingId,
    canEdit: options.canEdit !== false,
  });
}

// ======================================================================
// (٣) شهادة إنجاز الترجمة
// ======================================================================

function renderInterpreterCertificate({ course, interpreter, sections = {} }, options = {}) {
  const s = sections || {};
  const period = `${toArabicDigits(gregorian(course.startDate))} – ${toArabicDigits(gregorian(course.endDate))}`;

  const body = `
    <p style="margin-top:14mm;">السادة الكرام</p>
    <p>السلام عليكم ورحمة الله وبركاته</p>
    <p>تشهد ${escapeHtml(UNIVERSITY.trainingAgency)} بجامعة نايف العربية للعلوم الأمنية</p>

    <table class="data">
      <tr><th style="width:8%;">م</th><th>الدورة</th><th>المترجم</th><th>التاريخ</th></tr>
      <tr>
        <td>١</td>
        <td class="rtl">${escapeHtml(course.name || '')}</td>
        <td class="rtl">${escapeHtml(interpreter.fullName || '')}</td>
        <td>${escapeHtml(period)}</td>
      </tr>
    </table>

    ${editable('statement', s.statement, `قد انجز جميع أعمال الترجمة الموكلة إليه ضمن الدورة التدريبية`)}

    <p style="margin-top:10mm;">تقبلوا وافر التحايا</p>

    <div class="signatures" style="margin-top:16mm;">
      <div class="signature">
        <div class="role">المشرف العام على الدورة</div>
        <div class="who">${inlineEdit('supervisor', s.supervisor, '')}</div>
        <div class="line">الاسم والتوقيع</div>
      </div>
    </div>`;

  return renderPage({
    title: DOC_TITLES.certificate,
    subtitle: UNIVERSITY.trainingAgency,
    refLine: '',
    body,
    trackingId: options.trackingId,
    canEdit: options.canEdit !== false,
    letterheadOption: true,
  });
}

// ======================================================================
// (٤) طلب صرف مستحقات المترجم — مترجم بتحويل
// ======================================================================

function renderInterpreterTransferEmail({ course, interpreter }) {
  const amount = interpreter.amount === null || interpreter.amount === undefined
    ? null
    : Number(interpreter.amount);

  const coordinator = `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim();

  const row = (label, value) => (value
    ? `<tr><td style="border:1px solid #d6e0df; background:#f0f6f5; padding:8px 10px; font-weight:700; width:34%;">${escapeHtml(label)}</td><td style="border:1px solid #d6e0df; padding:8px 10px;">${escapeHtml(value)}</td></tr>`
    : '');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /></head>
<body style="margin:0; padding:18px; background:#ffffff; font-family:'Cairo',Tahoma,Arial,sans-serif; color:#11202b; line-height:1.9; font-size:14px;">
  <p style="margin:0 0 14px;">سعادة مدير الإدارة المالية</p>
  <p style="margin:0 0 14px;">السلام عليكم ورحمة الله وبركاته، وبعد:</p>

  <p style="margin:0 0 14px;">
    نفيدكم بأن المترجم <strong>${escapeHtml(interpreter.fullName || '')}</strong>
    قد أنجز جميع أعمال الترجمة الموكلة إليه ضمن الدورة التدريبية
    <strong>«${escapeHtml(course.name || '')}»</strong>${course.code ? ` (${escapeHtml(course.code)})` : ''}،
    المنفَّذة في ${escapeHtml(course.city || '')}
    خلال الفترة من ${escapeHtml(gregorian(course.startDate))}
    إلى ${escapeHtml(gregorian(course.endDate))}، على الوجه المطلوب.
  </p>

  <p style="margin:0 0 14px;">
    عليه، نأمل التكرّم بالتوجيه بتحويل مستحقاته المالية عن أعمال الترجمة
    ${amount !== null ? `بمبلغ <strong>${escapeHtml(formatAmount(amount))} ريال</strong> (${escapeHtml(amountInWords(amount))}) ` : ''}
    وفق البيانات المدونة أدناه.
  </p>

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; margin:0 0 16px;">
    ${row('الاسم', interpreter.fullName)}
    ${row('رقم الهوية الوطنية', interpreter.nationalId)}
    ${row('البريد الإلكتروني', interpreter.email)}
    ${row('رقم الجوال', interpreter.mobile)}
    ${row('العنوان', interpreter.address)}
    ${row('البنك', interpreter.bankName)}
    ${row('الفرع', interpreter.bankBranch)}
    ${row('الدولة', interpreter.bankCountry)}
    ${row('رقم الحساب الدولي (IBAN)', interpreter.iban)}
    ${row('ملاحظات', interpreter.notes)}
  </table>

  <p style="margin:0 0 6px;">وتقبلوا تحياتي،</p>
  <p style="margin:0; font-weight:700;">${escapeHtml(coordinator || 'منسق البرنامج')}</p>
  <p style="margin:2px 0 0; color:#6b7280; font-size:12px;">${escapeHtml(UNIVERSITY.agency)}</p>
</body>
</html>`;
}

module.exports = {
  UNIVERSITY,
  CONTRACT_DEFAULTS,
  DOC_TITLES,
  ACTIVITY_TYPES,
  BENEFICIARY_ROLES,
  fontFaceCss,
  hijri,
  gregorian,
  inclusiveDays,
  contractFacts,
  renderInterpreterContract,
  renderInterpreterEntitlement,
  renderInterpreterCertificate,
  renderInterpreterTransferEmail,
};
