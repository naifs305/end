import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import MainLayout from '../../components/layout/MainLayout';
import ElementRow from '../../components/operational/ElementRow';
import Modal from '../../components/operational/Modal';
import CourseReportForm from '../../components/operational/CourseReportForm';
import FinancialForm from '../../components/operational/FinancialForm';
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
  trainee_registration: 1, registration_message: 2, advance_req: 3, pre_test: 4,
  opening_report: 5, reaction_evaluation: 6, post_test: 7, certificates: 8,
  closing_report: 9, report: 9, supervisor_compensation: 10, trainer_compensation: 11,
  revenues: 12, materials: 13, settlement: 14,
};

function fmt(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ar-SA', { day:'numeric', month:'short', year:'numeric' });
}
function fmtFull(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('ar-SA', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
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
  const { activeRole } = useAuth();

  const [course,          setCourse]          = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showAll,         setShowAll]         = useState(false);

  const isEmployee   = activeRole === 'EMPLOYEE';
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
    ['PENDING_APPROVAL','APPROVED','NOT_APPLICABLE'].includes(el.status)), [sortedElements]);

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
    if (isEmployee && el.element.isFormBased &&
        !['APPROVED','PENDING_APPROVAL','NOT_APPLICABLE'].includes(el.status)) {
      return (
        <button onClick={() => setSelectedElement(el)}
          className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition">
          فتح النموذج
        </button>
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

    return (
      <div key={el.id}
        className="rounded-2xl border border-border bg-white shadow-card overflow-hidden transition hover:shadow-soft"
        style={{ borderInlineStart: `3px solid ${meta.border}` }}>
        <div className="p-4 space-y-3">

          {/* رأس العنصر */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h4 className="font-extrabold text-sm text-text-main">{el.element.name}</h4>
              <Badge meta={meta} small />
              {overdue && (
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
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <ElementRow element={{ ...el, course }} activeRole={activeRole} onUpdate={fetchCourse} />
              {renderAction(el)}
            </div>
          </div>

          {/* المواعيد */}
          {deadline && !['APPROVED','NOT_APPLICABLE'].includes(el.status) && (
            <div className="flex flex-wrap gap-4 text-[11px]">
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

  return (
    <MainLayout>
      <div className="space-y-4">

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
                    <span className="font-bold text-accent">{completedElements.filter(e=>e.status!=='NOT_APPLICABLE').length}</span>
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

        {/* ── العناصر النشطة ──────────────────────────────────────────── */}
        {activeElements.length > 0 && (
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div>
                <h2 className="font-extrabold text-text-main">العناصر النشطة</h2>
                <p className="text-[11px] text-text-soft mt-0.5">تحتاج إجراء أو معالجة</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sand/20 text-sm font-extrabold text-warning border border-sand/40">
                {activeElements.length}
              </span>
            </div>
            <div className="p-4 grid gap-3 sm:grid-cols-2">
              {activeElements.map(el => renderElementCard(el))}
            </div>
          </div>
        )}

        {/* ── العناصر المكتملة ─────────────────────────────────────────── */}
        {completedElements.length > 0 && (
          <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between border-b border-border px-5 py-3.5 hover:bg-background transition"
              onClick={() => setShowAll(v => !v)}>
              <div className="text-right">
                <h2 className="font-extrabold text-text-main">العناصر المكتملة</h2>
                <p className="text-[11px] text-text-soft mt-0.5">مرفوعة أو مُعتمدة</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-50 text-sm font-extrabold text-accent border border-accent/20">
                  {completedElements.length}
                </span>
                <span className="text-text-soft text-sm">{showAll ? '▲' : '▼'}</span>
              </div>
            </button>
            {showAll && (
              <div className="p-4 grid gap-3 sm:grid-cols-2">
                {completedElements.map(el => renderElementCard(el))}
              </div>
            )}
            {!showAll && (
              <div className="px-5 py-3 text-center text-xs text-text-soft/60">
                اضغط لعرض {completedElements.length} عنصر مكتمل
              </div>
            )}
          </div>
        )}

        {/* ── لا توجد عناصر ────────────────────────────────────────────── */}
        {sortedElements.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-soft shadow-card">
            لا توجد عناصر إغلاق لهذه الدورة
          </div>
        )}
      </div>

      {/* ── المودال ──────────────────────────────────────────────────── */}
      {selectedElement && (
        <Modal isOpen onClose={() => setSelectedElement(null)} title={selectedElement.element.name}>
          {isReportKey(selectedElement.element.key) && (
            <CourseReportForm
              trackingId={selectedElement.id}
              course={course}
              reportType={selectedElement.element.key}
              onClose={() => setSelectedElement(null)}
              onSuccess={fetchCourse}
            />
          )}
          {(selectedElement.element.key === 'advance_req' || selectedElement.element.key === 'settlement') && (
            <FinancialForm
              type={selectedElement.element.key === 'advance_req' ? 'advance' : 'settlement'}
              trackingId={selectedElement.id}
              onClose={() => setSelectedElement(null)}
              onSuccess={fetchCourse}
            />
          )}
        </Modal>
      )}
    </MainLayout>
  );
}
