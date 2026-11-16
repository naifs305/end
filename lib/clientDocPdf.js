// =============================================================
// تحويل مستند من صفحة واحدة (كشهادة الإنجاز) إلى PDF في المتصفح
// -------------------------------------------------------------
// مولّدات PDF البرمجية تكسر الحروف العربية، فلا نرسم النص بها.
// بل نترك المتصفح يرسم المستند بنفسه (عبر foreignObject في SVG)
// ثم نضع الصورة الناتجة في ورقة A4 — فيطابق الملف ما يُرى ويُطبع.
// المستند يصل «مستقلاً»: المطبوعة والخط مضمّنان فيه.
// =============================================================

const A4_PX = { w: 794, h: 1123 }; // ٢١٠×٢٩٧ ملم بدقة ٩٦ نقطة
const SCALE = 2.5;                 // دقة الطباعة: نحو ٢٤٠ نقطة في البوصة

function escapeXmlText(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر رسم المستند'));
    img.src = src;
  });
}

export async function singlePageHtmlToPdfDataUrl(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const styles = [...parsed.querySelectorAll('style')].map((s) => s.textContent).join('\n');
  const sheet = parsed.querySelector('.sheet');
  if (!sheet) throw new Error('المستند بلا صفحة');

  const body = new XMLSerializer().serializeToString(sheet);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_PX.w * SCALE}" height="${A4_PX.h * SCALE}" viewBox="0 0 ${A4_PX.w} ${A4_PX.h}">`
    + `<foreignObject x="0" y="0" width="${A4_PX.w}" height="${A4_PX.h}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" lang="ar" style="width:${A4_PX.w}px;height:${A4_PX.h}px;overflow:hidden;background:#fff;color:#11202b;font-family:'Boutros Jazirah Text',Tahoma,Arial,sans-serif;font-size:14.5px;line-height:1.95;">`
    + `<style>${escapeXmlText(styles)} .sheet{margin:0 !important;}</style>`
    + body
    + '</div></foreignObject></svg>';

  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // يُحمَّل مرتين: الأولى تُنزل الخط المضمّن، والثانية تُرسم به
  await loadImage(src);
  await new Promise((r) => setTimeout(r, 250));
  const img = await loadImage(src);

  const canvas = document.createElement('canvas');
  canvas.width = A4_PX.w * SCALE;
  canvas.height = A4_PX.h * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL('image/jpeg', 0.9);

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.addImage(jpeg, 'JPEG', 0, 0, 210, 297);
  const base64 = pdf.output('datauristring').split('base64,')[1];
  return `data:application/pdf;base64,${base64}`;
}

// =============================================================
// مستند من عدة صفحات (كعقد المترجم) إلى PDF في المتصفح
// -------------------------------------------------------------
// يُعرض المستند المستقل في إطار مخفي بعرض A4، ثم يُوزَّع محتواه على
// صفحات بقياس ارتفاع كل كتلة: الفقرة، وعنوان المادة مع أول ما يليه،
// والقائمة الطويلة تُقسم بين صفحتين مع حفظ ترقيمها. وكل صفحة تُرسم
// بالمطبوعة (الترويسة والتذييل) كما تُطبع، ثم تُجمع في ملف واحد.
// =============================================================
const MM = 96 / 25.4;

function waitFrame(iframe) {
  return new Promise((resolve) => { iframe.onload = () => resolve(); });
}

async function drawSvgPage(svg, scale) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loadImage(src);
  await new Promise((r) => setTimeout(r, 200));
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = A4_PX.w * scale;
  canvas.height = A4_PX.h * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export async function multiPageHtmlToPdfDataUrl(html, { topMm = 52, bottomMm = 36, scale = 2, onPage = null } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${A4_PX.w}px;height:${A4_PX.h}px;border:0;visibility:hidden;`;
  document.body.appendChild(iframe);
  try {
    const loaded = waitFrame(iframe);
    iframe.srcdoc = html;
    await loaded;
    const doc = iframe.contentDocument;
    // مظهر الطباعة: بلا إطارات التحرير
    const fix = doc.createElement('style');
    fix.textContent = '.toolbar{display:none!important}.editable,.inline-edit{border:0!important;background:transparent!important;padding:0!important}body{background:#fff!important}';
    doc.head.appendChild(fix);
    if (doc.fonts?.ready) await doc.fonts.ready;
    await new Promise((r) => setTimeout(r, 150));

    const td = doc.querySelector('table.frame > tbody > tr > td');
    if (!td) throw new Error('المستند بلا متن');
    const usable = A4_PX.h - (topMm + bottomMm) * MM;
    const outerH = (el) => {
      const cs = doc.defaultView.getComputedStyle(el);
      return el.getBoundingClientRect().height + parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
    };

    // الكتل: كل ابن مباشر، والطويل الذي فيه قائمة يُقسم عناصرَ تحفظ ترقيمها
    const units = [];
    for (const el of [...td.children]) {
      const h = outerH(el);
      const list = el.matches('ol,ul') ? el : el.querySelector(':scope > ol, :scope > ul');
      if (h > usable * 0.6 && list && list.children.length > 1) {
        const before = [...el.childNodes].filter((n) => n !== list && !(n.nodeType === 1 && n.contains(list)));
        const lead = before.map((n) => (n.nodeType === 1 ? n.outerHTML : (n.textContent.trim() ? `<p>${n.textContent}</p>` : ''))).join('');
        let start = Number(list.getAttribute('start') || 1);
        [...list.children].forEach((li, k) => {
          const tag = list.tagName.toLowerCase();
          const wrapOpen = el === list ? '' : `<div class="${el.className}">`;
          const wrapClose = el === list ? '' : '</div>';
          const listHtml = `<${tag}${tag === 'ol' ? ` start="${start + k}"` : ''} style="margin:0;padding-inline-start:22px">${li.outerHTML}</${tag}>`;
          units.push({ html: `${wrapOpen}${k === 0 ? lead : ''}${listHtml}${wrapClose}`, h: outerH(li) + (k === 0 ? 14 : 2) });
        });
        start += list.children.length;
      } else {
        units.push({ html: el.outerHTML, h, keepNext: el.classList.contains('article-head') });
      }
    }

    // التوزيع على الصفحات: عنوان المادة لا يبقى وحده آخر الصفحة
    const pages = [[]];
    let used = 0;
    units.forEach((u, i) => {
      const need = u.keepNext && units[i + 1] ? u.h + units[i + 1].h : u.h;
      if (used > 0 && used + need > usable) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(u.html);
      used += u.h;
    });

    const styles = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    for (let p = 0; p < pages.length; p += 1) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_PX.w * scale}" height="${A4_PX.h * scale}" viewBox="0 0 ${A4_PX.w} ${A4_PX.h}">`
        + `<foreignObject x="0" y="0" width="${A4_PX.w}" height="${A4_PX.h}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" lang="ar" style="width:${A4_PX.w}px;height:${A4_PX.h}px;overflow:hidden;background:#fff;color:#11202b;font-family:'Boutros Jazirah Text',Tahoma,Arial,sans-serif;font-size:14.5px;line-height:1.95;">`
        + `<style>${escapeXmlText(styles)}</style>`
        + `<div class="sheet" style="width:${A4_PX.w}px;max-width:none;height:${A4_PX.h}px;min-height:0;margin:0;overflow:hidden;">`
        + `<div style="height:${topMm}mm"></div>`
        + new XMLSerializer().serializeToString(new DOMParser().parseFromString(`<div>${pages[p].join('')}</div>`, 'text/html').body.firstChild)
        + '</div></div></foreignObject></svg>';
      const jpeg = await drawSvgPage(svg, scale);
      if (onPage) onPage(jpeg, p);
      if (p > 0) pdf.addPage();
      pdf.addImage(jpeg, 'JPEG', 0, 0, 210, 297);
    }
    const base64 = pdf.output('datauristring').split('base64,')[1];
    return `data:application/pdf;base64,${base64}`;
  } finally {
    iframe.remove();
  }
}
