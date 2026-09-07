import styles from "./AgentWorkstage.module.css";

export function CurrentWorkOutline({ connected }: { connected: boolean }) {
  return (
    <aside className={styles.currentWork} aria-labelledby="current-work-heading">
      <div>
        <p>Current work · Draft</p>
        <h2 id="current-work-heading">Lead qualification · 3 decisions · 2 assumptions</h2>
      </div>
      <div className={styles.currentWorkActions}>
        <button type="button">Review decisions</button>
        <button type="button">Edit assumptions</button>
      </div>
      <span>Planning only · no org changes{connected ? " · Flow action acknowledged" : ""}</span>
    </aside>
  );
}
