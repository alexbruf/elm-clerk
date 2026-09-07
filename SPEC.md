# elm-clerk: spec for agent handoff

Status: v1 spec, 2026-09-06. Owner: Alex (ViewEngine).

## 1. Goal

Ship two versioned packages that let an Elm app use Clerk auth through ClerkJS, plus CI/CD that keeps them in step with Clerk releases without a human watching the changelog.

- `elm-clerk` (Elm package): typed state, messages, decoders, and a small command API. No ports inside (registry forbids them).
- `@viewengine/elm-clerk` (npm): a shim that loads `@clerk/clerk-js`, subscribes to `clerk.addListener`, and bridges two ports.
- Consumer copies one `Ports.elm` (about 15 lines, never changes across Clerk versions).

## 2. Non-goals

- Porting Clerk logic to Elm. ClerkJS owns sessions, tokens, refresh, and UI.
- Server-side verification. That lives in the Rust backend (JWKS + `jsonwebtoken`), out of scope here.
- iframe embedding of Clerk UI.
- Supporting Elm 0.18 or elm-ui bindings.

## 3. Repo layout (single repo, two publishable units)

```
elm-clerk/
  elm/                      # Elm package (elm.json type: package)
    src/Clerk.elm
    src/Clerk/User.elm
    src/Clerk/Session.elm
    src/Clerk/Organization.elm
    src/Clerk/Internal/Protocol.elm
    tests/
  js/                       # npm package @viewengine/elm-clerk
    src/index.ts
    src/protocol.ts
    test/
    package.json            # depends on @clerk/clerk-js (caret range)
  example/                  # Browser.application consumer used in CI
    src/Main.elm
    src/Ports.elm           # the canonical copy consumers paste
    src/Effect.elm          # Elm Land style adapter, documented in README
  coverage.json             # ClerkJS surface manifest, see section 7
  .github/
    dependabot.yml
    workflows/
      ci.yml
      release.yml
      clerk-sync.md         # gh-aw source
      clerk-sync.lock.yml   # compiled by gh aw compile
  README.md
```

## 4. Elm package API

Module `Clerk` exposes:

```elm
type State
    = Loading
    | SignedOut
    | SignedIn { session : Session, user : User, organization : Maybe Organization }

type Msg                    -- opaque; consumer wraps it in their own Msg

type alias Ports msg =
    { toJs : Value -> Cmd msg
    , fromJs : (Value -> msg) -> Sub msg
    }

init : State                -- Loading; JS sends the real state on boot
update : Ports msg -> Msg -> State -> ( State, Cmd msg, Maybe Event )
subscriptions : Ports msg -> (Msg -> msg) -> Sub msg

-- commands
signOut : Ports msg -> Cmd msg
openSignIn : Ports msg -> Cmd msg
openSignUp : Ports msg -> Cmd msg
openUserProfile : Ports msg -> Cmd msg
mountSignIn : Ports msg -> String -> Cmd msg        -- element id
mountUserButton : Ports msg -> String -> Cmd msg
unmount : Ports msg -> String -> Cmd msg
requestToken : Ports msg -> { requestId : String, template : Maybe String } -> Cmd msg
setActiveOrganization : Ports msg -> String -> Cmd msg

type Event
    = StateChanged State
    | TokenReceived { requestId : String, token : String }
    | TokenFailed { requestId : String, reason : String }
    | Error String
```

Rules:

- `Msg` and decoders are internal; consumer only sees `State` and `Event`.
- Every outgoing command is one JSON object `{ "v": 1, "tag": String, ...payload }`.
- Every incoming message is one JSON object with the same shape. Unknown tags decode to `Error`, never a crash.
- `Loading` is the only state before the first `stateChanged`. Consumer must render something for it.
- Token requests carry a consumer-supplied `requestId` so concurrent requests do not collide.
- Flags: JS may pass the initial state as a flag so first render is correct. Package exposes `Clerk.stateDecoder` for this.

`Clerk.User`, `Clerk.Session`, `Clerk.Organization` are plain records mirroring the ClerkJS resource shapes listed in `coverage.json`, with decoders. Fields not in the manifest are not decoded.

## 5. Consumer `Ports.elm` (copied verbatim)

```elm
port module Ports exposing (clerkIn, clerkOut)

import Json.Encode exposing (Value)

port clerkOut : Value -> Cmd msg
port clerkIn : (Value -> msg) -> Sub msg
```

Wiring: `clerkPorts = { toJs = Ports.clerkOut, fromJs = Ports.clerkIn }`.

## 6. npm shim `@viewengine/elm-clerk`

```ts
export function attachClerk(app: ElmApp, opts: {
  publishableKey: string;
  clerkOptions?: ClerkOptions;   // passed to clerk.load
  ports?: { out?: string; in?: string };  // defaults clerkOut / clerkIn
}): Promise<Clerk>;
```

Behavior:

1. `new Clerk(publishableKey)`, `await clerk.load(clerkOptions)`.
2. Send `stateChanged` once with the current state.
3. `clerk.addListener(({ session, user, organization }) => send stateChanged)`.
4. `app.ports[out].subscribe(dispatch)` where `dispatch` switches on `tag` and calls the matching ClerkJS method. Unknown tag sends `error`.
5. `requestToken` calls `clerk.session?.getToken({ template })` and replies `tokenReceived` or `tokenFailed` with the same `requestId`.
6. Never throws into the Elm runtime; every failure becomes an `error` message.

The shim is the only file that imports `@clerk/clerk-js`. It stays under 200 lines; growth goes into `protocol.ts`.

## 7. `coverage.json` (the mechanical contract)

Single source of truth for what the library implements, consumed by humans and the sync agent.

```json
{
  "clerkJsVersion": "5.x.y",
  "resources": {
    "User": { "fields": ["id", "primaryEmailAddress", "firstName", "lastName", "imageUrl", "createdAt"] },
    "Session": { "fields": ["id", "status", "lastActiveAt", "expireAt"] },
    "Organization": { "fields": ["id", "name", "slug", "imageUrl"] }
  },
  "methods": {
    "implemented": ["signOut", "openSignIn", "openSignUp", "openUserProfile", "mountSignIn", "mountUserButton", "unmount", "session.getToken", "setActive"],
    "deferred": [],
    "wontImplement": ["redirectToSignIn", "handleRedirectCallback"]
  }
}
```

Rules: a method or field appears in exactly one list. `wontImplement` entries carry a reason in a sibling `notes` object. CI fails if `coverage.json` disagrees with the exported Elm API (script in `scripts/check-coverage.mjs` parses `Clerk.elm` exports and the shim's dispatch table).

## 8. CI (`ci.yml`, deterministic)

On every push and PR:

1. `elm-format --validate`, `elm-review`, `elm-test` in `elm/`.
2. `npm ci && npm test` in `js/` (vitest, jsdom, `@clerk/clerk-js` mocked at module boundary; tests assert every `tag` round-trips).
3. Build `example/` with `elm make --optimize` and run a Playwright smoke test against a Clerk test instance (publishable key in repo secret). Asserts: boot sends `stateChanged`, sign-out flips state, token request returns a JWT.
4. `node scripts/check-coverage.mjs`.

## 9. Dependabot (`dependabot.yml`)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /js
    schedule: { interval: daily }
    allow:
      - dependency-name: "@clerk/clerk-js"
    labels: [clerk-bump]
```

Only `@clerk/clerk-js` bumps get the `clerk-bump` label; nothing else triggers the agent.

## 10. Agentic sync (`clerk-sync.md`, gh-aw, Copilot engine)

Frontmatter:

```yaml
on:
  pull_request:
    types: [opened, synchronize]
    paths: [js/package.json]
if: github.actor == 'dependabot[bot]'
engine: copilot
permissions: read-all
network:
  allowed: [defaults, clerk.com, github.com, registry.npmjs.org, unpkg.com]
tools:
  web-fetch: true
  bash: [git, node, npm, elm]
safe-outputs:
  create-pull-request:
    labels: [clerk-sync, needs-review]
    draft: true
  add-comment: {}
timeout-minutes: 30
max-turns: 60
```

Body (instructions to the agent):

1. Read the version range in the Dependabot PR diff (old and new `@clerk/clerk-js`).
2. Fetch Clerk's changelog for that range (`https://clerk.com/changelog` and the `clerk/javascript` GitHub releases for `@clerk/clerk-js`). Extract added, changed, deprecated, and removed public methods, options, and resource fields.
3. Diff against `coverage.json`. Produce three lists: new surface not present anywhere in the manifest, implemented surface whose signature changed, implemented surface now removed.
4. For removed or changed surface: update Elm types, decoders, shim dispatch, tests, and `coverage.json` so CI passes against the new version. This is required.
5. For new surface: implement it only if it fits the existing message protocol without a `v` bump. Otherwise add it to `deferred` with a one-line note.
6. Run the full CI steps locally; do not open a PR that fails them.
7. Open one draft PR titled `clerk-sync: <old> -> <new>` targeting the Dependabot branch, body containing the three lists and which items landed in `implemented` vs `deferred`.
8. Comment on the Dependabot PR linking the sync PR.
9. If the changelog cannot be fetched or is ambiguous, open no PR; comment on the Dependabot PR with what was found and stop.

Merging is human-only. Branch protection requires CI green plus one review on `clerk-sync` PRs.

## 11. Release (`release.yml`)

On push of a tag `v*.*.*` on `main`:

1. Verify `elm/elm.json` version, `js/package.json` version, and the tag agree.
2. `elm publish` from `elm/` (needs the tag pushed first, which this trigger guarantees).
3. `npm publish --provenance` from `js/`.
4. Attach `coverage.json` to the GitHub release.

Version policy: both packages move together. Clerk minor bump with no protocol change is a patch here; any protocol `v` bump is a major.

## 12. Acceptance criteria

- `example/` app signs in, shows user, fetches a token, signs out, in Chromium via Playwright, on CI.
- A consumer can go from empty Elm Land app to signed-in state by installing both packages, pasting `Ports.elm`, and calling `attachClerk` once. README walks through this and it is tested by a doc-driven script.
- `check-coverage.mjs` fails the build when `coverage.json` and code diverge.
- A synthetic Dependabot PR (manually opened with `clerk-bump` label bumping `@clerk/clerk-js` one minor) results in a `clerk-sync` draft PR within one workflow run.
- No `port` declarations exist under `elm/src`.

## 13. Open items for the agent to decide and record in the PR description

- Whether `Session` exposes `lastActiveToken` or only `getToken` round-trips (default: round-trips only).
- Shim packaging: ESM only vs ESM plus CJS (default: ESM only).
- Elm package name: `viewengine/elm-clerk` pending Alex's GitHub org name.
