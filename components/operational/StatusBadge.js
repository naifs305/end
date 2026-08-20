import { useTranslation } from '../../lib/i18n';

const COLORS = {
  NOT_APPLICABLE: 'bg-border/40 text-text-soft border-border/40',
  NOT_STARTED: 'bg-background text-text-soft border-border',
  IN_PROGRESS: 'bg-primary-light text-primary border-primary/20',
  PENDING_APPROVAL: 'bg-sand/20 text-warning border-sand/40',
  APPROVED: 'bg-forest-50 text-accent border-accent/20',
  REJECTED: 'bg-burgundy/10 text-danger border-burgundy/20',
  RETURNED: 'bg-sand/20 text-warning border-sand/40',
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const label = status ? t(`elementStatus.${status}`) : status;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        COLORS[status] || 'bg-background text-text-soft border-border'
      }`}
    >
      {label}
    </span>
  );
}
