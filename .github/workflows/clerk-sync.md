---
on:
  pull_request:
    types: [opened, synchronize]
    paths: [js/package.json]
if: github.actor == 'dependabot[bot]' || contains(github.event.pull_request.labels.*.name, 'clerk-bump')
engine: copilot
permissions: read-all
network:
  allowed: [defaults, clerk.com, github.com, registry.npmjs.org, unpkg.com]
tools:
  web-fetch: {}
  bash: [git, node, npm, elm]
safe-outputs:
  create-pull-request:
    labels: [clerk-sync, needs-review]
    draft: true
  add-comment: {}
timeout-minutes: 30
max-turns: 60
---

# clerk-sync

You are responding to a Dependabot pull request that bumps `@clerk/clerk-js`
in `js/package.json`. Your job is to keep `elm-clerk` (the Elm package under
the repo root: `elm.json`, `src/`, `tests/`) and `@viewengine/elm-clerk` (the npm shim under `js/`) working
against the new ClerkJS version, and to keep `coverage.json` at the repo
root, the single source of truth for what this library implements, in
agreement with the code. Follow these steps in order.

1. **Read the version range in the Dependabot PR diff.** Look at the diff
   to `js/package.json` on this pull request and extract the old and new
   `@clerk/clerk-js` version (or range). You need both ends: the version
   `coverage.json`'s `clerkJsVersion` currently records, and the version
   Dependabot wants to move to.

2. **Fetch Clerk's changelog for that range.** Use your web-fetch tool
   against `https://clerk.com/changelog` and the `clerk/javascript` GitHub
   releases for the `@clerk/clerk-js` package, covering every version
   between the old and new pins. Extract anything relevant to the public
   surface this library touches: added, changed, deprecated, and removed
   public methods, `Clerk` constructor/`load` options, and fields on the
   `User`, `Session`, and `Organization` resources.

3. **Diff the changelog against `coverage.json`.** Compare what you found
   in step 2 against `coverage.json`'s `resources.*.fields`,
   `methods.implemented`, `methods.deferred`, and `methods.wontImplement`
   lists, and its `bindings` map (which ties each implemented method to its
   Elm function name and its wire `tag`). Produce three lists: surface that
   is new and not present anywhere in the manifest; surface already in
   `methods.implemented` or `resources.*.fields` whose signature or shape
   changed; and surface already in `methods.implemented` that ClerkJS has
   now removed.

4. **Fix removed or changed surface. This is required, not optional.** For
   anything in the "changed" or "removed" list from step 3, update the Elm
   types and decoders (`src/Clerk.elm`, `src/Clerk/User.elm`,
   `src/Clerk/Session.elm`, `src/Clerk/Organization.elm`), the
   shim's dispatch table (`js/src/index.ts`'s `handlers`, and
   `js/src/protocol.ts`'s `OUTGOING_TAGS` if a tag itself needs to change),
   the tests in both `tests/` and `js/test/`, and `coverage.json`
   itself (fields, method lists, `bindings`, `notes`, and
   `clerkJsVersion`), so that the full CI suite passes against the new
   ClerkJS version. A PR that leaves any of this broken is not acceptable.

5. **Implement or defer new surface.** For anything in the "new" list from
   step 3, implement it only if it fits inside the existing wire protocol
   (`{ "v": 1, "tag": string, ...payload }`) without changing the protocol
   version `v`. If it does, add it the same way existing methods are
   wired: an Elm command function, a `tag`, a shim dispatch entry, tests,
   and a `coverage.json` `bindings` entry, landing in
   `methods.implemented`. If it does not fit without a `v` bump (a
   breaking protocol change is out of scope for an automated sync), add it
   to `coverage.json`'s `methods.deferred` instead, with a one-line reason
   in a sibling note.

6. **Run the full CI suite locally before doing anything else.** Using the
   `bash` tools available to you (`git`, `node`, `npm`, `elm`), run the same
   checks `.github/workflows/ci.yml` runs: `elm-format --validate`,
   `elm-review`, and `elm-test` at the repo root; `typecheck`, `build`, and `test`
   in `js/`; and both `node scripts/check-coverage.mjs` and
   `node scripts/check-readme.mjs` from the repo root. Do not proceed to
   open a pull request that fails any of these.

7. **Open one draft pull request.** Title it `clerk-sync: <old> -> <new>`
   (the old and new `@clerk/clerk-js` versions from step 1), target the
   Dependabot branch (not `main`), and write a body containing the three
   lists from step 3 plus, for each item, whether it landed in
   `methods.implemented` or `methods.deferred` and why. Use the
   `create-pull-request` safe output for this; it is already configured to
   label the PR `clerk-sync` and `needs-review` and to open it as a draft.

8. **Comment on the Dependabot pull request.** Leave a comment on the
   original Dependabot PR linking the sync PR you just opened, using the
   `add-comment` safe output, so a human reviewing the Dependabot bump sees
   the sync work immediately.

9. **If the changelog cannot be fetched, or is ambiguous, stop and say so
   instead of guessing.** Open no pull request. Instead, comment on the
   Dependabot PR (again via `add-comment`) describing exactly what you were
   able to find, what was missing or unclear, and why you stopped. Merging
   is human-only in every case; branch protection on `clerk-sync` PRs
   requires CI green plus one human review before anything here can land.
