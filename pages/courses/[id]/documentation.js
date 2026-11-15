// ======================================================================
// مساحة توثيق الدورة — عنصر التميّز
// ----------------------------------------------------------------------
// اختياري: من يوثّق دورته وينشرها بالحد الأدنى من الجودة ينال نجمة
// تميّز ودرجات إضافية، ومن لا يوثّق لا يُخصم عليه شيء.
// بيانات الدورة تُقرأ من المنصة نفسها، فلا تُدخل مرتين.
// ======================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  Star, ImagePlus, Trash2, ArrowRight, ArrowLeft, Check, Circle, Save, Plus, X,
  CalendarDays, MapPin, Users, Send, EyeOff, Image as ImageIcon, ListOrdered, BookOpenText,
  GraduationCap, ClipboardPaste, Camera, BookOpen, FileBarChart2, Layers, Link2, Copy, ExternalLink, QrCode,
  Pencil, Sparkles, FileUp, Loader2, Square, RectangleVertical, Award, Upload, HardDrive, Eye as EyeIcon,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import Avatar from '../../../components/shared/Avatar';
import api from '../../../lib/axios';
import { isAcceptableImageFile, fileToDocumentationPhoto, fileToAvatarDataUrl, fileToSignatureDataUrl, bakeDocumentationPhoto } from '../../../lib/clientImage';
import PhotoEditor from '../../../components/documentation/PhotoEditor';
import { filterDefsMarkup, lookOf, cssFilter } from '../../../lib/documentation/photoLook';
import { MAGAZINE_SECTIONS, REPORT_SECTIONS, isOn } from '../../../lib/documentation/sections';
import PhotoImg from '../../../components/documentation/PhotoImg';

const FILTER_DEFS = filterDefsMarkup();
const SESSION_PHOTOS = 4;
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

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

// نافذة فوق الصفحة كلها أينما كان موضع الزر
function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

// حقل نص بزر «اكتب بالمساعد» — المساعد يصوغ، والمنسق يراجع ويعدّل
function AiText({ label, hint, value, onChange, rows = 4, max = 3000, editable, onAi, busy, placeholder }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end gap-2">
        <span className="text-xs font-bold text-text-main">{label} {hint && <span className="font-normal text-text-soft">— {hint}</span>}</span>
        {editable && onAi && (
          <button type="button" onClick={onAi} disabled={busy}
            className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-sand/20 px-3 py-1.5 text-[12px] font-bold text-warning hover:bg-sand/35 disabled:opacity-60">
            {busy ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : <Sparkles size={14} aria-hidden="true" />}
            {value?.trim() ? 'أعد الصياغة بالمساعد' : 'اكتبها بالمساعد'}
          </button>
        )}
      </div>
      <textarea value={value} disabled={!editable} rows={rows} maxLength={max} placeholder={placeholder} aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm leading-loose outline-none focus:border-primary" />
    </div>
  );
}

const PATRONAGE_PRESETS = [
  'تحت إشراف برامج الشراكات الدولية بوزارة الداخلية',
  'بالتعاون مع برامج الشراكات الدولية بوزارة الداخلية',
  'ضمن برامج الشراكة مع الجهات الأمنية العربية',
];

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
  const [editing, setEditing] = useState(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedText, setSchedText] = useState('');
  const [schedFound, setSchedFound] = useState(null);
  const [schedBusy, setSchedBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(null); // 'all' أو رقم الجلسة
  const [picker, setPicker] = useState(null); // رقم الجلسة التي تُختار صورها
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDraft, setReportDraft] = useState(null);
  const [welcome, setWelcome] = useState('');
  const [patronage, setPatronage] = useState('');
  const [logos, setLogos] = useState([]);
  const [logoBusy, setLogoBusy] = useState(false);
  const [compact, setCompact] = useState({ total: 0, done: 0 });
  const logoRef = useRef(null);
  const fileRef = useRef(null);
  const pdfRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = unwrap(await api.get(`/courses/${id}/documentation`));
      setData(d);
      setIntro(d.documentation?.intro || '');
      setClosing(d.documentation?.closing || '');
      setSessions((d.documentation?.sessions || []).map((s) => ({ ...s, date: toDateInput(s.date), photoIds: s.photoIds || [] })));
      setReportSummary(d.documentation?.reportSummary || '');
      setRecommendations(d.documentation?.recommendations || '');
      setWelcome(d.documentation?.welcome || '');
      setPatronage(d.documentation?.patronage || '');
      setLogos(d.documentation?.logos || []);
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

  const save = async (over = {}, { quiet = false } = {}) => {
    setSaving(true);
    try {
      const d = unwrap(await api.put(`/courses/${id}/documentation`, { intro, closing, sessions, reportSummary, recommendations, trainees, welcome, patronage, logos, ...over }));
      setData(d);
      setDirty(false);
      if (!quiet) toast.success('حُفظ التوثيق');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (on) => {
    setPublishing(true);
    try {
      if (on && dirty) await api.put(`/courses/${id}/documentation`, { intro, closing, sessions, reportSummary, recommendations, trainees, welcome, patronage, logos });
      const d = unwrap(await api.post(`/courses/${id}/documentation/publish`, { publish: on }));
      setData(d);
      setDirty(false);
      toast.success(on ? '★ نُشر التوثيق ونلت نجمة التميّز' : 'أُلغي النشر');
      if (on) compactPhotos(d.documentation?.media);
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر تنفيذ الطلب');
    } finally {
      setPublishing(false);
    }
  };

  const setSession = (i, k, v) => { setSessions((list) => list.map((s, x) => (x === i ? { ...s, [k]: v } : s))); setDirty(true); };
  const setTrainee = (i, k, v) => { setTrainees((list) => list.map((t, x) => (x === i ? { ...t, [k]: v } : t))); setDirty(true); };

  // ── صور الجلسات ──
  const sessionOf = (mid) => sessions.findIndex((s) => (s.photoIds || []).includes(mid));
  const togglePickerPhoto = (si, mid) => {
    setSessions((list) => list.map((s, x) => {
      if (x !== si) return s;
      const ids = s.photoIds || [];
      if (ids.includes(mid)) return { ...s, photoIds: ids.filter((p) => p !== mid) };
      if (ids.length >= SESSION_PHOTOS) { toast.error(`${SESSION_PHOTOS} صور للجلسة على الأكثر`); return s; }
      return { ...s, photoIds: [...ids, mid] };
    }));
    setDirty(true);
  };
  // بعد حفظ المحرّر: تُنقل الصورة إلى الجلسة المختارة وتُحفظ الجلسات فوراً
  const afterEdit = async ({ sessionIndex, changedSession }) => {
    const mid = editing?.id;
    setEditing(null);
    if (changedSession && mid) {
      const next = sessions.map((s, x) => {
        const ids = (s.photoIds || []).filter((p) => p !== mid);
        if (x === sessionIndex) return { ...s, photoIds: [...ids, mid].slice(-SESSION_PHOTOS) };
        return { ...s, photoIds: ids };
      });
      setSessions(next);
      await save({ sessions: next }, { quiet: true });
    }
    await load();
    toast.success('حُفظت الصورة');
  };

  // ── اللصق الذكي من منصة التدريب ──
  const readSchedule = async () => {
    setSchedBusy(true);
    try {
      const r = unwrap(await api.post(`/courses/${id}/documentation/assist`, { action: 'schedule', text: schedText }));
      setSchedFound(r.sessions || []);
      if (!r.sessions?.length) toast.error('لم يُتعرّف على جلسات في النص — تأكد أنك نسخت صفحة الجدول كاملة');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّرت قراءة الجدول');
    } finally { setSchedBusy(false); }
  };
  const applySchedule = (mode) => {
    const rows = (schedFound || []).map((x) => ({ title: x.title, presenter: x.presenter || '', date: x.date || '', time: x.time || '', description: '', photoIds: [] }));
    setSessions((list) => (mode === 'replace' ? rows : [...list, ...rows]));
    setDirty(true);
    setSchedOpen(false); setSchedText(''); setSchedFound(null);
    toast.success(`أُضيفت ${rows.length} جلسة — راجعها ثم احفظ`);
  };

  // ── أوصاف الجلسات بالذكاء الاصطناعي ──
  const describe = async (indexes, tag) => {
    if (!indexes.length) { toast('كل الجلسات موصوفة — لإعادة كتابة وصف استعمل الزر بجانبه'); return; }
    setAiBusy(tag);
    try {
      const r = unwrap(await api.post(`/courses/${id}/documentation/assist`, { action: 'describe', sessions, indexes, intro }, { timeout: 200000 }));
      const map = r.descriptions || {};
      const n = Object.keys(map).length;
      setSessions((list) => list.map((s, i) => (map[i] ? { ...s, description: map[i] } : s)));
      if (n) { setDirty(true); toast.success(n > 1 ? `كُتبت ${n} أوصاف — راجعها وعدّل ما تشاء` : 'كُتب الوصف — راجعه وعدّل ما تشاء'); }
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّرت كتابة الأوصاف');
    } finally { setAiBusy(null); }
  };

  // ── تقرير الجهة المنفّذة ──
  const importReport = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { toast.error('أرفق التقرير بصيغة PDF'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('حجم التقرير أكبر من ١٥ ميجابايت'); return; }
    setReportBusy(true);
    try {
      let pdf = await readAsDataUrl(file);
      pdf = pdf.replace(/^data:[^;]*;/, 'data:application/pdf;');
      const r = unwrap(await api.post(`/courses/${id}/documentation/assist`, { action: 'report', pdf }, { timeout: 200000 }));
      setReportDraft({
        ...r,
        use: {
          summary: !!r.summary,
          recommendations: r.recommendations?.length > 0,
          intro: !!r.intro && intro.trim().length < 60,
          modules: r.modules?.length > 0 && sessions.length === 0,
          trainees: r.trainees?.length > 0 && trainees.length === 0,
        },
      });
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّرت قراءة التقرير');
    } finally { setReportBusy(false); }
  };
  const applyReport = () => {
    const r = reportDraft; const u = r.use;
    if (u.summary) setReportSummary([r.summary, r.outcomes?.length ? `\n\nأبرز المخرجات:\n${r.outcomes.map((o) => `• ${o}`).join('\n')}` : ''].join('').trim());
    if (u.recommendations) setRecommendations(r.recommendations.join('\n'));
    if (u.intro) setIntro(r.intro);
    if (u.modules) setSessions((list) => [...list, ...r.modules.map((m) => ({ title: m.title, presenter: '', date: '', time: '', description: m.description, photoIds: [] }))]);
    if (u.trainees) setTrainees((list) => [...list, ...r.trainees.map((t) => ({ name: t.name, entity: t.entity, score: t.score ?? '', distinction: '', isDistinguished: false }))]);
    setReportDraft(null);
    setDirty(true);
    toast.success('نُقلت المادة إلى الحقول — راجعها ثم احفظ');
  };

  const FIELD_SETTERS = { intro: setIntro, closing: setClosing, welcome: setWelcome, reportSummary: setReportSummary, recommendations: setRecommendations };
  const compose = async (field) => {
    setAiBusy(field);
    try {
      const r = unwrap(await api.post(`/courses/${id}/documentation/assist`, {
        action: 'compose', field, intro, closing, welcome, patronage, reportSummary, recommendations, sessions,
        trainees: trainees.map((t) => ({ score: t.score, entity: t.entity, isDistinguished: t.isDistinguished, distinction: t.distinction })),
      }, { timeout: 200000 }));
      if (r.text) { FIELD_SETTERS[field](r.text); setDirty(true); toast.success('صاغها المساعد — راجعها وعدّل ما تشاء'); }
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّرت الصياغة');
    } finally { setAiBusy(null); }
  };

  // ── شعارات الشركاء (شعار الجامعة أساسي دائماً) ──
  const hasPreset = (k) => logos.some((l) => l.preset === k);
  const togglePreset = (k) => { setLogos((l) => (l.some((x) => x.preset === k) ? l.filter((x) => x.preset !== k) : [...l, { preset: k }])); setDirty(true); };
  const uploadLogo = async (file) => {
    if (!file || !isAcceptableImageFile(file)) return;
    if (logos.length >= 4) { toast.error('أربعة شعارات شركاء على الأكثر'); return; }
    setLogoBusy(true);
    try {
      const image = await fileToSignatureDataUrl(file, 700);
      const r = unwrap(await api.post(`/courses/${id}/documentation/logo`, { image }));
      setLogos((l) => [...l, { key: r.key, url: r.url, name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) }]);
      setDirty(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر رفع الشعار');
    } finally { setLogoBusy(false); }
  };

  // ── ضغط الصور بعد النشر: يُثبَّت القصّ والفلتر وتُصغَّر إلى حاجة المجلة ──
  // المجلة لا تتغيّر شكلاً، والأصل الكبير يُحذف من الخادم فيتوفّر نحو النصف أو أكثر.
  const compactPhotos = async (list) => {
    const todo = (list || []).filter((m) => !m.edit?.baked);
    if (!todo.length) return;
    setCompact({ total: todo.length, done: 0 });
    let saved = 0;
    for (const m of todo) {
      try {
        const look = lookOf(m.edit);
        const out = await bakeDocumentationPhoto(m.fullUrl, look, cssFilter(look));
        const edit = {
          ...look, crop: { x: 0, y: 0, w: 1, h: 1 }, baked: true,
          ...(out.filterBaked ? { filter: 'none', b: 1, c: 1, s: 1 } : {}),
        };
        await api.patch(`/documentation/media/${m.id}`, { replace: out, edit });
        saved += Math.max(0, (m.size || 0) - Math.round((out.full.length * 3) / 4));
      } catch { /* صورة تعذّر ضغطها تبقى كما هي، وتُعاد المحاولة لاحقاً */ }
      setCompact((c) => ({ ...c, done: c.done + 1 }));
    }
    setCompact({ total: 0, done: 0 });
    await load();
    if (saved > 0) toast.success(`ضُغطت الصور ووُفّر نحو ${(saved / 1048576).toFixed(1)} ميجابايت من الخادم`);
  };

  const sections = doc?.sections || {};
  const toggleSection = async (key) => {
    const next = { ...sections, [key]: isOn(sections, key) ? false : true };
    try { const d = unwrap(await api.put(`/courses/${id}/documentation`, { sections: next })); setData(d); } catch { toast.error('تعذّر الحفظ'); }
  };

  const setFormat = async (format) => {
    try { const d = unwrap(await api.put(`/courses/${id}/documentation`, { format })); setData(d); } catch { toast.error('تعذّر تغيير المقاس'); }
  };

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
                hint="اضغط «قصّ وتحسين» لأي صورة، واختر صورة الغلاف بزرّها. الصور العمودية والأفقية من الجوال مقبولة كلها.">
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
                    const si = sessionOf(m.id);
                    return (
                      <li key={m.id} className={`overflow-hidden rounded-2xl border bg-white ${isCover ? 'border-accent shadow-[0_0_0_2px_#C6AA76]' : 'border-border'}`}>
                        <button type="button" disabled={!editable} onClick={() => setEditing(m)} aria-label={`تعديل الصورة ${i + 1}`}
                          className="relative block aspect-[4/3] w-full overflow-hidden bg-background">
                          <PhotoImg m={m} src={m.thumbUrl} alt={m.caption || `صورة ${i + 1}`} loading="lazy" />
                          {isCover && <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-extrabold text-white"><Star size={11} fill="currentColor" aria-hidden="true" /> صورة الغلاف</span>}
                          {si >= 0 && <span className="absolute end-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10.5px] font-extrabold text-white">جلسة {si + 1}</span>}
                          {m.width < 1400 && m.height < 1400 && <span className="absolute bottom-2 start-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white" title="دقتها أقل مما يناسب الطباعة الكبيرة">دقة منخفضة</span>}
                        </button>
                        {editable && (
                          <div className="flex flex-col gap-1 border-t border-border p-1.5">
                            <button type="button" onClick={() => setEditing(m)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary-light/60 px-2 py-1.5 text-[11.5px] font-bold text-primary hover:bg-primary-light">
                              <Pencil size={13} aria-hidden="true" /> قصّ وتحسين
                            </button>
                            <button type="button" onClick={() => setCover(m.id)} disabled={isCover}
                              className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-bold ${isCover ? 'bg-sand/20 text-warning' : 'bg-background text-text-main hover:bg-sand/15 hover:text-warning'}`}>
                              <Star size={13} aria-hidden="true" fill={isCover ? 'currentColor' : 'none'} /> {isCover ? 'الغلاف' : 'اجعلها الغلاف'}
                            </button>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="تقديمها في الترتيب" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-background disabled:opacity-30"><ArrowRight size={13} aria-hidden="true" /> قبل</button>
                              <button type="button" onClick={() => move(i, 1)} disabled={i === media.length - 1} title="تأخيرها في الترتيب" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-background disabled:opacity-30">بعد <ArrowLeft size={13} aria-hidden="true" /></button>
                              <button type="button" onClick={() => { if (window.confirm('حذف هذه الصورة نهائياً؟')) removePhoto(m.id); }} title="حذف الصورة" className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-danger hover:bg-burgundy/5"><Trash2 size={13} aria-hidden="true" /> حذف</button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── الترحيب والإشراف والشعارات ── */}
            <section className={PANEL} aria-labelledby="h-front">
              <SectionHead icon={Award} title={<span id="h-front">الغلاف والترحيب</span>} hint="كلها اختيارية: عبارة إشراف على الغلاف، وكلمة ترحيب، وشعارات الشركاء بجوار شعار الجامعة." />
              <div className="space-y-5 p-5">
                <div>
                  <span className="mb-1 block text-xs font-bold text-text-main">عبارة الإشراف أو الشراكة <span className="font-normal text-text-soft">— تظهر على الغلاف</span></span>
                  <input value={patronage} disabled={!editable} maxLength={160} onChange={(e) => { setPatronage(e.target.value); setDirty(true); }} placeholder="اتركها فارغة إن لم تكن هناك جهة مشرفة"
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                  {editable && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {PATRONAGE_PRESETS.map((t) => (
                        <button key={t} type="button" onClick={() => { setPatronage(t); setDirty(true); }}
                          className={`rounded-full border px-3 py-1 text-[11.5px] font-bold ${patronage === t ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-soft hover:border-primary/40 hover:text-primary'}`}>{t}</button>
                      ))}
                    </div>
                  )}
                </div>
                <AiText label="كلمة الترحيب" hint="صفحة بعد الغلاف، تُحذف إن تُركت فارغة" value={welcome} rows={3} max={1500} editable={editable}
                  onChange={(v) => { setWelcome(v); setDirty(true); }} onAi={() => compose('welcome')} busy={aiBusy === 'welcome'} />
                <div>
                  <span className="mb-1 block text-xs font-bold text-text-main">الشعارات <span className="font-normal text-text-soft">— شعار الجامعة ثابت في كل الإصدارات، وتُضاف بجواره شعارات الشركاء</span></span>
                  <div className="flex flex-wrap items-stretch gap-2">
                    <span className="grid h-20 w-36 place-items-center rounded-2xl border border-border bg-[#0b3f42] p-2" title="شعار الجامعة — أساسي">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/nauss-logo-gold.png" alt="شعار الجامعة" className="max-h-full max-w-full object-contain" />
                    </span>
                    <button type="button" disabled={!editable} onClick={() => togglePreset('moi-partnerships')} aria-pressed={hasPreset('moi-partnerships')}
                      className={`relative grid h-20 w-24 place-items-center rounded-2xl border-2 bg-white p-1.5 ${hasPreset('moi-partnerships') ? 'border-primary' : 'border-dashed border-border opacity-60 hover:opacity-100'}`} title="شعار برامج الشراكات الدولية — وزارة الداخلية">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/moi-partnerships.png" alt="برامج الشراكات الدولية" className="max-h-full max-w-full object-contain" />
                      {hasPreset('moi-partnerships') && <span className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-white"><Check size={12} /></span>}
                    </button>
                    {logos.filter((l) => l.key).map((l) => (
                      <span key={l.key} className="relative grid h-20 w-24 place-items-center rounded-2xl border border-border bg-white p-1.5" title={l.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.url} alt={l.name || 'شعار شريك'} className="max-h-full max-w-full object-contain" />
                        {editable && <button type="button" onClick={() => { setLogos((x) => x.filter((y) => y.key !== l.key)); setDirty(true); }} aria-label="إزالة الشعار" className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white"><X size={12} /></button>}
                      </span>
                    ))}
                    {editable && (
                      <button type="button" onClick={() => logoRef.current?.click()} disabled={logoBusy}
                        className="grid h-20 w-24 place-items-center rounded-2xl border-2 border-dashed border-border text-[11px] font-bold text-text-soft hover:border-primary/50 hover:text-primary">
                        <span className="flex flex-col items-center gap-1">{logoBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} aria-hidden="true" />} شعار آخر</span>
                      </button>
                    )}
                    <input ref={logoRef} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadLogo(f); }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-soft">يُفضّل الشعار بخلفية شفافة (PNG).</p>
                </div>
              </div>
            </section>

            {/* ── المقدمة والخاتمة ── */}
            <section className={PANEL} aria-labelledby="h-texts">
              <SectionHead icon={BookOpenText} title={<span id="h-texts">نص التوثيق</span>} hint="يصوغها المساعد من بيانات الدورة وجلساتها، وتراجعها أنت وتعدّل ما تشاء." />
              <div className="space-y-4 p-5">
                <AiText label="المقدمة" hint="عن الدورة وأهدافها وما ميّزها" value={intro} rows={5} editable={editable}
                  onChange={(v) => { setIntro(v); setDirty(true); }} onAi={() => compose('intro')} busy={aiBusy === 'intro'} />
                <AiText label="الخاتمة" hint="اختيارية" value={closing} rows={3} editable={editable}
                  onChange={(v) => { setClosing(v); setDirty(true); }} onAi={() => compose('closing')} busy={aiBusy === 'closing'} />
              </div>
            </section>

            {/* ── الجلسات ── */}
            <section className={PANEL} aria-labelledby="h-sessions">
              <SectionHead icon={ListOrdered} title={<span id="h-sessions">جدول الجلسات <span className="text-text-soft">({sessions.length})</span></span>} hint="الصق الجدول من منصة التدريب، وأسند لكل جلسة صورها، فتظهر في المجلة بقصتها وصورها.">
                {editable && (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => setSchedOpen((v) => !v)} aria-expanded={schedOpen}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-primary">
                      <ClipboardPaste size={15} aria-hidden="true" /> لصق من منصة التدريب
                    </button>
                    {sessions.length > 0 && (
                      <button type="button" disabled={!!aiBusy} onClick={() => describe(sessions.map((x, i) => (x.title?.trim() && !x.description?.trim() ? i : -1)).filter((i) => i >= 0), 'all')}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-warning hover:bg-sand/15 disabled:opacity-60">
                        {aiBusy === 'all' ? <Loader2 size={15} aria-hidden="true" className="animate-spin" /> : <Sparkles size={15} aria-hidden="true" />} اكتب الأوصاف
                      </button>
                    )}
                    <button type="button" onClick={() => { setSessions((l) => [...l, { title: '', presenter: '', date: '', time: '', description: '', photoIds: [] }]); setDirty(true); }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-primary hover:bg-primary-light">
                      <Plus size={15} aria-hidden="true" /> جلسة
                    </button>
                  </div>
                )}
              </SectionHead>
              {schedOpen && (
                <div className="border-b border-border bg-primary-light/30 p-4">
                  {!schedFound ? (
                    <>
                      <p className="mb-2 text-[12.5px] text-text-soft">افتح جدول الدورة في منصة التدريب، وحدّد الصفحة كلها (Ctrl+A) وانسخها، ثم الصقها هنا كما هي. تُستخرج العناوين والتواريخ والأوقات، وتُتجاهل الاستراحات والملفات والروابط.</p>
                      <textarea value={schedText} onChange={(e) => setSchedText(e.target.value)} rows={7} aria-label="نص الجدول المنسوخ"
                        className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-primary" />
                      <div className="mt-2 flex gap-1">
                        <button type="button" onClick={readSchedule} disabled={!schedText.trim() || schedBusy} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                          {schedBusy ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : <Check size={14} aria-hidden="true" />} استخراج الجلسات
                        </button>
                        <button type="button" onClick={() => setSchedOpen(false)} className="rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-white">إلغاء</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-[13px] font-extrabold text-text-main">وُجدت {schedFound.length} جلسة — راجعها:</p>
                      <ol className="mb-3 max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-white p-3 text-[12.5px]">
                        {schedFound.map((x, i) => (
                          <li key={i} className="flex flex-wrap gap-x-3 border-b border-border/60 py-1 last:border-0">
                            <b className="text-text-main">{i + 1}. {x.title}</b>
                            <span className="text-text-soft" dir="ltr">{x.date || ''} {x.time || ''}</span>
                            {x.presenter && <span className="text-warning">{x.presenter}</span>}
                          </li>
                        ))}
                      </ol>
                      <div className="flex flex-wrap gap-1">
                        {sessions.length > 0 && (
                          <button type="button" onClick={() => applySchedule('replace')} disabled={!schedFound.length} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">استبدال الجدول الحالي</button>
                        )}
                        <button type="button" onClick={() => applySchedule('append')} disabled={!schedFound.length}
                          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-50 ${sessions.length ? 'border border-primary text-primary' : 'bg-primary text-white'}`}>
                          <Plus size={14} aria-hidden="true" /> {sessions.length ? 'إضافة إلى الجدول' : 'اعتماد الجلسات'}
                        </button>
                        <button type="button" onClick={() => setSchedFound(null)} className="rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-white">رجوع</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="space-y-3 p-4">
                {sessions.length === 0 && <p className="py-4 text-center text-[13px] text-text-soft">لا جلسات بعد — الصقها من منصة التدريب بنقرة.</p>}
                {sessions.map((s, i) => (
                  <div key={i} className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_140px_110px_auto]">
                    <input value={s.title} disabled={!editable} onChange={(e) => setSession(i, 'title', e.target.value)} placeholder="عنوان الجلسة" aria-label="عنوان الجلسة" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={s.presenter || ''} disabled={!editable} onChange={(e) => setSession(i, 'presenter', e.target.value)} placeholder="المقدّم" aria-label="المقدّم" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input type="date" value={s.date || ''} disabled={!editable} onChange={(e) => setSession(i, 'date', e.target.value)} aria-label="التاريخ" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={s.time || ''} disabled={!editable} onChange={(e) => setSession(i, 'time', e.target.value)} placeholder="الوقت" aria-label="الوقت" className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                    {editable && (
                      <button type="button" onClick={() => { setSessions((l) => l.filter((_, x) => x !== i)); setDirty(true); }} aria-label="حذف الجلسة" className="grid h-10 w-10 place-items-center rounded-full text-danger hover:bg-burgundy/5"><X size={16} /></button>
                    )}
                    <div className="relative sm:col-span-5">
                      <textarea value={s.description || ''} disabled={!editable} onChange={(e) => setSession(i, 'description', e.target.value)} rows={2} placeholder="وصف موجز (اختياري)" aria-label="وصف الجلسة"
                        className="block w-full resize-y rounded-xl border border-border px-3 py-2 pe-11 text-[13px] leading-relaxed outline-none focus:border-primary" />
                      {editable && s.title?.trim() && (
                        <button type="button" disabled={!!aiBusy} onClick={() => describe([i], i)} title={s.description ? 'أعد كتابة الوصف' : 'اكتب الوصف'} aria-label="كتابة الوصف بالذكاء الاصطناعي"
                          className="absolute end-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-warning hover:bg-sand/20 disabled:opacity-50">
                          {aiBusy === i ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                        </button>
                      )}
                    </div>
                    {/* صور الجلسة */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:col-span-5">
                      {(s.photoIds || []).map((pid) => {
                        const m = media.find((x) => x.id === pid);
                        if (!m) return null;
                        return (
                          <span key={pid} className="relative h-12 w-16 overflow-hidden rounded-lg border border-border">
                            <PhotoImg m={m} src={m.thumbUrl} />
                          </span>
                        );
                      })}
                      {editable && media.length > 0 && (
                        <button type="button" onClick={() => setPicker(i)}
                          className="inline-flex h-12 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-[12px] font-bold text-text-soft hover:border-primary/50 hover:text-primary">
                          <ImageIcon size={14} aria-hidden="true" /> {(s.photoIds || []).length ? 'تغيير الصور' : 'صور الجلسة'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── التقرير الفني ── */}
            <section className={PANEL} aria-labelledby="h-report">
              <SectionHead icon={FileBarChart2} title={<span id="h-report">التقرير الفني</span>}
                hint="للقيادات وجهة التدريب: يُستخرج من داخل المنصة وحدها، ولا يظهر في المجلة العامة.">
                {editable && (
                  <>
                    <button type="button" onClick={() => pdfRef.current?.click()} disabled={reportBusy}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-warning hover:bg-sand/15 disabled:opacity-60">
                      {reportBusy ? <Loader2 size={15} aria-hidden="true" className="animate-spin" /> : <FileUp size={15} aria-hidden="true" />}
                      {reportBusy ? 'يقرأ التقرير…' : 'من تقرير الجهة المنفّذة'}
                    </button>
                    <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; importReport(f); }} />
                  </>
                )}
              </SectionHead>
              {reportDraft && (
                <div className="border-b border-border bg-sand/10 p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-[13px] font-extrabold text-text-main"><Sparkles size={15} aria-hidden="true" className="text-warning" /> قرأ المساعد التقرير — اختر ما يُنقل إلى الحقول:</p>
                  <p className="mb-3 text-[11.5px] text-text-soft">كل ما يُنقل يبقى قابلاً للتعديل قبل الحفظ.</p>
                  <div className="space-y-2">
                    {[
                      { k: 'summary', label: 'ملخص التنفيذ وأبرز المخرجات', show: !!reportDraft.summary, preview: reportDraft.summary },
                      { k: 'recommendations', label: `التوصيات (${reportDraft.recommendations?.length || 0})`, show: reportDraft.recommendations?.length > 0, preview: reportDraft.recommendations?.join(' · ') },
                      { k: 'intro', label: 'مقدمة المجلة', show: !!reportDraft.intro, preview: reportDraft.intro, warn: intro.trim().length >= 60 ? 'ستحل محل المقدمة الحالية' : '' },
                      { k: 'modules', label: `محاور البرنامج جلساتٍ بأوصافها (${reportDraft.modules?.length || 0})`, show: reportDraft.modules?.length > 0, preview: reportDraft.modules?.map((m) => m.title).join(' · '), warn: sessions.length ? 'تُضاف بعد الجلسات الحالية' : '' },
                      { k: 'trainees', label: `المتدربون ودرجاتهم (${reportDraft.trainees?.length || 0})`, show: reportDraft.trainees?.length > 0, preview: reportDraft.trainees?.slice(0, 5).map((t) => t.name).join(' · ') },
                    ].filter((x) => x.show).map((x) => (
                      <label key={x.k} className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border bg-white p-3">
                        <input type="checkbox" checked={!!reportDraft.use[x.k]} onChange={(e) => setReportDraft((d) => ({ ...d, use: { ...d.use, [x.k]: e.target.checked } }))} className="mt-1 h-4 w-4 accent-[#00676a]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-text-main">{x.label}{x.warn && <span className="ms-2 text-[11px] font-bold text-warning">— {x.warn}</span>}</span>
                          <span className="line-clamp-2 block text-[12px] leading-relaxed text-text-soft">{x.preview}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-1">
                    <button type="button" onClick={applyReport} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white"><Check size={14} aria-hidden="true" /> نقل المختار</button>
                    <button type="button" onClick={() => setReportDraft(null)} className="rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-white">تجاهل</button>
                  </div>
                </div>
              )}
              <div className="space-y-4 p-5">
                <AiText label="ملخص التنفيذ" hint="ما تحقق من أهداف البرنامج وأبرز مخرجاته" value={reportSummary} rows={5} max={4000} editable={editable}
                  onChange={(v) => { setReportSummary(v); setDirty(true); }} onAi={() => compose('reportSummary')} busy={aiBusy === 'reportSummary'} />
                <AiText label="التوصيات" hint="توصية في كل سطر" value={recommendations} rows={4} max={4000} editable={editable}
                  onChange={(v) => { setRecommendations(v); setDirty(true); }} onAi={() => compose('recommendations')} busy={aiBusy === 'recommendations'} />
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
                <div className="border-b border-border px-4 py-3">
                  <p className="mb-2 text-[11.5px] font-bold text-text-soft">مقاس المجلة</p>
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-background p-1" role="radiogroup" aria-label="مقاس المجلة">
                    {[{ v: 'A4', label: 'A4 طولي', Icon: RectangleVertical }, { v: 'SQUARE', label: 'مربع', Icon: Square }].map(({ v, label, Icon }) => {
                      const on = (doc.format || 'A4') === v;
                      return (
                        <button key={v} type="button" role="radio" aria-checked={on} disabled={!editable} onClick={() => !on && setFormat(v)}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold ${on ? 'bg-white text-primary shadow-sm' : 'text-text-soft hover:text-text-main'}`}>
                          <Icon size={14} aria-hidden="true" /> {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold text-text-main"><EyeIcon size={14} aria-hidden="true" /> الأقسام الظاهرة</p>
                  {[{ t: 'المجلة', list: MAGAZINE_SECTIONS }, { t: 'التقرير الفني', list: REPORT_SECTIONS }].map((g) => (
                    <div key={g.t} className="mb-2">
                      <p className="mb-1 text-[11px] font-bold text-text-soft">{g.t}</p>
                      <div className="flex flex-wrap gap-1">
                        {g.list.map((x) => {
                          const shown = isOn(sections, x.key);
                          return (
                            <button key={x.key} type="button" disabled={!editable} onClick={() => toggleSection(x.key)} aria-pressed={shown} title={x.hint || ''}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${shown ? 'border-primary/40 bg-primary-light/60 text-primary' : 'border-dashed border-border text-text-soft line-through decoration-1'}`}>
                              {shown ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />} {x.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-4 py-3 text-[11.5px] text-text-soft">
                  {(() => {
                    const bytes = media.reduce((a, m) => a + (m.size || 0), 0);
                    const pending = media.filter((m) => !m.edit?.baked).length;
                    return (
                      <>
                        <p className="flex items-center gap-1.5"><HardDrive size={13} aria-hidden="true" /> حجم صور التوثيق: <b className="text-text-main">{(bytes / 1048576).toFixed(1)} ميجابايت</b></p>
                        {compact.total > 0 ? (
                          <p className="mt-1.5 font-bold text-primary">جارٍ ضغط الصور… {compact.done} من {compact.total}</p>
                        ) : published && pending > 0 && editable ? (
                          <button type="button" onClick={() => compactPhotos(media)} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-[11.5px] font-bold text-primary hover:brightness-95">
                            <HardDrive size={13} aria-hidden="true" /> ضغط {pending} صورة الآن
                          </button>
                        ) : published && media.length > 0 ? (
                          <p className="mt-1 text-[11px]">الصور مضغوطة بمقاس المجلة — والمجلة كما هي.</p>
                        ) : (
                          <p className="mt-1 text-[11px]">تُضغط الصور تلقائياً عند النشر بلا تغيير في شكل المجلة.</p>
                        )}
                      </>
                    );
                  })()}
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
              <button type="button" onClick={() => save()} disabled={saving || !dirty}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(46,96,102,0.85)] hover:bg-primary-dark disabled:opacity-50">
                <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : dirty ? 'حفظ النص والجلسات' : 'كل شيء محفوظ'}
              </button>
            )}
          </aside>
        </div>
      </div>

      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: FILTER_DEFS }} />
      {editing && (
        <PhotoEditor media={editing} isCover={doc.coverMediaId === editing.id} sessions={sessions} sessionIndex={sessionOf(editing.id)}
          onClose={() => setEditing(null)} onSaved={afterEdit} />
      )}
      {picker !== null && sessions[picker] && (
        <Portal>
        <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b2224]/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="صور الجلسة"
          onClick={(e) => { if (e.target === e.currentTarget) setPicker(null); }}>
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">
            <div className="border-b border-border px-5 py-3">
              <p className="text-[15px] font-extrabold text-text-main">صور الجلسة: {sessions[picker].title || `الجلسة ${picker + 1}`}</p>
              <p className="text-[12px] text-text-soft">اختر حتى {SESSION_PHOTOS} صور — تظهر مع الجلسة في المجلة بدل المعرض العام.</p>
            </div>
            <ul className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-4 sm:grid-cols-4">
              {media.map((m) => {
                const on = (sessions[picker].photoIds || []).includes(m.id);
                const other = !on ? sessionOf(m.id) : -1;
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => togglePickerPhoto(picker, m.id)} aria-pressed={on}
                      className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl border-[3px] ${on ? 'border-primary' : 'border-transparent'}`}>
                      <PhotoImg m={m} src={m.thumbUrl} alt={m.caption || ''} />
                      {on && <span className="absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-white"><Check size={14} /></span>}
                      {other >= 0 && <span className="absolute start-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[10px] font-bold text-white">جلسة {other + 1}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end border-t border-border bg-background px-4 py-3">
              <button type="button" onClick={() => setPicker(null)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-[13px] font-bold text-white"><Check size={15} aria-hidden="true" /> تم</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </MainLayout>
  );
}
