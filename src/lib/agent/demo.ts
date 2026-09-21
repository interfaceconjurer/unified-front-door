import type { CapturedContext, RunInput, AgentAdapter, AgentPolicy } from "./contracts";
import { SURFACES, type SurfaceId } from "../workspace/surfaces";
import { ASSESSMENT_STEPS, ASSESSMENT_ORGS, findingsForScope } from "../onboarding/assessment";
import { captureFindings } from "../assessment/model";
import { requestedSurface } from "./navigation-intent";

export const SURFACE_QUESTIONS: Record<SurfaceId, string> = {
  build: "What would you like to build or set up? I can help with your data, automations, agents, or app experiences.",
  code: "What would you like to work on in Code? We can write or review code, build a query, or investigate a failing test.",
  alm: "What would you like to move forward in ALM? We can plan work, review a release, or investigate a deployment.",
  govern: "What would you like to review in Govern & Observe? I can help with access, platform health, or policy controls.",
};
export function projectIntroduction(context: CapturedContext): string {
  if (context.improvement?.source === "brief") return `“${context.projectName}” was created and is ready.\n\nGoal: ${context.improvement.goal}\n\nWhat would you like to work on first?`;
  if (context.improvement) return `“${context.projectName}” is ready for planning.\n\n${context.greeting}\n\nChoose a work item to review its approach and decide the next step.`;
  return `“${context.projectName}” · ${context.branch}\n\n${context.greeting ?? "Your project workspace is ready. Tell me what you’d like to work on first."}`;
}
export function recommendSurface(text: string, context: CapturedContext): SurfaceId | null {
  const requested = requestedSurface(text);
  return requested && context.profile.surfaceAccess.includes(requested) ? requested : null;
}
export function demoReply(input: Extract<RunInput, { kind: "chat" }>): string {
  const { context: c, text, destination } = input, improvement = c.improvement;
  const findings = improvement?.workItems.flatMap(item => item.finding ? [{ item, finding: item.finding }] : []) ?? [];
  const first = findings.find(({ item }) => item.status !== "done");
  if (improvement?.source === "brief") return `Your project goal is: ${improvement.goal}\n\nLet’s choose the smallest useful first step. What should someone be able to do in the first version?`;
  if (improvement) {
    if (/validat|success|test|acceptance/i.test(text)) return findings.map(({ finding }) => `${finding.title}: ${finding.validation}`).join("\n\n");
    if (/plan|steps/i.test(text)) return findings.map(({ finding }) => `${finding.title}\n${finding.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`).join("\n\n");
    return first ? `Start with “${first.item.title}” (${first.item.priority.toLowerCase()} priority). ${first.finding.steps[0] ?? "Original implementation steps were not saved; review the work item before planning new steps."} Open its work item plan to review the remaining steps. This demo tracks the plan; it does not execute org changes.`
      : "All work items are marked complete. Review the acceptance criteria and the sandbox validation evidence before planning a release.";
  }
  if (c.profile.onboarding) return /project/i.test(text)
    ? "Return to the home assessment, select the opportunities you want to address, and choose Shape a project. Review its goal, sandbox, and work item plans, then choose Create project."
    : "The demo assessment reviews usage and limits, automation failures, and release readiness for your selected orgs. Each finding includes sample evidence and an approach to investigate. Review the scope and findings on the home screen.";
  if (destination) return `I’d start this in ${SURFACES[destination].label}. I’ll carry your goal and the context we establish here into that workspace.`;
  if (c.surface === "home") return /plan|steps|approach/i.test(text)
    ? "A starting plan is to confirm the current workflow, choose one useful improvement, and validate it with the people who will use it. Which outcome would make the first version successful? This is a demo planning reply; no work has been created or executed."
    : "Let’s shape this in the conversation. Who is this for, and what problem should the first version solve? This is a demo planning reply; no work has been created or executed.";
  const label = SURFACES[c.surface].label;
  if (!c.hasProjects) return `This is a wireframe response scoped to ${label}. In the full experience I’d help you establish the project context as we begin.`;
  return `This is a wireframe response scoped to ${label}, working in ${c.projectName}${c.worktreeLabel ? ` · ${c.worktreeLabel}` : ""} against ${c.orgLabel ?? "no connected org"}. In the full experience I’d act on this using ${label}’s tools while keeping that context.`;
}
export const demoPolicy: AgentPolicy = {
  recommend: recommendSurface,
  surfaceReply(context, first) { const question = context.surface === "home" ? "How can I help?" : SURFACE_QUESTIONS[context.surface]; return first && context.greeting ? `${context.greeting}\n\n${question}` : question; },
  workReply(work) { return `I’ve opened “${work.title}”. ${work.summary} ${work.attention ? "Let’s review what needs your decision." : "What would you like to do next?"}`; },
};
/** Demo timing and fixture interpretation belong to this replaceable adapter. */
export const demoAdapter: AgentAdapter = {
  async step(input, checkpoint, now) {
    if (input.kind === "chat") {
      const reply = demoReply(input);
      return checkpoint === 0 ? { kind: "progress", checkpoint: 1, text: reply.slice(0, Math.ceil(reply.length / 2)), delayMs: 350 }
        : { kind: "complete", text: reply };
    }
    return checkpoint + 1 < ASSESSMENT_STEPS.length ? { kind: "progress", checkpoint: checkpoint + 1, delayMs: 1400 }
      : { kind: "complete", findings: captureFindings(input.assessmentRunId, findingsForScope(input.orgIds), ASSESSMENT_ORGS, now) };
  },
};

/** Contract-test adapter; never selected by HTTP or environment configuration. */
export function deterministicAdapter(options: { delayMs?: number; fail?: boolean; tool?: { name: string; input: unknown } } = {}): AgentAdapter {
  return { async step(input, checkpoint, now, signal) {
    if (options.delayMs) await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error("Aborted")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, options.delayMs);
      if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    });
    if (options.fail) return { kind: "failed", error: { code: "adapter_failed", message: "The demo adapter could not complete this attempt.", retryable: true, effects: "none" } };
    if (options.tool) return { kind: "tool", ...options.tool };
    return demoAdapter.step(input, checkpoint, now, signal);
  } };
}
