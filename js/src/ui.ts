/**
 * Loads Clerk's prebuilt UI bundle (`@clerk/ui`) from the instance's own
 * Frontend API host, the way Clerk's JavaScript quickstart does for npm users.
 *
 * ClerkJS 6 no longer bundles its UI. `clerk.mountSignIn` and friends need a
 * `ClerkUI` constructor passed to `clerk.load({ ui: { ClerkUI } })`. The npm
 * package `@clerk/ui` provides one but requires React as a peer dependency,
 * which an Elm app does not have, so the shim injects the browser bundle and
 * picks the constructor up from `window.__internal_ClerkUICtor`.
 */

/** Major version of `@clerk/ui` the shim asks the CDN for. */
export const CLERK_UI_MAJOR = 1;

const UI_GLOBAL = '__internal_ClerkUICtor';

const pending = new Map<string, Promise<unknown>>();

/**
 * Decodes the Frontend API host embedded in a publishable key, e.g.
 * `pk_test_ZXhhbXBs...` -> `example-instance-1234.clerk.accounts.dev`.
 * Throws when the key does not look like a Clerk publishable key.
 */
export function frontendApiFromKey(publishableKey: string): string {
  const match = /^pk_(test|live)_([A-Za-z0-9+/=]+)$/.exec(publishableKey ?? '');
  if (!match || !match[2]) {
    throw new Error('publishableKey is not a Clerk publishable key (expected pk_test_... or pk_live_...)');
  }
  let decoded: string;
  try {
    decoded = atob(match[2]);
  } catch {
    throw new Error('publishableKey is not a Clerk publishable key (bad encoding)');
  }
  const host = decoded.replace(/\$$/, '').trim();
  if (!host || /[\s/]/.test(host)) {
    throw new Error('publishableKey does not contain a Frontend API host');
  }
  return host;
}

/** URL of the `@clerk/ui` browser bundle for the instance behind `publishableKey`. */
export function uiBundleUrl(publishableKey: string, major: number = CLERK_UI_MAJOR): string {
  return `https://${frontendApiFromKey(publishableKey)}/npm/@clerk/ui@${major}/dist/ui.browser.js`;
}

/**
 * Injects the UI bundle once and resolves with the `ClerkUI` constructor.
 * Repeated calls for the same URL share one script and one promise.
 */
export function loadUiFromCdn(publishableKey: string, doc: Document = document): Promise<unknown> {
  const url = uiBundleUrl(publishableKey);
  const existing = pending.get(url);
  if (existing) return existing;

  const promise = new Promise<unknown>((resolve, reject) => {
    const win = doc.defaultView as (Window & Record<string, unknown>) | null;
    const already = win?.[UI_GLOBAL];
    if (already) {
      resolve(already);
      return;
    }
    const script = doc.createElement('script');
    script.src = url;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => {
      const ctor = (doc.defaultView as (Window & Record<string, unknown>) | null)?.[UI_GLOBAL];
      if (ctor) resolve(ctor);
      else reject(new Error(`Clerk UI bundle loaded from ${url} but did not define window.${UI_GLOBAL}`));
    });
    script.addEventListener('error', () => {
      reject(new Error(`failed to load the Clerk UI bundle from ${url}`));
    });
    (doc.head ?? doc.documentElement).appendChild(script);
  });

  pending.set(url, promise);
  promise.catch(() => pending.delete(url));
  return promise;
}

/** Test hook: forgets in-flight or completed loads. */
export function resetUiLoader(): void {
  pending.clear();
}
