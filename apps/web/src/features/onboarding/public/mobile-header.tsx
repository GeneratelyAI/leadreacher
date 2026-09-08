"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ASSETS } from "@/lib/constants/brand";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import styles from "../components/MobileOnboarding.module.css";

export default function MobileOnboardingHeader() {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <header className={styles.header}>
        <Link href="/" prefetch={false} aria-label="LeadReacher home" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSETS.logoColored} width={154} height={30} alt="" />
        </Link>
        <button ref={helpRef} type="button" onClick={() => setHelpOpen(true)}>
          Help
        </button>
      </header>
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent
          side="bottom"
          className={styles.sheet}
          overlayClassName={styles.sheetBackdrop}
          finalFocus={helpRef}
        >
          <span className={styles.handle} aria-hidden />
          <SheetTitle>Building your first campaign</SheetTitle>
          <SheetDescription>
            Review each decision before continuing. Nothing is sent during
            setup.
          </SheetDescription>
          <div className={styles.helpContent}>
            <h3>Your audience</h3>
            <p>
              Use Edit to add or remove roles, company types, industries, and
              locations.
            </p>
            <h3>Your content</h3>
            <p>
              Choose a video style or upload your own creative. Generated
              previews appear only when a real asset is available.
            </p>
            <h3>Your campaign</h3>
            <p>
              Open the website bar to review your saved decisions. You can
              return to earlier steps without starting over.
            </p>
          </div>
          <SheetClose className={styles.primary}>Got it</SheetClose>
        </SheetContent>
      </Sheet>
    </>
  );
}
