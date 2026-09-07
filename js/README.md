# @viewengine/elm-clerk

The npm half of [elm-clerk](https://github.com/alexbruf/elm-clerk): a small ESM shim that loads
[`@clerk/clerk-js`](https://www.npmjs.com/package/@clerk/clerk-js) and bridges it to a compiled Elm
app over two ports. Pair it with the Elm package `alexbruf/elm-clerk`.

## Install

```sh
bun add @viewengine/elm-clerk        # pulls @clerk/clerk-js ^6.31.0
```

ESM only. No CommonJS build.

## Use

Paste the canonical `Ports.elm` into your Elm app:

```elm
port module Ports exposing (clerkIn, clerkOut)

import Json.Encode exposing (Value)

port clerkOut : Value -> Cmd msg
port clerkIn : (Value -> msg) -> Sub msg
```

Then wire the shim once, after `Elm.Main.init`:

```js
import { attachClerk } from '@viewengine/elm-clerk';

const app = Elm.Main.init({ node: document.getElementById('root') });

const clerk = await attachClerk(app, {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  // clerkOptions: { signInUrl: '/sign-in' },   // passed straight to clerk.load()
  // ports: { out: 'clerkOut', in: 'clerkIn' }, // these are the defaults
  // ui: 'cdn',                                  // default; 'none' for headless
});
```

`attachClerk` resolves with the loaded `Clerk` instance. It rejects only when the named ports are
missing from `app.ports`, when the Clerk UI bundle cannot be fetched, or when `clerk.load()` fails.
All three happen in your own setup code, before Elm is involved. After that, nothing ever throws
into the Elm runtime: every failure arrives on `clerkIn` as `{ v: 1, tag: "error", message }`.

### Prebuilt UI

ClerkJS 6 does not bundle its UI components. With the default `ui: 'cdn'`, the shim injects
`https://<frontend-api>/npm/@clerk/ui@1/dist/ui.browser.js` (the host is decoded from the
publishable key) and passes the resulting constructor as `clerkOptions.ui.ClerkUI`, which is what
`mountSignIn`, `mountUserButton`, `openSignIn`, `openSignUp`, and `openUserProfile` need. This
mirrors Clerk's own JavaScript quickstart and avoids a React peer dependency. Options:

- `ui: 'none'`: skip the bundle. State and `requestToken` still work; the mount/open commands
  reply with an `error` message.
- Supply `clerkOptions.ui.ClerkUI` yourself (for example from `@clerk/ui` if your app already
  bundles React) and the CDN step is skipped.
- `uiBundleUrl(publishableKey)` and `frontendApiFromKey(publishableKey)` are exported if you need
  the URL for a Content Security Policy.

## API

| Export | What it is |
|--------|-----------|
| `attachClerk(app, opts)` | Loads ClerkJS and bridges the two ports. Also the default export. |
| `ElmApp`, `ElmPort`, `AttachOptions`, `ClerkOptions` | Types for the call above. |
| `PROTOCOL_VERSION`, `OUTGOING_TAGS`, `INCOMING_TAGS` | The v1 wire protocol tables. |
| `serializeState`, `parseOutgoing`, `stateChanged`, `tokenReceived`, `tokenFailed`, `error` | Protocol helpers, re-exported from `./protocol`. |
| `State`, `UserJson`, `SessionJson`, `OrganizationJson`, message types | Protocol types. |

The wire protocol itself (all nine Elm to JS tags, all four JS to Elm tags, and the `State` JSON) is
documented in the [root README and CLAUDE.md](https://github.com/alexbruf/elm-clerk).

## Develop

```sh
bun install
bun run typecheck
bun run test     # vitest + jsdom, @clerk/clerk-js mocked at the module boundary
bun run build    # tsc -> dist/
```

BSD-3-Clause.
