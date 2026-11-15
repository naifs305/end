// ======================================================================
// أقسام المجلة والتقرير الفني — يُظهرها المنسق أو يخفيها
// ----------------------------------------------------------------------
// يُحفظ المخفيّ وحده ({ gallery: false })، فكل قسم جديد يُضاف لاحقاً يظهر
// تلقائياً في التوثيقات القديمة. والغلاف والغلاف الخلفي ثابتان دائماً.
// ======================================================================

const MAGAZINE_SECTIONS = [
  { key: 'welcome', label: 'كلمة الترحيب', hint: 'تظهر إن كُتبت' },
  { key: 'intro', label: 'عن البرنامج' },
  { key: 'timeline', label: 'برنامج الدورة' },
  { key: 'features', label: 'من قلب الجلسات', hint: 'الجلسات بصورها' },
  { key: 'gallery', label: 'معرض الصور' },
  { key: 'closing', label: 'الختام' },
];

const REPORT_SECTIONS = [
  { key: 'results', label: 'قراءة النتائج' },
  { key: 'program', label: 'سجل الجلسات' },
  { key: 'trainees', label: 'سجل المتدربين' },
  { key: 'stars', label: 'المتميّزون' },
  { key: 'highlights', label: 'مشاهد من التنفيذ' },
  { key: 'recs', label: 'التوصيات' },
];

const KEYS = new Set([...MAGAZINE_SECTIONS, ...REPORT_SECTIONS].map((s) => s.key));

/** يُبقي المفاتيح المعروفة المخفية فقط */
function cleanSections(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (KEYS.has(k) && v === false) out[k] = false;
  return out;
}

const isOn = (sections, key) => !(sections && sections[key] === false);

module.exports = { MAGAZINE_SECTIONS, REPORT_SECTIONS, cleanSections, isOn };
