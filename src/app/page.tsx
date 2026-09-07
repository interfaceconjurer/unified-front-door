import { AppLauncher } from "@/components/front-door/AppLauncher";
import styles from "@/components/app-shell/AppShell.module.css";

export default function Home() {
  return (
    <div className={styles.orientSurface}>
      <AppLauncher />
      <aside className={styles.recentContext} aria-labelledby="recent-context-heading">
        <div>
          <h2 id="recent-context-heading">Recent context</h2>
          <p>Acme Storefront · SIT Sandbox · main</p>
        </div>
        <span className={styles.recentMetric}>4 flows · 1 worktree</span>
      </aside>
    </div>
  );
}
