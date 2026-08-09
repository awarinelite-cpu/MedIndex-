// src/utils/exportDrugPdf.js
//
// Builds a branded, multi-page PDF of one drug's complete record — every
// populated field across all six TAB_SECTIONS groups (Overview, Dosage,
// Safety, Interactions, Pharmacology, Nursing Notes) — for sharing outside
// the app. Drawn with jsPDF's vector text/shape API (see pdfBrand.js)
// rather than rasterizing the DOM (html2canvas), so it stays crisp at any
// zoom, is a small file size, and paginates cleanly instead of slicing a
// screenshot mid-section.

import { jsPDF } from 'jspdf';
import { TAB_SECTIONS } from './aiSectionFill';
import {
  BLUE, INK, MUTED, LINE,
  PAGE_W, MARGIN, CONTENT_W,
  statusColor, newPageState, drawFooter, drawCoverHeader,
  ensureSpace, wrapSegments, drawWrappedRow, drawFieldBody, drawFieldLabel,
  drawSectionHeader, drawPill, slugify, shareOrDownloadPdf,
} from './pdfBrand';

/**
 * @param {Object} drug — the drug record (same shape as everywhere else in the app)
 * @returns {jsPDF} — call .save(filename) or .output('blob') on the result
 */
export function buildDrugPdf(drug) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx = { runningHeaderLabel: drug.generic_name, pageCount: 1 };
  const state = newPageState();

  drawCoverHeader(doc, 'Clinical Drug Reference');
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

/**
 * Downloads the PDF directly (works everywhere, including desktop browsers
 * with no native share sheet).
 */
export function downloadDrugPdf(drug) {
  const doc = buildDrugPdf(drug);
  doc.save(`medindex-${slugify(drug.generic_name)}.pdf`);
}

/**
 * Opens the native share sheet with the PDF as a file when supported;
 * falls back to a plain download everywhere else.
 */
export async function shareDrugPdf(drug) {
  const doc = buildDrugPdf(drug);
  return shareOrDownloadPdf(doc, {
    fileName: `medindex-${slugify(drug.generic_name)}.pdf`,
    title: `${drug.generic_name} — MedIndex`,
    text: `${drug.generic_name} clinical reference, shared from MedIndex.`,
  });
}
