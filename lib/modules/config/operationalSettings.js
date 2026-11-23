// =============================================================
// إعدادات التشغيل التي يديرها المدير بنفسه
// -------------------------------------------------------------
// الإعدادات التي تتغيّر بتغيّر الإجراء لا بتغيّر الكود. تعريفها هنا
// (لا في الشاشة) حتى تُختبر قواعد التحقق منها: فقيمة خاطئة هنا
// تُعطّل القائمة الأسبوعية أو تُخرج عقداً ببيانات ناقصة.
// =============================================================

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SETTING_GROUPS = [
  {
    key: 'evaluation',
    title: 'معادلة التقييم السنوي',
    note: 'تقييم المنسق = التنفيذ + تسجيل الدورات المسندة + التميّز + تقديرك، بأوزانها (تُنسب إلى مجموعها، فلا يلزم أن تساوي ١٠٠). والمشرف يُضاف إليه جزء من مؤشر إشرافه بسقف ١٠٠. اترك الخانة فارغة لاعتماد الافتراضي.',
    fields: [
      { key: 'evaluation.weight.execution', label: 'وزن الأداء في التنفيذ', type: 'number', hint: 'الافتراضي ٤٥ — توقيت العناصر وجودتها وإقفال الدورات منسوبةً إلى أقصى الممكن.', category: 'evaluation', settingLabel: 'وزن الأداء في التنفيذ (التقييم السنوي)', optional: true },
      { key: 'evaluation.weight.registration', label: 'وزن تسجيل الدورات المسندة', type: 'number', hint: 'الافتراضي ٨ — ما سجّله المنسق مما أُسند إليه.', category: 'evaluation', settingLabel: 'وزن تسجيل الدورات المسندة (التقييم السنوي)', optional: true },
      { key: 'evaluation.weight.excellence', label: 'وزن التميّز والتعاون', type: 'number', hint: 'الافتراضي ٧ — التوثيق والتعاون والمبادرات وتحدي الشهر.', category: 'evaluation', settingLabel: 'وزن التميّز والتعاون (التقييم السنوي)', optional: true },
      { key: 'evaluation.weight.manager', label: 'وزن تقدير المدير', type: 'number', hint: 'الافتراضي ٤٠ — خانة واحدة تُدخلها في صفحة التقييم السنوي.', category: 'evaluation', settingLabel: 'وزن تقدير المدير (التقييم السنوي)', optional: true },
      { key: 'evaluation.supervisorShare', label: 'حصة مؤشر الإشراف المضافة للمشرف (٪)', type: 'number', hint: 'الافتراضي ٢٥ — تقييم المشرف = تقييمه منسقاً + ربع مؤشر إشرافه، بسقف ١٠٠.', category: 'evaluation', settingLabel: 'حصة مؤشر الإشراف المضافة لتقييم المشرف', optional: true },
      { key: 'evaluation.excellenceFull', label: 'درجات التميّز التي تبلغ بها ١٠٠ في السنة', type: 'number', hint: 'الافتراضي ١٠٠ درجة (مثل: توثيقان بنجمتين، أو مراجعات ومبادرات تبلغها).', category: 'evaluation', settingLabel: 'درجات التميّز الكاملة في السنة', optional: true },
    ],
  },
  {
    key: 'supervision',
    title: 'مؤشر أداء المشرفين',
    note: 'مؤشر الإشراف من ١٠٠ يُبنى من ثلاثة مكوّنات بأوزانها (تُنسب إلى مجموعها). والمشرف المتفرّغ للإشراف يُقاس به وحده، ويُضاف إليه تقديرك بوزن «تقدير المدير» أعلاه. أما المشرف الذي يتولى دورات بنفسه فيُقيَّم منسقاً ويُضاف إليه جزء من هذا المؤشر بالحصة المحددة أعلاه. اترك الخانة فارغة لاعتماد الافتراضي.',
    fields: [
      { key: 'supervision.weight.speed', label: 'وزن سرعة البتّ في العناصر', type: 'number', hint: 'الافتراضي ٥٠ — البتّ خلال يوم = ١٠٠، وخلال يومين = ٧٥، ثم ينقص ١٥ عن كل يوم.', category: 'evaluation', settingLabel: 'وزن سرعة البتّ (مؤشر المشرفين)', optional: true },
      { key: 'supervision.weight.closure', label: 'وزن إقفال دورات الفريق في موعدها', type: 'number', hint: 'الافتراضي ٢٥ — نسبة دورات فريقه التي أُقفلت في موعدها.', category: 'evaluation', settingLabel: 'وزن إقفال دورات الفريق (مؤشر المشرفين)', optional: true },
      { key: 'supervision.weight.team', label: 'وزن أداء منسقي الفريق', type: 'number', hint: 'الافتراضي ٢٥ — متوسط أداء منسقيه في التنفيذ.', category: 'evaluation', settingLabel: 'وزن أداء الفريق (مؤشر المشرفين)', optional: true },
    ],
  },
  {
    key: 'blockers',
    title: 'بلاغات العوائق',
    note: 'البلاغ يوقف ساعة العنصر حين يكون التأخير خارج يد المنسق. والرصيد يحدّ من الإفراط فيه.',
    fields: [
      {
        key: 'blockers.quarterQuota',
        label: 'رصيد المنسق من البلاغات في الفصل',
        type: 'number',
        hint: 'ما زاد على الرصيد يُحوَّل إلى المدير للبتّ فيه، ولا يُحتسب تلقائياً.',
        category: 'blockers',
        settingLabel: 'رصيد المنسق من بلاغات العوائق في الفصل',
      },
      {
        key: 'blockers.partyDirectory',
        label: 'عناوين الجهات المنتظَرة',
        type: 'lines',
        hint: 'سطر لكل جهة بالصيغة: الاسم = البريد. وهذه الجهات تصلها القائمة الأسبوعية.',
        placeholder: 'تطوير الأعمال = bd@nauss.edu.sa\nالمدربون = trainers@nauss.edu.sa',
        category: 'blockers',
        settingLabel: 'عناوين الجهات المنتظَرة (سطر لكل جهة: الاسم = البريد)',
        optional: true,
      },
    ],
  },
  {
    key: 'courses',
    title: 'إدخال الدورة',
    note: 'الدورة التي تُدخَل بعد هذه المهلة تُعدّ متأخرة، ويُطلب من المنسق مبرر.',
    fields: [
      {
        key: 'course.entryLeadHours',
        label: 'المهلة المطلوبة لإدخال الدورة قبل بدايتها (ساعة)',
        type: 'number',
        hint: 'الافتراضي ٧٢ ساعة — وهي مهلة أول عنصر مطلوب (تسجيل المتدربين).',
        category: 'courses',
        settingLabel: 'المهلة المطلوبة لإدخال الدورة قبل بدايتها (ساعة)',
      },
    ],
  },
  {
    key: 'interpreter',
    title: 'مترجم الدورة',
    note: 'تظهر هذه البيانات في عقد الترجمة وفي طلب صرف المستحقات — فتغييرها هنا يسري على كل مستند جديد.',
    fields: [
      {
        key: 'interpreter.transfer.email.to',
        label: 'مستلم طلب صرف مستحقات المترجم (تحويل)',
        type: 'email',
        category: 'email',
        settingLabel: 'مستلم طلب صرف مستحقات المترجم (تحويل)',
      },
      {
        key: 'interpreter.legal.email.to',
        label: 'الإدارة القانونية — المستلم',
        type: 'email',
        hint: 'تصله رسالة مراجعة عقد المترجم واعتماده.',
        category: 'email',
        settingLabel: 'مستلم رسالة مراجعة عقد المترجم (الإدارة القانونية)',
      },
      {
        key: 'interpreter.legal.email.cc',
        label: 'الإدارة القانونية — نسخة إلى',
        type: 'emails',
        hint: 'عنوان أو أكثر، بينها فاصلة.',
        category: 'email',
        settingLabel: 'نسخة رسالة الإدارة القانونية',
        optional: true,
      },
      {
        key: 'interpreter.finance.email.to',
        label: 'الإدارة المالية — المستلم',
        type: 'email',
        hint: 'تصله طلبات صرف مستحقات المترجم.',
        category: 'email',
        settingLabel: 'مستلم طلبات صرف مستحقات المترجم (الإدارة المالية)',
      },
      {
        key: 'interpreter.finance.email.cc',
        label: 'الإدارة المالية — نسخة إلى',
        type: 'emails',
        hint: 'عنوان أو أكثر، بينها فاصلة.',
        category: 'email',
        settingLabel: 'نسخة طلبات صرف مستحقات المترجم',
        optional: true,
      },
      {
        key: 'interpreter.contract.rep',
        label: 'ممثل الجامعة في العقد',
        type: 'text',
        category: 'interpreter',
        settingLabel: 'ممثل الجامعة في عقد الترجمة',
      },
      {
        key: 'interpreter.contract.repTitle',
        label: 'صفته',
        type: 'text',
        category: 'interpreter',
        settingLabel: 'صفة ممثل الجامعة في عقد الترجمة',
      },
      {
        key: 'interpreter.contract.email',
        label: 'البريد الإلكتروني في صدر العقد',
        type: 'email',
        category: 'interpreter',
        settingLabel: 'البريد الإلكتروني في صدر عقد الترجمة',
      },
      {
        key: 'interpreter.contract.bufferDays',
        label: 'أيام ما قبل الدورة وما بعدها في مدة العقد',
        type: 'number',
        hint: 'مدة العقد تمتد هذا العدد قبل بداية الدورة ومثله بعد نهايتها.',
        category: 'interpreter',
        settingLabel: 'أيام ما قبل الدورة وما بعدها في مدة عقد الترجمة',
      },
    ],
  },
  {
    key: 'externalTrainer',
    title: 'المدرب الخارجي',
    note: 'عناوين رسائل التذاكر والاستقبال والإسكان التي تُخرجها المنصة من عنصر «مدرب خارجي».',
    fields: [
      {
        key: 'trainer.hr.email.to',
        label: 'الموارد البشرية (التذاكر) — المستلم',
        type: 'email',
        category: 'email',
        settingLabel: 'المدرب الخارجي: الموارد البشرية (التذاكر) — المستلم',
      },
      {
        key: 'trainer.hr.email.cc',
        label: 'الموارد البشرية (التذاكر) — نسخة إلى',
        type: 'emails',
        hint: 'عنوان أو أكثر، بينها فاصلة.',
        category: 'email',
        settingLabel: 'المدرب الخارجي: الموارد البشرية (التذاكر) — نسخة إلى',
      },
      {
        key: 'trainer.protocol.email.to',
        label: 'المراسم (الاستقبال والتوديع) — المستلم',
        type: 'email',
        category: 'email',
        settingLabel: 'المدرب الخارجي: المراسم (الاستقبال والتوديع) — المستلم',
      },
      {
        key: 'trainer.protocol.email.cc',
        label: 'المراسم (الاستقبال والتوديع) — نسخة إلى',
        type: 'emails',
        hint: 'عنوان أو أكثر، بينها فاصلة.',
        category: 'email',
        settingLabel: 'المدرب الخارجي: المراسم (الاستقبال والتوديع) — نسخة إلى',
      },
      {
        key: 'trainer.hospitality.email.to',
        label: 'الضيافة والإسكان — المستلم',
        type: 'email',
        category: 'email',
        settingLabel: 'المدرب الخارجي: الضيافة والإسكان — المستلم',
      },
      {
        key: 'trainer.hospitality.email.cc',
        label: 'الضيافة والإسكان — نسخة إلى',
        type: 'emails',
        hint: 'عنوان أو أكثر، بينها فاصلة.',
        category: 'email',
        settingLabel: 'المدرب الخارجي: الضيافة والإسكان — نسخة إلى',
      },
    ],
  },
  {
    key: 'travelGuide',
    title: 'دليل السفر التعريفي',
    note: 'وجهة طلب تصميم دليل جديد حين لا يوجد دليل لمدينة التنفيذ.',
    fields: [
      {
        key: 'travelGuide.request.email.to',
        label: 'طلب تصميم دليل — المستلم (مدير الإدارة)',
        type: 'email',
        category: 'email',
        settingLabel: 'دليل السفر: مستلم طلب تصميم دليل جديد',
      },
      {
        key: 'travelGuide.request.email.cc',
        label: 'طلب تصميم دليل — نسخة إلى',
        type: 'emails',
        hint: 'عنوان أو أكثر، بينها فاصلة.',
        category: 'email',
        settingLabel: 'دليل السفر: نسخة طلب تصميم دليل جديد',
      },
    ],
  },
  {
    key: 'email',
    title: 'بريد التقارير',
    note: 'وجهة تقارير الافتتاح والاختتام والقائمة الأسبوعية.',
    fields: [
      {
        key: 'report.email.to',
        label: 'المستلم (إلى)',
        type: 'email',
        category: 'email',
        settingLabel: 'مستلم تقارير الإقفال (إلى)',
      },
      {
        key: 'report.email.cc',
        label: 'نسخة إلى (CC)',
        type: 'email',
        category: 'email',
        settingLabel: 'نسخة إلى (CC)',
      },
    ],
  },
];

const ALL_SETTING_FIELDS = SETTING_GROUPS.flatMap((group) => group.fields);

/** حقل واحد: رسالة الخطأ، أو فارغ إن كان سليماً */
function validateSettingField(field, raw) {
  const value = String(raw ?? '').trim();

  if (value === '' && field.optional) return '';

  if (field.type === 'number') {
    if (value === '') return 'القيمة مطلوبة';
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return 'أدخل رقماً صحيحاً موجباً';
    return '';
  }

  if (field.type === 'email') {
    if (value === '') return 'البريد مطلوب';
    if (!EMAIL_RE.test(value)) return 'البريد الإلكتروني غير صحيح';
    return '';
  }

  // قائمة عناوين تفصلها الفواصل — عنوان واحد مكسور يُسقط النسخة كلها
  if (field.type === 'emails') {
    if (value === '') return 'البريد مطلوب';
    const bad = value.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
      .find((one) => !EMAIL_RE.test(one));
    if (bad) return `عنوان غير صحيح: ${bad}`;
    return '';
  }

  if (field.type === 'lines') {
    // كل سطر: "الاسم = البريد". وسطر مكسور يعني جهة لا يصلها بريد.
    const bad = value.split('\n').map((l) => l.trim()).filter(Boolean).find((line) => {
      const parts = line.split('=');
      if (parts.length !== 2) return true;
      return !parts[0].trim() || !EMAIL_RE.test(parts[1].trim());
    });
    return bad ? `سطر غير صحيح: ${bad}` : '';
  }

  if (value === '') return 'القيمة مطلوبة';
  return '';
}

/** كل الحقول دفعة واحدة — خريطة المفتاح إلى رسالة الخطأ */
function validateAllSettings(values = {}) {
  const errors = {};
  for (const field of ALL_SETTING_FIELDS) {
    const message = validateSettingField(field, values[field.key]);
    if (message) errors[field.key] = message;
  }
  return errors;
}

/** الحمولة التي تُرسل إلى /api/settings */
function buildSettingsPayload(values = {}) {
  return ALL_SETTING_FIELDS.map((field) => ({
    key: field.key,
    value: String(values[field.key] ?? '').trim(),
    category: field.category,
    label: field.settingLabel,
  }));
}

module.exports = {
  EMAIL_RE,
  SETTING_GROUPS,
  ALL_SETTING_FIELDS,
  validateSettingField,
  validateAllSettings,
  buildSettingsPayload,
};
