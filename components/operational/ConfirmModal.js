import { useEffect } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';

/**
 * نافذة تأكيد (نعم/لا) — بديل مهيّأ ومتاح بدل window.confirm.
 * props:
 *  open, title, message, confirmLabel?, tone ('primary'|'danger'|'warning'),
 *  loading, onConfirm, onCancel
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const trapRef = useFocusTrap(open);

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
  const Icon = tone === 'danger' ? Trash2 : Check;

  return (
    <div className="glass-overlay animate-fade-in fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div ref={trapRef} className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl border border-white/50 bg-white/85 shadow-deep backdrop-blur-xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="text-base font-extrabold text-text-main">{title}</h2>
          <button onClick={onCancel} aria-label={t('common.close')} className="rounded-lg p-1 text-text-soft hover:bg-background">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-text-soft">{message}</p>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3">
          <button
            onClick={() => onConfirm?.()}
            disabled={loading}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${toneCls}`}
          >
            {loading ? '...' : (<><Icon size={16} aria-hidden="true" /> {confirmLabel || t('common.confirm')}</>)}
          </button>
          <button onClick={onCancel} disabled={loading} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
