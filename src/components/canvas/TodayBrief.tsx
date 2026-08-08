import type { ReactElement } from "react";
import {
  ListCheckIcon,
  GitBranchIcon,
  ShieldIcon,
  GridIcon,
  DatabaseIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
import styles from "./TodayBrief.module.css";

/**
 * Dedicated body for the Today canvas: the user's daily brief. Content is mock
 * (wireframe fidelity) — the real thing would be assembled by the agent from
 * across the user's projects.
 */

type BriefItem = { Icon: IconComponent; title: string; meta: string };

const attention: BriefItem[] = [
  { Icon: ListCheckIcon, title: "4 work items awaiting your review", meta: "Acme Onboarding" },
  { Icon: GitBranchIcon, title: "Pipeline Release 26.8 is blocked", meta: "FIT check failed · 2h ago" },
  { Icon: ShieldIcon, title: "2 access approvals pending", meta: "Trust" },
];

const inFlight: BriefItem[] = [
  { Icon: GridIcon, title: "Acme Onboarding", meta: "6 open items · deploying to staging" },
  { Icon: DatabaseIcon, title: "Billing data model", meta: "3 schema changes in review" },
];

function ItemRow({ Icon, title, meta }: BriefItem): ReactElement {
  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon width={18} height={18} />
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowMeta}>{meta}</span>
      </span>
    </li>
  );
}

export function TodayBrief(): ReactElement {
  // Computed live so the brief reads as genuinely "today"; suppressed for
  // hydration since the server and client clocks can differ by a hair.
  const now = new Date();
  const hour = now.getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <article className={styles.brief}>
      <header className={styles.header}>
        <p className={styles.eyebrow} suppressHydrationWarning>
          {dateLabel}
        </p>
        <h1 className={styles.greeting} suppressHydrationWarning>
          Good {partOfDay}, Jordan
        </h1>
        <p className={styles.summary}>
          Here&rsquo;s what needs you across your projects today.
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Needs your attention</h2>
          <span className={styles.count}>{attention.length}</span>
        </div>
        <ul className={styles.rows}>
          {attention.map((item) => (
            <ItemRow key={item.title} {...item} />
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>In flight</h2>
          <span className={styles.count}>{inFlight.length}</span>
        </div>
        <ul className={styles.rows}>
          {inFlight.map((item) => (
            <ItemRow key={item.title} {...item} />
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.agent}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>From your agent</h2>
        </div>
        <div className={styles.agentBody}>
          <span className={styles.agentIcon} aria-hidden="true">
            <SparklesIcon width={20} height={20} />
          </span>
          <div className={styles.agentText}>
            <p className={styles.agentNote}>
              Test coverage in the <strong>Billing</strong>{" "}
              service dropped 6% after yesterday&rsquo;s merge. I can open a canvas
              breaking down the uncovered paths.
            </p>
            <button type="button" className={styles.agentAction}>
              Open coverage canvas
            </button>
          </div>
        </div>
      </section>
    </article>
  );
}
