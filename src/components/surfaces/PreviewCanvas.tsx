"use client";

import { useState } from "react";
import { DatabaseIcon, ExternalLinkIcon, EyeIcon, GitBranchIcon, ChevronRightIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { canvasDestination, destinationHref } from "@/lib/navigation/model";
import { canvasTarget, type CanvasOf } from "@/lib/surface-canvas/model";
import styles from "./PreviewCanvas.module.css";

export function PreviewCanvas({ spec }: { spec: CanvasOf<"preview"> }) {
  const { projects, orgs, target } = useWorkspace();
  const { profile } = useDemoProfile();
  const { openCanvasInProject } = useNavigationActions();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [revision, setRevision] = useState(0);
  const project = projects.find(project => project.id === spec.params.projectId);
  const worktree = project?.worktrees.find(worktree => worktree.id === spec.params.worktreeId);
  const org = orgs.find(org => org.id === spec.params.orgId);
  if (!project || !worktree || !profile) return <p>This preview is no longer available.</p>;
  const href = destinationHref(canvasDestination(profile.id, "build", spec, canvasTarget(spec, target), target));
  const storefront = project.id === "acme-storefront";

  return <article className={styles.preview} aria-label="Project preview">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><EyeIcon width={16} height={16} />Preview<span className={styles.demoBadge}>Demo</span></p>
        <h1>{project.name}</h1>
        <p className={styles.subtitle}>Try the experience from this worktree, with your agent alongside.</p>
      </div>
      {target.projectId === null && <button type="button" className={styles.enterProject}
        aria-label={worktree.isPrimary ? `Open project ${project.name}` : `Open worktree ${worktree.label} in ${project.name}`}
        onClick={() => openCanvasInProject("build", spec)}>
        {worktree.isPrimary ? "Open project" : "Open worktree"}<ChevronRightIcon width={16} height={16} />
      </button>}
    </header>
    <dl className={styles.context}>
      <div><dt>Worktree</dt><dd>{worktree.label}</dd></div>
      <div><dt>Branch</dt><dd><GitBranchIcon width={14} height={14} />{worktree.branch}</dd></div>
      <div><dt>Target org</dt><dd><DatabaseIcon width={14} height={14} />{org?.label ?? "No org selected"}</dd></div>
    </dl>
    <section className={styles.viewer} aria-label="Preview viewer">
      <div className={styles.toolbar}>
        <div role="group" aria-label="Preview viewport" className={styles.devices}>
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Desktop</button>
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</button>
        </div>
        <div className={styles.tools}>
          <button type="button" onClick={() => setRevision(value => value + 1)}>Reset demo</button>
          <a href={href} target="_blank" rel="noreferrer" aria-label="Open preview in new tab" title="Open preview in new tab">
            <ExternalLinkIcon width={16} height={16} /><span>Open in new tab</span>
          </a>
        </div>
      </div>
      <div className={styles.stage}>
        <div className={styles.frame} data-device={device}>
          {storefront ? <StorefrontDemo key={revision} /> : <CrmDemo key={revision} routing={worktree.id === "lead-routing"} />}
        </div>
      </div>
      <p className={styles.caption}>Interactive demo · Sample data · Changes here aren’t saved to your org</p>
    </section>
  </article>;
}

const LEADS = [
  { name: "Avery Morgan", company: "Northstar Labs", initials: "AM", region: "North America", size: "1,200 employees" },
  { name: "Jamie Chen", company: "Summit Financial", initials: "JC", region: "Asia Pacific", size: "480 employees" },
  { name: "Taylor Brooks", company: "Evergreen Studio", initials: "TB", region: "Europe", size: "85 employees" },
];

function CrmDemo({ routing }: { routing: boolean }) {
  const [section, setSection] = useState<"Leads" | "Accounts">("Leads");
  const [selected, setSelected] = useState(0);
  const [routed, setRouted] = useState<number[]>([]);
  const lead = LEADS[selected]!;
  const assigned = routed.includes(selected);
  return <div className={styles.sampleApp}>
    <div className={styles.appBar}><span className={styles.appLogo}>T</span><strong>Trailblazer</strong><span className={styles.appLabel}>Sales workspace</span><span className={styles.avatar}>AM</span></div>
    <nav className={styles.appNav} aria-label="Sample CRM navigation">{(["Leads", "Accounts"] as const).map(tab =>
      <button type="button" key={tab} aria-current={tab === section ? "page" : undefined} onClick={() => setSection(tab)}>{tab}</button>)}</nav>
    <div className={styles.appBody}>
      <p className={styles.appEyebrow}>YOUR SALES WORKSPACE</p>
      <h2>{section === "Leads" ? "Make every connection count." : "A clearer view of your customers."}</h2>
      <p className={styles.appDescription}>{section === "Leads" ? "The right conversation, with the right team." : "Explore the accounts behind your latest conversations."}</p>
      {section === "Leads" ? <>
        <div className={styles.metrics}>
          <div><span>New leads</span><strong>{3 - routed.length}</strong></div>
          <div><span>Routed to a team</span><strong>{routed.length}</strong></div>
          <div><span>Active accounts</span><strong>24</strong></div>
        </div>
        <div className={styles.leadWorkspace}>
          <section className={styles.leadList} aria-label="Sample leads"><h3>New connections <span>3</span></h3>
            {LEADS.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index} onClick={() => setSelected(index)}>
              <span className={styles.person}>{item.initials}</span><span><strong>{item.name}</strong><small>{item.company}</small></span><ChevronRightIcon width={14} height={14} />
            </button>)}
          </section>
          <section className={styles.leadDetail} aria-label="Sample lead details">
            <div className={styles.detailTitle}><span className={styles.person}>{lead.initials}</span><div><h3>{lead.name}</h3><p>{lead.company}</p></div></div>
            <dl><div><dt>Region</dt><dd>{lead.region}</dd></div><div><dt>Company size</dt><dd>{lead.size}</dd></div></dl>
            <div className={styles.routingNote}><strong>{routing ? "Smart lead routing" : "Lead assignment"}</strong><p>{routing ? "Match each lead with a sales team based on region and company size." : "Assign this lead to your regional sales team."}</p></div>
            <button type="button" className={styles.samplePrimary} disabled={assigned} onClick={() => setRouted(previous => [...previous, selected])}>{assigned ? "Assigned to sales" : "Route sample lead"}</button>
            <p className={styles.sampleStatus} role="status">{assigned ? `${lead.name} is ready for follow-up with ${selected === 0 ? "Enterprise sales" : "Regional sales"}.` : ""}</p>
          </section>
        </div>
      </> : <div className={styles.accounts}>{LEADS.map(lead => <div key={lead.company}><span className={styles.person}>{lead.company.slice(0, 1)}</span><h3>{lead.company}</h3><p>{lead.region}</p><small>{lead.size}</small></div>)}</div>}
    </div>
  </div>;
}

function StorefrontDemo() {
  const [cart, setCart] = useState<string[]>([]);
  const [showCart, setShowCart] = useState(false);
  const products = [{ name: "Everyday tote", price: 32, mark: "01" }, { name: "Studio notebook", price: 18, mark: "02" }, { name: "Travel tumbler", price: 28, mark: "03" }];
  return <div className={`${styles.sampleApp} ${styles.storefront}`}>
    <div className={styles.appBar}><span className={styles.appLogo}>a.</span><strong>acme / everyday</strong><button type="button" className={styles.cartButton} aria-pressed={showCart} onClick={() => setShowCart(value => !value)}>Bag ({cart.length})</button></div>
    <div className={styles.appBody}>
      <p className={styles.appEyebrow}>THOUGHTFULLY MADE. EVERY DAY.</p><h2>A little less ordinary.</h2><p className={styles.appDescription}>Considered essentials for wherever the day takes you.</p>
      {showCart ? <section className={styles.bag} aria-label="Sample shopping bag"><h3>Your bag</h3>{cart.length ? <><ul>{cart.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul><button type="button" className={styles.samplePrimary} onClick={() => setCart([])}>Empty bag</button></> : <p>Your bag is empty. Pick something you love.</p>}<button type="button" className={styles.continueShopping} onClick={() => setShowCart(false)}>Continue shopping</button></section>
        : <div className={styles.products}>{products.map(product => <div key={product.name}><div className={styles.productArt} aria-hidden="true"><span>acme</span><strong>{product.mark}</strong></div><h3>{product.name}</h3><p>${product.price}</p><button type="button" onClick={() => setCart(previous => [...previous, product.name])}>Add to bag</button></div>)}</div>}
      <p className={styles.sampleStatus} role="status">{cart.length ? `${cart.length} ${cart.length === 1 ? "item" : "items"} in your sample bag` : ""}</p>
    </div>
  </div>;
}
