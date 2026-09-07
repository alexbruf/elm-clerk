import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CLERK_UI_MAJOR,
  frontendApiFromKey,
  loadUiFromCdn,
  resetUiLoader,
  uiBundleUrl,
} from '../src/ui.js';

// A synthetic key: Clerk publishable keys are `pk_<env>_` + base64(frontendApiHost + '$').
const HOST = 'example-instance-1234.clerk.accounts.dev';
const TEST_KEY = `pk_test_${btoa(`${HOST}$`)}`;
const GLOBAL = '__internal_ClerkUICtor';

const win = window as unknown as Record<string, unknown>;

beforeEach(() => {
  resetUiLoader();
  delete win[GLOBAL];
  document.head.innerHTML = '';
});

afterEach(() => {
  delete win[GLOBAL];
});

function injectedScripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll('script'));
}

describe('frontendApiFromKey', () => {
  it('decodes a test key', () => {
    expect(frontendApiFromKey(TEST_KEY)).toBe(HOST);
  });

  it('decodes a live key', () => {
    expect(frontendApiFromKey(`pk_live_${btoa('clerk.example.com$')}`)).toBe('clerk.example.com');
  });

  it('rejects keys without the pk_ prefix', () => {
    expect(() => frontendApiFromKey('sk_test_abc')).toThrow(/not a Clerk publishable key/);
    expect(() => frontendApiFromKey('')).toThrow(/not a Clerk publishable key/);
  });

  it('rejects keys whose payload is not a host', () => {
    expect(() => frontendApiFromKey(`pk_test_${btoa('not a host/$')}`)).toThrow(/Frontend API host/);
  });
});

describe('uiBundleUrl', () => {
  it('points at the @clerk/ui browser bundle on the Frontend API host', () => {
    expect(uiBundleUrl(TEST_KEY)).toBe(
      `https://${HOST}/npm/@clerk/ui@${CLERK_UI_MAJOR}/dist/ui.browser.js`,
    );
    expect(uiBundleUrl(TEST_KEY, 2)).toBe(`https://${HOST}/npm/@clerk/ui@2/dist/ui.browser.js`);
  });
});

describe('loadUiFromCdn', () => {
  it('injects one script and resolves with the global the bundle defines', async () => {
    const promise = loadUiFromCdn(TEST_KEY);
    const scripts = injectedScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(uiBundleUrl(TEST_KEY));
    expect(scripts[0]?.async).toBe(true);

    const fakeCtor = class FakeUI {};
    win[GLOBAL] = fakeCtor;
    scripts[0]?.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBe(fakeCtor);
  });

  it('shares one script and one promise across concurrent calls', async () => {
    const first = loadUiFromCdn(TEST_KEY);
    const second = loadUiFromCdn(TEST_KEY);
    expect(second).toBe(first);
    expect(injectedScripts()).toHaveLength(1);

    win[GLOBAL] = {};
    injectedScripts()[0]?.dispatchEvent(new Event('load'));
    await first;

    // After success the cached promise is reused; no second script.
    await loadUiFromCdn(TEST_KEY);
    expect(injectedScripts()).toHaveLength(1);
  });

  it('resolves immediately when the global is already present', async () => {
    const existing = {};
    win[GLOBAL] = existing;
    await expect(loadUiFromCdn(TEST_KEY)).resolves.toBe(existing);
    expect(injectedScripts()).toHaveLength(0);
  });

  it('rejects when the script fails to load and allows a retry', async () => {
    const promise = loadUiFromCdn(TEST_KEY);
    injectedScripts()[0]?.dispatchEvent(new Event('error'));
    await expect(promise).rejects.toThrow(/failed to load the Clerk UI bundle/);

    const retry = loadUiFromCdn(TEST_KEY);
    expect(retry).not.toBe(promise);
    expect(injectedScripts()).toHaveLength(2);
  });

  it('rejects when the bundle loads but defines no constructor', async () => {
    const promise = loadUiFromCdn(TEST_KEY);
    injectedScripts()[0]?.dispatchEvent(new Event('load'));
    await expect(promise).rejects.toThrow(/did not define window\.__internal_ClerkUICtor/);
  });

  it('throws synchronously for a malformed key, before touching the DOM', () => {
    expect(() => loadUiFromCdn('garbage')).toThrow(/not a Clerk publishable key/);
    expect(injectedScripts()).toHaveLength(0);
  });
});
