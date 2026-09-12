import type { ReactNode } from "react";
import styles from "./steps/CheckoutMobile.module.css";

export type SummaryRow = { key: string; label: ReactNode; value: string };

function Rows({ rows }: { rows: SummaryRow[] }) {
  return <dl className={styles.priceRows}>
    {rows.map((row) => {
      const [amount, interval] = row.value.split(" / ");
      return <div key={row.key}><dt>{row.label}</dt><dd>{/[0-9]/.test(amount) ? <><span className={styles.priceAmount}>{amount}</span>{interval ? ` / ${interval}` : ""}</> : row.value}</dd></div>;
    })}
  </dl>;
}

export function OrderSummaryCard({ loading, products, channels, subtotal }: {
  loading: boolean;
  products: SummaryRow[];
  channels: SummaryRow[];
  subtotal: string;
}) {
  return <aside className={`${styles.summaryCard} ${styles.desktop}`} aria-labelledby="summary-heading">
    <div className={styles.summaryProducts}>
      <h2 id="summary-heading">Order summary</h2>
      {loading ? <p role="status">Loading plan</p> : <Rows rows={products} />}
    </div>
    {channels.length ? <section className={styles.summarySection} aria-labelledby="channel-billing-heading">
      <h3 id="channel-billing-heading">Channel billing</h3>
      <Rows rows={channels} />
    </section> : null}
    <div className={`${styles.summarySection} ${styles.summaryTotal}`}>
      <Rows rows={[{ key: "subtotal", label: "Subtotal", value: subtotal }]} />
      <p className={styles.summaryTax}>Taxes calculated by Stripe at checkout.</p>
    </div>
  </aside>;
}
