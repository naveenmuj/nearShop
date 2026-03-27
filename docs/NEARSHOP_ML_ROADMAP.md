# NearShop ML Roadmap

## Purpose

This document is the working product and engineering roadmap for NearShop ML and AI capabilities.

It is designed to help the team:

- track what is already shipped
- separate heuristic analytics from true ML layers
- execute phase by phase
- prioritize gaps before building new features
- align backend, mobile, web, analytics, and ops work

## Current Summary

NearShop currently has:

- `Phase 1` formally implemented as merchant analytics intelligence
- multiple AI features already implemented beyond Phase 1
- partial production readiness for AI operations
- no formal advanced ML platform yet

This means the product is already beyond a pure Phase 1 state, but the roadmap has not yet been normalized into structured phases.

Operational tracker:

- [OPERATIONAL_INSIGHTS_VALIDATION_TRACKER.md](d:/Local_shop/docs/OPERATIONAL_INSIGHTS_VALIDATION_TRACKER.md)

## Phase View

| Phase | Name | Status | Goal |
| --- | --- | --- | --- |
| 1 | Analytics Intelligence | Shipped | Deliver low-cost statistical and heuristic insights |
| 2 | Core AI Features | Mostly Shipped | Add feature-level AI capabilities for customers and merchants |
| 3 | Personalization and Ranking | Partial | Improve quality of recommendations, deals, search, and targeting |
| 4 | Production ML Platform | Partial Foundation | Make AI measurable, reliable, observable, and cost-controlled |
| 5 | Advanced ML Platform | Not Started | Add true ML platform capabilities and continuous learning loops |

---

## Phase 1: Analytics Intelligence

### Goal

Provide useful merchant intelligence without depending on expensive model training or large-scale ML infrastructure.

### Scope

- shop stats
- product analytics
- local demand insights
- reorder guidance
- short-term sales forecasting
- recommended merchant actions
- segment summaries from existing data

### Status

`Shipped`

### Existing Backend

- [nearshop-api/app/analytics/router.py](d:/Local_shop/nearshop-api/app/analytics/router.py)
- [nearshop-api/app/analytics/service.py](d:/Local_shop/nearshop-api/app/analytics/service.py)

### Key Characteristics

- rules-based
- statistical
- low-cost
- explainable
- easy to ship and maintain

### Deliverables Already Present

- `GET /api/v1/analytics/shop/{shop_id}/stats`
- `GET /api/v1/analytics/shop/{shop_id}/products`
- `GET /api/v1/analytics/shop/{shop_id}/demand`
- `GET /api/v1/analytics/shop/{shop_id}/phase1`

### Tracking Checklist

- [x] Shop KPIs
- [x] Product analytics
- [x] Demand insights
- [x] Reorder recommendation logic
- [x] Phase 1 endpoint
- [ ] Merchant-facing explainability UI standardization
- [ ] Benchmarking and output quality review

---

## Phase 2: Core AI Features

### Goal

Ship usable AI-powered product experiences for customers and merchants.

### Scope

- AI cataloging
- visual search
- conversational search
- pricing suggestions
- recommendations
- collaborative filtering
- trending
- demand gaps
- customer segmentation
- sentiment intelligence
- personalized deals
- catalogue suggestions
- AI-generated descriptions

### Status

`Mostly Shipped`

### Existing Backend

- [nearshop-api/app/ai/router.py](d:/Local_shop/nearshop-api/app/ai/router.py)
- [nearshop-api/app/ai/cataloging.py](d:/Local_shop/nearshop-api/app/ai/cataloging.py)
- [nearshop-api/app/ai/visual_search.py](d:/Local_shop/nearshop-api/app/ai/visual_search.py)
- [nearshop-api/app/ai/smart_search.py](d:/Local_shop/nearshop-api/app/ai/smart_search.py)
- [nearshop-api/app/ai/trending.py](d:/Local_shop/nearshop-api/app/ai/trending.py)
- [nearshop-api/app/ai/sentiment.py](d:/Local_shop/nearshop-api/app/ai/sentiment.py)
- [nearshop-api/app/ai/catalogue_suggestions.py](d:/Local_shop/nearshop-api/app/ai/catalogue_suggestions.py)

### Existing Web Surface

- [nearshop-web/src/api/ai.js](d:/Local_shop/nearshop-web/src/api/ai.js)

### Core Features and Status

| Feature | Status | Notes |
| --- | --- | --- |
| AI cataloging / Snap & List | Shipped | Merchant-facing image-to-catalog workflow exists |
| Visual search | Partial | Backend exists, feature-flag dependent |
| Conversational search | Partial | Backend exists, quality tuning likely needed |
| Pricing suggestion | Shipped | Present, should be validated for usefulness |
| Content-based recommendations | Shipped | Core recommendation endpoint exists |
| Collaborative filtering | Shipped | Implemented as feature endpoint |
| Hyperlocal trending | Shipped | Event-weighted trending feed exists |
| Demand-gap analysis | Shipped | Merchant opportunity discovery exists |
| Customer segmentation | Shipped | RFM-style segmentation exists |
| Review sentiment | Shipped | AI plus fallback logic exists |
| Personalized deals | Shipped | Endpoint exists |
| Catalogue suggestions | Shipped | Merchant catalog gap suggestions exist |
| Description generation | Shipped | AI-generated shop descriptions exist |

### Tracking Checklist

- [x] AI cataloging
- [x] Recommendations
- [x] Collaborative filtering
- [x] Trending feed
- [x] Demand gap analysis
- [x] Sentiment analysis
- [x] Personalized deals
- [x] Catalogue suggestions
- [ ] Quality scoring per AI feature
- [ ] Feature-level regression tests
- [ ] UX consistency across mobile and web

---

## Phase 3: Personalization and Ranking

### Goal

Improve feature quality by ranking results better per user, per shop, per location, and per intent.

### Why This Phase Matters

NearShop already has several AI endpoints. The next gain is not just adding more endpoints, but making existing outputs rank better and feel more relevant.

### Scope

- unified ranking layer for recommendations, deals, and trending
- ranking based on click, wishlist, cart, and purchase behavior
- better user-profile signals
- better shop-context signals
- locality-aware ranking improvements
- intent-aware search ranking
- feedback loops for relevance improvement

### Status

`Partial`

### Existing Foundations

- event tracking in [nearshop-api/app/analytics/router.py](d:/Local_shop/nearshop-api/app/analytics/router.py)
- trending based on weighted event velocity in [nearshop-api/app/ai/trending.py](d:/Local_shop/nearshop-api/app/ai/trending.py)
- content and collaborative recommendation endpoints in [nearshop-api/app/ai/router.py](d:/Local_shop/nearshop-api/app/ai/router.py)

### Major Gaps

- no shared ranking service
- no unified ranking policy across recommendation/trending/deals/search
- no offline evaluation framework
- no explicit relevance metrics tracking
- no experiment framework for ranking changes

### Proposed Deliverables

#### 3.1 Unified Feature Signals

- define a shared feature set using:
  - product views
  - wishlist adds
  - add-to-cart
  - purchases
  - repeat purchases
  - location affinity
  - shop affinity
  - category affinity

#### 3.2 Ranking Layer

- recommendation reranker
- trending reranker
- personalized deal reranker
- search relevance reranker

#### 3.3 Feedback Loop

- log impression vs click vs cart vs purchase
- generate feature-level conversion metrics
- rank by conversion-aware utility instead of raw heuristics only

### Tracking Checklist

- [ ] Define ranking inputs
- [ ] Define ranking outputs and objectives
- [ ] Build shared ranking service
- [ ] Add impression logging
- [ ] Add click-through and conversion metrics
- [ ] Add offline evaluation notebook or scripts
- [ ] Add simple experiment toggle for ranking versions

---

## Phase 4: Production ML Platform

### Goal

Make AI reliable in production with observability, control, fallback, and cost discipline.

### Status

`Partial Foundation`

### Existing Foundations

- AI feature flags in [nearshop-api/app/config.py](d:/Local_shop/nearshop-api/app/config.py)
- recommendation caching in [nearshop-api/app/ai/cache.py](d:/Local_shop/nearshop-api/app/ai/cache.py)
- tracked AI usage in `nearshop-api/app/ai/tracker.py`
- admin AI analytics in `nearshop-api/app/admin/ai_analytics.py`

### Scope

- latency tracking
- cost tracking
- cache strategy
- error tracking
- fallback strategies
- model/version observability
- environment-based feature control
- readiness for staged rollouts

### Major Gaps

- no formal model registry/version governance
- no standardized per-feature fallback policy document
- no scheduled refresh/retraining job layer
- no A/B testing framework
- no SLA/SLO definitions per AI feature

### Proposed Deliverables

#### 4.1 Observability

- dashboard per AI feature:
  - latency
  - failure rate
  - token usage
  - cost
  - cache hit rate

#### 4.2 Reliability

- standard fallback behavior matrix
- per-feature timeout policy
- degraded mode handling

#### 4.3 Release Control

- feature flags by environment
- model version tagging
- staged rollout support

### Tracking Checklist

- [x] Feature flags
- [x] AI usage tracking foundation
- [x] Recommendation cache foundation
- [ ] Per-feature dashboards
- [ ] Standardized fallbacks
- [ ] Rollout/version policy
- [ ] A/B experimentation support

---

## Phase 5: Advanced ML Platform

### Goal

Move from isolated AI features to a true continuously improving ML system.

### Status

`Not Started`

### Scope

- feature store
- training pipelines
- model registry
- automated evaluation pipelines
- embedding infrastructure at scale
- retrieval + reranking architecture
- continuous retraining loops
- anomaly detection
- fraud/risk models
- merchant copilots using longitudinal business state

### When To Start

This phase should begin only after:

- Phase 3 ranking is stable
- Phase 4 observability is real
- product usage is high enough to justify infrastructure cost

### Tracking Checklist

- [ ] Feature store
- [ ] Training pipeline orchestration
- [ ] Model registry
- [ ] Offline evaluation dataset
- [ ] Embedding lifecycle management
- [ ] Retrieval + reranking architecture
- [ ] Retraining workflows
- [ ] Drift detection

---

## Recommended Execution Order

### Priority Sequence

1. Finish Phase 1 quality and business clarity
2. Stabilize existing Phase 2 features
3. Build Phase 3 ranking and personalization improvements
4. Strengthen Phase 4 production platform
5. Start Phase 5 only after volume and product maturity justify it

### Practical Near-Term Recommendation

The best next phase to execute is:

`Phase 3: Personalization and Ranking`

Reason:

- most Phase 2 features already exist
- user impact now depends more on relevance than on adding more AI endpoints
- Phase 3 creates the highest product uplift without prematurely building heavy ML infrastructure

---

## Quarter-Based Execution Suggestion

### Track A: Stabilize What Exists

- validate all current AI endpoints
- define success metrics per feature
- fix quality and UX gaps
- ensure mobile and web expose the right AI surfaces

### Track B: Ranking

- unify event capture
- define relevance signals
- build first ranking layer
- compare heuristic ranking vs ranked output

### Track C: Production Readiness

- latency dashboards
- token/cost visibility
- fallback policy
- rollout guardrails

---

## Feature-to-Phase Mapping

| Feature | Phase |
| --- | --- |
| Merchant heuristic insights | 1 |
| Reorder and demand summaries | 1 |
| AI cataloging | 2 |
| Visual search | 2 |
| Conversational search | 2 |
| Pricing suggestion | 2 |
| Recommendations | 2 |
| Collaborative filtering | 2 |
| Trending feed | 2 |
| Demand gaps | 2 |
| Customer segmentation | 2 |
| Sentiment intelligence | 2 |
| Personalized deals | 2 |
| Catalogue suggestions | 2 |
| Unified relevance ranking | 3 |
| Conversion-aware reranking | 3 |
| Experimentation | 4 |
| AI observability and cost control | 4 |
| Feature store and retraining platform | 5 |

---

## Ownership Template

Use this section for ongoing tracking.

| Area | Owner | Status | Next Action | Target Date |
| --- | --- | --- | --- | --- |
| Phase 1 quality review | TBD | Not Started | Review Phase 1 output usefulness | TBD |
| AI feature validation | TBD | Not Started | Validate all Phase 2 endpoints | TBD |
| Ranking design | TBD | Not Started | Define shared ranking inputs | TBD |
| AI observability | TBD | Not Started | Add AI metrics dashboard | TBD |
| ML platform planning | TBD | Not Started | Define Phase 5 entry criteria | TBD |

---

## Definition of Done by Phase

### Phase 1 Done

- merchant insights are accurate enough for daily use
- outputs are understandable
- endpoints are stable

### Phase 2 Done

- each AI feature is accessible through product surfaces
- quality is acceptable
- fallbacks exist

### Phase 3 Done

- ranking measurably improves engagement or conversion
- relevance metrics are tracked

### Phase 4 Done

- latency, failure, and cost are observable
- rollouts are controlled
- regressions can be detected quickly

### Phase 5 Done

- models and features improve through structured pipelines rather than manual one-off logic

---

## Immediate Next Actions

Recommended next actions for the team:

1. Validate every currently implemented AI endpoint and mark production-readiness.
2. Add product-level tracking metrics for recommendation, trending, deals, and search relevance.
3. Design Phase 3 ranking inputs and success metrics.
4. Add a delivery plan for observability and fallback standardization.
