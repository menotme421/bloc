import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Sync initializer avoids a flash of desktop layout on mobile:
  // first render already knows the viewport (client-only value;
  // SSR falls back to undefined, same as before this preset).
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.innerWidth < MOBILE_BREAKPOINT;
  })

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
