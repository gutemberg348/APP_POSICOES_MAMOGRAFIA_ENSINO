import { api } from "./api";

// Only the published website records traffic. No personal data or search terms
// are sent, and failures never interrupt the learning experience.
export function recordSiteVisit(screen: string) {
  if (typeof document === "undefined") return;
  try {
    let visitor = localStorage.getItem("mamografia_visitor");
    if (!visitor) {
      visitor = crypto.randomUUID();
      localStorage.setItem("mamografia_visitor", visitor);
    }
    void api("/analytics/visit", {
      method: "POST",
      body: {
        visitor,
        event_id: crypto.randomUUID(),
        screen,
        device: window.innerWidth < 800 ? "mobile" : "desktop",
      },
    }).catch(() => {});
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
