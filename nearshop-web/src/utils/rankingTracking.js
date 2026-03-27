import { trackEvent, trackEventsBatch } from '../api/analytics'

const seenImpressions = new Set()

export function buildRankingMetadata(item, context = {}) {
  return {
    ranking_surface: context.ranking_surface || item?.ranking_surface || null,
    ranking_reason: context.ranking_reason || item?.reason || null,
    query: context.query || null,
    source_screen: context.source_screen || null,
    position: context.position ?? null,
  }
}

export function rankingSearchParams(context = {}) {
  const params = new URLSearchParams()
  if (context.ranking_surface) params.set('surface', context.ranking_surface)
  if (context.ranking_reason) params.set('reason', context.ranking_reason)
  if (context.query) params.set('query', context.query)
  if (context.source_screen) params.set('source_screen', context.source_screen)
  if (context.position != null) params.set('position', String(context.position))
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export function readRankingContext(searchParams) {
  const position = Number(searchParams.get('position'))
  return {
    ranking_surface: searchParams.get('surface') || null,
    ranking_reason: searchParams.get('reason') || null,
    query: searchParams.get('query') || null,
    source_screen: searchParams.get('source_screen') || null,
    position: Number.isFinite(position) ? position : null,
  }
}

export function trackRankingClick(item, context = {}) {
  const metadata = buildRankingMetadata(item, context)
  if (!metadata.ranking_surface || !item?.id) return Promise.resolve()
  return trackEvent({
    event_type: 'product_click',
    entity_type: 'product',
    entity_id: item.id,
    metadata,
  }).catch(() => {})
}

export function trackRankingAction(eventType, item, context = {}) {
  const metadata = buildRankingMetadata(item, context)
  if (!metadata.ranking_surface || !item?.id) return Promise.resolve()
  return trackEvent({
    event_type: eventType,
    entity_type: 'product',
    entity_id: item.id,
    metadata,
  }).catch(() => {})
}

export function trackRankingImpressions(items = [], baseContext = {}) {
  const events = items
    .slice(0, 8)
    .map((item, index) => {
      const context = { ...baseContext, position: baseContext.position ?? index + 1 }
      const metadata = buildRankingMetadata(item, context)
      if (!metadata.ranking_surface || !item?.id) return null
      const key = [
        metadata.ranking_surface,
        metadata.query || '',
        item.id,
        metadata.position || '',
      ].join(':')
      if (seenImpressions.has(key)) return null
      seenImpressions.add(key)
      return {
        event_type: 'ranking_impression',
        entity_type: 'product',
        entity_id: item.id,
        metadata,
      }
    })
    .filter(Boolean)

  if (!events.length) return Promise.resolve()
  return trackEventsBatch(events).catch(() => {})
}
