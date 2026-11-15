import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  AlertTriangle,
  FileText,
  FileCheck,
  Coins,
  Hourglass,
  Upload,
  Check,
  Minus,
  Printer,
  Mail,
  Pencil,
  ArrowLeft,
  Undo2,
  Clock,
  CalendarClock,
  ThumbsUp,
  ThumbsDown,
  Star,
  Trash2,
} from 'lucide-react';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import MainLayout from '../../components/layout/MainLayout';
import ElementRow from '../../components/operational/ElementRow';
import CourseNotesReportForm from '../../components/operational/CourseNotesReportForm';
import toast from 'react-hot-toast';
import { useTranslation } from '../../lib/i18n';
import { useOptions } from '../../lib/hooks/useOptions';
import ReasonModal from '../../components/operational/ReasonModal';
import TimeRing, { ringFor, RING_TONE } from '../../components/operational/TimeRing';

// ── أنماط الحالات (التسميات من الترجمة) ───────────────────────────────
const STATUS_META = {
  DRAFT: { cls: 'bg-border/60 text-text-soft', border: '#D7DBDA' },
  PREPARATION: { cls: 'bg-sand/20 text-warning border-sand/40', border: '#C3B39F' },
  EXECUTION: { cls: 'bg-primary-light text-primary border-primary/20', border: '#253C32' },
  IN_PROGRESS: { cls: 'bg-primary-light text-primary border-primary/20', border: '#253C32' },
  AWAITING_CLOSURE: { cls: 'bg-sand/30 text-warning border-sand/50', border: '#8B7D6B' },
  CLOSED: { cls: 'bg-forest-50 text-accent border-accent/20', border: '#5D8A70' },
  ARCHIVED: { cls: 'bg-border text-text-soft border-border', border: '#9DA3A1' },
};

const EL_STATUS_META = {
  NOT_STARTED: { cls: 'bg-background text-text-soft border-border', border: '#D7DBDA' },
  PENDING_APPROVAL: { cls: 'bg-primary-light text-primary border-primary/20', border: '#253C32' },
  APPROVED: { cls: 'bg-forest-50 text-accent border-accent/30', border: '#5D8A70' },
  RETURNED: { cls: 'bg-sand/20 text-warning border-sand/40', border: '#C3B39F' },
  REJECTED: { cls: 'bg-burgundy/10 text-danger border-burgundy/20', border: '#633646' },
  NOT_APPLICABLE: { cls: 'bg-border/40 text-text-soft/60 border-border/40', border: '#E5E7E6' },
};

const ELEMENT_ORDER = {
  trainee_registration: 1, registration_message: 2, medical_insurance: 3, advance_req: 4, pre_test: 5,
  opening_report: 6, reaction_evaluation: 7, post_test: 8, certificates: 9,
  closing_report: 10, report: 10, supervisor_compensation: 11, trainer_compensation: 12,
  revenues: 13, materials: 14, settlement: 15,
  // مترجم الدورة: العقد مبكّر مع التجهيز، والمستحقات والشهادة بعد الانتهاء
  interpreter_contract: 4.5,
  interpreter_transfer: 12.5,
  interpreter_advance: 12.6,
  interpreter_certificate: 12.7,
};


const CRITICAL_ELEMENTS = new Set(['opening_report', 'closing_report', 'settlement']);
const CRITICAL_ICON = { opening_report: FileText, closing_report: FileCheck, settlement: Coins };

function fmt(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ar-SA-u-ca-gregory', { day:'numeric', month:'short', year:'numeric' });
}
function fmtFull(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('ar-SA-u-ca-gregory', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── بطاقة معلومة مصغّرة ───────────────────────────────────────────────
function Pill({ label, value, wide }) {
  return (
    <div className={`rounded-xl border border-border bg-background px-3 py-2 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-text-soft/60">{label}</p>
      <div className="text-sm font-bold leading-snug text-text-main break-words">{value}</div>
    </div>
  );
}

function Badge({ label, cls, small }) {
  if (!cls) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-bold ${small ? 'text-[10px]' : 'text-xs'} ${cls}`}>
      {label}
    </span>
  );
}

function YesNo({ value }) {
  return value ? <Check size={14} className="text-accent" aria-hidden="true" /> : <Minus size={14} className="text-text-soft/50" aria-hidden="true" />;
}

// ======================================================================
// بطاقة الإدخال المتأخر
// ----------------------------------------------------------------------
// التأخير قاسته المنصة بنفسها، فلا نقاش فيه. والمعروض للقرار هو
// المبرر وحده — والدورة مضافة في كل حال.
// ======================================================================
function LateEntryCard({ course, isManager, onDecided }) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');

  const days = Math.max(0, Math.round((course.lateEntryHours || 0) / 24));
  const status = course.lateEntryStatus;

  async function decide(accept) {
    if (!accept && note.trim().length < 5) {
      toast.error('اكتب سبب الرفض');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/courses/${course.id}/late-entry-decision`, { accept, note: note.trim() });
      toast.success(accept ? 'قُبل المبرر — لا ملاحظة على المنسق' : 'رُفض المبرر — سُجّلت نقطة');
      setRejectOpen(false);
      setNote('');
      onDecided?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر حفظ القرار');
    } finally {
      setBusy(false);
    }
  }

  const tone = status === 'ACCEPTED'
    ? 'border-accent/30 bg-accent/5'
    : status === 'REJECTED'
      ? 'border-burgundy/30 bg-burgundy/5'
      : 'border-sand/50 bg-sand/10';

  return (
    <div className={`rounded-2xl border p-4 shadow-card ${tone}`}>
      <div className="flex items-start gap-3">
        <CalendarClock size={22} aria-hidden="true" className="shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-text-main">
            أُدخلت هذه الدورة متأخرة بـ{days} يوم
            {status === 'ACCEPTED' && <span className="text-accent"> — قُبل المبرر</span>}
            {status === 'REJECTED' && <span className="text-danger"> — رُفض المبرر</span>}
            {status === 'PENDING' && <span className="text-warning"> — بانتظار قرار المدير</span>}
          </p>

          {course.lateEntryReason && (
            <p className="mt-1.5 text-xs leading-relaxed text-text-main">
              <span className="font-bold text-text-soft">مبرر المنسق:</span> {course.lateEntryReason}
            </p>
          )}

          {course.lateEntryDecisionNote && (
            <p className="mt-1 text-xs leading-relaxed text-text-soft">
              <span className="font-bold">قرار المدير:</span> {course.lateEntryDecisionNote}
            </p>
          )}

          {status === 'ACCEPTED' && (
            <p className="mt-2 text-[11px] text-accent">
              العناصر التي فات موعدها قبل الإدخال لا تُحتسب في توقيت المنسق.
            </p>
          )}
          {status === 'REJECTED' && (
            <p className="mt-2 text-[11px] text-danger">
              المواعيد محتسبة من تواريخ الدورة الأصلية، ونقطة متدرّجة على الانضباط.
            </p>
          )}

          {isManager && status === 'PENDING' && (
            <div className="mt-3">
              {!rejectOpen ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => decide(true)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    <ThumbsUp size={14} aria-hidden="true" /> قبول المبرر
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectOpen(true)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-burgundy/30 bg-white px-3 py-2 text-xs font-bold text-danger transition hover:bg-burgundy/5 disabled:opacity-50"
                  >
                    <ThumbsDown size={14} aria-hidden="true" /> رفض وتسجيل نقطة
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={600}
                    placeholder="سبب رفض المبرر — يصل المنسق"
                    className="w-full resize-none rounded-lg border border-sand/40 bg-white p-2 text-xs text-text-main outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(false)}
                      disabled={busy}
                      className="rounded-xl bg-danger px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      تأكيد الرفض
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectOpen(false); setNote(''); }}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-soft"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { activeRole, user } = useAuth();
  const { t, locale } = useTranslation();
  const { options: locationOptions } = useOptions('LOCATION_TYPE');

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotesReport, setShowNotesReport] = useState(false);

  const isCoordinator = course?.primaryEmployeeId && user?.id === course.primaryEmployeeId;
  const isApprover = activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
  const isManager = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const intl = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
  const fmt = (date) => (date ? new Date(date).toLocaleDateString(intl, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
  const fmtFull = (date) => (date ? new Date(date).toLocaleString(intl, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

  const courseStatusLabel = (status) => t(`courseStatus.${status === 'DRAFT' ? 'PREPARATION' : status === 'IN_PROGRESS' ? 'EXECUTION' : status}`);
  const elStatusLabel = (status) => t(`elementStatus.${status}`);
  const criticalLabel = (key) => t(`courseDetail.criticalLabels.${key}`);

  useEffect(() => {
    if (id) fetchCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCourse = async () => {
    try {
      const res = await api.get(`/courses/${id}`);
      setCourse(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReportDownload = async (elementId) => {
    try {
      const res = await api.get(`/closure/${elementId}/export`, { responseType: 'text', headers: { Accept: 'text/html' } });
      const w = window.open('', '_blank');
      if (!w) {
        toast.error(t('courseDetail.printWindowFailed'));
        return;
      }
      w.document.open();
      w.document.write(res.data);
      w.document.close();
    } catch {
      toast.error(t('courseDetail.openReportFailed'));
    }
  };

  const handleReportEmlDownload = async (elementId, elementKey) => {
    try {
      const res = await api.get(`/closure/${elementId}/export-eml`, { responseType: 'blob', headers: { Accept: 'message/rfc822' } });
      const fallback = elementKey === 'opening_report' ? 'opening-report.eml' : 'closing-report.eml';
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] || fallback;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('courseDetail.fileDownloaded'));
    } catch {
      toast.error(t('courseDetail.emlFailed'));
    }
  };

  // ── عنصر التميّز: توثيق الدورة (اختياري، لا يدخل في الإقفال) ──
  const [docSummary, setDocSummary] = useState(null);
  useEffect(() => {
    if (!id) return;
    api.get(`/courses/${id}/documentation`)
      .then((res) => setDocSummary(res?.data?.data ?? res?.data))
      .catch(() => setDocSummary(null));
  }, [id]);

  const sortedElements = useMemo(() => {
    if (!course?.closureElements) return [];
    return [...course.closureElements].sort((a, b) => (ELEMENT_ORDER[a.element?.key] ?? 999) - (ELEMENT_ORDER[b.element?.key] ?? 999));
  }, [course]);

  const activeElements = useMemo(() => sortedElements.filter((el) => ['NOT_STARTED', 'RETURNED', 'REJECTED'].includes(el.status)), [sortedElements]);
  const completedElements = useMemo(() => sortedElements.filter((el) => ['PENDING_APPROVAL', 'APPROVED'].includes(el.status)), [sortedElements]);
  const notApplicableElements = useMemo(() => sortedElements.filter((el) => el.status === 'NOT_APPLICABLE'), [sortedElements]);

  const progress = useMemo(() => {
    const rel = sortedElements.filter((el) => el.status !== 'NOT_APPLICABLE');
    if (!rel.length) return 0;
    const done = rel.filter((el) => ['PENDING_APPROVAL', 'APPROVED'].includes(el.status)).length;
    return Math.round((done / rel.length) * 100);
  }, [sortedElements]);

  // المواعيد تأتي محسوبة من الخادم (lib/shared/deadlines) ولا تُحسب هنا.
  // كانت الشاشة تحسبها بنفسها فتتجاهل أيام العمل وبلاغات العوائق،
  // فيرى المنسق موعداً ويُحاسَب على آخر.
  const calcDeadline = (el) => (el.deadlines?.maxDeadline ? new Date(el.deadlines.maxDeadline) : null);
  const calcIdealDeadline = (el) => (el.deadlines?.idealDeadline ? new Date(el.deadlines.idealDeadline) : null);
  const isPaused = (el) => !!el.deadlines?.hasOpenBlocker;
  const isOverdue = (el) => {
    if (['APPROVED', 'NOT_APPLICABLE', 'PENDING_APPROVAL'].includes(el.status)) return false;
    // الموقوف ببلاغ عائق قائم ليس متأخراً — صاحبه أبلغ قبل الموعد
    if (isPaused(el)) return false;
    return !!el.deadlines?.isOverdue;
  };
  const supervisorWaitHours = (el) => {
    if (el.status !== 'PENDING_APPROVAL' || !el.executionAt) return null;
    return Math.round((Date.now() - new Date(el.executionAt).getTime()) / 3600000);
  };

  const optionalElements = useMemo(() => sortedElements.filter((el) => el.element?.elementType === 'OPTIONAL'), [sortedElements]);
  const approvedElements = useMemo(() => sortedElements.filter((el) => el.status === 'APPROVED'), [sortedElements]);
  const exemptableElements = useMemo(() => sortedElements.filter((el) => el.status !== 'NOT_APPLICABLE'), [sortedElements]);
  const exemptedByManager = useMemo(() => sortedElements.filter((el) => el.status === 'NOT_APPLICABLE' && el.overriddenById), [sortedElements]);

  const reportElements = useMemo(() =>
    sortedElements.filter(el => ['opening_report','closing_report'].includes(el.element?.key)), [sortedElements]);

  const toggleReport = async (type, enabled) => {
    try {
      await api.post(`/courses/${id}/toggle-report`, { type, enabled });
      toast.success(enabled ? 'تم تفعيل التقرير' : 'تم إلغاء تفعيل التقرير');
      fetchCourse();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر تغيير حالة التقرير');
    }
  };

  const toggleOptionalElement = async (trackingId, enabled) => {
    try {
      await api.post(`/courses/${id}/toggle-element`, { trackingId, enabled });
      toast.success(enabled ? t('courseDetail.toggleEnabled') : t('courseDetail.toggleDisabled'));
      fetchCourse();
    } catch (e) {
      toast.error(e.response?.data?.message || t('courseDetail.updateFailed'));
    }
  };

  const [overrideModal, setOverrideModal] = useState(null); // { trackingId, action }
  const [overrideBusy, setOverrideBusy] = useState(false);

  const doOverride = async (trackingId, action, reason) => {
    try {
      await api.post(`/courses/${id}/override-element`, { trackingId, action, reason });
      toast.success(t('courseDetail.actionDone'));
      fetchCourse();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || t('courseDetail.actionFailed'));
      return false;
    }
  };

  const confirmOverride = async (reason) => {
    if (!overrideModal) return;
    setOverrideBusy(true);
    const ok = await doOverride(overrideModal.trackingId, overrideModal.action, reason);
    setOverrideBusy(false);
    if (ok) setOverrideModal(null);
  };

  // أدوات المدير: إرسال رسالة موجّهة
  const [msgModal, setMsgModal] = useState(null); // { trackingId, elementName, employeeName }
  const [msgType, setMsgType]   = useState('REMINDER');
  const [msgText, setMsgText]   = useState('');
  const [msgSending, setMsgSending] = useState(false);

  const sendManagerMessage = async () => {
    if (!msgText.trim()) return toast.error('الرسالة مطلوبة');
    setMsgSending(true);
    try {
      await api.post(`/courses/${id}/manager-message`, {
        trackingId: msgModal.trackingId,
        messageType: msgType,
        message: msgText.trim(),
      });
      toast.success('تم إرسال الرسالة للموظف');
      setMsgModal(null);
      setMsgText('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذر الإرسال');
    } finally {
      setMsgSending(false);
    }
  };

  const isReportKey = (key) => key === 'opening_report' || key === 'closing_report' || key === 'report';

  const renderAction = (el) => {
    if (isReportKey(el.element.key) && ['PENDING_APPROVAL', 'APPROVED'].includes(el.status)) {
      return (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 [&:not(:first-child)]:mt-2">
          <button onClick={() => handleReportDownload(el.id)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(46,96,102,0.85)] transition hover:bg-primary-dark">
            <Printer size={15} aria-hidden="true" /> {t('courseDetail.print')}
          </button>
          <button onClick={() => handleReportEmlDownload(el.id, el.element.key)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft transition hover:bg-white hover:text-primary">
            <Mail size={15} aria-hidden="true" /> رسالة بريد
          </button>
        </div>
      );
    }

    return null;
  };

  // ── بطاقة العنصر: تصميم «حلقة الوقت» ──────────────────────────────
  // الحلقة تقول كم بقي، والسطران تحت الاسم يقولان الحالة والموعد، وما سوى
  // ذلك ملاحظة قصيرة عند الحاجة. والأزرار كلها في ذيل البطاقة.
  const TIMING = {
    100: { label: 'قبل المثالي', cls: 'text-primary' },
    70: { label: 'بين المثالي والأقصى', cls: 'text-warning' },
    20: { label: 'بعد الأقصى', cls: 'text-danger' },
  };

  const Note = ({ tone = 'soft', icon: Icon, children }) => {
    const tones = {
      soft: 'bg-background text-text-main',
      warn: 'bg-sand/15 text-text-main',
      bad: 'bg-burgundy/5 text-text-main',
      brand: 'bg-primary-light/60 text-text-main',
    };
    return (
      <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[12px] leading-relaxed ${tones[tone]}`}>
        {Icon && <Icon size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-text-soft" />}
        <div className="min-w-0">{children}</div>
      </div>
    );
  };

  const renderElementCard = (el) => {
    const deadline = calcDeadline(el);
    const overdue = isOverdue(el);
    const waitH = supervisorWaitHours(el);
    const hasExt = (el.extensionHours || 0) > 0;
    const ring = ringFor({ ...el, course });
    const toneColor = RING_TONE[ring.tone];

    const isCritical = CRITICAL_ELEMENTS.has(el.element?.key);
    const isRedAlert = isCritical && overdue && !['APPROVED', 'PENDING_APPROVAL'].includes(el.status);
    const isSettlement = el.element?.key === 'settlement';
    const isDone = ['PENDING_APPROVAL', 'APPROVED'].includes(el.status);
    const timing = isDone ? TIMING[el.deadlines?.timeScore] : null;

    const waitDuration = waitH != null ? (waitH < 24 ? t('courseDetail.hours', { n: waitH }) : t('courseDetail.days', { n: Math.floor(waitH / 24) })) : '';
    const showDeadline = deadline && !isDone && el.status !== 'NOT_APPLICABLE';
    const statusText = overdue ? t('courseDetail.overdue') : isPaused(el) ? 'الساعة متوقفة' : elStatusLabel(el.status);

    return (
      <article
        key={el.id}
        className={`overflow-hidden rounded-[20px] border bg-white shadow-[0_1px_2px_rgba(28,46,48,0.05),0_10px_28px_-16px_rgba(28,46,48,0.22)] ${
          isRedAlert ? 'border-danger/40' : 'border-border'
        }`}
      >
        {isRedAlert && (
          <div className={`flex items-center gap-2 px-5 py-1.5 text-[11px] font-bold text-white ${isSettlement ? 'bg-danger' : 'bg-burgundy/80'}`}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{t('courseDetail.alertBanner', { level: isSettlement ? t('courseDetail.alertCritical') : t('courseDetail.alertUrgent'), label: criticalLabel(el.element?.key) })}</span>
          </div>
        )}

        {/* ── الجسم: الحلقة ثم الاسم وسطرا الحالة والموعد ── */}
        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-4 px-5 pb-4 pt-5">
          <TimeRing ring={ring} />
          <div className="min-w-0 space-y-1">
            <h4 className="text-[16px] font-extrabold leading-snug text-text-main">{el.element.name}</h4>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold" style={{ color: toneColor }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneColor }} aria-hidden="true" />
              <span>{statusText}</span>
              {isCritical && !isDone && el.status !== 'NOT_APPLICABLE' && (
                <span className="font-normal text-text-soft">· {t('courseDetail.criticalElement')}</span>
              )}
              {hasExt && <span className="font-normal text-primary">· {t('courseDetail.extensionBadge', { hours: el.extensionHours })}</span>}
              {el.deadlines?.excludedFromTiming && <span className="font-normal text-text-soft">· غير محتسب</span>}
            </p>

            {showDeadline && (
              <p className="text-[13px] text-text-soft">
                {t('courseDetail.max')} <span className={`font-bold ${overdue ? 'text-danger' : 'text-text-main'}`}>{fmt(deadline)}</span>
                {el.element?.isDeadlineWorkingDays ? <span className="text-[12px]"> · {t('courseDetail.workingDays')}</span> : null}
              </p>
            )}

            {isDone && (
              <p className="text-[13px] text-text-soft">
                {el.status === 'APPROVED' ? (
                  <>
                    {el.decider ? `اعتمده ${el.decider.firstName} ${el.decider.lastName}` : t('courseDetail.approvedAt')}
                    {el.decisionAt && <>{' · '}<span className="font-bold text-text-main">{fmt(el.decisionAt)}</span></>}
                  </>
                ) : waitH !== null ? (
                  <>{t('courseDetail.waitingSince', { duration: waitDuration })}</>
                ) : null}
                {timing && <span className={`font-bold ${timing.cls}`}> · {timing.label}</span>}
              </p>
            )}
          </div>
        </div>

        {/* ── ملاحظات قصيرة عند الحاجة ── */}
        <div className="space-y-2 px-5 empty:hidden [&:not(:empty)]:pb-4">
          {el.status === 'RETURNED' && (
            <Note tone="warn" icon={Undo2}>
              <span className="font-bold text-warning">{t('courseDetail.returnReasonView')} </span>
              {el.rejectionReason || el.notes || t('courseDetail.notSpecified')}
            </Note>
          )}
          {el.status === 'REJECTED' && (
            <Note tone="bad" icon={AlertTriangle}>
              <span className="font-bold text-danger">{t('courseDetail.rejectReasonView')} </span>
              {el.rejectionReason || el.notes || t('courseDetail.notSpecified')}
            </Note>
          )}
          {waitH !== null && waitH > 48 && (
            <Note tone="warn" icon={Hourglass}>
              <span className="font-bold text-warning">{t('courseDetail.deservesFollowup')}</span>
            </Note>
          )}
          {el.executionAt && (
            <Note icon={Upload}>
              {t('courseDetail.uploadedAt')} <span className="font-bold">{fmtFull(el.executionAt)}</span>
              {el.executor && <> · {el.executor.firstName} {el.executor.lastName}</>}
            </Note>
          )}
          {el.delayReason && (
            <Note tone="warn" icon={FileText}>
              <span className="font-bold text-warning">{t('courseDetail.justification')}: </span>
              {el.delayReason}
            </Note>
          )}
          {hasExt && el.extensionReason && (
            <Note tone="brand" icon={CalendarClock}>
              <span className="font-bold text-primary">{t('courseDetail.extensionBadge', { hours: el.extensionHours })}: </span>
              {el.extensionReason}
            </Note>
          )}
          {['advance_req', 'settlement'].includes(el.element?.key) && el.formData?.referenceNumber && (
            <Note tone="brand" icon={Coins}>
              رقم المعاملة في منصة السلف: <span className="font-bold">{el.formData.referenceNumber}</span>
            </Note>
          )}
        </div>

        {/* ── ذيل البطاقة: الأزرار. يختفي إن لم يكن فيه فعل ── */}
        <div className="border-t border-border bg-background px-4 py-3 [&:not(:has(button,textarea,input))]:hidden">
          <ElementRow element={{ ...el, course }} activeRole={activeRole} isOverdue={overdue} onUpdate={fetchCourse} />
          {renderAction(el)}
        </div>
      </article>
    );
  };

  if (loading)
    return (
      <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: t('common.loading') }]}>
        <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );

  if (!course)
    return (
      <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: t('courseDetail.notFound') }]}>
        <div className="rounded-2xl border border-danger/20 bg-white p-10 text-center text-danger shadow-card">{t('courseDetail.notFound')}</div>
      </MainLayout>
    );

  const courseStatus = STATUS_META[course.status] || STATUS_META.DRAFT;
  const locationLabel = locationOptions.find((o) => o.value === course.locationType)?.label || course.locationType;

  const criticalOverdue = sortedElements.filter(
    (el) => CRITICAL_ELEMENTS.has(el.element?.key) && isOverdue(el) && !['APPROVED', 'PENDING_APPROVAL', 'NOT_APPLICABLE'].includes(el.status)
  );
  const settlementOverdue = criticalOverdue.find((el) => el.element?.key === 'settlement');
  // شهادة إنجاز المترجم: بعد انتهاء الدورة بثلاثة أيام يُذكَّر المنسق بإرسالها للمالية
  const certificateEl = sortedElements.find((el) => el.element?.key === 'interpreter_certificate');
  const certificateDue = !!certificateEl && !['APPROVED', 'PENDING_APPROVAL', 'NOT_APPLICABLE'].includes(certificateEl.status)
    && course.endDate && Date.now() >= new Date(course.endDate).getTime() + 3 * 24 * 60 * 60 * 1000;

  return (
    <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: course.name }]}>
      <div className="space-y-4">
        {/* الإدخال المتأخر — مسجّل آلياً، وقراره للمدير */}
        {course.isLateEntry && (
          <LateEntryCard
            course={course}
            isManager={activeRole === 'MANAGER'}
            onDecided={fetchCourse}
          />
        )}

        {/* بانر الإنذارات الحرجة */}
        {criticalOverdue.length > 0 && (
          <div className={`rounded-2xl border p-4 shadow-card ${settlementOverdue ? 'border-danger/40 bg-danger/5' : 'border-burgundy/30 bg-burgundy/5'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} aria-hidden="true" className="shrink-0 animate-pulse text-danger" />
              <div className="flex-1">
                <p className="mb-1 text-sm font-extrabold text-danger">
                  {settlementOverdue ? t('courseDetail.bannerSettlement') : t('courseDetail.bannerCount', { count: criticalOverdue.length })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {criticalOverdue.map((el) => {
                    const CritIcon = CRITICAL_ICON[el.element?.key];
                    return (
                      <span
                        key={el.id}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${el.element?.key === 'settlement' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-burgundy/20 bg-burgundy/10 text-danger'}`}
                      >
                        {CritIcon && <CritIcon size={12} aria-hidden="true" />}
                        <span>{el.element.name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {certificateDue && (
          <div className="rounded-2xl border border-sand/60 bg-sand/15 p-4 shadow-card">
            <div className="flex items-start gap-3">
              <FileCheck size={24} aria-hidden="true" className="shrink-0 text-warning" />
              <div className="flex-1">
                <p className="text-sm font-extrabold text-text-main">أرسل شهادة إنجاز المترجم إلى الإدارة المالية</p>
                <p className="mt-0.5 text-[13px] text-text-soft">
                  مضت ثلاثة أيام على انتهاء الدورة. أصدر الشهادة من عنصر «{certificateEl.element?.name || 'شهادة إنجاز الترجمة'}» ثم نزّل «رسالة المالية — بقية المستحقات» والشهادة مرفقة بها، لصرف المبلغ المستحق للمترجم.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* رأس الصفحة */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card" style={{ borderTop: `3px solid ${courseStatus.border}` }}>
          <div className="space-y-4 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge label={courseStatusLabel(course.status)} cls={courseStatus.cls} />
                  <span className="text-xs text-text-soft/60">
                    {course.courseType === 'internal' ? t('course.typeInternal') : t('course.typeExternal')}
                    {course.code ? ` · ${course.code}` : ''}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold leading-tight text-text-main">{course.name}</h1>
                {course.beneficiaryEntity && (
                  <p className="mt-0.5 text-xs text-text-soft">
                    {course.beneficiaryEntity}
                    {course.city ? ` · ${course.city}` : ''}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setShowNotesReport(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-forest-50 px-3 py-2 text-xs font-extrabold text-accent shadow-sm transition hover:bg-accent hover:text-white"
                >
                  <FileText size={14} aria-hidden="true" /> {t('courseDetail.generalReport')}
                </button>
                {/* التعديل والحذف بصلاحية الخادم نفسها: المدير، والمشرف، ومنسق الدورة في مرحلة الإعداد */}
                {(isManager || isSupervisor || (course.primaryEmployeeId === user?.id && course.status === 'PREPARATION')) && (
                  <>
                    <button
                      onClick={() => router.push(`/courses/${id}/edit`)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft transition hover:border-primary hover:text-primary"
                    >
                      <Pencil size={14} aria-hidden="true" /> {t('common.edit')}
                    </button>
                    <button
                      onClick={() => setDeleteOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft transition hover:border-danger hover:bg-burgundy/5 hover:text-danger"
                    >
                      <Trash2 size={14} aria-hidden="true" /> {t('common.delete')}
                    </button>
                  </>
                )}
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft transition hover:bg-background"
                >
                  <ArrowLeft size={14} aria-hidden="true" /> {t('common.back')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Pill label={t('course.project')} value={course.operationalProject?.name || '-'} />
              <Pill label={t('course.owner')} value={`${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-'} />
              <Pill label={t('course.form.from')} value={fmt(course.startDate)} />
              <Pill label={t('course.form.to')} value={fmt(course.endDate)} />
              <Pill label={t('courseDetail.trainees')} value={course.numTrainees ?? '-'} />
              {course.locationType && <Pill label={t('course.form.locationType')} value={locationLabel} />}
              <Pill label={t('courseDetail.advance')} value={<YesNo value={course.requiresAdvance} />} />
              <Pill label={t('courseDetail.revenue')} value={<YesNo value={course.requiresRevenue} />} />
              <Pill label={t('courseDetail.settlement')} value={<YesNo value={course.requiresAdvanceSettlement} />} />
              <Pill label={t('courseDetail.materials')} value={<YesNo value={course.materialsIssued} />} />
            </div>

            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-extrabold text-text-main">{t('courseDetail.closureProgress')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-text-soft">
                    <span className="font-bold text-accent">{completedElements.length}</span>
                    <span className="text-text-soft/60"> / {sortedElements.filter((e) => e.status !== 'NOT_APPLICABLE').length} {t('courseDetail.elementUnit')}</span>
                  </span>
                  <span className="font-extrabold text-primary">{progress}%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-forest-50">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              {activeElements.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {activeElements.filter((e) => e.status === 'RETURNED').length > 0 && (
                    <span className="rounded-full border border-sand/40 bg-sand/20 px-2 py-0.5 font-bold text-warning">
                      {t('courseDetail.returnedCount', { count: activeElements.filter((e) => e.status === 'RETURNED').length })}
                    </span>
                  )}
                  {activeElements.filter((e) => isOverdue(e)).length > 0 && (
                    <span className="rounded-full border border-burgundy/20 bg-burgundy/10 px-2 py-0.5 font-bold text-danger">
                      {t('courseDetail.overdueCount', { count: activeElements.filter((e) => isOverdue(e)).length })}
                    </span>
                  )}
                  {activeElements.filter((e) => e.status === 'NOT_STARTED').length > 0 && (
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-text-soft">
                      {t('courseDetail.notStartedCount', { count: activeElements.filter((e) => e.status === 'NOT_STARTED').length })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── عنصر التميّز: توثيق الدورة ── */}
        {docSummary && (() => {
          const d = docSummary.documentation;
          const photos = d?.media?.length || 0;
          const starred = !!d?.starAwarded;
          const published = d?.status === 'PUBLISHED';
          const { checks = [] } = docSummary.star || {};
          const done = checks.filter((c) => c.done).length;
          return (
            <article className="overflow-hidden rounded-[20px] border border-accent/40 bg-white shadow-[0_1px_2px_rgba(28,46,48,0.05),0_10px_28px_-16px_rgba(28,46,48,0.22)]"
              style={{ background: 'linear-gradient(110deg,#fff8ec,#ffffff 60%)' }}>
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${starred ? 'bg-accent text-white shadow-[0_8px_18px_-8px_rgba(178,146,90,0.9)]' : 'bg-sand/20 text-warning'}`}>
                  <Star size={24} aria-hidden="true" fill={starred ? 'currentColor' : 'none'} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-extrabold text-warning">عنصر التميّز · اختياري</p>
                  <h2 className="text-[16px] font-extrabold text-text-main">توثيق الدورة</h2>
                  <p className="text-[12.5px] text-text-soft">
                    {starred
                      ? `نال نجمة التميّز — ${photos} صورة منشورة`
                      : published
                        ? 'منشور، ونقص عن معايير النجمة — أكمله لتعود'
                        : d
                          ? `مسودة: ${photos} صورة · ${done} من ${checks.length} معايير`
                          : 'وثّق الدورة بالصور والجلسات وانشرها فتنال نجمة تميّز ودرجات إضافية — ولا يُخصم على من لا يوثّق.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 border-t border-accent/20 bg-sand/5 px-4 py-3">
                <Link href={`/courses/${id}/documentation`}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(178,146,90,0.9)] transition hover:brightness-95">
                  <Star size={15} aria-hidden="true" /> {d ? 'فتح مساحة التوثيق' : 'ابدأ التوثيق'}
                </Link>
                {published && d?.slug && (
                  <a href={`/m/${d.slug}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-warning hover:bg-white">
                    تصفّح المجلة
                  </a>
                )}
              </div>
            </article>
          );
        })()}

        {/* ── عمودان متساويان: غير المكتملة | المكتملة ── */}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section aria-labelledby="h-incomplete">
            <div className="mb-3 flex items-center gap-2.5 px-1">
              <h2 id="h-incomplete" className="text-lg font-extrabold text-text-main">{t('courseDetail.incompleteElements')}</h2>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-sand/20 px-2 text-sm font-extrabold text-warning">{activeElements.length}</span>
            </div>
            <div className="space-y-4">
              {activeElements.length > 0 ? activeElements.map((el) => renderElementCard(el)) : (
                <p className="rounded-[20px] border border-dashed border-border bg-white py-10 text-center text-sm text-text-soft">{t('courseDetail.noIncomplete')}</p>
              )}
            </div>
          </section>

          <section aria-labelledby="h-completed">
            <div className="mb-3 flex items-center gap-2.5 px-1">
              <h2 id="h-completed" className="text-lg font-extrabold text-text-main">{t('courseDetail.completedElements')}</h2>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-forest-50 px-2 text-sm font-extrabold text-primary">{completedElements.length}</span>
            </div>
            <div className="space-y-4">
              {completedElements.length > 0 ? completedElements.map((el) => renderElementCard(el)) : (
                <p className="rounded-[20px] border border-dashed border-border bg-white py-10 text-center text-sm text-text-soft">{t('courseDetail.noCompleted')}</p>
              )}
            </div>
          </section>
        </div>

        {notApplicableElements.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="font-extrabold text-text-main">{t('courseDetail.notApplicableTitle')}</h2>
                <p className="mt-0.5 text-[11px] text-text-soft">{t('courseDetail.notApplicableDesc')}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-border/40 text-sm font-extrabold text-text-soft/60">{notApplicableElements.length}</span>
            </div>
            <div className="space-y-2 p-3">{notApplicableElements.map((el) => renderElementCard(el))}</div>
          </div>
        )}

        {optionalElements.length > 0 && (isCoordinator || isApprover) && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-extrabold text-text-main">{t('courseDetail.optionalTitle')}</h2>
              <p className="mt-0.5 text-[11px] text-text-soft">{t('courseDetail.optionalDesc')}</p>
            </div>
            <div className="space-y-2 p-3">
              {optionalElements.map((el) => {
                const enabled = el.status !== 'NOT_APPLICABLE';
                const locked = ['APPROVED', 'PENDING_APPROVAL'].includes(el.status);
                return (
                  <label key={el.id} className={`flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 ${locked ? '' : 'cursor-pointer hover:bg-background'}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={enabled} disabled={locked} onChange={(e) => toggleOptionalElement(el.id, e.target.checked)} className="h-4 w-4 accent-primary" />
                      <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                    </div>
                    <Badge label={elStatusLabel(el.status)} cls={(EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED).cls} small />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── تفعيل تقارير الافتتاح والاختتام (داخلية فقط) ──────────────── */}
        {course?.courseType === 'internal' && (isCoordinator || isApprover) && reportElements.length > 0 && (
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-extrabold text-text-main">📋 تقارير الافتتاح والاختتام</h2>
              <p className="text-[11px] text-text-soft mt-0.5">فعّل التقارير التي تنطبق على هذه الدورة الداخلية</p>
            </div>
            <div className="p-3 space-y-2">
              {reportElements.map((el) => {
                const type = el.element.key === 'opening_report' ? 'opening' : 'closing';
                const enabled = el.status !== 'NOT_APPLICABLE';
                const locked = ['APPROVED', 'PENDING_APPROVAL'].includes(el.status);
                return (
                  <label key={el.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 ${locked ? '' : 'cursor-pointer hover:bg-background'}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={enabled} disabled={locked || (!isApprover && enabled)}
                        onChange={(e) => toggleReport(type, e.target.checked)}
                        className="h-4 w-4 accent-primary" />
                      <div>
                        <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                        {!isApprover && !enabled && (
                          <p className="text-[10px] text-text-soft">تفعيله تطوّعي — يُحتسب إيجاباً في مؤشرات أدائك</p>
                        )}
                      </div>
                    </div>
                    <Badge meta={EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED} small />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── تحكم المدير في عناصر الإقفال ─────────────────────────────── */}
        {isManager && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-extrabold text-text-main">{t('courseDetail.managerControlTitle')}</h2>
              <p className="mt-0.5 text-[11px] text-text-soft">{t('courseDetail.managerControlDesc')}</p>
            </div>
            <div className="space-y-4 p-3">
              <div>
                <h4 className="mb-2 text-xs font-extrabold text-text-soft">{t('courseDetail.approvedRevertable')}</h4>
                {approvedElements.length === 0 ? (
                  <p className="text-xs text-text-soft">{t('courseDetail.noApproved')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {approvedElements.map((el) => (
                      <div key={el.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                        <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                        <button onClick={() => setOverrideModal({ trackingId: el.id, action: 'revert' })} className="inline-flex items-center gap-1 rounded-lg border border-burgundy/20 px-2 py-1 text-[11px] font-bold text-danger hover:bg-burgundy/5">
                          <Undo2 size={12} aria-hidden="true" /> {t('courseDetail.revert')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── إرسال رسالة موجّهة ── */}
              <div>
                <h4 className="mb-2 text-xs font-extrabold text-text-soft">📩 إرسال رسالة لموظف عن عنصر</h4>
                <div className="space-y-1.5">
                  {sortedElements.filter(el => el.status !== 'NOT_APPLICABLE' && el.executedById).map((el) => (
                    <div key={el.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-text-main block truncate">{el.element.name}</span>
                        <span className="text-[10px] text-text-soft">{el.executedBy?.firstName} {el.executedBy?.lastName}</span>
                      </div>
                      <button
                        onClick={() => setMsgModal({ trackingId: el.id, elementName: el.element.name, employeeName: `${el.executedBy?.firstName} ${el.executedBy?.lastName}` })}
                        className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/10">
                        📩 راسله
                      </button>
                    </div>
                  ))}
                  {sortedElements.filter(el => el.status !== 'NOT_APPLICABLE' && el.executedById).length === 0 && (
                    <p className="text-xs text-text-soft">لا توجد عناصر مرتبطة بموظف بعد</p>
                  )}
                </div>
              </div>

              {/* ── إعادة فتح أي عنصر (قوة استثنائية) ── */}
              <div>
                <h4 className="mb-1 text-xs font-extrabold text-danger">🔓 إعادة فتح عنصر (إلزامي سبب)</h4>
                <p className="mb-2 text-[10px] text-text-soft">يُعيد أي عنصر إلى "لم يبدأ" بغض النظر عن حالته الحالية</p>
                <div className="space-y-1.5">
                  {sortedElements.filter(el => !['NOT_APPLICABLE','NOT_STARTED'].includes(el.status)).map((el) => (
                    <div key={el.id} className="flex items-center justify-between gap-2 rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-text-main block truncate">{el.element.name}</span>
                        <span className="text-[10px] text-warning">{el.status === 'APPROVED' ? '✅ معتمد' : el.status === 'PENDING_APPROVAL' ? '⏳ معلّق' : el.status === 'RETURNED' ? '↩ مُعاد' : el.status}</span>
                      </div>
                      <button onClick={() => setOverrideModal({ trackingId: el.id, action: 'force-reset' })}
                        className="shrink-0 rounded-lg border border-danger/20 px-2 py-1 text-[11px] font-bold text-danger hover:bg-burgundy/10">
                        🔓 فتح
                      </button>
                    </div>
                  ))}
                  {sortedElements.filter(el => !['NOT_APPLICABLE','NOT_STARTED'].includes(el.status)).length === 0 && (
                    <p className="text-xs text-text-soft">لا توجد عناصر يمكن إعادة فتحها</p>
                  )}
                </div>
              </div>

              {/* استثناء عنصر */}
              <div>
                <h4 className="mb-2 text-xs font-extrabold text-text-soft">{t('courseDetail.exemptTitle')}</h4>
                {exemptableElements.length === 0 ? (
                  <p className="text-xs text-text-soft">{t('courseDetail.noExemptable')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {exemptableElements.map((el) => (
                      <div key={el.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                          <Badge label={elStatusLabel(el.status)} cls={(EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED).cls} small />
                        </div>
                        <button onClick={() => setOverrideModal({ trackingId: el.id, action: 'exempt' })} className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-white">
                          {t('courseDetail.exempt')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {exemptedByManager.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-extrabold text-text-soft">{t('courseDetail.exemptedByManager')}</h4>
                  <div className="space-y-1.5">
                    {exemptedByManager.map((el) => (
                      <div key={el.id} className="rounded-xl border border-border bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                          <button onClick={() => doOverride(el.id, 'restore', null)} className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-white">
                            {t('courseDetail.cancelExemption')}
                          </button>
                        </div>
                        {el.overrideReason && <p className="mt-1 text-[11px] text-text-soft">{t('courseDetail.reasonLabel')} {el.overrideReason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {sortedElements.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-soft shadow-card">{t('courseDetail.noElements')}</div>
        )}
      </div>

      <ReasonModal
        open={!!overrideModal}
        title={overrideModal?.action === 'revert' ? t('courseDetail.revert')
          : overrideModal?.action === 'force-reset' ? t('courseDetail.forceReset')
          : t('courseDetail.exempt')}
        label={overrideModal?.action === 'revert' ? t('courseDetail.revertPrompt')
          : overrideModal?.action === 'force-reset' ? t('courseDetail.forceResetPrompt')
          : t('courseDetail.exemptPrompt')}
        required
        tone={['revert', 'force-reset'].includes(overrideModal?.action) ? 'danger' : 'warning'}
        loading={overrideBusy}
        onConfirm={confirmOverride}
        onCancel={() => setOverrideModal(null)}
      />
      {showNotesReport && (
        <CourseNotesReportForm
          courseId={id}
          course={course}
          onClose={() => setShowNotesReport(false)}
        />
      )}

      {/* ── Modal رسالة المدير ── */}
      {msgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-l from-primary/5 to-white px-5 py-3.5">
              <div>
                <h3 className="font-extrabold text-text-main">📩 رسالة إلى الموظف</h3>
                <p className="text-[10px] text-text-soft mt-0.5">
                  العنصر: {msgModal.elementName} · الموظف: {msgModal.employeeName}
                </p>
              </div>
              <button onClick={() => { setMsgModal(null); setMsgText(''); }}
                className="rounded-full p-1.5 hover:bg-background text-text-soft">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* نوع الرسالة */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'INQUIRY',  icon: '💬', label: 'استفسار', cls: 'border-primary/30 bg-primary/5 text-primary' },
                  { val: 'REMINDER', icon: '🔔', label: 'تذكير',   cls: 'border-sand/50 bg-sand/10 text-warning' },
                  { val: 'WARNING',  icon: '🚨', label: 'إنذار',   cls: 'border-danger/30 bg-danger/5 text-danger' },
                ].map(t => (
                  <button key={t.val}
                    onClick={() => setMsgType(t.val)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-extrabold transition ${msgType === t.val ? t.cls + ' ring-2 ring-offset-1 ring-primary/30' : 'border-border text-text-soft hover:bg-background'}`}>
                    <span className="text-lg">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              {/* نص الرسالة */}
              <textarea
                rows={4}
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm text-text-main placeholder:text-text-soft/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                dir="rtl"
              />
              {/* إرسال */}
              <div className="flex gap-2">
                <button
                  onClick={sendManagerMessage}
                  disabled={msgSending || !msgText.trim()}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white transition ${
                    msgType === 'WARNING' ? 'bg-danger hover:bg-danger/90'
                    : msgType === 'REMINDER' ? 'bg-warning hover:bg-warning/90'
                    : 'bg-primary hover:bg-primary-dark'
                  } disabled:opacity-40`}>
                  {msgSending ? 'جاري الإرسال...' : '📨 إرسال'}
                </button>
                <button onClick={() => { setMsgModal(null); setMsgText(''); }}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-text-soft hover:bg-background">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ══ تأكيد حذف الدورة ══ */}
      {deleteOpen && typeof document !== 'undefined' && createPortal(
        <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4" onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="del-title">
            <div className="space-y-3 p-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/10 text-danger">
                <Trash2 size={26} aria-hidden="true" />
              </div>
              <h2 id="del-title" className="text-base font-extrabold text-text-main">{t('course.delete.title')}</h2>
              <p className="text-sm text-text-soft">{t('course.delete.confirmText', { name: course.name })}</p>
              <p className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">{t('course.delete.irreversible')}</p>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-3">
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await api.delete(`/courses/${id}`);
                    toast.success(t('course.delete.success'));
                    router.replace('/courses');
                  } catch (e) {
                    toast.error(e?.response?.data?.message || t('course.delete.failed'));
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger py-2.5 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-50"
              >
                {deleting ? '...' : (<><Trash2 size={16} aria-hidden="true" /> {t('course.delete.confirm')}</>)}
              </button>
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </MainLayout>
  );
}
