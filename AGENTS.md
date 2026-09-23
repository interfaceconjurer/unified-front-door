<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Preserve merged product behavior

- Before starting a branch or reconciling it with main, fetch origin and record
  the current main SHA. If fetching is unavailable, state that the baseline is
  unverified; do not claim the branch contains the latest product behavior.
- Do not use `git merge -s ours` to integrate a divergent product branch. It
  records ancestry while discarding the incoming tree. Keep incoming behavior
  through an ordinary merge or adapt it to the current architecture.
- Review the final content diff against current main, including removed tests.
  For each affected feature, record whether it is retained, adapted with a
  replacement check, or removed with explicit user approval. Approval of an
  architecture or release does not imply approval to remove existing features.
- An ancestor check or a green branch-local suite is not evidence of feature
  retention. Register new UI behavior checks in `scripts/browser/suites.mjs`,
  the registry used by `scripts/browser/run.mjs`, so both the PR shards and full
  release gate run them; keep the behavior map in `docs/verification.md` current
  when replacing tests.
