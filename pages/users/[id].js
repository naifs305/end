import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import useAuth from '../../context/AuthContext';
import { ArrowLeft, User, Search, Star, BarChart3, KeyRound, ChevronUp, ChevronDown, Trash2, Camera, Handshake } from 'lucide-react';
import ConfirmModal from '../../components/operational/ConfirmModal';
import { useTranslation } from '../../lib/i18n';
import Avatar from '../../components/shared/Avatar';
import { isAcceptableImageFile, fileToAvatarDataUrl } from '../../lib/clientImage';

// تكوين الأدوار — الأيقونات هنا، التسميات من roles.* والأوصاف من admin.users.*
const ROLE_CFG = [
  { key: 'EMPLOYEE',           Icon: User,      descKey: 'admin.users.roleEmployeeDesc' },
  { key: 'PROJECT_SUPERVISOR', Icon: Search,    descKey: 'admin.users.roleSupervisorDesc' },
  { key: 'MANAGER',            Icon: Star,      descKey: 'admin.users.roleManagerDesc' },
  { key: 'QUALITY_VIEWER',     Icon: BarChart3, descKey: 'admin.users.roleQualityDesc' },
];

export default function EditUser() {
  const router = useRouter();
  const { id }  = router.query;
  const { user: currentUser, activeRole } = useAuth();
  const isManager = activeRole === 'MANAGER';
  const { t } = useTranslation();

  const [user,     setUser]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [newPass,  setNewPass]  = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [supervisors, setSupervisors] = useState([]);

  // صورة المستخدم: يضعها المدير هنا، أو صاحبها من ملفه الشخصي.
  // تُصغَّر قبل الحفظ فتظهر في بطاقات الدورات دون أن تُثقلها.
  const savePhoto = async (file) => {
    if (!file) return;
    if (file !== 'remove' && !isAcceptableImageFile(file)) { toast.error('اختر ملف صورة'); return; }
    setSavingPhoto(true);
    try {
      const profileImage = file === 'remove' ? null : await fileToAvatarDataUrl(file);
      await api.put(`/users/${id}`, { profileImage });
      setUser((u) => ({ ...u, profileImage }));
      toast.success(profileImage ? 'حُفظت الصورة' : 'أُزيلت الصورة');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر حفظ الصورة');
    } finally {
      setSavingPhoto(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get(`/users/${id}`), api.get('/projects'), api.get('/users').catch(() => ({ data: [] }))])
      .then(([ur, pr, all]) => {
        setUser(ur.data);
        const d = pr.data;
        setProjects(Array.isArray(d) ? d : d?.data || []);
        const list = Array.isArray(all.data) ? all.data : all.data?.data || [];
        setSupervisors(list.filter((u) => u.isActive && (u.roles || []).includes('PROJECT_SUPERVISOR')));
      })
      .catch(() => toast.error(t('admin.users.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  // حذف الحساب — يتحول تلقائياً إلى تعطيل إن كان للموظف دورات مرتبطة
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/users/${id}`);
      toast.success(res.data?.message || t('admin.users.deleted'));
      router.replace('/users');
    } catch (err) {
      toast.error(err?.response?.data?.message || t('common.error'));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${id}`, {
        firstName:           user.firstName,
        lastName:            user.lastName,
        roles:               user.roles,
        isActive:            user.isActive,
        operationalProjectId:user.isCollaborator ? null : user.operationalProjectId,
        ...(isManager ? {
          isCollaborator:      !!user.isCollaborator,
          followUpSupervisorId:user.isCollaborator ? (user.followUpSupervisorId || null) : null,
        } : {}),
      });
      if (currentUser?.id === id) {
        try {
          const r = await api.get('/auth/refresh');
          if (r.data?.access_token) {
            const store = localStorage.getItem('token') ? localStorage : sessionStorage;
            store.setItem('token', r.data.access_token);
            store.setItem('cachedUser', JSON.stringify(r.data.user));
            toast.success(t('admin.users.savedRolesUpdated'));
            setTimeout(() => window.location.reload(), 1200);
            return;
          }
        } catch {}
      }
      toast.success(t('admin.users.savedChanges'));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPass.trim() || newPass.length < 6) { toast.error(t('admin.users.passwordTooShort')); return; }
    setSavingPw(true);
    try {
      await api.put(`/users/${id}/reset-password`, { password: newPass });
      toast.success(t('admin.users.passwordChanged'));
      setNewPass('');
      setShowPw(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('admin.users.passwordChangeFailed'));
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
        {t('admin.users.userNotFound')}
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
              <div className="relative">
                <Avatar user={user} size={64} className={user.isActive ? '' : 'opacity-50'} />
                {isManager && (
                  <label className="absolute -bottom-1 -end-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-primary text-white shadow-md hover:bg-primary-dark" title="تغيير الصورة">
                    <Camera size={14} aria-hidden="true" />
                    <span className="sr-only">تغيير الصورة</span>
                    <input type="file" accept="image/*,.heic,.heif" className="hidden" disabled={savingPhoto}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; savePhoto(f); }} />
                  </label>
                )}
              </div>
              <div>
                <h1 className="font-extrabold text-primary">{user.firstName} {user.lastName}</h1>
                <p className="text-xs text-text-soft">{user.email}</p>
                {isManager && user.profileImage && (
                  <button type="button" onClick={() => savePhoto('remove')} disabled={savingPhoto}
                    className="mt-1 text-[11px] font-bold text-danger hover:underline">إزالة الصورة</button>
                )}
              </div>
            </div>
            <button onClick={() => router.back()}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">
              <ArrowLeft size={15} aria-hidden="true" /> {t('common.back')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* البيانات الشخصية */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-4 font-extrabold text-text-main">{t('admin.users.personalInfo')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-text-main">{t('admin.users.firstName')}</label>
                <input className={inputCls} value={user.firstName||''} onChange={e=>setUser({...user,firstName:e.target.value})} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-text-main">{t('admin.users.lastName')}</label>
                <input className={inputCls} value={user.lastName||''} onChange={e=>setUser({...user,lastName:e.target.value})} />
              </div>
              {isManager && (
                <label className={`col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${user.isCollaborator ? 'border-accent/50 bg-sand/10' : 'border-border bg-background'}`}>
                  <input type="checkbox" checked={!!user.isCollaborator}
                    onChange={e=>setUser({...user,isCollaborator:e.target.checked})}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                  <Handshake size={20} aria-hidden="true" className={user.isCollaborator ? 'text-warning' : 'text-text-soft'} />
                  <span>
                    <span className="block text-sm font-bold text-text-main">منسق متعاون</span>
                    <span className="block text-[11px] text-text-soft">من خارج موظفي العمليات: لا ينتمي لمشروع، ومرجعه المدير، ويُسند متابعته لمشرف.</span>
                  </span>
                </label>
              )}
              {user.isCollaborator ? (
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-text-main">المشرف المتابع</label>
                  <select className={inputCls} value={user.followUpSupervisorId||''} disabled={!isManager}
                    onChange={e=>setUser({...user,followUpSupervisorId:e.target.value||null})}>
                    <option value="">المدير وحده</option>
                    {supervisors.filter(s=>s.id!==id).map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-text-soft">يعتمد عناصر دوراته ويتابعها، بدل مشرف مشروع الدورة.</p>
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-text-main">{t('admin.users.operationalProject')}</label>
                  <select className={inputCls} value={user.operationalProjectId||''} onChange={e=>setUser({...user,operationalProjectId:e.target.value})}>
                    <option value="">{t('admin.users.selectProject')}</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-text-main">{t('admin.users.statusLabel')}</label>
                <div className="flex gap-2">
                  {[{v:true,l:t('admin.common.active'),c:'border-accent/40 bg-forest-50 text-accent'},{v:false,l:t('admin.common.inactive'),c:'border-burgundy/30 bg-burgundy/5 text-danger'}].map(o=>(
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
            <h2 className="mb-1 font-extrabold text-text-main">{t('admin.users.rolesTitle')}</h2>
            <p className="mb-3 text-[11px] text-text-soft">{t('admin.users.rolesHint')}</p>
            <div className="space-y-2">
              {ROLE_CFG.map(r => {
                const active = (user.roles||[]).includes(r.key);
                const RIcon = r.Icon;
                return (
                  <label key={r.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition
                      ${active ? 'border-primary/30 bg-primary-light/50' : 'border-border bg-background hover:border-primary/20'}`}>
                    <input type="checkbox" checked={active} onChange={e=>toggleRole(r.key,e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                    <RIcon size={20} aria-hidden="true" className={active ? 'text-primary' : 'text-text-soft'} />
                    <div>
                      <div className={`text-sm font-bold ${active?'text-primary':'text-text-main'}`}>{t(`roles.${r.key}`)}</div>
                      <div className="text-[10px] text-text-soft">{t(r.descKey)}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* حفظ */}
          <button type="submit" disabled={saving}
            className="w-full rounded-2xl bg-primary py-3 font-extrabold text-white hover:bg-primary-dark disabled:opacity-60">
            {saving ? t('common.saving') : t('admin.users.saveChanges')}
          </button>
        </form>

        {/* تغيير كلمة المرور */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <button type="button" onClick={()=>setShowPw(v=>!v)}
            className="flex w-full items-center justify-between text-sm font-bold text-text-main">
            <span className="inline-flex items-center gap-1.5"><KeyRound size={16} aria-hidden="true" /> {t('admin.users.changePassword')}</span>
            {showPw
              ? <ChevronUp size={16} aria-hidden="true" className="text-text-soft" />
              : <ChevronDown size={16} aria-hidden="true" className="text-text-soft" />}
          </button>
          {showPw && (
            <div className="mt-3 space-y-2">
              <input type="password" autoComplete="off" value={newPass} onChange={e=>setNewPass(e.target.value)}
                placeholder={t('admin.users.newPasswordPlaceholder')}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={handleResetPassword} disabled={savingPw||!newPass.trim()}
                className="w-full rounded-xl bg-forest-700 py-2.5 text-sm font-bold text-white hover:bg-forest-800 disabled:opacity-50">
                {savingPw ? t('admin.users.changingPassword') : t('admin.users.changePassword')}
              </button>
            </div>
          )}
        </div>

        {/* حذف الحساب — للمدير فقط، ولا يظهر لحساب المستخدم نفسه */}
        {isManager && currentUser?.id !== id && (
          <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-5">
            <h2 className="mb-1 inline-flex items-center gap-1.5 font-extrabold text-danger">
              <Trash2 size={16} aria-hidden="true" /> {t('admin.users.deleteAccount')}
            </h2>
            <p className="mb-3 text-xs leading-6 text-text-soft">{t('admin.users.deleteAccountHint')}</p>
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={deleting}
              className="rounded-xl border border-burgundy/30 bg-white px-4 py-2.5 text-sm font-bold text-danger transition hover:bg-burgundy/10 disabled:opacity-50">
              {deleting ? t('common.saving') : t('admin.users.deleteAccount')}
            </button>
          </div>
        )}

      </div>

      <ConfirmModal
        open={confirmDelete}
        title={t('admin.users.deleteAccount')}
        message={t('admin.users.deleteConfirm', { name: `${user.firstName || ''} ${user.lastName || ''}`.trim() })}
        confirmLabel={t('common.delete')}
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </MainLayout>
  );
}
