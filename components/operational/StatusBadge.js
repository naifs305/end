export default function StatusBadge({ status }) {
  const colors = {
    NOT_APPLICABLE:   'bg-border/40 text-text-soft border-border/40',
    NOT_STARTED:      'bg-background text-text-soft border-border',
    IN_PROGRESS:      'bg-primary-light text-primary border-primary/20',
    PENDING_APPROVAL: 'bg-sand/20 text-warning border-sand/40',
    APPROVED:         'bg-forest-50 text-accent border-accent/20',
    REJECTED:         'bg-burgundy/10 text-danger border-burgundy/20',
    RETURNED:         'bg-sand/20 text-warning border-sand/40',
  };

  const labels = {
    NOT_APPLICABLE:   'غير مطبق',
    NOT_STARTED:      'لم يبدأ',
    IN_PROGRESS:      'قيد العمل',
    PENDING_APPROVAL: 'قيد الاعتماد',
    APPROVED:         'مُعتمد',
    REJECTED:         'مرفوض',
    RETURNED:         'مُعاد',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${colors[status] || 'bg-background text-text-soft border-border'}`}>
      {labels[status] || status}
    </span>
  );
}
