import React from 'react';
import { Heart } from 'lucide-react';
import { useFavourites } from '../hooks/useFavourites';

// Heart toggle. First tap saves the item to Favourites, tapping again removes it.
// `item` = { type: 'drug' | 'condition', refId, name, subtitle, ...extra }.
export default function FavouriteHeart({ item, bar = false }) {
  const { isFav, toggle } = useFavourites();
  const saved = isFav(item.type, item.refId);
  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}
      title={saved ? 'Remove from favourites' : 'Save to favourites'}
      className={bar
        ? 'p-2.5 rounded-full text-white hover:bg-white/10 transition-colors flex-shrink-0'
        : 'p-2.5 rounded-full border border-drug-border bg-white text-drug-muted flex-shrink-0'}
    >
      <Heart className="w-5 h-5" style={saved ? { color: '#ff5a6e', fill: '#ff5a6e' } : undefined} />
    </button>
  );
}
