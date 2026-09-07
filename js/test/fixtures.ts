/**
 * ClerkJS-shaped inputs (`*Like`) that serialize to `fixtures/full.json` and
 * `fixtures/empty.json` at the repo root. Those JSON files are the shared
 * contract: the Elm tests decode the very same documents.
 */

import type {
  OrganizationLike,
  OrganizationMembershipLike,
  PublicUserDataLike,
  ResourcesLike,
  SessionLike,
  UserLike,
  VerificationLike,
} from '../src/protocol.js';

const T_CREATED = new Date(1757152800000);
const T_ACTIVE = new Date(1757239200000);
const T_EXPIRE = new Date(1757325600000);
const T_ABANDON = new Date(1759917600000);

const verified = (strategy: string, extra: Partial<VerificationLike> = {}): VerificationLike => ({
  status: 'verified',
  strategy,
  expireAt: null,
  error: null,
  message: null,
  nonce: null,
  externalVerificationRedirectURL: null,
  verifiedAtClient: null,
  ...extra,
});

const adaPublicUserData: PublicUserDataLike = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  imageUrl: 'https://img.clerk.com/user_1',
  hasImage: true,
  identifier: 'ada@example.com',
  userId: 'user_1',
  username: 'ada',
  banned: false,
  deprovisioned: false,
};

export const fullOrganization: OrganizationLike = {
  id: 'org_1',
  name: 'ViewEngine',
  slug: 'viewengine',
  imageUrl: 'https://img.clerk.com/org_1',
  hasImage: true,
  membersCount: 12,
  pendingInvitationsCount: 3,
  publicMetadata: { plan: 'team' },
  adminDeleteEnabled: true,
  maxAllowedMemberships: 25,
  selfServeSSOEnabled: false,
  exclusiveMembership: false,
  createdAt: T_CREATED,
  updatedAt: T_ACTIVE,
};

export const fullMembership: OrganizationMembershipLike = {
  id: 'orgmem_1',
  organization: fullOrganization,
  permissions: ['org:sys_profile:manage', 'org:sys_memberships:read'],
  publicMetadata: { seat: 1 },
  publicUserData: adaPublicUserData,
  role: 'org:admin',
  roleName: 'Admin',
  createdAt: T_CREATED,
  updatedAt: T_ACTIVE,
};

export const fullUser: UserLike = {
  id: 'user_1',
  externalId: 'ext_1',
  username: 'ada',
  fullName: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  imageUrl: 'https://img.clerk.com/user_1',
  hasImage: true,
  primaryEmailAddressId: 'idn_email_1',
  primaryEmailAddress: { emailAddress: 'ada@example.com' },
  primaryPhoneNumberId: 'idn_phone_1',
  primaryPhoneNumber: { phoneNumber: '+15555550100' },
  primaryWeb3WalletId: 'idn_wallet_1',
  primaryWeb3Wallet: { web3Wallet: '0xabc123' },
  emailAddresses: [
    {
      id: 'idn_email_1',
      emailAddress: 'ada@example.com',
      verification: verified('email_code', {
        expireAt: new Date(1757239800000),
        verifiedAtClient: 'client_1',
      }),
      matchesSsoConnection: false,
      linkedTo: [{ id: 'idn_oauth_1', type: 'oauth_google' }],
    },
  ],
  phoneNumbers: [
    {
      id: 'idn_phone_1',
      phoneNumber: '+15555550100',
      verification: verified('phone_code'),
      reservedForSecondFactor: true,
      defaultSecondFactor: true,
      linkedTo: [],
      backupCodes: ['code-1', 'code-2'],
    },
  ],
  web3Wallets: [
    {
      id: 'idn_wallet_1',
      web3Wallet: '0xabc123',
      verification: {
        status: 'unverified',
        strategy: 'web3_metamask_signature',
        expireAt: null,
        error: { message: 'signature rejected' },
        message: 'Please sign the message',
        nonce: 'nonce-1',
        externalVerificationRedirectURL: null,
        verifiedAtClient: null,
      },
    },
  ],
  externalAccounts: [
    {
      id: 'eac_1',
      identificationId: 'idn_oauth_1',
      provider: 'google',
      providerUserId: 'google-uid-1',
      emailAddress: 'ada@gmail.com',
      approvedScopes: 'email profile',
      firstName: 'Ada',
      lastName: 'Lovelace',
      imageUrl: 'https://lh3.googleusercontent.com/ada',
      username: 'ada.lovelace',
      phoneNumber: null,
      label: 'personal',
      publicMetadata: { tier: 'gold' },
      verification: verified('oauth_google', {
        externalVerificationRedirectURL: new URL('https://accounts.google.com/o/oauth2/auth?x=1'),
      }),
    },
  ],
  enterpriseAccounts: [
    {
      id: 'ea_1',
      active: true,
      emailAddress: 'ada@acme.com',
      enterpriseConnectionId: 'enc_1',
      enterpriseConnection: {
        id: 'enc_1',
        active: true,
        allowIdpInitiated: false,
        allowSubdomains: true,
        disableAdditionalIdentifications: false,
        domain: 'acme.com',
        logoPublicUrl: 'https://img.clerk.com/acme-logo',
        name: 'Acme SSO',
        protocol: 'saml',
        provider: 'saml_okta',
        syncUserAttributes: true,
        allowOrganizationAccountLinking: false,
        enterpriseConnectionId: 'enc_1',
      },
      firstName: 'Ada',
      lastName: 'Lovelace',
      protocol: 'saml',
      provider: 'saml_okta',
      providerUserId: 'okta-uid-1',
      publicMetadata: { dept: 'eng' },
      verification: verified('saml'),
      lastAuthenticatedAt: T_ACTIVE,
    },
  ],
  passkeys: [
    {
      id: 'pk_1',
      name: 'MacBook Touch ID',
      lastUsedAt: T_ACTIVE,
      verification: verified('passkey'),
    },
  ],
  organizationMemberships: [fullMembership],
  passwordEnabled: true,
  totpEnabled: true,
  backupCodeEnabled: true,
  twoFactorEnabled: true,
  publicMetadata: { role: 'founder' },
  unsafeMetadata: { theme: 'dark' },
  lastSignInAt: T_ACTIVE,
  legalAcceptedAt: T_CREATED,
  createdAt: T_CREATED,
  updatedAt: T_ACTIVE,
};

export const fullSession: SessionLike = {
  id: 'sess_1',
  status: 'active',
  expireAt: T_EXPIRE,
  abandonAt: T_ABANDON,
  lastActiveAt: T_ACTIVE,
  createdAt: T_CREATED,
  updatedAt: T_ACTIVE,
  factorVerificationAge: [5, -1],
  lastActiveOrganizationId: 'org_1',
  actor: { sub: 'user_admin', type: 'admin' },
  tasks: [{ key: 'choose-organization' }],
  currentTask: { key: 'choose-organization' },
  publicUserData: adaPublicUserData,
};

/** Serializes to fixtures/full.json. */
export const fullResources: ResourcesLike = {
  session: fullSession,
  user: fullUser,
  organization: fullOrganization,
};

/**
 * Serializes to fixtures/empty.json. Optional inputs are left `undefined`
 * (not `null`) on purpose, so the serializer's defaults are what's tested.
 */
export const emptyResources: ResourcesLike = {
  session: {
    id: 'sess_2',
    status: 'pending',
    expireAt: T_EXPIRE,
    abandonAt: T_ABANDON,
    lastActiveAt: T_ACTIVE,
    createdAt: T_CREATED,
    updatedAt: T_ACTIVE,
    factorVerificationAge: null,
    tasks: null,
    publicUserData: {
      imageUrl: 'https://img.clerk.com/default',
      hasImage: false,
      identifier: 'user_2',
    },
  },
  user: {
    id: 'user_2',
    imageUrl: 'https://img.clerk.com/default',
    hasImage: false,
    passwordEnabled: false,
    totpEnabled: false,
    backupCodeEnabled: false,
    twoFactorEnabled: false,
  },
  organization: null,
};
