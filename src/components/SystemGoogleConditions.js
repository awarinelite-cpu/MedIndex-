// src/components/SystemGoogleConditions.js
//
// Admin tool on a system page: search Google for MORE conditions in the
// system, paste the answer, preview it (conditions that already exist are
// flagged and never added twice) and save the new ones as conditions.
//
// The Google search carries the same short prompt the app's own AI uses for
// "more conditions" (mode "system_conditions" in api/_lib), including the list
// of conditions already in the system so Google is told not to repeat them.
import useAutoSaveOnPaste from '../utils/useAutoSaveOnPaste';
import React, { useMemo, useState } from 'react';
import { Search, ExternalLink, ClipboardPaste, Save, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { useAiInsight } from '../context/AiInsightContext';
import { addCustomConditions, slugifyConditionLabel, normalizeConditionLabel } from '../hooks/useCustomConditions';
import { stripCitations } from '../utils/parseAiDrugDetail';

const EM = '\u2014';

export function googleSystemConditionsUrl(systemName, existingLabels = []) {
  const known = existingLabels.length
    ? `\nConditions already covered for this system (do not repeat these or close synonyms of them):\n${existingLabels.join(', ')}\n`
    : '';
  const q = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The app organizes medications by body system, and within each system, by the specific clinical conditions treated there. The nurse is looking at the "${systemName}" system and wants more condition categories added to it beyond what's already there.\n`
    + `${known}\n`
    + `Suggest additional clinically distinct conditions commonly managed within the "${systemName}" system that are NOT already covered. For each one, output exactly this 3-line block, with a blank line between blocks:\n\n`
    + `### <Condition Label>\nIcon: <single relevant emoji>\nKeywords: <6-10 comma-separated lowercase keyword phrases that would appear in a drug's indications/overview text if that drug treats this condition>\n\n`
    + `Suggest around 5-10 additional conditions if the system reasonably supports that many being clinically distinct; suggest fewer if the system is narrow. Do not invent an implausible condition just to hit a number, and do not duplicate or closely overlap with the conditions already covered above. Output nothing except the blocks themselves ${EM} no preamble or closing text.`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

const STOP = new Set(['and', 'the', 'of', 'with', 'a', 'an', 'in', 'on', 'to']);
function keywordsFromLabel(label) {
  const norm = String(label || '').toLowerCase().trim();
  const words = norm.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  return Array.from(new Set([norm, ...words]));
}

const cleanLabel = raw => String(raw || '')
  .replace(/^#{1,6}\s*/, '')
  .replace(/^\s*(?:[-*\u2022]+|\d+[.)])\s*/, '')
  .replace(/\*\*|__/g, '')
  .replace(/\s*:\s*$/, '')
  .trim();

// Reads Google's answer: the "### Label / Icon: / Keywords:" blocks (with or
// without the ###), or, failing that, a plain list of condition names.
export function parsePastedConditions(text) {
  const cleaned = stripCitations(String(text || '').replace(/```[a-z]*\s*/gi, '')).trim();
  if (!cleaned) return [];
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const structured = lines.some(l => /^(icon|keywords)\s*:/i.test(l));
  const items = [];

  if (structured) {
    let cur = null;
    for (const l of lines) {
      let m;
      if ((m = l.match(/^icon\s*:\s*(.+)$/i))) { if (cur) cur.icon = m[1].trim().split(/\s+/)[0]; continue; }
      if ((m = l.match(/^keywords\s*:\s*(.+)$/i))) {
        if (cur) cur.keywords = m[1].split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        continue;
      }
      const label = cleanLabel(l);
      if (label && label.length <= 90) { cur = { label, icon: '', keywords: [] }; items.push(cur); }
    }
    return items
      .filter(i => i.keywords.length || i.icon)
      .map(i => ({ label: i.label, icon: i.icon || '\uD83E\uDE7A', keywords: i.keywords.length ? i.keywords : keywordsFromLabel(i.label) }));
  }

  // plain list: one condition per short line (drop the explanation after a dash / colon)
  return lines
    .map(l => cleanLabel(l.split(/\s+[\u2013\u2014-]\s+|:\s+/)[0]))
    .filter(l => l.length >= 3 && l.length <= 80 && l.split(/\s+/).length <= 9 && !/[.!?]$/.test(l))
    .map(label => ({ label, icon: '\uD83E\uDE7A', keywords: keywordsFromLabel(label) }));
}

const baseKey = label => normalizeConditionLabel(String(label || '').replace(/\(.*?\)/g, ''));

export default function SystemGoogleConditions({ systemId, systemName, existingLabels = [] }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const { enqueueAutoFillCondition } = useAiInsight();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  // "Already exists" = same label, or same label ignoring a "(...)" qualifier.
  const existingKeys = useMemo(() => {
    const s = new Set();
    existingLabels.forEach(l => { s.add(normalizeConditionLabel(l)); s.add(baseKey(l)); });
    return s;
  }, [existingLabels]);

  const rows = useMemo(() => {
    const seen = new Set();
    return parsePastedConditions(text).map(item => {
      const full = normalizeConditionLabel(item.label);
      const base = baseKey(item.label);
      const duplicate = existingKeys.has(full) || existingKeys.has(base);
      const repeated = seen.has(full);
      seen.add(full);
      return { ...item, status: duplicate ? 'exists' : repeated ? 'repeat' : 'new' };
    });
  }, [text, existingKeys]);

  const toAdd = rows.filter(r => r.status === 'new');
  const auto = useAutoSaveOnPaste(toAdd.length > 0);

  const pasteFromClipboard = async () => {
    try { const t = await navigator.clipboard.readText(); auto.arm(); setText(t); setState('idle'); setError(''); }
    catch { setError('Could not read the clipboard. Long-press in the box below and choose Paste.'); }
  };

  const save = async () => {
    if (!toAdd.length) return;
    setState('saving'); setError('');
    try {
      const payload = toAdd.map(r => ({ id: slugifyConditionLabel(r.label), label: r.label, icon: r.icon, keywords: r.keywords }));
      await addCustomConditions(systemId, payload);
      payload.forEach(c => enqueueAutoFillCondition({
        conditionId: c.id, label: c.label, conditionKeywords: c.keywords, systemName, endpoint: provider.endpoint,
      }));
      setSavedCount(payload.length);
      setState('saved');
      setText('');
    } catch (e) {
      setState('error');
      setError(`SAVE FAILED: ${e.code ? `[${e.code}] ` : ''}${e.message || 'Unknown error'}`);
    }
  };

  auto.saveRef.current = save;

  if (!isAdmin) return null;

  return (
    <div className="mt-4 bg-white border border-drug-border rounded-2xl overflow-hidden">
      <a
        href={googleSystemConditionsUrl(systemName, existingLabels)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white font-semibold text-sm"
      >
        <Search className="w-4 h-4" /> Search Google for more {systemName} conditions <ExternalLink className="w-4 h-4" />
      </a>
      <p className="px-4 pt-2 text-xs text-drug-muted">
        The search already lists the {existingLabels.length} condition{existingLabels.length === 1 ? '' : 's'} in this system so Google skips them.
        Copy Google's answer and paste it below. Conditions that already exist are never added twice.
      </p>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <ClipboardPaste className="w-5 h-5 text-violet-600 flex-shrink-0" />
        <span className="flex-1 font-bold text-violet-900 text-sm">Paste the conditions Google found</span>
        <ChevronDown className={`w-4 h-4 text-violet-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm"
          >
            <ClipboardPaste className="w-4 h-4" /> Paste from Clipboard
          </button>
          <textarea
            value={text}
            onPaste={auto.arm}
            onChange={e => { setText(e.target.value); setState('idle'); setError(''); }}
            rows={6}
            placeholder={'### Atrial Septal Defect\nIcon: \uD83E\uDEC0\nKeywords: atrial septal defect, asd, congenital heart defect'}
            className="w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-mono"
          />
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

          {rows.length > 0 && (
            <div className="rounded-lg border border-violet-200 overflow-hidden">
              <p className="px-3 py-2 text-xs font-semibold text-violet-900 bg-violet-50">
                {rows.length} found: {toAdd.length} new, {rows.length - toAdd.length} already in {systemName} (skipped)
              </p>
              <div className="max-h-64 overflow-y-auto divide-y divide-drug-border">
                {rows.map((r, i) => (
                  <div key={`${r.label}-${i}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-lg flex-shrink-0">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{r.label}</div>
                      <div className="text-xs text-drug-muted truncate">{r.keywords.slice(0, 4).join(', ')}</div>
                    </div>
                    <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'new' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.status === 'new' ? 'New' : r.status === 'exists' ? 'Already exists' : 'Repeated'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state === 'saved' && (
            <p className="text-sm font-semibold text-green-700">
              Added {savedCount} new condition{savedCount === 1 ? '' : 's'}. Drugs are being matched to them automatically.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!toAdd.length || state === 'saving'}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-50"
            >
              {state === 'saving'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Add {toAdd.length || ''} new condition{toAdd.length === 1 ? '' : 's'}</>}
            </button>
            {text && (
              <button
                type="button"
                onClick={() => { setText(''); setError(''); setState('idle'); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
