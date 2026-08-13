import * as React from "react"

/**
 * Must match Tailwind's `lg` screen (see tailwind.config.ts, which uses
 * Tailwind's default 1024px). Every layout in this app switches between
 * its mobile and desktop rendering at `lg:`, so this hook has to agree -
 * a mismatched breakpoint here previously left components like
 * CampaignDetails treating 768-1023px viewports as desktop while the
 * rest of the app, including auth, already renders them as mobile.
 */
const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
