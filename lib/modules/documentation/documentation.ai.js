// ======================================================================
// مساعد التوثيق بالذكاء الاصطناعي (Claude)
// ----------------------------------------------------------------------
// ثلاث مهام، كلها تملأ حقولاً يراجعها المنسق ويعدّلها قبل الحفظ:
//   ١. أوصاف الجلسات: فقرة رسمية لكل جلسة من عنوانها وسياق الدورة.
//   ٢. قراءة الجدول المنسوخ حين لا يتعرّف عليه اللصق الذكي.
//   ٣. قراءة تقرير الجهة المنفّذة (PDF): ملخص ومخرجات وتوصيات ومحاور.
//
// يعمل بمفتاح ANTHROPIC_API_KEY في بيئة الخادم، ويحتاج الخادم اتصالاً
// بالإنترنت (api.anthropic.com). وبدون المفتاح تختفي أزرار المساعد ويبقى
// كل شيء يعمل يدوياً كما هو.
// ======================================================================
const Anthropic = require('@anthropic-ai/sdk');
const { cleanSessionTitle } = require('../../documentation/lmsSchedule');

const MODEL = 'claude-opus-5-5';
let client = null;

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic({ timeout: 120 * 1000, maxRetries: 2 });
  return client;
}

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

/** تنقية النص العربي: مسافات زائدة، ومسافة قبل علامات الترقيم، وعلامات تنصيص محيطة */
function tidy(text) {
  return String(text || '')
    .replace(/^["«“'\s]+|["»”'\s]+$/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ +([،,.:؛;!?؟])/g, '$1')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** طلب واحد بمخرجات JSON مقيّدة بمخطط */
async function askJson({ system, content, schema, effort = 'medium', maxTokens = 16000 }) {
  if (!isConfigured()) throw httpError(503, 'مساعد الذكاء الاصطناعي غير مُفعّل على هذا الخادم', 'serverErrors.documentation.aiOff');
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // إن اعتذر النموذج عن طلب لسبب احترازي أعاده الخادم على نموذج بديل تلقائياً
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw httpError(503, 'مفتاح الذكاء الاصطناعي غير صالح — راجع الفنيين', 'serverErrors.documentation.aiKey');
    if (e instanceof Anthropic.RateLimitError) throw httpError(429, 'المساعد مشغول الآن، أعد المحاولة بعد دقيقة', 'serverErrors.documentation.aiBusy');
    if (e instanceof Anthropic.BadRequestError) throw httpError(400, 'تعذّر على المساعد قراءة المدخل — تأكد من الملف أو النص', 'serverErrors.documentation.aiInput');
    if (e instanceof Anthropic.APIConnectionError) throw httpError(503, 'تعذّر الوصول إلى خدمة الذكاء الاصطناعي من الخادم (قد يكون بلا اتصال بالإنترنت)', 'serverErrors.documentation.aiOffline');
    if (e instanceof Anthropic.APIError) throw httpError(502, 'خدمة الذكاء الاصطناعي لم تستجب، أعد المحاولة', 'serverErrors.documentation.aiUpstream');
    throw e;
  }
  if (response.stop_reason === 'refusal') throw httpError(422, 'اعتذر المساعد عن هذا الطلب — اكتب النص يدوياً', 'serverErrors.documentation.aiRefusal');
  if (response.stop_reason === 'max_tokens') throw httpError(422, 'المدخل أطول مما يحتمله المساعد — جزّئه', 'serverErrors.documentation.aiTooLong');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(502, 'جاءت إجابة المساعد ناقصة، أعد المحاولة', 'serverErrors.documentation.aiParse');
  }
}

const STYLE = `اكتب بعربية فصحى أكاديمية رصينة بنَفَس مؤسسي سعودي، كما تكتب جامعة نايف العربية للعلوم الأمنية في إصداراتها الرسمية.
- الهمزات في مواضعها، وعلامات الترقيم العربية (، ؛) ملاصقة لما قبلها، ولا رموز إنجليزية ولا «+».
- لا حشو ولا مبالغة: تجنّب «حيوية، فريدة، نقطة انطلاق، حجر الزاوية، بشكل فعّال، مما يعزز من، الاستفادة القصوى».
- لا تخترع أرقاماً أو أسماء أو جهات أو نتائج غير مذكورة في المدخل.
- لا تذكر أنك نموذج ذكاء اصطناعي.`;

// ── ١. أوصاف الجلسات ─────────────────────────────────────────
const SESSIONS_SYSTEM = `أنت محرّر في وكالة جامعة نايف العربية للعلوم الأمنية للتدريب، تكتب فقرات مجلة توثيق الدورات التدريبية. المجلة تصدر بعد انعقاد الدورة وتُقدَّم للقيادات والجهات الشريكة، فهي وثيقة رسمية لما جرى.

لكل جلسة مطلوبة اكتب فقرة واحدة:
١. من ٣٠ إلى ٥٠ كلمة، بلا عنوان ولا تعداد.
٢. بصيغة الماضي التوثيقية («تناولت الجلسة…، تدرّب المشاركون على…، استعرض المحاضر…») ملتزماً بها في الفقرة كلها.
٣. ابدأ بمضمون الجلسة مباشرة، ولا تبدأ بـ«تهدف» أو «تمثل» أو «تعد» أو «في إطار» أو «تأتي»، ونوّع الافتتاحيات والتراكيب بين الجلسات فلا تتشابه.
٤. لا تعِد عنوان الجلسة بين علامتي تنصيص، ولا تذكر اسم الدورة كاملاً.
٥. استنتج من العنوان ومن سياق الدورة الموضوعات والمهارات المرجّحة بثقة، ولا تتطرّق لمضمون جلسة أخرى من الجلسات.
٦. الجلسات المراسمية (الافتتاح، الختام، التكريم، الزيارات): صِف ما جرى بإيجاز ولغة رسمية دون ادعاء أهداف تدريبية.
٧. جملة الأثر في آخر الفقرة واحدة ومحددة.

${STYLE}`;

const SESSIONS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, text: { type: 'string' } },
        required: ['index', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

/**
 * يكتب أوصاف الجلسات المطلوبة دفعة واحدة، فيأتي كل وصف متمايزاً عن غيره.
 * sessions: [{ title, presenter, date, description }]، indexes: أرقام الجلسات المطلوبة
 */
async function describeSessions({ course, intro, sessions, indexes }) {
  const wanted = [...new Set(indexes)].filter((i) => sessions[i] && String(sessions[i].title || '').trim());
  if (!wanted.length) return {};
  const lines = sessions.map((s, i) => {
    const bits = [`${i}) ${cleanSessionTitle(s.title)}`];
    if (s.presenter) bits.push(`المقدّم: ${s.presenter}`);
    if (s.date) bits.push(`التاريخ: ${String(s.date).slice(0, 10)}`);
    if (!wanted.includes(i) && s.description) bits.push(`وصفها الحالي: ${s.description}`);
    return bits.join(' — ');
  });
  const content = [
    `الدورة: ${course.name}`,
    course.city ? `مكان الانعقاد: ${course.city}` : '',
    intro ? `مقدمة التوثيق (للسياق): ${String(intro).slice(0, 1500)}` : '',
    `جدول الجلسات كاملاً (الرقم قبل القوس هو index):\n${lines.join('\n')}`,
    `اكتب أوصاف الجلسات ذات الأرقام: ${wanted.join('، ')}. أعِد لكل منها index ونص الفقرة.`,
  ].filter(Boolean).join('\n\n');

  const out = await askJson({ system: SESSIONS_SYSTEM, content, schema: SESSIONS_SCHEMA, effort: 'medium' });
  const result = {};
  for (const it of out.items || []) {
    if (wanted.includes(it.index) && String(it.text || '').trim()) result[it.index] = tidy(it.text).slice(0, 1200);
  }
  return result;
}

// ── ٢. قراءة جدول منسوخ لم يتعرّف عليه اللصق الذكي ───────────
const SCHEDULE_SCHEMA = {
  type: 'object',
  properties: {
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD أو نص فارغ' },
          time: { type: 'string', description: 'HH:MM - HH:MM بنظام ٢٤ ساعة أو نص فارغ' },
          presenter: { type: 'string', description: 'اسم المقدّم أو نص فارغ' },
        },
        required: ['title', 'date', 'time', 'presenter'],
        additionalProperties: false,
      },
    },
  },
  required: ['sessions'],
  additionalProperties: false,
};

async function readSchedule({ text }) {
  const out = await askJson({
    system: `تستخرج الجلسات التدريبية من نص منسوخ من جدول دورة. لكل جلسة: عنوانها كما ورد (بلا ترقيم في أوله)، وتاريخها، ووقتها بنظام ٢٤ ساعة، ومقدّمها إن ذُكر.
تجاهل الاستراحات والصلاة والوجبات وسطور الملفات والروابط والأيقونات والحضور. لا تخترع جلسة غير موجودة، ولا تترجم العناوين.`,
    content: String(text).slice(0, 30000),
    schema: SCHEDULE_SCHEMA,
    effort: 'low',
  });
  const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
  const okTime = (t) => (/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(t || '') ? t : null);
  return (out.sessions || [])
    .map((s) => ({ title: cleanSessionTitle(s.title).slice(0, 200), date: okDate(s.date), time: okTime(s.time), presenter: tidy(s.presenter).slice(0, 120) || null }))
    .filter((s) => s.title);
}

// ── ٣. تقرير الجهة المنفّذة ──────────────────────────────────
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'ملخص التنفيذ: فقرة أو فقرتان (٨٠–١٤٠ كلمة)' },
    outcomes: { type: 'array', items: { type: 'string' }, description: 'أبرز ما اكتسبه المتدربون، ٣–٦ عبارات قصيرة' },
    recommendations: { type: 'array', items: { type: 'string' }, description: 'التوصيات، ٢–٦، ومنها ما يُستنتج من التقرير بوضوح' },
    intro: { type: 'string', description: 'مقدمة المجلة: فقرة (٦٠–١٠٠ كلمة) تعرّف بالبرنامج وأهدافه' },
    modules: {
      type: 'array',
      description: 'محاور البرنامج كما وردت في التقرير',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, description: { type: 'string' } },
        required: ['title', 'description'],
        additionalProperties: false,
      },
    },
    trainees: {
      type: 'array',
      description: 'المتدربون ودرجاتهم إن وُجد جدول درجات، وإلا قائمة فارغة',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, entity: { type: 'string' }, score: { anyOf: [{ type: 'number' }, { type: 'null' }] } },
        required: ['name', 'entity', 'score'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'outcomes', 'recommendations', 'intro', 'modules', 'trainees'],
  additionalProperties: false,
};

async function readProviderReport({ course, pdfBase64 }) {
  const out = await askJson({
    system: `تقرأ تقرير الجهة المنفّذة لبرنامج تدريبي (قد يكون بالإنجليزية أو العربية) وتُعدّ منه مادة التقرير الفني ومجلة التوثيق باللغة العربية لوكالة جامعة نايف العربية للعلوم الأمنية للتدريب.
- اعتمد على ما في التقرير وحده، وترجم المصطلحات الفنية ترجمة دقيقة مع إبقاء المختصر الإنجليزي بين قوسين عند الحاجة، مثل: القتال في الأماكن المغلقة (CQB).
- المحاور: عنوان عربي موجز ووصف من جملة أو جملتين بصيغة الماضي («تدرّب المشاركون على…»).
- لا تذكر أسماء أفراد الجهة المنفّذة إلا إن كانوا مدربين أو مقدّمين للمحاور.
- إن لم يتضمن التقرير درجات المتدربين فأعِد قائمة المتدربين فارغة.

${STYLE}`,
    content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
      { type: 'text', text: `البرنامج في منصة الوكالة: ${course.name}${course.city ? ` — ${course.city}` : ''}. أعدّ المادة المطلوبة من هذا التقرير.` },
    ],
    schema: REPORT_SCHEMA,
    effort: 'medium',
  });
  const list = (a, n) => (Array.isArray(a) ? a : []).map(tidy).filter(Boolean).slice(0, n);
  return {
    summary: tidy(out.summary).slice(0, 3000),
    outcomes: list(out.outcomes, 8),
    recommendations: list(out.recommendations, 8),
    intro: tidy(out.intro).slice(0, 2500),
    modules: (out.modules || []).map((m) => ({ title: cleanSessionTitle(m.title).slice(0, 200), description: tidy(m.description).slice(0, 1200) })).filter((m) => m.title).slice(0, 40),
    trainees: (out.trainees || []).map((t) => ({
      name: tidy(t.name).slice(0, 160), entity: tidy(t.entity).slice(0, 160),
      score: Number.isFinite(t.score) ? Math.max(0, Math.min(100, t.score)) : null,
    })).filter((t) => t.name).slice(0, 200),
  };
}

module.exports = { MODEL, isConfigured, describeSessions, readSchedule, readProviderReport, tidy };
