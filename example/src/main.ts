import { Elm } from './Main.elm'
import { attachClerk } from '@viewengine/elm-clerk'

const node = document.getElementById('app')

const app = Elm.Main.init({
  node,
  flags: { status: 'loading' },
})

attachClerk(app, {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
}).then((clerk) => {
  // Exposed for the Playwright smoke test (../e2e/smoke.spec.ts), which
  // drives ClerkJS directly (test-mode sign-in) rather than through the DOM
  // alone.
  ;(window as unknown as { __clerk: unknown }).__clerk = clerk
})
