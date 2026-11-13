// =============================================================
// بطاقة بيانات مترجم الدورة
// -------------------------------------------------------------
// تُعبَّأ مرة واحدة، فتبني مستندات المترجم الأربعة كلها: العقد،
// وطلب الصرف بالتحويل، ونموذج الاستحقاق، وشهادة إنجاز الترجمة.
// فلا يُكتب الاسم ورقم الهوية في كل مستند على حدة، ولا يختلف اسم
// بين مستند وآخر.
//
// وبيانات البرنامج (اسمه ورقمه وتاريخه ومقر تنفيذه) لا تُدخَل هنا
// إطلاقاً — تُقرأ من الدورة نفسها.
// =============================================================
import { useCallback, useEffect, useState } from 'react';
import { Languages, Pencil, Save, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

const TYPE_LABELS = {
  CONTRACT: 'مترجم بعقد',
  TRANSFER: 'مترجم بتحويل',
  ADVANCE: 'مترجم بسلفة',
};

const TYPE_OUTPUT = {
  CONTRACT: 'المطلوب: عقد ترجمة يُصدَّر من عنصر «عقد مترجم الدورة».',
  TRANSFER: 'المطلوب: رسالة طلب صرف مستحقات تُصدَّر من عنصر «طلب صرف مستحقات المترجم».',
  ADVANCE: 'المطلوب: نموذج استحقاق يُصدَّر من عنصر «نموذج استحقاق مترجم الدورة».',
};

const EMPTY = {
  fullName: '', nationalId: '', email: '', mobile: '', address: '', amount: '', notes: '',
};

function Field({ label, value, onChange, placeholder, type = 'text', hint, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-text-main">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
      />
      {hint && <span className="mt-1 block text-[11px] text-text-soft">{hint}</span>}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2 border-b border-border/60 py-1.5 last:border-0">
      <span className="w-36 shrink-0 text-xs font-bold text-text-soft">{label}</span>
      <span className="text-sm text-text-main">{value || '—'}</span>
    </div>
  );
}

export default function InterpreterCard({ courseId, canEdit, onSaved }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/courses/${courseId}/interpreter`);
      const payload = res?.data?.data ?? res?.data;
      setState(payload);
      if (payload?.interpreter) {
        setForm({
          fullName: payload.interpreter.fullName || '',
          nationalId: payload.interpreter.nationalId || '',
          email: payload.interpreter.email || '',
          mobile: payload.interpreter.mobile || '',
          address: payload.interpreter.address || '',
          amount: payload.interpreter.amount != null ? String(payload.interpreter.amount) : '',
          notes: payload.interpreter.notes || '',
        });
      }
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/courses/${courseId}/interpreter`, form);
      toast.success('حُفظت بيانات المترجم');
      setEditing(false);
      await load();
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر حفظ بيانات المترجم');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !state || !state.requiresInterpreter) return null;

  const { interpreter, contractType } = state;
  const showForm = editing || !interpreter;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-extrabold text-text-main">
          <Languages size={18} aria-hidden="true" className="text-primary" />
          بيانات مترجم الدورة
        </h2>
        <div className="flex items-center gap-2">
          {contractType && (
            <span className="rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-bold text-primary">
              {TYPE_LABELS[contractType] || contractType}
            </span>
          )}
          {interpreter && !editing && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-forest-50 px-3 py-1 text-xs font-bold text-accent">
              <Check size={13} aria-hidden="true" /> مكتملة
            </span>
          )}
        </div>
      </div>

      <p className="mb-4 text-xs text-text-soft">
        تُعبَّأ مرة واحدة وتُبنى منها مستندات المترجم كلها.
        {contractType ? ` ${TYPE_OUTPUT[contractType] || ''}` : ''}
        {' '}وبيانات البرنامج تُؤخذ من الدورة تلقائياً.
      </p>

      {showForm ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="اسم المترجم رباعياً" value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="كما في الهوية" required />
            <Field label="رقم الهوية الوطنية" value={form.nationalId} onChange={(v) => set('nationalId', v)} placeholder="عشرة أرقام" required />
            <Field label="البريد الإلكتروني" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="name@example.com" required />
            <Field label="رقم الجوال" value={form.mobile} onChange={(v) => set('mobile', v)} placeholder="05xxxxxxxx" required />
            <Field label="العنوان" value={form.address} onChange={(v) => set('address', v)} placeholder="المدينة — الحي" required />
            <Field
              label="قيمة المستحق (ريال)"
              value={form.amount}
              onChange={(v) => set('amount', v)}
              placeholder="اختياري"
              hint="يظهر في طلب الصرف ونموذج الاستحقاق"
            />
            <div className="md:col-span-2">
              <Field label="ملاحظات" value={form.notes} onChange={(v) => set('notes', v)} placeholder="اختياري" />
            </div>
          </div>

          {canEdit && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
              </button>
              {interpreter && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); load(); }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold text-text-soft transition hover:text-text-main"
                >
                  <X size={15} aria-hidden="true" /> إلغاء
                </button>
              )}
            </div>
          )}

          {!canEdit && (
            <p className="mt-3 text-xs text-text-soft">بيانات المترجم يعبّئها منسق الدورة.</p>
          )}
        </>
      ) : (
        <>
          <Row label="الاسم" value={interpreter.fullName} />
          <Row label="رقم الهوية" value={interpreter.nationalId} />
          <Row label="البريد الإلكتروني" value={interpreter.email} />
          <Row label="رقم الجوال" value={interpreter.mobile} />
          <Row label="العنوان" value={interpreter.address} />
          <Row
            label="قيمة المستحق"
            value={interpreter.amount != null ? `${Number(interpreter.amount).toLocaleString('ar-SA')} ريال` : null}
          />
          {interpreter.notes && <Row label="ملاحظات" value={interpreter.notes} />}

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary transition hover:text-primary-dark"
            >
              <Pencil size={14} aria-hidden="true" /> تعديل البيانات
            </button>
          )}
        </>
      )}
    </div>
  );
}
