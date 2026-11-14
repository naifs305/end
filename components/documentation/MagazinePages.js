// ======================================================================
// صفحات المجلة والتقرير الفني — بمقاس A4 تماماً
// ----------------------------------------------------------------------
// صفحة واحدة تخدم ثلاثة: التصفّح بالتقليب على الشاشة، والعرض المتتابع
// على الجوال، والطباعة (ونسخة المطبعة بهوامش القصّ). فما يراه المنسق
// هو بعينه ما يخرج من المطبعة.
//
// الصياغة عربية أكاديمية بنَفَس مؤسسي سعودي، وما يكتبه المنسق يُعرض
// نصاً (React يهرّبه) فلا يُنفَّذ منه شيء.
// ======================================================================

const fmtDate = (v, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory-nu-arab', opts) : '');
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
  return d > 0 ? d : null;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const LOGO = '/nauss-logo.png';

// ── أجزاء متكررة ─────────────────────────────────────────────
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
      <img src={m.fullUrl} alt={m.caption || 'صورة من الدورة'} />
      {showCaption && m.caption && <figcaption>{m.caption}</figcaption>}
    </figure>
  );
}

// ── الغلاف ────────────────────────────────────────────────────
function Cover({ course, cover, edition }) {
  const kicker = edition === 'report' ? 'التقرير الفني' : 'إصدار توثيقي';
  return (
    <section className="mz-page mz-cover">
      {cover && <img className="mz-cover-img" src={cover.fullUrl} alt="" />}
      <div className="mz-cover-veil" />
      <div className="mz-cover-top">
        <img src={LOGO} alt="جامعة نايف العربية للعلوم الأمنية" className="mz-logo-white" />
        <span>وكالة الجامعة للتدريب</span>
      </div>
      <div className="mz-cover-body">
        <span className="mz-kicker-light">{kicker} · برنامج تدريبي</span>
        <h1>{course.name}</h1>
        <div className="mz-gold-rule" />
        <p className="mz-cover-meta">
          {course.city ? `${course.city} · ` : ''}{fmtDate(course.startDate)} – {fmtDate(course.endDate)}
        </p>
      </div>
      <div className="mz-cover-foot">
        <span>جامعة نايف العربية للعلوم الأمنية</span>
        <span>{toAr(new Date(course.endDate || Date.now()).getFullYear())}</span>
      </div>
    </section>
  );
}

// ── التقديم ───────────────────────────────────────────────────
function Intro({ course, doc, photo, page }) {
  const days = daysBetween(course.startDate, course.endDate);
  const c = course.coordinator;
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="تقديم" />
      <div className="mz-body">
        <span className="mz-kicker">عن البرنامج</span>
        <h2 className="mz-h2">تقديم</h2>
        <div className="mz-intro-grid">
          <p className="mz-lead">
            {doc.intro || `انطلاقاً من رسالة جامعة نايف العربية للعلوم الأمنية في بناء القدرات الأمنية العربية، نفّذت وكالة الجامعة للتدريب برنامج «${course.name}».`}
          </p>
          <aside className="mz-facts">
            <div><b>الفترة</b><span>{fmtDate(course.startDate)}<br />إلى {fmtDate(course.endDate)}</span></div>
            {days && <div><b>المدة</b><span>{toAr(days)} {days > 10 ? 'يوماً' : days > 2 ? 'أيام' : days === 2 ? 'يومان' : 'يوم'}</span></div>}
            {course.city && <div><b>مكان الانعقاد</b><span>{course.city}</span></div>}
            {course.numTrainees ? <div><b>المشاركون</b><span>{toAr(course.numTrainees)} متدرباً</span></div> : null}
            {c && (
              <div className="mz-coord">
                <b>منسق البرنامج</b>
                <span className="mz-coord-row">
                  {c.profileImage && <img src={c.profileImage} alt="" />}
                  {c.firstName} {c.lastName}
                </span>
              </div>
            )}
          </aside>
        </div>
        {photo && <Photo m={photo} className="mz-intro-photo" />}
      </div>
      <Folio n={page} />
    </section>
  );
}

// ── برنامج الدورة (الجلسات) ──────────────────────────────────
function Sessions({ course, sessions, page, part }) {
  return (
    <section className="mz-page mz-inner">
      <RunningHead course={course} label="برنامج الدورة" />
      <div className="mz-body">
        <span className="mz-kicker">الجلسات التدريبية</span>
        <h2 className="mz-h2">برنامج الدورة{part > 1 ? ` (${toAr(part)})` : ''}</h2>
        <ol className="mz-timeline">
          {sessions.map((s) => (
            <li key={s.id || s.title}>
              <div className="mz-tl-date">
                {s.date ? fmtDate(s.date, { day: 'numeric', month: 'short' }) : '—'}
                {s.time && <small>{s.time}</small>}
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

// ── المعرض: ثلاثة تصاميم تتناوب ─────────────────────────────
const GALLERY_TITLES = ['من أجواء الدورة', 'لقطات من الجلسات', 'مشاهد من البرنامج', 'محطات من الدورة'];

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
function BackCover() {
  return (
    <section className="mz-page mz-back">
      <div className="mz-back-ring" />
      <img src={LOGO} alt="جامعة نايف العربية للعلوم الأمنية" className="mz-logo-white mz-back-logo" />
      <p>جامعة نايف العربية للعلوم الأمنية</p>
      <p className="mz-back-sub">وكالة الجامعة للتدريب — إدارة عمليات التدريب</p>
      <p className="mz-back-web">www.nauss.edu.sa</p>
    </section>
  );
}

// ══════════════════ التقرير الفني ══════════════════
function avg(list) {
  const v = list.filter((x) => Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

function ReportDivider() {
  return (
    <section className="mz-page mz-divider">
      <div className="mz-back-ring" />
      <span className="mz-kicker-light">الجزء الثاني</span>
      <h2>التقرير الفني</h2>
      <div className="mz-gold-rule" />
      <p>ملخص تنفيذ البرنامج ونتائج المتدربين وتوصياته — مُعدّ للقيادات وجهة التدريب</p>
    </section>
  );
}

function Executive({ course, doc, trainees, sessions, photosCount, page }) {
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
      <div className="mz-body">
        <span className="mz-kicker">الملخص التنفيذي</span>
        <h2 className="mz-h2">نتائج البرنامج في سطور</h2>
        <div className="mz-kpis">
          {kpis.map((k) => <div key={k.label}><b>{toAr(k.value)}</b><span>{k.label}</span></div>)}
        </div>
        <table className="mz-info">
          <tbody>
            <tr><th>البرنامج</th><td>{course.name}</td></tr>
            <tr><th>الفترة</th><td>{fmtDate(course.startDate)} – {fmtDate(course.endDate)}{days ? ` (${toAr(days)} أيام)` : ''}</td></tr>
            {course.city && <tr><th>مكان الانعقاد</th><td>{course.city}</td></tr>}
            {course.coordinator && <tr><th>منسق البرنامج</th><td>{course.coordinator.firstName} {course.coordinator.lastName}</td></tr>}
            <tr><th>التوثيق المصوّر</th><td>{toAr(photosCount)} صورة</td></tr>
          </tbody>
        </table>
        <h3 className="mz-h3">ملخص التنفيذ</h3>
        <p className="mz-text">
          {doc.reportSummary || `نُفّذ البرنامج وفق الخطة المعتمدة، وحقّق أهدافه التدريبية بمشاركة ${toAr(trainees.length || course.numTrainees || 0)} متدرباً، وقد اتسمت الجلسات بالتفاعل والتطبيق العملي.`}
        </p>
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
          <thead><tr><th>م</th><th>المتدرب</th><th>الجهة</th><th>الدرجة</th><th>ملاحظة التميّز</th></tr></thead>
          <tbody>
            {trainees.map((t, i) => (
              <tr key={t.id || `${t.name}-${i}`} className={t.isDistinguished ? 'is-star' : ''}>
                <td>{toAr(startIndex + i + 1)}</td>
                <td className="mz-tr-name">
                  {t.photoUrl ? <img src={t.photoUrl} alt="" /> : <span className="mz-tr-init">{t.name?.trim()?.[0] || '؟'}</span>}
                  <span>{t.name}{t.isDistinguished && <i> ★</i>}</span>
                </td>
                <td>{t.entity || '—'}</td>
                <td className="mz-tr-score">{Number.isFinite(t.score) ? toAr(t.score) : '—'}</td>
                <td className="mz-tr-note">{t.distinction || ''}</td>
              </tr>
            ))}
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
  const c = course.coordinator;
  const lines = String(doc.recommendations || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return (
    <section className="mz-page mz-inner mz-report">
      <RunningHead course={course} label="التقرير الفني" />
      <div className="mz-body">
        <span className="mz-kicker">التوصيات</span>
        <h2 className="mz-h2">التوصيات والمقترحات</h2>
        {lines.length ? (
          <ol className="mz-recs">{lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
        ) : (
          <p className="mz-text">لا توصيات مدوّنة لهذا البرنامج.</p>
        )}
        {c && (
          <div className="mz-report-sign">
            <span>منسق البرنامج</span>
            {c.signatureImage && <img src={c.signatureImage} alt="" />}
            <b>{c.firstName} {c.lastName}</b>
          </div>
        )}
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
  const media = doc.media || [];
  const sessions = doc.sessions || [];
  const trainees = doc.trainees || [];
  const cover = media.find((m) => m.id === doc.coverMediaId) || media[0] || null;
  const rest = media.filter((m) => m.id !== cover?.id);

  const pages = [];
  let n = 1;
  const push = (key, render) => { pages.push({ key, node: render(n) }); n += 1; };

  const withMagazine = edition !== 'report';
  const withReport = edition !== 'magazine';

  push('cover', () => <Cover course={course} cover={cover} edition={edition} />);

  if (withMagazine) {
    const introPhoto = rest[0] || null;
    const gallery = introPhoto ? rest.slice(1) : rest;
    push('intro', (p) => <Intro course={course} doc={doc} photo={introPhoto} page={p} />);
    chunk(sessions, 7).forEach((part, i) => push(`sessions-${i}`, (p) => <Sessions course={course} sessions={part} page={p} part={i + 1} />));

    // المعرض: أنماط تتناوب — بطل وصورتان، ثم شبكة أربع، ثم عمود وصورتان
    const layouts = [{ k: 'hero', size: 3 }, { k: 'grid', size: 4 }, { k: 'side', size: 3 }];
    let i = 0; let g = 0;
    while (i < gallery.length) {
      const l = layouts[g % layouts.length];
      const part = gallery.slice(i, i + l.size);
      const layout = part.length < l.size ? (part.length === 1 ? 'single' : part.length === 2 ? 'pair' : l.k) : l.k;
      const gi = g;
      push(`gal-${g}`, (p) => <Gallery course={course} photos={part} layout={layout} page={p} index={gi} />);
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
    if (withMagazine) push('report-divider', () => <ReportDivider />);
    push('executive', (p) => <Executive course={course} doc={doc} trainees={trainees} sessions={sessions} photosCount={media.length} page={p} />);
    // توزيع متوازن على الصفحات (١٥ متدرباً = ٨ + ٧، لا ١٢ + ٣)
    const perPage = trainees.length ? Math.ceil(trainees.length / Math.ceil(trainees.length / 12)) : 12;
    chunk(trainees, perPage).forEach((part, i) => push(`trainees-${i}`, (p) => <TraineesTable course={course} trainees={part} page={p} part={i + 1} startIndex={i * perPage} />));
    const stars = trainees.filter((t) => t.isDistinguished);
    chunk(stars, 6).forEach((part, i) => push(`stars-${i}`, (p) => <Distinguished course={course} list={part} page={p} />));
    push('recs', (p) => <Recommendations course={course} doc={doc} page={p} />);
  }

  push('back', () => <BackCover />);
  return pages;
}

// ── الأنماط: صفحة A4 حقيقية، تُصغَّر على الشاشة وتُطبع بمقاسها ──
export const MAGAZINE_CSS = `
.mz-page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fcfaf5;color:#17393b;
  font-family:'Cairo','Boutros Jazirah Text',Tahoma,sans-serif;direction:rtl;box-sizing:border-box}
.mz-page *{box-sizing:border-box}
.mz-page img{display:block}
.mz-inner{padding:0}
.mz-body{position:absolute;inset:30mm 18mm 22mm 18mm;display:flex;flex-direction:column}
.mz-head{position:absolute;top:0;inset-inline:0;height:20mm;display:flex;align-items:center;gap:4mm;padding:0 18mm;
  border-bottom:0.4mm solid #C6AA76;background:linear-gradient(180deg,#ffffff,#fcfaf5)}
.mz-head-logo{height:9mm;width:auto}
.mz-head-label{font-weight:800;color:#00676a;font-size:3.4mm}
.mz-head-course{margin-inline-start:auto;font-size:3mm;color:#55696a;max-width:95mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mz-folio{position:absolute;bottom:8mm;inset-inline:0;display:flex;justify-content:center}
.mz-folio span{font-weight:800;font-size:3.4mm;color:#8a6d3a;border-top:0.4mm solid #C6AA76;padding-top:1.2mm;min-width:12mm;text-align:center}
.mz-kicker{font-size:3.2mm;font-weight:800;color:#8a6d3a;letter-spacing:.2mm}
.mz-h2{font-size:9.5mm;line-height:1.25;font-weight:800;color:#0b3f42;margin:1mm 0 6mm}
.mz-h2-sm{font-size:7mm;margin-bottom:5mm}
.mz-h3{font-size:4.6mm;font-weight:800;color:#0b3f42;margin:6mm 0 2mm}
.mz-lead{font-size:4.3mm;line-height:2;text-align:justify;margin:0;white-space:pre-line}
.mz-text{font-size:3.8mm;line-height:1.95;text-align:justify;margin:0;white-space:pre-line}

/* الغلاف */
.mz-cover{background:#0b3f42;color:#fff}
.mz-cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mz-cover-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,63,66,.55) 0%,rgba(11,63,66,.05) 30%,rgba(11,63,66,.15) 52%,rgba(7,45,48,.92) 82%,#0b3f42 100%)}
.mz-cover-top{position:absolute;top:16mm;inset-inline:18mm;display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:3.6mm}
.mz-logo-white{height:16mm;width:auto;filter:brightness(0) invert(1)}
.mz-cover-body{position:absolute;bottom:34mm;inset-inline:18mm}
.mz-kicker-light{font-size:3.6mm;font-weight:800;color:#e6d9bd;letter-spacing:.3mm}
.mz-cover h1{font-size:14mm;line-height:1.2;font-weight:800;margin:3mm 0 4mm;color:#fff;text-shadow:0 1mm 4mm rgba(0,0,0,.25)}
.mz-gold-rule{width:34mm;height:1.2mm;background:#C6AA76;border-radius:1mm}
.mz-cover-meta{font-size:4.2mm;margin:4mm 0 0;color:#f1ecdf}
.mz-cover-foot{position:absolute;bottom:14mm;inset-inline:18mm;display:flex;justify-content:space-between;font-size:3.2mm;color:#e6d9bd;border-top:0.3mm solid rgba(230,217,189,.4);padding-top:3mm}

/* التقديم */
.mz-intro-grid{display:grid;grid-template-columns:1fr 58mm;gap:8mm;align-items:start}
.mz-facts{background:#fff;border:0.3mm solid #e6d9bd;border-radius:4mm;padding:5mm;display:flex;flex-direction:column;gap:3.5mm}
.mz-facts b{display:block;font-size:2.9mm;color:#8a6d3a;font-weight:800}
.mz-facts span{font-size:3.5mm;font-weight:700;color:#0b3f42;line-height:1.6}
.mz-coord-row{display:flex;align-items:center;gap:2.5mm}
.mz-coord-row img{width:9mm;height:9mm;border-radius:50%;object-fit:cover}
.mz-intro-photo{margin-top:auto;height:78mm}

/* الصور */
.mz-photo{position:relative;margin:0;border-radius:3.5mm;overflow:hidden;background:#e9e4d6}
.mz-photo img{width:100%;height:100%;object-fit:cover}
.mz-photo figcaption{position:absolute;inset-inline:0;bottom:0;padding:6mm 4mm 3mm;font-size:3.1mm;font-weight:700;color:#fff;
  background:linear-gradient(0deg,rgba(7,45,48,.85),transparent)}
.mz-gal{flex:1;display:grid;gap:4mm;min-height:0}
.mz-gal-hero{grid-template-columns:1fr 1fr;grid-template-rows:1.5fr 1fr}
.mz-gal-hero .mz-photo:first-child{grid-column:1/-1}
.mz-gal-grid{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.mz-gal-side{grid-template-columns:1.25fr 1fr;grid-template-rows:1fr 1fr}
.mz-gal-side .mz-photo:first-child{grid-row:1/-1}
.mz-gal-pair{grid-template-rows:1fr 1fr}
.mz-gal-single{grid-template-rows:1fr}

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
.mz-back,.mz-divider{background:linear-gradient(160deg,#0b3f42,#0a4d50 60%,#0b3f5c);color:#e6d9bd;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.mz-back p{margin:1.5mm 0;font-weight:800;font-size:5mm;color:#fff}
.mz-back .mz-back-sub{font-size:3.8mm;font-weight:700;color:#e6d9bd}
.mz-back .mz-back-web{font-size:3.6mm;letter-spacing:1mm;color:#C6AA76;margin-top:8mm}
.mz-back-logo{height:28mm;margin-bottom:8mm}
.mz-back-ring{position:absolute;width:150mm;height:150mm;border-radius:50%;border:6mm solid rgba(198,170,118,.12);inset-inline-end:-45mm;bottom:-45mm}
.mz-divider h2{font-size:16mm;font-weight:800;color:#fff;margin:3mm 0 5mm}
.mz-divider p{font-size:4.2mm;max-width:140mm;line-height:1.9;color:#f1ecdf;margin-top:6mm}

/* التقرير */
.mz-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-bottom:6mm}
.mz-kpis b{font-size:8.5mm}
.mz-info{width:100%;border-collapse:collapse;font-size:3.5mm}
.mz-info th{width:38mm;text-align:start;background:#f3ede0;color:#0b3f42;font-weight:800;padding:2.5mm 3mm;border:0.3mm solid #e6d9bd}
.mz-info td{padding:2.5mm 3mm;border:0.3mm solid #e6d9bd;background:#fff}
.mz-trainees{width:100%;border-collapse:collapse;font-size:3.3mm}
.mz-trainees th{background:#0b3f42;color:#fff;font-weight:800;padding:2.5mm 2mm;text-align:start}
.mz-trainees td{padding:2mm;border-bottom:0.3mm solid #e6d9bd;background:#fff;vertical-align:middle}
.mz-trainees tr.is-star td{background:#fbf5e8}
.mz-tr-name{display:flex;align-items:center;gap:2.5mm;font-weight:700;color:#0b3f42}
.mz-tr-name img,.mz-tr-init{width:9mm;height:9mm;border-radius:50%;object-fit:cover;flex:none}
.mz-tr-init{display:grid;place-items:center;background:#e7f0f0;color:#00676a;font-weight:800}
.mz-tr-name i{color:#C6AA76;font-style:normal}
.mz-tr-score{font-weight:800;color:#00676a;text-align:center;font-size:3.8mm}
.mz-tr-note{font-size:3mm;color:#3e5b5c;line-height:1.6}
.mz-stars{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.mz-star-card{background:#fff;border:0.3mm solid #e6d9bd;border-radius:4mm;padding:5mm 3.5mm;text-align:center;position:relative}
.mz-star-card img,.mz-tr-init-lg{width:24mm;height:24mm;border-radius:50%;object-fit:cover;margin:0 auto 3mm;border:0.8mm solid #C6AA76;font-size:8mm}
.mz-star-card b{display:block;font-size:3.9mm;color:#0b3f42}
.mz-star-card small{display:block;font-size:3mm;color:#8a6d3a;font-weight:700}
.mz-star-score{display:inline-block;margin-top:2mm;background:#00676a;color:#fff;font-weight:800;border-radius:3mm;padding:0.6mm 3mm;font-size:3.6mm}
.mz-star-card p{font-size:3mm;line-height:1.7;margin:2mm 0 0;color:#3e5b5c}
.mz-recs{margin:0;padding-inline-start:7mm;font-size:3.9mm;line-height:2;list-style:arabic-indic}
.mz-recs li::marker{color:#8a6d3a;font-weight:800}
.mz-recs li{margin-bottom:2mm}
.mz-report-sign{margin-top:auto;align-self:flex-end;text-align:center;width:60mm}
.mz-report-sign span{display:block;font-size:3.3mm;font-weight:800;color:#0b3f42}
.mz-report-sign img{max-height:20mm;max-width:55mm;margin:2mm auto;object-fit:contain}
.mz-report-sign b{display:block;font-size:3.6mm}
`;
