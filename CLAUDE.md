# elm-clerk

Clerk authentication for Elm apps, bridged through ClerkJS over two ports. One repo, two publishable units that version together. Full spec: `SPEC.md` (read it before non-trivial changes).

## Layout

```
elm.json, src/, tests/, review/   Elm package `alexbruf/elm-clerk` at the REPO ROOT (the Elm registry needs elm.json at the archive root). NO port declarations under src/.
js/         npm package `@viewengine/elm-clerk`. The ONLY code that imports @clerk/clerk-js. src/index.ts < 200 lines; growth goes to src/protocol.ts.
example/    Browser.application consumer built in CI. src/Ports.elm is the canonical copy consumers paste.
scripts/    check-coverage.mjs (CI gate: coverage.json must agree with Elm exports + shim dispatch table).
coverage.json  ClerkJS surface manifest. Single source of truth. Every method/field in exactly one list.
.github/    ci.yml, release.yml, dependabot.yml, clerk-sync.md (gh-aw source) + clerk-sync.lock.yml (compiled).
```

## Commands

Use `bun` / `bunx`, never npm/npx. Root is a bun workspace (`js`, `example`).

```
bun install                                   # all workspaces
elm-format --validate src tests && elm-review && elm-test
cd js && bun run build && bun run test        # vitest, clerk-js mocked at module boundary
cd example && bun run build && bun run test:e2e   # elm make --optimize + Playwright (needs CLERK_PUBLISHABLE_KEY)
node scripts/check-coverage.mjs
```

Env vars live in `.env` (never committed). See `.env.example`.

## Wire protocol (v1): the contract between src/ (Elm) and js/

Every message in both directions is one JSON object `{ "v": 1, "tag": "<tag>", ...payload }`.
Unknown tags never crash: Elm decodes them to `Error`, JS replies with an `error` message.

Elm -> JS (port `clerkOut`):

| tag                     | payload                                               | ClerkJS call                                 |
|-------------------------|-------------------------------------------------------|----------------------------------------------|
| `signOut`               | `{}`                                                  | `clerk.signOut()`                            |
| `openSignIn`            | `{}`                                                  | `clerk.openSignIn()`                         |
| `openSignUp`            | `{}`                                                  | `clerk.openSignUp()`                         |
| `openUserProfile`       | `{}`                                                  | `clerk.openUserProfile()`                    |
| `mountSignIn`           | `{ "elementId": string }`                             | `clerk.mountSignIn(el)`                      |
| `mountUserButton`       | `{ "elementId": string }`                             | `clerk.mountUserButton(el)`                  |
| `unmount`               | `{ "elementId": string }`                             | unmount whatever was mounted on that element |
| `requestToken`          | `{ "requestId": string, "template": string \| null }` | `clerk.session?.getToken({ template })`      |
| `setActiveOrganization` | `{ "organizationId": string }`                        | `clerk.setActive({ organization: id })`      |

JS -> Elm (port `clerkIn`):

| tag             | payload                                     |
|-----------------|---------------------------------------------|
| `stateChanged`  | `{ "state": State }`                        |
| `tokenReceived` | `{ "requestId": string, "token": string }`  |
| `tokenFailed`   | `{ "requestId": string, "reason": string }` |
| `error`         | `{ "message": string }`                     |

`State` JSON (also accepted as the Elm flag via `Clerk.stateDecoder`):

```json
{ "status": "loading" }
{ "status": "signedOut" }
{ "status": "signedIn", "session": Session, "user": User, "organization": Organization | null }
```

Resources (fields are exactly those in `coverage.json`; timestamps are epoch milliseconds, decoded to `Time.Posix`):

```json
User:         { "id": string, "primaryEmailAddress": string | null, "firstName": string | null,
                "lastName": string | null, "imageUrl": string, "createdAt": number | null }
Session:      { "id": string, "status": string, "lastActiveAt": number, "expireAt": number }
Organization: { "id": string, "name": string, "slug": string | null, "imageUrl": string }
```

`primaryEmailAddress` is the email string (`user.primaryEmailAddress?.emailAddress`), not the ClerkJS resource object.

## Rules

- `Msg` in `Clerk` is opaque. Consumers see only `State`, `Event`, `Ports`, the command functions, and `stateDecoder`.
- `Loading` is the only state before the first `stateChanged`.
- Token requests carry a consumer-supplied `requestId`; never assume one in-flight request.
- The shim never throws into the Elm runtime; every failure becomes an `error` message.
- Adding a tag or field: update `coverage.json`, Elm types/decoders, shim dispatch, tests in both packages. CI checks all four agree.
- Any change to the `v` field is a major release of both packages. A Clerk minor bump with no protocol change is a patch.
- Both packages share one version. `release.yml` verifies `elm.json`, `js/package.json`, and the git tag agree.
- Never commit `.env`. Clerk publishable keys for CI come from the `CLERK_PUBLISHABLE_KEY` repo secret.

## Decisions recorded (SPEC section 13)

- `Session` does not expose `lastActiveToken`; tokens only via `requestToken` round-trips.
- Shim ships ESM only.
- Elm package name is `alexbruf/elm-clerk` (GitHub user of the origin remote).
- Target ClerkJS is the 6.x line (`^6.31.0` at bootstrap); `coverage.json.clerkJsVersion` tracks the pinned version.
- ClerkJS 6 ships no UI; `mountSignIn` etc. need `clerk.load({ ui: { ClerkUI } })`. `@clerk/ui` on npm needs React peers, so the shim (`js/src/ui.ts`) injects `https://<frontend-api>/npm/@clerk/ui@<major>/dist/ui.browser.js` (host decoded from the publishable key, per Clerk's JS quickstart) and reads `window.__internal_ClerkUICtor`. `attachClerk` option `ui: 'cdn' | 'none'` (default `'cdn'`); a consumer-supplied `clerkOptions.ui.ClerkUI` wins. `coverage.json.clerkUiMajor` tracks the requested major.
- The listener is registered with `skipInitialEmit: true`; the shim sends the first `stateChanged` itself so boot produces exactly one.
- The Elm package lives at the repo root, not in `elm/` as SPEC section 3 shows: `elm publish` downloads the tagged GitHub archive and requires `elm.json` at its root, so a subdirectory package cannot be published.
- `clerk-sync.md` uses `web-fetch: {}` rather than SPEC's `web-fetch: true`; gh-aw v0.88 rejects the boolean form. Recompile with `gh aw compile` after editing it and commit the lock file.

## Local e2e

`example/e2e/smoke.spec.ts` needs a real dev-instance key in `.env` and a Clerk user `smoke+clerk_test@example.com` on that instance (Clerk test mode accepts OTP `424242` for `+clerk_test` addresses). The instance must allow email-code sign-in without a required password. The Clerk CLI is linked to that app; `clerk config pull` shows the settings.
