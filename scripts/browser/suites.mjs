// One registry for both the full release gate and PR shards.
export const BROWSER_SUITES = Object.freeze([
    'expansion-profiles', 'modal-working', 'profile-reset', 'org-sign-in', 'session-recovery', 'profile-start', 'assessment-startup', 'org-resources', 'org-setup', 'unified-search', 'global-home', 'workspace-tabs', 'today-departure',
    'starter-canvases', 'assessment-canvas', 'project-creation', 'project-create-end-to-end', 'agent-navigation',
    'project-panel', 'project-explorer', 'workspace-changes', 'object-field-changes', 'project-surface-scope', 'alm-app-migration', 'attention-scenarios', 'work-project-entry', 'project-preview', 'canvas-motion', 'surface-switcher', 'chat-layout',
    'interactions', 'agent-regressions', 'session-chat', 'chat-latency', 'streaming', 'budgets', 'faults', 'timestamps', 'idle-suspension',
]);

export function browserSuites(shard) {
    if (shard === undefined) return [...BROWSER_SUITES];
    const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shard);
    if (!match) throw new Error('Use --shard INDEX/COUNT.');
    const [, index, count] = match.map(Number);
    if (index > count || count > BROWSER_SUITES.length) throw new Error('Browser shard must be nonempty and within its count.');
    return BROWSER_SUITES.filter((_, offset) => offset % count === index - 1);
}
