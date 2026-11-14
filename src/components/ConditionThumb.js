// src/components/ConditionThumb.js
// Shared condition picture used by Home "Recently viewed" and the Conditions
// list: the condition's own picture always wins; organ artwork / stethoscope
// only when it has none (or it fails to load).
import React, { useState } from 'react';
import { Stethoscope as StethoIcon } from 'lucide-react';
import { normalizeImageUrl } from '../utils/generateDrugImage';

const PUBLIC = process.env.PUBLIC_URL || '';
export const ORGAN_THUMBS = {
  respiratory: `${PUBLIC}/img/organ-lungs.webp`,
  cardiovascular: `${PUBLIC}/img/organ-heart.webp`,
  renal: `${PUBLIC}/img/organ-kidneys.webp`,
};

export default function ConditionThumb({ url, art }) {
  const [failed, setFailed] = useState(false);
  const src = !failed && url ? normalizeImageUrl(url) : art;
  if (src) return <img src={src} alt="" loading="lazy" onError={() => { if (url && !failed) setFailed(true); }} />;
  return <StethoIcon size={22} strokeWidth={2.2} />;
}
