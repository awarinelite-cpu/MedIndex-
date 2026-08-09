// src/utils/exportSystemNotePdf.js
//
// Builds a "system note" PDF — a single branded document covering every
// condition in one body system, with a linked table of contents on the
// first page(s): tapping a condition's row in a PDF reader jumps straight
// to that condition's full write-up (clinical info + drug list), the same
// content that opens when you tap the condition in the app itself.
//
// Two-pass layout: 1) reserve enough blank TOC pages up front (page count
// depends only on how many conditions there are, which we know before
// drawing anything), 2) lay out every condition's content, remembering
// which page each one started on, 3) go back with doc.setPage() and fill
// in the TOC rows + doc.link() jumps now that real page numbers exist.

import { jsPDF } from 'jspdf';
import {
  NAVY, BLUE, INK, MUTED, LINE, WHITE,
  PAGE_W, MARGIN, CONTENT_W, FOOTER_Y,
  statusColor, newPageState, drawFooter, drawCoverHeader, drawRunningHeader,
  ensureSpace, drawFieldBody, drawFieldLabel, drawSectionHeader, drawPill,
  slugify, shareOrDownloadPdf,
} from './pdfBrand';
import { hasNoDistinctTypes, hasNoSurgicalManagement } from './parseConditionClinicalInfo';

const CLINICAL_FIELDS = [
  ['introduction', 'Introduction'],
  ['types', 'Types'],
  ['organRelated', 'Organ System Involved'],
  ['etiology', 'Etiology'],
  ['pathology', 'Pathophysiology'],
  ['clinicalManifestation', 'Clinical Manifestation'],
  ['diagnosis', 'Diagnosis & Investigation'],
  ['management', 'Medical Management'],
  ['surgicalManagement', 'Surgical Management'],
  ['nursingDiagnosis', 'Nursing Diagnosis'],
  ['nursingConsideration', 'Nursing Consideration'],
];

const TOC_ROW_H = 7;
const TOC_TITLE_TOP = 52;

function tocRowsPerPage(isFirstPage) {
  const top = isFirstPage ? TOC_TITLE_TOP : 18;
  const usable = (FOOTER_Y - 6) - top;
  return Math.max(1, Math.floor(usable / TOC_ROW_H));
}

function countTocPages(entryCount) {
  let remaining = entryCount;
  let pages = 0;
  let first = true;
  while (remaining > 0) {
    const capacity = tocRowsPerPage(first);
    remaining -= capacity;
    pages += 1;
    first = false;
  }
  return Math.max(1, pages);
}

/**
 * @param {Object} system — { id, name } (from anatomicalSystems.js)
 * @param {Array}  entries — [{ condition: {id,label,icon,...}, drugs: [...] }], already
 *                 filtered/sorted the same way the system page displays them
 * @param {Object} clinicalInfoByCondition — { [conditionId]: {introduction, types, ...} }
 * @returns {jsPDF}
 */
export function buildSystemNotePdf(system, entries, clinicalInfoByCondition = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx = { runningHeaderLabel: `${system.name} — System Note`, pageCount: 1 };
  const state = newPageState();

  const tocPageCount = countTocPages(entries.length);

  // ── Pass 1: reserve blank TOC pages ─────────────────────────────────
  drawCoverHeader(doc, 'Full System Note');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(system.name, MARGIN, TOC_TITLE_TOP - 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${entries.length} condition${entries.length !== 1 ? 's' : ''} · Tap any row below to jump to its full write-up`,
    MARGIN, TOC_TITLE_TOP - 2
  );
  for (let i = 1; i < tocPageCount; i++) {
    doc.addPage();
    ctx.pageCount++;
  }

  // ── Pass 2: lay out every condition, recording its start page ───────
  const tocEntries = []; // { label, iconLabel, drugCount, page, y (filled later) }
  doc.addPage();
  ctx.pageCount++;
  drawRunningHeader(doc, ctx.runningHeaderLabel);
  state.y = 18;

  entries.forEach(({ condition, drugs }, idx) => {
    const startPage = doc.internal.getCurrentPageInfo().pageNumber;
    const info = clinicalInfoByCondition[condition.id] || null;

    // Condition header banner
    ensureSpace(doc, state, 16, ctx);
    if (idx > 0) state.y += 2;
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN, state.y - 5, CONTENT_W, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...WHITE);
    doc.text(`${condition.icon ? condition.icon + '  ' : ''}${condition.label}`, MARGIN + 4, state.y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(191, 219, 254);
    doc.text(
      `${drugs.length} drug${drugs.length !== 1 ? 's' : ''}`,
      PAGE_W - MARGIN - 4, state.y + 3, { align: 'right' }
    );
    state.y += 13;

    tocEntries.push({ label: condition.label, icon: condition.icon, drugCount: drugs.length, page: startPage });

    // "Back to contents" link — top of the FIRST TOC page
    doc.link(MARGIN, state.y - 13 + 0.5, 34, 5, { pageNumber: 1 });

    if (!info) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('No clinical write-up generated yet for this condition.', MARGIN, state.y);
      state.y += 6;
    } else {
      CLINICAL_FIELDS.forEach(([key, label]) => {
        const body = info[key];
        if (!body) return;
        if (key === 'types' && hasNoDistinctTypes(body)) return;
        if (key === 'surgicalManagement' && hasNoSurgicalManagement(body)) return;
        drawFieldLabel(doc, state, ctx, label);
        drawFieldBody(doc, state, ctx, body, { fontSize: 9, lineH: 4.3 });
        state.y += 2;
      });
    }

    // ── Drug list for this condition, grouped by class ────────────────
    if (drugs.length) {
      drawSectionHeader(doc, state, ctx, 'Medications');
      const byClass = new Map();
      drugs.forEach(d => {
        const cls = d.drug_class || 'Other';
        if (!byClass.has(cls)) byClass.set(cls, []);
        byClass.get(cls).push(d);
      });
      [...byClass.entries()].forEach(([className, classDrugs]) => {
        ensureSpace(doc, state, 7, ctx);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...BLUE);
        doc.text(className, MARGIN, state.y);
        state.y += 4.8;

        classDrugs.forEach(drug => {
          ensureSpace(doc, state, 6, ctx);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...INK);
          doc.text(`•  ${drug.generic_name || 'Unnamed'}`, MARGIN + 2, state.y);
          const nameW = doc.getStringUnitWidth(`•  ${drug.generic_name || 'Unnamed'}`) * 9 / doc.internal.scaleFactor;
          if (drug.prescription_status) {
            drawPill(doc, MARGIN + 4 + nameW, state.y - 3.4, drug.prescription_status, 6.5, statusColor(drug.prescription_status));
          }
          state.y += 4.4;
          const indication = drug.indications || drug.primary_indications;
          if (indication) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            const lines = doc.splitTextToSize(indication, CONTENT_W - 6);
            const clipped = lines.slice(0, 2);
            clipped.forEach(l => {
              ensureSpace(doc, state, 3.8, ctx);
              doc.text(l, MARGIN + 4, state.y);
              state.y += 3.8;
            });
          }
          state.y += 1.4;
        });
      });
    }

    state.y += 4;
  });

  // ── Pass 3: go back and fill in the TOC pages with links ────────────
  let tocPage = 1;
  let row = 0;
  let capacity = tocRowsPerPage(true);
  doc.setPage(tocPage);
  let y = TOC_TITLE_TOP + 4;

  tocEntries.forEach((entry) => {
    if (row >= capacity) {
      tocPage++;
      row = 0;
      capacity = tocRowsPerPage(false);
      doc.setPage(tocPage);
      drawRunningHeader(doc, ctx.runningHeaderLabel);
      y = 22;
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y + 2.3, PAGE_W - MARGIN, y + 2.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...BLUE);
    const label = `${entry.icon ? entry.icon + ' ' : ''}${entry.label}`;
    doc.text(label, MARGIN, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${entry.drugCount} drug${entry.drugCount !== 1 ? 's' : ''}  ·  p.${entry.page}`, PAGE_W - MARGIN, y, { align: 'right' });

    // Whole row is tappable and jumps to the condition's start page
    doc.link(MARGIN, y - 4.5, CONTENT_W, TOC_ROW_H, { pageNumber: entry.page });

    y += TOC_ROW_H;
    row++;
  });

  // ── Footers on every page, now that the true page count is known ───
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  return doc;
}

export function downloadSystemNotePdf(system, entries, clinicalInfoByCondition) {
  const doc = buildSystemNotePdf(system, entries, clinicalInfoByCondition);
  doc.save(`medindex-${slugify(system.name)}-system-note.pdf`);
}

export async function shareSystemNotePdf(system, entries, clinicalInfoByCondition) {
  const doc = buildSystemNotePdf(system, entries, clinicalInfoByCondition);
  return shareOrDownloadPdf(doc, {
    fileName: `medindex-${slugify(system.name)}-system-note.pdf`,
    title: `${system.name} — MedIndex System Note`,
    text: `${system.name} full system note (${entries.length} conditions), shared from MedIndex.`,
  });
}
