import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  serializeActor,
  serializeEmailAddress,
  serializeEnterpriseAccount,
  serializeEnterpriseConnection,
  serializeExternalAccount,
  serializeIdentificationLink,
  serializeOrganization,
  serializeOrganizationMembership,
  serializePasskey,
  serializePhoneNumber,
  serializePublicUserData,
  serializeSession,
  serializeState,
  serializeUser,
  serializeVerification,
  serializeWeb3Wallet,
} from '../src/protocol.js';
import { emptyResources, fullMembership, fullResources, fullSession, fullUser } from './fixtures.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (rel: string): unknown => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const coverage = readJson('coverage.json') as {
  resources: Record<string, { fields: string[] }>;
};

describe('shared fixtures (fixtures/*.json)', () => {
  it('serializes the full ClerkJS resources to fixtures/full.json exactly', () => {
    expect(serializeState(fullResources)).toEqual(readJson('fixtures/full.json'));
  });

  it('serializes the sparse ClerkJS resources to fixtures/empty.json exactly', () => {
    expect(serializeState(emptyResources)).toEqual(readJson('fixtures/empty.json'));
  });
});

describe('every serialized resource has exactly the coverage.json fields, in order', () => {
  const user = fullUser;
  const email = user.emailAddresses![0]!;
  const phone = user.phoneNumbers![0]!;
  const wallet = user.web3Wallets![0]!;
  const external = user.externalAccounts![0]!;
  const enterprise = user.enterpriseAccounts![0]!;
  const passkey = user.passkeys![0]!;

  const outputs: Record<string, object> = {
    User: serializeUser(user),
    Session: serializeSession(fullSession),
    Organization: serializeOrganization(fullMembership.organization),
    OrganizationMembership: serializeOrganizationMembership(fullMembership),
    EmailAddress: serializeEmailAddress(email),
    PhoneNumber: serializePhoneNumber(phone),
    Web3Wallet: serializeWeb3Wallet(wallet),
    ExternalAccount: serializeExternalAccount(external),
    EnterpriseAccount: serializeEnterpriseAccount(enterprise),
    EnterpriseConnection: serializeEnterpriseConnection(enterprise.enterpriseConnection!),
    Passkey: serializePasskey(passkey),
    Verification: serializeVerification(email.verification),
    IdentificationLink: serializeIdentificationLink(email.linkedTo![0]!),
    PublicUserData: serializePublicUserData(fullSession.publicUserData),
    Actor: serializeActor(fullSession.actor!),
  };

  it('covers every resource listed in coverage.json', () => {
    expect(Object.keys(outputs).sort()).toEqual(Object.keys(coverage.resources).sort());
  });

  for (const [name, { fields }] of Object.entries(coverage.resources)) {
    it(name, () => {
      expect(Object.keys(outputs[name] ?? {})).toEqual(fields);
    });
  }
});

describe('serializer defaults', () => {
  it('turns absent optional booleans and ids into false / null', () => {
    expect(
      serializePublicUserData({ imageUrl: 'i', hasImage: false, identifier: 'x' }),
    ).toEqual({
      firstName: null,
      lastName: null,
      imageUrl: 'i',
      hasImage: false,
      identifier: 'x',
      userId: null,
      username: null,
      banned: false,
      deprovisioned: false,
    });
  });

  it('turns absent lists and metadata into [] and {}', () => {
    const phone = serializePhoneNumber({
      id: 'p',
      phoneNumber: '+1',
      verification: {},
      reservedForSecondFactor: false,
      defaultSecondFactor: false,
    });
    expect(phone.linkedTo).toEqual([]);
    expect(phone.backupCodes).toEqual([]);
    expect(serializeVerification({})).toEqual({
      status: null,
      strategy: null,
      expireAt: null,
      error: null,
      message: null,
      nonce: null,
      externalVerificationRedirectURL: null,
      verifiedAtClient: null,
    });
  });

  it('maps the factorVerificationAge tuple, task keys, and actor', () => {
    const session = serializeSession({ ...fullSession, factorVerificationAge: [1, 2], actor: { sub: 's' } });
    expect(session.factorVerificationAge).toEqual({ firstFactorAge: 1, secondFactorAge: 2 });
    expect(session.tasks).toEqual(['choose-organization']);
    expect(session.currentTask).toBe('choose-organization');
    expect(session.actor).toEqual({ sub: 's', type: null });
  });
});
