import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
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

  const calcDeadline = (el) => {
    const e = el.element;
    if (!e?.deadlineRefPoint || e.deadlineMaxHours == null || !course) return null;
    const ref = e.deadlineRefPoint === 'START' ? new Date(course.startDate) : new Date(course.endDate);
    return new Date(ref.getTime() + (e.deadlineMaxHours + (el.extensionHours || 0)) * 3600000);
  };
  const calcIdealDeadline = (el) => {
    const e = el.element;
    if (!e?.deadlineRefPoint || e.deadlineIdealHours == null || !course) return null;
    const ref = e.deadlineRefPoint === 'START' ? new Date(course.startDate) : new Date(course.endDate);
    return new Date(ref.getTime() + e.deadlineIdealHours * 3600000);
  };
  const isOverdue = (el) => {
    if (['APPROVED', 'NOT_APPLICABLE', 'PENDING_APPROVAL'].includes(el.status)) return false;
    const dl = calcDeadline(el);
    return dl && new Date() > dl;
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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => handleReportDownload(el.id)} className="inline-flex items-center gap-1 text-xs font-bold text-primary transition hover:text-primary-dark">
            <Printer size={14} aria-hidden="true" /> {t('courseDetail.print')}
          </button>
          <button onClick={() => handleReportEmlDownload(el.id, el.element.key)} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-dark">
            <Mail size={14} aria-hidden="true" /> EML
          </button>
        </div>
      );
    }
    return null;
  };

  const renderElementCard = (el) => {
    const meta = EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED;
    const deadline = calcDeadline(el);
    const idealDl = calcIdealDeadline(el);
    const overdue = isOverdue(el);
    const waitH = supervisorWaitHours(el);
    const hasExt = (el.extensionHours || 0) > 0;

    const isCritical = CRITICAL_ELEMENTS.has(el.element?.key);
    const CritIcon = CRITICAL_ICON[el.element?.key];
    const isRedAlert = isCritical && overdue && !['APPROVED', 'PENDING_APPROVAL'].includes(el.status);
    const isSettlement = el.element?.key === 'settlement';
    const palette =
      el.status === 'APPROVED'
        ? { bg: 'linear-gradient(135deg,#F0F8F4 0%,#FFFFFF 60%)', border: '#5D8A70', glow: 'rgba(93,138,112,0.16)' }
        : el.status === 'PENDING_APPROVAL'
        ? { bg: 'linear-gradient(135deg,#EEF5F2 0%,#FFFFFF 62%)', border: '#253C32', glow: 'rgba(37,60,50,0.14)' }
        : overdue || isRedAlert
        ? { bg: 'linear-gradient(135deg,#FFF5EF 0%,#FFFFFF 62%)', border: '#633646', glow: 'rgba(99,54,70,0.14)' }
        : { bg: 'linear-gradient(135deg,#FBF8F2 0%,#FFFFFF 62%)', border: '#C3B39F', glow: 'rgba(195,179,159,0.18)' };

    const waitDuration = waitH != null ? (waitH < 24 ? t('courseDetail.hours', { n: waitH }) : t('courseDetail.days', { n: Math.floor(waitH / 24) })) : '';

    return (
      <div
        key={el.id}
        className={`min-h-[128px] overflow-visible rounded-2xl border transition hover:-translate-y-0.5 ${isRedAlert ? 'border-danger shadow-[0_0_0_2px_rgba(99,54,70,0.15)]' : 'border-border'}`}
        style={{ borderInlineStart: `5px solid ${isRedAlert ? '#633646' : palette.border}`, background: palette.bg, boxShadow: `0 10px 24px ${palette.glow}` }}
      >
        {isRedAlert && (
          <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-white ${isSettlement ? 'bg-danger' : 'bg-burgundy/80'}`}>
            <AlertTriangle size={14} aria-hidden="true" className="animate-pulse" />
            <span>{t('courseDetail.alertBanner', { level: isSettlement ? t('courseDetail.alertCritical') : t('courseDetail.alertUrgent'), label: criticalLabel(el.element?.key) })}</span>
            {isSettlement && <span className="ms-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{t('courseDetail.needsImmediate')}</span>}
          </div>
        )}

        {isCritical && !isRedAlert && !['APPROVED', 'NOT_APPLICABLE'].includes(el.status) && (
          <div className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold ${isSettlement ? 'border-b border-burgundy/15 bg-burgundy/8 text-danger' : 'border-b border-sand/20 bg-sand/10 text-warning'}`}>
            {CritIcon && <CritIcon size={12} aria-hidden="true" />}
            <span>{t('courseDetail.criticalElement')} — {criticalLabel(el.element?.key)}</span>
          </div>
        )}

        <div className="space-y-2.5 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h4 className="text-[15px] font-extrabold leading-snug text-text-main">{el.element.name}</h4>
              <Badge label={elStatusLabel(el.status)} cls={meta.cls} small />
              {overdue && !isRedAlert && (
                <span className="inline-flex items-center gap-1 rounded-full border border-burgundy/20 bg-burgundy/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                  <AlertTriangle size={11} aria-hidden="true" /> {t('courseDetail.overdue')}
                </span>
              )}
              {hasExt && (
                <span className="inline-flex rounded-full border border-primary/20 bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">
                  {t('courseDetail.extensionBadge', { hours: el.extensionHours })}
                </span>
              )}
            </div>
            <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-[360px] sm:max-w-[62%]">
              <ElementRow element={{ ...el, course }} activeRole={activeRole} isOverdue={overdue} onUpdate={fetchCourse} />
              {renderAction(el)}
            </div>
          </div>

          {deadline && !['APPROVED', 'NOT_APPLICABLE'].includes(el.status) && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-white/70 bg-white/70 px-2.5 py-1.5 text-[11px]">
              {idealDl && (
                <span className="text-text-soft">
                  {t('courseDetail.ideal')}: <span className="font-bold text-accent">{fmt(idealDl)}</span>
                </span>
              )}
              <span className={`font-bold ${overdue ? 'text-danger' : 'text-text-main'}`}>
                {t('courseDetail.max')}: {fmt(deadline)}
                {el.element?.isDeadlineWorkingDays ? ` ${t('courseDetail.workingDays')}` : ''}
              </span>
            </div>
          )}

          {waitH !== null && (
            <div className={`flex w-fit items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] ${waitH > 48 ? 'border border-sand/40 bg-sand/20 text-warning' : 'border border-border bg-background text-text-soft'}`}>
              <Hourglass size={12} aria-hidden="true" />
              <span>{t('courseDetail.waitingSince', { duration: waitDuration })}</span>
              {waitH > 48 && <span className="font-extrabold">{t('courseDetail.deservesFollowup')}</span>}
            </div>
          )}

          {el.executionAt && (
            <div className="flex flex-wrap gap-3 text-[11px] text-text-soft">
              <span className="inline-flex items-center gap-1">
                <Upload size={12} aria-hidden="true" /> {t('courseDetail.uploadedAt')}: <strong className="text-primary">{fmtFull(el.executionAt)}</strong>
              </span>
              {el.executor && (
                <span>
                  {t('courseDetail.by')}: <strong className="text-text-main">{el.executor.firstName} {el.executor.lastName}</strong>
                </span>
              )}
            </div>
          )}

          {el.delayReason && (
            <div className="rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-[11px]">
              <span className="font-bold text-warning">{t('courseDetail.justification')}: </span>
              <span className="text-text-main">{el.delayReason}</span>
            </div>
          )}

          {hasExt && el.extensionReason && (
            <div className="rounded-xl border border-primary/20 bg-primary-light/50 px-3 py-2 text-[11px]">
              <span className="font-bold text-primary">{t('courseDetail.extensionBadge', { hours: el.extensionHours })}: </span>
              <span className="text-text-main">{el.extensionReason}</span>
              {el.extensionGrantedAt && <span className="ms-2 text-text-soft">— {fmt(el.extensionGrantedAt)}</span>}
            </div>
          )}

          {el.status === 'APPROVED' && el.decisionAt && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent">
              <Check size={13} aria-hidden="true" />
              <span>{t('courseDetail.approvedAt')}: {fmtFull(el.decisionAt)}</span>
              {el.decider && <span className="font-normal text-text-soft">— {el.decider.firstName} {el.decider.lastName}</span>}
            </div>
          )}

          {/* رقم المعاملة من منصة السلف */}
          {['advance_req', 'settlement'].includes(el.element?.key) && el.formData?.referenceNumber && (
            <div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary-light/40 px-2.5 py-1.5 text-[11px] font-bold text-primary w-fit">
              <span>🔗</span>
              <span>رقم المعاملة في منصة السلف:</span>
              <span className="font-extrabold">{el.formData.referenceNumber}</span>
            </div>
          )}

          {/* إعادة */}
          {el.status === 'RETURNED' && (
            <div className="rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-[11px]">
              <p className="mb-0.5 font-bold text-warning">{t('courseDetail.returnReasonView')}</p>
              <p className="text-text-main">{el.rejectionReason || el.notes || t('courseDetail.notSpecified')}</p>
              {el.decisionAt && <p className="mt-1 text-text-soft">{fmtFull(el.decisionAt)}</p>}
            </div>
          )}

          {el.status === 'REJECTED' && (
            <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-[11px]">
              <p className="mb-0.5 font-bold text-danger">{t('courseDetail.rejectReasonView')}</p>
              <p className="text-text-main">{el.rejectionReason || el.notes || t('courseDetail.notSpecified')}</p>
              {el.decisionAt && <p className="mt-1 text-text-soft">{fmtFull(el.decisionAt)}</p>}
            </div>
          )}
        </div>
      </div>
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

  return (
    <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: course.name }]}>
      <div className="space-y-4">
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
                {(isManager || isSupervisor) && (
                  <button
                    onClick={() => router.push(`/courses/${id}/edit`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft transition hover:border-primary hover:text-primary"
                  >
                    <Pencil size={14} aria-hidden="true" /> {t('common.edit')}
                  </button>
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

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="font-extrabold text-text-main">{t('courseDetail.incompleteElements')}</h2>
                <p className="mt-0.5 text-[11px] text-text-soft">{t('courseDetail.bySequence')}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sand/40 bg-sand/20 text-sm font-extrabold text-warning">{activeElements.length}</span>
            </div>
            <div className="space-y-2 p-3">
              {activeElements.length > 0 ? activeElements.map((el) => renderElementCard(el)) : <p className="py-8 text-center text-sm text-text-soft">{t('courseDetail.noIncomplete')}</p>}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="font-extrabold text-text-main">{t('courseDetail.completedElements')}</h2>
                <p className="mt-0.5 text-[11px] text-text-soft">{t('courseDetail.submittedOrApproved')}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/20 bg-forest-50 text-sm font-extrabold text-accent">{completedElements.length}</span>
            </div>
            <div className="space-y-2 p-3">
              {completedElements.length > 0 ? completedElements.map((el) => renderElementCard(el)) : <p className="py-8 text-center text-sm text-text-soft">{t('courseDetail.noCompleted')}</p>}
            </div>
          </div>
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
    </MainLayout>
  );
}
