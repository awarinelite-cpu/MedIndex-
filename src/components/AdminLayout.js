import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Pill, Shield, Upload, LayoutDashboard, Download, X, RefreshCw, LogOut, Users, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout({ children }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  const [isInstalled,   setIsInstalled]   = useState(false);
  const [showUpdate,    setShowUpdate]    = useState(false);

  const { user, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  // ── Swap manifest to admin-specific one when on /admin ───────────────────
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) {
      link.setAttribute('href', '/admin-manifest.json');
    }
    // Restore public manifest when leaving admin
    return () => {
      const l = document.querySelector('link[rel="manifest"]');
      if (l) l.setAttribute('href', '/manifest.json');
    };
  }, []);

  // ── PWA install prompt ────────────────────────────────────────────────────
  useEffect(() => {
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
    window.addEventListener('swUpdateAvailable', () => setShowUpdate(true));
    window.addEventListener('appinstalled', () => { setShowInstall(false); setIsInstalled(true); });
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/admin',        label: 'Dashboard',   icon: LayoutDashboard },
    { to: '/admin/upload', label: 'Bulk Upload', icon: Upload          },
    { to: '/admin/bulk-images', label: 'Bulk Images', icon: ImageIcon  },
    { to: '/admin/users',  label: 'Users',       icon: Users           },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F4F8', fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* ── SW Update Toast ──────────────────────────────────────────────── */}
      {showUpdate && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 flex-shrink-0 text-blue-300" />
            <div className="flex-1 text-sm">
              <div className="font-bold">Update available</div>
              <div className="text-gray-300 text-xs">Reload to get the latest admin panel.</div>
            </div>
            <button onClick={() => window.location.reload()} className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-bold flex-shrink-0">
              Reload
            </button>
            <button onClick={() => setShowUpdate(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Install Banner ───────────────────────────────────────────────── */}
      {showInstall && !isInstalled && (
        <div style={{ background: '#0B1F3A' }} className="text-white px-4 py-2.5 flex items-center gap-3 text-sm">
          <Shield className="w-4 h-4 flex-shrink-0 text-blue-300" />
          <span className="flex-1 text-blue-100">
            Install <strong className="text-white">MedIndex Admin</strong> as a separate app for quick access
          </span>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-bold flex-shrink-0"
            style={{ color: '#0B1F3A' }}
          >
            <Download className="w-3.5 h-3.5" />
            Install Admin App
          </button>
          <button onClick={() => setShowInstall(false)} className="text-blue-400 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Admin Header ─────────────────────────────────────────────────── */}
      <header style={{ background: '#0B1F3A' }} className="text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div style={{ background: 'linear-gradient(135deg,#00C9A7,#0070F3)', borderRadius: 8 }} className="w-8 h-8 flex items-center justify-center">
                <Pill className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold">MedIndex</span>
              <span style={{ background: 'rgba(0,201,167,0.2)', color: '#00C9A7', fontSize: 10, padding: '2px 8px', borderRadius: 20 }} className="font-bold">
                Admin
              </span>
            </div>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              ))}

              {/* Back to public site */}
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-2"
              >
                ← Public Site
              </Link>

              {/* Logout */}
              {user && (
                <button
                  onClick={handleLogout}
                  title={`Sign out (${user.email})`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-red-500/20 transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Admin Footer ─────────────────────────────────────────────────── */}
      <footer style={{ background: '#0B1F3A', borderTop: '1px solid rgba(255,255,255,0.08)' }} className="py-4">
        <div className="max-w-7xl mx-auto px-4 text-center" style={{ fontSize: 12, color: '#475569' }}>
          MedIndex Admin Panel · Restricted Access
        </div>
      </footer>
    </div>
  );
}
