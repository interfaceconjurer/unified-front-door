# UI integration incident and prevention

Investigated September 20, 2026. The UI behavior from `f6313a2` reached main
intact in [PR #14](https://github.com/interfaceconjurer/unified-front-door/pull/14),
then was omitted when the architecture branch absorbed main using Git's `ours`
merge strategy. That operation retained the architecture branch's entire tree
while recording the incoming commits as ancestors. A later ancestry check was
therefore true but did not establish that the UI behavior survived.

The investigation and safeguards are ready for review and are being published
on `org-exploration`. Main and the hosted deployment remain unchanged; merging
the branch and enabling remote enforcement remain rollout steps.

The seven selected behaviors are restored separately; see the
[completed restoration ledger](ui-restoration-state.md). This report addresses
the integration mechanism and practical prevention, not responsibility or intent
beyond the available records.

## Confirmed sequence

Times below are Eastern Daylight Time (UTC−04:00).

| Time | Evidence |
| --- | --- |
| September 15, 11:54:41 | PR #14 merged `f6313a2` and its review follow-up `f7aa855` as `4a81973`. The merge tree exactly matches `f7aa855`; the planned UI entered main intact. |
| September 15, 11:55:06 | The local `arch-review` reflog records creation from `4e52aa1`, the pre-PR-14 main revision. Architecture phase documents also explicitly use that older baseline. |
| September 17, 10:32:00 | Local main's reflog records the pull that advanced it to `4a81973`. The architecture work had already been developed against its recorded older baseline. |
| September 17, 11:36:55 | `ad8cded` combines parents `fb63e63` and `4a81973`. The reflog explicitly says `Merge made by the 'ours' strategy.` Its result tree exactly matches `fb63e63`. |
| September 17, 11:41:23 | GitHub records the PR #15 verification check as successful. It checked the resulting architecture implementation and its tests. |
| September 17, 11:42:25 | [PR #15](https://github.com/interfaceconjurer/unified-front-door/pull/15) merged as `d34da16`, whose tree is again identical to `ad8cded` and `fb63e63`. The omitted incoming content was not restored by this merge. |

The PR #15 description states that older planning screens were deliberately not
reintroduced. Its merge message also says “as requested.” Those records support
an intentional integration choice. The contemporaneous
[release task](</home/omarchy/Hive/AI Work/tasks/unified-front-door-heroku-release.md>)
records Jordan's approval to deploy/merge the current prototype and explicitly
records retaining that result during reconciliation. The
[profile/chat recovery task](</home/omarchy/Hive/AI Work/tasks/unified-front-door-profile-session-recovery.md>)
also records release approval. Those summaries do not establish that every
omitted UI behavior was individually disclosed and approved. GitHub returned no
PR #15 review records or issue comments. PR #14 had a review and recorded local
tests, but no recorded status checks. Absence of a GitHub review record does not
prove there was no discussion elsewhere.

## Why existing checks did not establish retention

An exact content comparison across the 58 paths changed by PR #14 found that
`d34da16` had 25 paths matching the pre-fork revision, zero matching PR #14's
version, and 33 differing from both. These are file-content counts, not a count
of features removed: the architecture work legitimately changed many paths.

Four changed test files also matched their pre-fork versions again:
`auth.test.mjs`, `conversation.test.mjs`, `surface-canvas.test.mjs`, and
`workspace.test.mjs`. `onboarding.test.mjs` differed from both versions. The
incoming implementation and some of its assertions were omitted together;
passing the resulting branch's suite could not prove those earlier behaviors
were retained. Each changed or removed check needs a feature disposition, not
an assumption that an older test must always remain unchanged.

The architecture documents' explicit `4e52aa1` baseline, the unchanged-result
merge, and the missing comparison of incoming product behaviors explain the
gap. The useful durable architecture validation was not a substitute for
integration acceptance against the newer main UI.

Remote enforcement was also absent when inspected on September 20: GitHub's main
branch protection endpoint returned 404, “Branch not protected,” and the active
branch-rules endpoint returned an empty array. This is a present-state finding,
not proof of repository settings at the time of PR #15.

## Prevention implemented locally

- [Agent instructions](../AGENTS.md) require fetching and recording current main,
  prohibit `git merge -s ours` for divergent product integration, and require a
  final content/test review. Each affected behavior must be retained, adapted
  with a replacement check, or removed with explicit user approval. Architecture
  approval does not imply approval to remove product behavior.
- [The merge-integrity check](../scripts/check-merge-integrity.mjs) rejects newly
  introduced merges whose tree exactly matches the first parent while absorbing
  changed incoming content. Incoming history with no net tree change against its
  shared base, such as an empty checkpoint, is allowed. Full history and exact comparison
  revisions are required. It catches this incident's mechanism, not arbitrary
  semantic regressions or every possible misuse of merge strategies.
- [The workflow](../.github/workflows/deploy-heroku.yml) makes verification and
  deployment depend on that check. Manual dispatch requires an explicit prior
  base and rejects an identical or nonancestor revision. The operator still
  supplies the claimed previously verified base; ancestry checking cannot prove
  that it was previously verified.
- [The browser runner](../scripts/browser/run.mjs) now includes nine additional
  restored-behavior suites, for 22 registered suites total. The
  [verification behavior map](verification.md) connects restored behavior to the
  checks the release runner actually invokes.

## Verification and remaining limits

Independent review passed the final six temporary-repository merge-integrity tests,
including the no-net-incoming-change case.
The check also rejects the real `4a81973..d34da16` range and identifies `ad8cded`;
the accepted current baseline `d34da16..HEAD` passes. Review closed a manual-run
bypass by requiring a meaningful explicit comparison base. The final workflow
and 22-suite registration received source review.

The coordinator also executed the workflow's actual YAML shell step in six
cases: historical bad PR blocked; previously accepted bad ancestry excluded from
a new range; manual same-revision and nonancestor bases rejected; a normal merge
allowed; and a manual range introducing the historical bad merge blocked.
Scoped ESLint and whitespace checks pass. A final read-only GitHub check still
reported main at `d34da16`.

The expanded full browser/release gate has **not** been rerun as one complete
gate for this prevention change. Earlier restoration checks remain recorded in
their own ledger; registering them is not a new execution result. These changes
are being published on `org-exploration` and remain undeployed. No remote branch protection or ruleset
has been enabled. Once published, workflow dependencies can block deployment,
but without server-side protection they do not prevent unchecked direct pushes.

Rollout is to review and merge the branch, then require the
`merge-integrity` and `verify` checks for main, require current-base integration,
and prevent direct-push or bypass paths. Those repository settings are not
enabled by this local change. The manual release base must come from an actually
verified revision; [operations guidance](operations.md) documents that operator
responsibility.

Reproduce the core local evidence with:

```sh
git show -s --format='%h %T %P %ad %s' --date=iso-strict 4a81973 fb63e63 ad8cded d34da16
git reflog show arch-review --date=iso-strict
git diff 4a81973 d34da16 -- src scripts
node scripts/check-merge-integrity.mjs --base 4a81973 --head d34da16
```
