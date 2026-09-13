import styles from "./steps/CheckoutMobile.module.css";

export function StripeLoadingSkeleton({ label = "Loading secure payment form" }: { label?: string }) {
  return <div className={styles.stripeSkeleton} role="status" aria-label={label}>
    <span className={styles.skeletonLabel} />
    <span className={styles.skeletonField} />
    <span className={styles.skeletonLabel} />
    <span className={styles.skeletonField} />
    <span className={styles.skeletonSplit}><i /><i /></span>
    <span className={styles.skeletonButton} />
  </div>;
}
