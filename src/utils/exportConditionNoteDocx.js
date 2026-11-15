// src/utils/exportConditionNoteDocx.js
//
// Microsoft Word (.docx) version of the single-condition note: every clinical
// section (Introduction → Nursing Consideration, in full) plus every medication
// tagged to the condition, grouped by class. Sibling of exportConditionNotePdf.js.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Footer, PageNumber, BorderStyle,
} from 'docx';
import { slugify } from './pdfBrand';
import { hasNoDistinctTypes, hasNoSurgicalManagement } from './parseConditionClinicalInfo';

const CLINICAL_FIELDS = [
  ['introduction', 'Introduction'],
  ['types', 'Types'],
  ['organRelated', 'Organ System Involved'],
  ['etiology', 'Etiology'],
  ['pathology', 'Pathophysiology'],
  ['clinicalManifestation', 'Clinical Manifestation'],
  ['diagnosis', 'Diagnosis and Investigation'],
  ['management', 'Medical Management'],
  ['surgicalManagement', 'Surgical Management'],
  ['nursingDiagnosis', 'Nursing Diagnosis'],
  ['nursingConsideration', 'Nursing Consideration'],
];

const BLUE = '1E3A8A';
const MUTED = '6B7280';
const FONT = 'Calibri';

// "text **bold** text" → TextRuns
function inlineRuns(text, base = {}) {
  const runs = [];
  String(text || '').split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    if (!part) return;
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    runs.push(new TextRun({ font: FONT, size: 22, ...base, text: m ? m[1] : part.replace(/\*\*/g, ''), bold: !!m || !!base.bold }));
  });
  return runs;
}

// The app's markdown-ish bodies: "- " bullets, "### " sub-headings, **bold**,
// "1. " numbered lines and plain paragraphs.
function bodyParagraphs(body) {
  const out = [];
  String(body || '').split('\n').forEach(raw => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) return;
    const sub = line.match(/^\s*#{3,6}\s+(.+)$/);
    if (sub) {
      out.push(new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: sub[1].replace(/\*\*/g, ''), bold: true, italics: true, color: BLUE, font: FONT, size: 23 })],
      }));
      return;
    }
    const bullet = line.match(/^(\s*)[-•*]\s+(.+)$/);
    if (bullet) {
      out.push(new Paragraph({
        bullet: { level: bullet[1].length >= 2 ? 1 : 0 },
        spacing: { after: 40 },
        children: inlineRuns(bullet[2]),
      }));
      return;
    }
    const num = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (num) {
      out.push(new Paragraph({
        indent: { left: 360, hanging: 360 },
        spacing: { after: 40 },
        children: inlineRuns(`${num[1]}.  ${num[2]}`),
      }));
      return;
    }
    out.push(new Paragraph({ spacing: { after: 80 }, children: inlineRuns(line) }));
  });
  return out;
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C7D2FE', space: 2 } },
    children: [new TextRun({ text, bold: true, color: BLUE, font: FONT, size: 28 })],
  });
}

export function buildConditionNoteDocx(system, condition, drugs, clinicalInfo = null) {
  const children = [];

  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: `${system?.name || ''} — Condition Note`.trim(), color: MUTED, font: FONT, size: 20 })],
  }));
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 60 },
    children: [new TextRun({ text: condition.label, bold: true, color: BLUE, font: FONT, size: 44 })],
  }));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({
      text: `${drugs.length} medication${drugs.length !== 1 ? 's' : ''} for this condition · MedIndex`,
      color: MUTED, font: FONT, size: 20,
    })],
  }));

  if (!clinicalInfo) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'No clinical write-up has been added for this condition yet.', italics: true, color: MUTED, font: FONT, size: 21 })],
    }));
  } else {
    CLINICAL_FIELDS.forEach(([key, label]) => {
      const body = clinicalInfo[key];
      if (!body) return;
      if (key === 'types' && hasNoDistinctTypes(body)) return;
      if (key === 'surgicalManagement' && hasNoSurgicalManagement(body)) return;
      children.push(sectionHeading(label));
      children.push(...bodyParagraphs(body));
    });
  }

  children.push(sectionHeading('Medications'));
  if (!drugs.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'No medications tagged to this condition yet.', italics: true, color: MUTED, font: FONT, size: 21 })],
    }));
  } else {
    const byClass = new Map();
    drugs.forEach(d => {
      const cls = d.drug_class || 'Other';
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls).push(d);
    });
    [...byClass.entries()].forEach(([className, classDrugs]) => {
      children.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        keepNext: true,
        children: [new TextRun({ text: className, bold: true, color: BLUE, font: FONT, size: 24 })],
      }));
      classDrugs.forEach(drug => {
        const status = drug.prescription_status ? `  (${drug.prescription_status})` : '';
        children.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 60, after: 20 },
          keepNext: true,
          children: [
            new TextRun({ text: drug.generic_name || 'Unnamed', bold: true, font: FONT, size: 22 }),
            new TextRun({ text: status, color: MUTED, font: FONT, size: 20 }),
          ],
        }));
        const indication = drug.indications || drug.primary_indications;
        if (indication) {
          bodyParagraphs(indication).forEach(p => children.push(p));
        }
      });
    });
  }

  children.push(new Paragraph({
    spacing: { before: 360 },
    children: [new TextRun({
      text: 'Reference material only — not a substitute for current prescribing information or clinical judgment.',
      italics: true, color: MUTED, font: FONT, size: 18,
    })],
  }));

  return new Document({
    creator: 'MedIndex',
    title: `${condition.label} — MedIndex Condition Note`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `MedIndex · ${condition.label} · Page `, color: MUTED, font: FONT, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: MUTED, font: FONT, size: 16 }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Opens the phone's share sheet with the .docx when possible, otherwise downloads it.
export async function shareConditionNoteDocx(system, condition, drugs, clinicalInfo) {
  const blob = await Packer.toBlob(buildConditionNoteDocx(system, condition, drugs, clinicalInfo));
  const fileName = `medindex-${slugify(condition.label)}-condition-note.docx`;
  const file = new File([blob], fileName, { type: DOCX_MIME });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${condition.label} — MedIndex Condition Note`,
        text: `${condition.label}: clinical info and ${drugs.length} medication${drugs.length !== 1 ? 's' : ''}, shared from MedIndex.`,
      });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
