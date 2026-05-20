import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import useAuth from '../../context/AuthContext';

const ROLE_CFG = [
  { key:'EMPLOYEE',           label:'منسق (موظف)',        icon:'👤', desc:'ينفّذ الدورات ويرفع العناصر' },
  { key:'PROJECT_SUPERVISOR', label:'مشرف مشروع',          icon:'🔍', desc:'يعتمد عناصر دورات مشروعه' },
  { key:'MANAGER',            label:'مدير',                icon:'⭐', desc:'صلاحيات كاملة + KPI' },
  { key:'QUALITY_VIEWER',     label:'مراقب الجودة',        icon:'📊', desc:'قراءة التقارير فقط' },
];

export default function EditUser() {
  const router = useRouter();
  const { id }  = router.query;
  const { user: currentUser } = useAuth();

  const [user,     setUser]     = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [newPass,  setNewPass]  = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get(`/users/${id}`), api.get('/projects')])
      .then(([ur, pr]) => {
        setUser(ur.data);
        const d = pr.data;
        setProjects(Array.isArray(d) ? d : d?.data || []);
      })
      .catch(() => toast.error('تعذر التحميل'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${id}`, {
        firstName:           user.firstName,
        lastName:            user.lastName,
        roles:               user.roles,
        isActive:            user.isActive,
        operationalProjectId:user.operationalProjectId,
      });
      if (currentUser?.id === id) {
        try {
          const r = await api.get('/auth/refresh');
          if (r.data?.access_token) {
            const store = localStorage.getItem('token') ? localStorage : sessionStorage;
            store.setItem('token', r.data.access_token);
            store.setItem('cachedUser', JSON.stringify(r.data.user));
            toast.success('تم الحفظ — الأدوار محدَّثة ✓');
            setTimeout(() => window.location.reload(), 1200);
            return;
          }
        } catch {}
      }
      toast.success('تم حفظ التعديلات ✓');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPass.trim() || newPass.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setSavingPw(true);
    try {
      await api.put(`/users/${id}/reset-password`, { password: newPass });
      toast.success('تم تغيير كلمة المرور ✓');
      setNewPass('');
      setShowPw(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'فشل التغيير');
    } finally { setSavingPw(false); }
  };

  const toggleRole = (key, checked) => {
    const roles = checked
      ? [...new Set([...(user.roles||[]), key])]
      : (user.roles||[]).filter(r => r !== key);
    setUser({ ...user, roles });
  };

  const inputCls = 'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';

  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </MainLayout>
  );

  if (!user) return (
    <MainLayout>
      <div className="rounded-2xl border border-danger/20 bg-white p-6 text-danger shadow-card">
        المستخدم غير موجود
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div className="mx-auto max-w-xl space-y-4">

        {/* رأس */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white ${user.isActive ? 'bg-primary' : 'bg-slate-300'}`}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div>
                <h1 className="font-extrabold text-primary">{user.firstName} {user.lastName}</h1>
                <p className="text-xs text-text-soft">{user.email}</p>
              </div>
            </div>
            <button onClick={() => router.back()}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">
              ← رجوع
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* البيانات الشخصية */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-4 font-extrabold text-text-main">البيانات الشخصية</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-text-main">الاسم الأول</label>
                <input className={inputCls} value={user.firstName||''} onChange={e=>setUser({...user,firstName:e.target.value})} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-text-main">الاسم الأخير</label>
                <input className={inputCls} value={user.lastName||''} onChange={e=>setUser({...user,lastName:e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-text-main">المشروع التشغيلي</label>
                <select className={inputCls} value={user.operationalProjectId||''} onChange={e=>setUser({...user,operationalProjectId:e.target.value})}>
                  <option value="">اختر المشروع</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-text-main">الحالة</label>
                <div className="flex gap-2">
                  {[{v:true,l:'نشط',c:'border-accent/40 bg-forest-50 text-accent'},{v:false,l:'معطل',c:'border-burgundy/30 bg-burgundy/5 text-danger'}].map(o=>(
                    <button key={String(o.v)} type="button" onClick={()=>setUser({...user,isActive:o.v})}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${user.isActive===o.v ? o.c : 'border-border bg-background text-text-soft hover:bg-background'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* الأدوار */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-1 font-extrabold text-text-main">الأدوار والصلاحيات</h2>
            <p className="mb-3 text-[11px] text-text-soft">المستخدم يمكن أن يحمل أكثر من دور — المدير هو من يمنح الأدوار</p>
            <div className="space-y-2">
              {ROLE_CFG.map(r => {
                const active = (user.roles||[]).includes(r.key);
                return (
                  <label key={r.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition
                      ${active ? 'border-primary/30 bg-primary-light/50' : 'border-border bg-background hover:border-primary/20'}`}>
                    <input type="checkbox" checked={active} onChange={e=>toggleRole(r.key,e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-lg">{r.icon}</span>
                    <div>
                      <div className={`text-sm font-bold ${active?'text-primary':'text-text-main'}`}>{r.label}</div>
                      <div className="text-[10px] text-text-soft">{r.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* حفظ */}
          <button type="submit" disabled={saving}
            className="w-full rounded-2xl bg-primary py-3 font-extrabold text-white hover:bg-primary-dark disabled:opacity-60">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>

        {/* تغيير كلمة المرور */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <button type="button" onClick={()=>setShowPw(v=>!v)}
            className="flex w-full items-center justify-between text-sm font-bold text-text-main">
            <span>🔑 تغيير كلمة المرور</span>
            <span className="text-text-soft">{showPw?'▲':'▼'}</span>
          </button>
          {showPw && (
            <div className="mt-3 space-y-2">
              <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)}
                placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={handleResetPassword} disabled={savingPw||!newPass.trim()}
                className="w-full rounded-xl bg-forest-700 py-2.5 text-sm font-bold text-white hover:bg-forest-800 disabled:opacity-50">
                {savingPw ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
              </button>
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
