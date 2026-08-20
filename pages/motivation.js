// مركز التحفيز — 4 أدوات تحفيزية
import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Award,
  Lightbulb,
  Target,
  CalendarDays,
  Medal,
  Crosshair,
  Zap,
  TrendingUp,
  Landmark,
  Rocket,
  Handshake,
  HeartHandshake,
  Star,
  ThumbsUp,
  PartyPopper,
  Users,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Circle,
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';

// ─── ثوابت ───────────────────────────────────────────────────────────────────
// (الأنماط والأيقونات فقط؛ التسميات والأوصاف من الترجمة)

const BADGE_META = {
  COMMITTED:     { Icon: Medal,         cls:'bg-primary-light text-primary border-primary/20' },
  PRECISE:       { Icon: Crosshair,     cls:'bg-forest-50 text-accent border-accent/20' },
  FAST:          { Icon: Zap,           cls:'bg-sand/20 text-warning border-sand/40' },
  IMPROVER:      { Icon: TrendingUp,    cls:'bg-primary-light text-primary border-primary/20' },
  CONSISTENT:    { Icon: Landmark,      cls:'bg-forest-50 text-accent border-accent/20' },
  PIONEER:       { Icon: Rocket,        cls:'bg-primary-light text-primary border-primary/20' },
  IDEA_CHAMPION: { Icon: Lightbulb,     cls:'bg-sand/20 text-warning border-sand/40' },
  TEAM_PLAYER:   { Icon: Handshake,     cls:'bg-forest-50 text-accent border-accent/20' },
  PLEDGE_KEEPER: { Icon: HeartHandshake,cls:'bg-primary-light text-primary border-primary/20' },
  STAR:          { Icon: Star,          cls:'bg-sand/20 text-warning border-sand/40' },
};

const IDEA_STATUS_CLS = {
  PENDING:      'bg-background text-text-soft border-border',
  UNDER_REVIEW: 'bg-sand/20 text-warning border-sand/40',
  APPROVED:     'bg-primary-light text-primary border-primary/20',
  IMPLEMENTED:  'bg-forest-50 text-accent border-accent/20',
  REJECTED:     'bg-burgundy/10 text-danger border-burgundy/20',
};

const CHALLENGE_STATUS_CLS = {
  ACTIVE:    'bg-primary-light text-primary border-primary/20',
  ACHIEVED:  'bg-forest-50 text-accent border-accent/20',
  FAILED:    'bg-burgundy/10 text-danger border-burgundy/20',
  CANCELLED: 'bg-background text-text-soft border-border',
};

function nowLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ─── مكونات مشتركة ────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
}

function Badge({ label, cls }) {
  if (!label) return null;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
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

function BadgesSection({ isManager, currentUser, users, t, intl }) {
  const [badges,       setBadges]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState({ userId:'', badgeType:'COMMITTED', note:'' });
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/motivation/badges')
      .then(r => setBadges(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error(t('motivation.loadBadgesFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleAward = async () => {
    if (!form.userId || !form.badgeType) { toast.error(t('motivation.selectEmployeeAndBadge')); return; }
    setSaving(true);
    try {
      await api.post('/motivation/badges', { ...form, periodLabel: nowLabel() });
      toast.success(t('motivation.badgeAwarded'));
      setShowModal(false);
      setForm({ userId:'', badgeType:'COMMITTED', note:'' });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || t('common.error')); }
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
        {Object.entries(BADGE_META).map(([key, meta]) => {
          const MetaIcon = meta.Icon;
          return (
            <div key={key} className={`rounded-2xl border p-3 text-center transition hover:shadow-soft ${(byType[key]||0) > 0 ? meta.cls : 'bg-background border-border text-text-soft/40'}`}>
              <MetaIcon size={24} aria-hidden="true" className="mx-auto mb-1" />
              <div className="text-xs font-extrabold">{t(`motivation.badgeTypes.${key}`)}</div>
              {(byType[key]||0) > 0 && (
                <div className="mt-1 text-[10px] font-bold opacity-70">{t('motivation.badgeCount', { count: byType[key] })}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-soft">
          {isManager ? t('motivation.teamBadgeCount', { count: myBadges.length }) : t('motivation.myBadgeCount', { count: myBadges.length })}
        </p>
        {isManager && (
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-dark transition">
            <Medal size={14} aria-hidden="true" /> {t('motivation.awardBadge')}
          </button>
        )}
      </div>

      {loading ? <Spinner /> : myBadges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
          <Award size={40} aria-hidden="true" className="mx-auto mb-3 text-text-soft/50" />
          <p className="font-bold text-text-main">{t('motivation.noBadges')}</p>
          <p className="mt-1 text-sm text-text-soft">
            {isManager ? t('motivation.noBadgesManager') : t('motivation.noBadgesEmployee')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {myBadges.map(b => {
            const meta = BADGE_META[b.badgeType] || { Icon: Award, cls:'bg-background text-text-soft border-border' };
            const MetaIcon = meta.Icon;
            const label = BADGE_META[b.badgeType] ? t(`motivation.badgeTypes.${b.badgeType}`) : b.badgeType;
            return (
              <div key={b.id} className={`rounded-2xl border p-4 shadow-card ${meta.cls}`}>
                <div className="flex items-start gap-3">
                  <MetaIcon size={30} aria-hidden="true" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm">{label}</p>
                    {BADGE_META[b.badgeType] && (
                      <p className="text-[11px] opacity-70 mt-0.5">{t(`motivation.badgeDesc.${b.badgeType}`)}</p>
                    )}
                    {isManager && (
                      <p className="mt-1 text-xs font-bold">{b.firstName} {b.lastName}</p>
                    )}
                    {b.note && <p className="mt-1 text-[11px] opacity-60">"{b.note}"</p>}
                    <p className="mt-1 text-[10px] opacity-50">
                      {b.periodLabel || ''} · {new Date(b.awardedAt).toLocaleDateString(intl, { day:'numeric', month:'short', year:'numeric' })}
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
            <h3 className="mb-4 inline-flex items-center gap-2 text-lg font-extrabold text-primary">
              <Medal size={20} aria-hidden="true" /> {t('motivation.awardBadgeTitle')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.employee')}</label>
                <select value={form.userId} onChange={e => setForm(p=>({...p,userId:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="">{t('motivation.selectEmployee')}</option>
                  {(users||[]).filter(u=>u.roles?.includes('EMPLOYEE')).map(u=>(
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.badgeType')}</label>
                <select value={form.badgeType} onChange={e => setForm(p=>({...p,badgeType:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  {Object.keys(BADGE_META).map((key)=>(
                    <option key={key} value={key}>{t(`motivation.badgeTypes.${key}`)} — {t(`motivation.badgeDesc.${key}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.noteOptional')}</label>
                <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                  placeholder={t('motivation.notePlaceholder')}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={handleAward} disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                {saving ? t('motivation.awarding') : t('motivation.awardBadgeConfirm')}
              </button>
              <button onClick={()=>setShowModal(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-soft hover:bg-background">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── القسم 2: بنك المبادرات ───────────────────────────────────────────────────

function IdeasSection({ isManager, currentUser, t, intl }) {
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
      .catch(() => toast.error(t('motivation.loadIdeasFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'ALL' ? ideas : ideas.filter(i => i.status === statusFilter);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error(t('motivation.titleDescRequired')); return; }
    setSaving(true);
    try {
      await api.post('/motivation/ideas', form);
      toast.success(t('motivation.ideaSubmitted'));
      setShowModal(false);
      setForm({ title:'', description:'', category:'general' });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || t('common.error')); }
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
    } catch { toast.error(t('common.error')); }
  };

  const handleReview = async (id) => {
    const rev = reviewing[id];
    if (!rev?.status) { toast.error(t('motivation.selectStatus')); return; }
    try {
      await api.put(`/motivation/ideas/${id}`, { action:'review', status: rev.status, reviewNotes: rev.notes });
      toast.success(t('motivation.statusUpdated'));
      setReviewing(p => { const n={...p}; delete n[id]; return n; });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || t('common.error')); }
  };

  const statusTabs = [
    { key:'ALL',          label:t('common.all'),                         count: ideas.length },
    { key:'PENDING',      label:t('motivation.ideaStatus.PENDING'),      count: ideas.filter(i=>i.status==='PENDING').length },
    { key:'UNDER_REVIEW', label:t('motivation.ideaStatus.UNDER_REVIEW'), count: ideas.filter(i=>i.status==='UNDER_REVIEW').length },
    { key:'APPROVED',     label:t('motivation.ideaStatus.APPROVED'),     count: ideas.filter(i=>i.status==='APPROVED').length },
    { key:'IMPLEMENTED',  label:t('motivation.ideaStatus.IMPLEMENTED'),  count: ideas.filter(i=>i.status==='IMPLEMENTED').length },
  ];

  return (
    <div className="space-y-4">
      {/* شريط الفلتر + زر الإضافة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition
                ${statusFilter===tab.key ? 'bg-primary text-white border-primary' : 'bg-background border-border text-text-soft hover:border-primary/40'}`}>
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition">
          <Lightbulb size={14} aria-hidden="true" /> {t('motivation.addIdea')}
        </button>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
          <Lightbulb size={40} aria-hidden="true" className="mx-auto mb-3 text-text-soft/50" />
          <p className="font-bold text-text-main">{t('motivation.noIdeas')}</p>
          <p className="mt-1 text-sm text-text-soft">{t('motivation.noIdeasHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(idea => {
            const smCls = IDEA_STATUS_CLS[idea.status] || IDEA_STATUS_CLS.PENDING;
            const smLabel = t(`motivation.ideaStatus.${idea.status}`);
            const rev = reviewing[idea.id] || {};
            return (
              <div key={idea.id} className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-text-soft bg-background border border-border rounded-full px-2 py-0.5">
                        {t(`motivation.ideaCategory.${idea.category}`) || idea.category}
                      </span>
                      <Badge label={smLabel} cls={smCls} />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* زر التأييد */}
                      <button onClick={() => handleSupport(idea.id)}
                        aria-label={t('motivation.support')}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition
                          ${idea.iSupported ? 'bg-primary-light text-primary border-primary/20' : 'border-border bg-background text-text-soft hover:border-primary/30'}`}>
                        <ThumbsUp size={13} aria-hidden="true" /> {idea.supportCount || 0}
                      </button>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-sm text-text-main mb-1">{idea.title}</h4>
                  <p className="text-xs text-text-soft line-clamp-2 leading-relaxed">{idea.description}</p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-text-soft">
                    <span className="font-bold">{idea.firstName} {idea.lastName}</span>
                    <span>{new Date(idea.createdAt).toLocaleDateString(intl, { day:'numeric', month:'short', year:'numeric' })}</span>
                  </div>

                  {idea.reviewNotes && (
                    <div className="mt-2 rounded-xl border border-primary/10 bg-primary-light/30 px-3 py-2 text-[11px] text-text-soft">
                      <span className="font-bold text-primary">{t('motivation.managementNote')} </span>{idea.reviewNotes}
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
                          <option value="">{t('motivation.changeStatus')}</option>
                          <option value="UNDER_REVIEW">{t('motivation.ideaStatus.UNDER_REVIEW')}</option>
                          <option value="APPROVED">{t('motivation.reviewApprove')}</option>
                          <option value="IMPLEMENTED">{t('motivation.reviewImplement')}</option>
                          <option value="REJECTED">{t('motivation.reviewReject')}</option>
                        </select>
                        {rev.status && (
                          <>
                            <input
                              value={rev.notes || ''}
                              onChange={e => setReviewing(p=>({...p,[idea.id]:{...rev,notes:e.target.value}}))}
                              placeholder={t('motivation.notePlaceholderShort')}
                              className="flex-1 min-w-[120px] rounded-xl border border-border px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                            />
                            <button onClick={()=>handleReview(idea.id)}
                              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark">
                              {t('common.save')}
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
            <h3 className="mb-4 inline-flex items-center gap-2 text-lg font-extrabold text-primary">
              <Lightbulb size={20} aria-hidden="true" /> {t('motivation.newIdeaTitle')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.ideaTitleLabel')} <span className="text-danger">*</span></label>
                <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                  placeholder={t('motivation.ideaTitlePlaceholder')}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.ideaDescLabel')} <span className="text-danger">*</span></label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                  rows={4} placeholder={t('motivation.ideaDescPlaceholder')}
                  className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.category')}</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="process">{t('motivation.categoryProcess')}</option>
                  <option value="technical">{t('motivation.categoryTechnical')}</option>
                  <option value="training">{t('motivation.categoryTraining')}</option>
                  <option value="general">{t('motivation.ideaCategory.general')}</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
                {saving ? t('motivation.submitting') : <><Check size={16} aria-hidden="true" /> {t('motivation.submitIdea')}</>}
              </button>
              <button onClick={()=>setShowModal(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-soft hover:bg-background">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── القسم 3: التحدي الشهري ──────────────────────────────────────────────────

function ChallengeSection({ isManager, currentUser, t, intl }) {
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
    if (!form.title.trim()) { toast.error(t('motivation.titleRequired')); return; }
    const tv = Number(form.targetValue);
    if (!tv || tv < 10 || tv > 100) { toast.error(t('motivation.targetRange')); return; }
    setSaving(true);
    try {
      await api.post('/motivation/challenges', { ...form, targetValue: tv, periodLabel: label });
      toast.success(t('motivation.challengeCreated'));
      setShowForm(false);
      setForm({ title:'', description:'', targetMetric:'timeliness', targetValue:'80' });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || t('common.error')); }
    finally { setSaving(false); }
  };

  const monthName = new Date().toLocaleString(intl, { month: 'long' });
  const metricLabel = (m) => t(`motivation.metric.${m}`);

  return (
    <div className="space-y-4">
      {loading ? <Spinner /> : !challenge ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
          <Target size={40} aria-hidden="true" className="mx-auto mb-3 text-text-soft/50" />
          <p className="font-bold text-text-main">{t('motivation.noChallenge', { month: monthName })}</p>
          <p className="mt-1 text-sm text-text-soft mb-4">
            {isManager ? t('motivation.noChallengeManager') : t('motivation.noChallengeEmployee')}
          </p>
          {isManager && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark">
              <Target size={16} aria-hidden="true" /> {t('motivation.launchChallenge')}
            </button>
          )}
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border shadow-card ${challenge.status === 'ACHIEVED' ? 'border-accent/30' : 'border-border'} bg-white`}>
          {challenge.status === 'ACHIEVED' && (
            <div className="bg-forest-50 border-b border-accent/20 px-5 py-3 text-center text-sm font-extrabold text-accent">
              <PartyPopper size={16} aria-hidden="true" className="inline me-1 align-text-bottom" /> {t('motivation.challengeAchieved', { month: monthName })}
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={24} aria-hidden="true" className="text-primary" />
                  <h3 className="text-xl font-extrabold text-text-main">{challenge.title}</h3>
                  <Badge label={t(`motivation.challengeStatus.${challenge.status}`)} cls={CHALLENGE_STATUS_CLS[challenge.status]} />
                </div>
                {challenge.description && <p className="text-sm text-text-soft mt-1">{challenge.description}</p>}
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary-light px-4 py-3 text-center min-w-[100px]">
                <p className="text-2xl font-extrabold text-primary">{challenge.targetValue}%</p>
                <p className="text-[10px] text-text-soft mt-0.5">{t('motivation.target')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-text-main">{metricLabel(challenge.targetMetric)}</span>
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
                  ? t('motivation.currentProgress', { current: Number(challenge.currentValue).toFixed(1), target: challenge.targetValue })
                  : t('motivation.noKpiYet')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* نموذج إنشاء تحدي */}
      {isManager && showForm && (
        <div className="rounded-2xl border border-primary/20 bg-white p-5 shadow-card">
          <h4 className="mb-4 inline-flex items-center gap-2 font-extrabold text-primary">
            <Target size={18} aria-hidden="true" /> {t('motivation.launchChallengeTitle', { month: monthName })}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.challengeTitleLabel')} <span className="text-danger">*</span></label>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                placeholder={t('motivation.challengeTitlePlaceholder')}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.targetMetric')}</label>
                <select value={form.targetMetric} onChange={e=>setForm(p=>({...p,targetMetric:e.target.value}))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  {['timeliness','quality','zero_returns','final_score'].map((k)=>(
                    <option key={k} value={k}>{t(`motivation.metric.${k}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.targetValueLabel')}</label>
                <input type="number" min="10" max="100" value={form.targetValue} onChange={e=>setForm(p=>({...p,targetValue:e.target.value}))}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-text-main">{t('motivation.challengeDescLabel')}</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                rows={2} placeholder={t('motivation.challengeDescPlaceholder')}
                className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
              {saving ? t('motivation.launching') : <><Rocket size={16} aria-hidden="true" /> {t('motivation.launchConfirm')}</>}
            </button>
            <button onClick={()=>setShowForm(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-soft hover:bg-background">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {isManager && !showForm && challenge && (
        <button onClick={() => setShowForm(true)}
          className="w-full rounded-xl border border-dashed border-primary/30 py-2.5 text-sm font-bold text-primary hover:bg-primary-light transition">
          {t('motivation.updateChallenge')}
        </button>
      )}
    </div>
  );
}

// ─── القسم 4: التعهد الشخصي ─────────────────────────────────────────────────

function PledgeSection({ isManager, currentUser, users, t, intl }) {
  const [pledge,      setPledge]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [form,        setForm]        = useState({ pledge1:'', pledge2:'', pledge3:'' });
  const [saving,      setSaving]      = useState(false);
  const [teamPledges, setTeamPledges] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [evaluating,  setEvaluating]  = useState({});
  const [showTeam,    setShowTeam]    = useState(false);

  const label = nowLabel();
  const monthName = new Date().toLocaleString(intl, { month: 'long' });

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
    if (!form.pledge1.trim()) { toast.error(t('motivation.pledge1Required')); return; }
    setSaving(true);
    try {
      await api.post('/motivation/pledges', { ...form, periodLabel: label });
      toast.success(t('motivation.pledgeSaved'));
      loadMine();
    } catch (e) { toast.error(e?.response?.data?.message || t('common.error')); }
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
      toast.success(t('motivation.evaluated', { rate: r.data.fulfillRate ?? '—' }));
      setEvaluating(p => { const n={...p}; delete n[pledgeId]; return n; });
      loadTeam();
    } catch { toast.error(t('common.error')); }
  };

  const FulfillDot = ({ val }) => (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full
      ${val === true ? 'bg-forest-50 text-accent border border-accent/20'
        : val === false ? 'bg-burgundy/10 text-danger border border-burgundy/20'
        : 'bg-background text-text-soft/40 border border-border'}`}>
      {val === true ? <Check size={11} aria-hidden="true" /> : val === false ? <X size={11} aria-hidden="true" /> : <Circle size={9} aria-hidden="true" />}
    </span>
  );

  const pledgeFields = [
    { key:'pledge1', label:t('motivation.pledge1'), req:true,  ph:t('motivation.pledge1Placeholder') },
    { key:'pledge2', label:t('motivation.pledge2'), req:false, ph:t('motivation.pledge2Placeholder') },
    { key:'pledge3', label:t('motivation.pledge3'), req:false, ph:t('motivation.pledge3Placeholder') },
  ];

  return (
    <div className="space-y-4">
      {loading ? <Spinner /> : !pledge ? (
        /* لم يُعبئ التعهد بعد */
        <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
          <div className="bg-gradient-to-l from-primary/5 to-white px-5 py-4 border-b border-border">
            <h3 className="inline-flex items-center gap-2 font-extrabold text-primary">
              <CalendarDays size={18} aria-hidden="true" /> {t('motivation.myPledges', { month: monthName })}
            </h3>
            <p className="text-xs text-text-soft mt-0.5">{t('motivation.pledgeIntro')}</p>
          </div>
          <div className="p-5 space-y-3">
            {pledgeFields.map(f => (
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
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60 transition">
              {saving ? t('common.saving') : <><HeartHandshake size={16} aria-hidden="true" /> {t('motivation.pledgeCommit')}</>}
            </button>
          </div>
        </div>
      ) : (
        /* عرض التعهد الحالي */
        <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
          <div className="bg-gradient-to-l from-primary/5 to-white px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="inline-flex items-center gap-2 font-extrabold text-primary">
                  <CalendarDays size={18} aria-hidden="true" /> {t('motivation.myPledges', { month: monthName })}
                </h3>
                {pledge.fulfillRate != null && (
                  <p className="text-xs text-text-soft mt-0.5">
                    {t('motivation.fulfillRate')} <span className="font-extrabold text-primary">{pledge.fulfillRate}%</span>
                  </p>
                )}
              </div>
              {pledge.fulfillRate === 100 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 border border-accent/20 px-3 py-1 text-xs font-extrabold text-accent">
                  <Medal size={14} aria-hidden="true" /> {t('motivation.pledgeKept')}
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
                {t('motivation.evaluatedAt')} {new Date(pledge.evaluatedAt).toLocaleDateString(intl, { day:'numeric', month:'short', year:'numeric' })}
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
            <h4 className="inline-flex items-center gap-2 font-extrabold text-text-main">
              <Users size={18} aria-hidden="true" /> {t('motivation.evaluateTeamPledges')}
            </h4>
            {showTeam
              ? <ChevronUp size={16} aria-hidden="true" className="text-text-soft" />
              : <ChevronDown size={16} aria-hidden="true" className="text-text-soft" />}
          </button>
          {showTeam && (
            <div className="border-t border-border p-4">
              {teamLoading ? <Spinner /> : teamPledges.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-soft">{t('motivation.noTeamPledges')}</p>
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
                          {t('motivation.saveEvaluation')}
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
  { key:'badges',    Icon: Award },
  { key:'ideas',     Icon: Lightbulb },
  { key:'challenge', Icon: Target },
  { key:'pledge',    Icon: CalendarDays },
];

export default function MotivationPage() {
  const { activeRole, user } = useAuth();
  const { t, locale } = useTranslation();
  const intl = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
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

  const monthName = new Date().toLocaleString(intl, { month: 'long' });

  const tabLabel = (key) => t(`motivation.tabs.${key}`);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس الصفحة */}
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary to-primary-dark text-white shadow-soft">
          <div className="relative px-6 py-6">
            <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold mb-1">
              <Sparkles size={24} aria-hidden="true" /> {t('motivation.title')}
            </h1>
            <p className="text-sm opacity-80 mb-4">{t('motivation.subtitle', { month: monthName })}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { Icon: Award,        label:t('motivation.tabs.badges'),    desc:t('motivation.bannerBadges') },
                { Icon: Lightbulb,    label:t('motivation.tabs.ideas'),     desc:t('motivation.bannerIdeas') },
                { Icon: Target,       label:t('motivation.tabs.challenge'), desc:t('motivation.bannerChallenge') },
                { Icon: CalendarDays, label:t('motivation.tabs.pledge'),    desc:t('motivation.bannerPledge') },
              ].map(item => {
                const ItemIcon = item.Icon;
                return (
                  <div key={item.label} className="rounded-xl bg-white/10 px-3 py-2">
                    <p className="inline-flex items-center gap-1.5 font-extrabold text-sm">
                      <ItemIcon size={15} aria-hidden="true" /> {item.label}
                    </p>
                    <p className="text-[11px] opacity-70">{item.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="pointer-events-none absolute -bottom-8 -start-8 h-32 w-32 rounded-full bg-white/5" />
          </div>
        </div>

        {/* التبويبات */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-card">
          <div className="flex min-w-max">
            {TABS.map(tabItem => {
              const TabIcon = tabItem.Icon;
              return (
                <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-6 py-3.5 text-sm font-bold transition whitespace-nowrap
                    ${tab === tabItem.key
                      ? 'border-primary text-primary bg-primary-light/30'
                      : 'border-transparent text-text-soft hover:text-primary hover:bg-background'}`}>
                  <TabIcon size={16} aria-hidden="true" />
                  {tabLabel(tabItem.key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* المحتوى */}
        {tab === 'badges'    && <BadgesSection   isManager={isManager||isSupervisor} currentUser={user} users={users} t={t} intl={intl} />}
        {tab === 'ideas'     && <IdeasSection    isManager={isManager||isSupervisor} currentUser={user} t={t} intl={intl} />}
        {tab === 'challenge' && <ChallengeSection isManager={isManager}              currentUser={user} t={t} intl={intl} />}
        {tab === 'pledge'    && <PledgeSection   isManager={isManager}               currentUser={user} users={users} t={t} intl={intl} />}

      </div>
    </MainLayout>
  );
}
