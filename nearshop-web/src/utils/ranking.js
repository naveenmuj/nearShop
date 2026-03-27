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
}

const TONES = {
  reorder: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  favorite_shop: 'bg-pink-50 text-pink-700 border-pink-200',
  query_match: 'bg-blue-50 text-blue-700 border-blue-200',
  recent_intent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  local_trending: 'bg-orange-50 text-orange-700 border-orange-200',
  nearby_high_rated: 'bg-amber-50 text-amber-700 border-amber-200',
  similar_tastes: 'bg-violet-50 text-violet-700 border-violet-200',
  good_value: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  shop_match: 'bg-sky-50 text-sky-700 border-sky-200',
  default: 'bg-purple-50 text-purple-700 border-purple-200',
}

export function getRankingReasonLabel(reason, fallback = 'For you') {
  if (!reason) return fallback
  return LABELS[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getRankingReasonTone(reason) {
  return TONES[reason] || TONES.default
}
