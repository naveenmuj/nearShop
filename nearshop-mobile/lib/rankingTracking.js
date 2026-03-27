import { trackEvent, trackEventsBatch } from './analytics';

const seenImpressions = new Set();

function toStringOrNull(value) {
  if (value == null || value === '') return null;
  return String(value);
}

export function extractRankingContextFromParams(params = {}) {
  const position = Number(params.position);
  return {
    ranking_surface: toStringOrNull(params.surface),
    ranking_reason: toStringOrNull(params.reason),
    ranking_profile: toStringOrNull(params.profile),
    query: toStringOrNull(params.query),
    source_screen: toStringOrNull(params.source_screen),
    position: Number.isFinite(position) ? position : null,
  };
}

export function rankingRouteParams(context = {}) {
  return {
    surface: context.ranking_surface || '',
    reason: context.ranking_reason || '',
    profile: context.ranking_profile || '',
    query: context.query || '',
    source_screen: context.source_screen || '',
    position: context.position != null ? String(context.position) : '',
  };
}

export function buildRankingMetadata(item, context = {}) {
  return {
    ranking_surface: context.ranking_surface || item?.ranking_surface || null,
    ranking_reason: context.ranking_reason || item?.reason || null,
    ranking_profile: context.ranking_profile || item?.ranking_profile || null,
    query: context.query || null,
    source_screen: context.source_screen || null,
    position: context.position ?? null,
  };
}

export function trackRankingClick(item, context = {}) {
  const metadata = buildRankingMetadata(item, context);
  if (!metadata.ranking_surface || !item?.id) return Promise.resolve();
  return trackEvent({
    event_type: 'product_click',
    entity_type: 'product',
    entity_id: item.id,
    metadata,
  }).catch(() => {});
}

export function trackRankingAction(eventType, item, context = {}) {
  const metadata = buildRankingMetadata(item, context);
  if (!metadata.ranking_surface || !item?.id) return Promise.resolve();
  return trackEvent({
    event_type: eventType,
    entity_type: 'product',
    entity_id: item.id,
    metadata,
  }).catch(() => {});
}

export function trackRankingImpressions(items = [], baseContext = {}) {
  const events = items
    .slice(0, 8)
    .map((item, index) => {
      const context = {
        ...baseContext,
        position: baseContext.position ?? index + 1,
      };
      const metadata = buildRankingMetadata(item, context);
      if (!metadata.ranking_surface || !item?.id) return null;
      const key = [
        metadata.ranking_surface,
        metadata.query || '',
        item.id,
        metadata.position || '',
      ].join(':');
      if (seenImpressions.has(key)) return null;
      seenImpressions.add(key);
      return {
        event_type: 'ranking_impression',
        entity_type: 'product',
        entity_id: item.id,
        metadata,
      };
    })
    .filter(Boolean);

  if (!events.length) return Promise.resolve();
  return trackEventsBatch(events).catch(() => {});
}
