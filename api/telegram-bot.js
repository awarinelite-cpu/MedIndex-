// api/telegram-bot.js — MedIndex Telegram bot webhook.
// NODE.JS SERVERLESS FUNCTION (classic req/res), same pattern as
// api/drug-ai-claude.js — not Edge (see that file's header comment for why).
//
// Set as the Telegram webhook URL (https://<your-domain>/api/telegram-bot),
// and register it with:
//   curl -F "url=https://<your-domain>/api/telegram-bot" \
//        -F "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
//        https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
//
// Required env vars (Vercel project settings):
//   TELEGRAM_BOT_TOKEN      — from @BotFather
//   TELEGRAM_WEBHOOK_SECRET — any random string; must match setWebhook above
//   ANTHROPIC_API_KEY       — already used by api/drug-ai-claude.js
//   FIREBASE_SERVICE_ACCOUNT_BASE64 (or _KEY) — already used by api/_lib
//
// Every command resolves the sender's MedIndex `uid` from
// telegram_links/{uid} (see src/lib/telegramLink.js for how it's created)
// and re-checks admins/{email} live on every admin command — the bot never
// trusts a cached role, same as the web app's own ProtectedAdminRoute.

import { adminDb } from './_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { consumeCredits, ensureWallet, CLINICAL_PLAN_COST } from './_lib/credits.js';

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`${TELEGRAM_API(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

const sendMessage = (chatId, text, extra = {}) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// AI-generated clinical info text uses markdown-style **bold** (same source
// renderAiText.js renders as bold on the web) — Telegram doesn't understand
// markdown asterisks, it needs real HTML tags. Escape first (so any stray
// < > & in the source stay safe), then convert **text** -> <b>text</b> on
// the now-escaped string, since escaping never touches asterisks.
function escapeHtmlWithBold(s = '') {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// ── Link resolution ──────────────────────────────────────────────
async function getLinkedUser(chatId) {
  const snap = await adminDb().collection('telegram_links').where('chatId', '==', chatId).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...doc.data() };
}

async function isAdminUid(uid, email) {
  if (!email) return false;
  const snap = await adminDb().collection('admins').doc(email).get();
  return snap.exists && snap.data()?.role === 'admin';
}

async function requireLink(chatId) {
  const link = await getLinkedUser(chatId);
  if (!link) {
    await sendMessage(chatId,
      'Not linked yet. Open MedIndex → More → Telegram Bot, generate a code, then send:\n<code>/link 123456</code>');
    return null;
  }
  return link;
}

// ── Commands ──────────────────────────────────────────────────────

async function handleStart(chatId) {
  const link = await getLinkedUser(chatId);
  if (link) {
    await sendMessage(chatId, `👋 Welcome back! You're linked as ${escapeHtml(link.email || link.displayName || link.uid)}.\nSend /help to see what I can do.`);
  } else {
    await sendMessage(chatId,
      "👋 Welcome to the MedIndex bot.\n\nTo connect your account: open MedIndex → More → Telegram Bot, tap \"Generate link code\", then send it here as:\n<code>/link 123456</code>");
  }
}

async function handleLink(chatId, from, code) {
  if (!code) { await sendMessage(chatId, 'Usage: <code>/link 123456</code> — generate a code from More → Telegram Bot in the app.'); return; }
  const codeRef = adminDb().collection('link_codes').doc(code.trim());
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) { await sendMessage(chatId, '❌ That code is invalid or has already been used. Generate a new one in the app.'); return; }
  const data = codeSnap.data();
  if (data.used) { await sendMessage(chatId, '❌ That code was already used. Generate a new one in the app.'); return; }

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0);
  if (Date.now() - createdAt.getTime() > 15 * 60 * 1000) {
    await sendMessage(chatId, '❌ That code expired (15 min limit). Generate a new one in the app.');
    return;
  }

  await adminDb().collection('telegram_links').doc(data.uid).set({
    chatId,
    telegramUserId: from.id,
    telegramUsername: from.username || null,
    email: data.email || null,
    displayName: data.displayName || null,
    linkedAt: FieldValue.serverTimestamp(),
  });
  await codeRef.set({ used: true, usedAt: FieldValue.serverTimestamp() }, { merge: true });

  await sendMessage(chatId, `✅ Linked as ${escapeHtml(data.email || data.displayName || data.uid)}. Send /help to see what I can do.`);
}

async function handleUnlink(chatId) {
  const link = await getLinkedUser(chatId);
  if (!link) { await sendMessage(chatId, "You're not linked."); return; }
  await adminDb().collection('telegram_links').doc(link.uid).delete();
  await sendMessage(chatId, '🔌 Unlinked. Send /link with a new code to reconnect.');
}

async function handleStatus(chatId) {
  const link = await requireLink(chatId);
  if (!link) return;
  const admin = await isAdminUid(link.uid, link.email);
  const wallet = await ensureWallet(link.uid);
  await sendMessage(chatId,
    `Linked as: ${escapeHtml(link.email || link.uid)}\nRole: ${admin ? 'Admin' : 'User'}\nAI credits: ${wallet.balance}`);
}

async function handleCredits(chatId) {
  const link = await requireLink(chatId);
  if (!link) return;
  const wallet = await ensureWallet(link.uid);
  await sendMessage(chatId, `💳 You have <b>${wallet.balance}</b> AI credits.\nBuy more from the app: More → AI Credits.`);
}

function fmtDrugSummary(d) {
  const lines = [
    `<b>${escapeHtml(d.generic_name)}</b>${d.brand_names ? ' (' + escapeHtml(d.brand_names) + ')' : ''}`,
    d.drug_class ? `Class: ${escapeHtml(d.drug_class)}` : null,
    d.prescription_status ? `Status: ${escapeHtml(d.prescription_status)}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

async function searchDrugs(term) {
  const needle = term.trim().toLowerCase();
  // Firestore has no native substring search; the drug set is small enough
  // for a reference app that a bounded full scan + in-memory filter is
  // fine here (same ceiling reasoning as src/hooks/useDrugs.js — no
  // artificial page limit that would silently hide matches).
  const snap = await adminDb().collection('drugs').limit(3000).get();
  const results = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const hay = `${d.generic_name || ''} ${d.brand_names || ''} ${d.drug_class || ''} ${d.indications || ''}`.toLowerCase();
    if (hay.includes(needle)) results.push({ id: doc.id, ...d });
    if (results.length >= 30) break;
  }
  return results;
}

async function handleSearch(chatId, term) {
  if (!term) { await sendMessage(chatId, 'Usage: <code>/search amoxicillin</code>'); return; }
  const results = await searchDrugs(term);
  if (!results.length) { await sendMessage(chatId, `No drugs matched "${escapeHtml(term)}".`); return; }
  const top = results.slice(0, 8);
  const text = top.map((d, i) => `${i + 1}. ${escapeHtml(d.generic_name)}${d.drug_class ? ' — ' + escapeHtml(d.drug_class) : ''}`).join('\n');
  await sendMessage(chatId,
    `Found ${results.length} match${results.length === 1 ? '' : 'es'}${results.length > top.length ? ` (showing ${top.length})` : ''}:\n${text}\n\nUse <code>/drug &lt;exact or partial name&gt;</code> for full details.`);
}

async function handleDrug(chatId, term) {
  if (!term) { await sendMessage(chatId, 'Usage: <code>/drug amoxicillin</code>'); return; }
  const results = await searchDrugs(term);
  if (!results.length) { await sendMessage(chatId, `No drug matched "${escapeHtml(term)}".`); return; }
  const d = results[0];
  const sections = [
    fmtDrugSummary(d),
    d.indications ? `\n<b>Indications:</b>\n${escapeHtml(d.indications)}` : null,
    d.adult_dose ? `\n<b>Adult dose:</b>\n${escapeHtml(d.adult_dose)}` : null,
    d.child_dose ? `\n<b>Child dose:</b>\n${escapeHtml(d.child_dose)}` : null,
    d.contraindications ? `\n<b>Contraindications:</b>\n${escapeHtml(d.contraindications)}` : null,
    d.adverse_effect ? `\n<b>Adverse effects:</b>\n${escapeHtml(d.adverse_effect)}` : null,
    d.interaction ? `\n<b>Interactions:</b>\n${escapeHtml(d.interaction)}` : null,
    d.pregnancy_lactation ? `\n<b>Pregnancy/Lactation:</b>\n${escapeHtml(d.pregnancy_lactation)}` : null,
  ].filter(Boolean);
  let text = sections.join('\n');
  if (text.length > 3800) text = text.slice(0, 3800) + '\n… (truncated — see full entry in the app)';
  await sendMessage(chatId, text);
  if (results.length > 1) {
    await sendMessage(chatId, `(${results.length - 1} other match${results.length - 1 === 1 ? '' : 'es'} — be more specific to see a different one)`);
  }
}

async function handleLabs(chatId, term) {
  if (!term) { await sendMessage(chatId, 'Usage: <code>/labs sodium</code>'); return; }
  let LABS;
  try {
    ({ LABS } = await import('../src/data/labsData.js'));
  } catch {
    await sendMessage(chatId, 'Lab reference data is unavailable right now.');
    return;
  }
  // Flatten parent tests + their nested `children` (e.g. CBC → Hemoglobin,
  // Hematocrit, MCV…) into one searchable list, same structure LabReferencePage renders.
  const all = [];
  for (const test of LABS) {
    all.push(test);
    if (Array.isArray(test.children)) all.push(...test.children);
  }
  const needle = term.trim().toLowerCase();
  const matches = all
    .filter(l => (l.name || '').toLowerCase().includes(needle) || (l.abbr || '').toLowerCase().includes(needle))
    // Rank so the plain systemic/serum test (e.g. "Blood Glucose") outranks
    // compartment-specific variants ("Urine Glucose", "CSF Glucose") and
    // derived/related tests ("OGTT", "G6PD") when someone just searches "glucose".
    .sort((a, b) => {
      const score = (l) => {
        const n = (l.name || '').toLowerCase();
        if (n === needle) return 0;
        if (n.startsWith('blood ' + needle) || n.startsWith('serum ' + needle) || n.startsWith('plasma ' + needle)) return 1;
        if (n.startsWith(needle)) return 2;
        if (n.includes(' ' + needle) || n.includes('(' + needle)) return 3;
        return 4;
      };
      const as = score(a), bs = score(b);
      if (as !== bs) return as - bs;
      return (a.name || '').length - (b.name || '').length;
    });
  if (!matches.length) { await sendMessage(chatId, `No lab test matched "${escapeHtml(term)}".`); return; }
  const match = matches[0];
  const listify = (v) => Array.isArray(v) ? v.map(x => `• ${x}`).join('\n') : v;
  const sections = [
    `<b>${escapeHtml(match.name)}</b>${match.abbr ? ' (' + escapeHtml(match.abbr) + ')' : ''}`,
    match.normal ? `Normal range: ${escapeHtml(match.normal)}` : null,
    match.highCauses ? `\n<b>⬆️ Causes of high:</b>\n${escapeHtml(listify(match.highCauses))}` : null,
    match.solutionHigh ? `\n<b>🩺 Management (high):</b>\n${escapeHtml(listify(match.solutionHigh))}` : null,
    match.lowCauses ? `\n<b>⬇️ Causes of low:</b>\n${escapeHtml(listify(match.lowCauses))}` : null,
    match.solutionLow ? `\n<b>🩺 Management (low):</b>\n${escapeHtml(listify(match.solutionLow))}` : null,
  ].filter(Boolean);
  let text = sections.join('\n');
  if (text.length > 3800) text = text.slice(0, 3800) + '\n… (truncated — see full entry in the app)';
  await sendMessage(chatId, text);
  if (matches.length > 1) {
    const others = matches.slice(1, 6).map(m => m.name).join(', ');
    await sendMessage(chatId, `(Other matches: ${escapeHtml(others)}${matches.length > 6 ? '…' : ''} — send <code>/labs</code> with a more specific term to see one of these instead)`);
  }
}

async function handleCondition(chatId, term) {
  if (!term) { await sendMessage(chatId, 'Usage: <code>/condition peptic ulcer</code>'); return; }
  let SYSTEM_CONDITIONS;
  try {
    ({ SYSTEM_CONDITIONS } = await import('../src/data/systemConditions.js'));
  } catch {
    await sendMessage(chatId, 'Condition data is unavailable right now.');
    return;
  }
  const needle = term.trim().toLowerCase();
  // Find matching condition(s) by label across every system — same
  // condition can only live in one system, but we don't know which one
  // the sender means, so scan all of them (same approach as handleLabs'
  // flattened search over LABS).
  const matches = [];
  for (const [systemId, conditions] of Object.entries(SYSTEM_CONDITIONS)) {
    for (const cond of conditions) {
      if ((cond.label || '').toLowerCase().includes(needle) || cond.id === needle.replace(/\s+/g, '_')) {
        matches.push({ ...cond, systemId });
      }
    }
  }
  if (!matches.length) { await sendMessage(chatId, `No condition matched \"${escapeHtml(term)}\".`); return; }
  const cond = matches[0];

  // Clinical info lives in its own collection (one doc per condition,
  // doc ID = conditionId) — same source the web app's
  // ConditionClinicalInfoPanel reads via useConditionClinicalInfo.js.
  // Shown first, same order as the web app: clinical info above, drugs below.
  const infoSnap = await adminDb().collection('condition_clinical_info').doc(cond.id).get();
  const info = infoSnap.exists ? infoSnap.data() : null;

  // Live matching in the app is STRICT and tag-based (condition_tags on
  // the drug doc), not a live keyword scan — see getDrugConditions in
  // systemConditions.js. Mirror that here so bot results agree with what
  // the app itself shows on the Browse/System pages.
  const snap = await adminDb().collection('drugs').where('condition_tags', 'array-contains', cond.id).limit(30).get();

  const header = `<b>${escapeHtml(cond.icon || '')} ${escapeHtml(cond.label)}</b>`;

  const infoSections = info ? [
    info.introduction ? `\n<b>Introduction</b>\n${escapeHtmlWithBold(info.introduction)}` : null,
    info.etiology ? `\n<b>Etiology</b>\n${escapeHtmlWithBold(info.etiology)}` : null,
    info.clinicalManifestation ? `\n<b>Clinical Manifestation</b>\n${escapeHtmlWithBold(info.clinicalManifestation)}` : null,
    info.diagnosis ? `\n<b>Diagnosis and Investigation</b>\n${escapeHtmlWithBold(info.diagnosis)}` : null,
    info.management ? `\n<b>Medical Management</b>\n${escapeHtmlWithBold(info.management)}` : null,
  ].filter(Boolean) : [];

  const drugsText = snap.empty
    ? '\n<i>No drugs are tagged for this condition yet.</i>'
    : `\n<b>Drugs</b>\n${snap.docs.map((d, i) => `${i + 1}. ${escapeHtml(d.data().generic_name)}`).join('\n')}`;

  let text = [header, ...infoSections, drugsText].join('\n');
  const footer = `\n\nUse <code>/drug &lt;name&gt;</code> for full drug details.` +
    (matches.length > 1 ? `\n(${matches.length - 1} other condition${matches.length - 1 === 1 ? '' : 's'} also matched "${escapeHtml(term)}" — be more specific to see a different one)` : '');

  // Telegram messages cap at 4096 chars — clinical info alone can exceed
  // that, so truncate the body (not the footer) if needed, same pattern
  // handleLabs uses.
  const budget = 3900 - footer.length;
  if (text.length > budget) {
    text = text.slice(0, budget);
    // A hard slice can land mid-tag (e.g. "...Treatmen<b>t") or leave a
    // <b> open with no matching </b> — either breaks Telegram's HTML
    // parser and the whole message fails to send. Trim back to the last
    // safe boundary and close any unmatched <b>.
    const lastLt = text.lastIndexOf('<');
    if (lastLt !== -1 && text.indexOf('>', lastLt) === -1) text = text.slice(0, lastLt);
    const opens = (text.match(/<b>/g) || []).length;
    const closes = (text.match(/<\/b>/g) || []).length;
    if (opens > closes) text += '</b>'.repeat(opens - closes);
    text += '\n… (truncated — see full clinical info in the app)';
  }

  await sendMessage(chatId, text + footer);
}

async function handleFavorites(chatId, args) {
  const link = await requireLink(chatId);
  if (!link) return;
  const favRef = adminDb().collection('users').doc(link.uid).collection('favorites');

  if (!args) {
    const snap = await favRef.get();
    if (snap.empty) { await sendMessage(chatId, 'No favorites yet. Add one with <code>/favorites add amoxicillin</code>.'); return; }
    const text = snap.docs.map((d, i) => `${i + 1}. ${escapeHtml(d.data().generic_name || d.id)}`).join('\n');
    await sendMessage(chatId, `⭐ Your favorites:\n${text}`);
    return;
  }

  const [action, ...rest] = args.split(' ');
  const term = rest.join(' ');
  if (action === 'add' && term) {
    const results = await searchDrugs(term);
    if (!results.length) { await sendMessage(chatId, `No drug matched "${escapeHtml(term)}".`); return; }
    const d = results[0];
    await favRef.doc(d.id).set({ generic_name: d.generic_name, addedAt: FieldValue.serverTimestamp() });
    await sendMessage(chatId, `⭐ Added ${escapeHtml(d.generic_name)} to favorites.`);
  } else if (action === 'remove' && term) {
    const results = await searchDrugs(term);
    if (results.length) await favRef.doc(results[0].id).delete();
    await sendMessage(chatId, `Removed ${escapeHtml(term)} from favorites (if it was there).`);
  } else {
    await sendMessage(chatId, 'Usage: <code>/favorites</code>, <code>/favorites add &lt;drug&gt;</code>, or <code>/favorites remove &lt;drug&gt;</code>.');
  }
}

async function handleAi(chatId, question) {
  const link = await requireLink(chatId);
  if (!link) return;
  if (!question) { await sendMessage(chatId, 'Usage: <code>/ai should I combine ibuprofen with warfarin?</code>'); return; }

  const admin = await isAdminUid(link.uid, link.email);
  if (!admin) {
    try {
      await consumeCredits(link.uid, CLINICAL_PLAN_COST);
    } catch (e) {
      await sendMessage(chatId, `⚠️ ${e.message} Buy more from the app: More → AI Credits.`);
      return;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { await sendMessage(chatId, 'AI is not configured on the server.'); return; }

  await sendMessage(chatId, '🤖 Thinking…');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: 'You are a clinical drug/lab reference assistant for nurses and clinicians at a Nigerian hospital. Be concise, practical, and safety-focused. This is not a substitute for a pharmacist or physician for high-risk decisions.',
        messages: [{ role: 'user', content: question }],
      }),
    });
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    await sendMessage(chatId, text ? escapeHtml(text) : 'No response generated.');
  } catch (e) {
    await sendMessage(chatId, `AI request failed: ${escapeHtml(e.message)}`);
  }
}

async function handlePending(chatId) {
  const link = await requireLink(chatId);
  if (!link) return;
  const admin = await isAdminUid(link.uid, link.email);
  if (!admin) { await sendMessage(chatId, '🔒 Admins only.'); return; }

  // Firestore can't query "array field is non-empty" directly, so scan
  // (bounded, same reasoning as searchDrugs) and filter in-memory —
  // matches how ConditionSection.js finds these client-side too.
  const snap = await adminDb().collection('drugs').limit(3000).get();
  const pending = snap.docs.filter(d => Array.isArray(d.data().pending_condition_tags) && d.data().pending_condition_tags.length > 0);
  if (!pending.length) { await sendMessage(chatId, '✅ Nothing pending review.'); return; }
  const text = pending.slice(0, 10).map((d, i) => {
    const tags = (d.data().pending_condition_tags || []).join(', ');
    return `${i + 1}. ${escapeHtml(d.data().generic_name)} → ${escapeHtml(tags)} (id: <code>${d.id}</code>)`;
  }).join('\n');
  await sendMessage(chatId, `📋 Pending AI-flagged matches:\n${text}\n\nUse <code>/approve &lt;id&gt; &lt;condition&gt;</code> or <code>/reject &lt;id&gt; &lt;condition&gt;</code>.`);
}

async function handleReviewAction(chatId, args, approve) {
  const link = await requireLink(chatId);
  if (!link) return;
  const admin = await isAdminUid(link.uid, link.email);
  if (!admin) { await sendMessage(chatId, '🔒 Admins only.'); return; }

  const [drugId, ...rest] = (args || '').split(' ');
  const condition = rest.join(' ');
  if (!drugId || !condition) { await sendMessage(chatId, `Usage: <code>/${approve ? 'approve' : 'reject'} &lt;id&gt; &lt;condition&gt;</code>`); return; }

  const ref = adminDb().collection('drugs').doc(drugId);
  const snap = await ref.get();
  if (!snap.exists) { await sendMessage(chatId, 'Drug not found.'); return; }

  const update = { pending_condition_tags: FieldValue.arrayRemove(condition) };
  if (approve) {
    update.confirmed_condition_tags = FieldValue.arrayUnion(condition);
  }
  await ref.update(update);
  await sendMessage(chatId, `${approve ? '✅ Approved' : '❌ Rejected'}: ${escapeHtml(condition)} for ${escapeHtml(snap.data().generic_name)}.`);
}

async function handleHelp(chatId) {
  await sendMessage(chatId, [
    '<b>MedIndex bot commands</b>',
    '/link &lt;code&gt; — connect your account',
    '/status — your account, role, credits',
    '/search &lt;term&gt; — find drugs',
    '/drug &lt;name&gt; — full drug details',
    '/labs &lt;test&gt; — lab reference',
    '/condition &lt;name&gt; — drugs for a condition',
    '/favorites [add|remove] &lt;drug&gt; — saved drugs',
    '/ai &lt;question&gt; — AI clinical consult (uses 1 credit)',
    '/credits — check AI credit balance',
    '/unlink — disconnect your account',
    '',
    '<i>Admins only:</i>',
    '/pending — AI-flagged matches awaiting review',
    '/approve &lt;id&gt; &lt;condition&gt;',
    '/reject &lt;id&gt; &lt;condition&gt;',
  ].join('\n'));
}

// ── Webhook entry point ────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(200).json({ ok: true }); return; }

  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && req.headers['x-telegram-bot-api-secret-token'] !== expected) {
    res.status(401).json({ error: 'Invalid secret token' });
    return;
  }

  // IMPORTANT: await all real work BEFORE sending the response. Vercel can
  // freeze/terminate the function the instant a response is sent, so any
  // async work kicked off "in the background" after res.status(200) here
  // is not guaranteed to ever finish — that was silently swallowing every
  // reply (Telegram saw 200 OK; the sendMessage() call underneath it never
  // actually completed).
  try {
    const update = req.body || {};
    const msg = update.message;
    if (!msg || !msg.text) { res.status(200).json({ ok: true }); return; }
    const chatId = msg.chat.id;
    const [cmdRaw, ...rest] = msg.text.trim().split(' ');
    const cmd = cmdRaw.split('@')[0]; // strip @BotName in group chats
    const arg = rest.join(' ');

    switch (cmd) {
      case '/start': await handleStart(chatId); break;
      case '/help': await handleHelp(chatId); break;
      case '/link': await handleLink(chatId, msg.from, arg); break;
      case '/unlink': await handleUnlink(chatId); break;
      case '/status': await handleStatus(chatId); break;
      case '/credits': await handleCredits(chatId); break;
      case '/search': await handleSearch(chatId, arg); break;
      case '/drug': await handleDrug(chatId, arg); break;
      case '/labs': await handleLabs(chatId, arg); break;
      case '/condition': await handleCondition(chatId, arg); break;
      case '/favorites': await handleFavorites(chatId, arg); break;
      case '/ai': await handleAi(chatId, arg); break;
      case '/pending': await handlePending(chatId); break;
      case '/approve': await handleReviewAction(chatId, arg, true); break;
      case '/reject': await handleReviewAction(chatId, arg, false); break;
      default:
        await sendMessage(chatId, "Didn't recognize that command. Send /help to see what I can do.");
    }
  } catch (e) {
    console.error('[telegram-bot] handler error:', e);
  }

  res.status(200).json({ ok: true });
}
