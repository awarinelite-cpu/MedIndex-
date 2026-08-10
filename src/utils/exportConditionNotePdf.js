// src/utils/exportConditionNotePdf.js
//
// Builds a single-condition PDF note — clinical info (Introduction/Types/
// Organ System/Etiology/Pathophysiology/Clinical Manifestation/Diagnosis/
// Management/etc.) plus the full drug list tagged to that condition, all on
// their own branded pages. This is the per-condition sibling of
// exportSystemNotePdf.js's "Full System Note" (which covers every condition
// in a system with a linked table of contents) — same visual language and
// field layout, just scoped to one condition and with no TOC needed.

import { jsPDF } from 'jspdf';
import {
  BLUE, INK, MUTED,
  MARGIN, CONTENT_W,
  newPageState, drawFooter, drawCoverHeader,
  ensureSpace, drawFieldBody, drawFieldLabel, drawSectionHeader, drawPill,
  statusColor, slugify, shareOrDownloadPdf,
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

/**
 * @param {Object} system    — { id, name } (from anatomicalSystems.js)
 * @param {Object} condition — { id, label, icon, ... }
 * @param {Array}  drugs     — drugs tagged to this condition
 * @param {Object|null} clinicalInfo — {introduction, types, ...} or null if not yet generated
 * @returns {jsPDF}
 */
export function buildConditionNotePdf(system, condition, drugs, clinicalInfo = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx = { runningHeaderLabel: `${system.name} — ${condition.label}`, pageCount: 1 };
  const state = newPageState();

  drawCoverHeader(doc, `${system.name} — Condition Note`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(`${condition.icon ? condition.icon + '  ' : ''}${condition.label}`, MARGIN, 52 - 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${drugs.length} medication${drugs.length !== 1 ? 's' : ''} for this condition`,
    MARGIN, 52 - 2
  );
  state.y = 52;

  if (!clinicalInfo) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('No clinical write-up generated yet for this condition.', MARGIN, state.y);
    state.y += 6;
  } else {
    CLINICAL_FIELDS.forEach(([key, label]) => {
      const body = clinicalInfo[key];
      if (!body) return;
      if (key === 'types' && hasNoDistinctTypes(body)) return;
      if (key === 'surgicalManagement' && hasNoSurgicalManagement(body)) return;
      ensureSpace(doc, state, 10, ctx);
      drawFieldLabel(doc, state, ctx, label);
      drawFieldBody(doc, state, ctx, body, { fontSize: 9, lineH: 4.3 });
      state.y += 2;
    });
  }

  // ── Drug list, grouped by class — same layout as the system note ──────
  if (drugs.length) {
    ensureSpace(doc, state, 10, ctx);
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
  } else {
    ensureSpace(doc, state, 10, ctx);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('No medications tagged to this condition yet.', MARGIN, state.y);
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  return doc;
}

export function downloadConditionNotePdf(system, condition, drugs, clinicalInfo) {
  const doc = buildConditionNotePdf(system, condition, drugs, clinicalInfo);
  doc.save(`medindex-${slugify(condition.label)}-condition-note.pdf`);
}

export async function shareConditionNotePdf(system, condition, drugs, clinicalInfo) {
  const doc = buildConditionNotePdf(system, condition, drugs, clinicalInfo);
  return shareOrDownloadPdf(doc, {
    fileName: `medindex-${slugify(condition.label)}-condition-note.pdf`,
    title: `${condition.label} — MedIndex Condition Note`,
    text: `${condition.label}: clinical info and ${drugs.length} medication${drugs.length !== 1 ? 's' : ''}, shared from MedIndex.`,
  });
}
