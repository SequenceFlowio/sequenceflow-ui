const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export function postLoginPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  // The inbox index is often just the page that triggered sign-in. Start a
  // normal session at Overview; keep links to a specific conversation intact.
  const pathname = next.split(/[?#]/, 1)[0];
  return pathname === "/inbox" || pathname === "/inbox/"
    ? DEFAULT_POST_LOGIN_PATH
    : next;
}
