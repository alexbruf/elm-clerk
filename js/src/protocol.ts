/**
 * elm-clerk wire protocol v1.
 *
 * Every message in both directions is one JSON object `{ v: 1, tag: "<tag>", ...payload }`.
 * This module is deliberately free of any `@clerk/clerk-js` import: it only describes
 * shapes, so it can be tested and reasoned about without a browser or Clerk instance.
 */

export const PROTOCOL_VERSION = 1;

/** Elm -> JS tags, in the order documented in CLAUDE.md. */
export const OUTGOING_TAGS = [
  'signOut',
  'openSignIn',
  'openSignUp',
  'openUserProfile',
  'mountSignIn',
  'mountUserButton',
  'unmount',
  'requestToken',
  'setActiveOrganization',
] as const;

export type OutgoingTag = (typeof OUTGOING_TAGS)[number];

/** JS -> Elm tags. */
export const INCOMING_TAGS = ['stateChanged', 'tokenReceived', 'tokenFailed', 'error'] as const;

export type IncomingTag = (typeof INCOMING_TAGS)[number];

// ---------------------------------------------------------------------------
// Resource JSON (fields are exactly those listed in coverage.json)
// ---------------------------------------------------------------------------

export interface UserJson {
  id: string;
  /** `user.primaryEmailAddress?.emailAddress`, not the ClerkJS resource object. */
  primaryEmailAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  /** Epoch milliseconds, or null when ClerkJS has no value. */
  createdAt: number | null;
}

export interface SessionJson {
  id: string;
  status: string;
  /** Epoch milliseconds. */
  lastActiveAt: number;
  /** Epoch milliseconds. */
  expireAt: number;
}

export interface OrganizationJson {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string;
}

export interface LoadingState {
  status: 'loading';
}

export interface SignedOutState {
  status: 'signedOut';
}

export interface SignedInState {
  status: 'signedIn';
  session: SessionJson;
  user: UserJson;
  organization: OrganizationJson | null;
}

export type State = LoadingState | SignedOutState | SignedInState;

// ---------------------------------------------------------------------------
// Outgoing messages (Elm -> JS, port `clerkOut`)
// ---------------------------------------------------------------------------

interface Envelope<T extends string> {
  v: typeof PROTOCOL_VERSION;
  tag: T;
}

export type SignOutMessage = Envelope<'signOut'>;
export type OpenSignInMessage = Envelope<'openSignIn'>;
export type OpenSignUpMessage = Envelope<'openSignUp'>;
export type OpenUserProfileMessage = Envelope<'openUserProfile'>;

export interface MountSignInMessage extends Envelope<'mountSignIn'> {
  elementId: string;
}

export interface MountUserButtonMessage extends Envelope<'mountUserButton'> {
  elementId: string;
}

export interface UnmountMessage extends Envelope<'unmount'> {
  elementId: string;
}

export interface RequestTokenMessage extends Envelope<'requestToken'> {
  requestId: string;
  template: string | null;
}

export interface SetActiveOrganizationMessage extends Envelope<'setActiveOrganization'> {
  organizationId: string;
}

export type OutgoingMessage =
  | SignOutMessage
  | OpenSignInMessage
  | OpenSignUpMessage
  | OpenUserProfileMessage
  | MountSignInMessage
  | MountUserButtonMessage
  | UnmountMessage
  | RequestTokenMessage
  | SetActiveOrganizationMessage;

/** Maps each outgoing tag to its message type. */
export type OutgoingMessageByTag = {
  [M in OutgoingMessage as M['tag']]: M;
};

// ---------------------------------------------------------------------------
// Incoming messages (JS -> Elm, port `clerkIn`)
// ---------------------------------------------------------------------------

export interface StateChangedMessage extends Envelope<'stateChanged'> {
  state: State;
}

export interface TokenReceivedMessage extends Envelope<'tokenReceived'> {
  requestId: string;
  token: string;
}

export interface TokenFailedMessage extends Envelope<'tokenFailed'> {
  requestId: string;
  reason: string;
}

export interface ErrorMessage extends Envelope<'error'> {
  message: string;
}

export type IncomingMessage =
  | StateChangedMessage
  | TokenReceivedMessage
  | TokenFailedMessage
  | ErrorMessage;

export function stateChanged(state: State): StateChangedMessage {
  return { v: PROTOCOL_VERSION, tag: 'stateChanged', state };
}

export function tokenReceived(requestId: string, token: string): TokenReceivedMessage {
  return { v: PROTOCOL_VERSION, tag: 'tokenReceived', requestId, token };
}

export function tokenFailed(requestId: string, reason: string): TokenFailedMessage {
  return { v: PROTOCOL_VERSION, tag: 'tokenFailed', requestId, reason };
}

export function error(message: string): ErrorMessage {
  return { v: PROTOCOL_VERSION, tag: 'error', message };
}

// ---------------------------------------------------------------------------
// Serialization of the live ClerkJS resources
// ---------------------------------------------------------------------------

/**
 * The narrow structural slice of the ClerkJS resources this package reads.
 * The real `UserResource` / `SignedInSessionResource` / `OrganizationResource`
 * are assignable to these, so `serializeState(clerk)` type-checks without
 * `protocol.ts` importing `@clerk/clerk-js`.
 */
export interface UserLike {
  id: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  createdAt?: Date | null;
}

export interface SessionLike {
  id: string;
  status: string;
  lastActiveAt: Date;
  expireAt: Date;
}

export interface OrganizationLike {
  id: string;
  name: string;
  slug?: string | null;
  imageUrl: string;
}

export interface ResourcesLike {
  session?: SessionLike | null;
  user?: UserLike | null;
  organization?: OrganizationLike | null;
}

export function serializeUser(user: UserLike): UserJson {
  return {
    id: user.id,
    primaryEmailAddress: user.primaryEmailAddress?.emailAddress ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl,
    createdAt: user.createdAt ? user.createdAt.getTime() : null,
  };
}

export function serializeSession(session: SessionLike): SessionJson {
  return {
    id: session.id,
    status: session.status,
    lastActiveAt: session.lastActiveAt.getTime(),
    expireAt: session.expireAt.getTime(),
  };
}

export function serializeOrganization(organization: OrganizationLike): OrganizationJson {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug ?? null,
    imageUrl: organization.imageUrl,
  };
}

/**
 * `loading` is never produced here: the shim only serializes after `clerk.load()`
 * resolved, so the state is always `signedOut` or `signedIn`.
 */
export function serializeState(resources: ResourcesLike): State {
  const session = resources.session;
  const user = resources.user;
  if (!session || !user) {
    return { status: 'signedOut' };
  }
  return {
    status: 'signedIn',
    session: serializeSession(session),
    user: serializeUser(user),
    organization: resources.organization ? serializeOrganization(resources.organization) : null,
  };
}

// ---------------------------------------------------------------------------
// Parsing values arriving on the outgoing port
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; message: OutgoingMessage }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(reason: string): ParseResult {
  return { ok: false, error: `elm-clerk: ${reason}` };
}

function requireString(
  raw: Record<string, unknown>,
  tag: string,
  field: string,
): string | ParseResult {
  const value = raw[field];
  if (typeof value !== 'string') {
    return fail(`message "${tag}" requires a string "${field}"`);
  }
  return value;
}

/** Validates an unknown value from `app.ports.clerkOut` into a typed message. */
export function parseOutgoing(value: unknown): ParseResult {
  if (!isRecord(value)) {
    return fail(`expected a message object, got ${value === null ? 'null' : typeof value}`);
  }
  if (value['v'] !== PROTOCOL_VERSION) {
    return fail(`unsupported protocol version ${JSON.stringify(value['v'])}, expected ${PROTOCOL_VERSION}`);
  }
  const tag = value['tag'];
  if (typeof tag !== 'string') {
    return fail('message is missing a string "tag"');
  }
  if (!(OUTGOING_TAGS as readonly string[]).includes(tag)) {
    return fail(`unknown tag "${tag}"`);
  }
  const known = tag as OutgoingTag;

  switch (known) {
    case 'signOut':
    case 'openSignIn':
    case 'openSignUp':
    case 'openUserProfile':
      return { ok: true, message: { v: PROTOCOL_VERSION, tag: known } as OutgoingMessage };

    case 'mountSignIn':
    case 'mountUserButton':
    case 'unmount': {
      const elementId = requireString(value, known, 'elementId');
      if (typeof elementId !== 'string') return elementId;
      return {
        ok: true,
        message: { v: PROTOCOL_VERSION, tag: known, elementId } as OutgoingMessage,
      };
    }

    case 'requestToken': {
      const requestId = requireString(value, known, 'requestId');
      if (typeof requestId !== 'string') return requestId;
      const template = value['template'];
      if (template !== null && template !== undefined && typeof template !== 'string') {
        return fail('message "requestToken" requires "template" to be a string or null');
      }
      return {
        ok: true,
        message: { v: PROTOCOL_VERSION, tag: known, requestId, template: template ?? null },
      };
    }

    case 'setActiveOrganization': {
      const organizationId = requireString(value, known, 'organizationId');
      if (typeof organizationId !== 'string') return organizationId;
      return { ok: true, message: { v: PROTOCOL_VERSION, tag: known, organizationId } };
    }
  }
}
