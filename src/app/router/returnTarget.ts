const KEY = "tenno.return-to";
export function rememberTarget(path: string) {
  if (path.startsWith("/") && !path.startsWith("//")) sessionStorage.setItem(KEY, path);
}
export function takeTarget(userId: string): string | null {
  const path = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) return null;
  const recipient = url.searchParams.get("pushUser");
  if (recipient && recipient !== userId) return "/notifications";
  url.searchParams.delete("pushUser");
  return url.pathname + url.search + url.hash;
}
