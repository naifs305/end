import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  Send,
  RotateCcw,
  Undo2,
  Bell,
  CheckCircle2,
  Check,
  CornerUpLeft,
  X,
  Clock,
  AlertTriangle,
  HeartPulse,
  FileText,
} from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import useAuth from '../../context/AuthContext';
import { useTranslation } from '../../lib/i18n';
import { useSettings } from '../../lib/hooks/useSettings';
import CourseReportForm from './CourseReportForm';
import ReasonModal from './ReasonModal';

// ======================================================================
// مكون صف عنصر الإقفال
// ======================================================================
export default function ElementRow({ element, activeRole, isOverdue = false, onUpdate }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { get: getSetting } = useSettings();
  const [loading, setLoading] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [showDelayReason, setShowDelayReason] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extHours, setExtHours] = useState('');
  const [extReason, setExtReason] = useState('');
  const [savingExt, setSavingExt] = useState(false);
  const isFinancialElement = ['advance_req', 'settlement'].includes(element?.element?.key);
  const isOpeningReport = element?.element?.key === 'opening_report';
  const isClosingReport = element?.element?.key === 'closing_report';
  const isCourseReport = isOpeningReport || isClosingReport;
  const [showReportForm, setShowReportForm] = useState(false);
  const solfUrl = getSetting('solf.url', process.env.NEXT_PUBLIC_SOLF_URL || 'https://solf-nif.vercel.app');

  // ── نموذج التأمين الطبي ──
  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    issuedCount: '',
    totalTrainees: element?.course?.numTrainees || '',
    notInsuredReason: '',
    note: '',
  });

  const handleInsuranceSubmit = async () => {
    const issued = Number(insuranceForm.issuedCount);
    const total = Number(insuranceForm.totalTrainees);
    if (!insuranceForm.issuedCount || isNaN(issued) || issued < 0) {
      toast.error(t('element.toast.insuranceEnterIssued'));
      return;
    }
    if (issued < total && !insuranceForm.notInsuredReason.trim()) {
      toast.error(t('element.toast.insuranceReason'));
      return;
    }
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, {
        status: 'PENDING_APPROVAL',
        formData: {
          issuedCount: issued,
          totalTrainees: total,
          notInsuredCount: Math.max(0, total - issued),
          notInsuredReason: insuranceForm.notInsuredReason.trim() || null,
          note: insuranceForm.note.trim() || null,
        },
        ...(delayReason.trim() ? { delayReason: delayReason.trim() } : {}),
      });
      toast.success(t('element.toast.insuranceSubmitted'));
      setShowInsuranceForm(false);
      setDelayReason('');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('element.toast.submitError'));
    } finally {
      setLoading(false);
    }
  };

  const isEmployee = activeRole === 'EMPLOYEE';
  const isCoordinator = user?.id && user.id === element?.course?.primaryEmployeeId;
  const canExecute = isEmployee || isCoordinator;
  const isApprover = activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
  const isManager = activeRole === 'MANAGER';
  const [volunteering, setVolunteering] = useState(false);
  const canVolunteerReport = canExecute && isCourseReport && element.status === 'NOT_APPLICABLE';

  const handleVolunteerReport = async () => {
    setVolunteering(true);
    try {
      await api.post(`/courses/${element.courseId}/toggle-report`, {
        type: isOpeningReport ? 'opening' : 'closing',
        enabled: true,
      });
      toast.success(t('element.toast.volunteerEnabled'));
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('element.toast.volunteerFailed'));
    } finally {
      setVolunteering(false);
    }
  };

  // ---- إجراءات الموظف ----
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, {
        status: 'PENDING_APPROVAL',
        ...(delayReason.trim() ? { delayReason: delayReason.trim() } : {}),
      });
      toast.success(t('element.toast.submitted'));
      setDelayReason('');
      setShowDelayReason(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('element.toast.submitError'));
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'NOT_STARTED' });
      toast.success(t('element.toast.withdrawn'));
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // ---- إجراءات المعتمد ----
  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'APPROVED' });
      toast.success(t('element.toast.approved'));
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      toast.error(t('element.toast.returnReasonRequired'));
      return;
    }
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'RETURNED', notes: returnReason.trim() });
      toast.success(t('element.toast.returned'));
      setReturnReason('');
      setShowReturnForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error(t('element.toast.rejectReasonRequired'));
      return;
    }
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'REJECTED', notes: rejectReason.trim() });
      toast.success(t('element.toast.rejected'));
      setRejectReason('');
      setShowRejectForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const [showManualClose, setShowManualClose] = useState(false);
  const doManualClose = async (notes) => {
    setLoading(true);
    try {
      await api.post(`/closure/${element.id}/manual-financial-close`, { notes });
      toast.success(t('element.toast.manualClosed'));
      setShowManualClose(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('element.toast.manualCloseFailed'));
    } finally {
      setLoading(false);
    }
  };

  const openSolfForCourse = () => {
    const params = new URLSearchParams({
      courseId: element.courseId,
      courseCode: element.course?.code || '',
      courseName: element.course?.name || '',
      employeeEmail: element.course?.primaryEmployee?.email || '',
      location: element.course?.city || '',
      formType: element.element?.key === 'settlement' ? 'settlement' : 'request',
      startDate: element.course?.startDate ? String(element.course.startDate).slice(0, 10) : '',
      endDate: element.course?.endDate ? String(element.course.endDate).slice(0, 10) : '',
    });
    window.open(`${solfUrl}/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  // ---- تمديد الموعد (مدير فقط) ----
  const handleGrantExtension = async () => {
    const hours = Number(extHours);
    if (!hours || hours < 1) {
      toast.error(t('element.toast.extHoursInvalid'));
      return;
    }
    if (!extReason.trim()) {
      toast.error(t('element.toast.extReasonRequired'));
      return;
    }
    setSavingExt(true);
    try {
      await api.post(`/closure/${element.id}/extend`, {
        extensionHours: hours,
        extensionReason: extReason.trim(),
      });
      toast.success(t('element.toast.extGranted', { hours }));
      setExtHours('');
      setExtReason('');
      setShowExtendForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || t('element.toast.extFailed'));
    } finally {
      setSavingExt(false);
    }
  };

  // ---- تذكير المدير ----
  const handleRemind = async () => {
    setReminding(true);
    try {
      const res = await api.get('/messages/users');
      const approvers = (res.data || []).filter(
        (u) => Array.isArray(u.roles) && (u.roles.includes('MANAGER') || u.roles.includes('PROJECT_SUPERVISOR'))
      );
      if (!approvers.length) {
        toast.error(t('element.toast.noApprover'));
        return;
      }
      await api.post('/messages', {
        recipientIds: approvers.map((u) => u.id),
        subject: t('element.remind.subject', { course: element?.course?.name || t('course.form.editTitle') }),
        message: t('element.remind.body', { element: element?.element?.name || '', course: element?.course?.name || '' }),
        courseId: element?.courseId || undefined,
      });
      toast.success(t('element.toast.reminderSent'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('element.toast.reminderFailed'));
    } finally {
      setReminding(false);
    }
  };

  const Spinner = () => <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />;

  // ======================================================================
  // العرض
  // ======================================================================
  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
      {/* زر منصة السلف */}
      {canExecute && isFinancialElement && !['APPROVED', 'NOT_APPLICABLE'].includes(element.status) && (
        <button
          type="button"
          onClick={openSolfForCourse}
          className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/30 bg-white px-3 py-2 text-xs font-bold text-primary shadow-sm hover:bg-primary-light"
        >
          <ExternalLink size={14} aria-hidden="true" /> {t('element.solfPlatform')}
        </button>
      )}

      {canExecute && ['NOT_STARTED', 'RETURNED', 'REJECTED'].includes(element.status) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isMedicalInsurance ? (
              <button
                onClick={() => setShowInsuranceForm((v) => !v)}
                disabled={loading}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50"
              >
                <HeartPulse size={14} aria-hidden="true" />
                {element.status === 'RETURNED' ? t('element.resubmit') : t('element.submitInsurance')}
              </button>
            ) : isCourseReport ? (
              <button
                onClick={() => setShowReportForm(true)}
                disabled={loading}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50"
              >
                <FileText size={14} aria-hidden="true" />
                {element.status === 'RETURNED' ? t('element.resubmit') : element.formData ? t('element.completeDraft') : t('element.submit')}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition disabled:opacity-50 ${
                  isFinancialElement ? 'border border-sand/50 bg-white text-warning hover:bg-sand/10' : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {loading ? (
                  <><Spinner /> {t('element.uploading')}</>
                ) : isFinancialElement ? (
                  <>{t('element.submitOutsidePlatform')}</>
                ) : element.status === 'RETURNED' ? (
                  <><RotateCcw size={14} aria-hidden="true" /> {t('element.resubmit')}</>
                ) : (
                  <><Send size={14} aria-hidden="true" /> {t('element.submit')}</>
                )}
              </button>
            )}

            {isOverdue && (
              <button type="button" onClick={() => setShowDelayReason((v) => !v)} className="text-xs text-text-soft underline hover:text-primary">
                {showDelayReason ? t('element.hideDelayReason') : `+ ${t('element.addDelayReason')}`}
              </button>
            )}
          </div>

          {showDelayReason && (
            <div className="w-full rounded-xl border border-sand/40 bg-sand/10 p-2">
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder={t('element.delayReasonPlaceholder')}
                className="w-full resize-none rounded-lg border border-sand/30 bg-white p-2 text-xs text-text-main outline-none focus:border-primary"
              />
              <p className="mt-1 text-end text-[10px] text-text-soft">{delayReason.length}/400</p>
            </div>
          )}

          {/* ── نموذج التأمين الطبي ── */}
          {isMedicalInsurance && showInsuranceForm && (
            <div className="w-full space-y-3 rounded-xl border border-primary/20 bg-primary-light p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-primary">
                <HeartPulse size={16} aria-hidden="true" /> {t('element.insurance.title')}
              </p>

              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">
                  {t('element.insurance.totalTrainees')} <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={insuranceForm.totalTrainees}
                  onChange={(e) => setInsuranceForm((p) => ({ ...p, totalTrainees: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder={t('element.insurance.totalPlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">
                  {t('element.insurance.issuedCount')} <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={insuranceForm.issuedCount}
                  onChange={(e) => setInsuranceForm((p) => ({ ...p, issuedCount: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder={t('element.insurance.issuedPlaceholder')}
                />
                {insuranceForm.issuedCount &&
                  insuranceForm.totalTrainees &&
                  Number(insuranceForm.issuedCount) < Number(insuranceForm.totalTrainees) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-warning">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {t('element.insurance.uninsuredWarning', { count: Number(insuranceForm.totalTrainees) - Number(insuranceForm.issuedCount) })}
                    </p>
                  )}
              </div>

              {insuranceForm.issuedCount &&
                insuranceForm.totalTrainees &&
                Number(insuranceForm.issuedCount) < Number(insuranceForm.totalTrainees) && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-text-main">
                      {t('element.insurance.uninsuredReasonLabel', { count: Number(insuranceForm.totalTrainees) - Number(insuranceForm.issuedCount) })} <span className="text-danger">*</span>
                    </label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={insuranceForm.notInsuredReason}
                      onChange={(e) => setInsuranceForm((p) => ({ ...p, notInsuredReason: e.target.value }))}
                      placeholder={t('element.insurance.uninsuredReasonPlaceholder')}
                      className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                  </div>
                )}

              <div>
                <label className="mb-1 block text-xs font-bold text-text-main">{t('element.insurance.noteLabel')}</label>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={insuranceForm.note}
                  onChange={(e) => setInsuranceForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder={t('element.insurance.notePlaceholder')}
                  className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleInsuranceSubmit}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {loading ? '...' : (<><Check size={14} aria-hidden="true" /> {t('element.insurance.submitForApproval')}</>)}
                </button>
                <button onClick={() => setShowInsuranceForm(false)} className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-text-soft hover:bg-background">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canVolunteerReport && (
        <button
          type="button"
          onClick={handleVolunteerReport}
          disabled={volunteering}
          className="whitespace-nowrap rounded-xl border border-accent/40 bg-forest-50 px-3 py-2 text-xs font-bold text-accent shadow-sm hover:bg-accent hover:text-white disabled:opacity-50"
          title={t('element.volunteerReportHint')}
        >
          {volunteering ? '...' : t('element.volunteerReport')}
        </button>
      )}

      {canExecute && element.status === 'PENDING_APPROVAL' && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleWithdraw}
            disabled={loading || reminding}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs font-bold text-warning transition hover:bg-sand/20 disabled:opacity-50"
          >
            <Undo2 size={14} aria-hidden="true" /> {t('element.withdraw')}
          </button>
          <button
            onClick={handleRemind}
            disabled={loading || reminding}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-primary-light disabled:opacity-50"
          >
            {reminding ? (<><Spinner /> {t('element.sending')}</>) : (<><Bell size={14} aria-hidden="true" /> {t('element.remindSupervisor')}</>)}
          </button>
        </div>
      )}

      {/* أزرار المعتمد */}
      {isApprover && isFinancialElement && !['APPROVED', 'NOT_APPLICABLE'].includes(element.status) && (
        <button
          type="button"
          onClick={() => setShowManualClose(true)}
          disabled={loading}
          className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-xl border border-accent/40 bg-forest-50 px-3 py-2 text-xs font-bold text-accent shadow-sm hover:bg-accent hover:text-white disabled:opacity-50"
        >
          <CheckCircle2 size={14} aria-hidden="true" /> {t('element.manualClose')}
        </button>
      )}

      <ReasonModal
        open={showManualClose}
        title={t('element.manualClose')}
        label={t('element.toast.manualClosePrompt')}
        initialValue={t('element.toast.manualCloseDefault')}
        tone="primary"
        loading={loading}
        onConfirm={doManualClose}
        onCancel={() => setShowManualClose(false)}
      />

      {/* عرض بيانات التأمين للمعتمد */}
      {isApprover && isMedicalInsurance && element.status === 'PENDING_APPROVAL' && element.formData && (
        <div className="mb-1 w-full space-y-1.5 rounded-xl border border-primary/20 bg-primary-light px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary">
            <HeartPulse size={14} aria-hidden="true" /> {t('element.insurance.submittedTitle')}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <p className="mb-0.5 text-text-soft">{t('element.insurance.totalShort')}</p>
              <p className="text-xl font-extrabold text-text-main">{element.formData.totalTrainees ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <p className="mb-0.5 text-text-soft">{t('element.insurance.issuedShort')}</p>
              <p className="text-xl font-extrabold text-accent">{element.formData.issuedCount ?? '-'}</p>
            </div>
            <div className={`rounded-lg border px-3 py-2 text-center ${element.formData.notInsuredCount > 0 ? 'border-burgundy/20 bg-burgundy/5' : 'border-border bg-white'}`}>
              <p className="mb-0.5 text-text-soft">{t('element.insurance.uninsuredShort')}</p>
              <p className={`text-xl font-extrabold ${element.formData.notInsuredCount > 0 ? 'text-danger' : 'text-accent'}`}>{element.formData.notInsuredCount ?? 0}</p>
            </div>
          </div>
          {element.formData.notInsuredReason && (
            <div className="rounded-lg border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-xs text-danger">
              <span className="font-bold">{t('element.insurance.uninsuredReasonView')} </span>
              {element.formData.notInsuredReason}
            </div>
          )}
          {element.formData.note && (
            <div className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text-soft">
              <span className="font-bold text-text-main">{t('element.insurance.noteView')} </span>
              {element.formData.note}
            </div>
          )}
        </div>
      )}

      {isApprover && element.status === 'PENDING_APPROVAL' && (
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <Check size={14} aria-hidden="true" /> {t('element.approve')}
            </button>
            <button
              type="button"
              onClick={() => { setShowReturnForm((v) => !v); setShowRejectForm(false); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              <CornerUpLeft size={14} aria-hidden="true" /> {t('element.returnToEmployee')}
            </button>
            <button
              type="button"
              onClick={() => { setShowRejectForm((v) => !v); setShowReturnForm(false); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              <X size={14} aria-hidden="true" /> {t('element.reject')}
            </button>
          </div>

          {showReturnForm && (
            <div className="rounded-xl border border-sand/40 bg-sand/10 p-2">
              <p className="mb-1 text-xs font-bold text-warning">{t('element.returnReasonLabel')}</p>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder={t('element.returnReasonPlaceholder')}
                className="w-full resize-none rounded-lg border border-sand/30 bg-white p-2 text-xs outline-none focus:border-warning"
              />
              <div className="mt-1.5 flex gap-2">
                <button onClick={handleReturn} disabled={loading} className="rounded-lg bg-warning px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                  {t('element.confirmReturn')}
                </button>
                <button onClick={() => { setShowReturnForm(false); setReturnReason(''); }} className="rounded-lg border border-border px-3 py-1 text-xs text-text-soft">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {showRejectForm && (
            <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 p-2">
              <p className="mb-1 text-xs font-bold text-danger">{t('element.rejectReasonLabel')}</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder={t('element.rejectReasonPlaceholder')}
                className="w-full resize-none rounded-lg border border-burgundy/20 bg-white p-2 text-xs outline-none focus:border-danger"
              />
              <div className="mt-1.5 flex gap-2">
                <button onClick={handleReject} disabled={loading} className="rounded-lg bg-danger px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                  {t('element.confirmReject')}
                </button>
                <button onClick={() => { setShowRejectForm(false); setRejectReason(''); }} className="rounded-lg border border-border px-3 py-1 text-xs text-text-soft">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* تمديد الموعد — مدير فقط */}
      {isManager && !['APPROVED', 'NOT_APPLICABLE'].includes(element.status) && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowExtendForm((v) => !v)}
            className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/40 bg-primary-light/50 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-light"
          >
            {showExtendForm ? t('common.close') : (<><Clock size={14} aria-hidden="true" /> {t('element.grantExtension')}</>)}
          </button>

          {showExtendForm && (
            <div className="rounded-xl border border-primary/20 bg-primary-light/30 p-3">
              <p className="mb-2 text-xs font-bold text-primary">{t('element.grantExtensionTitle')}</p>
              <div className="flex flex-wrap gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-text-soft">{t('element.hoursLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={extHours}
                    onChange={(e) => setExtHours(e.target.value)}
                    placeholder={t('element.hoursPlaceholder')}
                    className="w-24 rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10px] text-text-soft">{t('element.extReasonLabel')}</label>
                  <input
                    type="text"
                    maxLength={300}
                    value={extReason}
                    onChange={(e) => setExtReason(e.target.value)}
                    placeholder={t('element.extReasonPlaceholder')}
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={handleGrantExtension} disabled={savingExt} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  {savingExt ? '...' : t('element.grantExtensionBtn')}
                </button>
                <button onClick={() => { setShowExtendForm(false); setExtHours(''); setExtReason(''); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-soft">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── نموذج تقرير الافتتاح/الاختتام ─────────────────────────── */}
      {isCourseReport && showReportForm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-5xl rounded-3xl border border-border bg-background p-4 shadow-deep">
            <CourseReportForm
              trackingId={element.id}
              course={element.course}
              reportType={element.element.key}
              delayReason={delayReason}
              initialData={element.formData || null}
              onClose={() => setShowReportForm(false)}
              onSuccess={onUpdate}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
