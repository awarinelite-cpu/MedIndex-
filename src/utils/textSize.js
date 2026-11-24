// Reader text size (accessibility). Scales everything sized in rem by changing
// the root font size; the choice is remembered on this device.
const KEY = 'medindex-text-size';
export const TEXT_SIZES = [
  { id: 'normal', label: 'Normal', percent: 100 },
  { id: 'large',  label: 'Large',  percent: 112.5 },
  { id: 'xlarge', label: 'Extra large', percent: 125 },
];

export function getTextSize() {
  try {
    const v = window.localStorage.getItem(KEY);
    if (TEXT_SIZES.some(s => s.id === v)) return v;
  } catch {}
  return 'normal';
}

export function applyTextSize(id = getTextSize()) {
  const size = TEXT_SIZES.find(s => s.id === id) || TEXT_SIZES[0];
  document.documentElement.style.fontSize = `${size.percent}%`;
}

export function setTextSize(id) {
  try { window.localStorage.setItem(KEY, id); } catch {}
  applyTextSize(id);
}
