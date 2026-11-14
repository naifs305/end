// ======================================================================
// سجل المترجمين — للمدير
// ----------------------------------------------------------------------
// قاعدة المترجمين التي يختار منها المنسق مترجم دورته. يضيف المدير
// ويعدّل ويحذف، ويدخلها تلقائياً كل مترجم جديد يسجّله منسق.
// والحذف من السجل لا يمسّ بيانات الدورات ولا مستنداتها.
// ======================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { Languages, Plus, Pencil, Trash2, Search, Upload, X, Save } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import ConfirmModal from '../components/operational/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';

const EMPTY = {
  fullName: '', nationalId: '', nationality: '', mobile: '', email: '', address: '',
  specialty: '', bankName: '', bankBranch: '', bankCountry: '', iban: '', notes: '',
};

const unwrap = (res) => res?.data?.data ?? res?.data;

function Field({ label, value, onChange, placeholder, required, wide, dir }) {
  return (
    <label className={`block ${wide ? 'md:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-bold text-text-main">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <input
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}

export default function InterpretersPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const isManager = activeRole === 'MANAGER';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | interpreter
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!authLoading && (!user || !isManager)) router.replace('/');
  }, [authLoading, user, isManager, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(unwrap(await api.get('/interpreters')) || []);
    } catch {
      toast.error('تعذّر تحميل سجل المترجمين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user && isManager) load(); }, [user, isManager, load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.fullName, i.nationalId, i.mobile, i.email, i.bankName].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, search]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (i) => {
    setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, i[k] || ''])));
    setEditing(i);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/interpreters', form);
      else await api.put(`/interpreters/${editing.id}`, form);
      toast.success(editing === 'new' ? 'أُضيف المترجم' : 'حُفظت التعديلات');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/interpreters/${toDelete.id}`);
      toast.success('حُذف المترجم من السجل');
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر الحذف');
    } finally {
      setDeleting(false);
    }
  };

  // استيراد ملف بقائمة المترجمين (JSON) — الموجود بالهوية يُحدَّث والجديد يُضاف
  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed.interpreters;
      const r = unwrap(await api.post('/interpreters/import', { interpreters: list }));
      toast.success(`أُضيف ${r.added} وحُدّث ${r.updated}${r.failed.length ? ` · لم يُقبل ${r.failed.length}` : ''}`);
      if (r.failed.length) r.failed.forEach((f) => toast.error(`${f.name}: ${f.reason}`));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'الملف غير صالح');
    }
  };

  if (!isManager) return null;

  return (
    <MainLayout breadcrumb={[{ label: 'المترجمون' }]}>
      <div className="space-y-5">
        {/* ── الرأس ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-text-main">
              <Languages size={22} aria-hidden="true" className="text-primary" /> المترجمون
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-forest-50 px-2 text-sm text-primary">{items.length}</span>
            </h1>
            <p className="mt-1 text-sm text-text-soft">السجل الذي يختار منه المنسق مترجم دورته. البيانات الثابتة وحدها، والمبلغ والمدة مكانهما الدورة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold text-text-soft transition hover:bg-white hover:text-primary">
              <Upload size={15} aria-hidden="true" /> استيراد من ملف
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
            <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(46,96,102,0.85)] transition hover:bg-primary-dark">
              <Plus size={16} aria-hidden="true" /> إضافة مترجم
            </button>
          </div>
        </div>

        {/* ── البحث ── */}
        <label className="relative block max-w-md">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهوية أو الجوال"
            aria-label="بحث في المترجمين"
            className="w-full rounded-full border border-border bg-white py-2.5 pe-4 ps-9 text-sm outline-none focus:border-primary"
          />
        </label>

        {/* ── القائمة ── */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : shown.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-border bg-white py-12 text-center text-sm text-text-soft">
            {items.length ? 'لا نتائج للبحث' : 'لا مترجمين بعد — أضف أول مترجم أو استورد ملفاً'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((i) => (
              <article key={i.id} className="overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_1px_2px_rgba(28,46,48,0.05),0_10px_28px_-16px_rgba(28,46,48,0.22)]">
                <div className="flex items-start gap-3 px-5 pb-4 pt-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest-50 text-lg font-extrabold text-primary">
                    {i.fullName.trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-extrabold leading-snug text-text-main">{i.fullName}</h2>
                    <p className="mt-0.5 text-[12px] text-text-soft">
                      {[i.nationality, i.specialty].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {i._count?.courses > 0 && (
                    <span className="shrink-0 rounded-full bg-sand/15 px-2.5 py-1 text-[11px] font-bold text-warning">{i._count.courses} دورة</span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pb-4 text-[12px]">
                  <div><dt className="text-text-soft">الهوية</dt><dd className="text-right font-bold text-text-main" dir="ltr">{i.nationalId}</dd></div>
                  <div><dt className="text-text-soft">الجوال</dt><dd className="text-right font-bold text-text-main" dir="ltr">{i.mobile}</dd></div>
                  <div className="col-span-2"><dt className="text-text-soft">البريد</dt><dd className="truncate text-right font-bold text-text-main" dir="ltr">{i.email}</dd></div>
                  <div className="col-span-2"><dt className="text-text-soft">{i.bankName || 'البنك'}</dt><dd className="truncate text-right font-bold text-text-main" dir="ltr">{i.iban || '—'}</dd></div>
                </dl>
                <div className="flex items-center gap-1 border-t border-border bg-background px-4 py-3">
                  <button type="button" onClick={() => openEdit(i)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-[13px] font-bold text-white transition hover:bg-primary-dark">
                    <Pencil size={14} aria-hidden="true" /> تعديل
                  </button>
                  <button type="button" onClick={() => setToDelete(i)} className="ms-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-danger transition hover:bg-white">
                    <Trash2 size={14} aria-hidden="true" /> حذف
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ── نافذة الإضافة والتعديل ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="int-form-title">
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-[20px] border border-border bg-white shadow-deep">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 id="int-form-title" className="text-lg font-extrabold text-text-main">{editing === 'new' ? 'إضافة مترجم' : 'تعديل بيانات المترجم'}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="إغلاق" className="rounded-full p-2 text-text-soft hover:bg-background"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
              <Field label="الاسم رباعياً" value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="كما في الهوية" required wide />
              <Field label="رقم الهوية" value={form.nationalId} onChange={(v) => set('nationalId', v)} placeholder="عشرة أرقام" required dir="ltr" />
              <Field label="الجنسية" value={form.nationality} onChange={(v) => set('nationality', v)} placeholder="سعودي" />
              <Field label="الجوال" value={form.mobile} onChange={(v) => set('mobile', v)} placeholder="05xxxxxxxx" required dir="ltr" />
              <Field label="البريد الإلكتروني" value={form.email} onChange={(v) => set('email', v)} placeholder="name@example.com" required dir="ltr" />
              <Field label="العنوان" value={form.address} onChange={(v) => set('address', v)} placeholder="المملكة العربية السعودية" required />
              <Field label="التخصص" value={form.specialty} onChange={(v) => set('specialty', v)} placeholder="ترجمة فورية عربي ↔ إنجليزي" />
              <Field label="البنك" value={form.bankName} onChange={(v) => set('bankName', v)} placeholder="مصرف الراجحي" />
              <Field label="الفرع" value={form.bankBranch} onChange={(v) => set('bankBranch', v)} placeholder="اختياري" />
              <Field label="رقم الآيبان" value={form.iban} onChange={(v) => set('iban', v)} placeholder="SA0000000000000000000000" wide dir="ltr" />
              <Field label="ملاحظات" value={form.notes} onChange={(v) => set('notes', v)} placeholder="اختياري" wide />
            </div>
            <div className="flex items-center gap-1 border-t border-border bg-background px-5 py-3">
              <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
                <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center rounded-full px-4 py-2 text-[13px] font-bold text-text-soft hover:bg-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="حذف المترجم من السجل"
        message={toDelete ? `سيُحذف «${toDelete.fullName}» من السجل. بيانات الدورات ومستنداتها تبقى كما هي.` : ''}
        confirmLabel="حذف"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </MainLayout>
  );
}
