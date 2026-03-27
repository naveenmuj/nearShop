# Operational Insights Validation Tracker

## Objective

This tracker is the operational checklist for closing NearShop merchant operational insights.

This capability should only be marked complete when:

- backend outputs are stable
- merchant-facing surfaces are wired
- outputs are understandable
- validation criteria are reviewed against real shop data
- known limitations are documented

## Scope

- shop stats
- product analytics
- local demand insights
- 7-day forecast
- reorder alerts
- customer segment summary
- recommended merchant actions

## Implementation Status

| Area | Current Status | Evidence | Notes |
| --- | --- | --- | --- |
| Shop stats endpoint | Done | `GET /api/v1/analytics/shop/{shop_id}/stats` | Implemented |
| Product analytics endpoint | Done | `GET /api/v1/analytics/shop/{shop_id}/products` | Implemented |
| Demand insights endpoint | Done | `GET /api/v1/analytics/shop/{shop_id}/demand` | Requires location |
| Operational insights endpoint | Done | `GET /api/v1/analytics/shop/{shop_id}/operational-insights` | Implemented |
| Forecast output | Done | Included in `sales_forecast` | Rolling average method |
| Reorder alert output | Done | Included in `reorder_alerts` | Rules-based |
| Customer segment summary | Done | Included in `customer_segments` | Uses existing segmentation |
| Recommended actions | Done | Included in `recommended_actions` | CTA-oriented |
| Output metadata | Done | Included in `meta` | Added confidence, sample sizes, warnings |
| Mobile analytics surface | Done | Business analytics screen | Consumes operational insights |
| Web analytics surface | Done | Business analytics page | Consumes operational insights |
| Regression coverage | Done | Backend regression tests | Unit/regression level only |
| Real-data validation | Pending | Manual review needed | Needs business review |
| Acceptance thresholds | Pending | Not formally approved | Must be defined |
| Monitoring dashboard | Pending | Not implemented | Operational gap |
| Merchant explainability standard | Partial | Meta/warnings added | UI copy still not standardized |

## Acceptance Criteria

### 1. Forecast Quality

- Forecast response must always include:
  - `next_7_days_revenue`
  - `next_7_days_orders`
  - `recent_daily_avg_revenue`
  - `recent_daily_avg_orders`
  - confidence label in `meta.confidence.forecast`
- Forecast output must expose low-confidence conditions via `meta.warnings`

### 2. Inventory Actionability

- Reorder alerts must never suggest zero reorder quantity
- Reorder alerts must include severity and recommended quantity
- Merchant action card must explain why reorder is suggested

### 3. Customer Insight Coverage

- Operational insights must return segment summary even when full segment breakdown is small
- Segment confidence must be visible in metadata

### 4. Demand Snapshot Clarity

- If location is missing, the response must explicitly say demand snapshot is limited
- If location exists, demand queries should be included in the response payload

### 5. Explainability

- Output must expose:
  - methods used
  - sample sizes
  - confidence labels
  - warnings

## Remaining Work

### Product / Business Validation

- [ ] Review forecast usefulness with real shop data
- [ ] Review reorder alert usefulness with real inventory cases
- [ ] Review recommended actions with business stakeholders
- [ ] Decide minimum acceptable confidence thresholds for surfacing actions prominently

### Engineering Hardening

- [x] Add metadata for confidence, sample size, and warnings
- [x] Add regression coverage for metadata contract
- [x] Add structured API response schema for operational insights
- [ ] Add monitoring for operational insights endpoint latency/error rates
- [ ] Add snapshot-based evaluation script for live shop validation

### UX Hardening

- [ ] Standardize UI wording for low-confidence forecast
- [ ] Standardize UI wording for missing-location demand snapshot
- [ ] Add merchant-facing “why am I seeing this?” copy

## Ownership

| Workstream | Owner | Status | Next Action |
| --- | --- | --- | --- |
| Backend operational insights logic | Engineering | In Progress | Add monitoring and live validation |
| Merchant validation | Product/Business | Pending | Review output against real shops |
| Mobile analytics UX | Engineering/Product | Partial | Improve explainability copy |
| Web analytics UX | Engineering/Product | Partial | Improve explainability copy |
| Operations | Engineering/Ops | Pending | Add endpoint monitoring |

## Input Needed From You

The next important inputs should come from product/business review, not engineering guesswork:

1. Which 3-5 real shops should be used to validate forecast and reorder quality?
2. What makes a forecast “good enough” for your business use case?
3. Should low-confidence actions still be shown, or visually downgraded?
4. Which action types matter most to merchants:
   - inventory
   - win-back customers
   - loyalty/champions
   - demand-based promotions
   - revenue drop alerts

## Recommended Next Step

Run a real-data operational insights review for selected shops and score:

- accuracy
- usefulness
- clarity
- actionability

That is the cleanest way to formally close this operational-insights layer before moving deeper into personalization and ranking work.
