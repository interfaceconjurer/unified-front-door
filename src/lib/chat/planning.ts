export type PlanningState = {
  goal: string;
  audience?: string;
  outcome?: string;
  constraints?: string;
  refinements?: string[];
  phase: "goal" | "audience" | "outcome" | "constraints" | "review";
};

export function planningSuggestions(plan?: PlanningState): readonly string[] {
  switch (plan?.phase) {
    case "audience": return ["My internal team", "Our customers", "Draft a first plan"];
    case "outcome": return ["Less manual work", "Faster turnaround", "Fewer errors"];
    case "constraints": return ["Use our existing systems", "No fixed constraints yet", "Draft a first plan"];
    case "review": return ["Break this into tasks", "Refine the goal", "Start a new plan"];
    default: return ["I want to improve a workflow", "I’m exploring a new idea"];
  }
}

function pointOfView(goal: string): string {
  if (/\b(lead|leads|routing|sales)\b/i.test(goal)) {
    return "I’d start with one clear handoff: who owns the work, what information they need, and what should happen next. That gives us a useful workflow to improve and a concrete way to measure it.";
  }
  if (/\b(release|deployment|deploy|pipeline)\b/i.test(goal)) {
    return "I’d map one release path first, make the review and validation steps explicit, and identify where work gets delayed. That will help us choose a focused first improvement.";
  }
  if (/\b(support|cases|service)\b/i.test(goal)) {
    return "I’d focus on one common service journey first: what someone needs, where the current process gets difficult, and what a successful resolution looks like.";
  }
  return "I’d start with the smallest change that makes one group’s workflow better. Agreeing on what success looks like will help us choose the right implementation.";
}

function planOutline(plan: PlanningState): string {
  return `Goal\n${plan.goal}\n\nWho it’s for\n${plan.audience || "Still to confirm."}\n\nWhat success looks like\n${plan.outcome || "Still to confirm."}\n\nConstraints\n${plan.constraints || "Still to confirm."}${plan.refinements?.length ? `\n\nRefinements\n${plan.refinements.map(note => `• ${note}`).join("\n")}` : ""}`;
}

function review(plan: PlanningState): { planning: PlanningState; reply: string } {
  return { planning: { ...plan, phase: "review" }, reply: `Here’s a first working plan.\n\n${planOutline(plan)}\n\nPoint of view\n${pointOfView(plan.goal)}\n\nFirst steps\n1. Map the current workflow and the main pain point with the people involved.\n2. Define the smallest useful change, using the success target and constraints above.\n3. Try it with a representative example and gather feedback.\n4. Compare the result with the target, then agree on the next increment.\n\nWhat would you change, or should we break the first step into tasks?` };
}

/** A guided prototype conversation. Planning data belongs to its chat session. */
export function nextPlanningTurn(current: PlanningState | undefined, text: string): { planning: PlanningState; reply: string } {
  const value = text.trim();
  const command = value.toLowerCase().replace(/[.!?]+$/, "");
  if (command === "start a new plan") {
    return { planning: { goal: "", phase: "goal" }, reply: "Let’s start a new plan. What are you trying to accomplish, and what prompted the idea?" };
  }
  if (current?.goal) {
    if (command === "draft a first plan") return review(current);
    if (command === "refine the goal") {
      return { planning: { ...current, phase: "goal" }, reply: `The current goal is: ${current.goal}\n\nHow would you sharpen or change it?` };
    }
    if (command === "break this into tasks") {
      return { planning: { ...current, phase: "review" }, reply: `Let’s turn the first step into a concrete discovery task.\n\nGoal\n${current.goal}\n\n1. Identify a representative person from ${current.audience || "the intended audience"}.\n2. Walk through one real example of their current workflow and record the friction.\n3. Establish a baseline for the outcome: ${current.outcome || "a success measure we still need to agree on"}.\n4. List the data, systems, and people involved, checking these constraints: ${current.constraints || "still to confirm"}.\n5. Write a short proposal for the smallest useful change and review it with the people involved.\n\nWho should help with that first walkthrough?` };
    }
  }
  if (!current?.goal || current.phase === "goal") {
    const planning: PlanningState = { ...current, goal: value, phase: "audience" };
    if (current?.audience && current.outcome && current.constraints) return review(planning);
    return { planning, reply: `Let’s shape a plan for this.\n\n${pointOfView(value)}\n\nWho is this for, and what is the biggest problem in their current workflow?` };
  }
  if (current.phase === "audience") {
    return { planning: { ...current, audience: value, phase: "outcome" }, reply: `That gives us a starting audience and problem: ${value}\n\nWhat would a successful first version change for them? A concrete measure, such as time saved or fewer errors, will help us make the right tradeoffs.` };
  }
  if (current.phase === "outcome") {
    return { planning: { ...current, outcome: value, phase: "constraints" }, reply: `We’ll use this as the success target: ${value}\n\nWhat constraints should shape the plan? Think about existing systems, available data, team capacity, or a deadline.` };
  }
  if (current.phase === "constraints") return review({ ...current, constraints: value });
  return review({ ...current, refinements: [...(current.refinements ?? []), value] });
}
