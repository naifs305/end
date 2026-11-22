// =============================================================
// مساعدات الاستجابة الموحّدة لطبقة الـ HTTP
// كل المسارات تُرجع: بيانات عند النجاح، أو { code, message } عند الخطأ
// =============================================================
const { ZodError } = require('zod');
const { AppError } = require('../../shared/AppError');

// أسماء الحقول بالعربية — حين تأتي رسالة التحقق الافتراضية بالإنجليزية («Required»)
// تُصاغ بالعربية باسم الحقل، فيعرف المستخدم ما الناقص بالضبط
const FIELD_LABELS = {
  name: 'الاسم', title: 'العنوان', content: 'المحتوى', description: 'الوصف', note: 'الملاحظة', notes: 'الملاحظات',
  reason: 'السبب', details: 'التفصيل', awaitedParty: 'الجهة المنتظَرة', trackingId: 'العنصر', courseId: 'الدورة',
  userId: 'الموظف', email: 'البريد الإلكتروني', password: 'كلمة المرور', firstName: 'الاسم الأول', lastName: 'اسم العائلة',
  roles: 'الأدوار', role: 'الدور', operationalProjectId: 'المشروع', startDate: 'تاريخ البدء', endDate: 'تاريخ الانتهاء',
  status: 'الحالة', action: 'الإجراء', type: 'النوع', year: 'السنة', rating: 'التقدير', approve: 'القرار',
  phone: 'رقم الجوال', jobTitle: 'المسمى الوظيفي', mobile: 'رقم الجوال', city: 'المدينة', location: 'المقر',
};

function zodMessage(issue) {
  if (!issue) return 'بيانات غير صالحة';
  if (/[؀-ۿ]/.test(issue.message || '')) return issue.message;
  const key = (issue.path || []).filter((p) => typeof p === 'string').pop();
  const label = (key && FIELD_LABELS[key]) || (key ? `«${key}»` : 'أحد الحقول');
  if (issue.code === 'invalid_type' && (issue.received === 'undefined' || issue.received === 'null')) return `${label} مطلوب`;
  if (issue.code === 'too_small') return issue.type === 'string' && issue.minimum <= 1 ? `${label} مطلوب` : `${label} أقصر من المطلوب`;
  if (issue.code === 'too_big') return `${label} أطول من المسموح`;
  if (issue.code === 'invalid_string' && issue.validation === 'email') return 'البريد الإلكتروني غير صحيح';
  if (issue.code === 'invalid_enum_value') return `قيمة ${label} غير صحيحة`;
  return `قيمة ${label} غير صالحة`;
}

function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

function created(res, data) {
  return res.status(201).json(data);
}

// يحوّل أي خطأ (Zod / AppError / Prisma / غير معروف) إلى استجابة متّسقة
function fail(res, error) {
  // أخطاء التحقّق (zod)
  if (error instanceof ZodError) {
    return res.status(400).json({
      code: 'serverErrors.common.validation',
      message: zodMessage(error.errors?.[0]),
      issues: error.flatten ? error.flatten().fieldErrors : undefined,
    });
  }
  // أخطاء التطبيق المعروفة
  if (error instanceof AppError) {
    // رفض مفهوم (4xx) لا يُوسَم «خطأ في الخادم»، وإلا ترجمته الواجهة رسالة عامة وأخفت السبب
    const code = error.statusCode < 500 && error.code === 'serverErrors.common.serverError' ? undefined : error.code;
    return res.status(error.statusCode).json({ code, message: error.message });
  }
  // أخطاء Prisma الشائعة
  if (error?.code === 'P2002') {
    return res.status(409).json({ code: 'serverErrors.common.conflict', message: 'تعارض في البيانات' });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ code: 'serverErrors.common.notFound', message: 'العنصر غير موجود' });
  }
  // رفض مفهوم بخطأ عادي يحمل حالته (403 صلاحية، 400 حالة، 409 تعارض…):
  // تصل رسالته العربية كما هي — كانت تُوسَم «خطأ في الخادم» فيرى المستخدم رسالة عامة
  const status = Number(error?.statusCode) || 500;
  if (status >= 400 && status < 500) {
    return res.status(status).json({
      ...(typeof error.code === 'string' && error.code.startsWith('serverErrors.') && error.code !== 'serverErrors.common.serverError' ? { code: error.code } : {}),
      message: error?.message || 'تعذّر تنفيذ الطلب',
    });
  }
  // غير معروف
  console.error('Unhandled error:', error);
  return res.status(status).json({
    code: 'serverErrors.common.serverError',
    message: error?.message || 'حدث خطأ في الخادم',
  });
}

module.exports = { ok, created, fail, zodMessage };
