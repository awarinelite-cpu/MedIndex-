// src/components/PhotoAutoMatchUpload.js
//
// "Photos (auto-match)" mode of Bulk Image Upload: admin drops in raw
// photos of drug packages. Each photo is OCR'd (Claude vision, via
// api/ocr-drug-name) to read the printed drug name, fuzzy-matched against
// the existing drug list, and shown for review. Confirmed rows are
// uploaded to ImgChest (api/imgchest-upload) and the resulting link is
// saved to that drug's image_url field — same Firestore write pattern as
// the CSV flow in BulkImageUploadPage.

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useDrugs } from '../hooks/useDrugs';
import { useAiProvider } from '../context/AiProviderContext';
import { matchDrugName, MATCH_HIGH_CONFIDENCE, MATCH_LOW_CONFIDENCE } from '../utils/matchDrugName';
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const CONCURRENCY = 4;

// Only these three providers accept image input with the models this app
// has them configured with (see api/ocr-drug-name.js). DeepSeek and Kimi
// fall back to Gemini for OCR specifically — their text-insight models
// don't do vision.
const VISION_CAPABLE = new Set(['claude', 'gemini', 'openai']);
function ocrProviderFor(selectedProviderId) {
  return VISION_CAPABLE.has(selectedProviderId) ? selectedProviderId : 'gemini';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runWithConcurrency(items, limit, worker) {
  let i = 0;
  async function next() {
    if (i >= items.length) return;
    const idx = i++;
    await worker(items[idx], idx);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

function statusFromScore(score) {
  if (score >= MATCH_HIGH_CONFIDENCE) return 'matched';
  if (score >= MATCH_LOW_CONFIDENCE) return 'review';
  return 'no_match';
}

export default function PhotoAutoMatchUpload() {
  const { drugs } = useDrugs();
  const { providerId } = useAiProvider();
  const ocrProvider = ocrProviderFor(providerId);
  const [rows, setRows] = useState([]); // see shape below
  const [phase, setPhase] = useState('idle'); // idle | processing | review | uploading | done
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadSummary, setUploadSummary] = useState(null);
  const rowsRef = useRef([]);

  // Match candidates include both the generic name and every brand name
  // (brand_names is a comma-separated string) — a photo usually shows the
  // brand printed on the box, which can be completely unrelated-looking
  // to the generic name the drug is actually filed under.
  const drugList = drugs.flatMap(d => {
    const entries = [];
    if (d.generic_name) entries.push({ id: d.id, name: d.generic_name, displayName: d.generic_name });
    (d.brand_names || '')
      .split(',')
      .map(b => b.trim())
      .filter(Boolean)
      .forEach(brand => entries.push({ id: d.id, name: brand, displayName: `${brand} (${d.generic_name})` }));
    return entries;
  });

  const setRow = (id, patch) => {
    rowsRef.current = rowsRef.current.map(r => (r.id === id ? { ...r, ...patch } : r));
    setRows([...rowsRef.current]);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const initial = acceptedFiles.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      previewUrl: URL.createObjectURL(file),
      dataUrl: null,
      ocrName: null,
      ocrError: '',
      matchedId: null,
      matchedName: '',
      score: 0,
      status: 'processing', // processing | matched | review | no_match | error
      manualQuery: '',
      include: true,
    }));
    rowsRef.current = initial;
    setRows(initial);
    setPhase('processing');

    runWithConcurrency(initial, CONCURRENCY, async (row) => {
      try {
        const dataUrl = await readFileAsDataUrl(row.file);
        setRow(row.id, { dataUrl });

        const ocrRes = await fetch('/api/ocr-drug-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: dataUrl, provider: ocrProvider }),
        });
        const ocrData = await ocrRes.json().catch(() => ({}));
        if (!ocrRes.ok) throw new Error(ocrData.error || 'OCR failed');

        const name = ocrData.name;
        if (!name) {
          setRow(row.id, { ocrName: null, status: 'no_match', include: false });
          return;
        }

        const best = matchDrugName(name, drugList);
        const status = best ? statusFromScore(best.score) : 'no_match';
        setRow(row.id, {
          ocrName: name,
          matchedId: best ? best.id : null,
          matchedName: best ? best.displayName : '',
          manualQuery: best ? best.displayName : name,
          score: best ? best.score : 0,
          status,
          include: status === 'matched',
        });
      } catch (err) {
        setRow(row.id, { status: 'error', ocrError: err.message || 'Failed to read image', include: false });
      }
    }).then(() => setPhase('review'));
  }, [drugList, ocrProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: true,
  });

  function handleManualPick(rowId, drugName) {
    const typed = drugName.trim().toLowerCase();
    const found = drugList.find(d => d.displayName.toLowerCase() === typed || d.name.toLowerCase() === typed);
    if (found) {
      setRow(rowId, {
        matchedId: found.id,
        matchedName: found.displayName,
        manualQuery: found.displayName,
        status: 'matched',
        include: true,
      });
    } else {
      setRow(rowId, { manualQuery: drugName, matchedId: null, status: 'review', include: false });
    }
  }

  async function handleUpload() {
    const toUpload = rowsRef.current.filter(r => r.include && r.matchedId && r.dataUrl);
    if (toUpload.length === 0) return;

    setPhase('uploading');
    setUploadProgress({ current: 0, total: toUpload.length });

    let uploaded = 0;
    let failed = 0;
    const successful = [];

    await runWithConcurrency(toUpload, CONCURRENCY, async (row) => {
      try {
        const res = await fetch('/api/imgchest-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: row.dataUrl, filename: row.file.name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || 'ImgChest upload failed');
        successful.push({ docId: row.matchedId, url: data.url });
        uploaded++;
      } catch (err) {
        failed++;
      } finally {
        setUploadProgress(p => ({ ...p, current: p.current + 1 }));
      }
    });

    // Batch-write all successful image URLs to Firestore, same
    // touch-only-the-image-field pattern as the CSV flow.
    const BATCH_SIZE = 500;
    for (let i = 0; i < successful.length; i += BATCH_SIZE) {
      const chunk = successful.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(({ docId, url }) => {
        const ref = doc(collection(db, 'drugs'), docId);
        batch.update(ref, { image_url: url, last_updated: serverTimestamp() });
      });
      try {
        await batch.commit();
      } catch (err) {
        failed += chunk.length;
        uploaded -= chunk.length;
      }
    }

    setUploadSummary({
      uploaded,
      failed,
      skipped: rowsRef.current.length - toUpload.length,
    });
    setPhase('done');
  }

  function reset() {
    rowsRef.current = [];
    setRows([]);
    setPhase('idle');
    setUploadSummary(null);
    setUploadProgress({ current: 0, total: 0 });
  }

  const processingCount = rows.filter(r => r.status === 'processing').length;
  const matchedCount = rows.filter(r => r.include && r.matchedId).length;
  const needsReviewCount = rows.filter(r => r.status === 'review' || r.status === 'no_match' || r.status === 'error').length;

  const providerLabel = { claude: 'Claude', gemini: 'Gemini', openai: 'ChatGPT' }[ocrProvider];
  const isFallback = ocrProvider !== providerId;

  return (
    <div>
      <p className="text-drug-muted text-sm mb-2">
        Drop in raw photos of drug packages/labels. Each photo is read automatically to find the
        drug name, matched to an existing drug, and uploaded to ImgChest once you confirm. Anything
        unclear or unmatched is left for you to fix below before anything is saved.
      </p>
      <p className="text-xs text-drug-muted mb-6">
        Reading photos with <span className="font-semibold">{providerLabel}</span>
        {isFallback && ` (your selected provider doesn't support images, so this falls back from ${providerId})`}.
      </p>

      {phase === 'idle' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary-500 bg-primary-50' : 'border-drug-border hover:border-primary-300'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-primary-400 mx-auto mb-3" />
          <p className="font-semibold">{isDragActive ? 'Drop your photos here' : 'Drag & drop drug photos here'}</p>
          <p className="text-sm text-drug-muted mt-1">or tap to browse — multiple files at once</p>
        </div>
      )}

      {(phase === 'processing' || phase === 'review') && rows.length > 0 && (
        <div>
          {phase === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-drug-muted mb-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Reading {processingCount} of {rows.length} photos…
            </div>
          )}

          {phase === 'review' && (
            <div className="flex flex-wrap gap-3 mb-4">
              <span className="text-sm font-semibold px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
                {matchedCount} ready to upload
              </span>
              {needsReviewCount > 0 && (
                <span className="text-sm font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg">
                  {needsReviewCount} need review
                </span>
              )}
            </div>
          )}

          <div className="space-y-2 max-h-[32rem] overflow-y-auto mb-4">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-white border border-drug-border rounded-xl">
                <img src={r.previewUrl} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-100" />

                <div className="flex-1 min-w-0">
                  {r.status === 'processing' && (
                    <span className="text-sm text-drug-muted inline-flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading…
                    </span>
                  )}

                  {r.status !== 'processing' && (
                    <>
                      <div className="text-xs text-drug-muted mb-1 truncate">
                        Photo read: <span className="font-medium">{r.ocrName || '(no name detected)'}</span>
                      </div>
                      <input
                        type="text"
                        list="drug-name-options"
                        value={r.manualQuery}
                        onChange={(e) => handleManualPick(r.id, e.target.value)}
                        placeholder="Type drug name to match…"
                        className="w-full text-sm px-2.5 py-1.5 border border-drug-border rounded-lg"
                      />
                    </>
                  )}
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {r.status === 'matched' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {r.status === 'review' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  {(r.status === 'no_match' || r.status === 'error') && <XCircle className="w-5 h-5 text-red-600" />}
                  {r.status !== 'processing' && (
                    <input
                      type="checkbox"
                      checked={r.include && !!r.matchedId}
                      disabled={!r.matchedId}
                      onChange={(e) => setRow(r.id, { include: e.target.checked })}
                      title={r.matchedId ? 'Include in upload' : 'Pick a matching drug first'}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <datalist id="drug-name-options">
            {[...new Map(drugList.map(d => [d.displayName, d])).values()].map(d => (
              <option key={`${d.id}-${d.displayName}`} value={d.displayName} />
            ))}
          </datalist>

          {phase === 'review' && (
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={matchedCount === 0}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                Upload {matchedCount} photo{matchedCount === 1 ? '' : 's'}
              </button>
              <button onClick={reset} className="px-5 py-2.5 border border-drug-border rounded-xl font-semibold text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'uploading' && (
        <div className="text-center py-10">
          <div className="text-drug-muted mb-2">Uploading {uploadProgress.current} / {uploadProgress.total}…</div>
          <div className="w-full max-w-sm mx-auto h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all"
              style={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'done' && uploadSummary && (
        <div className="bg-white border border-drug-border rounded-xl p-6 text-center">
          <CheckCircle className={`w-10 h-10 mx-auto mb-3 ${uploadSummary.failed === 0 ? 'text-green-600' : 'text-amber-600'}`} />
          <h2 className="text-lg font-bold mb-2">{uploadSummary.failed === 0 ? 'Upload complete' : 'Upload finished with some errors'}</h2>
          <p className="text-sm text-drug-muted mb-1">{uploadSummary.uploaded} photo{uploadSummary.uploaded === 1 ? '' : 's'} uploaded and linked</p>
          {uploadSummary.skipped > 0 && <p className="text-sm text-drug-muted mb-1">{uploadSummary.skipped} skipped (unmatched or unchecked)</p>}
          {uploadSummary.failed > 0 && <p className="text-sm text-red-600 mb-1">{uploadSummary.failed} failed to upload</p>}
          <button onClick={reset} className="mt-4 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700">
            Upload more photos
          </button>
        </div>
      )}
    </div>
  );
}
