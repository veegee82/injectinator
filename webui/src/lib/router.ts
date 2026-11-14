import { useEffect, useState } from "react";

export type Route = { view: string; params: URLSearchParams };
const parse = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [path, q] = h.split("?");
  return { view: path || "overview", params: new URLSearchParams(q ?? "") };
};
export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => { const f = () => setR(parse()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return r;
}
export const href = (view: string, params?: Record<string, string>) => `#/${view}${params && Object.keys(params).length ? "?" + new URLSearchParams(params) : ""}`;
