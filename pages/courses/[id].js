import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import MainLayout from '../../components/layout/MainLayout';
import ElementRow from '../../components/operational/ElementRow';
import CourseNotesReportForm from '../../components/operational/CourseNotesReportForm';
import toast from 'react-hot-toast';

// ── ثوابت الحالات ─────────────────────────────────────────────────────
const STATUS_META = {
  DRAFT:            { label: 'مسودة',           cls: 'bg-border/60 text-text-soft',                  border: '#D7DBDA' },
  PREPARATION:      { label: 'قيد الإعداد',      cls: 'bg-sand/20 text-warning border-sand/40',       border: '#C3B39F' },
  EXECUTION:        { label: 'قيد التنفيذ',      cls: 'bg-primary-light text-primary border-primary/20', border: '#253C32' },
  IN_PROGRESS:      { label: 'قيد التنفيذ',      cls: 'bg-primary-light text-primary border-primary/20', border: '#253C32' },
  AWAITING_CLOSURE: { label: 'بانتظار الإغلاق',  cls: 'bg-sand/30 text-warning border-sand/50',       border: '#8B7D6B' },
  CLOSED:           { label: 'مغلقة',             cls: 'bg-forest-50 text-accent border-accent/20',    border: '#5D8A70' },
  ARCHIVED:         { label: 'مؤرشفة',            cls: 'bg-border text-text-soft border-border',       border: '#9DA3A1' },
};

const EL_STATUS_META = {
  NOT_STARTED:      { label: 'لم يبدأ',          cls: 'bg-background text-text-soft border-border',          border: '#D7DBDA' },
  PENDING_APPROVAL: { label: 'قيد الاعتماد',      cls: 'bg-primary-light text-primary border-primary/20',     border: '#253C32' },
  APPROVED:         { label: 'مُعتمد',            cls: 'bg-forest-50 text-accent border-accent/30',           border: '#5D8A70' },
  RETURNED:         { label: 'مُعاد',             cls: 'bg-sand/20 text-warning border-sand/40',              border: '#C3B39F' },
  REJECTED:         { label: 'مرفوض',             cls: 'bg-burgundy/10 text-danger border-burgundy/20',       border: '#633646' },
  NOT_APPLICABLE:   { label: 'غير منطبق',         cls: 'bg-border/40 text-text-soft/60 border-border/40',    border: '#E5E7E6' },
};

const ELEMENT_ORDER = {
  trainee_registration: 1, registration_message: 2, medical_insurance: 3, advance_req: 4, pre_test: 5,
  opening_report: 6, reaction_evaluation: 7, post_test: 8, certificates: 9,
  closing_report: 10, report: 10, supervisor_compensation: 11, trainer_compensation: 12,
  revenues: 13, materials: 14, settlement: 15,
};

// العناصر الحرجة التي تستوجب إنذاراً خاصاً
const CRITICAL_ELEMENTS = new Set(['opening_report', 'closing_report', 'settlement']);
const CRITICAL_META = {
  opening_report: { label: 'تقرير الافتتاح',  icon: '📋', urgency: 'high' },
  closing_report: { label: 'تقرير الاختتام',  icon: '📝', urgency: 'high' },
  settlement:     { label: 'تسوية السلفة',    icon: '💰', urgency: 'critical' },
};

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
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-soft/60 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-text-main leading-snug break-words">{value}</p>
    </div>
  );
}

// ── شارة حالة ─────────────────────────────────────────────────────────
function Badge({ meta, small }) {
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-bold ${small ? 'text-[10px]' : 'text-xs'} ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { activeRole, user } = useAuth();

  const [course,          setCourse]          = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showAll,         setShowAll]         = useState(false);
  const [showNotesReport, setShowNotesReport] = useState(false);

  const isEmployee   = activeRole === 'EMPLOYEE';
  const isCoordinator = course?.primaryEmployeeId && user?.id === course.primaryEmployeeId;
  const isApprover   = activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
  const isManager    = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';

  useEffect(() => { if (id) fetchCourse(); }, [id]);

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

  // ── تحميل التقارير ───────────────────────────────────────────────────
  const handleReportDownload = async (elementId) => {
    try {
      const res = await api.get(`/closure/${elementId}/export`, {
        responseType: 'text', headers: { Accept: 'text/html' },
      });
      const w = window.open('', '_blank');
      if (!w) { toast.error('تعذر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة'); return; }
      w.document.open(); w.document.write(res.data); w.document.close();
    } catch { toast.error('تعذر فتح التقرير'); }
  };

  const handleReportEmlDownload = async (elementId, elementKey) => {
    try {
      const res = await api.get(`/closure/${elementId}/export-eml`, {
        responseType: 'blob', headers: { Accept: 'message/rfc822' },
      });
      const fallback = elementKey === 'opening_report' ? 'opening-report.eml' : 'closing-report.eml';
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = match?.[1] || fallback;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('تم تنزيل الملف');
    } catch { toast.error('تعذر تنزيل ملف EML'); }
  };

  // ── ترتيب وتجميع العناصر ─────────────────────────────────────────────
  const sortedElements = useMemo(() => {
    if (!course?.closureElements) return [];
    return [...course.closureElements].sort((a, b) =>
      (ELEMENT_ORDER[a.element?.key] ?? 999) - (ELEMENT_ORDER[b.element?.key] ?? 999)
    );
  }, [course]);

  const activeElements    = useMemo(() => sortedElements.filter(el =>
    ['NOT_STARTED','RETURNED','REJECTED'].includes(el.status)), [sortedElements]);
  const completedElements = useMemo(() => sortedElements.filter(el =>
    ['PENDING_APPROVAL','APPROVED'].includes(el.status)), [sortedElements]);
  const notApplicableElements = useMemo(() => sortedElements.filter(el =>
    el.status === 'NOT_APPLICABLE'), [sortedElements]);

  const progress = useMemo(() => {
    const rel  = sortedElements.filter(el => el.status !== 'NOT_APPLICABLE');
    if (!rel.length) return 0;
    const done = rel.filter(el => ['PENDING_APPROVAL','APPROVED'].includes(el.status)).length;
    return Math.round((done / rel.length) * 100);
  }, [sortedElements]);

  // ── حساب المواعيد ────────────────────────────────────────────────────
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
    if (['APPROVED','NOT_APPLICABLE','PENDING_APPROVAL'].includes(el.status)) return false;
    const dl = calcDeadline(el);
    return dl && new Date() > dl;
  };
  const supervisorWaitHours = (el) => {
    if (el.status !== 'PENDING_APPROVAL' || !el.executionAt) return null;
    return Math.round((Date.now() - new Date(el.executionAt).getTime()) / 3600000);
  };

  // ── عناصر اختيارية وتحكم المدير ──────────────────────────────────────
  const optionalElements = useMemo(() =>
    sortedElements.filter(el => el.element?.elementType === 'OPTIONAL'), [sortedElements]);

  const approvedElements = useMemo(() =>
    sortedElements.filter(el => el.status === 'APPROVED'), [sortedElements]);

  const exemptableElements = useMemo(() =>
    sortedElements.filter(el => el.status !== 'NOT_APPLICABLE'), [sortedElements]);

  const exemptedByManager = useMemo(() =>
    sortedElements.filter(el => el.status === 'NOT_APPLICABLE' && el.overriddenById), [sortedElements]);

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
      toast.success(enabled ? 'تم تفعيل العنصر' : 'تم إلغاء تفعيل العنصر');
      fetchCourse();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذر التحديث');
    }
  };

  const overrideElement = async (trackingId, action, needsReason) => {
    let reason;
    if (needsReason) {
      const promptText = action === 'revert' ? 'سبب استرجاع العنصر (إلزامي):'
        : action === 'force-reset' ? 'سبب إعادة فتح العنصر (إلزامي):'
        : 'سبب الاستثناء (إلزامي):';
      reason = window.prompt(promptText);
      if (!reason || !reason.trim()) {
        if (reason !== null) toast.error('السبب مطلوب');
        return;
      }
    }
    try {
      await api.post(`/courses/${id}/override-element`, { trackingId, action, reason });
      toast.success('تم تنفيذ الإجراء');
      fetchCourse();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذر التنفيذ');
    }
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
    if (isReportKey(el.element.key) && ['PENDING_APPROVAL','APPROVED'].includes(el.status)) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => handleReportDownload(el.id)}
            className="text-xs font-bold text-primary hover:text-primary-dark transition">
            🖨️ طباعة
          </button>
          <button onClick={() => handleReportEmlDownload(el.id, el.element.key)}
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark transition">
            📧 EML
          </button>
        </div>
      );
    }
    return null;
  };

  // ── بطاقة عنصر إغلاق ─────────────────────────────────────────────────
  const renderElementCard = (el) => {
    const meta      = EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED;
    const deadline  = calcDeadline(el);
    const idealDl   = calcIdealDeadline(el);
    const overdue   = isOverdue(el);
    const waitH     = supervisorWaitHours(el);
    const hasExt    = (el.extensionHours || 0) > 0;

    const isCritical   = CRITICAL_ELEMENTS.has(el.element?.key);
    const criticalMeta = CRITICAL_META[el.element?.key];
    const isRedAlert   = isCritical && overdue && !['APPROVED','PENDING_APPROVAL'].includes(el.status);
    const isSettlement = el.element?.key === 'settlement';
    const palette = el.status === 'APPROVED'
      ? { bg: 'linear-gradient(135deg,#F0F8F4 0%,#FFFFFF 60%)', border: '#5D8A70', glow: 'rgba(93,138,112,0.16)' }
      : el.status === 'PENDING_APPROVAL'
        ? { bg: 'linear-gradient(135deg,#EEF5F2 0%,#FFFFFF 62%)', border: '#253C32', glow: 'rgba(37,60,50,0.14)' }
        : overdue || isRedAlert
          ? { bg: 'linear-gradient(135deg,#FFF5EF 0%,#FFFFFF 62%)', border: '#633646', glow: 'rgba(99,54,70,0.14)' }
          : { bg: 'linear-gradient(135deg,#FBF8F2 0%,#FFFFFF 62%)', border: '#C3B39F', glow: 'rgba(195,179,159,0.18)' };

    return (
      <div key={el.id}
        className={`rounded-2xl border overflow-visible transition hover:-translate-y-0.5 min-h-[128px]
          ${isRedAlert ? 'border-danger shadow-[0_0_0_2px_rgba(99,54,70,0.15)]' : 'border-border'}`}
        style={{ borderInlineStart: `5px solid ${isRedAlert ? '#633646' : palette.border}`, background: palette.bg, boxShadow: `0 10px 24px ${palette.glow}` }}>

        {/* شريط الإنذار الأحمر للعناصر الحرجة المتأخرة */}
        {isRedAlert && (
          <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-white
            ${isSettlement ? 'bg-danger' : 'bg-burgundy/80'}`}>
            <span className="animate-pulse">🚨</span>
            <span>إنذار {isSettlement ? 'حرج' : 'عاجل'}: {criticalMeta?.label} متأخر عن الموعد الأقصى</span>
            {isSettlement && <span className="mr-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px]">يستوجب متابعة فورية</span>}
          </div>
        )}

        {/* شارة العنصر الحرج (قبل الاستحقاق) */}
        {isCritical && !isRedAlert && !['APPROVED','NOT_APPLICABLE'].includes(el.status) && (
          <div className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold
            ${isSettlement ? 'bg-burgundy/8 text-danger border-b border-burgundy/15' : 'bg-sand/10 text-warning border-b border-sand/20'}`}>
            <span>{criticalMeta?.icon}</span>
            <span>عنصر حرج — {criticalMeta?.label}</span>
          </div>
        )}

        <div className="p-3 space-y-2.5">

          {/* رأس العنصر */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h4 className="font-extrabold text-[15px] text-text-main leading-snug">{el.element.name}</h4>
              <Badge meta={meta} small />
              {overdue && !isRedAlert && (
                <span className="inline-flex items-center gap-1 rounded-full bg-burgundy/10 px-2 py-0.5 text-[10px] font-bold text-danger border border-burgundy/20">
                  ⚠ متأخر
                </span>
              )}
              {hasExt && (
                <span className="inline-flex rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                  تمديد +{el.extensionHours}س
                </span>
              )}
            </div>
            <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-[360px] sm:max-w-[62%]">
              <ElementRow element={{ ...el, course }} activeRole={activeRole} isOverdue={overdue} onUpdate={fetchCourse} />
              {renderAction(el)}
            </div>
          </div>

          {/* المواعيد */}
          {deadline && !['APPROVED','NOT_APPLICABLE'].includes(el.status) && (
            <div className="flex flex-wrap gap-2 text-[11px] rounded-xl bg-white/70 px-2.5 py-1.5 border border-white/70">
              {idealDl && (
                <span className="text-text-soft">
                  مثالي: <span className="font-bold text-accent">{fmt(idealDl)}</span>
                </span>
              )}
              <span className={`font-bold ${overdue ? 'text-danger' : 'text-text-main'}`}>
                أقصاه: {fmt(deadline)}
                {el.element?.isDeadlineWorkingDays ? ' (أيام عمل)' : ''}
              </span>
            </div>
          )}

          {/* انتظار المشرف */}
          {waitH !== null && (
            <div className={`flex items-center gap-1.5 text-[11px] rounded-xl px-2.5 py-1.5 w-fit
              ${waitH > 48 ? 'bg-sand/20 text-warning border border-sand/40' : 'bg-background text-text-soft border border-border'}`}>
              <span>⏳</span>
              <span>انتظار اعتماد منذ {waitH < 24 ? `${waitH} ساعة` : `${Math.floor(waitH/24)} يوم`}</span>
              {waitH > 48 && <span className="font-extrabold">— يستحق المتابعة</span>}
            </div>
          )}

          {/* تاريخ التقديم */}
          {el.executionAt && (
            <div className="text-[11px] text-text-soft flex flex-wrap gap-3">
              <span>📤 رُفع: <strong className="text-primary">{fmtFull(el.executionAt)}</strong></span>
              {el.executor && (
                <span>بواسطة: <strong className="text-text-main">{el.executor.firstName} {el.executor.lastName}</strong></span>
              )}
            </div>
          )}

          {/* مبرر التأخر */}
          {el.delayReason && (
            <div className="rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-[11px]">
              <span className="font-bold text-warning">مبرر: </span>
              <span className="text-text-main">{el.delayReason}</span>
            </div>
          )}

          {/* تمديد */}
          {hasExt && el.extensionReason && (
            <div className="rounded-xl border border-primary/20 bg-primary-light/50 px-3 py-2 text-[11px]">
              <span className="font-bold text-primary">تمديد +{el.extensionHours}س: </span>
              <span className="text-text-main">{el.extensionReason}</span>
              {el.extensionGrantedAt && <span className="text-text-soft mr-2">— {fmt(el.extensionGrantedAt)}</span>}
            </div>
          )}

          {/* اعتماد */}
          {el.status === 'APPROVED' && el.decisionAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-accent font-bold">
              <span>✓</span>
              <span>تم الاعتماد: {fmtFull(el.decisionAt)}</span>
              {el.decider && <span className="text-text-soft font-normal">— {el.decider.firstName} {el.decider.lastName}</span>}
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
              <p className="font-bold text-warning mb-0.5">سبب الإعادة:</p>
              <p className="text-text-main">{el.rejectionReason || el.notes || 'لم يُحدد'}</p>
              {el.decisionAt && <p className="mt-1 text-text-soft">{fmtFull(el.decisionAt)}</p>}
            </div>
          )}

          {/* رفض */}
          {el.status === 'REJECTED' && (
            <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-[11px]">
              <p className="font-bold text-danger mb-0.5">سبب الرفض:</p>
              <p className="text-text-main">{el.rejectionReason || el.notes || 'لم يُحدد'}</p>
              {el.decisionAt && <p className="mt-1 text-text-soft">{fmtFull(el.decisionAt)}</p>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── شاشات التحميل والخطأ ─────────────────────────────────────────────
  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </MainLayout>
  );

  if (!course) return (
    <MainLayout>
      <div className="rounded-2xl border border-danger/20 bg-white p-10 text-center text-danger shadow-card">
        الدورة غير موجودة
      </div>
    </MainLayout>
  );

  const courseStatus = STATUS_META[course.status] || STATUS_META.DRAFT;

  // العناصر الحرجة المتأخرة
  const criticalOverdue = sortedElements.filter(el =>
    CRITICAL_ELEMENTS.has(el.element?.key) &&
    isOverdue(el) &&
    !['APPROVED','PENDING_APPROVAL','NOT_APPLICABLE'].includes(el.status)
  );
  const settlementOverdue = criticalOverdue.find(el => el.element?.key === 'settlement');

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* 🚨 بانر الإنذارات الحرجة */}
        {criticalOverdue.length > 0 && (
          <div className={`rounded-2xl border p-4 shadow-card
            ${settlementOverdue ? 'border-danger/40 bg-danger/5' : 'border-burgundy/30 bg-burgundy/5'}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl animate-pulse shrink-0">🚨</span>
              <div className="flex-1">
                <p className={`font-extrabold text-sm mb-1 ${settlementOverdue ? 'text-danger' : 'text-danger'}`}>
                  {settlementOverdue
                    ? 'إنذار حرج — تسوية السلفة متأخرة وتستوجب متابعة فورية'
                    : `${criticalOverdue.length} عنصر حرج متأخر في هذه الدورة`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {criticalOverdue.map(el => (
                    <span key={el.id}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold
                        ${el.element?.key === 'settlement'
                          ? 'bg-danger/10 text-danger border-danger/20'
                          : 'bg-burgundy/10 text-danger border-burgundy/20'}`}>
                      <span>{CRITICAL_META[el.element?.key]?.icon}</span>
                      <span>{el.element.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── رأس الصفحة ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden"
          style={{ borderTop: `3px solid ${courseStatus.border}` }}>
          <div className="px-5 py-4 space-y-4">

            {/* سطر العنوان */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge meta={courseStatus} />
                  <span className="text-xs text-text-soft/60">
                    {course.courseType === 'internal' ? 'داخلية' : 'خارجية'}
                    {course.code ? ` · ${course.code}` : ''}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-text-main leading-tight">{course.name}</h1>
                {course.beneficiaryEntity && (
                  <p className="mt-0.5 text-xs text-text-soft">{course.beneficiaryEntity}{course.city ? ` · ${course.city}` : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowNotesReport(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-forest-50 px-3 py-2 text-xs font-extrabold text-accent hover:bg-accent hover:text-white transition shadow-sm">
                  📝 تقرير عام
                </button>
                {(isManager || isSupervisor) && (
                  <button
                    onClick={() => router.push(`/courses/${id}/edit`)}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft hover:border-primary hover:text-primary transition">
                    ✏️ تعديل
                  </button>
                )}
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft hover:bg-background transition">
                  ← رجوع
                </button>
              </div>
            </div>

            {/* تفاصيل الدورة */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Pill label="المشروع"   value={course.operationalProject?.name || '-'} />
              <Pill label="المسؤول"   value={`${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-'} />
              <Pill label="من"        value={fmt(course.startDate)} />
              <Pill label="إلى"       value={fmt(course.endDate)} />
              <Pill label="متدربون"   value={course.numTrainees ?? '-'} />
              {course.locationType && <Pill label="مقر التنفيذ"  value={course.locationType} />}
              <Pill label="سلفة"      value={course.requiresAdvance ? '✓' : '—'} />
              <Pill label="إيرادات"   value={course.requiresRevenue ? '✓' : '—'} />
              <Pill label="تسوية"     value={course.requiresAdvanceSettlement ? '✓' : '—'} />
              <Pill label="مواد"      value={course.materialsIssued ? '✓' : '—'} />
            </div>

            {/* شريط الإنجاز */}
            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-extrabold text-text-main">تقدم الإغلاق</span>
                <div className="flex items-center gap-3">
                  <span className="text-text-soft">
                    <span className="font-bold text-accent">{completedElements.length}</span>
                    <span className="text-text-soft/60"> / {sortedElements.filter(e=>e.status!=='NOT_APPLICABLE').length} عنصر</span>
                  </span>
                  <span className="font-extrabold text-primary">{progress}%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-forest-50">
                <div className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
              {activeElements.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {activeElements.filter(e=>e.status==='RETURNED').length > 0 && (
                    <span className="rounded-full bg-sand/20 px-2 py-0.5 text-warning font-bold border border-sand/40">
                      {activeElements.filter(e=>e.status==='RETURNED').length} مُعاد
                    </span>
                  )}
                  {activeElements.filter(e=>isOverdue(e)).length > 0 && (
                    <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-danger font-bold border border-burgundy/20">
                      {activeElements.filter(e=>isOverdue(e)).length} متأخر
                    </span>
                  )}
                  {activeElements.filter(e=>e.status==='NOT_STARTED').length > 0 && (
                    <span className="rounded-full bg-background px-2 py-0.5 text-text-soft border border-border">
                      {activeElements.filter(e=>e.status==='NOT_STARTED').length} لم يبدأ
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="font-extrabold text-text-main">العناصر غير المكتملة</h2>
                <p className="text-[11px] text-text-soft mt-0.5">حسب تسلسل الإقفال</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sand/20 text-sm font-extrabold text-warning border border-sand/40">{activeElements.length}</span>
            </div>
            <div className="p-3 space-y-2">
              {activeElements.length > 0 ? activeElements.map(el => renderElementCard(el)) : <p className="py-8 text-center text-sm text-text-soft">لا توجد عناصر غير مكتملة</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="font-extrabold text-text-main">العناصر المكتملة</h2>
                <p className="text-[11px] text-text-soft mt-0.5">مرفوعة أو مُعتمدة</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-50 text-sm font-extrabold text-accent border border-accent/20">{completedElements.length}</span>
            </div>
            <div className="p-3 space-y-2">
              {completedElements.length > 0 ? completedElements.map(el => renderElementCard(el)) : <p className="py-8 text-center text-sm text-text-soft">لا توجد عناصر مكتملة</p>}
            </div>
          </div>
        </div>

        {/* ── عناصر غير منطبقة على هذه الدورة ──────────────────────────── */}
        {notApplicableElements.length > 0 && (
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="font-extrabold text-text-main">عناصر غير منطبقة</h2>
                <p className="text-[11px] text-text-soft mt-0.5">لا تُحسب ضمن متطلبات إغلاق هذه الدورة</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-border/40 text-sm font-extrabold text-text-soft/60 border border-border/40">{notApplicableElements.length}</span>
            </div>
            <div className="p-3 space-y-2">
              {notApplicableElements.map(el => renderElementCard(el))}
            </div>
          </div>
        )}

        {/* ── عناصر اختيارية لهذه الدورة ──────────────────────────────── */}
        {optionalElements.length > 0 && (isCoordinator || isApprover) && (
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-extrabold text-text-main">عناصر اختيارية لهذه الدورة</h2>
              <p className="text-[11px] text-text-soft mt-0.5">فعّل العناصر التي تنطبق على هذه الدورة فقط</p>
            </div>
            <div className="p-3 space-y-2">
              {optionalElements.map((el) => {
                const enabled = el.status !== 'NOT_APPLICABLE';
                const locked = ['APPROVED', 'PENDING_APPROVAL'].includes(el.status);
                return (
                  <label key={el.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 ${locked ? '' : 'cursor-pointer hover:bg-background'}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={enabled} disabled={locked}
                        onChange={(e) => toggleOptionalElement(el.id, e.target.checked)}
                        className="h-4 w-4 accent-primary" />
                      <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                    </div>
                    <Badge meta={EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED} small />
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
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-extrabold text-text-main">تحكم المدير في عناصر الإقفال</h2>
              <p className="text-[11px] text-text-soft mt-0.5">استرجاع عناصر معتمدة أو استثناء عناصر من متطلبات الدورة — يتطلب سبباً ويُسجّل في سجل المراجعة</p>
            </div>
            <div className="p-3 space-y-4">

              {/* استرجاع عنصر معتمد */}
              <div>
                <h4 className="mb-2 text-xs font-extrabold text-text-soft">عناصر معتمدة (يمكن استرجاعها)</h4>
                {approvedElements.length === 0 ? (
                  <p className="text-xs text-text-soft">لا توجد عناصر معتمدة</p>
                ) : (
                  <div className="space-y-1.5">
                    {approvedElements.map((el) => (
                      <div key={el.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                        <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                        <button onClick={() => overrideElement(el.id, 'revert', true)}
                          className="rounded-lg border border-burgundy/20 px-2 py-1 text-[11px] font-bold text-danger hover:bg-burgundy/5">
                          ↩️ استرجاع
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
                      <button onClick={() => overrideElement(el.id, 'force-reset', true)}
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
                <h4 className="mb-2 text-xs font-extrabold text-text-soft">استثناء عنصر من هذه الدورة</h4>
                {exemptableElements.length === 0 ? (
                  <p className="text-xs text-text-soft">لا توجد عناصر يمكن استثناؤها</p>
                ) : (
                  <div className="space-y-1.5">
                    {exemptableElements.map((el) => (
                      <div key={el.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                          <Badge meta={EL_STATUS_META[el.status] || EL_STATUS_META.NOT_STARTED} small />
                        </div>
                        <button onClick={() => overrideElement(el.id, 'exempt', true)}
                          className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-white">
                          استثناء
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* عناصر مُستثناة من المدير */}
              {exemptedByManager.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-extrabold text-text-soft">عناصر مُستثناة من المدير</h4>
                  <div className="space-y-1.5">
                    {exemptedByManager.map((el) => (
                      <div key={el.id} className="rounded-xl border border-border bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-text-main">{el.element.name}</span>
                          <button onClick={() => overrideElement(el.id, 'restore', false)}
                            className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-white">
                            إلغاء الاستثناء
                          </button>
                        </div>
                        {el.overrideReason && (
                          <p className="mt-1 text-[11px] text-text-soft">السبب: {el.overrideReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── لا توجد عناصر ────────────────────────────────────────────── */}
        {sortedElements.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-soft shadow-card">
            لا توجد عناصر إغلاق لهذه الدورة
          </div>
        )}
      </div>

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
