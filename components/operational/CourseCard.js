import Link from 'next/link';

export default function CourseCard({ course }) {
  return (
    <Link href={`/courses/${course.id}`}>
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition border-t-4 border-primary cursor-pointer flex flex-col h-full">
          <h3 className="font-bold text-lg mb-2 text-gray-800">{course.name}</h3>
          <p className="text-sm text-gray-500 mb-2 flex-grow">
            {course.beneficiaryEntity} - {course.city}
          </p>
          <div className="flex justify-between items-center text-xs text-gray-400 mt-4 border-t pt-4">
            <span>{new Date(course.startDate).toLocaleDateString('ar-SA')}</span>
            <span className={`px-2 py-1 rounded font-semibold ${
              course.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
              course.status === 'ARCHIVED' ? 'bg-gray-200 text-gray-600' :
              course.status === 'AWAITING_CLOSURE' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {course.status.replace(/_/g, ' ')}
            </span>
          </div>
      </div>
    </Link>
  );
}