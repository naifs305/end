import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DatePicker from 'react-datepicker';
import MainLayout from '../../components/layout/MainLayout';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

const initialForm = {
  title: '',
  operationalProjectId: '',
  locationType: '',
  city: '',
  startDate: '',
  endDate: '',
  traineesCount: '',
  requiresAdvance: false,
  requiresAdvanceSettlement: false,
  requiresMaterialReturn: false,
  requiresCoordinatorCompensation: false,
  requiresTrainerCompensation: false,
};

const locationTypeOptions = [
  { value: 'INTERNAL', label: 'داخلي' },
  { value: 'EXTERNAL', label: 'خارجي' },
  { value: 'REMOTE', label: 'عن بُعد' },
];

function formatDateForApi(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DateRangeInput = forwardRef(function DateRangeInput(
  { startDate, endDate, onClear, onClick },
  ref,
) {
  return (
    <div className="w-full">
      <button
        type="button"
        ref={ref}
        onClick={onClick}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-right transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="text-lg text-slate-400">📅</div>

            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-1 text-xs font-medium text-slate-500">تاريخ البداية</div>
                <div className="truncate text-sm font-semibold text-slate-900">
                  {startDate || 'اختر تاريخ البداية'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-1 text-xs font-medium text-slate-500">تاريخ النهاية</div>
                <div className="truncate text-sm font-semibold text-slate-900">
                  {endDate || 'اختر تاريخ النهاية'}
                </div>
              </div>
            </div>
          </div>

          {(startDate || endDate) && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                }
              }}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              مسح
            </span>
          )}
        </div>
      </button>
    </div>
  );
});

export default function CreateCoursePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const startDateObj = form.startDate ? new Date(form.startDate) : null;
  const endDateObj = form.endDate ? new Date(form.endDate) : null;

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const res = await api.get('/projects');

        const items = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

        setProjects(items);

        if (items.length > 0) {
          setForm((prev) => ({
            ...prev,
            operationalProjectId: prev.operationalProjectId || items[0].id,
          }));
        }
      } catch (error) {
        console.error('Failed to load projects: - create.js:132', error);
        toast.error('تعذر تحميل المشاريع التشغيلية');
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  const canSubmit = useMemo(() => {
    return (
      form.title.trim() &&
      form.operationalProjectId &&
      form.locationType &&
      form.city.trim() &&
      form.startDate &&
      form.endDate &&
      form.traineesCount &&
      Number(form.traineesCount) > 0 &&
      user?.id
    );
  }, [form, user]);

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;

    setForm((prev) => ({
      ...prev,
      startDate: start ? formatDateForApi(start) : '',
      endDate: end ? formatDateForApi(end) : '',
    }));

    if (start && end) {
      setTimeout(() => {
        setIsDatePickerOpen(false);
      }, 50);
    }
  };

  const clearDateRange = () => {
    setForm((prev) => ({
      ...prev,
      startDate: '',
      endDate: '',
    }));
    setIsDatePickerOpen(false);
  };

  const normalizePayload = () => {
    return {
      name: form.title.trim(),
      city: form.city.trim(),
      locationType: form.locationType,
      startDate: form.startDate,
      endDate: form.endDate,
      numTrainees: Number(form.traineesCount),
      operationalProjectId: form.operationalProjectId,
      primaryEmployeeId: user?.id,
      supportingEmployeeIds: [],
      courseType: form.locationType,
      requiresAdvance: form.requiresAdvance,
      requiresRevenue: false,
      materialsIssued: form.requiresMaterialReturn,
      requiresAdvanceSettlement: form.requiresAdvanceSettlement,
      requiresSupervisorCompensation: form.requiresCoordinatorCompensation,
      requiresTrainerCompensation: form.requiresTrainerCompensation,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canSubmit) {
      toast.error('أكمل الحقول المطلوبة أولًا');
      return;
    }

    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error('تاريخ النهاية يجب أن يكون بعد أو مساويًا لتاريخ البداية');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = normalizePayload();
      const res = await api.post('/courses', payload);

      toast.success('تم إنشاء الدورة بنجاح');

      const createdId =
        res?.data?.id ||
        res?.data?.data?.id ||
        res?.data?.course?.id;

      if (createdId) {
        router.push(`/courses/${createdId}`);
        return;
      }

      router.push('/courses');
    } catch (error) {
      console.error('Create course failed: - create.js:241', error);
      toast.error(error?.response?.data?.message || 'تعذر إنشاء الدورة');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-right">جاري التحميل...</div>
      </MainLayout>
    );
  }

  if (!user) return null;

  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">إنشاء دورة جديدة</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">البيانات الأساسية</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="عنوان الدورة"
                  required
                  value={form.title}
                  onChange={(value) => handleChange('title', value)}
                  placeholder="مثال: التفتيش الأمني"
                  className="md:col-span-2"
                />

                <SelectField
                  label="مقر التنفيذ"
                  required
                  value={form.locationType}
                  onChange={(value) => handleChange('locationType', value)}
                  options={locationTypeOptions}
                />

                <Field
                  label="المدينة"
                  required
                  value={form.city}
                  onChange={(value) => handleChange('city', value)}
                  placeholder="مثال: الرياض"
                />

                <DateRangeField
                  startDate={startDateObj}
                  endDate={endDateObj}
                  startDateValue={form.startDate}
                  endDateValue={form.endDate}
                  isOpen={isDatePickerOpen}
                  setIsOpen={setIsDatePickerOpen}
                  onChange={handleDateRangeChange}
                  onClear={clearDateRange}
                />

                <Field
                  label="عدد المتدربين"
                  required
                  type="number"
                  min="1"
                  value={form.traineesCount}
                  onChange={(value) => handleChange('traineesCount', value)}
                  placeholder="مثال: 25"
                />

                <SelectField
                  label="المشروع التشغيلي"
                  required
                  value={form.operationalProjectId}
                  onChange={(value) => handleChange('operationalProjectId', value)}
                  disabled={isLoadingProjects}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">الإعدادات التشغيلية</h2>
                <p className="mt-1 text-sm text-slate-500">
                  هذه الخيارات تتحكم في العناصر التشغيلية المشروطة داخل الدورة
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CheckboxField
                  label="يتطلب سلفة"
                  checked={form.requiresAdvance}
                  onChange={(checked) => handleChange('requiresAdvance', checked)}
                />

                <CheckboxField
                  label="يتطلب تسوية سلفة"
                  checked={form.requiresAdvanceSettlement}
                  onChange={(checked) =>
                    handleChange('requiresAdvanceSettlement', checked)
                  }
                />

                <CheckboxField
                  label="يتطلب إعادة مواد تدريبية"
                  checked={form.requiresMaterialReturn}
                  onChange={(checked) =>
                    handleChange('requiresMaterialReturn', checked)
                  }
                />

                <CheckboxField
                  label="يتطلب مستحقات منسق"
                  checked={form.requiresCoordinatorCompensation}
                  onChange={(checked) =>
                    handleChange('requiresCoordinatorCompensation', checked)
                  }
                />

                <CheckboxField
                  label="يتطلب مستحقات مدرب"
                  checked={form.requiresTrainerCompensation}
                  onChange={(checked) =>
                    handleChange('requiresTrainerCompensation', checked)
                  }
                />
              </div>
            </div>

            <div className="sticky bottom-4 z-10">
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => router.push('/courses')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الدورة'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  min,
  className = '',
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500">*</span> : null}
      </span>

      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  disabled = false,
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500">*</span> : null}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
      >
        <option value="">
          {label === 'المشروع التشغيلي' ? 'اختر المشروع التشغيلي' : 'اختر مقر التنفيذ'}
        </option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateRangeField({
  startDate,
  endDate,
  startDateValue,
  endDateValue,
  isOpen,
  setIsOpen,
  onChange,
  onClear,
}) {
  return (
    <div className="md:col-span-2">
      <span className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-700">
        تاريخ الدورة
        <span className="text-red-500">*</span>
      </span>

      <DatePicker
        selected={startDate}
        onChange={onChange}
        startDate={startDate}
        endDate={endDate}
        selectsRange
        open={isOpen}
        onInputClick={() => setIsOpen(true)}
        onClickOutside={() => setIsOpen(false)}
        shouldCloseOnSelect={false}
        monthsShown={2}
        popperPlacement="bottom-start"
        dateFormat="yyyy-MM-dd"
        placeholderText="اختر تاريخ البداية والنهاية"
        calendarClassName="border border-slate-200 rounded-xl shadow-xl"
        wrapperClassName="w-full"
        customInput={
          <DateRangeInput
            startDate={startDateValue}
            endDate={endDateValue}
            onClear={onClear}
          />
        }
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}