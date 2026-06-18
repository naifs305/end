import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { Plus, UserPlus, ChevronUp, ChevronDown, AlertTriangle, Trash2 } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import ConfirmModal from '../components/operational/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { canManageProjects } from '../lib/roles';
import { useTranslation } from '../lib/i18n';

// ======================================================================
// الهيكل التنظيمي للمشاريع
// ======================================================================
// كل مشروع تشغيلي يضم:
//   • مشرف مشروع  — يعتمد عناصر الإقفال لدورات مشروعه
//   • منسقون       — ينفّذون الدورات ويرفعون العناصر
//
// ملاحظة: المنسق يمكن أن يعمل في دورات مشروع آخر (تغطية)
// في هذه الحالة يعتمد عناصره مشرف المشروع الذي تنتمي إليه الدورة
// (مشرف الدورة = مشرف مشروع الدورة — وليس مشرف مشروع المنسق)

export default function ProjectsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [newProjectName,   setNewProjectName]   = useState('');
  const [selectedProject,  setSelectedProject]  = useState('');
  const [selectedUser,     setSelectedUser]      = useState('');
  const [expandedProject,  setExpandedProject]  = useState(null);
  const [confirmState,     setConfirmState]     = useState(null);
  const [busy,             setBusy]             = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !canManageProjects(activeRole))) router.replace('/');
  }, [authLoading, user, activeRole, router]);

  useEffect(() => {
    if (user && canManageProjects(activeRole)) load();
  }, [user, activeRole]);

  const load = async () => {
    setLoading(true);
    try {
      const [pr, ur] = await Promise.all([api.get('/projects'), api.get('/users')]);
      setProjects(pr.data || []);
      const d = ur.data;
      setUsers(Array.isArray(d) ? d : d?.data || []);
    } catch { toast.error(t('admin.common.loadFailed')); }
    finally { setLoading(false); }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return toast.error(t('admin.projects.nameRequired'));
    try {
      await api.post('/projects', { name: newProjectName.trim() });
      setNewProjectName('');
      toast.success(t('admin.projects.created'));
      load();
    } catch (e) { toast.error(e.response?.data?.message || t('admin.projects.createFailed')); }
  };

  const assignSupervisor = async () => {
    if (!selectedProject || !selectedUser) return toast.error(t('admin.projects.selectBoth'));
    try {
      await api.post('/supervisors/assign', { userId: selectedUser, operationalProjectId: selectedProject });
      setSelectedProject(''); setSelectedUser('');
      toast.success(t('admin.projects.assigned'));
      load();
    } catch (e) { toast.error(e.response?.data?.message || t('admin.projects.assignFailed')); }
  };

  const removeSupervisor = async (userId) => {
    try {
      await api.delete(`/supervisors/${userId}`);
      toast.success(t('admin.projects.supervisorRemoved'));
      load();
    } catch (e) { toast.error(e.response?.data?.message || t('admin.projects.removeFailed')); }
  };

  const confirmDeleteProject = async () => {
    if (!confirmState) return;
    setBusy(true);
    try {
      await api.delete(`/projects/${confirmState.id}`);
      toast.success(t('admin.projects.deleted'));
      load();
    } catch (e) { toast.error(e.response?.data?.message || t('admin.projects.deleteFailed')); }
    finally { setBusy(false); setConfirmState(null); }
  };

  // الموظفون المنتمون لكل مشروع
  const employeesByProject = useMemo(() => {
    const map = {};
    for (const u of users) {
      const pid = u.operationalProjectId;
      if (!pid) continue;
      if (!map[pid]) map[pid] = [];
      map[pid].push(u);
    }
    return map;
  }, [users]);

  // قائمة المستخدمين لاختيار مشرف
  const eligibleUsers = users.filter(u => u.isActive);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <h1 className="text-xl font-extrabold text-primary">{t('admin.projects.title')}</h1>
          <p className="mt-0.5 text-xs text-text-soft">
            {t('admin.projects.subtitle')}
          </p>
          <div className="mt-3 inline-flex items-start gap-1.5 rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span><strong>{t('admin.projects.noteTitle')}</strong> {t('admin.projects.noteBody')}</span>
          </div>
        </div>

        {/* إجراءات سريعة */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* إنشاء مشروع */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-text-main">
              <Plus size={15} aria-hidden="true" /> {t('admin.projects.createTitle')}
            </h3>
            <div className="flex gap-2">
              <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('admin.projects.createPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && createProject()}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <button onClick={createProject}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">{t('admin.projects.createButton')}</button>
            </div>
          </div>

          {/* تعيين مشرف */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-text-main">
              <UserPlus size={15} aria-hidden="true" /> {t('admin.projects.assignTitle')}
            </h3>
            <div className="flex flex-wrap gap-2">
              <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">{t('admin.projects.selectProject')}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">{t('admin.projects.selectUser')}</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
              <button onClick={assignSupervisor}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">{t('admin.projects.assignButton')}</button>
            </div>
          </div>
        </div>

        {/* قائمة المشاريع */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-10 text-text-soft shadow-card">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white py-10 text-center text-sm text-text-soft shadow-card">
            {t('admin.projects.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const supervisor  = project.supervisors?.[0];
              const members     = employeesByProject[project.id] || [];
              const supervisorUser = supervisor?.user;
              const isExpanded  = expandedProject === project.id;

              return (
                <div key={project.id} className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
                  {/* رأس المشروع */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-background transition"
                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-extrabold text-primary">
                        {project.name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-text-main">{project.name}</h3>
                        <p className="text-xs text-text-soft">
                          {t('admin.projects.courseCount', { count: project._count?.courses || 0 })} • {t('admin.projects.coordinatorCount', { count: members.length })}
                          {supervisorUser
                            ? ` • ${t('admin.projects.supervisorPrefix', { name: `${supervisorUser.firstName} ${supervisorUser.lastName}` })}`
                            : ` • ${t('admin.projects.noSupervisorInline')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!supervisorUser && (
                        <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">{t('admin.projects.noSupervisorBadge')}</span>
                      )}
                      {isExpanded
                        ? <ChevronUp size={16} aria-hidden="true" className="text-text-soft" />
                        : <ChevronDown size={16} aria-hidden="true" className="text-text-soft" />}
                    </div>
                  </div>

                  {/* تفاصيل المشروع */}
                  {isExpanded && (
                    <div className="border-t border-border px-5 pb-4 pt-3">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                        {/* المشرف */}
                        <div>
                          <h4 className="mb-2 text-xs font-extrabold uppercase text-text-soft">{t('admin.projects.supervisorHeading')}</h4>
                          {supervisorUser ? (
                            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary-light px-3 py-2">
                              <div>
                                <p className="font-bold text-sm text-primary">{supervisorUser.firstName} {supervisorUser.lastName}</p>
                                <p className="text-xs text-text-soft">{supervisorUser.email}</p>
                                {supervisorUser.roles?.includes('EMPLOYEE') && (
                                  <p className="text-[10px] text-warning">{t('admin.projects.alsoCoordinator')}</p>
                                )}
                              </div>
                              <button onClick={() => removeSupervisor(supervisorUser.id)}
                                className="rounded-lg border border-burgundy/20 px-2 py-1 text-[10px] font-bold text-danger hover:bg-burgundy/5">
                                {t('admin.common.remove')}
                              </button>
                            </div>
                          ) : (
                            <p className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-burgundy/20 bg-burgundy/5 py-3 text-center text-xs text-danger">
                              <AlertTriangle size={13} aria-hidden="true" /> {t('admin.projects.noSupervisorWarning')}
                            </p>
                          )}
                        </div>

                        {/* المنسقون */}
                        <div>
                          <h4 className="mb-2 text-xs font-extrabold uppercase text-text-soft">
                            {t('admin.projects.coordinatorsHeading', { count: members.length })}
                          </h4>
                          {members.length === 0 ? (
                            <p className="text-xs text-text-soft">{t('admin.projects.noCoordinators')}</p>
                          ) : (
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {members.map((m) => (
                                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-1.5">
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                    {m.firstName?.[0]}{m.lastName?.[0]}
                                  </div>
                                  <span className="text-xs text-text-main flex-1">{m.firstName} {m.lastName}</span>
                                  {m.roles?.includes('PROJECT_SUPERVISOR') && (
                                    <span className="text-[9px] rounded-full bg-primary-light text-primary border border-primary/20 px-1.5 py-0.5 font-bold">{t('admin.projects.coordinatorBadge')}</span>
                                  )}
                                  {!m.isActive && (
                                    <span className="text-[9px] rounded-full bg-burgundy/10 text-danger px-1.5 py-0.5 font-bold">{t('admin.users.disabledBadge')}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* حذف المشروع */}
                      <div className="mt-3 border-t border-border pt-3">
                        <button onClick={() => setConfirmState({ id: project.id, name: project.name })}
                          className="inline-flex items-center gap-1 rounded-xl border border-burgundy/20 px-3 py-1.5 text-xs font-bold text-danger hover:bg-burgundy/5">
                          <Trash2 size={13} aria-hidden="true" /> {t('admin.projects.deleteProject')}
                        </button>
                        <span className="ms-2 text-[10px] text-text-soft">{t('admin.projects.deleteHint')}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmState}
        title={t('admin.projects.deleteProject')}
        message={confirmState ? t('admin.projects.deleteConfirm', { name: confirmState.name }) : ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        loading={busy}
        onConfirm={confirmDeleteProject}
        onCancel={() => setConfirmState(null)}
      />
    </MainLayout>
  );
}
