import { Clerk } from '@clerk/clerk-js';

import { describe, resolvePorts, type ElmApp } from './ports.js';
import {
  error as errorMessage,
  parseOutgoing,
  serializeState,
  stateChanged,
  tokenFailed,
  tokenReceived,
  type IncomingMessage,
  type OutgoingMessage,
  type OutgoingMessageByTag,
  type OutgoingTag,
} from './protocol.js';
import { loadUiFromCdn } from './ui.js';

export * from './protocol.js';
export type { ElmApp, ElmPort } from './ports.js';
export { CLERK_UI_MAJOR, frontendApiFromKey, uiBundleUrl } from './ui.js';
export type { Clerk };

/** The options object `clerk.load()` accepts, taken straight from the installed ClerkJS. */
export type ClerkOptions = NonNullable<Parameters<Clerk['load']>[0]>;

export interface AttachOptions {
  publishableKey: string;
  /** Passed verbatim to `clerk.load()`. */
  clerkOptions?: ClerkOptions;
  /** Port names, defaulting to `clerkOut` / `clerkIn`. */
  ports?: { out?: string; in?: string };
  /**
   * Where Clerk's prebuilt UI comes from. `'cdn'` (default) loads the
   * `@clerk/ui` browser bundle from the instance's Frontend API host so
   * `mountSignIn`, `openSignIn`, ... work. `'none'` skips it (headless: only
   * state and tokens). Ignored when `clerkOptions.ui.ClerkUI` is already set.
   */
  ui?: 'cdn' | 'none';
}

type MountKind = 'signIn' | 'userButton';

type Handlers = {
  [T in OutgoingTag]: (message: OutgoingMessageByTag[T]) => void | Promise<unknown>;
};

/**
 * Loads ClerkJS and bridges it to a compiled Elm app over two ports.
 *
 * Never throws into the Elm runtime: every failure after the ports are resolved
 * becomes an `error` message on the incoming port.
 */
export async function attachClerk(app: ElmApp, opts: AttachOptions): Promise<Clerk> {
  const { subscribe, send: rawSend } = resolvePorts(
    app,
    opts.ports?.out ?? 'clerkOut',
    opts.ports?.in ?? 'clerkIn',
  );
  const send = (message: IncomingMessage): void => {
    try {
      rawSend(message);
    } catch {
      // The Elm runtime rejected the message; there is nowhere left to report it.
    }
  };
  const sendError = (message: string): void => send(errorMessage(`elm-clerk: ${message}`));
  const fail = (prefix: string, cause: unknown): never => {
    sendError(`${prefix}: ${describe(cause)}`);
    throw cause instanceof Error ? cause : new Error(describe(cause));
  };

  const clerk = new Clerk(opts.publishableKey);

  let clerkOptions: ClerkOptions | undefined = opts.clerkOptions;
  if (opts.ui !== 'none' && !clerkOptions?.ui?.ClerkUI) {
    try {
      const ClerkUI = (await loadUiFromCdn(opts.publishableKey)) as NonNullable<
        NonNullable<ClerkOptions['ui']>['ClerkUI']
      >;
      clerkOptions = { ...clerkOptions, ui: { ...clerkOptions?.ui, ClerkUI } };
    } catch (cause) {
      fail('loading the Clerk UI bundle failed', cause);
    }
  }

  try {
    await clerk.load(clerkOptions);
  } catch (cause) {
    fail('clerk.load failed', cause);
  }

  const mounted = new Map<string, { kind: MountKind; element: HTMLDivElement }>();

  const requireElement = (elementId: string): HTMLDivElement => {
    const element = typeof document === 'undefined' ? null : document.getElementById(elementId);
    if (!element) throw new Error(`no element with id "${elementId}" in the document`);
    return element as HTMLDivElement;
  };

  const handlers: Handlers = {
    signOut: () => clerk.signOut(),
    openSignIn: () => clerk.openSignIn(),
    openSignUp: () => clerk.openSignUp(),
    openUserProfile: () => clerk.openUserProfile(),
    mountSignIn: (message) => {
      const element = requireElement(message.elementId);
      clerk.mountSignIn(element);
      mounted.set(message.elementId, { kind: 'signIn', element });
    },
    mountUserButton: (message) => {
      const element = requireElement(message.elementId);
      clerk.mountUserButton(element);
      mounted.set(message.elementId, { kind: 'userButton', element });
    },
    unmount: (message) => {
      const entry = mounted.get(message.elementId);
      if (!entry) {
        sendError(`unmount: nothing is mounted on element "${message.elementId}"`);
        return;
      }
      mounted.delete(message.elementId);
      if (entry.kind === 'signIn') clerk.unmountSignIn(entry.element);
      else clerk.unmountUserButton(entry.element);
    },
    requestToken: async (message) => {
      const session = clerk.session;
      if (!session) {
        send(tokenFailed(message.requestId, 'no active session'));
        return;
      }
      let token: string | null;
      try {
        token = await session.getToken(
          message.template === null ? undefined : { template: message.template },
        );
      } catch (cause) {
        send(tokenFailed(message.requestId, describe(cause)));
        return;
      }
      if (typeof token !== 'string') {
        send(tokenFailed(message.requestId, 'clerk returned no token'));
        return;
      }
      send(tokenReceived(message.requestId, token));
    },
    setActiveOrganization: (message) => clerk.setActive({ organization: message.organizationId }),
  };

  const dispatch = (value: unknown): void => {
    const parsed = parseOutgoing(value);
    if (!parsed.ok) {
      send(errorMessage(parsed.error));
      return;
    }
    const message = parsed.message;
    const handler = handlers[message.tag] as (m: OutgoingMessage) => void | Promise<unknown>;
    try {
      const result = handler(message);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        void Promise.resolve(result).catch((cause: unknown) => {
          sendError(`"${message.tag}" failed: ${describe(cause)}`);
        });
      }
    } catch (cause) {
      sendError(`"${message.tag}" failed: ${describe(cause)}`);
    }
  };

  send(stateChanged(serializeState(clerk)));
  clerk.addListener(
    (resources) => {
      try {
        send(stateChanged(serializeState(resources)));
      } catch (cause) {
        sendError(`failed to serialize state: ${describe(cause)}`);
      }
    },
    { skipInitialEmit: true },
  );
  subscribe(dispatch);

  return clerk;
}

export default attachClerk;
