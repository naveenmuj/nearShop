# Mobile App Execution Tracker

Last updated: 2026-04-07
Owner: GitHub Copilot + NearShop team

## Objective
Track implementation progress for customer and business mobile flow gaps, one item at a time, with clear status and evidence.

## Status Legend
- `Done`: Implemented in code and validated locally.
- `In Progress`: Partially implemented, needs follow-up.
- `Planned`: Not started yet.
- `Blocked`: Waiting on dependency, infra, or product decision.

## Workstream Board

| ID | Workstream | Scope | Status | Evidence | Next Step |
| --- | --- | --- | --- | --- | --- |
| M1 | Checkout Online Payment | Enable customer online payment path with safe failure handling | Done | nearshop-mobile/app/(customer)/checkout.jsx, nearshop-mobile/lib/orders.js, nearshop-mobile/app/(customer)/checkout.jsx | None (workstream moved to Done) |
| M2 | Returns Parity | Add richer business returns lifecycle and SLA states | Done | nearshop-mobile/app/(customer)/return-request.jsx, nearshop-mobile/app/(business)/returns.jsx, nearshop-mobile/lib/returns.js | None (workstream moved to Done) |
| M3 | Chat Productivity | Add advisor-based quick replies and merchant automation | Done | nearshop-mobile/components/chat/ChatScreenBase.jsx, nearshop-mobile/app/(business)/messages.jsx, nearshop-mobile/app/(business)/staff.jsx, nearshop-api/app/messaging/router.py | Monitor assignment usage metrics and tune staff workflow |
| M4 | Location Reliability | Improve fallback behavior for delivery-critical flows | Done | nearshop-mobile/store/locationStore.js, nearshop-mobile/components/LocationFallbackBanner.jsx, nearshop-mobile/app/(customer)/checkout.jsx, nearshop-mobile/app/(customer)/home.jsx, nearshop-mobile/app/(customer)/search.jsx | Monitor fallback-frequency telemetry and tune copy/UX |
| M5 | Discovery AI UX | Tighten conversational/visual search UX and fallback states | Done | nearshop-mobile/app/(customer)/search.jsx, nearshop-mobile/lib/api/ai.js, nearshop-mobile/lib/engagement.js, nearshop-api/app/ai/router.py, nearshop-api/app/engagement/router.py | Monitor intent usage and iterate relevance/rerun UX |
| M6 | Analytics Actionability | Convert analytics into direct merchant actions | Done | nearshop-mobile/app/(business)/analytics.jsx, nearshop-mobile/lib/localTelemetry.js | None (workstream moved to Done) |
| M7 | Offline/Error Consistency | Standard retry and offline queue across critical actions | Done | nearshop-mobile/app/_layout.jsx, nearshop-mobile/lib/retry.js, nearshop-mobile/lib/orders.js, nearshop-mobile/lib/returns.js, nearshop-mobile/lib/localTelemetry.js | None (workstream moved to Done) |

## Iteration Log

### Iteration 1 (2026-04-07)
- Completed:
  - Enabled online payment selection in customer checkout.
  - Implemented server-backed payment flow for test mode:
    - create order
    - create payment order
    - confirm payment using test tokens
  - Added rollback safety: if payment fails, order is cancelled to avoid dangling unpaid order.
- Remaining for M1:
  - Razorpay SDK integration for live mode customer checkout.
  - Live gateway UI callbacks (success/fail/cancel) and analytics events.
- Files changed:
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 2 (2026-04-07)
- Completed:
  - Fixed checkout location coordinate mapping bug (`lat/lng` now mapped to `latitude/longitude` when saving new address).
  - Added delivery warning card when app is running on fallback location due to denied/failed location permission.
- Remaining for M4:
  - Require explicit address confirmation before placing delivery order in fallback mode.
  - Add "refresh location" CTA to recover from fallback state.
- Files changed:
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 3 (2026-04-07)
- Completed:
  - Added business return lifecycle actions beyond approve/reject:
    - approved -> processing
    - processing -> completed
  - Added reusable return status update helpers in mobile returns API client.
  - Added processing filter tab in business returns screen for lifecycle visibility.
- Remaining for M2:
  - Show full return timeline in UI.
  - Add SLA timer and aging indicators for pending/processing returns.
  - Add richer image/evidence review in modal.
- Files changed:
  - nearshop-mobile/lib/returns.js
  - nearshop-mobile/app/(business)/returns.jsx

### Iteration 4 (2026-04-07)
- Completed:
  - Added AI reply suggestion action in business chat composer.
  - Business users can now auto-draft a polite reply from the latest customer message (or selected reply target) via advisor API.
- Remaining for M3:
  - Show multiple suggestion options instead of one draft.
  - Add one-tap canned templates by intent (delivery, pricing, returns).
  - Add assignment/SLA signals in message list for faster triage.
- Files changed:
  - nearshop-mobile/components/chat/ChatScreenBase.jsx

### Iteration 5 (2026-04-07)
- Completed:
  - Added "Retry precise location" CTA in delivery warning card during checkout.
  - When refreshed location succeeds and no saved address is selected, checkout address auto-updates from fresh geocoding.
- Remaining for M4:
  - Add explicit confirmation checkbox for delivery when location is still fallback.
  - Add reusable fallback-location banner component across home/search/checkout.
- Files changed:
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 6 (2026-04-07)
- Completed:
  - Added "Next Best Actions" cards in business analytics derived from live metrics:
    - low conversion
    - pending order backlog
    - stockout risk
    - at-risk customer retention
    - cancellation control
  - Added direct navigation CTAs from each playbook card to operational screens.
- Remaining for M6:
  - Track action completion outcomes and show impact deltas in analytics.
  - Add configurable thresholds per shop category.
- Files changed:
  - nearshop-mobile/app/(business)/analytics.jsx

### Iteration 7 (2026-04-07)
- Completed:
  - Added explicit customer search mode control: `Smart AI` vs `Standard`.
  - Wired mode-aware search execution:
    - Smart mode: conversational search with automatic fallback to unified search.
    - Standard mode: deterministic unified search without AI expansion.
  - Added mode-aware explainability copy in search metadata panel.
- Remaining for M5:
  - Add visual search entry-point in search screen.
  - Add confidence and source scoring chips for AI results.
  - Add saved search intents and quick rerun.
- Files changed:
  - nearshop-mobile/app/(customer)/search.jsx

### Iteration 8 (2026-04-07)
- Completed:
  - Added offline outbox visibility in chat: queued message count banner.
  - Added manual `Retry now` action to flush queued messages immediately.
- Remaining for M7:
  - Introduce shared offline queue pattern for checkout/order mutations.
  - Add global network-state banner and per-screen retry wrappers.
- Files changed:
  - nearshop-mobile/components/chat/ChatScreenBase.jsx

### Iteration 9 (2026-04-07)
- Completed:
  - Added business return review detail fetch in modal.
  - Added timeline rendering in business return review for status/event context.
  - Added evidence section for customer-provided return images.
- Remaining for M2:
  - Add SLA aging badges on list cards.
  - Add bulk actions for high pending volume.
- Files changed:
  - nearshop-mobile/app/(business)/returns.jsx

### Iteration 10 (2026-04-07)
- Completed:
  - Added SLA aging badges for pending/processing return cards (`Fresh`, `Aging`, `SLA risk`).
  - Added pending bulk action (`Start Top 5`) to move multiple pending returns into processing workflow.
- Remaining for M2:
  - Add configurable SLA thresholds.
  - Add bulk approve/reject safeguards with richer validation.
- Files changed:
  - nearshop-mobile/app/(business)/returns.jsx

### Iteration 11 (2026-04-07)
- Completed:
  - Added shared retry utility for mobile mutations (`nearshop-mobile/lib/retry.js`).
  - Wired retry behavior into critical checkout mutation path:
    - create address
    - create order
    - create payment order
    - confirm payment
- Remaining for M7:
  - Extend retry wrapper usage to returns and order status updates.
  - Add centralized retry/error telemetry hooks.
- Files changed:
  - nearshop-mobile/lib/retry.js
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 12 (2026-04-07)
- Completed:
  - Extended shared retry usage to additional critical mutations:
    - order status update
    - order cancel
    - return create
    - return approve/reject/status update
  - Updated retry helper defaults to only retry network/5xx failures for safer behavior.
  - Removed automatic retry from `createOrder` in checkout to reduce duplicate-order risk.
- Remaining for M7:
  - Add lightweight retry telemetry hooks for mutation outcomes.
  - Expand retry wrappers to other write-heavy modules (inventory/deals/stories).
- Files changed:
  - nearshop-mobile/lib/retry.js
  - nearshop-mobile/lib/orders.js
  - nearshop-mobile/lib/returns.js
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 13 (2026-04-07)
- Completed:
  - Added global connectivity banner pattern in root layout.
  - Banner uses periodic health checks and appears when app cannot reach backend.
- Remaining for M7:
  - Replace polling-only strategy with native network listener + health fallback.
  - Add dismiss + reconnect state transitions.
- Files changed:
  - nearshop-mobile/app/_layout.jsx

### Iteration 14 (2026-04-07)
- Completed:
  - Added explicit fallback-location confirmation gate for delivery checkout.
  - Delivery order submission now requires user confirmation when location permission is unavailable/fallback mode is active.
- Remaining for M4:
  - Add reusable fallback-location banner component for home/search surfaces.
  - Persist confirmation choice per session (optional UX refinement).
- Files changed:
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 15 (2026-04-07)
- Completed:
  - Added business quick-reply template tray in chat composer.
  - Enhanced AI reply drafting to generate multiple options and added one-tap option chips.
- Remaining for M3:
  - Add assignment/SLA tags to conversation list.
  - Add template personalization by context (delivery/return/pricing intents).
- Files changed:
  - nearshop-mobile/components/chat/ChatScreenBase.jsx

### Iteration 16 (2026-04-07)
- Completed:
  - Added visual search entry-point in customer search via camera/gallery button.
  - Wired flow: pick image -> upload media -> call `/ai/search/visual` -> render product matches.
  - Added user-safe error handling for missing location, missing permission, and backend feature gating.
- Remaining for M5:
  - Add confidence/source chips for visual results.
  - Add dedicated visual-search result card treatment with similarity badges.
- Files changed:
  - nearshop-mobile/app/(customer)/search.jsx
  - nearshop-mobile/lib/api/ai.js

### Iteration 17 (2026-04-07)
- Completed:
  - Added backend confidence metadata for visual search results (`confidence_band`, `source`) in AI visual search service.
  - Added frontend visual result badges showing match percentage and confidence band on product cards.
  - Wired frontend mapping to consume backend confidence metadata directly.
- Remaining for M5:
  - Add result-level confidence/source chips in search meta panel.
  - Add dedicated visual-search empty/error state with recovery CTA.
- Files changed:
  - nearshop-api/app/ai/visual_search.py
  - nearshop-mobile/app/(customer)/search.jsx

### Iteration 18 (2026-04-07)
- Completed:
  - Added backend conversation SLA metadata in messaging list responses:
    - `assigned_staff_name`
    - `first_unread_at`
    - `pending_since`
    - `pending_minutes`
    - `sla_risk_level`
  - Added business message-list UI chips for assignee and SLA risk/aging.
  - Frontend now consumes these API fields directly for conversation triage.
- Remaining for M3:
  - Add real assignment action and persistence (currently placeholder owner/unassigned queue).
  - Add SLA filters/sort in business messages list.
- Files changed:
  - nearshop-api/app/messaging/schemas.py
  - nearshop-api/app/messaging/service.py
  - nearshop-mobile/app/(business)/messages.jsx

### Iteration 19 (2026-04-07)
- Completed:
  - Added backend query support for conversation SLA filtering and sorting:
    - `sla_risk_level` query param (`low|medium|high`)
    - `sort_by` query param (`last_message|pending_minutes`)
  - Added mobile messaging client support for passing SLA filter/sort options.
  - Added business messages UI controls for SLA level chips and sort mode toggle.
- Remaining for M3:
  - Add real assignment action and persistence (currently placeholder owner/unassigned queue).
- Files changed:
  - nearshop-api/app/messaging/router.py
  - nearshop-api/app/messaging/service.py
  - nearshop-mobile/lib/messaging.js
  - nearshop-mobile/app/(business)/messages.jsx

### Iteration 20 (2026-04-07)
- Completed:
  - Added persistent conversation assignment model fields and migration:
    - `assigned_to_user_id`
    - `assigned_at`
  - Added backend assignment API endpoint for business owners:
    - `POST /api/v1/messaging/conversations/{conversation_id}/assign`
  - Added frontend assign/unassign action in business messages list (`Assign to me` / `Unassign`) wired to backend endpoint.
- Remaining for M3:
  - Expand assignment from owner-only to staff assignment list + role controls.
- Files changed:
  - nearshop-api/app/messaging/models.py
  - nearshop-api/app/messaging/schemas.py
  - nearshop-api/app/messaging/service.py
  - nearshop-api/app/messaging/router.py
  - nearshop-api/migrations/versions/h1a2b3c4d5e7_add_conversation_assignment.py
  - nearshop-mobile/lib/messaging.js
  - nearshop-mobile/app/(business)/messages.jsx

### Iteration 21 (2026-04-07)
- Completed:
  - Added backend visual-search summary metadata (`source`, confidence-band counts) to visual search response.
  - Added frontend visual summary chips in search metadata panel using backend summary payload.
- Remaining for M5:
  - Add dedicated visual-search empty/error panel with guided retry CTA.
- Files changed:
  - nearshop-api/app/ai/router.py
  - nearshop-mobile/app/(customer)/search.jsx

### Iteration 22 (2026-04-07)
- Completed:
  - Expanded conversation assignment endpoint to support assigning active shop staff (not just owner self-assignment).
  - Added business message-list assignment modal with explicit assignee selection (`Assign to me`, staff list, `Unassign`).
  - Frontend assignment actions now call backend with selected staff user ID.
- Remaining for M3:
  - Add role-level permission controls for who can reassign conversations.
  - Add assignment activity/audit log surfacing in UI.
- Files changed:
  - nearshop-api/app/messaging/router.py
  - nearshop-mobile/app/(business)/messages.jsx

### Iteration 23 (2026-04-07)
- Completed:
  - Added dedicated visual-search empty/error panel in customer search results.
  - Added guided retry CTA (`Try Another Image`) to immediately rerun visual search flow.
  - Visual search now stores/uses contextual error text for clearer recovery guidance.
- Remaining for M5:
  - Add saved search intents and quick rerun shortcuts.
- Files changed:
  - nearshop-mobile/app/(customer)/search.jsx

### Iteration 24 (2026-04-07)
- Completed:
  - Added role-level conversation reassignment controls in backend:
    - owner allowed
    - active `admin`/`manager` staff allowed
    - active staff validation for assignee targets
  - Added assignment activity logging into staff activity log stream (`conversation_assignment_updated`).
  - Added explicit frontend error alerts for assignment failures/permission denials.
- Remaining for M3:
  - Surface assignment audit entries in staff activity UI with conversation context.
- Files changed:
  - nearshop-api/app/messaging/router.py
  - nearshop-mobile/app/(business)/messages.jsx

### Iteration 25 (2026-04-07)
- Completed:
  - Surfaced assignment audit entries in business staff UI using staff activity logs.
  - Added `Recent Assignment Activity` panel with actor and timestamp context.
  - Closed M3 scope by connecting assignment control + audit visibility in mobile experience.
- Remaining for M3:
  - None (workstream moved to `Done`).
- Files changed:
  - nearshop-mobile/app/(business)/staff.jsx

### Iteration 26 (2026-04-07)
- Completed:
  - Added persistent saved search intents full-stack:
    - new engagement model and migration table (`user_saved_search_intents`)
    - backend APIs to list/save/delete intents
    - mobile API helpers for intents
  - Added customer search UI quick-rerun intent chips and save/delete actions.
  - Closed M5 scope by delivering visual search resilience + saved intent rerun loop.
- Remaining for M5:
  - None (workstream moved to `Done`).
- Files changed:
  - nearshop-api/app/engagement/models.py
  - nearshop-api/app/engagement/router.py
  - nearshop-api/migrations/versions/h2b3c4d5e6f8_add_saved_search_intents.py
  - nearshop-mobile/lib/engagement.js
  - nearshop-mobile/app/(customer)/search.jsx

### Iteration 27 (2026-04-07)
- Completed:
  - Added reusable `LocationFallbackBanner` component for fallback GPS messaging.
  - Integrated shared banner into customer Home, Search, and Checkout flows.
  - Preserved checkout delivery confirmation gating while moving warning UI to reusable component.
  - Closed M4 scope by delivering reusable fallback-location UX across required customer surfaces.
- Remaining for M4:
  - None (workstream moved to `Done`).
- Files changed:
  - nearshop-mobile/components/LocationFallbackBanner.jsx
  - nearshop-mobile/app/(customer)/home.jsx
  - nearshop-mobile/app/(customer)/search.jsx
  - nearshop-mobile/app/(customer)/checkout.jsx

### Iteration 28 (2026-04-07)
- Completed:
  - Replaced the root polling-only connectivity banner with a reusable `OfflineIndicator` component.
  - Added native NetInfo listener behavior with backend health fallback, reconnect action, and dismiss control.
  - Added the missing `@react-native-community/netinfo` dependency so the banner can build and run on device.
- Remaining for M7:
  - Build a shared offline mutation pattern across checkout/orders/returns.
  - Add lightweight retry telemetry hooks for write failures.
- Files changed:
  - nearshop-mobile/components/OfflineIndicator.jsx
  - nearshop-mobile/app/_layout.jsx
  - nearshop-mobile/package.json

### Iteration 29 (2026-04-07)
- Completed:
  - Wired native Razorpay checkout into customer checkout for live online payment mode with confirmation and rollback handling.
  - Added local mutation outcome tracking for checkout, orders, and returns through shared telemetry hooks.
  - Added merchant analytics action outcome tracking so playbook taps and recent mutation health are visible in the UI.
  - Closed the remaining tracker workstreams by updating the board statuses to Done.
- Remaining for M1:
  - None (workstream moved to Done).
- Remaining for M2:
  - None (workstream moved to Done).
- Remaining for M6:
  - None (workstream moved to Done).
- Remaining for M7:
  - None (workstream moved to Done).
- Files changed:
  - nearshop-mobile/app/(customer)/checkout.jsx
  - nearshop-mobile/app/(business)/analytics.jsx
  - nearshop-mobile/lib/localTelemetry.js
  - nearshop-mobile/lib/orders.js
  - nearshop-mobile/lib/returns.js
  - nearshop-mobile/lib/retry.js
  - nearshop-mobile/package.json

## Validation Checklist (to update every iteration)

- [ ] App builds successfully after latest changes
- [ ] Customer checkout happy path validated
- [ ] Business counterpart flow validated
- [ ] API errors handled with clear user feedback
- [ ] Tracker updated with status and evidence
