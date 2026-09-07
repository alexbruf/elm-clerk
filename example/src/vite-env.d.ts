/// <reference types="vite/client" />

declare module '*.elm' {
  const Elm: {
    Main: {
      init: (options: { node?: HTMLElement | null; flags?: unknown }) => {
        ports?: Record<string, { subscribe?: (cb: (value: unknown) => void) => void; send?: (value: unknown) => void }>
      }
    }
  }
  export { Elm }
}

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
