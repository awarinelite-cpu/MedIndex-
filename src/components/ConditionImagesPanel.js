import React, { useRef, useState } from 'react';
import { ImageIcon, ClipboardList, Info, Loader2, Trash2, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadClipboardImageToImgChest, uploadImageToImgChest } from '../utils/generateDrugImage';
import { addConditionImageUrls, deleteConditionImage } from '../hooks/useConditionClinicalInfo';

/* ── Condition picture gallery (swipe to view more than one picture) ───── */
function ConditionImageGallery({ images, altBase }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, images.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (!el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== activeIndex) setActiveIndex(i);
  };

  if (images.length <= 1) {
    const img = images[0];
    return img ? (
      <img
        src={img.url}
        alt={altBase}
        className="w-full max-w-sm mx-auto rounded-lg border border-drug-border"
      />
    ) : null;
  }

  return (
    <div className="relative max-w-sm mx-auto">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        data-swipe-gallery="true"
        // Same as the drug gallery: swiping a picture must never also be
        // read as a page/tab swipe.
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-lg border border-drug-border scroll-smooth"
        style={{ scrollbarWidth: 'none', touchAction: 'pan-x' }}
      >
        {images.map((img, i) => (
          <img
            key={img.url + i}
            src={img.url}
            alt={`${altBase} (${i + 1} of ${images.length})`}
            className="w-full flex-shrink-0 snap-center object-contain bg-white"
            draggable={false}
          />
        ))}
      </div>

      {activeIndex > 0 && (
        <button
          onClick={() => scrollToIndex(activeIndex - 1)}
          aria-label="Previous picture"
          className="hidden sm:flex items-center justify-center absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border border-drug-border shadow hover:bg-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {activeIndex < images.length - 1 && (
        <button
          onClick={() => scrollToIndex(activeIndex + 1)}
          aria-label="Next picture"
          className="hidden sm:flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border border-drug-border shadow hover:bg-white"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center justify-center gap-1.5 mt-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToIndex(i)}
            aria-label={`Go to picture ${i + 1}`}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIndex ? 'bg-primary-600' : 'bg-drug-border'}`}
          />
        ))}
      </div>
      <p className="text-[11px] text-drug-muted text-center mt-1">
        Swipe to see more — {activeIndex + 1} of {images.length}
      </p>
    </div>
  );
}

/* ── Pictures for a condition ─────────────────────────────────────────────
   Everyone sees the pictures once they exist. Admins can add more by pasting
   an image from the clipboard (Ctrl+V / long-press paste on the panel, or the
   "Paste from Clipboard" button) — there is deliberately no file picker and
   no link field. Pasted images are re-hosted on ImgChest via the same
   /api/imgchest-upload proxy the drug pictures use. */
export default function ConditionImagesPanel({ condition, images }) {
  const { isAdmin } = useAuth();
  const list = Array.isArray(images) ? images : [];
  const [pasteState, setPasteState] = useState('idle'); // idle | uploading | error
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  // Nothing to show a regular user, and nothing to do for them.
  if (!isAdmin && list.length === 0) return null;

  // Uploads a batch one by one, then saves every successful picture in a
  // single write so nothing overwrites anything. Failures are reported.
  const uploadMany = async (items, uploadOne) => {
    setPasteState('uploading');
    setError('');
    const urls = [];
    let failed = 0;
    let lastErr = '';
    for (let i = 0; i < items.length; i++) {
      setProgress(items.length > 1 ? `Uploading ${i + 1} of ${items.length}…` : '');
      try {
        urls.push(await uploadOne(items[i]));
      } catch (e) {
        failed += 1;
        lastErr = e.message || 'Upload failed.';
      }
    }
    setProgress('');
    try {
      if (urls.length > 0) {
        await addConditionImageUrls({ conditionId: condition.id, urls, existingImages: list });
      }
      // The live listener pushes the new pictures in automatically.
      if (failed > 0) {
        setError(`${urls.length} of ${items.length} pictures added. ${failed} failed: ${lastErr}`);
        setPasteState(urls.length > 0 ? 'idle' : 'error');
      } else {
        setPasteState('idle');
      }
    } catch (e) {
      setError(e.message || 'Failed to save the pictures.');
      setPasteState('error');
    }
  };

  const uploadBlobs = (blobs) => uploadMany(blobs, (blob) => uploadClipboardImageToImgChest({ blob }));

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length > 0) uploadMany(files, (file) => uploadImageToImgChest({ file }));
  };

  // Ctrl+V / long-press paste while the panel (or a child) has focus.
  const handlePasteEvent = (e) => {
    if (!isAdmin) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const blobs = [];
    for (const item of items) {
      if (item.type?.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) blobs.push(blob);
      }
    }
    if (blobs.length > 0) {
      e.preventDefault();
      uploadBlobs(blobs);
    }
  };

  // Explicit button via the Async Clipboard API — needed on mobile, where
  // there's often no keyboard to trigger a native paste event.
  const handlePasteButton = async () => {
    setPasteState('uploading');
    setError('');
    try {
      if (!navigator.clipboard?.read) {
        throw new Error('Clipboard paste isn’t supported in this browser. Use Upload Photo(s) instead.');
      }
      const items = await navigator.clipboard.read();
      const blobs = [];
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) blobs.push(await item.getType(imageType));
      }
      if (blobs.length === 0) throw new Error('No image found on the clipboard. Copy a picture first, then try again.');
      await uploadBlobs(blobs);
    } catch (e) {
      setError(e.message || 'Failed to paste image from clipboard.');
      setPasteState('error');
    }
  };

  const handleDelete = async (index) => {
    if (!window.confirm(`Remove picture ${index + 1} from "${condition.label}"?`)) return;
    setError('');
    try {
      await deleteConditionImage({ conditionId: condition.id, images: list, index });
    } catch (e) {
      setError(e.message || 'Failed to remove image.');
    }
  };

  const uploading = pasteState === 'uploading';

  return (
    <div
      className="px-4 pt-4 pb-3 focus:outline-none"
      tabIndex={isAdmin ? 0 : undefined}
      onPaste={isAdmin ? handlePasteEvent : undefined}
    >
      <div className="flex items-center gap-2.5 rounded-xl bg-[#EEEAFE] px-3 py-2.5 text-[15px] font-semibold text-[#0A1F5C] mb-3">
        <ImageIcon className="w-5 h-5 text-violet-600 flex-shrink-0" />
        {list.length > 0
          ? `Images${list.length > 1 ? ` (${list.length})` : ''}`
          : `No image yet for ${condition.label}`}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePasteButton}
            disabled={uploading}
            className="inline-flex items-center gap-2 text-[15px] font-bold text-white disabled:opacity-60 px-5 py-2.5 rounded-xl shadow-md"
            style={{ background: 'linear-gradient(135deg, #7C4DFF, #5B2FE0)' }}
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {progress || 'Uploading…'}</>
              : <><ClipboardList className="w-5 h-5" /> {list.length > 0 ? 'Paste More' : 'Paste from Clipboard'}</>}
          </button>
          <label className={`inline-flex items-center gap-2 text-[15px] font-bold px-5 py-2.5 rounded-xl border border-violet-300 bg-white text-violet-700 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-5 h-5" /> Upload Photo(s)
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} disabled={uploading} />
          </label>
        </div>
      )}

      {list.length > 0 && <div className="mt-3"><ConditionImageGallery images={list} altBase={condition.label} /></div>}

      {isAdmin && list.length > 0 && (
        <div className="flex items-center justify-center gap-3 flex-wrap mt-2">
          {list.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDelete(i)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" /> Remove {list.length > 1 ? `#${i + 1}` : 'picture'}
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <p className="text-[13px] italic text-slate-500 mt-3 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Copy image(s), then press Paste — or pick several photos with Upload Photo(s). You can also click here and press Ctrl+V (long-press → Paste on a phone).</span>
        </p>
      )}
      {error && <div className="text-xs text-red-600 mt-2">⚠ {error}</div>}
    </div>
  );
}
