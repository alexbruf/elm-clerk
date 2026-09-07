import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachClerk } from '../src/index.js';
import {
  configureNextClerk,
  lastClerk,
  makeOrganization,
  makeSession,
  makeUser,
  resetFakeClerk,
  type FakeClerk,
  type FakeResources,
} from './fakeClerk.js';
import { makeElmApp, makePortlessApp, type FakeElmApp } from './fakeElmApp.js';
import { OUTGOING_TAGS, serializeState, type OutgoingTag } from '../src/protocol.js';

vi.mock('@clerk/clerk-js', async () => {
  const module = await import('./fakeClerk.js');
  return { Clerk: module.FakeClerk };
});

/** Stand-in for the constructor `window.__internal_ClerkUICtor` would hold. */
class FakeClerkUI {}
const loadUiFromCdn = vi.fn(async (_key: string): Promise<unknown> => FakeClerkUI);

vi.mock('../src/ui.js', async () => {
  const actual = await vi.importActual<typeof import('../src/ui.js')>('../src/ui.js');
  return { ...actual, loadUiFromCdn: (key: string) => loadUiFromCdn(key) };
});

const unhandled: unknown[] = [];
const onUnhandled = (event: PromiseRejectionEvent): void => {
  unhandled.push(event.reason);
};

beforeEach(() => {
  resetFakeClerk();
  unhandled.length = 0;
  document.body.innerHTML = '';
  globalThis.addEventListener('unhandledrejection', onUnhandled as EventListener);
});

afterEach(() => {
  globalThis.removeEventListener('unhandledrejection', onUnhandled as EventListener);
});

async function attach(
  resources: FakeResources = {},
  portNames?: { out?: string; in?: string },
): Promise<{ app: FakeElmApp; clerk: FakeClerk }> {
  configureNextClerk(resources);
  const app = makeElmApp(portNames);
  await attachClerk(app as never, {
    publishableKey: 'pk_test_123',
    ...(portNames ? { ports: portNames } : {}),
  });
  return { app, clerk: lastClerk() };
}

/** Lets queued promise callbacks (the async handlers) run. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function div(id: string): HTMLDivElement {
  const element = document.createElement('div');
  element.id = id;
  document.body.appendChild(element);
  return element;
}

describe('attachClerk boot', () => {
  it('constructs Clerk with the publishable key and forwards clerkOptions to load', async () => {
    configureNextClerk({});
    const app = makeElmApp();
    await attachClerk(app as never, {
      publishableKey: 'pk_test_abc',
      clerkOptions: { signInUrl: '/sign-in' } as never,
    });
    const clerk = lastClerk();
    expect(clerk.publishableKey).toBe('pk_test_abc');
    expect(clerk.loadOptions).toEqual({ signInUrl: '/sign-in', ui: { ClerkUI: FakeClerkUI } });
  });

  it('loads the Clerk UI bundle from the CDN by default and hands it to clerk.load', async () => {
    loadUiFromCdn.mockClear();
    const { clerk } = await attach({});
    expect(loadUiFromCdn).toHaveBeenCalledWith('pk_test_123');
    expect((clerk.loadOptions as { ui?: { ClerkUI?: unknown } }).ui?.ClerkUI).toBe(FakeClerkUI);
    expect(clerk.listenerOptions).toEqual({ skipInitialEmit: true });
  });

  it('skips the UI bundle with ui: "none"', async () => {
    loadUiFromCdn.mockClear();
    configureNextClerk({});
    const app = makeElmApp();
    await attachClerk(app as never, { publishableKey: 'pk_test_123', ui: 'none' });
    expect(loadUiFromCdn).not.toHaveBeenCalled();
    expect(lastClerk().loadOptions).toBeUndefined();
    expect(app.sent).toEqual([{ v: 1, tag: 'stateChanged', state: { status: 'signedOut' } }]);
  });

  it('keeps a ClerkUI the consumer supplied through clerkOptions', async () => {
    loadUiFromCdn.mockClear();
    class OwnUI {}
    configureNextClerk({});
    const app = makeElmApp();
    await attachClerk(app as never, {
      publishableKey: 'pk_test_123',
      clerkOptions: { ui: { ClerkUI: OwnUI } } as never,
    });
    expect(loadUiFromCdn).not.toHaveBeenCalled();
    expect(lastClerk().loadOptions).toEqual({ ui: { ClerkUI: OwnUI } });
  });

  it('sends error and rejects when the UI bundle cannot be loaded', async () => {
    loadUiFromCdn.mockRejectedValueOnce(new Error('offline'));
    configureNextClerk({});
    const app = makeElmApp();
    await expect(attachClerk(app as never, { publishableKey: 'pk_test_123' })).rejects.toThrow(
      'offline',
    );
    expect(app.sent).toEqual([
      { v: 1, tag: 'error', message: 'elm-clerk: loading the Clerk UI bundle failed: offline' },
    ]);
  });

  it('sends a signedOut stateChanged when there is no session', async () => {
    const { app } = await attach({});
    expect(app.sent).toEqual([{ v: 1, tag: 'stateChanged', state: { status: 'signedOut' } }]);
  });

  it('sends a fully populated signedIn stateChanged (serializeState of the resources)', async () => {
    const resources = { session: makeSession(), user: makeUser(), organization: makeOrganization() };
    const { app } = await attach(resources);
    expect(app.sent[0]).toEqual({ v: 1, tag: 'stateChanged', state: serializeState(resources) });
    expect(app.sent[0]).toMatchObject({
      state: { status: 'signedIn', user: { primaryEmailAddress: 'ada@example.com' } },
    });
  });

  it('signs in without an organization', async () => {
    const { app } = await attach({ session: makeSession(), user: makeUser() });
    expect(app.sent[0]).toMatchObject({ tag: 'stateChanged', state: { organization: null } });
  });

  it('sends stateChanged again on every listener emission', async () => {
    const { app, clerk } = await attach({});
    clerk.emit({ session: makeSession(), user: makeUser() });
    clerk.emit({ session: null, user: null });

    const states = app.ofTag('stateChanged').map((message) => message.state.status);
    expect(states).toEqual(['signedOut', 'signedIn', 'signedOut']);
  });

  it('honours custom port names', async () => {
    const { app, clerk } = await attach({}, { out: 'authOut', in: 'authIn' });
    expect(app.sent).toHaveLength(1);
    app.emit({ v: 1, tag: 'openSignIn' });
    expect(clerk.called('openSignIn')).toBeDefined();
  });

  it('rejects when the outgoing port is missing', async () => {
    await expect(
      attachClerk(makePortlessApp(), { publishableKey: 'pk_test' }),
    ).rejects.toThrow(/no subscribable port named "clerkOut"/);
  });

  it('rejects when the incoming port is missing', async () => {
    const app = { ports: { clerkOut: { subscribe: () => {} } } };
    await expect(attachClerk(app, { publishableKey: 'pk_test' })).rejects.toThrow(
      /no sendable port named "clerkIn"/,
    );
  });

  it('rejects when a custom port name is missing', async () => {
    const app = makeElmApp();
    await expect(
      attachClerk(app as never, { publishableKey: 'pk_test', ports: { out: 'nope' } }),
    ).rejects.toThrow(/no subscribable port named "nope"/);
  });

  it('sends error and rejects when clerk.load fails', async () => {
    configureNextClerk({ loadError: new Error('bad key') });
    const app = makeElmApp();
    await expect(attachClerk(app as never, { publishableKey: 'pk_bad' })).rejects.toThrow('bad key');
    expect(app.sent).toEqual([
      { v: 1, tag: 'error', message: 'elm-clerk: clerk.load failed: bad key' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Every outgoing tag must reach the matching ClerkJS method.
// ---------------------------------------------------------------------------

interface RoundTrip {
  /** Runs before the message is dispatched. */
  setup?: (context: { app: FakeElmApp; clerk: FakeClerk }) => void;
  message: Record<string, unknown>;
  method: string;
  assert?: (context: { app: FakeElmApp; clerk: FakeClerk }) => void;
}

const roundTrips: Record<OutgoingTag, RoundTrip> = {
  signOut: { message: { v: 1, tag: 'signOut' }, method: 'signOut' },
  openSignIn: { message: { v: 1, tag: 'openSignIn' }, method: 'openSignIn' },
  openSignUp: { message: { v: 1, tag: 'openSignUp' }, method: 'openSignUp' },
  openUserProfile: { message: { v: 1, tag: 'openUserProfile' }, method: 'openUserProfile' },
  mountSignIn: {
    setup: () => void div('sign-in'),
    message: { v: 1, tag: 'mountSignIn', elementId: 'sign-in' },
    method: 'mountSignIn',
    assert: ({ clerk }) => {
      expect(clerk.called('mountSignIn')?.args[0]).toBe(document.getElementById('sign-in'));
    },
  },
  mountUserButton: {
    setup: () => void div('user-button'),
    message: { v: 1, tag: 'mountUserButton', elementId: 'user-button' },
    method: 'mountUserButton',
    assert: ({ clerk }) => {
      expect(clerk.called('mountUserButton')?.args[0]).toBe(document.getElementById('user-button'));
    },
  },
  unmount: {
    setup: ({ app }) => {
      div('sign-in');
      app.emit({ v: 1, tag: 'mountSignIn', elementId: 'sign-in' });
    },
    message: { v: 1, tag: 'unmount', elementId: 'sign-in' },
    method: 'unmountSignIn',
  },
  requestToken: {
    setup: ({ clerk }) => {
      clerk.session = makeSession();
    },
    message: { v: 1, tag: 'requestToken', requestId: 'r1', template: null },
    method: '',
    assert: ({ app }) => {
      expect(app.ofTag('tokenReceived')[0]).toEqual({
        v: 1,
        tag: 'tokenReceived',
        requestId: 'r1',
        token: 'jwt-token',
      });
    },
  },
  setActiveOrganization: {
    message: { v: 1, tag: 'setActiveOrganization', organizationId: 'org_9' },
    method: 'setActive',
    assert: ({ clerk }) => {
      expect(clerk.called('setActive')?.args[0]).toEqual({ organization: 'org_9' });
    },
  },
};

describe('outgoing tag dispatch', () => {
  it('covers every tag in OUTGOING_TAGS', () => {
    expect(Object.keys(roundTrips).sort()).toEqual([...OUTGOING_TAGS].sort());
  });

  it.each(OUTGOING_TAGS)('routes %s to ClerkJS', async (tag) => {
    const roundTrip = roundTrips[tag];
    const context = await attach({});
    roundTrip.setup?.(context);
    context.app.emit(roundTrip.message);
    await settle();

    if (roundTrip.method) {
      expect(context.clerk.called(roundTrip.method), `${tag} did not call ${roundTrip.method}`).toBeDefined();
    }
    roundTrip.assert?.(context);
    expect(context.app.ofTag('error')).toEqual([]);
  });
});

describe('requestToken', () => {
  it('passes the template through when given', async () => {
    const getToken = vi.fn(async () => 'templated-jwt');
    const { app } = await attach({ session: makeSession({ getToken }), user: makeUser() });

    app.emit({ v: 1, tag: 'requestToken', requestId: 'r2', template: 'supabase' });
    await settle();

    expect(getToken).toHaveBeenCalledWith({ template: 'supabase' });
    expect(app.ofTag('tokenReceived')[0]).toMatchObject({ requestId: 'r2', token: 'templated-jwt' });
  });

  it('omits the options object when the template is null', async () => {
    const getToken = vi.fn(async () => 'plain-jwt');
    const { app } = await attach({ session: makeSession({ getToken }), user: makeUser() });

    app.emit({ v: 1, tag: 'requestToken', requestId: 'r3', template: null });
    await settle();

    expect(getToken).toHaveBeenCalledWith(undefined);
  });

  it('replies tokenFailed when getToken rejects', async () => {
    const getToken = vi.fn(async () => {
      throw new Error('network down');
    });
    const { app } = await attach({ session: makeSession({ getToken }), user: makeUser() });

    app.emit({ v: 1, tag: 'requestToken', requestId: 'r4', template: null });
    await settle();

    expect(app.ofTag('tokenFailed')[0]).toEqual({
      v: 1,
      tag: 'tokenFailed',
      requestId: 'r4',
      reason: 'network down',
    });
    expect(app.ofTag('error')).toEqual([]);
  });

  it('replies tokenFailed when getToken resolves to null', async () => {
    const { app } = await attach({
      session: makeSession({ getToken: async () => null }),
      user: makeUser(),
    });

    app.emit({ v: 1, tag: 'requestToken', requestId: 'r5', template: null });
    await settle();

    expect(app.ofTag('tokenFailed')[0]).toMatchObject({
      requestId: 'r5',
      reason: 'clerk returned no token',
    });
  });

  it('replies tokenFailed when there is no session', async () => {
    const { app } = await attach({});

    app.emit({ v: 1, tag: 'requestToken', requestId: 'r6', template: null });
    await settle();

    expect(app.ofTag('tokenFailed')[0]).toMatchObject({
      requestId: 'r6',
      reason: 'no active session',
    });
  });

  it('keeps concurrent requestIds apart', async () => {
    const { app } = await attach({
      session: makeSession({ getToken: async (options) => `jwt:${options?.template ?? 'default'}` }),
      user: makeUser(),
    });

    app.emit({ v: 1, tag: 'requestToken', requestId: 'a', template: 'one' });
    app.emit({ v: 1, tag: 'requestToken', requestId: 'b', template: 'two' });
    await settle();

    expect(app.ofTag('tokenReceived')).toEqual([
      { v: 1, tag: 'tokenReceived', requestId: 'a', token: 'jwt:one' },
      { v: 1, tag: 'tokenReceived', requestId: 'b', token: 'jwt:two' },
    ]);
  });
});

describe('mounting', () => {
  it('errors when the element does not exist', async () => {
    const { app, clerk } = await attach({});
    app.emit({ v: 1, tag: 'mountSignIn', elementId: 'ghost' });
    await settle();

    expect(app.ofTag('error')[0]?.message).toMatch(/no element with id "ghost"/);
    expect(clerk.called('mountSignIn')).toBeUndefined();
  });

  it('unmounts a user button with unmountUserButton', async () => {
    const { app, clerk } = await attach({});
    div('ub');
    app.emit({ v: 1, tag: 'mountUserButton', elementId: 'ub' });
    app.emit({ v: 1, tag: 'unmount', elementId: 'ub' });
    await settle();

    expect(clerk.called('unmountUserButton')).toBeDefined();
    expect(clerk.called('unmountSignIn')).toBeUndefined();
    expect(app.ofTag('error')).toEqual([]);
  });

  it('errors when unmounting an element that was never mounted', async () => {
    const { app } = await attach({});
    div('never');
    app.emit({ v: 1, tag: 'unmount', elementId: 'never' });
    await settle();

    expect(app.ofTag('error')[0]?.message).toMatch(/nothing is mounted on element "never"/);
  });

  it('errors when unmounting the same element twice', async () => {
    const { app } = await attach({});
    div('twice');
    app.emit({ v: 1, tag: 'mountSignIn', elementId: 'twice' });
    app.emit({ v: 1, tag: 'unmount', elementId: 'twice' });
    app.emit({ v: 1, tag: 'unmount', elementId: 'twice' });
    await settle();

    expect(app.ofTag('error')).toHaveLength(1);
  });
});

describe('failures never reach the Elm runtime', () => {
  it('turns an unknown tag into error', async () => {
    const { app } = await attach({});
    app.emit({ v: 1, tag: 'launchRockets' });
    expect(app.ofTag('error')[0]?.message).toMatch(/unknown tag "launchRockets"/);
  });

  it('turns a wrong protocol version into error', async () => {
    const { app } = await attach({});
    app.emit({ v: 2, tag: 'signOut' });
    expect(app.ofTag('error')[0]?.message).toMatch(/unsupported protocol version 2/);
  });

  it('turns a malformed message into error', async () => {
    const { app } = await attach({});
    app.emit('not a message');
    app.emit(null);
    app.emit({ v: 1, tag: 'mountSignIn' });
    expect(app.ofTag('error')).toHaveLength(3);
  });

  it('turns a synchronously throwing ClerkJS method into error', async () => {
    const { app, clerk } = await attach({});
    clerk.failOn.add('openSignIn');
    app.emit({ v: 1, tag: 'openSignIn' });
    await settle();

    expect(app.ofTag('error')[0]?.message).toMatch(/"openSignIn" failed: openSignIn exploded/);
    expect(unhandled).toEqual([]);
  });

  it('turns a rejecting ClerkJS method into error with no unhandled rejection', async () => {
    const { app, clerk } = await attach({});
    clerk.failOn.add('signOut');
    app.emit({ v: 1, tag: 'signOut' });
    await settle();

    expect(app.ofTag('error')[0]?.message).toMatch(/"signOut" failed: signOut exploded/);
    expect(unhandled).toEqual([]);
  });

  it('turns a rejecting setActive into error', async () => {
    const { app, clerk } = await attach({});
    clerk.failOn.add('setActive');
    app.emit({ v: 1, tag: 'setActiveOrganization', organizationId: 'org_x' });
    await settle();

    expect(app.ofTag('error')[0]?.message).toMatch(/"setActiveOrganization" failed/);
    expect(unhandled).toEqual([]);
  });

  it('swallows a throwing Elm port send', async () => {
    configureNextClerk({});
    const app = makeElmApp();
    app.ports['clerkIn'] = {
      send: () => {
        throw new Error('elm blew up');
      },
    };
    await expect(attachClerk(app as never, { publishableKey: 'pk_test' })).resolves.toBeDefined();
  });
});
