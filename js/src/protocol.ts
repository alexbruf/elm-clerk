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
// Resource JSON
//
// Every interface below lists exactly the fields of the matching entry in
// `coverage.json`, in the same order. The serializers emit every key on every
// object: nullable values become `null`, never `undefined`, so the shape on the
// wire never varies and the Elm decoders can be total.
// ---------------------------------------------------------------------------

/** A metadata bag, passed through untouched; `{}` when ClerkJS has null. */
export type MetadataJson = Record<string, unknown>;

/** Epoch milliseconds. */
export type Millis = number;

export interface VerificationJson {
  status: string | null;
  strategy: string | null;
  expireAt: Millis | null;
  /** `ClerkAPIError.message`, not the whole error object. */
  error: string | null;
  message: string | null;
  nonce: string | null;
  /** `URL.toString()`. */
  externalVerificationRedirectURL: string | null;
  verifiedAtClient: string | null;
}

export interface IdentificationLinkJson {
  id: string;
  /** Elm field `type_`. */
  type: string;
}

export interface PublicUserDataJson {
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  hasImage: boolean;
  identifier: string;
  userId: string | null;
  username: string | null;
  banned: boolean;
  deprovisioned: boolean;
}

export interface ActorJson {
  sub: string;
  /** Elm field `type_`. */
  type: string | null;
}

export interface EmailAddressJson {
  id: string;
  emailAddress: string;
  verification: VerificationJson;
  matchesSsoConnection: boolean;
  linkedTo: IdentificationLinkJson[];
}

export interface PhoneNumberJson {
  id: string;
  phoneNumber: string;
  verification: VerificationJson;
  reservedForSecondFactor: boolean;
  defaultSecondFactor: boolean;
  linkedTo: IdentificationLinkJson[];
  backupCodes: string[];
}

export interface Web3WalletJson {
  id: string;
  web3Wallet: string;
  verification: VerificationJson;
}

export interface ExternalAccountJson {
  id: string;
  identificationId: string;
  provider: string;
  providerUserId: string;
  emailAddress: string;
  approvedScopes: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  username: string | null;
  phoneNumber: string | null;
  label: string | null;
  publicMetadata: MetadataJson;
  verification: VerificationJson | null;
}

/**
 * The connection hanging off an enterprise account
 * (`EnterpriseAccountConnectionResource` in `@clerk/shared`).
 */
export interface EnterpriseConnectionJson {
  /** `ClerkResource.id` is optional, so this can be null. */
  id: string | null;
  active: boolean;
  allowIdpInitiated: boolean;
  allowSubdomains: boolean;
  disableAdditionalIdentifications: boolean;
  domain: string;
  logoPublicUrl: string | null;
  name: string;
  protocol: string;
  provider: string;
  syncUserAttributes: boolean;
  allowOrganizationAccountLinking: boolean;
  enterpriseConnectionId: string | null;
}

export interface EnterpriseAccountJson {
  /** `ClerkResource.id` is optional, so this can be null. */
  id: string | null;
  active: boolean;
  emailAddress: string;
  enterpriseConnectionId: string | null;
  enterpriseConnection: EnterpriseConnectionJson | null;
  firstName: string | null;
  lastName: string | null;
  protocol: string;
  provider: string;
  providerUserId: string | null;
  publicMetadata: MetadataJson;
  verification: VerificationJson | null;
  lastAuthenticatedAt: Millis | null;
}

export interface PasskeyJson {
  id: string;
  name: string | null;
  lastUsedAt: Millis | null;
  /** `verification.publicKey` is browser-only and deliberately not serialized. */
  verification: VerificationJson | null;
}

export interface OrganizationJson {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string;
  hasImage: boolean;
  membersCount: number;
  pendingInvitationsCount: number;
  publicMetadata: MetadataJson;
  adminDeleteEnabled: boolean;
  maxAllowedMemberships: number;
  selfServeSSOEnabled: boolean;
  exclusiveMembership: boolean;
  createdAt: Millis;
  updatedAt: Millis;
}

export interface OrganizationMembershipJson {
  id: string;
  organization: OrganizationJson;
  permissions: string[];
  publicMetadata: MetadataJson;
  publicUserData: PublicUserDataJson | null;
  role: string;
  roleName: string;
  createdAt: Millis;
  updatedAt: Millis;
}

export interface UserJson {
  id: string;
  externalId: string | null;
  username: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  hasImage: boolean;
  primaryEmailAddressId: string | null;
  /** `user.primaryEmailAddress?.emailAddress`, not the ClerkJS resource object. */
  primaryEmailAddress: string | null;
  primaryPhoneNumberId: string | null;
  /** `user.primaryPhoneNumber?.phoneNumber`. */
  primaryPhoneNumber: string | null;
  primaryWeb3WalletId: string | null;
  /** `user.primaryWeb3Wallet?.web3Wallet`. */
  primaryWeb3Wallet: string | null;
  emailAddresses: EmailAddressJson[];
  phoneNumbers: PhoneNumberJson[];
  web3Wallets: Web3WalletJson[];
  externalAccounts: ExternalAccountJson[];
  enterpriseAccounts: EnterpriseAccountJson[];
  passkeys: PasskeyJson[];
  organizationMemberships: OrganizationMembershipJson[];
  passwordEnabled: boolean;
  totpEnabled: boolean;
  backupCodeEnabled: boolean;
  twoFactorEnabled: boolean;
  publicMetadata: MetadataJson;
  unsafeMetadata: MetadataJson;
  lastSignInAt: Millis | null;
  legalAcceptedAt: Millis | null;
  createdAt: Millis | null;
  updatedAt: Millis | null;
}

/** The `[firstFactorAge, secondFactorAge]` tuple, as a record. */
export interface FactorVerificationAgeJson {
  firstFactorAge: number;
  secondFactorAge: number;
}

export interface SessionJson {
  id: string;
  status: string;
  expireAt: Millis;
  abandonAt: Millis;
  lastActiveAt: Millis;
  createdAt: Millis;
  updatedAt: Millis;
  factorVerificationAge: FactorVerificationAgeJson | null;
  lastActiveOrganizationId: string | null;
  actor: ActorJson | null;
  /** Task keys; `[]` when ClerkJS has null. */
  tasks: string[];
  /** The current task's key. */
  currentTask: string | null;
  publicUserData: PublicUserDataJson;
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
// Structural input types
//
// The narrow slice of the ClerkJS resources this package reads. The real
// `UserResource`, `SignedInSessionResource`, `OrganizationResource`, ... are
// assignable to these, so `serializeState(clerk)` type-checks in `index.ts`
// without `protocol.ts` importing `@clerk/clerk-js`. Fields the shim treats as
// nullable are optional here so tests and the fake Clerk can omit them.
// ---------------------------------------------------------------------------

export interface VerificationLike {
  status?: string | null;
  strategy?: string | null;
  expireAt?: Date | null;
  /** `ClerkAPIError`; only `message` is read. */
  error?: { message: string } | null;
  message?: string | null;
  nonce?: string | null;
  /** A `URL`. */
  externalVerificationRedirectURL?: { toString: () => string } | null;
  verifiedAtClient?: string | null;
}

export interface IdentificationLinkLike {
  id: string;
  type: string;
}

export interface PublicUserDataLike {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl: string;
  hasImage: boolean;
  identifier: string;
  userId?: string | null;
  username?: string | null;
  banned?: boolean;
  deprovisioned?: boolean;
}

export interface ActorLike {
  sub: string;
  type?: string | null;
}

export interface SessionTaskLike {
  key: string;
}

export interface EmailAddressLike {
  id: string;
  emailAddress: string;
  verification: VerificationLike;
  matchesSsoConnection: boolean;
  linkedTo?: readonly IdentificationLinkLike[] | null;
}

export interface PhoneNumberLike {
  id: string;
  phoneNumber: string;
  verification: VerificationLike;
  reservedForSecondFactor: boolean;
  defaultSecondFactor: boolean;
  linkedTo?: readonly IdentificationLinkLike[] | null;
  backupCodes?: readonly string[] | null;
}

export interface Web3WalletLike {
  id: string;
  web3Wallet: string;
  verification: VerificationLike;
}

export interface ExternalAccountLike {
  id: string;
  identificationId: string;
  provider: string;
  providerUserId: string;
  emailAddress: string;
  approvedScopes: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  username?: string | null;
  phoneNumber?: string | null;
  label?: string | null;
  publicMetadata?: MetadataJson | null;
  verification?: VerificationLike | null;
}

export interface EnterpriseConnectionLike {
  id?: string | undefined;
  active: boolean;
  allowIdpInitiated: boolean;
  allowSubdomains: boolean;
  disableAdditionalIdentifications: boolean;
  domain: string;
  logoPublicUrl?: string | null;
  name: string;
  protocol: string;
  provider: string;
  syncUserAttributes: boolean;
  allowOrganizationAccountLinking: boolean;
  enterpriseConnectionId?: string | null;
}

export interface EnterpriseAccountLike {
  id?: string | undefined;
  active: boolean;
  emailAddress: string;
  enterpriseConnectionId?: string | null;
  enterpriseConnection?: EnterpriseConnectionLike | null;
  firstName?: string | null;
  lastName?: string | null;
  protocol: string;
  provider: string;
  providerUserId?: string | null;
  publicMetadata?: MetadataJson | null;
  verification?: VerificationLike | null;
  lastAuthenticatedAt?: Date | null;
}

export interface PasskeyLike {
  id: string;
  name?: string | null;
  lastUsedAt?: Date | null;
  verification?: VerificationLike | null;
}

export interface OrganizationLike {
  id: string;
  name: string;
  slug?: string | null;
  imageUrl: string;
  hasImage: boolean;
  membersCount: number;
  pendingInvitationsCount: number;
  publicMetadata?: MetadataJson | null;
  adminDeleteEnabled: boolean;
  maxAllowedMemberships: number;
  selfServeSSOEnabled: boolean;
  exclusiveMembership: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMembershipLike {
  id: string;
  organization: OrganizationLike;
  permissions?: readonly string[] | null;
  publicMetadata?: MetadataJson | null;
  publicUserData?: PublicUserDataLike | null;
  role: string;
  roleName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLike {
  id: string;
  externalId?: string | null;
  username?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl: string;
  hasImage: boolean;
  primaryEmailAddressId?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  primaryPhoneNumberId?: string | null;
  primaryPhoneNumber?: { phoneNumber: string } | null;
  primaryWeb3WalletId?: string | null;
  primaryWeb3Wallet?: { web3Wallet: string } | null;
  emailAddresses?: readonly EmailAddressLike[] | null;
  phoneNumbers?: readonly PhoneNumberLike[] | null;
  web3Wallets?: readonly Web3WalletLike[] | null;
  externalAccounts?: readonly ExternalAccountLike[] | null;
  enterpriseAccounts?: readonly EnterpriseAccountLike[] | null;
  passkeys?: readonly PasskeyLike[] | null;
  organizationMemberships?: readonly OrganizationMembershipLike[] | null;
  passwordEnabled: boolean;
  totpEnabled: boolean;
  backupCodeEnabled: boolean;
  twoFactorEnabled: boolean;
  publicMetadata?: MetadataJson | null;
  unsafeMetadata?: MetadataJson | null;
  lastSignInAt?: Date | null;
  legalAcceptedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface SessionLike {
  id: string;
  status: string;
  expireAt: Date;
  abandonAt: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  factorVerificationAge?: readonly [firstFactorAge: number, secondFactorAge: number] | null;
  lastActiveOrganizationId?: string | null;
  actor?: ActorLike | null;
  tasks?: readonly SessionTaskLike[] | null;
  currentTask?: SessionTaskLike | null;
  publicUserData: PublicUserDataLike;
}

export interface ResourcesLike {
  session?: SessionLike | null;
  user?: UserLike | null;
  organization?: OrganizationLike | null;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** `Date` -> epoch milliseconds, `null` when ClerkJS has no value. */
function millis(date: Date | null | undefined): Millis | null {
  return date ? date.getTime() : null;
}

/** Metadata passes through untouched; `{}` when ClerkJS has null/undefined. */
function metadata(value: MetadataJson | null | undefined): MetadataJson {
  return value ?? {};
}

/** Lists become `[]` when ClerkJS has null/undefined. */
function list<A, B>(values: readonly A[] | null | undefined, serialize: (value: A) => B): B[] {
  return values ? values.map(serialize) : [];
}

export function serializeVerification(verification: VerificationLike): VerificationJson {
  return {
    status: verification.status ?? null,
    strategy: verification.strategy ?? null,
    expireAt: millis(verification.expireAt),
    error: verification.error?.message ?? null,
    message: verification.message ?? null,
    nonce: verification.nonce ?? null,
    externalVerificationRedirectURL: verification.externalVerificationRedirectURL
      ? verification.externalVerificationRedirectURL.toString()
      : null,
    verifiedAtClient: verification.verifiedAtClient ?? null,
  };
}

function serializeOptionalVerification(
  verification: VerificationLike | null | undefined,
): VerificationJson | null {
  return verification ? serializeVerification(verification) : null;
}

export function serializeIdentificationLink(link: IdentificationLinkLike): IdentificationLinkJson {
  return { id: link.id, type: link.type };
}

export function serializePublicUserData(data: PublicUserDataLike): PublicUserDataJson {
  return {
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    imageUrl: data.imageUrl,
    hasImage: data.hasImage,
    identifier: data.identifier,
    userId: data.userId ?? null,
    username: data.username ?? null,
    banned: data.banned ?? false,
    deprovisioned: data.deprovisioned ?? false,
  };
}

export function serializeActor(actor: ActorLike): ActorJson {
  return { sub: actor.sub, type: actor.type ?? null };
}

export function serializeEmailAddress(emailAddress: EmailAddressLike): EmailAddressJson {
  return {
    id: emailAddress.id,
    emailAddress: emailAddress.emailAddress,
    verification: serializeVerification(emailAddress.verification),
    matchesSsoConnection: emailAddress.matchesSsoConnection,
    linkedTo: list(emailAddress.linkedTo, serializeIdentificationLink),
  };
}

export function serializePhoneNumber(phoneNumber: PhoneNumberLike): PhoneNumberJson {
  return {
    id: phoneNumber.id,
    phoneNumber: phoneNumber.phoneNumber,
    verification: serializeVerification(phoneNumber.verification),
    reservedForSecondFactor: phoneNumber.reservedForSecondFactor,
    defaultSecondFactor: phoneNumber.defaultSecondFactor,
    linkedTo: list(phoneNumber.linkedTo, serializeIdentificationLink),
    backupCodes: list(phoneNumber.backupCodes, (code) => code),
  };
}

export function serializeWeb3Wallet(wallet: Web3WalletLike): Web3WalletJson {
  return {
    id: wallet.id,
    web3Wallet: wallet.web3Wallet,
    verification: serializeVerification(wallet.verification),
  };
}

export function serializeExternalAccount(account: ExternalAccountLike): ExternalAccountJson {
  return {
    id: account.id,
    identificationId: account.identificationId,
    provider: account.provider,
    providerUserId: account.providerUserId,
    emailAddress: account.emailAddress,
    approvedScopes: account.approvedScopes,
    firstName: account.firstName,
    lastName: account.lastName,
    imageUrl: account.imageUrl,
    username: account.username ?? null,
    phoneNumber: account.phoneNumber ?? null,
    label: account.label ?? null,
    publicMetadata: metadata(account.publicMetadata),
    verification: serializeOptionalVerification(account.verification),
  };
}

export function serializeEnterpriseConnection(
  connection: EnterpriseConnectionLike,
): EnterpriseConnectionJson {
  return {
    id: connection.id ?? null,
    active: connection.active,
    allowIdpInitiated: connection.allowIdpInitiated,
    allowSubdomains: connection.allowSubdomains,
    disableAdditionalIdentifications: connection.disableAdditionalIdentifications,
    domain: connection.domain,
    logoPublicUrl: connection.logoPublicUrl ?? null,
    name: connection.name,
    protocol: connection.protocol,
    provider: connection.provider,
    syncUserAttributes: connection.syncUserAttributes,
    allowOrganizationAccountLinking: connection.allowOrganizationAccountLinking,
    enterpriseConnectionId: connection.enterpriseConnectionId ?? null,
  };
}

export function serializeEnterpriseAccount(account: EnterpriseAccountLike): EnterpriseAccountJson {
  return {
    id: account.id ?? null,
    active: account.active,
    emailAddress: account.emailAddress,
    enterpriseConnectionId: account.enterpriseConnectionId ?? null,
    enterpriseConnection: account.enterpriseConnection
      ? serializeEnterpriseConnection(account.enterpriseConnection)
      : null,
    firstName: account.firstName ?? null,
    lastName: account.lastName ?? null,
    protocol: account.protocol,
    provider: account.provider,
    providerUserId: account.providerUserId ?? null,
    publicMetadata: metadata(account.publicMetadata),
    verification: serializeOptionalVerification(account.verification),
    lastAuthenticatedAt: millis(account.lastAuthenticatedAt),
  };
}

export function serializePasskey(passkey: PasskeyLike): PasskeyJson {
  return {
    id: passkey.id,
    name: passkey.name ?? null,
    lastUsedAt: millis(passkey.lastUsedAt),
    verification: serializeOptionalVerification(passkey.verification),
  };
}

export function serializeOrganization(organization: OrganizationLike): OrganizationJson {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug ?? null,
    imageUrl: organization.imageUrl,
    hasImage: organization.hasImage,
    membersCount: organization.membersCount,
    pendingInvitationsCount: organization.pendingInvitationsCount,
    publicMetadata: metadata(organization.publicMetadata),
    adminDeleteEnabled: organization.adminDeleteEnabled,
    maxAllowedMemberships: organization.maxAllowedMemberships,
    selfServeSSOEnabled: organization.selfServeSSOEnabled,
    exclusiveMembership: organization.exclusiveMembership,
    createdAt: organization.createdAt.getTime(),
    updatedAt: organization.updatedAt.getTime(),
  };
}

export function serializeOrganizationMembership(
  membership: OrganizationMembershipLike,
): OrganizationMembershipJson {
  return {
    id: membership.id,
    organization: serializeOrganization(membership.organization),
    permissions: list(membership.permissions, (permission) => permission),
    publicMetadata: metadata(membership.publicMetadata),
    publicUserData: membership.publicUserData
      ? serializePublicUserData(membership.publicUserData)
      : null,
    role: membership.role,
    roleName: membership.roleName,
    createdAt: membership.createdAt.getTime(),
    updatedAt: membership.updatedAt.getTime(),
  };
}

export function serializeUser(user: UserLike): UserJson {
  return {
    id: user.id,
    externalId: user.externalId ?? null,
    username: user.username ?? null,
    fullName: user.fullName ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl,
    hasImage: user.hasImage,
    primaryEmailAddressId: user.primaryEmailAddressId ?? null,
    primaryEmailAddress: user.primaryEmailAddress?.emailAddress ?? null,
    primaryPhoneNumberId: user.primaryPhoneNumberId ?? null,
    primaryPhoneNumber: user.primaryPhoneNumber?.phoneNumber ?? null,
    primaryWeb3WalletId: user.primaryWeb3WalletId ?? null,
    primaryWeb3Wallet: user.primaryWeb3Wallet?.web3Wallet ?? null,
    emailAddresses: list(user.emailAddresses, serializeEmailAddress),
    phoneNumbers: list(user.phoneNumbers, serializePhoneNumber),
    web3Wallets: list(user.web3Wallets, serializeWeb3Wallet),
    externalAccounts: list(user.externalAccounts, serializeExternalAccount),
    enterpriseAccounts: list(user.enterpriseAccounts, serializeEnterpriseAccount),
    passkeys: list(user.passkeys, serializePasskey),
    organizationMemberships: list(user.organizationMemberships, serializeOrganizationMembership),
    passwordEnabled: user.passwordEnabled,
    totpEnabled: user.totpEnabled,
    backupCodeEnabled: user.backupCodeEnabled,
    twoFactorEnabled: user.twoFactorEnabled,
    publicMetadata: metadata(user.publicMetadata),
    unsafeMetadata: metadata(user.unsafeMetadata),
    lastSignInAt: millis(user.lastSignInAt),
    legalAcceptedAt: millis(user.legalAcceptedAt),
    createdAt: millis(user.createdAt),
    updatedAt: millis(user.updatedAt),
  };
}

export function serializeSession(session: SessionLike): SessionJson {
  const age = session.factorVerificationAge;
  return {
    id: session.id,
    status: session.status,
    expireAt: session.expireAt.getTime(),
    abandonAt: session.abandonAt.getTime(),
    lastActiveAt: session.lastActiveAt.getTime(),
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    factorVerificationAge: age ? { firstFactorAge: age[0], secondFactorAge: age[1] } : null,
    lastActiveOrganizationId: session.lastActiveOrganizationId ?? null,
    actor: session.actor ? serializeActor(session.actor) : null,
    tasks: list(session.tasks, (task) => task.key),
    currentTask: session.currentTask?.key ?? null,
    publicUserData: serializePublicUserData(session.publicUserData),
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
