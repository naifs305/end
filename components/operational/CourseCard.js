import Link from 'next/link';

const STATUS_CFG = {
  DRAFT:            { label: 'مسودة',            cls: 'bg-background text-text-soft border-border' },
  PREPARATION:      { label: 'قيد الإعداد',       cls: 'bg-background text-text-soft border-border' },
  IN_PROGRESS:      { label: 'قيد التنفيذ',       cls: 'bg-primary-light text-primary border-primary/20' },
  EXECUTION:        { label: 'قيد التنفيذ',       cls: 'bg-primary-light text-primary border-primary/20' },
  AWAITING_CLOSURE: { label: 'بانتظار الإغلاق',   cls: 'bg-sand/20 text-warning border-sand/40' },
  CLOSED:           { label: 'مغلقة',              cls: 'bg-forest-50 text-accent border-accent/20' },
  ARCHIVED:         { label: 'مؤرشفة',             cls: 'bg-border/60 text-text-soft border-border' },
};

export default function CourseCard({ course }) {
  const s = STATUS_CFG[course.status] || STATUS_CFG.DRAFT;

  return (
    <Link href={`/courses/${course.id}`}>
      <div className="flex h-full cursor-pointer flex-col rounded-2xl border border-border border-t-4 border-t-primary bg-white p-4 shadow-card transition hover:shadow-soft hover:-translate-y-0.5">
        <h3 className="mb-1 font-extrabold text-text-main leading-snug line-clamp-2">{course.name}</h3>
        <p className="mb-3 text-xs text-text-soft flex-grow">
          {course.beneficiaryEntity}{course.city ? ` · ${course.city}` : ''}
        </p>
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-text-soft">
            {new Date(course.startDate).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
          </span>
          <span className={`rounded-full border px-2 py-0.5 font-bold ${s.cls}`}>{s.label}</span>
        </div>
      </div>
    </Link>
  );
}
