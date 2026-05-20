import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DatePicker from 'react-datepicker';
import MainLayout from '../../../components/layout/MainLayout';
import api from '../../../lib/axios';
import toast from 'react-hot-toast';

// ── أدوات ──────────────────────────────────────────────────────
function fmtDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

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
export default function EditCoursePage() {
  const router = useRouter();
  const { id }  = router.query;

  const [form,     setForm]     = useState(null);
  const [projects, setProjects] = useState([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/courses/${id}`),
      api.get('/projects'),
    ]).then(([cr, pr]) => {
      const c = cr.data;
      const projects = Array.isArray(pr.data) ? pr.data : pr.data?.data || [];
      setProjects(projects);
      setForm({
        name:                        c.name || '',
        code:                        c.code || '',
        beneficiaryEntity:           c.beneficiaryEntity || '',
        city:                        c.city || '',
        locationType:                c.locationType || '',
        startDate:                   c.startDate ? fmtDate(new Date(c.startDate)) : '',
        endDate:                     c.endDate   ? fmtDate(new Date(c.endDate))   : '',
        numTrainees:                 c.numTrainees != null ? String(c.numTrainees) : '',
        operationalProjectId:        c.operationalProjectId || c.operationalProject?.id || '',
        requiresAdvance:             !!c.requiresAdvance,
        requiresAdvanceSettlement:   !!c.requiresAdvanceSettlement,
        requiresRevenue:             !!c.requiresRevenue,
        materialsIssued:             !!c.materialsIssued,
        requiresSupervisorCompensation: !!c.requiresSupervisorCompensation,
        requiresTrainerCompensation: !!c.requiresTrainerCompensation,
        requiresPreTest:             !!c.requiresPreTest,
        requiresPostTest:            !!c.requiresPostTest,
      });
    }).catch(() => toast.error('تعذر تحميل بيانات الدورة'))
      .finally(() => setLoading(false));
  }, [id]);

  const set    = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const canSubmit = useMemo(() => form &&
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
      await api.put(`/courses/${id}`, {
        name:                        form.name.trim(),
        code:                        form.code.trim() || undefined,
        beneficiaryEntity:           form.beneficiaryEntity.trim() || undefined,
        city:                        form.city.trim(),
        locationType:                form.locationType,
        startDate:                   form.startDate,
        endDate:                     form.endDate,
        numTrainees:                 Number(form.numTrainees),
        operationalProjectId:        form.operationalProjectId,
        courseType:                  form.locationType === 'INTERNAL' ? 'internal' : 'external',
        requiresAdvance:             form.requiresAdvance,
        requiresAdvanceSettlement:   form.requiresAdvanceSettlement,
        requiresRevenue:             form.requiresRevenue,
        materialsIssued:             form.materialsIssued,
        requiresSupervisorCompensation: form.requiresSupervisorCompensation,
        requiresTrainerCompensation: form.requiresTrainerCompensation,
        requiresPreTest:             form.requiresPreTest,
        requiresPostTest:            form.requiresPostTest,
      });
      toast.success('تم تحديث الدورة ✓');
      router.push(`/courses/${id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذر تحديث الدورة');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return (
    <MainLayout>
      <div className="flex items-center justify-center py-20 text-text-soft">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </MainLayout>
  );

  const sDate = form.startDate ? new Date(form.startDate) : null;
  const eDate = form.endDate   ? new Date(form.endDate)   : null;

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl space-y-5">

        {/* رأس */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-primary">تعديل الدورة</h1>
              <p className="mt-0.5 text-xs text-text-soft truncate max-w-xs">{form.name}</p>
            </div>
            <button onClick={() => router.push(`/courses/${id}`)} type="button"
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
                <input value={form.name} onChange={e=>set('name',e.target.value)} required placeholder="اسم الدورة" className={inputCls} />
              </Field>
              <Field label="كود الدورة">
                <input value={form.code} onChange={e=>set('code',e.target.value)} placeholder="مثال: SEC-101 (اختياري)" className={inputCls} />
              </Field>
              <Field label="الجهة المستفيدة">
                <input value={form.beneficiaryEntity} onChange={e=>set('beneficiaryEntity',e.target.value)} placeholder="اسم الجهة (اختياري)" className={inputCls} />
              </Field>
              <Field label="مقر التنفيذ" required>
                <select value={form.locationType} onChange={e=>set('locationType',e.target.value)} required className={inputCls}>
                  <option value="">اختر</option>
                  <option value="INTERNAL">داخلي</option>
                  <option value="EXTERNAL">خارجي</option>
                  <option value="REMOTE">عن بُعد</option>
                </select>
              </Field>
              <Field label="المدينة" required>
                <input value={form.city} onChange={e=>set('city',e.target.value)} required placeholder="الرياض" className={inputCls} />
              </Field>
              <Field label="المشروع التشغيلي" required>
                <select value={form.operationalProjectId} onChange={e=>set('operationalProjectId',e.target.value)} required className={inputCls}>
                  <option value="">اختر المشروع</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="تاريخ الدورة" required span2>
                <DatePicker
                  selected={sDate} onChange={([s,e])=>{ set('startDate',fmtDate(s)); set('endDate',fmtDate(e)); if(s&&e) setTimeout(()=>setDateOpen(false),60); }}
                  startDate={sDate} endDate={eDate} selectsRange
                  open={dateOpen} onInputClick={()=>setDateOpen(true)} onClickOutside={()=>setDateOpen(false)}
                  shouldCloseOnSelect={false} monthsShown={2} dateFormat="yyyy-MM-dd"
                  customInput={<DateInput startDate={form.startDate} endDate={form.endDate} onClear={()=>{set('startDate','');set('endDate','');}} />}
                />
              </Field>
              <Field label="عدد المتدربين" required>
                <input type="number" min="1" value={form.numTrainees} onChange={e=>set('numTrainees',e.target.value)} required className={inputCls} />
              </Field>
            </div>
          </div>

          {/* الإعدادات التشغيلية */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-1 font-extrabold text-text-main">⚙️ الإعدادات التشغيلية</h2>
            <p className="mb-4 text-xs text-text-soft">تغيير هذه الإعدادات سيُحدِّث عناصر الإقفال المطلوبة تلقائياً</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Toggle label="يتطلب سلفة مؤقتة"           desc="طلب السلفة قبل الدورة"                checked={form.requiresAdvance}               onChange={v=>set('requiresAdvance',v)} />
              <Toggle label="يتطلب تسوية سلفة"           desc="تسوية السلفة بعد الدورة"  critical   checked={form.requiresAdvanceSettlement}     onChange={v=>set('requiresAdvanceSettlement',v)} />
              <Toggle label="يدر إيرادات مالية"          desc="رفع الإيرادات بعد الدورة"             checked={form.requiresRevenue}               onChange={v=>set('requiresRevenue',v)} />
              <Toggle label="صُرفت مواد تدريبية"          desc="إعادة المواد بعد الدورة"              checked={form.materialsIssued}               onChange={v=>set('materialsIssued',v)} />
              <Toggle label="مستحقات مشرف المشروع"       desc="رفع مستحقات المشرف"       critical   checked={form.requiresSupervisorCompensation} onChange={v=>set('requiresSupervisorCompensation',v)} />
              <Toggle label="مستحقات المدرب"             desc="رفع مستحقات المدرب"        critical   checked={form.requiresTrainerCompensation}   onChange={v=>set('requiresTrainerCompensation',v)} />
              <Toggle label="يشتمل على اختبار قبلي"      desc="تقديم الاختبار القبلي"                checked={form.requiresPreTest}               onChange={v=>set('requiresPreTest',v)} />
              <Toggle label="يشتمل على اختبار بعدي"      desc="تقديم الاختبار البعدي"                checked={form.requiresPostTest}              onChange={v=>set('requiresPostTest',v)} />
            </div>
          </div>

          {/* حفظ */}
          <div className="sticky bottom-4 z-10">
            <div className="rounded-2xl border border-border bg-white/95 p-4 shadow-deep backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-soft">{canSubmit ? '✓ جاهز للحفظ' : 'أكمل الحقول المطلوبة *'}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>router.push(`/courses/${id}`)}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-main hover:bg-background">إلغاء</button>
                  <button type="submit" disabled={!canSubmit||saving}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-extrabold text-white hover:bg-primary-dark disabled:opacity-50">
                    {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
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
