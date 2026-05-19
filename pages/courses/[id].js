import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import MainLayout from '../../components/layout/MainLayout';
import ElementRow from '../../components/operational/ElementRow';
import Modal from '../../components/operational/Modal';
import CourseReportForm from '../../components/operational/CourseReportForm';
import FinancialForm from '../../components/operational/FinancialForm';

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { activeRole } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState(null);

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
      const res = await api.get(`/closure/${elementId}/export`, {
        responseType: 'text',
        headers: {
          Accept: 'text/html',
        },
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(res.data);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert('تعذر فتح التقرير');
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleReportEmlDownload = async (elementId, elementKey) => {
    try {
      const res = await api.get(`/closure/${elementId}/export-eml`, {
        responseType: 'blob',
        headers: { Accept: 'message/rfc822' },
      });
      const fallback = elementKey === 'opening_report' ? 'opening-report.eml' : 'closing-report.eml';
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      downloadBlob(res.data, match?.[1] || fallback);
    } catch (err) {
      console.error(err);
      alert('تعذر تنزيل ملف EML');
    }
  };


  const elementOrder = {
    trainee_registration: 1,
    registration_message: 2,
    advance_req: 3,
    pre_test: 4,
    opening_report: 5,
    reaction_evaluation: 6,
    post_test: 7,
    certificates: 8,
    closing_report: 9,
    report: 9,
    supervisor_compensation: 10,
    trainer_compensation: 11,
    revenues: 12,
    materials: 13,
    settlement: 14,
  };

  const sortedElements = useMemo(() => {
    if (!course?.closureElements) return [];
    return [...course.closureElements].sort((a, b) => {
      const aOrder = elementOrder[a.element?.key] ?? 999;
      const bOrder = elementOrder[b.element?.key] ?? 999;
      return aOrder - bOrder;
    });
  }, [course]);

  const activeElements = useMemo(() => {
    return sortedElements.filter(
      (el) =>
        el.status === 'NOT_STARTED' ||
        el.status === 'RETURNED' ||
        el.status === 'REJECTED',
    );
  }, [sortedElements]);

  const completedElements = useMemo(() => {
    return sortedElements.filter(
      (el) => el.status === 'PENDING_APPROVAL' || el.status === 'APPROVED',
    );
  }, [sortedElements]);

  const progress = useMemo(() => {
    const relevant = sortedElements.filter((el) => el.status !== 'NOT_APPLICABLE');
    if (!relevant.length) return 0;
    const done = relevant.filter(
      (el) => el.status === 'PENDING_APPROVAL' || el.status === 'APPROVED',
    ).length;
    return Math.round((done / relevant.length) * 100);
  }, [sortedElements]);

  const getStatusLabel = (status) => {
    const labels = {
      NOT_STARTED: 'لم يبدأ',
      PENDING_APPROVAL: 'تم الرفع',
      APPROVED: 'تم الاعتماد',
      REJECTED: 'مرفوض',
      RETURNED: 'معاد للموظف',
      NOT_APPLICABLE: 'غير منطبق',
    };
    return labels[status] || status;
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      NOT_STARTED: 'bg-gray-100 text-text-soft',
      PENDING_APPROVAL: 'bg-primary-light text-primary',
      APPROVED: 'bg-emerald-50 text-success',
      REJECTED: 'bg-red-50 text-danger',
      RETURNED: 'bg-amber-50 text-warning',
      NOT_APPLICABLE: 'bg-slate-100 text-text-soft',
    };
    return classes[status] || 'bg-gray-100 text-text-soft';
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-SA');
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-SA');
  };

  // ---- حساب الموعد النهائي للعنصر ----
  const calcDeadline = (el) => {
    const e = el.element;
    if (!e?.deadlineRefPoint || e.deadlineMaxHours == null || !course) return null;
    const refDate = e.deadlineRefPoint === 'START'
      ? new Date(course.startDate)
      : new Date(course.endDate);
    const extraHours = el.extensionHours || 0;
    return new Date(refDate.getTime() + (e.deadlineMaxHours + extraHours) * 3600000);
  };

  const calcIdealDeadline = (el) => {
    const e = el.element;
    if (!e?.deadlineRefPoint || e.deadlineIdealHours == null || !course) return null;
    const refDate = e.deadlineRefPoint === 'START'
      ? new Date(course.startDate)
      : new Date(course.endDate);
    return new Date(refDate.getTime() + e.deadlineIdealHours * 3600000);
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

  const isEmployee = activeRole === 'EMPLOYEE';
  const isReportKey = (key) => key === 'opening_report' || key === 'closing_report' || key === 'report';

  const renderAction = (el) => {
    if (
      isReportKey(el.element.key) &&
      (el.status === 'PENDING_APPROVAL' || el.status === 'APPROVED')
    ) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleReportDownload(el.id)}
            className="text-sm font-bold text-primary hover:text-primary-dark"
          >
            طباعة التقرير
          </button>
          <button
            onClick={() => handleReportEmlDownload(el.id, el.element.key)}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            تنزيل EML
          </button>
        </div>
      );
    }

    if (
      isEmployee &&
      el.element.isFormBased &&
      el.status !== 'APPROVED' &&
      el.status !== 'PENDING_APPROVAL' &&
      el.status !== 'NOT_APPLICABLE'
    ) {
      return (
        <button
          onClick={() => setSelectedElement(el)}
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
        >
          فتح النموذج
        </button>
      );
    }

    return null;
  };

  const renderElementCard = (el) => {
    const deadline    = calcDeadline(el);
    const idealDl     = calcIdealDeadline(el);
    const overdue     = isOverdue(el);
    const waitH       = supervisorWaitHours(el);
    const hasExtension = el.extensionHours > 0;

    return (
      <div
        key={el.id}
        className={`mb-4 rounded-3xl border bg-white p-4 shadow-card transition hover:shadow-soft ${overdue ? 'border-red-200' : 'border-border'}`}
      >
        <div className="flex flex-col gap-3">

          {/* رأس العنصر */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-extrabold text-text-main">{el.element.name}</h4>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(el.status)}`}>
                {getStatusLabel(el.status)}
              </span>
              {overdue && (
                <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  ⚠ تجاوز الموعد
                </span>
              )}
              {hasExtension && (
                <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                  تمديد +{el.extensionHours}س
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-start gap-2">
              <ElementRow element={{ ...el, course }} activeRole={activeRole} onUpdate={fetchCourse} />
              {renderAction(el)}
            </div>
          </div>

          {/* الموعد النهائي */}
          {deadline && !['APPROVED', 'NOT_APPLICABLE'].includes(el.status) && (
            <div className="flex flex-wrap gap-3 text-xs">
              {idealDl && (
                <span className="text-text-soft">
                  الموعد المثالي: <span className="font-bold text-primary">{formatDate(idealDl)}</span>
                </span>
              )}
              <span className={`font-bold ${overdue ? 'text-red-500' : 'text-text-main'}`}>
                آخر موعد: {formatDate(deadline)}
                {el.element?.isDeadlineWorkingDays ? ' (أيام عمل)' : ''}
              </span>
            </div>
          )}

          {/* انتظار المشرف */}
          {waitH !== null && (
            <div className={`flex items-center gap-1 text-xs ${waitH > 48 ? 'text-warning' : 'text-text-soft'}`}>
              <span>⏳ في انتظار الاعتماد منذ:</span>
              <span className="font-bold">
                {waitH < 24 ? `${waitH} ساعة` : `${Math.floor(waitH / 24)} يوم${waitH % 24 > 0 ? ` و${waitH % 24} ساعة` : ''}`}
              </span>
              {waitH > 48 && <span className="text-warning font-bold">— يستحق المتابعة</span>}
            </div>
          )}

          {/* تاريخ التقديم */}
          {el.executionAt && (
            <div className="text-xs font-medium text-primary">
              تم التقديم: {formatDateTime(el.executionAt)}
            </div>
          )}

          {/* مبرر التأخر */}
          {el.delayReason && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs">
              <span className="font-bold text-amber-700">مبرر الموظف: </span>
              <span className="text-amber-800">{el.delayReason}</span>
            </div>
          )}

          {/* تفاصيل التمديد */}
          {hasExtension && el.extensionReason && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
              <span className="font-bold text-blue-700">تمديد ممنوح (+{el.extensionHours} ساعة): </span>
              <span className="text-blue-800">{el.extensionReason}</span>
              {el.extensionGrantedAt && (
                <span className="mr-2 text-blue-500">— {formatDate(el.extensionGrantedAt)}</span>
              )}
            </div>
          )}

          {/* الاعتماد */}
          {el.status === 'APPROVED' && el.decisionAt && (
            <div className="text-xs font-medium text-success">
              ✓ تم الاعتماد: {formatDateTime(el.decisionAt)}
            </div>
          )}

          {/* الإعادة */}
          {el.status === 'RETURNED' && (
            <div className="rounded-2xl border border-warning/20 bg-amber-50 p-3 text-sm text-warning">
              <div className="mb-1 font-bold">سبب الإعادة:</div>
              <div>{el.rejectionReason || el.notes || 'لا يوجد سبب'}</div>
              {el.decisionAt && (
                <div className="mt-1 text-xs">تاريخ الإعادة: {formatDateTime(el.decisionAt)}</div>
              )}
            </div>
          )}

          {/* الرفض */}
          {el.status === 'REJECTED' && (
            <div className="rounded-2xl border border-danger/20 bg-red-50 p-3 text-sm text-danger">
              <div className="mb-1 font-bold">سبب الرفض:</div>
              <div>{el.rejectionReason || el.notes || 'لا يوجد سبب'}</div>
              {el.decisionAt && (
                <div className="mt-1 text-xs">تاريخ الرفض: {formatDateTime(el.decisionAt)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-border bg-white p-10 text-center text-text-soft shadow-card">
          جاري التحميل...
        </div>
      </MainLayout>
    );
  }

  if (!course) {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-danger/20 bg-white p-10 text-center text-danger shadow-card">
          لم يتم العثور على الدورة
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold leading-tight text-text-main md:text-2xl">
                    {course.name}
                  </h1>
                  <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">
                    {course.courseType === 'internal' ? 'داخلية' : 'خارجية'}
                  </span>
                </div>

                <div className="mb-4 text-sm text-text-soft">
                  {course.beneficiaryEntity || '-'} {course.city ? `| ${course.city}` : ''}
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                  <DetailPill label="المشروع" value={course.operationalProject?.name || '-'} />
                  <DetailPill
                    label="المسؤول"
                    value={
                      `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() ||
                      '-'
                    }
                  />
                  <DetailPill label="مقر التنفيذ" value={course.locationType || '-'} />
                  <DetailPill
                    label="التاريخ"
                    value={`من ${formatDate(course.startDate)} إلى ${formatDate(course.endDate)}`}
                  />
                  <DetailPill label="المتدربون" value={course.numTrainees ?? '-'} />
                  <DetailPill label="سلفة" value={course.requiresAdvance ? 'نعم' : 'لا'} />
                  <DetailPill label="إيرادات" value={course.requiresRevenue ? 'نعم' : 'لا'} />
                  <DetailPill label="تسوية" value={course.requiresAdvanceSettlement ? 'نعم' : 'لا'} />
                  <DetailPill label="مواد" value={course.materialsIssued ? 'نعم' : 'لا'} />
                  <DetailPill
                    label="مستحقات مشرف"
                    value={course.requiresSupervisorCompensation ? 'نعم' : 'لا'}
                  />
                </div>
              </div>

              <div className="shrink-0 xl:w-[250px]">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <SummaryCard title="عناصر نشطة" value={activeElements.length} tone="amber" />
                  <SummaryCard title="عناصر مكتملة" value={completedElements.length} tone="green" />
                </div>

                <div className="rounded-3xl border border-border bg-background p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-bold text-text-soft">نسبة الإنجاز</div>
                    <div className="text-sm font-extrabold text-primary">{progress}%</div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-extrabold text-primary">عناصر نشطة</h2>
                <p className="mt-1 text-sm text-text-soft">
                  العناصر التي ما زالت تحتاج إجراء أو معالجة
                </p>
              </div>
              <span className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-full bg-amber-50 px-3 text-sm font-extrabold text-warning">
                {activeElements.length}
              </span>
            </div>

            <div className="p-5">
              {activeElements.length === 0 ? (
                <EmptyState text="لا توجد عناصر نشطة حاليًا" />
              ) : (
                activeElements.map((el) => renderElementCard(el))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-extrabold text-primary">عناصر مكتملة</h2>
                <p className="mt-1 text-sm text-text-soft">
                  العناصر التي تم رفعها أو اعتمادها أو انتهت معالجتها
                </p>
              </div>
              <span className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-full bg-emerald-50 px-3 text-sm font-extrabold text-success">
                {completedElements.length}
              </span>
            </div>

            <div className="p-5">
              {completedElements.length === 0 ? (
                <EmptyState text="لا توجد عناصر مكتملة حاليًا" />
              ) : (
                completedElements.map((el) => renderElementCard(el))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedElement && (
        <Modal
          isOpen={!!selectedElement}
          onClose={() => setSelectedElement(null)}
          title={selectedElement.element.name}
        >
          {isReportKey(selectedElement.element.key) && (
            <CourseReportForm
              trackingId={selectedElement.id}
              course={course}
              reportType={selectedElement.element.key}
              onClose={() => setSelectedElement(null)}
              onSuccess={fetchCourse}
            />
          )}

          {(selectedElement.element.key === 'advance_req' ||
            selectedElement.element.key === 'settlement') && (
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

function SummaryCard({ title, value, tone = 'green' }) {
  const tones = {
    green: 'bg-emerald-50 text-success border-emerald-100',
    amber: 'bg-amber-50 text-warning border-amber-100',
  };

  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.green}`}>
      <div className="mb-1 text-[11px] font-bold">{title}</div>
      <div className="text-lg font-extrabold">{value}</div>
    </div>
  );
}

function DetailPill({ label, value }) {
  return (
    <div className="min-h-[58px] rounded-2xl border border-border bg-background px-3 py-2">
      <div className="mb-1 text-[11px] font-bold text-text-soft">{label}</div>
      <div className="break-words text-sm font-bold leading-5 text-text-main">{value}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-background p-8 text-center text-text-soft">
      {text}
    </div>
  );
}