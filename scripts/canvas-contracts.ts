/** Compile-only assertions: adding a canvas must preserve per-kind requirements. */
import type { CanvasSpecInput } from "../src/lib/surface-canvas/model";
// @ts-expect-error App input requires app identity.
const missingApp: CanvasSpecInput = { kind: "app", title: "App", params: { projectId: "p" } };
// @ts-expect-error Work input requires captured project/worktree.
const missingWorkScope: CanvasSpecInput = { kind: "work", title: "Work", params: { workId: "w" } };
// @ts-expect-error Capability input requires a declared surface.
const unknownSurface: CanvasSpecInput = { kind: "capability", title: "Apex", params: { capability: "apex", surface: "other" } };
// @ts-expect-error Project input requires its target identity.
const missingProject: CanvasSpecInput = { kind: "improvement-project", title: "Project", params: {} };
void [missingApp, missingWorkScope, unknownSurface, missingProject];
