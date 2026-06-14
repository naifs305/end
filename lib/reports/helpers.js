// =============================================================
// مكتبة مساعدات توليد التقارير القيادية
// -------------------------------------------------------------
// دوال مساعدة مشتركة بين تقريري الافتتاح والاختتام
// =============================================================

function escapeHtml(value) {
  if (value === null || value === undefined) return '-';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRatingLabel(value) {
  const map = {
    excellent: 'ممتاز',
    good: 'جيد',
    needs_improvement: 'يحتاج تحسين',
    weak: 'ضعيف',
    requires_development: 'يحتاج تطوير',
  };
  return map[value] || '-';
}

function getRatingClass(value) {
  const map = {
    excellent: 'badge excellent',
    good: 'badge good',
    needs_improvement: 'badge improve',
    weak: 'badge weak',
    requires_development: 'badge develop',
  };
  return map[value || ''] || 'badge';
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ar-SA');
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-SA');
}

function formatLocationType(value) {
  const map = {
    INTERNAL: 'داخلي',
    EXTERNAL: 'خارجي',
    REMOTE: 'عن بُعد',
    internal: 'داخلي',
    external: 'خارجي',
    remote: 'عن بُعد',
  };
  return map[value] || value || '-';
}

function calculateDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return '-';
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (isNaN(ms)) return '-';
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
  return `${days} يوم`;
}

function toListItems(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\n|،|؛/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function renderList(items, emptyMessage) {
  if (!items || items.length === 0) {
    return `<div class="empty-note">${escapeHtml(emptyMessage)}</div>`;
  }
  return `<ol class="list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
}

// ======================================================================
// الأنماط المشتركة (CSS) لكل التقارير
// ======================================================================

const sharedCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

  @page {
    size: A4;
    margin: 14mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: 'Cairo', Tahoma, Arial, sans-serif;
    background: #eef3f2;
    color: #1f2937;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    background: #ffffff;
    padding: 16px 18px 20px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 3px solid #016564;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .brand-text { flex: 1; }

  .brand-title {
    margin: 0;
    color: #016564;
    font-size: 24px;
    font-weight: 800;
    line-height: 1.2;
  }

  .brand-subtitle {
    margin: 4px 0 0;
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
  }

  .logo {
    width: 150px;
    height: auto;
    object-fit: contain;
  }

  .title-box {
    margin: 10px 0 12px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #016564 0%, #498983 100%);
    color: #ffffff;
    border-radius: 14px;
  }

  .title-box h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    line-height: 1.35;
  }

  .title-box p {
    margin: 6px 0 0;
    font-size: 12px;
    opacity: 0.95;
  }

  .letter {
    padding: 12px 14px;
    background: #f5f9f8;
    border-right: 4px solid #016564;
    border-radius: 10px;
    margin-bottom: 12px;
  }

  .paragraph {
    margin: 0 0 8px;
    font-size: 13.5px;
    line-height: 1.85;
  }

  .section {
    margin-top: 14px;
    border: 1px solid #d9e3e1;
    border-radius: 14px;
    overflow: hidden;
    page-break-inside: avoid;
  }

  .section-header {
    background: #f0f6f5;
    color: #016564;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 800;
    border-bottom: 1px solid #d9e3e1;
  }

  .section-body {
    padding: 12px 14px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .card {
    background: #fafbfb;
    border: 1px solid #e4ebea;
    border-radius: 10px;
    padding: 10px 12px;
  }

  .card .label {
    color: #6b7280;
    font-size: 10.5px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .card .value {
    color: #013b3c;
    font-size: 13px;
    font-weight: 700;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
  }

  .stat-card {
    text-align: center;
    padding: 12px 8px;
    background: linear-gradient(180deg, #ffffff 0%, #f0f6f5 100%);
    border: 1px solid #d9e3e1;
    border-radius: 12px;
  }

  .stat-number {
    color: #016564;
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 6px;
  }

  .stat-label {
    color: #374151;
    font-size: 11px;
    font-weight: 700;
  }

  .evaluations-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .evaluation-card {
    background: #fafbfb;
    border: 1px solid #e4ebea;
    border-radius: 10px;
    padding: 10px 12px;
  }

  .evaluation-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .evaluation-title {
    color: #013b3c;
    font-size: 12.5px;
    font-weight: 800;
  }

  .badge {
    display: inline-block;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 800;
    border-radius: 999px;
    color: #ffffff;
    background: #6b7280;
  }

  .badge.excellent { background: #047857; }
  .badge.good { background: #2563eb; }
  .badge.improve { background: #d97706; }
  .badge.weak { background: #b91c1c; }
  .badge.develop { background: #7c3aed; }

  .note-box {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.65;
    color: #334155;
  }

  .list {
    margin: 0;
    padding: 0 20px 0 0;
    font-size: 12.5px;
    line-height: 1.85;
  }

  .list li {
    margin-bottom: 4px;
  }

  .empty-note {
    color: #6b7280;
    font-size: 12px;
    font-style: italic;
  }

  .footer-note {
    margin-top: 14px;
    padding: 10px 12px;
    background: #fefbf4;
    border-right: 4px solid #d0b284;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
  }

  .closing {
    margin-top: 12px;
    font-size: 14px;
  }

  .signature {
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px dashed #cfd8d6;
    color: #016564;
    font-weight: 800;
    font-size: 14px;
  }

  @media print {
    body { background: #ffffff; }
    .page { padding: 0; }
  }
`;

// ======================================================================
// الترويسة المشتركة
// ======================================================================

function renderHeader(title, subtitle) {
  return `
    <div class="header">
      <div class="brand-text">
        <h1 class="brand-title">${escapeHtml(title)}</h1>
        <p class="brand-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <img
        class="logo"
        src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
        alt="شعار جامعة نايف"
      />
    </div>
  `;
}

function renderTitleBox(courseName, tagline) {
  return `
    <div class="title-box">
      <h2>${escapeHtml(courseName)}</h2>
      <p>${escapeHtml(tagline)}</p>
    </div>
  `;
}

function renderClosing() {
  return `
    <div class="closing">
      <p class="paragraph">وتفضلوا بقبول فائق الاحترام والتقدير،،،</p>
      <div class="signature">فريق عمل إدارة عمليات التدريب — وكالة الجامعة للتدريب</div>
    </div>
  `;
}

function renderAutoPrintScript() {
  return `
    <script>
      window.onload = function () {
        setTimeout(function () {
          window.print();
        }, 500);
      };
    </script>
  `;
}

module.exports = {
  escapeHtml,
  getRatingLabel,
  getRatingClass,
  formatDate,
  formatDateTime,
  formatLocationType,
  calculateDurationDays,
  toListItems,
  renderList,
  sharedCSS,
  renderHeader,
  renderTitleBox,
  renderClosing,
  renderAutoPrintScript,
};
