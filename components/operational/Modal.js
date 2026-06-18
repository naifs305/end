import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';

export default function Modal({ isOpen, onClose, title, children }) {
  const { t } = useTranslation();
  const trapRef = useFocusTrap(isOpen);

  // إغلاق النافذة عند الضغط على Escape
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2F3437]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div ref={trapRef} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <h3 className="text-lg font-extrabold text-text-main">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-soft transition hover:bg-white hover:text-primary"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
