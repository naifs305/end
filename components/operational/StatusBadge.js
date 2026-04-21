export default function StatusBadge({ status }) {
  const colors = {
    NOT_APPLICABLE: 'bg-gray-100 text-gray-600',
    NOT_STARTED: 'bg-gray-200 text-gray-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  const labels = {
    NOT_APPLICABLE: 'غير مطبق',
    NOT_STARTED: 'غير مبدوء',
    IN_PROGRESS: 'قيد العمل',
    PENDING_APPROVAL: 'بانتظار الاعتماد',
    APPROVED: 'مكتمل',
    REJECTED: 'مرفوض',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}