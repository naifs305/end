// =============================================================
// مؤقّت داخلي لدورة حياة الدورات — لا يحتاج مُشغِّلاً خارجياً
// -------------------------------------------------------------
// حالة الدورة (تحضير ← تنفيذ ← بانتظار الإقفال ← مقفلة) كانت تتقدّم
// بالمهمة اليومية وحدها، ويستدعيها مؤقّت خارجي لا يوجد إلا على
// الاستضافة السابقة. فعلى خادم الجامعة بقيت الدورات «تحضير» بعد انتهائها،
// والمكتملة غير مقفلة. هذا المؤقّت يعمل داخل الخادم نفسه:
//   • عند الإقلاع بعد دقيقة، ثم كل نصف ساعة
//   • وعند فتح قائمة الدورات (بحد أدنى خمس دقائق بين مرتين)
// ولا يُرسل تنبيهات ولا رسائل — يقدّم الحالات بتواريخها ويُقفل المكتمل فقط.
// =============================================================
const EVERY_MS = 30 * 60 * 1000;
const MIN_GAP_MS = 5 * 60 * 1000;

let running = null;
let lastRunAt = 0;
let started = false;

/** يقدّم حالات الدورات بتواريخها ويُقفل المكتمل — مرة واحدة في كل لحظة */
async function refreshLifecycles({ force = false, archive = false } = {}) {
  if (running) return running;
  if (!force && Date.now() - lastRunAt < MIN_GAP_MS) return null;
  lastRunAt = Date.now();
  running = (async () => {
    try {
      const out = await require('../modules/courses/courses.service').advanceDueCourseLifecycles({ archive });
      if (out && (out.toExecution || out.toAwaitingClosure || out.closed)) {
        console.log('[lifecycle]', JSON.stringify(out));
      }
      return out;
    } catch (e) {
      console.error('[lifecycle] failed:', e?.message);
      return null;
    } finally {
      running = null;
    }
  })();
  return running;
}

function start() {
  if (started) return;
  started = true;
  console.log('[lifecycle] internal timer started (every 30 min)');
  // حفظ رصيد السنة الماضية ثقيل مرة في السنة — للمؤقّت وحده، لا لفتح القائمة
  const first = setTimeout(() => refreshLifecycles({ force: true, archive: true }), 60 * 1000);
  const timer = setInterval(() => refreshLifecycles({ force: true, archive: true }), EVERY_MS);
  // لا يُبقي المؤقّت العملية حية وحده
  first.unref?.();
  timer.unref?.();
}

module.exports = { start, refreshLifecycles };
