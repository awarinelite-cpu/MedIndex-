// src/lib/telegramLink.js
// Client-side Firestore helpers for linking a MedIndex account to the
// Telegram bot. Mirrors the same pattern used in NACON-EMR
// (src/lib/telegramReminders.js): the web app writes a short-lived code to
// `link_codes/{code}`, the user sends `/link <code>` to the bot, and the
// bot (running server-side with the Admin SDK, see api/telegram-bot.js)
// redeems it by writing `telegram_links/{uid}`.
//
// The bot then acts AS that uid for every command — same permissions
// (admin or not) the user already has in the web app, checked live against
// `admins/{email}` on every admin-only command rather than cached at link
// time.

import {
  doc, setDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function generateLinkCode(uid, email, displayName) {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  await setDoc(doc(db, 'link_codes', code), {
    uid,
    email: email || null,
    displayName: displayName || null,
    used: false,
    createdAt: serverTimestamp(),
  });
  return code;
}

export function listenTelegramLink(uid, callback) {
  return onSnapshot(doc(db, 'telegram_links', uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function unlinkTelegram(uid) {
  await deleteDoc(doc(db, 'telegram_links', uid));
}
