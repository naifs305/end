import { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import useAuth from '../../context/AuthContext';
import CourseReportForm from './CourseReportForm';

// ======================================================================
// مكون صف عنصر الإقفال — المرحلة الرابعة
// ======================================================================
// تحسينات:
//   ١. حقل مبرر التأخر للموظف (مخفي افتراضياً، يظهر بالضغط)
//   ٢. نموذج سبب الإعادة/الرفض inline بدلاً من prompt()
//   ٣. زر منح تمديد للمدير مع نموذج داخلي

export default function ElementRow({ element, activeRole, isOverdue = false, onUpdate }) {
  const { user } = useAuth();
  const [loading, setLoading]               = useState(false);
  const [reminding, setReminding]           = useState(false);
  const [showDelayReason, setShowDelayReason] = useState(false);
  const [delayReason, setDelayReason]       = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason]     = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason]     = useState('');
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extHours, setExtHours]             = useState('');
  const [extReason, setExtReason]           = useState('');
  const [savingExt, setSavingExt]           = useState(false);
  const isFinancialElement = ['advance_req', 'settlement'].includes(element?.element?.key);
  const isOpeningReport = element?.element?.key === 'opening_report';
  const isClosingReport = element?.element?.key === 'closing_report';
  const isCourseReport = isOpeningReport || isClosingReport;
  const [showReportForm, setShowReportForm] = useState(false);
  const solfUrl = process.env.NEXT_PUBLIC_SOLF_URL || 'https://solf-nif.vercel.app';

  const isEmployee = activeRole === 'EMPLOYEE';
  const isCoordinator = user?.id && user.id === element?.course?.primaryEmployeeId;
  const canExecute = isEmployee || isCoordinator;
  const isApprover = activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
  const isManager  = activeRole === 'MANAGER';
  const [volunteering, setVolunteering] = useState(false);
  const canVolunteerReport = canExecute && isCourseReport && element.status === 'NOT_APPLICABLE';

  const handleVolunteerReport = async () => {
    setVolunteering(true);
    try {
      await api.post(`/courses/${element.courseId}/toggle-report`, {
        type: isOpeningReport ? 'opening' : 'closing',
        enabled: true,
      });
      toast.success('تم تفعيل التقرير — يمكنك تقديمه الآن، وسيُقدَّر هذا العمل التطوّعي في مؤشرات أدائك');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر تفعيل التقرير');
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
      toast.success('تم تقديم العنصر');
      setDelayReason('');
      setShowDelayReason(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في التقديم');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'NOT_STARTED' });
      toast.success('تم سحب التقديم');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  // ---- إجراءات المعتمد ----

  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'APPROVED' });
      toast.success('تم الاعتماد');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) { toast.error('سبب الإعادة مطلوب'); return; }
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'RETURNED', notes: returnReason.trim() });
      toast.success('تم إعادة العنصر للموظف');
      setReturnReason('');
      setShowReturnForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('سبب الرفض مطلوب'); return; }
    setLoading(true);
    try {
      await api.put(`/closure/${element.id}`, { status: 'REJECTED', notes: rejectReason.trim() });
      toast.success('تم رفض العنصر');
      setRejectReason('');
      setShowRejectForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleManualFinancialClose = async () => {
    const notes = window.prompt('ملاحظة التقفيل اليدوي (اختياري):', 'تم تنفيذ الإجراء خارج منصة السلف');
    if (notes === null) return;
    setLoading(true);
    try {
      await api.post(`/closure/${element.id}/manual-financial-close`, { notes });
      toast.success('تم تقفيل العنصر مباشرة');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر تقفيل العنصر');
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
    if (!hours || hours < 1) { toast.error('أدخل عدد ساعات صحيح'); return; }
    if (!extReason.trim()) { toast.error('سبب التمديد مطلوب'); return; }
    setSavingExt(true);
    try {
      await api.post(`/closure/${element.id}/extend`, {
        extensionHours: hours,
        extensionReason: extReason.trim(),
      });
      toast.success(`تم منح تمديد ${hours} ساعة للموظف`);
      setExtHours('');
      setExtReason('');
      setShowExtendForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر منح التمديد');
    } finally {
      setSavingExt(false);
    }
  };

  // ---- تذكير المدير ----

  const handleRemind = async () => {
    setReminding(true);
    try {
      const res = await api.get('/messages/users');
      const approvers = (res.data || []).filter((u) =>
        Array.isArray(u.roles) && (u.roles.includes('MANAGER') || u.roles.includes('PROJECT_SUPERVISOR'))
      );
      if (!approvers.length) { toast.error('لا يوجد معتمد متاح'); return; }
      await api.post('/messages', {
        recipientIds: approvers.map((u) => u.id),
        subject: `تذكير باعتماد عنصر — ${element?.course?.name || 'دورة'}`,
        message: `نأمل مراجعة "${element?.element?.name || 'عنصر'}" المرفوع في "${element?.course?.name || 'الدورة'}" وهو بانتظار الاعتماد.`,
        courseId: element?.courseId || undefined,
      });
      toast.success('تم إرسال التذكير');
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر إرسال التذكير');
    } finally {
      setReminding(false);
    }
  };

  // ======================================================================
  // العرض
  // ======================================================================

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">

      {/* أزرار الموظف — تقديم / سحب */}
      {canExecute && isFinancialElement && !['APPROVED', 'NOT_APPLICABLE'].includes(element.status) && (
        <button
          type="button"
          onClick={openSolfForCourse}
          className="w-fit whitespace-nowrap rounded-xl border border-primary/30 bg-white px-3 py-2 text-xs font-bold text-primary shadow-sm hover:bg-primary-light"
        >
          منصة السلف
        </button>
      )}

      {canExecute && ['NOT_STARTED', 'RETURNED', 'REJECTED'].includes(element.status) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isCourseReport ? (
            <button
              onClick={() => setShowReportForm(true)}
              disabled={loading}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 transition"
            >
              📋 {element.status === 'RETURNED' ? '↩ إعادة تقديم' : element.formData ? '✏️ استكمال المسودة' : 'تقديم'}
            </button>
            ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold shadow-sm disabled:opacity-50 transition ${isFinancialElement ? 'border border-sand/50 bg-white text-warning hover:bg-sand/10' : 'bg-primary text-white hover:bg-primary-dark'}`}
            >
              {loading
                ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> جاري الرفع...</>
                : isFinancialElement ? 'تقديم خارج المنصة' : element.status === 'RETURNED' ? '↩ إعادة تقديم' : 'تقديم'}
            </button>
            )}

            {/* زر إضافة مبرر — مخفي بالافتراض */}
            {isOverdue && (
              <button
                type="button"
                onClick={() => setShowDelayReason((v) => !v)}
                className="text-xs text-text-soft underline hover:text-primary"
              >
                {showDelayReason ? 'إخفاء المبرر' : '+ أضف مبرراً للتأخر'}
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
                placeholder="اكتب مبرراً للتأخر (اختياري — سيظهر للمشرف والمدير)"
                className="w-full resize-none rounded-lg border border-sand/30 bg-white p-2 text-xs text-text-main outline-none focus:border-primary"
              />
              <p className="mt-1 text-right text-[10px] text-text-soft">{delayReason.length}/400</p>
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
          title="هذا التقرير غير إجباري على هذه الدورة، لكن تقديمه تطوّعاً يُحتسب لك تقديراً في مؤشرات الأداء"
        >
          {volunteering ? '...' : '🙋 تطوّع بتقديم هذا التقرير'}
        </button>
      )}

      {canExecute && element.status === 'PENDING_APPROVAL' && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleWithdraw}
            disabled={loading || reminding}
            className="whitespace-nowrap rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs font-bold text-warning hover:bg-sand/20 disabled:opacity-50 transition"
          >
            سحب التقديم
          </button>
          <button
            onClick={handleRemind}
            disabled={loading || reminding}
            className="whitespace-nowrap rounded-xl border border-primary bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-primary-light disabled:opacity-50"
          >
            {reminding
              ? <span className="flex items-center gap-1"><span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> إرسال...</span>
              : '🔔 تذكير المشرف'}
          </button>
        </div>
      )}

      {/* أزرار المعتمد */}
      {isApprover && isFinancialElement && !['APPROVED', 'NOT_APPLICABLE'].includes(element.status) && (
        <button
          type="button"
          onClick={handleManualFinancialClose}
          disabled={loading}
          className="w-fit whitespace-nowrap rounded-xl border border-accent/40 bg-forest-50 px-3 py-2 text-xs font-bold text-accent shadow-sm hover:bg-accent hover:text-white disabled:opacity-50"
        >
          تقفيل يدوي
        </button>
      )}


      {isApprover && element.status === 'PENDING_APPROVAL' && (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="whitespace-nowrap rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              اعتماد ✓
            </button>
            <button
              type="button"
              onClick={() => { setShowReturnForm((v) => !v); setShowRejectForm(false); }}
              disabled={loading}
              className="whitespace-nowrap rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              إعادة للموظف
            </button>
            <button
              type="button"
              onClick={() => { setShowRejectForm((v) => !v); setShowReturnForm(false); }}
              disabled={loading}
              className="whitespace-nowrap rounded-xl bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              رفض
            </button>
          </div>

          {/* نموذج الإعادة */}
          {showReturnForm && (
            <div className="rounded-xl border border-sand/40 bg-sand/10 p-2">
              <p className="mb-1 text-xs font-bold text-warning">سبب الإعادة (مطلوب)</p>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="وضّح للموظف ما يجب تصحيحه..."
                className="w-full resize-none rounded-lg border border-sand/30 bg-white p-2 text-xs outline-none focus:border-warning"
              />
              <div className="mt-1.5 flex gap-2">
                <button onClick={handleReturn} disabled={loading}
                  className="rounded-lg bg-warning px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                  تأكيد الإعادة
                </button>
                <button onClick={() => { setShowReturnForm(false); setReturnReason(''); }}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-text-soft">
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* نموذج الرفض */}
          {showRejectForm && (
            <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 p-2">
              <p className="mb-1 text-xs font-bold text-danger">سبب الرفض (مطلوب)</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="وضّح سبب الرفض النهائي..."
                className="w-full resize-none rounded-lg border border-burgundy/20 bg-white p-2 text-xs outline-none focus:border-danger"
              />
              <div className="mt-1.5 flex gap-2">
                <button onClick={handleReject} disabled={loading}
                  className="rounded-lg bg-danger px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                  تأكيد الرفض
                </button>
                <button onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-text-soft">
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* زر تمديد الموعد — مدير فقط */}
      {isManager && !['APPROVED', 'NOT_APPLICABLE'].includes(element.status) && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowExtendForm((v) => !v)}
            className="w-fit whitespace-nowrap rounded-xl border border-primary/40 bg-primary-light/50 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-light"
          >
            {showExtendForm ? 'إغلاق' : '⏱ منح تمديد'}
          </button>

          {showExtendForm && (
            <div className="rounded-xl border border-primary/20 bg-primary-light/30 p-3">
              <p className="mb-2 text-xs font-bold text-primary">منح تمديد إضافي للموعد</p>
              <div className="flex flex-wrap gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-text-soft">عدد الساعات</label>
                  <input
                    type="number" min="1" max="720"
                    value={extHours} onChange={(e) => setExtHours(e.target.value)}
                    placeholder="مثال: 24"
                    className="w-24 rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10px] text-text-soft">سبب التمديد</label>
                  <input
                    type="text" maxLength={300}
                    value={extReason} onChange={(e) => setExtReason(e.target.value)}
                    placeholder="الظروف التي استدعت التمديد..."
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={handleGrantExtension} disabled={savingExt}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  {savingExt ? '...' : 'منح التمديد'}
                </button>
                <button onClick={() => { setShowExtendForm(false); setExtHours(''); setExtReason(''); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-soft">
                  إلغاء
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
