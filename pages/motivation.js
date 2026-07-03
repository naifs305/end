// مركز التحفيز — 4 أدوات تحفيزية
import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

// ─── ثوابت ───────────────────────────────────────────────────────────────────

const BADGE_META = {
  COMMITTED:     { label:'الملتزم',     icon:'🎖️', desc:'كل العناصر قبل الموعد المثالي',   cls:'bg-primary-light text-primary border-primary/20' },
  PRECISE:       { label:'الدقيق',      icon:'🎯', desc:'صفر إعادات في الفترة كاملة',        cls:'bg-forest-50 text-accent border-accent/20' },
  FAST:          { label:'السريع',      icon:'⚡', desc:'أسرع متوسط تقديم في الفريق',        cls:'bg-sand/20 text-warning border-sand/40' },
  IMPROVER:      { label:'المتحسن',     icon:'📈', desc:'أفضل تحسن في مسار الأداء',          cls:'bg-primary-light text-primary border-primary/20' },
  CONSISTENT:    { label:'الثابت',      icon:'🏛️', desc:'3 أشهر متتالية فوق 80%',            cls:'bg-forest-50 text-accent border-accent/20' },
  PIONEER:       { label:'الرائد',      icon:'🚀', desc:'أول من يكمل كل عناصر دورة',         cls:'bg-primary-light text-primary border-primary/20' },
  IDEA_CHAMPION: { label:'المبدع',      icon:'💡', desc:'مبادرة تحسين مُنفَّذة',              cls:'bg-sand/20 text-warning border-sand/40' },
  TEAM_PLAYER:   { label:'لاعب الفريق', icon:'🤝', desc:'تحدي فريق شهري محقق',              cls:'bg-forest-50 text-accent border-accent/20' },
  PLEDGE_KEEPER: { label:'الوفي',       icon:'🤲', desc:'وفى بكل تعهداته الشهرية',           cls:'bg-primary-light text-primary border-primary/20' },
  STAR:          { label:'النجم',       icon:'⭐', desc:'أداء متميز مرتين متتاليتين',         cls:'bg-sand/20 text-warning border-sand/40' },
};

const IDEA_STATUS = {
  PENDING:      { label:'بانتظار المراجعة', cls:'bg-background text-text-soft border-border' },
  UNDER_REVIEW: { label:'قيد الدراسة',     cls:'bg-sand/20 text-warning border-sand/40' },
  APPROVED:     { label:'معتمدة',           cls:'bg-primary-light text-primary border-primary/20' },
  IMPLEMENTED:  { label:'مُنفَّذة ✓',       cls:'bg-forest-50 text-accent border-accent/20' },
  REJECTED:     { label:'مرفوضة',           cls:'bg-burgundy/10 text-danger border-burgundy/20' },
};

const IDEA_CATEGORY = {
  process:   'عملية',
  technical: 'تقنية',
  training:  'تدريب',
  general:   'عام',
};

const METRIC_LABEL = {
  timeliness:   'متوسط درجة التوقيت',
  quality:      'متوسط درجة الجودة',
  zero_returns: 'انخفاض معدل الإعادات',
  final_score:  'متوسط الدرجة الكلية',
};

const CHALLENGE_STATUS = {
  ACTIVE:    { label:'جارٍ',       cls:'bg-primary-light text-primary border-primary/20' },
  ACHIEVED:  { label:'✓ محقق',     cls:'bg-forest-50 text-accent border-accent/20' },
  FAILED:    { label:'لم يتحقق',   cls:'bg-burgundy/10 text-danger border-burgundy/20' },
  CANCELLED: { label:'ملغي',       cls:'bg-background text-text-soft border-border' },
};

function nowLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ─── مكونات مشتركة ────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
}

function Badge({ meta }) {
  if (!meta) return null;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>;
}

function ProgressBar({ value, max = 100, color = 'bg-primary' }) {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-forest-50">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── القسم 1: الشارات ─────────────────────────────────────────────────────────

function BadgesSection({ isManager, currentUser, users }) {
  const [badges,       setBadges]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState({ userId:'', badgeType:'COMMITTED', note:'' });
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/motivation/badges')
      .then(r => setBadges(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('تعذر تحميل الشارات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAward = async () => {
    if (!form.userId || !form.badgeType) { toast.error('اختر الموظف ونوع الشارة'); return; }
    setSaving(true);
    try {
      await api.post('/motivation/badges', { ...form, periodLabel: nowLabel() });
      toast.success('تم منح الشارة ✓');
      setShowModal(false);
      setForm({ userId:'', badgeType:'COMMITTED', note:'' });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'حدث خطأ'); }
    finally { setSaving(false); }
  };

  // تجميع الشارات حسب النوع
  const byType = badges.reduce((acc, b) => {
    acc[b.badgeType] = (acc[b.badgeType] || 0) + 1;
    return acc;
  }, {});

  const myBadges = isManager ? badges : badges.filter(b => b.userId === currentUser?.id);

  return (
    <div className="space-y-4">
      {/* ملخص أنواع الشارات */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {Object.entries(BADGE_META).map(([key, meta]) => (
          <div key={key} className={`rounded-2xl border p-3 text-center transition hover:shadow-soft ${(byType[key]||0) > 0 ? meta.cls : 'bg-background border-border text-text-soft/40'}`}>
            <div className="text-2xl mb-1">{meta.icon}</div>
            <div className="text-xs font-extrabold">{meta.label}</div>
            {(byType[key]||0) > 0 && (
              <div className="mt-1 text-[10px] font-bold opacity-70">{byType[key]} شارة</div>
            )}
          </div>
        ))}
      </div>

      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-soft">{myBadges.length} شارة {isManager ? 'للفريق' : 'لك'}</p>
        {isManager && (
          <button onClick={() => setShowModal(true)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-dark transition">
            🎖️ منح شارة
          </button>
        )}
      </div>

      {loading ? <Spinner /> : myBadges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
          <p className="text-4xl mb-3">🏅</p>
          <p className="font-bold text-text-main">لا توجد شارات بعد</p>
          <p className="mt-1 text-sm text-text-soft">
            {isManager ? 'امنح أول شارة لموظف متميز' : 'أكمل مهامك في الوقت المحدد لتحصل على شاراتك الأولى'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {myBadges.map(b => {
            const meta = BADGE_META[b.badgeType] || { label: b.badgeType, icon:'🏅', cls:'bg-background text-text-soft border-border' };
            return (
              <div key={b.id} className={`rounded-2xl border p-4 shadow-card ${meta.cls}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm">{meta.label}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">{meta.desc}</p>
                    {isManager && (
                      <p className="mt-1 text-xs font-bold">{b.firstName} {b.lastName}</p>
                    )}
                    {b.note && <p className="mt-1 text-[11px] opacity-60">"{b.note}"</p>}
                    <p className="mt-1 text-[10px] opacity-50">
                      {b.periodLabel || ''} · {new Date(b.awardedAt).toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'short', year:'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* مودال منح شارة */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-deep">
            <h3 className="mb-4 text-lg font-extrabold text-primary">🎖️ منح شارة لموظف</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">الموظف</label>
                <select value={form.userId} onChange={e => setForm(p=>({...p,userId:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="">اختر موظفاً</option>
                  {(users||[]).filter(u=>u.roles?.includes('EMPLOYEE')).map(u=>(
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">نوع الشارة</label>
                <select value={form.badgeType} onChange={e => setForm(p=>({...p,badgeType:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  {Object.entries(BADGE_META).map(([key,meta])=>(
                    <option key={key} value={key}>{meta.icon} {meta.label} — {meta.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">ملاحظة (اختياري)</label>
                <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                  placeholder="سبب منح الشارة..."
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={handleAward} disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                {saving ? 'جاري المنح...' : 'منح الشارة'}
              </button>
              <button onClick={()=>setShowModal(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-soft hover:bg-background">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── القسم 2: بنك المبادرات ───────────────────────────────────────────────────

function IdeasSection({ isManager, currentUser }) {
  const [ideas,       setIdeas]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter,setStatusFilter]= useState('ALL');
  const [showModal,   setShowModal]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState({ title:'', description:'', category:'general' });
  const [reviewing,   setReviewing]   = useState({}); // { [id]: { status, notes } }

  const load = useCallback(() => {
    setLoading(true);
    api.get('/motivation/ideas')
      .then(r => setIdeas(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('تعذر تحميل المبادرات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'ALL' ? ideas : ideas.filter(i => i.status === statusFilter);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error('العنوان والوصف مطلوبان'); return; }
    setSaving(true);
    try {
      await api.post('/motivation/ideas', form);
      toast.success('تم تقديم مبادرتك ✓');
      setShowModal(false);
      setForm({ title:'', description:'', category:'general' });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'حدث خطأ'); }
    finally { setSaving(false); }
  };

  const handleSupport = async (id) => {
    try {
      const r = await api.put(`/motivation/ideas/${id}`, { action:'support' });
      const act = r.data.action;
      setIdeas(prev => prev.map(i => {
        if (i.id !== id) return i;
        return { ...i, supportCount: act === 'supported' ? i.supportCount+1 : i.supportCount-1, iSupported: act === 'supported' };
      }));
    } catch { toast.error('حدث خطأ'); }
  };

  const handleReview = async (id) => {
    const rev = reviewing[id];
    if (!rev?.status) { toast.error('اختر الحالة'); return; }
    try {
      await api.put(`/motivation/ideas/${id}`, { action:'review', status: rev.status, reviewNotes: rev.notes });
      toast.success('تم تحديث الحالة ✓');
      setReviewing(p => { const n={...p}; delete n[id]; return n; });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'حدث خطأ'); }
  };

  const statusTabs = [
    { key:'ALL',          label:'الكل',            count: ideas.length },
    { key:'PENDING',      label:'بانتظار',          count: ideas.filter(i=>i.status==='PENDING').length },
    { key:'UNDER_REVIEW', label:'قيد الدراسة',      count: ideas.filter(i=>i.status==='UNDER_REVIEW').length },
    { key:'APPROVED',     label:'معتمدة',            count: ideas.filter(i=>i.status==='APPROVED').length },
    { key:'IMPLEMENTED',  label:'منفذة',             count: ideas.filter(i=>i.status==='IMPLEMENTED').length },
  ];

  return (
    <div className="space-y-4">
      {/* شريط الفلتر + زر الإضافة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition
                ${statusFilter===t.key ? 'bg-primary text-white border-primary' : 'bg-background border-border text-text-soft hover:border-primary/40'}`}>
              {t.label} {t.count > 0 && `(${t.count})`}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)}
          className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition">
          💡 أضف مبادرة
        </button>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
          <p className="text-4xl mb-3">💡</p>
          <p className="font-bold text-text-main">لا توجد مبادرات</p>
          <p className="mt-1 text-sm text-text-soft">شارك أفكارك لتحسين العمل وتطوير المنصة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(idea => {
            const sm = IDEA_STATUS[idea.status] || IDEA_STATUS.PENDING;
            const rev = reviewing[idea.id] || {};
            const isMine = idea.userId === currentUser?.id;
            return (
              <div key={idea.id} className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-text-soft bg-background border border-border rounded-full px-2 py-0.5">
                        {IDEA_CATEGORY[idea.category] || idea.category}
                      </span>
                      <Badge meta={sm} />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* زر التأييد */}
                      <button onClick={() => handleSupport(idea.id)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition
                          ${idea.iSupported ? 'bg-primary-light text-primary border-primary/20' : 'border-border bg-background text-text-soft hover:border-primary/30'}`}>
                        👍 {idea.supportCount || 0}
                      </button>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-sm text-text-main mb-1">{idea.title}</h4>
                  <p className="text-xs text-text-soft line-clamp-2 leading-relaxed">{idea.description}</p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-text-soft">
                    <span className="font-bold">{idea.firstName} {idea.lastName}</span>
                    <span>{new Date(idea.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'short', year:'numeric' })}</span>
                  </div>

                  {idea.reviewNotes && (
                    <div className="mt-2 rounded-xl border border-primary/10 bg-primary-light/30 px-3 py-2 text-[11px] text-text-soft">
                      <span className="font-bold text-primary">ملاحظة الإدارة: </span>{idea.reviewNotes}
                    </div>
                  )}

                  {/* مراجعة المدير */}
                  {isManager && idea.status !== 'IMPLEMENTED' && idea.status !== 'REJECTED' && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={rev.status || ''}
                          onChange={e => setReviewing(p=>({...p, [idea.id]:{...rev, status:e.target.value}}))}
                          className="flex-1 rounded-xl border border-border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary">
                          <option value="">تغيير الحالة...</option>
                          <option value="UNDER_REVIEW">قيد الدراسة</option>
                          <option value="APPROVED">اعتماد</option>
                          <option value="IMPLEMENTED">تنفيذ + شارة مبدع</option>
                          <option value="REJECTED">رفض</option>
                        </select>
                        {rev.status && (
                          <>
                            <input
                              value={rev.notes || ''}
                              onChange={e => setReviewing(p=>({...p,[idea.id]:{...rev,notes:e.target.value}}))}
                              placeholder="ملاحظة..."
                              className="flex-1 min-w-[120px] rounded-xl border border-border px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                            />
                            <button onClick={()=>handleReview(idea.id)}
                              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark">
                              حفظ
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* مودال إضافة مبادرة */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-deep">
            <h3 className="mb-4 text-lg font-extrabold text-primary">💡 مبادرة تحسين جديدة</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">العنوان <span className="text-danger">*</span></label>
                <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                  placeholder="عنوان واضح ومختصر لمبادرتك..."
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">الوصف <span className="text-danger">*</span></label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                  rows={4} placeholder="اشرح مبادرتك وكيف تُحسّن العمل..."
                  className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">التصنيف</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="process">عملية — تحسين إجراءات العمل</option>
                  <option value="technical">تقنية — تطوير المنصة</option>
                  <option value="training">تدريب — تطوير الكوادر</option>
                  <option value="general">عام</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
                {saving ? 'جاري الإرسال...' : '✓ تقديم المبادرة'}
              </button>
              <button onClick={()=>setShowModal(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-soft hover:bg-background">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── القسم 3: التحدي الشهري ──────────────────────────────────────────────────

function ChallengeSection({ isManager, currentUser }) {
  const [challenge,  setChallenge]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ title:'', description:'', targetMetric:'timeliness', targetValue:'80' });

  const label = nowLabel();

  const load = useCallback(() => {
    setLoading(true);
    api.get('/motivation/challenges', { params: { periodLabel: label } })
      .then(r => setChallenge(r.data))
      .catch(() => setChallenge(null))
      .finally(() => setLoading(false));
  }, [label]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('العنوان مطلوب'); return; }
    const tv = Number(form.targetValue);
    if (!tv || tv < 10 || tv > 100) { toast.error('القيمة المستهدفة بين 10 و 100'); return; }
    setSaving(true);
    try {
      await api.post('/motivation/challenges', { ...form, targetValue: tv, periodLabel: label });
      toast.success('تم إنشاء التحدي ✓');
      setShowForm(false);
      setForm({ title:'', description:'', targetMetric:'timeliness', targetValue:'80' });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'حدث خطأ'); }
    finally { setSaving(false); }
  };

  const arMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthName = arMonths[new Date().getMonth()];

  return (
    <div className="space-y-4">
      {loading ? <Spinner /> : !challenge ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-bold text-text-main">لا يوجد تحدي لشهر {monthName}</p>
          <p className="mt-1 text-sm text-text-soft mb-4">
            {isManager ? 'أنشئ تحدياً شهرياً لتحفيز الفريق نحو هدف مشترك' : 'انتظر المدير لإطلاق تحدي هذا الشهر'}
          </p>
          {isManager && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark">
              🎯 أطلق تحدي الشهر
            </button>
          )}
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border shadow-card ${challenge.status === 'ACHIEVED' ? 'border-accent/30' : 'border-border'} bg-white`}>
          {challenge.status === 'ACHIEVED' && (
            <div className="bg-forest-50 border-b border-accent/20 px-5 py-3 text-center text-sm font-extrabold text-accent">
              🎉 تهانينا! الفريق حقق تحدي {monthName} بنجاح
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🎯</span>
                  <h3 className="text-xl font-extrabold text-text-main">{challenge.title}</h3>
                  <Badge meta={CHALLENGE_STATUS[challenge.status]} />
                </div>
                {challenge.description && <p className="text-sm text-text-soft mt-1">{challenge.description}</p>}
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary-light px-4 py-3 text-center min-w-[100px]">
                <p className="text-2xl font-extrabold text-primary">{challenge.targetValue}%</p>
                <p className="text-[10px] text-text-soft mt-0.5">الهدف</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-text-main">{METRIC_LABEL[challenge.targetMetric] || challenge.targetMetric}</span>
                <span className="text-text-soft">
                  {challenge.currentValue != null ? `${Number(challenge.currentValue).toFixed(1)}%` : '—'} / {challenge.targetValue}%
                </span>
              </div>
              <ProgressBar
                value={challenge.currentValue || 0}
                max={challenge.targetValue}
                color={challenge.status === 'ACHIEVED' ? 'bg-accent' : (challenge.currentValue||0) >= challenge.targetValue * 0.8 ? 'bg-primary' : 'bg-sand'}
              />
              <p className="text-[11px] text-text-soft">
                {challenge.currentValue != null
                  ? `التقدم الحالي: ${Number(challenge.currentValue).toFixed(1)}% من هدف ${challenge.targetValue}%`
                  : 'لم يُحتسب KPI لهذه الفترة بعد — احتسب المؤشرات لرؤية التقدم'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* نموذج إنشاء تحدي */}
      {isManager && showForm && (
        <div className="rounded-2xl border border-primary/20 bg-white p-5 shadow-card">
          <h4 className="mb-4 font-extrabold text-primary">🎯 إطلاق تحدي جديد لشهر {monthName}</h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-text-main">عنوان التحدي <span className="text-danger">*</span></label>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                placeholder="مثال: تحدي الالتزام بالمواعيد لشهر مايو"
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">المؤشر المستهدف</label>
                <select value={form.targetMetric} onChange={e=>setForm(p=>({...p,targetMetric:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  {Object.entries(METRIC_LABEL).map(([k,v])=>(
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">القيمة المستهدفة (%)</label>
                <input type="number" min="10" max="100" value={form.targetValue} onChange={e=>setForm(p=>({...p,targetValue:e.target.value}))}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-text-main">وصف التحدي (اختياري)</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                rows={2} placeholder="شجّع فريقك وأخبرهم لماذا هذا التحدي مهم..."
                className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
              {saving ? 'جاري الإطلاق...' : '🚀 إطلاق التحدي'}
            </button>
            <button onClick={()=>setShowForm(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-soft hover:bg-background">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {isManager && !showForm && challenge && (
        <button onClick={() => setShowForm(true)}
          className="w-full rounded-xl border border-dashed border-primary/30 py-2.5 text-sm font-bold text-primary hover:bg-primary-light transition">
          + تحديث / استبدال التحدي
        </button>
      )}
    </div>
  );
}

// ─── القسم 4: التعهد الشخصي ─────────────────────────────────────────────────

function PledgeSection({ isManager, currentUser, users }) {
  const [pledge,      setPledge]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [form,        setForm]        = useState({ pledge1:'', pledge2:'', pledge3:'' });
  const [saving,      setSaving]      = useState(false);
  const [teamPledges, setTeamPledges] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [evaluating,  setEvaluating]  = useState({});
  const [showTeam,    setShowTeam]    = useState(false);

  const label = nowLabel();
  const arMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthName = arMonths[new Date().getMonth()];

  const loadMine = useCallback(() => {
    setLoading(true);
    api.get('/motivation/pledges', { params: { periodLabel: label } })
      .then(r => setPledge(r.data))
      .catch(() => setPledge(null))
      .finally(() => setLoading(false));
  }, [label]);

  useEffect(() => { loadMine(); }, [loadMine]);

  const loadTeam = () => {
    if (!isManager) return;
    setTeamLoading(true);
    Promise.all(
      (users||[]).filter(u=>u.roles?.includes('EMPLOYEE')).map(u =>
        api.get('/motivation/pledges', { params: { periodLabel: label, userId: u.id } })
          .then(r => r.data ? { ...r.data, empName:`${u.firstName} ${u.lastName}` } : null)
          .catch(() => null)
      )
    ).then(results => setTeamPledges(results.filter(Boolean)))
     .finally(() => setTeamLoading(false));
  };

  const handleSave = async () => {
    if (!form.pledge1.trim()) { toast.error('التعهد الأول مطلوب'); return; }
    setSaving(true);
    try {
      await api.post('/motivation/pledges', { ...form, periodLabel: label });
      toast.success('تم حفظ تعهدك ✓');
      loadMine();
    } catch (e) { toast.error(e?.response?.data?.message || 'حدث خطأ'); }
    finally { setSaving(false); }
  };

  const handleEvaluate = async (pledgeId, evals) => {
    try {
      const r = await api.put('/motivation/pledges/evaluate', {
        pledgeId,
        fulfilled1: evals.f1 ?? null,
        fulfilled2: evals.f2 ?? null,
        fulfilled3: evals.f3 ?? null,
      });
      toast.success(`تم التقييم — نسبة الوفاء: ${r.data.fulfillRate ?? '—'}%`);
      setEvaluating(p => { const n={...p}; delete n[pledgeId]; return n; });
      loadTeam();
    } catch { toast.error('حدث خطأ'); }
  };

  const FulfillDot = ({ val }) => (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
      ${val === true ? 'bg-forest-50 text-accent border border-accent/20'
        : val === false ? 'bg-burgundy/10 text-danger border border-burgundy/20'
        : 'bg-background text-text-soft/40 border border-border'}`}>
      {val === true ? '✓' : val === false ? '✗' : '○'}
    </span>
  );

  return (
    <div className="space-y-4">
      {loading ? <Spinner /> : !pledge ? (
        /* لم يُعبئ التعهد بعد */
        <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
          <div className="bg-gradient-to-l from-primary/5 to-white px-5 py-4 border-b border-border">
            <h3 className="font-extrabold text-primary">📅 تعهداتي لشهر {monthName}</h3>
            <p className="text-xs text-text-soft mt-0.5">
              أكتب 3 أهداف شخصية تلتزم بتحقيقها هذا الشهر
            </p>
          </div>
          <div className="p-5 space-y-3">
            {[
              { key:'pledge1', label:'التعهد الأول', req:true,  ph:'مثال: سأقدم تقارير الافتتاح قبل الموعد المثالي دائماً' },
              { key:'pledge2', label:'التعهد الثاني', req:false, ph:'مثال: لن يكون لدي أي عنصر مُعاد هذا الشهر' },
              { key:'pledge3', label:'التعهد الثالث', req:false, ph:'مثال: سأتحقق من المنصة يومياً وأتابع حالة عناصري' },
            ].map(f => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-bold text-text-main">
                  {f.label} {f.req && <span className="text-danger">*</span>}
                </label>
                <input
                  value={form[f.key]}
                  onChange={e => setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.ph}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            ))}
            <button onClick={handleSave} disabled={saving}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60 transition">
              {saving ? 'جاري الحفظ...' : '🤲 أتعهد بتحقيق هذه الأهداف'}
            </button>
          </div>
        </div>
      ) : (
        /* عرض التعهد الحالي */
        <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
          <div className="bg-gradient-to-l from-primary/5 to-white px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-primary">📅 تعهداتي لشهر {monthName}</h3>
                {pledge.fulfillRate != null && (
                  <p className="text-xs text-text-soft mt-0.5">
                    نسبة الوفاء: <span className="font-extrabold text-primary">{pledge.fulfillRate}%</span>
                  </p>
                )}
              </div>
              {pledge.fulfillRate === 100 && (
                <span className="rounded-full bg-forest-50 border border-accent/20 px-3 py-1 text-xs font-extrabold text-accent">
                  🏅 وفيت بعهدك!
                </span>
              )}
            </div>
          </div>
          <div className="p-5 space-y-3">
            {[
              { text: pledge.pledge1, fulfilled: pledge.fulfilled1 },
              { text: pledge.pledge2, fulfilled: pledge.fulfilled2 },
              { text: pledge.pledge3, fulfilled: pledge.fulfilled3 },
            ].filter(p => p.text).map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <FulfillDot val={p.fulfilled} />
                <p className={`flex-1 text-sm ${p.fulfilled === false ? 'line-through text-text-soft/50' : 'text-text-main'}`}>
                  {p.text}
                </p>
              </div>
            ))}
            {pledge.fulfillRate != null && (
              <div className="mt-2">
                <ProgressBar
                  value={pledge.fulfillRate}
                  color={pledge.fulfillRate === 100 ? 'bg-accent' : pledge.fulfillRate >= 66 ? 'bg-primary' : 'bg-sand'}
                />
              </div>
            )}
            {pledge.evaluatedAt && (
              <p className="text-[11px] text-text-soft text-center">
                تم التقييم: {new Date(pledge.evaluatedAt).toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'short', year:'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* قسم تقييم الفريق — مدير فقط */}
      {isManager && (
        <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
          <button onClick={() => { setShowTeam(v=>!v); if (!showTeam) loadTeam(); }}
            className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition">
            <h4 className="font-extrabold text-text-main">👥 تقييم تعهدات الفريق</h4>
            <span className="text-xs text-text-soft">{showTeam ? '▲' : '▼'}</span>
          </button>
          {showTeam && (
            <div className="border-t border-border p-4">
              {teamLoading ? <Spinner /> : teamPledges.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-soft">لا توجد تعهدات مُسجَّلة من الفريق</p>
              ) : (
                <div className="space-y-3">
                  {teamPledges.map(tp => {
                    const ev = evaluating[tp.id] || {};
                    return (
                      <div key={tp.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-sm text-text-main">{tp.empName}</p>
                          {tp.fulfillRate != null && (
                            <span className={`text-xs font-extrabold ${tp.fulfillRate===100?'text-accent':tp.fulfillRate>=50?'text-primary':'text-danger'}`}>
                              {tp.fulfillRate}%
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5 mb-2">
                          {[
                            { text: tp.pledge1, key:'f1', fulfilled: tp.fulfilled1 },
                            { text: tp.pledge2, key:'f2', fulfilled: tp.fulfilled2 },
                            { text: tp.pledge3, key:'f3', fulfilled: tp.fulfilled3 },
                          ].filter(p=>p.text).map((p,i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-text-soft">
                              <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                                <input type="checkbox"
                                  checked={ev[p.key] ?? (p.fulfilled ?? false)}
                                  onChange={e => setEvaluating(prev => ({
                                    ...prev,
                                    [tp.id]: { ...(prev[tp.id]||{}), [p.key]: e.target.checked }
                                  }))}
                                  className="h-3.5 w-3.5 rounded" />
                                <span>{p.text}</span>
                              </label>
                              <FulfillDot val={p.fulfilled} />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleEvaluate(tp.id, {
                            f1: ev.f1 ?? tp.fulfilled1 ?? false,
                            f2: tp.pledge2 ? (ev.f2 ?? tp.fulfilled2 ?? false) : null,
                            f3: tp.pledge3 ? (ev.f3 ?? tp.fulfilled3 ?? false) : null,
                          })}
                          className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white hover:bg-primary-dark">
                          حفظ التقييم
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── الصفحة الرئيسية ─────────────────────────────────────────────────────────

const TABS = [
  { key:'badges',    label:'الشارات',        icon:'🏅' },
  { key:'ideas',     label:'المبادرات',      icon:'💡' },
  { key:'challenge', label:'تحدي الشهر',    icon:'🎯' },
  { key:'pledge',    label:'تعهدي',          icon:'📅' },
];

export default function MotivationPage() {
  const { activeRole, user } = useAuth();
  const isManager    = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const [tab,   setTab]   = useState('badges');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (isManager || isSupervisor) {
      api.get('/users').then(r => {
        const d = r.data;
        setUsers(Array.isArray(d) ? d : d?.data || []);
      }).catch(() => {});
    }
  }, [isManager, isSupervisor]);

  const arMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthName = arMonths[new Date().getMonth()];

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس الصفحة */}
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary to-primary-dark text-white shadow-soft">
          <div className="relative px-6 py-6">
            <h1 className="text-2xl font-extrabold mb-1">🌟 مركز التحفيز</h1>
            <p className="text-sm opacity-80 mb-4">أدوات تُحفّز على الانضباط والمبادرة والتميز — شهر {monthName}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon:'🏅', label:'الشارات',     desc:'اكسب شارات التميز' },
                { icon:'💡', label:'المبادرات',   desc:'قدّم أفكارك واحصل على الائتمان' },
                { icon:'🎯', label:'تحدي الشهر',  desc:'تحدٍّ جماعي شهري' },
                { icon:'📅', label:'تعهدي',        desc:'التزم بأهدافك الشخصية' },
              ].map(t => (
                <div key={t.icon} className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="font-extrabold text-sm">{t.icon} {t.label}</p>
                  <p className="text-[11px] opacity-70">{t.desc}</p>
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute -bottom-8 -start-8 h-32 w-32 rounded-full bg-white/5" />
          </div>
        </div>

        {/* التبويبات */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-card">
          <div className="flex min-w-max">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-6 py-3.5 text-sm font-bold transition whitespace-nowrap
                  ${tab === t.key
                    ? 'border-primary text-primary bg-primary-light/30'
                    : 'border-transparent text-text-soft hover:text-primary hover:bg-background'}`}>
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* المحتوى */}
        {tab === 'badges'    && <BadgesSection   isManager={isManager||isSupervisor} currentUser={user} users={users} />}
        {tab === 'ideas'     && <IdeasSection    isManager={isManager||isSupervisor} currentUser={user} />}
        {tab === 'challenge' && <ChallengeSection isManager={isManager}              currentUser={user} />}
        {tab === 'pledge'    && <PledgeSection   isManager={isManager}               currentUser={user} users={users} />}

      </div>
    </MainLayout>
  );
}
