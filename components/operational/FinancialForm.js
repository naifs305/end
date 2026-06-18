import { useState } from 'react';
import { Check } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from '../../lib/i18n';

function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-text-main">
        {label}
        {required ? <span className="ms-1 text-danger">*</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function FinancialForm({ type, trackingId, onClose, onSuccess }) {
  const { t } = useTranslation();
  const isAdvance = type === 'advance';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    totalAmount: '',
    requestDate: '',
    receiptDate: '',
    advanceAmount: '',
    spentAmount: '',
    deliveredToAuditorDate: '',
    invoicesUploadedDate: '',
    note: '',
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = () => {
    if (isAdvance) {
      if (!form.totalAmount || !form.requestDate || !form.receiptDate) {
        toast.error(t('financialForm.completeRequired'));
        return false;
      }
    } else {
      if (
        !form.advanceAmount ||
        !form.spentAmount ||
        !form.deliveredToAuditorDate ||
        !form.invoicesUploadedDate
      ) {
        toast.error(t('financialForm.completeRequired'));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const endpoint = isAdvance ? 'advance' : 'settlement';

      const payload = isAdvance
        ? {
            totalAmount: Number(form.totalAmount),
            requestDate: form.requestDate,
            receiptDate: form.receiptDate,
            note: form.note || '',
          }
        : {
            advanceAmount: Number(form.advanceAmount),
            spentAmount: Number(form.spentAmount),
            deliveredToAuditorDate: form.deliveredToAuditorDate,
            invoicesUploadedDate: form.invoicesUploadedDate,
            note: form.note || '',
          };

      await api.post(`/closure/${trackingId}/${endpoint}`, payload);

      toast.success(t('financialForm.submitSuccess'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-border bg-background p-4">
        <h3 className="text-base font-extrabold text-primary">
          {isAdvance ? t('financialForm.advanceTitle') : t('financialForm.settlementTitle')}
        </h3>
      </div>

      {isAdvance ? (
        <>
          <Field label={t('financialForm.totalRequested')} required>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={inputClass}
              value={form.totalAmount}
              onChange={(e) => handleChange('totalAmount', e.target.value)}
            />
          </Field>

          <Field label={t('financialForm.requestDate')} required>
            <input
              type="date"
              required
              className={inputClass}
              value={form.requestDate}
              onChange={(e) => handleChange('requestDate', e.target.value)}
            />
          </Field>

          <Field label={t('financialForm.receiptDate')} required>
            <input
              type="date"
              required
              className={inputClass}
              value={form.receiptDate}
              onChange={(e) => handleChange('receiptDate', e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('financialForm.advanceAmount')} required>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={inputClass}
              value={form.advanceAmount}
              onChange={(e) => handleChange('advanceAmount', e.target.value)}
            />
          </Field>

          <Field label={t('financialForm.spentAmount')} required>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={inputClass}
              value={form.spentAmount}
              onChange={(e) => handleChange('spentAmount', e.target.value)}
            />
          </Field>

          <Field label={t('financialForm.deliveredToAuditorDate')} required>
            <input
              type="date"
              required
              className={inputClass}
              value={form.deliveredToAuditorDate}
              onChange={(e) => handleChange('deliveredToAuditorDate', e.target.value)}
            />
          </Field>

          <Field label={t('financialForm.invoicesUploadedDate')} required>
            <input
              type="date"
              required
              className={inputClass}
              value={form.invoicesUploadedDate}
              onChange={(e) => handleChange('invoicesUploadedDate', e.target.value)}
            />
          </Field>
        </>
      )}

      <Field label={t('financialForm.additionalNotes')}>
        <textarea
          className={`${inputClass} min-h-[120px]`}
          rows={4}
          value={form.note}
          onChange={(e) => handleChange('note', e.target.value)}
          placeholder={t('financialForm.additionalNotes')}
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-border bg-white px-5 py-2.5 font-bold text-text-main transition hover:bg-background"
        >
          {t('common.cancel')}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-6 py-2.5 font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? (
            t('common.saving')
          ) : (
            <>
              <Check size={16} aria-hidden="true" /> {t('common.submit')}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
