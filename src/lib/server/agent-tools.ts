import "server-only";
import { record, stableJson } from "../application/contracts";
import type { CapturedContext, RunError, StepOutcome } from "../agent/contracts";

export class ToolError extends Error {
  constructor(readonly detail: RunError) { super(detail.message); }
}
export type ToolAuthority = { namespaceId: string; profileId: string; epoch: string; context: CapturedContext };
export type AgentTool = {
  effect: "read" | "write";
  authorize(input: unknown, authority: ToolAuthority): boolean;
  execute(input: unknown, authority: ToolAuthority, effectId: string, signal: AbortSignal): Promise<StepOutcome>;
  reconcile?: (effectId: string, authority: ToolAuthority) => Promise<StepOutcome | null>;
};
export type ToolRegistry = Readonly<Record<string, AgentTool>>;
export const demoTools: ToolRegistry = Object.freeze({
  "demo.context": {
    effect: "read",
    authorize(input, authority) {
      if (!record(input) || Object.keys(input).length !== 1) return false;
      return stableJson(input.target) === stableJson(authority.context.target) && !!authority.namespaceId && authority.profileId === authority.context.profile.id;
    },
    async execute() { return { kind: "complete", text: "The captured demo context is available. No private service was contacted." }; },
  },
});
export function authorizedTool(registry: ToolRegistry, name: string, input: unknown, authority: ToolAuthority): AgentTool {
  if (!Object.hasOwn(registry, name)) throw new ToolError({ code: "unconfigured", message: "This tool is not configured.", retryable: false, effects: "none" });
  const tool = registry[name]!;
  if (!record(input)) throw new ToolError({ code: "tool_denied", message: "The tool input is not authorized for this captured context.", retryable: false, effects: "none" });
  if (!tool.authorize(input, authority)) throw new ToolError({ code: "tool_denied", message: "The tool is not authorized for this captured context.", retryable: false, effects: "none" });
  return tool;
}
