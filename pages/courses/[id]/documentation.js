// ======================================================================
// مساحة توثيق الدورة — عنصر التميّز
// ----------------------------------------------------------------------
// اختياري: من يوثّق دورته وينشرها بالحد الأدنى من الجودة ينال نجمة
// تميّز ودرجات إضافية، ومن لا يوثّق لا يُخصم عليه شيء.
// بيانات الدورة تُقرأ من المنصة نفسها، فلا تُدخل مرتين.
// ======================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  Star, ImagePlus, Trash2, ArrowRight, ArrowLeft, Check, Circle, Save, Plus, X,
  CalendarDays, MapPin, Users, Send, EyeOff, Image as ImageIcon, ListOrdered, BookOpenText,
  GraduationCap, ClipboardPaste, Camera, BookOpen, FileBarChart2, Layers, Link2, Copy, ExternalLink, QrCode,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import Avatar from '../../../components/shared/Avatar';
import api from '../../../lib/axios';
import { isAcceptableImageFile, fileToDocumentationPhoto, fileToAvatarDataUrl } from '../../../lib/clientImage';

const unwrap = (res) => res?.data?.data ?? res?.data;
const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');

const PANEL = 'overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_1px_2px_rgba(28,46,48,0.05),0_10px_28px_-16px_rgba(28,46,48,0.22)]';

function SectionHead({ icon: Icon, title, hint, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4">
      <Icon size={18} aria-hidden="true" className="text-primary" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-extrabold text-text-main">{title}</h2>
        {hint && <p className="text-[12px] text-text-soft">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function CourseDocumentationPage() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState({ total: 0, done: 0 });
  const [intro, setIntro] = useState('');
  const [closing, setClosing] = useState('');
  const [sessions, setSessions] = useState([]);
  const [reportSummary, setReportSummary] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [trainees, setTrainees] = useState([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [qrSvg, setQrSvg] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = unwrap(await api.get(`/courses/${id}/documentation`));
      setData(d);
      setIntro(d.documentation?.intro || '');
      setClosing(d.documentation?.closing || '');
      setSessions((d.documentation?.sessions || []).map((s) => ({ ...s, date: toDateInput(s.date) })));
      setReportSummary(d.documentation?.reportSummary || '');
      setRecommendations(d.documentation?.recommendations || '');
      setTrainees((d.documentation?.trainees || []).map((t) => ({ ...t, score: t.score ?? '' })));
      setDirty(false);
      if (d.documentation?.status === 'PUBLISHED') {
        api.get(`/courses/${id}/documentation/qr`, { responseType: 'text' })
          .then((r) => setQrSvg(typeof r.data === 'string' ? r.data : null)).catch(() => setQrSvg(null));
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر تحميل التوثيق');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doc = data?.documentation;
  const media = doc?.media || [];
  const editable = !!data?.canEdit;
  const published = doc?.status === 'PUBLISHED';

  // معاينة المعايير مباشرة بما في الصفحة (قبل الحفظ)
  const liveChecks = useMemo(() => {
    if (!data) return [];
    const c = data.criteria;
    return [
      { key: 'photos', label: `${c.minPhotos} صور على الأقل`, done: media.length >= c.minPhotos, note: `${media.length} من ${c.minPhotos}` },
      { key: 'cover', label: 'صورة غلاف مختارة', done: !!doc?.coverMediaId && media.some((m) => m.id === doc.coverMediaId) },
      { key: 'intro', label: 'مقدمة تعرّف بالدورة', done: intro.trim().length >= c.minIntroChars, note: `${intro.trim().length} من ${c.minIntroChars} حرفاً` },
    ];
  }, [data, media, doc, intro]);
  const readyCount = liveChecks.filter((c) => c.done).length;
  const ready = liveChecks.length > 0 && readyCount === liveChecks.length;

  // ── رفع الصور: تُضغط في المتصفح واحدة واحدة ──
  const onFiles = async (files) => {
    const list = [...(files || [])].filter(isAcceptableImageFile);
    if (!list.length) return;
    setUploads({ total: list.length, done: 0 });
    for (const f of list) {
      try {
        const photo = await fileToDocumentationPhoto(f);
        await api.post(`/courses/${id}/documentation/media`, photo);
      } catch (e) {
        toast.error(e.response?.data?.message || `تعذّر رفع ${f.name}`);
      }
      setUploads((u) => ({ ...u, done: u.done + 1 }));
    }
    setUploads({ total: 0, done: 0 });
    await load();
  };

  const setCover = async (mid) => {
    try { await api.patch(`/documentation/media/${mid}`, { cover: true }); await load(); } catch { toast.error('تعذّر اختيار الغلاف'); }
  };
  const saveCaption = async (mid, caption) => {
    try { await api.patch(`/documentation/media/${mid}`, { caption }); } catch { toast.error('تعذّر حفظ التعليق'); }
  };
  const removePhoto = async (mid) => {
    try { await api.delete(`/documentation/media/${mid}`); await load(); } catch { toast.error('تعذّر حذف الصورة'); }
  };
  const move = async (index, dir) => {
    const ids = media.map((m) => m.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setData((d) => ({ ...d, documentation: { ...d.documentation, media: ids.map((x) => media.find((m) => m.id === x)) } }));
    try { await api.put(`/courses/${id}/documentation`, { order: ids }); } catch { toast.error('تعذّر حفظ الترتيب'); load(); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const d = unwrap(await api.put(`/courses/${id}/documentation`, { intro, closing, sessions, reportSummary, recommendations, trainees }));
      setData(d);
      setDirty(false);
      toast.success('حُفظ التوثيق');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (on) => {
    setPublishing(true);
    try {
      if (on && dirty) await api.put(`/courses/${id}/documentation`, { intro, closing, sessions, reportSummary, recommendations, trainees });
      const d = unwrap(await api.post(`/courses/${id}/documentation/publish`, { publish: on }));
      setData(d);
      setDirty(false);
      toast.success(on ? '★ نُشر التوثيق ونلت نجمة التميّز' : 'أُلغي النشر');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر تنفيذ الطلب');
    } finally {
      setPublishing(false);
    }
  };

  const setSession = (i, k, v) => { setSessions((list) => list.map((s, x) => (x === i ? { ...s, [k]: v } : s))); setDirty(true); };
  const setTrainee = (i, k, v) => { setTrainees((list) => list.map((t, x) => (x === i ? { ...t, [k]: v } : t))); setDirty(true); };

  // صورة المتدرب: مربعة مصغّرة، تُرفع فوراً ويُحفظ مفتاحها مع القائمة
  const uploadTraineePhoto = async (i, file) => {
    if (!file || !isAcceptableImageFile(file)) return;
    try {
      const photo = await fileToAvatarDataUrl(file, 400);
      const r = unwrap(await api.post(`/courses/${id}/documentation/trainee-photo`, { photo }));
      setTrainees((list) => list.map((t, x) => (x === i ? { ...t, photoKey: r.photoKey, photoUrl: r.photoUrl } : t)));
      setDirty(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر رفع الصورة');
    }
  };

  // لصق من Excel: كل سطر «الاسم ⇥ الجهة ⇥ الدرجة» (والعمودان الأخيران اختياريان)
  const applyPaste = () => {
    const rows = pasteText.split(/\r?\n/).map((l) => l.split(/\t|;|،(?=\s*\d)/).map((x) => x.trim())).filter((r) => r[0]);
    const parsed = rows.map((r) => {
      const scoreCell = r.find((x, idx) => idx > 0 && /^[0-9٠-٩]+([.,][0-9٠-٩]+)?$/.test(x));
      const entity = r.slice(1).find((x) => x && x !== scoreCell) || '';
      return { name: r[0], entity, score: scoreCell ? scoreCell.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(',', '.') : '', distinction: '', isDistinguished: false };
    });
    setTrainees((list) => [...list, ...parsed]);
    setPasteText('');
    setPasteOpen(false);
    setDirty(true);
    toast.success(`أُضيف ${parsed.length} متدرباً`);
  };

  // تمييز الثلاثة الأعلى درجةً بضغطة (يبقى للمنسق تعديل الاختيار)
  const markTop = () => {
    const ranked = trainees.map((t, i) => ({ i, s: Number(t.score) })).filter((x) => Number.isFinite(x.s)).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.i);
    setTrainees((list) => list.map((t, i) => ({ ...t, isDistinguished: ranked.includes(i) || t.isDistinguished })));
    setDirty(true);
  };

  const editionUrl = (edition) => `/courses/${id}/documentation/print?edition=${edition}`;
  const publicUrl = typeof window !== 'undefined' && doc?.slug ? `${window.location.origin}/m/${doc.slug}` : '';

  if (loading || !data) {
    return (
      <MainLayout breadcrumb={[{ label: 'الدورات', href: '/courses' }, { label: 'توثيق الدورة' }]}>
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      </MainLayout>
    );
  }

  const { course } = data;

  return (
    <MainLayout breadcrumb={[{ label: 'الدورات', href: '/courses' }, { label: course.name, href: `/courses/${course.id}` }, { label: 'توثيق الدورة' }]}>
      <div className="space-y-5">
        {/* ── الرأس: عنصر التميّز وبيانات الدورة من المنصة ── */}
        <div className={`${PANEL} relative`} style={{ background: 'linear-gradient(135deg,#fffaf0,#ffffff 55%)' }}>
          <div className="flex flex-wrap items-start gap-4 px-5 py-5">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${doc?.starAwarded ? 'bg-accent text-white shadow-[0_8px_18px_-8px_rgba(178,146,90,0.9)]' : 'bg-sand/20 text-warning'}`}>
              <Star size={28} aria-hidden="true" fill={doc?.starAwarded ? 'currentColor' : 'none'} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold text-warning">عنصر التميّز · اختياري</p>
              <h1 className="text-xl font-extrabold leading-snug text-text-main">توثيق دورة «{course.name}»</h1>
              <p className="mt-1 max-w-2xl text-[13px] text-text-soft">
                وثّق دورتك بالصور والجلسات وانشرها، فتنال <b className="text-warning">نجمة تميّز</b> ودرجات إضافية في مؤشرك. ومن لا يوثّق لا يُخصم عليه شيء.
              </p>
            </div>
            <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background">
              <ArrowRight size={15} aria-hidden="true" /> الدورة
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-background/60 px-5 py-3 text-[12.5px] text-text-soft">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" /> {fmt(course.startDate)} ← {fmt(course.endDate)}</span>
            {course.city && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" /> {course.city}</span>}
            {course.numTrainees ? <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden="true" /> {course.numTrainees} متدرباً</span> : null}
            {course.coordinator && (
              <span className="inline-flex items-center gap-1.5"><Avatar user={course.coordinator} size={22} /> {course.coordinator.firstName} {course.coordinator.lastName}</span>
            )}
            <span className="ms-auto text-[11px]">من بيانات الدورة في المنصة — لا تُدخل مرتين</span>
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {/* ── الصور ── */}
            <section className={PANEL} aria-labelledby="h-photos">
              <SectionHead icon={ImageIcon} title={<span id="h-photos">صور الدورة <span className="text-text-soft">({media.length})</span></span>}
                hint="تُضغط في جهازك قبل الرفع. اختر غلافاً بالنجمة، ورتّب بالأسهم، واكتب تعليقاً لكل صورة.">
                {editable && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploads.total > 0}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(46,96,102,0.85)] hover:bg-primary-dark disabled:opacity-60">
                    <ImagePlus size={15} aria-hidden="true" /> إضافة صور
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
                  onChange={(e) => { const f = e.target.files; onFiles(f); e.target.value = ''; }} />
              </SectionHead>

              {uploads.total > 0 && (
                <div className="border-b border-border bg-primary-light/40 px-5 py-2.5 text-[12.5px] font-bold text-primary">
                  جارٍ ضغط الصور ورفعها… {uploads.done} من {uploads.total}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(uploads.done / uploads.total) * 100}%` }} />
                  </div>
                </div>
              )}

              {media.length === 0 ? (
                <button type="button" disabled={!editable} onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (editable) onFiles(e.dataTransfer.files); }}
                  className="m-5 grid w-[calc(100%-2.5rem)] place-items-center rounded-2xl border-2 border-dashed border-border py-14 text-center text-text-soft hover:border-primary/40">
                  <ImagePlus size={30} aria-hidden="true" className="mb-2" />
                  <span className="text-sm font-bold">اسحب الصور هنا أو اضغط لاختيارها</span>
                  <span className="mt-1 text-[12px]">صور الافتتاح، والجلسات، والزيارات، والختام</span>
                </button>
              ) : (
                <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-4"
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (editable) onFiles(e.dataTransfer.files); }}>
                  {media.map((m, i) => {
                    const isCover = doc.coverMediaId === m.id;
                    return (
                      <li key={m.id} className={`group overflow-hidden rounded-2xl border bg-white ${isCover ? 'border-accent shadow-[0_0_0_2px_#C6AA76]' : 'border-border'}`}>
                        <div className="relative aspect-[4/3] bg-background">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.thumbUrl} alt={m.caption || `صورة ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                          {isCover && <span className="absolute start-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-extrabold text-white">الغلاف</span>}
                          {editable && (
                            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                              <button type="button" onClick={() => setCover(m.id)} title="اجعلها الغلاف" aria-label="اجعلها الغلاف" className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-warning"><Star size={15} fill={isCover ? 'currentColor' : 'none'} /></button>
                              <button type="button" onClick={() => move(i, -1)} title="تقديم" aria-label="تقديم" className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-text-main"><ArrowRight size={15} /></button>
                              <button type="button" onClick={() => move(i, 1)} title="تأخير" aria-label="تأخير" className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-text-main"><ArrowLeft size={15} /></button>
                              <button type="button" onClick={() => removePhoto(m.id)} title="حذف" aria-label="حذف الصورة" className="ms-auto grid h-8 w-8 place-items-center rounded-full bg-white/90 text-danger"><Trash2 size={15} /></button>
                            </div>
                          )}
                        </div>
                        <input defaultValue={m.caption || ''} disabled={!editable} placeholder="تعليق على الصورة" aria-label={`تعليق الصورة ${i + 1}`}
                          onBlur={(e) => { if ((e.target.value || '') !== (m.caption || '')) saveCaption(m.id, e.target.value); }}
                          className="w-full border-0 border-t border-border px-2.5 py-2 text-[12px] outline-none focus:bg-primary-light/30 disabled:bg-white" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── المقدمة والخاتمة ── */}
            <section className={PANEL} aria-labelledby="h-texts">
              <SectionHead icon={BookOpenText} title={<span id="h-texts">نص التوثيق</span>} hint="المقدمة تفتتح المجلة والتقرير، والخاتمة تختمهما." />
              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-text-main">المقدمة <span className="font-normal text-text-soft">— عن الدورة وأهدافها وما ميّزها</span></span>
                  <textarea value={intro} disabled={!editable} rows={5} maxLength={3000}
                    onChange={(e) => { setIntro(e.target.value); setDirty(true); }}
                    className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm leading-loose outline-none focus:border-primary" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-text-main">الخاتمة <span className="font-normal text-text-soft">— اختيارية</span></span>
                  <textarea value={closing} disabled={!editable} rows={3} maxLength={3000}
                    onChange={(e) => { setClosing(e.target.value); setDirty(true); }}
                    className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm leading-loose outline-none focus:border-primary" />
                </label>
              </div>
            </section>

            {/* ── الجلسات ── */}
            <section className={PANEL} aria-labelledby="h-sessions">
              <SectionHead icon={ListOrdered} title={<span id="h-sessions">جدول الجلسات <span className="text-text-soft">({sessions.length})</span></span>} hint="اختياري — يظهر في المجلة جدولاً زمنياً للدورة.">
                {editable && (
                  <button type="button" onClick={() => { setSessions((l) => [...l, { title: '', presenter: '', date: '', time: '', description: '' }]); setDirty(true); }}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-primary hover:bg-primary-light">
                    <Plus size={15} aria-hidden="true" /> جلسة
                  </button>
                )}
              </SectionHead>
              <div className="space-y-3 p-4">
                {sessions.length === 0 && <p className="py-4 text-center text-[13px] text-text-soft">لا جلسات بعد.</p>}
                {sessions.map((s, i) => (
                  <div key={i} className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_140px_110px_auto]">
                    <input value={s.title} disabled={!editable} onChange={(e) => setSession(i, 'title', e.target.value)} placeholder="عنوان الجلسة" aria-label="عنوان الجلسة" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={s.presenter || ''} disabled={!editable} onChange={(e) => setSession(i, 'presenter', e.target.value)} placeholder="المقدّم" aria-label="المقدّم" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input type="date" value={s.date || ''} disabled={!editable} onChange={(e) => setSession(i, 'date', e.target.value)} aria-label="التاريخ" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={s.time || ''} disabled={!editable} onChange={(e) => setSession(i, 'time', e.target.value)} placeholder="الوقت" aria-label="الوقت" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    {editable && (
                      <button type="button" onClick={() => { setSessions((l) => l.filter((_, x) => x !== i)); setDirty(true); }} aria-label="حذف الجلسة" className="grid h-10 w-10 place-items-center rounded-full text-danger hover:bg-burgundy/5"><X size={16} /></button>
                    )}
                    <textarea value={s.description || ''} disabled={!editable} onChange={(e) => setSession(i, 'description', e.target.value)} rows={2} placeholder="وصف موجز (اختياري)" aria-label="وصف الجلسة"
                      className="resize-y rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-primary sm:col-span-5" />
                  </div>
                ))}
              </div>
            </section>

            {/* ── التقرير الفني ── */}
            <section className={PANEL} aria-labelledby="h-report">
              <SectionHead icon={FileBarChart2} title={<span id="h-report">التقرير الفني</span>}
                hint="للقيادات وجهة التدريب: يُستخرج من داخل المنصة وحدها، ولا يظهر في المجلة العامة." />
              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-text-main">ملخص التنفيذ <span className="font-normal text-text-soft">— ما تحقق من أهداف البرنامج وأبرز مخرجاته</span></span>
                  <textarea value={reportSummary} disabled={!editable} rows={4} maxLength={4000}
                    onChange={(e) => { setReportSummary(e.target.value); setDirty(true); }}
                    className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm leading-loose outline-none focus:border-primary" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-text-main">التوصيات <span className="font-normal text-text-soft">— توصية في كل سطر</span></span>
                  <textarea value={recommendations} disabled={!editable} rows={4} maxLength={4000}
                    onChange={(e) => { setRecommendations(e.target.value); setDirty(true); }}
                    className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm leading-loose outline-none focus:border-primary" />
                </label>
              </div>
            </section>

            {/* ── المتدربون ── */}
            <section className={PANEL} aria-labelledby="h-trainees">
              <SectionHead icon={GraduationCap} title={<span id="h-trainees">المتدربون ودرجاتهم <span className="text-text-soft">({trainees.length})</span></span>}
                hint="صورهم ودرجاتهم وما تميّزوا به — في التقرير الفني وحده.">
                {editable && (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => setPasteOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-primary">
                      <ClipboardPaste size={15} aria-hidden="true" /> لصق من Excel
                    </button>
                    <button type="button" onClick={markTop} disabled={!trainees.length} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-warning disabled:opacity-40">
                      <Star size={15} aria-hidden="true" /> تمييز الأعلى درجة
                    </button>
                    <button type="button" onClick={() => { setTrainees((l) => [...l, { name: '', entity: '', score: '', distinction: '', isDistinguished: false }]); setDirty(true); }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-primary hover:bg-primary-light">
                      <Plus size={15} aria-hidden="true" /> متدرب
                    </button>
                  </div>
                )}
              </SectionHead>
              {pasteOpen && (
                <div className="border-b border-border bg-primary-light/30 p-4">
                  <p className="mb-2 text-[12px] text-text-soft">انسخ الأعمدة من Excel والصقها هنا: الاسم، ثم الجهة، ثم الدرجة — سطر لكل متدرب.</p>
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} dir="rtl" aria-label="بيانات المتدربين"
                    className="w-full rounded-2xl border border-border bg-white px-3 py-2 font-mono text-[13px] outline-none focus:border-primary" />
                  <div className="mt-2 flex gap-1">
                    <button type="button" onClick={applyPaste} disabled={!pasteText.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"><Check size={14} aria-hidden="true" /> إضافة</button>
                    <button type="button" onClick={() => setPasteOpen(false)} className="rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-white">إلغاء</button>
                  </div>
                </div>
              )}
              <div className="space-y-2 p-4">
                {trainees.length === 0 && <p className="py-4 text-center text-[13px] text-text-soft">لا متدربين بعد — أضفهم أو الصقهم من Excel.</p>}
                {trainees.map((t, i) => (
                  <div key={i} className={`grid items-start gap-2 rounded-2xl border p-3 sm:grid-cols-[48px_minmax(0,1.5fr)_minmax(0,1fr)_80px_auto] ${t.isDistinguished ? 'border-accent/60 bg-sand/10' : 'border-border'}`}>
                    <label className={`relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-forest-50 text-primary ${editable ? 'cursor-pointer' : ''}`} title="صورة المتدرب">
                      {t.photoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={t.photoUrl} alt="" className="h-full w-full object-cover" />
                        : <Camera size={18} aria-hidden="true" />}
                      {editable && <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadTraineePhoto(i, f); }} />}
                      <span className="sr-only">صورة المتدرب</span>
                    </label>
                    <input value={t.name} disabled={!editable} onChange={(e) => setTrainee(i, 'name', e.target.value)} placeholder="اسم المتدرب" aria-label="اسم المتدرب" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={t.entity || ''} disabled={!editable} onChange={(e) => setTrainee(i, 'entity', e.target.value)} placeholder="الجهة أو الدولة" aria-label="الجهة" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={t.score} disabled={!editable} inputMode="decimal" onChange={(e) => setTrainee(i, 'score', e.target.value)} placeholder="الدرجة" aria-label="الدرجة" className="rounded-xl border border-border px-3 py-2 text-center text-sm outline-none focus:border-primary" />
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={!editable} onClick={() => setTrainee(i, 'isDistinguished', !t.isDistinguished)} aria-pressed={!!t.isDistinguished} title="متميّز"
                        className={`grid h-10 w-10 place-items-center rounded-full ${t.isDistinguished ? 'bg-accent text-white' : 'text-text-soft hover:bg-sand/20'}`}>
                        <Star size={16} aria-hidden="true" fill={t.isDistinguished ? 'currentColor' : 'none'} />
                      </button>
                      {editable && (
                        <button type="button" onClick={() => { setTrainees((l) => l.filter((_, x) => x !== i)); setDirty(true); }} aria-label="حذف المتدرب" className="grid h-10 w-10 place-items-center rounded-full text-danger hover:bg-burgundy/5"><X size={16} /></button>
                      )}
                    </div>
                    {(t.isDistinguished || t.distinction) && (
                      <input value={t.distinction || ''} disabled={!editable} onChange={(e) => setTrainee(i, 'distinction', e.target.value)} placeholder="بماذا تميّز؟ (مثال: أعلى درجة في الاختبار البعدي، ومشاركة فاعلة في التطبيقات)" aria-label="ملاحظة التميّز"
                        className="rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-primary sm:col-span-5" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── النجمة والنشر ── */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <div className={PANEL}>
              <div className="px-5 pb-4 pt-5 text-center">
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#C6AA76 ${(readyCount / (liveChecks.length || 1)) * 100}%, #EDF1F1 0)` }}>
                  <span className="grid h-[78px] w-[78px] place-items-center rounded-full bg-white">
                    <Star size={34} aria-hidden="true" className="text-accent" fill={doc?.starAwarded ? 'currentColor' : 'none'} />
                  </span>
                </div>
                <p className="mt-3 text-[15px] font-extrabold text-text-main">
                  {doc?.starAwarded ? 'نلت نجمة التميّز' : ready ? 'جاهز للنشر' : `${readyCount} من ${liveChecks.length} معايير`}
                </p>
                <p className="text-[12px] text-text-soft">{published ? `منشور منذ ${fmt(doc.publishedAt)}` : 'لم يُنشر بعد'}</p>
              </div>
              <ul className="space-y-2 border-t border-border px-5 py-4">
                {liveChecks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2 text-[13px]">
                    {c.done
                      ? <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                      : <Circle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-border" />}
                    <span className={c.done ? 'text-text-main' : 'text-text-soft'}>{c.label}{c.note && <span className="block text-[11px] text-text-soft">{c.note}</span>}</span>
                  </li>
                ))}
              </ul>
              {editable && (
                <div className="flex flex-wrap items-center gap-1 border-t border-border bg-background px-4 py-3">
                  {!published ? (
                    <button type="button" onClick={() => publish(true)} disabled={!ready || publishing}
                      title={ready ? '' : 'أكمل المعايير أولاً'}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_8px_18px_-10px_rgba(178,146,90,0.9)] transition hover:brightness-95 disabled:opacity-50">
                      <Send size={15} aria-hidden="true" /> {publishing ? 'جارٍ النشر…' : 'نشر ونيل النجمة'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => publish(false)} disabled={publishing}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-white hover:text-danger">
                      <EyeOff size={15} aria-hidden="true" /> إلغاء النشر
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── الإصدارات: مجلة، أو تقرير، أو الاثنان ── */}
            {doc && (
              <div className={PANEL}>
                <p className="border-b border-border px-5 py-3 text-[13px] font-extrabold text-text-main">الإصدارات</p>
                <div className="space-y-1 p-3">
                  {[
                    { e: 'magazine', label: 'المجلة', hint: 'غلاف، وتقديم، وجلسات، ومعرض، وختام', Icon: BookOpen },
                    { e: 'report', label: 'التقرير الفني', hint: 'للقيادات: ملخص، ونتائج، ومتميّزون، وتوصيات', Icon: FileBarChart2 },
                    { e: 'both', label: 'المجلة والتقرير معاً', hint: 'إصدار كامل للطباعة', Icon: Layers },
                  ].map(({ e, label, hint, Icon }) => (
                    <a key={e} href={editionUrl(e)} target="_blank" rel="noreferrer"
                      className="flex items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-background">
                      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-text-main">{label}</span>
                        <span className="block text-[11.5px] text-text-soft">{hint}</span>
                      </span>
                      <ExternalLink size={14} aria-hidden="true" className="mt-1 text-text-soft" />
                    </a>
                  ))}
                </div>
                <p className="border-t border-border px-5 py-2.5 text-[11.5px] text-text-soft">في كل إصدار: طباعة أو حفظ PDF، و«نسخة المطبعة» بهوامش القصّ.</p>
              </div>
            )}

            {published && doc.slug && (
              <div className={`${PANEL} border-accent/40`}>
                <p className="flex items-center gap-2 border-b border-border px-5 py-3 text-[13px] font-extrabold text-text-main"><Link2 size={16} aria-hidden="true" className="text-warning" /> رابط المجلة العام</p>
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <span dir="ltr" className="min-w-0 flex-1 truncate text-[12px] text-text-main">{publicUrl}</span>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success('نُسخ الرابط'); }} aria-label="نسخ الرابط" className="grid h-8 w-8 place-items-center rounded-full text-primary hover:bg-white"><Copy size={15} /></button>
                    <a href={publicUrl} target="_blank" rel="noreferrer" aria-label="فتح المجلة" className="grid h-8 w-8 place-items-center rounded-full text-primary hover:bg-white"><ExternalLink size={15} /></a>
                  </div>
                  {qrSvg && (
                    <div className="flex items-center gap-3">
                      <div className="h-24 w-24 rounded-xl border border-border bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                      <div className="text-[12px] text-text-soft">
                        <p className="mb-1 inline-flex items-center gap-1 font-bold text-text-main"><QrCode size={14} aria-hidden="true" /> رمز المجلة</p>
                        <p>للعروض والشاشات والمطبوعات.</p>
                        <a download="magazine-qr.svg" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`} className="font-bold text-primary hover:underline">تنزيل الرمز</a>
                      </div>
                    </div>
                  )}
                  <p className="text-[11.5px] text-text-soft">شوهدت {doc.views || 0} مرة. الرابط عام لمن يملكه، ولا يظهر في محركات البحث.</p>
                </div>
              </div>
            )}

            {editable && (
              <button type="button" onClick={save} disabled={saving || !dirty}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(46,96,102,0.85)] hover:bg-primary-dark disabled:opacity-50">
                <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : dirty ? 'حفظ النص والجلسات' : 'كل شيء محفوظ'}
              </button>
            )}
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
