import { test, expect } from '@playwright/test'

// SPEC.md section 12 acceptance criteria, exercised in order against a real
// Clerk test instance. Requires the development instance's "test mode" to
// be enabled (Clerk dashboard -> Configure -> Restrictions) so that
// `+clerk_test` email addresses accept the fixed OTP `424242` without
// sending real email. See:
// https://clerk.com/docs/testing/test-emails-and-phones
const rawKey = process.env.CLERK_PUBLISHABLE_KEY
const isPlaceholder = !rawKey || /^pk_test_x+/i.test(rawKey) || rawKey === 'pk_test_xxxxxxxx...'

test.skip(
  isPlaceholder,
  'CLERK_PUBLISHABLE_KEY is missing or is still the placeholder value; set a real ' +
    'Clerk test-instance publishable key to run the e2e smoke test.'
)

const TEST_EMAIL = 'smoke+clerk_test@example.com'
const TEST_OTP = '424242'
const JWT_RE = /^[\w-]+\.[\w-]+\.[\w-]+$/

test('sign in, get a token, sign out', async ({ page }) => {
  // (a) page loads and boot sends stateChanged -> signedOut
  await page.goto('/')
  await expect(page.getByTestId('state')).toHaveText('signedOut', { timeout: 15_000 })

  // (b) click sign-in, Clerk's mounted SignIn appears inline (#clerk-sign-in),
  // sign in using Clerk test mode.
  await page.getByTestId('sign-in').click()

  const signIn = page.locator('#clerk-sign-in')
  const emailInput = signIn.locator('input[name="identifier"]')
  await expect(emailInput).toBeVisible({ timeout: 15_000 })
  await emailInput.fill(TEST_EMAIL)
  // Clerk's form also contains a hidden submit button, so target by role/name.
  await signIn.getByRole('button', { name: 'Continue', exact: true }).click()

  // Clerk renders the email code as a one-time-code input (per-digit boxes
  // backed by one hidden input). Fill whichever variant is present.
  const otpInput = signIn
    .locator('input[autocomplete="one-time-code"]')
    .or(signIn.locator('input[name="codeInput-0"]'))
    .first()
  await expect(otpInput).toBeAttached({ timeout: 15_000 })
  await otpInput.fill(TEST_OTP)

  await expect(page.getByTestId('state')).toHaveText('signedIn', { timeout: 15_000 })
  await expect(page.getByTestId('user-email')).toContainText(TEST_EMAIL)

  // (c) click get-token, token text matches a JWT shape.
  await page.getByTestId('get-token').click()
  await expect(page.getByTestId('token')).toHaveText(JWT_RE, { timeout: 15_000 })

  // (d) click sign-out, state returns to signedOut.
  await page.getByTestId('sign-out').click()
  await expect(page.getByTestId('state')).toHaveText('signedOut', { timeout: 15_000 })
})
