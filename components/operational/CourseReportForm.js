import { useMemo, useState } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

const ratings = [
  { value: 'excellent', label: 'ممتاز' },
  { value: 'good', label: 'جيد' },
  { value: 'needs_improvement', label: 'يحتاج تحسين' },
  { value: 'weak', label: 'ضعيف' },
  { value: 'requires_development', label: 'يحتاج تطوير' },
];

const ratingValuesRequiringComment = ['needs_improvement', 'weak', 'requires_development'];

const openingGuides = {
  training_environment: [
    'جاهزية القاعة أو مقر التنفيذ',
    'النظافة والترتيب والانضباط العام',
    'سلامة التكييف والإنارة والتهوية',
    'سلامة المقاعد والطاولات وتجهيزات المتدربين',
    'مدى مناسبة البيئة التدريبية لبداية التنفيذ',
  ],
  trainer_evaluation: [
    'جاهزية المدرب في بداية الدورة',
    'الالتزام بالوقت والتعليمات التنظيمية',
    'وضوح أسلوب العرض والتقديم',
    'التعاون مع فريق التشغيل',
    'الاستعداد لبداية التنفيذ',
  ],
  trainee_evaluation: [
    'انتظام الحضور في اليوم الأول',
    'سلامة التسجيل ودخول المشاركين',
    'التزام المتدربين بالتعليمات الأولية',
    'وضوح الاستقبال والتنظيم عند البداية',
    'انطباع أولي عن انضباط المجموعة',
  ],
  content_evaluation: [
    'وضوح المحتوى العلمي منذ البداية',
    'مدى ارتباط المحتوى بالبرنامج',
    'سلامة المادة العلمية والمرفقات',
    'تسلسل العناصر العلمية',
    'ملاءمة المحتوى للفئة المستهدفة',
  ],
  lms_evaluation: [
    'جاهزية منصة LMS وبنود البرنامج',
    'وضوح التعليمات داخل المنصة',
    'توفر الملفات والروابط الأساسية',
    'سلامة الوصول للمحتوى والاختبارات',
    'تطابق المحتوى على المنصة مع التنفيذ',
  ],
};

const closingGuides = {
  training_environment: [
    'جاهزية القاعة أو مقر التنفيذ',
    'النظافة والترتيب والانضباط العام',
    'سلامة التكييف والإنارة والتهوية',
    'سلامة المقاعد والطاولات وتجهيزات المتدربين',
    'مدى مناسبة البيئة التدريبية لتنفيذ البرنامج',
  ],
  trainer_evaluation: [
    'الالتزام بالحضور والانصراف',
    'الجاهزية العلمية والقدرة على الشرح',
    'التفاعل مع المتدربين وإدارة النقاش',
    'الالتزام بالجدول الزمني',
    'التعاون مع فريق التشغيل',
  ],
  trainee_evaluation: [
    'الانضباط بالحضور والالتزام',
    'التفاعل والمشاركة أثناء التنفيذ',
    'الالتزام بالتعليمات',
    'الجدية في الأنشطة والاختبارات',
    'السلوك العام داخل البيئة التدريبية',
  ],
  content_evaluation: [
    'جودة المادة العلمية وتكاملها',
    'سلامة تسلسل المحتوى أثناء التنفيذ',
    'مناسبة المحتوى للأهداف التدريبية',
    'وضوح الحقائب والمرفقات العلمية',
    'مدى تحقيق المحتوى لقيمة تعليمية فعلية',
  ],
  lms_evaluation: [
    'اكتمال المحتوى على منصة LMS',
    'وضوح التعليمات داخل المنصة',
    'توفر الاختبارات أو الأنشطة المطلوبة',
    'سلامة الملفات والروابط والمرفقات',
    'مدى توافق المنصة مع البرنامج المنفذ',
  ],
};

function emptySection() {
  return { rating: '', comment: '' };
}

function getInitialForm(reportType) {
  if (reportType === 'opening_report') {
    return {
      training_environment: emptySection(),
      trainer_evaluation: emptySection(),
      trainee_evaluation: emptySection(),
      content_evaluation: emptySection(),
      lms_evaluation: emptySection(),
      registered_trainees_count: '',
      initial_attendance_count: '',
      trainers_count: '',
      translators_count: '',
      readiness_notes: '',
      declarationConfirmed: false,
      attachments: [],
    };
  }

  return {
    training_environment: emptySection(),
    trainer_evaluation: emptySection(),
    trainee_evaluation: emptySection(),
    content_evaluation: emptySection(),
    lms_evaluation: emptySection(),
    registered_trainees_count: '',
    actual_attendance_count: '',
    trainers_count: '',
    translators_count: '',
    passed_count: '',
    failed_count: '',
    recommendations: '',
    declarationConfirmed: false,
    attachments: [],
  };
}

function RatingBadgePreview({ value }) {
  if (!value) return null;
  const map = {
    excellent: 'bg-emerald-50 text-success border-emerald-200',
    good: 'bg-primary-light text-primary border-primary/20',
    needs_improvement: 'bg-amber-50 text-warning border-amber-200',
    weak: 'bg-red-50 text-danger border-danger/20',
    requires_development: 'bg-[#f7f1e7] text-[#8c6b2a] border-[#e6d4ad]',
  };
  const label = ratings.find((r) => r.value === value)?.label || value;
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${map[value] || 'bg-background text-text-soft border-border'}`}>{label}</span>;
}

function Section({ title, name, data, onChange, required = false, helperItems = [] }) {
  const needsComment = ratingValuesRequiringComment.includes(data?.rating || '');
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-extrabold text-text-main">{title}{required ? <span className="mr-1 text-danger">*</span> : null}</h4>
          <RatingBadgePreview value={data?.rating} />
        </div>
        {helperItems.length > 0 && (
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-2 text-xs font-bold text-text-main">محاور التقييم المقترحة</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {helperItems.map((item, index) => (
                <div key={`${name}-guide-${index}`} className="flex items-start gap-2 text-xs text-text-soft">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="mb-1.5 block text-xs font-bold text-text-soft">التقييم العام{required ? <span className="mr-1 text-danger">*</span> : null}</label>
          <select name={`${name}.rating`} value={data?.rating || ''} onChange={onChange} className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" required={required}>
            <option value="">اختر التقييم</option>
            {ratings.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-xs font-bold text-text-soft">الوصف التفصيلي والملاحظات{needsComment ? <span className="mr-1 text-danger">*</span> : null}</label>
          <textarea name={`${name}.comment`} value={data?.comment || ''} onChange={onChange} className="min-h-[120px] w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="اكتب وصفًا واضحًا لما تم رصده في هذا المحور، مع ذكر الملاحظات أو جوانب القوة أو جوانب التحسين" required={needsComment} />
          <div className="mt-2 text-[11px] text-text-soft">عند اختيار: يحتاج تحسين / ضعيف / يحتاج تطوير، تصبح الملاحظة إلزامية.</div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return <div className="rounded-2xl border border-border bg-white p-3"><div className="mb-1 text-[11px] font-bold text-text-soft">{label}</div><div className="break-words text-sm font-bold text-text-main">{value || '-'}</div></div>;
}

function AttachmentCard({ file, index, onRemove }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-2">
      <img src={file.content} alt={file.name} className="mb-2 h-28 w-full rounded-xl object-cover" />
      <div className="mb-1 truncate text-xs font-medium text-text-main">{file.name}</div>
      <div className="mb-2 text-[11px] text-text-soft">{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</div>
      <button type="button" onClick={() => onRemove(index)} className="text-xs font-bold text-danger hover:underline">حذف</button>
    </div>
  );
}

function TextField({ label, name, value, onChange, placeholder, required = false, type = 'text', min, disabled = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-text-soft">{label}{required ? <span className="mr-1 text-danger">*</span> : null}</label>
      <input type={type} min={min} name={name} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-background" required={required} />
    </div>
  );
}

function TextAreaField({ label, name, value, onChange, placeholder, required = false, minHeight = '120px' }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-text-soft">{label}{required ? <span className="mr-1 text-danger">*</span> : null}</label>
      <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" style={{ minHeight }} required={required} />
    </div>
  );
}

function formatLocationType(value) {
  const map = { INTERNAL: 'داخلي', EXTERNAL: 'خارجي', REMOTE: 'عن بُعد' };
  return map[value] || value || '-';
}

export default function CourseReportForm({ trackingId, onClose, onSuccess, course, reportType = 'closing_report' }) {
  const normalizedType = reportType === 'opening_report' ? 'opening_report' : 'closing_report';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(getInitialForm(normalizedType));

  const courseInfo = useMemo(() => {
    if (!course) return null;
    return {
      name: course.name || '-',
      code: course.code || '-',
      project: course.operationalProject?.name || '-',
      city: course.city || '-',
      locationType: course.locationType || '-',
      startDate: course.startDate ? new Date(course.startDate).toLocaleDateString('ar-SA') : '-',
      endDate: course.endDate ? new Date(course.endDate).toLocaleDateString('ar-SA') : '-',
      traineesCount: course.numTrainees ?? '-',
      supervisor: `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-',
    };
  }, [course]);

  const attendanceRate = useMemo(() => {
    const registered = Number(form.registered_trainees_count);
    const actual = Number(normalizedType === 'opening_report' ? form.initial_attendance_count : form.actual_attendance_count);
    if (!registered || Number.isNaN(registered) || registered <= 0) return '';
    if (Number.isNaN(actual) || actual < 0) return '';
    return `${((actual / registered) * 100).toFixed(1)}%`;
  }, [form.registered_trainees_count, form.initial_attendance_count, form.actual_attendance_count, normalizedType]);

  const passingRate = useMemo(() => {
    if (normalizedType !== 'closing_report') return '';
    const attendance = Number(form.actual_attendance_count);
    const passed = Number(form.passed_count);
    if (!attendance || Number.isNaN(attendance) || attendance <= 0) return '';
    if (Number.isNaN(passed) || passed < 0) return '';
    return `${((passed / attendance) * 100).toFixed(1)}%`;
  }, [form.actual_attendance_count, form.passed_count, normalizedType]);

  const completionStats = useMemo(() => {
    const keys = normalizedType === 'opening_report'
      ? ['training_environment', 'trainer_evaluation', 'trainee_evaluation', 'content_evaluation', 'lms_evaluation']
      : ['training_environment', 'trainer_evaluation', 'trainee_evaluation', 'content_evaluation', 'lms_evaluation'];
    const completed = keys.filter((key) => form[key]?.rating).length;
    return { completed, total: keys.length, percent: Math.round((completed / keys.length) * 100) };
  }, [form, normalizedType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const parts = name.split('.');
    if (parts.length === 2) {
      const [section, field] = parts;
      setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const content = canvas.toDataURL('image/jpeg', 0.72);
        resolve({
          name: file.name.replace(/\.[^.]+$/, '.jpg'),
          type: 'image/jpeg',
          size: Math.round((content.length * 3) / 4),
          content,
        });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleAttachmentsChange = async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      if (form.attachments.length + files.length > 6) {
        toast.error('الحد الأقصى 6 صور فقط');
        e.target.value = '';
        return;
      }
      const invalidFile = files.find((file) => !file.type.startsWith('image/'));
      if (invalidFile) {
        toast.error('يسمح فقط برفع الصور');
        e.target.value = '';
        return;
      }
      const oversized = files.find((file) => file.size > 4 * 1024 * 1024);
      if (oversized) {
        toast.error('حجم الصورة الواحدة يجب ألا يتجاوز 4MB');
        e.target.value = '';
        return;
      }
      const convertedFiles = await Promise.all(files.map(compressImage));
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...convertedFiles] }));
      e.target.value = '';
    } catch {
      toast.error('تعذر رفع الصور');
    }
  };

  const handleRemoveAttachment = (index) => setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));

  const validateForm = () => {
    const requiredSections = normalizedType === 'opening_report'
      ? ['training_environment', 'trainer_evaluation', 'trainee_evaluation', 'content_evaluation', 'lms_evaluation']
      : ['training_environment', 'trainer_evaluation', 'trainee_evaluation', 'content_evaluation', 'lms_evaluation'];

    for (const key of requiredSections) {
      const section = form[key];
      if (!section?.rating?.trim()) {
        toast.error('لا يمكن تقديم التقرير قبل استكمال جميع التقييمات الأساسية');
        return false;
      }
      if (ratingValuesRequiringComment.includes(section.rating) && !section.comment?.trim()) {
        toast.error('يوجد تقييم يتطلب ملاحظة تفسيرية');
        return false;
      }
    }

    if (form.registered_trainees_count === '' || (normalizedType === 'opening_report' ? form.initial_attendance_count === '' : form.actual_attendance_count === '')) {
      toast.error('أكمل بيانات المشاركة الأساسية');
      return false;
    }

    if (!form.declarationConfirmed) {
      toast.error('يجب الإقرار بصحة البيانات قبل التقديم');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const endpoint = normalizedType === 'opening_report' ? `/closure/${trackingId}/opening-report` : `/closure/${trackingId}/closing-report`;
      await api.post(endpoint, {
        ...form,
        attendance_rate: attendanceRate,
        passing_rate: passingRate,
        generatedCourseInfo: courseInfo,
      });
      toast.success('تم تقديم التقرير');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const title = normalizedType === 'opening_report' ? 'تقرير افتتاح الدورة' : 'تقرير اختتام الدورة';
  const subtitle = normalizedType === 'opening_report'
    ? 'نموذج تفصيلي لمتابعة الجاهزية التشغيلية والحضور الأولي عند افتتاح البرنامج'
    : 'نموذج تفصيلي لتقييم التنفيذ التشغيلي وجودة البرنامج والبيئة التدريبية عند الاختتام';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-primary">{title}</h3>
            <p className="mt-1 text-sm text-text-soft">{subtitle}</p>
          </div>
          <div className="min-w-[220px] rounded-3xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-text-soft">استكمال النموذج</span><span className="text-sm font-extrabold text-primary">{completionStats.percent}%</span></div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${completionStats.percent}%` }} /></div>
            <div className="mt-2 text-[11px] text-text-soft">{completionStats.completed} من {completionStats.total} محاور مكتملة</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReadOnlyField label="اسم الدورة" value={courseInfo?.name} />
          <ReadOnlyField label="كود الدورة" value={courseInfo?.code} />
          <ReadOnlyField label="المشروع التشغيلي" value={courseInfo?.project} />
          <ReadOnlyField label="المدينة" value={courseInfo?.city} />
          <ReadOnlyField label="مقر التنفيذ" value={formatLocationType(courseInfo?.locationType)} />
          <ReadOnlyField label="تاريخ البداية" value={courseInfo?.startDate} />
          <ReadOnlyField label="تاريخ النهاية" value={courseInfo?.endDate} />
          <ReadOnlyField label="عدد المتدربين" value={courseInfo?.traineesCount} />
          <ReadOnlyField label="المشرف / المنسق" value={courseInfo?.supervisor} />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4"><h4 className="text-base font-extrabold text-text-main">إحصائيات ${normalizedType === 'opening_report' ? 'الافتتاح والحضور الأولي' : 'المشاركة والنتائج النهائية'}</h4></div>
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${normalizedType === 'opening_report' ? 'xl:grid-cols-4' : 'xl:grid-cols-4'}`}>
          <TextField label="عدد المشاركين المسجلين" name="registered_trainees_count" value={form.registered_trainees_count} onChange={handleChange} placeholder="مثال: 14" type="number" min="0" required />
          {normalizedType === 'opening_report' ? (
            <TextField label="عدد الحضور في اليوم الأول" name="initial_attendance_count" value={form.initial_attendance_count} onChange={handleChange} placeholder="مثال: 14" type="number" min="0" required />
          ) : (
            <TextField label="عدد الحضور الفعلي" name="actual_attendance_count" value={form.actual_attendance_count} onChange={handleChange} placeholder="مثال: 14" type="number" min="0" required />
          )}
          <TextField label="عدد المدربين" name="trainers_count" value={form.trainers_count} onChange={handleChange} placeholder="مثال: 3" type="number" min="0" />
          <TextField label="عدد المترجمين" name="translators_count" value={form.translators_count} onChange={handleChange} placeholder="مثال: 1" type="number" min="0" />
          <TextField label={normalizedType === 'opening_report' ? 'نسبة الحضور الأولية' : 'نسبة الحضور'} name="attendance_rate_preview" value={attendanceRate} onChange={() => {}} disabled />
          {normalizedType === 'closing_report' && (
            <>
              <TextField label="عدد المجتازين" name="passed_count" value={form.passed_count} onChange={handleChange} placeholder="مثال: 12" type="number" min="0" />
              <TextField label="عدد غير المجتازين" name="failed_count" value={form.failed_count} onChange={handleChange} placeholder="مثال: 2" type="number" min="0" />
              <TextField label="نسبة الاجتياز" name="passing_rate_preview" value={passingRate} onChange={() => {}} disabled />
            </>
          )}
        </div>
      </div>

      {normalizedType === 'opening_report' ? (
        <>
          <Section title="تقييم البيئة التدريبية" name="training_environment" data={form.training_environment} onChange={handleChange} required helperItems={openingGuides.training_environment} />
          <Section title="تقييم المدرب" name="trainer_evaluation" data={form.trainer_evaluation} onChange={handleChange} required helperItems={openingGuides.trainer_evaluation} />
          <Section title="تقييم المتدرب" name="trainee_evaluation" data={form.trainee_evaluation} onChange={handleChange} required helperItems={openingGuides.trainee_evaluation} />
          <Section title="تقييم المحتوى" name="content_evaluation" data={form.content_evaluation} onChange={handleChange} required helperItems={openingGuides.content_evaluation} />
          <Section title="تقييم منصة LMS" name="lms_evaluation" data={form.lms_evaluation} onChange={handleChange} required helperItems={openingGuides.lms_evaluation} />
          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <TextAreaField label="ملاحظات وتوصيات عند الافتتاح" name="readiness_notes" value={form.readiness_notes} onChange={handleChange} placeholder="اكتب أبرز الملاحظات والتوصيات الميدانية عند افتتاح الدورة" minHeight="140px" />
          </div>
        </>
      ) : (
        <>
          <Section title="تقييم البيئة التدريبية" name="training_environment" data={form.training_environment} onChange={handleChange} required helperItems={closingGuides.training_environment} />
          <Section title="تقييم المدرب" name="trainer_evaluation" data={form.trainer_evaluation} onChange={handleChange} required helperItems={closingGuides.trainer_evaluation} />
          <Section title="تقييم المتدرب" name="trainee_evaluation" data={form.trainee_evaluation} onChange={handleChange} required helperItems={closingGuides.trainee_evaluation} />
          <Section title="تقييم المحتوى" name="content_evaluation" data={form.content_evaluation} onChange={handleChange} required helperItems={closingGuides.content_evaluation} />
          <Section title="تقييم منصة LMS" name="lms_evaluation" data={form.lms_evaluation} onChange={handleChange} required helperItems={closingGuides.lms_evaluation} />
          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <TextAreaField label="التوصيات والمقترحات" name="recommendations" value={form.recommendations} onChange={handleChange} placeholder="اكتب التوصيات والمقترحات التي خرج بها فريق الإشراف عند اختتام البرنامج" minHeight="140px" />
          </div>
        </>
      )}

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between"><h4 className="text-base font-extrabold text-text-main">مرفقات وصور داعمة</h4><span className="text-xs text-text-soft">اختياري — حتى 6 صور</span></div>
        <div className="mb-4"><input type="file" accept="image/*" multiple onChange={handleAttachmentsChange} className="block w-full text-sm text-text-soft file:ml-4 file:rounded-2xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:opacity-90" /></div>
        {form.attachments.length > 0 ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{form.attachments.map((file, index) => <AttachmentCard key={`${file.name}-${index}`} file={file} index={index} onRemove={handleRemoveAttachment} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-text-soft">لم يتم إرفاق أي صور حتى الآن</div>}
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <label className="flex items-start gap-3 text-sm text-text-main">
          <input type="checkbox" name="declarationConfirmed" checked={form.declarationConfirmed} onChange={handleChange} className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary" />
          <span>أقر بصحة البيانات المدخلة في هذا التقرير، وأنها تعبّر عن الحالة الميدانية الفعلية للدورة لحظة الرفع.</span>
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
        <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-main transition hover:bg-background">إغلاق</button>
        <button type="submit" disabled={loading} className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'جاري الحفظ...' : 'حفظ وتقديم التقرير'}</button>
      </div>
    </form>
  );
}
