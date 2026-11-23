import { useState, useEffect, useCallback } from 'react';
import { OctagonPause, PlayCircle, AlertTriangle, Clock3, X } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

// ======================================================================
// لوحة بلاغ العائق على عنصر إقفال
// ----------------------------------------------------------------------
// البلاغ يُرفع والمنسق منتظر — لا بعد فوات الموعد. فالساعة تتوقف من
// لحظة الرفع لا من تاريخ يكتبه بيده، ومَن سكت طوال الانتظار لا يحقّ
// له الادّعاء بعدها. ولذلك نُظهر له أثر توقيت بلاغه قبل أن يرفعه.
// ======================================================================

const REASONS = [
  { value: 'TRAINER_GRADES', label: 'تأخر تسجيل الدرجات من المدرب', partyHint: 'اسم المدرب' },
  { value: 'TRAINEE_NAMES', label: 'تأخر استلام أسماء المتدربين', partyHint: 'الإدارة المسؤولة' },
  { value: 'INSURANCE_SUSPENDED', label: 'إيقاف إصدار التأمين الطبي', partyHint: 'الجهة المسؤولة' },
  { value: 'FINANCE_PENDING', label: 'بانتظار إجراء مالي', partyHint: 'الجهة المالية' },
  { value: 'BENEFICIARY_PENDING', label: 'بانتظار الجهة المستفيدة', partyHint: 'اسم الجهة المستفيدة' },
  { value: 'CERTIFICATE_TYPE_PENDING', label: 'بانتظار تحديد نوع الشهادة', partyHint: 'إدارة تصميم البرامج التدريبية' },
  { value: 'OTHER', label: 'سبب آخر', partyHint: 'الجهة المنتظَرة' },
];

const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));

function daysSince(date) {
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function Spinner() {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />;
}

export default function BlockerPanel({ element, canAct, canOversee = false, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState(null);
  const [reason, setReason] = useState('TRAINER_GRADES');
  const [party, setParty] = useState('');
  const [details, setDetails] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const blockers = element.blockers || [];
  const openBlocker = blockers.find((b) => b.status === 'OPEN');
  const creditedPast = blockers.filter((b) => b.status === 'RESOLVED' && b.isCredited);
  const pendingDecision = blockers.find((b) => b.credit === 'QUOTA_EXCEEDED_PENDING');

  const canRaise = canAct
    && !openBlocker
    && ['NOT_STARTED', 'RETURNED'].includes(element.status);

  const loadQuota = useCallback(() => {
    api.get('/blockers/quota')
      .then((res) => setQuota(res.data || null))
      .catch(() => setQuota(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    loadQuota();
  }, [open, loadQuota]);

  // أثر توقيت البلاغ — يُعرض قبل الرفع لا بعده
  const dl = element.deadlines || {};
  const now = Date.now();
  const pastIdeal = dl.idealDeadline && now > new Date(dl.idealDeadline).getTime();
  const pastMax = dl.maxDeadline && now > new Date(dl.maxDeadline).getTime();

  async function handleRaise() {
    if (party.trim().length < 3) return toast.error('اكتب اسم الجهة المنتظَرة');
    if (details.trim().length < 10) return toast.error('اكتب تفصيل العائق');

    setLoading(true);
    try {
      const res = await api.post('/blockers', {
        trackingId: element.id,
        reason,
        awaitedParty: party.trim(),
        details: details.trim(),
      });
      const warnings = res.data?.warnings || [];
      if (warnings.length) {
        warnings.forEach((w) => toast(w.message, { icon: '⚠️', duration: 6000 }));
      } else {
        toast.success('رُفع البلاغ — الساعة متوقفة من الآن');
      }
      setOpen(false);
      setParty('');
      setDetails('');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر رفع البلاغ');
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve() {
    setLoading(true);
    try {
      await api.post(`/blockers/${openBlocker.id}/resolve`, {});
      toast.success('أُغلق البلاغ — عادت الساعة');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر إغلاق البلاغ');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      await api.post(`/blockers/${openBlocker.id}/cancel`, {});
      toast.success('سُحب البلاغ');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر سحب البلاغ');
    } finally {
      setLoading(false);
    }
  }

  // رفض بلاغ غير صحيح (للمدير ومشرف المشروع): يُلغى أثره على المواعيد
  async function handleReject() {
    if (rejectNote.trim().length < 5) return toast.error('اكتب سبب الرفض — يصل للمنسق');
    setLoading(true);
    try {
      await api.post(`/blockers/${openBlocker.id}/cancel`, { note: rejectNote.trim() });
      toast.success('رُفض البلاغ — عادت المواعيد كأنه لم يُرفع، وأُبلغ المنسق');
      setRejecting(false);
      setRejectNote('');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر رفض البلاغ');
    } finally {
      setLoading(false);
    }
  }

  const selectedReason = REASONS.find((r) => r.value === reason) || REASONS[0];

  // الجذر «شفاف» في التخطيط: زر الرفع يجلس في سطر أزرار ذيل البطاقة،
  // وما سواه (البلاغ القائم، والنموذج) يأخذ سطراً كاملاً تحته.
  return (
    <div className="contents">
      {/* ── بلاغ قائم ── */}
      {openBlocker && (
        <div className="order-last w-full rounded-xl border border-sand/50 bg-sand/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-warning">
                <OctagonPause size={14} aria-hidden="true" />
                متوقّف بانتظار: {openBlocker.awaitedParty}
              </p>
              <p className="mt-1 text-[11px] text-text-soft">
                {REASON_LABEL[openBlocker.reason] || openBlocker.reason}
                {' · '}
                منذ {daysSince(openBlocker.raisedAt)} يوم
                {openBlocker.isCredited
                  ? ' · الساعة متوقفة'
                  : ' · بانتظار قرار المدير قبل احتسابه'}
              </p>
              {openBlocker.details && (
                <p className="mt-1 text-[11px] text-text-main">{openBlocker.details}</p>
              )}
            </div>
            {!canAct && canOversee && !rejecting && (
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="shrink-0 rounded-lg border border-danger/40 bg-white px-2.5 py-1.5 text-[11px] font-bold text-danger transition hover:bg-danger/5"
              >
                رفض البلاغ
              </button>
            )}
            {canAct && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  <PlayCircle size={13} aria-hidden="true" /> زال العائق
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="text-[11px] text-text-soft underline hover:text-danger"
                >
                  سحب
                </button>
              </div>
            )}
          </div>
          {rejecting && (
            <div className="mt-2 space-y-2 border-t border-sand/40 pt-2">
              <p className="text-[11px] text-text-soft">
                رفض البلاغ يُلغي أثره: تسري مواعيد العنصر كأنه لم يُرفع، ويصل السبب للمنسق.
              </p>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                maxLength={600}
                placeholder="سبب الرفض — مثلاً: لا عائق فعلي، والمطلوب رفع المستحقات"
                className="w-full resize-none rounded-lg border border-sand/40 bg-white p-2 text-xs outline-none focus:border-danger"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleReject} disabled={loading} className="rounded-lg bg-danger px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                  {loading ? <Spinner /> : 'تأكيد الرفض'}
                </button>
                <button type="button" onClick={() => { setRejecting(false); setRejectNote(''); }} className="rounded-lg border border-border px-3 py-1 text-xs text-text-soft">
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── بلاغات سابقة أثّرت في الموعد ── */}
      {!openBlocker && creditedPast.length > 0 && dl.maxPauseHours > 0 && (
        <p className="order-last flex w-full items-center gap-1.5 text-[11px] text-text-soft">
          <Clock3 size={12} aria-hidden="true" />
          أُجّل الموعد {Math.round(dl.maxPauseHours / 24)} يوم بسبب {creditedPast.length} بلاغ عائق سابق
        </p>
      )}

      {pendingDecision && !openBlocker && (
        <p className="order-last flex w-full items-center gap-1.5 text-[11px] text-warning">
          <AlertTriangle size={12} aria-hidden="true" />
          بلاغ بانتظار قرار المدير — تجاوز رصيدك الفصلي
        </p>
      )}

      {/* ── زر رفع البلاغ ── */}
      {canRaise && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ms-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold text-text-soft transition hover:bg-white hover:text-warning"
        >
          <OctagonPause size={15} aria-hidden="true" /> أبلغ عن عائق
        </button>
      )}

      {/* ── نموذج البلاغ ── */}
      {canRaise && open && (
        <div className="order-last w-full space-y-3 rounded-xl border border-sand/50 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-text-main">بلاغ عائق</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="text-text-soft hover:text-danger">
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <p className="rounded-lg bg-primary-light/60 p-2 text-[11px] leading-relaxed text-primary">
            البلاغ يُسجَّل باسم الجهة التي تنتظرها ويصل المشرف والمدير فوراً،
            وتُرسل للجهة قائمة أسبوعية بما هو متوقّف لديها.
          </p>

          {/* أثر التوقيت — يراه قبل أن يرفع */}
          {pastMax ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-danger/10 p-2 text-[11px] text-danger">
              <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
              فات الموعد الأقصى — البلاغ يُسجَّل للمتابعة ولا يرفع العقوبة.
            </p>
          ) : pastIdeal ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-sand/20 p-2 text-[11px] text-warning">
              <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
              فات الموعد المثالي — البلاغ يرفع العقوبة ولا يُعيد درجة التميّز.
            </p>
          ) : (
            <p className="rounded-lg bg-accent/10 p-2 text-[11px] text-accent">
              أنت تبلّغ في وقته — الموعدان معاً يتأجّلان بمدة العائق.
            </p>
          )}

          {quota && (
            <p className={`text-[11px] ${quota.exhausted ? 'text-warning' : 'text-text-soft'}`}>
              رصيدك هذا الفصل: {quota.used} من {quota.quota}
              {quota.exhausted
                ? ' — تجاوزت الرصيد، البلاغ يحتاج قرار المدير ليُحتسب.'
                : ` · المتبقي ${quota.remaining}`}
            </p>
          )}

          <div>
            <label htmlFor={`blocker-reason-${element.id}`} className="mb-1 block text-[11px] font-bold text-text-main">سبب التوقف</label>
            <select
              id={`blocker-reason-${element.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-sand/40 bg-white p-2 text-xs text-text-main outline-none focus:border-primary"
            >
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor={`blocker-party-${element.id}`} className="mb-1 block text-[11px] font-bold text-text-main">
              الجهة المنتظَرة <span className="font-normal text-text-soft">({selectedReason.partyHint})</span>
            </label>
            <input
              id={`blocker-party-${element.id}`}
              value={party}
              onChange={(e) => setParty(e.target.value)}
              maxLength={120}
              placeholder={selectedReason.partyHint}
              className="w-full rounded-lg border border-sand/40 bg-white p-2 text-xs text-text-main outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor={`blocker-details-${element.id}`} className="mb-1 block text-[11px] font-bold text-text-main">التفصيل</label>
            <textarea
              id={`blocker-details-${element.id}`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="ما الذي تنتظره تحديداً؟ ومتى طلبته؟"
              className="w-full resize-none rounded-lg border border-sand/40 bg-white p-2 text-xs text-text-main outline-none focus:border-primary"
            />
            <p className="mt-1 text-end text-[10px] text-text-soft">{details.length}/600</p>
          </div>

          <button
            type="button"
            onClick={handleRaise}
            disabled={loading}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <><Spinner /> جارٍ الرفع</> : <><OctagonPause size={14} aria-hidden="true" /> رفع البلاغ وإيقاف الساعة</>}
          </button>
        </div>
      )}
    </div>
  );
}
