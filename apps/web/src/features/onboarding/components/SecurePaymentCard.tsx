import type { ReactNode } from "react";
import { PaymentTrustBar } from "./Checkout";
import styles from "./steps/CheckoutMobile.module.css";

export function SecurePaymentCard({ children }: { children: ReactNode }) {
  return <section className={styles.paymentCard} aria-labelledby="payment-heading">
    <h2 className={`${styles.mobile} ${styles.paymentTitle}`}>Payment details</h2>
    <div className={styles.trust}><PaymentTrustBar /></div>
    {children}
  </section>;
}
