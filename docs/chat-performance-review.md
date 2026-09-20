# Chat update integrity and latency review

Reviewed 2026-09-18: the PostgreSQL connection/transaction boundary, navigation
commands and receipts, client request ordering, conversation reconciliation, and
the transition into newly acknowledged content.

## Integrity retained

- A bounded `pg` pool reuses connections and honors the configured TLS settings.
- Transaction-local timeouts, rollback, transport-error handling, and destruction
  of timed-out clients remain in place. Uncertain writes are not blindly replayed.
- Session generation and workspace epoch fence stale callers. SQL values remain
  parameterized; records and receipts are scoped to their authenticated owner.
- Conversation changes and their retry receipts commit atomically. A retry keeps
  the original command identity and cannot replay an older navigation change.
- Snapshot reads retain repeatable-read isolation and the single retry for a
  known serialization rollback. Worker lease, quota, and effect safeguards remain.

## Changes

1. Send `BEGIN` and the four fixed transaction settings together. The same settings
   and transaction boundary now need one setup round trip instead of five.
2. Return the acknowledged conversation with a navigation response. `UPDATE …
   RETURNING revision` supplies its version without another query. The response
   includes history; the durable receipt still contains only identifiers.
3. Merge acknowledgements by revision. Older in-flight snapshots cannot erase a
   new conversation or replace newer messages. Session reset still creates a new
   client store. Legacy acknowledgements await a genuinely fresh history read.
4. Coalesce superseded, unsent plain visits. Preserve in-flight and uncertain
   requests, submitted messages, and explicit work actions in their original order.
5. Poll idle chat every five seconds, pause full-history polling in hidden tabs
   and during navigation writes, and keep active/recovery observation responsive.
   Assessment controls explicitly refresh the agent after acknowledgement.
6. Reveal incoming entries when scrolling begins. The shell transition and reader
   position rules remain; content no longer stays hidden for the entire scroll.
7. Show a live status in the Agent header: **Loading conversation…**, **Updating
   conversation…**, **Still updating…** after five seconds, or **Reconnecting…**
   during automatic recovery. Keep the transcript and composer draft visible.

## Evidence and limits

Before changes, the development log contained six chat writes with a median of
1,589 ms and 90 reads with a median of 701 ms. These are server operation timings,
not end-to-end navigation measurements.

A read-only comparison on the configured remote database alternated the old and
new transaction wrappers around `SELECT 1`, discarding the first warm-up pair:

| Probe | Round trips | Samples (ms) | Median (ms) |
| --- | ---: | --- | ---: |
| Previous wrapper | 7 | 445, 531, 523 | 523 |
| Batched wrapper | 3 | 105, 306, 108 | 108 |

This small sample isolates transaction overhead; it is not a claim that complete
navigation is five times faster. Returning history also removes one follow-up
HTTP request from the normal visit path. Remote latency and the existing workspace
projection reads still contribute to total request time.

Validation: 78 unit/reliability checks and 45 database integration checks passed.
Integration tests used a disposable local PostgreSQL instance and the real schema;
they covered rollback, retry identity, session changes, isolation, model quotas,
worker leases, and streamed progress. Browser checks covered delayed/failed visits,
normal/reduced motion, readable content during scrolling, preserved drafts/history,
reconnect, and day-zero assessment startup. No live model calls were needed.

No application dependency, schema migration, cache service, or second persistence
system was added. This is a focused review of the chat update path, not a complete
security audit or a production load test.
