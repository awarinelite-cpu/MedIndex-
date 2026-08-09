// src/utils/exportDrugPdf.js
//
// Builds a branded, multi-page PDF of one drug's complete record — every
// populated field across all six TAB_SECTIONS groups (Overview, Dosage,
// Safety, Interactions, Pharmacology, Nursing Notes) — for sharing outside
// the app. Drawn with jsPDF's vector text/shape API rather than rasterizing
// the DOM (html2canvas), so it stays crisp at any zoom, is a small file
// size, and paginates cleanly instead of slicing a screenshot mid-section.
//
// Colors mirror the live app's own palette (tailwind.config.js `primary`
// scale, and Layout.js's `bg-primary-900` header) so the PDF reads as an
// extension of the app rather than a generic export.

import { jsPDF } from 'jspdf';
import { TAB_SECTIONS } from './aiSectionFill';

const NAVY   = [30, 58, 138];   // primary-900 — matches the in-app header bar
const BLUE   = [37, 99, 235];   // primary-600 — links/accents
const BLUE_L = [239, 246, 255]; // primary-50 — light section tint
const INK    = [17, 24, 39];    // body text
const MUTED  = [107, 114, 128]; // secondary text
const LINE   = [226, 232, 240]; // hairlines
const WHITE  = [255, 255, 255];

const PAGE_W = 210, PAGE_H = 297; // A4, mm
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 12;

const STATUS_COLORS = {
  OTC:        { bg: [220, 252, 231], fg: [21, 128, 61] },
  Controlled: { bg: [254, 226, 226], fg: [185, 28, 28] },
  default:    { bg: [219, 234, 254], fg: [29, 78, 216] },
};

function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.default;
}

// ── low-level helpers ───────────────────────────────────────────────────

function newPageState() {
  return { y: MARGIN };
}

function drawFooter(doc, pageNum, pageCount) {
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
// or scrolled-through PDF never loses context of what drug it is.
function drawRunningHeader(doc, drugName) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('MedIndex', MARGIN, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(drugName, PAGE_W - MARGIN, 8, { align: 'right' });
}

function ensureSpace(doc, state, needed, ctx) {
  if (state.y + needed <= FOOTER_Y - 6) return;
  doc.addPage();
  ctx.pageCount++;
  drawRunningHeader(doc, ctx.drugName);
  state.y = 18;
}

// Splits text on **bold** markers into [{ text, bold }] segments — same
// convention src/utils/renderAiText.js uses for on-screen rendering.
function splitBoldSegments(line) {
  return line.split(/\*\*(.+?)\*\*/g).map((text, i) => ({ text, bold: i % 2 === 1 })).filter(s => s.text);
}

// Wraps a line's bold/plain segments across the given width, returning an
// array of wrapped rows, each row itself an array of {text, bold} chunks —
// so bold formatting survives word-wrap instead of being flattened first.
function wrapSegments(doc, segments, maxWidth, fontSize) {
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

function drawWrappedRow(doc, row, x, y, fontSize, color) {
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
function drawFieldBody(doc, state, ctx, text, { fontSize = 9.5, lineH = 4.6 } = {}) {
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    const isBullet = /^[-*]\s+/.test(line);
    const raw = isBullet ? line.replace(/^[-*]\s+/, '') : line;
    const indent = isBullet ? 4 : 0;
    const width = CONTENT_W - indent;
    const rows = wrapSegments(doc, splitBoldSegments(raw), width, fontSize);

    rows.forEach((row, i) => {
      ensureSpace(doc, state, lineH, ctx);
      if (isBullet && i === 0) {
        doc.setFontSize(fontSize);
        doc.setTextColor(...BLUE);
        doc.text('•', MARGIN, state.y);
      }
      drawWrappedRow(doc, row, MARGIN + indent, state.y, fontSize, INK);
      state.y += lineH;
    });
    state.y += 1.2; // small gap between lines/paragraphs
  });
}

function drawFieldLabel(doc, state, ctx, label) {
  ensureSpace(doc, state, 7, ctx);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(label, MARGIN, state.y);
  state.y += 5.5;
}

function drawSectionHeader(doc, state, ctx, label) {
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

function drawPill(doc, x, y, text, fontSize, colors) {
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

// ── main export ─────────────────────────────────────────────────────────

/**
 * @param {Object} drug — the drug record (same shape as everywhere else in the app)
 * @returns {jsPDF} — call .save(filename) or .output('blob') on the result
 */
export function buildDrugPdf(drug) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx = { drugName: drug.generic_name, pageCount: 1 };
  const state = newPageState();

  // ── Cover header band ────────────────────────────────────────────────
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
  doc.text('Clinical Drug Reference', MARGIN, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(191, 219, 254); // primary-200-ish
  const genDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Generated ${genDate}`, PAGE_W - MARGIN, 18, { align: 'right' });

  state.y = 52;

  // ── Drug identity block ─────────────────────────────────────────────
  const pillsTopY = state.y;
  let pillX = MARGIN;
  const status = statusColor(drug.prescription_status);
  const statusPill = drawPill(doc, pillX, pillsTopY, drug.prescription_status || 'Reference', 8, status);
  pillX += statusPill.width + 3;
  let pillsHeight = statusPill.height;
  if (drug.prescription_status === 'Controlled') {
    const cp = drawPill(doc, pillX, pillsTopY, 'Controlled Substance', 8, { bg: [254, 242, 242], fg: [185, 28, 28] });
    pillsHeight = Math.max(pillsHeight, cp.height);
  }
  state.y = pillsTopY + pillsHeight + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(drug.generic_name || 'Unknown drug', MARGIN, state.y);
  state.y += 7;

  if (drug.pronunciation) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(`/${drug.pronunciation}/`, MARGIN, state.y);
    state.y += 6;
  }

  if (drug.drug_class) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLUE);
    const classRows = wrapSegments(doc, [{ text: drug.drug_class, bold: false }], CONTENT_W, 11);
    classRows.forEach(row => {
      drawWrappedRow(doc, row.map(c => ({ ...c, bold: true })), MARGIN, state.y, 11, BLUE);
      state.y += 5.5;
    });
  }
  if (drug.brand_names) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Brand names: ${drug.brand_names}`, MARGIN, state.y);
    state.y += 6;
  }

  // Strength pills
  const strengths = String(drug.strength || '').split(/\n|;|\|/).map(s => s.trim()).filter(Boolean);
  if (strengths.length) {
    let x = MARGIN;
    doc.setFont('helvetica', 'normal');
    strengths.forEach(s => {
      const w = doc.getStringUnitWidth(s) * 8 / doc.internal.scaleFactor + 6;
      if (x + w > PAGE_W - MARGIN) { x = MARGIN; state.y += 8; }
      drawPill(doc, x, state.y, s, 8, { bg: [245, 243, 255], fg: [109, 40, 217] });
      x += w + 2.5;
    });
    state.y += 10;
  }

  state.y += 2;
  doc.setDrawColor(...LINE);
  doc.line(MARGIN, state.y, PAGE_W - MARGIN, state.y);
  state.y += 8;

  // ── Body — every populated field, grouped by tab ────────────────────
  Object.values(TAB_SECTIONS).forEach(section => {
    const populated = section.fields
      .map((field, i) => ({ field, header: section.headers[i], value: drug[field] }))
      .filter(f => f.value && String(f.value).trim());
    if (!populated.length) return;

    drawSectionHeader(doc, state, ctx, section.label);
    populated.forEach(f => {
      drawFieldLabel(doc, state, ctx, f.header);
      drawFieldBody(doc, state, ctx, f.value);
      state.y += 2;
    });
  });

  // Trailing metadata (NAFDAC no., source) if present
  const meta = [drug.nafdac_no && `NAFDAC No.: ${drug.nafdac_no}`, drug.source && `Source: ${drug.source}`].filter(Boolean);
  if (meta.length) {
    ensureSpace(doc, state, 10, ctx);
    state.y += 2;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, state.y, PAGE_W - MARGIN, state.y);
    state.y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    meta.forEach(line => { doc.text(line, MARGIN, state.y); state.y += 4.5; });
  }

  // ── Footers on every page ───────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  return doc;
}

function slugify(name) {
  return String(name || 'drug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Downloads the PDF directly (works everywhere, including desktop browsers
 * with no native share sheet).
 */
export function downloadDrugPdf(drug) {
  const doc = buildDrugPdf(drug);
  doc.save(`medindex-${slugify(drug.generic_name)}.pdf`);
}

/**
 * Opens the native share sheet with the PDF as a file when the platform
 * supports it (most mobile browsers + the Capacitor app); falls back to a
 * plain download everywhere else (most desktop browsers).
 */
export async function shareDrugPdf(drug) {
  const doc = buildDrugPdf(drug);
  const fileName = `medindex-${slugify(drug.generic_name)}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${drug.generic_name} — MedIndex`,
        text: `${drug.generic_name} clinical reference, shared from MedIndex.`,
      });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // Fall through to download on any other share failure.
    }
  }

  doc.save(fileName);
  return 'downloaded';
}
