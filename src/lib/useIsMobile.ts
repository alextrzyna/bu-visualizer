"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 768px)";

export function useIsMobile(): boolean {
  // Always false on the first render so the server and client agree; the
  // effect below flips it to the real value post-hydration. Components
  // that render nothing on desktop (e.g. LightWipe) therefore paint
  // nothing in the server HTML and only appear once we know the
  // viewport, which avoids any hydration mismatch.
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
