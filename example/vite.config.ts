import { defineConfig, loadEnv } from 'vite'
import elmPlugin from 'vite-plugin-elm'

// Root .env (not example/.env) is the single source of truth for local
// secrets, per repo convention (see ../.env.example). `envDir: '..'` plus
// `loadEnv(mode, '..', '')` both point Vite at that file: the second arg
// makes Vite's own `import.meta.env` loading read it too, and the explicit
// `loadEnv` call here lets us remap `CLERK_PUBLISHABLE_KEY` (unprefixed, so
// it isn't picked up by `envPrefix` on its own) onto the `VITE_`-prefixed
// name the app actually reads.
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, '..', '')
  const port = Number(process.env.EXAMPLE_PORT ?? 5173)

  return {
    envDir: '..',
    envPrefix: ['VITE_'],
    plugins: [elmPlugin()],
    server: { port },
    preview: { port },
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(
        rootEnv.CLERK_PUBLISHABLE_KEY ?? ''
      ),
    },
  }
})
