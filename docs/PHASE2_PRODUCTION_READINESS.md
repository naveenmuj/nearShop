# Phase 2 Production Readiness

## Validation Date

- 2026-03-29

## Hosted Environment

- Base URL: `http://165.232.182.130/api/v1`
- Regression report: [live_api_regression_report.json](d:/Local_shop/docs/live_api_regression_report.json)

## Hosted Validation Summary

Hosted regression checks passed:

- `GET /health`
- `GET /features`
- `GET /auth/me`
- `GET /search/history`
- `GET /users/recently-viewed`
- `GET /feed/home`
- `GET /feed/hook`
- `GET /products/search`
- `GET /search/suggestions`
- `GET /search/unified`
- `GET /shops/nearby`
- `GET /deals/nearby`
- `GET /ai/trending`
- `GET /ai/recommendations`
- `GET /analytics/shop/{shop_id}/stats`
- `GET /analytics/shop/{shop_id}/products`
- `GET /analytics/shop/{shop_id}/demand`
- `GET /analytics/shop/{shop_id}/operational-insights`

Additional hosted AI checks executed directly:

- `GET /advisor/suggestions` -> passed
- `POST /advisor/chat` -> passed
- `POST /ai/generate-description` -> passed
- `POST /ai/catalog/snap` multipart upload -> passed
- `GET /shops/mine` -> passed

## Endpoint Readiness

| Endpoint / Feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| AI Advisor suggestions | Stable | Hosted direct check passed | Returns merchant suggestions correctly |
| AI Advisor chat | Stable | Hosted direct check passed | Live AI answer returned successfully |
| Description generation | Stable | Hosted direct check passed | Returned non-fallback generated description |
| Snap & List cataloging | Stable | Hosted direct check passed | Multipart image upload analyzed successfully |
| `shops/mine` auth path | Stable | Hosted direct check passed | Business user auth works after redeploy |
| No-shop onboarding CTA | Partial | Code path implemented | No production business user without a shop currently exists to run a truthful live validation without mutating prod data |
| Visual search | Partial | Backend exists, feature-flag dependent | Needs dedicated hosted validation |
| Conversational search | Partial | Backend exists | Needs quality-focused validation |
| Pricing suggestion | Stable | Existing evaluation artifacts | Still needs usefulness review, not just availability |
| Recommendations | Stable | Hosted regression + ranking reports | Ranking quality should continue improving |
| Collaborative filtering | Partial | Offline quality report exists | Needs hosted scenario validation plus quality tuning |
| Trending | Stable | Hosted regression passed | Ranking tuning remains Phase 3 work |
| Demand gaps | Stable | Existing report artifacts | Merchant usefulness should be reviewed |
| Customer segmentation | Stable | Operational insights output present | Confidence can be low on small shops |
| Review sentiment | Partial | Implemented, not revalidated in this hosted pass | Needs dedicated hosted smoke test |
| Personalized deals | Partial | Implemented, not revalidated in this hosted pass | Needs dedicated hosted smoke test |
| Catalogue suggestions | Partial | Implemented, not revalidated in this hosted pass | Needs dedicated hosted smoke test |

## Notes From This Validation

- The previous `401` issues were consistent with stale or missing auth on role-aware flows.
- Hosted regression is now clean for the tested paths.
- No-shop onboarding behavior is implemented in mobile, but live production validation is blocked by lack of a safe no-shop business test user.

## Sprint Execution Order

### Sprint A: Phase 2 Closure

- Re-run dedicated hosted smoke tests for:
  - review sentiment
  - personalized deals
  - catalogue suggestions
  - visual search
  - conversational search
- Validate no-shop onboarding using a safe test account in staging or a temporary seeded production test user
- Mark each Phase 2 endpoint with final readiness label

### Sprint B: Signal Tracking

- Add impression logging for:
  - unified search
  - recommendations
  - trending
  - deals
- Add click and conversion attribution per ranking surface
- Extend reports to include relevance and conversion metrics by surface

### Sprint C: Ranking Rollout

- Use `query_focus_v1` as current strongest candidate based on profile comparison
- Start live experiment on `unified_search`
- Feed real traffic into experiment outcomes and only promote after thresholds are met

### Sprint D: Production ML Guardrails

- Add endpoint latency and error monitoring
- Standardize fallback policy per AI feature
- Formalize production env defaults and rollout policy

## Current Recommendation

Phase 2 is close enough to treat as `production-ready with a short validation tail`, not fully closed.

The best next engineering focus remains:

- finish Sprint A validation gaps
- then move immediately into Sprint B and Sprint C
