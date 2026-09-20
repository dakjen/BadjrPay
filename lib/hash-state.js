// Keep view state in the URL hash so a refresh (or a bookmark) lands on the same screen:
//   #bookkeeping/pnl?year=2026&period=q3   #billing/plans   #invoices/<invoiceId>
export function readHash() {
  if (typeof window === "undefined") return { page: "", sub: "", params: {} };
  const h = window.location.hash.replace(/^#/, "");
  const [path, qs] = h.split("?");
  const [page = "", sub = ""] = path.split("/");
  return { page, sub, params: Object.fromEntries(new URLSearchParams(qs || "")) };
}

export function writeHash(page, sub = "", params = {}) {
  if (typeof window === "undefined") return;
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  const next = `#${page}${sub ? `/${sub}` : ""}${qs ? `?${qs}` : ""}`;
  if (window.location.hash !== next) window.history.replaceState(null, "", next);
}
