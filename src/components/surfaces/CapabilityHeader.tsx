import type { IconComponent } from "@/components/icons";
import styles from "./CapabilityDraftCanvas.module.css";

export function CapabilityHeader({ title, description, Icon }: {
  title: string; description: string; Icon: IconComponent;
}) {
  return <header className={styles.header}>
    <span className={styles.icon} aria-hidden="true"><Icon width={23} height={23} /></span>
    <div><h1>{title}</h1><p>{description}</p></div>
  </header>;
}
