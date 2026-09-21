import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const label = process.argv[2] ?? 'candidate';
if (!/^[a-zA-Z0-9_-]+$/.test(label))
    throw new Error('Use a simple artifact label.');
for (const suite of [
    'modal-working', 'profile-reset', 'assessment-startup', 'org-resources', 'org-setup', 'unified-search', 'global-home',
    'starter-canvases', 'assessment-canvas', 'project-creation', 'project-create-end-to-end', 'agent-navigation',
    'project-panel', 'project-surface-scope', 'alm-app-migration', 'attention-scenarios', 'work-project-entry', 'project-preview', 'canvas-motion', 'surface-switcher', 'chat-layout',
    'interactions', 'agent-regressions', 'session-chat', 'chat-latency', 'streaming', 'budgets', 'faults', 'timestamps',
]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./${suite}.mjs`, import.meta.url)), label], { stdio: 'inherit', env: process.env });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        process.exit(result.status ?? 1);
}
