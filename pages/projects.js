import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { canManageProjects } from '../lib/roles';

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
  const [projects, setProjects] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [newProjectName,   setNewProjectName]   = useState('');
  const [selectedProject,  setSelectedProject]  = useState('');
  const [selectedUser,     setSelectedUser]      = useState('');
  const [expandedProject,  setExpandedProject]  = useState(null);

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
    } catch { toast.error('تعذر تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return toast.error('اسم المشروع مطلوب');
    try {
      await api.post('/projects', { name: newProjectName.trim() });
      setNewProjectName('');
      toast.success('تم إنشاء المشروع');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر الإنشاء'); }
  };

  const assignSupervisor = async () => {
    if (!selectedProject || !selectedUser) return toast.error('اختر المشروع والمستخدم');
    try {
      await api.post('/supervisors/assign', { userId: selectedUser, operationalProjectId: selectedProject });
      setSelectedProject(''); setSelectedUser('');
      toast.success('تم تعيين المشرف');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر التعيين'); }
  };

  const removeSupervisor = async (userId) => {
    try {
      await api.delete(`/supervisors/${userId}`);
      toast.success('تمت إزالة الإشراف');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر الإزالة'); }
  };

  const deleteProject = async (id, name) => {
    if (!confirm(`حذف مشروع "${name}"؟ يجب ألا يحتوي على موظفين أو دورات.`)) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success('تم حذف المشروع');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر الحذف'); }
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
          <h1 className="text-xl font-extrabold text-primary">المشاريع التشغيلية</h1>
          <p className="mt-0.5 text-xs text-text-soft">
            ضبط العلاقات بين المشرفين والمنسقين — كل مشروع يضم مشرفاً مسؤولاً وفريقاً من المنسقين
          </p>
          <div className="mt-3 rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs text-warning">
            <strong>ملاحظة مهمة:</strong> عند تغطية منسق لدورة في مشروع آخر — يعتمد عناصره <strong>مشرف مشروع الدورة</strong> (وليس مشرف مشروع المنسق الأصلي). KPI المنسق يحتسب جميع دوراته بغض النظر عن المشروع.
          </div>
        </div>

        {/* إجراءات سريعة */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* إنشاء مشروع */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-text-main">➕ إنشاء مشروع جديد</h3>
            <div className="flex gap-2">
              <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="اسم المشروع التشغيلي"
                onKeyDown={(e) => e.key === 'Enter' && createProject()}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <button onClick={createProject}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">إنشاء</button>
            </div>
          </div>

          {/* تعيين مشرف */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-text-main">👤 تعيين مشرف مشروع</h3>
            <div className="flex flex-wrap gap-2">
              <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">اختر المشروع</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">اختر المستخدم</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
              <button onClick={assignSupervisor}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">تعيين</button>
            </div>
          </div>
        </div>

        {/* قائمة المشاريع */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-10 text-text-soft shadow-card">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">جاري التحميل...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white py-10 text-center text-sm text-text-soft shadow-card">
            لا توجد مشاريع — أنشئ مشروعاً أولاً
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
                          {project._count?.courses || 0} دورة • {members.length} منسق
                          {supervisorUser ? ` • مشرف: ${supervisorUser.firstName} ${supervisorUser.lastName}` : ' • لا يوجد مشرف'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!supervisorUser && (
                        <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">بدون مشرف</span>
                      )}
                      <span className="text-xs text-text-soft">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* تفاصيل المشروع */}
                  {isExpanded && (
                    <div className="border-t border-border px-5 pb-4 pt-3">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                        {/* المشرف */}
                        <div>
                          <h4 className="mb-2 text-xs font-extrabold uppercase text-text-soft">مشرف المشروع</h4>
                          {supervisorUser ? (
                            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary-light px-3 py-2">
                              <div>
                                <p className="font-bold text-sm text-primary">{supervisorUser.firstName} {supervisorUser.lastName}</p>
                                <p className="text-xs text-text-soft">{supervisorUser.email}</p>
                                {supervisorUser.roles?.includes('EMPLOYEE') && (
                                  <p className="text-[10px] text-warning">يعمل أيضاً كمنسق</p>
                                )}
                              </div>
                              <button onClick={() => removeSupervisor(supervisorUser.id)}
                                className="rounded-lg border border-burgundy/20 px-2 py-1 text-[10px] font-bold text-danger hover:bg-burgundy/5">
                                إزالة
                              </button>
                            </div>
                          ) : (
                            <p className="rounded-xl border border-dashed border-burgundy/20 bg-burgundy/5 py-3 text-center text-xs text-danger">
                              ⚠️ لا يوجد مشرف — العناصر لن تُعتمد تلقائياً
                            </p>
                          )}
                        </div>

                        {/* المنسقون */}
                        <div>
                          <h4 className="mb-2 text-xs font-extrabold uppercase text-text-soft">
                            المنسقون ({members.length})
                          </h4>
                          {members.length === 0 ? (
                            <p className="text-xs text-text-soft">لا يوجد منسقون مسجلون في هذا المشروع</p>
                          ) : (
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {members.map((m) => (
                                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-1.5">
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                    {m.firstName?.[0]}{m.lastName?.[0]}
                                  </div>
                                  <span className="text-xs text-text-main flex-1">{m.firstName} {m.lastName}</span>
                                  {m.roles?.includes('PROJECT_SUPERVISOR') && (
                                    <span className="text-[9px] rounded-full bg-primary-light text-primary border border-primary/20 px-1.5 py-0.5 font-bold">مشرف</span>
                                  )}
                                  {!m.isActive && (
                                    <span className="text-[9px] rounded-full bg-burgundy/10 text-danger px-1.5 py-0.5 font-bold">معطل</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* حذف المشروع */}
                      <div className="mt-3 border-t border-border pt-3">
                        <button onClick={() => deleteProject(project.id, project.name)}
                          className="rounded-xl border border-burgundy/20 px-3 py-1.5 text-xs font-bold text-danger hover:bg-burgundy/5">
                          🗑️ حذف المشروع
                        </button>
                        <span className="mr-2 text-[10px] text-text-soft">يُحذف فقط إذا لم تكن هناك موظفون أو دورات</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
