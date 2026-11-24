// src/pages/OfflinePage.js
// Route: /offline — one-tap "Download for offline", last-sync time and
// storage use. The data itself lives in Firestore's persistent cache, so
// this page just forces a complete, fresh pull and reports on it.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudOff, Download, CheckCircle2, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { downloadForOffline, getLastSync, getStorageEstimate } from '../utils/offlineSync';

const COUNT_LABELS = {
  drugs: 'drugs',
  procedures: 'procedures',
  condition_clinical_info: 'condition notes',
};

function timeAgo(ms) {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const fmtMB = (b) => `${(b / (1024 * 1024)).toFixed(b > 1e9 ? 0 : 1)} MB`;

export default function OfflinePage() {
  const online = useOnlineStatus();
  const [last, setLast] = useState(getLastSync());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [storage, setStorage] = useState(null);
  const saveData = typeof navigator !== 'undefined' && !!navigator.connection?.saveData;
  const [includeImages, setIncludeImages] = useState(!saveData);
  const cancelRef = useRef(false);

  useEffect(() => { getStorageEstimate().then(setStorage); }, [last]);
  useEffect(() => () => { cancelRef.current = true; }, []);

  const start = async () => {
    setError('');
    setBusy(true);
    cancelRef.current = false;
    try {
      const info = await downloadForOffline({
        includeImages,
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      });
      setLast(info);
    } catch (e) {
      setError(e.message || 'Download failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pct = progress?.percent ?? 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="mi-off-icon"><CloudOff size={26} /></span>
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: 'var(--mi-ink)' }}>Offline mode</h1>
          <p className="text-sm" style={{ color: 'var(--mi-body)' }}>Save the whole app to this phone for wards with poor network.</p>
        </div>
      </div>

      <div className="mi-off-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide opacity-70">Last saved</div>
            <div className="text-lg font-extrabold">{last ? timeAgo(last.at) : 'Not yet downloaded'}</div>
          </div>
          {last && <CheckCircle2 size={28} className="text-green-600" />}
        </div>
        {last && (
          <ul className="mt-2 text-sm space-y-0.5 opacity-90">
            {Object.entries(last.counts).map(([k, n]) => (
              <li key={k}>{n.toLocaleString()} {COUNT_LABELS[k] || k}</li>
            ))}
            {last.imagesIncluded && <li>{last.images.toLocaleString()} images</li>}
          </ul>
        )}
        {storage && storage.quota > 0 && (
          <div className="mt-2 text-xs opacity-70">
            Storage used by MedIndex: {fmtMB(storage.usage)} of {fmtMB(storage.quota)} available
          </div>
        )}
      </div>

      <label className="mi-off-row">
        <input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)} disabled={busy} />
        <span>
          <b>Include drug images</b>
          <span className="block text-xs opacity-75">Uses more data. Turn off to save text only.</span>
        </span>
      </label>

      {busy && (
        <div>
          <div className="flex justify-between text-sm font-semibold mb-1">
            <span>{progress?.label || 'Starting…'}</span><span>{pct}%</span>
          </div>
          <div className="mi-off-bar"><div style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {error && (
        <div className="mi-off-error"><AlertTriangle size={18} /> <span>{error}</span></div>
      )}

      <button type="button" className="mi-off-btn" onClick={start} disabled={busy || !online}>
        <Download size={20} />
        {busy ? 'Downloading…' : last ? 'Update offline data' : 'Download for offline'}
      </button>
      {!online && <p className="text-sm text-center opacity-80">You're offline now. Connect to Wi-Fi or mobile data to download.</p>}
      {busy && (
        <button type="button" className="w-full text-sm font-semibold underline opacity-80" onClick={() => { cancelRef.current = true; }}>
          Cancel
        </button>
      )}

      <p className="text-xs opacity-70 leading-relaxed">
        Tip: update once a week on Wi-Fi. Anything you open while online is also saved automatically.
        Calculators, Lab Reference and the Emergency guides are built into the app and always work offline.
      </p>

      <Link to="/emergency" className="mi-off-link">
        <ShieldAlert size={22} />
        <span><b>Emergency guides</b><span className="block text-xs opacity-80">Available offline, always</span></span>
        <ChevronRight size={20} />
      </Link>
    </div>
  );
}
