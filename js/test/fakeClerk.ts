/**
 * A hand-written stand-in for `@clerk/clerk-js`'s `Clerk` class.
 *
 * Only the surface `src/index.ts` touches is implemented; the shape follows the
 * real 6.31.0 declarations (`dist/types/core/clerk.d.ts`).
 */

export interface FakeUser {
  id: string;
  primaryEmailAddress: { emailAddress: string } | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  createdAt: Date | null;
}

export interface FakeSession {
  id: string;
  status: string;
  lastActiveAt: Date;
  expireAt: Date;
  getToken: (options?: { template?: string }) => Promise<string | null>;
}

export interface FakeOrganization {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string;
}

export interface FakeResources {
  session?: FakeSession | null;
  user?: FakeUser | null;
  organization?: FakeOrganization | null;
}

export interface Call {
  method: string;
  args: unknown[];
}

/** Every FakeClerk built since the last `resetFakeClerk()`. */
export const createdClerks: FakeClerk[] = [];

export interface NextClerkInit extends FakeResources {
  loadError?: Error | null;
}

let nextInit: NextClerkInit = {};

/** Seeds the resources (and optional load failure) of the next constructed FakeClerk. */
export function configureNextClerk(init: NextClerkInit): void {
  nextInit = init;
}

export function resetFakeClerk(): void {
  createdClerks.length = 0;
  nextInit = {};
}

export function lastClerk(): FakeClerk {
  const clerk = createdClerks[createdClerks.length - 1];
  if (!clerk) throw new Error('no FakeClerk was constructed');
  return clerk;
}

export class FakeClerk {
  publishableKey: string;
  session: FakeSession | null = null;
  user: FakeUser | null = null;
  organization: FakeOrganization | null = null;

  /** Recorded `clerk.load()` argument. */
  loadOptions: unknown = undefined;
  /** Set to make `clerk.load()` reject. */
  loadError: Error | null = null;

  /** Every bridged method call, in order. */
  calls: Call[] = [];
  /** Method names that should throw (sync) or reject (async) when called. */
  failOn = new Set<string>();

  listenerOptions: { skipInitialEmit?: boolean } | undefined;
  listeners: Array<(resources: FakeResources) => void> = [];

  constructor(publishableKey: string) {
    this.publishableKey = publishableKey;
    this.session = nextInit.session ?? null;
    this.user = nextInit.user ?? null;
    this.organization = nextInit.organization ?? null;
    this.loadError = nextInit.loadError ?? null;
    nextInit = {};
    createdClerks.push(this);
  }

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args });
    if (this.failOn.has(method)) throw new Error(`${method} exploded`);
  }

  called(method: string): Call | undefined {
    return this.calls.find((call) => call.method === method);
  }

  load = async (options?: unknown): Promise<void> => {
    this.loadOptions = options;
    if (this.loadError) throw this.loadError;
  };

  addListener = (callback: (resources: FakeResources) => void, options?: { skipInitialEmit?: boolean }): (() => void) => {
    this.listenerOptions = options;
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  };

  /** Test helper: apply new resources and notify listeners, like ClerkJS does. */
  emit(resources: FakeResources): void {
    this.session = resources.session ?? null;
    this.user = resources.user ?? null;
    this.organization = resources.organization ?? null;
    for (const listener of [...this.listeners]) listener(resources);
  }

  signOut = async (...args: unknown[]): Promise<void> => {
    this.record('signOut', args);
  };

  openSignIn = (...args: unknown[]): void => {
    this.record('openSignIn', args);
  };

  openSignUp = (...args: unknown[]): void => {
    this.record('openSignUp', args);
  };

  openUserProfile = (...args: unknown[]): void => {
    this.record('openUserProfile', args);
  };

  mountSignIn = (...args: unknown[]): void => {
    this.record('mountSignIn', args);
  };

  unmountSignIn = (...args: unknown[]): void => {
    this.record('unmountSignIn', args);
  };

  mountUserButton = (...args: unknown[]): void => {
    this.record('mountUserButton', args);
  };

  unmountUserButton = (...args: unknown[]): void => {
    this.record('unmountUserButton', args);
  };

  setActive = async (...args: unknown[]): Promise<void> => {
    this.record('setActive', args);
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const CREATED_AT = new Date('2024-01-02T03:04:05.000Z');
export const LAST_ACTIVE_AT = new Date('2026-09-07T10:00:00.000Z');
export const EXPIRE_AT = new Date('2026-09-08T10:00:00.000Z');

export function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: 'user_1',
    primaryEmailAddress: { emailAddress: 'ada@example.com' },
    firstName: 'Ada',
    lastName: 'Lovelace',
    imageUrl: 'https://img.clerk.com/user_1',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<FakeSession> = {}): FakeSession {
  return {
    id: 'sess_1',
    status: 'active',
    lastActiveAt: LAST_ACTIVE_AT,
    expireAt: EXPIRE_AT,
    getToken: async () => 'jwt-token',
    ...overrides,
  };
}

export function makeOrganization(overrides: Partial<FakeOrganization> = {}): FakeOrganization {
  return {
    id: 'org_1',
    name: 'ViewEngine',
    slug: 'viewengine',
    imageUrl: 'https://img.clerk.com/org_1',
    ...overrides,
  };
}
