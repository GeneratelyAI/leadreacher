import type { ReactNode } from "react";
import { Info } from "@/components/ui/icons";
import styles from "./ChannelList.module.css";

export type ChannelListRow = {
  id: string;
  name: string;
  icon: ReactNode;
  description: ReactNode;
  control?: ReactNode;
  selection?: { checked: boolean; disabled: boolean; onChange: () => void };
  storySelected?: boolean;
};

export function ChannelList({ rows, footer, notice, busy = false }: {
  rows: ChannelListRow[];
  footer: ReactNode;
  notice?: string;
  busy?: boolean;
}) {
  const hasSelections = rows.some((row) => row.selection);
  return <div className={styles.composition}>
    <div className={styles.card} data-selection-card={hasSelections || undefined} aria-busy={busy}>
      <div className={styles.rows} role="group" aria-label="Campaign channels">
        {rows.map((row) => {
          const contents = <>
            <span className={styles.icon} data-story-object={`channel:${row.id}`} data-story-selected={row.storySelected ?? row.selection?.checked}>{row.icon}</span>
            <strong className={styles.name}>{row.name}</strong>
            <span className={styles.description}>{row.description}</span>
            <span className={styles.control}>{row.selection ? <input type="checkbox" aria-label={row.name} checked={row.selection.checked} disabled={row.selection.disabled} onChange={row.selection.onChange} /> : row.control}</span>
          </>;
          return row.selection
            ? <label key={row.id} data-channel={row.id} data-selected={row.selection.checked} className={styles.row}>{contents}</label>
            : <article key={row.id} data-channel={row.id} className={styles.row}>{contents}</article>;
        })}
      </div>
      <footer className={styles.footer}>{footer}</footer>
    </div>
    {notice ? <p className={styles.notice}><Info aria-hidden />{notice}</p> : null}
  </div>;
}
