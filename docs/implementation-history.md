# Implementation history

[← README](../README.md)

These phase summaries were recorded during implementation. Their deployment
and local-environment statements describe those checkpoints, not a current
inventory. See the linked journals for the original evidence and limits.

A React prototyping environment that mimics the Salesforce Lightning look using
the **SLDS 2 (Salesforce Cosmos)** design language. Application records persist in
**Neon Postgres** through a server-owned application API. Phase 4 is independently
approved after Neon integration, recovery, CLI, production, and documentation
checks. See the
[Phase 4 journal](../docs/phases/phase-4-neon.md) for exact evidence and limits.
Phase 5 is independently approved, including agent/assessment contracts, durable
worker lifetime, recovery, and documentation. Exact evidence is tracked in the
[Phase 5 journal](../docs/phases/phase-5-agent-interfaces.md).
Phase 6 is independently approved, including accessible interactions, feature
recovery, recovery-safe edit coalescing, and measured client limits. See the
[Phase 6 journal](../docs/phases/phase-6-ui-reliability.md).
Phase 7 is independently approved for delivery and operational readiness. The
[journal](../docs/phases/phase-7-delivery-readiness.md) and
[verification artifact](../docs/phases/phase-7-verification.json) retain exact
source/evidence and failed attempts. This phase has not deployed or verified the
hosted application.
Phase 8 adds bounded Anthropic `claude-sonnet-5` reasoning that explains findings
and proposes plans over captured application data. The complete local release
gate and actual-provider acceptance pass, and Phase 8 is independently approved.
The local environment now enables Anthropic chat. Follow the
[Phase 8 journal](../docs/phases/phase-8-real-agent.md) and
[verification record](../docs/phases/phase-8-verification.json) for evidence and
limits. Private-org tools and external writes remain outside this scope.

Phase 9's shared HTTP authentication/startup boundary, request lifetime, and
concurrent session reads pass the full 14-stage gate and 205 tests. The independent
reviewer approved all six criteria; the read-only Heroku preflight is complete. See the
[Phase 9 journal](../docs/phases/phase-9-operations.md). That checkpoint did not include
hosted deployment or additional paid provider calls; the later manual verification
below used the user's existing $5 verification allowance.

Manual testing before Phase 10 has removed developer recovery/import controls
from the product UI. Replies now display received text in small increments, accept
valid Anthropic completion metadata, and preserve the final buffered text on
provider failure. Backend, database, browser, and one controlled live Anthropic
verification pass; the local worker is running for another manual test.
The [manual testing log](../docs/manual-testing.md) separates those changes from the
approved Phase 9 source; a hosted release requires fresh source verification.
At the user's request, login also offers **Clear data** beside each profile to
[restore that profile's demo starting state](../docs/manual-testing.md#clear-data-from-login)
after confirmation. Phase 10 remains paused for local manual testing.
