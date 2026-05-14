/// <reference types="vite/client" />

// Project-specific Vite env vars. Extending Vite's ImportMetaEnv keeps
// `import.meta.env.VITE_*` lookups strongly typed everywhere they're used.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_TOLGEE_API_URL?: string;
  readonly VITE_TOLGEE_API_KEY?: string;
  readonly VITE_TOLGEE_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
