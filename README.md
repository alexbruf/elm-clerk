# elm-clerk

Clerk authentication for Elm apps, bridged through ClerkJS over two ports.

This repo ships two versioned packages plus the glue that keeps them in
step with each other and with upstream Clerk releases:

- `alexbruf/elm-clerk` (Elm package, published to the Elm package registry):
  typed `State`, `Event`, decoders, and a small command API. No `port`
  declarations live here; the registry forbids them in packages.
- `@viewengine/elm-clerk` (npm package): a shim that loads `@clerk/clerk-js`,
  listens for state changes, and dispatches Elm's outgoing commands to the
  matching ClerkJS call. It is the only file in the repo that imports
  `@clerk/clerk-js`.
- `example/`: a small `Browser.application` that exercises both packages
  together and is built and tested on every CI run.

Full design spec: `SPEC.md`. Wire protocol and field reference: `CLAUDE.md`.

## Architecture

```
Elm app
  |
  | Cmd msg  (Clerk.signOut, Clerk.mountSignIn, Clerk.requestToken, ...)
  v
port clerkOut : Value -> Cmd msg      -- from your Ports.elm
  |
  v
@viewengine/elm-clerk (js/)  --calls-->  @clerk/clerk-js
  |
  v
port clerkIn : (Value -> msg) -> Sub msg      -- from your Ports.elm
  |
  v
Elm app  (Clerk.subscriptions decodes it into Clerk.Msg)
```

Every message crossing a port is one JSON object `{ "v": 1, "tag": "<tag>", ...payload }`.
Elm never sees a raw ClerkJS object; the shim's job is to translate.

`Ports.elm` is the only file a consumer writes by hand for the port
boundary. It is about five lines, never changes across Clerk versions, and
is checked byte-for-byte against the copy below by `scripts/check-readme.mjs`.

## Install

```sh
elm install alexbruf/elm-clerk
bun add @viewengine/elm-clerk
```

## Wiring

Copy this file into your project verbatim, as `src/Ports.elm` (or wherever
your source directory expects it):

```elm title=Ports.elm
port module Ports exposing (clerkIn, clerkOut)

import Json.Encode exposing (Value)

port clerkOut : Value -> Cmd msg
port clerkIn : (Value -> msg) -> Sub msg
```

In your Elm app, build a `Clerk.Ports msg` from it once and reuse it:

```elm
clerkPorts : Clerk.Ports Msg
clerkPorts =
    { toJs = Ports.clerkOut
    , fromJs = Ports.clerkIn
    }
```

Wire the subscription:

```elm
subscriptions : Model -> Sub Msg
subscriptions _ =
    Clerk.subscriptions clerkPorts ClerkMsg
```

Handle the resulting `Clerk.Msg` in `update`, storing the new `Clerk.State`
and reacting to the `Maybe Clerk.Event` it produces (`StateChanged`,
`TokenReceived`, `TokenFailed`, `Error`):

```elm
ClerkMsg clerkMsg ->
    let
        ( newState, cmd, event ) =
            Clerk.update clerkPorts clerkMsg model.clerk
    in
    ( { model | clerk = newState } |> applyEvent event, cmd )
```

On the JS side, initialize your Elm app and hand it to `attachClerk` once:

```ts title=main.ts
import { attachClerk } from '@viewengine/elm-clerk'

const app = Elm.Main.init({
  node: document.getElementById('app'),
  flags: { status: 'loading' },
})

attachClerk(app, {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
})
```

`attachClerk` sends the current Clerk state once immediately, then again on
every `clerk.addListener` change, and subscribes to `clerkOut` to dispatch
Elm's commands to ClerkJS. It never throws into the Elm runtime; every
failure on the JS side becomes an `error` message instead.

ClerkJS 6 ships without its prebuilt UI. By default `attachClerk` fetches the
`@clerk/ui` browser bundle from your instance's own Frontend API host (the
host is decoded from the publishable key, exactly as Clerk's JavaScript
quickstart does) and hands the constructor to `clerk.load`, so `mountSignIn`,
`openSignIn`, and the rest work with no React dependency in your app. Pass
`ui: 'none'` for a headless setup that only needs state and tokens, or set
`clerkOptions.ui.ClerkUI` yourself if you bundle `@clerk/ui`.

The full, working version of all of this lives in `example/src/`.

## The Loading state rule

`Clerk.State` is `Loading | SignedOut | SignedIn {...}`. `Loading` is the
only state that exists before the shim's first `stateChanged` message
arrives, and your view must render something for it (a spinner, a blank
shell, anything other than nothing), because on a slow network it can be
visible for real. `Clerk.init` starts there.

You can skip the flash of `Loading` on first paint: `attachClerk` can pass
the shim's already-known state as the Elm flag, and `Clerk.stateDecoder`
decodes it. `example/src/Main.elm` shows the pattern: try
`Clerk.stateDecoder` on the flag, fall back to `Clerk.init` if it is missing
or fails to decode.

## Token requests and requestId

`Clerk.requestToken` takes a `requestId : String` you choose. The shim
replies with `tokenReceived` or `tokenFailed` carrying that same
`requestId`. This exists because a consumer can have more than one token
request in flight (different templates, retried on failure, requested from
two places in the UI at once); the protocol never assumes there is exactly
one outstanding request. Keep a counter or a UUID generator in your model
and match replies back to the request that caused them, the way
`example/src/Main.elm`'s `nextRequestId` field does.

## Elm Land Effect.elm adapter

Elm Land style apps route every side effect through an `Effect msg` type
instead of returning `Cmd msg` directly from `update`, so that pages and
shared logic never need to know about `Clerk.Ports msg`, only `Main.elm`'s
runtime boundary does. `example/src/Effect.elm` is a full, documented
implementation of this pattern for `elm-clerk`.

The one thing worth calling out if you build your own: don't store a
deferred `Clerk.Ports msg -> Cmd msg` function inside your `Effect` type,
even though it looks convenient (`Effect.clerk Clerk.signOut` reads nicely
at the call site). That shape has no correct `Effect.map`, because turning
a `Clerk.Ports a -> Cmd a` into a `Clerk.Ports msg -> Cmd msg` given only
`toMsg : a -> msg` would require building a `Clerk.Ports a` out of a
`Clerk.Ports msg`, and both of that record's fields need a function going
the other way. Instead, store which command to run as plain data (an
enum with no `msg` in it, the same way Elm Land's own
`SendToLocalStorage { key, value }` effect works), and only turn that data
into a real `Cmd msg` in `toCmd`, called once, at the top, with the one real
`Clerk.Ports Msg`. See the module comment in `example/src/Effect.elm` for
the full walkthrough and the code.

## Wire protocol

The full tag-by-tag table (Elm to JS and JS to Elm), the JSON shape of
`State`, `User`, `Session`, and `Organization`, and the rules that govern
changing any of it live in `CLAUDE.md`. Read that before adding or changing
a tag or a field; the same section explains which files have to move
together (`coverage.json`, Elm types and decoders, shim dispatch, tests in
both packages) and how CI enforces it.

## coverage.json

`coverage.json` at the repo root is the single source of truth for what
ClerkJS surface this library implements. Every method and every resource
field appears in exactly one of `methods.implemented`, `methods.deferred`,
or `methods.wontImplement`; `wontImplement` entries carry a reason in the
sibling `notes` object; `bindings` maps each implemented method to its Elm
function name and its wire `tag`.

`scripts/check-coverage.mjs` (no dependencies) parses `elm/src/Clerk.elm`'s
exposing list, `js/src/protocol.ts`'s `OUTGOING_TAGS` tuple, `js/src/index.ts`'s
`handlers` dispatch table, and the Elm resource record fields in
`elm/src/Clerk/{User,Session,Organization}.elm`, then checks all of it
against `coverage.json`. It also checks that `coverage.json`'s
`clerkJsVersion` is inside the caret range pinned in `js/package.json`.
CI runs it (see `.github/workflows/ci.yml`) and fails the build on any
mismatch.

`scripts/check-readme.mjs` is the doc-driven counterpart: it checks this
file's `Ports.elm` code block against the real `example/src/Ports.elm`
byte-for-byte, checks that every `attachClerk` line in this file's `main.ts`
block also appears in the real `example/src/main.ts`, and checks that both
install commands above are actually written down here.

## Dependabot to clerk-sync

`.github/dependabot.yml` watches `@clerk/clerk-js` in `js/` on a daily
schedule and labels its pull requests `clerk-bump`; nothing else in the
repo triggers this flow. `.github/workflows/clerk-sync.md` is a gh-aw
(GitHub Agentic Workflows) source file, compiled to
`.github/workflows/clerk-sync.lock.yml`, that runs on Dependabot's pull
requests against `js/package.json`. The agent reads the old and new
`@clerk/clerk-js` versions, fetches Clerk's changelog and GitHub releases
for that range, and diffs the result against `coverage.json` to find new
surface, changed surface, and removed surface. Anything removed or changed
gets fixed in place (Elm types, decoders, shim dispatch, tests,
`coverage.json`) so CI stays green against the new version; anything new
gets implemented if it fits the existing protocol without a `v` bump, or
else recorded in `methods.deferred` with a one-line note. The agent runs
the same CI steps from `CLAUDE.md` locally before opening anything, then
opens one draft PR titled `clerk-sync: <old> -> <new>` targeting the
Dependabot branch and comments a link back on the Dependabot PR. It never
merges anything; branch protection requires CI green plus one human review
on `clerk-sync` PRs.

## Release and version policy

Both packages move together and share one version number. `release.yml`
runs on any pushed tag matching `v*.*.*`, verifies that tag is on `main`,
verifies `elm/elm.json`'s version, `js/package.json`'s version, and the tag
itself all agree, mirrors the tag as a bare `X.Y.Z` tag on the same commit
(the Elm registry looks for that form), then runs `elm publish` from `elm/`, `npm publish --access
public` from `js/` using npm trusted publishing (OIDC, no token secret, and
provenance is attached automatically; `bun publish` has no OIDC support yet,
so this one step uses npm), and attaches `coverage.json` to the GitHub
release. One-time setup: on npmjs.com, add a trusted publisher for
`@viewengine/elm-clerk` pointing at `alexbruf/elm-clerk` and `release.yml`.

A Clerk minor version bump that requires no protocol change ships as a
patch release of both packages here. Any change to the wire protocol's `v`
field is a major release of both packages, because it is a breaking change
for every consumer's `Ports.elm` boundary at once.

## Decisions recorded

From SPEC.md section 13, as settled and recorded in `CLAUDE.md`:

- `Session` does not expose `lastActiveToken`. Tokens are only available
  through `requestToken` round-trips, so a token is never stale by
  construction.
- The shim ships ESM only, no CommonJS build.
- The Elm package name is `alexbruf/elm-clerk`, matching the GitHub user of
  the origin remote.
- The target ClerkJS line is 6.x (`^6.31.0` at bootstrap).
  `coverage.json`'s `clerkJsVersion` tracks the currently pinned version.
