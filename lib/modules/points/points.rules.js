// ======================================================================
// قواعد «رصيد الإنجاز» — المرجع الوحيد لكل درجة تُمنح أو تُخصم
// ----------------------------------------------------------------------
// كل درجة تُكتب سطراً في سجل المنسق بسببها وتاريخها، فيرى كيف حُسبت.
// الرصيد سنوي، ويُحفظ رصيد كل سنة عند انقضائها للرجوع إليه.
// ======================================================================

const RULES_VERSION = 1;

// العناصر الحرجة: درجتها ضعف العادية
const CRITICAL_KEYS = new Set([
  'opening_report', 'closing_report',
  'supervisor_compensation', 'settlement',
  'medical_insurance', 'certificates',
]);

const POINTS = {
  // ── تنفيذ العناصر ──
  elementBase: 10,            // عنصر عادي (الحرج ضعفه)
  idealBonusShare: 0.2,       // مكافأة المبادرة: قبل الموعد المثالي +٢٠٪
  latePerDayShare: 0.1,       // بعد الأقصى: تنقص ١٠٪ من درجته عن كل يوم
  lateFloorShare: -0.5,       // ويصل الخصم إلى سالب نصف درجته
  returnShare: -0.2,          // كل إعادة للتصحيح
  rejectShare: -0.5,          // كل رفض

  // ── الدورات ──
  courseExecuted: 15,         // دورة سُجّلت ونُفّذت
  earlyRegistration: 5,       // سُجّلت قبل بدايتها
  lateEntryRejected: -10,     // إدخال متأخر رُفض مبرره
  unregisteredCourse: -20,    // دورة مسندة لم تُسجَّل في المنصة

  // ── الإقفال ──
  closureOnTime: 30,
  closureLatePerDay: -3,
  closureFloor: -30,

  // ── التوثيق ──
  documentation: 20,          // توثيق الدورة (جلسة موصوفة وصور)
  documentationStar: 20,      // نجمة التميّز فوقه

  // ── التعاون ──
  certReview: 15,             // مراجعة شهادات زميل
  closureReview: 5,           // تقييم صعوبات الإقفال
  fieldReport: 10,            // تقرير ميداني
  optionalReport: 10,         // تقرير اختياري

  // ── المبادرات والتقدير ──
  ideaSubmitted: 5,
  ideaApproved: 20,
  ideaImplemented: 30,
  managerRecognition: 15,     // شارة تقدير يمنحها المدير
  challengeAchieved: 20,      // تحقيق تحدي الشهر (لكل من شارك)
  commitmentStreak: 10,       // كل ١٠ عناصر متتالية في موعدها
  streakSize: 10,

  // ── الانضباط ──
  rejectedBlocker: -5,        // بلاغ عائق رُفض لعدم صحته
};

// حدّ أدنى للتوثيق حتى يُحتسب: جلسة موصوفة وثلاث صور
const DOCUMENTATION_MIN = { sessions: 1, photos: 3 };

const CATEGORIES = {
  element: 'تنفيذ العناصر',
  quality: 'جودة التنفيذ',
  course: 'الدورات',
  closure: 'إقفال الدورات',
  documentation: 'التوثيق',
  collaboration: 'التعاون',
  initiative: 'المبادرات والتقدير',
  discipline: 'الانضباط',
};

// مستويات الرصيد السنوي
const LEVELS = [
  { key: 'diamond', name: 'ماسي', min: 2000 },
  { key: 'gold', name: 'ذهبي', min: 1400 },
  { key: 'silver', name: 'فضي', min: 800 },
  { key: 'bronze', name: 'برونزي', min: 400 },
  { key: 'starter', name: 'منطلق', min: -Infinity },
];

function levelOf(total) {
  const l = LEVELS.find((x) => total >= x.min) || LEVELS[LEVELS.length - 1];
  const idx = LEVELS.indexOf(l);
  const next = idx > 0 ? LEVELS[idx - 1] : null;
  return { key: l.key, name: l.name, next: next ? { name: next.name, min: next.min, remaining: Math.max(0, next.min - total) } : null };
}

// جدول القواعد كما يُعرض للمنسق في «كيف تُحسب درجاتي»
function describeRules() {
  const P = POINTS;
  return [
    { category: 'element', items: [
      { label: 'عنصر قُدّم قبل الموعد المثالي', points: `+${P.elementBase * (1 + P.idealBonusShare)} (الحرج +${P.elementBase * 2 * (1 + P.idealBonusShare)})` },
      { label: 'عنصر قُدّم بين المثالي والأقصى', points: `+${P.elementBase} (الحرج +${P.elementBase * 2})` },
      { label: 'بعد الموعد الأقصى', points: `تنقص ${P.elementBase * P.latePerDayShare} عن كل يوم (الحرج ${P.elementBase * 2 * P.latePerDayShare}) حتى ${P.elementBase * P.lateFloorShare} (الحرج ${P.elementBase * 2 * P.lateFloorShare})` },
      { label: 'عنصر فات موعده الأقصى ولم يُقدَّم', points: 'يُخصم بالقاعدة نفسها يوماً بيوم حتى يُقدَّم' },
      { label: 'كل ١٠ عناصر متتالية في موعدها', points: `+${P.commitmentStreak}` },
    ] },
    { category: 'quality', items: [
      { label: 'كل إعادة للتصحيح', points: `${P.elementBase * P.returnShare} (الحرج ${P.elementBase * 2 * P.returnShare})` },
      { label: 'رفض العنصر', points: `${P.elementBase * P.rejectShare} (الحرج ${P.elementBase * 2 * P.rejectShare})` },
    ] },
    { category: 'course', items: [
      { label: 'دورة سُجّلت ونُفّذت', points: `+${P.courseExecuted}` },
      { label: 'سُجّلت قبل بدايتها', points: `+${P.earlyRegistration}` },
      { label: 'دورة مسندة لم تُسجَّل في المنصة', points: `${P.unregisteredCourse}` },
      { label: 'إدخال متأخر رُفض مبرره', points: `${P.lateEntryRejected}` },
    ] },
    { category: 'closure', items: [
      { label: 'دورة أُقفلت في موعدها', points: `+${P.closureOnTime}` },
      { label: 'كل يوم تأخير في الإقفال', points: `${P.closureLatePerDay} حتى ${P.closureFloor}` },
    ] },
    { category: 'documentation', items: [
      { label: 'توثيق الدورة (جلسة موصوفة وثلاث صور على الأقل)', points: `+${P.documentation}` },
      { label: 'نيل نجمة التميّز بنشره مكتملاً', points: `+${P.documentationStar} إضافية` },
    ] },
    { category: 'collaboration', items: [
      { label: 'مراجعة شهادات زميل', points: `+${P.certReview}` },
      { label: 'تقرير ميداني أو اختياري', points: `+${P.fieldReport}` },
      { label: 'تقييم صعوبات الإقفال', points: `+${P.closureReview}` },
    ] },
    { category: 'initiative', items: [
      { label: 'تقديم مبادرة تطوير', points: `+${P.ideaSubmitted}` },
      { label: 'اعتماد المبادرة', points: `+${P.ideaApproved}` },
      { label: 'تنفيذ المبادرة', points: `+${P.ideaImplemented} إضافية` },
      { label: 'شارة تقدير من المدير', points: `+${P.managerRecognition}` },
      { label: 'تحقيق تحدي الشهر (لكل من شارك)', points: `+${P.challengeAchieved}` },
    ] },
    { category: 'discipline', items: [
      { label: 'بلاغ عائق رُفض لعدم صحته', points: `${P.rejectedBlocker}` },
    ] },
  ];
}

module.exports = { RULES_VERSION, CRITICAL_KEYS, POINTS, DOCUMENTATION_MIN, CATEGORIES, LEVELS, levelOf, describeRules };
