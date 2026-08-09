// src/utils/pdfBrand.js
//
// Shared low-level jsPDF drawing helpers for every branded PDF export in
// the app (single drug — exportDrugPdf.js, a saved list/folder —
// exportListPdf.js). Kept in one place so the look stays identical across
// exports and a palette tweak only has to happen once.
//
// Colors mirror the live app's own palette (tailwind.config.js `primary`
// scale, and Layout.js's `bg-primary-900` header).

export const NAVY   = [30, 58, 138];   // primary-900 — matches the in-app header bar
export const BLUE   = [37, 99, 235];   // primary-600 — links/accents
export const BLUE_L = [239, 246, 255]; // primary-50 — light section tint
export const INK    = [17, 24, 39];    // body text
export const MUTED  = [107, 114, 128]; // secondary text
export const LINE   = [226, 232, 240]; // hairlines
export const WHITE  = [255, 255, 255];
export const AMBER_L = [255, 251, 235]; // note callout background
export const AMBER_FG = [146, 64, 14];  // note callout text

export const PAGE_W = 210, PAGE_H = 297; // A4, mm
export const MARGIN = 16;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const FOOTER_Y = PAGE_H - 12;

export const STATUS_COLORS = {
  OTC:        { bg: [220, 252, 231], fg: [21, 128, 61] },
  Controlled: { bg: [254, 226, 226], fg: [185, 28, 28] },
  default:    { bg: [219, 234, 254], fg: [29, 78, 216] },
};

export function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.default;
}

export function newPageState() {
  return { y: MARGIN };
}

export function drawFooter(doc, pageNum, pageCount) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    'Reference material only — not a substitute for current prescribing information or clinical judgment.',
    MARGIN, FOOTER_Y
  );
  doc.text(`MedIndex · ${pageNum}/${pageCount}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
}

// Slim running header repeated on every page after the first, so a printed
// or scrolled-through PDF never loses context of what it's looking at.
export function drawRunningHeader(doc, rightLabel) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('MedIndex', MARGIN, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(rightLabel, PAGE_W - MARGIN, 8, { align: 'right' });
}

export function ensureSpace(doc, state, needed, ctx) {
  if (state.y + needed <= FOOTER_Y - 6) return;
  doc.addPage();
  ctx.pageCount++;
  drawRunningHeader(doc, ctx.runningHeaderLabel);
  state.y = 18;
}

// Splits text on **bold** markers into [{ text, bold }] segments — same
// convention src/utils/renderAiText.js uses for on-screen rendering.
export function splitBoldSegments(line) {
  return line.split(/\*\*(.+?)\*\*/g).map((text, i) => ({ text, bold: i % 2 === 1 })).filter(s => s.text);
}

// Wraps a line's bold/plain segments across the given width, returning an
// array of wrapped rows, each row itself an array of {text, bold} chunks —
// so bold formatting survives word-wrap instead of being flattened first.
export function wrapSegments(doc, segments, maxWidth, fontSize) {
  doc.setFontSize(fontSize);
  const rows = [[]];
  let rowWidth = 0;
  const spaceW = doc.getStringUnitWidth(' ') * fontSize / doc.internal.scaleFactor;

  segments.forEach(seg => {
    doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
    seg.text.split(/(\s+)/).forEach(token => {
      if (token === '') return;
      if (/^\s+$/.test(token)) {
        rowWidth += spaceW;
        rows[rows.length - 1].push({ text: ' ', bold: seg.bold, isSpace: true });
        return;
      }
      const w = doc.getStringUnitWidth(token) * fontSize / doc.internal.scaleFactor;
      if (rowWidth + w > maxWidth && rows[rows.length - 1].length > 0) {
        rows.push([]);
        rowWidth = 0;
      }
      rows[rows.length - 1].push({ text: token, bold: seg.bold });
      rowWidth += w;
    });
  });
  return rows.filter(r => r.length > 0);
}

export function drawWrappedRow(doc, row, x, y, fontSize, color) {
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  let cx = x;
  row.forEach(chunk => {
    doc.setFont('helvetica', chunk.bold ? 'bold' : 'normal');
    doc.text(chunk.text, cx, y);
    cx += doc.getStringUnitWidth(chunk.text) * fontSize / doc.internal.scaleFactor;
  });
}

// Renders one field's free-text value: paragraphs, "- " bullets, and
// inline **bold** — mirroring renderAiText.js's parsing rules exactly.
export function drawFieldBody(doc, state, ctx, text, { fontSize = 9.5, lineH = 4.6, width = CONTENT_W, x = MARGIN } = {}) {
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    const isBullet = /^[-*]\s+/.test(line);
    const raw = isBullet ? line.replace(/^[-*]\s+/, '') : line;
    const indent = isBullet ? 4 : 0;
    const rows = wrapSegments(doc, splitBoldSegments(raw), width - indent, fontSize);

    rows.forEach((row, i) => {
      ensureSpace(doc, state, lineH, ctx);
      if (isBullet && i === 0) {
        doc.setFontSize(fontSize);
        doc.setTextColor(...BLUE);
        doc.text('•', x, state.y);
      }
      drawWrappedRow(doc, row, x + indent, state.y, fontSize, INK);
      state.y += lineH;
    });
    state.y += 1.2; // small gap between lines/paragraphs
  });
}

export function drawFieldLabel(doc, state, ctx, label) {
  ensureSpace(doc, state, 7, ctx);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(label, MARGIN, state.y);
  state.y += 5.5;
}

export function drawSectionHeader(doc, state, ctx, label) {
  ensureSpace(doc, state, 14, ctx);
  state.y += 2;
  doc.setFillColor(...BLUE_L);
  doc.rect(MARGIN, state.y - 5, CONTENT_W, 9, 'F');
  doc.setFillColor(...BLUE);
  doc.rect(MARGIN, state.y - 5, 1.4, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...NAVY);
  doc.text(label, MARGIN + 4, state.y + 1);
  state.y += 10;
}

export function drawPill(doc, x, y, text, fontSize, colors) {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  const padX = 3;
  const w = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor + padX * 2;
  const h = fontSize / doc.internal.scaleFactor * 3.4;
  doc.setFillColor(...colors.bg);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  doc.setTextColor(...colors.fg);
  doc.text(text, x + padX, y + h / 2 + fontSize * 0.11);
  return { width: w, height: h };
}

// The navy cover banner shared by every export's first page.
export function drawCoverHeader(doc, tagline) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 40, 'F');
  doc.setFillColor(...BLUE);
  doc.rect(0, 40, PAGE_W, 1.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('MedIndex', MARGIN, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(219, 234, 254); // primary-100-ish on navy
  doc.text(tagline, MARGIN, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(191, 219, 254); // primary-200-ish
  const genDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Generated ${genDate}`, PAGE_W - MARGIN, 18, { align: 'right' });
}

export function slugify(name) {
  return String(name || 'file').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Opens the native share sheet with the PDF as a file when the platform
 * supports it (most mobile browsers + the Capacitor app); falls back to a
 * plain download everywhere else (most desktop browsers).
 */
export async function shareOrDownloadPdf(doc, { fileName, title, text }) {
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // Fall through to download on any other share failure.
    }
  }

  doc.save(fileName);
  return 'downloaded';
}
