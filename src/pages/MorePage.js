// src/pages/MorePage.js
// Route: /more
// Full page version of what used to be a dropdown panel that opened at the
// top of the screen when tapping "More" in the bottom tab bar. Same content
// (search, nav links, admin portal, dark mode, AI provider, account), just
// as its own page instead of an overlay.

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, Home, Grid3X3, FlaskConical, Calculator, Download,
  LogOut, User, Sun, Moon, ChevronRight, Sparkles, Coins, Fingerprint, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import IosInstallModal from '../components/IosInstallModal';
import AiProviderDropdown from '../components/AiProviderDropdown';
import { isBiometricAvailable, isBiometricEnrolled, enrollBiometric, disableBiometric } from '../utils/biometricAuth';
import { generateLinkCode, listenTelegramLink, unlinkTelegram } from '../lib/telegramLink';
import { Send } from 'lucide-react';

const NAV_LINKS = [
  { to: '/',            label: 'Home',              icon: Home         },
  { to: '/browse',      label: 'Browse',            icon: Grid3X3      },
  { to: '/procedures',  label: 'Procedures',        icon: ClipboardList },
  { to: '/ai-consult',  label: 'AI Clinical Consult', icon: Sparkles   },
  { to: '/ai-credits',  label: 'AI Credits',        icon: Coins        },
  { to: '/labs',        label: 'Lab Ref',           icon: FlaskConical },
  { to: '/calculators', label: 'Calculators',       icon: Calculator   },
];

export default function MorePage() {
  const { user, isAdmin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const {
    showInstall, isInstalled, platform, handleInstall,
    showIosInstructions, closeIosInstructions,
  } = usePwaInstall();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const [tgLink, setTgLink] = useState(null);      // telegram_links/{uid} doc, or null if not linked
  const [tgCode, setTgCode] = useState(null);       // freshly generated code, shown until they link
  const [tgLoading, setTgLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listenTelegramLink(user.uid, (link) => {
      setTgLink(link);
      if (link) setTgCode(null); // clear the shown code once linking succeeds
    });
    return unsub;
  }, [user]);

  const handleGenerateTgCode = async () => {
    if (!user) return;
    setTgLoading(true);
    try {
      const code = await generateLinkCode(user.uid, user.email, user.displayName);
      setTgCode(code);
    } catch (err) {
      console.error('[MorePage] generateLinkCode failed:', err);
    } finally {
      setTgLoading(false);
    }
  };

  const handleUnlinkTg = async () => {
    if (!user) return;
    await unlinkTelegram(user.uid);
  };

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text);
  };
  const [bioError, setBioError] = useState('');

  useEffect(() => { isBiometricAvailable().then(setBioSupported); }, []);
  useEffect(() => { if (user) setBioEnrolled(isBiometricEnrolled(user.email)); }, [user]);

  const toggleBiometric = async () => {
    setBioError('');
    if (bioEnrolled) {
      disableBiometric(user.email);
      setBioEnrolled(false);
      return;
    }
    setBioBusy(true);
    try {
      await enrollBiometric({ email: user.email, displayName: user.displayName });
      setBioEnrolled(true);
    } catch (e) {
      setBioError(
        e.name === 'NotAllowedError'
          ? 'Fingerprint setup was cancelled.'
          : (e.message || 'Could not set up fingerprint unlock on this device.')
      );
    }
    setBioBusy(false);
  };


  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-drug-text mb-4">More</h1>

      <form onSubmit={handleSearch} className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-drug-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full pl-10 pr-4 py-2.5 bg-drug-bg border border-drug-border rounded-xl
                     text-drug-text placeholder-drug-muted focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </form>

      <div className="rounded-xl border border-drug-border overflow-hidden bg-white mb-6">
        {NAV_LINKS.map((link, i) => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex items-center justify-between gap-2 px-4 py-3.5 text-sm font-medium text-drug-text
                       hover:bg-gray-50 transition-colors ${i !== NAV_LINKS.length - 1 ? 'border-b border-drug-border' : ''}`}
          >
            <span className="flex items-center gap-3">
              <link.icon className="w-4 h-4 text-primary-600" />
              {link.label}
            </span>
            <ChevronRight className="w-4 h-4 text-drug-muted" />
          </Link>
        ))}
      </div>

      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold mb-4"
          style={{ background: 'rgba(0,201,167,0.12)', color: '#00997F' }}
        >
          ← Admin Portal
        </Link>
      )}

      <button
        onClick={toggleTheme}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold mb-4
                   bg-drug-bg border border-drug-border text-drug-text hover:bg-gray-100 transition-colors"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>

      {showInstall && !isInstalled && (
        <button
          onClick={handleInstall}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold mb-4
                     bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {platform === 'ios' ? 'How to install MedIndex App' : 'Install MedIndex App'}
        </button>
      )}
      <IosInstallModal open={showIosInstructions} onClose={closeIosInstructions} />

      {user && (
        <div className="border-t border-drug-border pt-4 mt-2">
          <p className="text-xs text-drug-muted uppercase tracking-widest font-bold mb-2">AI Provider</p>
          <div className="mb-5">
            <AiProviderDropdown placement="left" />
          </div>

          {bioSupported && (
            <>
              <div className="flex items-center justify-between px-1 py-2">
                <div className="flex items-center gap-2 text-drug-text text-sm">
                  <Fingerprint className="w-4 h-4 flex-shrink-0" />
                  Fingerprint Unlock
                </div>
                <button
                  onClick={toggleBiometric}
                  disabled={bioBusy}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${bioEnrolled ? 'bg-primary-600' : 'bg-drug-border'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${bioEnrolled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {bioError && <p className="text-xs text-red-600 px-1 mb-1">{bioError}</p>}
              {bioEnrolled && !bioError && (
                <p className="text-xs text-drug-muted px-1 mb-1">MedIndex will ask for your fingerprint each time you open the app on this device.</p>
              )}
            </>
          )}

          <p className="text-xs text-drug-muted uppercase tracking-widest font-bold mb-2 mt-5">Telegram Bot</p>
          <div className="mb-5 px-1">
            {tgLink ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-drug-text text-sm min-w-0">
                  <Send className="w-4 h-4 flex-shrink-0 text-primary-600" />
                  <span className="truncate">Linked{tgLink.telegramUsername ? ` as @${tgLink.telegramUsername}` : ''}</span>
                </div>
                <button
                  onClick={handleUnlinkTg}
                  className="px-3 py-1.5 bg-drug-bg border border-drug-border rounded-lg text-drug-text text-sm font-medium hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                  Unlink
                </button>
              </div>
            ) : tgCode ? (
              <div className="text-sm text-drug-text">
                <p className="mb-2">Message the bot with:</p>
                <div className="flex items-center gap-2">
                  <code style={{ fontSize: 16, fontWeight: 700 }}>/link {tgCode}</code>
                  <button className="btn btn-sm" onClick={() => copy(`/link ${tgCode}`, 'Command')}>
                    Copy
                  </button>
                </div>
                <p className="text-xs text-drug-muted mt-2">Code expires in 15 minutes.</p>
              </div>
            ) : (
              <button
                onClick={handleGenerateTgCode}
                disabled={tgLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold
                           bg-drug-bg border border-drug-border text-drug-text hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {tgLoading ? 'Generating…' : 'Generate link code'}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-1 py-2">
            <div className="flex items-center gap-2 text-drug-text text-sm min-w-0">
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{user.displayName || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-drug-bg border border-drug-border rounded-lg
                         text-drug-text text-sm font-medium hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
