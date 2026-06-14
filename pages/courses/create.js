import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DatePicker from 'react-datepicker';
import MainLayout from '../../components/layout/MainLayout';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

// ── أدوات ──────────────────────────────────────────────────────
function fmtDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

const EMPTY = {
  name:'', beneficiaryEntity:'', city:'', locationType:'',
  startDate:'', endDate:'', numTrainees:'',
  operationalProjectId: '',
  requiresAdvance:false, requiresAdvanceSettlement:false,
  requiresRevenue:false, materialsIssued:false,
  requiresSupervisorCompensation:false, requiresTrainerCompensation:false,
  requiresPreTest:false, requiresPostTest:false,
};

// ── مدخل DatePicker مخصص ──────────────────────────────────────
const DateInput = forwardRef(function DateInput({ startDate, endDate, onClick, onClear }, ref) {
  return (
    <button type="button" ref={ref} onClick={onClick}
      className="w-full rounded-xl border border-border bg-white px-4 py-3 text-right text-sm outline-none hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10">
      <div className="flex items-center gap-3">
        <span className="text-text-soft">📅</span>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="rounded-lg bg-background px-3 py-2">
            <div className="text-[10px] text-text-soft">من</div>
            <div className="font-bold text-text-main">{startDate || '—'}</div>
          </div>
          <div className="rounded-lg bg-background px-3 py-2">
            <div className="text-[10px] text-text-soft">إلى</div>
            <div className="font-bold text-text-main">{endDate || '—'}</div>
          </div>
        </div>
        {(startDate || endDate) && (
          <button type="button" onClick={e=>{e.stopPropagation();onClear();}}
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] text-text-soft hover:bg-background">✕</button>
        )}
      </div>
    </button>
  );
});

// ── toggle ────────────────────────────────────────────────────
function Toggle({ label, desc, checked, onChange, critical }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition
      ${checked ? 'border-primary/30 bg-primary-light/50' : 'border-border bg-background hover:border-primary/20'}
      ${critical ? 'ring-1 ring-primary/20' : ''}`}>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none
          ${checked ? 'bg-primary' : 'bg-forest-200'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
          ${checked ? 'translate-x-[-1px] rtl:translate-x-4' : 'translate-x-[-1px] rtl:translate-x-0.5'}`} />
      </button>
      <div>
        <div className={`text-sm font-bold ${checked ? 'text-primary' : 'text-text-main'}`}>
          {label} {critical && <span className="text-xs text-sand font-normal">⭐ حرج</span>}
        </div>
        {desc && <div className="mt-0.5 text-[11px] text-text-soft">{desc}</div>}
      </div>
    </label>
  );
}

// ── صف حقل ───────────────────────────────────────────────────
function Field({ label, required, children, span2 }) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <label className="mb-1.5 block text-xs font-bold text-text-main">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';

// ── الصفحة ───────────────────────────────────────────────────
export default function CreateCoursePage() {
  const router  = useRouter();
  const { user, loading } = useAuth();
  const [form,     setForm]     = useState(EMPTY);
  const [projects, setProjects] = useState([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    api.get('/projects').then(r => {
      const d = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setProjects(d);
      if (d.length) setForm(p => ({ ...p, operationalProjectId: p.operationalProjectId || d[0].id }));
    }).catch(() => toast.error('تعذر تحميل المشاريع'));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggle = k => setForm(p => ({ ...p, [k]: !p[k] }));

  // اكتشاف تلقائي: هل الدورة خارج مشروع المنسق؟
  const isCrossProject = user && form.operationalProjectId &&
    user.operationalProjectId &&
    form.operationalProjectId !== user.operationalProjectId;

  const canSubmit = useMemo(() =>
    form.name.trim() && form.operationalProjectId && form.locationType &&
    form.city.trim() && form.startDate && form.endDate &&
    form.numTrainees && Number(form.numTrainees) > 0,
  [form]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!canSubmit) { toast.error('أكمل الحقول المطلوبة'); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية'); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        beneficiaryEntity: form.beneficiaryEntity.trim() || undefined,
        city: form.city.trim(),
        locationType: form.locationType,
        startDate: form.startDate,
        endDate: form.endDate,
        numTrainees: Number(form.numTrainees),
        operationalProjectId: form.operationalProjectId,
        primaryEmployeeId: user.id,
        courseType: form.locationType === 'INTERNAL' ? 'internal' : form.locationType === 'REMOTE' ? 'remote' : 'external',
        requiresAdvance:               form.requiresAdvance,
        requiresAdvanceSettlement:     form.requiresAdvanceSettlement,
        requiresRevenue:               form.requiresRevenue,
        materialsIssued:               form.materialsIssued,
        requiresSupervisorCompensation:form.requiresSupervisorCompensation,
        requiresTrainerCompensation:   form.requiresTrainerCompensation,
        requiresPreTest:               form.requiresPreTest,
        requiresPostTest:              form.requiresPostTest,
        isCrossProject:                isCrossProject || false,
      };
      const res = await api.post('/courses', payload);
      toast.success('تم إنشاء الدورة ✓');
      const id = res?.data?.id || res?.data?.data?.id;
      router.push(id ? `/courses/${id}` : '/courses');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذر إنشاء الدورة');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
    </div>
  );
  if (!user) return null;

  const sDate = form.startDate ? new Date(form.startDate) : null;
  const eDate = form.endDate   ? new Date(form.endDate)   : null;

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl space-y-5">

        {/* رأس */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-primary">إنشاء دورة تدريبية</h1>
              <p className="mt-0.5 text-xs text-text-soft">أدخل بيانات الدورة وحدد الإعدادات التشغيلية</p>
            </div>
            <button onClick={() => router.push('/courses')} type="button"
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">
              ← رجوع
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* البيانات الأساسية */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-4 font-extrabold text-text-main">📋 البيانات الأساسية</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="اسم الدورة" required span2>
                <input value={form.name} onChange={e=>set('name',e.target.value)} required
                  placeholder="مثال: أساليب التفتيش الأمني"
                  className={inputCls} />
              </Field>
              <Field label="الجهة المستفيدة">
                <input value={form.beneficiaryEntity} onChange={e=>set('beneficiaryEntity',e.target.value)}
                  placeholder="اسم الجهة المستفيدة (اختياري)"
                  className={inputCls} />
              </Field>
              <Field label="مقر التنفيذ" required>
                <select value={form.locationType} onChange={e=>set('locationType',e.target.value)} required className={inputCls}>
                  <option value="">اختر مقر التنفيذ</option>
                  <option value="INTERNAL">داخلي</option>
                  <option value="EXTERNAL">خارجي</option>
                  <option value="REMOTE">عن بُعد</option>
                </select>
              </Field>
              <Field label="المدينة" required>
                <input value={form.city} onChange={e=>set('city',e.target.value)} required
                  placeholder="مثال: الرياض"
                  className={inputCls} />
              </Field>
              <Field label="المشروع التشغيلي" required>
                <select value={form.operationalProjectId} onChange={e=>set('operationalProjectId',e.target.value)} required className={inputCls}>
                  <option value="">اختر المشروع</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {isCrossProject && (
                  <div className="mt-2 rounded-xl border border-accent/30 bg-forest-50 px-3 py-2 text-xs">
                    <p className="font-bold text-accent mb-0.5">🌟 دورة خارج مشروعك</p>
                    <p className="text-text-soft">هذه الدورة تنتمي لمشروع غير مشروعك الأصلي. ستحصل على نقاط تحفيزية إضافية في تقييم أدائك عند إنجازها في الوقت المحدد.</p>
                  </div>
                )}
              </Field>
              <Field label="تاريخ الدورة (بداية - نهاية)" required span2>
                <DatePicker
                  selected={sDate} onChange={([s,e])=>{ set('startDate',fmtDate(s)); set('endDate',fmtDate(e)); if(s&&e) setTimeout(()=>setDateOpen(false),60); }}
                  startDate={sDate} endDate={eDate} selectsRange
                  open={dateOpen} onInputClick={()=>setDateOpen(true)} onClickOutside={()=>setDateOpen(false)}
                  shouldCloseOnSelect={false} monthsShown={2} dateFormat="yyyy-MM-dd"
                  customInput={<DateInput startDate={form.startDate} endDate={form.endDate} onClear={()=>{set('startDate','');set('endDate','');}} />}
                />
              </Field>
              <Field label="عدد المتدربين" required>
                <input type="number" min="1" value={form.numTrainees} onChange={e=>set('numTrainees',e.target.value)} required
                  placeholder="مثال: 25"
                  className={inputCls} />
              </Field>
            </div>
          </div>

          {/* الإعدادات التشغيلية */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-1 font-extrabold text-text-main">⚙️ الإعدادات التشغيلية</h2>
            <p className="mb-4 text-xs text-text-soft">تحدد العناصر المطلوبة لإقفال الدورة — عناصر ⭐ حرجة تؤثر مباشرة في مؤشرات الأداء</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Toggle label="يتطلب سلفة مؤقتة" desc="طلب السلفة قبل الدورة"
                checked={form.requiresAdvance} onChange={v=>set('requiresAdvance',v)} />
              <Toggle label="يتطلب تسوية سلفة" desc="تسوية السلفة بعد الدورة" critical
                checked={form.requiresAdvanceSettlement} onChange={v=>set('requiresAdvanceSettlement',v)} />
              <Toggle label="يدر إيرادات مالية" desc="رفع الإيرادات بعد الدورة"
                checked={form.requiresRevenue} onChange={v=>set('requiresRevenue',v)} />
              <Toggle label="صُرفت مواد تدريبية" desc="إعادة المواد بعد الدورة"
                checked={form.materialsIssued} onChange={v=>set('materialsIssued',v)} />
              <Toggle label="مستحقات مشرف المشروع" desc="رفع مستحقات المشرف" critical
                checked={form.requiresSupervisorCompensation} onChange={v=>set('requiresSupervisorCompensation',v)} />
              <Toggle label="مستحقات المدرب" desc="رفع مستحقات المدرب" critical
                checked={form.requiresTrainerCompensation} onChange={v=>set('requiresTrainerCompensation',v)} />
              <Toggle label="يشتمل على اختبار قبلي" desc="تقديم الاختبار القبلي للمتدربين"
                checked={form.requiresPreTest} onChange={v=>set('requiresPreTest',v)} />
              <Toggle label="يشتمل على اختبار بعدي" desc="تقديم الاختبار البعدي للمتدربين"
                checked={form.requiresPostTest} onChange={v=>set('requiresPostTest',v)} />
            </div>
          </div>

          {/* أزرار الحفظ */}
          <div className="sticky bottom-4 z-10">
            <div className="rounded-2xl border border-border bg-white/95 p-4 shadow-deep backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-soft">
                  {canSubmit ? '✓ البيانات مكتملة — جاهز للإنشاء' : 'أكمل الحقول المطلوبة *'}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>router.push('/courses')}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-main hover:bg-background">
                    إلغاء
                  </button>
                  <button type="submit" disabled={!canSubmit||saving}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-extrabold text-white hover:bg-primary-dark disabled:opacity-50">
                    {saving ? 'جاري الإنشاء...' : '+ إنشاء الدورة'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>
    </MainLayout>
  );
}
