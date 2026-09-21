# History retention audit

September 20, 2026. This follow-up asks whether other work was lost during
integration, beyond the already documented [PR #14 incident](ui-integration-incident.md).
The available-ref, merge, revert, and local-unreachable/reflog review is complete.
No additional instance of the same merge failure was found: `ad8cded` is the only
unchanged-result merge that discards changed incoming content. The other confirmed
rollback is the explicit PR #5 reset. All recoverable local-only commits were
classified without an unexplained feature-loss finding. No product code or
runtime was changed by this audit; refs were refreshed and evidence documented.
The completed [restoration](ui-restoration-state.md) remains intact.

## Scope inspected

- `origin` was fetched successfully. GitHub reports 16 current remote branch
  heads. The checkout has 20 local branches and 39 refs, including `origin/HEAD`,
  a cached PR #7 ref, and the Heroku remote ref.
- All 124 commits reachable from those refs are ancestors of current main
  `d34da16`. This establishes ancestry coverage of available refs, not behavior
  parity. All 28 locally recoverable unreachable commits were also classified
  separately, with reflog/reset and deleted-branch evidence.
- GitHub lists 15 repository PRs, all merged, with no open or closed-unmerged PR.
- All 17 reachable merge commits were compared by parent/result tree, shared
  merge base, and incoming-path changes. An independent reviewer also inspected
  partial-loss candidates rather than relying solely on the new merge guard.
- The scan also checked explicit reverts, repeated nonmerge root trees, and
  large-removal commits. Large removal counts are triage signals, not proof that
  behavior disappeared.

## Reachable merge findings

The 15 PR merge commits have result trees exactly equal to their incoming branch
heads. The only two divergent integration merges are reviewed separately below.
An exact incoming tree at a PR merge proves that merge did not modify the branch
head; it cannot rule out losses in earlier commits within that branch.

| Merge class | Commits | Finding |
| --- | --- | --- |
| PRs #1–3 | `f050a7c`, `c14aa12`, `27b76e8` | Exact incoming branch-head trees. |
| PR #4 | `171fa99` | Exact experiment branch-head tree; deliberately reverted by PR #5. |
| PR #5 | `606eb55` | Exact revert branch-head tree; see the reset finding below. |
| PRs #6–10 | `741d822`, `3cd74b3`, `ae39677`, `bf40c13`, `1b9c825` | Exact incoming branch-head trees. |
| PRs #11–15 | `92e98e9`, `1a28008`, `4e52aa1`, `4a81973`, `d34da16` | Exact incoming branch-head trees. PR #15 carries the earlier `ad8cded` omission; its own merge does not introduce another differing tree. |
| Divergent integration | `ecb6305` | Incoming changes were retained or adapted; no additional discarded incoming-only paths found. |
| Divergent integration | `ad8cded` | Known `ours` incident: all incoming paths resolve to the first-parent tree. |

For `ad8cded`, the incoming side changed 58 paths against the shared base. Of
those, 25 were incoming-only and returned to the unchanged first-parent/base
content; 33 were also changed by the architecture branch and retained its
versions. These are path classifications, not 58 separate lost behaviors. The
whole-root merge guard inspected all 17 reachable merges and reported only
`ad8cded`.

For `ecb6305`, incoming main changed four paths. The `SurfaceProjection`
component/style pair was retained exactly. `AgentPanel.tsx` had already been
rewritten without the duplicate chips removed by incoming main; the merged CSS
removed their leftover styling. The independent source comparison classifies
this as adaptation, rather than another instance of ignoring incoming behavior.

## A separate intentional reset

Commit `feefa6b` explicitly reverts
[PR #4](https://github.com/interfaceconjurer/unified-front-door/pull/4), and its
entire tree exactly matches `27b76e8`, the state before that experiment merged.
[PR #5](https://github.com/interfaceconjurer/unified-front-door/pull/5) documents
broken functionality and an intentional reset. The experiment remains available
on its experiment branch and in history.

The repeated nonmerge-tree scan found only this explicit reset. Other
large-removal candidates correspond to documented refactors, this revert, or the
known architecture integration. Those descriptions and source comparisons do not
establish exhaustive behavior retention, and no automatic restoration of the
reverted experiment is proposed.

## Local-only and unreachable history

| Recoverable commits | Classification | Content evidence |
| --- | --- | --- |
| 17 | Earlier history represented by a squash | Tip `7ccf92e` has the exact full tree of reachable `03c5581`. |
| 9 | Another earlier history represented by a squash | Tip `1d5b1f9` has the exact full tree of reachable `622f1c0`. |
| 1 | Amended commit | `35a1c06` has the exact tree of reachable `2130b5d`, with the same parent and subject. |
| 1 | Deleted experiment-branch merge | `ef0975d` uses the same parents as `ecb6305` in reversed order; their trees differ only by six unused `.scopeChip` reduced-motion CSS lines. The active global reduced-motion handling remains. |

The [contemporaneous commit-grouping task](</home/omarchy/Hive/AI Work/tasks/unified-front-door-architecture-commit-grouping.md>)
records the user-requested deletion of the temporary branch after the PR #4/#5
experiment and reset. The inspected reset reflog entry returns HEAD to the same
SHA, rather than identifying a discarded commit. Root independently confirmed
the empty squash comparisons and the six-line CSS difference. These local
objects provide no additional unexplained, recoverable feature-loss finding.

## Conclusion and limits

The audit found the known `ad8cded` integration failure and a separate documented
PR #5 rollback, not another instance of silently absorbing changed incoming
content into an unchanged tree. The second divergent integration was an inspected
adaptation; local-only history was represented by squashes, an amendment, and the
documented experiment branch. No unmerged current remote branch or repository PR
was discovered that needs to be merged to recover the selected UI work.

This is a Git content/integration audit, not an exhaustive pixel comparison or
behavior regression run of every historical screen. Ordinary commits and partial
rewrites can remove behavior without an unchanged-result merge or a repeated
tree. Deleted remote branches, expired reflogs, pruned objects, and history
unavailable in the current checkout cannot be proven absent. “No additional
finding” within inspected history is narrower than proof that every historical
feature still works.

Reproduce the reachable-history inventory with:

```sh
git for-each-ref --format='%(refname) %(objectname)'
git rev-list --count --all
git rev-list --count origin/main
git log --all --merges --format='%h %P %s'
git show -s --format='%h %T %P %s' ecb6305 ad8cded feefa6b 27b76e8
git show -s --format='%h %T %P %s' 7ccf92e 03c5581 1d5b1f9 622f1c0 35a1c06 2130b5d
git diff ef0975d ecb6305 -- src/components/chat/AgentPanel.module.css
```
