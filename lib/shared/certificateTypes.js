// أنواع شهادة الدورة كما تُعرض في الواجهة (إضافة الدورة وتعديلها وصفحتها)
// والمنطق على الخادم في lib/modules/courses/certificate.js
export const CERTIFICATE_TYPES = [
  { value: 'PASS', label: 'اجتياز', desc: 'يُشترط فيها الاختبار البعدي ودرجات المتدربين.' },
  { value: 'ATTENDANCE', label: 'حضور', desc: 'تُمنح بالحضور، ولا اختبارات فيها.' },
  { value: 'PENDING', label: 'بانتظار التحديد', desc: 'لم تحدده إدارة تصميم البرامج بعد — يُفتح لك عنصر «تأكيد نوع الشهادة»، وتؤكده قبل إطلاق الشهادات.' },
];

export const CERTIFICATE_LABEL = Object.fromEntries(CERTIFICATE_TYPES.map((c) => [c.value, c.label]));
