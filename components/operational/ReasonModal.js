import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';

/**
 * نافذة منبثقة لإدخال سبب/ملاحظة — بديل مهيّأ ومتاح بدل window.prompt.
 * props:
 *  open, title, description?, label?, placeholder?, initialValue?,
 *  required (bool), confirmLabel?, tone ('primary'|'danger'|'warning'),
 *  loading, onConfirm(value), onCancel
 */
export default function ReasonModal({
  open,
  title,
  description,
  label,
  placeholder = '',
  initialValue = '',
  required = false,
  confirmLabel,
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const toneCls = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-primary';
  const canConfirm = !loading && (!required || value.trim().length > 0);

  return (
    <div className="glass-overlay animate-fade-in fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div ref={trapRef} className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl border border-white/50 bg-white/85 shadow-deep backdrop-blur-xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-text-main">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-text-soft">{description}</p>}
          </div>
          <button onClick={onCancel} aria-label={t('common.close')} className="rounded-lg p-1 text-text-soft hover:bg-background">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {label && (
            <label className="mb-1.5 block text-sm font-bold text-text-main">
              {label} {required && <span className="text-danger">*</span>}
            </label>
          )}
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder={placeholder}
            className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3">
          <button
            onClick={() => onConfirm?.(value.trim())}
            disabled={!canConfirm}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${toneCls}`}
          >
            {loading ? '...' : (<><Check size={16} aria-hidden="true" /> {confirmLabel || t('common.confirm')}</>)}
          </button>
          <button onClick={onCancel} disabled={loading} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
