# Testing Strategy

## 1. Unit & Integration Testing
- Framework: Vitest
- Target: Domain services in `packages/business-logic/` and route validation in `packages/validation/`.
- Coverage:
  - Ticket allocation and concurrency controls.
  - Payment calculation and idempotency validation.
  - Stream token verification and single-session enforcement.
  - Virtual gift double-entry ledger calculations.

## 2. Real-Time Chat & Load Testing
- Socket.IO connection stress tests simulating 5,000 to 20,000 concurrent room subscriptions.
- k6 scripts in `tests/load/` targeting API throughput and ticket checkout bottlenecks.

## 3. End-to-End Testing
- Framework: Playwright (`tests/e2e/`)
- User journeys:
  - Discovery -> Ticket Selection -> Checkout -> Confirmation -> Live Watch Room -> Live Chat & Gift.
  - Admin login -> Event creation -> Stream configuration -> Moderation ban action.
