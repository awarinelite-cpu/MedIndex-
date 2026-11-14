// src/components/PasteMedicationsPanel.js
// Admin-only: paste a list of medications (e.g. copied from Google) onto a
// condition. Each name is matched to an existing drug (just linked) or created
// saved as a name-only drug (no AI) to be filled in by hand later, then tagged
// to the condition.
import React, { useMemo, useState } from 'react';
import { ClipboardPaste, Check, AlertCircle } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { parseMedicationList, addMedicationsToCondition } from '../utils/aiDrugSave';

const LABELS = { queued: 'Waiting', linked: 'Linked (already in app)', added: 'Added (fill in info later)', failed: 'Failed' };

export default function PasteMedicationsPanel({ conditionId, conditionName }) {
  const { drugs } = useDrugs();
  const [text, setText] = useState('');
  const [status, setStatus] = useState({});
  const [running, setRunning] = useState(false);
  const names = useMemo(() => parseMedicationList(text), [text]);

  const pasteFromClipboard = async () => {
    try { setText(await navigator.clipboard.readText()); } catch { /* user can paste manually */ }
  };

  const run = async () => {
    if (!names.length || running || !conditionId) return;
    setRunning(true);
    setStatus(Object.fromEntries(names.map(n => [n, { s: 'queued' }])));
    try {
      await addMedicationsToCondition({
        names, conditionId, existingDrugs: drugs,
        onProgress: (n, s, error) => setStatus(prev => ({ ...prev, [n]: { s, error } })),
      });
    } catch (e) {
      setStatus(prev => ({ ...prev, _error: { s: 'failed', error: e.message } }));
    }
    setRunning(false);
  };

  return (
    <div className="cp-paste">
      <h3 className="cp-paste-title"><ClipboardPaste size={18} strokeWidth={2.4} /> Paste medication list</h3>
      <p className="cp-paste-hint">Copy the list from Google, paste it here (one drug per line), and save. They are saved right away; you can add each drug's full information yourself afterwards.</p>
      <textarea className="cp-paste-box" rows={6} value={text} disabled={running}
        placeholder={`Paste medications for ${conditionName || 'this condition'}...`}
        onChange={e => setText(e.target.value)} />
      <div className="cp-paste-actions">
        <button type="button" className="cp-paste-btn alt" onClick={pasteFromClipboard} disabled={running}>Paste from clipboard</button>
        <button type="button" className="cp-paste-btn" onClick={run} disabled={running || !names.length}>
          {running ? 'Saving...' : `Add ${names.length || ''} medication${names.length === 1 ? '' : 's'}`}
        </button>
      </div>
      {names.length > 0 && (
        <ul className="cp-paste-list">
          {names.map(n => {
            const st = status[n]?.s;
            return (
              <li key={n} className={st ? `is-${st}` : ''}>
                <span>{n}</span>
                <span className="cp-paste-st">
                  {(st === 'linked' || st === 'added') && <Check size={14} />}
                  {st === 'failed' && <AlertCircle size={14} />}
                  {st ? (st === 'failed' && status[n].error ? status[n].error : LABELS[st]) : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {status._error && <p className="cp-paste-err">{status._error.error}</p>}
    </div>
  );
}
