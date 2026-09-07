/** One Elm port, as the compiled Elm app exposes it. */
export interface ElmPort {
  subscribe?: (callback: (value: unknown) => void) => void;
  unsubscribe?: (callback: (value: unknown) => void) => void;
  send?: (value: unknown) => void;
}

/** The subset of a compiled Elm application this shim touches. */
export interface ElmApp {
  ports: Record<string, ElmPort>;
}

export interface ResolvedPorts {
  subscribe: (callback: (value: unknown) => void) => void;
  send: (value: unknown) => void;
}

/**
 * Finds the two ports on a compiled Elm app. Throws (before Elm is involved)
 * when either is missing, since that is a wiring mistake in the consumer's
 * own setup code.
 */
export function resolvePorts(app: ElmApp, outName: string, inName: string): ResolvedPorts {
  const ports = app?.ports;
  const outPort = ports?.[outName];
  if (!outPort || typeof outPort.subscribe !== 'function') {
    throw new Error(
      `elm-clerk: the Elm app has no subscribable port named "${outName}". ` +
        `Add \`port ${outName} : Value -> Cmd msg\` or pass opts.ports.out.`,
    );
  }
  const inPort = ports?.[inName];
  if (!inPort || typeof inPort.send !== 'function') {
    throw new Error(
      `elm-clerk: the Elm app has no sendable port named "${inName}". ` +
        `Add \`port ${inName} : (Value -> msg) -> Sub msg\` or pass opts.ports.in.`,
    );
  }
  return { subscribe: outPort.subscribe.bind(outPort), send: inPort.send.bind(inPort) };
}

export function describe(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  try {
    return JSON.stringify(cause) ?? String(cause);
  } catch {
    return String(cause);
  }
}
