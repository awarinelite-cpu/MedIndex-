// src/components/DrugOfTheDay.js
// Home-page "Drug of the Day": one drug per Nigerian calendar day (Africa/Lagos),
// the same for every user, picked deterministically from the live drug list.
// Includes a one-tap daily class quiz with a day streak (stored on-device only).

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pill, ChevronRight, Flame, CheckCircle2, XCircle } from 'lucide-react';
import { getDisplayDrugClass } from '../utils/drugCategory';

const QUIZ_KEY = 'mi_dotd_quiz';
const STREAK_KEY = 'mi_dotd_streak';

// Day number + ISO key in Nigeria time, so the drug flips at local midnight.
function lagosToday() {
  let key;
  try {
    key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    key = new Date().toISOString().slice(0, 10);
  }
  const [y, m, d] = key.split('-').map(Number);
  return { key, day: Math.floor(Date.UTC(y, m - 1, d) / 86400000) };
}

// Small seeded PRNG so every device gets the same pick/options on the same day.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clean = (v) => String(v || '').replace(/[#*_`]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\s+/g, ' ').trim();

// First sentence / list item, capped, for compact display.
function brief(v, max = 150) {
  const s = clean(v);
  if (!s) return '';
  const first = s.split(/(?<=[.;])\s|\s[-•]\s/)[0] || s;
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export default function DrugOfTheDay({ drugs }) {
  const today = useMemo(lagosToday, []);

  const pool = useMemo(() => (
    (drugs || [])
      .filter(d => d && d.id && d.generic_name && clean(d.overview).length > 20 && getDisplayDrugClass(d))
      .sort((a, b) => a.generic_name.localeCompare(b.generic_name))
  ), [drugs]);

  const pick = useMemo(() => {
    if (!pool.length) return null;
    return pool[Math.floor(mulberry32(today.day)() * pool.length)];
  }, [pool, today.day]);

  const options = useMemo(() => {
    if (!pick) return [];
    const correct = getDisplayDrugClass(pick);
    const rand = mulberry32(today.day + 101);
    const others = [...new Set(pool.map(getDisplayDrugClass))].filter(c => c && c !== correct);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const opts = [correct, ...others.slice(0, 2)];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [pick, pool, today.day]);

  const [picked, setPicked] = useState(() => {
    const q = readJson(QUIZ_KEY);
    return q && q.date === today.key ? q.picked : null;
  });
  const [streak, setStreak] = useState(() => readJson(STREAK_KEY) || { last: 0, count: 0, best: 0 });

  if (!pick || options.length < 2) return null;

  const correct = getDisplayDrugClass(pick);
  const answered = picked !== null;

  const answer = (opt) => {
    if (answered) return;
    setPicked(opt);
    writeJson(QUIZ_KEY, { date: today.key, picked: opt });
    const prev = readJson(STREAK_KEY) || { last: 0, count: 0, best: 0 };
    if (prev.last !== today.day) {
      const count = prev.last === today.day - 1 ? prev.count + 1 : 1;
      const next = { last: today.day, count, best: Math.max(prev.best || 0, count) };
      writeJson(STREAK_KEY, next);
      setStreak(next);
    }
  };

  const used = brief(pick.indications || pick.primary_indications, 110);
  const caution = brief(pick.contraindications);
  const tip = brief(pick.nursing_considerations || pick.nursing_action);
  const liveStreak = streak.last === today.day || streak.last === today.day - 1 ? streak.count : 0;

  return (
    <section className="dotd" aria-label="Drug of the day">
      <div className="dotd-head">
        <span className="dotd-tag">Drug of the Day</span>
        {liveStreak > 0 && (
          <span className="dotd-streak" title={`Best streak: ${streak.best} days`}>
            <Flame size={14} strokeWidth={2.4} /> {liveStreak} day{liveStreak === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <Link to={`/drug/${pick.id}`} className="dotd-main">
        <span className="dotd-icon"><Pill size={26} strokeWidth={2} /></span>
        <span className="dotd-text">
          <span className="dotd-name">{pick.generic_name}</span>
          <span className="dotd-class">{correct}</span>
        </span>
        <ChevronRight size={20} strokeWidth={2.4} />
      </Link>

      <p className="dotd-over">{brief(pick.overview, 190)}</p>

      <ul className="dotd-facts">
        {used && <li><b>Used for:</b> {used}</li>}
        {caution && <li><b>Caution:</b> {caution}</li>}
        {tip && <li><b>Nursing tip:</b> {tip}</li>}
      </ul>

      <div className="dotd-quiz">
        <div className="dotd-q">Quick quiz: which class is <b>{pick.generic_name}</b>?</div>
        <div className="dotd-opts">
          {options.map(opt => {
            const isRight = opt === correct;
            const state = !answered ? '' : isRight ? 'is-right' : opt === picked ? 'is-wrong' : 'is-dim';
            return (
              <button key={opt} type="button" className={`dotd-opt ${state}`} onClick={() => answer(opt)} disabled={answered}>
                <span>{opt}</span>
                {answered && isRight && <CheckCircle2 size={18} />}
                {answered && !isRight && opt === picked && <XCircle size={18} />}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`dotd-result ${picked === correct ? 'ok' : 'no'}`}>
            {picked === correct ? 'Correct! ' : `Not quite, it's ${correct}. `}
            <Link to={`/drug/${pick.id}`}>Read the full page</Link>. New drug tomorrow.
          </div>
        )}
      </div>
    </section>
  );
}
