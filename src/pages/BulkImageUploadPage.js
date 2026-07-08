import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { Upload, ImageIcon, CheckCircle, XCircle, Download, AlertTriangle } from 'lucide-react';
import { normalizeImageUrl } from '../utils/generateDrugImage';
import { slugifyDrugName } from '../utils/aiDrugSave';

// Same deterministic-ID convention used across the app (UploadPage,
// aiDrugSave.slugifyDrugName) — a drug's doc ID is derived from its
// generic name, so this is how we match CSV rows to existing drugs.
function computeDocId(genericName) {
  if (!genericName) return null;
  return slugifyDrugName(genericName);
}

// Accept a few common header spellings so admins don't have to reformat
// whatever sheet they already have.
function getGenericName(row) {
  return (row.generic_name || row.drug_name || row.name || row.drug || '').trim();
}
function getImageUrl(row) {
  return (row.image_url || row.image_link || row.image || row.link || row.url || '').trim();
}

export default function BulkImageUploadPage() {
  // eslint-disable-next-line no-unused-vars
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]); // [{ name, docId, url, status: 'matched'|'not_found'|'invalid_url' }]
  const [parseStatus, setParseStatus] = useState('idle'); // idle | checking | ready | error
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | success | partial
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadSummary, setUploadSummary] = useState(null);
  const [parseError, setParseError] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setParseStatus('checking');
    setUploadStatus('idle');
    setUploadSummary(null);
    setParseError('');

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          await checkRows(results.data);
        } catch (err) {
          setParseError(err.message || 'Failed to check rows against the database.');
          setParseStatus('error');
        }
      },
      error: (err) => {
        setParseError('CSV parsing error: ' + err.message);
        setParseStatus('error');
      },
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    multiple: false,
  });

  async function checkRows(data) {
    const prelim = data.map(row => {
      const name = getGenericName(row);
      const rawUrl = getImageUrl(row);
      if (!name) return { name: '', docId: null, url: '', status: 'not_found' };
      const docId = computeDocId(name);
      let url = '';
      try {
        url = normalizeImageUrl(rawUrl);
        if (!/^https?:\/\/.+/i.test(url)) throw new Error('invalid');
      } catch {
        return { name, docId, url: rawUrl, status: 'invalid_url' };
      }
      return { name, docId, url, status: 'pending' }; // resolved to 'matched'/'not_found' below
    });

    const idsToCheck = [...new Set(prelim.filter(r => r.status === 'pending').map(r => r.docId))];
    const existingIds = new Set();
    const CHUNK = 30;
    for (let i = 0; i < idsToCheck.length; i += CHUNK) {
      const idChunk = idsToCheck.slice(i, i + CHUNK);
      if (idChunk.length === 0) continue;
      const snap = await getDocs(query(collection(db, 'drugs'), where(documentId(), 'in', idChunk)));
      snap.forEach(d => existingIds.add(d.id));
    }

    const finalRows = prelim.map(r => {
      if (r.status !== 'pending') return r;
      return { ...r, status: existingIds.has(r.docId) ? 'matched' : 'not_found' };
    });

    setRows(finalRows);
    setParseStatus('ready');
  }

  async function handleUpload() {
    const matchedRows = rows.filter(r => r.status === 'matched');
    if (matchedRows.length === 0) return;

    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: matchedRows.length });

    const BATCH_SIZE = 500;
    let uploaded = 0;
    let errorCount = 0;

    const chunks = [];
    for (let i = 0; i < matchedRows.length; i += BATCH_SIZE) {
      chunks.push(matchedRows.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(chunks.map(async (chunk) => {
      const batch = writeBatch(db);
      chunk.forEach(row => {
        const ref = doc(db, 'drugs', row.docId);
        // update() only touches these two fields — every other field on the
        // drug (dosage, pharmacology, etc.) is left completely untouched.
        batch.update(ref, {
          image_url:    row.url,
          last_updated: serverTimestamp(),
        });
      });
      try {
        await batch.commit();
        uploaded += chunk.length;
        setUploadProgress({ current: uploaded, total: matchedRows.length });
      } catch (err) {
        console.error('Batch error:', err);
        errorCount += chunk.length;
      }
    }));

    setUploadSummary({
      updated: uploaded,
      notFound: rows.filter(r => r.status === 'not_found').length,
      invalidUrl: rows.filter(r => r.status === 'invalid_url').length,
      errors: errorCount,
    });
    setUploadStatus(errorCount === 0 ? 'success' : 'partial');
  }

  function downloadTemplate() {
    const csv = Papa.unparse([{ generic_name: '', image_url: '' }]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bulk_image_template.csv';
    link.click();
  }

  function reset() {
    setFile(null);
    setRows([]);
    setParseStatus('idle');
    setUploadStatus('idle');
    setUploadSummary(null);
    setParseError('');
  }

  const matchedCount    = rows.filter(r => r.status === 'matched').length;
  const notFoundCount   = rows.filter(r => r.status === 'not_found').length;
  const invalidUrlCount = rows.filter(r => r.status === 'invalid_url').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-primary-600" /> Bulk Image Upload
        </h1>
        <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-800">
          <Download className="w-4 h-4" /> Template
        </button>
      </div>
      <p className="text-drug-muted text-sm mb-6">
        Upload a CSV with <code className="bg-gray-100 px-1.5 py-0.5 rounded">generic_name</code> and{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded">image_url</code> columns to link images
        (e.g. Imgur) to many drugs at once. Only the image is touched — nothing else on each drug's
        record is changed.
      </p>

      {parseStatus === 'idle' && uploadStatus === 'idle' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary-500 bg-primary-50' : 'border-drug-border hover:border-primary-300'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-primary-400 mx-auto mb-3" />
          <p className="font-semibold">{isDragActive ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}</p>
          <p className="text-sm text-drug-muted mt-1">or tap to browse</p>
        </div>
      )}

      {parseStatus === 'checking' && (
        <div className="text-center py-10 text-drug-muted">Checking rows against the database…</div>
      )}

      {parseStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-start gap-2">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> {parseError}
        </div>
      )}

      {parseStatus === 'ready' && uploadStatus === 'idle' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="text-sm font-semibold px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
              {matchedCount} matched
            </span>
            {notFoundCount > 0 && (
              <span className="text-sm font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg">
                {notFoundCount} not found
              </span>
            )}
            {invalidUrlCount > 0 && (
              <span className="text-sm font-semibold px-3 py-1.5 bg-red-50 text-red-700 rounded-lg">
                {invalidUrlCount} invalid URL
              </span>
            )}
          </div>

          <div className="bg-white border border-drug-border rounded-xl overflow-hidden max-h-96 overflow-y-auto mb-4">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i !== rows.length - 1 ? 'border-b border-drug-border' : ''}`}>
                {r.status === 'matched' && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                {r.status === 'not_found' && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                {r.status === 'invalid_url' && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                <span className="font-medium truncate flex-1">{r.name || '(blank name)'}</span>
                <span className="text-xs text-drug-muted truncate flex-1">{r.url || '(no URL)'}</span>
              </div>
            ))}
          </div>

          {notFoundCount > 0 && (
            <p className="text-xs text-amber-700 mb-4">
              Rows marked "not found" didn't match any existing drug by name — check spelling
              matches exactly what's already in MedIndex. They'll be skipped automatically.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={matchedCount === 0}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              Update {matchedCount} image{matchedCount === 1 ? '' : 's'}
            </button>
            <button onClick={reset} className="px-5 py-2.5 border border-drug-border rounded-xl font-semibold text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="text-center py-10">
          <div className="text-drug-muted mb-2">Uploading {uploadProgress.current} / {uploadProgress.total}…</div>
          <div className="w-full max-w-sm mx-auto h-2 bg-gray-100 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full bg-primary-600 transition-all"
              style={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {(uploadStatus === 'success' || uploadStatus === 'partial') && uploadSummary && (
        <div className="bg-white border border-drug-border rounded-xl p-6 text-center">
          <CheckCircle className={`w-10 h-10 mx-auto mb-3 ${uploadStatus === 'success' ? 'text-green-600' : 'text-amber-600'}`} />
          <h2 className="text-lg font-bold mb-2">{uploadStatus === 'success' ? 'Upload complete' : 'Upload finished with some errors'}</h2>
          <p className="text-sm text-drug-muted mb-1">{uploadSummary.updated} image{uploadSummary.updated === 1 ? '' : 's'} updated</p>
          {uploadSummary.notFound > 0 && <p className="text-sm text-drug-muted mb-1">{uploadSummary.notFound} not found (skipped)</p>}
          {uploadSummary.invalidUrl > 0 && <p className="text-sm text-drug-muted mb-1">{uploadSummary.invalidUrl} invalid URL (skipped)</p>}
          {uploadSummary.errors > 0 && <p className="text-sm text-red-600 mb-1">{uploadSummary.errors} failed to save</p>}
          <button onClick={reset} className="mt-4 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700">
            Upload another file
          </button>
        </div>
      )}
    </div>
  );
}
