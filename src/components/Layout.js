import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Pill, Search, X, Home, Grid3X3, Download, RefreshCw, FlaskConical, Calculator, LogOut, User, Sun, Moon, Bell, Bookmark, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDrugs } from '../hooks/useDrugs';
import { usePrefetchDrugImages } from '../hooks/usePrefetchDrugImages';
import { usePwaInstall } from '../hooks/usePwaInstall';
import AiProviderDropdown from './AiProviderDropdown';
export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { drugs } = useDrugs();
  usePrefetchDrugImages(user ? drugs : null);
  const { showInstall, isInstalled, handleInstall, dismissInstall } = usePwaInstall();
  const [searchQuery,     setSearchQuery]      = useState('');
  const [showUpdate,      setShowUpdate]       = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const location = useLocation();
  const navigate  = useNavigate();

  // Close the notifications popover on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ── SW update prompt ────────────────────────────────────────────────────
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    // SW update available — store the waiting worker so we can tell it to activate
    const onUpdate = (e) => {
      setWaitingWorker(e.detail?.worker || null);
      setShowUpdate(true);
    };
    window.addEventListener('swUpdateAvailable', onUpdate);

    return () => {
      window.removeEventListener('swUpdateAvailable', onUpdate);
    };
  }, []);

  const handleUpdate = () => {
    setShowUpdate(false);
    // Tell the waiting SW to skip waiting and become active —
    // index.js listens for the SW_UPDATED message it sends and reloads.
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navLinks = [
    { to: '/',            label: 'Home',        icon: Home         },
    { to: '/browse',      label: 'Browse',      icon: Grid3X3      },
    { to: '/labs',        label: 'Lab Ref',     icon: FlaskConical },
    { to: '/calculators', label: 'Calculators', icon: Calculator   },
  ];
  const isActive = (path) => location.pathname === path;

  // ── Bottom tab bar (mobile) ─────────────────────────────────────────────
  const bottomTabs = [
    { to: '/',        label: 'Home',      icon: Home     },
    { to: '/browse',  label: 'Browse',    icon: Grid3X3  },
    { to: '/browse',  label: 'Search',    icon: Search   },
    { to: '/lists',   label: 'Favorites', icon: Bookmark },
  ];

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── SW Update Toast ──────────────────────────────────────────────── */}
      {showUpdate && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
          <div className="bg-primary-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 flex-shrink-0 text-primary-300" />
            <div className="flex-1 text-sm">
              <div className="font-bold">Update available</div>
              <div className="text-primary-300 text-xs">A new version of MedIndex is ready.</div>
            </div>
            <button
              onClick={handleUpdate}
              className="px-3 py-1.5 bg-white text-primary-900 rounded-lg text-xs font-bold hover:bg-primary-100 transition-colors flex-shrink-0"
            >
              Reload
            </button>
            <button onClick={() => setShowUpdate(false)} className="text-primary-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Install Banner ───────────────────────────────────────────────── */}
      {showInstall && !isInstalled && (
        <div className="bg-primary-800 text-white px-4 py-2.5 flex items-center gap-3 text-sm">
          <Pill className="w-4 h-4 flex-shrink-0 text-primary-300" />
          <span className="flex-1 text-primary-100">
            Install MedIndex for <strong className="text-white">offline access</strong> to drugs &amp; lab reference
          </span>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-primary-900 rounded-lg text-xs font-bold hover:bg-primary-100 transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
          <button onClick={dismissInstall} className="text-primary-400 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-r from-primary-900 to-primary-700 text-white sticky top-0 z-40 shadow-lg">
        {/* Brand row — app identity + notifications, mirrors the native app bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 border-b border-white/10 md:border-0">
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
              <span className="p-1.5 bg-white/10 rounded-lg flex-shrink-0">
                <Pill className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg sm:text-xl font-bold tracking-tight leading-tight truncate">MedIndex</span>
                <span className="hidden sm:block text-[11px] font-medium text-primary-200 leading-tight">
                  Your Medication Database
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  aria-label="Notifications"
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-64 bg-white text-drug-text rounded-xl shadow-2xl border border-drug-border overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-drug-border">
                      <p className="text-sm font-bold">Notifications</p>
                    </div>
                    <div className="px-4 py-6 text-center text-sm text-drug-muted">
                      No new notifications
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Search — desktop */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search medications, conditions, classes..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg
                             text-white placeholder-white/50 focus:outline-none focus:ring-2
                             focus:ring-white/30 focus:bg-white/15 transition-all"
                />
              </div>
            </form>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              {/* Return to Admin Portal — only shown to logged-in admins browsing the public site */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ml-1"
                  style={{ background: 'rgba(0,201,167,0.2)', color: '#00C9A7' }}
                >
                  ← Admin Portal
                </Link>
              )}
              {/* Install button in nav (desktop, only when prompt available) */}
              {showInstall && !isInstalled && (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                             bg-white/15 hover:bg-white/25 text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Install
                </button>
              )}
              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-white/80
                           hover:text-white hover:bg-white/15 transition-colors flex-shrink-0"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {/* AI Provider selector */}
              {user && <AiProviderDropdown />}

              {/* User avatar + sign out */}
              {user && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                  <div className="flex items-center gap-1.5 text-white/80 text-sm">
                    <User className="w-4 h-4" />
                    <span className="hidden lg:inline max-w-[120px] truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-white/70
                               hover:text-white hover:bg-white/10 transition-colors text-sm"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>

        {/* Mobile menu — see /more page (MorePage.js) for the full menu,
            opened via the bottom "More" tab instead of a dropdown here. */}
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="hidden md:block bg-white border-t border-drug-border py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-drug-muted">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Pill className="w-4 h-4" />
            <span className="font-semibold text-drug-text">MedIndex</span>
          </div>
          <p className="mt-1 text-xs">For educational and reference purposes only. Not a substitute for professional medical advice.</p>
          <p className="mt-1 text-xs font-semibold text-drug-text">Made by: The Elite Nurses</p>
        </div>
      </footer>

      {/* ── Bottom tab bar (mobile) ─────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-drug-border
                       flex items-stretch pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        {bottomTabs.map(tab => (
          <Link
            key={tab.label}
            to={tab.to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive(tab.to) ? 'text-primary-700' : 'text-drug-muted'
            }`}
          >
            <tab.icon className="w-5 h-5" strokeWidth={isActive(tab.to) ? 2.5 : 2} />
            {tab.label}
          </Link>
        ))}
        <Link
          to="/more"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
            isActive('/more') ? 'text-primary-700' : 'text-drug-muted'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" strokeWidth={isActive('/more') ? 2.5 : 2} />
          More
        </Link>
      </nav>
    </div>
  );
}
