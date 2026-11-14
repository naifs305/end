// ======================================================================
// صفحات المجلة والتقرير الفني — بمقاس A4، أو مربعة ٢١٠×٢١٠ ملم
// ----------------------------------------------------------------------
// صفحة واحدة تخدم ثلاثة: التقليب على الشاشة، والعرض المتتابع على الجوال،
// والطباعة (ونسخة المطبعة بهوامش القصّ). فما يراه المنسق هو بعينه ما يخرج
// من المطبعة.
//
// الهوية: شعار الجامعة الذهبي ثابت في كل إصدار، وبجواره شعارات الشركاء إن
// وُجدت، ونجمة الجامعة زخرفةً شفافة في الخلفيات.
//
// كل صورة تُعرض بقصّها وفلترها المحفوظين (PhotoImg) — فلا تُقصّ الرؤوس ولا
// تُعاد كتابة الصورة. وصور كل جلسة تظهر معها في «من قلب الجلسات»، وما بقي
// يتوزّع على المعرض بحسب اتجاهه (عمودية أو أفقية من الجوال).
//
// الصياغة عربية أكاديمية بنَفَس مؤسسي سعودي، وما يكتبه المنسق يُعرض نصاً
// (React يهرّبه) فلا يُنفَّذ منه شيء.
// ======================================================================
import { orientation, ratioOf } from '../../lib/documentation/photoLook';
import PhotoImg from './PhotoImg';

const fmtDate = (v, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory-nu-arab', opts) : '');
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const yearOf = (v) => toAr(new Date(v || '2026-01-01').getFullYear());

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
  return d > 0 ? d : null;
}
const daysWord = (d) => (d > 10 ? 'يوماً' : d > 2 ? 'أيام' : d === 2 ? 'يومان' : 'يوم');

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// توزيع متوازن بحد أقصى للصفحة (٦ عناصر بحد ٤ = ٣ + ٣، لا ٤ + ٢)
function balanced(list, max) {
  if (!list.length) return [];
  return chunk(list, Math.ceil(list.length / Math.ceil(list.length / max)));
}

const LOGO = '/brand/nauss-logo-gold.png';
const STAR = '/brand/nauss-star.png';

// ── أجزاء متكررة ─────────────────────────────────────────────
function Star({ className = '' }) {
  return <img src={STAR} alt="" aria-hidden="true" className={`mz-star ${className}`} />;
}

function PartnerLogos({ logos, light = false }) {
  if (!logos?.length) return null;
  return (
    <div className={`mz-partners ${light ? 'is-light' : ''}`}>
      {logos.map((l) => <span key={l.key || l.preset}><img src={l.url} alt={l.name || 'شعار شريك'} /></span>)}
    </div>
  );
}

function RunningHead({ course, label }) {
  return (
    <div className="mz-head">
      <img src={LOGO} alt="" className="mz-head-logo" />
      <span className="mz-head-label">{label}</span>
      <span className="mz-head-course">{course.name}</span>
    </div>
  );
}

function Folio({ n }) {
  return <div className="mz-folio"><span>{toAr(n)}</span></div>;
}

function Photo({ m, className = '', showCaption = true }) {
  if (!m) return null;
  return (
    <figure className={`mz-photo ${className}`}>
      <PhotoImg m={m} alt={m.caption || 'صورة من الدورة'} />
      {showCaption && m.caption && <figcaption>{m.caption}</figcaption>}
    </figure>
  );
}

// ── الغلاف ────────────────────────────────────────────────────
function Cover({ course, doc, cover, edition }) {
  const kicker = edition === 'report' ? 'التقرير الفني للبرنامج' : 'برنامج تدريبي';
  return (
    <section className="mz-page mz-cover">
      {cover && <div className="mz-cover-img"><PhotoImg m={cover} alt="" /></div>}
      <div className="mz-cover-veil" />
      <Star className="mz-cover-star" />
      <div className="mz-cover-top">
        <img src={LOGO} alt="جامعة نايف العربية للعلوم الأمنية" className="mz-cover-logo" />
        <PartnerLogos logos={doc.logos} light />
      </div>
      <div className="mz-cover-body">
        {doc.patronage && <span className="mz-patron">{doc.patronage}</span>}
        <span className="mz-kicker-light">{kicker}</span>
        <h1>{course.name}</h1>
        <div className="mz-gold-rule" />
        <p className="mz-cover-meta">
          {course.city ? `${course.city} · ` : ''}{fmtDate(course.startDate)} – {fmtDate(course.endDate)}
        </p>
      </div>
      <div className="mz-cover-foot">
        <span>وكالة الجامعة للتدريب</span>
        <span>{yearOf(course.endDate)}</span>
      </div>
    </section>
  );
}

// ── كلمة الترحيب (اختيارية) ───────────────────────────────────
function Welcome({ course, doc, page }) {
  return (
    <section className="mz-page mz-inner mz-welcome">
      <Star className="mz-welcome-star" />
      <div className="mz-welcome-body">
        <img src={LOGO} alt="" className="mz-welcome-logo" />
        <span className="mz-kicker">كلمة ترحيب</span>
        <div className="mz-gold-rule mz-rule-center" />
        <p className="mz-welcome-text">{doc.welcome}</p>
        {doc.patronage && <p className="mz-welcome-patron">{doc.patronage}</p>}
        <PartnerLogos logos={doc.logos} />
        <p className="mz-welcome-course">{course.name}</p>
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── التقديم: عن البرنامج وبطاقته ─────────────────────────────
function Intro({ course, doc, photo, page }) {
  const days = daysBetween(course.startDate, course.endDate);
  const c = course.coordinator;
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="عن البرنامج" />
      <div className="mz-body mz-intro">
        <div className="mz-intro-main">
          <span className="mz-kicker">عن البرنامج</span>
          <h2 className="mz-h2 mz-intro-title">{course.name}</h2>
          <p className="mz-lead">
            {doc.intro || `انطلاقاً من رسالة جامعة نايف العربية للعلوم الأمنية في بناء القدرات الأمنية العربية، نفّذت وكالة الجامعة للتدريب برنامج «${course.name}».`}
          </p>
          {photo && <Photo m={photo} className="mz-intro-photo" />}
        </div>
        <aside className="mz-card">
          <Star className="mz-card-star" />
          <b className="mz-card-title">بطاقة البرنامج</b>
          <dl>
            <div><dt>الفترة</dt><dd>{fmtDate(course.startDate, { day: 'numeric', month: 'long' })} – {fmtDate(course.endDate)}</dd></div>
            {days && <div><dt>المدة</dt><dd>{toAr(days)} {daysWord(days)}</dd></div>}
            {course.city && <div><dt>مكان الانعقاد</dt><dd>{course.city}</dd></div>}
            {course.numTrainees ? <div><dt>المشاركون</dt><dd>{toAr(course.numTrainees)} متدرباً</dd></div> : null}
            {doc.patronage && <div><dt>بإشراف</dt><dd>{doc.patronage}</dd></div>}
          </dl>
          {c && (
            <div className="mz-coord">
              {c.profileImage ? <img src={c.profileImage} alt="" /> : <span className="mz-coord-init">{c.firstName?.[0] || '؟'}</span>}
              <span><small>منسق البرنامج</small><b>{c.firstName} {c.lastName}</b></span>
            </div>
          )}
        </aside>
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── برنامج الدورة (الجلسات) ──────────────────────────────────
function Sessions({ course, sessions, page, part, offset }) {
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="برنامج الدورة" />
      <Star className="mz-corner-star" />
      <div className="mz-body">
        <span className="mz-kicker">الجلسات التدريبية</span>
        <h2 className="mz-h2">برنامج الدورة{part > 1 ? ` (${toAr(part)})` : ''}</h2>
        <ol className="mz-timeline">
          {sessions.map((s, k) => (
            <li key={s.id || `${offset + k}`}>
              <div className="mz-tl-date">
                {s.date ? fmtDate(s.date, { day: 'numeric', month: 'short' }) : `${toAr(offset + k + 1)}`}
                {s.time && <small>{toAr(s.time)}</small>}
              </div>
              <div className="mz-tl-body">
                <h3>{s.title}</h3>
                {s.presenter && <p className="mz-tl-who">{s.presenter}</p>}
                {s.description && <p className="mz-tl-desc">{s.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── من قلب الجلسات: كل جلسة بصورها وقصتها ──────────────────
function SessionFeatures({ course, items, page }) {
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="من قلب الجلسات" />
      <div className="mz-body mz-feats">
        {items.map(({ s, n, photos }, k) => (
          <article key={s.id || `${n}`} className={`mz-feat mz-feat-p${Math.min(photos.length, 4)} ${k % 2 ? 'mz-feat-flip' : ''} ${photos.length === 1 && orientation(photos[0]) === 'portrait' ? 'mz-feat-tall' : ''}`}>
            <div className="mz-feat-photos">
              {photos.slice(0, 4).map((m) => <Photo key={m.id} m={m} showCaption={false} />)}
            </div>
            <div className="mz-feat-text">
              <span className="mz-feat-no">الجلسة {toAr(n)}</span>
              <h3>{s.title}</h3>
              <p className="mz-feat-meta">
                {[s.date ? fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' }) : '', s.time ? toAr(s.time) : ''].filter(Boolean).join(' · ')}
              </p>
              {s.presenter && <p className="mz-feat-who">{s.presenter}</p>}
              {s.description && <p className="mz-feat-desc">{s.description}</p>}
            </div>
          </article>
        ))}
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── المعرض: تصاميم تتناوب وتراعي اتجاه الصور ─────────────────
const GALLERY_TITLES = ['من أجواء الدورة', 'لقطات من البرنامج', 'مشاهد من التطبيق', 'محطات من الدورة'];

function Gallery({ course, photos, layout, page, index }) {
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="المعرض" />
      <div className="mz-body">
        <h2 className="mz-h2 mz-h2-sm">{GALLERY_TITLES[index % GALLERY_TITLES.length]}</h2>
        <div className={`mz-gal mz-gal-${layout}`}>
          {photos.map((m) => <Photo key={m.id} m={m} />)}
        </div>
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── الختام ────────────────────────────────────────────────────
function Closing({ course, doc, stats, qrSvg, page }) {
  const c = course.coordinator;
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="ختام" />
      <Star className="mz-corner-star" />
      <div className="mz-body">
        <span className="mz-kicker">ختام البرنامج</span>
        <h2 className="mz-h2">ختام</h2>
        <p className="mz-lead">
          {doc.closing || `وبحمد الله وتوفيقه اختُتم برنامج «${course.name}»، بعد أيام حافلة بالمعرفة والتطبيق وتبادل الخبرات، سائلين الله أن يكون لبنةً في مسيرة العمل الأمني العربي المشترك.`}
        </p>
        <div className="mz-stats">
          {stats.map((s) => (
            <div key={s.label}><b>{toAr(s.value)}</b><span>{s.label}</span></div>
          ))}
        </div>
        <div className="mz-closing-foot">
          {c && (
            <div className="mz-signoff">
              <span>أعدّ هذا الإصدار</span>
              <b>{c.firstName} {c.lastName}</b>
              <small>منسق البرنامج — وكالة الجامعة للتدريب</small>
            </div>
          )}
          {qrSvg && (
            <div className="mz-qr">
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <span>تصفّح المجلة إلكترونياً</span>
            </div>
          )}
        </div>
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── الغلاف الخلفي ─────────────────────────────────────────────
function BackCover({ doc }) {
  return (
    <section className="mz-page mz-back">
      <Star className="mz-back-star" />
      <img src={LOGO} alt="جامعة نايف العربية للعلوم الأمنية" className="mz-back-logo" />
      <PartnerLogos logos={doc.logos} light />
      <p className="mz-back-sub">وكالة الجامعة للتدريب</p>
      <p className="mz-back-web">www.nauss.edu.sa</p>
    </section>
  );
}

// ══════════════════ التقرير الفني ══════════════════
function avg(list) {
  const v = list.filter((x) => Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

const BANDS = [
  { label: 'ممتاز', min: 90, max: 100, color: '#00676a' },
  { label: 'جيد جداً', min: 80, max: 89.99, color: '#2E8A8E' },
  { label: 'جيد', min: 70, max: 79.99, color: '#B8955A' },
  { label: 'مقبول', min: 60, max: 69.99, color: '#D08A3E' },
  { label: 'دون المطلوب', min: 0, max: 59.99, color: '#A04A4A' },
];

function ReportDivider({ doc }) {
  return (
    <section className="mz-page mz-divider">
      <Star className="mz-back-star" />
      <img src={LOGO} alt="" className="mz-divider-logo" />
      <span className="mz-kicker-light">الجزء الثاني</span>
      <h2>التقرير الفني</h2>
      <div className="mz-gold-rule" />
      <p>ملخص تنفيذ البرنامج، ونتائج المتدربين، وتوصياته — مُعدّ للقيادات وجهة التدريب</p>
      <PartnerLogos logos={doc.logos} light />
    </section>
  );
}

function Executive({ course, doc, trainees, sessions, photosCount, page, withSummary = true }) {
  const scores = trainees.map((t) => t.score).filter((x) => Number.isFinite(x));
  const average = avg(scores);
  const top = scores.length ? Math.max(...scores) : null;
  const passed = scores.filter((s) => s >= 60).length;
  const distinguished = trainees.filter((t) => t.isDistinguished).length;
  const days = daysBetween(course.startDate, course.endDate);
  const kpis = [
    { label: 'متدرباً', value: trainees.length || course.numTrainees || 0 },
    { label: 'متوسط الدرجات', value: average ?? '—' },
    { label: 'أعلى درجة', value: top ?? '—' },
    { label: 'نسبة الاجتياز', value: scores.length ? `${Math.round((passed / scores.length) * 100)}٪` : '—' },
    { label: 'متدرباً متميّزاً', value: distinguished },
    { label: 'جلسة تدريبية', value: sessions.length },
  ];
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <Star className="mz-corner-star" />
      <div className="mz-body">
        <span className="mz-kicker">الملخص التنفيذي</span>
        <h2 className="mz-h2">البرنامج في أرقام</h2>
        <div className="mz-kpis">
          {kpis.map((k) => <div key={k.label}><b>{toAr(k.value)}</b><span>{k.label}</span></div>)}
        </div>
        <table className="mz-info">
          <tbody>
            <tr><th>البرنامج</th><td>{course.name}</td></tr>
            <tr><th>الفترة</th><td>{fmtDate(course.startDate)} – {fmtDate(course.endDate)}{days ? ` (${toAr(days)} ${daysWord(days)})` : ''}</td></tr>
            {course.city && <tr><th>مكان الانعقاد</th><td>{course.city}</td></tr>}
            {doc.patronage && <tr><th>الإشراف</th><td>{doc.patronage}</td></tr>}
            {course.coordinator && <tr><th>منسق البرنامج</th><td>{course.coordinator.firstName} {course.coordinator.lastName}</td></tr>}
            <tr><th>التوثيق المصوّر</th><td>{toAr(photosCount)} صورة</td></tr>
          </tbody>
        </table>
        {withSummary && (
          <>
            <h3 className="mz-h3">ملخص التنفيذ</h3>
            <p className="mz-text mz-summary">
              {doc.reportSummary || `نُفّذ البرنامج وفق الخطة المعتمدة، وحقّق أهدافه التدريبية بمشاركة ${toAr(trainees.length || course.numTrainees || 0)} متدرباً، وقد اتسمت الجلسات بالتفاعل والتطبيق العملي.`}
            </p>
          </>
        )}
      </div>
      <Folio n={page} />
    </section>
  );
}

function SummaryPage({ course, doc, trainees, page }) {
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <div className="mz-body">
        <span className="mz-kicker">الملخص التنفيذي</span>
        <h2 className="mz-h2 mz-h2-sm">ملخص التنفيذ</h2>
        <p className="mz-text mz-summary">
          {doc.reportSummary || `نُفّذ البرنامج وفق الخطة المعتمدة، وحقّق أهدافه التدريبية بمشاركة ${toAr(trainees.length || course.numTrainees || 0)} متدرباً، وقد اتسمت الجلسات بالتفاعل والتطبيق العملي.`}
        </p>
      </div>
      <Folio n={page} />
    </section>
  );
}

// نتائج المتدربين بصرياً: توزيع التقديرات، والمتوسط، والأوائل، والجهات المشاركة
function Results({ course, trainees, page }) {
  const scores = trainees.map((t) => t.score).filter((x) => Number.isFinite(x));
  const average = avg(scores) || 0;
  const bands = BANDS.map((b) => ({ ...b, n: scores.filter((s) => s >= b.min && s <= b.max).length }));
  const maxN = Math.max(1, ...bands.map((b) => b.n));
  const ent = {};
  trainees.forEach((t) => { const k = (t.entity || '').trim(); if (k) ent[k] = (ent[k] || 0) + 1; });
  const entities = Object.entries(ent).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const maxE = Math.max(1, ...entities.map((e) => e[1]));
  const top = [...trainees].filter((t) => Number.isFinite(t.score)).sort((a, b) => b.score - a.score).slice(0, 5);
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <div className="mz-body">
        <span className="mz-kicker">نتائج التقييم</span>
        <h2 className="mz-h2 mz-h2-sm">قراءة في نتائج المتدربين</h2>
        <div className="mz-res">
          <div className="mz-res-ring" style={{ background: `conic-gradient(#00676a ${average * 3.6}deg, #ece6d6 0)` }}>
            <span><b>{toAr(average)}</b><small>متوسط الدرجات</small></span>
          </div>
          <div className="mz-bands">
            {bands.map((b) => (
              <div key={b.label} className="mz-band">
                <span className="mz-band-l">{b.label}</span>
                <span className="mz-band-bar"><i style={{ width: `${(b.n / maxN) * 100}%`, background: b.color }} /></span>
                <b>{toAr(b.n)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="mz-res-grid">
          {top.length > 0 && (
            <div className="mz-res-box">
              <h3 className="mz-h3">الخمسة الأوائل</h3>
              <ol className="mz-top">
                {top.map((t, i) => <li key={t.id || t.name}><span className="mz-top-n">{toAr(i + 1)}</span><span className="mz-top-name">{t.name}</span><b>{toAr(t.score)}</b></li>)}
              </ol>
            </div>
          )}
          {entities.length > 0 && (
            <div className="mz-res-box">
              <h3 className="mz-h3">الجهات المشاركة</h3>
              {entities.map(([name, n]) => (
                <div key={name} className="mz-band mz-band-ent">
                  <span className="mz-band-l">{name}</span>
                  <span className="mz-band-bar"><i style={{ width: `${(n / maxE) * 100}%` }} /></span>
                  <b>{toAr(n)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Folio n={page} />
    </section>
  );
}

// سجل تنفيذ البرنامج: الجلسات بتواريخها ومقدّميها
function ProgramTable({ course, sessions, page, part, offset }) {
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <div className="mz-body">
        <span className="mz-kicker">تنفيذ البرنامج</span>
        <h2 className="mz-h2 mz-h2-sm">سجل الجلسات المنفّذة{part > 1 ? ` (${toAr(part)})` : ''}</h2>
        <table className="mz-trainees mz-prog">
          <thead><tr><th>م</th><th>الجلسة</th><th>التاريخ</th><th>الوقت</th><th>المقدّم</th></tr></thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.id || `${offset + i}`}>
                <td>{toAr(offset + i + 1)}</td>
                <td className="mz-prog-title">{s.title}</td>
                <td>{s.date ? fmtDate(s.date, { day: 'numeric', month: 'short' }) : '—'}</td>
                <td>{s.time ? toAr(s.time) : '—'}</td>
                <td>{s.presenter || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Folio n={page} />
    </section>
  );
}

// مشاهد من التنفيذ — شاهد مصوّر داخل التقرير
function Highlights({ course, photos, page }) {
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <div className="mz-body">
        <span className="mz-kicker">التوثيق المصوّر</span>
        <h2 className="mz-h2 mz-h2-sm">مشاهد من التنفيذ</h2>
        <div className={`mz-gal mz-gal-${photos.length >= 4 ? 'grid' : photos.length === 3 ? 'hero' : 'pair'}`}>
          {photos.map((m) => <Photo key={m.id} m={m} />)}
        </div>
      </div>
      <Folio n={page} />
    </section>
  );
}

function TraineesTable({ course, trainees, page, part, startIndex }) {
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <div className="mz-body">
        <span className="mz-kicker">نتائج المتدربين</span>
        <h2 className="mz-h2 mz-h2-sm">سجل المتدربين ودرجاتهم{part > 1 ? ` (${toAr(part)})` : ''}</h2>
        <table className="mz-trainees">
          <thead><tr><th>م</th><th>المتدرب</th><th>الجهة</th><th>الدرجة</th><th>التقدير</th><th>ملاحظة التميّز</th></tr></thead>
          <tbody>
            {trainees.map((t, i) => {
              const band = Number.isFinite(t.score) ? BANDS.find((b) => t.score >= b.min && t.score <= b.max) : null;
              return (
                <tr key={t.id || `${t.name}-${i}`} className={t.isDistinguished ? 'is-star' : ''}>
                  <td>{toAr(startIndex + i + 1)}</td>
                  <td className="mz-tr-name">
                    {t.photoUrl ? <img src={t.photoUrl} alt="" /> : <span className="mz-tr-init">{t.name?.trim()?.[0] || '؟'}</span>}
                    <span>{t.name}{t.isDistinguished && <i> ★</i>}</span>
                  </td>
                  <td>{t.entity || '—'}</td>
                  <td className="mz-tr-score">{Number.isFinite(t.score) ? toAr(t.score) : '—'}</td>
                  <td>{band ? <span className="mz-grade" style={{ color: band.color, borderColor: band.color }}>{band.label}</span> : '—'}</td>
                  <td className="mz-tr-note">{t.distinction || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Folio n={page} />
    </section>
  );
}

function Distinguished({ course, list, page }) {
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <Star className="mz-corner-star" />
      <div className="mz-body">
        <span className="mz-kicker">لوحة الشرف</span>
        <h2 className="mz-h2">المتدربون المتميّزون</h2>
        <div className="mz-stars">
          {list.map((t) => (
            <div key={t.id || t.name} className="mz-star-card">
              {t.photoUrl ? <img src={t.photoUrl} alt="" /> : <span className="mz-tr-init mz-tr-init-lg">{t.name?.trim()?.[0] || '؟'}</span>}
              <b>{t.name}</b>
              {t.entity && <small>{t.entity}</small>}
              {Number.isFinite(t.score) && <span className="mz-star-score">{toAr(t.score)}</span>}
              {t.distinction && <p>{t.distinction}</p>}
            </div>
          ))}
        </div>
      </div>
      <Folio n={page} />
    </section>
  );
}

function Recommendations({ course, doc, page }) {
  const lines = String(doc.recommendations || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <Star className="mz-corner-star" />
      <div className="mz-body">
        <span className="mz-kicker">التوصيات</span>
        <h2 className="mz-h2">التوصيات والمقترحات</h2>
        {lines.length ? (
          <ol className="mz-recs">{lines.map((l, i) => <li key={i}><span className="mz-rec-n">{toAr(i + 1)}</span><p>{l}</p></li>)}</ol>
        ) : (
          <p className="mz-text">لا توصيات مدوّنة لهذا البرنامج.</p>
        )}
        <p className="mz-report-end">صدر هذا التقرير عن وكالة الجامعة للتدريب — {fmtDate(course.endDate || '2026-01-01')}</p>
      </div>
      <Folio n={page} />
    </section>
  );
}

/**
 * يبني صفحات الإصدار.
 * edition: magazine | report | both
 */
export function buildPages({ course, documentation: doc, edition = 'magazine', qrSvg = null }) {
  const square = doc.format === 'SQUARE';
  // سعة الصفحة: المربعة أقصر بثلث تقريباً
  const per = square
    ? { timeline: 5, features: 1, trainees: 7, stars: 3, program: 8 }
    : { timeline: 7, features: 2, trainees: 12, stars: 6, program: 14 };
  const media = doc.media || [];
  const byId = new Map(media.map((m) => [m.id, m]));
  const sessions = doc.sessions || [];
  const trainees = doc.trainees || [];
  const cover = media.find((m) => m.id === doc.coverMediaId) || media[0] || null;

  // صور الجلسات تظهر مع جلساتها، لا في المعرض
  const features = sessions
    .map((s, i) => ({ s, n: i + 1, photos: (s.photoIds || []).map((pid) => byId.get(pid)).filter((m) => m && m.id !== cover?.id) }))
    .filter((f) => f.photos.length);
  const used = new Set(features.flatMap((f) => f.photos.map((m) => m.id)));
  const rest = media.filter((m) => m.id !== cover?.id && !used.has(m.id));

  const pages = [];
  let n = 1;
  const push = (key, render) => { pages.push({ key, node: render(n) }); n += 1; };

  const withMagazine = edition !== 'report';
  const withReport = edition !== 'magazine';

  push('cover', () => <Cover course={course} doc={doc} cover={cover} edition={edition} />);
  if (withMagazine && doc.welcome) push('welcome', (p) => <Welcome course={course} doc={doc} page={p} />);

  if (withMagazine) {
    // صورة التقديم أفقية إن وُجدت (المربعة لا تتسع لها)
    const introPhoto = square ? null : (rest.find((m) => orientation(m) === 'landscape') || null);
    const gallery = rest.filter((m) => m !== introPhoto);
    push('intro', (p) => <Intro course={course} doc={doc} photo={introPhoto} page={p} />);
    let offset = 0;
    balanced(sessions, per.timeline).forEach((part, i) => {
      const o = offset; offset += part.length;
      push(`sessions-${i}`, (p) => <Sessions course={course} sessions={part} page={p} part={i + 1} offset={o} />);
    });
    chunk(features, per.features).forEach((part, i) => push(`feat-${i}`, (p) => <SessionFeatures course={course} items={part} page={p} />));

    // المعرض: بطل وصورتان، ثم شبكة أربع، ثم عمود وصورتان — والعموديات
    // الثلاث المتتالية تُصفّ أعمدةً، والبطل أفقيّ، والعمود عموديّ
    const layouts = [{ k: 'hero', size: 3 }, { k: 'grid', size: 4 }, { k: 'side', size: 3 }];
    let i = 0; let g = 0;
    while (i < gallery.length) {
      let l = layouts[g % layouts.length];
      const next3 = gallery.slice(i, i + 3);
      if (next3.length === 3 && next3.every((m) => orientation(m) === 'portrait')) l = { k: 'trio', size: 3 };
      let part = gallery.slice(i, i + l.size);
      if (l.k === 'hero') part = [...part].sort((a, b) => ratioOf(b) - ratioOf(a));
      if (l.k === 'side') part = [...part].sort((a, b) => ratioOf(a) - ratioOf(b));
      const layout = part.length < l.size ? (part.length === 1 ? 'single' : part.length === 2 ? (part.every((m) => orientation(m) === 'portrait') ? 'pair-tall' : 'pair') : l.k) : l.k;
      const gi = g;
      const photos = part;
      push(`gal-${g}`, (p) => <Gallery course={course} photos={photos} layout={layout} page={p} index={gi} />);
      i += l.size; g += 1;
    }
    const days = daysBetween(course.startDate, course.endDate);
    const stats = [
      days ? { label: days > 10 ? 'يوماً تدريبياً' : 'أيام تدريبية', value: days } : null,
      sessions.length ? { label: 'جلسة', value: sessions.length } : null,
      course.numTrainees ? { label: 'متدرباً', value: course.numTrainees } : null,
      { label: 'لقطة موثّقة', value: media.length },
    ].filter(Boolean);
    push('closing', (p) => <Closing course={course} doc={doc} stats={stats} qrSvg={qrSvg} page={p} />);
  }

  if (withReport) {
    if (withMagazine) push('report-divider', () => <ReportDivider doc={doc} />);
    push('executive', (p) => <Executive course={course} doc={doc} trainees={trainees} sessions={sessions} photosCount={media.length} page={p} withSummary={!square} />);
    if (square) push('summary', (p) => <SummaryPage course={course} doc={doc} trainees={trainees} page={p} />);
    if (trainees.some((t) => Number.isFinite(t.score))) push('results', (p) => <Results course={course} trainees={trainees} page={p} />);
    let offset = 0;
    balanced(sessions, per.program).forEach((part, i) => {
      const o = offset; offset += part.length;
      push(`program-${i}`, (p) => <ProgramTable course={course} sessions={part} page={p} part={i + 1} offset={o} />);
    });
    // توزيع متوازن على الصفحات (١٥ متدرباً = ٨ + ٧، لا ١٢ + ٣)
    let start = 0;
    balanced(trainees, per.trainees).forEach((part, i) => {
      const s0 = start; start += part.length;
      push(`trainees-${i}`, (p) => <TraineesTable course={course} trainees={part} page={p} part={i + 1} startIndex={s0} />);
    });
    const stars = trainees.filter((t) => t.isDistinguished);
    chunk(stars, per.stars).forEach((part, i) => push(`stars-${i}`, (p) => <Distinguished course={course} list={part} page={p} />));
    const shots = [cover, ...media.filter((m) => m.id !== cover?.id)].filter(Boolean).slice(0, 4);
    if (edition === 'report' && shots.length >= 2) push('highlights', (p) => <Highlights course={course} photos={shots} page={p} />);
    push('recs', (p) => <Recommendations course={course} doc={doc} page={p} />);
  }

  push('back', () => <BackCover doc={doc} />);
  return pages;
}

// ── الأنماط: صفحة حقيقية بالملّيمتر، تُصغَّر على الشاشة وتُطبع بمقاسها ──
export const MAGAZINE_CSS = `
.mz-page{width:210mm;height:297mm;position:relative;overflow:hidden;color:#17393b;
  background:#fcfaf5 radial-gradient(120mm 90mm at 100% 0%,rgba(198,170,118,.10),transparent 70%);
  font-family:'Cairo','Boutros Jazirah Text',Tahoma,sans-serif;direction:rtl;box-sizing:border-box}
.mz-page *{box-sizing:border-box}
.mz-page img{display:block}
.mz-star{position:absolute;pointer-events:none;user-select:none}
.mz-corner-star{width:95mm;height:95mm;left:-30mm;bottom:-28mm;opacity:.07}
.mz-inner{padding:0}
.mz-body{position:absolute;inset:31mm 18mm 22mm 18mm;display:flex;flex-direction:column}
.mz-head{position:absolute;top:0;inset-inline:0;height:21mm;display:flex;align-items:center;gap:4mm;padding:0 18mm;
  border-bottom:0.4mm solid #C6AA76;background:linear-gradient(180deg,#ffffff,#fcfaf5)}
.mz-head-logo{height:12mm;width:auto}
.mz-head-label{font-weight:800;color:#00676a;font-size:3.4mm;border-inline-start:0.3mm solid #e6d9bd;padding-inline-start:4mm}
.mz-head-course{margin-inline-start:auto;font-size:3mm;color:#55696a;max-width:90mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mz-folio{position:absolute;bottom:8mm;inset-inline:0;display:flex;justify-content:center}
.mz-folio span{font-weight:800;font-size:3.4mm;color:#8a6d3a;border-top:0.4mm solid #C6AA76;padding-top:1.2mm;min-width:12mm;text-align:center}
.mz-kicker{font-size:3.2mm;font-weight:800;color:#8a6d3a;letter-spacing:.2mm}
.mz-h2{font-size:9.5mm;line-height:1.25;font-weight:800;color:#0b3f42;margin:1mm 0 6mm}
.mz-h2-sm{font-size:7mm;margin-bottom:5mm}
.mz-h3{font-size:4.6mm;font-weight:800;color:#0b3f42;margin:6mm 0 2mm}
.mz-lead{font-size:4.3mm;line-height:2;text-align:justify;margin:0;white-space:pre-line}
.mz-text{font-size:3.8mm;line-height:1.95;text-align:justify;margin:0;white-space:pre-line}
.mz-gold-rule{width:34mm;height:1.2mm;background:#C6AA76;border-radius:1mm}
.mz-rule-center{margin:3mm auto 6mm}
.mz-partners{display:flex;align-items:center;gap:3mm;flex-wrap:wrap;position:relative}
.mz-partners span{height:15mm;min-width:15mm;padding:1.5mm 2.5mm;border-radius:2.5mm;background:#fff;display:grid;place-items:center;border:0.3mm solid #e6d9bd}
.mz-partners img{max-height:12mm;max-width:34mm;object-fit:contain}
.mz-partners.is-light span{border-color:rgba(255,255,255,.4);box-shadow:0 1mm 4mm rgba(0,0,0,.18)}

/* الغلاف */
.mz-cover{background:#0b3f42;color:#fff}
.mz-cover-img{position:absolute;inset:0}
.mz-cover-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,45,48,.78) 0%,rgba(11,63,66,.15) 26%,rgba(11,63,66,.12) 46%,rgba(7,45,48,.9) 78%,#0b3f42 100%)}
.mz-cover-star{width:150mm;height:150mm;left:-52mm;bottom:-40mm;opacity:.16}
.mz-cover-top{position:absolute;top:14mm;inset-inline:16mm;display:flex;align-items:flex-start;justify-content:space-between;gap:6mm}
.mz-cover-logo{height:30mm;width:auto;filter:drop-shadow(0 1mm 3mm rgba(0,0,0,.35))}
.mz-cover-body{position:absolute;bottom:32mm;inset-inline:18mm}
.mz-patron{display:inline-block;font-size:3.5mm;font-weight:800;color:#0b3f42;background:#C6AA76;border-radius:2mm;padding:1.2mm 3.5mm;margin-bottom:4mm}
.mz-kicker-light{display:block;font-size:3.8mm;font-weight:800;color:#e6d9bd;letter-spacing:.3mm}
.mz-cover h1{font-size:14mm;line-height:1.2;font-weight:800;margin:2.5mm 0 4mm;color:#fff;text-shadow:0 1mm 4mm rgba(0,0,0,.3)}
.mz-cover-meta{font-size:4.2mm;margin:4mm 0 0;color:#f1ecdf}
.mz-cover-foot{position:absolute;bottom:13mm;inset-inline:18mm;display:flex;justify-content:space-between;font-size:3.3mm;font-weight:700;color:#e6d9bd;border-top:0.3mm solid rgba(230,217,189,.4);padding-top:3mm}

/* الترحيب */
.mz-welcome-star{width:190mm;height:190mm;left:10mm;top:40mm;opacity:.06}
.mz-welcome-body{position:absolute;inset:26mm 26mm 26mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:2mm}
.mz-welcome-logo{height:26mm;width:auto;margin-bottom:6mm}
.mz-welcome-text{font-size:5mm;line-height:2.1;color:#0b3f42;font-weight:600;margin:0 0 6mm;white-space:pre-line}
.mz-welcome-patron{font-size:3.8mm;font-weight:800;color:#8a6d3a;margin:0 0 4mm}
.mz-welcome-course{font-size:3.4mm;color:#55696a;margin-top:6mm}

/* التقديم */
.mz-intro{flex-direction:row;gap:8mm}
.mz-intro-main{flex:1;min-width:0;display:flex;flex-direction:column}
.mz-intro-title{font-size:8.5mm}
.mz-intro-photo{margin-top:auto;height:82mm;flex:none}
.mz-card{position:relative;overflow:hidden;width:60mm;flex:none;background:#0b3f42;color:#fff;border-radius:5mm;padding:7mm 5.5mm;display:flex;flex-direction:column}
.mz-card-star{width:80mm;height:80mm;left:-26mm;bottom:-22mm;opacity:.14}
.mz-card-title{font-size:4mm;color:#C6AA76;font-weight:800;margin-bottom:4mm;border-bottom:0.3mm solid rgba(198,170,118,.45);padding-bottom:3mm;position:relative}
.mz-card dl{margin:0;display:flex;flex-direction:column;gap:4mm;position:relative}
.mz-card dt{font-size:2.9mm;color:#e6d9bd;font-weight:700}
.mz-card dd{margin:0.6mm 0 0;font-size:3.7mm;font-weight:800;line-height:1.5}
.mz-coord{margin-top:auto;position:relative;display:flex;align-items:center;gap:3mm;background:rgba(255,255,255,.08);border-radius:3.5mm;padding:3mm}
.mz-coord img,.mz-coord-init{width:15mm;height:15mm;border-radius:50%;object-fit:cover;border:0.7mm solid #C6AA76;flex:none}
.mz-coord-init{display:grid;place-items:center;background:#C6AA76;color:#0b3f42;font-weight:800;font-size:6mm}
.mz-coord small{display:block;font-size:2.8mm;color:#e6d9bd}
.mz-coord b{display:block;font-size:3.6mm;line-height:1.4}

/* الصور */
.mz-photo{position:relative;margin:0;border-radius:3.5mm;overflow:hidden;background:#e9e4d6}
.mz-photo figcaption{position:absolute;inset-inline:0;bottom:0;padding:6mm 4mm 3mm;font-size:3.1mm;font-weight:700;color:#fff;
  background:linear-gradient(0deg,rgba(7,45,48,.85),transparent);z-index:1}
.mz-gal{flex:1;display:grid;gap:4mm;min-height:0}
.mz-gal-hero{grid-template-columns:1fr 1fr;grid-template-rows:1.5fr 1fr}
.mz-gal-hero .mz-photo:first-child{grid-column:1/-1}
.mz-gal-grid{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.mz-gal-side{grid-template-columns:1.25fr 1fr;grid-template-rows:1fr 1fr}
.mz-gal-side .mz-photo:first-child{grid-row:1/-1}
.mz-gal-pair{grid-template-rows:1fr 1fr}
.mz-gal-pair-tall{grid-template-columns:1fr 1fr}
.mz-gal-trio{grid-template-columns:repeat(3,1fr)}
.mz-gal-single{grid-template-rows:1fr}

/* من قلب الجلسات */
.mz-feats{gap:7mm}
.mz-feat{flex:1;min-height:0;display:grid;grid-template-columns:1.3fr 1fr;gap:6mm;align-items:stretch}
.mz-feat-flip{grid-template-columns:1fr 1.3fr}
.mz-feat-flip .mz-feat-photos{order:2}
.mz-feat-photos{display:grid;gap:2.5mm;min-height:0}
.mz-feat-p2 .mz-feat-photos{grid-template-rows:1fr 1fr}
.mz-feat-p3 .mz-feat-photos,.mz-feat-p4 .mz-feat-photos{grid-template-columns:1.6fr 1fr}
.mz-feat-p3 .mz-feat-photos .mz-photo:first-child{grid-row:1/3}
.mz-feat-p4 .mz-feat-photos .mz-photo:first-child{grid-row:1/4}
.mz-feat-text{display:flex;flex-direction:column;justify-content:center;min-width:0;border-inline-start:0.6mm solid #C6AA76;padding-inline-start:5mm}
.mz-feat-flip .mz-feat-text{border-inline-start:0;border-inline-end:0.6mm solid #C6AA76;padding-inline-start:0;padding-inline-end:5mm}
.mz-feat-no{align-self:flex-start;font-size:3mm;font-weight:800;color:#fff;background:#00676a;border-radius:2mm;padding:0.6mm 2.5mm}
.mz-feat h3{font-size:5.2mm;line-height:1.4;font-weight:800;color:#0b3f42;margin:2.5mm 0 1.5mm}
.mz-feat-meta{font-size:3.1mm;color:#8a6d3a;font-weight:700;margin:0}
.mz-feat-who{font-size:3.3mm;color:#00676a;font-weight:800;margin:1mm 0 0}
.mz-feat-desc{font-size:3.4mm;line-height:1.85;color:#3e5b5c;margin:2.5mm 0 0;text-align:justify;display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden}

/* الجلسات */
.mz-timeline{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4mm;position:relative}
.mz-timeline:before{content:"";position:absolute;inset-block:2mm;inset-inline-start:27mm;width:0.5mm;background:#e6d9bd}
.mz-timeline li{display:grid;grid-template-columns:24mm 1fr;gap:7mm;position:relative}
.mz-timeline li:after{content:"";position:absolute;inset-inline-start:25.6mm;top:2mm;width:3.2mm;height:3.2mm;border-radius:50%;background:#C6AA76;border:0.8mm solid #fcfaf5}
.mz-tl-date{font-size:3.6mm;font-weight:800;color:#00676a;text-align:center;line-height:1.4}
.mz-tl-date small{display:block;font-size:2.9mm;color:#8a6d3a;font-weight:700}
.mz-tl-body h3{font-size:4.2mm;font-weight:800;color:#0b3f42;margin:0}
.mz-tl-who{font-size:3.2mm;color:#8a6d3a;font-weight:700;margin:0.5mm 0 0}
.mz-tl-desc{font-size:3.3mm;line-height:1.8;margin:1mm 0 0;color:#3e5b5c}

/* الختام */
.mz-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(30mm,1fr));gap:4mm;margin:10mm 0}
.mz-stats div,.mz-kpis div{background:#fff;border:0.3mm solid #e6d9bd;border-radius:4mm;padding:5mm 3mm;text-align:center}
.mz-stats b,.mz-kpis b{display:block;font-size:10mm;font-weight:800;color:#00676a;line-height:1.1}
.mz-stats span,.mz-kpis span{font-size:3.2mm;color:#55696a;font-weight:700}
.mz-closing-foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:8mm}
.mz-signoff span{display:block;font-size:3mm;color:#8a6d3a;font-weight:700}
.mz-signoff b{display:block;font-size:5mm;color:#0b3f42}
.mz-signoff small{font-size:3mm;color:#55696a}
.mz-qr{text-align:center;font-size:2.9mm;color:#55696a;font-weight:700}
.mz-qr div{width:30mm;height:30mm;background:#fff;padding:1.5mm;border-radius:2mm;border:0.3mm solid #e6d9bd;margin-bottom:1.5mm}
.mz-qr svg{width:100%;height:100%}

/* الغلاف الخلفي والفاصل */
.mz-back,.mz-divider{background:linear-gradient(160deg,#0b3f42,#0a4d50 60%,#0b3f5c);color:#e6d9bd;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:5mm}
.mz-back-star{width:170mm;height:170mm;right:-60mm;bottom:-55mm;opacity:.12}
.mz-back-logo{height:42mm;width:auto;margin-bottom:4mm;position:relative}
.mz-back .mz-back-sub{font-size:4.4mm;font-weight:800;color:#fff;margin:2mm 0 0;position:relative}
.mz-back .mz-back-web{font-size:3.6mm;letter-spacing:1mm;color:#C6AA76;margin:0;position:relative}
.mz-divider-logo{height:24mm;width:auto;margin-bottom:6mm;position:relative}
.mz-divider h2{font-size:16mm;font-weight:800;color:#fff;margin:0;position:relative}
.mz-divider p{font-size:4.2mm;max-width:140mm;line-height:1.9;color:#f1ecdf;margin:2mm 0;position:relative}

/* التقرير */
.mz-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-bottom:6mm}
.mz-kpis b{font-size:8.5mm}
.mz-info{width:100%;border-collapse:collapse;font-size:3.5mm}
.mz-info th{width:38mm;text-align:start;background:#f3ede0;color:#0b3f42;font-weight:800;padding:2.5mm 3mm;border:0.3mm solid #e6d9bd}
.mz-info td{padding:2.5mm 3mm;border:0.3mm solid #e6d9bd;background:#fff}
.mz-summary{background:#fff;border-inline-start:1mm solid #C6AA76;border-radius:2mm;padding:4mm 5mm}
.mz-res{display:flex;align-items:center;gap:9mm;background:#fff;border:0.3mm solid #e6d9bd;border-radius:5mm;padding:7mm}
.mz-res-ring{width:46mm;height:46mm;border-radius:50%;display:grid;place-items:center;flex:none}
.mz-res-ring span{width:36mm;height:36mm;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}
.mz-res-ring b{font-size:11mm;color:#00676a;line-height:1}
.mz-res-ring small{font-size:2.9mm;color:#55696a;font-weight:700;margin-top:1mm}
.mz-bands{flex:1;display:flex;flex-direction:column;gap:3mm}
.mz-band{display:grid;grid-template-columns:24mm 1fr 9mm;align-items:center;gap:3mm;font-size:3.3mm}
.mz-band-l{font-weight:800;color:#0b3f42;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mz-band-bar{height:4.5mm;background:#f3ede0;border-radius:2mm;overflow:hidden}
.mz-band-bar i{display:block;height:100%;border-radius:2mm;background:#00676a}
.mz-band b{color:#0b3f42;text-align:center}
.mz-band-ent{grid-template-columns:36mm 1fr 8mm;margin-bottom:2.5mm}
.mz-band-ent .mz-band-bar i{background:#C6AA76}
.mz-res-grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:6mm}
.mz-res-box{background:#fff;border:0.3mm solid #e6d9bd;border-radius:5mm;padding:2mm 6mm 6mm}
.mz-top{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2.5mm}
.mz-top li{display:flex;align-items:center;gap:3mm;font-size:3.4mm}
.mz-top-n{width:7mm;height:7mm;border-radius:50%;background:#0b3f42;color:#fff;display:grid;place-items:center;font-weight:800;flex:none}
.mz-top li:first-child .mz-top-n{background:#C6AA76;color:#0b3f42}
.mz-top-name{flex:1;font-weight:700;color:#0b3f42;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mz-top b{color:#00676a}
.mz-trainees{width:100%;border-collapse:collapse;font-size:3.3mm}
.mz-trainees th{background:#0b3f42;color:#fff;font-weight:800;padding:2.5mm 2mm;text-align:start}
.mz-trainees td{padding:2mm;border-bottom:0.3mm solid #e6d9bd;background:#fff;vertical-align:middle}
.mz-trainees tr:nth-child(even) td{background:#fbf9f3}
.mz-trainees tr.is-star td{background:#fbf3e3}
.mz-prog-title{font-weight:800;color:#0b3f42}
.mz-grade{display:inline-block;font-size:2.8mm;font-weight:800;border:0.3mm solid;border-radius:1.5mm;padding:0.3mm 1.8mm;white-space:nowrap}
.mz-tr-name{display:flex;align-items:center;gap:2.5mm;font-weight:700;color:#0b3f42}
.mz-tr-name img,.mz-tr-init{width:9mm;height:9mm;border-radius:50%;object-fit:cover;flex:none}
.mz-tr-init{display:grid;place-items:center;background:#e7f0f0;color:#00676a;font-weight:800}
.mz-tr-name i{color:#C6AA76;font-style:normal}
.mz-tr-score{font-weight:800;color:#00676a;text-align:center;font-size:3.8mm}
.mz-tr-note{font-size:3mm;color:#3e5b5c;line-height:1.6}
.mz-stars{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.mz-star-card{background:#fff;border:0.3mm solid #e6d9bd;border-radius:4mm;padding:5mm 3.5mm;text-align:center;position:relative;box-shadow:0 1mm 4mm rgba(11,63,66,.06)}
.mz-star-card img,.mz-tr-init-lg{width:24mm;height:24mm;border-radius:50%;object-fit:cover;margin:0 auto 3mm;border:0.8mm solid #C6AA76;font-size:8mm}
.mz-star-card b{display:block;font-size:3.9mm;color:#0b3f42}
.mz-star-card small{display:block;font-size:3mm;color:#8a6d3a;font-weight:700}
.mz-star-score{display:inline-block;margin-top:2mm;background:#00676a;color:#fff;font-weight:800;border-radius:3mm;padding:0.6mm 3mm;font-size:3.6mm}
.mz-star-card p{font-size:3mm;line-height:1.7;margin:2mm 0 0;color:#3e5b5c}
.mz-recs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3.5mm}
.mz-recs li{display:flex;gap:4mm;align-items:flex-start;background:#fff;border:0.3mm solid #e6d9bd;border-radius:3.5mm;padding:3.5mm 4.5mm}
.mz-rec-n{width:8mm;height:8mm;border-radius:2mm;background:#0b3f42;color:#C6AA76;font-weight:800;display:grid;place-items:center;flex:none;font-size:3.8mm}
.mz-recs p{margin:0;font-size:3.8mm;line-height:1.85;color:#17393b}
.mz-report-end{margin-top:auto;text-align:center;font-size:3.1mm;color:#8a6d3a;font-weight:700;border-top:0.3mm solid #e6d9bd;padding-top:3mm}

/* ═════ المقاس المربع ٢١٠×٢١٠ ═════ */
.mz-fmt-sq .mz-page{height:210mm}
.mz-fmt-sq .mz-body{inset:25mm 16mm 18mm 16mm}
.mz-fmt-sq .mz-head{height:18mm;padding:0 16mm}
.mz-fmt-sq .mz-head-logo{height:10mm}
.mz-fmt-sq .mz-folio{bottom:6mm}
.mz-fmt-sq .mz-h2{font-size:8mm;margin-bottom:4mm}
.mz-fmt-sq .mz-h2-sm{font-size:6.2mm}
.mz-fmt-sq .mz-intro-title{font-size:7mm}
.mz-fmt-sq .mz-lead{font-size:3.8mm;line-height:1.9}
.mz-fmt-sq .mz-cover-body{bottom:24mm;inset-inline:16mm}
.mz-fmt-sq .mz-cover h1{font-size:11mm}
.mz-fmt-sq .mz-cover-top{top:11mm;inset-inline:14mm}
.mz-fmt-sq .mz-cover-logo{height:24mm}
.mz-fmt-sq .mz-cover-foot{bottom:9mm;inset-inline:16mm}
.mz-fmt-sq .mz-partners span{height:12mm}
.mz-fmt-sq .mz-partners img{max-height:9mm}
.mz-fmt-sq .mz-card{width:54mm;padding:5mm 4.5mm}
.mz-fmt-sq .mz-card dl{gap:2.6mm}
.mz-fmt-sq .mz-coord img,.mz-fmt-sq .mz-coord-init{width:12mm;height:12mm}
.mz-fmt-sq .mz-welcome-body{inset:18mm 22mm}
.mz-fmt-sq .mz-welcome-logo{height:20mm;margin-bottom:3mm}
.mz-fmt-sq .mz-welcome-text{font-size:4.3mm;line-height:1.95;margin-bottom:3mm}
.mz-fmt-sq .mz-welcome-star{width:150mm;height:150mm;top:30mm;left:30mm}
.mz-fmt-sq .mz-timeline{gap:3mm}
.mz-fmt-sq .mz-feat,.mz-fmt-sq .mz-feat-flip{grid-template-columns:none;grid-template-rows:1.5fr auto;gap:4mm}
.mz-fmt-sq .mz-feat-tall{grid-template-columns:1fr 1fr;grid-template-rows:none}
.mz-fmt-sq .mz-feat-flip .mz-feat-photos{order:0}
.mz-fmt-sq .mz-feat-p2 .mz-feat-photos{grid-template-rows:none;grid-template-columns:1fr 1fr}
.mz-fmt-sq .mz-feat-text,.mz-fmt-sq .mz-feat-flip .mz-feat-text{border:0;border-top:0.6mm solid #C6AA76;padding:3mm 0 0}
.mz-fmt-sq .mz-feat-tall .mz-feat-text{border-top:0;border-inline-start:0.6mm solid #C6AA76;padding:0 4mm 0 0}
.mz-fmt-sq .mz-feat-desc{-webkit-line-clamp:4}
.mz-fmt-sq .mz-stats{margin:6mm 0}
.mz-fmt-sq .mz-stats b{font-size:8mm}
.mz-fmt-sq .mz-qr div{width:25mm;height:25mm}
.mz-fmt-sq .mz-signoff b{font-size:4.4mm}
.mz-fmt-sq .mz-kpis{gap:3mm;margin-bottom:4mm}
.mz-fmt-sq .mz-kpis div{padding:3mm 2mm}
.mz-fmt-sq .mz-kpis b{font-size:7mm}
.mz-fmt-sq .mz-info{font-size:3.2mm}
.mz-fmt-sq .mz-info th,.mz-fmt-sq .mz-info td{padding:1.8mm 2.5mm}
.mz-fmt-sq .mz-res{padding:4mm;gap:6mm}
.mz-fmt-sq .mz-res-ring{width:36mm;height:36mm}
.mz-fmt-sq .mz-res-ring span{width:28mm;height:28mm}
.mz-fmt-sq .mz-res-ring b{font-size:8mm}
.mz-fmt-sq .mz-bands{gap:2mm}
.mz-fmt-sq .mz-res-grid{margin-top:4mm;gap:4mm}
.mz-fmt-sq .mz-res-box{padding:0 4mm 3mm}
.mz-fmt-sq .mz-top{gap:1.5mm}
.mz-fmt-sq .mz-band-ent{margin-bottom:1.5mm}
.mz-fmt-sq .mz-recs{gap:2.5mm}
.mz-fmt-sq .mz-recs li{padding:2.5mm 3.5mm}
.mz-fmt-sq .mz-recs p{font-size:3.4mm;line-height:1.7}
.mz-fmt-sq .mz-back-logo{height:32mm}
.mz-fmt-sq .mz-divider h2{font-size:13mm}
`;
