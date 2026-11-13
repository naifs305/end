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
