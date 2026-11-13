// =============================================================
// إعدادات التشغيل — للمدير وحده
// -------------------------------------------------------------
// الإعدادات التي تتغيّر بتغيّر الإجراء لا بتغيّر الكود: رصيد بلاغات
// العوائق، وعناوين الجهات المنتظَرة، ومهلة إدخال الدورة، وجهة صرف
// مستحقات المترجم، وممثل الجامعة في عقد الترجمة.
//
// بلا هذه الشاشة كان تغيير أيٍّ منها يحتاج مبرمجاً — وهي أمور
// إدارية بحتة يقررها المدير ويغيّرها في دقيقة.
// (تعريف الحقول وقواعد التحقق في lib/modules/config/operationalSettings)
// =============================================================
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { SlidersHorizontal, Save, Mail, ShieldAlert, Languages, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import {
  SETTING_GROUPS,
  ALL_SETTING_FIELDS,
  validateAllSettings,
  buildSettingsPayload,
} from '../lib/modules/config/operationalSettings';

const GROUP_ICON = {
  blockers: ShieldAlert,
  courses: CalendarClock,
  interpreter: Languages,
  email: Mail,
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && activeRole !== 'MANAGER') {
      toast.error('هذه الشاشة للمدير وحده');
      router.push('/');
    }
  }, [activeRole, authLoading, router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const map = res?.data?.data ?? res?.data ?? {};
      const next = {};
      for (const field of ALL_SETTING_FIELDS) next[field.key] = map[field.key] ?? '';
      setValues(next);
    } catch {
      toast.error('تعذّر تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeRole === 'MANAGER') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeRole]);

  const set = (key, value) => {
    setValues((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: '' }));
  };

  const save = async () => {
    const nextErrors = validateAllSettings(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      toast.error('راجع الحقول المعلَّمة بالأحمر');
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings', buildSettingsPayload(values));
      toast.success('حُفظت الإعدادات');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || activeRole !== 'MANAGER') return null;

  return (
    <MainLayout breadcrumb={[{ label: 'إعدادات التشغيل' }]}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h1 className="inline-flex items-center gap-2 text-lg font-extrabold text-text-main">
            <SlidersHorizontal size={20} aria-hidden="true" className="text-primary" />
            إعدادات التشغيل
          </h1>
          <p className="mt-1 text-xs text-text-soft">
            ما يتغيّر هنا يسري على المنصة فوراً، ولا يحتاج تعديلاً برمجياً ولا رفعاً جديداً.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-soft shadow-card">
            جارٍ التحميل…
          </div>
        ) : (
          <>
            {SETTING_GROUPS.map((group) => {
              const Icon = GROUP_ICON[group.key] || SlidersHorizontal;
              return (
                <div key={group.key} className="rounded-2xl border border-border bg-white p-5 shadow-card">
                  <h2 className="inline-flex items-center gap-2 font-extrabold text-text-main">
                    <Icon size={18} aria-hidden="true" className="text-primary" />
                    {group.title}
                  </h2>
                  <p className="mb-4 mt-1 text-xs text-text-soft">{group.note}</p>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {group.fields.map((field) => {
                      const error = errors[field.key];
                      const isLines = field.type === 'lines';
                      return (
                        <label key={field.key} className={`block ${isLines ? 'md:col-span-2' : ''}`}>
                          <span className="mb-1 block text-xs font-bold text-text-main">{field.label}</span>
                          {isLines ? (
                            <textarea
                              rows={4}
                              value={values[field.key] ?? ''}
                              onChange={(e) => set(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              dir="ltr"
                              className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary ${
                                error ? 'border-danger' : 'border-border'
                              }`}
                            />
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={values[field.key] ?? ''}
                              onChange={(e) => set(field.key, e.target.value)}
                              dir={field.type === 'email' ? 'ltr' : undefined}
                              className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary ${
                                error ? 'border-danger' : 'border-border'
                              }`}
                            />
                          )}
                          {error
                            ? <span className="mt-1 block text-[11px] font-bold text-danger">{error}</span>
                            : field.hint && <span className="mt-1 block text-[11px] text-text-soft">{field.hint}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="sticky bottom-4 z-10">
              <div className="rounded-2xl border border-border bg-white/95 p-4 shadow-deep backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-text-soft">يُحفظ كل ما في الشاشة دفعة واحدة.</p>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                  >
                    <Save size={16} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
