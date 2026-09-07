import type { ElmApp, ElmPort } from '../src/index.js';
import type { IncomingMessage } from '../src/protocol.js';

export interface FakeElmApp extends ElmApp {
  /** Messages the shim sent on the incoming port, in order. */
  sent: IncomingMessage[];
  /** The dispatcher the shim subscribed with; throws before `attachClerk` ran. */
  emit(value: unknown): void;
  /** Every message with the given tag. */
  ofTag<T extends IncomingMessage['tag']>(
    tag: T,
  ): Extract<IncomingMessage, { tag: T }>[];
  last(): IncomingMessage | undefined;
}

export function makeElmApp(
  names: { out?: string; in?: string } = {},
): FakeElmApp {
  const outName = names.out ?? 'clerkOut';
  const inName = names.in ?? 'clerkIn';

  const sent: IncomingMessage[] = [];
  let dispatch: ((value: unknown) => void) | null = null;

  const outPort: ElmPort = {
    subscribe: (callback) => {
      dispatch = callback;
    },
    unsubscribe: () => {
      dispatch = null;
    },
  };
  const inPort: ElmPort = {
    send: (value) => {
      sent.push(value as IncomingMessage);
    },
  };

  return {
    ports: { [outName]: outPort, [inName]: inPort },
    sent,
    emit(value) {
      if (!dispatch) throw new Error('nothing subscribed to the outgoing port yet');
      dispatch(value);
    },
    ofTag(tag) {
      return sent.filter((message) => message.tag === tag) as never;
    },
    last() {
      return sent[sent.length - 1];
    },
  };
}

/** An app object with no usable ports at all. */
export function makePortlessApp(): ElmApp {
  return { ports: {} };
}
