// src/components/EmergencyTimer.js
// Bedside stopwatch with a repeating reminder (e.g. "2 min CPR cycle",
// "every 5 min adrenaline"). Uses wall-clock time so it stays accurate if
// the screen locks briefly. Vibrates and flashes when an interval is due.
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Bell } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');
function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export default function EmergencyTimer({ label, minutes }) {
  const intervalMs = Math.round(minutes * 60 * 1000);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [flash, setFlash] = useState(false);
  const startedAt = useRef(0);   // wall-clock start of the current run
  const baseElapsed = useRef(0); // elapsed accumulated before the current run
  const lastCycle = useRef(0);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const total = baseElapsed.current + (Date.now() - startedAt.current);
      setElapsed(total);
      const due = Math.floor(total / intervalMs);
      if (due > lastCycle.current) {
        lastCycle.current = due;
        setCycles(due);
        setFlash(true);
        try { navigator.vibrate?.([300, 120, 300]); } catch { /* unsupported */ }
        setTimeout(() => setFlash(false), 4000);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, intervalMs]);

  const toggle = () => {
    if (running) {
      baseElapsed.current += Date.now() - startedAt.current;
      setRunning(false);
    } else {
      startedAt.current = Date.now();
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setCycles(0);
    setFlash(false);
    baseElapsed.current = 0;
    lastCycle.current = 0;
  };

  const intoCycle = elapsed % intervalMs;
  const remaining = intervalMs - intoCycle;
  const intervalText = minutes < 1 ? `${Math.round(minutes * 60)} sec` : minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`;

  return (
    <div className={`em-timer ${flash ? 'is-due' : ''}`}>
      <div className="em-timer-label"><Bell size={15} /> {label} <span className="opacity-70">· every {intervalText}</span></div>
      <div className="em-timer-row">
        <div>
          <div className="em-timer-big">{fmt(elapsed)}</div>
          <div className="em-timer-sub">
            {flash ? 'DUE NOW' : running ? `Next in ${fmt(remaining)}` : elapsed ? 'Paused' : 'Tap start'}
            {cycles > 0 && ` · ${cycles} done`}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="em-timer-btn" onClick={toggle} aria-label={running ? 'Pause timer' : 'Start timer'}>
            {running ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button type="button" className="em-timer-btn is-ghost" onClick={reset} aria-label="Reset timer">
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
