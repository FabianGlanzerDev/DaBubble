/** Firebase appends action parameters before the hash; route them before Angular starts. */
export function entryLocation(url: URL): string | null {
  if (url.searchParams.has('mode') || url.searchParams.has('oobCode'))
    return '/#/passwort-reset/neues-passwort' + url.search;
  if (url.hash.startsWith('#/')) return url.pathname === '/' && !url.search ? null : '/' + url.hash;
  if (url.pathname === '/' || url.pathname === '/index.html') return null;
  // Legacy clean links can migrate only if the host actually serves the application.
  const path = url.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  return '/#' + path + url.search + url.hash;
}

export function prepareEntryLocation(browser: Window): void {
  const destination = entryLocation(new URL(browser.location.href));
  if (destination) browser.history.replaceState(browser.history.state, '', destination);
}
