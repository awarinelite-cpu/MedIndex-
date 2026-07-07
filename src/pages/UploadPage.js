import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { Upload, FileText, CheckCircle, XCircle, Download } from 'lucide-react';
import { isDrugComplete } from '../utils/aiDrugSave';

const REQUIRED_FIELDS = ['generic_name', 'drug_class'];

// Same deterministic-ID convention used throughout the app (SystemPage AI
// save, aiDrugSave.slugifyDrugName) — a drug's doc ID is always derived from
// its generic name, which is exactly what lets us detect duplicates here.
function computeDocId(genericName) {
  if (!genericName) return null;
  return genericName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

// Normalize any prescription_status value into one of the 3 valid ones
function normalizePrescriptionStatus(val) {
  if (!val) return 'Prescription';
  const v = val.toLowerCase();
  if (v.includes('otc') || v.includes('over the counter') || v.includes('over-the-counter')) return 'OTC';
  if (v.includes('controlled')) return 'Controlled';
  return 'Prescription';
}

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, validating, uploading, success, error
  const [previewMode, setPreviewMode] = useState(true);
  // Per-row duplicate/completeness check against existing Firestore drugs.
  // rowActions[i] = 'new' | 'update' | 'skip' — computed once per file, before upload.
  const [rowActions, setRowActions] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null); // { added, updated, skipped, errors }


  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setUploadStatus('validating');
    setRowActions([]);
    setUploadSummary(null);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        setParsedData(data);
        validateData(data);
        checkDuplicates(data);
      },
      error: (err) => {
        setValidationErrors([{ row: 0, message: 'CSV parsing error: ' + err.message }]);
        setUploadStatus('error');
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    multiple: false
  });

  function validateData(data) {
    const warnings = [];

    // Check for duplicates within the CSV itself
    const nameSeen = {};
    data.forEach((row, index) => {
      if (row.generic_name) {
        const key = row.generic_name.toLowerCase().trim();
        if (nameSeen[key] !== undefined) {
          warnings.push({
            row: index + 2,
            field: 'generic_name',
            message: `Duplicate of row ${nameSeen[key]}: "${row.generic_name}" already exists in this file. The later row will overwrite the earlier one.`,
            isWarning: true
          });
        } else {
          nameSeen[key] = index + 2;
        }
      }
    });

    data.forEach((row, index) => {
      const rowNum = index + 2;

      // Only block on truly missing required fields (generic_name, drug_class)
      REQUIRED_FIELDS.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          warnings.push({ row: rowNum, field, message: `Missing required field: ${field}` });
        }
      });

      // prescription_status: warn if non-standard but will be auto-normalized on upload
      if (row.prescription_status) {
        const normalized = normalizePrescriptionStatus(row.prescription_status);
        const v = row.prescription_status.trim();
        if (!['OTC', 'Prescription', 'Controlled'].includes(v)) {
          warnings.push({
            row: rowNum,
            field: 'prescription_status',
            message: `"${v}" will be auto-normalized to "${normalized}" on upload.`,
            isWarning: true
          });
        }
      }
    });

    setValidationErrors(warnings);
    // Only block upload if there are hard errors (missing required fields)
    const hardErrors = warnings.filter(w => !w.isWarning);
    setUploadStatus(hardErrors.length === 0 ? 'ready' : 'error');
  }

  // Classify each row as:
  //   'new'    — no drug with this generic_name exists yet
  //   'update' — a drug exists but its record is incomplete (missing overview,
  //              dosage, pharmacology, etc.) — the CSV row will overwrite it
  //   'skip'   — a drug exists AND is already complete — dropped to avoid
  //              clobbering good data with a duplicate row
  async function checkDuplicates(data) {
    setCheckingDuplicates(true);
    try {
      const docIds = data.map(row => computeDocId(row.generic_name));
      const uniqueIds = [...new Set(docIds.filter(Boolean))];

      // Firestore 'in' queries on documentId() max out at 30 values per call.
      const existingById = {};
      const CHUNK = 30;
      for (let i = 0; i < uniqueIds.length; i += CHUNK) {
        const idChunk = uniqueIds.slice(i, i + CHUNK);
        if (idChunk.length === 0) continue;
        const snap = await getDocs(query(collection(db, 'drugs'), where(documentId(), 'in', idChunk)));
        snap.forEach(d => { existingById[d.id] = d.data(); });
      }

      const actions = data.map((row, i) => {
        const docId = docIds[i];
        if (!docId) return 'new'; // no generic_name — nothing to match against
        const existing = existingById[docId];
        if (!existing) return 'new';
        return isDrugComplete(existing) ? 'skip' : 'update';
      });
      setRowActions(actions);
    } catch (err) {
      console.error('Duplicate check failed:', err);
      // Fail open — if the check errors out, treat everything as new so the
      // upload isn't blocked; Firestore will still just overwrite by doc ID.
      setRowActions(data.map(() => 'new'));
    } finally {
      setCheckingDuplicates(false);
    }
  }

  async function handleUpload() {
    const hardErrors = validationErrors.filter(w => !w.isWarning);
    if (hardErrors.length > 0) return;

    // Rows already confirmed complete-and-duplicate get dropped here — they
    // never reach Firestore, so an existing complete record is never
    // overwritten by a redundant CSV row.
    const rowsToUpload = parsedData.filter((_, i) => rowActions[i] !== 'skip');
    const skippedCount = parsedData.length - rowsToUpload.length;
    const updatedCount = parsedData.filter((_, i) => rowActions[i] === 'update').length;

    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: rowsToUpload.length });

    const BATCH_SIZE = 500;
    let uploaded = 0;
    let errorCount = 0;

    // Split into chunks of 500 (Firestore batch limit)
    const chunks = [];
    for (let i = 0; i < rowsToUpload.length; i += BATCH_SIZE) {
      chunks.push(rowsToUpload.slice(i, i + BATCH_SIZE));
    }

    // Fire all batches in parallel
    await Promise.all(chunks.map(async (chunk) => {
      const batch = writeBatch(db);
      chunk.forEach(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
          const val = row[key];
          cleanRow[key] = val && val.trim() !== '' ? val.trim() : null;
        });
        // Auto-normalize prescription_status
        if (cleanRow.prescription_status) {
          cleanRow.prescription_status = normalizePrescriptionStatus(cleanRow.prescription_status);
        } else {
          cleanRow.prescription_status = 'Prescription';
        }
        cleanRow.created_at   = serverTimestamp();
        cleanRow.last_updated = serverTimestamp();
        cleanRow.status       = 'Active';
        cleanRow.source       = cleanRow.source || 'CSV Upload';
        // Deterministic doc ID — lowercase + sanitised so same drug never duplicates
        const docId = computeDocId(cleanRow.generic_name) || doc(collection(db, 'drugs')).id;
        const ref = doc(db, 'drugs', docId);
        batch.set(ref, cleanRow);
      });
      try {
        await batch.commit();
        uploaded += chunk.length;
        setUploadProgress({ current: uploaded, total: rowsToUpload.length });
      } catch (err) {
        console.error('Batch error:', err);
        errorCount += chunk.length;
      }
    }));

    setUploadSummary({
      added: rowsToUpload.length - updatedCount - errorCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
    });
    setUploadStatus(errorCount === 0 ? 'success' : 'partial');
  }

  function downloadTemplate() {
    const templateHeaders = Object.keys(parsedData[0] || {});
    if (templateHeaders.length === 0) {
      // Default template if no file uploaded yet
      const defaultHeaders = [
        'generic_name','drug_class','drug_subclass','prescription_status','nafdac_no',
        'overview','strength','indications','therapeutic_note',
        'adult_dose','child_dose','renal_dose','administration','nstg_recommendations',
        'pharmacology','advice_to_patients','contraindications','precautions',
        'pregnancy_lactation','interaction','adverse_effect','nursing_action',
        'pharmacovigilance','product_description','storage_recommendations','pack_size_price',
        'source','status'
      ];
      const csv = Papa.unparse([defaultHeaders.reduce((acc, h) => ({...acc, [h]: ''}), {})]);
      downloadCSV(csv, 'drug_bank_template.csv');
      return;
    }
    const csv = Papa.unparse([templateHeaders.reduce((acc, h) => ({...acc, [h]: ''}), {})]);
    downloadCSV(csv, 'drug_bank_template.csv');
  }

  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  const errorByRow = validationErrors.reduce((acc, err) => {
    if (!acc[err.row]) acc[err.row] = [];
    acc[err.row].push(err);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary-100 rounded-xl">
          <Upload className="w-6 h-6 text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Bulk Upload</h1>
          <p className="text-drug-muted text-sm">Upload medications via CSV file</p>
        </div>
      </div>

      {/* Upload Area */}
      {!file && (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDragActive 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-drug-border hover:border-primary-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-drug-muted mx-auto mb-4" />
            <p className="text-lg font-semibold text-drug-text">
              {isDragActive ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
            </p>
            <p className="text-sm text-drug-muted mt-2">or click to browse</p>
            <p className="text-xs text-drug-muted mt-4">Supported: .csv, .xlsx (save as CSV first)</p>
          </div>

          <div className="mt-6 flex justify-center">
            <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Download Blank Template
            </button>
          </div>
        </>
      )}

      {/* File Info & Validation */}
      {file && (
        <div className="space-y-6">
          {/* File Summary */}
          <div className="bg-white border border-drug-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary-600" />
              <div>
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-drug-muted">{(file.size / 1024).toFixed(1)} KB • {parsedData.length} rows</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setParsedData([]); setValidationErrors([]); setUploadStatus('idle'); setRowActions([]); setUploadSummary(null); }} className="btn-secondary">
              Remove File
            </button>
          </div>

          {/* Validation Status */}
          {uploadStatus === 'validating' && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
              <p className="text-primary-800 font-medium">Validating {parsedData.length} rows...</p>
            </div>
          )}

          {checkingDuplicates && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
              <p className="text-primary-800 font-medium">Checking for drugs already in the database...</p>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-800">
                  {validationErrors.filter(w => !w.isWarning).length > 0
                    ? `${validationErrors.filter(w => !w.isWarning).length} Error${validationErrors.filter(w => !w.isWarning).length > 1 ? 's' : ''} Found — Fix before uploading`
                    : `${validationErrors.filter(w => w.isWarning).length} Warning${validationErrors.filter(w => w.isWarning).length > 1 ? 's' : ''} — Will be auto-corrected on upload`
                  }
                </h3>
              </div>
              <p className="text-sm text-red-700 mb-3">Fix these errors in your CSV and re-upload.</p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(errorByRow).map(([rowNum, errors]) => (
                  <div key={rowNum} className="bg-white rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Row {rowNum}</span>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1">
                      {errors.map((err, i) => (
                        <li key={i}>• <code className="font-mono bg-red-50 px-1 rounded">{err.field}</code>: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadStatus === 'ready' && !checkingDuplicates && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-bold text-green-800">Validation Passed</p>
                <p className="text-sm text-green-700">
                  {parsedData.length} rows ready to upload. No errors found.
                  {rowActions.length === parsedData.length && (() => {
                    const newCount    = rowActions.filter(a => a === 'new').length;
                    const updateCount = rowActions.filter(a => a === 'update').length;
                    const skipCount   = rowActions.filter(a => a === 'skip').length;
                    return (
                      <> {newCount} new · {updateCount} will complete an existing incomplete record
                      {skipCount > 0 && <> · {skipCount} already complete in the database will be skipped (no duplicates)</>}.</>
                    );
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploadStatus === 'uploading' && (
            <div className="bg-white border border-drug-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Uploading...</span>
                <span className="text-sm text-drug-muted">{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {(uploadStatus === 'success' || uploadStatus === 'partial') && uploadSummary && (
            <div className={`${uploadStatus === 'success' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-xl p-6 text-center`}>
              <CheckCircle className={`w-12 h-12 mx-auto mb-3 ${uploadStatus === 'success' ? 'text-green-600' : 'text-yellow-600'}`} />
              <h3 className={`text-xl font-bold ${uploadStatus === 'success' ? 'text-green-800' : 'text-yellow-800'}`}>
                {uploadStatus === 'success' ? 'Upload Complete!' : 'Upload Finished With Some Errors'}
              </h3>
              <p className={`mt-2 ${uploadStatus === 'success' ? 'text-green-700' : 'text-yellow-700'}`}>
                {uploadSummary.added} new drug{uploadSummary.added !== 1 ? 's' : ''} added,{' '}
                {uploadSummary.updated} incomplete record{uploadSummary.updated !== 1 ? 's' : ''} completed.
                {uploadSummary.skipped > 0 && (
                  <> {uploadSummary.skipped} row{uploadSummary.skipped !== 1 ? 's' : ''} skipped — already complete in the database, no duplicates created.</>
                )}
                {uploadSummary.errors > 0 && (
                  <> {uploadSummary.errors} row{uploadSummary.errors !== 1 ? 's' : ''} failed to upload — check console for details.</>
                )}
              </p>
              <button onClick={() => { setFile(null); setParsedData([]); setUploadStatus('idle'); setRowActions([]); setUploadSummary(null); }} className="btn-primary mt-4">
                Upload Another File
              </button>
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && uploadStatus !== 'success' && uploadStatus !== 'partial' && (
            <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-drug-border">
                <h3 className="font-bold">Data Preview</h3>
                <button onClick={() => setPreviewMode(!previewMode)} className="text-sm text-primary-600 font-medium">
                  {previewMode ? 'Show All Columns' : 'Show Key Columns'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-drug-border">
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted w-10">#</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Action</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Generic Name</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Class</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Indications</th>
                      {!previewMode && Object.keys(parsedData[0] || {}).filter(k => !['generic_name','drug_class','prescription_status','indications'].includes(k)).map(key => (
                        <th key={key} className="text-left px-4 py-2 font-semibold text-drug-muted text-xs">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, i) => (
                      <tr key={i} className={`border-b border-drug-border hover:bg-gray-50 ${errorByRow[i + 2] ? 'bg-red-50' : ''} ${rowActions[i] === 'skip' ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2 text-drug-muted">{i + 1}</td>
                        <td className="px-4 py-2">
                          {checkingDuplicates ? (
                            <span className="text-xs text-drug-muted">checking…</span>
                          ) : (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                              rowActions[i] === 'skip' ? 'bg-gray-200 text-gray-600' :
                              rowActions[i] === 'update' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {rowActions[i] === 'skip' ? 'Skip — duplicate' : rowActions[i] === 'update' ? 'Complete existing' : 'New'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-medium">{row.generic_name}</td>
                        <td className="px-4 py-2 text-drug-muted">{row.drug_class}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            row.prescription_status === 'OTC' ? 'bg-green-100 text-green-700' :
                            row.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {row.prescription_status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-drug-muted max-w-xs truncate">{row.indications}</td>
                        {!previewMode && Object.keys(row).filter(k => !['generic_name','drug_class','prescription_status','indications'].includes(k)).map(key => (
                          <td key={key} className="px-4 py-2 text-drug-muted text-xs max-w-xs truncate">{row[key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="text-center py-3 text-sm text-drug-muted border-t border-drug-border">
                    ...and {parsedData.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {uploadStatus !== 'uploading' && uploadStatus !== 'success' && uploadStatus !== 'partial' && (
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={validationErrors.filter(w => !w.isWarning).length > 0 || checkingDuplicates}
                className={`btn-primary flex-1 flex items-center justify-center gap-2 ${(validationErrors.filter(w => !w.isWarning).length > 0 || checkingDuplicates) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-4 h-4" />
                {validationErrors.filter(w => !w.isWarning).length > 0
                  ? 'Fix Errors to Upload'
                  : checkingDuplicates
                    ? 'Checking for duplicates…'
                    : (() => {
                        const skipCount = rowActions.filter(a => a === 'skip').length;
                        const toUpload = parsedData.length - skipCount;
                        return skipCount > 0 ? `Upload ${toUpload} Drugs (${skipCount} skipped)` : `Upload ${toUpload} Drugs`;
                      })()
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
