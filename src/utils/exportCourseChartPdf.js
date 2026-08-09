// src/utils/exportCourseChartPdf.js
//
// Builds a branded PDF "Drug Course Chart" from an AI Clinical Consult
// session: the complaint/note, the AI's Diagnosis, and the confirmed
// "Give This" drug table (Drug / Dose / Frequency / Duration / Role) —
// the same rows the user ticked on-screen, in the same order. Mirrors
// exportListPdf.js's structure and pdfBrand.js's shared visual language
// so it looks like every other MedIndex export.

import { jsPDF } from 'jspdf';
import {
  NAVY, BLUE_L, INK, MUTED, LINE, AMBER_L, AMBER_FG,
  PAGE_W, MARGIN, CONTENT_W,
  newPageState, drawFooter, drawCoverHeader,
  ensureSpace, drawFieldBody, drawSectionHeader,
  slugify, shareOrDownloadPdf,
} from './pdfBrand';
import { SECTION_META } from './parseClinicalPlan';

const COL = {
  drug: MARGIN,
  dose: MARGIN + 62,
  freq: MARGIN + 92,
  dur:  MARGIN + 132,
  role: MARGIN + 160,
};

function drawTableHeader(doc, state, ctx) {
  ensureSpace(doc, state, 10, ctx);
  doc.setFillColor(...BLUE_L);
  doc.rect(MARGIN, state.y - 4.5, CONTENT_W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('Drug', COL.drug + 2, state.y + 1);
  doc.text('Dose', COL.dose, state.y + 1);
  doc.text('Frequency', COL.freq, state.y + 1);
  doc.text('Duration', COL.dur, state.y + 1);
  doc.text('Role', COL.role, state.y + 1);
  state.y += 7;
}

/**
 * @param {Object} consult
 *   noteText   — the free-text complaint/consultation note
 *   diagnosis  — the AI's diagnosis text (Diagnosis section body)
 *   age, sex, allergies — patient context as entered on the form
 *   rows       — confirmed "Give This" rows: [{ name, dose, frequency, duration, category, allergyConflict }]
 * @returns {jsPDF}
 */
export function buildCourseChartPdf({ noteText, diagnosis, age, sex, allergies, rows }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx = { runningHeaderLabel: 'Drug Course Chart', pageCount: 1 };
  const state = newPageState();

  drawCoverHeader(doc, 'AI Clinical Consult — Drug Course Chart');
  state.y = 52;

  // ── Patient context line ─────────────────────────────────────────────
  const contextParts = [];
  if (age) contextParts.push(`Age ${age}`);
  if (sex) contextParts.push(sex);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(contextParts.length ? contextParts.join(' · ') : 'Patient', MARGIN, state.y);
  state.y += 7;

  const allergyList = (allergies || '').split(',').map(a => a.trim()).filter(Boolean);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...(allergyList.length ? [220, 38, 38] : [180, 83, 9]));
  doc.text(
    allergyList.length ? `Documented allergies: ${allergyList.join(', ')}` : 'No allergies entered — confirm with the patient before prescribing.',
    MARGIN, state.y
  );
  state.y += 8;

  doc.setDrawColor(...LINE);
  doc.line(MARGIN, state.y, PAGE_W - MARGIN, state.y);
  state.y += 9;

  // ── Complaint / note ──────────────────────────────────────────────────
  if (noteText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text('Complaint', MARGIN, state.y);
    state.y += 5.5;
    drawFieldBody(doc, state, ctx, noteText, { fontSize: 9.5, lineH: 4.6 });
    state.y += 3;
  }

  // ── Diagnosis ─────────────────────────────────────────────────────────
  if (diagnosis) {
    drawSectionHeader(doc, state, ctx, 'Diagnosis');
    drawFieldBody(doc, state, ctx, diagnosis, { fontSize: 9.5, lineH: 4.6 });
    state.y += 3;
  }

  // ── Give This table ──────────────────────────────────────────────────
  drawSectionHeader(doc, state, ctx, `Give This (${rows.length} drug${rows.length !== 1 ? 's' : ''})`);

  if (!rows.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text('No drugs were confirmed for this course chart.', MARGIN, state.y);
    state.y += 6;
  } else {
    drawTableHeader(doc, state, ctx);
    rows.forEach((r, i) => {
      const nameLines = doc.splitTextToSize(r.name, 58);
      const rowH = Math.max(6, nameLines.length * 4.2 + 1.5);
      ensureSpace(doc, state, rowH, ctx);

      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(MARGIN, state.y - 4.2, CONTENT_W, rowH, 'F');
      }
      if (r.allergyConflict) {
        doc.setFillColor(254, 226, 226);
        doc.rect(MARGIN, state.y - 4.2, 1.4, rowH, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...(r.allergyConflict ? [220, 38, 38] : INK));
      doc.text(nameLines, COL.drug + 2, state.y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
      doc.text(r.dose || '—', COL.dose, state.y);
      doc.text(r.frequency || '—', COL.freq, state.y);
      doc.text(r.duration || '—', COL.dur, state.y);
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      const roleLabel = SECTION_META[r.category]?.label || r.category || '';
      doc.text(doc.splitTextToSize(roleLabel, PAGE_W - MARGIN - COL.role), COL.role, state.y);

      state.y += rowH;
    });

    if (rows.some(r => r.allergyConflict)) {
      state.y += 2;
      ensureSpace(doc, state, 8, ctx);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(220, 38, 38);
      doc.text('▎ = flagged as a possible conflict with a documented allergy — confirm before administering.', MARGIN, state.y);
      state.y += 6;
    }
  }

  // ── Safety footnote callout ─────────────────────────────────────────
  state.y += 3;
  ensureSpace(doc, state, 14, ctx);
  const noteText2 = 'AI suggestion only — not a prescription. Confirm against allergy history, dosage, and local protocol before prescribing.';
  const noteLines = doc.splitTextToSize(noteText2, CONTENT_W - 8);
  const noteH = noteLines.length * 4.2 + 5;
  doc.setFillColor(...AMBER_L);
  doc.rect(MARGIN, state.y - 4, CONTENT_W, noteH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...AMBER_FG);
  doc.text(noteLines, MARGIN + 3, state.y + 1);
  state.y += noteH;

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  return doc;
}

function fileBaseName(noteText) {
  const firstWords = (noteText || 'course-chart').split(/\s+/).slice(0, 6).join(' ');
  return slugify(firstWords) || 'course-chart';
}

export function downloadCourseChartPdf(consult) {
  const doc = buildCourseChartPdf(consult);
  doc.save(`medindex-${fileBaseName(consult.noteText)}-course-chart.pdf`);
}

export async function shareCourseChartPdf(consult) {
  const doc = buildCourseChartPdf(consult);
  return shareOrDownloadPdf(doc, {
    fileName: `medindex-${fileBaseName(consult.noteText)}-course-chart.pdf`,
    title: 'MedIndex — Drug Course Chart',
    text: `Drug course chart (${consult.rows.length} drugs), shared from MedIndex AI Clinical Consult.`,
  });
}
