// ======================================================================
// حلقة الوقت — رأس بطاقة عنصر الإقفال
// ----------------------------------------------------------------------
// الحلقة تمتلئ بقدر ما مضى من مهلة العنصر، وفي وسطها ما بقي له (أو مقدار
// تأخره). والمواعيد نفسها تأتي محسوبة من الخادم؛ هنا عرضها فقط.
// ======================================================================
import { Check, Clock, Minus, OctagonPause, X } from 'lucide-react';

const H = 3600000;

export const RING_TONE = {
  ok:      '#2E6066', // في الموعد
  near:    '#B2925A', // بعد المثالي وقبل الأقصى
  late:    '#895B60', // فات الأقصى
  paused:  '#5A9296', // الساعة متوقفة ببلاغ
  pending: '#B2925A', // بانتظار الاعتماد
  done:    '#2E6066', // معتمد
  off:     '#C2D6D7', // غير مطلوب
};

// «٣ ساعات» / «يومان» / «١١ يوماً» — بقواعد العدد في العربية
function unitWord(n, kind) {
  const w = kind === 'h'
    ? { one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' }
    : { one: 'يوم', two: 'يومان', few: 'أيام', many: 'يوماً' };
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  if (n >= 3 && n <= 10) return w.few;
  return w.many;
}

function amount(ms) {
  const hours = Math.max(1, Math.round(Math.abs(ms) / H));
  if (hours < 48) return { value: hours, unit: unitWord(hours, 'h') };
  const days = Math.floor(hours / 24);
  return { value: days, unit: unitWord(days, 'd') };
}

/**
 * يقرّر شكل الحلقة من حالة العنصر ومواعيده المحسوبة.
 * يُرجع: tone (لون)، pct (امتلاء ٠–١٠٠)، value و unit (الوسط)، icon، label (وصف مقروء)
 */
export function ringFor(el, now = Date.now()) {
  const status = el.status;
  if (status === 'APPROVED') return { tone: 'done', pct: 100, icon: Check, label: 'معتمد' };
  if (status === 'PENDING_APPROVAL') return { tone: 'pending', pct: 70, icon: Clock, label: 'بانتظار الاعتماد' };
  if (status === 'NOT_APPLICABLE') return { tone: 'off', pct: 0, icon: Minus, label: 'غير مطلوب' };

  const max = el.deadlines?.maxDeadline ? new Date(el.deadlines.maxDeadline).getTime() : null;
  const ideal = el.deadlines?.idealDeadline ? new Date(el.deadlines.idealDeadline).getTime() : null;

  if (el.deadlines?.hasOpenBlocker) {
    return { tone: 'paused', pct: 50, icon: OctagonPause, unit: 'متوقفة', label: 'الساعة متوقفة ببلاغ عائق' };
  }
  if (!max) {
    return { tone: status === 'REJECTED' ? 'late' : 'ok', pct: 0, icon: status === 'REJECTED' ? X : Clock, label: 'بلا موعد' };
  }

  if (el.deadlines?.isOverdue || now > max) {
    const a = amount(now - max);
    return { tone: 'late', pct: 100, ...a, label: `متأخر ${a.value} ${a.unit}` };
  }

  // الامتلاء: ما مضى من المهلة منذ إنشاء سجل العنصر حتى الموعد الأقصى
  const start = new Date(el.createdAt || el.course?.createdAt || max - 14 * 24 * H).getTime();
  const span = Math.max(H, max - start);
  const pct = Math.min(99, Math.max(4, Math.round(((now - start) / span) * 100)));
  const a = amount(max - now);
  const tone = ideal && now > ideal ? 'near' : 'ok';
  return { tone, pct, ...a, label: `باقٍ ${a.value} ${a.unit} على الموعد الأقصى` };
}

export default function TimeRing({ ring }) {
  const color = RING_TONE[ring.tone] || RING_TONE.ok;
  const Icon = ring.icon;
  const showNumber = ring.value != null;

  return (
    <div
      role="img"
      aria-label={ring.label}
      className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${ring.pct}%, #EDF1F1 0)` }}
    >
      <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white text-center leading-none">
        {showNumber ? (
          <div>
            <span className="block text-[22px] font-extrabold tabular-nums" style={{ color }}>{ring.value}</span>
            <span className="mt-1 block text-[11px] font-bold text-text-soft">{ring.sub || ring.unit}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            {Icon && <Icon size={22} aria-hidden="true" style={{ color }} />}
            {ring.unit && <span className="text-[11px] font-bold text-text-soft">{ring.unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
