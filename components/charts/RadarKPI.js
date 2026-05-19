import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip
} from 'recharts';

export default function RadarKPI({ data = [] }) {
  if (!data.length) return (
    <div className="flex h-full items-center justify-center text-sm text-text-soft">لا توجد بيانات</div>
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#D8DDDA" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontFamily: 'Cairo, sans-serif', fontSize: 11, fill: '#6E767A' }}
        />
        <Radar
          name="الأداء"
          dataKey="score"
          stroke="#006C6D"
          fill="#006C6D"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'الدرجة']}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12, borderRadius: 12, border: '1px solid #D8DDDA' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
