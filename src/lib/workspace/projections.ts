/**
 * Per-surface projections — the concrete expression of "project = noun, surface =
 * lens." One project, one set of facets; each surface reads a *different* slice of
 * it and frames it for the job that surface exists to do. Build sees the data
 * model and automation; Code sees the whole source tree and worktrees; Govern
 * reads security through the lens of the target org's risk; ALM sees lines of
 * work and a release payload.
 *
 * Pure and React-free: takes the domain model (project + active org) and returns
 * plain data. The surface component maps it to UI, so this stays the single place
 * that decides "what does this lens show." Insights are wireframe-grade narrative
 * derived from the facets — enough to prove the projection idea without a backend.
 */

import type { Org, Project, ProjectFacets, SurfaceId } from "./model";

/** A headline number this lens cares about. `key` also selects the icon in the
 *  UI; `emphasis` marks the facet(s) the lens centers on. */
export type ProjectionMetric = {
  key: "objects" | "flows" | "apex" | "lwc" | "permsets" | "worktrees" | "components";
  label: string;
  value: number;
  emphasis?: boolean;
};

export type ProjectionInsight = {
  key: string;
  title: string;
  detail: string;
  tone: "neutral" | "info" | "caution";
};

export type SurfaceProjection = {
  /** One line: what this lens is showing of the project right now. */
  lead: string;
  metrics: readonly ProjectionMetric[];
  insights: readonly ProjectionInsight[];
};

export function projectionForSurface(
  surfaceId: SurfaceId,
  project: Project,
  org: Org,
): SurfaceProjection {
  const facets = project.facets;
  const worktrees = project.worktrees.length;
  switch (surfaceId) {
    case "build":
      return buildProjection(project, facets);
    case "code":
      return codeProjection(project, facets, worktrees, org);
    case "govern":
      return governProjection(project, facets, org);
    case "alm":
      return almProjection(project, facets, worktrees, org);
  }
}

function buildProjection(project: Project, f: ProjectFacets): SurfaceProjection {
  return {
    lead: `Configuring ${project.name}: its data model, automation, and experiences.`,
    metrics: [
      { key: "objects", label: "Custom objects", value: f.objects, emphasis: true },
      { key: "flows", label: "Automations", value: f.flows, emphasis: true },
      { key: "lwc", label: "Experiences", value: f.lwc },
      { key: "permsets", label: "Permission sets", value: f.permissionSets },
    ],
    insights: [
      {
        key: "model",
        title: `${f.objects} objects define the data model`,
        detail: "Add or refine objects, fields, and relationships from guided builders.",
        tone: "neutral",
      },
      {
        key: "automation",
        title: `${f.flows} automations in this project`,
        detail:
          f.flows > 15
            ? "That's a lot of moving parts — consider consolidating overlapping flows to keep this maintainable."
            : "Extend or adjust process automation without leaving the project.",
        tone: f.flows > 15 ? "caution" : "info",
      },
    ],
  };
}

function codeProjection(
  project: Project,
  f: ProjectFacets,
  worktrees: number,
  org: Org,
): SurfaceProjection {
  return {
    lead: `Everything in ${project.name}: source, tests, and diagnostics across ${worktrees} ${
      worktrees === 1 ? "worktree" : "worktrees"
    }.`,
    metrics: [
      { key: "apex", label: "Apex classes", value: f.apexClasses, emphasis: true },
      { key: "lwc", label: "Lightning components", value: f.lwc, emphasis: true },
      { key: "objects", label: "Objects", value: f.objects },
      { key: "flows", label: "Flows", value: f.flows },
      { key: "worktrees", label: "Worktrees", value: worktrees, emphasis: true },
    ],
    insights: [
      {
        key: "source",
        title: `${f.apexClasses} Apex classes and ${f.lwc} components`,
        detail: "The full source tree is open here — Code is the widest lens on the project.",
        tone: "neutral",
      },
      worktrees > 1
        ? {
            key: "worktrees",
            title: `${worktrees} parallel worktrees`,
            detail:
              "Each worktree is an isolated checkout with its own agent session — switch above to move between them.",
            tone: "info",
          }
        : {
            key: "worktrees",
            title: "Single worktree",
            detail:
              "Add a worktree to run parallel lines of work, each with an independent agent session.",
            tone: "neutral",
          },
      {
        key: "diagnostics",
        title: "Tests and diagnostics",
        detail: `Run the suite and inspect results against ${org.label}.`,
        tone: "neutral",
      },
    ],
  };
}

function governProjection(project: Project, f: ProjectFacets, org: Org): SurfaceProjection {
  const isProd = org.kind === "production";
  return {
    lead: `The security posture and health of ${project.name}, as deployed to ${org.label}.`,
    metrics: [
      { key: "permsets", label: "Permission sets", value: f.permissionSets, emphasis: true },
      { key: "objects", label: "Objects secured", value: f.objects },
      { key: "apex", label: "Apex in review", value: f.apexClasses },
    ],
    insights: [
      isProd
        ? {
            key: "org",
            title: `Pointed at ${org.label}`,
            detail:
              "This is a production org — access changes and deployments affect live users and data. Review carefully before acting.",
            tone: "caution",
          }
        : {
            key: "org",
            title: `Observing ${org.label}`,
            detail: `A ${org.kind} org — a safe place to validate policy and posture before it reaches production.`,
            tone: "info",
          },
      {
        key: "access",
        title: `${f.permissionSets} permission sets govern access`,
        detail: "Audit who can see and do what across this project's objects and features.",
        tone: "neutral",
      },
      {
        key: "health",
        title: "Platform health",
        detail: "Telemetry, governor-limit headroom, and operational signals surface here.",
        tone: "neutral",
      },
    ],
  };
}

function almProjection(
  project: Project,
  f: ProjectFacets,
  worktrees: number,
  org: Org,
): SurfaceProjection {
  const components = f.flows + f.apexClasses + f.lwc;
  return {
    lead: `Carrying ${project.name} from change to release across its lines of work.`,
    metrics: [
      { key: "worktrees", label: "Lines of work", value: worktrees, emphasis: true },
      { key: "components", label: "Deployable components", value: components, emphasis: true },
      { key: "objects", label: "Objects", value: f.objects },
    ],
    insights: [
      worktrees > 1
        ? {
            key: "inflight",
            title: `${worktrees} lines of work in flight`,
            detail:
              "Each worktree maps to a branch and a candidate work item — track them from plan through release.",
            tone: "info",
          }
        : {
            key: "inflight",
            title: "One line of work",
            detail: "A single active worktree — a straightforward path to release.",
            tone: "neutral",
          },
      {
        key: "payload",
        title: `${components} components in the release payload`,
        detail: `Validate and deploy toward ${org.label} through the pipeline.`,
        tone: "neutral",
      },
      {
        key: "health",
        title: "Release health",
        detail: "Deployment status, validation results, and post-release monitoring surface here.",
        tone: "neutral",
      },
    ],
  };
}
