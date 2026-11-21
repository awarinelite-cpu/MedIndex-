// src/components/PasteMedicationsPanel.js
// Admin-only: paste a list of medications (e.g. copied from Google) onto a
// condition. Each name is matched to an existing drug (just linked) or created
// saved as a name-only drug (no AI) to be filled in by hand later, then tagged
// to the condition.
import React, { useMemo, useState } from 'react';
import { ClipboardPaste, Check, AlertCircle, X } from 'lucide-react';
import useAutoSaveOnPaste from '../utils/useAutoSaveOnPaste';
import { useDrugs } from '../hooks/useDrugs';
import { parseMedicationList, addMedicationsToCondition } from '../utils/aiDrugSave';
import { parseMedicationEntries } from '../utils/medicationText';

const LABELS = { queued: 'Waiting', linked: 'Linked (already in app)', added: 'Added (fill in info later)', failed: 'Failed' };

export default function PasteMedicationsPanel({ conditionId, conditionName }) {
  const { drugs } = useDrugs();
  const [text, setText] = useState('');
  const [status, setStatus] = useState({});
  const [running, setRunning] = useState(false);
  const [removed, setRemoved] = useState([]);
  const entries = useMemo(() => parseMedicationEntries(text, parseMedicationList), [text]);
  // Drugs still on the list, plus the group labels that still have a drug under them.
  const rows = useMemo(() => {
    const out = [];
    entries.forEach((e, i) => {
      if (e.type === 'drug') { if (!removed.includes(e.text)) out.push(e); return; }
      const stopAt = e.type === 'heading' ? ['heading'] : ['heading', 'sub'];
      let has = false;
      for (let j = i + 1; j < entries.length && !stopAt.includes(entries[j].type); j++) {
        const x = entries[j];
        if (x.type === 'drug' && !removed.includes(x.text) && (e.type === 'heading' || x.underSub)) { has = true; break; }
      }
      if (has) out.push(e);
    });
    return out;
  }, [entries, removed]);
  const items = useMemo(() => rows.filter(r => r.type === 'drug').map(r => ({ name: r.text, heading: r.heading || '', sub: r.sub || '', hOrder: r.hOrder || 0, order: r.order || 0 })), [rows]);
  const names = useMemo(() => items.map(i => i.name), [items]);
  const auto = useAutoSaveOnPaste(names.length > 0);
  const updateText = (t) => { setText(t); setRemoved([]); };
  const removeName = (n) => setRemoved(prev => [...prev, n]);

  const pasteFromClipboard = async () => {
    try { const t = await navigator.clipboard.readText(); auto.arm(); updateText(t); } catch { /* user can paste manually */ }
  };

  const run = async () => {
    if (!names.length || running || !conditionId) return;
    setRunning(true);
    setStatus(Object.fromEntries(names.map(n => [n, { s: 'queued' }])));
    try {
      await addMedicationsToCondition({
        names, items, conditionId, existingDrugs: drugs,
        onProgress: (n, s, error) => setStatus(prev => ({ ...prev, [n]: { s, error } })),
      });
    } catch (e) {
      setStatus(prev => ({ ...prev, _error: { s: 'failed', error: e.message } }));
    }
    setRunning(false);
  };

  auto.saveRef.current = run;

  return (
    <div className="cp-paste">
      <h3 className="cp-paste-title"><ClipboardPaste size={18} strokeWidth={2.4} /> Paste medication list</h3>
      <p className="cp-paste-hint">Copy the list from Google, paste it here (one drug per line), and save. They are saved right away; you can add each drug's full information yourself afterwards.</p>
      <textarea className="cp-paste-box" rows={6} value={text} disabled={running}
        placeholder={`Paste medications for ${conditionName || 'this condition'}...`}
        onPaste={auto.arm}
        onChange={e => updateText(e.target.value)} />
      <div className="cp-paste-actions">
        <button type="button" className="cp-paste-btn alt" onClick={pasteFromClipboard} disabled={running}>Paste from clipboard</button>
        <button type="button" className="cp-paste-btn" onClick={run} disabled={running || !names.length}>
          {running ? 'Saving...' : `Add ${names.length || ''} medication${names.length === 1 ? '' : 's'}`}
        </button>
      </div>
      {rows.length > 0 && (
        <ul className="cp-paste-list">
          {rows.map((r, idx) => {
            if (r.type === 'heading') return <li key={`h${idx}`} className="cp-paste-head">{r.text}</li>;
            if (r.type === 'sub') return <li key={`s${idx}`} className="cp-paste-sub">{r.text}</li>;
            const n = r.text;
            const st = status[n]?.s;
            return (
              <li key={n} className={`${st ? `is-${st}` : ''}${r.underSub ? ' under-sub' : ''}`}>
                <span className="cp-paste-name">{n}</span>
                <span className="cp-paste-st">
                  {(st === 'linked' || st === 'added') && <Check size={14} />}
                  {st === 'failed' && <AlertCircle size={14} />}
                  {st ? (st === 'failed' && status[n].error ? status[n].error : LABELS[st]) : ''}
                  {!st && !running && (
                    <button type="button" className="cp-paste-x" onClick={() => removeName(n)}
                      aria-label={`Remove ${n}`} title="Not a drug - remove">
                      <X size={16} strokeWidth={3} />
                    </button>
                  )}
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
