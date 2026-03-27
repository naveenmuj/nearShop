const LABELS = {
  ai_match: 'For you',
  reorder: 'Reorder',
  favorite_shop: 'Favorite shop',
  query_match: 'Matches your search',
  recent_intent: 'Based on your searches',
  local_trending: 'Trending nearby',
  nearby_high_rated: 'Top rated nearby',
  similar_tastes: 'Similar shoppers liked this',
  good_value: 'Great value nearby',
  shop_match: 'Great shop match',
};

const TONES = {
  reorder: { backgroundColor: '#DCFCE7', textColor: '#166534' },
  favorite_shop: { backgroundColor: '#FCE7F3', textColor: '#9D174D' },
  query_match: { backgroundColor: '#DBEAFE', textColor: '#1D4ED8' },
  recent_intent: { backgroundColor: '#E0E7FF', textColor: '#4338CA' },
  local_trending: { backgroundColor: '#FFEDD5', textColor: '#C2410C' },
  nearby_high_rated: { backgroundColor: '#FEF3C7', textColor: '#B45309' },
  similar_tastes: { backgroundColor: '#EDE9FE', textColor: '#6D28D9' },
  good_value: { backgroundColor: '#ECFDF5', textColor: '#047857' },
  shop_match: { backgroundColor: '#E0F2FE', textColor: '#0369A1' },
  default: { backgroundColor: '#F3E8FF', textColor: '#7C3AED' },
};

export function getRankingReasonLabel(reason, fallback = 'For you') {
  if (!reason) return fallback;
  return LABELS[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getRankingReasonTone(reason) {
  return TONES[reason] || TONES.default;
}
