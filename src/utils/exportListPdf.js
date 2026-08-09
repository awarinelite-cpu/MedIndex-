// src/utils/exportListPdf.js
//
// Builds a branded PDF of a saved drug list ("Favorites" folder): the
// folder title, then each drug's class, prescription status, personal
// note, and — when the full record is available (drugs still in the live
// database, matched by drugId) — a short Overview + Adult Dose snippet so
// the sheet is useful on its own without reopening the app. AI-only
// entries not yet in the database are labeled as such, same as on-screen.

import { jsPDF } from 'jspdf';
import {
  NAVY, BLUE, INK, MUTED, LINE, AMBER_L, AMBER_FG,
  PAGE_W, MARGIN, CONTENT_W,
  statusColor, newPageState, drawFooter, drawCoverHeader,
  ensureSpace, drawFieldBody, drawPill, slugify, shareOrDownloadPdf,
} from './pdfBrand';

function formatDate(ts) {
  if (!ts?.toDate) return null;
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * @param {Object} list — the list/folder record ({ title, createdAt, drugs: [...] })
 * @param {Array}  allDrugs — the live drug list (from useDrugs()), used to enrich
 *                 each entry with class/status/overview/dose when still in the database
 * @returns {jsPDF}
 */
export function buildListPdf(list, allDrugs = []) {
  const drugsById = new Map(allDrugs.map(d => [d.id, d]));
  const entries = list.drugs || [];

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx = { runningHeaderLabel: list.title, pageCount: 1 };
  const state = newPageState();

  drawCoverHeader(doc, 'Saved Drug List');
  state.y = 52;

  // ── List identity block ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(list.title || 'Untitled list', MARGIN, state.y);
  state.y += 8;

  const createdLabel = formatDate(list.createdAt);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${entries.length} drug${entries.length !== 1 ? 's' : ''}${createdLabel ? ` · Created ${createdLabel}` : ''}`,
    MARGIN, state.y
  );
  state.y += 8;

  doc.setDrawColor(...LINE);
  doc.line(MARGIN, state.y, PAGE_W - MARGIN, state.y);
  state.y += 9;

  // ── Empty state ──────────────────────────────────────────────────────
  if (!entries.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('No drugs saved to this list yet.', MARGIN, state.y);
  }

  // ── One block per drug ───────────────────────────────────────────────
  entries.forEach((entry, i) => {
    const full = !entry.drugId?.startsWith('ai_') ? drugsById.get(entry.drugId) : null;
    const isAiOnly = entry.drugId?.startsWith('ai_') || !full;

    ensureSpace(doc, state, 16, ctx);
    if (i > 0) {
      doc.setDrawColor(...LINE);
      doc.line(MARGIN, state.y, PAGE_W - MARGIN, state.y);
      state.y += 7;
    }

    // Name row + pills
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...INK);
    doc.text(entry.drugName || 'Unknown drug', MARGIN, state.y);
    let pillX = MARGIN + doc.getStringUnitWidth(entry.drugName || 'Unknown drug') * 13.5 / doc.internal.scaleFactor + 4;

    if (isAiOnly) {
      drawPill(doc, pillX, state.y - 3.6, 'AI · not verified', 7, { bg: [245, 243, 255], fg: [109, 40, 217] });
    } else if (full?.prescription_status) {
      drawPill(doc, pillX, state.y - 3.6, full.prescription_status, 7, statusColor(full.prescription_status));
    }
    state.y += 6;

    const drugClass = full?.drug_class || entry.drugClass;
    if (drugClass) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...BLUE);
      doc.text(drugClass, MARGIN, state.y);
      state.y += 5.5;
    }

    // Personal note callout
    if (entry.notes) {
      ensureSpace(doc, state, 12, ctx);
      const noteTop = state.y - 3.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      const noteLines = doc.splitTextToSize(entry.notes, CONTENT_W - 8);
      const noteH = noteLines.length * 4 + 4;
      doc.setFillColor(...AMBER_L);
      doc.rect(MARGIN, noteTop, CONTENT_W, noteH, 'F');
      doc.setTextColor(...AMBER_FG);
      doc.text(noteLines, MARGIN + 3, noteTop + 5);
      state.y = noteTop + noteH + 4;
    }

    // Overview / dose snippet, only if the drug is still in the live database
    if (full?.overview) {
      drawFieldBody(doc, state, ctx, full.overview, { fontSize: 9, lineH: 4.3 });
    }
    if (full?.adult_dose) {
      ensureSpace(doc, state, 6, ctx);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(...NAVY);
      doc.text('Adult Dose', MARGIN, state.y);
      state.y += 4.6;
      drawFieldBody(doc, state, ctx, full.adult_dose, { fontSize: 9, lineH: 4.3 });
    }
    if (!full?.overview && !full?.adult_dose && !isAiOnly) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text('Open this drug in MedIndex for full clinical details.', MARGIN, state.y);
      state.y += 5;
    }
    if (isAiOnly) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text('Not yet in the verified database — save it from an AI lookup to add full details.', MARGIN, state.y);
      state.y += 5;
    }

    state.y += 3;
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  return doc;
}

export function downloadListPdf(list, allDrugs) {
  const doc = buildListPdf(list, allDrugs);
  doc.save(`medindex-list-${slugify(list.title)}.pdf`);
}

export async function shareListPdf(list, allDrugs) {
  const doc = buildListPdf(list, allDrugs);
  return shareOrDownloadPdf(doc, {
    fileName: `medindex-list-${slugify(list.title)}.pdf`,
    title: `${list.title} — MedIndex`,
    text: `"${list.title}" drug list, shared from MedIndex.`,
  });
}
