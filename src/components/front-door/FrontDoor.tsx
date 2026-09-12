"use client";

import {
  ChevronRightIcon,
  GitBranchIcon,
  ListCheckIcon,
  PuzzleIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { canAccessSurface } from "@/lib/demo-profiles";
import { surfaceApps, type SurfaceApp } from "./app-catalog";
import { ReturningHome } from "./ReturningHome";
import { DayZeroHome } from "@/components/onboarding/DayZeroHome";
import { SurfaceNav } from "./SurfaceNav";
import styles from "./FrontDoor.module.css";

type Starter = {
  title: string;
  description: string;
  surfaceId: SurfaceApp["id"];
  fallbackSurfaceId?: SurfaceApp["id"];
  Icon: IconComponent;
  prompt: string;
};

const STARTERS: readonly Starter[] = [
  {
    title: "Start your first project",
    description: "Define your goal, set up work items, and plan your first steps.",
    surfaceId: "alm",
    Icon: ListCheckIcon,
    prompt: "Help me start my first project. Walk me through defining its goal, creating and prioritizing work items, and choosing the first task to work on.",
  },
  {
    title: "Build your first agent",
    description: "Give an agent a job to do, connect your data, and try it out.",
    surfaceId: "build",
    Icon: SparklesIcon,
    prompt: "Help me build an agent that qualifies and routes leads. Walk me through defining its instructions, connecting data, and trying it out.",
  },
  {
    title: "Build a React app",
    description: "Create a custom app with React, connected to your Salesforce data.",
    surfaceId: "code",
    fallbackSurfaceId: "build",
    Icon: PuzzleIcon,
    prompt: "Help me build a React app for browsing and searching Salesforce accounts. Walk me through the app structure, connecting Salesforce data, and adding tests.",
  },
  {
    title: "Set up a release pipeline",
    description: "Explore how to take your first change from a sandbox to production.",
    surfaceId: "alm",
    Icon: GitBranchIcon,
    prompt: "Help me set up my first release pipeline. Walk me through connecting a repository, validating changes in a sandbox, and adding a production approval step.",
  },
];

const EXISTING_PROJECT_PROMPT =
  "Help me get started with an existing Salesforce source project. Walk me through connecting my repository and a development org, then exploring the codebase.";

export function isStarterPrompt(value: string): boolean {
  return STARTERS.some((starter) => starter.prompt === value) || value === EXISTING_PROJECT_PROMPT;
}

/** The welcome/assessment content occupies the persistent agent's stream area. */
export function FrontDoor({ onSeedPrompt }: { onSeedPrompt: (prompt: string) => void }) {
  const { profile } = useDemoProfile();
  const availableSurfaces = profile
    ? surfaceApps.filter((surface) => canAccessSurface(profile, surface.id))
    : [];
  const starters = STARTERS.flatMap((starter) => {
    if (availableSurfaces.some((surface) => surface.id === starter.surfaceId)) return [starter];
    if (starter.fallbackSurfaceId && availableSurfaces.some((surface) => surface.id === starter.fallbackSurfaceId)) {
      return [{ ...starter, surfaceId: starter.fallbackSurfaceId }];
    }
    return [];
  });
  const returning = profile?.workspaceExperience === "established";
  const dayZero = profile?.onboarding === "org-assessment";
  const canUseCode = availableSurfaces.some((surface) => surface.id === "code");

  return (
    <main className={`${styles.frontDoor} ${returning ? styles.returning : ""}`} aria-labelledby="front-door-heading">
      <div className={styles.scroll}>
        <div className={styles.content}>
          {dayZero ? <DayZeroHome /> : returning ? <ReturningHome /> : <>
          <header className={styles.hero}>
            <p className={styles.welcome}>
              {profile?.experience === "new" ? "Welcome" : "Welcome back"}, {profile?.firstName}
            </p>
            <h1 id="front-door-heading">What will you build first?</h1>
            <p className={styles.intro}>
              Your tools, your ideas, and an agent to help you bring them to life.
            </p>
          </header>

          <SurfaceNav />

          <section className={styles.starters} aria-labelledby="starters-heading">
            <div className={styles.sectionHeading}>
              <h2 id="starters-heading">A few ways to get started</h2>
              <p>Pick an idea and make it yours.</p>
            </div>
            <ul className={styles.starterGrid}>
              {starters.map((starter) => (
                <li key={starter.title}>
                  <button
                    type="button"
                    className={styles.starterCard}
                    data-surface={starter.surfaceId}
                    onClick={() => onSeedPrompt(starter.prompt)}
                  >
                    <span className={styles.cardTop}>
                      <span className={styles.starterIcon} aria-hidden="true">
                        <starter.Icon width={22} height={22} />
                      </span>
                      <span className={styles.surfaceLabel}>
                        {availableSurfaces.find((surface) => surface.id === starter.surfaceId)?.label}
                      </span>
                    </span>
                    <strong className={styles.starterTitle}>{starter.title}</strong>
                    <span className={styles.starterDescription}>{starter.description}</span>
                    <span className={styles.starterAction}>
                      Try with the agent
                      <ChevronRightIcon width={15} height={15} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {canUseCode && (
            <div className={styles.existingProject}>
              <GitBranchIcon className={styles.existingIcon} width={20} height={20} aria-hidden="true" />
              <div className={styles.existingCopy}>
                <h2>Have a project already?</h2>
                <p>Start with your codebase and get to know what you can do here.</p>
              </div>
              <button type="button" onClick={() => onSeedPrompt(EXISTING_PROJECT_PROMPT)}>
                Bring your project
                <ChevronRightIcon width={15} height={15} aria-hidden="true" />
              </button>
            </div>
          )}
          </>}
        </div>
      </div>

    </main>
  );
}
