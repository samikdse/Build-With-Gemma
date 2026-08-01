/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMMA_BASE_URL?: string;
  readonly VITE_GEMMA_MODEL?: string;
  readonly VITE_EMBED_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
