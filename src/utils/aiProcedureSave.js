import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { parseAiProcedureDetail, isProcedureNotFoundText } from './parseAiProcedureDetail';
import { apiUrl } from '../config/apiBase';

export { isProcedureNotFoundText };

async function getAuthUser() {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in to save procedures.');
  }
  return auth.currentUser;
}

// Same contributor/role pattern as aiDrugSave.js's getContributorInfo — kept
// as its own copy here (rather than imported) so this file has no
// dependency on drug-specific logic. Cached per uid for the session.
let _roleCache = null; // { uid, isAdmin }
async function getContributorInfo() {
  const user = await getAuthUser();
  if (_roleCache && _roleCache.uid === user.uid) {
    return { uid: user.uid, email: user.email || 'unknown', isAdmin: _roleCache.isAdmin };
  }
  let isAdmin = false;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    isAdmin = snap.exists() && snap.data()?.role === 'admin';
  } catch {
    isAdmin = false;
  }
  _roleCache = { uid: user.uid, isAdmin };
  return { uid: user.uid, email: user.email || 'unknown', isAdmin };
}

function buildReviewMeta({ uid, email, isAdmin }, contributionType) {
  return isAdmin
    ? { needs_review: false, reviewed_by: email, reviewed_at: serverTimestamp() }
    : {
        needs_review: true,
        contribution_type: contributionType, // 'new' | 'update'
        contributed_by_uid: uid,
        contributed_by_email: email,
        contributed_at: serverTimestamp(),
      };
}

export function slugifyProcedureName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

// ── Fetch AI text for a procedure ───────────────────────────────────────────
export async function fetchAiProcedureText({ procedureName, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'procedure', genericName: procedureName, notInDatabase: true }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// Any signed-in user (admin or not) can trigger this — same permission
// model as saveAiDrugToDatabase. Non-admin writes land flagged for the
// admin review queue instead of going live unreviewed.
export async function saveAiProcedureToDatabase({ procedureName, text }) {
  const contributor = await getContributorInfo();

  if (isProcedureNotFoundText(text)) {
    throw new Error(`"${procedureName}" could not be identified as a real procedure — nothing was saved.`);
  }

  const parsed = parseAiProcedureDetail(text);
  if (!parsed.overview && !parsed.steps && !parsed.indications) {
    throw new Error(`"${procedureName}" returned little to no usable clinical information — nothing was saved.`);
  }

  const docId = slugifyProcedureName(procedureName);
  const ref   = doc(db, 'procedures', docId);

  const existing = await getDoc(ref);
  const existingData = existing.exists() ? existing.data() : null;

  const previousVersion = (!contributor.isAdmin && existingData && !existingData.needs_review)
    ? existingData
    : (existingData?.previous_version ?? null);

  await setDoc(ref, {
    ...parsed,
    name:         procedureName,
    category:     parsed.category || existingData?.category || 'Uncategorized',
    related_drug_ids:      existingData?.related_drug_ids || [],
    related_condition_ids: existingData?.related_condition_ids || [],
    source:       'AI Generated',
    status:       'Active',
    created_at:  existing.exists()
      ? (existingData.created_at || serverTimestamp())
      : serverTimestamp(),
    last_updated: serverTimestamp(),
    ...buildReviewMeta(contributor, existing.exists() ? 'update' : 'new'),
    previous_version: previousVersion,
  }, { merge: false });

  return { status: 'saved', id: docId };
}

// ── Admin review-queue actions (mirrors aiDrugSave.js) ──────────────────────
export async function approveProcedureReview({ id }) {
  const { email } = await getContributorInfo();
  await updateDoc(doc(db, 'procedures', id), {
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
  });
}

export async function restoreProcedurePreviousVersion({ id, previousVersion }) {
  if (!previousVersion) throw new Error('No previous version was saved for this procedure.');
  const { email } = await getContributorInfo();
  await setDoc(doc(db, 'procedures', id), {
    ...previousVersion,
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
    last_updated: serverTimestamp(),
  }, { merge: false });
}

export async function saveReviewedProcedureEdits({ id, edits }) {
  const { email } = await getContributorInfo();
  await updateDoc(doc(db, 'procedures', id), {
    ...edits,
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
    last_updated: serverTimestamp(),
  });
}

export async function deleteReviewedProcedure({ id }) {
  await getAuthUser();
  await deleteDoc(doc(db, 'procedures', id));
}

// ── Admin-only direct edit (used from the procedure detail page, not the
// review queue) — includes the related drug/condition links. Throws if the
// caller isn't an admin, since this writes straight to the live record with
// no review step.
export async function saveProcedureDetails({ id, fields }) {
  const contributor = await getContributorInfo();
  if (!contributor.isAdmin) {
    throw new Error('Only admins can edit a procedure directly.');
  }
  await updateDoc(doc(db, 'procedures', id), {
    ...fields,
    last_updated: serverTimestamp(),
    needs_review: false,
    reviewed_by: contributor.email,
    reviewed_at: serverTimestamp(),
  });
}

// Admin-only manual create (no AI) — e.g. adding a procedure the AI
// couldn't resolve, or one an admin wants to author from scratch.
export async function createProcedureManually({ name, fields }) {
  const contributor = await getContributorInfo();
  if (!contributor.isAdmin) {
    throw new Error('Only admins can add a procedure manually.');
  }
  const docId = slugifyProcedureName(name);
  await setDoc(doc(db, 'procedures', docId), {
    ...fields,
    name,
    category: fields.category || 'Uncategorized',
    related_drug_ids: [],
    related_condition_ids: [],
    source: 'Manual',
    status: 'Active',
    created_at: serverTimestamp(),
    last_updated: serverTimestamp(),
    needs_review: false,
    reviewed_by: contributor.email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
  }, { merge: false });
  return { status: 'saved', id: docId };
}
