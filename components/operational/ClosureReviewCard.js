// ======================================================================
// تقييم صعوبات الإقفال — بطاقة في صفحة الدورة بعد إقفالها
// ----------------------------------------------------------------------
// سؤال واحد بإجابتين: «لم تواجهني صعوبات» أو «واجهت صعوبات». وفي الثانية
// يختار المنسق الإدارة، ثم نوع الصعوبة بنقرة، وأثرها وأيام التأخير.
// ومن مجموع التقييمات تُبنى لوحة «أداء الإدارات».
// ======================================================================
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck, ThumbsUp, AlertTriangle, Check, Save, Pencil, Building2 } from 'lucide-react';
import api from '../../lib/axios';

const unwrap = (r) => r?.data?.data ?? r?.data;

// تقييم مجمّع لكل إدارة: أنواعها المختارة، وأثر واحد، وأيام تأخير، وملاحظة،
// وكيف تجاوزها المنسق، وموضعها إن كانت في مقر التنفيذ
// القائمة تُنشأ جديدة لكل إدارة — لا تُشارك بين الإدارات
const emptyGroup = () => ({ types: [], labels: [], newLabel: '', impact: 'MEDIUM', delayDays: '', note: '', resolution: '', country: '', city: '', venue: '' });
function toGroups(issues = []) {
  const g = {};
  for (const i of issues) {
    g[i.department] = g[i.department] || {
      ...emptyGroup(), impact: i.impact || 'MEDIUM', delayDays: i.delayDays ?? '', note: i.note || '', resolution: i.resolution || '',
      country: i.country || '', city: i.city || '', venue: i.venue || '',
    };
    g[i.department].types.push(i.issueType);
    g[i.department].labels.push(i.issueLabel || i.issueType);
  }
  return g;
}

export default function ClosureReviewCard({ courseId }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // null | 'none' | 'issues'
  const [groups, setGroups] = useState({});
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/courses/${courseId}/closure-review`).then((r) => {
      if (!alive) return;
      const d = unwrap(r);
      setData(d);
      if (d.review) {
        setMode(d.review.noIssues ? 'none' : 'issues');
        setGroups(toGroups(d.review.issues));
        setNote(d.review.note || '');
      }
    }).catch(() => setData(null));
    return () => { alive = false; };
  }, [courseId]);

  if (!data || !data.eligible) return null;
  const { catalog, review, canEdit } = data;
  const deps = catalog.departments;
  const showForm = canEdit && (!review || editing);

  const toggleDep = (key) => setGroups((g) => {
    const next = { ...g };
    if (next[key]) delete next[key]; else next[key] = { ...emptyGroup(), city: deps.find((d) => d.key === key)?.location ? (data.course?.city || '') : '' };
    return next;
  });
  const setGroup = (key, patch) => setGroups((g) => ({ ...g, [key]: { ...g[key], ...patch } }));
  const toggleType = (dep, type) => setGroups((g) => {
    const types = g[dep].types.includes(type) ? g[dep].types.filter((t) => t !== type) : [...g[dep].types, type];
    return { ...g, [dep]: { ...g[dep], types } };
  });

  const save = async () => {
    const issues = mode === 'issues'
      ? Object.entries(groups).flatMap(([department, x]) => {
        const base = { department, impact: x.impact, delayDays: x.delayDays, note: x.note, resolution: x.resolution, country: x.country, city: x.city, venue: x.venue };
        const chosen = x.types.map((issueType) => ({ ...base, issueType }));
        // صعوبة لم تُذكر: تُضاف لقائمة الصعوبات فيجدها المنسق التالي
        if (x.newLabel.trim().length >= 4) chosen.push({ ...base, issueType: 'new', newLabel: x.newLabel.trim() });
        return chosen;
      })
      : [];
    if (mode === 'issues' && !issues.length) { toast.error('اختر الإدارة ونوع الصعوبة، أو اكتب صعوبة جديدة'); return; }
    setSaving(true);
    try {
      const d = unwrap(await api.put(`/courses/${courseId}/closure-review`, { noIssues: mode === 'none', note, issues }));
      setData(d);
      // الصعوبة الجديدة صارت نوعاً في القائمة: تُعاد المجموعات من المحفوظ
      setGroups(d.review ? toGroups(d.review.issues) : {});
      setEditing(false);
      toast.success('شكراً — سُجّل تقييمك');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر الحفظ');
    } finally { setSaving(false); }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-l from-primary-light/50 to-white px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white"><ClipboardCheck size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-text-main">تقييم صعوبات الإقفال</h2>
          <p className="text-xs text-text-soft">ما واجهته من الإدارات الأخرى حتى أقفلت الدورة — يبني مؤشر أداء الإدارات.</p>
        </div>
        {review && canEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-text-soft hover:bg-background hover:text-primary">
            <Pencil size={13} aria-hidden="true" /> تعديل
          </button>
        )}
      </div>

      {!showForm ? (
        <div className="p-5">
          {!review ? (
            <p className="text-sm text-text-soft">لم يُسجَّل تقييم لهذه الدورة بعد.</p>
          ) : review.noIssues ? (
            <p className="inline-flex items-center gap-2 text-sm font-bold text-primary"><ThumbsUp size={16} aria-hidden="true" /> لم تواجه المنسق صعوبات في إقفال هذه الدورة.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(toGroups(review.issues)).map(([dep, g]) => (
                <li key={dep} className="rounded-xl border border-border px-3 py-2.5 text-sm">
                  <p className="font-extrabold text-text-main">{deps.find((d) => d.key === dep)?.name || dep}</p>
                  <p className="text-text-soft">{g.labels.join('، ')}
                    {' · '}أثر {catalog.impacts.find((i) => i.key === g.impact)?.label}{g.delayDays !== '' && g.delayDays !== null ? ` · تأخير ${g.delayDays} يوم` : ''}</p>
                  {(g.venue || g.city || g.country) && <p className="mt-0.5 text-xs text-text-soft">📍 {[g.venue, g.city, g.country].filter(Boolean).join('، ')}</p>}
                  {g.note && <p className="mt-0.5 text-xs text-text-soft">«{g.note}»</p>}
                  {g.resolution && <p className="mt-0.5 text-xs text-primary">✔ تجاوزها بـ: {g.resolution}</p>}
                </li>
              ))}
            </ul>
          )}
          {review?.note && <p className="mt-3 text-xs text-text-soft">ملاحظة عامة: {review.note}</p>}
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setMode('none')} aria-pressed={mode === 'none'}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-start transition ${mode === 'none' ? 'border-primary bg-primary-light/50' : 'border-border hover:border-primary/40'}`}>
              <ThumbsUp size={22} aria-hidden="true" className="text-primary" />
              <span><b className="block text-sm text-text-main">لم تواجهني صعوبات</b><span className="text-xs text-text-soft">كل الإدارات تعاونت في وقتها</span></span>
            </button>
            <button type="button" onClick={() => setMode('issues')} aria-pressed={mode === 'issues'}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-start transition ${mode === 'issues' ? 'border-warning bg-sand/15' : 'border-border hover:border-warning/40'}`}>
              <AlertTriangle size={22} aria-hidden="true" className="text-warning" />
              <span><b className="block text-sm text-text-main">واجهت صعوبات</b><span className="text-xs text-text-soft">حدّد الإدارة ونوع الصعوبة</span></span>
            </button>
          </div>

          {mode === 'issues' && (
            <>
              <div>
                <p className="mb-2 text-xs font-extrabold text-text-main">من أي إدارة؟ <span className="font-normal text-text-soft">— اختر واحدة أو أكثر</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {deps.map((d) => (
                    <button key={d.key} type="button" onClick={() => toggleDep(d.key)} aria-pressed={!!groups[d.key]}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${groups[d.key] ? 'border-warning bg-sand/20 text-warning' : 'border-border text-text-soft hover:border-warning/40'}`}>
                      {groups[d.key] ? <Check size={12} aria-hidden="true" /> : <Building2 size={12} aria-hidden="true" />} {d.name}
                    </button>
                  ))}
                </div>
              </div>
              {Object.entries(groups).map(([key, g]) => {
                const dep = deps.find((d) => d.key === key);
                return (
                  <div key={key} className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-sm font-extrabold text-text-main">{dep?.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dep?.issues.filter((i) => i.key !== 'other' || g.types.includes('other')).map((i) => (
                        <button key={i.key} type="button" onClick={() => toggleType(key, i.key)} aria-pressed={g.types.includes(i.key)} title={i.custom ? `أضافها زميل — اختيرت ${i.uses || 1} مرة` : ''}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${g.types.includes(i.key) ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-main hover:border-primary/40'}`}>
                          {i.label}{i.custom && <span className={`ms-1 text-[10px] ${g.types.includes(i.key) ? 'text-white/80' : 'text-warning'}`}>✦</span>}
                        </button>
                      ))}
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-text-soft">صعوبة لم تُذكر؟ اكتبها — تُضاف للقائمة فيجدها زملاؤك بعدك</span>
                      <input value={g.newLabel} maxLength={120} onChange={(e) => setGroup(key, { newLabel: e.target.value })} placeholder="مثال: تأخر موافقة المعالي من مكتب الوكيل"
                        className="w-full rounded-xl border border-dashed border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary" />
                    </label>
                    {dep?.location && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {[['country', 'الدولة', 'إسبانيا'], ['city', 'المدينة', 'مدريد'], ['venue', 'مقر التنفيذ', 'اسم الفندق أو المركز']].map(([f, l, ph]) => (
                          <label key={f} className="block">
                            <span className="mb-1 block text-[11px] font-bold text-text-soft">{l}</span>
                            <input value={g[f]} maxLength={120} onChange={(e) => setGroup(key, { [f]: e.target.value })} placeholder={ph}
                              className="w-full rounded-xl border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary" />
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-[auto_120px_1fr] sm:items-end">
                      <div>
                        <p className="mb-1 text-[11px] font-bold text-text-soft">أثرها على الإقفال</p>
                        <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
                          {catalog.impacts.map((im) => (
                            <button key={im.key} type="button" onClick={() => setGroup(key, { impact: im.key })} aria-pressed={g.impact === im.key}
                              className={`rounded-full px-3 py-1 text-xs font-bold ${g.impact === im.key ? (im.key === 'HIGH' ? 'bg-danger text-white' : im.key === 'MEDIUM' ? 'bg-warning text-white' : 'bg-primary text-white') : 'text-text-soft'}`}>
                              {im.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-text-soft">أيام التأخير</span>
                        <input type="number" min="0" max="365" inputMode="numeric" value={g.delayDays} onChange={(e) => setGroup(key, { delayDays: e.target.value })} placeholder="اختياري"
                          className="w-full rounded-xl border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-text-soft">ملاحظة</span>
                        <input value={g.note} maxLength={500} onChange={(e) => setGroup(key, { note: e.target.value })} placeholder="اختياري — مثال: وصلت الأسماء قبل الدورة بيوم"
                          className="w-full rounded-xl border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-text-soft">كيف تجاوزتها؟ <span className="font-normal">— اختياري، وتنفع زملاءك في «مساعد التنفيذ»</span></span>
                      <input value={g.resolution} maxLength={500} onChange={(e) => setGroup(key, { resolution: e.target.value })} placeholder="مثال: نسّقنا مع الفندق لتوفير خط إنترنت مستقل للقاعة"
                        className="w-full rounded-xl border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary" />
                    </label>
                  </div>
                );
              })}
            </>
          )}

          {mode && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-text-main">ملاحظة عامة <span className="font-normal text-text-soft">— اختيارية</span></span>
                <input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                  <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : 'حفظ التقييم'}
                </button>
                {review && <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-text-soft hover:bg-background">إلغاء</button>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
