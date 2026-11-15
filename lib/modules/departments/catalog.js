// ======================================================================
// الإدارات التي يعتمد عليها المنسق في إقفال الدورة، وأنواع الصعوبات المعتادة
// ----------------------------------------------------------------------
// قائمة واحدة يقرأ منها تقييم المنسق بعد الإقفال ولوحة «أداء الإدارات».
// تُضاف إدارة أو صعوبة هنا فتظهر في الموضعين معاً.
// ======================================================================

const DEPARTMENTS = [
  {
    key: 'business_dev', name: 'إدارة تطوير الأعمال', short: 'تطوير الأعمال',
    issues: [
      { key: 'names_late', label: 'تأخر تسليم أسماء المتدربين' },
      { key: 'names_incomplete', label: 'أسماء ناقصة أو غير دقيقة' },
      { key: 'names_changed', label: 'تغيير الأسماء بعد اعتمادها' },
      { key: 'nomination_late', label: 'تأخر الترشيح أو تأكيد الجهة' },
    ],
  },
  {
    key: 'trainers_affairs', name: 'إدارة شؤون المدربين', short: 'شؤون المدربين',
    issues: [
      { key: 'trainer_info_late', label: 'تأخر استلام معلومات المدربين' },
      { key: 'trainer_changed', label: 'تغيير المدرب قبل الدورة' },
      { key: 'grades_late', label: 'تأخر درجات المتدربين أو تقييمهم' },
      { key: 'materials_late', label: 'تأخر المادة التدريبية' },
    ],
  },
  {
    key: 'finance', name: 'الإدارة المالية', short: 'المالية',
    issues: [
      { key: 'advance_late', label: 'تأخر صرف السلفة' },
      { key: 'settlement_late', label: 'تأخر اعتماد التسوية' },
      { key: 'payment_late', label: 'تأخر صرف المستحقات' },
    ],
  },
  {
    key: 'hr', name: 'إدارة الموارد البشرية', short: 'الموارد البشرية',
    issues: [
      { key: 'tickets_late', label: 'تأخر إصدار تذاكر السفر' },
      { key: 'insurance_late', label: 'تأخر التأمين الطبي' },
      { key: 'visa_late', label: 'تأخر إجراءات التأشيرة' },
    ],
  },
  {
    key: 'legal', name: 'الإدارة القانونية', short: 'القانونية',
    issues: [
      { key: 'contract_review_late', label: 'تأخر مراجعة العقود واعتمادها' },
    ],
  },
  {
    key: 'protocol', name: 'إدارة المراسم', short: 'المراسم',
    issues: [
      { key: 'reception_issue', label: 'إشكال في الاستقبال أو التوديع' },
    ],
  },
  {
    key: 'hospitality', name: 'إدارة الضيافة والإسكان', short: 'الضيافة والإسكان',
    issues: [
      { key: 'housing_issue', label: 'إشكال في الإسكان' },
      { key: 'catering_issue', label: 'إشكال في الضيافة' },
    ],
  },
  {
    key: 'it', name: 'تقنية المعلومات', short: 'تقنية المعلومات',
    issues: [
      { key: 'lms_issue', label: 'مشكلات منصة التدريب (LMS)' },
      { key: 'equipment_issue', label: 'مشكلات الأجهزة والقاعات' },
    ],
  },
  {
    key: 'beneficiary', name: 'الجهة المستفيدة', short: 'الجهة المستفيدة',
    issues: [
      { key: 'beneficiary_late', label: 'تأخر ردود الجهة المستفيدة' },
      { key: 'attendance_issue', label: 'غياب المتدربين أو تأخرهم' },
    ],
  },
];

const IMPACTS = [
  { key: 'LOW', label: 'بسيط', weight: 0.5 },
  { key: 'MEDIUM', label: 'متوسط', weight: 1 },
  { key: 'HIGH', label: 'كبير', weight: 1.5 },
];

// كل إدارة تقبل «أخرى» نوعاً عاماً
for (const d of DEPARTMENTS) d.issues.push({ key: 'other', label: 'أخرى' });

const byKey = new Map(DEPARTMENTS.map((d) => [d.key, d]));
const department = (key) => byKey.get(key) || null;
const issueLabel = (dep, key) => department(dep)?.issues.find((i) => i.key === key)?.label || key;
const impactOf = (key) => IMPACTS.find((i) => i.key === key) || IMPACTS[1];

// بلاغات العوائق أثناء الإقفال تُنسب لإداراتها أيضاً
const BLOCKER_REASON_DEPARTMENT = {
  TRAINEE_NAMES: 'business_dev',
  TRAINER_GRADES: 'trainers_affairs',
  FINANCE_PENDING: 'finance',
  BENEFICIARY_PENDING: 'beneficiary',
};

module.exports = { DEPARTMENTS, IMPACTS, department, issueLabel, impactOf, BLOCKER_REASON_DEPARTMENT };
