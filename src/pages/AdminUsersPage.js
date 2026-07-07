import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Search, RefreshCw, ShieldOff, ShieldCheck, Trash2, KeyRound,
  ChevronDown, ChevronRight, ListChecks, History, AlertTriangle,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

// ── API helper — every call attaches the signed-in admin's ID token ───────
async function callUsersApi(method, body) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/api/admin/users', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    });
  } catch { return iso; }
}

// ── Per-user activity: saved drug lists + recent searches ─────────────────
function UserActivityPanel({ uid }) {
  const [state, setState] = useState('loading'); // loading | done | error
  const [lists, setLists] = useState([]);
  const [searches, setSearches] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      try {
        const [listsSnap, searchSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', uid, 'lists'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'search_logs'), where('uid', '==', uid))),
        ]);
        if (cancelled) return;
        setLists(listsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const searchRows = searchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        searchRows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setSearches(searchRows.slice(0, 50));
        setState('done');
      } catch (e) {
        if (!cancelled) { setError(e.message || 'Failed to load activity.'); setState('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  if (state === 'loading') {
    return (
      <div className="p-4 text-sm text-drug-muted flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading activity…
      </div>
    );
  }
  if (state === 'error') {
    return <div className="p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-2 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Saved Lists ({lists.length})
        </h4>
        {lists.length === 0 ? (
          <p className="text-sm text-drug-muted italic">No saved lists.</p>
        ) : (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {lists.map(l => (
              <li key={l.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div className="font-semibold text-drug-text">{l.title || 'Untitled list'}</div>
                <div className="text-xs text-drug-muted">
                  {(l.drugs || []).length} drug(s)
                  {(l.drugs || []).length > 0 && (
                    <> — {l.drugs.slice(0, 3).map(d => d.drugName).filter(Boolean).join(', ')}
                    {l.drugs.length > 3 ? ', …' : ''}</>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-2 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Recent Searches ({searches.length})
        </h4>
        {searches.length === 0 ? (
          <p className="text-sm text-drug-muted italic">No search activity logged yet.</p>
        ) : (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {searches.map(s => (
              <li key={s.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-drug-text truncate">"{s.query}"</span>
                <span className="text-xs text-drug-muted flex-shrink-0">
                  {s.resultCount != null ? `${s.resultCount} results` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '', 'active', 'disabled'
  const [expandedUid, setExpandedUid] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);   // uid currently mid-action
  const [rowMsg,  setRowMsg]  = useState({});     // uid -> { type, text }
  const [confirmDelete, setConfirmDelete] = useState(null); // user object

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callUsersApi('GET');
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message || 'Failed to load users.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter(u => !u.disabled).length,
    disabled: users.filter(u => u.disabled).length,
  }), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      const matchesQ = !q ||
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' && !u.disabled) ||
        (statusFilter === 'disabled' && u.disabled);
      return matchesQ && matchesStatus;
    });
  }, [users, search, statusFilter]);

  function setMsg(uid, type, text) {
    setRowMsg(prev => ({ ...prev, [uid]: { type, text } }));
    setTimeout(() => setRowMsg(prev => {
      const next = { ...prev };
      if (next[uid]?.text === text) delete next[uid];
      return next;
    }), 4500);
  }

  async function handleResetPassword(u) {
    setRowBusy(u.uid);
    try {
      await sendPasswordResetEmail(auth, u.email);
      setMsg(u.uid, 'success', `Reset link sent to ${u.email}`);
    } catch (e) {
      setMsg(u.uid, 'error', e.message || 'Failed to send reset email.');
    }
    setRowBusy(null);
  }

  async function handleToggleDisabled(u) {
    setRowBusy(u.uid);
    try {
      await callUsersApi('POST', { action: u.disabled ? 'enable' : 'disable', uid: u.uid });
      setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, disabled: !u.disabled } : x));
      setMsg(u.uid, 'success', u.disabled ? 'Account re-enabled.' : 'Account disabled.');
    } catch (e) {
      setMsg(u.uid, 'error', e.message || 'Action failed.');
    }
    setRowBusy(null);
  }

  async function handleDelete(u) {
    setRowBusy(u.uid);
    try {
      await callUsersApi('POST', { action: 'delete', uid: u.uid });
      setUsers(prev => prev.filter(x => x.uid !== u.uid));
      setConfirmDelete(null);
    } catch (e) {
      setMsg(u.uid, 'error', e.message || 'Delete failed.');
      setConfirmDelete(null);
    }
    setRowBusy(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-drug-text flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-600" /> Users
          </h1>
          <p className="text-sm text-drug-muted mt-1">Manage accounts, reset passwords, and review activity.</p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-drug-border rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Users', value: stats.total,    bg: 'bg-primary-50', color: 'text-drug-text' },
          { label: 'Active',      value: stats.active,   bg: 'bg-green-50',   color: 'text-green-700' },
          { label: 'Disabled',    value: stats.disabled,  bg: 'bg-red-50',     color: 'text-red-700'   },
        ].map(s => (
          <div key={s.label} className={`border border-drug-border rounded-xl p-4 ${s.bg}`}>
            <p className="text-xs text-drug-muted">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Server-not-configured error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold mb-1">Couldn't load users</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-drug-border rounded-lg text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-drug-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 w-8"></th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Last Sign-in</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-10 text-drug-muted">
                <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" /> Loading users…
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-drug-muted">No users found.</td></tr>
            )}
            {!loading && filtered.map(u => {
              const isOpen = expandedUid === u.uid;
              const busy = rowBusy === u.uid;
              const msg = rowMsg[u.uid];
              return (
                <React.Fragment key={u.uid}>
                  <tr className="border-t border-drug-border hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedUid(isOpen ? null : u.uid)}
                        className="text-drug-muted hover:text-drug-text"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-drug-text">{u.displayName || '(no name)'}</div>
                      <div className="text-xs text-drug-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.disabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-bold">
                          <ShieldOff className="w-3 h-3" /> Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-bold">
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-drug-muted text-xs">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-drug-muted text-xs">{fmtDate(u.lastSignInAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleResetPassword(u)}
                          disabled={busy}
                          title="Send password reset email"
                          className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleDisabled(u)}
                          disabled={busy}
                          title={u.disabled ? 'Re-enable account' : 'Disable account'}
                          className={`p-1.5 rounded-lg disabled:opacity-50 ${
                            u.disabled ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'
                          }`}
                        >
                          {u.disabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          disabled={busy}
                          title="Delete account"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {msg && (
                        <div className={`text-xs mt-1 text-right ${msg.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
                          {msg.text}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-drug-border bg-gray-50/40">
                      <td colSpan={6}><UserActivityPanel uid={u.uid} /></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-drug-text mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete this account?
            </h3>
            <p className="text-sm text-drug-muted mb-5">
              This permanently deletes <strong>{confirmDelete.email}</strong>'s login. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-drug-muted hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
