import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';

const TYPE_LABELS = {
  MANDATORY: 'إجباري',
  CONDITIONAL: 'مشروط',
  OPTIONAL: 'اختياري',
};

const TYPE_META = {
  MANDATORY:   { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  CONDITIONAL: { bg: 'bg-sand/20',    text: 'text-warning', border: 'border-sand/40' },
  OPTIONAL:    { bg: 'bg-background', text: 'text-text-soft', border: 'border-border' },
};

const CONDITION_FIELD_OPTIONS = [
  { value: 'requiresAdvance', label: 'تتطلب سلفة مؤقتة' },
  { value: 'requiresRevenue', label: 'تتطلب إيرادات مالية' },
  { value: 'materialsIssued', label: 'مواد تدريبية مُعارة' },
  { value: 'requiresAdvanceSettlement', label: 'تتطلب تسوية سلفة' },
  { value: 'requiresSupervisorCompensation', label: 'تتطلب مستحقات مشرف' },
  { value: 'requiresTrainerCompensation', label: 'تتطلب مستحقات مدرب' },
  { value: 'requiresPreTest', label: 'تتطلب اختبار قبلي' },
  { value: 'requiresPostTest', label: 'تتطلب اختبار بعدي' },
  { value: 'requiresOpeningReport', label: 'تتطلب تقرير افتتاح' },
  { value: 'requiresClosingReport', label: 'تتطلب تقرير اختتام' },
];

const CONDITION_FIELD_LABELS = CONDITION_FIELD_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label;
  return acc;
}, {});

export default function ClosureElementsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [elementType, setElementType] = useState('MANDATORY');
  const [conditionField, setConditionField] = useState(CONDITION_FIELD_OPTIONS[0].value);
  const [isFormBased, setIsFormBased] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || activeRole !== 'MANAGER')) router.replace('/');
  }, [authLoading, user, activeRole, router]);

  useEffect(() => {
    if (user && activeRole === 'MANAGER') load();
  }, [user, activeRole]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/closure-elements');
      setElements(res.data || []);
    } catch {
      toast.error('تعذر تحميل عناصر التقديم');
    } finally {
      setLoading(false);
    }
  };

  const createElement = async () => {
    if (!name.trim()) return toast.error('اسم العنصر مطلوب');
    setSaving(true);
    try {
      await api.post('/closure-elements', {
        name: name.trim(),
        elementType,
        conditionField: elementType === 'CONDITIONAL' ? conditionField : undefined,
        isFormBased,
      });
      toast.success('تم إنشاء العنصر وإضافته للدورات المفتوحة');
      setName('');
      setElementType('MANDATORY');
      setIsFormBased(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذر إنشاء العنصر');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (el) => {
    const verb = el.isActive ? 'تعطيل' : 'تفعيل';
    if (!window.confirm(`${verb} عنصر "${el.name}"؟`)) return;
    try {
      await api.patch(`/closure-elements/${el.id}`, { isActive: !el.isActive });
      toast.success(`تم ${verb} العنصر`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذر التحديث');
    }
  };

  if (authLoading || !user) return null;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <h1 className="text-xl font-extrabold text-primary">عناصر التقديم</h1>
          <p className="mt-0.5 text-xs text-text-soft">
            إدارة كتالوج عناصر الإقفال المطلوبة من المنسقين — إجبارية، مشروطة بحقول الدورة، أو اختيارية.
            العناصر الجديدة تُضاف تلقائياً إلى كل الدورات المفتوحة حالياً.
          </p>
        </div>

        {/* إنشاء عنصر جديد */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-extrabold text-text-main">➕ إضافة عنصر جديد</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="اسم العنصر"
              className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary lg:col-span-2" />

            <select value={elementType} onChange={(e) => setElementType(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="MANDATORY">إجباري لكل الدورات</option>
              <option value="CONDITIONAL">مشروط بحقل في الدورة</option>
              <option value="OPTIONAL">اختياري (يفعّله المنسق)</option>
            </select>

            {elementType === 'CONDITIONAL' ? (
              <select value={conditionField} onChange={(e) => setConditionField(e.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                {CONDITION_FIELD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-soft">
                <input type="checkbox" checked={isFormBased} onChange={(e) => setIsFormBased(e.target.checked)} />
                يتطلب تعبئة نموذج
              </label>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={createElement} disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50">
              {saving ? 'جاري الإنشاء...' : 'إنشاء العنصر'}
            </button>
          </div>
        </div>

        {/* قائمة العناصر */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-10 text-text-soft shadow-card">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">جاري التحميل...</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-right text-xs font-extrabold text-text-soft">
                  <th className="px-4 py-3">العنصر</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الشرط</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el) => {
                  const meta = TYPE_META[el.elementType] || TYPE_META.MANDATORY;
                  return (
                    <tr key={el.id} className={`border-b border-border last:border-0 ${!el.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-bold text-text-main">
                        {el.name}
                        {el.isCustom && (
                          <span className="mr-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">مخصص</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text} ${meta.border}`}>
                          {TYPE_LABELS[el.elementType] || el.elementType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-soft">
                        {el.conditionField ? (CONDITION_FIELD_LABELS[el.conditionField] || el.conditionField) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${el.isActive ? 'bg-success/10 text-success' : 'bg-burgundy/10 text-danger'}`}>
                          {el.isActive ? 'مفعّل' : 'معطّل'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <button onClick={() => toggleActive(el)}
                          className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-background">
                          {el.isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
