// Auto-save helper: call arm() when the admin pastes (clipboard button, paste
// into the box, or file upload). After the pasted text has been parsed on the
// next render, the component's save() runs by itself. Typing never auto-saves.
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAutoSaveOnPaste(ready) {
  const armed = useRef(false);
  const saveRef = useRef(null);
  const [tick, setTick] = useState(0);
  const arm = useCallback(() => { armed.current = true; setTick(t => t + 1); }, []);
  useEffect(() => {
    if (!armed.current) return;
    armed.current = false;
    if (ready) saveRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return { arm, saveRef };
}
