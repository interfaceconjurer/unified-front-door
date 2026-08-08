"use client";

/**
 * The project **metadata explorer** — a project canvas's persistent left rail.
 *
 * It's the project's own navigation, kept deliberately separate from the ALM
 * sub-nav. "Project home" is pinned at the top (the home — the dashboard, with
 * the ALM sections as drill-downs). Below it are the contextual metadata that
 * hangs off the project, grouped into Plans / Resources / Files. Selecting any
 * leaf takes over the content area beside the rail; selecting Project home
 * brings the dashboard back.
 *
 * Presentational and self-contained: it takes the three groups + the current
 * selection + an onSelect callback. Files are keyed by a path derived as the
 * tree renders, so the open file is matched back to the tree and highlighted.
 * All content is mock (see project-metadata).
 */
import { useState } from "react";
import {
  ChevronRightIcon,
  ClipboardIcon,
  CloseIcon,
  DatabaseIcon,
  FileIcon,
  FolderIcon,
  HomeIcon,
  LinkIcon,
  type IconComponent,
} from "@/components/icons";
import type { Tone } from "./canvas-kit";
import {
  fileLines,
  languageOf,
  planBlocks,
  resourceKindLabel,
  type FileNode,
  type OrgResource,
  type PlanDoc,
  type ResourceKind,
} from "./project-metadata";
import styles from "./metadata-explorer.module.css";

/** What's open in the content area beside the explorer. `overview` is the home;
 *  the rest are leaves opened from the rail (or, for files, a deep link). */
export type Selection =
  | { kind: "overview" }
  | { kind: "file"; path: string }
  | { kind: "plan"; plan: PlanDoc }
  | { kind: "resource"; resource: OrgResource };

export function MetadataExplorer({
  tree,
  plans,
  resources,
  selection,
  onSelect,
}: {
  tree: FileNode[];
  plans: PlanDoc[];
  resources: OrgResource[];
  selection: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const openPath = selection.kind === "file" ? selection.path : null;
  const openFile = (path: string) => onSelect({ kind: "file", path });

  return (
    <nav className={styles.explorer} aria-label="Project explorer">
      {/* Project home — the pinned home tab. */}
      <button
        type="button"
        className={styles.home}
        data-active={selection.kind === "overview" || undefined}
        aria-current={selection.kind === "overview" ? "page" : undefined}
        onClick={() => onSelect({ kind: "overview" })}
      >
        <span className={styles.rowIcon} aria-hidden="true">
          <HomeIcon width={16} height={16} />
        </span>
        <span className={styles.rowLabel}>Project home</span>
      </button>

      {/* Plans — attached plan documents. */}
      {plans.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Plans</h2>
          <ul className={styles.list}>
            {plans.map((plan) => {
              const active = selection.kind === "plan" && selection.plan.id === plan.id;
              return (
                <li key={plan.id}>
                  <LeafRow
                    Icon={ClipboardIcon}
                    label={plan.name}
                    tone={plan.tone}
                    active={active}
                    onClick={() => onSelect({ kind: "plan", plan })}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Resources — org-level context. */}
      {resources.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Resources</h2>
          <ul className={styles.list}>
            {resources.map((resource) => {
              const active =
                selection.kind === "resource" && selection.resource.id === resource.id;
              return (
                <li key={resource.id}>
                  <LeafRow
                    Icon={glyphForKind(resource.kind)}
                    label={resource.name}
                    tone={resource.tone}
                    active={active}
                    onClick={() => onSelect({ kind: "resource", resource })}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Files — the code tree, last. Folders start collapsed, so the rail
          opens on just the top-level folders + README; nested files reveal
          on expand. */}
      <section className={styles.section}>
        <h2 className={styles.sectionHead}>Files</h2>
        <ul className={styles.list}>
          {tree.map((node) => (
            <TreeItem
              key={node.name}
              node={node}
              parentPath=""
              openPath={openPath}
              onOpenFile={openFile}
            />
          ))}
        </ul>
      </section>
    </nav>
  );
}

/** A flat, single-line rail row (plans, resources) — icon + label, with an
 *  optional status dot echoing the app's tone system. */
function LeafRow({
  Icon,
  label,
  tone,
  active,
  onClick,
}: {
  Icon: IconComponent;
  label: string;
  tone?: Tone;
  active: boolean;
  onClick: () => void;
}) {
  const showDot = tone != null && tone !== "neutral";
  return (
    <button
      type="button"
      className={styles.row}
      data-active={active || undefined}
      aria-current={active ? "true" : undefined}
      onClick={onClick}
    >
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon width={15} height={15} />
      </span>
      <span className={styles.rowLabel}>{label}</span>
      {showDot && <span className={styles.statusDot} data-tone={tone} aria-hidden="true" />}
    </button>
  );
}

/** One file-tree row — a folder (expandable) or a file (opens on click). */
function TreeItem(props: {
  node: FileNode;
  parentPath: string;
  openPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  if (props.node.type === "folder") {
    return <FolderItem {...props} node={props.node} />;
  }
  const { node, parentPath, openPath, onOpenFile } = props;
  const path = `${parentPath}${node.name}`;
  const active = path === openPath;
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        data-active={active || undefined}
        aria-current={active ? "true" : undefined}
        onClick={() => onOpenFile(path)}
      >
        <span className={styles.toggle} aria-hidden="true" />
        <span className={styles.rowIcon} aria-hidden="true">
          <FileIcon width={15} height={15} />
        </span>
        <span className={styles.rowLabel}>{node.name}</span>
      </button>
    </li>
  );
}

function FolderItem({
  node,
  parentPath,
  openPath,
  onOpenFile,
}: {
  node: Extract<FileNode, { type: "folder" }>;
  parentPath: string;
  openPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  // Collapsed by default: the Files section opens on just the top-level folders
  // (src / config / tests) plus any top-level file (README), and you expand to
  // drill in.
  const [open, setOpen] = useState(false);
  const here = `${parentPath}${node.name}/`;
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.toggle} data-open={open || undefined} aria-hidden="true">
          <ChevronRightIcon width={13} height={13} />
        </span>
        <span className={styles.rowIcon} aria-hidden="true">
          <FolderIcon width={15} height={15} />
        </span>
        <span className={styles.rowLabel}>{node.name}</span>
      </button>
      {open && (
        <ul className={styles.group}>
          {node.children.map((child) => (
            <TreeItem
              key={child.name}
              node={child}
              parentPath={here}
              openPath={openPath}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The content area beside the rail when a leaf is open (not the Overview). */
export function ExplorerContent({
  selection,
  onClose,
}: {
  selection: Selection;
  onClose: () => void;
}) {
  switch (selection.kind) {
    case "file":
      return <FilePane path={selection.path} onClose={onClose} />;
    case "plan":
      return <DocPane plan={selection.plan} onClose={onClose} />;
    case "resource":
      return <ResourcePane resource={selection.resource} onClose={onClose} />;
    case "overview":
      return null;
    default: {
      // Exhaustiveness: adding a Selection kind without a case here is a
      // compile error (the value is no longer assignable to never).
      const _exhaustive: never = selection;
      return _exhaustive;
    }
  }
}

/** A pane header: the item's identity + a type label + a Close (back to home). */
function PaneBar({
  Icon,
  dir,
  name,
  type,
  meta,
  onClose,
}: {
  Icon: IconComponent;
  dir?: string;
  name: string;
  type: string;
  meta?: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.paneBar}>
      <span className={styles.paneIcon} aria-hidden="true">
        <Icon width={15} height={15} />
      </span>
      <span className={styles.paneTitle}>
        {dir && <span className={styles.paneDir}>{dir}</span>}
        <span className={styles.paneName}>{name}</span>
      </span>
      <span className={styles.paneType}>{type}</span>
      {meta && <span className={styles.paneMeta}>{meta}</span>}
      <button type="button" className={styles.closeBtn} onClick={onClose}>
        <CloseIcon width={15} height={15} />
        <span>Close</span>
      </button>
    </div>
  );
}

/** A file, shown as a line-numbered faux source body. */
function FilePane({ path, onClose }: { path: string; onClose: () => void }) {
  const lines = fileLines(path);
  const name = path.split("/").pop() ?? path;
  const dir = path.slice(0, path.length - name.length);

  return (
    <div className={styles.pane}>
      <PaneBar
        Icon={FileIcon}
        dir={dir || undefined}
        name={name}
        type={languageOf(path)}
        meta={`${lines.length} lines`}
        onClose={onClose}
      />
      <div className={styles.code}>
        {lines.map((line, i) => (
          <div key={i} className={styles.codeLine}>
            <span className={styles.lineNo} aria-hidden="true">
              {i + 1}
            </span>
            <code className={styles.lineText}>{line || " "}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A plan document, rendered as prose blocks. */
function DocPane({ plan, onClose }: { plan: PlanDoc; onClose: () => void }) {
  const blocks = planBlocks(plan);
  return (
    <div className={styles.pane}>
      <PaneBar Icon={ClipboardIcon} name={plan.name} type="Plan" onClose={onClose} />
      <article className={styles.doc}>
        {blocks.map((b, i) => {
          switch (b.t) {
            case "h1":
              return (
                <h3 key={i} className={styles.docH1}>
                  {b.text}
                </h3>
              );
            case "h2":
              return (
                <h4 key={i} className={styles.docH2}>
                  {b.text}
                </h4>
              );
            case "note":
              return (
                <p key={i} className={styles.docNote}>
                  {b.text}
                </p>
              );
            case "li":
              return (
                <div key={i} className={styles.docLi}>
                  {b.text}
                </div>
              );
            case "p":
              return (
                <p key={i} className={styles.docP}>
                  {b.text}
                </p>
              );
          }
        })}
      </article>
    </div>
  );
}

/** An org-level resource, shown as a small detail card. */
function ResourcePane({ resource, onClose }: { resource: OrgResource; onClose: () => void }) {
  return (
    <div className={styles.pane}>
      <PaneBar
        Icon={glyphForKind(resource.kind)}
        name={resource.name}
        type={resourceKindLabel(resource.kind)}
        onClose={onClose}
      />
      <div className={styles.resource}>
        <dl className={styles.resourceMeta}>
          <div className={styles.resourceField}>
            <dt>Type</dt>
            <dd>{resourceKindLabel(resource.kind)}</dd>
          </div>
          <div className={styles.resourceField}>
            <dt>Location</dt>
            <dd>{resource.detail}</dd>
          </div>
          {resource.note && (
            <div className={styles.resourceField}>
              <dt>Tag</dt>
              <dd>{resource.note}</dd>
            </div>
          )}
        </dl>
        <p className={styles.resourceHint}>
          Wireframe — a resource added to this project&rsquo;s context. In the product this opens
          the connected org or document.
        </p>
        <button type="button" className={styles.resourceOpen}>
          <LinkIcon width={15} height={15} />
          <span>Open resource</span>
        </button>
      </div>
    </div>
  );
}

/** Icon for a resource kind — orgs read as data stores, docs as files, the rest as links. */
function glyphForKind(kind: ResourceKind): IconComponent {
  switch (kind) {
    case "doc":
      return FileIcon;
    case "link":
      return LinkIcon;
    case "org":
    case "sandbox":
      return DatabaseIcon;
  }
}
