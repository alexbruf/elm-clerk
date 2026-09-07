import { describe, expect, it } from 'vitest';

import {
  INCOMING_TAGS,
  OUTGOING_TAGS,
  PROTOCOL_VERSION,
  error,
  parseOutgoing,
  serializeState,
  stateChanged,
  tokenFailed,
  tokenReceived,
} from '../src/protocol.js';
import {
  CREATED_AT,
  EXPIRE_AT,
  LAST_ACTIVE_AT,
  makeOrganization,
  makeSession,
  makeUser,
} from './fakeClerk.js';

describe('tag tables', () => {
  it('lists the nine Elm -> JS tags in protocol order', () => {
    expect(OUTGOING_TAGS).toEqual([
      'signOut',
      'openSignIn',
      'openSignUp',
      'openUserProfile',
      'mountSignIn',
      'mountUserButton',
      'unmount',
      'requestToken',
      'setActiveOrganization',
    ]);
  });

  it('lists the four JS -> Elm tags', () => {
    expect(INCOMING_TAGS).toEqual(['stateChanged', 'tokenReceived', 'tokenFailed', 'error']);
  });

  it('pins the protocol version at 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});

describe('serializeState', () => {
  it('returns signedOut with no session', () => {
    expect(serializeState({ session: null, user: makeUser() })).toEqual({ status: 'signedOut' });
  });

  it('returns signedOut with no user', () => {
    expect(serializeState({ session: makeSession(), user: null })).toEqual({ status: 'signedOut' });
  });

  it('returns signedOut for a freshly loaded anonymous Clerk', () => {
    expect(serializeState({})).toEqual({ status: 'signedOut' });
  });

  it('serializes exactly the coverage.json fields when signed in', () => {
    const state = serializeState({
      session: makeSession(),
      user: makeUser(),
      organization: makeOrganization(),
    });

    expect(state).toEqual({
      status: 'signedIn',
      session: {
        id: 'sess_1',
        status: 'active',
        lastActiveAt: LAST_ACTIVE_AT.getTime(),
        expireAt: EXPIRE_AT.getTime(),
      },
      user: {
        id: 'user_1',
        primaryEmailAddress: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        imageUrl: 'https://img.clerk.com/user_1',
        createdAt: CREATED_AT.getTime(),
      },
      organization: {
        id: 'org_1',
        name: 'ViewEngine',
        slug: 'viewengine',
        imageUrl: 'https://img.clerk.com/org_1',
      },
    });

    if (state.status !== 'signedIn') throw new Error('unreachable');
    expect(Object.keys(state.session).sort()).toEqual(
      ['expireAt', 'id', 'lastActiveAt', 'status'].sort(),
    );
    expect(Object.keys(state.user).sort()).toEqual(
      ['createdAt', 'firstName', 'id', 'imageUrl', 'lastName', 'primaryEmailAddress'].sort(),
    );
    expect(Object.keys(state.organization ?? {}).sort()).toEqual(
      ['id', 'imageUrl', 'name', 'slug'].sort(),
    );
  });

  it('nulls the organization when there is none', () => {
    const state = serializeState({ session: makeSession(), user: makeUser() });
    expect(state).toMatchObject({ status: 'signedIn', organization: null });
  });

  it('flattens primaryEmailAddress and nulls a missing one', () => {
    const state = serializeState({
      session: makeSession(),
      user: makeUser({ primaryEmailAddress: null }),
    });
    expect(state).toMatchObject({ user: { primaryEmailAddress: null } });
  });

  it('nulls createdAt when ClerkJS has none', () => {
    const state = serializeState({
      session: makeSession(),
      user: makeUser({ createdAt: null }),
    });
    expect(state).toMatchObject({ user: { createdAt: null } });
  });

  it('nulls an absent organization slug', () => {
    const state = serializeState({
      session: makeSession(),
      user: makeUser(),
      organization: makeOrganization({ slug: null }),
    });
    expect(state).toMatchObject({ organization: { slug: null } });
  });

  it('passes the session status through as a string', () => {
    const state = serializeState({
      session: makeSession({ status: 'pending' }),
      user: makeUser(),
    });
    expect(state).toMatchObject({ session: { status: 'pending' } });
  });

  it('never produces loading', () => {
    expect(serializeState({}).status).not.toBe('loading');
  });
});

describe('incoming message builders', () => {
  it('stamps v and tag on every message', () => {
    expect(stateChanged({ status: 'signedOut' })).toEqual({
      v: 1,
      tag: 'stateChanged',
      state: { status: 'signedOut' },
    });
    expect(tokenReceived('r1', 'jwt')).toEqual({
      v: 1,
      tag: 'tokenReceived',
      requestId: 'r1',
      token: 'jwt',
    });
    expect(tokenFailed('r1', 'nope')).toEqual({
      v: 1,
      tag: 'tokenFailed',
      requestId: 'r1',
      reason: 'nope',
    });
    expect(error('boom')).toEqual({ v: 1, tag: 'error', message: 'boom' });
  });
});

describe('parseOutgoing', () => {
  it('accepts every payload-free tag', () => {
    for (const tag of ['signOut', 'openSignIn', 'openSignUp', 'openUserProfile'] as const) {
      expect(parseOutgoing({ v: 1, tag })).toEqual({ ok: true, message: { v: 1, tag } });
    }
  });

  it('accepts element-id tags', () => {
    expect(parseOutgoing({ v: 1, tag: 'mountSignIn', elementId: 'x' })).toEqual({
      ok: true,
      message: { v: 1, tag: 'mountSignIn', elementId: 'x' },
    });
  });

  it('accepts requestToken with and without a template', () => {
    expect(parseOutgoing({ v: 1, tag: 'requestToken', requestId: 'r', template: null })).toEqual({
      ok: true,
      message: { v: 1, tag: 'requestToken', requestId: 'r', template: null },
    });
    expect(parseOutgoing({ v: 1, tag: 'requestToken', requestId: 'r', template: 'sup' })).toEqual({
      ok: true,
      message: { v: 1, tag: 'requestToken', requestId: 'r', template: 'sup' },
    });
  });

  it('accepts setActiveOrganization', () => {
    expect(parseOutgoing({ v: 1, tag: 'setActiveOrganization', organizationId: 'org_1' })).toEqual({
      ok: true,
      message: { v: 1, tag: 'setActiveOrganization', organizationId: 'org_1' },
    });
  });

  it.each([
    ['a non-object', 42],
    ['null', null],
    ['an array', [1, 2, 3]],
    ['a wrong version', { v: 2, tag: 'signOut' }],
    ['a missing version', { tag: 'signOut' }],
    ['a missing tag', { v: 1 }],
    ['a non-string tag', { v: 1, tag: 7 }],
    ['an unknown tag', { v: 1, tag: 'launchRockets' }],
    ['mountSignIn without elementId', { v: 1, tag: 'mountSignIn' }],
    ['unmount with a numeric elementId', { v: 1, tag: 'unmount', elementId: 3 }],
    ['requestToken without requestId', { v: 1, tag: 'requestToken', template: null }],
    ['requestToken with a numeric template', { v: 1, tag: 'requestToken', requestId: 'r', template: 4 }],
    ['setActiveOrganization without organizationId', { v: 1, tag: 'setActiveOrganization' }],
  ])('rejects %s', (_label, value) => {
    const result = parseOutgoing(value);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toMatch(/^elm-clerk: /);
  });
});
