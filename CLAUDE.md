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
node scripts/gen-fixtures.mjs && elm-format --yes tests/Fixtures.elm   # after editing fixtures/*.json
```

`fixtures/full.json` and `fixtures/empty.json` are the shared resource contract: the JS tests assert `serializeState` produces them byte-for-byte, and the Elm tests decode them (embedded in the generated `tests/Fixtures.elm`; CI fails if it drifts). Change a field: update `coverage.json`, both fixtures, the Elm record, the JS serializer, then regenerate.

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

Resources. Field names and order are exactly those in `coverage.json` (one Elm module `src/Clerk/<Name>.elm` per resource, record alias `<Name>`, plus `decoder`). Conventions:

- Timestamps are epoch milliseconds (`number`), `null` when ClerkJS has `null`; Elm decodes to `Time.Posix` / `Maybe Time.Posix`.
- `string | null` -> `Maybe String`. Booleans that ClerkJS marks optional (`banned?`) are serialized as `false` when absent.
- Metadata objects (`publicMetadata`, `unsafeMetadata`) are passed through untouched as JSON objects; Elm keeps them as `Json.Decode.Value` (empty object when ClerkJS has null/undefined).
- Nested resources are serialized recursively with the same rules; lists are JSON arrays (`[]` when ClerkJS has null).
- JSON key `type` maps to Elm field `type_` (reserved word). `check-coverage.mjs` knows this one rename.
- Anything not listed is not serialized; see `coverage.json.notes` for deliberate exclusions (`Session.lastActiveToken`, `Session.user`, `Session.agent`, passkey `publicKey`).

```json
User: { "id": string, "externalId": string|null, "username": string|null, "fullName": string|null,
        "firstName": string|null, "lastName": string|null, "imageUrl": string, "hasImage": bool,
        "primaryEmailAddressId": string|null, "primaryEmailAddress": string|null,   // the address string
        "primaryPhoneNumberId": string|null, "primaryPhoneNumber": string|null,     // the number string
        "primaryWeb3WalletId": string|null, "primaryWeb3Wallet": string|null,       // the wallet string
        "emailAddresses": [EmailAddress], "phoneNumbers": [PhoneNumber], "web3Wallets": [Web3Wallet],
        "externalAccounts": [ExternalAccount], "enterpriseAccounts": [EnterpriseAccount],
        "passkeys": [Passkey], "organizationMemberships": [OrganizationMembership],
        "passwordEnabled": bool, "totpEnabled": bool, "backupCodeEnabled": bool, "twoFactorEnabled": bool,
        "publicMetadata": object, "unsafeMetadata": object,
        "lastSignInAt": ms|null, "legalAcceptedAt": ms|null, "createdAt": ms|null, "updatedAt": ms|null }

Session: { "id": string, "status": string, "expireAt": ms, "abandonAt": ms, "lastActiveAt": ms,
           "createdAt": ms, "updatedAt": ms,
           "factorVerificationAge": { "firstFactorAge": int, "secondFactorAge": int } | null,
           "lastActiveOrganizationId": string|null, "actor": Actor|null,
           "tasks": [string],                  // task keys, [] when null
           "currentTask": string|null,          // task key
           "publicUserData": PublicUserData }

Organization: { "id": string, "name": string, "slug": string|null, "imageUrl": string, "hasImage": bool,
                "membersCount": int, "pendingInvitationsCount": int, "publicMetadata": object,
                "adminDeleteEnabled": bool, "maxAllowedMemberships": int, "selfServeSSOEnabled": bool,
                "exclusiveMembership": bool, "createdAt": ms, "updatedAt": ms }

OrganizationMembership: { "id": string, "organization": Organization, "permissions": [string],
                          "publicMetadata": object, "publicUserData": PublicUserData|null,
                          "role": string, "roleName": string, "createdAt": ms, "updatedAt": ms }

EmailAddress: { "id": string, "emailAddress": string, "verification": Verification,
                "matchesSsoConnection": bool, "linkedTo": [IdentificationLink] }
PhoneNumber:  { "id": string, "phoneNumber": string, "verification": Verification,
                "reservedForSecondFactor": bool, "defaultSecondFactor": bool,
                "linkedTo": [IdentificationLink], "backupCodes": [string] }   // [] when absent
Web3Wallet:   { "id": string, "web3Wallet": string, "verification": Verification }
ExternalAccount: { "id": string, "identificationId": string, "provider": string, "providerUserId": string,
                   "emailAddress": string, "approvedScopes": string, "firstName": string, "lastName": string,
                   "imageUrl": string, "username": string|null, "phoneNumber": string|null, "label": string|null,
                   "publicMetadata": object, "verification": Verification|null }
EnterpriseAccount: { "id": string|null, "active": bool, "emailAddress": string,
                     "enterpriseConnectionId": string|null, "enterpriseConnection": EnterpriseConnection|null,
                     "firstName": string|null, "lastName": string|null, "protocol": string, "provider": string,
                     "providerUserId": string|null, "publicMetadata": object, "verification": Verification|null,
                     "lastAuthenticatedAt": ms|null }
EnterpriseConnection: { "id": string|null, "active": bool, "allowIdpInitiated": bool, "allowSubdomains": bool,
                        "disableAdditionalIdentifications": bool, "domain": string, "logoPublicUrl": string|null,
                        "name": string, "protocol": string, "provider": string, "syncUserAttributes": bool,
                        "allowOrganizationAccountLinking": bool, "enterpriseConnectionId": string|null }
Passkey:      { "id": string, "name": string|null, "lastUsedAt": ms|null, "verification": Verification|null }
Verification: { "status": string|null, "strategy": string|null, "expireAt": ms|null,
                "error": string|null,                          // ClerkAPIError.message
                "message": string|null, "nonce": string|null,
                "externalVerificationRedirectURL": string|null,  // URL.toString()
                "verifiedAtClient": string|null }
IdentificationLink: { "id": string, "type": string }            // Elm field: type_
PublicUserData: { "firstName": string|null, "lastName": string|null, "imageUrl": string, "hasImage": bool,
                  "identifier": string, "userId": string|null, "username": string|null,
                  "banned": bool, "deprovisioned": bool }
Actor: { "sub": string, "type": string|null }                    // Elm field: type_
```

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
- `clerk-sync.md` deviates from SPEC section 10 where gh-aw or the first live run demanded it: `web-fetch: {}` (v0.88 rejects the boolean), `bash: [":*"]` (the [git, node, npm, elm] allowlist denied pipes/curl and burned the budget), `max-turns: 150` and `timeout-minutes: 45`, plus the `clerk-bump` label as an alternative trigger for synthetic PRs. Recompile with `gh aw compile` after editing it and commit the lock file.

## GitHub repository setup the automation depends on

- Secrets: `CLERK_PUBLISHABLE_KEY` (e2e), `COPILOT_GITHUB_TOKEN` (fine-grained PAT with Copilot Requests, runs the clerk-sync agent), `GH_AW_CI_TRIGGER_TOKEN` (fine-grained PAT, Contents + Pull requests + Workflows read/write on this repo; gh-aw uses it to push and open the sync PR so CI runs on it. PRs opened with the built-in token never trigger workflows).
- Actions setting "Allow GitHub Actions to create and approve pull requests" must be on (set via `PUT /repos/{owner}/{repo}/actions/permissions/workflow`, `can_approve_pull_request_reviews: true`).
- npm trusted publisher for `@viewengine/elm-clerk`: repository `alexbruf/elm-clerk`, workflow `release.yml`.
- Labels: `clerk-bump` (Dependabot applies it; also the manual trigger for synthetic PRs), `clerk-sync`, `needs-review`.
- Sandbox limits the agent lives with: the `elm` binary cannot reach `package.elm-lang.org` through the gh-aw proxy, so `elm-test`/`elm-review` are left to the CI run on the sync PR.

## Local e2e

`example/e2e/smoke.spec.ts` needs a real dev-instance key in `.env` and a Clerk user `smoke+clerk_test@example.com` on that instance (Clerk test mode accepts OTP `424242` for `+clerk_test` addresses). The instance must allow email-code sign-in without a required password. The Clerk CLI is linked to that app; `clerk config pull` shows the settings.
