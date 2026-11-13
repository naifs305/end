// =============================================================
// نموذج مترجم الدورة — يُفتح عند تقديم العنصر
// -------------------------------------------------------------
// نفس فكرة تقرير الافتتاح والاختتام: الضغط على «تقديم» يفتح
// النموذج، فتُعبَّأ بياناته، ثم يُولَّد المستند، ثم يُقدَّم العنصر
// للاعتماد. فلا بطاقة سابحة فوق العناصر، ولا بيانات تُدخَل في
// مكان ويُستهلك أثرها في مكان آخر.
//
// والبيانات واحدة لكل مستندات المترجم في الدورة، فتُعبَّأ مرة
// وتُقرأ في العقد وطلب الصرف ونموذج الاستحقاق والشهادة.
// =============================================================
import { useCallback, useEffect, useState } from 'react';
import { Languages, Save, FileText, Mail, Send, X, Check, ArrowRight, PenLine } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

const EMPTY = {
  fullName: '', nationalId: '', nationality: '', email: '', mobile: '', address: '',
  amount: '', bankName: '', bankBranch: '', bankCountry: '', iban: '', notes: '',
};

// العنصر الذي يحتاج بيانات مالية: العقد وطلب الصرف ونموذج الاستحقاق
const PAYMENT_KEYS = ['interpreter_contract', 'interpreter_transfer', 'interpreter_advance'];

const DOC_LABEL = {
  interpreter_contract: 'عقد الترجمة',
  interpreter_transfer: 'رسالة طلب صرف المستحقات',
  interpreter_advance: 'نموذج الاستحقاق المالي',
  interpreter_certificate: 'شهادة إنجاز الترجمة',
};

function Field({ label, value, onChange, placeholder, hint, required, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-text-main">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
      />
      {hint && <span className="mt-1 block text-[11px] text-text-soft">{hint}</span>}
    </label>
  );
}

export default function InterpreterForm({ trackingId, courseId, elementKey, initialFormData, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contractType, setContractType] = useState(null);

  const needsPayment = PAYMENT_KEYS.includes(elementKey);
  const isEmail = elementKey === 'interpreter_transfer';
  const isContract = elementKey === 'interpreter_contract';
  const isCertificate = elementKey === 'interpreter_certificate';
  const docLabel = DOC_LABEL[elementKey] || 'المستند';

  // توقيع وكيل الجامعة: العقد لا يكتمل قبله، فلا يُقدَّم العنصر بدونه
  const savedSignedAt = initialFormData?.agentSignedAt
    ? String(initialFormData.agentSignedAt).slice(0, 10)
    : '';
  const [agentSigned, setAgentSigned] = useState(!!savedSignedAt);
  const [agentSignedAt, setAgentSignedAt] = useState(savedSignedAt);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(!!savedSignedAt);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/courses/${courseId}/interpreter`);
      const payload = res?.data?.data ?? res?.data;
      setContractType(payload?.contractType || null);
      if (payload?.interpreter) {
        const i = payload.interpreter;
        setForm({
          fullName: i.fullName || '', nationalId: i.nationalId || '', nationality: i.nationality || '',
          email: i.email || '', mobile: i.mobile || '', address: i.address || '',
          amount: i.amount != null ? String(i.amount) : '',
          bankName: i.bankName || '', bankBranch: i.bankBranch || '',
          bankCountry: i.bankCountry || '', iban: i.iban || '', notes: i.notes || '',
        });
        setSaved(true);
      }
    } catch {
      toast.error('تعذّر تحميل بيانات المترجم');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  // حفظ نص المستند المُعدَّل: نافذة المستند لا تحمل هوية الدخول،
  // فتطلب من هذه الصفحة أن تحفظ عنها.
  useEffect(() => {
    const onMessage = async (event) => {
      const data = event?.data;
      if (!data || data.type !== 'interpreter-document-save') return;
      try {
        await api.post(`/closure/${trackingId}/interpreter-text`, { sections: data.sections || {} });
        event.source?.postMessage({ type: 'interpreter-document-saved', ok: true }, '*');
      } catch {
        event.source?.postMessage({ type: 'interpreter-document-saved', ok: false }, '*');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [trackingId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/courses/${courseId}/interpreter`, form);
      toast.success('حُفظت بيانات المترجم');
      setSaved(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر حفظ بيانات المترجم');
    } finally {
      setSaving(false);
    }
  };

  // المستند يُطلب بهوية الدخول ثم يُعرض — لا يُفتح رابطه مباشرة
  // المخرجات تُطلب بهوية الدخول ثم تُعرض أو تُنزَّل — لا تُفتح روابطها
  const openOutput = async (output = 'document') => {
    const asEml = output !== 'document' || isEmail;
    try {
      if (asEml) {
        const res = await api.get(`/closure/${trackingId}/interpreter-document`, {
          params: { output }, responseType: 'blob', headers: { Accept: 'message/rfc822' },
        });
        const disposition = res.headers['content-disposition'] || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const url = window.URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = match?.[1] || 'interpreter.eml';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success('نُزِّلت الرسالة — افتحها في برنامج البريد وأرسلها');
        return;
      }

      const res = await api.get(`/closure/${trackingId}/interpreter-document`, {
        params: { output }, responseType: 'text', headers: { Accept: 'text/html' },
      });
      const w = window.open('', '_blank');
      if (!w) {
        toast.error('تعذّر فتح نافذة المستند — اسمح بالنوافذ المنبثقة');
        return;
      }
      w.document.open();
      w.document.write(res.data);
      w.document.close();
    } catch (err) {
      const blob = err?.response?.data;
      if (blob instanceof Blob) {
        try {
          const parsed = JSON.parse(await blob.text());
          toast.error(parsed.message || 'تعذّر إخراج الملف');
          return;
        } catch { /* يسقط إلى الرسالة العامة */ }
      }
      toast.error(err?.response?.data?.message || 'تعذّر إخراج الملف');
    }
  };

  const saveSignature = async () => {
    if (agentSigned && !agentSignedAt) {
      toast.error('أدخل تاريخ توقيع الوكيل');
      return;
    }
    setSavingSignature(true);
    try {
      await api.post(`/closure/${trackingId}/interpreter-text`, {
        agentSignedAt: agentSigned ? agentSignedAt : '',
      });
      setSignatureSaved(agentSigned);
      toast.success(agentSigned ? 'سُجّل توقيع الوكيل' : 'أُلغي تسجيل التوقيع');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر تسجيل التوقيع');
    } finally {
      setSavingSignature(false);
    }
  };

  const submitElement = async () => {
    setSubmitting(true);
    try {
      await api.put(`/closure/${trackingId}`, { status: 'PENDING_APPROVAL' });
      toast.success('قُدِّم العنصر للاعتماد');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر تقديم العنصر');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-text-soft">جارٍ التحميل…</div>;
  }

  return (
    <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center justify-between border-b border-border bg-background px-5 py-4">
        <h3 className="inline-flex items-center gap-2 text-lg font-extrabold text-text-main">
          <Languages size={20} aria-hidden="true" className="text-primary" />
          {docLabel}
        </h3>
        <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-full p-2 text-text-soft hover:bg-white hover:text-primary">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <ol className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <li className={`rounded-full border px-3 py-1 ${saved ? 'border-accent/30 bg-forest-50 text-accent' : 'border-primary bg-primary text-white'}`}>
            {saved ? <span className="inline-flex items-center gap-1"><Check size={12} aria-hidden="true" /> البيانات</span> : '١ — البيانات'}
          </li>
          <ArrowRight size={14} aria-hidden="true" className="rotate-180 text-text-soft" />
          <li className={`rounded-full border px-3 py-1 ${saved ? 'border-primary bg-primary text-white' : 'border-border bg-background text-text-soft'}`}>
            ٢ — {isEmail ? 'الرسالة' : 'المستند'}
          </li>
          <ArrowRight size={14} aria-hidden="true" className="rotate-180 text-text-soft" />
          <li className="rounded-full border border-border bg-background px-3 py-1 text-text-soft">٣ — التقديم</li>
        </ol>

        <p className="mb-4 text-xs text-text-soft">
          بيانات المترجم تُعبَّأ مرة واحدة للدورة، ويُبنى منها {docLabel} مع بيانات البرنامج تلقائياً.
          {contractType === 'CONTRACT' && ' والعقد قابل للتعديل في صفحته قبل الطباعة.'}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="اسم المترجم رباعياً" value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="كما في الهوية" required />
          <Field label="رقم الهوية الوطنية" value={form.nationalId} onChange={(v) => set('nationalId', v)} placeholder="عشرة أرقام" required />
          <Field label="البريد الإلكتروني" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="name@example.com" required />
          <Field label="رقم الجوال" value={form.mobile} onChange={(v) => set('mobile', v)} placeholder="05xxxxxxxx" required />
          <Field label="الجنسية" value={form.nationality} onChange={(v) => set('nationality', v)} placeholder="سعودي" hint="تُذكر في صدر العقد" />
          <Field label="العنوان" value={form.address} onChange={(v) => set('address', v)} placeholder="المدينة — الحي" required />
        </div>

        {needsPayment && (
          <>
            <p className="mb-2 mt-5 text-sm font-extrabold text-text-main">المستحق المالي وبيانات الحساب</p>
            <p className="mb-3 text-xs text-text-soft">المبلغ يُكتب كتابةً من الرقم تلقائياً، فلا يختلف الرقم عن الكلمات.</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="قيمة المستحق (ريال)" value={form.amount} onChange={(v) => set('amount', v)} placeholder="12000" required />
              <Field label="اسم البنك" value={form.bankName} onChange={(v) => set('bankName', v)} placeholder="مصرف الراجحي" required />
              <Field label="الفرع" value={form.bankBranch} onChange={(v) => set('bankBranch', v)} placeholder="اختياري" />
              <Field label="الدولة" value={form.bankCountry} onChange={(v) => set('bankCountry', v)} placeholder="إن كان الحساب خارج دولة المقر" />
              <div className="md:col-span-2">
                <Field label="رقم الحساب الدولي (IBAN)" value={form.iban} onChange={(v) => set('iban', v)} placeholder="SA0000000000000000000000" required />
              </div>
            </div>
          </>
        )}

        <div className="mt-3">
          <Field label="ملاحظات" value={form.notes} onChange={(v) => set('notes', v)} placeholder="اختياري" />
        </div>

        {/* ── المخرجات: المستند ورسائله ───────────────────────── */}
        {saved && (
          <div className="mt-5 rounded-xl border border-primary/15 bg-primary-light/40 p-4">
            <p className="mb-1 text-sm font-extrabold text-text-main">المخرجات</p>
            <p className="mb-3 text-xs text-text-soft">
              {isContract
                ? 'المستند يُفتح صفحةً تُعدَّل ثم تُطبع بصيغة PDF. والرسالتان تُفتحان في برنامج البريد جاهزتين بوجهتيهما — أرفق بهما نسخة العقد قبل الإرسال.'
                : isCertificate
                ? 'الشهادة تُفتح صفحةً تُطبع بصيغة PDF، ورسالة المالية تُفتح في برنامج البريد — أرفق بها الشهادة قبل الإرسال.'
                : 'يُفتح المخرج جاهزاً، وتبقى المراجعة والإرسال بيدك.'}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openOutput('document')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark"
              >
                {isEmail
                  ? <><Mail size={15} aria-hidden="true" /> تنزيل الرسالة</>
                  : <><FileText size={15} aria-hidden="true" /> فتح {docLabel}</>}
              </button>

              {isContract && (
                <button
                  type="button"
                  onClick={() => openOutput('legal-eml')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-white px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-light"
                >
                  <Mail size={15} aria-hidden="true" /> رسالة الإدارة القانونية
                </button>
              )}

              {(isContract || isCertificate) && (
                <button
                  type="button"
                  onClick={() => openOutput('finance-eml')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-white px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-light"
                >
                  <Mail size={15} aria-hidden="true" />
                  {isContract ? 'رسالة المالية — الدفعة الأولى' : 'رسالة المالية — بقية المستحقات'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── توقيع وكيل الجامعة: شرط اكتمال العقد ───────────── */}
        {isContract && (
          <div className={`mt-4 rounded-xl border p-4 ${signatureSaved ? 'border-accent/30 bg-forest-50' : 'border-sand/50 bg-sand/10'}`}>
            <p className="mb-1 inline-flex items-center gap-2 text-sm font-extrabold text-text-main">
              <PenLine size={16} aria-hidden="true" className={signatureSaved ? 'text-accent' : 'text-warning'} />
              توقيع وكيل الجامعة للتدريب
            </p>
            <p className="mb-3 text-xs text-text-soft">
              العقد لا يكتمل بإخراجه، بل بتوقيع الوكيل عليه بعد مراجعة الإدارة القانونية.
              ولا يُقدَّم هذا العنصر للاعتماد قبل تأكيد التوقيع.
            </p>

            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-text-main">
              <input
                type="checkbox"
                checked={agentSigned}
                onChange={(e) => { setAgentSigned(e.target.checked); setSignatureSaved(false); }}
                className="h-4 w-4 accent-[#016564]"
              />
              وقّع وكيل الجامعة للتدريب على العقد
            </label>

            {agentSigned && (
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-text-main">تاريخ التوقيع <span className="text-danger">*</span></span>
                  <input
                    type="date"
                    value={agentSignedAt}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => { setAgentSignedAt(e.target.value); setSignatureSaved(false); }}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveSignature}
                  disabled={savingSignature}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                >
                  <Check size={15} aria-hidden="true" /> {savingSignature ? 'جارٍ التسجيل…' : 'تأكيد التوقيع'}
                </button>
                {signatureSaved && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-accent">
                    <Check size={13} aria-hidden="true" /> مُسجَّل
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-5 py-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-white px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-light disabled:opacity-60"
        >
          <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
        </button>

        <button
          type="button"
          onClick={submitElement}
          disabled={!saved || submitting || (isContract && !signatureSaved)}
          title={
            !saved ? 'احفظ البيانات أولاً'
              : (isContract && !signatureSaved) ? 'أكّد توقيع وكيل الجامعة أولاً' : ''
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
        >
          <Send size={15} aria-hidden="true" /> {submitting ? 'جارٍ التقديم…' : 'تقديم للاعتماد'}
        </button>
      </div>
    </div>
  );
}
