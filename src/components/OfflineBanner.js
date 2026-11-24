// src/components/OfflineBanner.js
// Slim status pill: amber while offline, green for a few seconds once the
// connection returns. Tells staff the data on screen is the saved copy and
// that the Emergency guides keep working (they ship inside the app).
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [showBack, setShowBack] = useState(false);
  const wasOffline = useRef(!online);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBack(false);
      return undefined;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowBack(true);
      const t = setTimeout(() => setShowBack(false), 3500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [online]);

  if (online && !showBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mi-offline-pill ${online ? 'is-online' : 'is-offline'}`}
    >
      {online ? <Wifi size={15} strokeWidth={2.4} /> : <WifiOff size={15} strokeWidth={2.4} />}
      {online ? (
        <span>Back online — syncing</span>
      ) : (
        <span>
          Offline — showing saved data.{' '}
          <Link to="/emergency" className="underline font-bold">Emergency guides</Link> still work.
        </span>
      )}
    </div>
  );
}
