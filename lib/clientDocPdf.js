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
