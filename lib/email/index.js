/**
 * نظام البريد الإلكتروني — Resend
 * جميع رسائل المنصة مُجمَّعة في ملف واحد
 *
 * الإعداد: https://resend.com
 * ١. أنشئ حساباً مجانياً
 * ٢. انسخ API Key من لوحة التحكم
 * ٣. أضف RESEND_API_KEY في Vercel Environment Variables
 */
const { Resend } = require('resend');

// ── إعداد العميل ──────────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM     = `منصة إقفال الدورات <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://end-nif.vercel.app';

// ── دالة الإرسال المركزية ────────────────────────────────────────────────────
async function send({ to, subject, html, tag }) {
  if (!resend) {
    console.log(`[Email MOCK] To: ${to} | Subject: ${subject}`);
    return { mock: true };
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html, tags: tag ? [{ name: 'type', value: tag }] : [] });
    if (error) { console.error('[Resend Error]', error); return null; }
    return data;
  } catch (err) {
    console.error('[Email Error]', err && err.message);
    return null;
  }
}

// ── قالب HTML الأساسي ────────────────────────────────────────────────────────
function baseTemplate({ title, preheader, body, cta, ctaUrl, color = '#253C32' }) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#F0F4F2;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F2;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- رأس البريد -->
        <tr><td style="background:${color};padding:28px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;text-align:right;">
                <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;">منصة إقفال الدورات التدريبية</p>
                <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;">${title}</h1>
                ${preheader ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${preheader}</p>` : ''}
              </td>
              <td style="vertical-align:middle;text-align:left;width:90px;"><img src="${BASE_URL}/nauss-logo.png" alt="جامعة نايف العربية للعلوم الأمنية" width="72" style="display:block;width:72px;height:auto;margin-right:auto;"/></td>
            </tr>
          </table>
        </td></tr>

        <!-- المحتوى -->
        <tr><td style="padding:32px;">
          ${body}
          ${cta ? `
          <div style="margin-top:28px;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;">${cta}</a>
          </div>` : ''}
        </td></tr>

        <!-- تذييل -->
        <tr><td style="background:#F0F4F2;padding:20px 32px;text-align:center;border-top:1px solid #E0E7E4;">
          <p style="margin:0;color:#7A8F87;font-size:11px;">جامعة نايف العربية للعلوم الأمنية · منصة إقفال الدورات التدريبية</p>
          <p style="margin:6px 0 0;color:#4B5952;font-size:11px;font-weight:700;">إدارة عمليات التدريب 2026</p>
          <p style="margin:3px 0 0;color:#7A8F87;font-size:10px;">تطوير — نايف الشهراني</p>
          <p style="margin:6px 0 0;color:#9AA8A1;font-size:10px;">هذا البريد مُرسَل تلقائياً — لا تُرد عليه</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label, value, bold = false) {
  return `<tr>
    <td style="padding:8px 12px;background:#F7FAF8;border-radius:6px;font-size:13px;color:#4B5952;width:40%;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:#14221D;font-weight:${bold?'700':'400'};">${value}</td>
  </tr>`;
}

function table(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="4" style="margin:16px 0;">${rows.join('')}</table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #E8EDEB;margin:24px 0;">`;
}

function highlight(text, color = '#EBF3EE', textColor = '#253C32') {
  return `<div style="background:${color};border-right:4px solid ${textColor};padding:12px 16px;border-radius:8px;margin:16px 0;font-size:14px;color:${textColor};">${text}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ١. ترحيب بالانضمام
// ══════════════════════════════════════════════════════════════════════════════
async function sendWelcome({ to, firstName, lastName, email, tempPassword }) {
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName} ${lastName}</strong> 👋</p>
    <p style="color:#4B5952;line-height:1.7;">يسعدنا انضمامك إلى منصة إقفال الدورات التدريبية. تم إنشاء حسابك بنجاح وبإمكانك البدء فوراً.</p>
    ${divider()}
    <p style="font-weight:700;color:#253C32;margin-bottom:8px;">بيانات الدخول:</p>
    ${table([
      row('البريد الإلكتروني', email),
      row('كلمة المرور المؤقتة', `<code style="background:#F0F4F2;padding:2px 8px;border-radius:4px;">${tempPassword}</code>`, true),
    ])}
    ${highlight('⚠️ يُرجى تغيير كلمة المرور فور تسجيل الدخول لأول مرة لضمان أمان حسابك.', '#FFF8E6', '#8B6914')}
  `;
  return send({
    to, tag: 'welcome',
    subject: `مرحباً بك في منصة إقفال الدورات يا ${firstName}`,
    html: baseTemplate({ title: 'مرحباً بك في المنصة 🎉', preheader: 'تم إنشاء حسابك بنجاح', body, cta: 'تسجيل الدخول الآن', ctaUrl: `${BASE_URL}/login` }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٢. استعادة كلمة المرور
// ══════════════════════════════════════════════════════════════════════════════
async function sendPasswordReset({ to, firstName, resetToken }) {
  const link = `${BASE_URL}/reset-password?token=${resetToken}`;
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لإتمام العملية.</p>
    ${highlight('⏳ هذا الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط من وقت الإرسال.', '#FFF8E6', '#8B6914')}
    <p style="color:#7A8F87;font-size:13px;margin-top:24px;">إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد — حسابك بأمان تام.</p>
  `;
  return send({
    to, tag: 'password-reset',
    subject: 'إعادة تعيين كلمة المرور — منصة إقفال الدورات',
    html: baseTemplate({ title: 'إعادة تعيين كلمة المرور 🔑', preheader: 'طلب إعادة تعيين كلمة المرور', body, cta: 'إعادة تعيين كلمة المرور', ctaUrl: link, color: '#253C32' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٣. عنصر إغلاق مُعاد
// ══════════════════════════════════════════════════════════════════════════════
async function sendElementReturned({ to, firstName, courseName, elementName, reason, courseId }) {
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">تم إعادة أحد عناصر الإقفال الخاصة بك ويستوجب مراجعتك وإعادة التقديم.</p>
    ${divider()}
    ${table([
      row('الدورة التدريبية', courseName, true),
      row('العنصر المُعاد', elementName, true),
    ])}
    ${reason ? highlight(`<strong>سبب الإعادة:</strong><br>${reason}`, '#FFF3F3', '#633646') : ''}
    <p style="color:#4B5952;font-size:13px;margin-top:16px;">يُرجى مراجعة الملاحظة وتصحيح العنصر وإعادة تقديمه في أقرب وقت.</p>
  `;
  return send({
    to, tag: 'element-returned',
    subject: `تم إعادة عنصر إغلاق — ${elementName}`,
    html: baseTemplate({ title: 'عنصر إغلاق مُعاد ↩️', preheader: `${elementName} بانتظار مراجعتك`, body, cta: 'فتح الدورة ومراجعة العنصر', ctaUrl: `${BASE_URL}/courses/${courseId}`, color: '#633646' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٣ب. عنصر إغلاق مرفوض
// ══════════════════════════════════════════════════════════════════════════════
async function sendElementRejected({ to, firstName, courseName, elementName, reason, courseId }) {
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">تم رفض تقديمك لأحد عناصر الإقفال.</p>
    ${divider()}
    ${table([
      row('الدورة التدريبية', courseName, true),
      row('العنصر المرفوض', elementName, true),
    ])}
    ${reason ? highlight(`<strong>سبب الرفض:</strong><br>${reason}`, '#FFF3F3', '#633646') : ''}
    <p style="color:#4B5952;font-size:13px;margin-top:16px;">يُرجى مراجعة الملاحظة والتواصل مع المسؤول عند الحاجة.</p>
  `;
  return send({
    to, tag: 'element-rejected',
    subject: `تم رفض عنصر إغلاق — ${elementName}`,
    html: baseTemplate({ title: 'عنصر إغلاق مرفوض ⛔', preheader: `${elementName} مرفوض`, body, cta: 'فتح الدورة', ctaUrl: `${BASE_URL}/courses/${courseId}`, color: '#633646' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٤. نتيجة KPI الشهرية للموظف
// ══════════════════════════════════════════════════════════════════════════════
async function sendMonthlyKpiEmployee({ to, firstName, periodLabel, finalScore, level, levelLabel, indicators }) {
  const colors = { OUTSTANDING:'#253C32', VERY_GOOD:'#394F49', GOOD:'#5D8A70', NEEDS_IMPROVEMENT:'#8B7D6B', WEAK:'#633646' };
  const color  = colors[level] || '#253C32';
  const messages = {
    OUTSTANDING:       'أداء استثنائي — أنت نجم الفريق هذا الشهر 🌟',
    VERY_GOOD:         'أداء ممتاز — استمر في هذا المستوى الرفيع 💪',
    GOOD:              'أداء جيد — لديك قدرة على الوصول لمستويات أعلى 📈',
    NEEDS_IMPROVEMENT: 'مجال للتحسين — نثق بقدرتك على الارتقاء 🎯',
    WEAK:              'نحتاج لمناقشة خطة تطوير معك — تواصل مع مشرفك 🤝',
  };
  const indRows = (indicators || []).map(ind =>
    `<tr><td style="padding:6px 12px;color:#4B5952;font-size:13px;">${ind.icon} ${ind.label}</td>
     <td style="padding:6px 12px;text-align:left;"><span style="background:#F0F4F2;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:700;color:#253C32;">${ind.score}%</span></td></tr>`
  ).join('');
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">تم احتساب مؤشرات أدائك لشهر <strong>${periodLabel}</strong>. إليك نتائجك:</p>
    <div style="background:${color};border-radius:16px;padding:24px;text-align:center;margin:20px 0;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">درجتك الإجمالية</p>
      <p style="margin:4px 0;color:#fff;font-size:48px;font-weight:800;">${finalScore}%</p>
      <p style="margin:0;color:rgba(255,255,255,0.9);font-size:16px;font-weight:700;">${levelLabel}</p>
    </div>
    <p style="color:#4B5952;font-size:14px;text-align:center;font-style:italic;">"${messages[level] || ''}"</p>
    ${indicators?.length ? `${divider()}<p style="font-weight:700;color:#253C32;">تفصيل المؤشرات:</p><table width="100%" cellpadding="0" cellspacing="4">${indRows}</table>` : ''}
  `;
  return send({
    to, tag: 'kpi-monthly',
    subject: `نتائج مؤشرات أدائك — ${periodLabel} (${finalScore}%)`,
    html: baseTemplate({ title: `مؤشرات أداء ${periodLabel} 📊`, preheader: `درجتك: ${finalScore}% — ${levelLabel}`, body, cta: 'عرض تفاصيل أدائك', ctaUrl: `${BASE_URL}/kpis`, color }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٥. الموظف الأفضل لهذا الشهر 🏆
// ══════════════════════════════════════════════════════════════════════════════
async function sendTopEmployeeMonth({ to, firstName, periodLabel, score, projectName }) {
  const body = `
    <div style="text-align:center;padding:16px 0;">
      <p style="font-size:60px;margin:0;">🏆</p>
      <h2 style="color:#253C32;font-size:24px;margin:8px 0;">الموظف الأفضل لشهر ${periodLabel}</h2>
    </div>
    <p style="font-size:16px;color:#14221D;text-align:center;">مبارك لك <strong>${firstName}</strong> !</p>
    <p style="color:#4B5952;line-height:1.8;text-align:center;">
      حققت أعلى درجة في فريقك هذا الشهر بنتيجة <strong style="color:#253C32;font-size:18px;">${score}%</strong>
      ${projectName ? `في مشروع <strong>${projectName}</strong>` : ''}.
    </p>
    ${highlight('🌟 هذا الإنجاز شهادة على التزامك وتميزك — استمر في هذا المستوى وأنت قدوة لفريقك.', '#EBF3EE', '#253C32')}
    <p style="color:#7A8F87;font-size:13px;text-align:center;margin-top:20px;">تم إضافة شارة "النجم" لملفك الشخصي تقديراً لهذا الإنجاز.</p>
  `;
  return send({
    to, tag: 'top-employee',
    subject: `🏆 أنت الموظف الأفضل لشهر ${periodLabel} — تهانينا!`,
    html: baseTemplate({ title: `الموظف الأفضل — ${periodLabel} 🏆`, preheader: `تهانينا يا ${firstName} على هذا الإنجاز`, body, cta: 'عرض شاراتك وإنجازاتك', ctaUrl: `${BASE_URL}/motivation`, color: '#253C32' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٦. شارة تحفيزية جديدة
// ══════════════════════════════════════════════════════════════════════════════
async function sendBadgeAwarded({ to, firstName, badgeLabel, badgeIcon, badgeDesc, periodLabel }) {
  const body = `
    <p style="font-size:16px;color:#14221D;">تهانينا <strong>${firstName}</strong> ! 🎉</p>
    <div style="text-align:center;background:#EBF3EE;border-radius:16px;padding:28px;margin:20px 0;">
      <p style="font-size:56px;margin:0;">${badgeIcon}</p>
      <h2 style="color:#253C32;margin:8px 0;font-size:20px;">${badgeLabel}</h2>
      <p style="color:#4B5952;margin:0;font-size:13px;">${badgeDesc}</p>
    </div>
    <p style="color:#4B5952;line-height:1.7;text-align:center;">
      حصلت على هذه الشارة في فترة <strong>${periodLabel}</strong> تقديراً لأدائك المتميز.
    </p>
  `;
  return send({
    to, tag: 'badge-awarded',
    subject: `🎖️ شارة جديدة: ${badgeLabel} — تهانينا!`,
    html: baseTemplate({ title: `شارة جديدة في رصيدك 🎖️`, preheader: `حصلت على شارة: ${badgeLabel}`, body, cta: 'عرض جميع شاراتك', ctaUrl: `${BASE_URL}/motivation`, color: '#5D8A70' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٧. تذكير مسبق بمواعيد العناصر (قبل 48 ساعة)
// ══════════════════════════════════════════════════════════════════════════════
async function sendDeadlineReminder({ to, firstName, items, courseId }) {
  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;font-size:13px;color:#14221D;font-weight:600;">${i.elementName}</td>
      <td style="padding:8px 12px;font-size:13px;color:#253C32;font-weight:700;">${i.courseName}</td>
      <td style="padding:8px 12px;font-size:12px;color:#633646;font-weight:700;text-align:left;">${i.deadline}</td>
    </tr>`
  ).join('');
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">لديك عناصر إقفال تقترب مواعيدها النهائية. يُرجى التقديم في أقرب وقت.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#253C32;">
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">العنصر</th>
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">الدورة</th>
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:left;">آخر موعد</th>
      </tr></thead>
      <tbody style="background:#fff;">${itemRows}</tbody>
    </table>
    ${highlight('⏳ لا تتأخر — التقديم قبل الموعد المثالي يرفع درجة التوقيت في تقييمك.', '#FFF8E6', '#8B6914')}
  `;
  return send({
    to, tag: 'deadline-reminder',
    subject: `⏰ تذكير: ${items.length} عنصر إقفال يقترب موعده`,
    html: baseTemplate({ title: 'تذكير بمواعيد عناصر الإقفال ⏰', preheader: `${items.length} عنصر يستوجب التقديم قريباً`, body, cta: 'تقديم العناصر الآن', ctaUrl: `${BASE_URL}/courses/${courseId || ''}`, color: '#8B7D6B' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٨. إطلاق تحدي شهري جديد
// ══════════════════════════════════════════════════════════════════════════════
async function sendChallengeAnnouncement({ to, firstName, challengeTitle, targetDesc, periodLabel }) {
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">أطلقت الإدارة تحدياً جديداً لشهر <strong>${periodLabel}</strong>:</p>
    <div style="background:#EBF3EE;border-radius:16px;padding:24px;margin:20px 0;text-align:center;">
      <p style="font-size:36px;margin:0;">🎯</p>
      <h2 style="color:#253C32;margin:8px 0;">${challengeTitle}</h2>
      <p style="color:#4B5952;margin:0;font-size:14px;">${targetDesc}</p>
    </div>
    ${highlight('🤝 هذا تحدٍّ جماعي — نجاح الفريق يعني حصول الجميع على شارة "لاعب الفريق"!', '#EBF3EE', '#253C32')}
  `;
  return send({
    to, tag: 'challenge-launch',
    subject: `🎯 تحدي ${periodLabel}: ${challengeTitle}`,
    html: baseTemplate({ title: `تحدي الشهر — ${periodLabel} 🎯`, preheader: challengeTitle, body, cta: 'عرض التحدي ومتابعة التقدم', ctaUrl: `${BASE_URL}/motivation` }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ٩. أداء منخفض — للمشرف
// ══════════════════════════════════════════════════════════════════════════════
async function sendLowScoreAlert({ to, supervisorName, employeeName, employeeScore, periodLabel, projectName }) {
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${supervisorName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">يستوجب انتباهك أن أحد موظفي مشروع <strong>${projectName}</strong> حصل على درجة أقل من 60% هذا الشهر.</p>
    ${divider()}
    ${table([
      row('الموظف', employeeName, true),
      row('الفترة', periodLabel),
      row('الدرجة الإجمالية', `<span style="color:#633646;font-weight:800;font-size:16px;">${employeeScore}%</span>`, true),
    ])}
    ${highlight('📌 يُنصح بجلسة متابعة مع الموظف لمناقشة أسباب الأداء ووضع خطة تطوير.', '#FFF3F3', '#633646')}
  `;
  return send({
    to, tag: 'low-score-alert',
    subject: `⚠️ تنبيه أداء: ${employeeName} — ${employeeScore}%`,
    html: baseTemplate({ title: 'تنبيه: أداء يستوجب المتابعة ⚠️', preheader: `درجة ${employeeName}: ${employeeScore}%`, body, cta: 'عرض مؤشرات الفريق', ctaUrl: `${BASE_URL}/kpis`, color: '#633646' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ١٠. ملخص أداء الفريق الشهري — للمشرف
// ══════════════════════════════════════════════════════════════════════════════
async function sendTeamMonthlySummary({ to, supervisorName, periodLabel, avgScore, employeesCount, topEmployee, projectName, teamData }) {
  const teamRows = (teamData || []).map((e, i) =>
    `<tr style="background:${i%2===0?'#F7FAF8':'#fff'};">
      <td style="padding:8px 12px;font-size:13px;color:#14221D;font-weight:600;">${e.name}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:center;font-weight:700;color:${e.score>=80?'#5D8A70':e.score>=60?'#8B7D6B':'#633646'};">${e.score}%</td>
      <td style="padding:8px 12px;font-size:12px;color:#4B5952;">${e.levelLabel}</td>
    </tr>`
  ).join('');
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${supervisorName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">إليك ملخص أداء فريق مشروع <strong>${projectName}</strong> لشهر <strong>${periodLabel}</strong>:</p>
    <div style="display:flex;gap:16px;margin:16px 0;">
      <div style="background:#EBF3EE;border-radius:12px;padding:16px;text-align:center;flex:1;">
        <p style="margin:0;color:#4B5952;font-size:12px;">متوسط الفريق</p>
        <p style="margin:4px 0;color:#253C32;font-size:28px;font-weight:800;">${avgScore}%</p>
      </div>
      <div style="background:#EBF3EE;border-radius:12px;padding:16px;text-align:center;flex:1;">
        <p style="margin:0;color:#4B5952;font-size:12px;">الموظفون المُقيَّمون</p>
        <p style="margin:4px 0;color:#253C32;font-size:28px;font-weight:800;">${employeesCount}</p>
      </div>
    </div>
    ${topEmployee ? highlight(`🏆 الأفضل هذا الشهر: <strong>${topEmployee.name}</strong> بنتيجة ${topEmployee.score}%`, '#EBF3EE', '#253C32') : ''}
    ${teamData?.length ? `${divider()}<p style="font-weight:700;color:#253C32;margin-bottom:8px;">تفصيل الفريق:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead><tr style="background:#253C32;">
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">الموظف</th>
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:center;">الدرجة</th>
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">المستوى</th>
      </tr></thead>
      <tbody>${teamRows}</tbody>
    </table>` : ''}
  `;
  return send({
    to, tag: 'team-monthly-summary',
    subject: `📊 تقرير فريقك الشهري — ${periodLabel} (متوسط: ${avgScore}%)`,
    html: baseTemplate({ title: `ملخص أداء الفريق — ${periodLabel}`, preheader: `متوسط الفريق: ${avgScore}%`, body, cta: 'عرض التفاصيل الكاملة', ctaUrl: `${BASE_URL}/kpis` }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ١١. تذكير اعتمادات معلّقة — للمشرف
// ══════════════════════════════════════════════════════════════════════════════
async function sendPendingApprovalsReminder({ to, supervisorName, count, items }) {
  const itemRows = (items || []).slice(0,8).map(i =>
    `<tr><td style="padding:7px 12px;font-size:13px;color:#253C32;font-weight:600;">${i.elementName}</td>
     <td style="padding:7px 12px;font-size:12px;color:#4B5952;">${i.courseName}</td>
     <td style="padding:7px 12px;font-size:12px;color:#633646;font-weight:700;text-align:left;">${i.waitHours} ساعة</td></tr>`
  ).join('');
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${supervisorName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">لديك <strong style="color:#633646;">${count} عنصر</strong> بانتظار قرارك منذ أكثر من 48 ساعة.</p>
    ${itemRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#253C32;"><th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">العنصر</th><th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">الدورة</th><th style="padding:10px 12px;color:#fff;font-size:12px;text-align:left;">الانتظار</th></tr></thead>
      <tbody style="background:#fff;">${itemRows}</tbody>
    </table>` : ''}
    ${highlight('⚡ سرعة البت في الاعتمادات تؤثر على تقييم أدائك كمشرف في مؤشر الاستجابة.', '#FFF8E6', '#8B6914')}
  `;
  return send({
    to, tag: 'pending-approvals',
    subject: `⏳ ${count} اعتماد بانتظار قرارك — يُرجى المراجعة`,
    html: baseTemplate({ title: `اعتمادات معلّقة تستوجب قرارك ⏳`, preheader: `${count} عنصر ينتظر منذ أكثر من 48 ساعة`, body, cta: 'مراجعة الاعتمادات الآن', ctaUrl: `${BASE_URL}/approvals`, color: '#8B7D6B' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ١٢. التقرير القيادي الشهري — للمدير
// ══════════════════════════════════════════════════════════════════════════════
async function sendExecutiveMonthlyReport({ to, managerName, periodLabel, summary }) {
  const { totalCourses, closedCourses, pendingApprovals, avgScore, topProject, employeesEvaluated, overdueNotClosed } = summary;
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${managerName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">إليك الملخص التنفيذي لشهر <strong>${periodLabel}</strong>:</p>
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="8" style="margin:16px 0;">
      <tr>
        <td style="background:#EBF3EE;border-radius:12px;padding:16px;text-align:center;width:25%;">
          <p style="margin:0;font-size:11px;color:#4B5952;">إجمالي الدورات</p>
          <p style="margin:4px 0;font-size:24px;font-weight:800;color:#253C32;">${totalCourses}</p>
        </td>
        <td style="background:#EBF3EE;border-radius:12px;padding:16px;text-align:center;width:25%;">
          <p style="margin:0;font-size:11px;color:#4B5952;">دورات مغلقة</p>
          <p style="margin:4px 0;font-size:24px;font-weight:800;color:#5D8A70;">${closedCourses}</p>
        </td>
        <td style="background:#EBF3EE;border-radius:12px;padding:16px;text-align:center;width:25%;">
          <p style="margin:0;font-size:11px;color:#4B5952;">متوسط KPI</p>
          <p style="margin:4px 0;font-size:24px;font-weight:800;color:#253C32;">${avgScore}%</p>
        </td>
        <td style="background:${overdueNotClosed>0?'#FFF0F0':'#EBF3EE'};border-radius:12px;padding:16px;text-align:center;width:25%;">
          <p style="margin:0;font-size:11px;color:#4B5952;">متأخرة</p>
          <p style="margin:4px 0;font-size:24px;font-weight:800;color:${overdueNotClosed>0?'#633646':'#253C32'};">${overdueNotClosed}</p>
        </td>
      </tr>
    </table>
    ${topProject ? highlight(`🏆 المشروع الأفضل هذا الشهر: <strong>${topProject.name}</strong> بمتوسط <strong>${topProject.avgScore}%</strong>`, '#EBF3EE', '#253C32') : ''}
    ${pendingApprovals > 0 ? highlight(`⏳ يوجد <strong>${pendingApprovals} اعتماد</strong> معلق في طابور المراجعة.`, '#FFF8E6', '#8B6914') : ''}
  `;
  return send({
    to, tag: 'executive-monthly',
    subject: `📊 التقرير القيادي الشهري — ${periodLabel}`,
    html: baseTemplate({ title: `التقرير القيادي — ${periodLabel} 📊`, preheader: `متوسط KPI: ${avgScore}% · ${employeesEvaluated} موظف مُقيَّم`, body, cta: 'عرض التقرير الكامل', ctaUrl: `${BASE_URL}/executive-report` }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ١٣. دورات تنتهي قريباً بدون إغلاق — للمشرف/المدير
// ══════════════════════════════════════════════════════════════════════════════
async function sendExpiringCoursesAlert({ to, recipientName, courses }) {
  const courseRows = courses.slice(0,8).map(c =>
    `<tr><td style="padding:8px 12px;font-size:13px;color:#14221D;font-weight:600;">${c.name}</td>
     <td style="padding:8px 12px;font-size:12px;color:#4B5952;">${c.employeeName}</td>
     <td style="padding:8px 12px;font-size:12px;color:#633646;font-weight:700;text-align:left;">${c.endDate}</td></tr>`
  ).join('');
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${recipientName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">يوجد <strong>${courses.length} دورة</strong> ستنتهي خلال الأسبوع القادم ولم يُكتمل إغلاقها بعد.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#253C32;">
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">الدورة</th>
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right;">المسؤول</th>
        <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:left;">تاريخ الانتهاء</th>
      </tr></thead>
      <tbody style="background:#fff;">${courseRows}</tbody>
    </table>
    ${highlight('🚨 الدورات غير المغلقة بعد انتهائها تؤثر على تقييم الانضباط لموظفيها.', '#FFF3F3', '#633646')}
  `;
  return send({
    to, tag: 'expiring-courses',
    subject: `🚨 ${courses.length} دورة ستنتهي هذا الأسبوع دون إغلاق`,
    html: baseTemplate({ title: 'دورات تنتهي قريباً 🚨', preheader: `${courses.length} دورة تستوجب المتابعة`, body, cta: 'عرض الدورات', ctaUrl: `${BASE_URL}/courses`, color: '#633646' }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ١٤. مبادرة مُعتمدة/مُنفَّذة
// ══════════════════════════════════════════════════════════════════════════════
async function sendIdeaStatusUpdate({ to, firstName, ideaTitle, status, reviewNotes }) {
  const statusMeta = {
    APPROVED:    { text: 'تم اعتماد مبادرتك ✅', color: '#253C32', icon: '✅' },
    IMPLEMENTED: { text: 'تم تنفيذ مبادرتك 🚀', color: '#5D8A70', icon: '🚀' },
    REJECTED:    { text: 'لم يتم قبول مبادرتك', color: '#633646', icon: '📝' },
  };
  const meta = statusMeta[status] || statusMeta.APPROVED;
  const body = `
    <p style="font-size:16px;color:#14221D;">مرحباً <strong>${firstName}</strong>،</p>
    <p style="color:#4B5952;line-height:1.7;">${meta.text}</p>
    ${highlight(`${meta.icon} <strong>${ideaTitle}</strong>`, '#EBF3EE', meta.color)}
    ${reviewNotes ? `<p style="color:#4B5952;font-size:14px;"><strong>ملاحظة الإدارة:</strong> ${reviewNotes}</p>` : ''}
    ${status === 'IMPLEMENTED' ? `<p style="color:#4B5952;line-height:1.7;">تم إضافة شارة <strong>"المبدع 💡"</strong> لملفك تقديراً لهذه المبادرة.</p>` : ''}
  `;
  return send({
    to, tag: 'idea-update',
    subject: `${meta.icon} مبادرتك "${ideaTitle}" — ${meta.text}`,
    html: baseTemplate({ title: `تحديث حالة مبادرتك ${meta.icon}`, preheader: meta.text, body, cta: 'عرض مبادرتك', ctaUrl: `${BASE_URL}/motivation`, color: meta.color }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ١٥. تحدٍّ شهري تحقق — للفريق
// ══════════════════════════════════════════════════════════════════════════════
async function sendChallengeAchieved({ to, firstName, challengeTitle, periodLabel, achievedValue, targetValue }) {
  const body = `
    <div style="text-align:center;padding:16px 0;">
      <p style="font-size:56px;margin:0;">🎉</p>
      <h2 style="color:#253C32;">الفريق حقق التحدي!</h2>
    </div>
    <p style="font-size:16px;color:#14221D;text-align:center;">مبارك لك <strong>${firstName}</strong>!</p>
    <p style="color:#4B5952;line-height:1.7;text-align:center;">حقق فريقك تحدي شهر <strong>${periodLabel}</strong> بنجاح:</p>
    ${highlight(`🎯 <strong>${challengeTitle}</strong><br>النتيجة المحققة: <strong>${Number(achievedValue).toFixed(1)}%</strong> من هدف ${targetValue}%`, '#EBF3EE', '#253C32')}
    <p style="color:#4B5952;font-size:13px;text-align:center;margin-top:16px;">تم إضافة شارة <strong>"لاعب الفريق 🤝"</strong> لملفك الشخصي.</p>
  `;
  return send({
    to, tag: 'challenge-achieved',
    subject: `🎉 الفريق حقق التحدي! — ${challengeTitle}`,
    html: baseTemplate({ title: `تحدي ${periodLabel} تحقق! 🎉`, preheader: `مبارك! الفريق نجح في ${challengeTitle}`, body, cta: 'عرض شاراتك', ctaUrl: `${BASE_URL}/motivation`, color: '#5D8A70' }),
  });
}

// ── تصدير جميع الدوال ────────────────────────────────────────────────────────
module.exports = {
  sendWelcome,
  sendPasswordReset,
  sendElementReturned,
  sendElementRejected,
  sendMonthlyKpiEmployee,
  sendTopEmployeeMonth,
  sendBadgeAwarded,
  sendDeadlineReminder,
  sendChallengeAnnouncement,
  sendLowScoreAlert,
  sendTeamMonthlySummary,
  sendPendingApprovalsReminder,
  sendExecutiveMonthlyReport,
  sendExpiringCoursesAlert,
  sendIdeaStatusUpdate,
  sendChallengeAchieved,
};
