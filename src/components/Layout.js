import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Pill, Search, Menu, X, Home, Grid3X3, Download, RefreshCw } from 'lucide-react';

export default function Layout({ children }) {
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false);
  const [searchQuery,     setSearchQuery]      = useState('');
  const [installPrompt,   setInstallPrompt]    = useState(null);   // beforeinstallprompt event
  const [showInstall,     setShowInstall]      = useState(false);
  const [showUpdate,      setShowUpdate]       = useState(false);
  const [isInstalled,     setIsInstalled]      = useState(false);

  const location = useLocation();
  const navigate  = useNavigate();

  // ── PWA install prompt ────────────────────────────────────────────────────
  useEffect(() => {
    // Detect if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // SW update available
    const onUpdate = () => setShowUpdate(true);
    window.addEventListener('swUpdateAvailable', onUpdate);

    // Hide install banner once installed
    window.addEventListener('appinstalled', () => {
      setShowInstall(false);
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('swUpdateAvailable', onUpdate);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  };

  const handleUpdate = () => {
    setShowUpdate(false);
    window.location.reload();
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navLinks = [
    { to: '/',       label: 'Home',   icon: Home     },
    { to: '/browse', label: 'Browse', icon: Grid3X3  },
  ];
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── SW Update Toast ──────────────────────────────────────────────── */}
      {showUpdate && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
          <div className="bg-primary-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 flex-shrink-0 text-primary-300" />
            <div className="flex-1 text-sm">
              <div className="font-bold">Update available</div>
              <div className="text-primary-300 text-xs">A new version of MedLookup is ready.</div>
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
            Install MedLookup for <strong className="text-white">offline access</strong> to all 280 drugs
          </span>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-primary-900 rounded-lg text-xs font-bold hover:bg-primary-100 transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
          <button onClick={() => setShowInstall(false)} className="text-primary-400 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-r from-primary-900 to-primary-700 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <Pill className="w-7 h-7" />
              <span className="text-xl font-bold tracking-tight">MedLookup</span>
            </Link>

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
            </nav>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-primary-800">
            <div className="px-4 py-3 space-y-2">
              <form onSubmit={handleSearch} className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg
                             text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </form>
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive(link.to) ? 'bg-white/20 text-white' : 'text-white/80'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              {showInstall && !isInstalled && (
                <button
                  onClick={() => { handleInstall(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold
                             bg-white text-primary-900"
                >
                  <Download className="w-4 h-4" />
                  Install MedLookup App
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-drug-border py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-drug-muted">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Pill className="w-4 h-4" />
            <span className="font-semibold text-drug-text">MedLookup</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Offline Ready</span>
          </div>
          <p>Comprehensive Nigerian clinical drug reference · 280 medications</p>
          <p className="mt-1 text-xs">For educational and reference purposes only. Not a substitute for professional medical advice.</p>
        </div>
      </footer>
    </div>
  );
}
