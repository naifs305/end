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
    system: `تستخرج الجلسات التدريبية من نص منسوخ من جدول دورة. لكل جلسة: عنوانها كما ورد (بلا ترقيم في أوله)، وتاريخها، ووقتها بنظام ٢٤ ساعة («09:00 - 10:30»، أو «09:00» إن لم تُذكر النهاية)، ومقدّمها إن ذُكر.
تجاهل الاستراحات والصلاة والوجبات وسطور الملفات والروابط والأيقونات والحضور. لا تخترع جلسة غير موجودة، ولا تترجم العناوين.`,
    content: String(text).slice(0, 30000),
    schema: SCHEDULE_SCHEMA,
    effort: 'low',
  });
  const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
  // «HH:MM - HH:MM» أو وقت بدء مفرد «HH:MM» (جداول Excel)
  const okTime = (t) => {
    const v = String(t || '').trim().replace(/^(\d):/, '0$1:').replace(/ - (\d):/, ' - 0$1:');
    return /^\d{2}:\d{2}( - \d{2}:\d{2})?$/.test(v) ? v : null;
  };
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

// ── ٤. صياغة نصوص الإصدار من واقع الدورة وجلساتها ───────────
const FIELD_BRIEFS = {
  welcome: {
    label: 'كلمة الترحيب',
    brief: 'كلمة ترحيب قصيرة (٤٠–٧٠ كلمة) تفتتح المجلة: ترحّب بالمشاركين وتشيد بالجهات المشاركة، وتشير إلى الجهة المشرفة إن ذُكرت. بصيغة الحاضر، ودون ذكر أسماء أشخاص.',
  },
  intro: {
    label: 'مقدمة المجلة',
    brief: 'فقرة أو فقرتان (٨٠–١٣٠ كلمة) تعرّف بالبرنامج: سياقه في رسالة الجامعة، وأهدافه المستنتجة من محاوره، والفئة المستهدفة، وما ميّز تنفيذه. بصيغة الماضي التوثيقية.',
  },
  closing: {
    label: 'خاتمة المجلة',
    brief: 'فقرة واحدة (٥٠–٨٠ كلمة) تختم الإصدار: ما اكتمل من محاور البرنامج إجمالاً، وأثره المرجو في عمل المشاركين، وشكر الجهات المشاركة. بصيغة الماضي، وبلا مبالغة.',
  },
  reportSummary: {
    label: 'الملخص التنفيذي للتقرير الفني',
    brief: 'ملخص تنفيذي للقيادات (١٠٠–١٦٠ كلمة) في فقرتين: الأولى عن تنفيذ البرنامج ومحاوره وتسلسلها، والثانية عن النتائج بالأرقام المعطاة وحدها (العدد، المتوسط، أعلى درجة، نسبة الاجتياز) إن وُجدت. ثم سطر «أبرز المخرجات:» تليه ٣–٥ نقاط تبدأ كل منها بـ«• » مستنتجة من المحاور.',
  },
  recommendations: {
    label: 'التوصيات',
    brief: 'من ٤ إلى ٦ توصيات عملية محددة، كل توصية في سطر مستقل بلا ترقيم ولا رموز في أوله، تبدأ بفعل مصدر أو أمر مؤسسي («تكرار…، إضافة…، إعداد…، تعزيز…»)، مستنتجة من محاور البرنامج ونتائجه، ويمكن تنفيذها فعلاً.',
  },
};

const COMPOSE_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
  additionalProperties: false,
};

/** يصوغ نصاً واحداً من نصوص الإصدار من واقع بيانات الدورة وجلساتها بتسلسلها */
async function composeText({ field, course, texts, sessions, trainees }) {
  const f = FIELD_BRIEFS[field];
  if (!f) throw httpError(400, 'حقل غير معروف', 'serverErrors.documentation.badField');
  const days = course.startDate && course.endDate ? Math.round((new Date(course.endDate) - new Date(course.startDate)) / 86400000) + 1 : null;
  const sessionLines = sessions.filter((s) => s.title.trim()).map((s, i) => {
    const bits = [`${i + 1}. ${cleanSessionTitle(s.title)}`];
    if (s.date) bits.push(String(s.date).slice(0, 10));
    if (s.presenter) bits.push(`المقدّم: ${s.presenter}`);
    if (s.description) bits.push(`وصفها: ${s.description}`);
    return bits.join(' — ');
  });
  const facts = [
    `البرنامج: ${course.name}`,
    course.city ? `مكان الانعقاد: ${course.city}` : '',
    days ? `المدة: ${days} أيام` : '',
    course.numTrainees ? `عدد المشاركين المسجّل: ${course.numTrainees}` : '',
    texts.patronage ? `الجهة المشرفة أو الشريكة: ${texts.patronage}` : '',
    sessionLines.length ? `الجلسات بتسلسلها:\n${sessionLines.join('\n')}` : 'لم تُسجَّل الجلسات بعد — اعتمد على اسم البرنامج وحده بحذر.',
    trainees.count ? `المتدربون: ${trainees.count}${trainees.average !== null ? `، المتوسط ${trainees.average}، أعلى درجة ${trainees.top}، نسبة الاجتياز ${trainees.passRate}٪` : ''}${trainees.entities.length ? `، من: ${trainees.entities.join('، ')}` : ''}` : '',
    trainees.distinctions.length ? `ما تميّز به المتفوقون: ${trainees.distinctions.join(' | ')}` : '',
    field !== 'intro' && texts.intro ? `المقدمة الحالية (للاتساق لا للتكرار): ${texts.intro.slice(0, 1200)}` : '',
    texts[field] ? `النص الحالي (أعد صياغته أجود منه مع الإبقاء على صحيح معلوماته): ${texts[field].slice(0, 2000)}` : '',
  ].filter(Boolean).join('\n');

  const out = await askJson({
    system: `أنت محرّر في وكالة جامعة نايف العربية للعلوم الأمنية للتدريب، تُعدّ نصوص إصدارات توثيق البرامج التدريبية التي تُرفع للقيادات والجهات الشريكة.
المطلوب: ${f.label}.
${f.brief}
- استند إلى عناوين الجلسات وتسلسلها في بناء المعنى، ولا تذكر رقم الجلسة.
- لا تبدأ بـ«تهدف» أو «في إطار» أو «يأتي».
${STYLE}`,
    content: facts,
    schema: COMPOSE_SCHEMA,
    effort: 'medium',
  });
  let text = tidy(out.text);
  if (field === 'recommendations') {
    text = text.split(/\n+/).map((l) => l.replace(/^[\s•\-–—*\d.)(٠-٩]+/, '').trim()).filter(Boolean).join('\n');
  }
  return text.slice(0, field === 'welcome' ? 1500 : 4000);
}

module.exports = { MODEL, isConfigured, askJson, describeSessions, readSchedule, readProviderReport, composeText, tidy };
