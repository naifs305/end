// =============================================================
// أدوات الإشراف في صفحة «رصيد الإنجاز»: أداء المشرفين، وطابور المشرف،
// وسجل الدورات المسندة (منه تُحتسب الدورات المسندة غير المسجّلة)
// =============================================================
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Crown, Lightbulb } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from '../../lib/i18n';

function fmtDur(t, hours) {
  if (hours == null || isNaN(Number(hours))) return '—';
  const h = Number(hours);
  if (h === 0)  return t('kpi.duration.instant');
  if (h < 1)    return t('kpi.duration.lessThanHour');
  if (h < 24)   return t('kpi.duration.hours', { n: Math.round(h) });
  const d = h / 24;
  return t('kpi.duration.days', { n: d < 2 ? d.toFixed(1) : Math.round(d) });
}


// ─── تقرير أداء المشرفين ─────────────────────────────────────────────────────

function SupervisorReport({ periodLabel }) {
  const { t } = useTranslation();
  const [data,    setData]    = useState([]);
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    api.get('/kpis/supervisor-performance', { params: { periodType: 'MONTHLY', periodLabel } })
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [show, periodLabel]);

  // مفاتيح الاستجابة (القيم تأتي بالعربية من الـ API) → ألوان + تسمية محلية
  const RESP_CFG = {
    'سريع جداً': { color: 'text-accent bg-forest-50 border-forest-200',     key: 'veryFast' },
    'مقبول':     { color: 'text-primary bg-primary-light border-primary/20', key: 'acceptable' },
    'بطيء':      { color: 'text-warning bg-sand/20 border-sand/50',          key: 'slow' },
    'متأخر':     { color: 'text-danger bg-burgundy/10 border-burgundy/30',   key: 'late' },
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-forest-200 bg-white shadow-card">
      <button
        onClick={() => setShow(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition"
      >
        <div className="flex items-center gap-2.5">
          <Crown size={18} aria-hidden="true" className="text-primary" />
          <div className="text-start">
            <h4 className="text-sm font-extrabold text-text-main">{t('kpi.supervisorReport.title')}</h4>
            <p className="text-[10px] text-text-soft">{t('kpi.supervisorReport.subtitle')}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-text-soft">
          {show ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {show ? t('kpi.hide') : t('kpi.show')}
        </span>
      </button>

      {show && (
        <div className="border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-soft">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t('common.loading')}
            </div>
          ) : !data.length ? (
            <div className="py-10 text-center text-sm text-text-soft">{t('kpi.supervisorReport.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['المشرف', 'إجمالي البت', 'معتمد', 'مُعاد', 'مرفوض', 'معدل الاعتماد', 'متوسط وقت البت', 'التقييم', 'معلّق عاجل 🔴'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-right font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(s => (
                    <tr key={s.userId} className="hover:bg-background transition">
                      <td className="px-3 py-2.5 font-bold text-text-main">{s.name}</td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-primary">{s.totalDecisions}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-accent">{s.approved}</td>
                      <td className="px-3 py-2.5 text-center text-warning">{s.returned}</td>
                      <td className="px-3 py-2.5 text-center text-danger">{s.rejected}</td>
                      <td className="px-3 py-2.5">
                        <div className="mb-0.5 h-1.5 w-full overflow-hidden rounded-full bg-forest-100">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${s.approvalRate}%` }} />
                        </div>
                        <span className="text-[10px] font-bold">{s.approvalRate}%</span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-text-main">
                        {s.avgResponseHours != null ? fmtDur(t, s.avgResponseHours) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RESP_CFG[s.responsiveness]?.color || 'bg-background text-text-soft border-border'}`}>
                          {s.responsiveness || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {s.pendingUrgent > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-burgundy/10 border border-burgundy/30 px-2 py-0.5 text-[10px] font-extrabold text-danger">
                            🔴 {s.pendingUrgent}
                          </span>
                        ) : s.pendingTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sand/10 border border-sand/40 px-2 py-0.5 text-[10px] font-bold text-warning">
                            ⏳ {s.pendingTotal}
                          </span>
                        ) : (
                          <span className="text-[10px] text-accent font-bold">✅</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── لوحة أداء المشرف الذاتية ────────────────────────────────────────────────

function MySupervisorStats() {
  const { t } = useTranslation();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/kpis/my-supervisor-stats')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-8 shadow-card text-sm text-text-soft">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      جاري تحميل إحصائياتك...
    </div>
  );

  if (!data) return null;

  const RESP_STYLE = {
    'سريع جداً': { bg: 'bg-forest-50 border-forest-200', text: 'text-accent',   icon: '⚡' },
    'مقبول':     { bg: 'bg-primary-light border-primary/20', text: 'text-primary', icon: '✅' },
    'بطيء':      { bg: 'bg-sand/20 border-sand/50',         text: 'text-warning', icon: '⏳' },
    'متأخر':     { bg: 'bg-burgundy/10 border-burgundy/30', text: 'text-danger',  icon: '🔴' },
  };
  const resp = RESP_STYLE[data.responsiveness] || { bg: 'bg-background border-border', text: 'text-text-soft', icon: '—' };

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-card">
      {/* الرأس */}
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-l from-primary/5 to-white px-5 py-3.5">
        <div>
          <h3 className="font-extrabold text-text-main">📋 لوحة أدائك كمشرف</h3>
          <p className="text-[10px] text-text-soft mt-0.5">مدى سرعتك في البت بعناصر فريقك</p>
        </div>
        {data.responsiveness && (
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${resp.bg} ${resp.text}`}>
            {resp.icon} {data.responsiveness}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* تنبيه العناصر العاجلة */}
        {data.urgentCount > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-burgundy/30 bg-burgundy/8 px-4 py-3.5">
            <span className="text-2xl shrink-0 mt-0.5">🔴</span>
            <div>
              <p className="font-extrabold text-danger text-sm">
                {data.urgentCount} عنصر ينتظر بتّك منذ أكثر من 3 أيام!
              </p>
              <p className="text-xs text-danger/70 mt-0.5">
                هذا التأخر يؤثر سلباً على سير العمل — يُنصح بمراجعتها الآن
              </p>
            </div>
          </div>
        )}

        {/* إشعار معتدل */}
        {data.urgentCount === 0 && data.moderateCount > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-sand/50 bg-sand/10 px-4 py-3.5">
            <span className="text-2xl shrink-0 mt-0.5">⏳</span>
            <div>
              <p className="font-extrabold text-warning text-sm">
                {data.moderateCount} عنصر بانتظار بتّك (بين يوم و3 أيام)
              </p>
              <p className="text-xs text-warning/70 mt-0.5">راجعها قريباً قبل أن تصبح عاجلة</p>
            </div>
          </div>
        )}

        {/* حالة جيدة */}
        {data.pendingTotal === 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3.5">
            <span className="text-2xl">✅</span>
            <p className="font-extrabold text-accent text-sm">أحسنت! لا توجد عناصر معلّقة بانتظار بتّك</p>
          </div>
        )}

        {/* الإحصائيات الأربع */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'إجمالي بتّاتك',    val: data.totalDecisions,  color: 'text-primary' },
            { label: 'معتمدة',            val: data.approved,        color: 'text-accent' },
            { label: 'معلّقة الآن',       val: data.pendingTotal,    color: data.pendingTotal > 0 ? 'text-warning' : 'text-text-soft' },
            { label: 'متوسط وقت البت',   val: data.avgResponseHours != null ? fmtDur(t, data.avgResponseHours) : '—', color: 'text-text-main' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="text-[10px] text-text-soft mb-0.5">{c.label}</p>
              <p className={`text-xl font-extrabold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* العناصر العاجلة */}
        {data.urgentItems?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-extrabold text-danger uppercase tracking-wide">
              🔴 عناصر عاجلة — تحتاج بتّك فوراً
            </h4>
            <div className="space-y-1.5">
              {data.urgentItems.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-burgundy/20 bg-burgundy/5 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-main truncate">
                      {item.executedBy?.firstName} {item.executedBy?.lastName}
                      <span className="text-text-soft font-normal"> · {item.element?.name}</span>
                    </p>
                    <p className="text-[10px] text-text-soft truncate">{item.course?.name}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold text-danger bg-burgundy/10 rounded-full px-2 py-0.5">
                    منذ {fmtDur(t, item.ageHours)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── سجل الإسناد التخطيطي ────────────────────────────────────────────────────

function AssignmentSection({ periodLabel, year, month }) {
  const { t } = useTranslation();
  const [show,    setShow]    = useState(false);
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState({});

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    api.get('/kpis/assignments', { params: { periodType: 'MONTHLY', year: Number(year), value: Number(month) } })
      .then(r => setRows(
        (r.data?.rows || []).map(row => ({
          ...row,
          inp: row.assignedCoursesCount == null ? '' : String(row.assignedCoursesCount),
          ni:  row.notes || '',
        })),
      ))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [show, periodLabel]);

  const upd = (uid, field, val) =>
    setRows(prev => prev.map(r => r.userId === uid ? { ...r, [field]: val } : r));

  const save = async (row) => {
    const count = Number(String(row.inp).trim());
    if (isNaN(count) || count < 0) { toast.error(t('kpi.assignment.invalidCount')); return; }
    setSaving(p => ({ ...p, [row.userId]: true }));
    try {
      await api.post('/kpis/assignments', {
        userId:               row.userId,
        periodType:           'MONTHLY',
        year:                 Number(year),
        value:                Number(month),
        assignedCoursesCount: count,
        notes:                row.ni || '',
      });
      toast.success(t('kpi.saved'));
    } catch {
      toast.error(t('kpi.saveFailed'));
    } finally {
      setSaving(p => ({ ...p, [row.userId]: false }));
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <button
        onClick={() => setShow(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList size={18} aria-hidden="true" className="text-primary" />
          <div className="text-start">
            <h4 className="text-sm font-extrabold text-text-main">{t('kpi.assignment.title')}</h4>
            <p className="text-[10px] text-text-soft">{t('kpi.assignment.subtitle')}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-text-soft">
          {show ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {show ? t('kpi.hide') : t('kpi.show')}
        </span>
      </button>

      {!show && (
        <div className="flex items-center gap-1.5 border-t border-border bg-sand/10 px-5 py-2 text-[10px] text-warning">
          <Lightbulb size={12} aria-hidden="true" /> {t('kpi.assignment.hint')}
        </div>
      )}

      {show && (
        <div className="border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-soft">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t('common.loading')}
            </div>
          ) : !rows.length ? (
            <div className="py-8 text-center text-sm text-text-soft">{t('kpi.assignment.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['employee','actual','planned','coverage','note','action'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-start font-bold">{h === 'action' ? '' : t(`kpi.assignment.col.${h}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.userId} className="hover:bg-background transition">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-text-main">{row.employeeName}</p>
                        <p className="text-[10px] text-text-soft">{row.projectName}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-primary">{row.actualCoursesCount}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min="0"
                          value={row.inp}
                          onChange={e => upd(row.userId, 'inp', e.target.value)}
                          className="w-16 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-primary transition"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${Number(row.courseRegistrationCoverageRate) >= 100 ? 'text-accent' : 'text-warning'}`}>
                          {Number(row.courseRegistrationCoverageRate).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          value={row.ni}
                          onChange={e => upd(row.userId, 'ni', e.target.value)}
                          className="w-36 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-primary transition"
                          placeholder={t('kpi.assignment.notePlaceholder')}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => save(row)}
                          disabled={!!saving[row.userId]}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition"
                        >
                          {saving[row.userId] ? '...' : t('common.save')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { SupervisorReport, MySupervisorStats, AssignmentSection };
