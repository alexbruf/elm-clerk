# elm-clerk-example

A minimal `Browser.application` that wires up `elm-clerk` end to end. Also
doubles as the CI Playwright fixture (see `../.github/workflows/ci.yml`).

## Run it

From the repo root:

```sh
bun install
```

Set `CLERK_PUBLISHABLE_KEY` in the root `.env` (see `../.env.example`), then:

```sh
cd example
bun run dev
```

Open `http://localhost:5173` (or `$EXAMPLE_PORT`).

## Build

```sh
bun run build
```

Type-checks the Elm source (`elm make --optimize`, output discarded) before
running the Vite production build.

## e2e

```sh
bun run test:e2e
```

Requires a real Clerk test-instance publishable key in `CLERK_PUBLISHABLE_KEY`
(test mode enabled on that instance). The suite skips itself with a clear
message otherwise.
